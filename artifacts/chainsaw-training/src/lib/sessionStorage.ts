import { Capacitor, registerPlugin } from "@capacitor/core";

const SESSION_KEYS = ["activationCode", "deviceId", "fullName", "email", "userId", "enrollmentId"] as const;
type SessionKey = typeof SESSION_KEYS[number];

const NATIVE_SESSION_KEY = "learnerSession";
export const ACCOUNT_DELETION_TOMBSTONE_KEY = "learnerAccountDeletionTombstone";
export const NATIVE_SESSION_VALIDATION_MARKER = "learnerSecureSessionValidation";
export const NATIVE_SESSION_VALIDATION_VERSION = "v1";
const BROWSER_SESSION_STATUS_KEY = "learnerSessionStatus";
const COOKIE_EXPIRY_DAYS = 365;
const NATIVE_OPERATION_TIMEOUT_MS = 3_000;

export type LearnerSession = {
  activationCode: string;
  fullName: string;
  email: string;
  userId: number;
  enrollmentId?: number | null;
};

export type StoredSession = {
  version: 1;
  deviceId: string;
  learner?: LearnerSession;
  status?: "active" | "suspended";
};

type LearnerSecureSessionPlugin = {
  get(options: { key: string }): Promise<{ value: unknown | null }>;
  set(options: { key: string; value: StoredSession }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  removeLegacy(): Promise<void>;
};

/*
 * This is deliberately an app-owned plugin. Do not replace it with a generic
 * secure-storage plugin: older hosted web bundles run inside already
 * distributed binaries and must never call a bridge they were not built with.
 */
const LearnerSecureSession = registerPlugin<LearnerSecureSessionPlugin>("LearnerSecureSession");

function setCookie(name: string, value: string) {
  const expires = new Date(Date.now() + COOKIE_EXPIRY_DAYS * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const pair = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(prefix.length));
  } catch {
    return null;
  }
}

function readBrowserValue(key: SessionKey): string | null {
  const fromStorage = localStorage.getItem(key);
  if (fromStorage !== null) return fromStorage;
  const fromCookie = getCookie(key);
  if (fromCookie !== null) {
    invalidateValidationMarker();
    localStorage.setItem(key, fromCookie);
  }
  return fromCookie;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<StoredSession>;
  if (session.version !== 1 || typeof session.deviceId !== "string" || !session.deviceId) return false;
  if (session.status !== undefined && session.status !== "active" && session.status !== "suspended") return false;
  if (!session.learner) return true;
  return typeof session.learner.activationCode === "string"
    && typeof session.learner.fullName === "string"
    && typeof session.learner.email === "string"
    && typeof session.learner.userId === "number"
    && Number.isFinite(session.learner.userId)
    && (session.learner.enrollmentId === undefined || session.learner.enrollmentId === null || (typeof session.learner.enrollmentId === "number" && Number.isFinite(session.learner.enrollmentId)));
}

/**
 * Whether this particular WebView has the replacement plugin. This is only a
 * capability check; it must never be used to choose the startup session.
 */
export function usesNativeSecureStorage(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LearnerSecureSession");
}

export function hasAccountDeletionTombstone(): boolean {
  return localStorage.getItem(ACCOUNT_DELETION_TOMBSTONE_KEY) !== null;
}

export function markAccountDeletionPending(): void {
  invalidateValidationMarker();
  localStorage.setItem(ACCOUNT_DELETION_TOMBSTONE_KEY, "v1");
}

export function preflightAccountDeletion(): void {
  assertAccountDeletionPreflight(
    Capacitor.isNativePlatform(),
    Capacitor.isPluginAvailable("LearnerSecureSession"),
  );
}

export function assertAccountDeletionPreflight(
  nativePlatform: boolean,
  pluginAvailable: boolean,
): void {
  if (nativePlatform && !pluginAvailable) {
    throw new Error("Account deletion requires an app update before it can continue");
  }
}

export function readBrowserSession(): StoredSession | null {
  if (hasAccountDeletionTombstone()) return null;
  const deviceId = readBrowserValue("deviceId");
  if (!deviceId) return null;
  const activationCode = readBrowserValue("activationCode");
  const fullName = readBrowserValue("fullName");
  const email = readBrowserValue("email");
  const rawUserId = readBrowserValue("userId");
  const rawEnrollmentId = readBrowserValue("enrollmentId");
  const userId = rawUserId ? Number(rawUserId) : null;
  const enrollmentId = rawEnrollmentId ? Number(rawEnrollmentId) : null;
  const learner = activationCode && fullName && email && userId !== null && Number.isFinite(userId)
    ? { activationCode, fullName, email, userId, enrollmentId: Number.isFinite(enrollmentId) ? enrollmentId : null }
    : undefined;
  const storedStatus = localStorage.getItem(BROWSER_SESSION_STATUS_KEY) ?? getCookie(BROWSER_SESSION_STATUS_KEY);
  if (storedStatus !== null && localStorage.getItem(BROWSER_SESSION_STATUS_KEY) === null) {
    invalidateValidationMarker();
    localStorage.setItem(BROWSER_SESSION_STATUS_KEY, storedStatus);
  }
  const status = learner && storedStatus === "suspended" ? "suspended" : "active";
  return { version: 1, deviceId, learner, status };
}

