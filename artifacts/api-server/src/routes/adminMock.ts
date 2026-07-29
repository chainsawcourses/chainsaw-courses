import { Router } from "express";
import { db, mockQuestionsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function adminGuard(req: Parameters<typeof verifyAdmin>[0], res: { status: (n: number) => { json: (o: unknown) => void } }): boolean {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

// Ensure table exists (CREATE TABLE IF NOT EXISTS for safety on fresh deploys)
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mock_questions (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      prompts TEXT NOT NULL,
      image TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
}
ensureTable().catch(err => logger.error({ err }, "Failed to ensure mock_questions table"));

function parseRow(row: typeof mockQuestionsTable.$inferSelect) {
  return {
    id: row.id,
    question: row.question,
    prompts: JSON.parse(row.prompts),
    image: row.image ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

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
  const { question, prompts, image, sortOrder, isActive } = req.body;
  if (!question || !prompts) { res.status(400).json({ error: "question and prompts required" }); return; }
  try {
    const [row] = await db.insert(mockQuestionsTable).values({
      question,
      prompts: JSON.stringify(prompts),
      image: image ?? null,
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
  const { question, prompts, image, sortOrder, isActive } = req.body;
  try {
    const [row] = await db.update(mockQuestionsTable).set({
      ...(question !== undefined && { question }),
      ...(prompts !== undefined && { prompts: JSON.stringify(prompts) }),
      ...(image !== undefined && { image: image ?? null }),
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
