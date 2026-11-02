import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { gzipSync } from "node:zlib";
import { BACKUP_CATEGORIES, BACKUP_TABLES, encryptBackupEntries, uploadVerifiedBackup } from "../src/lib/fullBackup.ts";
import { decryptAndVerifyBackup, restoreAndCompare } from "../src/lib/verifyFullBackup.ts";

const bytes = Buffer.from("encrypted-only-test-content");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const counts = { tables: 2, records: 4, learners: 1, certificates: 1, inspections: 0, risks: 0 };

test("category archives use the requested existing Drive folder names", () => {
  assert.deepEqual(
    BACKUP_CATEGORIES.map(category => category.folderName),
    ["Feedback", "Inspections", "Risk Assessments", "User Certificates", "Progress Backup"],
  );
});

function fakeDrive(options: { badChecksum?: boolean; uploadFails?: boolean; missingFolder?: boolean; deleteFails?: boolean } = {}) {
  const calls: Array<{ url: string; method: string }> = [];
  const requestBodies: Array<string | Buffer | undefined> = [];
  return {
    calls,
    requestBodies,
    proxy: async (_service: string, url: string, request: { method: string; body?: string | Buffer }) => {
      calls.push({ url, method: request.method });
      requestBodies.push(request.body);
      const respond = (status: number, data: unknown = {}) => ({
        ok: status >= 200 && status < 300, status,
        json: async () => data,
      });
      if (url.includes("pageSize=")) return respond(200, { files: options.missingFolder ? [] : [{ id: "private-folder" }] });
      if (request.method === "POST") return respond(200, { id: "temporary-id" });
      if (url.includes("/upload/")) {
        assert.ok(Buffer.isBuffer(request.body));
        return respond(options.uploadFails ? 500 : 200, { id: "temporary-id" });
      }
      if (request.method === "GET") return respond(200, {
        id: "temporary-id", size: String(bytes.length),
        md5Checksum: options.badChecksum ? "bad" : createHash("md5").update(bytes).digest("hex"),
      });
      if (request.method === "DELETE") return respond(options.deleteFails ? 500 : 204);
      return respond(200, { id: "temporary-id" });
    },
  };
}

test("publishes only after checking Drive size and checksum", async () => {
  const drive = fakeDrive();
  const result = await uploadVerifiedBackup(drive as never, bytes, "archive.enc", counts, sha256);
  assert.equal(result.folderId, "private-folder");
  assert.match(result.url, /temporary-id/);
  assert.equal(drive.calls.at(-1)?.method, "PATCH");
  assert.equal(drive.calls.some(c => c.method === "DELETE"), false);
});

test("creates the missing full-backup destination before uploading", async () => {
  const drive = fakeDrive({ missingFolder: true });
  const result = await uploadVerifiedBackup(drive as never, bytes, "archive.enc", counts, sha256);
  assert.equal(result.folderId, "temporary-id");
  assert.equal(drive.calls.filter((call) => call.method === "POST").length, 2);
  assert.equal(drive.calls.some((call) => call.url.includes("/upload/")), true);
});

test("finds and creates backup folders inside the requested parent", async () => {
  const drive = fakeDrive({ missingFolder: true });
  const result = await uploadVerifiedBackup(
    drive as never, bytes, "feedback.backup.enc", counts, sha256,
    { folderName: "Feedback", createFolder: true, parentId: "chainsaw-user-backup", category: "feedback", scope: "category" },
  );
  const folderQuery = decodeURIComponent(drive.calls[0].url);
  assert.match(folderQuery, /'chainsaw-user-backup' in parents/);
  assert.equal(JSON.parse(String(drive.requestBodies[1])).parents[0], "chainsaw-user-backup");
  assert.equal(result.folderId, "temporary-id");
});

for (const failure of [{ badChecksum: true }, { uploadFails: true }]) {
  test(`removes incomplete upload when ${Object.keys(failure)[0]}`, async () => {
    const drive = fakeDrive(failure);
    await assert.rejects(uploadVerifiedBackup(drive as never, bytes, "archive.enc", counts, sha256));
    assert.equal(drive.calls.at(-1)?.method, "DELETE");
    assert.equal(drive.calls.some(c => c.method === "PATCH" && !c.url.includes("/upload/")), false);
  });
}

