import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  dealsTable,
  compsTable,
  dealCompsTable,
  offerAnalysesTable,
} from "@workspace/db";
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
import {
  rentcastCompProvider,
  isRentCastConfigured,
} from "../lib/rentcastProvider.js";
import {
  isOverCap,
  recordUsage,
  getUsageThisMonth,
  MONTHLY_CAP,
} from "../lib/usageCap.js";

function activeCompProvider() {
  return isRentCastConfigured() ? rentcastCompProvider : mockCompProvider;
}

/**
 * Determines whether a comp should be auto-selected (included) based on the
 * deal's Comp Search Criteria from the Property Info tab.
 * A comp is included only if it passes EVERY criterion for which both the
 * subject and the comp have a value. If either side is null we give the
 * comp the benefit of the doubt and don't filter on that criterion.
 */
function shouldIncludeComp(
  deal: {
    sqft?: number | null;
    beds?: number | null;
    baths?: number | null;
    yearBuilt?: number | null;
    compRadiusMiles?: number | null;
    compSqftPct?: number | null;
    compBedsRange?: number | null;
    compBathsRange?: number | null;
    compYearBuiltRange?: number | null;
    propertyType?: string | null;
  },
  comp: {
    distanceMiles?: number | null;
    sqft?: number | null;
    beds?: number | null;
    baths?: number | null;
    yearBuilt?: number | null;
    propertyType?: string | null;
  },
): boolean {
  const radius = deal.compRadiusMiles ?? 0.5;
  // Distance must always be within the search radius
  if ((comp.distanceMiles ?? 999) > radius) return false;

  // Property type must match when both are known
  if (deal.propertyType && comp.propertyType) {
    if (deal.propertyType !== comp.propertyType) return false;
  }

  // SqFt: within ±compSqftPct% of subject sqft
  if (deal.sqft && comp.sqft) {
    const pct = (deal.compSqftPct ?? 20) / 100;
    if (Math.abs(comp.sqft - deal.sqft) > deal.sqft * pct) return false;
  }

  // Beds: within ±compBedsRange of subject beds
  if (deal.beds != null && comp.beds != null) {
    if (Math.abs(comp.beds - deal.beds) > (deal.compBedsRange ?? 1))
      return false;
  }

  // Baths: within ±compBathsRange of subject baths
  if (deal.baths != null && comp.baths != null) {
    if (Math.abs(comp.baths - deal.baths) > (deal.compBathsRange ?? 1))
      return false;
  }

  // Year Built: within ±compYearBuiltRange of subject year built.
  // If either side is null, skip this filter — do not exclude comps with missing year data.
  if (deal.yearBuilt != null && comp.yearBuilt != null) {
    if (
      Math.abs(comp.yearBuilt - deal.yearBuilt) >
      (deal.compYearBuiltRange ?? 10)
    )
      return false;
  }

  return true;
}

const router: IRouter = Router();

router.get("/deals", async (_req, res): Promise<void> => {
  const deals = await db
    .select()
    .from(dealsTable)
    .orderBy(dealsTable.updatedAt);
  const dealIds = deals.map((d) => d.id);

  // Fetch saved offer signals for all deals in one query
  const signals =
    dealIds.length > 0
      ? await db
          .select({
            dealId: offerAnalysesTable.dealId,
            signal: offerAnalysesTable.signal,
          })
          .from(offerAnalysesTable)
          .where(inArray(offerAnalysesTable.dealId, dealIds))
      : [];
  const signalMap = new Map(signals.map((s) => [s.dealId, s.signal]));

  const dealsWithSignal = deals.map((d) => ({
    ...d,
    offerSignal: signalMap.get(d.id) ?? null,
  }));

  res.json(ListDealsResponse.parse(dealsWithSignal.reverse()));
});

