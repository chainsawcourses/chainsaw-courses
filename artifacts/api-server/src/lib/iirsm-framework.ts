/**
 * iirsm-framework.ts
 * Loads the IIRSM Risk Management and Leadership Competence Framework
 * from app_config on first use and caches it in memory.
 */
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let cached: string | null = null;

export async function getIirsmFramework(): Promise<string | null> {
  if (cached !== null) return cached;
  try {
    const [row] = await db
      .select({ value: appConfigTable.value })
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "iirsm_competence_framework"))
      .limit(1);
    cached = row?.value ?? null;
    if (cached) {
      logger.info({ chars: cached.length }, "IIRSM Competence Framework loaded for AI reference");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to load IIRSM framework from DB");
  }
  return cached;
}
