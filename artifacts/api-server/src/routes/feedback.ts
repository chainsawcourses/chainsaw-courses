import { Router } from "express";
import { db } from "@workspace/db";
import { moduleFeedbackTable, modulesTable, usersTable, appFeedbackTable } from "@workspace/db";
import { SubmitModuleFeedbackBody } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { ReplitConnectors } from "@replit/connectors-sdk";

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
  comment: z.string().optional(),
});

router.post("/app-feedback", async (req, res) => {
  const parse = SubmitAppFeedbackBody.safeParse(req.body);
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
    await db.insert(appFeedbackTable).values({ userId: user.id, rating, comment: comment ?? null });
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
      comment: r.comment ?? null,
      studentName: r.studentName ?? "Unknown",
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching app feedback");
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

    // ── Find or create the "Chainsaw Courses User Backup" folder ──────────────
    const connectors = new ReplitConnectors();
    const BACKUP_FOLDER_NAME = "Chainsaw Courses User Backup";

    const folderSearchRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,
      { method: "GET" },
    );
    const folderSearchData = await folderSearchRes.json() as { files: Array<{ id: string }> };

    let folderId: string;
    if (folderSearchData.files.length > 0) {
      folderId = folderSearchData.files[0].id;
    } else {
      const createFolderRes = await connectors.proxy(
        "google-drive",
        "/drive/v3/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
        },
      );
      const folderData = await createFolderRes.json() as { id: string };
      folderId = folderData.id;
      logger.info({ folderId }, "Created Google Drive backup folder");
    }

    // ── Create blank spreadsheet in the folder ─────────────────────────────────
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
