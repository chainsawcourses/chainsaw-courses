import { createDecipheriv, createHash, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { BACKUP_CATEGORIES, BACKUP_TABLES, type BackupCounts } from "./fullBackup.ts";

const scrypt = promisify(scryptCallback);
type Row = Record<string, unknown>;
type Entry = { path: string; sha256: string; encoding: "json" | "base64"; data: unknown };
type RestoreClient = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, any>[] }> };
export type VerifiedBackup = {
  scope: "full" | "category";
  category?: string;
  tables: Map<string, Row[]>;
  counts: BackupCounts;
  documents: Map<string, Buffer>;
};

export async function decryptAndVerifyBackup(bytes: Buffer, passphrase: string): Promise<VerifiedBackup> {
  if (bytes.length < 49 || bytes.subarray(0, 4).toString() !== "CBK1") throw new Error("Invalid CBK1 backup header");
  const key = await scrypt(passphrase, bytes.subarray(4, 20), 32) as Buffer;
  let plain: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(20, 32));
    decipher.setAuthTag(bytes.subarray(-16));
    plain = Buffer.concat([decipher.update(bytes.subarray(32, -16)), decipher.final()]);
  } finally {
    key.fill(0);
  }
  const lines = gunzipSync(plain).toString("utf8").trimEnd().split("\n");
  const entries = new Map<string, unknown>();
  for (const line of lines) {
    const entry = JSON.parse(line) as Entry;
    if (typeof entry.path !== "string" || entries.has(entry.path) ||
        typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error("Invalid or duplicate backup entry");
    }
    let data: unknown;
    let content: Buffer;
    if (entry.encoding === "base64" && typeof entry.data === "string" &&
        entry.data.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(entry.data)) {
      content = Buffer.from(entry.data, "base64");
      if (content.toString("base64") !== entry.data) throw new Error(`Invalid base64: ${entry.path}`);
      data = content;
    } else if (entry.encoding === "json") {
      content = Buffer.from(JSON.stringify(entry.data));
      data = entry.data;
    } else {
      throw new Error(`Invalid encoding for ${entry.path}`);
    }
    if (createHash("sha256").update(content).digest("hex") !== entry.sha256) {
      throw new Error(`Checksum mismatch: ${entry.path}`);
    }
    entries.set(entry.path, data);
  }
  const manifest = entries.get("manifest.json") as {
    format?: string;
    scope?: "full" | "category";
    category?: string;
    tables?: string[];
  } | undefined;
  const category = manifest?.scope === "category"
    ? BACKUP_CATEGORIES.find((item) => item.key === manifest.category)
    : undefined;
  const expectedTables = manifest?.scope === "full" ? BACKUP_TABLES : category?.tables;
  if (manifest?.format !== "chainsaw-backup-v1" || !expectedTables ||
      JSON.stringify(manifest.tables) !== JSON.stringify(expectedTables)) throw new Error("Incompatible backup manifest");
  const tables = new Map<string, Row[]>();
  const counts: BackupCounts = { tables: 0, records: 0, learners: 0, certificates: 0, inspections: 0, risks: 0 };
  for (const table of expectedTables) {
    const rows = entries.get(`data/${table}.json`);
    if (!Array.isArray(rows) || !rows.every(row => row && typeof row === "object" && !Array.isArray(row))) {
      throw new Error(`Missing or invalid table: ${table}`);
    }
    tables.set(table, rows as Row[]);
    counts.tables++;
    counts.records += rows.length;
  }
  counts.learners = tables.get("users")?.length ?? 0;
  const users = tables.get("users") ?? [];
  const enrolments = tables.get("course_enrolments") ?? [];
  const includesCertificates = manifest.scope === "full" || manifest.category === "user-certificates";
  const expectedCertificates = includesCertificates ? [
    ...enrolments.filter(row => row.certificate_issued_at && !row.is_deleted).map(row => `documents/certificates/enrolment-${row.id}.pdf`),
    ...users.filter(row => row.certificate_issued_at && !enrolments.some(e => e.user_id === row.id && e.certificate_issued_at && !e.is_deleted))
      .map(row => `documents/certificates/legacy-user-${row.id}.pdf`),
  ] : [];
  const inspections = manifest.scope === "full" || manifest.category === "inspections"
    ? tables.get("inspection_records") ?? []
    : [];
  const risks = manifest.scope === "full" || manifest.category === "risk-assessments"
    ? tables.get("risk_assessments") ?? []
    : [];
  const expectedDocuments = [
    ...expectedCertificates,
    ...inspections.map(row => `documents/inspections/${row.id}.pdf`),
    ...risks.map(row => `documents/risks/${row.id}.pdf`),
  ];
  const documents = new Map<string, Buffer>();
  for (const [name, value] of entries) {
    if (!name.startsWith("documents/")) continue;
    if (!Buffer.isBuffer(value) || value.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Invalid PDF: ${name}`);
    documents.set(name, value);
  }
  const expected = new Set(["manifest.json", ...expectedTables.map(t => `data/${t}.json`), ...expectedDocuments]);
  if (expected.size !== entries.size || [...entries.keys()].some(name => !expected.has(name))) {
    throw new Error("Backup entries do not match table records");
  }
  counts.certificates = expectedCertificates.length;
  counts.inspections = inspections.length;
  counts.risks = risks.length;
  for (const category of ["certificates", "inspections", "risks"]) {
    const sample = [...documents].find(([name]) => name.startsWith(`documents/${category}/`));
    if (sample) {
      const pdf = await PDFDocument.load(sample[1]);
      if (!pdf.getPageCount()) throw new Error(`Empty PDF: ${sample[0]}`);
    }
  }
  return { scope: manifest!.scope!, ...(manifest.category ? { category: manifest.category } : {}), tables, counts, documents };
}

/** Only call with a disposable database client. Never pass the source database connection. */
export async function restoreAndCompare(client: RestoreClient, backup: VerifiedBackup): Promise<void> {
  if (backup.scope !== "full") throw new Error("Only a full archive can be restored as a complete application backup");
  const target = await client.query("SELECT current_database() AS name, inet_server_addr() AS address");
  if (!String(target.rows[0].name).startsWith("backup_verify_") || target.rows[0].address !== null) {
    throw new Error("Restore requires a disposable local-socket backup_verify_ database");
  }
  await client.query("BEGIN");
  try {
    // The source uses circular references (users.current_enrollment_id); validate
    // relationships after all rows are loaded rather than relying on insert order.
    await client.query("SET LOCAL session_replication_role = replica");
    for (const [table, rows] of backup.tables) {
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const metadata = (await client.query(
        "SELECT column_name, identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table],
      )).rows;
      const names = metadata.map(r => r.column_name as string);
      if (columns.length !== names.length || columns.some(c => !names.includes(c)) ||
          rows.some(row => Object.keys(row).length !== columns.length || columns.some(c => !(c in row)))) {
        throw new Error(`Schema mismatch: ${table}`);
      }
      const quoted = columns.map(c => `"${c.replaceAll('"', '""')}"`).join(",");
      const overrideIdentity = metadata.some(m => m.identity_generation === "ALWAYS" && columns.includes(m.column_name))
        ? " OVERRIDING SYSTEM VALUE" : "";
      for (const row of rows) {
        await client.query(
          `INSERT INTO "${table}" (${quoted})${overrideIdentity} VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`,
          columns.map(c => row[c]),
        );
      }
    }
    for (const [table, rows] of backup.tables) {
      const result = await client.query(`SELECT count(*)::int AS total FROM "${table}"`);
      if (result.rows[0].total !== rows.length) throw new Error(`Row count mismatch: ${table}`);
      const idColumn = await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'", [table],
      );
      if (!idColumn.rows.length) continue;
      const seq = await client.query("SELECT pg_get_serial_sequence($1, 'id') AS seq", [`public.${table}`]);
      if (seq.rows[0].seq) {
        const max = await client.query(`SELECT max(id) AS id FROM "${table}"`);
        await client.query("SELECT setval($1::regclass, $2, $3)", [seq.rows[0].seq, max.rows[0].id ?? 1, max.rows[0].id !== null]);
      }
    }
    // Validate both declared FKs and the application's unconstrained learner IDs.
    const refs = await client.query(`
      SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent,
        a.attname AS child_col, b.attname AS parent_col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
      WHERE c.contype='f' AND array_length(c.conkey,1)=1 AND c.connamespace='public'::regnamespace
    `);
    for (const ref of refs.rows) {
      const { child, parent, child_col, parent_col } = ref;
      const missing = await client.query(`SELECT count(*)::int AS total FROM "${child}" c
        WHERE c."${child_col}" IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM "${parent}" p WHERE p."${parent_col}" = c."${child_col}")`);
      if (missing.rows[0].total) throw new Error(`Orphaned relationship: ${child}.${child_col}`);
    }
    const learnerColumns = await client.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema='public' AND column_name IN ('user_id', 'enrollment_id')
    `);
    for (const [child, column, parent] of [
      ...learnerColumns.rows.filter(r => backup.tables.has(r.table_name)).map(r =>
        [r.table_name, r.column_name, r.column_name === "user_id" ? "users" : "course_enrolments"]),
      ["users", "current_enrollment_id", "course_enrolments"],
    ]) {
      const missing = await client.query(`SELECT count(*)::int AS total FROM "${child}" c
        WHERE c."${column}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE p.id=c."${column}")`);
      if (missing.rows[0].total) throw new Error(`Orphaned relationship: ${child}.${column}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}