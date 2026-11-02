export const BACKUP_ADVISORY_LOCK_KEYS = [1128418353, 1] as const;

type QueryClient = {
  query<T>(sql: string, values?: number[]): Promise<{ rows: T[] }>;
};

export async function tryAcquireBackupAdvisoryLock(client: QueryClient): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS locked",
    [...BACKUP_ADVISORY_LOCK_KEYS],
  );
  return result.rows[0]?.locked === true;
}

export async function releaseBackupAdvisoryLock(client: QueryClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1, $2)", [...BACKUP_ADVISORY_LOCK_KEYS]);
}
