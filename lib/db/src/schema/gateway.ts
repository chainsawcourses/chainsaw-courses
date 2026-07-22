import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assessmentVenuesTable = pgTable("assessment_venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  town: text("town").notNull(),
  county: text("county").notNull(),
  postcode: text("postcode").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  tier: text("tier").notNull().default("silver"), // "gold" | "silver"
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assessmentPassportsTable = pgTable("assessment_passports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  postcode: text("postcode").notNull(),
  phone: text("phone").notNull(),
  ppeConfirmed: boolean("ppe_confirmed").notNull().default(false),
  competenceConfirmed: boolean("competence_confirmed").notNull().default(false),
  gdprConfirmed: boolean("gdpr_confirmed").notNull().default(false),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

// status values: "pending" | "nudge7_sent" | "followup_requested" | "nudge12_sent" | "resolved" | "expired"
export const assessmentEnquiriesTable = pgTable("assessment_enquiries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  venueId: integer("venue_id").notNull(),
  status: text("status").notNull().default("pending"),
  resolveToken: text("resolve_token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  batchSentAt: timestamp("batch_sent_at"),
  followupRequestedAt: timestamp("followup_requested_at"),
  nudge7SentAt: timestamp("nudge7_sent_at"),
  nudge12SentAt: timestamp("nudge12_sent_at"),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAssessmentVenueSchema = createInsertSchema(assessmentVenuesTable).omit({ id: true, createdAt: true });
export const insertAssessmentPassportSchema = createInsertSchema(assessmentPassportsTable).omit({ id: true, completedAt: true });
export const insertAssessmentEnquirySchema = createInsertSchema(assessmentEnquiriesTable).omit({ id: true, createdAt: true });

export type AssessmentVenue = typeof assessmentVenuesTable.$inferSelect;
export type AssessmentPassport = typeof assessmentPassportsTable.$inferSelect;
export type AssessmentEnquiry = typeof assessmentEnquiriesTable.$inferSelect;
export type InsertAssessmentVenue = z.infer<typeof insertAssessmentVenueSchema>;
