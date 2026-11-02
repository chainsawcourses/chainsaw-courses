import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildWebkitRetailerHistoryArgs } from "./webkit-retailer-history-selection.mjs";

const expectedCaseTags = [
  "@webkit-retailer-history-verification-retry",
  "@webkit-retailer-history-stale-response",
  "@webkit-retailer-history-panel-close",
  "@webkit-retailer-history-navigation",
  "@webkit-retailer-history-reminder-retry",
  "@webkit-retailer-history-featured-retry",
];

const result = spawnSync("pnpm", buildWebkitRetailerHistoryArgs({ listOnly: true }), {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const testSource = readFileSync(
  new URL("../tests/browser/admin-retailer-review.spec.ts", import.meta.url),
  "utf8",
);
const missingTags = expectedCaseTags.filter((tag) => !testSource.includes(`"${tag}"`));
const selectedTestCount = result.stdout.match(/Total: (\d+) tests?/);

if (missingTags.length > 0 || Number(selectedTestCount?.[1]) !== expectedCaseTags.length) {
  console.error("The focused WebKit retailer-history suite is out of sync.");
  if (missingTags.length > 0) {
    console.error(`Missing stable case tags: ${missingTags.join(", ")}`);
  }
  console.error(`Expected ${expectedCaseTags.length} selected tests, received ${selectedTestCount?.[1] ?? "an unknown count"}.`);
  process.exit(1);
}

console.log(`Verified ${expectedCaseTags.length} focused WebKit retailer-history checks.`);