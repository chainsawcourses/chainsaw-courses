import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupFailureMessage, londonBackupDateKey, shouldRunScheduledBackup } from "../src/lib/backupSchedulePolicy.ts";

test("scheduled backup is due at 06:00 UK time, respecting GMT and BST", () => {
  assert.equal(shouldRunScheduledBackup(new Date("2026-10-15T04:59:00.000Z"), null), false); // 05:59 BST
  assert.equal(shouldRunScheduledBackup(new Date("2026-10-15T05:00:00.000Z"), null), true); // 06:00 BST
  assert.equal(shouldRunScheduledBackup(new Date("2026-10-15T05:00:00.000Z"), "2026-10-15"), false);
  assert.equal(shouldRunScheduledBackup(new Date("2026-10-16T05:00:00.000Z"), "2026-10-15"), true);
  assert.equal(shouldRunScheduledBackup(new Date("2026-01-15T05:59:00.000Z"), null), false); // 05:59 GMT
  assert.equal(shouldRunScheduledBackup(new Date("2026-01-15T06:00:00.000Z"), null), true); // 06:00 GMT
  assert.equal(londonBackupDateKey(new Date("2026-10-15T23:30:00.000Z")), "2026-10-16");
});

test("readable backup failures are reported without legacy archive configuration", () => {
  assert.match(backupFailureMessage("unexpected network failure"), /readable backup failed/);
});

test("backup errors distinguish incomplete Drive cleanup from general failures", () => {
  assert.match(backupFailureMessage("temporary Drive file could not be removed"), /temporary readable Drive files/);
  assert.match(backupFailureMessage("google-sheet request failed (429)"), /rate-limited/);
  assert.match(backupFailureMessage("google-drive request failed (403): storageQuotaExceeded"), /run out of available storage/);
  assert.match(backupFailureMessage("google-drive request failed (403): insufficientFilePermissions"), /denied permission/);
  assert.match(backupFailureMessage("google-drive request failed (403)"), /available Drive storage and edit access/);
  assert.match(backupFailureMessage("unexpected network failure"), /API logs/);
});

test("routine backups stay in admin without weekly reminder or activity emails", () => {
  const scheduler = readFileSync(new URL("../src/lib/scheduler.ts", import.meta.url), "utf8");
  const jobs = readFileSync(new URL("../src/lib/backupJobs.ts", import.meta.url), "utf8");
  assert.doesNotMatch(scheduler, /sendWeeklyBackupReminder|Weekly Backup Reminder|0 9 \* \* 1/);
  assert.doesNotMatch(jobs, /sendEmail|emailScheduledFailure/);
  assert.doesNotMatch(jobs, /MIGRATION_BACKUP_PASSPHRASE|createFullBackup/);
  assert.match(backupFailureMessage("The backup database connection was interrupted. Retry from admin."), /database connection was lost/);
});

test("Google-triggered backups are not also detached during server startup or cron", () => {
  const scheduler = readFileSync(new URL("../src/lib/scheduler.ts", import.meta.url), "utf8");
  assert.match(scheduler, /externalBackupTriggerConfigured = Boolean\(process\.env\.BACKUP_TRIGGER_SECRET\)/);
  assert.match(scheduler, /if \(!externalBackupTriggerConfigured\) void runScheduledBackupIfDue\(\)/);
  assert.match(scheduler, /if \(!externalBackupTriggerConfigured\) await runScheduledBackupIfDue\(\)/);
  const jobs = readFileSync(new URL("../src/lib/backupJobs.ts", import.meta.url), "utf8");
  const manual = jobs.slice(jobs.indexOf("export async function startManualBackup"), jobs.indexOf("export async function runScheduledBackupIfDue"));
  assert.match(manual, /await performBackup\(run, client\)/);
  assert.doesNotMatch(manual, /MIGRATION_BACKUP_PASSPHRASE|passphrase/);
  assert.doesNotMatch(manual, /void performBackup/);
});
