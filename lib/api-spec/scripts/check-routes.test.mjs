/**
 * check-routes.test.mjs
 *
 * Unit + integration tests for check-routes.mjs.
 *
 * Unit tests call the exported pure functions directly with in-memory fixtures.
 * Integration tests spawn the script as a child process (using env-var overrides
 * for paths/exemptions) and assert on exit code + stderr content.
 *
 * Run:  pnpm --filter @workspace/api-spec run test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  normalizeExpressPath,
  extractServerRoutes,
  extractSpecRoutes,
  runCheck,
} from "./check-routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "check-routes.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory, populate it with named files, and return the
 * directory path.  The directory is cleaned up automatically by the OS on reboot
 * (or the caller can delete it).
 *
 * @param {Record<string, string>} files  filename → content
 * @returns {string}  absolute path to the temp directory
 */
function makeTempDir(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-routes-test-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, "utf-8");
  }
  return dir;
}

/**
 * Build a minimal OpenAPI YAML string that includes the given routes.
 *
 * @param {Array<{ path: string, methods: string[] }>} routes
 * @returns {string}
 */
function makeSpecYaml(routes) {
  const lines = ["openapi: 3.0.0", "paths:"];
  for (const { path: p, methods } of routes) {
    lines.push(`  ${p}:`);
    for (const m of methods) {
      lines.push(`    ${m}:`);
      lines.push(`      responses:`);
      lines.push(`        '200':`);
      lines.push(`          description: OK`);
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * Build the content of a fake Express router file that registers the given routes.
 *
 * @param {Array<{ method: string, path: string }>} routes
 * @returns {string}
 */
function makeRouterFile(routes) {
  const lines = [`import { Router } from "express";`, `const router = Router();`];
  for (const { method, path: p } of routes) {
    lines.push(`router.${method.toLowerCase()}("${p}", (req, res) => res.json({}));`);
  }
  lines.push(`export default router;`);
  return lines.join("\n") + "\n";
}

/**
 * Spawn check-routes.mjs with the given env-var overrides.
 * Returns { exitCode, stdout, stderr }.
 *
 * @param {{ routesDir?: string, specFile?: string, exemptRoutes?: string[] }} opts
 */
function runScript({ routesDir, specFile, exemptRoutes } = {}) {
  const env = { ...process.env };
  if (routesDir) env.CHECK_ROUTES_DIR = routesDir;
  if (specFile) env.CHECK_SPEC_FILE = specFile;
  if (exemptRoutes !== undefined)
    env.CHECK_EXEMPT_ROUTES = JSON.stringify(exemptRoutes);

  const result = spawnSync(process.execPath, [SCRIPT], {
    env,
    encoding: "utf-8",
  });

  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Unit tests — pure functions
// ---------------------------------------------------------------------------

describe("normalizeExpressPath", () => {
  it("leaves paths without params unchanged", () => {
    assert.equal(normalizeExpressPath("/foo/bar"), "/foo/bar");
  });

  it("converts :param to {param}", () => {
    assert.equal(normalizeExpressPath("/foo/:id"), "/foo/{id}");
  });

  it("converts multiple params", () => {
    assert.equal(
      normalizeExpressPath("/users/:userId/items/:itemId"),
      "/users/{userId}/items/{itemId}"
    );
  });
});

describe("extractServerRoutes", () => {
  it("extracts routes from a .ts file", () => {
    const dir = makeTempDir({
      "things.ts": makeRouterFile([
        { method: "GET", path: "/things" },
        { method: "POST", path: "/things" },
        { method: "DELETE", path: "/things/:id" },
      ]),
    });

    const routes = extractServerRoutes(dir);

    assert.ok(routes.has("GET /things"), "should find GET /things");
    assert.ok(routes.has("POST /things"), "should find POST /things");
    assert.ok(routes.has("DELETE /things/{id}"), "should find DELETE /things/{id}");
    assert.equal(routes.size, 3);
  });

  it("skips index.ts", () => {
    const dir = makeTempDir({
      "index.ts": makeRouterFile([{ method: "GET", path: "/should-be-ignored" }]),
      "other.ts": makeRouterFile([{ method: "GET", path: "/included" }]),
    });

    const routes = extractServerRoutes(dir);
    assert.ok(!routes.has("GET /should-be-ignored"), "should skip index.ts");
    assert.ok(routes.has("GET /included"));
  });

  it("records the source filename for each route", () => {
    const dir = makeTempDir({
      "widgets.ts": makeRouterFile([{ method: "GET", path: "/widgets" }]),
    });

    const routes = extractServerRoutes(dir);
    assert.deepEqual(routes.get("GET /widgets"), ["widgets.ts"]);
  });
});

describe("extractSpecRoutes", () => {
  it("parses paths and methods from YAML", () => {
    const dir = makeTempDir({
      "spec.yaml": makeSpecYaml([
        { path: "/things", methods: ["get", "post"] },
        { path: "/things/{id}", methods: ["delete"] },
      ]),
    });

    const routes = extractSpecRoutes(path.join(dir, "spec.yaml"));
    assert.ok(routes.has("GET /things"));
    assert.ok(routes.has("POST /things"));
    assert.ok(routes.has("DELETE /things/{id}"));
    assert.equal(routes.size, 3);
  });

  it("returns an empty set for a spec with no paths", () => {
    const dir = makeTempDir({ "empty.yaml": "openapi: 3.0.0\n" });
    const routes = extractSpecRoutes(path.join(dir, "empty.yaml"));
    assert.equal(routes.size, 0);
  });
});

describe("runCheck", () => {
  it("returns no problems when everything is consistent", () => {
    const serverRoutes = new Map([
      ["GET /things", ["things.ts"]],
      ["GET /exempt", ["things.ts"]],
    ]);
    const specRoutes = new Set(["GET /things"]);
    const exemptRoutes = new Set(["GET /exempt"]);

    const { missing, staleExemptions } = runCheck(serverRoutes, specRoutes, exemptRoutes);

    assert.equal(missing.length, 0);
    assert.equal(staleExemptions.length, 0);
  });

  it("reports a route that is neither in the spec nor exempted", () => {
    const serverRoutes = new Map([["GET /untracked", ["things.ts"]]]);
    const specRoutes = new Set([]);
    const exemptRoutes = new Set([]);

    const { missing } = runCheck(serverRoutes, specRoutes, exemptRoutes);

    assert.equal(missing.length, 1);
    assert.equal(missing[0].route, "GET /untracked");
  });

  it("reports an exemption that has no matching server route (stale)", () => {
    const serverRoutes = new Map(); // no routes at all
    const specRoutes = new Set([]);
    const exemptRoutes = new Set(["DELETE /old-route"]);

    const { staleExemptions } = runCheck(serverRoutes, specRoutes, exemptRoutes);

    assert.equal(staleExemptions.length, 1);
    assert.equal(staleExemptions[0], "DELETE /old-route");
  });

  it("does not report a route that is in the spec", () => {
    const serverRoutes = new Map([["GET /covered", ["things.ts"]]]);
    const specRoutes = new Set(["GET /covered"]);
    const exemptRoutes = new Set([]);

    const { missing } = runCheck(serverRoutes, specRoutes, exemptRoutes);
    assert.equal(missing.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — spawn the real script and inspect exit code + output
// ---------------------------------------------------------------------------

describe("check-routes.mjs (integration)", () => {
  it("exits 0 and prints success when routes, spec, and exemptions are fully consistent", () => {
    const routesDir = makeTempDir({
      "things.ts": makeRouterFile([
        { method: "GET", path: "/things" },
        { method: "POST", path: "/exempt-thing" },
      ]),
    });
    const specYaml = makeSpecYaml([{ path: "/things", methods: ["get"] }]);
    const specDir = makeTempDir({ "openapi.yaml": specYaml });

    const { exitCode, stdout, stderr } = runScript({
      routesDir,
      specFile: path.join(specDir, "openapi.yaml"),
      exemptRoutes: ["POST /exempt-thing"],
    });

    assert.equal(exitCode, 0, `Expected exit 0 but got ${exitCode}.\nstderr: ${stderr}`);
    assert.ok(
      stdout.includes("✅"),
      `Expected success message in stdout.\nstdout: ${stdout}`
    );
  });

  it("exits 1 and names the stale exemption when an EXEMPT_ROUTES entry has no matching server route", () => {
    // Routes dir has only GET /things — the exemption for DELETE /ghost-route is stale.
    const routesDir = makeTempDir({
      "things.ts": makeRouterFile([{ method: "GET", path: "/things" }]),
    });
    const specYaml = makeSpecYaml([{ path: "/things", methods: ["get"] }]);
    const specDir = makeTempDir({ "openapi.yaml": specYaml });

    const { exitCode, stderr } = runScript({
      routesDir,
      specFile: path.join(specDir, "openapi.yaml"),
      exemptRoutes: ["DELETE /ghost-route"], // this route does not exist in the server
    });

    assert.equal(exitCode, 1, `Expected exit 1 but got ${exitCode}.\nstderr: ${stderr}`);
    assert.ok(
      stderr.includes("EXEMPT_ROUTES entry/entries no longer match any server route"),
      `Expected stale-exemption error in stderr.\nstderr: ${stderr}`
    );
    assert.ok(
      stderr.includes("DELETE /ghost-route"),
      `Expected stale route name in stderr.\nstderr: ${stderr}`
    );
  });

  it("exits 1 and names the untracked route when a server route is missing from both the spec and exemptions", () => {
    // Routes dir has GET /things (in spec) and POST /untracked (not in spec, not exempted).
    const routesDir = makeTempDir({
      "things.ts": makeRouterFile([
        { method: "GET", path: "/things" },
        { method: "POST", path: "/untracked" },
      ]),
    });
    const specYaml = makeSpecYaml([{ path: "/things", methods: ["get"] }]);
    const specDir = makeTempDir({ "openapi.yaml": specYaml });

    const { exitCode, stderr } = runScript({
      routesDir,
      specFile: path.join(specDir, "openapi.yaml"),
      exemptRoutes: [], // no exemptions
    });

    assert.equal(exitCode, 1, `Expected exit 1 but got ${exitCode}.\nstderr: ${stderr}`);
    assert.ok(
      stderr.includes("missing from the OpenAPI spec"),
      `Expected missing-route error in stderr.\nstderr: ${stderr}`
    );
    assert.ok(
      stderr.includes("POST /untracked"),
      `Expected untracked route name in stderr.\nstderr: ${stderr}`
    );
  });
});