/**
 * Browser storage is the canonical session during the compatibility period.
 * Keeping this function async preserves the API used by the API client.
 */
export async function readStoredSession(): Promise<StoredSession | null> {
  return readBrowserSession();
}

function exactSessionMatch(left: unknown, right: StoredSession): boolean {
  return isStoredSession(left) && stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function storedSessionPayload(session: StoredSession): string {
  return stableJson(session);
}

function invalidateValidationMarker() {
  localStorage.removeItem(NATIVE_SESSION_VALIDATION_MARKER);
}

async function validationMarker(session: StoredSession): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(storedSessionPayload(session)),
  );
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${NATIVE_SESSION_VALIDATION_VERSION}:${hex}`;
}

async function withNativeTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Native secure session operation timed out")), NATIVE_OPERATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function removeNativeMirror(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!usesNativeSecureStorage()) {
    throw new Error("Account deletion requires an app update before native cleanup can complete");
  }
  await withNativeTimeout(LearnerSecureSession.remove({ key: NATIVE_SESSION_KEY }));
  await withNativeTimeout(LearnerSecureSession.removeLegacy());
  if (Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("AppleStore")) {
    const { clearApplePurchaseIdentity } = await import("./appleStore");
    await withNativeTimeout(clearApplePurchaseIdentity());
  }
  const saved = await withNativeTimeout(LearnerSecureSession.get({ key: NATIVE_SESSION_KEY }));
  const nativeValue = saved && typeof saved === "object" && "value" in saved ? saved.value : saved;
  if (nativeValue !== null) throw new Error("Native learner session removal could not be verified");
}

/**
 * Retries only local deletion work. It never calls the server and leaves the
 * tombstone in place when an installed native bridge cannot be cleaned.
 */
export async function retryAccountDeletionCleanup(): Promise<boolean> {
  if (!hasAccountDeletionTombstone()) return true;
  clearBrowserIdentity();
  try {
    await removeNativeMirror();
    localStorage.removeItem(ACCOUNT_DELETION_TOMBSTONE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort post-render mirror. It intentionally does not participate in
 * startup or login/logout completion, and never changes browser data.
 */
export async function mirrorStoredSession(session: StoredSession | null = readBrowserSession()): Promise<boolean> {
  if (hasAccountDeletionTombstone()) {
    await retryAccountDeletionCleanup();
    return false;
  }
  if (!usesNativeSecureStorage() || !session) return false;
  try {
    await withNativeTimeout(LearnerSecureSession.set({ key: NATIVE_SESSION_KEY, value: session }));
    const result = await withNativeTimeout(LearnerSecureSession.get({ key: NATIVE_SESSION_KEY }));
    const nativeValue = result && typeof result === "object" && "value" in result
      ? result.value
      : result;
    if (!exactSessionMatch(nativeValue, session)) {
      throw new Error("Secure learner session verification failed");
    }
    const currentBrowserSession = readBrowserSession();
    if (!currentBrowserSession || storedSessionPayload(currentBrowserSession) !== storedSessionPayload(session)) {
      throw new Error("Browser learner session changed during native validation");
    }
    localStorage.setItem(NATIVE_SESSION_VALIDATION_MARKER, await validationMarker(session));
    return true;
  } catch {
    // Native storage is an observability/defence-in-depth mirror at this
    // stage. A failed bridge must never block the browser session or UI.
    invalidateValidationMarker();
    return false;
  }
}

/**
 * Kept for callers from the previous release. It no longer migrates or
 * removes anything: old binaries stay legacy-first and legacy keys/cookies
 * remain untouched.
 */
export async function migrateLegacyNativeSession(): Promise<StoredSession | null> {
  return readBrowserSession();
}

function mirrorAfterLegacyWrite() {
  void mirrorStoredSession().catch(() => {
    // mirrorStoredSession already handles failures; keep this guard for
    // unexpected plugin proxy errors.
  });
}

function writeLegacySession(session: StoredSession) {
  invalidateValidationMarker();
  const values: Record<SessionKey, string> = {
    activationCode: session.learner?.activationCode ?? "",
    deviceId: session.deviceId,
    fullName: session.learner?.fullName ?? "",
    email: session.learner?.email ?? "",
    userId: session.learner ? String(session.learner.userId) : "",
    enrollmentId: session.learner?.enrollmentId == null ? "" : String(session.learner.enrollmentId),
  };
  for (const key of SESSION_KEYS) {
    setCookie(key, values[key]);
    localStorage.setItem(key, values[key]);
  }
  const status = session.status ?? "active";
  setCookie(BROWSER_SESSION_STATUS_KEY, status);
  localStorage.setItem(BROWSER_SESSION_STATUS_KEY, status);
}

export async function saveLearnerSession(deviceId: string, learner: LearnerSession): Promise<void> {
  if (hasAccountDeletionTombstone() && !(await retryAccountDeletionCleanup())) {
    throw new Error("Account deletion cleanup is still pending");
  }
  const normalized: LearnerSession = {
    activationCode: learner.activationCode.trim().toUpperCase(),
    fullName: learner.fullName.trim(),
    email: learner.email.trim().toLowerCase(),
    userId: learner.userId,
    enrollmentId: learner.enrollmentId ?? null,
  };
  writeLegacySession({ version: 1, deviceId, learner: normalized, status: "active" });
  mirrorAfterLegacyWrite();
}

export async function saveDeviceSession(deviceId: string): Promise<void> {
  if (hasAccountDeletionTombstone() && !(await retryAccountDeletionCleanup())) {
    throw new Error("Account deletion cleanup is still pending");
  }
  writeLegacySession({ version: 1, deviceId, status: "active" });
  mirrorAfterLegacyWrite();
}

export async function suspendLearnerSession(deviceId: string, learner: LearnerSession): Promise<void> {
  if (hasAccountDeletionTombstone() && !(await retryAccountDeletionCleanup())) {
    throw new Error("Account deletion cleanup is still pending");
  }
  const normalized: LearnerSession = {
    activationCode: learner.activationCode.trim().toUpperCase(),
    fullName: learner.fullName.trim(),
    email: learner.email.trim().toLowerCase(),
    userId: learner.userId,
    enrollmentId: learner.enrollmentId ?? null,
  };
  writeLegacySession({ version: 1, deviceId, learner: normalized, status: "suspended" });
  mirrorAfterLegacyWrite();
}

export async function activateStoredLearnerSession(): Promise<StoredSession> {
  if (hasAccountDeletionTombstone() && !(await retryAccountDeletionCleanup())) {
    throw new Error("Account deletion cleanup is still pending");
  }
  const stored = readBrowserSession();
  if (!stored?.learner) throw new Error("Bonded learner session is unavailable");
  const active = { ...stored, status: "active" as const };
  writeLegacySession(active);
  mirrorAfterLegacyWrite();
  return active;
}

export async function clearLearnerSession(deviceId: string, forgetDevice = false): Promise<void> {
  // Keep the legacy record and cookies present for compatibility with
  // installed releases. Suspended status is the logout marker and prevents
  // learner credentials from being sent by getLearnerAuthHeaders.
  const current = readBrowserSession();
  if (forgetDevice) {
    clearBrowserIdentity();
    await removeNativeMirror();
    localStorage.removeItem(ACCOUNT_DELETION_TOMBSTONE_KEY);
    return;
  }
  writeLegacySession({
    version: 1,
    deviceId: current?.deviceId || deviceId,
    learner: current?.learner,
    status: "suspended",
  });
  mirrorAfterLegacyWrite();
}

export type LegacyStorage = Pick<Storage, "length" | "key" | "removeItem">;

export function clearLegacyIdentity(
  storage: LegacyStorage,
  expireCookie: (name: string) => void,
) {
  storage.removeItem(NATIVE_SESSION_VALIDATION_MARKER);
  for (const key of SESSION_KEYS) {
    storage.removeItem(key);
    expireCookie(key);
  }
  storage.removeItem(BROWSER_SESSION_STATUS_KEY);
  expireCookie(BROWSER_SESSION_STATUS_KEY);
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("verifiedCourseAccess:")) storage.removeItem(key);
  }
}

function clearBrowserIdentity() {
  clearLegacyIdentity(
    localStorage,
    (name) => {
      document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    },
  );
}

export async function getLearnerAuthHeaders(): Promise<HeadersInit | null> {
  const session = readBrowserSession();
  if (!session) return null;
  const headers: Record<string, string> = { deviceid: session.deviceId };
  if (session.learner && session.status !== "suspended") {
    headers.activationcode = session.learner.activationCode;
    headers.userid = String(session.learner.userId);
  }
  return headers;
}