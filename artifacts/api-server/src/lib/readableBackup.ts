import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { AppConnectors as ReplitConnectors } from "./appConnectors";
import { BACKUP_CATEGORIES, BACKUP_TABLES } from "./fullBackup";
import { generateCertificatePdf } from "./generateCertificate";
import { generateInspectionPdf, type InspectionItem } from "./generateInspectionPdf";
import { generateRiskAssessmentPdf, type HazardEntry } from "./generateRiskAssessmentPdf";
import {
  getAssessmentMediaObject,
  getRetailerLogoObject,
  retailerLogoObjectIdFromKey,
  listAssessmentMediaObjects,
} from "./assessmentMediaStorage";
import { drawApprovedPdfKitHeader } from "./pdfBranding";
import { learnerBackupName, progressCsv } from "./readableBackupNames";
import { findIncrementalFile, rememberIncrementalFile } from "./incrementalBackupFiles";
import { capturePortableTables, portableDataJson, portableManifest, portableRestoreSql, PORTABLE_README } from "./portableBackup";

type BackupDrive = Pick<ReplitConnectors, "proxy">;
type GoogleService = "google-drive" | "google-sheet";
type JsonRequest = { method: string; headers?: Record<string, string>; body?: string | Buffer };
type TableSnapshot = { name: string; columns: string[]; rows: Record<string, unknown>[] };
type SheetValue = string | number | boolean;

export type ReadableBackupCounts = {
  tables: number;
  records: number;
  learners: number;
  certificates: number;
  inspections: number;
  risks: number;
  waivers: number;
  assessmentMedia: number;
  retailerLogos: number;
};

export type ReadableBackupResult = {
  format: "readable";
  url: string;
  folderId: string;
  rootFolderId: string;
  title: string;
  at: string;
  counts: ReadableBackupCounts;
  categories: Array<{
    key: string;
    label: string;
    title: string;
    url: string;
    folderId: string;
    counts: { tables: number; records: number; documents: number };
  }>;
  documentFolders: Array<{ key: string; label: string; folderId: string; count: number }>;
  driveFileIds: string[];
};

const READABLE_CATEGORIES = [
  ...BACKUP_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    folderName: category.folderName,
    tables: [...category.tables],
  })),
  {
    key: "waivers",
    label: "Waivers",
    folderName: "Waivers",
    tables: ["users", "course_enrolments", "waivers"],
  },
];

const MAX_CELL_CODE_POINTS = 40_000;
const MAX_WORKBOOK_CELLS = 8_000_000;
const MAX_SHEETS_REQUEST_BYTES = 1_500_000;
const MAX_RETRY_DELAY_MS = 30_000;

async function googleApiErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = await response.clone().json() as {
      error?: { status?: unknown; errors?: Array<{ reason?: unknown }> };
    };
    const error = payload.error;
    const values = [
      error?.status,
      ...(Array.isArray(error?.errors) ? error.errors.map((item) => item.reason) : []),
    ];
    const safeCodes = [...new Set(values.filter((value): value is string =>
      typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value)))];
    return safeCodes.join(", ") || null;
  } catch {
    return null;
  }
}

async function driveJson<T>(drive: BackupDrive, service: GoogleService, url: string, request: JsonRequest): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await drive.proxy(service, url, request);
    if (response.ok) return await response.json() as T;
    if (attempt >= 5 || (response.status !== 429 && response.status < 500)) {
      const code = await googleApiErrorCode(response);
      throw new Error(`${service} request failed (${response.status})${code ? `: ${code}` : ""}`);
    }

    const retryAfter = response.headers.get("retry-after");
    const retryAfterMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)
      ? Math.min(MAX_RETRY_DELAY_MS, Number(retryAfter) * 1_000)
      : Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }
}

async function findOrCreateFolder(
  drive: BackupDrive,
  name: string,
  parentId: string,
  createIfMissing = true,
): Promise<string> {
  const escaped = name.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  const query = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`;
  const found = await driveJson<{ files?: Array<{ id: string }> }>(
    drive,
    "google-drive",
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=100`,
    { method: "GET" },
  );
  if (found.files?.length === 1 && found.files[0].id) return found.files[0].id;
  if ((found.files?.length ?? 0) > 1) throw new Error(`More than one “${name}” folder exists in the requested backup folder.`);
  if (!createIfMissing) throw new Error(`The existing “${name}” folder was not found in the requested backup folder.`);
  const created = await driveJson<{ id?: string }>(drive, "google-drive", "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!created.id) throw new Error(`Google Drive did not return an ID for the “${name}” folder.`);
  return created.id;
}

