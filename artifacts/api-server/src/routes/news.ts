import { Router } from "express";
import { db, newsItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

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

router.get("/news", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(newsItemsTable)
      .orderBy(desc(newsItemsTable.publishedAt));
    res.json(items);
  } catch (err) {
    logger.error({ err }, "Failed to list news items");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.post("/admin/news", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parse = CreateNewsItemBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { title, excerpt, url, imageUrl, publishedAt } = parse.data;
  try {
    const [item] = await db
      .insert(newsItemsTable)
      .values({ title, excerpt, url, imageUrl: imageUrl ?? null, publishedAt: new Date(publishedAt) })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    logger.error({ err }, "Failed to create news item");
    res.status(500).json({ error: "Failed to create news item" });
  }
});

router.patch("/admin/news/:id", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parse = UpdateNewsItemBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
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
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    logger.error({ err }, "Failed to update news item");
    res.status(500).json({ error: "Failed to update news item" });
  }
});

router.delete("/admin/news/:id", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [item] = await db
      .delete(newsItemsTable)
      .where(eq(newsItemsTable.id, id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete news item");
    res.status(500).json({ error: "Failed to delete news item" });
  }
});

export default router;
