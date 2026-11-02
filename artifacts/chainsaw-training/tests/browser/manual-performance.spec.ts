import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Publishing starts with a cold Vite cache on a smaller runner. Allow initial
// compilation within the test budget without retrying or skipping assertions.
test.describe.configure({ timeout: 60_000 });

type AnalyticsCall = {
  name: string;
  data?: Record<string, string | number | boolean>;
};

const learner = {
  code: "MANUAL-SLOW",
  userId: 701,
  fullName: "Manual Reader",
  expiresAt: "2099-09-09T12:00:00.000Z",
};

const manualPagesDir = fileURLToPath(
  new URL("../../../api-server/src/data/manual-pages/", import.meta.url),
);

function manualPagePath(url: string) {
  return path.join(manualPagesDir, url.split("/").at(-1)!);
}

async function prepareManual(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ learner }) => {
    localStorage.setItem("activationCode", learner.code);
    localStorage.setItem("deviceId", "slow-phone");
    localStorage.setItem("userId", String(learner.userId));
    localStorage.setItem("fullName", learner.fullName);
    localStorage.setItem("email", "reader@example.test");
    localStorage.setItem(
      `verifiedCourseAccess:${learner.code}:${learner.userId}`,
      JSON.stringify({ accessStatus: "active", accessExpiresAt: learner.expiresAt }),
    );
  }, { learner });
  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: {
      userId: learner.userId,
      fullName: learner.fullName,
      accessStatus: "active",
      accessExpiresAt: learner.expiresAt,
      courseCompletedAt: null,
      allModulesUnlocked: false,
      activeAdjustments: [],
    },
  }));
  await page.route("**/api/documents/manual/manifest", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({ json: { pages: 30 } });
  });
  await page.route("**/api/documents/manual/search-index", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: [{ page: 12, text: "Chain brake inspection and maintenance" }] });
  });
  await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 140));
    await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
  });
}

async function captureAnalytics(page: Page, throws = false) {
  await page.addInitScript(({ throws }) => {
    const calls: AnalyticsCall[] = [];
    Object.assign(window, {
      __manualAnalyticsCalls: calls,
      umami: {
        track(name: string, data?: Record<string, string | number | boolean>) {
          calls.push({ name, data });
          if (throws) throw new Error("analytics unavailable");
        },
      },
    });
  }, { throws });
}

async function analyticsCalls(page: Page): Promise<AnalyticsCall[]> {
  return page.evaluate(() => (
    window as typeof window & { __manualAnalyticsCalls?: AnalyticsCall[] }
  ).__manualAnalyticsCalls ?? []);
}

function expectPrivacySafeAnalytics(calls: AnalyticsCall[]) {
  const allowed = new Set(["surface", "layout", "attempt", "failure_type"]);
  for (const call of calls) {
    expect(Object.keys(call.data ?? {}).every((key) => allowed.has(key))).toBe(true);
  }
  expect(JSON.stringify(calls)).not.toContain(learner.code);
  expect(JSON.stringify(calls)).not.toContain("reader@example.test");
  expect(JSON.stringify(calls)).not.toContain("Chain brake inspection and maintenance");
}

for (const device of [
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "tablet", viewport: { width: 820, height: 1180 } },
]) {
  test(`${device.name} opens, searches, turns and zooms over a throttled connection`, async ({ page }) => {
    await prepareManual(page, device.viewport);
    await page.goto("/manual");
    await expect(page.getByText(/Page(?:s)? 1/)).toBeVisible();

    await page.getByPlaceholder("Search manual content…").fill("chain brake");
    await page.getByText("Chain brake inspection and maintenance").click();
    await expect(page.getByText(device.name === "phone" ? "Page 13 of 31" : "Pages 13–14 of 31")).toBeVisible();

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText(device.name === "phone" ? "Page 14 of 31" : "Pages 15–16 of 31")).toBeVisible();

    const canvas = page.locator(".page-canvas").first();
    await canvas.click({ position: { x: 20, y: 20 } });
    await expect(page.getByText(/PAGE \d+ · 200%/)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  });
}

