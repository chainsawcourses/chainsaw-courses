import { Router } from "express";
import { db, assessmentVenuesTable, assessmentPassportsTable, assessmentEnquiriesTable, usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import {
  sendCandidateConfirmation,
  sendBatchEmailToVenue,
} from "../lib/gatewayEmails";

const router = Router();

function nextBatchDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  let next: Date;
  if (day < 15) {
    next = new Date(year, month, 15);
  } else {
    next = new Date(year, month + 1, 1);
  }
  return next.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

async function requireGatewayUser(req: import("express").Request, res: import("express").Response) {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing credentials" });
    return null;
  }
  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorised" });
    return null;
  }
  return user;
}

// GET /api/gateway/venues — all active venues
router.get("/gateway/venues", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;
    const venues = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.active, true));
    res.json(venues);
  } catch (err) {
    logger.error({ err }, "Failed to fetch gateway venues");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/gateway/passport
router.get("/gateway/passport", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;
    const [passport] = await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.userId, user.id));
    res.json(passport ?? null);
  } catch (err) {
    logger.error({ err }, "Failed to fetch gateway passport");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/gateway/passport — create or update
router.post("/gateway/passport", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;
    const { postcode, phone, ppeConfirmed, competenceConfirmed, gdprConfirmed } = req.body as {
      postcode: string; phone: string; ppeConfirmed: boolean; competenceConfirmed: boolean; gdprConfirmed: boolean;
    };
    if (!postcode || !phone || !ppeConfirmed || !competenceConfirmed || !gdprConfirmed) {
      res.status(400).json({ error: "All fields required" });
      return;
    }
    const existing = await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.userId, user.id));
    if (existing.length > 0) {
      await db.update(assessmentPassportsTable)
        .set({ postcode, phone, ppeConfirmed, competenceConfirmed, gdprConfirmed, completedAt: new Date() })
        .where(eq(assessmentPassportsTable.userId, user.id));
    } else {
      await db.insert(assessmentPassportsTable).values({
        userId: user.id, postcode, phone, ppeConfirmed, competenceConfirmed, gdprConfirmed,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save gateway passport");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/gateway/enquiries — user's active enquiries
router.get("/gateway/enquiries", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;
    const enquiries = await db.select().from(assessmentEnquiriesTable).where(eq(assessmentEnquiriesTable.userId, user.id));
    res.json(enquiries);
  } catch (err) {
    logger.error({ err }, "Failed to fetch gateway enquiries");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/gateway/enquiries — register interest in a venue
router.post("/gateway/enquiries", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;

    const { venueId } = req.body as { venueId: number };
    if (!venueId) { res.status(400).json({ error: "venueId required" }); return; }

    const [venue] = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.id, venueId));
    if (!venue) { res.status(404).json({ error: "Venue not found" }); return; }

    const [passport] = await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.userId, user.id));
    if (!passport) { res.status(400).json({ error: "Complete Assessment Passport first" }); return; }

    // Check for existing active enquiry for this user+venue
    const existing = await db.select().from(assessmentEnquiriesTable).where(
      and(
        eq(assessmentEnquiriesTable.userId, user.id),
        eq(assessmentEnquiriesTable.venueId, venueId),
        ne(assessmentEnquiriesTable.status, "resolved"),
        ne(assessmentEnquiriesTable.status, "expired"),
      )
    );
    if (existing.length > 0) {
      res.json({ ok: true, existing: true });
      return;
    }

    const resolveToken = randomUUID();
    await db.insert(assessmentEnquiriesTable).values({
      userId: user.id,
      venueId,
      status: "pending",
      resolveToken,
    });

    // Send confirmation to candidate
    const batchDate = nextBatchDate();
    await sendCandidateConfirmation(
      { fullName: user.fullName, email: user.email, postcode: passport.postcode, phone: passport.phone },
      venue,
      batchDate,
    ).catch(() => {});

    // Check if pool of 4 reached — fire immediately if so
    const poolSize = await db.select().from(assessmentEnquiriesTable).where(
      and(
        eq(assessmentEnquiriesTable.venueId, venueId),
        ne(assessmentEnquiriesTable.status, "resolved"),
        ne(assessmentEnquiriesTable.status, "expired"),
      )
    );

    if (poolSize.length >= 4) {
      const candidates = await Promise.all(
        poolSize.slice(0, 4).map(async (e) => {
          const [u] = await db.select().from(usersTable).where(eq(usersTable.id, e.userId));
          const [p] = await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.userId, e.userId));
          return { fullName: u.fullName, email: u.email, postcode: p?.postcode ?? "—", phone: p?.phone ?? "—" };
        })
      );
      await sendBatchEmailToVenue(venue, candidates, true).catch(() => {});
      // Mark all as batch_sent
      await db.update(assessmentEnquiriesTable)
        .set({ batchSentAt: new Date() })
        .where(and(eq(assessmentEnquiriesTable.venueId, venueId), ne(assessmentEnquiriesTable.status, "resolved")));
      logger.info({ venueId, poolSize: poolSize.length }, "Pool of 4 reached — immediate group email sent");
    }

    res.json({ ok: true, existing: false });
  } catch (err) {
    logger.error({ err }, "Failed to register gateway enquiry");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/gateway/resolve/:token — handle nudge response links from email
router.get("/gateway/resolve/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const action = (req.query["action"] as string) ?? "resolved";

    const [enquiry] = await db.select().from(assessmentEnquiriesTable).where(eq(assessmentEnquiriesTable.resolveToken, token));
    if (!enquiry) {
      res.status(404).send("<h2>Link not found or already used.</h2>");
      return;
    }

    if (action === "resolved") {
      await db.update(assessmentEnquiriesTable)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(assessmentEnquiriesTable.id, enquiry.id));
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2 style="color:#16a34a;">✅ Updates cancelled</h2>
        <p>Great news — your enquiry has been marked as resolved. No further emails will be sent.</p>
        <p style="color:#6b7280;font-size:13px;">You can close this tab.</p>
        </body></html>
      `);
    } else if (action === "followup") {
      await db.update(assessmentEnquiriesTable)
        .set({ status: "followup_requested", followupRequestedAt: new Date() })
        .where(eq(assessmentEnquiriesTable.id, enquiry.id));
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2 style="color:#d97706;">📧 Follow-up requested</h2>
        <p>We'll send a follow-up to the venue on your behalf. You'll hear from us again in a few days if there's still no response.</p>
        <p style="color:#6b7280;font-size:13px;">You can close this tab.</p>
        </body></html>
      `);
    } else {
      res.status(400).send("<h2>Unknown action.</h2>");
    }
  } catch (err) {
    logger.error({ err }, "Failed to resolve gateway enquiry");
    res.status(500).send("<h2>Something went wrong.</h2>");
  }
});

export default router;
