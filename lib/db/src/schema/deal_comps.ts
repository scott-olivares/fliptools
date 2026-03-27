import { pgTable, text, serial, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealCompsTable = pgTable("deal_comps", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  compId: integer("comp_id").notNull(),
  included: boolean("included").notNull().default(true),
  relevance: text("relevance").notNull().default("normal"),
  notes: text("notes"),
});

export const insertDealCompSchema = createInsertSchema(dealCompsTable).omit({ id: true });
export type InsertDealComp = z.infer<typeof insertDealCompSchema>;
export type DealComp = typeof dealCompsTable.$inferSelect;
