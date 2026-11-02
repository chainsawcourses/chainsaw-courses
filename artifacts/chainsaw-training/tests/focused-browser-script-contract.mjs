import assert from "node:assert/strict";

export function assertFocusedBrowserScriptContract({
  packageScripts,
  scriptName,
  runnerModule,
}) {
  assert.ok(
    Object.hasOwn(packageScripts, scriptName),
    `package.json must declare the focused browser script "${scriptName}"`,
  );

  const command = packageScripts[scriptName];
  assert.equal(
    typeof command,
    "string",
    `focused browser script "${scriptName}" must be a command string`,
  );
  assert.match(
    command,
    new RegExp(`\\bnode ${escapeRegExp(runnerModule)}\\b`),
    `focused browser script "${scriptName}" must use its dedicated runner module`,
  );
  assert.doesNotMatch(
    command,
    /\bplaywright\s+test\b/,
    `focused browser script "${scriptName}" must not invoke Playwright directly`,
  );
  assert.doesNotMatch(
    command,
    /(?:\b[^\s]+\.spec\.[cm]?[jt]s\b|--project(?:=|\s)|--grep(?:=|\s))/,
    `focused browser script "${scriptName}" must leave spec, project, and grep selection to its runner`,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}