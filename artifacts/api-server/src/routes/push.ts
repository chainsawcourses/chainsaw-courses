import { Router } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { z } from "zod/v4";
import { resolveUser } from "./auth";

const router = Router();
const TRUSTED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL       = process.env.VAPID_EMAIL       ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const subs = await db.select().from(pushSubscriptionsTable);
  const message = JSON.stringify(payload);
  const failed: number[] = [];
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 86400 }
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          failed.push(sub.id);
        } else {
          logger.warn({ err, endpoint: sub.endpoint }, "Push send failed");
        }
      }
    })
  );
  for (const id of failed) {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, id));
  }
}

// Return VAPID public key so clients can subscribe
router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const SubscribeBody = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
});

function isTrustedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && (
      TRUSTED_PUSH_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".push.apple.com")
    );
  } catch {
    return false;
  }
}

// Store a push subscription
router.post("/push/subscribe", async (req, res) => {
  const parse = SubscribeBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid subscription" }); return; }
  const { endpoint, keys } = parse.data;
  const activationCode = req.headers.activationcode;
  const deviceId = req.headers.deviceid;
  const rawUserId = req.headers.userid;
  if (typeof activationCode !== "string" || typeof deviceId !== "string" ||
      activationCode.length > 256 || deviceId.length > 256) {
    res.status(401).json({ error: "Missing auth headers" }); return;
  }
  if (rawUserId !== undefined && (typeof rawUserId !== "string" || !/^\d+$/.test(rawUserId))) {
    res.status(401).json({ error: "Invalid auth headers" }); return;
  }
  if (!isTrustedPushEndpoint(endpoint)) {
    res.status(400).json({ error: "Unsupported push endpoint" }); return;
  }
  const user = await resolveUser(activationCode, deviceId, rawUserId ? Number(rawUserId) : undefined);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [existing] = await db.select({ userId: pushSubscriptionsTable.userId })
      .from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    if (existing?.userId !== null && existing?.userId !== undefined && existing.userId !== user.id) {
      res.status(403).json({ error: "Subscription belongs to another user" }); return;
    }
    await db
      .insert(pushSubscriptionsTable)
      .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.id })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
        where: sql`${pushSubscriptionsTable.userId} IS NULL OR ${pushSubscriptionsTable.userId} = ${user.id}`,
      });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to store push subscription");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// Remove a push subscription
router.delete("/push/subscribe", async (req, res) => {
  const parse = z.object({ endpoint: z.string().url().max(2048) }).safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid endpoint" }); return; }
  const { endpoint } = parse.data;
  const activationCode = req.headers.activationcode;
  const deviceId = req.headers.deviceid;
  const rawUserId = req.headers.userid;
  if (typeof activationCode !== "string" || typeof deviceId !== "string" ||
      activationCode.length > 256 || deviceId.length > 256 ||
      (rawUserId !== undefined && (typeof rawUserId !== "string" || !/^\d+$/.test(rawUserId)))) {
    res.status(401).json({ error: "Missing auth headers" }); return;
  }
  if (!isTrustedPushEndpoint(endpoint)) {
    res.status(400).json({ error: "Unsupported push endpoint" }); return;
  }
  const user = await resolveUser(activationCode, deviceId, rawUserId ? Number(rawUserId) : undefined);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.delete(pushSubscriptionsTable).where(
      sql`${pushSubscriptionsTable.endpoint} = ${endpoint} AND ${pushSubscriptionsTable.userId} = ${user.id}`,
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove push subscription");
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
