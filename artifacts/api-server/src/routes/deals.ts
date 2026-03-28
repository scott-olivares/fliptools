import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, dealsTable, compsTable, dealCompsTable, offerAnalysesTable } from "@workspace/db";
import {
  ListDealsResponse,
  CreateDealBody,
  GetDealResponse,
  UpdateDealBody,
  GetDealParams,
  UpdateDealParams,
  DeleteDealParams,
  CalculateArvParams,
  GetOfferAnalysisParams,
  SaveOfferAnalysisParams,
  SaveOfferAnalysisBody,
} from "@workspace/api-zod";
import { calculateARV, calculateOffer } from "../lib/arvEngine.js";
import { mockCompProvider } from "../lib/mockCompProvider.js";
import { rentcastCompProvider, isRentCastConfigured } from "../lib/rentcastProvider.js";

function activeCompProvider() {
  return isRentCastConfigured() ? rentcastCompProvider : mockCompProvider;
}

const router: IRouter = Router();

router.get("/deals", async (_req, res): Promise<void> => {
  const deals = await db.select().from(dealsTable).orderBy(dealsTable.updatedAt);
  res.json(ListDealsResponse.parse(deals.reverse()));
});

router.post("/deals", async (req, res): Promise<void> => {
  const parsed = CreateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const provider = activeCompProvider();
  const [deal] = await db
    .insert(dealsTable)
    .values({
      address: data.address,
      askingPrice: data.askingPrice,
      beds: data.beds ?? null,
      baths: data.baths ?? null,
      sqft: data.sqft ?? null,
      lotSize: data.lotSize ?? null,
      yearBuilt: data.yearBuilt ?? null,
      notes: data.notes ?? null,
      status: data.status ?? "new",
      dataSource: provider.name === "RentCast" ? "rentcast" : "mock",
    })
    .returning();

  try {
    const filters = {
      radiusMiles: 0.5,
      subjectSqft: deal.sqft ?? undefined,
      subjectBeds: deal.beds ?? undefined,
      subjectBaths: deal.baths ?? undefined,
    };
    let comps = await provider.getCompsForProperty(deal.address, filters).catch(async (err: any) => {
      if (provider.name === "RentCast") {
        console.warn(`[deals] Initial comp fetch failed, retrying wider: ${err?.message}`);
        return provider.getCompsForProperty(deal.address, { ...filters, radiusMiles: 2.0 });
      }
      throw err;
    });
    if (comps.length > 0) {
      const insertedComps = await db.insert(compsTable).values(comps).returning();
      for (const comp of insertedComps) {
        await db.insert(dealCompsTable).values({
          dealId: deal.id,
          compId: comp.id,
          included: (comp.distanceMiles ?? 999) <= 0.5,
          relevance: "normal",
          notes: null,
        });
      }
    }
  } catch (err: any) {
    console.warn(`[deals] comp fetch failed (${provider.name}): ${err?.message}`);
  }

  res.status(201).json(deal);
});

router.get("/deals/:id", async (req, res): Promise<void> => {
  const params = GetDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const dealComps = await db
    .select()
    .from(dealCompsTable)
    .where(eq(dealCompsTable.dealId, deal.id));

  const compIds = dealComps.map((dc) => dc.compId);
  const compsData =
    compIds.length > 0
      ? await db.select().from(compsTable).where(inArray(compsTable.id, compIds))
      : [];

  const compMap = new Map(compsData.map((c) => [c.id, c]));
  const comps = dealComps.map((dc) => ({
    ...dc,
    comp: compMap.get(dc.compId)!,
  })).filter((dc) => dc.comp);

  const [offerAnalysis] = await db
    .select()
    .from(offerAnalysesTable)
    .where(eq(offerAnalysesTable.dealId, deal.id));

  res.json({
    ...deal,
    comps,
    offerAnalysis: offerAnalysis ?? null,
  });
});

router.patch("/deals/:id", async (req, res): Promise<void> => {
  const params = UpdateDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const data = parsed.data as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      const dbKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      updateData[dbKey] = v;
    }
  }

  if (Object.keys(updateData).length === 0) {
    const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(existing);
    return;
  }

  const [deal] = await db
    .update(dealsTable)
    .set(parsed.data as any)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.json(deal);
});

