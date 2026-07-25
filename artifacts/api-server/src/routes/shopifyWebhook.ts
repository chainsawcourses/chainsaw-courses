import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { activationCodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `CC-${segment(6)}-${segment(4)}`;
}

async function makeUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const [existing] = await db
      .select({ id: activationCodesTable.id })
      .from(activationCodesTable)
      .where(eq(activationCodesTable.code, code));
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique activation code after 10 attempts");
}

function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string, secret: string): boolean {
  const computed = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function appUrl(): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl;
  const domains = process.env.REPLIT_DOMAINS?.trim();
  if (domains) return `https://${domains.split(",")[0].trim()}`;
  return "https://chainsawcourses.com";
}

router.post("/api/shopify/webhook", async (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    req.log.warn("SHOPIFY_WEBHOOK_SECRET not set — webhook rejected");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;

  if (!hmacHeader || !rawBody) {
    res.status(401).json({ error: "Missing HMAC or body" });
    return;
  }

  if (!verifyShopifyHmac(rawBody, hmacHeader, secret)) {
    req.log.warn("Shopify webhook HMAC verification failed");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  const topic = req.headers["x-shopify-topic"] as string | undefined;
  if (topic !== "orders/paid") {
    res.status(200).json({ ignored: true });
    return;
  }

  const order = req.body as {
    id?: number;
    order_number?: number;
    email?: string;
    customer?: { email?: string; first_name?: string; last_name?: string };
    billing_address?: { name?: string };
    line_items?: { title?: string; quantity?: number }[];
  };

  const buyerEmail = (order.email ?? order.customer?.email ?? "").trim();
  const buyerName = (
    order.customer?.first_name && order.customer?.last_name
      ? `${order.customer.first_name} ${order.customer.last_name}`
      : order.billing_address?.name ?? "Valued Customer"
  ).trim();
  const orderRef = order.order_number ?? order.id ?? "unknown";

  if (!buyerEmail) {
    req.log.warn({ orderRef }, "Shopify webhook: order has no email — skipping");
    res.status(200).json({ skipped: "no email" });
    return;
  }

  try {
    const code = await makeUniqueCode();

    await db.insert(activationCodesTable).values({
      code,
      notes: `Shopify order #${orderRef} — ${buyerName} <${buyerEmail}>`,
    });

    const url = appUrl();

    const sent = await sendEmail({
      to: buyerEmail,
      subject: "Your Chainsaw Courses Access Code",
      text: [
        `Hi ${buyerName},`,
        "",
        "Thank you for purchasing the Chainsaw Maintenance & Cross Cutting professional training course.",
        "",
        "Your personal access code is:",
        "",
        `    ${code}`,
        "",
        "To get started:",
        `  1. Go to ${url}`,
        "  2. Enter your full name, email address, and the code above.",
        "  3. Your progress is saved automatically and your certificate is issued once you pass the final exam.",
        "",
        "If you have any questions, reply to this email and we will be happy to help.",
        "",
        "Kind regards,",
        "Chainsaw Courses",
        "chainsawcourses.com",
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#222;">
          <p>Hi ${buyerName},</p>
          <p>Thank you for purchasing the <strong>Chainsaw Maintenance &amp; Cross Cutting</strong> professional training course.</p>
          <p>Your personal access code is:</p>
          <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:16px 24px;text-align:center;margin:24px 0;">
            <span style="font-family:monospace;font-size:24px;font-weight:700;letter-spacing:4px;color:#e27226;">${code}</span>
          </div>
          <p><strong>To get started:</strong></p>
          <ol>
            <li>Go to <a href="${url}">${url}</a></li>
            <li>Enter your full name, email address, and the code above.</li>
            <li>Your progress is saved automatically and your certificate is issued once you pass the final exam.</li>
          </ol>
          <p>If you have any questions, just reply to this email.</p>
          <p>Kind regards,<br/><strong>Chainsaw Courses</strong><br/>chainsawcourses.com</p>
        </div>
      `,
    });

    req.log.info({ orderRef, buyerEmail, code, emailSent: sent }, "Shopify order fulfilled — activation code created");
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err, orderRef }, "Failed to fulfil Shopify order");
    res.status(500).json({ error: "Fulfilment failed" });
  }
});

export default router;