router.post("/deals", async (req, res): Promise<void> => {
  const parsed = CreateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Usage cap: reject if the user has hit their monthly limit.
  const userId: string = res.locals.userId;
  if (await isOverCap(userId)) {
    const used = await getUsageThisMonth(userId);
    res.status(429).json({
      error: "Monthly analysis limit reached.",
      used,
      cap: MONTHLY_CAP,
      message: `You have used ${used} of ${MONTHLY_CAP} analyses this month. Limit resets on the 1st.`,
    });
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
      propertyType: data.propertyType ?? "SFR",
    })
    .returning();

  try {
    const filters = {
      radiusMiles: 0.5,
      subjectSqft: deal.sqft ?? undefined,
      subjectBeds: deal.beds ?? undefined,
      subjectBaths: deal.baths ?? undefined,
    };
    let comps = await provider
      .getCompsForProperty(deal.address, filters)
      .catch(async (err: any) => {
        if (provider.name === "RentCast") {
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "Initial comp fetch failed, retrying with wider radius",
              dealId: deal.id,
              address: deal.address,
              provider: provider.name,
              originalRadius: filters.radiusMiles,
              retryRadius: 2.0,
              error: err?.message || String(err),
              timestamp: new Date().toISOString(),
            }),
          );
          return provider.getCompsForProperty(deal.address, {
            ...filters,
            radiusMiles: 2.0,
          });
        }
        throw err;
      });
    if (comps.length > 0) {
      const insertedComps = await db
        .insert(compsTable)
        .values(comps)
        .returning();
      for (const comp of insertedComps) {
        await db.insert(dealCompsTable).values({
          dealId: deal.id,
          compId: comp.id,
          included: shouldIncludeComp(deal, comp),
          relevance: "normal",
          notes: null,
        });
      }
      // Cost-protection: stamp fetch time so the refresh endpoint can enforce TTL
      await db
        .update(dealsTable)
        .set({ compsLastFetchedAt: new Date() })
        .where(eq(dealsTable.id, deal.id));
    }
  } catch (err: any) {
    // Structured error logging for comp fetch failures
    console.error(
      JSON.stringify({
        level: "error",
        message: "Comp fetch failed during deal creation",
        dealId: deal.id,
        address: deal.address,
        provider: provider.name,
        error: err?.message || String(err),
        stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // Record usage now that a deal has been successfully created.
  await recordUsage(deal.id, "manual", userId);

  res.status(201).json(deal);
});

router.get("/deals/:id", async (req, res): Promise<void> => {
  const params = GetDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));
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
      ? await db
          .select()
          .from(compsTable)
          .where(inArray(compsTable.id, compIds))
      : [];

  const compMap = new Map(compsData.map((c) => [c.id, c]));
  const comps = dealComps
    .map((dc) => ({
      ...dc,
      comp: compMap.get(dc.compId)!,
    }))
    .filter((dc) => dc.comp);

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
    const [existing] = await db
      .select()
      .from(dealsTable)
      .where(eq(dealsTable.id, params.data.id));
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

  const dealId = params.data.id;

  // Delete everything in a transaction: offer analysis → deal_comps → orphaned comps → deal
  // The deal existence check is performed atomically inside the transaction
  const deletedDeal = await db.transaction(async (tx) => {
    // 1. Delete saved offer analysis
    await tx
      .delete(offerAnalysesTable)
      .where(eq(offerAnalysesTable.dealId, dealId));

    // 2. Collect comp IDs before removing the join records
    const dealComps = await tx
      .select({ compId: dealCompsTable.compId })
      .from(dealCompsTable)
      .where(eq(dealCompsTable.dealId, dealId));
    const compIds = dealComps.map((dc) => dc.compId);

    // 3. Remove join records
    await tx.delete(dealCompsTable).where(eq(dealCompsTable.dealId, dealId));

    // 4. Delete comps that are no longer referenced by any deal
    if (compIds.length > 0) {
      const stillReferenced = await tx
        .select({ compId: dealCompsTable.compId })
        .from(dealCompsTable)
        .where(inArray(dealCompsTable.compId, compIds));
      const referencedIds = new Set(stillReferenced.map((r) => r.compId));
      const orphanIds = compIds.filter((id) => !referencedIds.has(id));
      if (orphanIds.length > 0) {
        await tx.delete(compsTable).where(inArray(compsTable.id, orphanIds));
      }
    }

    // 5. Delete the deal itself using RETURNING to detect non-existence atomically
    const [deleted] = await tx
      .delete(dealsTable)
      .where(eq(dealsTable.id, dealId))
      .returning({ id: dealsTable.id });

    return deleted;
  });

  // If no deal was deleted, it didn't exist
  if (!deletedDeal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.sendStatus(204);
});

// Cost-protection: minimum time between RentCast comp fetches per deal (1 hour).
// Pass ?force=true to bypass (e.g. when the user explicitly wants fresh data after
// changing search criteria). Without force, repeated refreshes within the TTL window
// return the existing cached comps at zero API cost.
const COMP_REFRESH_TTL_MS = 60 * 60 * 1000; // 1 hour

router.post("/deals/:id/comps/refresh", async (req, res): Promise<void> => {
  const params = GetDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  // ── Cost-protection: TTL guard ─────────────────────────────────────────────
  const force = req.query.force === "true";
  if (!force && deal.compsLastFetchedAt) {
    const ageMs = Date.now() - new Date(deal.compsLastFetchedAt).getTime();
    if (ageMs < COMP_REFRESH_TTL_MS) {
      const nextRefreshAt = new Date(
        new Date(deal.compsLastFetchedAt).getTime() + COMP_REFRESH_TTL_MS,
      );
      console.info(
        `[deals] comp refresh skipped for deal ${deal.id} — last fetched ${Math.round(ageMs / 60000)}m ago (TTL: 60m). Use ?force=true to override.`,
      );
      res.json({ refreshed: 0, cached: true, nextRefreshAt });
      return;
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const baseRadius = deal.compRadiusMiles ?? 0.5;
  const filters = {
    radiusMiles: baseRadius,
    monthsBack: deal.compMonthsBack ?? 6,
    sqftSimilarityPct: deal.compSqftPct ?? 20,
    subjectSqft: deal.sqft ?? undefined,
    subjectBeds: deal.beds ?? undefined,
    subjectBaths: deal.baths ?? undefined,
  };

  // Fetch new comps FIRST — only delete existing ones if we get results back.
  // This prevents the deal from ending up with zero comps if the API fails.
  const provider = activeCompProvider();
  let freshComps: Awaited<ReturnType<typeof provider.getCompsForProperty>> = [];
  try {
    freshComps = await provider.getCompsForProperty(deal.address, filters);
  } catch (err: any) {
    // If RentCast fails (e.g. insufficient comps), retry with a wider radius
    if (provider.name === "RentCast" && baseRadius < 5) {
      try {
        const retryRadius = Math.min(baseRadius * 2, 5);
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "Comp refresh failed, retrying with wider radius",
            dealId: deal.id,
            address: deal.address,
            provider: provider.name,
            originalRadius: baseRadius,
            retryRadius,
            error: err?.message || String(err),
            timestamp: new Date().toISOString(),
          }),
        );
        freshComps = await provider.getCompsForProperty(deal.address, {
          ...filters,
          radiusMiles: retryRadius,
        });
      } catch (retryErr: any) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Comp refresh retry also failed",
            dealId: deal.id,
            address: deal.address,
            provider: provider.name,
            retryRadius: Math.min(baseRadius * 2, 5),
            error: retryErr?.message || String(retryErr),
            stack:
              process.env.NODE_ENV === "production"
                ? undefined
                : retryErr?.stack,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } else {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Comp refresh failed",
          dealId: deal.id,
          address: deal.address,
          provider: provider.name,
          error: err?.message || String(err),
          stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  if (freshComps.length === 0) {
    // Do NOT delete existing comps — keep them and tell the client nothing changed
    res
      .status(422)
      .json({ error: "No comps found — your existing comps have been kept." });
    return;
  }

  // We have fresh results — now safe to delete-and-replace existing comps
  const existingDealComps = await db
    .select()
    .from(dealCompsTable)
    .where(eq(dealCompsTable.dealId, deal.id));

  if (existingDealComps.length > 0) {
    const compIds = existingDealComps.map((dc) => dc.compId);
    await db.delete(dealCompsTable).where(eq(dealCompsTable.dealId, deal.id));
    await db.delete(compsTable).where(inArray(compsTable.id, compIds));
  }

  const insertedComps = await db
    .insert(compsTable)
    .values(freshComps)
    .returning();
  for (const comp of insertedComps) {
    await db.insert(dealCompsTable).values({
      dealId: deal.id,
      compId: comp.id,
      included: shouldIncludeComp(deal, comp),
      relevance: "normal",
      notes: null,
    });
  }

  // Cost-protection: stamp fetch time to enable TTL on future refreshes
  await db
    .update(dealsTable)
    .set({
      dataSource: provider.name === "RentCast" ? "rentcast" : "mock",
      compsLastFetchedAt: new Date(),
    })
    .where(eq(dealsTable.id, deal.id));

  res.json({ refreshed: insertedComps.length });
});

router.get("/deals/:id/arv", async (req, res): Promise<void> => {
  const params = CalculateArvParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));
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
      ? await db
          .select()
          .from(compsTable)
          .where(inArray(compsTable.id, compIds))
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

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const {
    arv,
    rehabCost,
    closingCosts,
    holdingCosts,
    sellingCosts,
    otherCosts,
    desiredProfitAmount,
    targetReturnPct,
    purchasePrice,
  } = parsed.data;

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
