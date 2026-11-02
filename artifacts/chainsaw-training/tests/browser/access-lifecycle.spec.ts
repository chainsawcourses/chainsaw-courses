import { expect, test, type Page, type Route } from "@playwright/test";

type Learner = {
  code: string;
  userId: number;
  fullName: string;
  expiresAt: string;
  completedAt?: string | null;
};

const deviceId = "installed-app-device";

test.beforeEach(async ({ page, browserName }) => {
  if (browserName !== "webkit") return;

  // Playwright cannot launch a native home-screen WebView, but navigator.standalone
  // models the iOS installed-app signal used by the production application.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
  });
});

async function persistLearner(page: Page, learner: Learner, accessStatus: "active" | "expired") {
  await page.addInitScript(({ deviceId, learner, accessStatus }) => {
    localStorage.setItem("activationCode", learner.code);
    localStorage.setItem("deviceId", deviceId);
    localStorage.setItem("userId", String(learner.userId));
    localStorage.setItem("fullName", learner.fullName);
    localStorage.setItem("email", `${learner.code.toLowerCase()}@example.test`);
    localStorage.setItem(
      `verifiedCourseAccess:${learner.code}:${learner.userId}`,
      JSON.stringify({ accessStatus, accessExpiresAt: learner.expiresAt }),
    );
  }, { deviceId, learner, accessStatus });
}

function authPayload(learner: Learner) {
  return {
    userId: learner.userId,
    fullName: learner.fullName,
    accessStatus: "active",
    accessExpiresAt: learner.expiresAt,
    courseCompletedAt: learner.completedAt ?? null,
    allModulesUnlocked: false,
    activeAdjustments: [],
  };
}

test("admin preview reactivates a previously suspended browser session", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("adminPreviewSuspendedStateInitialised")) return;
    sessionStorage.setItem("adminPreviewSuspendedStateInitialised", "true");
    localStorage.setItem("adminToken", "admin-preview-browser-test");
    localStorage.setItem("activationCode", "OLD-LEARNER");
    localStorage.setItem("deviceId", "suspended-preview-device");
    localStorage.setItem("userId", "77");
    localStorage.setItem("enrollmentId", "999");
    localStorage.setItem("fullName", "Suspended Learner");
    localStorage.setItem("email", "suspended@example.test");
    localStorage.setItem("learnerSessionStatus", "suspended");
  });
  await page.route("**/api/admin/bind-preview", async (route) => {
    await route.fulfill({
      json: {
        userId: 88,
        activationCode: "ADMIN-PREVIEW",
        fullName: "Admin Preview",
        email: "preview@example.test",
        deviceId: "suspended-preview-device",
      },
    });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: authPayload({
        code: "ADMIN-PREVIEW",
        userId: 88,
        fullName: "Admin Preview",
        expiresAt: "2099-08-01T00:00:00.000Z",
      }),
    });
  });

  await page.goto("/admin-preview");

  await expect(page).toHaveURL(/\/training$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("learnerSessionStatus"))).toBe("active");
  expect(await page.evaluate(() => localStorage.getItem("activationCode"))).toBe("ADMIN-PREVIEW");
  expect(await page.evaluate(() => localStorage.getItem("enrollmentId"))).toBe("");
  await expect(page.locator("body")).not.toBeEmpty();
});

async function switchLearner(page: Page, learner: Learner) {
  await expect(page.locator("html")).toHaveAttribute("data-lifecycle-test-ready", "true");
  await page.evaluate((learner) => {
    window.dispatchEvent(new CustomEvent("chainsaw:test-switch-learner", {
      detail: {
        activationCode: learner.code,
        fullName: learner.fullName,
        email: `${learner.code.toLowerCase()}@example.test`,
        userId: learner.userId,
      },
    }));
  }, learner);
}

test("persisted expired access blocks protected content before delayed revalidation", async ({ page }) => {
  const learner: Learner = {
    code: "EXPIRED-A",
    userId: 101,
    fullName: "Expired Learner",
    expiresAt: "2026-08-01T00:00:00.000Z",
  };
  await persistLearner(page, learner, "expired");

  let releaseAuth!: () => void;
  const authReleased = new Promise<void>((resolve) => { releaseAuth = resolve; });
  await page.route("**/api/auth/me", async (route) => {
    await authReleased;
    await route.fulfill({ json: authPayload({ ...learner, expiresAt: "2099-08-01T00:00:00.000Z" }) });
  });
  await page.addInitScript(() => {
    const seen: string[] = [];
    new MutationObserver(() => seen.push(document.body.innerText)).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    Object.defineProperty(window, "__lifecyclePaints", { value: seen });
  });

  await page.goto("/glossary");
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toBeVisible();
  expect(await page.evaluate(() =>
    (window as Window & { __lifecyclePaints: string[] }).__lifecyclePaints.some((text) => text.includes("Glossary of Terms")),
  )).toBe(false);

  releaseAuth();
  await expect(page.getByText("Glossary of Terms")).toBeVisible();
  await expect(page).toHaveURL(/\/glossary$/);
});