router.delete("/deals/:id", async (req, res): Promise<void> => {
  const params = DeleteDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .delete(dealsTable)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/deals/:id/comps/refresh", async (req, res): Promise<void> => {
  const params = GetDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const baseRadius = deal.compRadiusMiles ?? 0.5;
  const filters = {
    radiusMiles: baseRadius,
    monthsBack: deal.compMonthsBack ?? 6,
    sqftSimilarityPct: deal.compSqftPct ?? 20,
    subjectSqft: deal.sqft ?? undefined,
    subjectBeds: deal.beds ?? undefined,
    subjectBaths: deal.baths ?? undefined,
  };

  const existingDealComps = await db
    .select()
    .from(dealCompsTable)
    .where(eq(dealCompsTable.dealId, deal.id));

  if (existingDealComps.length > 0) {
    const compIds = existingDealComps.map((dc) => dc.compId);
    await db.delete(dealCompsTable).where(eq(dealCompsTable.dealId, deal.id));
    await db.delete(compsTable).where(inArray(compsTable.id, compIds));
  }

  const provider = activeCompProvider();
  let freshComps;
  try {
    freshComps = await provider.getCompsForProperty(deal.address, filters);
  } catch (err: any) {
    // If RentCast fails (e.g. insufficient comps), retry with a wider radius
    if (provider.name === "RentCast" && baseRadius < 5) {
      try {
        console.warn(`[deals] Retrying comp fetch with wider radius (${baseRadius * 2}mi)`);
        freshComps = await provider.getCompsForProperty(deal.address, {
          ...filters,
          radiusMiles: Math.min(baseRadius * 2, 5),
        });
      } catch (retryErr: any) {
        console.warn(`[deals] Retry also failed: ${retryErr?.message}`);
        freshComps = [];
      }
    } else {
      console.warn(`[deals] Comp provider error (${provider.name}): ${err?.message}`);
      freshComps = [];
    }
  }

  if (freshComps.length === 0) {
    res.json({ refreshed: 0 });
    return;
  }

  const insertedComps = await db.insert(compsTable).values(freshComps).returning();
  for (const comp of insertedComps) {
    await db.insert(dealCompsTable).values({
      dealId: deal.id,
      compId: comp.id,
      included: (comp.distanceMiles ?? 999) <= 0.5,
      relevance: "normal",
      notes: null,
    });
  }

  await db.update(dealsTable)
    .set({ dataSource: provider.name === "RentCast" ? "rentcast" : "mock" })
    .where(eq(dealsTable.id, deal.id));

  res.json({ refreshed: insertedComps.length });
});

router.get("/deals/:id/arv", async (req, res): Promise<void> => {
  const params = CalculateArvParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const dealComps = await db
    .select()
    .from(dealCompsTable)
    .where(eq(dealCompsTable.dealId, deal.id));

  const compIds = dealComps.map((dc) => dc.compId);

  const compsData =
    compIds.length > 0
      ? await db.select().from(compsTable).where(inArray(compsTable.id, compIds))
      : [];

  const compMap = new Map(compsData.map((c) => [c.id, c]));
  const compsWithJoin = dealComps
    .map((dc) => ({ dealComp: dc, comp: compMap.get(dc.compId)! }))
    .filter((item) => item.comp);

  const result = calculateARV(deal.sqft, compsWithJoin);

  const arvValue = deal.arvOverride ?? result.suggestedArv;

  await db
    .update(dealsTable)
    .set({ arvEstimate: arvValue })
    .where(eq(dealsTable.id, deal.id));

  res.json({
    dealId: deal.id,
    ...result,
    hasManualOverride: !!deal.arvOverride,
    manualOverrideValue: deal.arvOverride ?? null,
  });
});

router.get("/deals/:id/offer", async (req, res): Promise<void> => {
  const params = GetOfferAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(offerAnalysesTable)
    .where(eq(offerAnalysesTable.dealId, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "No offer analysis found for this deal" });
    return;
  }

  res.json(analysis);
});

router.put("/deals/:id/offer", async (req, res): Promise<void> => {
  const params = SaveOfferAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveOfferAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const { arv, rehabCost, closingCosts, holdingCosts, sellingCosts, otherCosts, desiredProfitAmount, targetReturnPct, purchasePrice } = parsed.data;

  const calcResult = calculateOffer({
    arv,
    rehabCost,
    closingCosts,
    holdingCosts,
    sellingCosts,
    otherCosts,
    desiredProfitAmount,
    targetReturnPct,
    purchasePrice: purchasePrice ?? null,
    askingPrice: deal.askingPrice,
  });

  const existingAnalysis = await db
    .select()
    .from(offerAnalysesTable)
    .where(eq(offerAnalysesTable.dealId, params.data.id));

  let analysis;
  if (existingAnalysis.length > 0) {
    [analysis] = await db
      .update(offerAnalysesTable)
      .set({
        arv,
        rehabCost,
        closingCosts,
        holdingCosts,
        sellingCosts,
        otherCosts,
        desiredProfitAmount,
        targetReturnPct,
        purchasePrice: purchasePrice ?? null,
        ...calcResult,
      })
      .where(eq(offerAnalysesTable.dealId, params.data.id))
      .returning();
  } else {
    [analysis] = await db
      .insert(offerAnalysesTable)
      .values({
        dealId: params.data.id,
        arv,
        rehabCost,
        closingCosts,
        holdingCosts,
        sellingCosts,
        otherCosts,
        desiredProfitAmount,
        targetReturnPct,
        purchasePrice: purchasePrice ?? null,
        ...calcResult,
      })
      .returning();
  }

  await db
    .update(dealsTable)
    .set({
      maxOffer: calcResult.maxOffer,
      projectedReturn: calcResult.projectedReturn,
    })
    .where(eq(dealsTable.id, params.data.id));

  res.json(analysis);
});

export default router;