function cellValue(value: unknown): SheetValue {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `base64:${value.toString("base64")}`;
  const json = JSON.stringify(value);
  return json === undefined ? "" : json;
}

function splitLongText(value: SheetValue): SheetValue[] {
  if (typeof value !== "string") return [value];
  const points = Array.from(value);
  if (points.length <= MAX_CELL_CODE_POINTS) return [value];
  const result: string[] = [];
  for (let i = 0; i < points.length; i += MAX_CELL_CODE_POINTS) {
    result.push(points.slice(i, i + MAX_CELL_CODE_POINTS).join(""));
  }
  return result;
}

/** Builds a lossless, readable grid; oversized cells are spread across numbered columns. */
export function buildReadableTableGrid(columns: string[], rows: Record<string, unknown>[]): SheetValue[][] {
  const serialized = rows.map((row) => columns.map((column) => cellValue(row[column])));
  const partCounts = columns.map((_, columnIndex) =>
    Math.max(1, ...serialized.map((row) => splitLongText(row[columnIndex]).length)),
  );
  const headers = columns.flatMap((column, index) =>
    partCounts[index] === 1
      ? [column]
      : Array.from({ length: partCounts[index] }, (_, part) => `${column} (part ${part + 1}; join in order)`),
  );
  if (headers.length > 18_000) throw new Error("A database table is too wide to export to Google Sheets.");
  const values: SheetValue[][] = [headers];
  for (const row of serialized) {
    const expanded: SheetValue[] = [];
    row.forEach((value, index) => {
      const parts = splitLongText(value);
      expanded.push(...parts);
      for (let missing = parts.length; missing < partCounts[index]; missing++) expanded.push("");
    });
    values.push(expanded);
  }
  return values;
}

function sheetTitle(name: string): string {
  const safe = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 100);
  if (!safe) throw new Error("A Google Sheets tab has an invalid name.");
  return safe;
}

