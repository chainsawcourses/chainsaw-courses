// A single-origin entry for a conventional Node host, not a replacement workflow.
import path from "node:path";
import express from "express";
import app from "../src/app";
import { logger } from "../src/lib/logger";
import { startScheduler } from "../src/lib/scheduler";

const rehearsal = process.env.RECOVERY_REHEARSAL === "true";
if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
if (process.env.OBJECT_STORAGE_PROVIDER !== "gcs" || process.env.GOOGLE_API_PROVIDER !== "direct") {
  throw new Error("Portable server requires explicit gcs storage and direct Google API providers");
}
if (rehearsal) {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || database.search !== "") {
    throw new Error("Recovery rehearsal requires a loopback-only database");
  }
}
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
// Before the imported application: rehearsal rejects HTTP mutations. Its database
// login must also reject actual row changes: authentication GETs can reconcile rows.
const server = express();
if (rehearsal) server.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.status(503).json({ error: "Read-only recovery rehearsal" }); return; }
  next();
});
server.use(app);
const web = path.resolve(process.env.WEB_DIST_DIR ?? "artifacts/chainsaw-training/dist/public");
server.use(express.static(web));
server.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(path.join(web, "index.html"), error => error && next(error));
});
server.listen(port, rehearsal ? "127.0.0.1" : "0.0.0.0", () => {
  logger.info({ port, rehearsal }, "Portable server listening");
  // No startup seed/data-fix. Schedules require an explicit live-host opt-in.
  if (!rehearsal && process.env.PORTABLE_ENABLE_SCHEDULER === "true") startScheduler();
});
