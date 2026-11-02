import { expect, test } from "@playwright/test";

test("admin roster distinguishes a failed read from an empty list on phone, tablet and desktop", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.setItem("adminToken", "synthetic-admin-session"));
  let failRoster = true;
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/admin/students") {
      return route.fulfill(failRoster
        ? { status: 503, json: { error: "Unavailable" } }
        : { json: [{ id: 51, fullName: "Synthetic Learner", email: "learner@example.invalid", activationCode: "TEST-CODE", activatedAt: "2026-09-01T00:00:00Z", completedModules: 2, totalModules: 5, waiverSigned: true, deviceBonded: true, totalQuizAttempts: 3, feedbackCount: 1 }] });
    }
    if (pathname === "/api/admin/stats") {
      return route.fulfill({ json: { totalLearners: 1, activeLearners: 1, completedLearners: 0, waiversSigned: 1, moduleStats: [], recentActivity: [], billingAlerts: [], billingAlertCount: 0 } });
    }
    return route.fulfill({ json: [] });
  });

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("alert").filter({ hasText: "student roster" })).toBeVisible();
    await expect(page.getByText("No learners recorded yet.")).toHaveCount(0);
    failRoster = false;
    await page.getByRole("alert").filter({ hasText: "student roster" }).getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Synthetic Learner").filter({ visible: true }).first()).toBeVisible();
    if (width < 640) await expect(page.getByRole("link", { name: "VIEW", exact: true })).toBeVisible();
     await page.getByRole("button", { name: "Student Roster", exact: true }).click();
     await expect(page.getByPlaceholder("Filter roster...")).toBeHidden();
     await page.getByRole("button", { name: "View student roster", exact: true }).click();
     await expect(page.getByPlaceholder("Filter roster...")).toBeVisible();
     const studentLink = page.getByRole("link", { name: "Synthetic Learner", exact: true }).filter({ visible: true });
     await expect(studentLink).toHaveAttribute("href", "/admin/students/51");
     await studentLink.click();
     await expect(page).toHaveURL(/\/admin\/students\/51$/);
    failRoster = true;
  }
});

test("exam attempts and certificates do not disguise server errors as empty lists", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("adminToken", "synthetic-admin-session"));
  let fail = true;
  await page.route("**/api/admin/{exam-log,certificates}", route => route.fulfill(fail
    ? { status: 401, json: { error: "Unauthorized" } }
    : { json: [] }));
  for (const [path, label, empty] of [
    ["/admin/exam-log", "final exam attempts", "No exam attempts recorded yet."],
    ["/admin/certificates", "the certificate register", "No certificates issued yet."],
  ]) {
    fail = true;
    await page.goto(path);
    await expect(page.getByRole("alert").filter({ hasText: label })).toBeVisible();
    await expect(page.getByText(empty)).toHaveCount(0);
    fail = false;
    await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText(empty)).toBeVisible();
  }
});

test("synthetic learner activity and related admin lists remain readable", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.setItem("adminToken", "synthetic-admin-session"));
  const at = "2026-09-01T00:00:00Z";
  await page.route("**/api/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const records: Record<string, unknown> = {
      "/api/admin/students/51": {
        id: 51, fullName: "Synthetic Learner", email: "learner@example.invalid",
        activatedAt: at, activationCode: "TEST-CODE", deviceId: "synthetic-device", deviceBonded: true,
        waiverSigned: true, subscriptionHistory: [], deliveryAttempts: [],
        enrollments: [{ enrollmentId: 52, activatedAt: at, status: "active", isCurrent: true, progress: { completedModules: 1, quizAttempts: 1, examAttempts: 1, examPassed: true }, certificate: { reference: "SYNTHETIC-CERT" } }],
        examAttempts: [{ id: 61, score: 90, passed: true, totalQuestions: 10, attemptedAt: at }],
        quizResults: [{ moduleId: 1, moduleTitle: "Synthetic Module", score: 100, passed: true, attemptedAt: at }],
        videoProgress: [{ moduleId: 1, moduleTitle: "Synthetic Module", lastTimestamp: 120, videoCompleted: true, quizPassed: true, updatedAt: at }],
        moduleFeedback: [{ id: 71, moduleTitle: "Synthetic Module", rating: 5, comment: "Synthetic module feedback", createdAt: at }],
        courseFeedback: [{ id: 72, rating: 5, comment: "Synthetic course feedback", createdAt: at }],
      },
      "/api/admin/exam-log": [{ id: 61, userId: 51, fullName: "Synthetic Learner", email: "learner@example.invalid", score: 90, passed: true, totalQuestions: 10, attemptedAt: at, attemptNumber: 1 }],
      "/api/admin/certificates": [{ id: 51, enrollmentId: 52, fullName: "Synthetic Learner", email: "learner@example.invalid", activationCode: "TEST-CODE", courseCompletedAt: at, certificateIssuedAt: at, certificateReference: "SYNTHETIC-CERT", examScore: 90, accessExpiresAt: null }],
      "/api/admin/feedback": [{ id: 71, userId: 51, studentName: "Synthetic Learner", moduleId: 1, moduleTitle: "Synthetic Module", rating: 5, comment: "Synthetic module feedback", createdAt: at }],
      "/api/admin/app-feedback": [{ id: 72, userId: 51, studentName: "Synthetic Learner", rating: 5, comment: "Synthetic course feedback", createdAt: at }],
      "/api/admin/risk-assessments": [{ id: 81, studentName: "Synthetic Learner", createdAt: at, taskDescription: "Synthetic risk", hazards: [] }],
      "/api/admin/inspections": [{ id: 91, studentName: "Synthetic Learner", createdAt: at, sawIdentifier: "SYNTHETIC-SAW", hasFailures: false, items: [] }],
    };
    return route.fulfill({ json: records[pathname] ?? [] });
  });
  await page.goto("/admin/students/51");
  await expect(page.getByText("Synthetic Learner").first()).toBeVisible();
  await expect(page.getByText("SYNTHETIC-CERT")).toBeVisible();
  await expect(page.getByText("Watched to 2:00")).toBeVisible();
  await expect(page.getByText("Synthetic course feedback")).toBeVisible();
  for (const [path, text] of [
    ["/admin/exam-log", "Synthetic Learner"],
    ["/admin/certificates", "SYNTHETIC-CERT"],
    ["/admin/feedback", "Synthetic Module"],
    ["/admin/risk-assessments", "Synthetic Learner"],
    ["/admin/inspections", "Synthetic Learner"],
  ]) {
    await page.goto(path);
    await expect(page.getByText(text).first()).toBeVisible();
  }
});