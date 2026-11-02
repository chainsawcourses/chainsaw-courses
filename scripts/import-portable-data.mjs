import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Intentionally a different variable from the running app's DATABASE_URL.
if (process.env.RECOVERY_IMPORT_CONFIRM !== "isolated-empty-database" || !process.env.RECOVERY_DATABASE_URL) {
  throw new Error("Set RECOVERY_DATABASE_URL and RECOVERY_IMPORT_CONFIRM=isolated-empty-database for a NEW EMPTY target only");
}
const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/import-portable-data.mjs private-portable-export-folder");
const hash = b => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile(path.join(input, "manifest.json")));
if (manifest.format !== "chainsaw-portable" || manifest.version !== 1) throw new Error("Unsupported portable manifest");
const bytes = {};
for (const name of ["data.json", "restore-postgresql.sql"]) {
  bytes[name] = await readFile(path.join(input, name));
  const f = manifest.files.find(f => f.name === name);
  if (!f || f.bytes !== bytes[name].length || f.sha256 !== hash(bytes[name])) throw new Error("Backup checksum mismatch");
}
const data = JSON.parse(bytes["data.json"]);
if (data.format !== "chainsaw-portable" || data.version !== 1 ||
    data.capturedAt !== manifest.capturedAt || data.tables.length !== manifest.tableCount) throw new Error("Mismatched backup set");
const { Client } = createRequire(new URL("../lib/db/package.json", import.meta.url))("pg");
const client = new Client({ connectionString: process.env.RECOVERY_DATABASE_URL });
const quote = s => `"${s.replaceAll('"', '""')}"`;
await client.connect();
try {
  // Check ALL public tables, not just the exported names. Never overwrite data.
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  if (!tables.length) throw new Error("Create the current application schema before importing");
  for (const t of tables) {
    if (+(await client.query(`SELECT count(*) FROM public.${quote(t.tablename)}`)).rows[0].count !== 0) {
      throw new Error("Target is not empty; import refused");
    }
  }
  await client.query(bytes["restore-postgresql.sql"].toString());
  const refs = (await client.query("SELECT t.relname AS child,p.relname AS parent FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class p ON p.oid=c.confrelid WHERE c.contype='f' AND c.connamespace='public'::regnamespace")).rows;
  const pending = [...data.tables], done = new Set(); let rows = 0;
  await client.query("BEGIN");
  try {
    while (pending.length) {
      const i = pending.findIndex(t => refs.filter(r => r.child === t.name).every(r => done.has(r.parent)));
      if (i < 0) throw new Error("Cyclic or missing parent relationship");
      const [t] = pending.splice(i, 1), columns = t.columns.map(c => quote(c.name)).join(",");
      await client.query(`INSERT INTO public.${quote(t.name)} (${columns}) OVERRIDING SYSTEM VALUE SELECT ${columns} FROM chainsaw_backup_import.${quote(t.name)}`);
      for (const column of t.columns.filter(c => c.identity)) {
        const seq = (await client.query("SELECT pg_get_serial_sequence($1,$2) AS seq", [`public.${quote(t.name)}`, column.name])).rows[0].seq;
        if (seq) await client.query(`SELECT setval($1, GREATEST(COALESCE(MAX(${quote(column.name)}),1),1),COUNT(*)>0) FROM public.${quote(t.name)}`, [seq]);
      }
      const select = schema => `SELECT to_jsonb(r) AS row FROM (SELECT ${columns} FROM ${schema}.${quote(t.name)}) r`;
      const diff = await client.query(`SELECT count(*) FROM ((${select("public")} EXCEPT ALL ${select("chainsaw_backup_import")}) UNION ALL (${select("chainsaw_backup_import")} EXCEPT ALL ${select("public")})) d`);
      if (+diff.rows[0].count !== 0) throw new Error("Restored cell comparison failed");
      done.add(t.name); rows += t.rows.length;
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  console.log(JSON.stringify({ tables: done.size, rows, everyCellMatched: true, capturedAt: data.capturedAt }));
} finally { await client.end(); }
