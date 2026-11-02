import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { portableRestoreSql, capturePortableTables } from "../src/lib/portableBackup.ts";
import { fixture } from "./portable-backup.test.ts";

test("portable export restores exact values, constraints and identity counters in PostgreSQL", {
  skip: process.env.RUN_PORTABLE_RESTORE_TEST !== "1",
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Never run the restoration rehearsal in production");
  const require = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
  const { Client } = require("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `portable_test_${Date.now()}`;
  try {
    await client.query(portableRestoreSql(fixture, schema).replace(/COMMIT;\s*$/, ""));
    const { rows } = await client.query(`SELECT name, balance::text, progress FROM "${schema}".learners`);
    assert.equal(rows[0].name, "O'Brien \\ Unicode 漢字");
    assert.equal(rows[0].balance, "123456789012345678901.1234");
    assert.deepEqual(rows[0].progress, { completed: true, score: 0, empty: null });
    const inserted = await client.query(`INSERT INTO "${schema}".learners(name) VALUES ('Next') RETURNING id`);
    assert.equal(inserted.rows[0].id, 43);
    await client.query("ROLLBACK");
    // Rehearse the complete development export without logging private row values.
    const source = readFileSync(new URL("../src/lib/fullBackup.ts", import.meta.url), "utf8");
    const declaration = source.match(/BACKUP_TABLES = \[([\s\S]*?)\] as const/)?.[1];
    assert.ok(declaration);
    const names = [...declaration.matchAll(/"([a-z_]+)"/g)].map(match => match[1]);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = await capturePortableTables(client, names);
    await client.query("ROLLBACK");
    assert.equal(tables.length, names.length);
    assert.ok(tables.every(table => table.columns.length > 0 && Array.isArray(JSON.parse(table.rowsJson))));
    await client.query(portableRestoreSql(tables, schema).replace(/COMMIT;\s*$/, ""));
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::int AS count FROM "${schema}"."${table.name}"`);
      assert.equal(result.rows[0].count, JSON.parse(table.rowsJson).length, table.name);
    }
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
