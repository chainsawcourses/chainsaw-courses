import { expect, test, type Page } from "@playwright/test";

type Enrolment = {
  code: string;
  userId: number;
  enrollmentId: number;
  fullName: string;
};

const deviceId = "video-completion-device";
const moduleId = 7;
const primaryEnrolment: Enrolment = {
  code: "VIDEO-PRIMARY",
  userId: 701,
  enrollmentId: 1701,
  fullName: "Primary Video Learner",
};
const replacementEnrolment: Enrolment = {
  code: "VIDEO-REPLACEMENT",
  userId: 701,
  enrollmentId: 1702,
  fullName: "Replacement Video Learner",
};

async function persistEnrolment(page: Page, enrolment: Enrolment) {
  await page.addInitScript(({ deviceId, enrolment }) => {
    localStorage.setItem("activationCode", enrolment.code);
    localStorage.setItem("deviceId", deviceId);
    localStorage.setItem("userId", String(enrolment.userId));
    localStorage.setItem("enrollmentId", String(enrolment.enrollmentId));
    localStorage.setItem("fullName", enrolment.fullName);
    localStorage.setItem("email", `${enrolment.code.toLowerCase()}@example.test`);
    localStorage.setItem(
      `verifiedCourseAccess:${enrolment.code}:${enrolment.userId}`,
      JSON.stringify({
        accessStatus: "active",
        accessExpiresAt: "2099-09-01T00:00:00.000Z",
      }),
    );
  }, { deviceId, enrolment });
}

function modulePayload(isCompleted: boolean) {
  return {
    id: moduleId,
    title: "Navigation-safe video",
    description: "Browser regression module",
    order: 1,
    category: "TEST",
    subCategory: null,
    contentType: "video",
    isLocked: false,
    isCompleted,
    quizPassed: false,
    duration: "1 minute",
    thumbnailUrl: null,
    vimeoId: "123456789",
    pdfUrl: null,
    isHighRisk: false,
    learningOutcome: null,
    assessmentCriteria: null,
    lastTimestamp: null,
    safetyText: "Test safety warning",
    quizCount: 1,
  };
}

test("video completion survives immediate navigation and remains enrolment-scoped", async ({ page }) => {
  await persistEnrolment(page, primaryEnrolment);

  const completedEnrolments = new Set<string>();
  let releaseCompletion!: () => void;
  const completionCanFinish = new Promise<void>((resolve) => { releaseCompletion = resolve; });
  let completionReceived!: () => void;
  const completionStarted = new Promise<void>((resolve) => { completionReceived = resolve; });

  await page.route("**/api/auth/me", async (route) => {
    const code = route.request().headers().activationcode ?? primaryEnrolment.code;
    const enrolment = code === replacementEnrolment.code ? replacementEnrolment : primaryEnrolment;
    await route.fulfill({
      json: {
        userId: enrolment.userId,
        enrollmentId: enrolment.enrollmentId,
        fullName: enrolment.fullName,
        accessStatus: "active",
        accessExpiresAt: "2099-09-01T00:00:00.000Z",
        courseCompletedAt: null,
        allModulesUnlocked: false,
        activeAdjustments: [],
      },
    });
  });
  await page.route(/\/api\/modules(?:\?.*)?$/, async (route) => {
    const code = route.request().headers().activationcode ?? "";
    await route.fulfill({ json: [modulePayload(completedEnrolments.has(code))] });
  });
  await page.route(new RegExp(`/api/modules/${moduleId}(?:\\?.*)?$`), async (route) => {
    const code = route.request().headers().activationcode ?? "";
    await route.fulfill({ json: modulePayload(completedEnrolments.has(code)) });
  });
  await page.route("**/api/progress/heartbeat", (route) => route.fulfill({
    json: { success: true, message: "Heartbeat saved" },
  }));
  await page.route("**/api/progress/complete-video", async (route) => {
    const request = route.request();
    expect(request.headers().activationcode).toBe(primaryEnrolment.code);
    expect(await request.postDataJSON()).toEqual({
      moduleId,
      deviceId,
      activationCode: primaryEnrolment.code,
      enrollmentId: primaryEnrolment.enrollmentId,
    });
    completionReceived();
    await completionCanFinish;
    completedEnrolments.add(primaryEnrolment.code);
    await route.fulfill({ json: { success: true, message: "Video marked complete" } });
  });
  await page.route(new RegExp(`/api/quizzes/${moduleId}(?:\\?.*)?$`), (route) => route.fulfill({
    json: {
      moduleId,
      moduleTitle: "Navigation-safe video",
      passingScore: 100,
      questions: [{
        id: 1,
        question: "Did the completion survive navigation?",
        options: ["Yes", "No"],
      }],
    },
  }));

  await page.goto(`/training/${moduleId}`);
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://player.vimeo.com",
      data: { event: "finish" },
    }));
  });
  await completionStarted;

  const navigation = page.goto("/glossary");
  releaseCompletion();
  await navigation;

  await page.goto(`/training/${moduleId}`);
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  await expect(page.getByRole("link", { name: "TAKE MODULE QUIZ" }).last()).toBeVisible();

  await page.goto(`/training/${moduleId}`);
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  await expect(page.getByRole("link", { name: "TAKE MODULE QUIZ" }).last()).toBeVisible();
  await page.getByRole("link", { name: "TAKE MODULE QUIZ" }).last().click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${moduleId}$`));
  await expect(page.getByText("Did the completion survive navigation?")).toBeVisible();

  await expect(page.locator("html")).toHaveAttribute("data-lifecycle-test-ready", "true");
  await page.evaluate((enrolment) => {
    window.dispatchEvent(new CustomEvent("chainsaw:test-switch-learner", {
      detail: {
        activationCode: enrolment.code,
        fullName: enrolment.fullName,
        email: `${enrolment.code.toLowerCase()}@example.test`,
        userId: enrolment.userId,
        enrollmentId: enrolment.enrollmentId,
      },
    }));
  }, replacementEnrolment);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("activationCode")))
    .toBe(replacementEnrolment.code);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/training/${moduleId}$`));
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  await expect(page.getByRole("button", { name: "QUIZ LOCKED — WATCH VIDEO FIRST" })).toBeVisible();
  await expect(page.getByRole("link", { name: "TAKE MODULE QUIZ" })).toHaveCount(0);
});

