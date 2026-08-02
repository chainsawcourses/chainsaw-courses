/**
 * Shared helpers for uploading certificate PDFs to Google Drive.
 * Target folder: Chainsaw Courses User Backup / User Certificates
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { generateCertificatePdf, CertUser } from "./generateCertificate";
import { logger } from "./logger";

export const BACKUP_FOLDER = "Chainsaw Courses User Backup";
const CERTS_FOLDER  = "User Certificates";

/** Find or create a Drive folder by name, optionally scoped to a parent. */
export async function getOrCreateDriveFolder(
  connectors: ReplitConnectors,
  name: string,
  parentId?: string,
): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const searchRes = await connectors.proxy(
    "google-drive",
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { method: "GET" },
  );
  const searchData = await searchRes.json() as { files: Array<{ id: string }> };
  if (searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await connectors.proxy("google-drive", "/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const created = await createRes.json() as { id: string };
  logger.info({ name, parentId, id: created.id }, "Created Drive folder");
  return created.id;
}

/** Resolves (and creates if needed) the 'User Certificates' subfolder. */
export async function getCertsFolderId(): Promise<{ connectors: ReplitConnectors; folderId: string }> {
  const connectors = new ReplitConnectors();
  const backupId = await getOrCreateDriveFolder(connectors, BACKUP_FOLDER);
  const folderId = await getOrCreateDriveFolder(connectors, CERTS_FOLDER, backupId);
  return { connectors, folderId };
}

/** Upload a PDF buffer to Drive via multipart upload. Returns a view URL. */
export async function uploadPdfToDrive(
  connectors: ReplitConnectors,
  pdfBytes: Uint8Array,
  fileName: string,
  folderId: string,
): Promise<string> {
  const boundary = `----ChainCerts${Date.now()}`;
  const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: "application/pdf" });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`, "utf-8"),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, "utf-8"),
    Buffer.from(pdfBytes),
    Buffer.from(`\r\n--${boundary}--`, "utf-8"),
  ]);
  const res = await connectors.proxy(
    "google-drive",
    "/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const file = await res.json() as { id: string };
  return `https://drive.google.com/file/d/${file.id}/view`;
}

/**
 * Full flow: generate a certificate PDF for a user and save it to Drive.
 * Returns the Drive view URL.
 */
export async function saveCertificateToDrive(
  user: CertUser,
  passedAt: Date,
  passedScore: number | null,
): Promise<string> {
  const { connectors, folderId } = await getCertsFolderId();
  const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
  const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
  const fileName = `Certificate_${safeName}.pdf`;
  const url = await uploadPdfToDrive(connectors, pdfBytes, fileName, folderId);
  logger.info({ userId: user.id, fileName, url }, "Certificate saved to Drive");
  return url;
}
