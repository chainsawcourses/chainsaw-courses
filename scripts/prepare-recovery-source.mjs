import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// This is deliberately a source snapshot, not an export of Git history or uploads.
const root = path.resolve(import.meta.dirname, "..");
const destination = path.resolve(root, process.argv[2] ?? "generated-artifacts/recovery/source");
if (!destination.startsWith(`${root}/generated-artifacts/`)) {
  throw new Error("Recovery output must be inside ignored generated-artifacts.");
}
const allowedRoot = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|playwright[^/]*\.ts|\.npmrc|\.replit|\.replitignore|\.gitignore)$/;
const allowedDirectory = /^(artifacts\/(?:api-server|chainsaw-training)\/|lib\/|scripts\/|release\/|\.github\/)/;
const excluded = /(^|\/)(node_modules|dist|build|test-results|playwright-report|source-documents|Pods|DerivedData)(\/|$)|(^|\/)\.(?!(?:replit-artifact|github)\/)[^/]+\/|(^|\/)\.env(?:\.|$)|(?:^|\/)(?:\.DS_Store|local\.properties)$|\.(?:p8|p12|pfx|jks|keystore|mobileprovision)$/i;
const excludedNames = /(?:David_Daniel_CV\.pdf|dist-public\.zip|chainsaw_.*preview\.mp4)$/i;
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const selected = [...new Set([
  ...tracked.filter(p => (allowedRoot.test(p) || allowedDirectory.test(p)) && !excluded.test(p) && !excludedNames.test(p)),
  "scripts/prepare-recovery-source.mjs",
  "scripts/recovery-crypto.mjs",
  "scripts/recovery-crypto.test.mjs",
  "scripts/restore-recovery-set.mjs",
  "docs/recovery.md",
  "docs/recovery-portable.md",
  // Public runtime branding imported by the frontend, not the uploads directory.
  "attached_assets/chainsaw-retailer-header-icon.png",
])].sort();
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const files = [];
for (const relative of selected) {
  const source = path.join(root, relative);
  const bytes = await readFile(source);
  if (bytes.subarray(0, 80).toString().startsWith("version https://git-lfs.github.com/spec/")) {
    throw new Error(`Unresolved LFS pointer: ${relative}`);
  }
  const target = path.join(destination, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  const mode = (await stat(source)).mode & 0o111 ? "100755" : "100644";
  files.push({
    path: relative, mode, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    gitBlob: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),
  });
}
const manifest = {
  format: "chainsaw-source-snapshot-v1",
  createdAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  purpose: "Current application source and runtime assets, without private uploads or unpushed Git history.",
  exclusions: [
    "Learner database and documents: kept separately in the restricted recovery folder.",
    "Environment values, signing credentials, provider accounts and dependency caches.",
    "Uploaded screenshots, old release binaries, migration exports, agent state and personal CV.",
    "Original source-document PDFs and generated preview videos; runtime assets remain included.",
  ],
  files,
};
await writeFile(path.join(destination, "SOURCE-MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ directory: destination, files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0), sourceCommit: manifest.sourceCommit }));
