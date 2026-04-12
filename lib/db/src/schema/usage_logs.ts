import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per property successfully analyzed (deal created + ARV calculated).
// Used to enforce the 100/month usage cap without a billing system.
// userId is reserved for v1.3 multi-user auth; hardcoded to "default" for now.
export const usageLogsTable = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default"),
  dealId: integer("deal_id").notNull(),
  source: text("source").notNull().default("email"), // "email" | "manual"
  billingMonth: text("billing_month").notNull(), // "2026-04" — YYYY-MM for fast aggregation
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUsageLogSchema = createInsertSchema(usageLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;
export type UsageLog = typeof usageLogsTable.$inferSelect;
