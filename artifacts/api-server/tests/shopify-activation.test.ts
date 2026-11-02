import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivationIdempotencyKey,
  createActivationSignature,
  normalizePurchaseCode,
  validateShopifyActivation,
} from "../src/lib/shopifyActivation.ts";

const input = {
  purchaseCode: "CC-6A3DF-34D1F",
  fullName: "Test Learner",
  email: "learner@example.com",
};
const signing = {
  secret: "test-shared-secret",
  timestamp: 1_789_070_000,
};

test("normalizes punctuation and invisible characters copied from activation emails", () => {
  assert.equal(
    normalizePurchaseCode(" \u200Bcci-example-code.\uFEFF "),
    "CCI-EXAMPLE-CODE",
  );
});

test("sends the exact Shopify activation contract as JSON", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({
      success: true,
      message: "Licence activated.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await validateShopifyActivation(
    input,
    request,
    createActivationIdempotencyKey(input),
    signing,
  );
  const rawBody = JSON.stringify(input);

  assert.equal(
    capturedUrl,
    "https://shopify-store-chainsawcourses.replit.app/api/activate",
  );
  assert.equal(capturedInit?.method, "POST");
  assert.deepEqual(capturedInit?.headers, {
    "Content-Type": "application/json",
    "Idempotency-Key": createActivationIdempotencyKey(input),
    "X-Activation-Timestamp": String(signing.timestamp),
    "X-Activation-Signature": createActivationSignature(
      rawBody,
      signing.timestamp,
      signing.secret,
    ),
  });
  assert.equal(capturedInit?.body, rawBody);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), input);
  assert.deepEqual(result, {
    success: true,
    message: "Licence activated.",
    status: 200,
  });
});

test("signs the exact raw request body using HMAC-SHA256", () => {
  assert.equal(
    createActivationSignature(
      '{"purchaseCode":"TEST"}',
      1_700_000_000,
      "shared-secret",
    ),
    "cc790d459992d84458f608b249a07e324dad3504c6f5fe024fa791b2ff610aeb",
  );
});

test("uses a stable idempotency key for retries by the same licence and email", () => {
  const first = createActivationIdempotencyKey(input);
  const retry = createActivationIdempotencyKey({
    purchaseCode: ` ${input.purchaseCode.toLowerCase()} `,
    email: ` ${input.email.toUpperCase()} `,
  });
  const otherLearner = createActivationIdempotencyKey({
    purchaseCode: input.purchaseCode,
    email: "other@example.com",
  });

  assert.equal(retry, first);
  assert.notEqual(otherLearner, first);
});

test("preserves Shopify's message when licence validation fails", async () => {
  const request = async () => new Response(JSON.stringify({
    success: false,
    message: "This licence is assigned to a different email address.",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await validateShopifyActivation(
    input,
    request,
    createActivationIdempotencyKey(input),
    signing,
  );

  assert.deepEqual(result, {
    success: false,
    message: "This licence is assigned to a different email address.",
    status: 400,
  });
});

test("reports an unavailable licence service without weakening validation", async () => {
  const request = async (): Promise<Response> => {
    throw new Error("network unavailable");
  };

  const result = await validateShopifyActivation(
    input,
    request,
    createActivationIdempotencyKey(input),
    signing,
  );

  assert.equal(result.success, false);
  assert.equal(result.status, 503);
  assert.match(result.message, /temporarily unavailable/i);
});

test("fails closed without the shared activation secret", async () => {
  let called = false;
  const request = async (): Promise<Response> => {
    called = true;
    return new Response();
  };

  const result = await validateShopifyActivation(
    input,
    request,
    createActivationIdempotencyKey(input),
    { secret: "" },
  );

  assert.equal(called, false);
  assert.equal(result.success, false);
  assert.equal(result.status, 503);
});

test("retries keep the same raw body and idempotency key", async () => {
  const attempts: RequestInit[] = [];
  const request = async (_url: string | URL | Request, init?: RequestInit) => {
    attempts.push(init ?? {});
    if (attempts.length === 1) {
      throw new Error("response lost");
    }
    return new Response(JSON.stringify({
      success: false,
      message: "Purchase code not found. Please check your code and try again.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const idempotencyKey = createActivationIdempotencyKey(input);

  await validateShopifyActivation(input, request, idempotencyKey, signing);
  const retry = await validateShopifyActivation(input, request, idempotencyKey, signing);

  assert.equal(attempts[0]?.body, attempts[1]?.body);
  assert.equal(
    (attempts[0]?.headers as Record<string, string>)["Idempotency-Key"],
    (attempts[1]?.headers as Record<string, string>)["Idempotency-Key"],
  );
  assert.equal(retry.success, false);
  assert.match(retry.message, /purchase code not found/i);
});

test("concurrent matching requests keep the same idempotency key", async () => {
  const attempts: RequestInit[] = [];
  const request = async (_url: string | URL | Request, init?: RequestInit) => {
    attempts.push(init ?? {});
    return new Response(JSON.stringify({
      success: false,
      message: "Purchase code not found. Please check your code and try again.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await Promise.all([
    validateShopifyActivation(input, request, undefined, signing),
    validateShopifyActivation(input, request, undefined, signing),
  ]);

  assert.equal(
    (attempts[0]?.headers as Record<string, string>)["Idempotency-Key"],
    createActivationIdempotencyKey(input),
  );
  assert.equal(
    (attempts[1]?.headers as Record<string, string>)["Idempotency-Key"],
    createActivationIdempotencyKey(input),
  );
});

test("preserves Retry-After when Shopify throttles activation", async () => {
  const request = async () => new Response(JSON.stringify({
    success: false,
    message: "Too many activation attempts. Please try again shortly.",
  }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "30",
    },
  });

  const result = await validateShopifyActivation(
    input,
    request,
    createActivationIdempotencyKey(input),
    signing,
  );

  assert.deepEqual(result, {
    success: false,
    message: "Too many activation attempts. Please try again shortly.",
    status: 429,
    retryAfter: "30",
  });
});

test("preserves idempotency conflict and temporary-service statuses", async () => {
  for (const status of [409, 503]) {
    const request = async () => new Response(JSON.stringify({
      success: false,
      message: `Shopify returned ${status}.`,
    }), {
      status,
      headers: { "Content-Type": "application/json" },
    });

    const result = await validateShopifyActivation(
      input,
      request,
      createActivationIdempotencyKey(input),
      signing,
    );

    assert.equal(result.success, false);
    assert.equal(result.status, status);
    assert.equal(result.message, `Shopify returned ${status}.`);
  }
});