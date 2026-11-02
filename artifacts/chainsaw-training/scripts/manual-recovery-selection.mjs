export const manualRecoverySelection = Object.freeze({
  spec: "manual-performance.spec.ts",
  config: "../../playwright.lifecycle.config.ts",
  project: "chromium-desktop",
  grep: "@manual-recovery",
});

export function buildManualRecoveryArgs({
  listOnly = false,
  selection = manualRecoverySelection,
} = {}) {
  const args = [
    "exec",
    "playwright",
    "test",
    selection.spec,
    "--config",
    selection.config,
    `--project=${selection.project}`,
    "--grep",
    selection.grep,
  ];

  if (listOnly) {
    args.push("--list");
  }

  return args;
}