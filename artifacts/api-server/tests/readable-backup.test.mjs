import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const apiDir = fileURLToPath(new URL("../", import.meta.url));
const tempDir = await mkdtemp(path.join(apiDir, ".readable-backup-test-"));
const bundlePath = path.join(tempDir, "readableBackup.mjs");
await build({
  entryPoints: [path.join(apiDir, "src/lib/readableBackup.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["@workspace/db", "@replit/connectors-sdk", "@google-cloud/storage", "pdfkit"],
  plugins: [{
    name: "stub-database-for-readable-backup-tests",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@workspace\/db$/ }, () => ({
        path: "workspace-db-test-stub",
        namespace: "workspace-db-test-stub",
      }));
      buildContext.onLoad({ filter: /.*/, namespace: "workspace-db-test-stub" }, () => ({
        contents: [
          "export const pool = { query: async () => { throw new Error('Database stub must not be called in these unit tests'); } };",
          "export const db = {};",
          "export const activationCodesTable = {};",
          "export const courseEnrolmentsTable = {};",
          "export const examAttemptsTable = {};",
          "export const moduleFeedbackTable = {};",
          "export const quizAttemptsTable = {};",
          "export const userProgressTable = {};",
          "export const usersTable = {};",
          "export const videoEngagementTable = {};",
          "export const waiversTable = {};",
        ].join("\n"),
        loader: "js",
      }));
    },
  }],
});
const { buildReadableTableGrid, generateWaiverPdf, writeReadableSpreadsheet, createReadableBackup, uploadPlainFile } =
  await import(pathToFileURL(bundlePath).href);

test("lost backup ownership stops work before any database reads or Drive uploads", async () => {
  let driveCalls = 0;
  await assert.rejects(createReadableBackup({
    proxy: async () => { driveCalls++; throw new Error("Unexpected Drive call"); },
  }, () => { throw new Error("The backup database connection was interrupted."); }),
  /backup database connection was interrupted/);
  assert.equal(driveCalls, 0);
});

test("unchanged PDF source skips uploads and never marks an existing file for cleanup", async () => {
  const calls = [];
  const drive = { proxy: async (_service, url, req) => {
    calls.push(req.method);
    return new Response(JSON.stringify({ files: [{ id: "existing", name: "User 12 - Signed Waiver - Enrolment 3.pdf", md5Checksum: "verified", appProperties: { sourceHash: "same-source", verifiedMd5: "verified" } }] }));
  } };
  const created = [];
  const file = await uploadPlainFile(drive, "folder", "Example - User 12 - Signed Waiver - Enrolment 3.pdf", "application/pdf", Buffer.from("new PDF creation metadata"), created, "same-source");
  assert.equal(file.id, "existing");
  assert.deepEqual(calls, ["GET"]);
  assert.deepEqual(created, []);
});

test("changed progress updates the existing file and verifies it without creating another", async () => {
  const { createHash } = await import("node:crypto");
  const bytes = Buffer.from("new progress");
  const methods = [];
  const drive = { proxy: async (_service, url, req) => {
    methods.push(req.method);
    if (url.includes("?q=")) return new Response(JSON.stringify({ files: [{ id: "progress", name: "User 12 - Progress - 2026-10-26T21-33-28-123Z.csv", md5Checksum: "old" }] }));
    if (url.includes("fields=id,size")) return new Response(JSON.stringify({ id: "progress", size: String(bytes.length), md5Checksum: createHash("md5").update(bytes).digest("hex") }));
    return new Response(JSON.stringify({ id: "progress" }));
  } };
  const created = [];
  assert.equal((await uploadPlainFile(drive, "folder", "Example - User 12 - Progress.csv", "text/csv", bytes, created)).id, "progress");
  assert.ok(!methods.includes("POST"));
  assert.deepEqual(created, []);
  const previousCalls = methods.length;
  await uploadPlainFile(drive, "folder", "Example - User 12 - Progress.csv", "text/csv", bytes, created);
  assert.equal(methods.length, previousCalls, "same-run repeat must skip unchanged content");
});

test("existing workbook updates its existing tabs without creating a file or duplicate tabs", async () => {
  const requests = [];
  const drive = { proxy: async (service, url, req) => {
    requests.push({ service, url, ...req });
    let result = {};
    if (url.includes("?q=")) result = { files: [{ id: "workbook", name: "Chainsaw Courses Full Data — 2026-10-26T21-33-28-123Z" }] };
    else if (url.includes("fields=sheets.properties(sheetId,title)")) result = { sheets: [{ properties: { sheetId: 0, title: "Overview" } }, { properties: { sheetId: 1000, title: "users" } }] };
    else if (url.includes("fields=sheets.properties.title")) result = { sheets: [{ properties: { title: "Overview" } }, { properties: { title: "users" } }] };
    return new Response(JSON.stringify(result));
  } };
  const created = [];
  await writeReadableSpreadsheet(drive, "folder", "Chainsaw Courses Full Data", [["Updated", "now"]], [{ name: "users", columns: ["id"], rows: [{ id: 1 }] }], created);
  assert.deepEqual(created, []);
  assert.ok(!requests.some(r => r.service === "google-drive" && r.method === "POST"));
  const batch = requests.find(r => r.url.endsWith(":batchUpdate") && !r.url.includes("/values"));
  const updates = JSON.parse(batch.body).requests;
  assert.ok(!updates.some(r => r.addSheet));
  assert.equal(updates.filter(r => r.updateCells).length, 2, "clears stale rows in existing tabs before replacement");
});

