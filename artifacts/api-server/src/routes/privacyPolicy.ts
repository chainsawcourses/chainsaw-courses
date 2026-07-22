import { Router } from "express";
import { logger } from "../lib/logger";
import { generatePrivacyPolicyPdf } from "../lib/generatePrivacyPolicyPdf";

const router = Router();

router.get("/privacy-policy-pdf", async (_req, res) => {
  try {
    const pdfBytes = await generatePrivacyPolicyPdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Chainsaw-Courses-Privacy-Policy.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating privacy policy PDF");
    res.status(500).json({ error: "Could not generate PDF" });
  }
});

export default router;
