export const RETAILER_REVIEW_INTERVAL_DAYS = 180;
export const RETAILER_REVIEW_DUE_NOTICE_DAYS = 30;
export const RETAILER_REVIEW_DAY_MS = 86_400_000;

export type RetailerReviewThreshold = "due" | "overdue";
export type RetailerReviewStatus = "current" | RetailerReviewThreshold | "not-applicable";

export function retailerReviewCutoffDate(
  now: Date,
  threshold: RetailerReviewThreshold,
): Date {
  const ageDays = threshold === "due"
    ? RETAILER_REVIEW_INTERVAL_DAYS - RETAILER_REVIEW_DUE_NOTICE_DAYS
    : RETAILER_REVIEW_INTERVAL_DAYS;
  return new Date(now.getTime() - ageDays * RETAILER_REVIEW_DAY_MS);
}

export function getRetailerReviewStatus(
  retailer: {
    active: boolean;
    verificationStatus: string;
    lastCheckedAt: string | Date | null;
  },
  now = new Date(),
): RetailerReviewStatus {
  if (!retailer.active || retailer.verificationStatus !== "verified") {
    return "not-applicable";
  }
  if (!retailer.lastCheckedAt) return "overdue";

  const checkedAt = retailer.lastCheckedAt instanceof Date
    ? retailer.lastCheckedAt
    : new Date(retailer.lastCheckedAt);
  if (Number.isNaN(checkedAt.getTime())) return "overdue";
  if (checkedAt <= retailerReviewCutoffDate(now, "overdue")) return "overdue";
  if (checkedAt <= retailerReviewCutoffDate(now, "due")) return "due";
  return "current";
}