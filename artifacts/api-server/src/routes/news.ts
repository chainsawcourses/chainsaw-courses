import { Router } from "express";
import { db, newsItemsTable } from "@workspace/db";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { fetchAllFeeds } from "../lib/rssFetcher";
import { z } from "zod/v4";
import { sendPushToAll } from "./push";
import { eq, desc, and, isNull, notInArray } from "drizzle-orm";
import { tagNewsArticle, TagOutcome } from "../lib/newsTagging";

const router = Router();

const CreateNewsItemBody = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  url: z.string().url(),
  imageUrl: z.string().optional(),
  publishedAt: z.string(),
});

const UpdateNewsItemBody = z.object({
  title: z.string().min(1).optional(),
  excerpt: z.string().min(1).optional(),
  url: z.string().url().optional(),
  imageUrl: z.string().nullable().optional(),
  publishedAt: z.string().optional(),
});

// Student-facing: approved items only
router.get("/news", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.status, "approved"))
      .orderBy(desc(newsItemsTable.publishedAt));
    res.json(items);
  } catch (err) {
    logger.error({ err }, "Failed to list news items");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Admin: list pending items — must come before /admin/news/:id routes
router.get("/admin/news/pending", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const items = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.status, "pending"))
      .orderBy(desc(newsItemsTable.publishedAt));
    res.json(items);
  } catch (err) {
    logger.error({ err }, "Failed to list pending news items");
    res.status(500).json({ error: "Failed to fetch pending items" });
  }
});

// Admin: manually trigger RSS fetch + tag any untagged approved articles
router.post("/admin/news/fetch-now", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const result = await fetchAllFeeds();

    const untagged = await db
      .select({ id: newsItemsTable.id, title: newsItemsTable.title, excerpt: newsItemsTable.excerpt })
      .from(newsItemsTable)
      .where(and(eq(newsItemsTable.status, "approved"), isNull(newsItemsTable.learningOutcome)));

    let tagged = 0;
    let errors = 0;
    for (const article of untagged) {
      const outcome: TagOutcome = await tagNewsArticle(article.id, article.title, article.excerpt)
        .catch((): TagOutcome => "failed");
      if (outcome !== "failed") tagged++;
      else errors++;
    }

    res.json({ ...result, tagged, errors });
  } catch (err) {
    logger.error({ err }, "Failed to fetch news");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Admin: retag all approved articles that have no LO/AC assigned
router.post("/admin/news/retag-all", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const untagged = await db
      .select({ id: newsItemsTable.id, title: newsItemsTable.title, excerpt: newsItemsTable.excerpt })
      .from(newsItemsTable)
      .where(and(eq(newsItemsTable.status, "approved"), isNull(newsItemsTable.learningOutcome)));

    const total = untagged.length;
    let tagged = 0;
    let errors = 0;
    for (const article of untagged) {
      const outcome: TagOutcome = await tagNewsArticle(article.id, article.title, article.excerpt)
        .catch((): TagOutcome => "failed");
      if (outcome !== "failed") tagged++;
      else errors++;
    }

    res.json({ total, tagged, errors });
  } catch (err) {
    logger.error({ err }, "Failed to retag news items");
    res.status(500).json({ error: "Failed to retag news items" });
  }
});

// Admin: approve a pending item
router.post("/admin/news/:id/approve", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [item] = await db
      .update(newsItemsTable)
      .set({ status: "approved" })
      .where(eq(newsItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
    void tagNewsArticle(item.id, item.title, item.excerpt)
      .catch((err) => logger.warn({ err }, "LO/AC tagging failed after approve"));
  } catch (err) {
    logger.error({ err }, "Failed to approve news item");
    res.status(500).json({ error: "Failed to approve" });
  }
});

// Admin: reject (delete) a pending item
router.post("/admin/news/:id/reject", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [item] = await db
      .delete(newsItemsTable)
      .where(eq(newsItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to reject news item");
    res.status(500).json({ error: "Failed to reject" });
  }
});

// Admin: create a manual news item (auto-approved)
router.post("/admin/news", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parse = CreateNewsItemBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { title, excerpt, url, imageUrl, publishedAt } = parse.data;
  try {
    const [item] = await db
      .insert(newsItemsTable)
      .values({
        title,
        excerpt,
        url,
        imageUrl: imageUrl ?? null,
        publishedAt: new Date(publishedAt),
        status: "approved",
      })
      .returning();
    res.status(201).json(item);
    void tagNewsArticle(item.id, item.title, item.excerpt)
      .catch((err) => logger.warn({ err }, "LO/AC tagging failed after create"));
    void sendPushToAll({
      title: "🌳 Forestry & Arb News 🌳",
      body: item.title,
      url: item.url,
    }).catch((err) => logger.warn({ err }, "Push notification failed after create"));
  } catch (err) {
    logger.error({ err }, "Failed to create news item");
    res.status(500).json({ error: "Failed to create news item" });
  }
});

// Admin: update item fields
router.patch("/admin/news/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parse = UpdateNewsItemBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const updates: Record<string, unknown> = {};
  if (parse.data.title !== undefined) updates.title = parse.data.title;
  if (parse.data.excerpt !== undefined) updates.excerpt = parse.data.excerpt;
  if (parse.data.url !== undefined) updates.url = parse.data.url;
  if (parse.data.imageUrl !== undefined) updates.imageUrl = parse.data.imageUrl;
  if (parse.data.publishedAt !== undefined) updates.publishedAt = new Date(parse.data.publishedAt);
  try {
    const [item] = await db
      .update(newsItemsTable)
      .set(updates)
      .where(eq(newsItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    logger.error({ err }, "Failed to update news item");
    res.status(500).json({ error: "Failed to update news item" });
  }
});

// Admin: keep 20 most recent approved articles, delete the rest
router.delete("/admin/news/purge-old", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const keep = await db
      .select({ id: newsItemsTable.id })
      .from(newsItemsTable)
      .where(eq(newsItemsTable.status, "approved"))
      .orderBy(desc(newsItemsTable.publishedAt))
      .limit(20);

    const keepIds = keep.map(r => r.id);

    const deleted = keepIds.length === 0
      ? await db.delete(newsItemsTable).where(eq(newsItemsTable.status, "approved")).returning()
      : await db.delete(newsItemsTable)
          .where(and(eq(newsItemsTable.status, "approved"), notInArray(newsItemsTable.id, keepIds)))
          .returning();

    logger.info({ deleted: deleted.length, kept: keepIds.length }, "Purged old news articles");
    res.json({ deleted: deleted.length, kept: keepIds.length });
  } catch (err) {
    logger.error({ err }, "Failed to purge old news");
    res.status(500).json({ error: "Failed to purge old news" });
  }
});

// Admin: delete a specific item
router.delete("/admin/news/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [item] = await db
      .delete(newsItemsTable)
      .where(eq(newsItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete news item");
    res.status(500).json({ error: "Failed to delete news item" });
  }
});

export default router;
