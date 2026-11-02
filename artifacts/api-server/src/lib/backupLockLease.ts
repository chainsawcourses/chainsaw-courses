interface BackupConnection {
  query(config: { text: string; query_timeout: number }): Promise<unknown>;
  on(event: "error", listener: (error: Error) => void): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
  release(destroy?: boolean): void;
}

/** A checked-out pg client needs its own error listener; the pool handles only idle clients. */
export function observeBackupConnection(client: BackupConnection, onLost: () => void, heartbeatMs = 20_000) {
  let lost = false;
  let stopped = false;
  let pending: Promise<void> = Promise.resolve();
  const handleError = (_error: Error) => {
    if (lost) return;
    lost = true;
    onLost();
  };
  client.on("error", handleError);
  // Uploads can take tens of minutes. Keep the lock-owning session active rather
  // than leaving it idle while all queries use other pool connections.
  const timer = setInterval(() => {
    if (stopped || lost) return;
    stopped = true; // Never overlap heartbeat queries.
    pending = client.query({ text: "SELECT 1", query_timeout: 10_000 }).then(
      () => {},
      (error: Error) => handleError(error),
    ).finally(() => { if (!released) stopped = false; });
  }, heartbeatMs);
  timer.unref();
  let released = false;
  return {
    get lost() { return lost; },
    assertHeld() {
      if (lost) throw new Error("The backup database connection was interrupted. Retry from admin.");
    },
    async stopHeartbeat() {
      released = true;
      stopped = true;
      clearInterval(timer);
      await pending;
    },
    release(destroy = false) {
      released = true;
      stopped = true;
      clearInterval(timer);
      try {
        // Returning a damaged client to the pool would repeat the failure.
        client.release(destroy || lost);
      } finally {
        client.removeListener("error", handleError);
      }
    },
  };
}

/** No age-based guess: recover records only after proving no backup owns the global lock. */
export async function recoverBackupOwnership<Client>(current: Client, deps: {
  acquire: () => Promise<Client | null>;
  isStillRunning: (client: Client) => Promise<boolean>;
  release: (client: Client) => Promise<void>;
}): Promise<Client> {
  const replacement = await deps.acquire();
  if (!replacement) throw new Error("The backup database connection was interrupted. Another backup owns the lock.");
  try {
    if (!await deps.isStillRunning(replacement)) {
      throw new Error("The backup database connection was interrupted. This run is no longer active.");
    }
    await deps.release(current);
    return replacement;
  } catch (error) {
    await deps.release(replacement);
    throw error;
  }
}

/** No age-based guess: recover records only after proving no backup owns the global lock. */
export async function reconcileUnownedBackupRuns<Client>(deps: {
  acquire: () => Promise<Client | null>;
  recover: (client: Client) => Promise<void>;
  release: (client: Client) => Promise<void>;
}): Promise<boolean> {
  const client = await deps.acquire();
  if (!client) return false;
  try {
    await deps.recover(client);
    return true;
  } finally {
    await deps.release(client);
  }
}
