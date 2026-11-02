import { randomBytes, createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt, isNull, sql } from "drizzle-orm";
import { db, usersTable, activationCodesTable, courseEnrolmentsTable, applePurchasesTable, applePurchaseIntentsTable, appleIdentityChallengesTable, waiversTable } from "@workspace/db";
import { AppleAccessError, appleConfig, type VerifiedApplePurchase } from "./appleVerification";
import { compatibleLearnerName, ensureCurrentEnrollment, normalizeLearnerEmail, enrollmentIsActive } from "./enrollment";
import { sendEmail } from "./email";
import { addCalendarMonthsUtc } from "./courseAccess";

export const hashAppleSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export function equalAppleSecret(value: string, expected: string) {
  const a = Buffer.from(hashAppleSecret(value));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function fail(status: number, code: string, message: string): never { throw new AppleAccessError(status, code, message); }

export async function createAppleIntent(deviceId: string, userId?: number) {
  const config = appleConfig();
  if (!config.enabled) fail(503, "apple_unavailable", "Apple purchases are not available yet.");
  const secret = randomBytes(32).toString("hex");
  const id = randomUUID(), appAccountToken = randomUUID();
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"apple-intent:" + deviceId}))`);
    const recent = await tx.select().from(applePurchaseIntentsTable).where(and(
      eq(applePurchaseIntentsTable.deviceId, deviceId),
      gt(applePurchaseIntentsTable.createdAt, new Date(Date.now() - 3600_000)),
    ));
    if (recent.length >= 12) fail(429, "rate_limited", "Please wait before starting another purchase.");
    await tx.insert(applePurchaseIntentsTable).values({ id, secretHash: hashAppleSecret(secret), appAccountToken, deviceId, userId, expiresAt: new Date(Date.now() + 7 * 86400_000) });
  });
  return { id, secret, appAccountToken, productId: config.productId };
}

export async function requestAppleIdentity(input: { email: string; fullName: string; deviceId: string }, ip: string) {
  const email = normalizeLearnerEmail(input.email);
  if (input.fullName.trim().length < 2) fail(400, "invalid_name", "Enter your full learner name.");
  const id = randomUUID(), code = String(randomInt(100000, 1000000));
  const requestHash = hashAppleSecret(ip);
  await db.transaction(async tx => {
    // A single advisory lock serialises the two independent abuse limits.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('apple-identity-rate'))`);
    await tx.delete(appleIdentityChallengesTable).where(lt(appleIdentityChallengesTable.expiresAt, new Date(Date.now() - 86400_000)));
    const recent = await tx.select().from(appleIdentityChallengesTable).where(gt(appleIdentityChallengesTable.createdAt, new Date(Date.now() - 3600_000)));
    if (recent.filter(r => r.email === email).length >= 5
      || recent.filter(r => r.deviceId === input.deviceId).length >= 20
      || recent.filter(r => r.requestHash === requestHash).length >= 100) {
      fail(429, "rate_limited", "Too many verification requests. Please try again later.");
    }
    await tx.insert(appleIdentityChallengesTable).values({
      id, email, fullName: input.fullName.trim(), deviceId: input.deviceId, requestHash,
      codeHash: hashAppleSecret(`${id}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000),
    });
  });
  const sent = await sendEmail({
    to: email, subject: "Your Chainsaw Courses verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes. Enter it only in Chainsaw Courses. Signing in transfers course access to this device. If you did not request this, ignore this email.`,
    html: `<p>Your Chainsaw Courses verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. Enter it only in the Chainsaw Courses app. Signing in transfers course access to this device.</p><p>If you did not request this, ignore this email.</p>`,
  });
  if (!sent) {
    await db.delete(appleIdentityChallengesTable).where(eq(appleIdentityChallengesTable.id, id));
    fail(503, "email_unavailable", "Your verification email could not be sent. Please try again later.");
  }
  return { challengeId: id, message: "Check your email for the six-digit verification code." };
}

