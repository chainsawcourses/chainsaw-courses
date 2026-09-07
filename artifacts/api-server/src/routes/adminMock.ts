import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, mockQuestionsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

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

const AUDIO_UPLOAD_DIR = path.join(__dirname, "../../uploads/question-audio");
fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `q-img-${Date.now()}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Images only (jpeg/png/webp/gif)"));
  },
});

const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AUDIO_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp3";
      const name = `q-audio-${Date.now()}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (/^audio\//.test(file.mimetype) || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Audio files only (mp3/wav/ogg/m4a/aac)"));
  },
});

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
ensureTable().catch(err => logger.error({ err }, "Failed to ensure mock_questions table"));

function parseRow(row: typeof mockQuestionsTable.$inferSelect) {
  return {
    id: row.id,
    question: row.question,
    prompts: JSON.parse(row.prompts),
    image: row.image ?? undefined,
    audioUrl: row.audioUrl ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

// ── Admin: upload image ──────────────────────────────────────────────────────
router.post("/admin/mock-questions/upload-image", (req, res, next) => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0])) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}, upload.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file received" }); return; }
  const url = `/question-images/uploads/${req.file.filename}`;
  res.json({ url });
});

// ── Admin: upload audio ──────────────────────────────────────────────────────
router.post("/admin/mock-questions/upload-audio", (req, res, next) => {
  if (!verifyAdmin(req as Parameters<typeof verifyAdmin>[0])) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}, uploadAudio.single("audio"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file received" }); return; }
  const url = `/question-audio/uploads/${req.file.filename}`;
  res.json({ url });
});

// ── Admin: list all ──────────────────────────────────────────────────────────
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
    const [row] = await db.insert(mockQuestionsTable).values({
      question,
      prompts: JSON.stringify(prompts),
      image: image ?? null,
      audioUrl: audioUrl ?? null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    }).returning();
    res.json(parseRow(row));
  } catch (err) {
    logger.error({ err }, "Failed to create mock question");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: import defaults (bulk insert from frontend data) ──────────────────
router.post("/admin/mock-questions/import-defaults", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const { questions, replace } = req.body as { questions: Array<{ id: number; question: string; prompts: unknown; image?: string }>; replace?: boolean };
  if (!Array.isArray(questions) || questions.length === 0) { res.status(400).json({ error: "questions array required" }); return; }
  try {
    if (replace) {
      await db.delete(mockQuestionsTable);
    }
    const rows = questions.map((q, i) => ({
      question: q.question,
      prompts: JSON.stringify(q.prompts),
      image: q.image ?? null,
      sortOrder: i,
      isActive: true,
    }));
    await db.insert(mockQuestionsTable).values(rows);
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
    const [row] = await db.update(mockQuestionsTable).set({
      ...(question !== undefined && { question }),
      ...(prompts !== undefined && { prompts: JSON.stringify(prompts) }),
      ...(image !== undefined && { image: image ?? null }),
      ...(audioUrl !== undefined && { audioUrl: audioUrl ?? null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    }).where(eq(mockQuestionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(parseRow(row));
  } catch (err) {
    logger.error({ err }, "Failed to update mock question");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: delete ────────────────────────────────────────────────────────────
router.delete("/admin/mock-questions/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(mockQuestionsTable).where(eq(mockQuestionsTable.id, id));
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
  const user = await resolveUser(activationCode, deviceId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
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
