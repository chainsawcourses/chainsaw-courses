import { Router } from "express";
import { randomInt } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { SubmitWebsitePurchaseBody } from "@workspace/api-zod";
import { db, activationCodesTable, websitePurchaseSeatsTable } from "@workspace/db";
import { sendEmail } from "../lib/email";
import { verifyWebsitePurchaseSignature } from "../lib/websitePurchaseSignature";

const router = Router();
// REST numeric IDs are shared with the existing Shopify webhook. The website
// must turn GraphQL GIDs into their trailing numeric IDs before signing.
const purchase = SubmitWebsitePurchaseBody.strict().superRefine((v, ctx) => {
  if (v.event === "purchase.confirmed" && !v.email) {
    ctx.addIssue({ code: "custom", message: "email is required for a confirmed purchase", path: ["email"] });
  }
});

function newCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length: number) => Array.from({ length }, () => chars[randomInt(chars.length)]).join("");
  return `CC-${part(6)}-${part(4)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

router.post("/website/purchases", async (req, res) => {
  const secret = process.env.WEBSITE_PURCHASE_SECRET?.trim();
  if (!secret) {
    req.log.error("WEBSITE_PURCHASE_SECRET is not configured");
    res.status(503).json({ error: "Purchase bridge is unavailable" });
    return;
  }
  const header = (name: string) => {
    const value = req.headers[name];
    return typeof value === "string" ? value : undefined;
  };
  if (!verifyWebsitePurchaseSignature(
    (req as typeof req & { rawBody?: Buffer }).rawBody,
    header("x-cc-timestamp"),
    header("x-cc-signature"),
    secret,
  )) {
    res.status(401).json({ error: "Invalid purchase signature" });
    return;
  }
  const parsed = purchase.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid purchase event" });
    return;
  }
  const { event, orderId, lineItemId, seatId } = parsed.data;
  const email = parsed.data.email?.trim().toLowerCase();
  const buyerName = parsed.data.buyerName?.trim() || "Learner";
  const isReversal = event !== "purchase.confirmed";

  try {
    const result = await db.transaction(async (tx) => {
      // The direct Shopify webhook and every seat in this order share a lock.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"shopify-order:" + orderId}))`);
      const [seat] = await tx.select().from(websitePurchaseSeatsTable).where(and(
        eq(websitePurchaseSeatsTable.orderId, orderId),
        eq(websitePurchaseSeatsTable.lineItemId, lineItemId),
        eq(websitePurchaseSeatsTable.seatId, seatId),
      )).limit(1);

      if (isReversal) {
        if (!seat) {
          // A direct Shopify webhook may already have issued one code for this
          // order. We cannot map an individual refunded seat onto that code.
          const [legacy] = await tx.select({ id: activationCodesTable.id })
            .from(activationCodesTable)
            .where(like(activationCodesTable.notes, `Shopify order id ${orderId} |%`))
            .limit(1);
          if (legacy) return { status: "conflict" as const };
          await tx.insert(websitePurchaseSeatsTable).values({
            orderId, lineItemId, seatId, status: "revoked", emailStatus: "not_applicable",
          });
          return { status: "revoked" as const };
        }
        if (seat.status !== "revoked") {
          await tx.update(websitePurchaseSeatsTable).set({ status: "revoked", updatedAt: new Date() })
            .where(eq(websitePurchaseSeatsTable.id, seat.id));
          if (seat.activationCodeId) {
            await tx.update(activationCodesTable).set({ isPaused: true })
              .where(eq(activationCodesTable.id, seat.activationCodeId));
          }
        }
        return { status: "revoked" as const };
      }

      if (seat) {
        if (seat.status === "revoked") return { status: "revoked" as const };
        if (seat.email !== email) return { status: "conflict" as const };
        return { status: "active" as const, seatId: seat.id };
      }
      // Legacy direct webhook issued ONE code for the whole order. Its seat
      // identity cannot be inferred; never silently issue additional codes.
      const [orderSeat] = await tx.select({ id: websitePurchaseSeatsTable.id })
        .from(websitePurchaseSeatsTable)
        .where(eq(websitePurchaseSeatsTable.orderId, orderId)).limit(1);
      if (!orderSeat) {
        const [legacy] = await tx.select({ id: activationCodesTable.id })
          .from(activationCodesTable)
          .where(like(activationCodesTable.notes, `Shopify order id ${orderId} |%`))
          .limit(1);
        if (legacy) return { status: "conflict" as const };
      }

      let codeId: number | undefined;
      for (let attempt = 0; attempt < 10 && !codeId; attempt++) {
        const [inserted] = await tx.insert(activationCodesTable).values({
          code: newCode(),
          assignedTo: email,
          notes: `Shopify order id ${orderId} | line ${lineItemId} seat ${seatId}`,
        }).onConflictDoNothing({ target: activationCodesTable.code })
          .returning({ id: activationCodesTable.id });
        codeId = inserted?.id;
      }
      if (!codeId) throw new Error("Code allocation failed");
      const [created] = await tx.insert(websitePurchaseSeatsTable).values({
        orderId, lineItemId, seatId, email, buyerName,
        activationCodeId: codeId, status: "active", emailStatus: "pending",
      }).returning({ id: websitePurchaseSeatsTable.id });
      return { status: "active" as const, seatId: created.id };
    });
    if (result.status === "conflict") {
      res.status(409).json({ error: "Seat identity conflicts with an existing purchase; manual review required" });
      return;
    }
    if (result.status === "revoked") {
      res.json({ status: "revoked", emailStatus: "not_applicable" });
      return;
    }

    // Commit the code first, then claim the ONE email attempt before contacting
    // SMTP. A timed-out/unknown send is never replayed automatically.
    const [claim] = await db.update(websitePurchaseSeatsTable)
      .set({ emailStatus: "sending", updatedAt: new Date() })
      .where(and(
        eq(websitePurchaseSeatsTable.id, result.seatId),
        eq(websitePurchaseSeatsTable.status, "active"),
        eq(websitePurchaseSeatsTable.emailStatus, "pending"),
      ))
      .returning({ activationCodeId: websitePurchaseSeatsTable.activationCodeId });
    if (claim?.activationCodeId) {
      await db.transaction(async (tx) => {
        // Serialize email dispatch with reversals on this seat. If the refund
        // wins first, no mail is sent; if mail wins first, refund follows it.
        const [seat] = await tx.select().from(websitePurchaseSeatsTable)
          .where(eq(websitePurchaseSeatsTable.id, result.seatId)).for("update");
        if (!seat) throw new Error("Purchase seat missing after claim");
        if (seat.status !== "active" || seat.resolution) {
          await tx.update(websitePurchaseSeatsTable)
            .set({ ...(seat.status !== "active" ? { emailStatus: "not_applicable" } : {}), updatedAt: new Date() })
            .where(eq(websitePurchaseSeatsTable.id, result.seatId));
          return;
        }
        const [code] = await tx.select({ code: activationCodesTable.code })
          .from(activationCodesTable).where(eq(activationCodesTable.id, claim.activationCodeId!));
        if (!code || !seat.email) throw new Error("Purchase code/email missing after claim");
        const url = process.env.APP_URL?.trim() || "https://app.chainsawcourses.com";
        const name = seat.buyerName || "Learner";
        const sent = await sendEmail({
          to: seat.email,
          subject: "Your Chainsaw Courses Access Code",
          text: `Hi ${name},\n\nYour personal Chainsaw Courses access code is:\n\n${code.code}\n\nOpen ${url} and enter your full name, email address and code to begin.\n\nChainsaw Courses`,
          html: `<p>Hi ${escapeHtml(name)},</p><p>Your personal Chainsaw Courses access code is:</p><p><strong>${code.code}</strong></p><p>Open <a href="${escapeHtml(url)}">${escapeHtml(url)}</a> and enter your full name, email address and code to begin.</p><p>Chainsaw Courses</p>`,
        });
        await tx.update(websitePurchaseSeatsTable)
          .set({ emailStatus: sent ? "sent" : "needs_review", updatedAt: new Date() })
          .where(eq(websitePurchaseSeatsTable.id, result.seatId));
      });
    }
    const [current] = await db.select({
      status: websitePurchaseSeatsTable.status,
      emailStatus: websitePurchaseSeatsTable.emailStatus,
    }).from(websitePurchaseSeatsTable).where(eq(websitePurchaseSeatsTable.id, result.seatId));
    res.status(current.emailStatus === "sent" ? 200 : 202).json({
      status: current.status,
      emailStatus: current.emailStatus,
    });
  } catch (err) {
    req.log.error({ err, orderId, lineItemId, seatId }, "Website purchase processing failed");
    res.status(500).json({ error: "Purchase processing failed; retry safely with the same seat identity" });
  }
});

export default router;