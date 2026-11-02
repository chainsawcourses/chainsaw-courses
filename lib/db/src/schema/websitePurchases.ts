import { pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// One row per purchased seat. Reversals are retained as tombstones so a late
// paid-event replay cannot recreate an entitlement after a refund.
export const websitePurchaseSeatsTable = pgTable("website_purchase_seats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: text("order_id").notNull(),
  lineItemId: text("line_item_id").notNull(),
  seatId: text("seat_id").notNull(),
  email: text("email"),
  buyerName: text("buyer_name"),
  activationCodeId: integer("activation_code_id"),
  status: text("status").notNull(), // active | revoked
  emailStatus: text("email_status").notNull().default("pending"), // pending | sending | sent | needs_review
  resolution: text("resolution"), // confirmed_received | manual_handoff | closed_unresolved
  resolutionNote: text("resolution_note"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("website_purchase_seat_identity_idx").on(t.orderId, t.lineItemId, t.seatId),
  uniqueIndex("website_purchase_seat_code_idx").on(t.activationCodeId),
]);

export const insertWebsitePurchaseSeatSchema = createInsertSchema(websitePurchaseSeatsTable)
  .omit({ createdAt: true, updatedAt: true });