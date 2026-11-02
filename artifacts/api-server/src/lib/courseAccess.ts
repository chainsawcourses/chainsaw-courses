/**
 * Access periods are calendar periods, calculated using UTC components so a
 * daylight-saving transition cannot shorten or lengthen a learner's access.
 */
export function addCalendarMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

type AccessUser = {
  accessExpiresAt: Date | null;
  subscriptionExpiresAt?: Date | null;
  /** Canonical learner-level entitlement name; legacy field remains supported. */
  subscriptionPaidThroughAt?: Date | null;
  /** A canonical row is authoritative even when its paid-through date is null. */
  hasCanonicalSubscription?: boolean;
  status?: string;
  isDeleted?: boolean;
};

/**
 * Returns the entitlement cutoff exposed to clients. A null base cutoff means
 * unlimited access; otherwise a paid subscription can only extend that cutoff.
 */
export function getEffectiveCourseAccessExpiry(user: AccessUser): Date | null {
  if (user.isDeleted || user.status === "deleted" || user.status === "revoked") return new Date(0);
  if (user.accessExpiresAt === null) return null;
  // Fall back to the legacy field only before a canonical subscription row
  // exists. An authoritative ended event deliberately leaves the canonical
  // paid-through date null and must not revive an old legacy expiry.
  const subscriptionExpiry = user.hasCanonicalSubscription
    ? user.subscriptionPaidThroughAt
    : (user.subscriptionPaidThroughAt ?? user.subscriptionExpiresAt);
  if (subscriptionExpiry && subscriptionExpiry > user.accessExpiresAt) {
    return subscriptionExpiry;
  }
  return user.accessExpiresAt;
}

export function hasActiveCourseAccess(user: AccessUser, now = new Date()): boolean {
  const effectiveExpiry = getEffectiveCourseAccessExpiry(user);
  return effectiveExpiry === null || effectiveExpiry > now;
}