import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { encryptRecoveryFile, decryptRecoveryFile } from "./recovery-crypto.mjs";
const passphrase = "synthetic-test-passphrase-only";
test("authenticated recovery format round-trips empty and binary files", () => {
  for (const input of [Buffer.alloc(0), Buffer.from("synthetic record"), randomBytes(65536)]) {
    const encrypted = encryptRecoveryFile(input, passphrase);
    assert.deepEqual(decryptRecoveryFile(encrypted, passphrase), input);
  }
});
test("wrong passwords, corrupted bytes and invalid headers fail explicitly", () => {
  const encrypted = encryptRecoveryFile(Buffer.from("synthetic record"), passphrase);
  assert.throws(() => decryptRecoveryFile(encrypted, "another-test-passphrase"), /decryption failed/);
  const damaged = Buffer.from(encrypted); damaged[35] ^= 1;
  assert.throws(() => decryptRecoveryFile(damaged, passphrase), /decryption failed/);
  assert.throws(() => decryptRecoveryFile(Buffer.from("not a backup"), passphrase), /Not a CCRF1/);
  assert.throws(() => encryptRecoveryFile(Buffer.from("x"), "short"), /at least 16/);
});
test("standalone set restore verifies real files and refuses overwrites", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "recovery-crypto-test-"));
  try {
    const plain = Buffer.from("synthetic learner-free test data");
    const encrypted = encryptRecoveryFile(plain, passphrase);
    const filename = "a".repeat(24) + ".ccrf";
    const sha = bytes => createHash("sha256").update(bytes).digest("hex");
    const manifest = { format: "chainsaw-encrypted-recovery-v1", files: [
      { filename, logicalPath: "documents/example.txt", plainBytes: plain.length,
        plainSha256: sha(plain), cipherSha256: sha(encrypted) },
    ] };
    await writeFile(path.join(dir, filename), encrypted);
    await writeFile(path.join(dir, "PRIVATE-MANIFEST.ccrf"), encryptRecoveryFile(Buffer.from(JSON.stringify(manifest)), passphrase));
    const restore = path.resolve("scripts/restore-recovery-set.mjs");
    const target = path.join(dir, "restored");
    const run = () => spawnSync(process.execPath, [restore, dir, target], {
      env: { ...process.env, RECOVERY_PASSPHRASE: passphrase }, encoding: "utf8",
    });
    assert.equal(run().status, 0);
    assert.deepEqual(await readFile(path.join(target, "documents/example.txt")), plain);
    assert.notEqual(run().status, 0);
    assert.deepEqual(await readFile(path.join(target, "documents/example.txt")), plain);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("authenticated manifests cannot restore paths outside the output folder", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "recovery-path-test-"));
  try {
    const filename = "b".repeat(24) + ".ccrf";
    const encrypted = encryptRecoveryFile(Buffer.from("synthetic"), passphrase);
    await writeFile(path.join(dir, filename), encrypted);
    const manifest = { format: "chainsaw-encrypted-recovery-v1", files: [
      { filename, logicalPath: "../escaped.txt", plainBytes: 9,
        cipherSha256: createHash("sha256").update(encrypted).digest("hex") },
    ] };
    await writeFile(path.join(dir, "PRIVATE-MANIFEST.ccrf"), encryptRecoveryFile(Buffer.from(JSON.stringify(manifest)), passphrase));
    const run = spawnSync(process.execPath, [path.resolve("scripts/restore-recovery-set.mjs"), dir, path.join(dir, "restored")], {
      env: { ...process.env, RECOVERY_PASSPHRASE: passphrase }, encoding: "utf8",
    });
    assert.notEqual(run.status, 0);
    await assert.rejects(readFile(path.join(dir, "escaped.txt")), { code: "ENOENT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