for (const device of [
  { name: "phone", viewport: { width: 390, height: 844 }, target: 7, label: "Page 7 of 31", tag: "@manual-recovery-reader-request-phone" },
  { name: "tablet", viewport: { width: 820, height: 1180 }, target: 7, label: "Pages 7–8 of 31", tag: "@manual-recovery-reader-request-tablet" },
]) {
  test(`${device.name} retries only a failed manual page without losing its place`, {
    tag: ["@manual-recovery", device.tag],
  }, async ({ page }) => {
    await prepareManual(page, device.viewport);
    await captureAnalytics(page);
    await page.unroute("**/api/documents/manual/pages/*.jpg");
    const requests = new Map<string, number>();
    const failedFilename = "page-006.jpg";
    await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
      const filename = route.request().url().split("/").at(-1)!;
      const count = (requests.get(filename) ?? 0) + 1;
      requests.set(filename, count);
      if (filename === failedFilename && count === 1) {
        await route.fulfill({ status: 503, json: { error: "Temporary page failure" } });
        return;
      }
      await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
    });

    await page.goto("/manual");
    const goTo = page.getByPlaceholder("1–31");
    await goTo.fill(String(device.target));
    await goTo.press("Enter");

    await expect(page.getByText(device.label)).toBeVisible();
    await expect(page.getByText(`Page ${device.target} could not be loaded.`)).toBeVisible();
    await expect.poll(async () => analyticsCalls(page)).toContainEqual({
      name: "manual_page_load_failed",
      data: {
        surface: "reader",
        attempt: "initial",
        layout: device.name === "phone" ? "single_page" : "spread",
        failure_type: "request",
      },
    });
    await expect(page.getByText("Failed to load the manual.")).toHaveCount(0);

    const requestsBeforeRetry = new Map(requests);
    await page.getByRole("button", { name: "Retry page" }).click();
    await expect(page.getByText(`Page ${device.target} could not be loaded.`)).toHaveCount(0);
    await expect(page.getByText(device.label)).toBeVisible();
    await expect.poll(async () => analyticsCalls(page)).toEqual(expect.arrayContaining([
      {
        name: "manual_page_retry_attempted",
        data: {
          surface: "reader",
          layout: device.name === "phone" ? "single_page" : "spread",
        },
      },
      {
        name: "manual_page_retry_succeeded",
        data: {
          surface: "reader",
          layout: device.name === "phone" ? "single_page" : "spread",
        },
      },
    ]));
    expectPrivacySafeAnalytics(await analyticsCalls(page));
    expect(requests.get(failedFilename)).toBe((requestsBeforeRetry.get(failedFilename) ?? 0) + 1);
    for (const [filename, count] of requestsBeforeRetry) {
      if (filename !== failedFilename) expect(requests.get(filename)).toBe(count);
    }
  });
}

for (const device of [
  { name: "phone", viewport: { width: 390, height: 844 }, target: 7, label: "Page 7 of 31", tag: "@manual-recovery-reader-damage-phone" },
  { name: "tablet", viewport: { width: 820, height: 1180 }, target: 7, label: "Pages 7–8 of 31", tag: "@manual-recovery-reader-damage-tablet" },
]) {
  test(`${device.name} recovers a damaged standard manual page without losing its place`, {
    tag: ["@manual-recovery", device.tag],
  }, async ({ page }) => {
    await prepareManual(page, device.viewport);
    await captureAnalytics(page);
    await page.unroute("**/api/documents/manual/pages/*.jpg");
    const requests = new Map<string, number>();
    const damagedFilename = "page-006.jpg";
    await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
      const filename = route.request().url().split("/").at(-1)!;
      const count = (requests.get(filename) ?? 0) + 1;
      requests.set(filename, count);
      if (filename === damagedFilename && count === 1) {
        await route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: Buffer.from("this is not a decodable image"),
        });
        return;
      }
      await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
    });

    await page.goto("/manual");
    const goTo = page.getByPlaceholder("1–31");
    await goTo.fill(String(device.target));
    await goTo.press("Enter");

    await expect(page.getByText(device.label)).toBeVisible();
    await expect(page.getByText(`Page ${device.target} could not be loaded.`)).toBeVisible();
    await expect(page.getByText("Failed to load the manual.")).toHaveCount(0);
    await expect.poll(async () => analyticsCalls(page)).toContainEqual({
      name: "manual_page_load_failed",
      data: {
        surface: "reader",
        attempt: "initial",
        layout: device.name === "phone" ? "single_page" : "spread",
        failure_type: "image_decode",
      },
    });

    const requestsBeforeRetry = new Map(requests);
    await page.getByRole("button", { name: "Retry page" }).click();

    await expect(page.getByText(`Page ${device.target} could not be loaded.`)).toHaveCount(0);
    await expect(page.getByText(device.label)).toBeVisible();
    expectPrivacySafeAnalytics(await analyticsCalls(page));
    expect(requests.get(damagedFilename)).toBe((requestsBeforeRetry.get(damagedFilename) ?? 0) + 1);
    for (const [filename, count] of requestsBeforeRetry) {
      if (filename !== damagedFilename) expect(requests.get(filename)).toBe(count);
    }
  });
}

