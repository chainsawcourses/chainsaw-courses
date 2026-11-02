import { createHash, createHmac } from "node:crypto";

const SHOPIFY_ACTIVATION_URL =
  "https://shopify-store-chainsawcourses.replit.app/api/activate";

type ShopifyActivationResponse = {
  success?: boolean;
  message?: string;
};

export type ShopifyActivationResult = {
  success: boolean;
  message: string;
  status: number;
  retryAfter?: string;
};

export function normalizePurchaseCode(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/[.,;:]+$/g, "")
    .trim()
    .toUpperCase();
}

export function createActivationIdempotencyKey(input: {
  purchaseCode: string;
  email: string;
}): string {
  return createHash("sha256")
    .update(`${normalizePurchaseCode(input.purchaseCode)}\n${input.email.trim().toLowerCase()}`)
    .digest("hex");
}

export function createActivationSignature(
  rawBody: string,
  timestamp: number,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export async function validateShopifyActivation(input: {
  purchaseCode: string;
  fullName: string;
  email: string;
}, request: typeof fetch = fetch, idempotencyKey = createActivationIdempotencyKey(input), signing: {
  secret?: string;
  timestamp?: number;
} = {}): Promise<ShopifyActivationResult> {
  const secret = signing.secret ?? process.env.SHOPIFY_ACTIVATION_SECRET;
  if (!secret) {
    return {
      success: false,
      message:
        "The licence service is temporarily unavailable. Please try again shortly.",
      status: 503,
    };
  }

  const rawBody = JSON.stringify(input);
  const timestamp = signing.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = createActivationSignature(rawBody, timestamp, secret);
  let response: Response;

  try {
    response = await request(SHOPIFY_ACTIVATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Activation-Timestamp": String(timestamp),
        "X-Activation-Signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      success: false,
      message:
        "The licence service is temporarily unavailable. Please try again shortly.",
      status: 503,
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | ShopifyActivationResponse
    | null;
  const message =
    payload?.message?.trim() ||
    (response.ok
      ? "The licence service returned an invalid response."
      : "The licence could not be validated.");
  const success = response.ok && payload?.success === true;
  const status = success
    ? 200
    : response.ok && payload?.success === false
      ? 400
      : response.status >= 400
        ? response.status
        : 502;
  const retryAfter =
    status === 429
      ? response.headers.get("Retry-After")?.trim() || undefined
      : undefined;

  return {
    success,
    message,
    status,
    ...(retryAfter ? { retryAfter } : {}),
  };
}
