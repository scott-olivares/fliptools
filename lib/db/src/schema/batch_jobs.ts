import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per address submitted for batch screening.
// source: "email" | "manual" (manual = single deal form, reserved for future paste/CSV intake)
// status: "pending" | "processing" | "done" | "failed"
// userId is hardcoded to "default" for v1.2 (single user). Scoped per user in v1.3.
export const batchJobsTable = pgTable("batch_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default"),
  address: text("address").notNull(),
  askingPrice: text("asking_price"), // stored as text; may be absent
  source: text("source").notNull().default("email"), // "email" | "manual"
  sourceRef: text("source_ref"), // e.g. email message-id for deduplication
  status: text("status").notNull().default("pending"),
  dealId: integer("deal_id"), // set once a deal record is created
  errorMessage: text("error_message"), // set on failure; shown in triage UI
  meta: jsonb("meta"), // arbitrary bag for future use (e.g. email subject)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertBatchJobSchema = createInsertSchema(batchJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;
export type BatchJob = typeof batchJobsTable.$inferSelect;
