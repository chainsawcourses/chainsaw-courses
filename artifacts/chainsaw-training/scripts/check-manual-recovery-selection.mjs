import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildManualRecoveryArgs } from "./manual-recovery-selection.mjs";

const expectedCaseTags = [
  "@manual-recovery-reader-request-phone",
  "@manual-recovery-reader-request-tablet",
  "@manual-recovery-reader-damage-phone",
  "@manual-recovery-reader-damage-tablet",
  "@manual-recovery-zoom-request-phone",
  "@manual-recovery-zoom-request-tablet",
  "@manual-recovery-zoom-damage",
  "@manual-recovery-analytics-failure",
];

const result = spawnSync("pnpm", buildManualRecoveryArgs({ listOnly: true }), {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const testSource = readFileSync(
  new URL("../tests/browser/manual-performance.spec.ts", import.meta.url),
  "utf8",
);
const missingTags = expectedCaseTags.filter((tag) => !testSource.includes(`"${tag}"`));
const selectedTestCount = result.stdout.match(/Total: (\d+) tests?/);

if (missingTags.length > 0 || Number(selectedTestCount?.[1]) !== expectedCaseTags.length) {
  console.error("The focused manual-recovery suite is out of sync.");
  if (missingTags.length > 0) {
    console.error(`Missing stable case tags: ${missingTags.join(", ")}`);
  }
  console.error(`Expected ${expectedCaseTags.length} selected tests, received ${selectedTestCount?.[1] ?? "an unknown count"}.`);
  process.exit(1);
}

console.log(`Verified ${expectedCaseTags.length} focused manual-recovery checks.`);