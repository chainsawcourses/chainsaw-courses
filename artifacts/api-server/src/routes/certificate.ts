import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { examAttemptsTable, usersTable, courseEnrolmentsTable } from "@workspace/db";
import { eq, and, asc, isNotNull, isNull } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import { certRef, generateCertificatePdf } from "../lib/generateCertificate";
import { sendCertificateEmail } from "../lib/sendCertificateEmail";
import { saveCertificateToDrive, getCertsFolderId, uploadPdfToDrive } from "../lib/driveCertificates";
import { issueCertificateToken, verifyCertificateToken } from "../lib/certificateToken";
import { generateSampleCertificatePdf } from "../lib/sampleCertificate";

const router = Router();

// Reviewer-only demonstration. Never create a passed attempt, award date, or
// certificate reference for this path.
async function getReviewerSample(req: Request) {
  const code = req.headers["activationcode"];
  const deviceId = req.headers["deviceid"];
  const userId = Number(req.headers["userid"]);
  if (typeof code !== "string" || code.trim().toUpperCase() !== "APPTEST26" ||
      typeof deviceId !== "string" || !deviceId || !Number.isSafeInteger(userId) || userId <= 0) return null;
  const user = await resolveUser(code, deviceId, userId);
  return user?.id === userId && user.activationCode === "APPTEST26" && user.enrollment ? user : null;
}

router.get("/certificate/sample/details", async (req, res) => {
  try {
    const user = await getReviewerSample(req);
    if (!user) { res.status(401).json({ error: "Unauthorised" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      fullName: user.fullName,
      email: user.email,
      passedAt: "",
      passedScore: null,
      certificateReference: "SAMPLE - NOT VALID",
    });
  } catch (err) {
    logger.error({ err }, "Error loading reviewer sample certificate");
    res.status(500).json({ error: "Could not load sample certificate" });
  }
});

router.get("/certificate/sample", async (req, res) => {
  try {
    const user = await getReviewerSample(req);
    if (!user) { res.status(401).json({ error: "Unauthorised" }); return; }
    const pdfBytes = await generateSampleCertificatePdf(user.fullName, user.email);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", 'attachment; filename="Chainsaw_Sample_Certificate_NOT_VALID.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating reviewer sample certificate");
    res.status(500).json({ error: "Could not generate sample certificate" });
  }
});

router.post("/certificate/sample/email", async (req, res) => {
  try {
    const user = await getReviewerSample(req);
    if (!user) { res.status(401).json({ error: "Unauthorised" }); return; }
    await sendCertificateEmail(user, new Date(), null, { sample: true });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error emailing reviewer sample certificate");
    res.status(500).json({ error: "Could not email sample certificate" });
  }
});

async function getCertData(activationCode: string, deviceId: string, requestedEnrollmentId?: number, userId?: number) {
  const user = await resolveUser(activationCode, deviceId, userId);
  if (!user) return null;
  let enrollment = user.enrollment;
  if (requestedEnrollmentId !== undefined) {
    const [requested] = await db
      .select()
      .from(courseEnrolmentsTable)
      .where(and(
        eq(courseEnrolmentsTable.id, requestedEnrollmentId),
        eq(courseEnrolmentsTable.userId, user.id),
        eq(courseEnrolmentsTable.isDeleted, false),
      ));
    if (!requested) return null;
    enrollment = requested;
  }
  if (!enrollment) return null;
  return getCertDataForEnrollment(user.id, enrollment);
}

async function getCertDataForEnrollment(userId: number, enrollment: typeof courseEnrolmentsTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)));
  if (!user) return null;
  const passedAttempts = await db
    .select()
    .from(examAttemptsTable)
    .where(and(
      eq(examAttemptsTable.userId, userId),
      eq(examAttemptsTable.enrollmentId, enrollment.id),
      eq(examAttemptsTable.passed, true),
    ))
    .orderBy(asc(examAttemptsTable.attemptedAt))
    .limit(1);
  // A completion timestamp is not proof of an exam pass. Certificates may
  // only be rendered from a real passed attempt belonging to this enrolment.
  if (passedAttempts.length === 0) return null;
  const passedAt = passedAttempts[0].attemptedAt;
  const passedScore = passedAttempts[0].score;
  const certificateUser = { ...user, enrollmentId: enrollment.id, courseCompletedAt: enrollment.courseCompletedAt, certificateIssuedAt: enrollment.certificateIssuedAt };
  return { user: certificateUser, enrollment, passedAt, passedScore };
}