for (const device of [
  { name: "phone", viewport: { width: 390, height: 844 }, tag: "@manual-recovery-zoom-request-phone" },
  { name: "tablet", viewport: { width: 820, height: 1180 }, tag: "@manual-recovery-zoom-request-tablet" },
]) {
  test(`${device.name} retries only a failed zoomed page without closing zoom`, {
    tag: ["@manual-recovery", device.tag],
  }, async ({ page }) => {
    await prepareManual(page, device.viewport);
    await captureAnalytics(page);
    await page.unroute("**/api/documents/manual/pages/*.jpg");
    const requests = new Map<string, number>();
    const failedFilename = "page-000.jpg";
    await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
      const filename = route.request().url().split("/").at(-1)!;
      const count = (requests.get(filename) ?? 0) + 1;
      requests.set(filename, count);
      if (filename === failedFilename && (count === 2 || count === 3)) {
        await route.fulfill({ status: 503, json: { error: "Temporary zoom failure" } });
        return;
      }
      await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
    });

    await page.goto("/manual");
    await expect(page.getByText(/Page(?:s)? 1/)).toBeVisible();
    await page.locator(".page-canvas").first().click({ position: { x: 20, y: 20 } });

    await expect(page.getByText("Page 1 could not be loaded.")).toBeVisible();
    await expect.poll(async () => analyticsCalls(page)).toContainEqual({
      name: "manual_page_load_failed",
      data: {
        surface: "zoom",
        attempt: "initial",
        layout: device.name === "phone" ? "single_page" : "spread",
        failure_type: "request",
      },
    });
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByText("PAGE 1 · 200% · TAP TO CLOSE")).toBeVisible();

    const requestsBeforeRetry = new Map(requests);
    await page.getByRole("button", { name: "Retry zoomed page" }).click();
    await expect(page.getByText("Page 1 could not be loaded.")).toBeVisible();
    await expect.poll(async () => analyticsCalls(page)).toContainEqual({
      name: "manual_page_load_failed",
      data: {
        surface: "zoom",
        attempt: "retry",
        layout: device.name === "phone" ? "single_page" : "spread",
        failure_type: "request",
      },
    });
    await page.getByRole("button", { name: "Retry zoomed page" }).click();

    await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
    await expect(page.getByText("Page 1 could not be loaded.")).toHaveCount(0);
    await expect(page.getByText("PAGE 1 · 200% · TAP TO CLOSE")).toBeVisible();
    await expect.poll(async () => analyticsCalls(page)).toEqual(expect.arrayContaining([
      {
        name: "manual_page_retry_attempted",
        data: {
          surface: "zoom",
          layout: device.name === "phone" ? "single_page" : "spread",
        },
      },
      {
        name: "manual_page_retry_succeeded",
        data: {
          surface: "zoom",
          layout: device.name === "phone" ? "single_page" : "spread",
        },
      },
    ]));
    expectPrivacySafeAnalytics(await analyticsCalls(page));
    expect(requests.get(failedFilename)).toBe((requestsBeforeRetry.get(failedFilename) ?? 0) + 2);
    for (const [filename, count] of requestsBeforeRetry) {
      if (filename !== failedFilename) expect(requests.get(filename)).toBe(count);
    }
  });
}

test("a damaged zoomed page reports an inline error and retries only that page", {
  tag: ["@manual-recovery", "@manual-recovery-zoom-damage"],
}, async ({ page }) => {
  await prepareManual(page, { width: 390, height: 844 });
  await captureAnalytics(page);
  await page.unroute("**/api/documents/manual/pages/*.jpg");
  const requests = new Map<string, number>();
  const damagedFilename = "page-000.jpg";
  await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
    const filename = route.request().url().split("/").at(-1)!;
    const count = (requests.get(filename) ?? 0) + 1;
    requests.set(filename, count);
    if (filename === damagedFilename && count === 2) {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from("this is not a decodable image"),
      });
      return;
    }
    await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
  });

  await page.goto("/manual");
  await expect(page.getByText("Page 1 of 31")).toBeVisible();
  await page.locator(".page-canvas").first().click({ position: { x: 20, y: 20 } });

  await expect(page.getByText("Page 1 could not be loaded.")).toBeVisible();
  await expect.poll(async () => analyticsCalls(page)).toContainEqual({
    name: "manual_page_load_failed",
    data: {
      surface: "zoom",
      attempt: "initial",
      layout: "single_page",
      failure_type: "image_decode",
    },
  });
  expectPrivacySafeAnalytics(await analyticsCalls(page));
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByText("PAGE 1 · 200% · TAP TO CLOSE")).toBeVisible();

  const requestsBeforeRetry = new Map(requests);
  await page.getByRole("button", { name: "Retry zoomed page" }).click();

  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  await expect(page.getByText("Page 1 could not be loaded.")).toHaveCount(0);
  await expect(page.getByText("PAGE 1 · 200% · TAP TO CLOSE")).toBeVisible();
  expect(requests.get(damagedFilename)).toBe((requestsBeforeRetry.get(damagedFilename) ?? 0) + 1);
  for (const [filename, count] of requestsBeforeRetry) {
    if (filename !== damagedFilename) expect(requests.get(filename)).toBe(count);
  }
});

