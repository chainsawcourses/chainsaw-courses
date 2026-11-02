import { Router } from "express";
import path from "path";
import fs from "fs";
import { db, mockQuestionsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { requireActiveCourseAccess, resolveUser } from "./auth";
import { hasActiveCourseAccess } from "../lib/courseAccess";
import { logger } from "../lib/logger";
import {
  createAssessmentMediaUpload,
  deleteAssessmentMediaObject,
  getAssessmentMediaObject,
  listAssessmentMediaObjects,
} from "../lib/assessmentMediaStorage";
import {
  assessmentMediaCleanupHealth,
  getAssessmentMediaReconciliationStatus,
  recordAssessmentMediaReconciliation,
} from "../lib/assessmentMediaReconciliation";

// Bundled default questions — auto-seeded on first startup when table is empty
// Try multiple candidate paths to support both dev (CWD=artifacts/api-server) and
// production (CWD=workspace root) environments.
type SeedQuestion = { id: number; question: string; prompts: unknown; image?: string };
let _seedQuestions: SeedQuestion[] | null = null;
function getSeedQuestions(): SeedQuestion[] {
  if (!_seedQuestions) {
    const candidates = [
      path.resolve("src/data/mockQuestionsSeed.json"),                         // dev: CWD = artifacts/api-server
      path.resolve("artifacts/api-server/src/data/mockQuestionsSeed.json"),    // prod: CWD = workspace root
      path.join(__dirname, "data/mockQuestionsSeed.json"),                     // dist copy (build output)
    ];
    for (const p of candidates) {
      try {
        _seedQuestions = JSON.parse(fs.readFileSync(p, "utf-8")) as SeedQuestion[];
        logger.info({ path: p, count: _seedQuestions.length }, "Loaded mock questions seed");
        break;
      } catch { /* try next */ }
    }
    if (!_seedQuestions) {
      logger.warn("mockQuestionsSeed.json not found in any candidate path — skipping auto-seed");
      _seedQuestions = [];
    }
  }
  return _seedQuestions;
}

const UPLOAD_DIR = path.join(__dirname, "../../uploads/question-images");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const BUNDLED_IMAGE_DIR = path.join(__dirname, "assets/question-images");

const AUDIO_UPLOAD_DIR = path.join(__dirname, "../../uploads/question-audio");
fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });

const router = Router();

