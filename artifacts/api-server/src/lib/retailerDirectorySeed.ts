import fs from "node:fs";
import path from "node:path";
import { db, chainsawRetailersTable } from "@workspace/db";
import { resolveVenueCoordinates } from "./gatewayVenue";
import { logger } from "./logger";

type SeedRetailer = {
  name?: unknown;
  address?: unknown;
  postcode?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  verificationStatus?: unknown;
  evidenceUrl?: unknown;
  lastCheckedAt?: unknown;
  active?: unknown;
};

function loadSeedRows(): SeedRetailer[] {
  const candidates = [
    path.resolve("src/data/retailerDirectorySeed.json"),
    path.resolve("artifacts/api-server/src/data/retailerDirectorySeed.json"),
    path.join(__dirname, "data/retailerDirectorySeed.json"),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(fs.readFileSync(candidate, "utf8")) as SeedRetailer[];
    } catch {
      // Try the next source-tree/dist location.
    }
  }

  logger.warn("retailerDirectorySeed.json not found — skipping retailer seed");
  return [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Populate the directory only while the table is empty in every environment.
 * This is intentionally an insert-once seed rather than an upsert:
 * operators may edit or deactivate these records without the next server
 * restart restoring the source JSON over their changes.
 */
export async function seedRetailerDirectoryIfEmpty(): Promise<void> {
  const existing = await db
    .select({ id: chainsawRetailersTable.id })
    .from(chainsawRetailersTable)
    .limit(1);
  if (existing.length > 0) {
    logger.info("Retailer directory already contains data — skipping development seed");
    return;
  }

  const sourceRows = loadSeedRows().filter((row) =>
    row.active === true &&
    row.verificationStatus === "verified" &&
    text(row.name) &&
    text(row.postcode),
  );
  if (sourceRows.length === 0) {
    logger.info("Retailer directory seed has no verified rows — skipping");
    return;
  }

  const rows: Array<typeof chainsawRetailersTable.$inferInsert> = [];
  for (const source of sourceRows) {
    const postcode = text(source.postcode).replace(/\s+/g, " ").toUpperCase();
    let coordinates: { lat: number; lng: number } | null;
    try {
      coordinates = await resolveVenueCoordinates({ postcode });
    } catch (err) {
      logger.warn({ err, retailerName: text(source.name) }, "Skipping retailer seed row after postcode lookup failure");
      continue;
    }
    if (!coordinates) {
      logger.warn({ retailerName: text(source.name) }, "Skipping retailer seed row with unmappable postcode");
      continue;
    }

    const checkedAt = source.lastCheckedAt ? new Date(String(source.lastCheckedAt)) : null;
    rows.push({
      name: text(source.name),
      address: text(source.address),
      town: "",
      county: "",
      postcode,
      lat: coordinates.lat,
      lng: coordinates.lng,
      email: text(source.email),
      phone: text(source.phone),
      website: text(source.website) || null,
      active: true,
      verificationStatus: "verified",
      evidenceUrl: text(source.evidenceUrl) || null,
      lastCheckedAt: checkedAt && !Number.isNaN(checkedAt.getTime()) ? checkedAt : null,
      notes: null,
    });
  }

  if (rows.length === 0) {
    logger.warn("No retailer seed rows could be geocoded — leaving directory empty");
    return;
  }

  // Recheck inside the write transaction as a final guard against a second
  // development process starting while this process was geocoding.
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: chainsawRetailersTable.id })
      .from(chainsawRetailersTable)
      .limit(1);
    if (current.length > 0) return;
    await tx.insert(chainsawRetailersTable).values(rows);
  });
  logger.info({ count: rows.length }, "Seeded verified chainsaw retailer directory");
}