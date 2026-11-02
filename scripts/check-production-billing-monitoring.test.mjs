import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertNoBillingNotificationTestScope,
  checkProductionBillingMonitoring,
  productionApiBase,
} from "./check-production-billing-monitoring.mjs";

test("production validation rejects the test-only billing scope without exposing its value", async () => {
  const sensitiveValue = "do-not-print-this-scope";
  assert.doesNotThrow(() => assertNoBillingNotificationTestScope(undefined));

  for (const configuredValue of ["", sensitiveValue]) {
    assert.throws(
      () => assertNoBillingNotificationTestScope(configuredValue),
      (error) => {
        assert.match(error.message, /BILLING_NOTIFICATION_TEST_SCOPE/);
        assert.equal(error.message.includes(sensitiveValue), false);
        return true;
      },
    );
  }

  let fetched = false;
  await assert.rejects(
    checkProductionBillingMonitoring({
      configuredUrl: "",
      smokeSecret: "",
      testScope: sensitiveValue,
      fetchImpl: async () => {
        fetched = true;
        throw new Error("unexpected request");
      },
    }),
    /BILLING_NOTIFICATION_TEST_SCOPE/,
  );
  assert.equal(fetched, false);
});

test("production command reads the test-only setting from the environment without exposing its value", () => {
  const sensitiveValue = "command-scope-must-not-leak";
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-production-billing-monitoring.mjs", import.meta.url))],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        BILLING_NOTIFICATION_TEST_SCOPE: sensitiveValue,
      },
    },
  );
  const output = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /BILLING_NOTIFICATION_TEST_SCOPE/);
  assert.equal(output.includes(sensitiveValue), false);
});

test("production URL accepts only a clean HTTPS origin or API root", () => {
  assert.equal(productionApiBase("https://example.com"), "https://example.com/api");
  assert.equal(productionApiBase("https://example.com/api/"), "https://example.com/api");
  for (const unsafe of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/other",
    "https://example.com?next=https://other.example",
    "https://example.com#fragment",
  ]) {
    assert.throws(() => productionApiBase(unsafe));
  }
});

test("runner rejects redirects and sends the dedicated credential only to the smoke route", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      schema: "ok",
      alertOpened: true,
      alertCleared: true,
      retainedRows: 0,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  await checkProductionBillingMonitoring({
    configuredUrl: "https://example.com/api",
    smokeSecret: "smoke-secret",
    fetchImpl,
    timeoutMs: 100,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.com/api/admin/billing-monitoring-smoke");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal("admintoken" in calls[0].options.headers, false);
  assert.equal(calls[0].options.headers.billingmonitoringtoken, "smoke-secret");
  assert.ok(calls.every((call) => call.options.signal instanceof AbortSignal));
});

test("runner fails closed for missing credentials, redirects, and malformed smoke results", async () => {
  await assert.rejects(
    checkProductionBillingMonitoring({
      configuredUrl: "https://example.com",
      smokeSecret: "",
    }),
    /BILLING_MONITORING_SMOKE_SECRET/,
  );
  await assert.rejects(
    checkProductionBillingMonitoring({
      configuredUrl: "https://example.com",
      smokeSecret: "secret",
      fetchImpl: async () => new Response(null, { status: 307, headers: { location: "https://other.example" } }),
    }),
    /smoke check failed with HTTP 307/,
  );
  await assert.rejects(
    checkProductionBillingMonitoring({
      configuredUrl: "https://example.com",
      smokeSecret: "secret",
      fetchImpl: async () => new Response('{"schema":"ok"}', { status: 200 }),
    }),
    /invalid result/,
  );
});

test("runner aborts requests after the configured timeout", async () => {
  await assert.rejects(
    checkProductionBillingMonitoring({
      configuredUrl: "https://example.com",
      smokeSecret: "secret",
      timeoutMs: 5,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      }),
    }),
    /timeout|aborted/i,
  );
});