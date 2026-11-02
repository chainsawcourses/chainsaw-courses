import { expect, test, type Page } from "@playwright/test";

// Keep review-age fixtures stable as the real calendar advances.
const REVIEW_TEST_NOW = "2026-09-15T12:00:00.000Z";

function isCancelledRequest(errorText: string | undefined) {
  return errorText !== undefined && /abort|cancel/i.test(errorText);
}

type AdminRetailer = {
  id: number;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website: string | null;
  logoObjectKey: string | null;
  active: boolean;
  featured: boolean;
  verificationStatus: "pending" | "verified" | "rejected";
  evidenceUrl: string | null;
  lastCheckedAt: string | null;
  reviewDueReminderSentAt: string | null;
  reviewDueReminderFailedAt: string | null;
  reviewOverdueReminderSentAt: string | null;
  reviewOverdueReminderFailedAt: string | null;
  notes: string | null;
};

const baseRetailer: Omit<AdminRetailer, "id" | "name" | "lastCheckedAt"> = {
  address: "1 Test Road",
  town: "Leeds",
  county: "West Yorkshire",
  postcode: "LS1 1AA",
  lat: 53.8,
  lng: -1.55,
  email: "retailer@example.test",
  phone: "0113 000 0000",
  website: "https://retailer.example.test",
  logoObjectKey: null,
  active: true,
  featured: false,
  verificationStatus: "verified",
  evidenceUrl: "https://evidence.example.test/old",
  reviewDueReminderSentAt: null,
  reviewDueReminderFailedAt: null,
  reviewOverdueReminderSentAt: null,
  reviewOverdueReminderFailedAt: null,
  notes: "Keep this note",
};

type MockAdminRetailerOptions = {
  failVerificationHistoryOnce?: boolean;
  delayOverdueVerificationHistoryMs?: number;
  featuredHistoryResponse?: "success" | "empty" | "failure" | "failureOnce";
  featuredHistoryDelayMs?: number;
  reminderHistoryResponse?: "success" | "empty" | "failureOnce";
  recoverReminderFailureOnReload?: boolean;
};

