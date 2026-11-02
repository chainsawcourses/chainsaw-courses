import { Router, type Request, type Response } from "express";
import { db, applePurchasesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  CreateApplePurchaseIntentBody, RequestAppleIdentityBody, CompleteAppleIdentityBody,
  SyncApplePurchaseBody, ReceiveAppleNotificationBody,
} from "@workspace/api-zod";
import { appleConfig, AppleAccessError, verifyAppleNotification, verifyApplePurchase } from "../lib/appleVerification";
import { createAppleIntent, requestAppleIdentity, checkAppleIdentity, completeAppleAccount, reconcileApplePurchase } from "../lib/appleAccounts";
import { resolveUser } from "./auth";
import { hasActiveCourseAccess } from "../lib/courseAccess";

const router = Router();
function replyError(req: Request, res: Response, error: unknown) {
  if (error instanceof AppleAccessError) {
    res.status(error.status).json({ error: error.code, message: error.message });
  } else {
    // Never log transaction proofs, OTPs, intent secrets or private keys.
    req.log.error({ errorType: error instanceof Error ? error.name : "Unknown" }, "Apple course operation failed");
    res.status(503).json({ error: "apple_unavailable", message: "Course access could not be confirmed. Please retry; do not purchase again." });
  }
}
function learner(req: Request) {
  return resolveUser(String(req.headers.activationcode || ""), String(req.headers.deviceid || ""),
    req.headers.userid ? Number(req.headers.userid) : undefined);
}
router.get("/apple/config", (_req, res) => {
  const config = appleConfig();
  res.setHeader("Cache-Control", "no-store");
  res.json({ ...config, message: config.enabled ? "Six months of access from purchase. Does not renew automatically." : "Apple purchasing is not available yet. Existing customers can sign in without buying again." });
});
router.post("/apple/intent", async (req, res): Promise<void> => {
  const parsed = CreateApplePurchaseIntentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid device session" }); return; }
  try {
    const user = req.headers.activationcode ? await learner(req) : null;
    if (req.headers.activationcode && !user) throw new AppleAccessError(401, "unauthorised", "Sign in again before purchasing.");
    if (user && hasActiveCourseAccess(user)) throw new AppleAccessError(409, "already_active", "You already have active course access. You do not need to buy again.");
    if (user && user.deviceId !== parsed.data.deviceId) throw new AppleAccessError(401, "unauthorised", "Device session mismatch.");
    res.setHeader("Cache-Control", "no-store");
    res.json(await createAppleIntent(parsed.data.deviceId, user?.id));
  } catch (error) { replyError(req, res, error); }
});
router.post("/apple/identity/request", async (req, res): Promise<void> => {
  const parsed = RequestAppleIdentityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a valid full name, email and device session." }); return; }
  try { res.json(await requestAppleIdentity(parsed.data, req.ip || "unknown")); }
  catch (error) { replyError(req, res, error); }
});
router.post("/apple/identity/complete", async (req, res): Promise<void> => {
  const parsed = CompleteAppleIdentityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid verification details" }); return; }
  const data = parsed.data;
  try {
    const challenge = await checkAppleIdentity(data.challengeId, data.code, data.deviceId);
    const purchase = data.signedTransaction ? await verifyApplePurchase(data.signedTransaction) : undefined;
    const result = await completeAppleAccount(challenge, purchase,
      data.intentId && data.intentSecret ? { id: data.intentId, secret: data.intentSecret } : undefined);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  } catch (error) { replyError(req, res, error); }
});
router.post("/apple/sync", async (req, res): Promise<void> => {
  const parsed = SyncApplePurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid transaction" }); return; }
  try {
    const user = await learner(req);
    if (!user) throw new AppleAccessError(401, "unauthorised", "Sign in to your learner account.");
    const purchase = await verifyApplePurchase(parsed.data.signedTransaction);
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"apple-transaction:" + purchase.transactionId}))`);
      const [ledger] = await tx.select().from(applePurchasesTable).where(and(eq(applePurchasesTable.transactionId, purchase.transactionId), eq(applePurchasesTable.userId, user.id))).for("update");
      if (!ledger || ledger.erasedAt) throw new AppleAccessError(409, "purchase_link_required", "Verify your learner email to link this purchase first.");
      await reconcileApplePurchase(tx, ledger, purchase);
    });
    res.json({ success: true, revoked: !!purchase.revokedAt, expiresAt: purchase.expiresAt.toISOString() });
  } catch (error) { replyError(req, res, error); }
});
router.post("/apple/notifications", async (req, res): Promise<void> => {
  const parsed = ReceiveAppleNotificationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid notification" }); return; }
  try {
    const notification = await verifyAppleNotification(parsed.data.signedPayload);
    if (notification.data?.signedTransactionInfo) {
      const purchase = await verifyApplePurchase(notification.data.signedTransactionInfo);
      await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"apple-transaction:" + purchase.transactionId}))`);
        const [ledger] = await tx.select().from(applePurchasesTable).where(eq(applePurchasesTable.transactionId, purchase.transactionId)).for("update");
        // An unclaimed purchase will be reconciled from Apple's current
        // record at claim time. Notifications cannot create learner accounts.
        if (ledger) await reconcileApplePurchase(tx, ledger, purchase);
      });
    }
    res.json({ success: true });
  } catch (error) { replyError(req, res, error); }
});
export default router;
