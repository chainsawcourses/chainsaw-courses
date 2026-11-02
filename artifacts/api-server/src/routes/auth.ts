import { Router, type Request, type Response } from "express";
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
  reasonableAdjustmentsTable,
  courseEnrolmentsTable,
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
  applePurchasesTable,
  applePurchaseIntentsTable,
  appleIdentityChallengesTable,
} from "@workspace/db";
import { ActivateCodeBody } from "@workspace/api-zod";
import { eq, and, isNull, or, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { addCalendarMonthsUtc, getEffectiveCourseAccessExpiry, hasActiveCourseAccess } from "../lib/courseAccess";
import { normalizePurchaseCode, validateShopifyActivation } from "../lib/shopifyActivation";
import { certRef } from "../lib/generateCertificate";
import {
  compatibleLearnerName,
  ensureCurrentEnrollment,
  normalizeLearnerEmail,
  normalizeLearnerName,
} from "../lib/enrollment";
import { issueCertificateToken } from "../lib/certificateToken";
import { isCertificateTestCode } from "../lib/certificateTestAccess";

const router = Router();

function webhookIssuedEmail(activation: typeof activationCodesTable.$inferSelect): string | null {
  const assignedEmail = activation.assignedTo?.trim().toLowerCase();
  if (activation.notes?.startsWith("Shopify order id ") && assignedEmail) {
    return assignedEmail;
  }

  // Compatibility for codes emailed by the original webhook, before it stored
  // assignedTo and a stable Shopify order ID.
  if (activation.notes?.startsWith("Shopify order #")) {
    const legacyEmail = activation.notes.match(/<([^<>]+)>/)?.[1]?.trim().toLowerCase();
    return legacyEmail || null;
  }

  return null;
}

type LearnerContext = typeof usersTable.$inferSelect & {
  status?: string;
  isDeleted?: boolean;
  enrollmentId: number | null;
  enrollment: typeof courseEnrolmentsTable.$inferSelect | null;
  subscription: typeof learnerSubscriptionsTable.$inferSelect | null;
  subscriptionPaidThroughAt: Date | null;
  hasCanonicalSubscription: boolean;
};

async function withCurrentEnrollment(user: typeof usersTable.$inferSelect): Promise<LearnerContext> {
  const enrollment = await db.transaction((tx) => ensureCurrentEnrollment(tx, user));
  const [subscription] = user.id === 0 ? [] : await db
    .select()
    .from(learnerSubscriptionsTable)
    .where(eq(learnerSubscriptionsTable.userId, user.id))
    .limit(1);
  return {
    ...user,
    enrollmentId: enrollment?.id ?? user.currentEnrollmentId ?? null,
    enrollment,
    status: enrollment?.status,
    isDeleted: enrollment?.isDeleted,
    // Course authority is held by the active enrolment. The user fields are
    // retained only as a compatibility fallback for rows not yet backfilled.
    accessExpiresAt: enrollment ? enrollment.accessExpiresAt : user.accessExpiresAt,
    courseCompletedAt: enrollment ? enrollment.courseCompletedAt : user.courseCompletedAt,
    certificateIssuedAt: enrollment ? enrollment.certificateIssuedAt : user.certificateIssuedAt,
    subscriptionExpiresAt: subscription ? subscription.paidThroughAt : user.subscriptionExpiresAt,
    subscriptionPaidThroughAt: subscription?.paidThroughAt ?? null,
    hasCanonicalSubscription: !!subscription,
    subscription,
  };
}

async function withSelectedEnrollment(user: typeof usersTable.$inferSelect, enrollment: typeof courseEnrolmentsTable.$inferSelect): Promise<LearnerContext> {
  const [subscription] = await db
    .select()
    .from(learnerSubscriptionsTable)
    .where(eq(learnerSubscriptionsTable.userId, user.id))
    .limit(1);
  return {
    ...user,
    enrollmentId: enrollment.id,
    enrollment,
    status: enrollment.status,
    isDeleted: enrollment.isDeleted,
    accessExpiresAt: enrollment.accessExpiresAt,
    courseCompletedAt: enrollment.courseCompletedAt,
    certificateIssuedAt: enrollment.certificateIssuedAt,
    subscriptionExpiresAt: subscription ? subscription.paidThroughAt : user.subscriptionExpiresAt,
    subscriptionPaidThroughAt: subscription?.paidThroughAt ?? null,
    hasCanonicalSubscription: !!subscription,
    subscription,
  };
}

router.post("/auth/activate", async (req, res) => {
  const parse = ActivateCodeBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { code: rawCode, deviceId, fullName, email } = parse.data;
  const code = normalizePurchaseCode(rawCode);
  if (code.startsWith("APPLE-")) {
    res.status(400).json({ error: "Use verified email sign-in or Restore Apple purchases. Apple session credentials cannot be redeemed as activation codes." });
    return;
  }

  try {
    if (isCertificateTestCode(code)) {
      await db
        .insert(activationCodesTable)
        .values({
          code,
          isUnlimited: true,
          notes: "Development-only certificate route testing",
        })
        .onConflictDoNothing({ target: activationCodesTable.code });
    }

    const [knownActivation] = await db
      .select()
      .from(activationCodesTable)
      .where(eq(activationCodesTable.code, code));

    // Codes created by our signed Shopify webhook are already verified purchase
    // records and are bound to the purchaser's email. Other paid codes are
    // checked against the Shopify licence service before a local record is made.
    if (!knownActivation?.isUnlimited) {
      const normalizedEmail = email.trim().toLowerCase();
      const locallyVerifiedEmail = knownActivation
        ? webhookIssuedEmail(knownActivation)
        : null;

      if (locallyVerifiedEmail) {
        if (locallyVerifiedEmail !== normalizedEmail) {
          res.status(400).json({
            success: false,
            error: "The email address does not match this purchase code.",
            message: "The email address does not match this purchase code.",
          });
          return;
        }
      } else {
        const shopifyValidation = await validateShopifyActivation({
          purchaseCode: code,
          fullName: fullName.trim(),
          email: normalizedEmail,
        });

        if (!shopifyValidation.success) {
          if (shopifyValidation.retryAfter) {
            res.setHeader("Retry-After", shopifyValidation.retryAfter);
          }
          res.status(shopifyValidation.status).json({
            success: false,
            error: shopifyValidation.message,
            message: shopifyValidation.message,
          });
          return;
        }

        if (!knownActivation) {
          await db
            .insert(activationCodesTable)
            .values({
              code,
              assignedTo: normalizedEmail,
              notes: "Validated by the Shopify licence service",
            })
            .onConflictDoNothing({ target: activationCodesTable.code });
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      const [activation] = await tx
        .select()
        .from(activationCodesTable)
        .where(eq(activationCodesTable.code, code));

      if (!activation) {
        return { error: "Invalid activation code", status: 400 };
      }

      if (activation.isPaused) {
        return { error: "This access code has been temporarily paused. Please contact support.", status: 403 };
      }

      // Unlimited codes: look up by code + name + email so each
      // distinct person gets their own user record and must sign their own waiver.
      if (activation.isUnlimited) {
        const normalizedName = normalizeLearnerName(fullName);
        const normalizedEmail = normalizeLearnerEmail(email);

        // For all-modules-unlocked (reviewer) codes, ignore device binding entirely
        // so the same session works across any device. Store a fixed placeholder deviceId.
        const storedDeviceId = activation.allModulesUnlocked ? "reviewer-any-device" : deviceId;

        const codeUsers = await tx
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.activationCode, code), isNull(usersTable.deletedAt)));

        const existingUser = codeUsers.find(
          (u) =>
            normalizeLearnerName(u.fullName) === normalizedName &&
            normalizeLearnerEmail(u.email) === normalizedEmail
        );

        if (existingUser) {
          // Unlimited codes identify a returning learner by their name and email.
          // When that learner activates on a replacement device, the successful
          // activation must update the device bond as well; otherwise every
          // follow-up request is rejected because it still points at the old device.
          if (!activation.allModulesUnlocked && existingUser.deviceId !== deviceId) {
            if (!existingUser.deviceId.startsWith("RESET_")) {
              return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
            }
            const [rebound] = await tx.update(usersTable).set({ deviceId }).where(and(
              eq(usersTable.id, existingUser.id),
              eq(usersTable.deviceId, existingUser.deviceId),
            )).returning();
            if (!rebound) return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
          }
          const enrollment = await ensureCurrentEnrollment(tx, existingUser);
          const [waiver] = enrollment
            ? await tx.select().from(waiversTable).where(and(
              eq(waiversTable.userId, existingUser.id),
              eq(waiversTable.enrollmentId, enrollment.id),
            ))
            : [];
          return {
            success: true,
            userId: existingUser.id,
            enrollmentId: enrollment?.id ?? null,
            fullName: existingUser.fullName,
            email: existingUser.email,
            waiverRequired: isCertificateTestCode(code) ? false : !waiver,
          };
        }

        // New person — create a fresh user record with no access expiry
        const [newUser] = await tx
          .insert(usersTable)
          .values({ activationCode: code, fullName, email, deviceId: storedDeviceId })
          .returning();
        const [enrollment] = await tx.insert(courseEnrolmentsTable).values({
          userId: newUser.id,
          purchaseCode: code,
          activationCode: code,
          accessType: "unlimited",
          accessExpiresAt: null,
        }).returning();
        await tx.update(usersTable)
          .set({ currentEnrollmentId: enrollment.id })
          .where(eq(usersTable.id, newUser.id));

        return {
          success: true,
          userId: newUser.id,
          enrollmentId: enrollment.id,
          fullName: newUser.fullName,
          email: newUser.email,
          waiverRequired: isCertificateTestCode(code) ? false : true,
        };
      }

      // Replaying a later paid purchase must resolve by its enrolment code,
      // never by users.activationCode (which is retained only as a legacy
      // compatibility field). This also makes replay idempotent under races.
      const [existingEnrollment] = await tx.select().from(courseEnrolmentsTable).where(and(
        eq(courseEnrolmentsTable.purchaseCode, code),
        eq(courseEnrolmentsTable.isDeleted, false),
      )).limit(1);
      if (existingEnrollment) {
        const [owner] = await tx.select().from(usersTable).where(and(
          eq(usersTable.id, existingEnrollment.userId),
          isNull(usersTable.deletedAt),
        ));
        if (!owner) return { error: "Activation owner not found", status: 409 };
        if (owner.deviceId !== deviceId) {
          if (!owner.deviceId.startsWith("RESET_")) {
            return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
          }
          const [rebound] = await tx.update(usersTable).set({ deviceId }).where(and(
            eq(usersTable.id, owner.id),
            eq(usersTable.deviceId, owner.deviceId),
          )).returning();
          if (!rebound) return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
        }
        await tx.update(usersTable).set({
          currentEnrollmentId: existingEnrollment.id,
          activationCode: code,
          accessExpiresAt: existingEnrollment.accessExpiresAt,
          courseCompletedAt: existingEnrollment.courseCompletedAt,
          certificateIssuedAt: existingEnrollment.certificateIssuedAt,
          lastActivityAt: new Date(),
        }).where(eq(usersTable.id, owner.id));
        const [waiver] = await tx.select().from(waiversTable).where(and(
          eq(waiversTable.userId, owner.id),
          eq(waiversTable.enrollmentId, existingEnrollment.id),
        ));
        return {
          success: true,
          userId: owner.id,
          enrollmentId: existingEnrollment.id,
          fullName: owner.fullName,
          email: owner.email,
          waiverRequired: !waiver,
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
            const [rebound] = await tx
              .update(usersTable)
              .set({ deviceId })
              .where(and(
                eq(usersTable.id, existingUser.id),
                eq(usersTable.deviceId, existingUser.deviceId),
              ))
              .returning();
            if (!rebound) return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
          } else {
            return { error: "This code is bonded to another device. Contact support to reset.", status: 409 };
          }
        }

        const enrollment = await ensureCurrentEnrollment(tx, existingUser);
        const [waiver] = enrollment
          ? await tx.select().from(waiversTable).where(and(
            eq(waiversTable.userId, existingUser.id),
            eq(waiversTable.enrollmentId, enrollment.id),
          ))
          : [];

        return {
          success: true,
          userId: existingUser.id,
          enrollmentId: enrollment?.id ?? null,
          fullName: existingUser.fullName,
          email: existingUser.email,
          waiverRequired: !waiver,
        };
      }

      const [claimedActivation] = await tx
        .update(activationCodesTable)
        .set({ isUsed: true })
        .where(and(
          eq(activationCodesTable.id, activation.id),
          eq(activationCodesTable.isUsed, false),
        ))
        .returning({ id: activationCodesTable.id });

      // Another request may have completed the same activation while this
      // request was waiting for Shopify. Reuse that learner rather than
      // creating a duplicate record.
      if (!claimedActivation) {
        const [existingUser] = await tx
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.activationCode, code), isNull(usersTable.deletedAt)));

        if (!existingUser) {
          return { error: "Activation is already being completed. Please try again.", status: 409 };
        }
        if (existingUser.deviceId !== deviceId) {
          if (!existingUser.deviceId.startsWith("RESET_")) {
            return { error: "This code is bonded to another device. Contact support to reset.", status: 409 };
          }
          const [rebound] = await tx.update(usersTable)
            .set({ deviceId })
            .where(and(
              eq(usersTable.id, existingUser.id),
              eq(usersTable.deviceId, existingUser.deviceId),
            ))
            .returning();
          if (!rebound) return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
        }
        const enrollment = await ensureCurrentEnrollment(tx, existingUser);
        const [waiver] = enrollment
          ? await tx.select().from(waiversTable).where(and(
            eq(waiversTable.userId, existingUser.id),
            eq(waiversTable.enrollmentId, enrollment.id),
          ))
          : [];
        return {
          success: true,
          userId: existingUser.id,
          enrollmentId: enrollment?.id ?? null,
          fullName: existingUser.fullName,
          email: existingUser.email,
          waiverRequired: !waiver,
        };
      }

      const activatedAt = new Date();
      const accessExpiresAt = addCalendarMonthsUtc(activatedAt, 6);
      // A learner is the durable identity. A second paid code creates another
      // enrolment on that identity rather than another user row.
      const normalizedEmail = normalizeLearnerEmail(email);
      const normalizedName = normalizeLearnerName(fullName);
      // Serialize paid identity matching so two distinct purchases submitted
      // concurrently cannot create duplicate learner identities.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`);
      const candidates = await tx
        .select()
        .from(usersTable)
        .where(isNull(usersTable.deletedAt));
      const existingLearner = candidates.find((candidate) =>
        normalizeLearnerEmail(candidate.email) === normalizedEmail &&
        compatibleLearnerName(candidate.fullName, normalizedName)
      );

      let learner = existingLearner;
      if (learner && learner.deviceId !== deviceId) {
        if (learner.deviceId.startsWith("RESET_")) {
          const [rebound] = await tx.update(usersTable)
            .set({ deviceId })
            .where(and(eq(usersTable.id, learner.id), eq(usersTable.deviceId, learner.deviceId)))
            .returning();
          if (!rebound) {
            return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
          }
          learner = rebound;
        } else {
          return { error: "This learner account is bonded to another device. Contact support to reset.", status: 409 };
        }
      }

      if (!learner) {
        const [newUser] = await tx
          .insert(usersTable)
          .values({ activationCode: code, fullName, email: normalizedEmail, deviceId, activatedAt, accessExpiresAt })
          .returning();
        learner = newUser;
      } else {
        // Backfill the durable learner before creating a refresher. The
        // per-user lock inside ensureCurrentEnrollment protects legacy
        // progress/completion evidence from being attached to the new cycle.
        await ensureCurrentEnrollment(tx, learner);
      }

      const [enrollment] = await tx.insert(courseEnrolmentsTable).values({
        userId: learner.id,
        purchaseCode: code,
        activationCode: code,
        activatedAt,
        accessExpiresAt,
        accessType: "paid",
      }).returning();
      await tx.update(usersTable)
        .set({
          currentEnrollmentId: enrollment.id,
          activationCode: code,
          accessExpiresAt,
          courseCompletedAt: null,
          certificateIssuedAt: null,
          lastActivityAt: activatedAt,
        })
        .where(eq(usersTable.id, learner.id));

      return {
        success: true,
        userId: learner.id,
        enrollmentId: enrollment.id,
        fullName: learner.fullName,
        email: learner.email,
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
  if (!activationCode || !deviceId) return null;
  const normalizedCode = activationCode.trim().toUpperCase();

  // Demo mode: return the synthetic user without any DB lookup
  if (process.env.DEMO_MODE === "true" && normalizedCode === "DEMO-PREVIEW") {
    return DEMO_USER_OBJ;
  }

  // Check if this is a reviewer / all-modules-unlocked code — these are device-agnostic
  const [codeRecord] = await db
    .select({ allModulesUnlocked: activationCodesTable.allModulesUnlocked, isPaused: activationCodesTable.isPaused })
    .from(activationCodesTable)
    .where(eq(activationCodesTable.code, normalizedCode));
  const deviceAgnostic = (codeRecord?.allModulesUnlocked ?? false)
    && !normalizedCode.startsWith("APPLE-SANDBOX-");

  // Paused codes are treated as unauthorised for all session requests
  if (codeRecord?.isPaused) return null;

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
    if (user) return withCurrentEnrollment(user);

    // A durable learner keeps the original users.activationCode. Subsequent
    // purchases are identified by their enrolment code, so resolve those
    // sessions through the enrolment owner rather than creating another user.
    const [enrollment] = await db
      .select()
      .from(courseEnrolmentsTable)
      .where(and(
        eq(courseEnrolmentsTable.userId, userId),
        or(
          eq(courseEnrolmentsTable.activationCode, normalizedCode),
          eq(courseEnrolmentsTable.purchaseCode, normalizedCode),
        ),
        eq(courseEnrolmentsTable.isDeleted, false),
      ));
    if (!enrollment) return null;
    const [enrollmentUser] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.id, userId),
        isNull(usersTable.deletedAt),
        deviceAgnostic ? undefined : eq(usersTable.deviceId, deviceId),
      ));
    return enrollmentUser ? await withSelectedEnrollment(enrollmentUser, enrollment) : null;
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

  if (user) return withCurrentEnrollment(user);

  const [enrollment] = await db
    .select()
    .from(courseEnrolmentsTable)
    .where(and(
      or(
        eq(courseEnrolmentsTable.activationCode, normalizedCode),
        eq(courseEnrolmentsTable.purchaseCode, normalizedCode),
      ),
      eq(courseEnrolmentsTable.isDeleted, false),
    ))
    .orderBy(courseEnrolmentsTable.id)
    .limit(1);
  if (!enrollment) return null;
  const [enrollmentUser] = await db
    .select()
    .from(usersTable)
    .where(and(
      eq(usersTable.id, enrollment.userId),
      isNull(usersTable.deletedAt),
      deviceAgnostic ? undefined : eq(usersTable.deviceId, deviceId),
    ));
  return enrollmentUser ? await withSelectedEnrollment(enrollmentUser, enrollment) : null;
}

