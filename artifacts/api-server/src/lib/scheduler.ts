import cron from "node-cron";
import { logger } from "./logger";
import { fetchAllFeeds } from "./rssFetcher";

export function startScheduler(): void {
  // Run at 07:00 every day (server local time / UTC)
  cron.schedule("0 7 * * *", async () => {
    logger.info("Scheduled RSS fetch starting");
    try {
      const result = await fetchAllFeeds();
      logger.info(result, "Scheduled RSS fetch finished");
    } catch (err) {
      logger.error({ err }, "Scheduled RSS fetch threw unexpectedly");
    }
  });

  logger.info("RSS scheduler registered (daily at 07:00)");
}