test("reader recovery still works when analytics throws", {
  tag: ["@manual-recovery", "@manual-recovery-analytics-failure"],
}, async ({ page }) => {
  await prepareManual(page, { width: 390, height: 844 });
  await captureAnalytics(page, true);
  await page.unroute("**/api/documents/manual/pages/*.jpg");
  let failuresRemaining = 2;
  await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
    const filename = route.request().url().split("/").at(-1)!;
    if (filename === "page-006.jpg" && failuresRemaining > 0) {
      failuresRemaining -= 1;
      await route.fulfill({ status: 503, body: "temporary failure" });
      return;
    }
    await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
  });

  await page.goto("/manual");
  await page.getByPlaceholder("1–31").fill("7");
  await page.getByPlaceholder("1–31").press("Enter");
  await expect(page.getByText("Page 7 could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Retry page" }).click();
  await expect(page.getByText("Page 7 could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Retry page" }).click();
  await expect(page.getByText("Page 7 could not be loaded.")).toHaveCount(0);
  await expect(page.getByText("Page 7 of 31")).toBeVisible();

  const calls = await analyticsCalls(page);
  expect(calls).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: "manual_page_load_failed",
      data: expect.objectContaining({ surface: "reader", attempt: "retry" }),
    }),
    expect.objectContaining({ name: "manual_page_retry_succeeded" }),
  ]));
  expectPrivacySafeAnalytics(calls);
});

for (const accessFailure of [
  { name: "expired", status: 403, destination: "Your access period has ended" },
  { name: "denied", status: 401, destination: null },
]) {
  test(`${accessFailure.name} access closes the manual from a failed zoom request`, async ({ page }) => {
    await prepareManual(page, { width: 390, height: 844 });
    await page.unroute("**/api/documents/manual/pages/*.jpg");
    let pageOneRequests = 0;
    await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
      const filename = route.request().url().split("/").at(-1)!;
      if (filename === "page-000.jpg") {
        pageOneRequests += 1;
        if (pageOneRequests === 2) {
          await route.fulfill({ status: accessFailure.status, json: { error: `Course access ${accessFailure.name}` } });
          return;
        }
      }
      await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
    });

    await page.goto("/manual");
    await expect(page.getByText("Page 1 of 31")).toBeVisible();
    await page.locator(".page-canvas").first().click({ position: { x: 20, y: 20 } });

    await expect(page).not.toHaveURL(/\/manual$/);
    if (accessFailure.destination) {
      await expect(page.getByRole("heading", { name: accessFailure.destination })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
    await expect(page.locator(".page-canvas")).toHaveCount(0);
  });
}

test("a long phone reading session evicts old pages and expiry removes the manual", async ({ page }) => {
  await prepareManual(page, { width: 390, height: 844 });
  const requests = new Map<string, number>();
  await page.unroute("**/api/documents/manual/pages/*.jpg");
  let expired = false;
  await page.route("**/api/documents/manual/pages/*.jpg", async (route) => {
    const filename = route.request().url().split("/").at(-1)!;
    requests.set(filename, (requests.get(filename) ?? 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (expired) await route.fulfill({ status: 403, json: { error: "Course access expired" } });
    else await route.fulfill({ path: manualPagePath(route.request().url()), contentType: "image/jpeg" });
  });
  await page.goto("/manual");
  await expect(page.getByText("Page 1 of 31")).toBeVisible();

  const goTo = page.getByPlaceholder("1–31");
  for (const target of [3, 5, 7, 9, 11, 13, 15, 17, 19]) {
    await goTo.fill(String(target));
    await goTo.press("Enter");
    await expect(page.getByText(`Page ${target} of 31`)).toBeVisible();
  }
  await goTo.fill("2");
  await goTo.press("Enter");
  await expect(page.getByText("Page 2 of 31")).toBeVisible();
  expect(requests.get("page-001.jpg")).toBeGreaterThan(1);

  expired = true;
  await goTo.fill("25");
  // The access refresh can replace the manual immediately after the input
  // event, so pressing Enter is best-effort once expiry has begun.
  await goTo.press("Enter", { timeout: 1_000 }).catch(() => {});
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toBeVisible();
  await expect(page.locator(".page-canvas")).toHaveCount(0);
});