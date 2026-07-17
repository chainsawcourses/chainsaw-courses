import { Router } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router = Router();

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
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  userId: z.number().optional(),
});

// Store a push subscription
router.post("/push/subscribe", async (req, res) => {
  const parse = SubscribeBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid subscription" }); return; }
  const { endpoint, keys, userId } = parse.data;
  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: userId ?? null })
      .onConflictDoUpdate({ target: pushSubscriptionsTable.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to store push subscription");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// Remove a push subscription
router.delete("/push/subscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  try {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove push subscription");
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
