import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modulesTable = pgTable("modules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  duration: integer("duration").notNull(),
  vimeoId: text("vimeo_id").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  isHighRisk: boolean("is_high_risk").notNull().default(false),
  safetyText: text("safety_text"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userProgressTable = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  moduleId: integer("module_id").notNull(),
  videoCompleted: boolean("video_completed").notNull().default(false),
  quizPassed: boolean("quiz_passed").notNull().default(false),
  quizScore: integer("quiz_score"),
  lastTimestamp: integer("last_timestamp").notNull().default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull(), // JSON array
  correctOption: integer("correct_option").notNull(),
  order: integer("order").notNull(),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  moduleId: integer("module_id").notNull(),
  score: integer("score").notNull(),
  passed: boolean("passed").notNull(),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModuleSchema = createInsertSchema(modulesTable).omit({ id: true, createdAt: true });
export const insertUserProgressSchema = createInsertSchema(userProgressTable).omit({ id: true, updatedAt: true });
export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true });
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });

export type Module = typeof modulesTable.$inferSelect;
export type UserProgress = typeof userProgressTable.$inferSelect;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertModule = z.infer<typeof insertModuleSchema>;