function adminGuard(req: Parameters<typeof verifyAdmin>[0], res: { status: (n: number) => { json: (o: unknown) => void } }): boolean {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

// Ensure table exists and is seeded with default questions on first startup
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mock_questions (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      prompts TEXT NOT NULL,
      image TEXT,
      audio_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  // Add audio_url column to existing tables that predate this field
  await db.execute(sql`ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS audio_url TEXT`);

  // Auto-seed if the table is empty
  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM mock_questions`);
  const count = Number((countResult.rows?.[0] as { count?: number } | undefined)?.count ?? 0);
  if (count === 0) {
    const seeds = getSeedQuestions();
    if (seeds.length > 0) {
      const rows = seeds.map((q, i) => ({
        question: q.question,
        prompts: JSON.stringify(q.prompts),
        image: q.image ?? null,
        sortOrder: i,
        isActive: true,
      }));
      await db.insert(mockQuestionsTable).values(rows);
      logger.info({ count: rows.length }, "Auto-seeded mock_questions table with defaults");
    }
  }
}
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

async function reconcileOrphanedAssessmentMedia(): Promise<void> {
  await recordAssessmentMediaReconciliation(async () => {
    const [rows, objects] = await Promise.all([
      db.select({
        image: mockQuestionsTable.image,
        audioUrl: mockQuestionsTable.audioUrl,
      }).from(mockQuestionsTable),
      listAssessmentMediaObjects(),
    ]);
    const referenced = new Set(rows.flatMap(row => [row.image, row.audioUrl]).filter(Boolean));
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    let removed = 0;
    for (const object of objects) {
      if (object.createdAt.getTime() > cutoff) continue;
      const url = object.objectKey.startsWith("assessment-media/images/")
        ? `/api/assessment-images/objects/${object.objectKey}`
        : object.objectKey.startsWith("assessment-media/audio/")
          ? `/api/assessment-audio/objects/${object.objectKey}`
          : null;
      if (url && !referenced.has(url)) {
        await deleteAssessmentMediaObject(object.objectKey);
        removed += 1;
      }
    }
    return removed;
  });
}

let reconciliationInFlight: Promise<void> | null = null;
function scheduleAssessmentMediaReconciliation(): Promise<void> {
  if (reconciliationInFlight) return reconciliationInFlight;
  reconciliationInFlight = reconcileOrphanedAssessmentMedia()
    .finally(() => { reconciliationInFlight = null; });
  return reconciliationInFlight;
}

ensureTable()
  .then(() => scheduleAssessmentMediaReconciliation())
  .catch(err => logger.error({ err }, "Failed to ensure mock_questions table"));
setInterval(() => void scheduleAssessmentMediaReconciliation(), 6 * 60 * 60 * 1000).unref();

function parseRow(row: typeof mockQuestionsTable.$inferSelect) {
  return {
    id: row.id,
    question: row.question,
    prompts: JSON.parse(row.prompts),
    image: protectImageUrl(row.image),
    audioUrl: protectAudioUrl(row.audioUrl),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function protectImageUrl(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  if (image.startsWith("/question-images/uploads/")) {
    image = image.replace("/question-images/uploads/", "/api/assessment-images/uploads/");
  }
  else if (image.startsWith("/question-images/")) {
    image = image.replace("/question-images/", "/api/assessment-images/bundled/");
  }
  return /^\/api\/assessment-images\/(?:(?:bundled|uploads)\/[a-zA-Z0-9._-]+|objects\/assessment-media\/images\/[a-f0-9-]+)$/.test(image)
    ? image
    : undefined;
}

function protectAudioUrl(audio: string | null | undefined): string | undefined {
  if (!audio) return undefined;
  if (audio.startsWith("/question-audio/uploads/")) {
    audio = audio.replace("/question-audio/uploads/", "/api/assessment-audio/uploads/");
  }
  return /^\/api\/assessment-audio\/(?:uploads\/[a-zA-Z0-9._-]+|objects\/assessment-media\/audio\/[a-f0-9-]+)$/.test(audio)
    ? audio
    : undefined;
}

function objectKeyFromMediaUrl(url: unknown): { kind: "image" | "audio"; objectKey: string } | null {
  if (typeof url !== "string") return null;
  const match = url.match(/^\/api\/assessment-(images|audio)\/objects\/(assessment-media\/(images|audio)\/[a-f0-9-]+)$/);
  if (!match || (match[1] === "images") !== (match[3] === "images")) return null;
  return { kind: match[1] === "images" ? "image" : "audio", objectKey: match[2] };
}

async function validateMediaAttachment(
  url: unknown,
  kind: "image" | "audio",
): Promise<string | null> {
  if (url == null || url === "") return null;
  const normalized = kind === "image"
    ? protectImageUrl(String(url))
    : protectAudioUrl(String(url));
  if (!normalized) throw new Error("Assessment media URL does not match its field");
  const media = objectKeyFromMediaUrl(normalized);
  if (!media) return normalized;
  if (media.kind !== kind) throw new Error("Assessment media kind does not match its field");
  const file = await getAssessmentMediaObject(media.objectKey);
  if (!file) throw new Error("Assessment media object does not exist");
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  const contentType = String(metadata.contentType ?? "");
  const valid = kind === "image"
    ? size > 0 && size <= 5 * 1024 * 1024 && /^image\/(jpeg|png|webp|gif)$/.test(contentType)
    : size > 0 && size <= 20 * 1024 * 1024 && (/^audio\//.test(contentType) || contentType === "application/ogg");
  if (!valid) throw new Error("Assessment media object has an invalid type or size");
  return normalized;
}

async function deleteMediaIfUnreferenced(url: string | null | undefined): Promise<void> {
  const media = objectKeyFromMediaUrl(url);
  if (!media || !url) return;
  try {
    const referenced = await db.select({ id: mockQuestionsTable.id }).from(mockQuestionsTable)
      .where(sql`${mockQuestionsTable.image} = ${url} OR ${mockQuestionsTable.audioUrl} = ${url}`)
      .limit(1);
    if (referenced.length === 0) await deleteAssessmentMediaObject(media.objectKey);
  } catch (err) {
    logger.warn({ err, objectKey: media.objectKey }, "Assessment media cleanup deferred");
  }
}

// ── Admin: upload image ──────────────────────────────────────────────────────
router.post("/admin/mock-questions/request-media-upload", async (req, res): Promise<void> => {
  if (!adminGuard(req, res)) return;
  const { kind, size, contentType } = req.body as { kind?: unknown; size?: unknown; contentType?: unknown };
  const validImage = kind === "image" && typeof size === "number" && size > 0 && size <= 5 * 1024 * 1024 &&
    typeof contentType === "string" && /^image\/(jpeg|png|webp|gif)$/.test(contentType);
  const validAudio = kind === "audio" && typeof size === "number" && size > 0 && size <= 20 * 1024 * 1024 &&
    typeof contentType === "string" && (/^audio\//.test(contentType) || contentType === "application/ogg");
  if (!validImage && !validAudio) {
    res.status(400).json({ error: "Unsupported media type or file size" });
    return;
  }
  try {
    const storageKind = kind === "image" ? "images" : "audio";
    const { uploadURL, objectKey } = await createAssessmentMediaUpload(storageKind);
    const url = kind === "image"
      ? `/api/assessment-images/objects/${objectKey}`
      : `/api/assessment-audio/objects/${objectKey}`;
    res.json({ uploadURL, url });
  } catch (err) {
    req.log.error({ err, kind }, "Failed to create assessment media upload");
    res.status(503).json({ error: "Media storage is unavailable" });
  }
});

router.post("/admin/mock-questions/finalize-media-upload", async (req, res): Promise<void> => {
  if (!adminGuard(req, res)) return;
  const media = objectKeyFromMediaUrl(req.body?.url);
  if (!media) { res.status(400).json({ error: "Invalid assessment media URL" }); return; }
  try {
    const file = await getAssessmentMediaObject(media.objectKey);
    if (!file) { res.status(404).json({ error: "Uploaded media not found" }); return; }
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    const contentType = String(metadata.contentType ?? "");
    const valid = media.kind === "image"
      ? size > 0 && size <= 5 * 1024 * 1024 && /^image\/(jpeg|png|webp|gif)$/.test(contentType)
      : size > 0 && size <= 20 * 1024 * 1024 && (/^audio\//.test(contentType) || contentType === "application/ogg");
    if (!valid) {
      await deleteAssessmentMediaObject(media.objectKey);
      res.status(400).json({ error: "Uploaded media does not match the permitted type or size" });
      return;
    }
    res.json({ url: req.body.url });
  } catch (err) {
    req.log.error({ err }, "Failed to finalize assessment media upload");
    res.status(503).json({ error: "Media storage is unavailable" });
  }
});

router.delete("/admin/mock-questions/media", async (req, res): Promise<void> => {
  if (!adminGuard(req, res)) return;
  const media = objectKeyFromMediaUrl(req.body?.url);
  if (!media) { res.status(400).json({ error: "Invalid assessment media URL" }); return; }
  try {
    await deleteMediaIfUnreferenced(req.body.url);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete unreferenced assessment media");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Protected assessment images ──────────────────────────────────────────────
router.get("/assessment-images/:source/:filename", async (req, res) => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0]) && !(await requireActiveCourseAccess(req, res))) {
    return;
  }

  const sourceDir = req.params.source === "bundled"
    ? BUNDLED_IMAGE_DIR
    : req.params.source === "uploads"
      ? UPLOAD_DIR
      : null;
  const filename = path.basename(req.params.filename);
  if (!sourceDir || filename !== req.params.filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const imagePath = path.join(sourceDir, filename);
  if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(imagePath);
});

router.get("/assessment-images/objects/assessment-media/images/:objectId", async (req, res): Promise<void> => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0]) && !(await requireActiveCourseAccess(req, res))) return;
  const objectId = Array.isArray(req.params.objectId) ? req.params.objectId[0] : req.params.objectId;
  const file = await getAssessmentMediaObject(`assessment-media/images/${objectId}`);
  if (!file) { res.status(404).json({ error: "Not found" }); return; }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  file.createReadStream().on("error", (err) => {
    req.log.error({ err }, "Failed to stream assessment image");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  }).pipe(res);
});

router.get("/assessment-audio/:source/:filename", async (req, res): Promise<void> => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0]) && !(await requireActiveCourseAccess(req, res))) return;
  const source = Array.isArray(req.params.source) ? req.params.source[0] : req.params.source;
  const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  if (source !== "uploads" || path.basename(filename) !== filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    res.status(404).json({ error: "Not found" }); return;
  }
  const audioPath = path.join(AUDIO_UPLOAD_DIR, filename);
  if (!fs.existsSync(audioPath) || !fs.statSync(audioPath).isFile()) {
    res.status(404).json({ error: "Not found" }); return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(audioPath);
});

router.get("/assessment-audio/objects/assessment-media/audio/:objectId", async (req, res): Promise<void> => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0]) && !(await requireActiveCourseAccess(req, res))) return;
  const objectId = Array.isArray(req.params.objectId) ? req.params.objectId[0] : req.params.objectId;
  const file = await getAssessmentMediaObject(`assessment-media/audio/${objectId}`);
  if (!file) { res.status(404).json({ error: "Not found" }); return; }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  file.createReadStream().on("error", (err) => {
    req.log.error({ err }, "Failed to stream assessment audio");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  }).pipe(res);
});

// ── Admin: list all ──────────────────────────────────────────────────────────
router.get("/admin/assessment-media-cleanup-health", async (req, res): Promise<void> => {
  if (!adminGuard(req, res)) return;
  try {
    const status = await getAssessmentMediaReconciliationStatus();
    res.json(assessmentMediaCleanupHealth(status));
  } catch (err) {
    logger.error({ err }, "Failed to read assessment media cleanup health");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/mock-questions", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const rows = await db.select().from(mockQuestionsTable).orderBy(asc(mockQuestionsTable.sortOrder), asc(mockQuestionsTable.id));
    res.json({ questions: rows.map(parseRow) });
  } catch (err) {
    logger.error({ err }, "Failed to list mock questions");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: create ────────────────────────────────────────────────────────────
router.post("/admin/mock-questions", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const { question, prompts, image, audioUrl, sortOrder, isActive } = req.body;
  if (!question || !prompts) { res.status(400).json({ error: "question and prompts required" }); return; }
  try {
    const [validatedImage, validatedAudio] = await Promise.all([
      validateMediaAttachment(image, "image"),
      validateMediaAttachment(audioUrl, "audio"),
    ]);
    const [row] = await db.insert(mockQuestionsTable).values({
      question,
      prompts: JSON.stringify(prompts),
      image: validatedImage,
      audioUrl: validatedAudio,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    }).returning();
    res.json(parseRow(row));
  } catch (err) {
    req.log.warn({ err }, "Failed to create mock question");
    res.status(400).json({ error: "Question or attached media is invalid" });
  }
});

// ── Admin: import defaults (bulk insert from frontend data) ──────────────────
router.post("/admin/mock-questions/import-defaults", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const { questions, replace } = req.body as { questions: Array<{ id: number; question: string; prompts: unknown; image?: string }>; replace?: boolean };
  if (!Array.isArray(questions) || questions.length === 0) { res.status(400).json({ error: "questions array required" }); return; }
  try {
    let replacedMedia: Array<{ image: string | null; audioUrl: string | null }> = [];
    const rows = await Promise.all(questions.map(async (q, i) => ({
      question: q.question,
      prompts: JSON.stringify(q.prompts),
      image: await validateMediaAttachment(q.image, "image"),
      sortOrder: i,
      isActive: true,
    })));
    if (replace) {
      await db.transaction(async (tx) => {
        replacedMedia = await tx.select({
          image: mockQuestionsTable.image,
          audioUrl: mockQuestionsTable.audioUrl,
        }).from(mockQuestionsTable);
        await tx.delete(mockQuestionsTable);
        await tx.insert(mockQuestionsTable).values(rows);
      });
      await Promise.all(replacedMedia.flatMap(row => [
        deleteMediaIfUnreferenced(row.image),
        deleteMediaIfUnreferenced(row.audioUrl),
      ]));
    } else {
      await db.insert(mockQuestionsTable).values(rows);
    }
    res.json({ count: rows.length });
  } catch (err) {
    logger.error({ err }, "Failed to import default mock questions");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: update ────────────────────────────────────────────────────────────
router.put("/admin/mock-questions/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { question, prompts, image, audioUrl, sortOrder, isActive } = req.body;
  try {
    const [validatedImage, validatedAudio] = await Promise.all([
      image !== undefined ? validateMediaAttachment(image, "image") : Promise.resolve(undefined),
      audioUrl !== undefined ? validateMediaAttachment(audioUrl, "audio") : Promise.resolve(undefined),
    ]);
    const [previous] = await db.select().from(mockQuestionsTable).where(eq(mockQuestionsTable.id, id));
    const [row] = await db.update(mockQuestionsTable).set({
      ...(question !== undefined && { question }),
      ...(prompts !== undefined && { prompts: JSON.stringify(prompts) }),
      ...(image !== undefined && { image: validatedImage ?? null }),
      ...(audioUrl !== undefined && { audioUrl: validatedAudio ?? null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    }).where(eq(mockQuestionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (previous?.image !== row.image) await deleteMediaIfUnreferenced(previous?.image);
    if (previous?.audioUrl !== row.audioUrl) await deleteMediaIfUnreferenced(previous?.audioUrl);
    res.json(parseRow(row));
  } catch (err) {
    req.log.warn({ err }, "Failed to update mock question");
    res.status(400).json({ error: "Question or attached media is invalid" });
  }
});

// ── Admin: delete ────────────────────────────────────────────────────────────
router.delete("/admin/mock-questions/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [deleted] = await db.delete(mockQuestionsTable).where(eq(mockQuestionsTable.id, id)).returning();
    if (deleted) {
      await deleteMediaIfUnreferenced(deleted.image);
      await deleteMediaIfUnreferenced(deleted.audioUrl);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete mock question");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Student: read active questions ───────────────────────────────────────────
router.get("/mock-questions", async (req, res) => {
  const deviceId       = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!hasActiveCourseAccess(user)) {
    res.status(403).json({ error: "access_expired", message: "Course access has ended." });
    return;
  }
  try {
    const rows = await db.select().from(mockQuestionsTable)
      .where(eq(mockQuestionsTable.isActive, true))
      .orderBy(asc(mockQuestionsTable.sortOrder), asc(mockQuestionsTable.id));
    if (rows.length === 0) { res.json({ questions: [] }); return; }
    res.json({ questions: rows.map(parseRow) });
  } catch (err) {
    logger.error({ err }, "Failed to fetch mock questions");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
