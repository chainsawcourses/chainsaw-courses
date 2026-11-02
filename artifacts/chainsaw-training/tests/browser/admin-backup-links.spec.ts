import { expect, test, type Page } from "@playwright/test";

const readableBackup = {
  state: "succeeded",
  source: "scheduled",
  startedAt: "2026-10-18T05:03:27.000Z",
  error: null,
  result: {
    format: "readable",
    url: "https://docs.google.com/spreadsheets/d/full-readable/edit",
    folderId: "weekly-folder-id",
    rootFolderId: "chainsaw-user-backup-id",
    title: "Chainsaw Courses Full Data — 2026-10-18",
    at: "2026-10-18T05:05:27.000Z",
    counts: {
      tables: 38, records: 100, learners: 30, certificates: 4, inspections: 17,
      risks: 26, waivers: 12, assessmentMedia: 3, retailerLogos: 2,
    },
    categories: [
      { key: "feedback", label: "Feedback", title: "Feedback", url: "https://docs.google.com/spreadsheets/d/feedback/edit", folderId: "feedback-folder-id", counts: { tables: 2, records: 8, documents: 0 } },
      { key: "inspections", label: "Inspections", title: "Inspections", url: "https://docs.google.com/spreadsheets/d/inspections/edit", folderId: "inspections-folder-id", counts: { tables: 2, records: 47, documents: 17 } },
      { key: "risk-assessments", label: "Risk assessments", title: "Risk assessments", url: "https://docs.google.com/spreadsheets/d/risks/edit", folderId: "risks-folder-id", counts: { tables: 2, records: 56, documents: 26 } },
      { key: "user-certificates", label: "User certificates", title: "User certificates", url: "https://docs.google.com/spreadsheets/d/certificates/edit", folderId: "certificates-folder-id", counts: { tables: 3, records: 77, documents: 4 } },
      { key: "progress", label: "User progress", title: "User progress", url: "https://docs.google.com/spreadsheets/d/progress/edit", folderId: "progress-folder-id", counts: { tables: 6, records: 250, documents: 0 } },
      { key: "waivers", label: "Waivers", title: "Waivers", url: "https://docs.google.com/spreadsheets/d/waivers/edit", folderId: "waivers-folder-id", counts: { tables: 3, records: 89, documents: 12 } },
    ],
    documentFolders: [
      { key: "portable", label: "Portable Export", folderId: "portable-folder-id", count: 4 },
      { key: "certificates", label: "User Certificates", folderId: "certificates-folder-id", count: 4 },
      { key: "waivers", label: "Waivers", folderId: "waivers-folder-id", count: 12 },
      { key: "inspections", label: "Inspections", folderId: "inspections-folder-id", count: 17 },
      { key: "risk-assessments", label: "Risk Assessments", folderId: "risks-folder-id", count: 26 },
      { key: "assessment-media", label: "Assessment Media", folderId: "media-folder-id", count: 3 },
      { key: "retailer-logos", label: "Retailer Logos", folderId: "logos-folder-id", count: 2 },
    ],
  },
};

const legacyBackup = {
  state: "succeeded",
  source: "scheduled",
  startedAt: "2026-10-17T05:03:27.000Z",
  error: null,
  result: {
    url: "https://drive.google.com/file/d/legacy-archive/view",
    folderId: "legacy-weekly-folder",
    rootFolderId: "chainsaw-user-backup-id",
    title: "Chainsaw-Courses-2026-10-17.backup.enc",
    at: "2026-10-17T05:05:27.000Z",
    sha256: "legacy-sha256",
    counts: { tables: 36, records: 100, learners: 30, certificates: 4, inspections: 17, risks: 26 },
    categories: [
      { key: "feedback", label: "Feedback", title: "feedback.backup.enc", url: "https://drive.google.com/file/d/feedback-archive/view", folderId: "feedback-folder-id", sha256: "feedback-sha256" },
    ],
  },
};

async function mockAdminApi(page: Page, backup: object) {
  await page.addInitScript(() => localStorage.setItem("adminToken", "synthetic-admin-session"));
  await page.route("**/api/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/admin/backup/status") return route.fulfill({ json: backup });
    if (pathname === "/api/admin/backup/exports") return route.fulfill({ json: [] });
    if (pathname === "/api/admin/stats") {
      return route.fulfill({ json: { totalLearners: 0, activeLearners: 0, completedLearners: 0, waiversSigned: 0, moduleStats: [], recentActivity: [], billingAlerts: [], billingAlertCount: 0 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/admin/dashboard");
}

async function openDataBackupPanel(page: Page) {
  const toggle = page.getByRole("button", { name: /Data & Backup/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "BACKUP FOLDER", exact: true })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

test("readable backup links open the full workbook, category sheets, and document folders", async ({ page }) => {
  await mockAdminApi(page, readableBackup);
  await openDataBackupPanel(page);
  await expect(page.getByRole("link", { name: "BACKUP FOLDER", exact: true })).toHaveAttribute(
    "href", "https://drive.google.com/drive/folders/chainsaw-user-backup-id",
  );
  await expect(page.getByText(/Last backed up: .*18 Oct 2026/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open full database Google Sheet" })).toHaveAttribute(
    "href", readableBackup.result.url,
  );
  await expect(page.getByRole("link", { name: "Open Feedback Google Sheet" })).toHaveAttribute(
    "href", readableBackup.result.categories[0].url,
  );
  await expect(page.getByRole("link", { name: "Open Waivers files (12)" })).toHaveAttribute(
    "href", "https://drive.google.com/drive/folders/waivers-folder-id",
  );
  await expect(page.getByRole("link", { name: "Open Portable Export files (4)" })).toHaveAttribute(
    "href", "https://drive.google.com/drive/folders/portable-folder-id",
  );
  await expect(page.getByText(/New exports are unencrypted Google Sheets and ordinary files/)).toBeVisible();

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test("legacy encrypted archives are not mislabeled as readable Sheets", async ({ page }) => {
  await mockAdminApi(page, legacyBackup);
  await openDataBackupPanel(page);
  await expect(page.getByText(/This older \.backup\.enc file remains encrypted/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open legacy encrypted Feedback archive" })).toHaveAttribute(
    "href", legacyBackup.result.categories[0].url,
  );
  await expect(page.getByRole("link", { name: "Open Feedback Google Sheet" })).toHaveCount(0);
});

test("running backups show the current named file and refresh to completion", async ({ page }) => {
  const backup = {
    state: "running", source: "manual", startedAt: new Date().toISOString(),
    result: { progress: "Saving Example Learner - User 12 - Inspection.pdf", updatedAt: new Date().toISOString() },
  };
  await mockAdminApi(page, backup);
  await openDataBackupPanel(page);
  await expect(page.getByRole("button", { name: "BACKUP RUNNING…" })).toBeDisabled();
  await expect(page.getByText(/Saving Example Learner/)).toBeVisible();
  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
  Object.assign(backup, readableBackup);
  await expect(page.getByRole("button", { name: "BACKUP ALL DATA" })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByRole("link", { name: "Open full database Google Sheet" })).toBeVisible();
});

test("unavailable status is reported instead of silently showing preparing forever", async ({ page }) => {
  await mockAdminApi(page, { state: "running", startedAt: new Date().toISOString() });
  await openDataBackupPanel(page);
  await page.route("**/api/admin/backup/status", route => route.fulfill({ status: 503, json: {} }));
  await expect(page.getByText(/Cannot refresh backup status/)).toBeVisible({ timeout: 10000 });
});
