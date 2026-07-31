import { Router } from "express";
import { db } from "@workspace/db";
import {
  activationCodesTable,
  usersTable,
  waiversTable,
  userProgressTable,
  quizAttemptsTable,
  chatMessagesTable,
  inspectionRecordsTable,
  riskAssessmentsTable,
  videoEngagementTable,
  moduleFeedbackTable,
  examAttemptsTable,
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

      // Unlimited codes: look up by code + name + email so each
      // distinct person gets their own user record and must sign their own waiver.
      if (activation.isUnlimited) {
        const normalizedName = fullName.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        // For all-modules-unlocked (reviewer) codes, ignore device binding entirely
        // so the same session works across any device. Store a fixed placeholder deviceId.
        const storedDeviceId = activation.allModulesUnlocked ? "reviewer-any-device" : deviceId;

        const codeUsers = await tx
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.activationCode, code), isNull(usersTable.deletedAt)));

        const existingUser = codeUsers.find(
          (u) =>
            u.fullName.trim().toLowerCase() === normalizedName &&
            u.email.trim().toLowerCase() === normalizedEmail
        );

        if (existingUser) {
          const [waiver] = await tx.select().from(waiversTable).where(eq(waiversTable.userId, existingUser.id));
          return {
            success: true,
            userId: existingUser.id,
            fullName: existingUser.fullName,
            email: existingUser.email,
            waiverRequired: !waiver,
          };
        }

        // New person — create a fresh user record with no access expiry
        const [newUser] = await tx
          .insert(usersTable)
          .values({ activationCode: code, fullName, email, deviceId: storedDeviceId })
          .returning();

        return {
          success: true,
          userId: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          waiverRequired: true,
        };
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
          // Allow re-bonding if admin has reset the device bond
          if (existingUser.deviceId.startsWith("RESET_")) {
            await tx
              .update(usersTable)
              .set({ deviceId })
              .where(eq(usersTable.id, existingUser.id));
          } else {
            return { error: "This code is bonded to another device. Contact support to reset.", status: 409 };
          }
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

      const accessExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const [newUser] = await tx
        .insert(usersTable)
        .values({ activationCode: code, fullName, email, deviceId, accessExpiresAt })
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
      res.status(result.status as number).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error activating code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Synthetic demo user — returned when DEMO_MODE=true and code is DEMO-PREVIEW.
// id=0 is used as a sentinel throughout routes to skip DB writes.
const DEMO_USER_OBJ = {
  id: 0,
  fullName: "Demo User",
  email: "demo@chainsawcourses.com",
  activationCode: "DEMO-PREVIEW",
  deviceId: "demo-device-0000",
  accessExpiresAt: null,
  subscriptionExpiresAt: null,
  courseCompletedAt: null,
  certificateIssuedAt: null,
  activatedAt: new Date("2024-01-01"),
  lastActivityAt: null,
  deletedAt: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

async function resolveUser(activationCode: string, deviceId: string, userId?: number) {
  const normalizedCode = activationCode.trim().toUpperCase();

  // Demo mode: return the synthetic user without any DB lookup
  if (process.env.DEMO_MODE === "true" && normalizedCode === "DEMO-PREVIEW") {
    return DEMO_USER_OBJ;
  }

  // Check if this is a reviewer / all-modules-unlocked code — these are device-agnostic
  const [codeRecord] = await db
    .select({ allModulesUnlocked: activationCodesTable.allModulesUnlocked })
    .from(activationCodesTable)
    .where(eq(activationCodesTable.code, normalizedCode));
  const deviceAgnostic = codeRecord?.allModulesUnlocked ?? false;

  // Fast path: when the client supplies its own userId, verify it directly.
  if (userId) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        deviceAgnostic
          ? and(eq(usersTable.id, userId), eq(usersTable.activationCode, normalizedCode), isNull(usersTable.deletedAt))
          : and(eq(usersTable.id, userId), eq(usersTable.activationCode, normalizedCode), eq(usersTable.deviceId, deviceId), isNull(usersTable.deletedAt))
      );
    return user ?? null;
  }

  // Fallback: no userId header — pick the oldest matching record.
  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      deviceAgnostic
        ? and(eq(usersTable.activationCode, normalizedCode), isNull(usersTable.deletedAt))
        : and(eq(usersTable.activationCode, normalizedCode), eq(usersTable.deviceId, deviceId), isNull(usersTable.deletedAt))
    )
    .orderBy(usersTable.id);

  return user ?? null;
}

router.get("/auth/me", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [waiver] = await db
    .select()
    .from(waiversTable)
    .where(eq(waiversTable.userId, user.id));

  const now = new Date();
  const hasSubscription = !!(user.subscriptionExpiresAt && user.subscriptionExpiresAt > now);
  const inFreeWindow = user.accessExpiresAt === null || user.accessExpiresAt > now;
  const accessStatus: "active" | "expired" = (hasSubscription || inFreeWindow) ? "active" : "expired";
  const daysRemaining = user.accessExpiresAt
    ? Math.max(0, Math.ceil((user.accessExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    activatedAt: user.activatedAt.toISOString(),
    waiverSigned: !!waiver,
    deviceId: user.deviceId,
    accessStatus,
    accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
    courseCompletedAt: user.courseCompletedAt?.toISOString() ?? null,
    daysRemaining,
  });
});

router.delete("/auth/delete-account", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const uid = user.id;
      // Delete all personal data linked to this user
      await tx.delete(waiversTable).where(eq(waiversTable.userId, uid));
      await tx.delete(userProgressTable).where(eq(userProgressTable.userId, uid));
      await tx.delete(quizAttemptsTable).where(eq(quizAttemptsTable.userId, uid));
      await tx.delete(examAttemptsTable).where(eq(examAttemptsTable.userId, uid));
      await tx.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, uid));
      await tx.delete(inspectionRecordsTable).where(eq(inspectionRecordsTable.userId, uid));
      await tx.delete(riskAssessmentsTable).where(eq(riskAssessmentsTable.userId, uid));
      await tx.delete(videoEngagementTable).where(eq(videoEngagementTable.userId, uid));
      await tx.delete(moduleFeedbackTable).where(eq(moduleFeedbackTable.userId, uid));
      // Anonymise the user row — keep the activation code bond marked as used
      // so the code cannot be reactivated after erasure.
      await tx
        .update(usersTable)
        .set({
          fullName: "DELETED",
          email: `deleted+${uid}@deleted.invalid`,
          deviceId: `DELETED_${uid}`,
          deletedAt: new Date(),
        })
        .where(eq(usersTable.id, uid));
    });

    logger.info({ userId: user.id }, "Account erased per GDPR Right to Erasure");
    res.json({ success: true, message: "Account deleted per GDPR Right to Erasure" });
  } catch (err) {
    logger.error({ err }, "Error deleting account");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { resolveUser };
export default router;