// A correct OTP is consumed only by the successful identity transaction. Wrong
// attempts are committed separately so rolling back an ownership conflict
// cannot roll back the brute-force counter.
export async function checkAppleIdentity(challengeId: string, code: string, deviceId: string) {
  const row = await db.transaction(async tx => {
    const [challenge] = await tx.select().from(appleIdentityChallengesTable).where(eq(appleIdentityChallengesTable.id, challengeId)).for("update");
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || challenge.deviceId !== deviceId) return null;
    await tx.update(appleIdentityChallengesTable).set({ attempts: challenge.attempts + 1 }).where(eq(appleIdentityChallengesTable.id, challengeId));
    return equalAppleSecret(`${challenge.id}:${code}`, challenge.codeHash) ? challenge : null;
  });
  if (!row) fail(401, "verification_failed", "The verification code is invalid or has expired.");
  return row;
}

export async function completeAppleAccount(
  challenge: Awaited<ReturnType<typeof checkAppleIdentity>>,
  purchase?: VerifiedApplePurchase,
  intentProof?: { id: string; secret: string },
) {
  return db.transaction(async tx => {
    // Share the Shopify activation lock, not a provider-specific lock: a paid
    // Apple callback and a website activation may arrive at the same time.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${challenge.email}))`);
    const [freshChallenge] = await tx.select().from(appleIdentityChallengesTable).where(eq(appleIdentityChallengesTable.id, challenge.id)).for("update");
    if (!freshChallenge || freshChallenge.consumedAt || freshChallenge.expiresAt <= new Date()) fail(401, "verification_failed", "Please request another verification code.");
    let ledger: typeof applePurchasesTable.$inferSelect | undefined;
    let intent: typeof applePurchaseIntentsTable.$inferSelect | undefined;
    if (purchase) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"apple-transaction:" + purchase.transactionId}))`);
      [ledger] = await tx.select().from(applePurchasesTable).where(eq(applePurchasesTable.transactionId, purchase.transactionId)).for("update");
      if (ledger?.erasedAt) fail(409, "erased_purchase", "This purchase belonged to a deleted account. Please contact support.");
      if (!ledger) {
        if (!intentProof) fail(409, "purchase_recovery_required", "This purchase has not been linked yet. Recover it on the device used to buy it, or contact support.");
        [intent] = await tx.select().from(applePurchaseIntentsTable).where(eq(applePurchaseIntentsTable.id, intentProof.id)).for("update");
        if (!intent || !equalAppleSecret(intentProof.secret, intent.secretHash)
          || intent.deviceId !== challenge.deviceId || intent.appAccountToken !== purchase.appAccountToken) {
          fail(409, "purchase_owner_mismatch", "This purchase cannot be linked from this session.");
        }
        // Keep old intents recoverable with their secret after delayed Ask to
        // Buy approval; expiry prevents reuse for initiating purchases, not
        // the legitimate completion of an already signed transaction.
      }
    }
    const matches = await tx.select().from(usersTable).where(and(
      sql`lower(trim(${usersTable.email})) = ${challenge.email}`, isNull(usersTable.deletedAt),
    )).for("update");
    if (matches.length > 1) fail(409, "ambiguous_account", "More than one learner uses this email. Contact support so the correct records can be preserved.");
    let user = matches[0];
    if (purchase && user && (purchase.environment === "Sandbox") !== user.activationCode.startsWith("APPLE-SANDBOX-")) {
      fail(409, "environment_mismatch", "Apple sandbox testing must use a separate test learner email, not an existing paid learner account.");
    }
    if (user && !compatibleLearnerName(user.fullName, challenge.fullName)) fail(409, "learner_name_conflict", "Use the name on your existing learner record, or contact support.");
    if (ledger && ledger.userId !== user?.id) fail(409, "purchase_owner_mismatch", "This Apple purchase is already linked to another learner.");
    if (intent?.userId && intent.userId !== user?.id) fail(409, "purchase_owner_mismatch", "Sign in to the learner account that started this purchase.");
    let recoveredShopifyEnrollment: typeof courseEnrolmentsTable.$inferSelect | undefined;
    let wasNewAppleLearner = false;
    if (!purchase) {
      const previous = user ? await ensureCurrentEnrollment(tx, user) : null;
      // An emailed, paid Shopify entitlement can be recovered without an iOS
      // code-redemption screen, including a purchase not yet activated.
      if ((!previous || !enrollmentIsActive(previous)) && !user?.activationCode.startsWith("APPLE-SANDBOX-")) {
        const unused = await tx.select().from(activationCodesTable).where(and(
          eq(activationCodesTable.isUsed, false), eq(activationCodesTable.isPaused, false),
          eq(activationCodesTable.isUnlimited, false),
          sql`(lower(trim(${activationCodesTable.assignedTo})) = ${challenge.email}
            OR position(${"<" + challenge.email + ">"} in lower(${activationCodesTable.notes})) > 0)`,
          sql`${activationCodesTable.notes} LIKE 'Shopify order %'`,
        )).for("update");
        if (unused.length > 1) fail(409, "ambiguous_purchase", "Multiple unused purchases use this email. Please contact support to select the correct learner purchase.");
        const paid = unused[0];
        if (paid) {
          const now = new Date(), expiry = addCalendarMonthsUtc(now, 6);
          if (!user) {
            [user] = await tx.insert(usersTable).values({
              fullName: challenge.fullName, email: challenge.email, deviceId: challenge.deviceId,
              activationCode: paid.code, accessExpiresAt: expiry,
            }).returning();
            recoveredShopifyEnrollment = (await ensureCurrentEnrollment(tx, user))!;
          } else {
            [recoveredShopifyEnrollment] = await tx.insert(courseEnrolmentsTable).values({
              userId: user.id, purchaseCode: paid.code, activationCode: paid.code,
              activatedAt: now, accessExpiresAt: expiry, accessType: "paid",
            }).returning();
          }
          await tx.update(activationCodesTable).set({ isUsed: true }).where(eq(activationCodesTable.id, paid.id));
        }
      }
    }
    if (!user && (!purchase || purchase.revokedAt || purchase.expiresAt <= new Date())) fail(409, "no_active_purchase", "No active course purchase was found for this learner.");
    if (!user) {
      wasNewAppleLearner = true;
      // Opaque, server-minted compatibility credential; not an Apple purchase
      // ID and never accepted by the public activation-code endpoint.
      const sandbox = purchase!.environment === "Sandbox";
      const credential = `APPLE-${sandbox ? "SANDBOX-" : ""}${randomBytes(32).toString("hex").toUpperCase()}`;
      await tx.insert(activationCodesTable).values({
        code: credential, isUsed: true,
        // Existing reviewer mode suppresses persisted exam passes and real awards.
        allModulesUnlocked: sandbox,
        notes: sandbox ? "Apple sandbox reviewer — sample certificates only; not redeemable" : "Apple learner session — not redeemable",
      });
      [user] = await tx.insert(usersTable).values({
        fullName: challenge.fullName, email: challenge.email, deviceId: challenge.deviceId,
        activationCode: credential, accessExpiresAt: purchase!.expiresAt,
      }).returning();
    }
    // Preserve and scope legacy evidence before adding a new training cycle.
    let current = recoveredShopifyEnrollment ?? (wasNewAppleLearner ? null : await ensureCurrentEnrollment(tx, user));
    if (!purchase && !current) fail(409, "no_purchase", "No course access was found. Please check the email used for your purchase.");
    if (purchase) {
      if (!ledger) {
        const [enrollment] = await tx.insert(courseEnrolmentsTable).values({
          userId: user.id, purchaseCode: `APPLE:${purchase.environment}:${purchase.transactionId}`,
          activationCode: user.activationCode, activatedAt: purchase.purchasedAt,
          accessExpiresAt: purchase.expiresAt, accessType: "apple",
          status: purchase.revokedAt ? "revoked" : "active",
          metadata: JSON.stringify({ provider: "apple", transactionId: purchase.transactionId, environment: purchase.environment }),
        }).returning();
        [ledger] = await tx.insert(applePurchasesTable).values({ ...purchase, userId: user.id, enrollmentId: enrollment.id }).returning();
        // A revoked/expired purchase never displaces valid Shopify access.
        if (!current || (!purchase.revokedAt && purchase.expiresAt > new Date()
          && !enrollmentIsActive(current))) current = enrollment;
      } else {
        await reconcileApplePurchase(tx, ledger, purchase);
        const [freshUser] = await tx.select().from(usersTable).where(eq(usersTable.id, user.id));
        if (freshUser?.currentEnrollmentId && freshUser.currentEnrollmentId !== current?.id) {
          [current] = await tx.select().from(courseEnrolmentsTable).where(eq(courseEnrolmentsTable.id, freshUser.currentEnrollmentId));
        }
        if (ledger.enrollmentId && (!current || current.id === ledger.enrollmentId)) {
          [current] = await tx.select().from(courseEnrolmentsTable).where(eq(courseEnrolmentsTable.id, ledger.enrollmentId));
        }
      }
      await tx.delete(applePurchaseIntentsTable).where(eq(applePurchaseIntentsTable.appAccountToken, purchase.appAccountToken));
    }
    if (!current) fail(409, "no_purchase", "The course enrolment could not be recovered. Please contact support.");
    const [accessCode] = await tx.select().from(activationCodesTable).where(eq(activationCodesTable.code, user.activationCode));
    if (accessCode?.isPaused) fail(403, "access_paused", "Your course access is paused. Please contact support.");
    await tx.update(usersTable).set({
      deviceId: challenge.deviceId, currentEnrollmentId: current.id,
      accessExpiresAt: current.accessExpiresAt, courseCompletedAt: current.courseCompletedAt,
      certificateIssuedAt: current.certificateIssuedAt,
    }).where(eq(usersTable.id, user.id));
    await tx.update(appleIdentityChallengesTable).set({ consumedAt: new Date() }).where(eq(appleIdentityChallengesTable.id, challenge.id));
    const [waiver] = await tx.select().from(waiversTable).where(and(eq(waiversTable.userId, user.id), eq(waiversTable.enrollmentId, current.id)));
    return { activationCode: user.activationCode, userId: user.id, fullName: user.fullName, email: user.email, enrollmentId: current.id, waiverRequired: !waiver };
  });
}

type TransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function reconcileApplePurchase(tx: TransactionExecutor, ledger: typeof applePurchasesTable.$inferSelect, purchase: VerifiedApplePurchase) {
  if (ledger.environment !== purchase.environment || ledger.appAccountToken !== purchase.appAccountToken || ledger.productId !== purchase.productId) fail(409, "purchase_owner_mismatch", "Purchase identity mismatch.");
  await tx.update(applePurchasesTable).set({ revokedAt: purchase.revokedAt, verifiedAt: new Date() }).where(eq(applePurchasesTable.transactionId, ledger.transactionId));
  if (ledger.erasedAt || !ledger.enrollmentId || !ledger.userId) return;
  await tx.update(courseEnrolmentsTable).set({ status: purchase.revokedAt ? "revoked" : "active", updatedAt: new Date() }).where(and(
    eq(courseEnrolmentsTable.id, ledger.enrollmentId), eq(courseEnrolmentsTable.userId, ledger.userId), eq(courseEnrolmentsTable.accessType, "apple"),
  ));
  if (purchase.revokedAt) {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, ledger.userId)).for("update");
    if (user?.currentEnrollmentId === ledger.enrollmentId) {
      const alternatives = await tx.select().from(courseEnrolmentsTable).where(and(eq(courseEnrolmentsTable.userId, user.id), eq(courseEnrolmentsTable.isDeleted, false)));
      const fallback = alternatives.find(e => e.id !== ledger.enrollmentId && e.status !== "revoked" && e.status !== "deleted"
        && (!e.accessExpiresAt || e.accessExpiresAt > new Date()));
      if (fallback) await tx.update(usersTable).set({
        currentEnrollmentId: fallback.id, accessExpiresAt: fallback.accessExpiresAt,
        courseCompletedAt: fallback.courseCompletedAt, certificateIssuedAt: fallback.certificateIssuedAt,
      }).where(eq(usersTable.id, user.id));
    }
  }
}
