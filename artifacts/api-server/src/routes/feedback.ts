import { Router } from "express";
import { db } from "@workspace/db";
import { moduleFeedbackTable, modulesTable, usersTable, appFeedbackTable } from "@workspace/db";
import { SubmitModuleFeedbackBody } from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { getOrCreateDriveFolder, BACKUP_FOLDER } from "../lib/driveCertificates";

const router = Router();

router.post("/feedback/:moduleId", async (req, res) => {
  const moduleId = parseInt(req.params.moduleId);
  const parse = SubmitModuleFeedbackBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, rating, comment } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.insert(moduleFeedbackTable).values({
      userId: user.id,
      moduleId,
      rating,
      comment: comment ?? null,
    });

    res.json({ success: true, message: "Feedback recorded" });
  } catch (err) {
    logger.error({ err }, "Error saving module feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/feedback", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: moduleFeedbackTable.id,
        moduleId: moduleFeedbackTable.moduleId,
        userId: moduleFeedbackTable.userId,
        rating: moduleFeedbackTable.rating,
        comment: moduleFeedbackTable.comment,
        createdAt: moduleFeedbackTable.createdAt,
        moduleTitle: modulesTable.title,
        moduleOrder: modulesTable.order,
        studentName: usersTable.fullName,
      })
      .from(moduleFeedbackTable)
      .leftJoin(modulesTable, eq(moduleFeedbackTable.moduleId, modulesTable.id))
      .leftJoin(usersTable, eq(moduleFeedbackTable.userId, usersTable.id))
      .orderBy(desc(moduleFeedbackTable.createdAt));

    res.json(
      rows.map((r) => ({
        id: r.id,
        moduleId: r.moduleId,
        userId: r.userId,
        moduleTitle: r.moduleTitle ?? "Unknown module",
        moduleOrder: r.moduleOrder ?? 9999,
        rating: r.rating,
        comment: r.comment ?? null,
        studentName: r.studentName ?? "Unknown",
        createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error fetching feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

const SubmitAppFeedbackBody = z.object({
  deviceId: z.string(),
  activationCode: z.string(),
  rating: z.number().int().min(1).max(5),
  clarityRating: z.number().int().min(1).max(5).optional(),
  usabilityRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

router.post("/app-feedback", async (req, res) => {
  const parse = SubmitAppFeedbackBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { deviceId, activationCode, rating, clarityRating, usabilityRating, comment } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.insert(appFeedbackTable).values({
      userId: user.id,
      rating,
      clarityRating: clarityRating ?? null,
      usabilityRating: usabilityRating ?? null,
      comment: comment ?? null,
    });
    res.json({ success: true, message: "Feedback recorded" });
  } catch (err) {
    logger.error({ err }, "Error saving app feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/app-feedback", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: appFeedbackTable.id,
        rating: appFeedbackTable.rating,
        clarityRating: appFeedbackTable.clarityRating,
        usabilityRating: appFeedbackTable.usabilityRating,
        comment: appFeedbackTable.comment,
        createdAt: appFeedbackTable.createdAt,
        studentName: usersTable.fullName,
      })
      .from(appFeedbackTable)
      .leftJoin(usersTable, eq(appFeedbackTable.userId, usersTable.id))
      .orderBy(desc(appFeedbackTable.createdAt));
    res.json(rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      clarityRating: r.clarityRating ?? null,
      usabilityRating: r.usabilityRating ?? null,
      comment: r.comment ?? null,
      studentName: r.studentName ?? "Unknown",
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching app feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Save one student's feedback to Google Drive ────────────────────────────────
router.post("/admin/feedback/student/:userId/save-to-drive", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  try {
    // ── Fetch this student's data ──────────────────────────────────────────────
    const [user] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const moduleRows = await db
      .select({
        moduleTitle: modulesTable.title,
        moduleOrder: modulesTable.order,
        rating: moduleFeedbackTable.rating,
        comment: moduleFeedbackTable.comment,
        createdAt: moduleFeedbackTable.createdAt,
      })
      .from(moduleFeedbackTable)
      .leftJoin(modulesTable, eq(moduleFeedbackTable.moduleId, modulesTable.id))
      .where(and(eq(moduleFeedbackTable.userId, userId)))
      .orderBy(modulesTable.order, desc(moduleFeedbackTable.createdAt));

    const courseRows = await db
      .select({
        rating: appFeedbackTable.rating,
        comment: appFeedbackTable.comment,
        createdAt: appFeedbackTable.createdAt,
      })
      .from(appFeedbackTable)
      .where(eq(appFeedbackTable.userId, userId))
      .orderBy(desc(appFeedbackTable.createdAt));

    // ── Sheets helpers (same as bulk export) ──────────────────────────────────
    type CellValue = string | number | null | undefined;
    const toCell = (v: CellValue) => ({
      userEnteredValue: typeof v === "number" ? { numberValue: v } : { stringValue: String(v ?? "") },
    });
    const toRow = (vals: CellValue[]) => ({ values: vals.map(toCell) });
    const headerFmt = {
      userEnteredFormat: {
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        backgroundColor: { red: 0.886, green: 0.447, blue: 0.149 },
      },
    };

    const MODULE_HEADERS = ["Module", "Rating", "Comment", "Date"];
    const COURSE_HEADERS = ["Rating", "Comment", "Date"];

    const builtModuleRows = moduleRows.map((r) =>
      toRow([r.moduleTitle ?? "Unknown module", r.rating, r.comment ?? "", r.createdAt?.toISOString?.() ?? String(r.createdAt)])
    );
    const builtCourseRows = courseRows.map((r) =>
      toRow([r.rating, r.comment ?? "", r.createdAt?.toISOString?.() ?? String(r.createdAt)])
    );

    const allSheets = [
      { title: "Module Feedback",         headers: MODULE_HEADERS, rows: builtModuleRows },
      { title: "Overall Course Feedback", headers: COURSE_HEADERS, rows: builtCourseRows },
    ];

    // ── Find or create "Chainsaw Courses User Backup" / "Feedback" folder ────────
    const connectors = new ReplitConnectors();
    const backupId2  = await getOrCreateDriveFolder(connectors, BACKUP_FOLDER);
    const folderId   = await getOrCreateDriveFolder(connectors, "Feedback", backupId2);

    // ── Create spreadsheet ─────────────────────────────────────────────────────
    const safeName = user.fullName.replace(/[^a-z0-9 ]/gi, "_");
    const title = `Feedback — ${safeName}`;

    const createFileRes = await connectors.proxy(
      "google-drive",
      "/drive/v3/files",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.spreadsheet", parents: [folderId] }) },
    );
    const fileData = await createFileRes.json() as { id: string };
    const spreadsheetId = fileData.id;

    // ── Discover default sheet ID ──────────────────────────────────────────────
    const metaRes = await connectors.proxy("google-sheet", `/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.sheetId`, { method: "GET" });
    const metaData = await metaRes.json() as { sheets: Array<{ properties: { sheetId: number } }> };
    const defaultSheetId = metaData.sheets[0].properties.sheetId;

    const sheetIdMap = allSheets.map((s, i) => ({ ...s, actualId: i === 0 ? defaultSheetId : 1000 + i }));

    // ── Rename / add sheets ────────────────────────────────────────────────────
    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: sheetIdMap[0].title }, fields: "title" } },
            ...sheetIdMap.slice(1).map((s) => ({ addSheet: { properties: { sheetId: s.actualId, title: s.title } } })),
          ],
        }),
      },
    );

    // ── Populate + format ──────────────────────────────────────────────────────
    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: sheetIdMap.flatMap((s) => [
            {
              updateCells: {
                start: { sheetId: s.actualId, rowIndex: 0, columnIndex: 0 },
                rows: [toRow(s.headers), ...s.rows],
                fields: "userEnteredValue,userEnteredFormat",
              },
            },
            {
              repeatCell: {
                range: { sheetId: s.actualId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: s.headers.length },
                cell: headerFmt,
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
            {
              autoResizeDimensions: {
                dimensions: { sheetId: s.actualId, dimension: "COLUMNS", startIndex: 0, endIndex: s.headers.length },
              },
            },
          ]),
        }),
      },
    );

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    logger.info({ userId, spreadsheetId, folderId }, "Student feedback saved to Google Drive");
    res.json({ url: sheetUrl, title });
  } catch (err) {
    logger.error({ err, userId }, "Error saving student feedback to Drive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Export all feedback to a Google Sheet ──────────────────────────────────────
router.post("/admin/feedback/export-sheets", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // ── Fetch all data ─────────────────────────────────────────────────────────
    const moduleRows = await db
      .select({
        id: moduleFeedbackTable.id,
        moduleId: moduleFeedbackTable.moduleId,
        moduleTitle: modulesTable.title,
        moduleOrder: modulesTable.order,
        rating: moduleFeedbackTable.rating,
        comment: moduleFeedbackTable.comment,
        createdAt: moduleFeedbackTable.createdAt,
        studentName: usersTable.fullName,
      })
      .from(moduleFeedbackTable)
      .leftJoin(modulesTable, eq(moduleFeedbackTable.moduleId, modulesTable.id))
      .leftJoin(usersTable, eq(moduleFeedbackTable.userId, usersTable.id))
      .orderBy(modulesTable.order, desc(moduleFeedbackTable.createdAt));

    const courseRows = await db
      .select({
        id: appFeedbackTable.id,
        rating: appFeedbackTable.rating,
        comment: appFeedbackTable.comment,
        createdAt: appFeedbackTable.createdAt,
        studentName: usersTable.fullName,
      })
      .from(appFeedbackTable)
      .leftJoin(usersTable, eq(appFeedbackTable.userId, usersTable.id))
      .orderBy(desc(appFeedbackTable.createdAt));

    // ── Sheets helpers ─────────────────────────────────────────────────────────
    type CellValue = string | number | null | undefined;
    const toCell = (v: CellValue) => ({
      userEnteredValue: typeof v === "number"
        ? { numberValue: v }
        : { stringValue: String(v ?? "") },
    });
    const toRow = (vals: CellValue[]) => ({ values: vals.map(toCell) });
    const headerFmt = {
      userEnteredFormat: {
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        backgroundColor: { red: 0.886, green: 0.447, blue: 0.149 },
      },
    };

    const MODULE_HEADERS  = ["Student", "Module", "Rating", "Comment", "Date"];
    const COURSE_HEADERS  = ["Student", "Rating", "Comment", "Date"];

    const builtModuleRows = moduleRows.map((r) =>
      toRow([
        r.studentName ?? "Unknown",
        r.moduleTitle ?? "Unknown module",
        r.rating,
        r.comment ?? "",
        r.createdAt?.toISOString?.() ?? String(r.createdAt),
      ])
    );
    const builtCourseRows = courseRows.map((r) =>
      toRow([
        r.studentName ?? "Unknown",
        r.rating,
        r.comment ?? "",
        r.createdAt?.toISOString?.() ?? String(r.createdAt),
      ])
    );

    const allSheets = [
      { title: "Module Feedback",         headers: MODULE_HEADERS, rows: builtModuleRows },
      { title: "Overall Course Feedback", headers: COURSE_HEADERS, rows: builtCourseRows },
    ];

    // ── Find or create "Chainsaw Courses User Backup" / "Feedback" folder ────────
    const connectors = new ReplitConnectors();
    const backupId = await getOrCreateDriveFolder(connectors, BACKUP_FOLDER);
    const folderId = await getOrCreateDriveFolder(connectors, "Feedback", backupId);

    // ── Create blank spreadsheet in the Feedback subfolder ────────────────────
    const createFileRes = await connectors.proxy(
      "google-drive",
      "/drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Feedback",
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [folderId],
        }),
      },
    );
    const fileData = await createFileRes.json() as { id: string };
    const spreadsheetId = fileData.id;

    // ── Discover default sheet real ID ─────────────────────────────────────────
    const metaRes = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.sheetId`,
      { method: "GET" },
    );
    const metaData = await metaRes.json() as { sheets: Array<{ properties: { sheetId: number } }> };
    const defaultSheetId = metaData.sheets[0].properties.sheetId;

    const sheetIdMap = allSheets.map((s, i) => ({
      ...s,
      actualId: i === 0 ? defaultSheetId : 1000 + i,
    }));

    // ── Rename/add sheets ──────────────────────────────────────────────────────
    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: sheetIdMap[0].title }, fields: "title" } },
            ...sheetIdMap.slice(1).map((s) => ({ addSheet: { properties: { sheetId: s.actualId, title: s.title } } })),
          ],
        }),
      },
    );

    // ── Populate data + format headers ─────────────────────────────────────────
    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: sheetIdMap.flatMap((s) => [
            {
              updateCells: {
                start: { sheetId: s.actualId, rowIndex: 0, columnIndex: 0 },
                rows: [toRow(s.headers), ...s.rows],
                fields: "userEnteredValue,userEnteredFormat",
              },
            },
            {
              repeatCell: {
                range: { sheetId: s.actualId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: s.headers.length },
                cell: headerFmt,
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
            {
              autoResizeDimensions: {
                dimensions: { sheetId: s.actualId, dimension: "COLUMNS", startIndex: 0, endIndex: s.headers.length },
              },
            },
          ]),
        }),
      },
    );

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    logger.info({ spreadsheetId, folderId, moduleRows: builtModuleRows.length, courseRows: builtCourseRows.length }, "Feedback exported to Google Sheet");
    res.json({ url: sheetUrl });
  } catch (err) {
    logger.error({ err }, "Error exporting feedback to Google Sheet");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
