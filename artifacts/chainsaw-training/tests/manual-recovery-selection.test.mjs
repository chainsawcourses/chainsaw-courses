import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildManualRecoveryArgs,
  manualRecoverySelection,
} from "../scripts/manual-recovery-selection.mjs";
import { assertFocusedBrowserScriptContract } from "./focused-browser-script-contract.mjs";

const packageScripts = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).scripts;

test("shared selection changes affect list-only validation and browser execution", () => {
  const changedSelection = {
    ...manualRecoverySelection,
    spec: "changed.spec.ts",
    project: "changed-project",
    grep: "@changed-selection",
  };

  const executionArgs = buildManualRecoveryArgs({
    selection: changedSelection,
  });
  const listArgs = buildManualRecoveryArgs({
    listOnly: true,
    selection: changedSelection,
  });

  assert.deepEqual(listArgs.slice(0, -1), executionArgs);
  assert.equal(listArgs.at(-1), "--list");
  for (const value of [
    changedSelection.spec,
    `--project=${changedSelection.project}`,
    changedSelection.grep,
  ]) {
    assert.ok(executionArgs.includes(value));
    assert.ok(listArgs.includes(value));
  }
});

test("focused manual recovery package script uses the dedicated runner", () => {
  assertFocusedBrowserScriptContract({
    packageScripts,
    scriptName: "test:manual-delivery-browser",
    runnerModule: "scripts/run-manual-recovery.mjs",
  });
});