function columnName(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export async function writeReadableSpreadsheet(
  drive: BackupDrive,
  folderId: string,
  title: string,
  overviewRows: SheetValue[][],
  tables: TableSnapshot[],
  createdFileIds: string[],
): Promise<{ id: string; url: string }> {
  const existing = await findIncrementalFile(drive, folderId, title, (url, req) => driveJson(drive, "google-drive", url, req));
  const file = existing ?? await driveJson<{ id?: string }>(drive, "google-drive", "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    }),
  });
  if (!file.id) throw new Error(`Google Drive did not create the “${title}” spreadsheet.`);
  if (!existing) createdFileIds.push(file.id);
  rememberIncrementalFile(drive, folderId, { id: file.id, name: title });
  if (existing && existing.name !== title) await driveJson(drive, "google-drive", `/drive/v3/files/${file.id}?fields=id`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: title }),
  });

  const metadata = await driveJson<{ sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> }>(
    drive,
    "google-sheet",
    `/v4/spreadsheets/${file.id}?fields=sheets.properties(sheetId,title)`,
    { method: "GET" },
  );
  const defaultSheetId = metadata.sheets?.[0]?.properties?.sheetId;
  if (defaultSheetId === undefined) throw new Error(`Google Sheets did not return the default tab for “${title}”.`);

  const allSheets = [
    { title: "Overview", sheetId: defaultSheetId, values: overviewRows },
    ...tables.map((table, index) => ({
      title: sheetTitle(table.name),
      sheetId: metadata.sheets?.find((sheet) => sheet.properties?.title === sheetTitle(table.name))?.properties?.sheetId
        ?? Math.max(1000, ...(metadata.sheets ?? []).map((s) => (s.properties?.sheetId ?? 0) + 1)) + index,
      values: buildReadableTableGrid(table.columns, table.rows),
    })),
  ];
  const cells = allSheets.reduce((sum, sheet) =>
    sum + sheet.values.reduce((rowsSum, row) => rowsSum + row.length, 0), 0);
  if (cells > MAX_WORKBOOK_CELLS) throw new Error(`“${title}” would exceed Google Sheets’ safe cell limit (${cells.toLocaleString()} cells).`);

  const requests: unknown[] = [{
    updateSheetProperties: {
      properties: { sheetId: defaultSheetId, title: "Overview", gridProperties: { frozenRowCount: 1 } },
      fields: "title,gridProperties.frozenRowCount",
    },
  }];
  for (const sheet of allSheets.slice(1)) {
    if (metadata.sheets?.some((entry) => entry.properties?.sheetId === sheet.sheetId)) continue;
    requests.push({
      addSheet: {
        properties: {
          sheetId: sheet.sheetId,
          title: sheet.title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }
  for (const sheet of allSheets) {
    if (existing) requests.push({
      updateCells: { range: { sheetId: sheet.sheetId }, fields: "userEnteredValue" },
    });
    if (sheet.values.length > 0 && sheet.values[0].length > 0) {
      requests.push({
        repeatCell: {
          range: { sheetId: sheet.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: {
            backgroundColor: { red: 0.886, green: 0.447, blue: 0.149 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          } },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });
    }
    if (sheet.values.length > 1 && sheet.values[0].length > 0) {
      requests.push({
        setBasicFilter: {
          filter: {
            range: {
              sheetId: sheet.sheetId,
              startRowIndex: 0,
              endRowIndex: sheet.values.length,
              startColumnIndex: 0,
              endColumnIndex: sheet.values[0].length,
            },
          },
        },
      });
    }
  }
  await driveJson(drive, "google-sheet", `/v4/spreadsheets/${file.id}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  let pendingRanges: Array<{ range: string; values: SheetValue[][] }> = [];
  const flushValueRanges = async () => {
    if (!pendingRanges.length) return;
    await driveJson(drive, "google-sheet", `/v4/spreadsheets/${file.id}/values:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "RAW", data: pendingRanges }),
    });
    pendingRanges = [];
  };
  const queueValueRange = async (
    sheet: typeof allSheets[number],
    startRow: number,
    rows: SheetValue[][],
    startColumn = 0,
    endColumn = Math.max(0, ...rows.map((row) => row.length)),
  ): Promise<void> => {
    if (endColumn <= startColumn) return;
    const rowEnd = startRow + rows.length;
    const range = startColumn === 0 && endColumn === Math.max(0, ...rows.map((row) => row.length))
      ? `'${sheet.title.replaceAll("'", "''")}'!A${startRow + 1}`
      : `'${sheet.title.replaceAll("'", "''")}'!${columnName(startColumn)}${startRow + 1}:${columnName(endColumn - 1)}${rowEnd}`;
    const values = startColumn === 0 && endColumn === Math.max(0, ...rows.map((row) => row.length))
      ? rows
      : rows.map((row) => row.slice(startColumn, endColumn));
    const entry = { range, values };
    const singleBytes = Buffer.byteLength(JSON.stringify({ valueInputOption: "RAW", data: [entry] }));

    if (singleBytes > MAX_SHEETS_REQUEST_BYTES) {
      if (rows.length > 1) {
        const midpoint = Math.floor(rows.length / 2);
        await queueValueRange(sheet, startRow, rows.slice(0, midpoint), startColumn, endColumn);
        await queueValueRange(sheet, startRow + midpoint, rows.slice(midpoint), startColumn, endColumn);
        return;
      }
      if (endColumn - startColumn > 1) {
        const midpoint = Math.floor((startColumn + endColumn) / 2);
        await queueValueRange(sheet, startRow, rows, startColumn, midpoint);
        await queueValueRange(sheet, startRow, rows, midpoint, endColumn);
        return;
      }
      throw new Error(`A cell in “${sheet.title}” exceeds Google Sheets’ safe request size.`);
    }

    const candidate = [...pendingRanges, entry];
    if (Buffer.byteLength(JSON.stringify({ valueInputOption: "RAW", data: candidate })) > MAX_SHEETS_REQUEST_BYTES) {
      await flushValueRanges();
    }
    pendingRanges.push(entry);
  };

  for (const sheet of allSheets) {
    for (let offset = 0; offset < sheet.values.length; offset += 100) {
      await queueValueRange(sheet, offset, sheet.values.slice(offset, offset + 100));
    }
  }
  await flushValueRanges();

  const verified = await driveJson<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    drive,
    "google-sheet",
    `/v4/spreadsheets/${file.id}?fields=sheets.properties.title`,
    { method: "GET" },
  );
  const createdTitles = new Set((verified.sheets ?? []).map((sheet) => sheet.properties?.title));
  if (allSheets.some((sheet) => !createdTitles.has(sheet.title))) {
    throw new Error(`Google Sheets did not verify every tab in “${title}”.`);
  }
  return { id: file.id, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
}

export async function uploadPlainFile(
  drive: BackupDrive,
  folderId: string,
  name: string,
  mimeType: string,
  bytes: Buffer,
  createdFileIds: string[],
  sourceHash?: string,
  aliases: string[] = [],
): Promise<{ id: string; url: string }> {
  const existing = await findIncrementalFile(drive, folderId, name, (url, req) => driveJson(drive, "google-drive", url, req), aliases);
  const md5 = createHash("md5").update(bytes).digest("hex");
  if (existing && (existing.md5Checksum === md5 || (sourceHash && existing.appProperties?.sourceHash === sourceHash && existing.md5Checksum && existing.appProperties.verifiedMd5 === existing.md5Checksum))) {
    return { id: existing.id, url: `https://drive.google.com/file/d/${existing.id}/view` };
  }
  const file = existing ?? await driveJson<{ id?: string }>(drive, "google-drive", "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType, parents: [folderId] }),
  });
  if (!file.id) throw new Error(`Google Drive did not create “${name}”.`);
  if (!existing) createdFileIds.push(file.id);
  if (existing) await driveJson(drive, "google-drive", `/drive/v3/files/${file.id}?fields=id`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
  });
  await driveJson(drive, "google-drive", `/upload/drive/v3/files/${file.id}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });
  const remote = await driveJson<{ id?: string; size?: string; md5Checksum?: string }>(
    drive,
    "google-drive",
    `/drive/v3/files/${file.id}?fields=id,size,md5Checksum`,
    { method: "GET" },
  );
  if (remote.id !== file.id || Number(remote.size) !== bytes.length || remote.md5Checksum !== md5) {
    throw new Error(`The readable Drive file “${name}” did not pass its size and checksum verification.`);
  }
  if (sourceHash) await driveJson(drive, "google-drive", `/drive/v3/files/${file.id}?fields=id`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { sourceHash, verifiedMd5: md5 } }),
  });
  rememberIncrementalFile(drive, folderId, {
    id: file.id, name, md5Checksum: md5, appProperties: sourceHash ? { sourceHash, verifiedMd5: md5 } : undefined,
  });
  return { id: file.id, url: `https://drive.google.com/file/d/${file.id}/view` };
}

