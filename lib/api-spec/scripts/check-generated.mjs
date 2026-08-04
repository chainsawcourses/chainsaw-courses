#!/usr/bin/env node
/**
 * Verifies that the generated client files match the current OpenAPI spec.
 *
 * Strategy: run orval into a temporary directory (never touching the real
 * source tree), then diff the output against the actual committed files.
 * This is safe to run in parallel with typecheck.
 *
 * Why the temp config includes a tsconfig with target "es2022":
 *   orval passes the tsconfig's compilerOptions.target to esbuild when it
 *   bundles the mutator file for parameter-count analysis.  Without a target
 *   the acorn parser defaults to ES6, which cannot parse `async function`,
 *   causing getMutatorInfo to return undefined and the second-parameter
 *   detection (SecondParameter<typeof customFetch>) to silently be omitted
 *   from the generated output.  Passing the tsconfig path explicitly to the
 *   output config ensures orval loads the right compilerOptions.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const specDir = resolve(__dirname, "..");
const root = resolve(specDir, "../..");

const reactGenerated = join(root, "lib/api-client-react/src/generated");
const zodGenerated = join(root, "lib/api-zod/src/generated");

// ── temp workspace ───────────────────────────────────────────────────────────
const tmpRoot = mkdtempSync(join(tmpdir(), "check-generated-"));
const cleanup = () => {
  try { rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT",  () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });

const reactTmpSrc = join(tmpRoot, "api-client-react", "src");
const zodTmpSrc   = join(tmpRoot, "api-zod", "src");
mkdirSync(reactTmpSrc, { recursive: true });
mkdirSync(zodTmpSrc,   { recursive: true });

// Copy the mutator so the relative import path in generated code matches the
// real workspace: generated/api.ts → ../custom-fetch (one level up).
const tmpMutator = join(reactTmpSrc, "custom-fetch.ts");
cpSync(join(root, "lib/api-client-react/src/custom-fetch.ts"), tmpMutator);

// Write a tsconfig with target "es2022" and DOM lib so that:
//   1. The esbuild step in getMutatorInfo uses ecmaVersion 2022 (not ES6,
//      which cannot parse `async function` and would silently skip
//      second-parameter detection).
//   2. Standard DOM types (RequestInit, Response, URL…) are available.
// The tsconfig path is passed explicitly to the output config so orval does
// not rely on findUp to locate it.
const tmpTsconfig = join(reactTmpSrc, "tsconfig.json");
writeFileSync(tmpTsconfig, JSON.stringify({
  compilerOptions: { lib: ["dom", "es2022"], target: "es2022", strict: true },
  include: ["."],
}));

// ── write a temp orval config ────────────────────────────────────────────────
const orvalPkg       = join(specDir, "node_modules/orval/dist/index.mjs");
const tempConfigPath = join(tmpRoot, "orval.config.mjs");

writeFileSync(tempConfigPath, `
import { defineConfig } from ${JSON.stringify(orvalPkg)};

const titleTransformer = (config) => {
  config.info ??= {};
  config.info.title = "Api";
  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: ${JSON.stringify(join(specDir, "openapi.yaml"))},
      override: { transformer: titleTransformer },
    },
    output: {
      workspace: ${JSON.stringify(reactTmpSrc)},
      tsconfig: ${JSON.stringify(tmpTsconfig)},
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: ${JSON.stringify(tmpMutator)},
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: ${JSON.stringify(join(specDir, "openapi.yaml"))},
      override: { transformer: titleTransformer },
    },
    output: {
      workspace: ${JSON.stringify(zodTmpSrc)},
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ["boolean", "number", "string"],
            param: ["boolean", "number", "string"],
            body: ["bigint", "date"],
            response: ["bigint", "date"],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
`);

// ── run orval into the temp workspace (real files untouched) ─────────────────
const orvalBin = join(specDir, "node_modules/.bin/orval");
try {
  execFileSync(orvalBin, ["--config", tempConfigPath], {
    cwd: tmpRoot,
    stdio: "inherit",
  });
} catch {
  console.error("orval failed — cannot check generated files.");
  process.exit(1);
}

// ── diff temp output vs committed files ──────────────────────────────────────
let stale = false;

for (const [tmpDir, actualDir, label] of [
  [join(reactTmpSrc, "generated"), reactGenerated, "api-client-react"],
  [join(zodTmpSrc,   "generated"), zodGenerated,   "api-zod"],
]) {
  try {
    execFileSync("diff", ["-rq", tmpDir, actualDir], { stdio: "pipe" });
  } catch {
    console.error(`  ✗ ${label}/src/generated is out of date`);
    stale = true;
  }
}

if (stale) {
  console.error("");
  console.error("ERROR: Generated client files are out of date.");
  console.error("Run: pnpm --filter @workspace/api-spec run codegen");
  process.exit(1);
}

console.log("✓ Generated files are up to date.");
