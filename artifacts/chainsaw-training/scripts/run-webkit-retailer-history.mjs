import { spawnSync } from "node:child_process";
import { buildWebkitRetailerHistoryArgs } from "./webkit-retailer-history-selection.mjs";

const result = spawnSync("pnpm", buildWebkitRetailerHistoryArgs(), {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (result.error || result.signal) {
  console.error("WebKit release check process did not exit normally.", {
    signal: result.signal,
    error: result.error?.message,
  });
}

process.exit(result.status ?? 1);