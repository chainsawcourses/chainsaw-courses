import { Router, type Request } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, chainsawRetailersTable } from "@workspace/db";
import { GetPublicRetailersResponse } from "@workspace/api-zod";
import { requireGatewayUser } from "./gateway";
import {
  getRetailerLogoObject,
  retailerLogoObjectIdFromKey,
} from "../lib/assessmentMediaStorage";
import {
  resolveVenueCoordinates,
  VENUE_MAPPING_ERROR,
  VENUE_MAPPING_SERVICE_ERROR,
  VenueMappingServiceError,
} from "../lib/gatewayVenue";
import { logger } from "../lib/logger";

const router = Router();

function publicAppOrigin(req: Request): string {
  const requestHost = req.get("host")?.toLowerCase();
  const domains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean);
  const matchingDomain = domains.find((domain) => domain.toLowerCase() === requestHost);
  // Development artifact previews have their own database/object identities.
  // Prefer the matching preview host so their public logo URLs do not point at
  // the production domain with development-only retailer and object IDs.
  if (matchingDomain) return `https://${matchingDomain}`;

  const configuredUrl = process.env.APP_URL?.trim() || process.env.app_url?.trim();
  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl);
      if (configured.protocol === "https:" || configured.protocol === "http:") return configured.origin;
    } catch {
      // Use the deployment's registered domain if an optional URL is malformed.
    }
  }

  if (domains.length > 0) {
    return `https://${domains[0]}`;
  }

  const host = req.get("host");
  if (!host) throw new Error("Unable to determine public app origin");
  return new URL(`${req.protocol === "https" ? "https" : "http"}://${host}`).origin;
}

async function listPublishableRetailers(req: Request) {
  const retailers = await db
    .select({
      id: chainsawRetailersTable.id,
      name: chainsawRetailersTable.name,
      address: chainsawRetailersTable.address,
      town: chainsawRetailersTable.town,
      county: chainsawRetailersTable.county,
      postcode: chainsawRetailersTable.postcode,
      lat: chainsawRetailersTable.lat,
      lng: chainsawRetailersTable.lng,
      email: chainsawRetailersTable.email,
      phone: chainsawRetailersTable.phone,
      website: chainsawRetailersTable.website,
      featured: chainsawRetailersTable.featured,
      logoObjectKey: chainsawRetailersTable.logoObjectKey,
    })
    .from(chainsawRetailersTable)
    .where(and(
      eq(chainsawRetailersTable.active, true),
      eq(chainsawRetailersTable.verificationStatus, "verified"),
    ))
    .orderBy(desc(chainsawRetailersTable.featured), asc(chainsawRetailersTable.name));

  const publicOrigin = publicAppOrigin(req);
  const response = retailers.map(({ logoObjectKey, ...retailer }) => {
    const objectId = logoObjectKey
      ? retailerLogoObjectIdFromKey(logoObjectKey, retailer.id)
      : null;
    return {
      ...retailer,
      logoUrl: objectId
        ? new URL(`/api/retailers/public/logos/${retailer.id}/${objectId}`, publicOrigin).toString()
        : null,
    };
  });
  return GetPublicRetailersResponse.parse(response);
}

// GET /api/retailers/public/logos/:retailerId/:objectId — public retailer branding image.
router.get("/retailers/public/logos/:retailerId/:objectId", async (req, res): Promise<void> => {
  const retailerId = Number(req.params["retailerId"]);
  const objectId = Array.isArray(req.params["objectId"]) ? req.params["objectId"][0] : req.params["objectId"];
  if (!Number.isInteger(retailerId) || retailerId <= 0 || !/^[a-f0-9-]{36}$/.test(objectId)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const objectKey = `retailer-logos/${retailerId}/${objectId}`;
    const [retailer] = await db
      .select({ logoObjectKey: chainsawRetailersTable.logoObjectKey })
      .from(chainsawRetailersTable)
      .where(and(
        eq(chainsawRetailersTable.id, retailerId),
        eq(chainsawRetailersTable.logoObjectKey, objectKey),
      ))
      .limit(1);
    if (!retailer) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const file = await getRetailerLogoObject(objectKey, retailerId);
    if (!file) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType ?? "");
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.createReadStream().on("error", (err) => {
      req.log.error({ err, retailerId }, "Failed to stream retailer logo");
      if (!res.headersSent) res.status(500).end();
      else res.destroy(err);
    }).pipe(res);
  } catch (err) {
    req.log.error({ err, retailerId }, "Failed to fetch retailer logo");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/retailers/public — retailer-only read feed for public storefront maps.
router.get("/retailers/public", async (req, res): Promise<void> => {
  try {
    res.json(await listPublishableRetailers(req));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch public retailer directory");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/retailers — authenticated learner directory.
router.get("/retailers", async (req, res): Promise<void> => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;

    res.json(await listPublishableRetailers(req));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch retailer directory");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/retailers/postcode — resolve without storing the supplied postcode.
router.post("/retailers/postcode", async (req, res) => {
  try {
    const user = await requireGatewayUser(req, res);
    if (!user) return;

    const postcode = typeof req.body?.postcode === "string" ? req.body.postcode.trim() : "";
    if (!postcode) {
      res.status(400).json({ error: "postcode required" });
      return;
    }

    let coordinates;
    try {
      coordinates = await resolveVenueCoordinates({ postcode });
    } catch (err) {
      if (err instanceof VenueMappingServiceError) {
        res.status(503).json({ error: VENUE_MAPPING_SERVICE_ERROR });
        return;
      }
      throw err;
    }
    if (!coordinates) {
      res.status(422).json({ error: VENUE_MAPPING_ERROR });
      return;
    }

    // Do not echo or persist the postcode: it is only used for this lookup.
    res.json(coordinates);
  } catch (err) {
    logger.error({ err }, "Failed to resolve retailer postcode");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;