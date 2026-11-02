export const webkitRetailerHistorySelection = Object.freeze({
  spec: "admin-retailer-review.spec.ts",
  config: "../../playwright.lifecycle.config.ts",
  project: "webkit-retailer-history",
  grep: "@webkit-retailer-history",
});

export function buildWebkitRetailerHistoryArgs({
  listOnly = false,
  selection = webkitRetailerHistorySelection,
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