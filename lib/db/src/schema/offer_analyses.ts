import { pgTable, serial, real, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const offerAnalysesTable = pgTable("offer_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().unique(),
  arv: real("arv").notNull(),
  rehabCost: real("rehab_cost").notNull().default(0),
  closingCosts: real("closing_costs").notNull().default(0),
  holdingCosts: real("holding_costs").notNull().default(0),
  sellingCosts: real("selling_costs").notNull().default(0),
  otherCosts: real("other_costs").notNull().default(0),
  desiredProfitAmount: real("desired_profit_amount").notNull().default(0),
  targetReturnPct: real("target_return_pct").notNull().default(9),
  purchasePrice: real("purchase_price"),
  maxOffer: real("max_offer").notNull(),
  projectedReturn: real("projected_return"),
  projectedProfit: real("projected_profit"),
  signal: text("signal").notNull().default("likely_pass"),
  signalExplanation: text("signal_explanation").notNull().default(""),
  totalCosts: real("total_costs").notNull().default(0),
  gapToAsking: real("gap_to_asking"),
  flaggedFarApart: boolean("flagged_far_apart").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOfferAnalysisSchema = createInsertSchema(offerAnalysesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOfferAnalysis = z.infer<typeof insertOfferAnalysisSchema>;
export type OfferAnalysis = typeof offerAnalysesTable.$inferSelect;