async function mockAdminRetailers(page: Page, options: MockAdminRetailerOptions = {}) {
  // Fix Date without mocking timers used by history retries and cancellation.
  await page.clock.setFixedTime(new Date(REVIEW_TEST_NOW));
  let verificationHistoryRequests = 0;
  let featuredHistoryRequests = 0;
  let reminderHistoryRequests = 0;
  let retailerListRequests = 0;
  let logoUploadSequence = 0;
  const retailers: AdminRetailer[] = [
    { ...baseRetailer, id: 1, name: "Current Tools", active: false, featured: true, lastCheckedAt: "2026-08-15T00:00:00.000Z" },
    {
      ...baseRetailer,
      id: 2,
      name: "Due Soon Saws",
      lastCheckedAt: "2026-04-05T00:00:00.000Z",
      reviewDueReminderSentAt: "2026-09-01T09:30:00.000Z",
    },
    {
      ...baseRetailer,
      id: 3,
      name: "Overdue Forestry",
      featured: true,
      lastCheckedAt: "2026-01-01T00:00:00.000Z",
      reviewDueReminderSentAt: "2026-06-01T09:30:00.000Z",
      reviewOverdueReminderSentAt: "2026-07-01T09:30:00.000Z",
      reviewOverdueReminderFailedAt: "2026-09-10T15:45:00.000Z",
    },
  ];

  await page.addInitScript(() => localStorage.setItem("adminToken", "browser-test-admin"));
  await page.route("https://logo-upload.example.test/put", async (route) => {
    await route.fulfill({ status: 200 });
  });
  await page.route("**/api/retailers/public/logos/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
    });
  });
  await page.route("**/api/admin/retailers{,/**}", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/retailers") {
      retailerListRequests += 1;
      if (options.recoverReminderFailureOnReload && retailerListRequests > 1) {
        const overdueRetailer = retailers.find((item) => item.id === 3)!;
        overdueRetailer.reviewOverdueReminderSentAt = "2026-09-12T10:15:00.000Z";
        overdueRetailer.reviewOverdueReminderFailedAt = null;
      }
      await route.fulfill({ json: retailers });
      return;
    }
    const logoUploadMatch = url.pathname.match(/^\/api\/admin\/retailers\/(\d+)\/logo-upload$/);
    if (request.method() === "POST" && logoUploadMatch) {
      const retailerId = Number(logoUploadMatch[1]);
      logoUploadSequence += 1;
      const objectId = `${logoUploadSequence.toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
      await route.fulfill({
        json: {
          uploadURL: "https://logo-upload.example.test/put",
          objectKey: `retailer-logos/${retailerId}/${objectId}`,
        },
      });
      return;
    }
    const logoAssignmentMatch = url.pathname.match(/^\/api\/admin\/retailers\/(\d+)\/logo$/);
    if (request.method() === "PUT" && logoAssignmentMatch) {
      const retailerId = Number(logoAssignmentMatch[1]);
      const retailer = retailers.find((item) => item.id === retailerId);
      if (!retailer) {
        await route.fulfill({ status: 404, json: { error: "Retailer not found" } });
        return;
      }
      const body = request.postDataJSON() as { objectKey: string | null };
      retailer.logoObjectKey = body.objectKey;
      await route.fulfill({ json: { logoObjectKey: retailer.logoObjectKey } });
      return;
    }
    const verificationHistoryMatch = url.pathname.match(/^\/api\/admin\/retailers\/(\d+)\/verification-history$/);
    if (request.method() === "GET" && verificationHistoryMatch) {
      verificationHistoryRequests += 1;
      const retailerId = Number(verificationHistoryMatch[1]);
      if (retailerId === 3 && options.delayOverdueVerificationHistoryMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayOverdueVerificationHistoryMs));
      }
      if (options.failVerificationHistoryOnce && verificationHistoryRequests === 1) {
        await route.fulfill({
          status: 503,
          json: { error: "The verification history service is temporarily unavailable." },
        });
        return;
      }
      await route.fulfill({
        json: [{
          id: 1,
          retailerId,
          priorEvidenceUrl: "https://evidence.example.test/original",
          priorCheckedAt: "2025-07-01T10:00:00.000Z",
          newEvidenceUrl: retailerId === 3
            ? "https://evidence.example.test/old"
            : `https://evidence.example.test/retailer-${retailerId}`,
          newCheckedAt: "2026-01-01T00:00:00.000Z",
          recordedAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/admin/retailers/3/featured-history") {
      featuredHistoryRequests += 1;
      if (options.featuredHistoryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.featuredHistoryDelayMs));
      }
      if (
        options.featuredHistoryResponse === "failure"
        || (options.featuredHistoryResponse === "failureOnce" && featuredHistoryRequests === 1)
      ) {
        await route.fulfill({
          status: 503,
          json: { error: "The featured history service is temporarily unavailable." },
        });
        return;
      }
      await route.fulfill({
        json: options.featuredHistoryResponse === "empty" ? [] : [{
          id: 1,
          retailerId: 3,
          priorFeatured: false,
          newFeatured: true,
          recordedAt: "2026-08-20T14:30:00.000Z",
        }],
      });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/admin/retailers/3/reminder-attempts") {
      reminderHistoryRequests += 1;
      if (options.reminderHistoryResponse === "failureOnce" && reminderHistoryRequests === 1) {
        await route.fulfill({
          status: 503,
          json: { error: "The reminder attempt history service is temporarily unavailable." },
        });
        return;
      }
      await route.fulfill({
        json: options.reminderHistoryResponse === "empty" ? [] : [{
          id: 1,
          retailerId: 3,
          threshold: "overdue",
          outcome: "sent",
          attemptedAt: "2026-09-12T10:15:00.000Z",
        }],
      });
      return;
    }
    if (request.method() === "PATCH" && url.pathname === "/api/admin/retailers/3/reverify") {
      const body = request.postDataJSON() as { evidenceUrl: string };
      const retailer = retailers.find((item) => item.id === 3)!;
      retailer.evidenceUrl = body.evidenceUrl;
      retailer.lastCheckedAt = REVIEW_TEST_NOW;
      retailer.reviewDueReminderSentAt = null;
      retailer.reviewDueReminderFailedAt = null;
      retailer.reviewOverdueReminderSentAt = null;
      retailer.reviewOverdueReminderFailedAt = null;
      await route.fulfill({ json: retailer });
      return;
    }
    if (request.method() === "PUT" && url.pathname.startsWith("/api/admin/retailers/")) {
      const id = Number(url.pathname.split("/").at(-1));
      const retailer = retailers.find((item) => item.id === id)!;
      Object.assign(retailer, request.postDataJSON());
      await route.fulfill({ json: retailer });
      return;
    }
    if (request.method() === "DELETE" && url.pathname === "/api/admin/retailers/3") {
      await route.fulfill({
        status: 409,
        json: { error: "This retailer has verification history and cannot be permanently deleted. Mark it inactive instead." },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { error: "Not found" } });
  });
}

