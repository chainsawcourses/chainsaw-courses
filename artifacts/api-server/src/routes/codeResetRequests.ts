import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, activationCodesTable, codeResetRequestsTable } from "@workspace/db";
import {
  CompleteCodeResetRequestBody,
  CompleteCodeResetRequestParams,
  CompleteCodeResetRequestResponse,
  CreateCodeResetRequestBody,
  CreateCodeResetRequestResponse,
  ListCodeResetRequestsResponse,
} from "@workspace/api-zod";
import { sendEmail } from "../lib/email";
import { getAuthenticatedAdminIdentity, verifyAdmin } from "./admin";

const router: IRouter = Router();
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || "info@chainsawcourses.com";
const requestAttempts = new Map<string, number>();
const REQUEST_COOLDOWN_MS = 10 * 60 * 1000;

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post("/learner/code-reset-requests", async (req, res): Promise<void> => {
  const parsed = CreateCodeResetRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  const email = normaliseEmail(parsed.data.email);
  const throttleKey = `${req.ip || req.socket.remoteAddress || "unknown"}:${email}`;
  const now = Date.now();
  const lastAttempt = requestAttempts.get(throttleKey);
  if (lastAttempt && now - lastAttempt < REQUEST_COOLDOWN_MS) {
    res.status(201).json(CreateCodeResetRequestResponse.parse({
      success: true,
      message: "Your request has been recorded. We will email you when your new code is ready.",
    }));
    return;
  }
  requestAttempts.set(throttleKey, now);

  try {
    const [existing] = await db
      .select()
      .from(codeResetRequestsTable)
      .where(and(
        eq(codeResetRequestsTable.email, email),
        eq(codeResetRequestsTable.status, "pending"),
      ))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(codeResetRequestsTable)
        .values({ email })
        .returning();

      const notified = await sendEmail({
        to: SUPPORT_EMAIL,
        subject: "Chainsaw Courses code reset request",
        text: `A learner has requested a new activation code.\n\nEmail: ${email}\n\nOpen the admin dashboard to create and send a code.`,
        html: `<p>A learner has requested a new activation code.</p><p><strong>Email:</strong> ${email}</p><p>Open the admin dashboard to create and send a code.</p>`,
      });

      await db
        .update(codeResetRequestsTable)
        .set({ supportEmailStatus: notified ? "sent" : "failed" })
        .where(eq(codeResetRequestsTable.id, created.id));
    }

    res.status(201).json(CreateCodeResetRequestResponse.parse({
      success: true,
      message: "Your request has been recorded. We will email you when your new code is ready.",
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to record code reset request");
    res.status(500).json({ error: "Your request could not be sent. Please try again." });
  }
});

router.get("/admin/code-reset-requests", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select()
    .from(codeResetRequestsTable)
    .orderBy(desc(codeResetRequestsTable.requestedAt));

  res.json(ListCodeResetRequestsResponse.parse(rows.map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    supportEmailStatus: row.supportEmailStatus,
    issuedCode: row.issuedCode,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }))));
});

router.post("/admin/code-reset-requests/:requestId/send-code", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = CompleteCodeResetRequestParams.safeParse(req.params);
  const body = CompleteCodeResetRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Select a valid activation code" });
    return;
  }

  const code = body.data.code.trim().toUpperCase();
  const [request] = await db
    .select()
    .from(codeResetRequestsTable)
    .where(eq(codeResetRequestsTable.id, params.data.requestId))
    .limit(1);
  if (!request) {
    res.status(404).json({ error: "Reset request not found" });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "This request has already been completed" });
    return;
  }

  const [activationCode] = await db
    .select()
    .from(activationCodesTable)
    .where(eq(activationCodesTable.code, code))
    .limit(1);
  if (
    !activationCode ||
    activationCode.isUsed ||
    activationCode.isUnlimited ||
    activationCode.isPaused ||
    activationCode.assignedTo
  ) {
    res.status(409).json({ error: "Choose an unused standard activation code" });
    return;
  }

  const sent = await sendEmail({
    to: request.email,
    subject: "Your new Chainsaw Courses activation code",
    text: `Your new Chainsaw Courses activation code is:\n\n${activationCode.code}\n\nOpen the app and enter this code to continue.`,
    html: `<p>Your new Chainsaw Courses activation code is:</p><p style="font-size:22px;font-weight:bold;letter-spacing:2px">${activationCode.code}</p><p>Open the app and enter this code to continue.</p>`,
  });
  if (!sent) {
    res.status(502).json({ error: "The email could not be sent. The request remains pending." });
    return;
  }

  const actorIdentity = getAuthenticatedAdminIdentity(req) ?? "Shared administrator";
  const completed = await db.transaction(async (tx) => {
    const [updatedRequest] = await tx
      .update(codeResetRequestsTable)
      .set({
        status: "completed",
        issuedCodeId: activationCode.id,
        issuedCode: activationCode.code,
        completedAt: new Date(),
        completedBy: actorIdentity,
      })
      .where(and(
        eq(codeResetRequestsTable.id, request.id),
        eq(codeResetRequestsTable.status, "pending"),
      ))
      .returning();
    if (!updatedRequest) return null;
    await tx
      .update(activationCodesTable)
      .set({ assignedTo: request.email })
      .where(eq(activationCodesTable.id, activationCode.id));
    return updatedRequest;
  });

  if (!completed) {
    res.status(409).json({ error: "This request has already been completed" });
    return;
  }

  res.json(CompleteCodeResetRequestResponse.parse({
    success: true,
    message: `Code emailed to ${request.email}`,
  }));
});

export default router;