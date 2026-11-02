import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, ".backup-restore-runner.mjs");
try {
  await build({
    entryPoints: [path.join(root, "tests/verify-backup-restore.integration.ts")],
    outfile: output,
    platform: "node",
    format: "esm",
    bundle: true,
    external: ["pg-native", "pdfkit", "fontkit", "@google-cloud/*", "*.node"],
    alias: { "@workspace/db": path.resolve(root, "../../lib/db/src/index.ts") },
    banner: { js: `import { createRequire as __backupRequire } from "node:module"; globalThis.require = __backupRequire(import.meta.url);` },
  });
  const result = spawnSync(process.execPath, [output], { cwd: path.resolve(root, "../.."), stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally {
  await rm(output, { force: true });
}