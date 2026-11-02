import { expect, test, type Page } from "@playwright/test";

const providerEventId = "evt_provider_private_123456";

const notificationHistory = [
  {
    notificationId: 101,
    alertType: "payment_failed",
    learnerId: 501,
    title: "Payment needs attention",
    status: "open",
    openDeliveryStatus: "sent",
    openDeliveryError: null,
    resolutionDeliveryStatus: null,
    resolutionDeliveryError: null,
    openedAt: "2026-09-10T09:00:00.000Z",
    resolvedAt: null,
    updatedAt: "2026-09-10T09:00:00.000Z",
    providerEventId,
  },
  {
    notificationId: 102,
    alertType: "payment_recovered",
    learnerId: 502,
    title: "Payment recovered",
    status: "resolved",
    openDeliveryStatus: "sent",
    openDeliveryError: null,
    resolutionDeliveryStatus: "sent",
    resolutionDeliveryError: null,
    openedAt: "2026-09-09T08:00:00.000Z",
    resolvedAt: "2026-09-09T10:30:00.000Z",
    updatedAt: "2026-09-09T10:30:00.000Z",
  },
  {
    notificationId: 103,
    alertType: "subscription_expiring",
    learnerId: 503,
    title: "Opening email could not be delivered",
    status: "open",
    openDeliveryStatus: "failed",
    openDeliveryError: "mailbox_unavailable",
    resolutionDeliveryStatus: null,
    resolutionDeliveryError: null,
    openedAt: "2026-09-08T07:00:00.000Z",
    resolvedAt: null,
    updatedAt: "2026-09-08T07:00:00.000Z",
  },
  {
    notificationId: 104,
    alertType: "payment_recovered",
    learnerId: null,
    title: "Recovery email retries exhausted",
    status: "resolved",
    openDeliveryStatus: "sent",
    openDeliveryError: null,
    resolutionDeliveryStatus: "retry_pending",
    resolutionDeliveryError: "retry_exhausted",
    openedAt: "2026-09-07T06:00:00.000Z",
    resolvedAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-07T12:00:00.000Z",
  },
];

async function mockAdminDashboard(page: Page) {
  await page.addInitScript(() => localStorage.setItem("adminToken", "browser-test-admin"));
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/backup/exports") {
      return route.fulfill({
        json: [{
          id: 1,
          title: "Chainsaw Courses User Backup",
          sheetUrl: "https://docs.google.com/spreadsheets/d/test",
          folderId: "test-folder",
          rowCount: 12,
          exportedAt: "2026-09-15T10:00:00.000Z",
        }],
      });
    }
    if (url.pathname === "/api/admin/billing-support-notifications") {
      const deliveryOutcome = url.searchParams.get("deliveryOutcome");
      const incidentStatus = url.searchParams.get("incidentStatus");
      const filtered = notificationHistory.filter((notification) => {
        if (incidentStatus && notification.status !== incidentStatus) return false;
        const deliveries = [
          { status: notification.openDeliveryStatus, error: notification.openDeliveryError },
          { status: notification.resolutionDeliveryStatus, error: notification.resolutionDeliveryError },
        ].filter((delivery) => delivery.status !== null);
        const hasFailure = deliveries.some(
          (delivery) => delivery.status === "failed" || delivery.error?.includes("exhaust") === true,
        );
        if (deliveryOutcome === "failed_or_exhausted") return hasFailure;
        if (deliveryOutcome === "delivered") return !hasFailure && deliveries.every((delivery) => delivery.status === "sent");
        if (deliveryOutcome === "pending") return !hasFailure && deliveries.some((delivery) => delivery.status !== "sent");
        return true;
      });
      return route.fulfill({ json: filtered });
    }
    return route.fulfill({ json: [] });
  });
}

