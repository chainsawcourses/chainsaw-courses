import { createCipheriv, createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createWriteStream } from "node:fs";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { PassThrough } from "node:stream";
import { createGzip } from "node:zlib";
import { AppConnectors as ReplitConnectors } from "./appConnectors";
import type { InspectionItem } from "./generateInspectionPdf";
import type { HazardEntry } from "./generateRiskAssessmentPdf";

const scrypt = promisify(scryptCallback);
// Deliberately explicit: an absent table is an error, not an silently incomplete backup.
export const BACKUP_TABLES = [
  "activation_codes", "users", "course_enrolments", "waivers", "modules", "user_progress",
  "quiz_questions", "quiz_attempts", "mock_questions", "chat_messages", "hazard_reference",
  "video_engagement", "module_feedback", "exam_questions", "exam_attempts", "inspection_records",
  "risk_assessments", "push_subscriptions", "news_items", "app_feedback", "app_config",
  "backup_test_logs", "backup_exports", "iqa_records", "reasonable_adjustments",
  "video_transcripts", "assessment_venues", "assessment_passports", "assessment_enquiries",
  "learner_subscriptions", "subscription_billing_events", "subscription_delivery_attempts",
  "billing_support_notifications", "chainsaw_retailers", "chainsaw_retailer_verification_history",
  "chainsaw_retailer_featured_history", "chainsaw_retailer_reminder_attempt",
  "code_reset_requests", "assessment_media_reconciliation_health", "website_purchase_seats",
  "apple_purchases", "apple_purchase_intents", "apple_identity_challenges",
] as const;

export type BackupCounts = { tables: number; records: number; learners: number; certificates: number; inspections: number; risks: number };
export const BACKUP_CATEGORIES = [
  { key: "feedback", label: "Feedback", folderName: "Feedback", tables: ["module_feedback", "app_feedback"], documents: [] },
  { key: "inspections", label: "Inspections", folderName: "Inspections", tables: ["users", "inspection_records"], documents: ["documents/inspections/"] },
  { key: "risk-assessments", label: "Risk assessments", folderName: "Risk Assessments", tables: ["users", "risk_assessments"], documents: ["documents/risks/"] },
  { key: "user-certificates", label: "User certificates", folderName: "User Certificates", tables: ["users", "course_enrolments"], documents: ["documents/certificates/"] },
  { key: "progress", label: "User progress", folderName: "Progress Backup", tables: ["users", "course_enrolments", "user_progress", "video_engagement", "quiz_attempts", "exam_attempts"], documents: [] },
] as const;

export type BackupCategoryResult = {
  key: string;
  label: string;
  title: string;
  url: string;
  folderId: string;
  sha256: string;
  counts: BackupCounts;
};
export type BackupResult = {
  url: string;
  folderId: string;
  rootFolderId: string;
  title: string;
  at: string;
  counts: BackupCounts;
  sha256: string;
  categories: BackupCategoryResult[];
};

type Drive = Pick<ReplitConnectors, "proxy">;
async function driveJson<T>(drive: Drive, url: string, options: { method: string; headers?: Record<string, string>; body?: string | Buffer }): Promise<T> {
  const response = await drive.proxy("google-drive", url, options);
  if (!response.ok) throw new Error(`Drive request failed (${response.status})`);
  return await response.json() as T;
}

