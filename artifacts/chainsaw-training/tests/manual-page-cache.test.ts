import assert from "node:assert/strict";
import test from "node:test";
import {
  clearManualPageCache,
  getCachedManualPage,
  manualPageCacheSize,
  MAX_MANUAL_PAGE_CACHE_ENTRIES,
} from "../src/lib/manualPageCache.ts";

test("manual page cache remains bounded and evicts least-recently-used pages", async () => {
  clearManualPageCache();
  const loads = new Map<string, number>();
  const load = (page: string) => () => {
    loads.set(page, (loads.get(page) ?? 0) + 1);
    return Promise.resolve(new Blob([page]));
  };

  for (let page = 1; page <= MAX_MANUAL_PAGE_CACHE_ENTRIES; page += 1) {
    await getCachedManualPage("learner-a", String(page), load(String(page)));
  }
  await getCachedManualPage("learner-a", "1", load("1"));
  await getCachedManualPage("learner-a", "9", load("9"));

  assert.equal(manualPageCacheSize(), MAX_MANUAL_PAGE_CACHE_ENTRIES);
  await getCachedManualPage("learner-a", "2", load("2"));
  assert.equal(loads.get("1"), 1, "recently used page should stay cached");
  assert.equal(loads.get("2"), 2, "least recently used page should be fetched again");
});

test("failed requests and learner changes do not leave protected blobs cached", async () => {
  clearManualPageCache();
  await assert.rejects(getCachedManualPage("learner-a", "1", () => Promise.reject(new Error("denied"))));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(manualPageCacheSize(), 0);

  await getCachedManualPage("learner-a", "1", () => Promise.resolve(new Blob(["a"])));
  await getCachedManualPage("learner-b", "1", () => Promise.resolve(new Blob(["b"])));
  clearManualPageCache("learner-a");
  assert.equal(manualPageCacheSize(), 1);
  clearManualPageCache();
});