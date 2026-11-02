import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const codeResetRequestsTable = pgTable("code_reset_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  supportEmailStatus: text("support_email_status").notNull().default("pending"),
  issuedCodeId: integer("issued_code_id"),
  issuedCode: text("issued_code"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
}, (table) => [
  index("code_reset_requests_status_requested_idx").on(table.status, table.requestedAt),
  index("code_reset_requests_email_idx").on(table.email),
]);

export const insertCodeResetRequestSchema = createInsertSchema(codeResetRequestsTable).omit({
  id: true,
  requestedAt: true,
  completedAt: true,
});

export type CodeResetRequest = typeof codeResetRequestsTable.$inferSelect;
export type InsertCodeResetRequest = z.infer<typeof insertCodeResetRequestSchema>;