import { Router } from "express";
import { db, assessmentVenuesTable, assessmentEnquiriesTable, assessmentPassportsTable, usersTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

async function resolveVenueCoordinates(
  postcode: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
): Promise<{ lat: number; lng: number; resolved: boolean }> {
  if (Number.isFinite(lat) && lat !== 0 && Number.isFinite(lng) && lng !== 0) {
    return { lat: lat!, lng: lng!, resolved: true };
  }
  const compactPostcode = postcode?.replace(/\s+/g, "").toUpperCase();
  if (!compactPostcode) return { lat: 0, lng: 0, resolved: false };

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compactPostcode)}`);
    if (!response.ok) return { lat: 0, lng: 0, resolved: false };
    const data = await response.json() as { result?: { latitude?: number; longitude?: number } };
    const resolvedLat = data.result?.latitude;
    const resolvedLng = data.result?.longitude;
    if (Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)) {
      return { lat: resolvedLat!, lng: resolvedLng!, resolved: true };
    }
  } catch (err) {
    logger.warn({ err, postcode: compactPostcode }, "Failed to geocode gateway venue postcode");
  }
  return { lat: 0, lng: 0, resolved: false };
}

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
    const { name, address, town, county, postcode, lat, lng, email, phone, website, tier, active, notes } = req.body as {
      name: string; address: string; town: string; county: string; postcode: string;
      lat: number; lng: number; email: string; phone: string;
      website?: string; tier: string; active?: boolean; notes?: string;
    };
    if (!String(name ?? "").trim()) {
      res.status(400).json({ error: "Please enter a venue name." }); return;
    }
    const coordinates = await resolveVenueCoordinates(postcode, lat, lng);
    if (!coordinates.resolved) {
      res.status(422).json({
        error: "Enter a valid UK postcode or latitude and longitude so this venue can be added to the map.",
      });
      return;
    }
    const [venue] = await db.insert(assessmentVenuesTable).values({
      name: name.trim(), address: address?.trim() || "", town: town?.trim() || "", county: county?.trim() || "",
      postcode: postcode?.trim().toUpperCase() || "", lat: coordinates.lat, lng: coordinates.lng,
      email: email?.trim() || "", phone: phone?.trim() || "",
      website: website?.trim() || null, tier: tier ?? "silver", notes: notes?.trim() || null,
      active: true,
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
    if (!String(name ?? "").trim()) {
      res.status(400).json({ error: "Please enter a venue name." }); return;
    }
    const coordinates = await resolveVenueCoordinates(postcode, lat, lng);
    if (!coordinates.resolved) {
      res.status(422).json({
        error: "Enter a valid UK postcode or latitude and longitude so this venue can be shown on the map.",
      });
      return;
    }
    const [updated] = await db.update(assessmentVenuesTable)
      .set({
        name: name.trim(), address: address?.trim() || "", town: town?.trim() || "", county: county?.trim() || "",
        postcode: postcode?.trim().toUpperCase() || "", lat: coordinates.lat, lng: coordinates.lng,
        email: email?.trim() || "", phone: phone?.trim() || "", website: website?.trim() || null,
        tier: tier ?? "silver", active, notes: notes?.trim() || null,
      })
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
