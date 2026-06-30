import { Router } from "express";
import mammoth from "mammoth";
import { logger } from "../lib/logger";

const router = Router();

let cached: { text: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60;

router.get("/how-to-use", async (req, res) => {
  const url = req.query["url"] as string | undefined;
  if (!url) {
    res.status(400).json({ error: "Missing ?url= parameter" });
    return;
  }

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json({ text: cached.text });
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: `Upstream fetch failed: ${response.status}` });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    cached = { text, fetchedAt: Date.now() };
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "Error fetching/parsing how-to-use doc");
    res.status(500).json({ error: "Failed to process document" });
  }
});

export default router;
