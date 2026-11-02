import app from "./app";
import { logger } from "./lib/logger";
import { setPostcodeLookupRecorder } from "./lib/gatewayVenue";
import { startScheduler } from "./lib/scheduler";
import { warnIfBillingNotificationTestScopeIsConfigured } from "./lib/billingSupportNotifications";
import { db, waiversTable, usersTable, activationCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedRetailerDirectoryIfEmpty } from "./lib/retailerDirectorySeed";

const rawPort = process.env["PORT"];

setPostcodeLookupRecorder((event) => {
  const level = event.outcome === "provider_failure" ? "warn" : "info";
  logger[level]({ event: "postcode_lookup", ...event }, "Postcode provider lookup");
});

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

if (process.env["NODE_ENV"] === "production" && !process.env["SESSION_SECRET"]) {
  throw new Error("SESSION_SECRET environment variable is required in production.");
}

warnIfBillingNotificationTestScopeIsConfigured();

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runStartupDataFix() {
  try {
    // Remove waivers whose user_id has no matching user (orphaned rows)
    const allWaivers = await db.select().from(waiversTable);
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    const userIds = new Set(allUsers.map(u => u.id));
    const orphaned = allWaivers.filter(w => !userIds.has(w.userId));
    for (const w of orphaned) {
      await db.delete(waiversTable).where(eq(waiversTable.id, w.id));
      logger.info({ waiverId: w.id, userId: w.userId }, "Startup: deleted orphaned waiver");
    }

    // Ensure the APPTEST26 reviewer code exists (upsert — safe to run on every boot)
    await db
      .insert(activationCodesTable)
      .values({
        code: "APPTEST26",
        isUsed: false,
        isUnlimited: true,
        allModulesUnlocked: true,
        notes: "Google Play reviewer access — all modules unlocked, waiver required",
      })
      .onConflictDoUpdate({
        target: activationCodesTable.code,
        set: { isUnlimited: true, allModulesUnlocked: true },
        // Note: isPaused is intentionally NOT reset on boot — admin may have paused it
      });
    logger.info("Startup: APPTEST26 reviewer code ensured");

    // Ensure ADMIN-PREVIEW always has allModulesUnlocked = true (upsert — safe to run on every boot)
    await db
      .insert(activationCodesTable)
      .values({
        code: "ADMIN-PREVIEW",
        isUsed: false,
        isUnlimited: true,
        allModulesUnlocked: true,
        notes: "Admin app preview — all modules unlocked, all content accessible",
      })
      .onConflictDoUpdate({
        target: activationCodesTable.code,
        set: { isUnlimited: true, allModulesUnlocked: true },
      });
    logger.info("Startup: ADMIN-PREVIEW reviewer code ensured");

    await seedRetailerDirectoryIfEmpty();
  } catch (err) {
    logger.error({ err }, "Startup data-fix failed (non-fatal)");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (process.env["NODE_ENV"] !== "test") {
    startScheduler();
    runStartupDataFix();
  }
});
