const STORAGE_KEY = "pendingVideoCompletions:v1";

export type VideoCompletionIdentity = {
  activationCode: string;
  deviceId: string;
  userId: number;
  enrollmentId: number;
};

export type PendingVideoCompletion = VideoCompletionIdentity & {
  moduleId: number;
};

function entryKey(entry: PendingVideoCompletion) {
  return [
    entry.activationCode,
    entry.deviceId,
    entry.userId,
    entry.enrollmentId,
    entry.moduleId,
  ].join(":");
}

function readPending(): PendingVideoCompletion[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PendingVideoCompletion => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<PendingVideoCompletion>;
      return typeof candidate.activationCode === "string"
        && typeof candidate.deviceId === "string"
        && Number.isInteger(candidate.userId)
        && Number.isInteger(candidate.enrollmentId)
        && Number.isInteger(candidate.moduleId);
    });
  } catch {
    return [];
  }
}

function writePending(entries: PendingVideoCompletion[]) {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // The immediate request can still succeed when storage is unavailable.
  }
}

export function retainVideoCompletion(entry: PendingVideoCompletion) {
  const pending = readPending();
  if (!pending.some((candidate) => entryKey(candidate) === entryKey(entry))) {
    writePending([...pending, entry]);
  }
}

export function releaseVideoCompletion(entry: PendingVideoCompletion) {
  writePending(readPending().filter((candidate) => entryKey(candidate) !== entryKey(entry)));
}

function belongsToIdentity(entry: PendingVideoCompletion, identity: VideoCompletionIdentity) {
  return entry.activationCode === identity.activationCode
    && entry.deviceId === identity.deviceId
    && entry.userId === identity.userId
    && entry.enrollmentId === identity.enrollmentId;
}

const activeFlushes = new Map<string, Promise<PendingVideoCompletion[]>>();

export function retryPendingVideoCompletions(identity: VideoCompletionIdentity): Promise<PendingVideoCompletion[]> {
  const identityKey = entryKey({ ...identity, moduleId: 0 });
  const existingFlush = activeFlushes.get(identityKey);
  if (existingFlush) return existingFlush;

  const flush = (async () => {
    const completed: PendingVideoCompletion[] = [];
    const attempted = new Set<string>();
    while (true) {
      const matching = readPending().filter((entry) =>
        belongsToIdentity(entry, identity) && !attempted.has(entryKey(entry)));
      if (matching.length === 0) break;
      for (const entry of matching) {
        attempted.add(entryKey(entry));
        try {
          const response = await fetch("/api/progress/complete-video", {
            method: "POST",
            keepalive: true,
            headers: {
              "content-type": "application/json",
              activationcode: entry.activationCode,
              deviceid: entry.deviceId,
              userid: String(entry.userId),
            },
            body: JSON.stringify({
              moduleId: entry.moduleId,
              deviceId: entry.deviceId,
              activationCode: entry.activationCode,
              enrollmentId: entry.enrollmentId,
            }),
          });
          if (!response.ok) continue;
          releaseVideoCompletion(entry);
          completed.push(entry);
        } catch {
          // Keep the entry for the next online event or course launch.
        }
      }
    }
    return completed;
  })().finally(() => {
    activeFlushes.delete(identityKey);
  });

  activeFlushes.set(identityKey, flush);
  return flush;
}