test("billing email history keeps failures prominent, resolved incidents visible, private, and responsive", async ({ page }) => {
  await mockAdminDashboard(page);
  await page.goto("/admin/dashboard");

  await expect(page.getByTestId("status-billing-history-count")).toHaveCount(0);
  const dataBackup = page.getByRole("button", { name: /Data & Backup/ });
  await expect(dataBackup).toHaveAttribute("aria-expanded", "false");
  await dataBackup.click();
  await expect(dataBackup).toHaveAttribute("aria-expanded", "true");
  const exportHistory = page.getByRole("button", { name: "Export History (1; older exports may not include every table)" });
  await expect(exportHistory).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Chainsaw Courses User Backup")).toHaveCount(0);
  await exportHistory.click();
  await expect(exportHistory).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Chainsaw Courses User Backup")).toBeVisible();
  await exportHistory.click();
  await expect(page.getByText("Chainsaw Courses User Backup")).toHaveCount(0);
  await page.getByRole("link", { name: "BILLING EMAIL HISTORY", exact: true }).click();
  await expect(page.getByTestId("status-billing-history-count")).toHaveText("4");
  await expect(exportHistory).toHaveCount(0);
  await expect(page.getByTestId("card-billing-history-102")).toContainText("RESOLVED");
  await expect(page.getByTestId("card-billing-history-102")).toContainText("Resolution");

  const failedOpening = page.getByTestId("card-billing-history-103");
  await expect(failedOpening).toHaveClass(/border-destructive/);
  await expect(failedOpening.getByTestId("status-billing-opening-failed")).toContainText("MAILBOX UNAVAILABLE");
  await expect(failedOpening.getByTestId("status-billing-opening-failed").getByText("FAILED", { exact: true })).toHaveClass(/text-destructive/);

  const exhaustedResolution = page.getByTestId("card-billing-history-104");
  await expect(exhaustedResolution).toHaveClass(/border-destructive/);
  await expect(exhaustedResolution.getByText("RETRY EXHAUSTED", { exact: true })).toHaveClass(/font-bold/);

  await expect(page.locator("body")).not.toContainText(providerEventId);
  expect(await page.content()).not.toContain(providerEventId);

  await page.getByTestId("select-billing-history-delivery").selectOption("failed_or_exhausted");
  await expect(page.getByTestId("status-billing-history-count")).toHaveText("2");
  await expect(page.getByTestId("card-billing-history-103")).toBeVisible();
  await expect(page.getByTestId("card-billing-history-104")).toBeVisible();
  await expect(page.getByTestId("card-billing-history-101")).toHaveCount(0);

  await page.getByTestId("select-billing-history-incident").selectOption("open");
  await expect(page.getByTestId("status-billing-history-count")).toHaveText("1");
  await expect(page.getByTestId("card-billing-history-103")).toBeVisible();

  await page.getByTestId("select-billing-history-incident").selectOption("resolved");
  await page.getByTestId("select-billing-history-delivery").selectOption("pending");
  await expect(page.getByTestId("status-billing-history-count")).toHaveText("0");
  await expect(page.getByTestId("status-billing-history-empty")).toContainText("No billing emails match these filters.");

  await page.getByTestId("button-reset-billing-history").click();
  await expect(page.getByTestId("status-billing-history-count")).toHaveText("4");
  await expect(page.getByTestId("select-billing-history-delivery")).toHaveValue("");
  await expect(page.getByTestId("select-billing-history-incident")).toHaveValue("");

  for (const viewport of [
    { name: "phone", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await test.step(`${viewport.name} has no horizontal overflow`, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByTestId("list-billing-history")).toBeVisible();
      expect(
        await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
      ).toEqual({ clientWidth: viewport.width, scrollWidth: viewport.width });
    });
  }
});

test("admin header tabs show only their selected panel and survive reload and browser navigation", async ({ page }) => {
  test.setTimeout(60_000);
  await mockAdminDashboard(page);
  const tabs = [
    { key: "subscription-alerts", name: "SUBSCRIPTION ALERTS" },
    { key: "billing-email-history", name: "BILLING EMAIL HISTORY" },
    { key: "replacement-code-requests", name: "REPLACEMENT CODE REQUESTS" },
  ];

  await page.goto("/admin/dashboard");
  for (const tab of tabs) await expect(page.locator(`#${tab.key}`)).toHaveCount(0);
  await expect(page.getByText("Total Students", { exact: true })).toBeVisible();

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const tab of tabs) {
      const link = page.getByRole("link", { name: tab.name, exact: true });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`\\?tab=${tab.key}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.locator(`#${tab.key}`)).toBeVisible();
      await expect(page.getByText("Total Students", { exact: true })).toHaveCount(0);
      for (const other of tabs.filter((candidate) => candidate.key !== tab.key)) {
        await expect(page.locator(`#${other.key}`)).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    }
  }

  await page.reload();
  await expect(page.locator("#replacement-code-requests")).toBeVisible();
  await page.getByRole("button", { name: "NEW CODE", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Generate Access Code");
  await page.keyboard.press("Escape");

  await page.goBack();
  await expect(page.locator("#billing-email-history")).toBeVisible();
  await page.getByRole("link", { name: "DASHBOARD", exact: true }).click();
  for (const tab of tabs) await expect(page.locator(`#${tab.key}`)).toHaveCount(0);
  await expect(page.getByText("Total Students", { exact: true })).toBeVisible();
});