function londonDateParts(date: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function londonBackupDateKey(date: Date): string {
  const parts = londonDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shouldRunScheduledBackup(now: Date, alreadyScheduledForDate: string | null): boolean {
  const parts = londonDateParts(now);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return (hour > 6 || (hour === 6 && minute >= 0)) &&
    alreadyScheduledForDate !== londonBackupDateKey(now);
}

export function backupFailureMessage(message: string): string {
  if (/backup database connection was interrupted/i.test(message)) {
    return "The backup stopped because its database connection was lost. No completed backup was recorded. Retry using Backup All Data.";
  }
  if (/cleanup|temporary Drive file/i.test(message)) {
    return "The backup failed and one or more temporary readable Drive files could not be removed. Review this run's files before retrying.";
  }
  if (/storageQuotaExceeded|quotaExceeded/i.test(message)) {
    return "Google Drive has run out of available storage for this backup. Free Drive space, then retry.";
  }
  if (/insufficientFilePermissions|insufficientAuthenticationScopes|authError|invalidCredentials/i.test(message)) {
    return "Google Drive denied permission to write backup files. Reconnect Google Drive and confirm the backup folder allows editing, then retry.";
  }
  if (/google-sheet request failed \(429\)/i.test(message)) {
    return "Google Sheets rate-limited the backup upload. The incomplete files were not verified; wait a few minutes and retry.";
  }
  if (/google-drive request failed \(403\)/i.test(message)) {
    return "Google Drive denied a backup-file upload (403). Check available Drive storage and edit access to the backup folders, then retry.";
  }
  return "The readable backup failed before verification. Check the API logs and retry.";
}