test("reports failed cleanup rather than implying retry is safe", async () => {
  const drive = fakeDrive({ badChecksum: true, deleteFails: true });
  await assert.rejects(uploadVerifiedBackup(drive as never, bytes, "archive.enc", counts, sha256), /could not be removed/);
});

test("creates a named category folder when it does not exist", async () => {
  const drive = fakeDrive({ missingFolder: true });
  const result = await uploadVerifiedBackup(
    drive as never, bytes, "feedback.backup.enc", counts, sha256,
    { folderName: "Feedback Backup", createFolder: true, category: "feedback", scope: "category" },
  );
  assert.equal(result.folderId, "temporary-id");
  assert.equal(drive.calls.filter((call) => call.method === "POST").length, 2);
});

const testPassphrase = "local-only-restore-fixture-passphrase";
function encryptedFixture(change?: (entries: Array<{ path: string; sha256: string; encoding: string; data: unknown }>) => void) {
  const entries = [
    { path: "manifest.json", data: { format: "chainsaw-backup-v1", scope: "full", tables: BACKUP_TABLES } },
    ...BACKUP_TABLES.map(table => ({ path: `data/${table}.json`, data: [] })),
  ].map(({ path, data }) => ({
    path, sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    encoding: "json", data,
  }));
  change?.(entries);
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = scryptSync(testPassphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(entries.map(e => JSON.stringify(e)).join("\n") + "\n")), cipher.final()]);
  key.fill(0);
  return Buffer.concat([Buffer.from("CBK1"), salt, iv, encrypted, cipher.getAuthTag()]);
}

test("decrypts and checks every declared table entry", async () => {
  const verified = await decryptAndVerifyBackup(encryptedFixture(), testPassphrase);
  assert.equal(verified.counts.tables, BACKUP_TABLES.length);
  assert.equal(verified.counts.records, 0);
});

test("rejects a wrong passphrase or altered authenticated ciphertext", async () => {
  const archive = encryptedFixture();
  await assert.rejects(decryptAndVerifyBackup(archive, "incorrect passphrase"));
  const tampered = Buffer.from(archive);
  tampered[35] ^= 1;
  await assert.rejects(decryptAndVerifyBackup(tampered, testPassphrase));
});

test("rejects an entry with a bad checksum even when the archive is authenticated", async () => {
  const archive = encryptedFixture(entries => { entries[2].sha256 = "0".repeat(64); });
  await assert.rejects(decryptAndVerifyBackup(archive, testPassphrase), /Checksum mismatch/);
});

test("rejects a missing or repeated table entry", async () => {
  await assert.rejects(decryptAndVerifyBackup(encryptedFixture(entries => { entries.pop(); }), testPassphrase), /Missing or invalid table/);
  await assert.rejects(decryptAndVerifyBackup(encryptedFixture(entries => { entries.push({ ...entries[1] }); }), testPassphrase), /duplicate backup entry/);
});

test("requires a PDF for every issued certificate", async () => {
  const archive = encryptedFixture(entries => {
    const user = entries.find(entry => entry.path === "data/users.json")!;
    user.data = [{ id: 51, certificate_issued_at: "2026-01-01T00:00:00.000Z" }];
    user.sha256 = createHash("sha256").update(JSON.stringify(user.data)).digest("hex");
  });
  await assert.rejects(decryptAndVerifyBackup(archive, testPassphrase), /entries do not match/);
});

test("decrypts category archives and prevents using one as a full restore", async () => {
  const category = BACKUP_CATEGORIES.find((item) => item.key === "feedback")!;
  const archive = await encryptBackupEntries(testPassphrase, [
    { path: "manifest.json", data: { format: "chainsaw-backup-v1", scope: "category", category: category.key, tables: category.tables } },
    { path: "data/module_feedback.json", data: [] },
    { path: "data/app_feedback.json", data: [] },
  ]);
  const verified = await decryptAndVerifyBackup(archive, testPassphrase);
  assert.equal(verified.scope, "category");
  assert.equal(verified.category, "feedback");
  assert.equal(verified.counts.tables, 2);
  await assert.rejects(restoreAndCompare({ query: async () => ({ rows: [] }) }, verified), /Only a full archive/);
});