async function findOrCreateFolder(drive: Drive, folderName: string, createIfMissing: boolean, parentId?: string): Promise<string> {
  const escapedName = folderName.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const folders = await driveJson<{ files: { id: string }[] }>(
    drive, `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=100`, { method: "GET" },
  );
  if (folders.files?.length === 1 && folders.files[0].id) return folders.files[0].id;
  if (folders.files?.length > 1) throw new Error(`${folderName} folder is ambiguous; resolve duplicate Drive folders before backup`);
  if (!createIfMissing) throw new Error(`${folderName} folder not found`);

  const created = await driveJson<{ id: string }>(drive, "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!created.id) throw new Error(`Drive did not return an ID for ${folderName}`);
  return created.id;
}

export async function uploadVerifiedBackup(
  drive: Drive, bytes: Buffer, title: string, counts: BackupCounts, sha256: string,
  options: { folderName?: string; createFolder?: boolean; parentId?: string; category?: string; scope?: "full" | "category" } = {},
): Promise<{ url: string; folderId: string }> {
  const folderName = options.folderName ?? "Weekly Backup";
  const folderId = await findOrCreateFolder(drive, folderName, options.createFolder ?? true, options.parentId);
  let fileId: string | undefined;
  try {
    const created = await driveJson<{ id: string }>(drive, "/drive/v3/files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${title}.uploading`, parents: [folderId], mimeType: "application/octet-stream" }),
    });
    if (!created.id) throw new Error("Drive did not return a file ID");
    fileId = created.id;
    await driveJson(drive, `/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/octet-stream" }, body: bytes,
    });
    const remote = await driveJson<{ id: string; size: string; md5Checksum: string }>(
      drive, `/drive/v3/files/${fileId}?fields=id,size,md5Checksum`, { method: "GET" },
    );
    if (remote.id !== fileId || Number(remote.size) !== bytes.length ||
      remote.md5Checksum !== createHash("md5").update(bytes).digest("hex")) {
      throw new Error("Uploaded file checksum or size did not match");
    }
    await driveJson(drive, `/drive/v3/files/${fileId}?fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: title, description: JSON.stringify({
        format: "chainsaw-backup-v1", scope: options.scope ?? "full",
        ...(options.category ? { category: options.category } : {}),
        sha256, counts,
      }) }),
    });
    return { url: `https://drive.google.com/file/d/${fileId}/view`, folderId };
  } catch (error) {
    if (fileId) {
      const deleted = await drive.proxy("google-drive", `/drive/v3/files/${fileId}`, { method: "DELETE" });
      if (!deleted.ok) throw new Error("Backup failed and the incomplete Drive file could not be removed");
    }
    throw error;
  }
}

type ArchiveEntry = { path: string; data: unknown | Buffer };

/** Creates a separate authenticated, gzip-compressed archive from already captured entries. */
export async function encryptBackupEntries(passphrase: string, entries: ArchiveEntry[]): Promise<Buffer> {
  if (passphrase.length < 16) throw new Error("Backup encryption passphrase is not configured");
  const dir = await mkdtemp(path.join(tmpdir(), "chainsaw-category-backup-"));
  const file = path.join(dir, "archive.enc");
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await scrypt(passphrase, salt, 32) as Buffer;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  key.fill(0);
  const source = new PassThrough();
  const output = createWriteStream(file, { mode: 0o600 });
  const pipe = pipeline(source, createGzip(), cipher, output);
  void pipe.catch(() => {});
  const writeEntry = async (entryPath: string, data: unknown) => {
    const content = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
    const line = JSON.stringify({
      path: entryPath,
      sha256: createHash("sha256").update(content).digest("hex"),
      encoding: Buffer.isBuffer(data) ? "base64" : "json",
      data: Buffer.isBuffer(data) ? content.toString("base64") : data,
    }) + "\n";
    if (!source.write(line)) await once(source, "drain");
  };
  try {
    for (const entry of entries) await writeEntry(entry.path, entry.data);
    source.end();
    await pipe;
    const ciphertext = await readFile(file);
    return Buffer.concat([Buffer.from("CBK1"), salt, iv, ciphertext, cipher.getAuthTag()]);
  } finally {
    source.destroy();
    await pipe.catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}

async function deleteDriveFile(drive: Drive, url: string): Promise<void> {
  const id = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view$/)?.[1];
  if (!id) throw new Error("Backup cleanup could not identify a Drive file");
  const deleted = await drive.proxy("google-drive", `/drive/v3/files/${id}`, { method: "DELETE" });
  if (!deleted.ok) throw new Error("Backup failed and an uploaded Drive archive could not be removed");
}