test("failed video completion retries when connectivity returns", async ({ page, context }) => {
  await persistEnrolment(page, primaryEnrolment);
  let completionAttempts = 0;
  let successfulCompletions = 0;
  let completed = false;
  let offline = false;

  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: {
      userId: primaryEnrolment.userId,
      enrollmentId: primaryEnrolment.enrollmentId,
      fullName: primaryEnrolment.fullName,
      accessStatus: "active",
      accessExpiresAt: "2099-09-01T00:00:00.000Z",
      courseCompletedAt: null,
      allModulesUnlocked: false,
      activeAdjustments: [],
    },
  }));
  await page.route(/\/api\/modules(?:\?.*)?$/, (route) =>
    route.fulfill({ json: [modulePayload(completed)] }));
  await page.route(new RegExp(`/api/modules/${moduleId}(?:\\?.*)?$`), (route) =>
    route.fulfill({ json: modulePayload(completed) }));
  await page.route("**/api/progress/heartbeat", (route) =>
    route.fulfill({ json: { success: true, message: "Heartbeat saved" } }));
  await page.route("**/api/progress/complete-video", async (route) => {
    completionAttempts += 1;
    if (offline) {
      await route.abort("internetdisconnected");
      return;
    }
    expect(await route.request().postDataJSON()).toEqual({
      moduleId,
      deviceId,
      activationCode: primaryEnrolment.code,
      enrollmentId: primaryEnrolment.enrollmentId,
    });
    successfulCompletions += 1;
    completed = true;
    await route.fulfill({ json: { success: true, message: "Video marked complete" } });
  });

  await page.goto(`/training/${moduleId}`);
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  offline = true;
  await context.setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://player.vimeo.com",
      data: { event: "finish" },
    }));
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pendingVideoCompletions:v1")))
    .not.toBeNull();
  expect(completionAttempts).toBe(1);
  expect(successfulCompletions).toBe(0);
  await page.getByRole("link", { name: "BACK" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pendingVideoCompletions:v1")))
    .not.toBeNull();

  offline = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => completionAttempts).toBe(2);
  expect(successfulCompletions).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pendingVideoCompletions:v1")))
    .toBeNull();

  await page.goto(`/training/${moduleId}`);
  await page.getByRole("button", { name: "I UNDERSTAND & ACKNOWLEDGE" }).click();
  await expect(page.getByRole("link", { name: "TAKE MODULE QUIZ" }).last()).toBeVisible();
});