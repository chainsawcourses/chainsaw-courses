import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// CCRF1: magic(5), salt(16), nonce(12), ciphertext, GCM authentication tag(16).
// scrypt uses Node's interoperable defaults: N=16384, r=8, p=1, 32-byte key.
const magic = Buffer.from("CCRF1");
export function encryptRecoveryFile(bytes, passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 16) throw new Error("A backup passphrase of at least 16 characters is required");
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(magic);
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([magic, salt, nonce, encrypted, cipher.getAuthTag()]);
  } finally { key.fill(0); }
}
export function decryptRecoveryFile(bytes, passphrase) {
  if (bytes.length < 49 || !bytes.subarray(0, 5).equals(magic)) throw new Error("Not a CCRF1 recovery file");
  const key = scryptSync(passphrase, bytes.subarray(5, 21), 32);
  try {
    const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(21, 33));
    cipher.setAAD(magic);
    cipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([cipher.update(bytes.subarray(33, -16)), cipher.final()]);
  } catch { throw new Error("Recovery decryption failed: wrong passphrase or damaged file"); }
  finally { key.fill(0); }
}
async function promptPassphrase() {
  if (!process.stdin.isTTY) throw new Error("Use an interactive terminal or RECOVERY_PASSPHRASE");
  process.stdout.write("Backup passphrase (hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); };
    const onData = text => {
      for (const char of text) {
        if (char === "\u0003") { finish(); reject(new Error("Cancelled")); return; }
        if (char === "\r" || char === "\n") { finish(); resolve(value); return; }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}
export async function getRecoveryPassphrase() {
  return process.env.RECOVERY_PASSPHRASE || await promptPassphrase();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output] = process.argv;
  if (!input || !output || input === output) throw new Error("Usage: node recovery-crypto.mjs encrypted.ccrf output-file");
  const passphrase = await getRecoveryPassphrase();
  const clear = decryptRecoveryFile(await readFile(input), passphrase);
  // Never overwrite an existing destination, especially not another backup.
  await writeFile(output, clear, { flag: "wx", mode: 0o600 });
  clear.fill(0);
  console.log("Decrypted successfully. Keep the output private.");
}