test("admins can complete a retailer review using only the keyboard", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  await expect(page.getByRole("button", { name: "Due soon (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Overdue (1)" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Reminder history for Due Soon Saws" })).toContainText("Due reminder:1 Sept 2026");

  const overdueFilter = page.getByRole("button", { name: "Overdue (1)" });
  await overdueFilter.focus();
  await expect(overdueFilter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(overdueFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Overdue Forestry")).toBeVisible();
  await expect(page.getByRole("group", { name: "Reminder history for Overdue Forestry" })).toContainText("Due reminder:1 Jun 2026");
  await expect(page.getByRole("group", { name: "Reminder history for Overdue Forestry" })).toContainText("Overdue reminder:1 Jul 2026");
  await expect(page.getByText("Current Tools")).toHaveCount(0);
  await expect(page.getByText("Due Soon Saws")).toHaveCount(0);

  const historyButton = page.getByRole("button", { name: "View verification history for Overdue Forestry" });
  await historyButton.focus();
  await expect(historyButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Verification history: Overdue Forestry")).toBeVisible();
  await expect(page.getByRole("region", { name: "Verification history: Overdue Forestry" })).toBeFocused();
  await expect(page.getByRole("link", { name: "https://evidence.example.test/original" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://evidence.example.test/old" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Enter");

  page.once("dialog", (dialog) => dialog.accept());
  const deleteButton = page.getByRole("button", { name: "Permanently delete Overdue Forestry" });
  await deleteButton.focus();
  await expect(deleteButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("cannot be permanently deleted");

  const reverifyButton = page.getByRole("button", { name: "Re-verify" });
  await reverifyButton.focus();
  await expect(reverifyButton).toBeFocused();
  await page.keyboard.press("Enter");
  const evidenceInput = page.getByLabel("Current evidence URL *");
  await expect(evidenceInput).toBeFocused();
  await evidenceInput.fill("https://evidence.example.test/current");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Confirm re-verification" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Overdue (0)" })).toBeVisible();
  await expect(page.getByText("Overdue Forestry")).toHaveCount(0);
  await page.getByRole("button", { name: "All (3)" }).click();
  await expect(page.getByRole("group", { name: "Reminder history for Overdue Forestry" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("verification history remains usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "Overdue (1)" }).click();
  await expect(page.getByRole("group", { name: "Reminder history for Overdue Forestry" })).toBeVisible();
  await page.getByRole("button", { name: "View verification history for Overdue Forestry" }).click();

  await expect(page.getByRole("region", { name: "Verification history: Overdue Forestry" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://evidence.example.test/original" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("successful reminder dates and the latest failure remain readable at responsive widths and recover after success", async ({ page }) => {
  await mockAdminRetailers(page, { recoverReminderFailureOnReload: true });
  await page.goto("/admin/retailers");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    const reminderStatus = page.getByRole("group", { name: "Reminder history for Overdue Forestry" });
    await expect(reminderStatus).toBeVisible();
    await expect(reminderStatus).toContainText("Due reminder:1 Jun 2026");
    await expect(reminderStatus).toContainText("Overdue reminder:1 Jul 2026");
    await expect(reminderStatus).toContainText("Overdue reminder failed:10 Sept 2026");
    expect(await reminderStatus.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0
        && rect.right <= window.innerWidth
        && element.scrollWidth <= element.clientWidth;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }

  await page.reload();

  const recoveredStatus = page.getByRole("group", { name: "Reminder history for Overdue Forestry" });
  await expect(recoveredStatus).toContainText("Overdue reminder:12 Sept 2026");
  await expect(recoveredStatus).not.toContainText("Overdue reminder failed");
});

test("admins can retry verification history without leaving the retailer review screen", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-verification-retry"],
}, async ({ page }) => {
  await mockAdminRetailers(page, { failVerificationHistoryOnce: true });
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "Overdue (1)" }).click();
  await page.getByRole("button", { name: "View verification history for Overdue Forestry" }).click();

  const historyPanel = page.getByRole("region", { name: "Verification history: Overdue Forestry" });
  await expect(historyPanel.getByRole("alert")).toContainText("temporarily unavailable");
  await historyPanel.getByRole("button", { name: "Retry verification history" }).click();

  await expect(historyPanel.getByRole("alert")).toHaveCount(0);
  await expect(historyPanel.getByRole("link", { name: "https://evidence.example.test/original" })).toBeVisible();
  await expect(page.getByText("Overdue Forestry", { exact: true })).toBeVisible();
});

test("an older verification response cannot replace the newly selected retailer history", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-stale-response"],
}, async ({ page, browserName }) => {
  await mockAdminRetailers(page, { delayOverdueVerificationHistoryMs: 250 });
  const cancelledRequests: string[] = [];
  page.on("requestfailed", (request) => {
    if (isCancelledRequest(request.failure()?.errorText)) cancelledRequests.push(request.url());
  });
  await page.goto("/admin/retailers");

  const overdueHistoryRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/retailers/3/verification-history"),
  );
  await page.getByRole("button", { name: "View verification history for Overdue Forestry" }).click();
  await overdueHistoryRequest;
  await page.getByRole("button", { name: "View verification history for Due Soon Saws" }).click();

  const historyPanel = page.getByRole("region", { name: "Verification history: Due Soon Saws" });
  await expect(historyPanel.getByRole("link", { name: "https://evidence.example.test/retailer-2" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(historyPanel.getByRole("link", { name: "https://evidence.example.test/retailer-2" })).toBeVisible();
  await expect(historyPanel.getByRole("link", { name: "https://evidence.example.test/old" })).toHaveCount(0);
  await expect(historyPanel.getByRole("alert")).toHaveCount(0);
  if (browserName !== "webkit") {
    expect(cancelledRequests.some((url) => url.endsWith("/api/admin/retailers/3/verification-history"))).toBe(true);
  }
});

test("closing a history panel cancels its active request without showing an error", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-panel-close"],
}, async ({ page, browserName }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    const cancelledHistoryRequests: string[] = [];
    Object.defineProperty(window, "__cancelledHistoryRequests", {
      value: cancelledHistoryRequests,
    });
    window.fetch = (input, init) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (url.endsWith("/verification-history")) {
        init?.signal?.addEventListener("abort", () => cancelledHistoryRequests.push(url), { once: true });
      }
      return nativeFetch(input, init);
    };
  });
  await mockAdminRetailers(page, { delayOverdueVerificationHistoryMs: 500 });
  await page.goto("/admin/retailers");

  const overdueHistoryRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/retailers/3/verification-history"),
  );
  await page.getByRole("button", { name: "View verification history for Overdue Forestry" }).click();
  await overdueHistoryRequest;
  const historyPanel = page.getByRole("region", { name: "Verification history: Overdue Forestry" });
  await expect(historyPanel).toContainText("Loading history…");
  await historyPanel.getByRole("button", { name: "Close" }).click();

  if (browserName !== "webkit") {
    await expect.poll(() => page.evaluate(
      () => (window as Window & { __cancelledHistoryRequests: string[] }).__cancelledHistoryRequests,
    )).toContain("/api/admin/retailers/3/verification-history");
  }
  await expect(historyPanel).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("leaving retailer review cancels its active history request without showing an error", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-navigation"],
}, async ({ page, browserName }) => {
  const cancelledHistoryRequests: string[] = [];
  await page.exposeFunction("__recordCancelledHistoryRequest", (url: string) => {
    cancelledHistoryRequests.push(url);
  });
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (url.endsWith("/verification-history")) {
        init?.signal?.addEventListener("abort", () => {
          void (window as Window & {
            __recordCancelledHistoryRequest: (cancelledUrl: string) => Promise<void>;
          }).__recordCancelledHistoryRequest(url);
        }, { once: true });
      }
      return nativeFetch(input, init);
    };
  });
  await mockAdminRetailers(page, { delayOverdueVerificationHistoryMs: 500 });
  await page.goto("/admin/retailers");

  const overdueHistoryRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/retailers/3/verification-history"),
  );
  await page.getByRole("button", { name: "View verification history for Overdue Forestry" }).click();
  await overdueHistoryRequest;
  await expect(page.getByRole("region", { name: "Verification history: Overdue Forestry" })).toContainText("Loading history…");
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  if (browserName !== "webkit") {
    await expect.poll(() => cancelledHistoryRequests).toContain("/api/admin/retailers/3/verification-history");
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("admins can retry reminder history without leaving the retailer review screen", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-reminder-retry"],
}, async ({ page }) => {
  await mockAdminRetailers(page, { reminderHistoryResponse: "failureOnce" });
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "Overdue (1)" }).click();
  await page.getByRole("button", { name: "View reminder attempt history for Overdue Forestry" }).click();

  const historyPanel = page.getByRole("region", { name: "Reminder attempts: Overdue Forestry" });
  await expect(historyPanel.getByRole("alert")).toContainText("temporarily unavailable");
  await historyPanel.getByRole("button", { name: "Retry reminder history" }).click();

  await expect(historyPanel.getByRole("alert")).toHaveCount(0);
  await expect(historyPanel).toContainText("overdue");
  await expect(historyPanel).toContainText("Sent");
  await expect(page.getByText("Overdue Forestry", { exact: true })).toBeVisible();
});

test("admins can mark a retailer as featured and see its status", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  const featureButton = page.getByRole("button", { name: "Mark Due Soon Saws as featured" });
  await expect(featureButton).toHaveAttribute("aria-pressed", "false");
  await featureButton.click();

  await expect(page.getByRole("button", { name: "Featured (3)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Due Soon Saws from featured retailers" })).toHaveAttribute("aria-pressed", "true");
});

test("admins can review prior and new featured status with the change time", async ({ page }) => {
  await mockAdminRetailers(page, { featuredHistoryDelayMs: 250 });
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "View featured history for Overdue Forestry" }).click();

  const historyPanel = page.getByRole("region", { name: "Featured history: Overdue Forestry" });
  await expect(historyPanel).toBeFocused();
  await expect(historyPanel).toContainText("Loading history…");
  await expect(historyPanel).toContainText("8/20/2026, 2:30:00 PM");
  await expect(historyPanel.getByText("Prior state")).toBeVisible();
  await expect(historyPanel.getByText("Not featured")).toBeVisible();
  await expect(historyPanel.getByText("New state")).toBeVisible();
  await expect(historyPanel.getByText("Featured", { exact: true })).toBeVisible();
});

