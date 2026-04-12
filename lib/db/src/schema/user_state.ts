import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user. Tracks app-level state that needs to survive sessions.
// userId is "default" for v1.2 single-user; becomes the auth user ID in v1.3.
export const userStateTable = pgTable("user_state", {
  userId: text("user_id").primaryKey(),
  // Last time the user was active in the app (set on any authenticated request in v1.3;
  // set manually via POST /session/ping in v1.2).
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // Last time the digest banner was dismissed.
  digestDismissedAt: timestamp("digest_dismissed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserStateSchema = createInsertSchema(userStateTable);
export type InsertUserState = z.infer<typeof insertUserStateSchema>;
export type UserState = typeof userStateTable.$inferSelect;