function categoryEntries(
  category: typeof BACKUP_CATEGORIES[number],
  backup: { tables: Map<string, Record<string, unknown>[]>; documents: Map<string, Buffer> },
  at: string,
): { entries: ArchiveEntry[]; counts: BackupCounts } {
  const tables = category.tables.map((name) => {
    const rows = backup.tables.get(name);
    if (!rows) throw new Error(`Full archive is missing category table ${name}`);
    return { name, rows };
  });
  const documents = [...backup.documents.entries()].filter(([name]) =>
    category.documents.some((prefix) => name.startsWith(prefix)),
  );
  const counts: BackupCounts = {
    tables: tables.length,
    records: tables.reduce((sum, table) => sum + table.rows.length, 0),
    learners: tables.find((table) => table.name === "users")?.rows.length ?? 0,
    certificates: documents.filter(([name]) => name.startsWith("documents/certificates/")).length,
    inspections: documents.filter(([name]) => name.startsWith("documents/inspections/")).length,
    risks: documents.filter(([name]) => name.startsWith("documents/risks/")).length,
  };
  return {
    counts,
    entries: [
      { path: "manifest.json", data: {
        format: "chainsaw-backup-v1", scope: "category", category: category.key, at,
        tables: category.tables,
        limitations: "Category archive only; it is not a complete application backup. Use the full archive for full recovery.",
        restore: "Decrypt using the separately held passphrase and verify each entry SHA-256 before using category records.",
      } },
      ...tables.map(({ name, rows }) => ({ path: `data/${name}.json`, data: rows })),
      ...documents.map(([path, data]) => ({ path, data })),
    ],
  };
}

/** Gzip-compressed NDJSON, encrypted as CBK1 + salt(16) + iv(12) + ciphertext + GCM tag(16).
 * Each line contains a path, SHA-256 and either JSON rows or base64 PDF bytes.
 * The key is derived from the separately managed passphrase; no key is included in the file.
 */