test("featured history explains when no changes have been recorded", async ({ page }) => {
  await mockAdminRetailers(page, { featuredHistoryResponse: "empty" });
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "View featured history for Overdue Forestry" }).click();

  const historyPanel = page.getByRole("region", { name: "Featured history: Overdue Forestry" });
  await expect(historyPanel).toContainText("No featured-status changes have been recorded yet.");
});

test("admins can retry featured history without leaving the retailer review screen", {
  tag: ["@webkit-retailer-history", "@webkit-retailer-history-featured-retry"],
}, async ({ page }) => {
  await mockAdminRetailers(page, { featuredHistoryResponse: "failureOnce" });
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "View featured history for Overdue Forestry" }).click();

  const historyPanel = page.getByRole("region", { name: "Featured history: Overdue Forestry" });
  await expect(historyPanel.getByRole("alert")).toContainText("temporarily unavailable");
  await historyPanel.getByRole("button", { name: "Retry featured history" }).click();

  await expect(historyPanel.getByRole("alert")).toHaveCount(0);
  await expect(historyPanel).toContainText("8/20/2026, 2:30:00 PM");
  await expect(historyPanel.getByText("Not featured")).toBeVisible();
  await expect(historyPanel.getByText("Featured", { exact: true })).toBeVisible();
  await expect(page.getByText("Overdue Forestry", { exact: true })).toBeVisible();
});

