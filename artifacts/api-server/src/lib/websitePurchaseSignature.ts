import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebsitePurchaseSignature(
  rawBody: Buffer | undefined,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!rawBody || !/^\d{10}$/.test(timestamp ?? "") || !/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;
  const seconds = Number(timestamp);
  if (Math.abs(now / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature!, "hex"));
}