export async function createFullBackup(
  passphrase: string,
  drive: Drive = new ReplitConnectors(),
): Promise<BackupResult> {
  if (passphrase.length < 16) throw new Error("Backup encryption passphrase is not configured");
  const { pool } = await import("@workspace/db");
  const { generateCertificatePdf } = await import("./generateCertificate");
  const { generateInspectionPdf } = await import("./generateInspectionPdf");
  const { generateRiskAssessmentPdf } = await import("./generateRiskAssessmentPdf");
  const dir = await mkdtemp(path.join(tmpdir(), "chainsaw-backup-"));
  const file = path.join(dir, "archive.enc");
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await scrypt(passphrase, salt, 32) as Buffer;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  key.fill(0);
  const source = new PassThrough();
  const output = createWriteStream(file, { mode: 0o600 });
  const pipe = pipeline(source, createGzip(), cipher, output);
  void pipe.catch(() => {});
  const uploaded: Array<{ url: string }> = [];
  const counts: BackupCounts = { tables: 0, records: 0, learners: 0, certificates: 0, inspections: 0, risks: 0 };
  const at = new Date().toISOString();
  const writeEntry = async (entryPath: string, data: unknown) => {
    const content = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
    const line = JSON.stringify({
      path: entryPath, sha256: createHash("sha256").update(content).digest("hex"),
      encoding: Buffer.isBuffer(data) ? "base64" : "json",
      data: Buffer.isBuffer(data) ? content.toString("base64") : data,
    }) + "\n";
    if (!source.write(line)) await once(source, "drain");
  };
  try {
    await writeEntry("manifest.json", {
      format: "chainsaw-backup-v1", scope: "full", at, tables: BACKUP_TABLES,
      limitations: "Separate database reads, not an atomic snapshot. Regenerated PDFs are not original issued files. Replit App Storage objects, Firebase-hosted course media, and other external storage are not inventoried or included.",
      restore: "Decrypt using the separately held passphrase, then gunzip and parse NDJSON. Verify each entry SHA-256. Import data tables preserving IDs and repair sequences before enabling writes.",
    });
    for (const table of BACKUP_TABLES) {
      const { rows } = await pool.query(`SELECT * FROM "${table}"`);
      await writeEntry(`data/${table}.json`, rows);
      counts.tables++;
      counts.records += rows.length;
      if (table === "users") counts.learners = rows.length;
    }
    const users = (await pool.query('SELECT id, full_name, email, certificate_issued_at FROM "users"')).rows as Array<{ id: number; full_name: string; email: string; certificate_issued_at: Date | null }>;
    const names = new Map(users.map(u => [u.id, u.full_name]));
    const enrolments = (await pool.query('SELECT id, user_id, certificate_issued_at FROM "course_enrolments" WHERE certificate_issued_at IS NOT NULL AND is_deleted=false')).rows as Array<{ id: number; user_id: number; certificate_issued_at: Date }>;
    for (const enrollment of enrolments) {
      const user = users.find(u => u.id === enrollment.user_id);
      if (!user) throw new Error("Certificate has no learner record");
      await writeEntry(`documents/certificates/enrolment-${enrollment.id}.pdf`, Buffer.from(await generateCertificatePdf(
        { id: user.id, fullName: user.full_name, email: user.email, enrollmentId: enrollment.id },
        enrollment.certificate_issued_at, null,
      )));
      counts.certificates++;
    }
    for (const user of users.filter(u => u.certificate_issued_at && !enrolments.some(e => e.user_id === u.id))) {
      await writeEntry(`documents/certificates/legacy-user-${user.id}.pdf`, Buffer.from(await generateCertificatePdf(
        { id: user.id, fullName: user.full_name, email: user.email }, user.certificate_issued_at!, null,
      )));
      counts.certificates++;
    }
    const inspections = (await pool.query('SELECT * FROM "inspection_records"')).rows;
    for (const row of inspections) {
      const pdf = await generateInspectionPdf({
        id: row.id, studentName: names.get(row.user_id) ?? "Unknown",
        sawIdentifier: row.saw_identifier, items: JSON.parse(row.items) as InspectionItem[],
        hasFailures: row.has_failures, createdAt: row.created_at, amendedAt: row.amended_at,
      });
      await writeEntry(`documents/inspections/${row.id}.pdf`, pdf);
      counts.inspections++;
    }
    const risks = (await pool.query('SELECT * FROM "risk_assessments"')).rows;
    for (const row of risks) {
      const pdf = await generateRiskAssessmentPdf({
        ...row, id: row.id, studentName: names.get(row.user_id) ?? "Unknown",
        taskDescription: row.task_description, siteDescription: row.site_description,
        gridReference: row.grid_reference, what3Words: row.what3_words,
        nearestHospital: row.nearest_hospital, hospitalPhone: row.hospital_phone,
        siteAccess: row.site_access, meetingPoint: row.meeting_point,
        firstAidKit: row.first_aid_kit, nearestAed: row.nearest_aed, nearestSignal: row.nearest_signal,
        hazards: JSON.parse(row.hazards) as HazardEntry[], createdAt: row.created_at, amendedAt: row.amended_at,
      });
      await writeEntry(`documents/risks/${row.id}.pdf`, pdf);
      counts.risks++;
    }
    source.end();
    await pipe;
    const ciphertext = await readFile(file);
    const bytes = Buffer.concat([Buffer.from("CBK1"), salt, iv, ciphertext, cipher.getAuthTag()]);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const title = `Chainsaw-Courses-${at.replace(/[:.]/g, "-")}.backup.enc`;
    const backupRootId = await findOrCreateFolder(drive, "Chainsaw Courses User Backup", false);
    const { url, folderId } = await uploadVerifiedBackup(drive, bytes, title, counts, sha256, {
      folderName: "Weekly Backup",
      createFolder: true,
      parentId: backupRootId,
    });
    uploaded.push({ url });

    const { decryptAndVerifyBackup } = await import("./verifyFullBackup");
    const verified = await decryptAndVerifyBackup(bytes, passphrase);
    const categories: BackupCategoryResult[] = [];
    for (const category of BACKUP_CATEGORIES) {
      const { entries, counts: categoryCounts } = categoryEntries(category, verified, at);
      const categoryBytes = await encryptBackupEntries(passphrase, entries);
      const categorySha256 = createHash("sha256").update(categoryBytes).digest("hex");
      const categoryTitle = `Chainsaw-Courses-${at.replace(/[:.]/g, "-")}-${category.key}.backup.enc`;
      const destination = await uploadVerifiedBackup(
        drive, categoryBytes, categoryTitle, categoryCounts, categorySha256,
        {
          folderName: category.folderName,
          createFolder: true,
          parentId: backupRootId,
          category: category.key,
          scope: "category",
        },
      );
      uploaded.push({ url: destination.url });
      categories.push({
        key: category.key, label: category.label, title: categoryTitle,
        url: destination.url, folderId: destination.folderId, sha256: categorySha256, counts: categoryCounts,
      });
    }
    return { url, folderId, rootFolderId: backupRootId, title, at, counts, sha256, categories };
  } catch (error) {
    let cleanupFailed = false;
    for (const backup of uploaded.reverse()) {
      try {
        await deleteDriveFile(drive, backup.url);
      } catch (cleanupError) {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed) throw new Error("Backup failed and one or more uploaded Drive archives could not be removed");
    throw error;
  } finally {
    source.destroy();
    await pipe.catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}