export type AccessStatus = "active" | "expired" | "unknown";

export type VerifiedAccess = {
  accessExpiresAt: string | null;
  accessStatus: AccessStatus;
};

export type CourseRouteGateDecision = "allow" | "hold" | "expired";

const ACCESS_STORAGE_PREFIX = "verifiedCourseAccess:";
// Browsers clamp oversized timeouts (often to zero). Rechecking daily keeps a
// six-month access window from turning into a rapid render loop and naturally
// reschedules until its exact expiry boundary.
export const MAX_ACCESS_RECHECK_DELAY_MS = 24 * 60 * 60 * 1000;

export function learnerIdentity(activationCode: string | null, userId: number | null): string | null {
  return activationCode && userId !== null ? `${activationCode}:${userId}` : null;
}

export function isProtectedCourseRoute(path: string): boolean {
  return path === "/training" ||
    path.startsWith("/training/") ||
    path.startsWith("/quiz/") ||
    path === "/exam" ||
    path === "/mock-test" ||
    path === "/cross-cut-sim" ||
    path === "/manual" ||
    path === "/resources" ||
    path.startsWith("/qr/") ||
    path === "/exam-preview" ||
    path === "/species-guide" ||
    path === "/glossary" ||
    path === "/hazards-reference" ||
    path === "/chain-chart" ||
    path === "/biosecurity-map" ||
    path === "/gateway";
}

// Expiry is an exclusive boundary: access is unavailable at the precise expiry
// instant, rather than at the end of that calendar day.
export function resolveAccessStatus(
  reportedStatus: AccessStatus,
  accessExpiresAt: string | null,
  now = Date.now(),
): AccessStatus {
  if (reportedStatus === "expired") return "expired";
  if (accessExpiresAt) {
    const expiresAt = Date.parse(accessExpiresAt);
    if (!Number.isNaN(expiresAt) && now >= expiresAt) return "expired";
  }
  return reportedStatus;
}

export function mayAccessRoute(path: string, access: VerifiedAccess, now = Date.now()): boolean {
  return courseRouteGateDecision(path, access, now) === "allow";
}

export function courseRouteGateDecision(
  path: string,
  access: VerifiedAccess,
  now = Date.now(),
): CourseRouteGateDecision {
  if (!isProtectedCourseRoute(path)) return "allow";
  const status = resolveAccessStatus(access.accessStatus, access.accessExpiresAt, now);
  if (status === "active") return "allow";
  if (status === "expired") return "expired";
  // Hold the requested route without rendering it while startup/account-switch
  // verification is pending. Active verification can then reveal that same path.
  return "hold";
}

export function millisecondsUntilAccessExpiry(access: VerifiedAccess, now = Date.now()): number | null {
  if (access.accessStatus !== "active" || !access.accessExpiresAt) return null;
  const expiresAt = Date.parse(access.accessExpiresAt);
  if (Number.isNaN(expiresAt)) return null;
  return Math.min(MAX_ACCESS_RECHECK_DELAY_MS, Math.max(0, expiresAt - now));
}

export function accessStorageKey(identity: string): string {
  return `${ACCESS_STORAGE_PREFIX}${identity}`;
}

export function readVerifiedAccess(storage: Pick<Storage, "getItem">, identity: string | null): VerifiedAccess | null {
  if (!identity) return null;
  try {
    const value: unknown = JSON.parse(storage.getItem(accessStorageKey(identity)) ?? "null");
    if (!value || typeof value !== "object") return null;
    const access = value as Partial<VerifiedAccess>;
    if (access.accessStatus !== "active" && access.accessStatus !== "expired" && access.accessStatus !== "unknown") return null;
    if (access.accessExpiresAt !== null && typeof access.accessExpiresAt !== "string") return null;
    return { accessStatus: access.accessStatus, accessExpiresAt: access.accessExpiresAt };
  } catch {
    return null;
  }
}

export function persistVerifiedAccess(storage: Pick<Storage, "setItem">, identity: string | null, access: VerifiedAccess): void {
  if (!identity) return;
  storage.setItem(accessStorageKey(identity), JSON.stringify(access));
}

export function accountSwitchDecision(
  storage: Pick<Storage, "getItem">,
  previousIdentity: string | null,
  nextIdentity: string | null,
): { clearQueryCache: boolean; access: VerifiedAccess } {
  return {
    clearQueryCache: previousIdentity !== nextIdentity,
    access: readVerifiedAccess(storage, nextIdentity) ?? { accessStatus: "unknown", accessExpiresAt: null },
  };
}