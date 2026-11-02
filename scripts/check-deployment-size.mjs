import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ignoreFile = path.join(root, ".replitignore");
const maxBytes = 6 * 1024 ** 3;
const requiredExclusions = [".git", ".cache", "exports", "attached_assets"];

function normalise(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/|\/$/g, "");
}

const exclusions = (await readFile(ignoreFile, "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map(normalise);

for (const required of requiredExclusions) {
  if (!exclusions.includes(required)) {
    throw new Error(`Missing required deployment exclusion: ${required}`);
  }
}

function isExcluded(relativePath) {
  const candidate = normalise(relativePath);
  return exclusions.some(
    (entry) => candidate === entry || candidate.startsWith(`${entry}/`),
  );
}

async function measureDirectory(directory, relativePath = "") {
  let bytes = 0;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;
    if (isExcluded(entryRelativePath)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      bytes += await measureDirectory(entryPath, entryRelativePath);
    } else if (entry.isFile()) {
      bytes += (await lstat(entryPath)).size;
    }
  }

  return bytes;
}

const deployableBytes = await measureDirectory(root);
const deployableGiB = deployableBytes / 1024 ** 3;

console.log(
  `Estimated deployment context: ${deployableGiB.toFixed(2)} GiB ` +
    `(guard: ${(maxBytes / 1024 ** 3).toFixed(0)} GiB)`,
);

if (deployableBytes > maxBytes) {
  throw new Error(
    "Estimated deployment context is too large. Audit new workspace assets " +
      "and add only verified development-only paths to .replitignore.",
  );
}