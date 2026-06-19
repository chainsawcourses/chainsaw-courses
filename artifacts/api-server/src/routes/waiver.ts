import { Router } from "express";
import { db } from "@workspace/db";
import { waiversTable } from "@workspace/db";
import { SignWaiverBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/waiver", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [waiver] = await db
      .select()
      .from(waiversTable)
      .where(eq(waiversTable.userId, user.id));

    if (!waiver) {
      res.json({ signed: false, signedAt: null, pdfUrl: null });
      return;
    }

    res.json({
      signed: true,
      signedAt: waiver.signedAt.toISOString(),
      pdfUrl: waiver.pdfPath ? `/api/waiver/pdf/${user.id}` : null,
    });
  } catch (err) {
    logger.error({ err }, "Error getting waiver status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/waiver", async (req, res) => {
  const parse = SignWaiverBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { signatureData, agreedToTerms } = parse.data;

  if (!agreedToTerms) {
    res.status(400).json({ error: "Must agree to terms" });
    return;
  }

  const deviceId = (req.headers["deviceid"] as string) || parse.data.deviceId;
  const activationCode = (req.headers["activationcode"] as string) || parse.data.activationCode;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(waiversTable)
      .where(eq(waiversTable.userId, user.id));

    if (existing) {
      res.json({ success: true, message: "Waiver already signed" });
      return;
    }

    await db.insert(waiversTable).values({
      userId: user.id,
      signatureData,
      agreedToTerms: true,
    });

    res.json({ success: true, message: "Waiver signed successfully" });
  } catch (err) {
    logger.error({ err }, "Error signing waiver");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