// GET /api/certificate/details — data for the responsive in-app certificate.
router.get("/certificate/details", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing credentials" });
    return;
  }

  try {
    const data = await getCertData(activationCode, deviceId, req.query["enrollmentId"] ? Number(req.query["enrollmentId"]) : undefined, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
    if (!data) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }

    const { user, passedAt, passedScore } = data;
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      fullName: user.fullName,
      email: user.email,
      passedAt: passedAt.toISOString(),
      passedScore,
      certificateReference: certRef(user.id, passedAt, data.enrollment.id),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching certificate details");
    res.status(500).json({ error: "Could not load certificate" });
  }
});

router.get("/certificate/access-token", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing credentials" });
    return;
  }
  try {
    const requestedEnrollmentId = req.query["enrollmentId"] ? Number(req.query["enrollmentId"]) : undefined;
    const data = await getCertData(
      activationCode,
      deviceId,
      requestedEnrollmentId,
      req.headers["userid"] ? Number(req.headers["userid"]) : undefined,
    );
    if (!data) {
      res.status(404).json({ error: "Certificate not issued for this enrolment" });
      return;
    }
    const token = issueCertificateToken(data.user.id, data.enrollment.id);
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      token,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + 600) * 1000).toISOString(),
      viewUrl: `/api/certificate/view?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    logger.error({ err }, "Error issuing certificate access token");
    res.status(500).json({ error: "Could not issue certificate access token" });
  }
});

// GET /api/certificate/view — iframe-friendly short-lived token URL.
router.get("/certificate/view", async (req, res) => {
  const token = req.query["token"] as string | undefined;
  if (!token) { res.status(401).json({ error: "Certificate token required" }); return; }
  try {
    const tokenPayload = token ? verifyCertificateToken(token) : null;
    if (!tokenPayload) { res.status(401).json({ error: "Invalid or expired certificate token" }); return; }
    const data = await db.select().from(courseEnrolmentsTable).where(and(
        eq(courseEnrolmentsTable.id, tokenPayload.enrollmentId),
        eq(courseEnrolmentsTable.userId, tokenPayload.userId),
        eq(courseEnrolmentsTable.isDeleted, false),
      )).then(([enrollment]) => enrollment ? getCertDataForEnrollment(tokenPayload.userId, enrollment) : null);
    if (!data) { res.status(401).json({ error: "Unauthorised" }); return; }
    const { user, passedAt, passedScore } = data;
    const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="Certificate_${safeName}.pdf"`);
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
     const data = await getCertData(activationCode, deviceId, req.query["enrollmentId"] ? Number(req.query["enrollmentId"]) : undefined, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
    if (!data) { res.status(401).json({ error: "Unauthorised" }); return; }
    const { user, passedAt, passedScore } = data;
    const pdfBytes = await generateCertificatePdf(user, passedAt, passedScore);
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    const disposition = req.query["download"] === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
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
    await sendCertificateEmail(user, passedAt, passedScore);
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
    const requestedEnrollmentId = req.query["enrollmentId"] ? Number(req.query["enrollmentId"]) : undefined;
    if (!requestedEnrollmentId) { res.status(400).json({ error: "enrollmentId is required" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const [enrollment] = requestedEnrollmentId
      ? await db.select().from(courseEnrolmentsTable).where(and(
        eq(courseEnrolmentsTable.id, requestedEnrollmentId),
        eq(courseEnrolmentsTable.userId, userId),
        eq(courseEnrolmentsTable.isDeleted, false),
      ))
      : [];
    const [passedAttempt] = await db
      .select()
      .from(examAttemptsTable)
      .where(and(
        eq(examAttemptsTable.userId, userId),
        ...(enrollment ? [eq(examAttemptsTable.enrollmentId, enrollment.id)] : []),
        eq(examAttemptsTable.passed, true),
      ))
      .orderBy(asc(examAttemptsTable.attemptedAt))
      .limit(1);
    if (!enrollment || !passedAttempt) { res.status(404).json({ error: "Certificate not issued for this enrolment" }); return; }
    const pdfBytes = await generateCertificatePdf({ ...user, enrollmentId: enrollment.id }, passedAttempt.attemptedAt, passedAttempt.score);
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

// POST /api/admin/certificate/:userId/save-to-drive — save one certificate PDF to Drive
router.post("/admin/certificate/:userId/save-to-drive", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const requestedEnrollmentId = req.query["enrollmentId"] ? Number(req.query["enrollmentId"]) : undefined;
  if (!requestedEnrollmentId) { res.status(400).json({ error: "enrollmentId is required" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const [enrollment] = requestedEnrollmentId
      ? await db.select().from(courseEnrolmentsTable).where(and(
        eq(courseEnrolmentsTable.id, requestedEnrollmentId),
        eq(courseEnrolmentsTable.userId, userId),
        eq(courseEnrolmentsTable.isDeleted, false),
      ))
      : [];
    if (!enrollment) { res.status(400).json({ error: "enrollmentId is required" }); return; }
    const [passedAttempt] = await db
      .select().from(examAttemptsTable)
      .where(and(
        eq(examAttemptsTable.userId, userId),
        ...(enrollment ? [eq(examAttemptsTable.enrollmentId, enrollment.id)] : []),
        eq(examAttemptsTable.passed, true),
      ))
      .orderBy(asc(examAttemptsTable.attemptedAt)).limit(1);
    if (!passedAttempt) { res.status(404).json({ error: "Certificate not issued for this enrolment" }); return; }
    const driveUrl = await saveCertificateToDrive({ ...user, enrollmentId: enrollment.id }, passedAttempt.attemptedAt, passedAttempt.score);
    res.json({ url: driveUrl });
  } catch (err) {
    logger.error({ err, userId }, "Error saving certificate to Drive");
    res.status(500).json({ error: "Could not save certificate to Drive" });
  }
});

// POST /api/admin/certificates/export-to-drive — bulk-save ALL certificates to Drive
router.post("/admin/certificates/export-to-drive", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // Enumerate completed enrolments, not users: one learner may hold many
    // historical certificates.
    const certUsers = await db
      .select({ user: usersTable, enrollment: courseEnrolmentsTable })
      .from(courseEnrolmentsTable)
      .innerJoin(usersTable, eq(courseEnrolmentsTable.userId, usersTable.id))
      .where(and(
        isNotNull(courseEnrolmentsTable.courseCompletedAt),
        eq(courseEnrolmentsTable.isDeleted, false),
        isNull(usersTable.deletedAt),
      ));

    // Resolve folder once, reuse for all uploads
    const { connectors, folderId } = await getCertsFolderId();

    let saved = 0;
    const errors: string[] = [];

    for (const { user, enrollment } of certUsers) {
      try {
        const [passedAttempt] = await db
          .select().from(examAttemptsTable)
          .where(and(
            eq(examAttemptsTable.userId, user.id),
            eq(examAttemptsTable.enrollmentId, enrollment.id),
            eq(examAttemptsTable.passed, true),
          ))
          .orderBy(asc(examAttemptsTable.attemptedAt)).limit(1);
        if (!passedAttempt) throw new Error("No passed exam attempt for enrolment");
        const pdfBytes = await generateCertificatePdf({ ...user, enrollmentId: enrollment.id }, passedAttempt.attemptedAt, passedAttempt.score);
        const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
        const reference = certRef(user.id, passedAttempt.attemptedAt, enrollment.id);
        await uploadPdfToDrive(connectors, pdfBytes, `Certificate_${safeName}_E${enrollment.id}_${reference.replaceAll("/", "-")}.pdf`, folderId);
        saved++;
      } catch (e) {
        errors.push(`${user.fullName} (enrolment ${enrollment.id}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    logger.info({ saved, errors: errors.length, folderId }, "Bulk certificate export to Drive");
    res.json({ saved, errors, folderUrl });
  } catch (err) {
    logger.error({ err }, "Error bulk-exporting certificates to Drive");
    res.status(500).json({ error: "Could not export certificates to Drive" });
  }
});

export default router;
