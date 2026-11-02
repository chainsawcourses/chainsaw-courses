import { Router, type Request, type Response } from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger";
import {
  HAZARDS,
  HAZARDS_REFERENCE_INTRO,
  generateHazardsPdf,
} from "../lib/generateHazardsPdf";
import { GetHazardsReferenceResponse } from "@workspace/api-zod";
import { requireActiveCourseAccess } from "./auth";

const router = Router();

const MANUAL_DIR = fileURLToPath(new URL("./data/manual-pages/", import.meta.url));
const MANUAL_PAGE_PATTERN = /^page-\d{3}\.jpg$/;

function setProtectedDocumentHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vary", "activationcode, deviceid, userid");
}

async function serveManualFile(
  req: Request,
  res: Response,
  filename: string,
  contentType: string,
): Promise<void> {
  if (!await requireActiveCourseAccess(req, res)) return;
  try {
    const bytes = await readFile(path.join(MANUAL_DIR, filename));
    setProtectedDocumentHeaders(res);
    res.type(contentType).send(bytes);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      res.status(404).json({ error: "Manual file not found" });
      return;
    }
    logger.error({ err, filename }, "Error serving protected manual file");
    res.status(500).json({ error: "Failed to serve manual file" });
  }
}

const LEGISLATION_PDF_URL =
  "https://firebasestorage.googleapis.com/v0/b/chainsaw-courses.firebasestorage.app/o/Important%20Acts%20and%20Legislation%20Guide.pdf?alt=media&token=3c01c2a9-23ff-425d-a074-e7b979d1e14a";

router.get("/documents/manual/manifest", (req, res) =>
  serveManualFile(req, res, "manifest.json", "application/json"));

router.get("/documents/manual/search-index", (req, res) =>
  serveManualFile(req, res, "search-index.json", "application/json"));

router.get("/documents/manual/pages/:filename", async (req, res) => {
  const filename = req.params.filename;
  if (!MANUAL_PAGE_PATTERN.test(filename)) {
    res.status(404).json({ error: "Manual page not found" });
    return;
  }
  await serveManualFile(req, res, filename, "image/jpeg");
});

/**
 * GET /api/documents/legislation
 * Proxies the legislation guide PDF from Firebase Storage so the real URL
 * is never exposed to the client. Only authenticated users can access it.
 */
router.get("/documents/legislation", async (req, res) => {
  if (!await requireActiveCourseAccess(req, res)) return;
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
router.get("/documents/hazards", async (req, res) => {
  if (!await requireActiveCourseAccess(req, res)) return;
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
router.get("/documents/hazards/reference", async (req, res): Promise<void> => {
  if (!await requireActiveCourseAccess(req, res)) return;
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
