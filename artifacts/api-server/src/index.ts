import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { db, waiversTable, usersTable, examAttemptsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

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

    // Stamp certificate fields for any user who passed the exam but has no cert date
    const passedAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.passed, true));
    for (const attempt of passedAttempts) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, attempt.userId));
      if (user && !user.certificateIssuedAt) {
        const expiresAt = new Date(attempt.attemptedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
        await db.update(usersTable).set({
          courseCompletedAt: attempt.attemptedAt,
          certificateIssuedAt: attempt.attemptedAt,
          accessExpiresAt: expiresAt,
        }).where(eq(usersTable.id, user.id));
        logger.info({ userId: user.id }, "Startup: stamped missing certificate fields");
      }
    }
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
  startScheduler();
  runStartupDataFix();
});
