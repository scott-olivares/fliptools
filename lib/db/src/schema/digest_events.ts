import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per nightly digest run per user.
// The banner reads the most recent unread row for the user.
export const digestEventsTable = pgTable("digest_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default"),
  // Counts from the run
  totalScreened: integer("total_screened").notNull().default(0),
  worthALook: integer("worth_a_look").notNull().default(0), // strong_candidate count
  closeCall: integer("close_call").notNull().default(0),
  // When the digest was computed
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDigestEventSchema = createInsertSchema(
  digestEventsTable,
).omit({ id: true });
export type InsertDigestEvent = z.infer<typeof insertDigestEventSchema>;
export type DigestEvent = typeof digestEventsTable.$inferSelect;
