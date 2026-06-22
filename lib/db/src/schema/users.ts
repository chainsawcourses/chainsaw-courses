import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activationCodesTable = pgTable("activation_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  isUsed: boolean("is_used").notNull().default(false),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  activationCode: text("activation_code").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  deviceId: text("device_id").notNull(),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at"),
  deletedAt: timestamp("deleted_at"),
});

export const waiversTable = pgTable("waivers", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  signatureData: text("signature_data").notNull(),
  agreedToTerms: boolean("agreed_to_terms").notNull().default(true),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  pdfPath: text("pdf_path"),
});

export const insertActivationCodeSchema = createInsertSchema(activationCodesTable).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, activatedAt: true, lastActivityAt: true, deletedAt: true });
export const insertWaiverSchema = createInsertSchema(waiversTable).omit({ id: true, signedAt: true });

export type ActivationCode = typeof activationCodesTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Waiver = typeof waiversTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
