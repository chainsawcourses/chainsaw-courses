import { timingSafeEqual } from "crypto";

const BILLING_SECRET_ENV = "WEBSITE_BILLING_EVENTS_SECRET";

export function hasBillingSecret(reqSecret: string | undefined): boolean {
  const configured = process.env[BILLING_SECRET_ENV];
  if (!configured || !reqSecret) return false;
  const supplied = Buffer.from(reqSecret);
  const expected = Buffer.from(configured);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}