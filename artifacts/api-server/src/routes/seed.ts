import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dealsTable, compsTable, dealCompsTable, offerAnalysesTable } from "@workspace/db";
import { calculateARV, calculateOffer } from "../lib/arvEngine.js";
import { MOCK_COMPS } from "../lib/mockCompProvider.js";

const router: IRouter = Router();

const SAMPLE_DEALS = [
  {
    address: "4800 Rosewood Dr, Austin, TX 78745",
    askingPrice: 349000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotSize: 0.18,
    yearBuilt: 1978,
    notes: "Dated kitchen and baths, good bones. Roof is 5 years old. Needs full interior rehab.",
    status: "reviewing" as const,
  },
  {
    address: "711 Creekside Blvd, Austin, TX 78704",
    askingPrice: 419000,
    beds: 3,
    baths: 2,
    sqft: 2050,
    lotSize: 0.22,
    yearBuilt: 1985,
    notes: "Seller motivated. Foundation crack at NW corner, inspector recommends repair. Interior is cosmetic only after that.",
    status: "offer_submitted" as const,
  },
  {
    address: "2220 Hollyhock Ln, Austin, TX 78723",
    askingPrice: 299000,
    beds: 3,
    baths: 1,
    sqft: 1540,
    lotSize: 0.14,
    yearBuilt: 1962,
    notes: "Smaller lot. Good neighborhood trajectory. Full gut rehab likely needed.",
    status: "new" as const,
  },
  {
    address: "5518 Mesquite Ridge Rd, Austin, TX 78749",
    askingPrice: 375000,
    beds: 4,
    baths: 2,
    sqft: 2100,
    lotSize: 0.26,
    yearBuilt: 1991,
    notes: "Larger floorplan, good layout. Cosmetic rehab + master bath expansion potential.",
    status: "passed" as const,
  },
  {
    address: "944 Lavender Way, Austin, TX 78741",
    askingPrice: 320000,
    beds: 3,
    baths: 2,
    sqft: 1720,
    lotSize: 0.17,
    yearBuilt: 1975,
    notes: "Pending estate sale. Some deferred maintenance. HVAC replaced 2022.",
    status: "closed" as const,
  },
];

router.post("/seed", async (_req, res): Promise<void> => {
  await db.delete(offerAnalysesTable);
  await db.delete(dealCompsTable);
  await db.delete(dealsTable);
  await db.delete(compsTable);

  const insertedComps = await db.insert(compsTable).values(MOCK_COMPS).returning();
  let dealsCreated = 0;

  for (const dealData of SAMPLE_DEALS) {
    const [deal] = await db
      .insert(dealsTable)
      .values({ ...dealData, dataSource: "mock" })
      .returning();

    for (const comp of insertedComps) {
      await db.insert(dealCompsTable).values({
        dealId: deal.id,
        compId: comp.id,
        included: true,
        relevance: "normal",
        notes: null,
      });
    }

    const thisDealComps = await db
      .select()
      .from(dealCompsTable)
      .where(eq(dealCompsTable.dealId, deal.id));

    const compsWithJoin = thisDealComps
      .map((dc) => ({
        dealComp: dc,
        comp: insertedComps.find((c) => c.id === dc.compId)!,
      }))
      .filter((item) => item.comp);

    const arvResult = calculateARV(deal.sqft, compsWithJoin);

    const rehabCost = Math.round((deal.sqft ?? 1800) * 45);
    const closingCosts = Math.round(deal.askingPrice * 0.015);
    const holdingCosts = Math.round(deal.askingPrice * 0.025);
    const sellingCosts = Math.round(arvResult.suggestedArv * 0.06);
    const otherCosts = 5000;
    const targetReturnPct = 9;

    const offerCalc = calculateOffer({
      arv: arvResult.suggestedArv,
      rehabCost,
      closingCosts,
      holdingCosts,
      sellingCosts,
      otherCosts,
      desiredProfitAmount: 0,
      targetReturnPct,
      purchasePrice: null,
      askingPrice: deal.askingPrice,
    });

    await db.insert(offerAnalysesTable).values({
      dealId: deal.id,
      arv: arvResult.suggestedArv,
      rehabCost,
      closingCosts,
      holdingCosts,
      sellingCosts,
      otherCosts,
      desiredProfitAmount: 0,
      targetReturnPct,
      purchasePrice: null,
      ...offerCalc,
    });

    await db
      .update(dealsTable)
      .set({
        arvEstimate: arvResult.suggestedArv,
        maxOffer: offerCalc.maxOffer,
        projectedReturn: offerCalc.projectedReturn,
      })
      .where(eq(dealsTable.id, deal.id));

    dealsCreated++;
  }

  res.json({
    message: "Sample data loaded successfully. All fields are labeled SAMPLE DATA.",
    dealsCreated,
    compsCreated: insertedComps.length,
  });
});

export default router;
