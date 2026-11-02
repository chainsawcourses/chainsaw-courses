import { Router } from "express";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  chainsawRetailersTable,
  chainsawRetailerFeaturedHistoryTable,
  chainsawRetailerReminderAttemptTable,
  chainsawRetailerVerificationHistoryTable,
} from "@workspace/db";
import {
  CreateRetailerLogoUploadBody,
  CreateRetailerLogoUploadResponse,
  UpdateRetailerLogoBody,
  UpdateRetailerLogoResponse,
} from "@workspace/api-zod";
import { getAuthenticatedAdminIdentity, verifyAdmin } from "./admin";
import {
  resolveVenueCoordinates,
  VENUE_MAPPING_ERROR,
  VENUE_MAPPING_SERVICE_ERROR,
  VenueMappingServiceError,
} from "../lib/gatewayVenue";
import { logger } from "../lib/logger";
import {
  createRetailerLogoUpload,
  deleteRetailerLogoObject,
  getRetailerLogoObject,
  retailerLogoObjectIdFromKey,
} from "../lib/assessmentMediaStorage";

const router = Router();
const VERIFICATION_STATUSES = new Set(["pending", "verified", "rejected"]);
const REMINDER_CLAIM_LEASE_MS = 30 * 60 * 1_000;
const RETAILER_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const RETAILER_LOGO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type RetailerBody = {
  name?: unknown;
  address?: unknown;
  town?: unknown;
  county?: unknown;
  postcode?: unknown;
  lat?: unknown;
  lng?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  active?: unknown;
  featured?: unknown;
  verificationStatus?: unknown;
  evidenceUrl?: unknown;
  lastCheckedAt?: unknown;
  notes?: unknown;
};

type ReverifyRetailerBody = {
  evidenceUrl?: unknown;
};

type PreparedRetailer = {
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website: string | null;
  active: boolean;
  featured: boolean;
  verificationStatus: string;
  evidenceUrl: string | null;
  lastCheckedAt: Date | null;
  notes: string | null;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalisePostcode(value: unknown): string {
  return stringValue(value).replace(/\s+/g, " ").toUpperCase();
}

function normaliseDedupText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dedupKey(input: Pick<PreparedRetailer, "name" | "postcode" | "address" | "town" | "county">): string {
  const name = normaliseDedupText(input.name)
    .replace(/\b(?:limited|ltd|plc|llp|incorporated|inc)\s*$/, "")
    .trim();
  const address = normaliseDedupText(input.address);
  const town = normaliseDedupText(input.town);
  const postcode = normalisePostcode(input.postcode).replace(/[^A-Z0-9]/g, "");
  // A postcode alone is not a physical location: a retailer can have several
  // genuine branches within one postcode. Prefer the full street address and
  // town, using postcode/locality only when an address is unavailable.
  const location = address
    ? `${address}|${town}`
    : `${postcode}|${town}|${normaliseDedupText(input.county)}`;
  return `${name}|${location}`;
}

function optionalText(value: unknown): string | null {
  const text = stringValue(value);
  return text || null;
}

function validEvidenceUrl(value: unknown): string | null {
  const text = stringValue(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseDate(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function parseCoordinates(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return undefined;
}

async function prepareRetailer(body: RetailerBody, defaults?: { active?: boolean; featured?: boolean }): Promise<
  | { ok: true; value: PreparedRetailer }
  | { ok: false; status: number; error: string }
> {
  const name = stringValue(body.name);
  if (!name) return { ok: false, status: 400, error: "Please enter a retailer name." };

  const postcode = normalisePostcode(body.postcode);
  const lat = parseCoordinates(body.lat);
  const lng = parseCoordinates(body.lng);
  let coordinates: { lat: number; lng: number } | null;
  try {
    coordinates = await resolveVenueCoordinates({ postcode, lat, lng });
  } catch (err) {
    if (err instanceof VenueMappingServiceError) {
      return { ok: false, status: 503, error: VENUE_MAPPING_SERVICE_ERROR };
    }
    throw err;
  }
  if (!coordinates) return { ok: false, status: 422, error: VENUE_MAPPING_ERROR };

  const verificationStatus = stringValue(body.verificationStatus) || "pending";
  if (!VERIFICATION_STATUSES.has(verificationStatus)) {
    return {
      ok: false,
      status: 400,
      error: "verificationStatus must be pending, verified, or rejected.",
    };
  }

  const lastCheckedAt = parseDate(body.lastCheckedAt);
  if (lastCheckedAt === "invalid") {
    return { ok: false, status: 400, error: "lastCheckedAt must be a valid date." };
  }
  if (body.featured !== undefined && typeof body.featured !== "boolean") {
    return { ok: false, status: 400, error: "featured must be true or false." };
  }

  return {
    ok: true,
    value: {
      name,
      address: stringValue(body.address),
      town: stringValue(body.town),
      county: stringValue(body.county),
      postcode,
      lat: coordinates.lat,
      lng: coordinates.lng,
      email: stringValue(body.email),
      phone: stringValue(body.phone),
      website: optionalText(body.website),
      active: typeof body.active === "boolean" ? body.active : defaults?.active ?? true,
      featured: typeof body.featured === "boolean" ? body.featured : defaults?.featured ?? false,
      verificationStatus,
      evidenceUrl: optionalText(body.evidenceUrl),
      lastCheckedAt,
      notes: optionalText(body.notes),
    },
  };
}

function retailerInsertValues(value: PreparedRetailer) {
  return {
    ...value,
    updatedAt: new Date(),
  };
}

function retailerDetailUpdateValues(value: PreparedRetailer) {
  return {
    name: value.name,
    address: value.address,
    town: value.town,
    county: value.county,
    postcode: value.postcode,
    lat: value.lat,
    lng: value.lng,
    email: value.email,
    phone: value.phone,
    website: value.website,
    active: value.active,
    featured: value.featured,
    notes: value.notes,
    updatedAt: new Date(),
  };
}

function adminOnly(req: Parameters<typeof verifyAdmin>[0], res: import("express").Response): boolean {
  if (verifyAdmin(req)) return true;
  res.status(401).json({ error: "Unauthorised" });
  return false;
}

// GET /api/admin/retailers
router.get("/admin/retailers", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const retailers = await db
      .select()
      .from(chainsawRetailersTable)
      .orderBy(desc(chainsawRetailersTable.featured), asc(chainsawRetailersTable.name));
    res.json(retailers);
  } catch (err) {
    logger.error({ err }, "Failed to list retailers");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/retailers/:id/logo-upload", async (req, res): Promise<void> => {
  if (!adminOnly(req, res)) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid retailer id." });
    return;
  }
  const body = CreateRetailerLogoUploadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Choose a PNG, JPEG, or WebP image up to 5 MB." });
    return;
  }
  if (!RETAILER_LOGO_CONTENT_TYPES.has(body.data.contentType)) {
    res.status(400).json({ error: "Choose a PNG, JPEG, or WebP image up to 5 MB." });
    return;
  }

  try {
    const [retailer] = await db
      .select({ id: chainsawRetailersTable.id })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }

    const upload = await createRetailerLogoUpload(id);
    res.json(CreateRetailerLogoUploadResponse.parse(upload));
  } catch (err) {
    req.log.error({ err, retailerId: id }, "Failed to prepare retailer logo upload");
    res.status(503).json({ error: "Logo storage is unavailable" });
  }
});

