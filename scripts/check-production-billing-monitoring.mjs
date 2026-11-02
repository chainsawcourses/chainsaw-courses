import { pathToFileURL } from "node:url";

export function productionApiBase(configuredUrl) {
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !["/", "/api", "/api/"].includes(url.pathname)) {
    throw new Error("app_url must be an HTTPS origin with no credentials, query, fragment, or non-API path");
  }
  return `${url.origin}/api`;
}

export function assertNoBillingNotificationTestScope(testScope) {
  if (testScope !== undefined) {
    throw new Error("BILLING_NOTIFICATION_TEST_SCOPE is test-only and must not be present in production");
  }
}

export async function checkProductionBillingMonitoring({
  configuredUrl,
  smokeSecret,
  testScope,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  assertNoBillingNotificationTestScope(testScope);
  if (!configuredUrl || !smokeSecret) {
    throw new Error("app_url (or APP_URL) and BILLING_MONITORING_SMOKE_SECRET are required");
  }
  const apiBase = productionApiBase(configuredUrl);
  const requestOptions = {
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  };
  const response = await fetchImpl(`${apiBase}/admin/billing-monitoring-smoke`, {
    ...requestOptions,
    method: "POST",
    headers: { billingmonitoringtoken: smokeSecret },
  });
  if (!response.ok) {
    throw new Error(`Production billing monitoring smoke check failed with HTTP ${response.status}`);
  }
  const result = await response.json();
  if (result.schema !== "ok" || result.alertOpened !== true ||
      result.alertCleared !== true || result.retainedRows !== 0) {
    throw new Error("Production billing monitoring smoke check returned an invalid result");
  }
  return result;
}

async function main() {
  await checkProductionBillingMonitoring({
    configuredUrl: process.env.app_url || process.env.APP_URL || "",
    smokeSecret: process.env.BILLING_MONITORING_SMOKE_SECRET,
    testScope: process.env.BILLING_NOTIFICATION_TEST_SCOPE,
  });
  console.log("Production billing monitoring schema and alert recovery are healthy");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Production billing monitoring check failed");
    process.exitCode = 1;
  });
}