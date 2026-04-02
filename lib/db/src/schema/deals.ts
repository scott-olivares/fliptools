import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  askingPrice: real("asking_price").notNull(),
  beds: real("beds"),
  baths: real("baths"),
  sqft: integer("sqft"),
  lotSize: real("lot_size"),
  yearBuilt: integer("year_built"),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  arvEstimate: real("arv_estimate"),
  arvOverride: real("arv_override"),
  maxOffer: real("max_offer"),
  projectedReturn: real("projected_return"),
  dataSource: text("data_source").notNull().default("mock"),
  propertyType: text("property_type").notNull().default("SFR"),
  // Comp search criteria
  compRadiusMiles: real("comp_radius_miles").default(0.5),
  compMonthsBack: integer("comp_months_back").default(6),
  compSqftPct: integer("comp_sqft_pct").default(20),
  compBedsRange: real("comp_beds_range").default(1),
  compBathsRange: real("comp_baths_range").default(1),
  compYearBuiltRange: integer("comp_year_built_range").default(10),
  // Cost-protection: track when comps were last fetched from RentCast
  compsLastFetchedAt: timestamp("comps_last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
