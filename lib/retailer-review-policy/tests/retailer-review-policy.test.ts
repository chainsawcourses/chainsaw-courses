import assert from "node:assert/strict";
import test from "node:test";
import {
  getRetailerReviewStatus,
  RETAILER_REVIEW_DAY_MS,
  retailerReviewCutoffDate,
} from "../src/index.ts";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function verifiedRetailer(lastCheckedAt: Date) {
  return {
    active: true,
    verificationStatus: "verified",
    lastCheckedAt,
  };
}

test("retailer review status changes at the shared due and overdue boundaries", () => {
  const due = retailerReviewCutoffDate(NOW, "due");
  const overdue = retailerReviewCutoffDate(NOW, "overdue");

  assert.equal(
    getRetailerReviewStatus(verifiedRetailer(new Date(due.getTime() + 1)), NOW),
    "current",
  );
  assert.equal(getRetailerReviewStatus(verifiedRetailer(due), NOW), "due");
  assert.equal(
    getRetailerReviewStatus(verifiedRetailer(new Date(overdue.getTime() + 1)), NOW),
    "due",
  );
  assert.equal(getRetailerReviewStatus(verifiedRetailer(overdue), NOW), "overdue");

  assert.equal(NOW.getTime() - due.getTime(), 150 * RETAILER_REVIEW_DAY_MS);
  assert.equal(NOW.getTime() - overdue.getTime(), 180 * RETAILER_REVIEW_DAY_MS);
});