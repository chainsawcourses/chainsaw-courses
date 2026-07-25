import { Router } from "express";
import { db, assessmentVenuesTable, assessmentEnquiriesTable, assessmentPassportsTable, usersTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/admin/gateway/venues
router.get("/admin/gateway/venues", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const venues = await db.select().from(assessmentVenuesTable).orderBy(assessmentVenuesTable.county, assessmentVenuesTable.name);
    res.json(venues);
  } catch (err) {
    logger.error({ err }, "Failed to list gateway venues");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/gateway/venues
router.post("/admin/gateway/venues", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const { name, address, town, county, postcode, lat, lng, email, phone, website, tier, notes } = req.body as {
      name: string; address: string; town: string; county: string; postcode: string;
      lat: number; lng: number; email: string; phone: string;
      website?: string; tier: string; notes?: string;
    };
    if (!name || !address || !town || !county || !postcode || !lat || !lng || !email || !phone) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }
    const [venue] = await db.insert(assessmentVenuesTable).values({
      name, address, town, county, postcode, lat, lng, email, phone,
      website: website ?? null, tier: tier ?? "silver", notes: notes ?? null, active: true,
    }).returning();
    res.json(venue);
  } catch (err) {
    logger.error({ err }, "Failed to create gateway venue");
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /api/admin/gateway/venues/:id
router.put("/admin/gateway/venues/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const id = Number(req.params["id"]);
    const { name, address, town, county, postcode, lat, lng, email, phone, website, tier, active, notes } = req.body as {
      name: string; address: string; town: string; county: string; postcode: string;
      lat: number; lng: number; email: string; phone: string;
      website?: string; tier: string; active: boolean; notes?: string;
    };
    const [updated] = await db.update(assessmentVenuesTable)
      .set({ name, address, town, county, postcode, lat, lng, email, phone, website: website ?? null, tier, active, notes: notes ?? null })
      .where(eq(assessmentVenuesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Venue not found" }); return; }
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update gateway venue");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /api/admin/gateway/venues/:id — hard delete
router.delete("/admin/gateway/venues/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const id = Number(req.params["id"]);
    await db.delete(assessmentVenuesTable).where(eq(assessmentVenuesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete gateway venue");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/gateway/enquiries — full pipeline view
router.get("/admin/gateway/enquiries", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const enquiries = await db
      .select({
        enquiry: assessmentEnquiriesTable,
        venue: assessmentVenuesTable,
        user: usersTable,
        passport: assessmentPassportsTable,
      })
      .from(assessmentEnquiriesTable)
      .leftJoin(assessmentVenuesTable, eq(assessmentEnquiriesTable.venueId, assessmentVenuesTable.id))
      .leftJoin(usersTable, eq(assessmentEnquiriesTable.userId, usersTable.id))
      .leftJoin(assessmentPassportsTable, eq(assessmentEnquiriesTable.userId, assessmentPassportsTable.userId))
      .orderBy(desc(assessmentEnquiriesTable.createdAt));
    res.json(enquiries);
  } catch (err) {
    logger.error({ err }, "Failed to list gateway enquiries");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/gateway/enquiries/:id/resolve — admin manual resolve
router.post("/admin/gateway/enquiries/:id/resolve", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const id = Number(req.params["id"]);
    await db.update(assessmentEnquiriesTable)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(assessmentEnquiriesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to resolve enquiry");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/gateway/pool-status — pool sizes per venue
router.get("/admin/gateway/pool-status", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorised" }); return; }
  try {
    const venues = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.active, true));
    const result = await Promise.all(venues.map(async (v) => {
      const pool = await db.select().from(assessmentEnquiriesTable).where(
        eq(assessmentEnquiriesTable.venueId, v.id),
      ).then(rows => rows.filter(r => r.status !== "resolved" && r.status !== "expired"));
      return { venue: v, poolSize: pool.length };
    }));
    res.json(result.filter(r => r.poolSize > 0));
  } catch (err) {
    logger.error({ err }, "Failed to get pool status");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