test("featured retailers compose with search and verification filters", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  const featuredFilter = page.getByRole("button", { name: "Featured (2)" });
  await expect(featuredFilter).toBeVisible();
  await featuredFilter.click();
  await expect(featuredFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Current Tools")).toBeVisible();
  await expect(page.getByText("Overdue Forestry")).toBeVisible();
  await expect(page.getByText("Due Soon Saws")).toHaveCount(0);

  await page.getByRole("button", { name: "Overdue (1)" }).click();
  await expect(page.getByText("Overdue Forestry")).toBeVisible();
  await expect(page.getByText("Current Tools")).toHaveCount(0);

  await page.getByLabel("Search retailers").fill("Current");
  await expect(page.getByText("Overdue Forestry")).toHaveCount(0);
  await expect(page.getByText("No retailers found.")).toBeVisible();

  await page.getByRole("button", { name: "All (3)" }).click();
  await expect(page.getByText("Current Tools")).toBeVisible();
});

test("featured retailer filter remains usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  await page.getByRole("button", { name: "Featured (2)" }).click();
  await expect(page.getByText("Current Tools")).toBeVisible();
  await expect(page.getByText("Overdue Forestry")).toBeVisible();
  await expect(page.getByText("Due Soon Saws")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("admins can review inactive retailers that remain featured", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  const warning = page.getByRole("region", { name: "1 inactive retailer is still featured" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("remove featured priority or make them active again");
  await expect(page.getByTestId("status-inactive-featured-1")).toHaveText("INACTIVE BUT FEATURED");

  const affectedFilter = warning.getByRole("button", { name: "Review affected (1)" });
  await affectedFilter.click();
  await expect(warning.getByRole("button", { name: "Show all retailers" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Current Tools")).toBeVisible();
  await expect(page.getByText("Due Soon Saws")).toHaveCount(0);
  await expect(page.getByText("Overdue Forestry")).toHaveCount(0);
});

test("inactive featured warning remains usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  const warning = page.getByRole("region", { name: "1 inactive retailer is still featured" });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Review affected (1)" }).click();
  await expect(page.getByTestId("status-inactive-featured-1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("admins can upload, preview, replace, and remove retailer logos across phone, tablet, and desktop widths", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");
  await page.getByRole("button", { name: "Edit Overdue Forestry" }).click();

  const logoPanel = page.getByRole("region", { name: "Retailer logo" });
  const logoInput = page.getByLabel("Choose retailer logo image");
  const logoImage = logoPanel.getByRole("img", { name: "Logo for Overdue Forestry" });
  await expect(logoPanel.getByText("No logo uploaded")).toBeVisible();

  const viewports = [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];
  for (const [index, viewport] of viewports.entries()) {
    await page.setViewportSize(viewport);
    await expect(logoPanel.getByRole("button", { name: "Upload logo" })).toBeVisible();
    await logoInput.setInputFiles({
      name: "retailer-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]),
    });
    const firstObjectId = `${(index * 2 + 1).toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
    await expect(logoImage).toHaveAttribute("src", `/api/retailers/public/logos/3/${firstObjectId}`);
    await expect(logoPanel.getByRole("button", { name: "Replace logo" })).toBeVisible();

    await logoInput.setInputFiles({
      name: "replacement-logo.webp",
      mimeType: "image/webp",
      buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]),
    });
    const replacementObjectId = `${(index * 2 + 2).toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
    await expect(logoImage).toHaveAttribute("src", `/api/retailers/public/logos/3/${replacementObjectId}`);
    await logoPanel.getByRole("button", { name: "Remove logo" }).click();
    await expect(logoPanel.getByText("No logo uploaded")).toBeVisible();
    await expect(logoPanel.getByRole("button", { name: "Upload logo" })).toBeVisible();
    const overflowDetails = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      elements: Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: element.className.toString().slice(0, 120),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((element) => element.right > window.innerWidth + 1)
        .sort((left, right) => right.right - left.right)
        .slice(0, 8),
    }));
    expect(
      overflowDetails.scrollWidth <= overflowDetails.width + 1,
      `Horizontal page overflow at ${viewport.width}px viewport width: ${JSON.stringify(overflowDetails)}`,
    ).toBe(true);
  }
});

test("the normal retailer list returns after the final featured inactive retailer is resolved", async ({ page }) => {
  await mockAdminRetailers(page);
  await page.goto("/admin/retailers");

  await page.getByLabel("Search retailers").fill("Overdue");
  await page.getByRole("button", { name: "Overdue (1)" }).click();
  await page.getByRole("region", { name: "1 inactive retailer is still featured" })
    .getByRole("button", { name: "Review affected (1)" })
    .click();

  await expect(page.getByLabel("Search retailers")).toHaveValue("");
  await expect(page.getByRole("button", { name: "All (3)" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Edit Current Tools" }).click();
  await page.getByLabel("Active (visible on map)").check();
  await page.getByRole("button", { name: "Save Retailer" }).click();

  await expect(page.getByRole("region", { name: /inactive retailer/ })).toHaveCount(0);
  await expect(page.getByText("Current Tools")).toBeVisible();
  await expect(page.getByText("Due Soon Saws")).toBeVisible();
  await expect(page.getByText("Overdue Forestry")).toBeVisible();
  await expect(page.getByText("No retailers found.")).toHaveCount(0);
});