function asJson(value: unknown): unknown {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export function generateWaiverPdf(waiver: Record<string, unknown>, user: Record<string, unknown> | undefined): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 60, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.once("error", reject);
    document.once("end", () => resolve(Buffer.concat(chunks)));
    try {
      drawApprovedPdfKitHeader(document, {
        left: 60, right: 535, y: document.y, chainsawLogoSize: 56, titleSize: 22, subtitleSize: 8,
      });
      document.y = 120;
      document.fontSize(16).fillColor("#1C1C1C").font("Helvetica-Bold")
        .text("SIGNED LIABILITY WAIVER & AGREEMENT", { align: "center" });
      document.moveDown(1.5);
      document.fontSize(10).fillColor("#555555").font("Helvetica-Bold").text("LEARNER DETAILS");
      document.moveDown(0.3);
      document.fontSize(10).fillColor("#1C1C1C").font("Helvetica")
        .text(`Full name: ${String(user?.full_name ?? "Not available")}`)
        .text(`Email: ${String(user?.email ?? "Not available")}`)
        .text(`User ID: ${String(waiver.user_id ?? "Not available")}`)
        .text(`Enrolment ID: ${String(waiver.enrollment_id ?? "Not available")}`)
        .text(`Date signed: ${waiver.signed_at instanceof Date ? waiver.signed_at.toISOString() : String(waiver.signed_at ?? "Not available")}`)
        .text(`Agreed to the waiver: ${waiver.agreed_to_terms === true ? "Yes" : "No"}`);
      document.moveDown(1);
      document.fontSize(10).fillColor("#555555").font("Helvetica-Bold").text("TERMS ACCEPTED");
      document.moveDown(0.4);

      const parsed = asJson(waiver.clauses_snapshot);
      const clauses = Array.isArray(parsed)
        ? parsed.filter((clause): clause is { number?: string; title?: string; text?: string } =>
            Boolean(clause && typeof clause === "object"))
        : [];
      if (clauses.length) {
        for (const clause of clauses) {
          const title = [clause.number, clause.title].filter(Boolean).join(". ");
          if (title) document.fontSize(9).font("Helvetica-Bold").fillColor("#1C1C1C").text(title);
          if (clause.text) document.fontSize(9).font("Helvetica").text(clause.text, { lineGap: 3 });
          document.moveDown(0.6);
        }
      } else {
        document.fontSize(9).fillColor("#1C1C1C").font("Helvetica")
          .text("The exact wording of the accepted waiver was not stored with this record. The signature and date below are retained; current terms have not been substituted.", { lineGap: 3 });
      }

      document.moveDown(1);
      document.fontSize(10).fillColor("#555555").font("Helvetica-Bold").text("ELECTRONIC SIGNATURE");
      document.moveDown(0.3);
      const boxY = document.y;
      document.rect(60, boxY, 300, 90).strokeColor("#CCCCCC").lineWidth(1).stroke();
      const signature = typeof waiver.signature_data === "string"
        ? waiver.signature_data.match(/^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/)
        : null;
      if (signature) {
        document.image(Buffer.from(signature[2], "base64"), 65, boxY + 5, { fit: [290, 80] });
      } else {
        document.fontSize(9).fillColor("#555555").font("Helvetica")
          .text(waiver.signature_data ? "[Signature stored in the Waivers spreadsheet]" : "[No signature image stored]", 70, boxY + 38);
      }
      document.text("", 60, boxY + 100);
      document.moveDown(0.5);
      document.fontSize(9).fillColor("#555555").font("Helvetica")
        .text(`Signed electronically on ${waiver.signed_at instanceof Date ? waiver.signed_at.toUTCString() : String(waiver.signed_at ?? "date unavailable")}`);
      document.end();
    } catch (error) {
      reject(error);
      document.destroy();
    }
  });
}

function extensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  return extensions[mimeType] ?? "bin";
}

function parseJsonArray<T>(value: unknown): T[] {
  const parsed = asJson(value);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

async function removeCreatedFiles(drive: BackupDrive, ids: string[]): Promise<void> {
  let failed = false;
  for (const id of [...ids].reverse()) {
    const response = await drive.proxy("google-drive", `/drive/v3/files/${id}`, { method: "DELETE" });
    if (!response.ok) failed = true;
  }
  if (failed) throw new Error("The readable backup failed and one or more temporary Drive files could not be removed.");
}

export async function createReadableBackup(
  drive: BackupDrive = new ReplitConnectors(),
  assertOwnership: () => void | Promise<void> = () => {},
  onProgress: (message: string) => Promise<void> = async () => {},
): Promise<ReadableBackupResult> {
  const rawDrive = drive;
  drive = {
    proxy: async (...args: Parameters<BackupDrive["proxy"]>) => {
      // Allow cleanup after lock loss, but never keep creating/uploading files.
      if (args[2]?.method !== "DELETE") await assertOwnership();
      return rawDrive.proxy(...args);
    },
  } as BackupDrive;
  const { pool } = await import("@workspace/db");
  const createdFileIds: string[] = [];
  const at = new Date().toISOString();
  const title = "Chainsaw Courses Full Data";
  const counts: ReadableBackupCounts = {
    tables: 0, records: 0, learners: 0, certificates: 0, inspections: 0, risks: 0,
    waivers: 0, assessmentMedia: 0, retailerLogos: 0,
  };

  try {
    const tables: TableSnapshot[] = [];
    await assertOwnership();
    const snapshot = await pool.connect();
    let snapshotFailed = false;
    const snapshotError = () => { snapshotFailed = true; };
    snapshot.on("error", snapshotError);
    let portableTables: Awaited<ReturnType<typeof capturePortableTables>>;
    try {
      await snapshot.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      for (const name of BACKUP_TABLES) {
        await assertOwnership();
        const result = await snapshot.query(`SELECT * FROM "${name}"`);
        const rows = result.rows as Record<string, unknown>[];
        tables.push({ name, columns: result.fields.map((field) => field.name), rows });
        counts.tables++;
        counts.records += rows.length;
        if (name === "users") counts.learners = rows.length;
        if (name === "waivers") counts.waivers = rows.length;
      }
      portableTables = await capturePortableTables(snapshot, BACKUP_TABLES);
      await snapshot.query("COMMIT");
    } catch (error) {
      snapshotFailed = true;
      await snapshot.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      snapshot.release(snapshotFailed);
      snapshot.removeListener("error", snapshotError);
    }
    const tableMap = new Map(tables.map((table) => [table.name, table]));
    const users = tableMap.get("users")?.rows ?? [];
    const usersById = new Map(users.map((user) => [Number(user.id), user]));
    const enrollments = tableMap.get("course_enrolments")?.rows ?? [];
    const inspectionRows = tableMap.get("inspection_records")?.rows ?? [];
    const riskRows = tableMap.get("risk_assessments")?.rows ?? [];
    const waiverRows = tableMap.get("waivers")?.rows ?? [];
    const issuedCertificateEnrollments = enrollments.filter((enrollment) =>
      Boolean(enrollment.certificate_issued_at) && enrollment.is_deleted !== true,
    );
    const legacyCertificateUsers = users.filter((user) =>
      Boolean(user.certificate_issued_at) && !enrollments.some((entry) => Number(entry.user_id) === Number(user.id)),
    );
    counts.certificates = issuedCertificateEnrollments.length + legacyCertificateUsers.length;

    const rootQuery = "name='Chainsaw Courses User Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const rootFolders = await driveJson<{ files?: Array<{ id: string }> }>(
      drive, "google-drive", `/drive/v3/files?q=${encodeURIComponent(rootQuery)}&fields=files(id)&pageSize=100`, { method: "GET" },
    );
    if (rootFolders.files?.length !== 1 || !rootFolders.files[0].id) {
      throw new Error("The existing Chainsaw Courses User Backup folder is missing or ambiguous.");
    }
    const backupRootId = rootFolders.files[0].id;
    const weeklyFolderId = await findOrCreateFolder(drive, "Weekly Backup", backupRootId);
    const categoryFolderIds = new Map<string, string>();
    for (const category of READABLE_CATEGORIES) {
      categoryFolderIds.set(category.key, await findOrCreateFolder(drive, category.folderName, backupRootId));
    }

    const overviewRows: SheetValue[][] = [
      ["Chainsaw Courses readable backup", "Details"],
      ["Created (UTC)", at],
      ["Backup policy", "Incremental: existing files are updated in place. These are current records, not separate historical snapshots."],
      ["Database tables", counts.tables],
      ["Database records", counts.records],
      ["Learners", counts.learners],
      ["Issued certificate PDFs", `${counts.certificates}; generated from issued certificate records, as originals are not stored separately.`],
      ["Signed waiver records", counts.waivers],
      ["Inspections", inspectionRows.length],
      ["Risk assessments", riskRows.length],
      ["Consistency", "Database tables share one repeatable-read snapshot. External documents/media are copied afterwards."],
      ["Sensitive data", "This workbook and its PDFs are unencrypted. Keep the Google Drive folder restricted to authorised staff."],
      ["Long values", "Fields over 40,000 characters are split across numbered columns; join the parts in order."],
      ["External storage", "Assessment media and retailer logos from App Storage are included in subfolders. Firebase-hosted course media is not included."],
    ];
    await onProgress("Writing full readable workbook");
    const fullWorkbook = await writeReadableSpreadsheet(
      drive, weeklyFolderId, title, overviewRows, tables, createdFileIds,
    );

    const categoryResults: ReadableBackupResult["categories"] = [];
    for (const category of READABLE_CATEGORIES) {
      await onProgress(`Writing ${category.label} spreadsheet`);
      const selectedTables = category.tables.map((name) => {
        const table = tableMap.get(name);
        if (!table) throw new Error(`The full readable workbook is missing the ${name} database table.`);
        return table;
      });
      const folderId = categoryFolderIds.get(category.key)!;
      const categoryTitle = `Chainsaw Courses ${category.label}`;
      const categoryRecords = selectedTables.reduce((sum, table) => sum + table.rows.length, 0);
      const categoryDocuments = category.key === "waivers" ? waiverRows.length
        : category.key === "user-certificates" ? counts.certificates
          : category.key === "inspections" ? inspectionRows.length
            : category.key === "risk-assessments" ? riskRows.length : 0;
      const workbook = await writeReadableSpreadsheet(
        drive,
        folderId,
        categoryTitle,
        [
          ["Category backup", "Details"],
          ["Created (UTC)", at],
          ["Category", category.label],
          ["Database tables", selectedTables.length],
          ["Database records", categoryRecords],
          ["Generated PDFs", categoryDocuments],
          ["Encryption", "None — these files are readable and contain personal data."],
        ],
        selectedTables,
        createdFileIds,
      );
      categoryResults.push({
        key: category.key, label: category.label, title: categoryTitle,
        url: workbook.url, folderId,
        counts: { tables: selectedTables.length, records: categoryRecords, documents: categoryDocuments },
      });
    }

    const fullDocumentFolders = new Map<string, string>();
    for (const name of ["Assessment Media", "Retailer Logos"]) {
      fullDocumentFolders.set(name, await findOrCreateFolder(drive, name, weeklyFolderId));
    }
    const documentFolders: ReadableBackupResult["documentFolders"] = [];
    const uploadDocumentCopies = async (
      name: string,
      mimeType: string,
      bytes: Buffer,
      categoryFolderId: string,
      _fullFolderName: string,
      source?: unknown,
      aliases: string[] = [],
    ) => {
      await onProgress(`Saving ${name}`);
      const sourceHash = source === undefined ? undefined : createHash("sha256").update(JSON.stringify(source)).digest("hex");
      await uploadPlainFile(drive, categoryFolderId, name, mimeType, bytes, createdFileIds, sourceHash, aliases);
    };

    const progressTables = tables.filter((table) => ["course_enrolments", "user_progress", "video_engagement", "quiz_attempts", "exam_attempts"].includes(table.name));
    for (const user of users) {
      const name = learnerBackupName(user.full_name, user.id);
      await uploadDocumentCopies(
        `${name} - Progress.csv`, "text/csv",
        progressCsv(String(user.full_name ?? "Unnamed learner"), progressTables, Number(user.id)),
        categoryFolderIds.get("progress")!, "Progress Backup",
      );
    }

    for (const enrollment of issuedCertificateEnrollments) {
      const user = usersById.get(Number(enrollment.user_id));
      if (!user) throw new Error(`Issued certificate enrolment ${String(enrollment.id)} has no learner record.`);
      const pdf = Buffer.from(await generateCertificatePdf(
        {
          id: Number(user.id),
          fullName: String(user.full_name ?? "Learner"),
          email: String(user.email ?? ""),
          enrollmentId: Number(enrollment.id),
        },
        enrollment.certificate_issued_at instanceof Date
          ? enrollment.certificate_issued_at
          : new Date(String(enrollment.certificate_issued_at)),
        null,
      ));
      await uploadDocumentCopies(
        `${learnerBackupName(user.full_name, user.id)} - Certificate - Enrolment ${String(enrollment.id)}.pdf`,
        "application/pdf",
        pdf,
        categoryFolderIds.get("user-certificates")!,
        "User Certificates",
        { userId: user.id, name: user.full_name, enrollment },
      );
    }
    for (const user of legacyCertificateUsers) {
      const pdf = Buffer.from(await generateCertificatePdf(
        { id: Number(user.id), fullName: String(user.full_name ?? "Learner"), email: String(user.email ?? "") },
        user.certificate_issued_at instanceof Date ? user.certificate_issued_at : new Date(String(user.certificate_issued_at)),
        null,
      ));
      await uploadDocumentCopies(
        `${learnerBackupName(user.full_name, user.id)} - Certificate - Legacy.pdf`,
        "application/pdf",
        pdf,
        categoryFolderIds.get("user-certificates")!,
        "User Certificates",
        { userId: user.id, name: user.full_name, issuedAt: user.certificate_issued_at },
      );
    }

    for (const row of waiverRows) {
      const user = usersById.get(Number(row.user_id));
      const pdf = await generateWaiverPdf(row, user);
      await uploadDocumentCopies(
        `${learnerBackupName(user?.full_name, row.user_id)} - Signed Waiver - Enrolment ${String(row.enrollment_id)}.pdf`,
        "application/pdf",
        pdf,
        categoryFolderIds.get("waivers")!,
        "Waivers",
        { row, name: user?.full_name },
        [`${learnerBackupName(user?.full_name, row.user_id)} - Signed Waiver ${String(row.id)}.pdf`],
      );
    }

    for (const row of inspectionRows) {
      const pdf = await generateInspectionPdf({
        id: Number(row.id),
        studentName: String(usersById.get(Number(row.user_id))?.full_name ?? "Unknown"),
        sawIdentifier: String(row.saw_identifier ?? ""),
        items: parseJsonArray<InspectionItem>(row.items),
        hasFailures: Boolean(row.has_failures),
        createdAt: row.created_at as Date,
        amendedAt: row.amended_at as Date | null,
      });
      await uploadDocumentCopies(
        `${learnerBackupName(usersById.get(Number(row.user_id))?.full_name, row.user_id)} - Inspection ${String(row.id)}.pdf`, "application/pdf", Buffer.from(pdf),
        categoryFolderIds.get("inspections")!, "Inspections",
        { row, name: usersById.get(Number(row.user_id))?.full_name },
      );
    }

    for (const row of riskRows) {
      const pdf = await generateRiskAssessmentPdf({
        ...row,
        id: Number(row.id),
        studentName: String(usersById.get(Number(row.user_id))?.full_name ?? "Unknown"),
        latitude: row.latitude == null ? null : String(row.latitude),
        longitude: row.longitude == null ? null : String(row.longitude),
        address: row.address == null ? null : String(row.address),
        taskDescription: String(row.task_description ?? ""),
        siteDescription: String(row.site_description ?? ""),
        gridReference: String(row.grid_reference ?? ""),
        what3Words: String(row.what3_words ?? ""),
        nearestHospital: String(row.nearest_hospital ?? ""),
        hospitalPhone: String(row.hospital_phone ?? ""),
        siteAccess: String(row.site_access ?? ""),
        meetingPoint: String(row.meeting_point ?? ""),
        firstAidKit: String(row.first_aid_kit ?? ""),
        nearestAed: String(row.nearest_aed ?? ""),
        nearestSignal: String(row.nearest_signal ?? ""),
        hazards: parseJsonArray<HazardEntry>(row.hazards),
        createdAt: row.created_at as Date,
        amendedAt: row.amended_at as Date | null,
      });
      await uploadDocumentCopies(
        `${learnerBackupName(usersById.get(Number(row.user_id))?.full_name, row.user_id)} - Risk Assessment ${String(row.id)}.pdf`, "application/pdf", Buffer.from(pdf),
        categoryFolderIds.get("risk-assessments")!, "Risk Assessments",
        { row, name: usersById.get(Number(row.user_id))?.full_name },
      );
    }
    counts.inspections = inspectionRows.length;
    counts.risks = riskRows.length;

    const waiverFolderId = categoryFolderIds.get("waivers")!;
    documentFolders.push({ key: "progress", label: "User Progress Files", folderId: categoryFolderIds.get("progress")!, count: users.length });
    documentFolders.push({ key: "certificates", label: "User Certificates", folderId: categoryFolderIds.get("user-certificates")!, count: counts.certificates });
    documentFolders.push({ key: "waivers", label: "Waivers", folderId: waiverFolderId, count: waiverRows.length });
    documentFolders.push({ key: "inspections", label: "Inspections", folderId: categoryFolderIds.get("inspections")!, count: inspectionRows.length });
    documentFolders.push({ key: "risk-assessments", label: "Risk Assessments", folderId: categoryFolderIds.get("risk-assessments")!, count: riskRows.length });

    const mediaFolderId = fullDocumentFolders.get("Assessment Media")!;
    await onProgress("Copying assessment media");
    const mediaObjects = await listAssessmentMediaObjects();
    for (const object of mediaObjects) {
      const file = await getAssessmentMediaObject(object.objectKey);
      if (!file) throw new Error(`An App Storage assessment file is missing: ${object.objectKey}`);
      const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
      const mimeType = metadata.contentType ?? "application/octet-stream";
      const objectId = object.objectKey.split("/").at(-1) ?? "unknown";
      const kind = object.objectKey.includes("/audio/") ? "audio" : "image";
      await uploadPlainFile(
        drive, mediaFolderId, `${kind}-${objectId}.${extensionForMimeType(mimeType)}`,
        mimeType, bytes, createdFileIds,
      );
    }
    counts.assessmentMedia = mediaObjects.length;

    const retailerRows = tableMap.get("chainsaw_retailers")?.rows ?? [];
    const logosFolderId = fullDocumentFolders.get("Retailer Logos")!;
    for (const retailer of retailerRows) {
      await onProgress(`Copying retailer logo ${counts.retailerLogos + 1}`);
      const objectKey = typeof retailer.logo_object_key === "string" ? retailer.logo_object_key : null;
      const retailerId = Number(retailer.id);
      const objectId = objectKey ? retailerLogoObjectIdFromKey(objectKey, retailerId) : null;
      if (!objectKey || !objectId) continue;
      const file = await getRetailerLogoObject(objectKey, retailerId);
      if (!file) throw new Error(`A retailer logo in App Storage is missing for retailer ${retailerId}.`);
      const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
      const mimeType = metadata.contentType ?? "application/octet-stream";
      await uploadPlainFile(
        drive, logosFolderId, `Retailer_${retailerId}_Logo.${extensionForMimeType(mimeType)}`,
        mimeType, bytes, createdFileIds,
      );
      counts.retailerLogos++;
    }
    documentFolders.push({ key: "assessment-media", label: "Assessment Media", folderId: mediaFolderId, count: counts.assessmentMedia });
    documentFolders.push({ key: "retailer-logos", label: "Retailer Logos", folderId: logosFolderId, count: counts.retailerLogos });

    await onProgress("Saving portable data export and import instructions");
    const portableFolderId = await findOrCreateFolder(drive, "Portable Export", backupRootId);
    const portableFiles = [
      { name: "data.json", bytes: Buffer.from(portableDataJson(portableTables, at)), mime: "application/json" },
      { name: "restore-postgresql.sql", bytes: Buffer.from(portableRestoreSql(portableTables)), mime: "text/plain" },
      { name: "README.txt", bytes: Buffer.from(PORTABLE_README), mime: "text/plain" },
    ];
    for (const file of portableFiles) {
      await uploadPlainFile(drive, portableFolderId, file.name, file.mime, file.bytes, createdFileIds);
    }
    // Publish the checksums last: importers must reject mixed/incomplete updates.
    await uploadPlainFile(drive, portableFolderId, "manifest.json", "application/json",
      portableManifest(portableFiles, at, portableTables.length), createdFileIds);
    documentFolders.push({ key: "portable", label: "Portable Export", folderId: portableFolderId, count: 4 });

    return {
      format: "readable",
      url: fullWorkbook.url,
      folderId: weeklyFolderId,
      rootFolderId: backupRootId,
      title,
      at,
      counts,
      categories: categoryResults,
      documentFolders,
      driveFileIds: createdFileIds,
    };
  } catch (error) {
    try {
      await removeCreatedFiles(drive, createdFileIds);
    } catch (cleanupError) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );
    }
    throw error;
  }
}
