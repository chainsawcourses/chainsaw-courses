import { pgTable, serial, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export type BackupRunResult = {
  url: string;
  folderId: string;
  rootFolderId?: string;
  title: string;
  at: string;
  format?: "encrypted" | "readable";
  counts: {
    tables: number;
    records: number;
    learners: number;
    certificates: number;
    inspections: number;
    risks: number;
    waivers?: number;
    assessmentMedia?: number;
    retailerLogos?: number;
  };
  sha256?: string;
  categories?: {
    key: string;
    label: string;
    title: string;
    url: string;
    folderId: string;
    sha256?: string;
    counts: {
      tables: number;
      records: number;
      learners?: number;
      certificates?: number;
      inspections?: number;
      risks?: number;
      documents?: number;
    };
  }[];
  documentFolders?: { key: string; label: string; folderId: string; count: number }[];
  /** IDs are retained only so a failed DB audit can remove files created by that run. */
  driveFileIds?: string[];
};

export const backupRunsTable = pgTable("backup_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  state: text("state").notNull(),
  scheduleKey: text("schedule_key"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  result: jsonb("result").$type<BackupRunResult | null>(),
}, (table) => [
  index("backup_runs_started_at_idx").on(table.startedAt),
  index("backup_runs_source_started_at_idx").on(table.source, table.startedAt),
  uniqueIndex("backup_runs_schedule_key_idx").on(table.scheduleKey),
]);

export type BackupRun = typeof backupRunsTable.$inferSelect;
