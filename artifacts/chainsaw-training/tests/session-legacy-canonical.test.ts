import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_DELETION_TOMBSTONE_KEY,
  assertAccountDeletionPreflight,
  clearLegacyIdentity,
  hasAccountDeletionTombstone,
  markAccountDeletionPending,
  mirrorStoredSession,
  NATIVE_SESSION_VALIDATION_MARKER,
  readBrowserSession,
  storedSessionPayload,
  type LegacyStorage,
  type StoredSession,
} from "../src/lib/sessionStorage.ts";

class FakeStorage implements LegacyStorage {
  protected readonly values = new Map<string, string>();

  constructor(keys: string[]) {
    for (const key of keys) this.values.set(key, "present");
  }

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  has(key: string) {
    return this.values.has(key);
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const session = (status: StoredSession["status"] = "active"): StoredSession => ({
  version: 1,
  deviceId: "device-1",
  learner: {
    activationCode: "ABC123",
    fullName: "A Learner",
    email: "learner@example.com",
    userId: 42,
  },
  status,
});

test("validation payload changes when any stored session field changes", () => {
  const active = storedSessionPayload(session("active"));
  const suspended = storedSessionPayload(session("suspended"));
  assert.notEqual(active, suspended);
  assert.notEqual(active, storedSessionPayload({ ...session(), deviceId: "device-2" }));
});

test("native account deletion is blocked before the server on an old binary", () => {
  assert.doesNotThrow(() => assertAccountDeletionPreflight(false, false));
  assert.doesNotThrow(() => assertAccountDeletionPreflight(true, true));
  assert.throws(
    () => assertAccountDeletionPreflight(true, false),
    /requires an app update/,
  );
});

test("deletion tombstone suppresses restore and mirror, then clears after browser retry", async () => {
  const storage = new FakeStorage([NATIVE_SESSION_VALIDATION_MARKER, "deviceId"]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "" } });

  markAccountDeletionPending();
  assert.equal(hasAccountDeletionTombstone(), true);
  assert.equal(readBrowserSession(), null);
  assert.equal(await mirrorStoredSession(), false);
  assert.equal(storage.has(ACCOUNT_DELETION_TOMBSTONE_KEY), false);
  assert.equal(storage.has("deviceId"), false);
});

test("explicit identity deletion invalidates stale marker before deleting legacy state", () => {
  const storage = new FakeStorage([
    NATIVE_SESSION_VALIDATION_MARKER,
    "activationCode",
    "deviceId",
    "fullName",
    "email",
    "userId",
    "learnerSessionStatus",
    "verifiedCourseAccess:ABC123:42",
    "verifiedCourseAccess:OTHER:9",
    "unrelated",
  ]);
  const expiredCookies: string[] = [];

  clearLegacyIdentity(storage, (name) => expiredCookies.push(name));

  assert.equal(storage.has(NATIVE_SESSION_VALIDATION_MARKER), false);
  assert.equal(storage.has("activationCode"), false);
  assert.equal(storage.has("deviceId"), false);
  assert.equal(storage.has("learnerSessionStatus"), false);
  assert.equal(storage.has("verifiedCourseAccess:ABC123:42"), false);
  assert.equal(storage.has("verifiedCourseAccess:OTHER:9"), false);
  assert.equal(storage.has("unrelated"), true);
  assert.deepEqual(expiredCookies, [
    "activationCode",
    "deviceId",
    "fullName",
    "email",
    "userId",
    "learnerSessionStatus",
  ]);
});