/**
 * Explicit, read-only-source restore rehearsal. Run via scripts/check-full-backup-restore.mjs.
 * Only the private, local PostgreSQL cluster is written; temporary archives are removed.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createFullBackup } from "../src/lib/fullBackup";
import { decryptAndVerifyBackup, restoreAndCompare } from "../src/lib/verifyFullBackup";
import { releaseBackupAdvisoryLock, tryAcquireBackupAdvisoryLock } from "../src/lib/backupAdvisoryLock";

const requireDb = createRequire(path.resolve("lib/db/package.json"));
const { Client } = requireDb("pg") as typeof import("pg");
const temp = mkdtempSync(path.join(tmpdir(), "backup-verify-"));
const port = 30000 + Math.floor(Math.random() * 25000);
const name = "backup_verify_restored";
const sourceName = "backup_verify_source";
const originalDatabaseUrl = process.env.DATABASE_URL;
const run = (command: string, args: string[]) => execFileSync(command, args, {
  stdio: ["ignore", "pipe", "pipe"], env: process.env,
});
let started = false;
try {
  if (!process.env.DATABASE_URL) throw new Error("Development source DB required");
  const passphrase = randomBytes(32).toString("hex");
  run("initdb", ["-D", path.join(temp, "db"), "-A", "trust", "--no-instructions"]);
  run("pg_ctl", ["-D", path.join(temp, "db"), "-o", `-k ${temp} -p ${port} -h ''`, "-l", path.join(temp, "postgres.log"), "start"]);
  started = true;
  for (const database of [sourceName, name]) {
    run("createdb", ["-U", process.env.USER || "runner", "-h", temp, "-p", String(port), database]);
  }
  const lockOwner = new Client({ host: temp, port, database: sourceName, user: process.env.USER || "runner" });
  const lockContender = new Client({ host: temp, port, database: sourceName, user: process.env.USER || "runner" });
  await Promise.all([lockOwner.connect(), lockContender.connect()]);
  try {
    if (!await tryAcquireBackupAdvisoryLock(lockOwner as never)) throw new Error("First backup lock acquisition failed");
    if (await tryAcquireBackupAdvisoryLock(lockContender as never)) throw new Error("Concurrent backup was not blocked");
    await releaseBackupAdvisoryLock(lockOwner as never);
    if (!await tryAcquireBackupAdvisoryLock(lockContender as never)) throw new Error("Backup lock was not released");
    await releaseBackupAdvisoryLock(lockContender as never);
  } finally {
    await Promise.all([lockOwner.end(), lockContender.end()]);
  }
  const schema = path.join(temp, "schema.sql");
  run("pg_dump", ["--schema-only", "--no-owner", "--no-acl", "-f", schema, process.env.DATABASE_URL]);
  for (const database of [sourceName, name]) {
    run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-U", process.env.USER || "runner", "-h", temp, "-p", String(port), "-d", database, "-f", schema]);
  }
  const sourceClient = new Client({ host: temp, port, database: sourceName, user: process.env.USER || "runner" });
  await sourceClient.connect();
  try {
    await sourceClient.query(`INSERT INTO users (id, activation_code, full_name, email, device_id)
      VALUES (51, 'RESTORE-TEST', 'Backup Test Learner', 'backup-test@example.invalid', 'test-only')`);
    await sourceClient.query(`INSERT INTO course_enrolments
      (id, user_id, purchase_code, activation_code, certificate_issued_at)
      VALUES (73, 51, 'RESTORE-TEST', 'RESTORE-TEST', NOW())`);
    await sourceClient.query("UPDATE users SET current_enrollment_id=73 WHERE id=51");
    await sourceClient.query(`INSERT INTO inspection_records (id, user_id, saw_identifier, items)
      VALUES (82, 51, 'TEST-SAW', '[]')`);
    await sourceClient.query(`INSERT INTO risk_assessments (id, user_id, task_description, hazards)
      VALUES (93, 51, 'Test task', '[]')`);
    await sourceClient.query(`INSERT INTO website_purchase_seats (id, order_id, line_item_id, seat_id, status)
      OVERRIDING SYSTEM VALUE VALUES (110, 'test-order', 'test-line', 'test-seat', 'pending')`);
  } finally {
    await sourceClient.end();
  }
  // Backup generation is pointed at this isolated fixture, never at the
  // development connection from which schema-only DDL was read.
  process.env.DATABASE_URL = `postgresql:///${sourceName}?host=${encodeURIComponent(temp)}&port=${port}&user=${process.env.USER || "runner"}`;

  const uploadedFiles = new Map<string, Buffer>();
  let nextFileId = 0;
  const drive = {
    proxy: async (_service: string, url: string, request: { method: string; body?: string | Buffer }) => {
      const result = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
      if (url.includes("pageSize=")) return result({ files: [{ id: "isolated-test-folder" }] });
      if (request.method === "POST") return result({ id: `isolated-test-file-${++nextFileId}` });
      if (url.includes("/upload/")) {
        if (!Buffer.isBuffer(request.body)) throw new Error("Expected encrypted bytes");
        const fileId = url.match(/\/files\/([^?]+)/)?.[1];
        if (!fileId) throw new Error("Expected a distinct Drive file ID");
        uploadedFiles.set(fileId, request.body);
        return result({ id: fileId });
      }
      if (request.method === "GET") {
        const fileId = url.match(/\/files\/([^?]+)/)?.[1];
        const ciphertext = fileId ? uploadedFiles.get(fileId) : undefined;
        if (!ciphertext || !fileId) throw new Error("Drive verification could not find uploaded bytes");
        return result({
          id: fileId, size: String(ciphertext.length),
          md5Checksum: createHash("md5").update(ciphertext).digest("hex"),
        });
      }
      const fileId = url.match(/\/files\/([^?]+)/)?.[1] ?? "isolated-test-file";
      return result({ id: fileId });
    },
  };
  const source = await createFullBackup(passphrase, drive as never);
  const fullFileId = source.url.match(/\/d\/([^/]+)\//)?.[1];
  const ciphertext = fullFileId ? uploadedFiles.get(fullFileId) : undefined;
  if (!ciphertext) throw new Error("No full encrypted archive produced");
  const verified = await decryptAndVerifyBackup(ciphertext, passphrase);
  if (createHash("sha256").update(ciphertext).digest("hex") !== source.sha256 ||
      JSON.stringify(verified.counts) !== JSON.stringify(source.counts)) {
    throw new Error("Archive hash or category totals do not match source");
  }
  if (source.categories.length !== 5) throw new Error("Not all category archives were produced");
  for (const category of source.categories) {
    const fileId = category.url.match(/\/d\/([^/]+)\//)?.[1];
    const categoryBytes = fileId ? uploadedFiles.get(fileId) : undefined;
    if (!categoryBytes || createHash("sha256").update(categoryBytes).digest("hex") !== category.sha256) {
      throw new Error(`Category archive hash differs: ${category.key}`);
    }
    const categoryBackup = await decryptAndVerifyBackup(categoryBytes, passphrase);
    if (categoryBackup.scope !== "category" || categoryBackup.category !== category.key ||
        JSON.stringify(categoryBackup.counts) !== JSON.stringify(category.counts)) {
      throw new Error(`Category archive verification failed: ${category.key}`);
    }
  }
  const client = new Client({ host: temp, port, database: name, user: process.env.USER || "runner" });
  await client.connect();
  try {
    await restoreAndCompare(client as never, verified);
    // Check identity preservation, not just counts, including sparse IDs.
    for (const [table, rows] of verified.tables) {
      if (!rows.length || !Object.hasOwn(rows[0], "id")) continue;
      const actual = (await client.query(`SELECT id FROM "${table}" ORDER BY id`)).rows.map(r => String(r.id));
      const expected = rows.map(r => String(r.id)).sort((a, b) => Number(a) - Number(b));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`IDs differ: ${table}`);
    }
    for (const [table, records] of verified.tables) {
      const hasId = (await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'", [table],
      )).rows.length > 0;
      if (!hasId) continue;
      const seq = (await client.query("SELECT pg_get_serial_sequence($1, 'id') AS seq", [`public.${table}`])).rows[0].seq;
      if (seq) {
        const { rows } = await client.query("SELECT last_value, is_called FROM " + seq);
        const max = Math.max(0, ...records.map(r => Number(r.id)));
        if (Number(rows[0].last_value) !== Math.max(1, max) || rows[0].is_called !== (max > 0)) {
          throw new Error(`Sequence differs: ${table}`);
        }
      }
    }
    console.log("Disposable restore verified:", verified.counts,
      "representative certificate/inspection/risk PDFs opened where present");
  } finally {
    await client.end();
  }
  const { pool } = await import("@workspace/db");
  await pool.end();
} finally {
  process.env.DATABASE_URL = originalDatabaseUrl;
  if (started) run("pg_ctl", ["-D", path.join(temp, "db"), "-m", "immediate", "stop"]);
  rmSync(temp, { recursive: true, force: true });
}