router.put("/admin/retailers/:id/logo", async (req, res): Promise<void> => {
  if (!adminOnly(req, res)) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid retailer id." });
    return;
  }
  const body = UpdateRetailerLogoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid retailer logo reference." });
    return;
  }

  const objectKey = body.data.objectKey;
  let canCleanUpNewUploadOnError = false;
  try {
    const [existing] = await db
      .select({ logoObjectKey: chainsawRetailersTable.logoObjectKey })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    canCleanUpNewUploadOnError = Boolean(objectKey && objectKey !== existing.logoObjectKey);

    if (objectKey && objectKey !== existing.logoObjectKey) {
      if (!retailerLogoObjectIdFromKey(objectKey, id)) {
        res.status(400).json({ error: "Uploaded logo does not belong to this retailer." });
        return;
      }
      let file: Awaited<ReturnType<typeof getRetailerLogoObject>> = null;
      try {
        file = await getRetailerLogoObject(objectKey, id);
      } catch (err) {
        req.log.error({ err, retailerId: id }, "Failed to inspect retailer logo upload");
        res.status(503).json({ error: "Logo storage is unavailable" });
        return;
      }
      if (!file) {
        res.status(404).json({ error: "Uploaded logo not found" });
        return;
      }

      let metadata;
      try {
        [metadata] = await file.getMetadata();
      } catch (err) {
        req.log.error({ err, retailerId: id }, "Failed to inspect retailer logo metadata");
        res.status(503).json({ error: "Logo storage is unavailable" });
        return;
      }
      const size = Number(metadata.size ?? 0);
      const contentType = String(metadata.contentType ?? "");
      if (size <= 0 || size > RETAILER_LOGO_MAX_BYTES || !RETAILER_LOGO_CONTENT_TYPES.has(contentType)) {
        try {
          await deleteRetailerLogoObject(objectKey, id);
        } catch (err) {
          req.log.warn({ err, retailerId: id }, "Invalid retailer logo cleanup deferred");
        }
        res.status(400).json({ error: "Uploaded logo must be a PNG, JPEG, or WebP image up to 5 MB." });
        return;
      }
    }

    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from chainsaw_retailers where id = ${id} for update`);
      const [current] = await tx
        .select({ logoObjectKey: chainsawRetailersTable.logoObjectKey })
        .from(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .limit(1);
      if (!current) return { found: false as const, previousObjectKey: null };

      await tx
        .update(chainsawRetailersTable)
        .set({ logoObjectKey: objectKey, updatedAt: new Date() })
        .where(eq(chainsawRetailersTable.id, id));
      return { found: true as const, previousObjectKey: current.logoObjectKey };
    });
    if (!outcome.found) {
      if (objectKey && objectKey !== existing.logoObjectKey) {
        await deleteRetailerLogoObject(objectKey, id).catch((err) => {
          req.log.warn({ err, retailerId: id }, "Unattached retailer logo cleanup deferred");
        });
      }
      res.status(404).json({ error: "Retailer not found" });
      return;
    }

    if (outcome.previousObjectKey && outcome.previousObjectKey !== objectKey) {
      try {
        await deleteRetailerLogoObject(outcome.previousObjectKey, id);
      } catch (err) {
        req.log.warn({ err, retailerId: id }, "Replaced retailer logo cleanup deferred");
      }
    }
    res.json(UpdateRetailerLogoResponse.parse({ logoObjectKey: objectKey }));
  } catch (err) {
    if (objectKey && canCleanUpNewUploadOnError) {
      try {
        const [current] = await db
          .select({ logoObjectKey: chainsawRetailersTable.logoObjectKey })
          .from(chainsawRetailersTable)
          .where(eq(chainsawRetailersTable.id, id))
          .limit(1);
        if (!current || current.logoObjectKey !== objectKey) {
          await deleteRetailerLogoObject(objectKey, id);
        }
      } catch (cleanupError) {
        req.log.warn({ err: cleanupError, retailerId: id }, "Unattached retailer logo cleanup deferred");
      }
    }
    req.log.error({ err, retailerId: id }, "Failed to update retailer logo");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/retailers/:id/verification-history
router.get("/admin/retailers/:id/verification-history", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    const [retailer] = await db
      .select({ id: chainsawRetailersTable.id })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    const history = await db
      .select()
      .from(chainsawRetailerVerificationHistoryTable)
      .where(eq(chainsawRetailerVerificationHistoryTable.retailerId, id))
      .orderBy(
        desc(chainsawRetailerVerificationHistoryTable.recordedAt),
        desc(chainsawRetailerVerificationHistoryTable.id),
      );
    res.json(history);
  } catch (err) {
    logger.error({ err }, "Failed to list retailer verification history");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/retailers/:id/featured-history
router.get("/admin/retailers/:id/featured-history", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    const [retailer] = await db
      .select({ id: chainsawRetailersTable.id })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    const history = await db
      .select()
      .from(chainsawRetailerFeaturedHistoryTable)
      .where(eq(chainsawRetailerFeaturedHistoryTable.retailerId, id))
      .orderBy(
        desc(chainsawRetailerFeaturedHistoryTable.recordedAt),
        desc(chainsawRetailerFeaturedHistoryTable.id),
      );
    res.json(history);
  } catch (err) {
    logger.error({ err }, "Failed to list retailer featured history");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/retailers/:id/reminder-attempts
router.get("/admin/retailers/:id/reminder-attempts", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    const [retailer] = await db
      .select({ id: chainsawRetailersTable.id })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    const attempts = await db
      .select()
      .from(chainsawRetailerReminderAttemptTable)
      .where(eq(chainsawRetailerReminderAttemptTable.retailerId, id))
      .orderBy(
        desc(chainsawRetailerReminderAttemptTable.attemptedAt),
        desc(chainsawRetailerReminderAttemptTable.id),
      );
    res.json(attempts);
  } catch (err) {
    logger.error({ err }, "Failed to list retailer reminder attempts");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/retailers
router.post("/admin/retailers", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const prepared = await prepareRetailer(req.body as RetailerBody);
    if (!prepared.ok) {
      res.status(prepared.status).json({ error: prepared.error });
      return;
    }
    const [retailer] = await db
      .insert(chainsawRetailersTable)
      .values(retailerInsertValues(prepared.value))
      .returning();
    res.json(retailer);
  } catch (err) {
    logger.error({ err }, "Failed to create retailer");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/retailers/import
router.post("/admin/retailers/import", async (req, res) => {
  if (!adminOnly(req, res)) return;

  const rows = Array.isArray(req.body) ? req.body : req.body?.rows;
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "rows must be an array" });
    return;
  }

  try {
    // Load once so duplicate detection covers both existing records and rows
    // already accepted in this import, without retaining postcode input.
    const existing = await db.select().from(chainsawRetailersTable);
    const keys = new Map(existing.map((retailer) => [dedupKey(retailer), retailer]));
    const results: Array<Record<string, unknown>> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        results.push({ row: index + 1, status: "error", error: "Each row must be an object." });
        continue;
      }

      try {
        const prepared = await prepareRetailer(row as RetailerBody);
        if (!prepared.ok) {
          results.push({ row: index + 1, status: "error", error: prepared.error });
          continue;
        }
        const key = dedupKey(prepared.value);
        const duplicate = keys.get(key);
        if (duplicate) {
          results.push({ row: index + 1, status: "duplicate", retailer: duplicate });
          continue;
        }

        const [retailer] = await db
          .insert(chainsawRetailersTable)
          .values(retailerInsertValues(prepared.value))
          .returning();
        keys.set(key, retailer);
        results.push({ row: index + 1, status: "created", retailer });
      } catch (err) {
        if (err instanceof VenueMappingServiceError) {
          results.push({ row: index + 1, status: "error", error: VENUE_MAPPING_SERVICE_ERROR });
        } else {
          throw err;
        }
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((result) => result.status === "created").length,
      duplicate: results.filter((result) => result.status === "duplicate").length,
      error: results.filter((result) => result.status === "error").length,
    };
    res.json({ results, summary });
  } catch (err) {
    logger.error({ err }, "Failed to import retailers");
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /api/admin/retailers/:id
router.put("/admin/retailers/:id", async (req, res) => {
  const actorIdentity = getAuthenticatedAdminIdentity(req);
  if (!actorIdentity) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    const [existing] = await db
      .select({ postcode: chainsawRetailersTable.postcode })
      .from(chainsawRetailersTable)
      .where(eq(chainsawRetailersTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    const body = req.body as RetailerBody;
    const postcodeChanged = normalisePostcode(body.postcode) !== normalisePostcode(existing.postcode);
    const prepared = await prepareRetailer(postcodeChanged ? { ...body, lat: undefined, lng: undefined } : body);
    if (!prepared.ok) {
      res.status(prepared.status).json({ error: prepared.error });
      return;
    }
    const retailer = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from chainsaw_retailers where id = ${id} for update`);
      const [lockedRetailer] = await tx
        .select({ featured: chainsawRetailersTable.featured })
        .from(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .limit(1);
      if (!lockedRetailer) return undefined;

      const changedAt = new Date();
      const [updated] = await tx
        .update(chainsawRetailersTable)
        .set({
          ...retailerDetailUpdateValues(prepared.value),
          updatedAt: changedAt,
        })
        .where(eq(chainsawRetailersTable.id, id))
        .returning();

      if (lockedRetailer.featured !== prepared.value.featured) {
        await tx.insert(chainsawRetailerFeaturedHistoryTable).values({
          retailerId: id,
          priorFeatured: lockedRetailer.featured,
          newFeatured: prepared.value.featured,
          actorIdentity,
          recordedAt: changedAt,
        });
      }
      return updated;
    });
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    res.json(retailer);
  } catch (err) {
    logger.error({ err }, "Failed to update retailer");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /api/admin/retailers/:id/reverify
// This deliberately updates only verification evidence so a routine review
// cannot overwrite newer contact, location or visibility details.
router.patch("/admin/retailers/:id/reverify", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    const evidenceUrl = validEvidenceUrl((req.body as ReverifyRetailerBody).evidenceUrl);
    if (!evidenceUrl) {
      res.status(400).json({ error: "Please enter a valid HTTP or HTTPS evidence URL." });
      return;
    }
    const retailer = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from chainsaw_retailers where id = ${id} for update`);
      const [existing] = await tx
        .select({
          evidenceUrl: chainsawRetailersTable.evidenceUrl,
          lastCheckedAt: chainsawRetailersTable.lastCheckedAt,
          reviewDueReminderClaimedAt: chainsawRetailersTable.reviewDueReminderClaimedAt,
          reviewOverdueReminderClaimedAt: chainsawRetailersTable.reviewOverdueReminderClaimedAt,
        })
        .from(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .limit(1);
      if (!existing) return undefined;

      const checkedAt = new Date();
      const activeClaimCutoff = new Date(checkedAt.getTime() - REMINDER_CLAIM_LEASE_MS);
      const [updated] = await tx
        .update(chainsawRetailersTable)
        .set({
          evidenceUrl,
          lastCheckedAt: checkedAt,
          verificationStatus: "verified",
          reviewDueReminderClaimedAt: existing.reviewDueReminderClaimedAt
            && existing.reviewDueReminderClaimedAt > activeClaimCutoff
            ? existing.reviewDueReminderClaimedAt
            : null,
          reviewDueReminderSentAt: null,
          reviewDueReminderFailedAt: null,
          reviewOverdueReminderClaimedAt: existing.reviewOverdueReminderClaimedAt
            && existing.reviewOverdueReminderClaimedAt > activeClaimCutoff
            ? existing.reviewOverdueReminderClaimedAt
            : null,
          reviewOverdueReminderSentAt: null,
          reviewOverdueReminderFailedAt: null,
          updatedAt: checkedAt,
        })
        .where(eq(chainsawRetailersTable.id, id))
        .returning();

      await tx.insert(chainsawRetailerVerificationHistoryTable).values({
        retailerId: id,
        priorEvidenceUrl: existing.evidenceUrl,
        priorCheckedAt: existing.lastCheckedAt,
        newEvidenceUrl: evidenceUrl,
        newCheckedAt: checkedAt,
        recordedAt: checkedAt,
      });
      return updated;
    });
    if (!retailer) {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    res.json(retailer);
  } catch (err) {
    logger.error({ err }, "Failed to re-verify retailer");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /api/admin/retailers/:id
router.delete("/admin/retailers/:id", async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid retailer id." });
      return;
    }
    let deletedLogoObjectKey: string | null = null;
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from chainsaw_retailers where id = ${id} for update`);
      const [retailer] = await tx
        .select({
          id: chainsawRetailersTable.id,
          logoObjectKey: chainsawRetailersTable.logoObjectKey,
        })
        .from(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .limit(1);
      if (!retailer) return "not-found" as const;

      const [activeClaim] = await tx
        .select({
          due: chainsawRetailersTable.reviewDueReminderClaimedAt,
          overdue: chainsawRetailersTable.reviewOverdueReminderClaimedAt,
        })
        .from(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .limit(1);
      const activeClaimCutoff = new Date(Date.now() - REMINDER_CLAIM_LEASE_MS);
      if (
        (activeClaim?.due && activeClaim.due > activeClaimCutoff)
        || (activeClaim?.overdue && activeClaim.overdue > activeClaimCutoff)
      ) return "active-reminder" as const;

      const [verificationHistoryEvent] = await tx
        .select({ id: chainsawRetailerVerificationHistoryTable.id })
        .from(chainsawRetailerVerificationHistoryTable)
        .where(eq(chainsawRetailerVerificationHistoryTable.retailerId, id))
        .limit(1);
      const [featuredHistoryEvent] = await tx
        .select({ id: chainsawRetailerFeaturedHistoryTable.id })
        .from(chainsawRetailerFeaturedHistoryTable)
        .where(eq(chainsawRetailerFeaturedHistoryTable.retailerId, id))
        .limit(1);
      const [reminderAttempt] = await tx
        .select({ id: chainsawRetailerReminderAttemptTable.id })
        .from(chainsawRetailerReminderAttemptTable)
        .where(eq(chainsawRetailerReminderAttemptTable.retailerId, id))
        .limit(1);
      if (verificationHistoryEvent || featuredHistoryEvent || reminderAttempt) return "has-history" as const;

      const deleted = await tx
        .delete(chainsawRetailersTable)
        .where(eq(chainsawRetailersTable.id, id))
        .returning({ logoObjectKey: chainsawRetailersTable.logoObjectKey });
      deletedLogoObjectKey = deleted[0]?.logoObjectKey ?? retailer.logoObjectKey;
      return deleted.length ? "deleted" as const : "not-found" as const;
    });
    if (outcome === "has-history") {
      res.status(409).json({
        error: "This retailer has verification history, featured-status history, or reminder history and cannot be permanently deleted. Mark it inactive instead.",
      });
      return;
    }
    if (outcome === "active-reminder") {
      res.status(409).json({
        error: "This retailer has a reminder delivery in progress and cannot be permanently deleted. Try again after it finishes.",
      });
      return;
    }
    if (outcome === "not-found") {
      res.status(404).json({ error: "Retailer not found" });
      return;
    }
    if (deletedLogoObjectKey) {
      try {
        await deleteRetailerLogoObject(deletedLogoObjectKey, id);
      } catch (err) {
        req.log.warn({ err, retailerId: id }, "Deleted retailer logo cleanup deferred");
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete retailer");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;