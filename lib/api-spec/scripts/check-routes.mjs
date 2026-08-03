#!/usr/bin/env node
/**
 * check-routes.mjs
 *
 * Compares Express route definitions in artifacts/api-server/src/routes/ against
 * lib/api-spec/openapi.yaml and reports any route (method + path) that exists in
 * the server but is absent from the spec.
 *
 * Routes intentionally excluded from the spec are listed in EXEMPT_ROUTES below.
 * If you add a new server route, you MUST either:
 *   (a) add it to openapi.yaml, OR
 *   (b) add it to EXEMPT_ROUTES with a comment explaining why it's excluded.
 *
 * Run:  pnpm --filter @workspace/api-spec run check-routes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Paths (overridable via env vars for testing)
// ---------------------------------------------------------------------------
const root = path.resolve(__dirname, "../../..");
export const routesDir =
  process.env.CHECK_ROUTES_DIR ||
  path.join(root, "artifacts/api-server/src/routes");
export const specFile =
  process.env.CHECK_SPEC_FILE || path.join(root, "lib/api-spec/openapi.yaml");

// ---------------------------------------------------------------------------
// Routes intentionally excluded from the OpenAPI spec.
// Format: "METHOD /normalized/path"  (Express :param → {param})
// Override the whole set via CHECK_EXEMPT_ROUTES (JSON array) for testing.
// ---------------------------------------------------------------------------
export const EXEMPT_ROUTES = process.env.CHECK_EXEMPT_ROUTES
  ? new Set(JSON.parse(process.env.CHECK_EXEMPT_ROUTES))
  : new Set([
      // --- Binary / PDF responses — not JSON APIs ---
      "GET /certificate",
      "GET /certificate/view",
      "GET /admin/certificate/{userId}",
      "GET /privacy-policy-pdf",
      "GET /waiver/pdf",
      "GET /waiver/pdf/{studentId}",
      "GET /inspections/{id}/pdf",
      "GET /admin/inspections/{id}/pdf",
      "GET /risk-assessments/{id}/pdf",
      "GET /admin/risk-assessments/{id}/pdf",

      // --- Google Drive integration — binary uploads, admin-only ---
      "POST /admin/inspections/{id}/save-to-drive",
      "POST /admin/inspections/export-to-drive",
      "POST /admin/risk-assessments/{id}/save-to-drive",
      "POST /admin/risk-assessments/export-to-drive",
      "POST /admin/certificate/{userId}/save-to-drive",
      "POST /admin/certificates/export-to-drive",
      "POST /admin/feedback/student/{userId}/save-to-drive",
      "POST /admin/feedback/export-sheets",

      // --- Shopify webhook — external callback, not consumed by the app client ---
      "POST /api/shopify/webhook",

      // --- Backup endpoints — admin-only maintenance, not used via generated client ---
      "GET /admin/backup/export",
      "GET /admin/backup/exports",
      "GET /admin/backup/logs",
      "POST /admin/backup/logs",

      // --- Config endpoints — admin raw-fetch, not orval hooks ---
      "GET /config/{key}",
      "PUT /admin/config/{key}",

      // --- Activation code admin — AdminDashboard uses raw fetch, not orval hooks ---
      "GET /admin/codes",
      "PATCH /admin/codes/{code}/assign",
      "DELETE /admin/codes/{code}",
      "PATCH /admin/codes/{code}/pause",

      // --- Modules admin — raw fetch in admin panel, not orval hooks ---
      "GET /admin/modules",
      "PATCH /admin/modules/{moduleId}",

      // --- Misc admin actions — raw fetch, not orval hooks ---
      "DELETE /admin/waivers/orphaned",
      "POST /admin/users/{userId}/issue-certificate",
      "POST /admin/bind-preview",
      "POST /certificate/resend",

      // --- Push notification endpoints — native browser integration ---
      "GET /push/vapid-public-key",
      "POST /push/subscribe",
      "DELETE /push/subscribe",

      // --- Static/content endpoints — no generated hooks needed ---
      "GET /how-to-use",
      "GET /documents/legislation",
      "GET /hazards/{category}",

      // --- Progress — complete-assessment is internal only ---
      "POST /progress/complete-assessment",

      // --- AI — grade-answer is an internal grading endpoint ---
      "POST /ai/grade-answer",

      // --- Gateway endpoints — separate booking system, not in training app client ---
      "GET /gateway/venues",
      "GET /gateway/passport",
      "POST /gateway/passport",
      "GET /gateway/enquiries",
      "POST /gateway/enquiries",
      "GET /gateway/resolve/{token}",
      "GET /admin/gateway/venues",
      "POST /admin/gateway/venues",
      "PUT /admin/gateway/venues/{id}",
      "DELETE /admin/gateway/venues/{id}",
      "GET /admin/gateway/enquiries",
      "POST /admin/gateway/enquiries/{id}/resolve",
      "GET /admin/gateway/pool-status",

      // --- Quality assurance & IQA — admin internal tools, not orval hooks ---
      "GET /admin/stats-quality",
      "GET /admin/certificates",
      "GET /admin/exam-log",
      "GET /admin/assessment-bank",
      "GET /admin/questions/stats",
      "GET /admin/questions",
      "POST /admin/questions",
      "PUT /admin/questions/{id}",
      "DELETE /admin/questions/{id}",
      "GET /admin/iqa-records",
      "POST /admin/iqa-records",
      "PATCH /admin/iqa-records/{id}",
      "GET /admin/reasonable-adjustments",
      "POST /admin/reasonable-adjustments",
      "GET /admin/malpractice",

      // --- Mock assessment admin — admin internal tools, not orval hooks ---
      "POST /admin/mock-questions/upload-image",
      "GET /admin/mock-questions",
      "POST /admin/mock-questions",
      "POST /admin/mock-questions/import-defaults",
      "PUT /admin/mock-questions/{id}",
      "DELETE /admin/mock-questions/{id}",
      "GET /mock-questions",

      // --- News maintenance — purge-old is a cron/maintenance endpoint ---
      "DELETE /admin/news/purge-old",
    ]);

// ---------------------------------------------------------------------------
// Step 1: Extract all routes from Express router files
// ---------------------------------------------------------------------------

/** Convert an Express path like /foo/:bar/:baz to OpenAPI format /foo/{bar}/{baz} */
export function normalizeExpressPath(p) {
  return p.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

export const ROUTE_REGEX =
  /router\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;

/**
 * Read all *.ts files (except index.ts) in `dir` and extract every
 * `router.<method>("path", ...)` call as a "METHOD /normalized-path" string.
 *
 * @param {string} dir
 * @returns {Map<string, string[]>}  key = "METHOD /path", value = source filenames
 */
export function extractServerRoutes(dir) {
  const routes = new Map();

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts");

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    let match;
    ROUTE_REGEX.lastIndex = 0;
    while ((match = ROUTE_REGEX.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const rawPath = match[2];
      const normalized = normalizeExpressPath(rawPath);
      const key = `${method} ${normalized}`;
      if (!routes.has(key)) routes.set(key, []);
      routes.get(key).push(file);
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Step 2: Extract all paths + methods from the OpenAPI YAML
// ---------------------------------------------------------------------------

/**
 * Parse an OpenAPI YAML file and return every "METHOD /path" combination
 * found under the `paths:` block.
 *
 * @param {string} yamlPath
 * @returns {Set<string>}
 */
export function extractSpecRoutes(yamlPath) {
  const content = fs.readFileSync(yamlPath, "utf-8");
  const specRoutes = new Set();

  // OpenAPI paths look like:
  //   /some/path:          ← 2-space indent (inside `paths:`)
  //     get:               ← 4-space indent (HTTP method)
  //
  // We scan line by line, tracking the current path.
  const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
  let currentPath = null;

  for (const line of content.split("\n")) {
    // Match a path entry: exactly 2 spaces of indent, then /...
    const pathMatch = /^  (\/[^:]*):/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1].trim();
      continue;
    }

    // Match an HTTP method: exactly 4 spaces of indent, then method:
    if (currentPath) {
      const methodMatch = /^    ([a-z]+):/.exec(line);
      if (methodMatch && HTTP_METHODS.has(methodMatch[1])) {
        specRoutes.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
      }
    }
  }

  return specRoutes;
}

// ---------------------------------------------------------------------------
// Step 3: Compare and report
// ---------------------------------------------------------------------------

/**
 * Compare server routes against spec routes and the exemption list.
 *
 * Returns the two problem sets without printing or exiting — callers decide
 * what to do with the results.
 *
 * @param {Map<string, string[]>} serverRoutes
 * @param {Set<string>} specRoutes
 * @param {Set<string>} exemptRoutes
 * @returns {{ missing: Array<{route: string, files: string[]}>, staleExemptions: string[] }}
 */
export function runCheck(serverRoutes, specRoutes, exemptRoutes) {
  const missing = [];

  for (const [route, files] of serverRoutes) {
    if (!specRoutes.has(route) && !exemptRoutes.has(route)) {
      missing.push({ route, files });
    }
  }

  const staleExemptions = [];
  for (const exemption of exemptRoutes) {
    if (!serverRoutes.has(exemption)) {
      staleExemptions.push(exemption);
    }
  }

  return { missing, staleExemptions };
}

// ---------------------------------------------------------------------------
// Entry point — only runs when executed directly (not when imported as a module)
// ---------------------------------------------------------------------------

function main() {
  const serverRoutes = extractServerRoutes(routesDir);
  const specRoutes = extractSpecRoutes(specFile);
  const { missing, staleExemptions } = runCheck(
    serverRoutes,
    specRoutes,
    EXEMPT_ROUTES
  );

  let hasErrors = false;

  if (missing.length > 0) {
    hasErrors = true;
    console.error(
      `\n❌  ${missing.length} server route(s) are missing from the OpenAPI spec:\n`
    );
    for (const { route, files } of missing.sort((a, b) =>
      a.route.localeCompare(b.route)
    )) {
      console.error(`  ${route}`);
      console.error(`    defined in: ${files.join(", ")}`);
    }
    console.error(`
To fix this, for each route above either:
  (a) Add the route to lib/api-spec/openapi.yaml  (so orval generates a typed hook), or
  (b) Add the route to EXEMPT_ROUTES in lib/api-spec/scripts/check-routes.mjs
      with a comment explaining why it does not belong in the spec.
`);
  }

  if (staleExemptions.length > 0) {
    hasErrors = true;
    console.error(
      `\n❌  ${staleExemptions.length} EXEMPT_ROUTES entry/entries no longer match any server route:\n`
    );
    for (const exemption of staleExemptions.sort()) {
      console.error(`  ${exemption}`);
    }
    console.error(`
These exemptions are stale — the server route was likely removed or renamed.
Remove them from EXEMPT_ROUTES in lib/api-spec/scripts/check-routes.mjs,
or update them to match the new route name.
`);
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log("✅  All server routes are covered by the OpenAPI spec (or are explicitly exempted).");
  console.log("✅  All EXEMPT_ROUTES entries correspond to actual server routes.");
  process.exit(0);
}

// Only run main() when invoked directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
