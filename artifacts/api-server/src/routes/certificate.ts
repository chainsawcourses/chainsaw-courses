import { Router } from "express";
import { db } from "@workspace/db";
import { examAttemptsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { generateCertificatePdf } from "../lib/generateCertificate";
import { sendCertificateEmail } from "../lib/sendCertificateEmail";

const router = Router();

async function getCertData(activationCode: string, deviceId: string) {
  const user = await resolveUser(activationCode, deviceId);
  if (!user) return null;
  const passedAttempts = await db
    .select()
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, user.id), eq(examAttemptsTable.passed, true)))
    .orderBy(desc(examAttemptsTable.attemptedAt))
    .limit(1);
  const passedAt    = passedAttempts.length > 0 ? passedAttempts[0].attemptedAt : new Date();
  const passedScore = passedAttempts.length > 0 ? passedAttempts[0].score : null;
  return { user, passedAt, passedScore };
}

// GET /api/certificate/view — iframe-friendly: accepts creds as query params so the URL
// can be used directly as an <iframe src> (iOS Safari cannot render blob/data URIs in iframes)
router.get("/certificate/view", async (req, res) => {
  const activationCode = req.query["code"] as string;
  const deviceId       = req.query["device"] as string;
  if (!deviceId || !activationCode) { res.status(401).json({ error: "Missing credentials" }); return; }
  try {
    const data = await getCertData(activationCode, deviceId);
    if (!data) { res.status(401).json({ error: "Unauthorised" }); return; }
    const { user, passedAt, passedScore } = data;
    const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Certificate_${safeName}.pdf"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating certificate (view)");
    res.status(500).json({ error: "Could not generate certificate" });
  }
});

// GET /api/certificate — view inline (default) or download (?download=1)
router.get("/certificate", async (req, res) => {
  const deviceId       = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) { res.status(401).json({ error: "Missing credentials" }); return; }
  try {
    const data = await getCertData(activationCode, deviceId);
    if (!data) { res.status(401).json({ error: "Unauthorised" }); return; }
    const { user, passedAt, passedScore } = data;
    const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    const disposition = req.query["download"] === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="Certificate_${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating certificate");
    res.status(500).json({ error: "Could not generate certificate" });
  }
});

// POST /api/certificate/resend — re-emails the certificate PDF
router.post("/certificate/resend", async (req, res) => {
  const deviceId       = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) { res.status(401).json({ error: "Missing credentials" }); return; }
  try {
    const data = await getCertData(activationCode, deviceId);
    if (!data) { res.status(401).json({ error: "Unauthorised" }); return; }
    const { user, passedAt, passedScore } = data;
    await sendCertificateEmail(user, passedAt, passedScore ?? 0);
    logger.info({ userId: user.id }, "Certificate resent on request");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error resending certificate");
    res.status(500).json({ error: "Could not resend certificate" });
  }
});

// GET /api/admin/certificate/:userId — admin view of any student's certificate
// Accepts admintoken as header OR ?token= query param (for new-tab links)
router.get("/admin/certificate/:userId", async (req, res) => {
  const tokenFromQuery = req.query["token"] as string | undefined;
  const reqWithToken = tokenFromQuery
    ? { headers: { ...req.headers, admintoken: tokenFromQuery } }
    : req;
  if (!verifyAdmin(reqWithToken)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const [passedAttempt] = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.passed, true)))
      .orderBy(desc(examAttemptsTable.attemptedAt))
      .limit(1);
    const passedAt    = passedAttempt?.attemptedAt ?? new Date();
    const passedScore = passedAttempt?.score ?? null;
    const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Certificate_${safeName}.pdf"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err, userId }, "Error generating certificate for admin");
    res.status(500).json({ error: "Could not generate certificate" });
  }
});

export default router;