test("focus refreshes an expired open screen after the subscription is activated elsewhere", async ({ page }) => {
  const learner: Learner = {
    code: "FOCUS-REFRESH",
    userId: 151,
    fullName: "Focus Refresh Learner",
    expiresAt: "2026-08-01T00:00:00.000Z",
  };
  await persistLearner(page, learner, "expired");
  let authRequests = 0;
  await page.route("**/api/auth/me", async (route) => {
    authRequests += 1;
    await route.fulfill({
      json: authRequests === 1
        ? authPayload({ ...learner, expiresAt: "2026-08-01T00:00:00.000Z" })
        : authPayload({ ...learner, expiresAt: "2099-08-01T00:00:00.000Z" }),
    });
  });

  await page.goto("/glossary");
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Glossary of Terms")).toBeVisible();
  expect(authRequests).toBeGreaterThanOrEqual(2);
});

test("switching learners aborts stale auth and clears certificate query data before paint", async ({ page }) => {
  const first: Learner = {
    code: "LEARNER-A",
    userId: 201,
    fullName: "First Learner",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
  const second: Learner = {
    code: "LEARNER-B",
    userId: 202,
    fullName: "Second Learner",
    expiresAt: "2099-02-01T00:00:00.000Z",
  };
  await persistLearner(page, first, "active");

  let staleRoute: Route | undefined;
  await page.route("**/api/auth/me", async (route) => {
    const code = route.request().headers()["activationcode"];
    if (code === first.code) {
      staleRoute = route;
      return;
    }
    await route.fulfill({ json: authPayload(second) });
  });
  await page.route("**/api/certificate/details?*", async (route) => {
    const code = route.request().headers()["activationcode"];
    const learner = code === second.code ? second : first;
    await route.fulfill({
      json: {
        fullName: learner.fullName,
        email: `${learner.code.toLowerCase()}@example.test`,
        passedAt: "2026-07-01T12:00:00.000Z",
        passedScore: 90,
        certificateReference: `CERT-${learner.userId}`,
      },
    });
  });

  await page.goto("/certificate");
  await expect(page.getByRole("img", { name: "Certificate of completion for First Learner" })).toBeVisible();
  await page.evaluate(() => {
    const staleCertificateMutations: string[] = [];
    new MutationObserver(() => {
      if (document.body.innerText.includes("First Learner")) {
        staleCertificateMutations.push(document.body.innerText);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    Object.defineProperty(window, "__staleCertificateMutations", { value: staleCertificateMutations });
  });
  await switchLearner(page, second);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(page.getByRole("img", { name: "Certificate of completion for First Learner" })).toHaveCount(0);
  expect(await page.evaluate(() =>
    (window as Window & { __staleCertificateMutations: string[] }).__staleCertificateMutations.length,
  )).toBe(0);
  await expect(page.getByRole("img", { name: "Certificate of completion for Second Learner" })).toBeVisible();

  await staleRoute?.fulfill({
    json: { ...authPayload(first), accessStatus: "expired", accessExpiresAt: "2026-01-01T00:00:00.000Z" },
  }).catch(() => {});
  await page.goto("/glossary");
  await expect(page.getByText("Glossary of Terms")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toHaveCount(0);
});

test("logout preserves the bonded learner and resumes without another activation", async ({ page }) => {
  const learner: Learner = {
    code: "BONDED-A",
    userId: 251,
    fullName: "Bonded Learner",
    expiresAt: "2099-03-01T00:00:00.000Z",
  };
  await persistLearner(page, learner, "active");
  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: { ...authPayload(learner), waiverSigned: true },
  }));
  await page.goto("/glossary");
  await expect(page.locator("html")).toHaveAttribute("data-lifecycle-test-ready", "true");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("chainsaw:test-suspend-learner"));
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("learnerSessionStatus"))).toBe("suspended");
  await page.goto("/");

  await expect(page.getByText("Welcome Back", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CONTINUE AS BONDED LEARNER" })).toBeVisible();
  await expect(page.getByLabel("Purchase Code")).toHaveCount(0);
  await expect(page.getByText(/different (licence|code)/i)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("activationCode"))).toBe(learner.code);
  expect(await page.evaluate(() => localStorage.getItem("learnerSessionStatus"))).toBe("suspended");

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("Welcome Back", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "CONTINUE AS BONDED LEARNER" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("learnerSessionStatus"))).toBe("suspended");
  await page.getByRole("button", { name: "CONTINUE AS BONDED LEARNER" }).click();
  await expect(page).toHaveURL(/\/training$/);
  expect(await page.evaluate(() => localStorage.getItem("activationCode"))).toBe(learner.code);
  expect(await page.evaluate(() => localStorage.getItem("learnerSessionStatus"))).toBe("active");
});

test("the mounted expiry timer replaces course content but leaves certificate access open", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-09T12:00:00.000Z") });
  const learner: Learner = {
    code: "TIMER-A",
    userId: 301,
    fullName: "Certificate Learner",
    expiresAt: "2026-09-09T12:00:05.000Z",
    completedAt: "2026-08-20T10:00:00.000Z",
  };
  await persistLearner(page, learner, "active");
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: authPayload(learner) }));
  await page.route("**/api/certificate/details?*", (route) => route.fulfill({
    json: {
      fullName: learner.fullName,
      email: "timer-a@example.test",
      passedAt: learner.completedAt,
      passedScore: 92,
      certificateReference: "CERT-301",
    },
  }));

  await page.goto("/glossary");
  await expect(page.getByText("Glossary of Terms")).toBeVisible();
  await page.clock.fastForward(5_000);
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toBeVisible();
  await expect(page.getByText("Glossary of Terms")).toHaveCount(0);

  await page.goto("/certificate");
  await expect(page.getByRole("img", { name: "Certificate of completion for Certificate Learner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your access period has ended" })).toHaveCount(0);
});