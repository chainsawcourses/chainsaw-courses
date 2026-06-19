import { Router } from "express";
import { db } from "@workspace/db";
import {
  activationCodesTable,
  usersTable,
  waiversTable,
} from "@workspace/db";
import { ActivateCodeBody } from "@workspace/api-zod";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.post("/auth/activate", async (req, res) => {
  const parse = ActivateCodeBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { code: rawCode, deviceId, fullName, email } = parse.data;
  const code = rawCode.trim().toUpperCase();

  try {
    const result = await db.transaction(async (tx) => {
      const [activation] = await tx
        .select()
        .from(activationCodesTable)
        .where(eq(activationCodesTable.code, code));

      if (!activation) {
        return { error: "Invalid activation code", status: 400 };
      }

      if (activation.isUsed) {
        const [existingUser] = await tx
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.activationCode, code), isNull(usersTable.deletedAt)));

        if (!existingUser) {
          return { error: "Activation code already used", status: 409 };
        }

        if (existingUser.deviceId !== deviceId) {
          return { error: "This code is bonded to another device. Contact support to reset.", status: 409 };
        }

        const [waiver] = await tx
          .select()
          .from(waiversTable)
          .where(eq(waiversTable.userId, existingUser.id));

        return {
          success: true,
          userId: existingUser.id,
          fullName: existingUser.fullName,
          email: existingUser.email,
          waiverRequired: !waiver,
        };
      }

      await tx
        .update(activationCodesTable)
        .set({ isUsed: true })
        .where(eq(activationCodesTable.id, activation.id));

      const [newUser] = await tx
        .insert(usersTable)
        .values({ activationCode: code, fullName, email, deviceId })
        .returning();

      return {
        success: true,
        userId: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        waiverRequired: true,
      };
    });

    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error activating code");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function resolveUser(activationCode: string, deviceId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.activationCode, activationCode), isNull(usersTable.deletedAt)));

  if (!user || user.deviceId !== deviceId) return null;
  return user;
}

router.get("/auth/me", async (req, res) => {
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

  const [waiver] = await db
    .select()
    .from(waiversTable)
    .where(eq(waiversTable.userId, user.id));

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    activatedAt: user.activatedAt.toISOString(),
    waiverSigned: !!waiver,
    deviceId: user.deviceId,
  });
});

router.delete("/auth/delete-account", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db
    .update(usersTable)
    .set({ deletedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Account deleted per GDPR Right to Erasure" });
});

export { resolveUser };
export default router;
