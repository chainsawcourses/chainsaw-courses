import { pool } from "@workspace/db";
import { runScheduledBackupOnce } from "../src/lib/backupJobs";

try {
  await runScheduledBackupOnce();
} finally {
  await pool.end();
}
