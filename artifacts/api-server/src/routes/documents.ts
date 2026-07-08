import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const LEGISLATION_PDF_URL =
  "https://firebasestorage.googleapis.com/v0/b/chainsaw-courses.firebasestorage.app/o/Important%20Acts%20and%20Legislation%20Guide.pdf?alt=media&token=3c01c2a9-23ff-425d-a074-e7b979d1e14a";

/**
 * GET /api/documents/legislation
 * Proxies the legislation guide PDF from Firebase Storage so the real URL
 * is never exposed to the client. Only authenticated users can access it.
 */
router.get("/documents/legislation", async (req, res) => {
  try {
    const response = await fetch(LEGISLATION_PDF_URL);
    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch document" });
      return;
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", 'inline; filename="Important Acts and Legislation Guide.pdf"');

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    logger.error({ err }, "Error fetching legislation PDF");
    res.status(500).json({ error: "Failed to serve document" });
  }
});

export default router;
