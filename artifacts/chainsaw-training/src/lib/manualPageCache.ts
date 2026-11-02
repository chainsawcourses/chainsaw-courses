export const MAX_MANUAL_PAGE_CACHE_ENTRIES = 8;

type CacheEntry = {
  request: Promise<Blob>;
  identity: string;
};

const entries = new Map<string, CacheEntry>();

function touch(key: string, entry: CacheEntry) {
  entries.delete(key);
  entries.set(key, entry);
}

export function getCachedManualPage(
  identity: string,
  filename: string,
  load: () => Promise<Blob>,
): Promise<Blob> {
  const key = `${identity}:${filename}`;
  const cached = entries.get(key);
  if (cached) {
    touch(key, cached);
    return cached.request;
  }

  const entry: CacheEntry = { identity, request: load() };
  entries.set(key, entry);
  while (entries.size > MAX_MANUAL_PAGE_CACHE_ENTRIES) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
  entry.request.catch(() => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return entry.request;
}

export function clearManualPageCache(identity?: string) {
  if (!identity) {
    entries.clear();
    return;
  }
  for (const [key, entry] of entries) {
    if (entry.identity === identity) entries.delete(key);
  }
}

export function clearCachedManualPage(identity: string, filename: string) {
  entries.delete(`${identity}:${filename}`);
}

export function manualPageCacheSize() {
  return entries.size;
}