/**
 * Shared gate for learner routes that expose active course materials. Completion
 * evidence routes intentionally do not use this gate so certificates and
 * progress history remain available after entitlement ends.
 */
export async function requireActiveCourseAccess(req: Request, res: Response): Promise<boolean> {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return false;
  }

  const user = await resolveUser(
    activationCode,
    deviceId,
    req.headers["userid"] ? Number(req.headers["userid"]) : undefined,
  );
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (!hasActiveCourseAccess(user)) {
    res.status(403).json({ error: "access_expired", message: "Course access has ended." });
    return false;
  }
  return true;
}

router.get("/auth/me", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  const userId = req.headers["userid"] ? Number(req.headers["userid"]) : undefined;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const normalizedCode = activationCode.trim().toUpperCase();
  const [accessCode] = await db
    .select({
      isPaused: activationCodesTable.isPaused,
      allModulesUnlocked: activationCodesTable.allModulesUnlocked,
      assignedTo: activationCodesTable.assignedTo,
    })
    .from(activationCodesTable)
    .where(eq(activationCodesTable.code, normalizedCode));

  if (accessCode?.isPaused) {
    res.status(403).json({
      error: "access_paused",
      message: "You no longer have access to this app.",
    });
    return;
  }

  let user = await resolveUser(normalizedCode, deviceId, userId);

  // A bonded device retains the learner's encrypted credentials after logout.
  // If an admin resets that learner's bond, Continue can claim the reset for
  // this device without asking the learner to re-enter a consumed code.
  if (!user && userId && (!accessCode?.allModulesUnlocked || normalizedCode.startsWith("APPLE-SANDBOX-"))) {
    const [resetUser] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, userId),
          eq(usersTable.activationCode, normalizedCode),
          isNull(usersTable.deletedAt),
        ),
      );

    if (resetUser?.deviceId.startsWith("RESET_")) {
      const [reboundUser] = await db
        .update(usersTable)
        .set({ deviceId })
        .where(
          and(
            eq(usersTable.id, resetUser.id),
            eq(usersTable.deviceId, resetUser.deviceId),
          ),
        )
        .returning();
      user = reboundUser ? await withCurrentEnrollment(reboundUser) : null;
    }
  }

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [waiver] = await db
    .select()
    .from(waiversTable)
    .where(and(eq(waiversTable.userId, user.id), eq(waiversTable.enrollmentId, user.enrollmentId)));

  const now = new Date();
  const accessStatus: "active" | "expired" = hasActiveCourseAccess(user, now) ? "active" : "expired";
  const effectiveAccessExpiresAt = getEffectiveCourseAccessExpiry(user);
  const daysRemaining = effectiveAccessExpiresAt
    ? Math.max(0, Math.ceil((effectiveAccessExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  // Fetch allModulesUnlocked + assignedTo flag for this activation code
  const codeFlags = accessCode;

  // Fetch active reasonable adjustments for this user
  const adjustmentRows = await db
    .select({ adjustmentType: reasonableAdjustmentsTable.adjustmentType })
    .from(reasonableAdjustmentsTable)
    .where(
      and(
        eq(reasonableAdjustmentsTable.userId, user.id),
        or(
          isNull(reasonableAdjustmentsTable.expiresAt),
          gte(reasonableAdjustmentsTable.expiresAt, now)
        )
      )
    );
  const activeAdjustments = adjustmentRows.map(r => r.adjustmentType);
  const enrollmentHistory = user.id === 0
    ? []
    : await db
      .select()
      .from(courseEnrolmentsTable)
      .where(and(eq(courseEnrolmentsTable.userId, user.id), eq(courseEnrolmentsTable.isDeleted, false)))
      .orderBy(courseEnrolmentsTable.createdAt);

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    activatedAt: user.activatedAt.toISOString(),
    waiverSigned: isCertificateTestCode(normalizedCode) || !!waiver,
    deviceId: user.deviceId,
    accessStatus,
    accessExpiresAt: effectiveAccessExpiresAt?.toISOString() ?? null,
    courseCompletedAt: user.courseCompletedAt?.toISOString() ?? null,
    certificateIssuedAt: user.certificateIssuedAt?.toISOString() ?? null,
    enrollmentId: user.enrollmentId,
    enrolmentId: user.enrollmentId,
    enrollmentHistory: enrollmentHistory.map((enrollment) => ({
      id: enrollment.id,
      enrollmentId: enrollment.id,
      enrolmentId: enrollment.id,
      activatedAt: enrollment.activatedAt.toISOString(),
      accessExpiresAt: enrollment.accessExpiresAt?.toISOString() ?? null,
      status: enrollment.status,
      courseCompletedAt: enrollment.courseCompletedAt?.toISOString() ?? null,
      certificateIssuedAt: enrollment.certificateIssuedAt?.toISOString() ?? null,
      isCurrent: enrollment.id === user.enrollmentId,
    })),
    daysRemaining,
    allModulesUnlocked: codeFlags?.allModulesUnlocked ?? false,
    assignedTo: codeFlags?.assignedTo ?? null,
    activeAdjustments,
    subscription: user.subscription
      ? {
        status: user.subscription.status,
        paidThroughAt: user.subscription.paidThroughAt?.toISOString() ?? null,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
      }
      : {
        status: "inactive",
        paidThroughAt: null,
        cancelAtPeriodEnd: false,
      },
  });
});

