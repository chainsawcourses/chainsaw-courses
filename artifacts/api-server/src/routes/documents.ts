import { Router } from "express";
import { logger } from "../lib/logger";
import {
  HAZARDS,
  HAZARDS_REFERENCE_INTRO,
  generateHazardsPdf,
} from "../lib/generateHazardsPdf";
import { GetHazardsReferenceResponse } from "@workspace/api-zod";

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

/**
 * GET /api/documents/hazards
 * Generates and serves the Hazards & Risks PDF reference sheet.
 * Only authenticated users can access it.
 */
router.get("/documents/hazards", async (_req, res) => {
  try {
    const pdfBytes = await generateHazardsPdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="Hazards and Risks Reference.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating hazards PDF");
    res.status(500).json({ error: "Failed to generate document" });
  }
});

/**
 * GET /api/documents/hazards/reference
 * Returns the same reference content in a mobile-safe, in-app format.
 */
router.get("/documents/hazards/reference", async (_req, res): Promise<void> => {
  try {
    res.json(
      GetHazardsReferenceResponse.parse({
        title: "Hazards & Risks",
        intro: HAZARDS_REFERENCE_INTRO,
        hazards: HAZARDS,
      }),
    );
  } catch (err) {
    logger.error({ err }, "Error serving hazards reference");
    res.status(500).json({ error: "Failed to load hazards reference" });
  }
});

export default router;
