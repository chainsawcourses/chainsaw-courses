import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptRecoveryFile, getRecoveryPassphrase } from "./recovery-crypto.mjs";

const [, , inputDirectory, outputDirectory] = process.argv;
if (!inputDirectory || !outputDirectory) throw new Error("Usage: node restore-recovery-set.mjs downloaded-folder private-output-folder");
const input = path.resolve(inputDirectory);
const output = path.resolve(outputDirectory);
if (input === output) throw new Error("Use a separate private output folder");
const passphrase = await getRecoveryPassphrase();
const manifest = JSON.parse(decryptRecoveryFile(await readFile(path.join(input, "PRIVATE-MANIFEST.ccrf")), passphrase));
if (manifest.format !== "chainsaw-encrypted-recovery-v1" || !Array.isArray(manifest.files)) throw new Error("Invalid recovery manifest");
// A fresh private directory prevents existing nested symlinks from redirecting
// decrypted learner files outside the requested restore location.
await mkdir(output, { mode: 0o700 });
const marker = path.join(output, ".INCOMPLETE");
await writeFile(marker, "Restore in progress; verify before using.\n", { flag: "wx", mode: 0o600 });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const file of manifest.files) {
  if (!/^[a-f0-9]{24}\.ccrf$/.test(file.filename)) throw new Error("Unsafe encrypted filename");
  const target = path.resolve(output, file.logicalPath);
  if (!target.startsWith(output + path.sep)) throw new Error("Unsafe restored path");
  const encrypted = await readFile(path.join(input, file.filename));
  if (hash(encrypted) !== file.cipherSha256) throw new Error("Encrypted file checksum mismatch");
  const clear = decryptRecoveryFile(encrypted, passphrase);
  if (clear.length !== file.plainBytes || hash(clear) !== file.plainSha256) throw new Error("Restored file checksum mismatch");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, clear, { flag: "wx", mode: 0o600 });
  clear.fill(0);
}
await unlink(marker);
console.log(`Restored and verified ${manifest.files.length} files. Keep the output private.`);