/**
 * CPD evidence is intentionally separate from /auth/me. It remains available
 * after an entitlement expires and is scoped to the durable learner identity,
 * while every progress/exam count is isolated to its enrolment.
 */
router.get("/auth/history", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  const userId = req.headers["userid"] ? Number(req.headers["userid"]) : undefined;
  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }
  const user = await resolveUser(activationCode, deviceId, userId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.id === 0) {
    res.json({ currentEnrollmentId: null, enrollments: [] });
    return;
  }

  const enrollments = await db
    .select()
    .from(courseEnrolmentsTable)
    .where(and(eq(courseEnrolmentsTable.userId, user.id), eq(courseEnrolmentsTable.isDeleted, false)))
    .orderBy(courseEnrolmentsTable.createdAt);
  const rows = await Promise.all(enrollments.map(async (enrollment) => {
    const [progress, quizzes, exams, waiver] = await Promise.all([
      db.select().from(userProgressTable).where(eq(userProgressTable.enrollmentId, enrollment.id)),
      db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.enrollmentId, enrollment.id)),
      db.select().from(examAttemptsTable).where(eq(examAttemptsTable.enrollmentId, enrollment.id)).orderBy(examAttemptsTable.attemptedAt),
      db.select({ id: waiversTable.id }).from(waiversTable).where(eq(waiversTable.enrollmentId, enrollment.id)).limit(1),
    ]);
    const passedExam = exams.find((attempt) => attempt.passed);
    return {
      enrollmentId: enrollment.id,
      enrolmentId: enrollment.id,
      activatedAt: enrollment.activatedAt.toISOString(),
      accessExpiresAt: enrollment.accessExpiresAt?.toISOString() ?? null,
      status: enrollment.accessExpiresAt && enrollment.accessExpiresAt <= new Date() ? "expired" : enrollment.status,
      courseCompletedAt: enrollment.courseCompletedAt?.toISOString() ?? null,
      certificateIssuedAt: enrollment.certificateIssuedAt?.toISOString() ?? null,
      certificateReference: passedExam
        ? certRef(user.id, passedExam.attemptedAt, enrollment.id)
        : null,
      certificateUrl: passedExam
        ? `/api/certificate/view?token=${encodeURIComponent(issueCertificateToken(user.id, enrollment.id))}`
        : null,
      isCurrent: enrollment.id === user.enrollmentId,
      waiverSigned: waiver.length > 0,
      progress: {
        totalModules: progress.length,
        completedModules: progress.filter((record) => record.videoCompleted && record.quizPassed).length,
        quizAttempts: quizzes.length,
        examAttempts: exams.length,
        examPassed: !!passedExam,
      },
    };
  }));

  res.json({ currentEnrollmentId: user.enrollmentId, enrollments: rows });
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
      // Retain only the transaction tombstone needed to prevent a previously
      // erased payment being claimed by another account. Remove all learner
      // links, intents and verification email data.
      await tx.update(applePurchasesTable).set({ userId: null, enrollmentId: null, erasedAt: new Date() }).where(eq(applePurchasesTable.userId, uid));
      await tx.delete(applePurchaseIntentsTable).where(or(eq(applePurchaseIntentsTable.userId, uid), eq(applePurchaseIntentsTable.deviceId, user.deviceId)));
      await tx.delete(appleIdentityChallengesTable).where(sql`lower(${appleIdentityChallengesTable.email}) = ${user.email.trim().toLowerCase()}`);
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
      await tx.delete(subscriptionBillingEventsTable).where(eq(subscriptionBillingEventsTable.userId, uid));
      await tx.delete(subscriptionDeliveryAttemptsTable).where(or(
        eq(subscriptionDeliveryAttemptsTable.learnerId, uid),
        sql`lower(${subscriptionDeliveryAttemptsTable.learnerEmail}) = ${user.email.trim().toLowerCase()}`,
      ));
      await tx.delete(learnerSubscriptionsTable).where(eq(learnerSubscriptionsTable.userId, uid));
      await tx.delete(courseEnrolmentsTable).where(eq(courseEnrolmentsTable.userId, uid));
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
