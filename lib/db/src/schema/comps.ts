import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const compsTable = pgTable("comps", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  salePrice: real("sale_price"),
  listPrice: real("list_price"),
  sqft: integer("sqft"),
  lotSize: real("lot_size"),
  beds: real("beds"),
  baths: real("baths"),
  distanceMiles: real("distance_miles"),
  yearBuilt: integer("year_built"),
  soldDate: text("sold_date"),
  listingStatus: text("listing_status").notNull().default("sold"),
  propertyType: text("property_type").notNull().default("SFR"),
  condition: text("condition").notNull().default("unknown"),
  source: text("source").notNull().default("mock"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  dataSource: text("data_source").notNull().default("mock"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCompSchema = createInsertSchema(compsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertComp = z.infer<typeof insertCompSchema>;
export type Comp = typeof compsTable.$inferSelect;