test("database rows become readable spreadsheet cells, with oversized fields preserved in parts", () => {
  const longValue = "x".repeat(40_001);
  const grid = buildReadableTableGrid(
    ["id", "empty", "date", "payload", "long_value"],
    [{
      id: 42,
      empty: null,
      date: new Date("2026-10-19T10:00:00.000Z"),
      payload: { nested: true },
      long_value: longValue,
    }],
  );

  assert.deepEqual(grid[0], [
    "id", "empty", "date", "payload",
    "long_value (part 1; join in order)", "long_value (part 2; join in order)",
  ]);
  assert.equal(grid[1][0], 42);
  assert.equal(grid[1][1], "");
  assert.equal(grid[1][2], "2026-10-19T10:00:00.000Z");
  assert.equal(grid[1][3], "{\"nested\":true}");
  assert.equal(String(grid[1][4]).length, 40_000);
  assert.equal(String(grid[1][4]) + String(grid[1][5]), longValue);
  assert.deepEqual(buildReadableTableGrid(["id", "value"], []), [["id", "value"]]);
});

test("native Google Sheets exports use RAW values, create data tabs, and verify them", async () => {
  const calls = [];
  const tabTitles = ["Sheet1"];
  let rateLimitedValueWrite = false;
  const fakeDrive = {
    proxy: async (service, url, request) => {
      calls.push({ service, url, request });
      let value = {};
      if (service === "google-drive" && request.method === "POST") {
        value = { id: "sheet-readable-1" };
      } else if (service === "google-sheet" && url.includes("fields=sheets.properties(sheetId,title)")) {
        value = { sheets: [{ properties: { sheetId: 7 } }] };
      } else if (service === "google-sheet" && url.endsWith("/values:batchUpdate")) {
        if (!rateLimitedValueWrite) {
          rateLimitedValueWrite = true;
          return new Response(JSON.stringify({ error: "rate limited" }), {
            status: 429,
            headers: { "Retry-After": "0", "Content-Type": "application/json" },
          });
        }
      } else if (service === "google-sheet" && url.endsWith(":batchUpdate")) {
        const body = JSON.parse(String(request.body ?? "{}"));
        for (const item of body.requests) {
          const title = item.addSheet?.properties?.title ?? item.updateSheetProperties?.properties?.title;
          if (title) {
            const existing = tabTitles.indexOf(title);
            if (existing >= 0) tabTitles.splice(existing, 1);
            tabTitles.push(title);
          }
        }
      } else if (service === "google-sheet" && url.includes("fields=sheets.properties.title")) {
        value = { sheets: tabTitles.map((title) => ({ properties: { title } })) };
      }
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
  const uploaded = [];
  const spreadsheet = await writeReadableSpreadsheet(
    fakeDrive,
    "weekly-folder",
    "Chainsaw Courses Full Data — 2026",
    [["Backup", "Details"], ["Format", "Readable"]],
    [{
      name: "users",
      columns: ["id", "display_name"],
      rows: [{ id: 7, display_name: "=HYPERLINK(\"https://example.invalid\")" }],
    }],
    uploaded,
  );

  assert.equal(spreadsheet.id, "sheet-readable-1");
  assert.equal(spreadsheet.url, "https://docs.google.com/spreadsheets/d/sheet-readable-1/edit");
  assert.deepEqual(uploaded, ["sheet-readable-1"]);
  assert.ok(tabTitles.includes("Overview"));
  assert.ok(tabTitles.includes("users"));
  const valueWrites = calls.filter(({ service, url }) =>
    service === "google-sheet" && url.endsWith("/values:batchUpdate"));
  assert.equal(valueWrites.length, 2, "the bounded values batch should retry after a rate limit");
  assert.ok(valueWrites.every(({ request }) => request.method === "POST"));
  const written = JSON.parse(String(valueWrites[1].request.body));
  assert.equal(written.valueInputOption, "RAW");
  assert.equal(written.data.length, 2, "Overview and table values are sent together");
  const usersRange = written.data.find((item) => item.range.includes("users"));
  assert.equal(usersRange.values[1][1], "=HYPERLINK(\"https://example.invalid\")");
  assert.ok(calls.some(({ service, url }) => service === "google-drive" && url.startsWith("/drive/v3/files?fields=id")));
});

test("signed waiver PDFs contain a readable PDF and support missing clause snapshots", async () => {
  const pdf = await generateWaiverPdf({
    user_id: 12,
    enrollment_id: 34,
    signed_at: new Date("2026-10-19T10:00:00.000Z"),
    agreed_to_terms: true,
    signature_data: null,
    clauses_snapshot: JSON.stringify([{ number: "1", title: "Training", text: "I understand the training conditions." }]),
  }, { full_name: "Test Learner", email: "learner@example.test" });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1_000);

  const fallbackPdf = await generateWaiverPdf({
    user_id: 12, enrollment_id: 34, signed_at: new Date(),
    signature_data: null, clauses_snapshot: null,
  }, undefined);
  assert.equal(fallbackPdf.subarray(0, 5).toString(), "%PDF-");
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
