import { spawnSync } from "node:child_process";
import { buildManualRecoveryArgs } from "./manual-recovery-selection.mjs";

const result = spawnSync("pnpm", buildManualRecoveryArgs(), {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

process.exit(result.status ?? 1);