import { Comp, DealComp as DealCompRow } from "@workspace/db";

interface CompWithJoin {
  dealComp: DealCompRow;
  comp: Comp;
}

const CONDITION_STATUS_WEIGHTS: Record<string, Record<string, number>> = {
  remodeled: { sold: 1.0, pending: 0.85, active: 0.3 },
  average: { sold: 0.35, pending: 0.3, active: 0.1 },
  unknown: { sold: 0.2, pending: 0.15, active: 0.05 },
};

const RELEVANCE_MULTIPLIER: Record<string, number> = {
  high: 1.2,
  normal: 1.0,
  low: 0.6,
};

function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lower && v <= upper);
}

export interface ARVEngineResult {
  suggestedArv: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceExplanation: string;
  methodology: string;
  contributingComps: {
    compId: number;
    address: string;
    salePrice: number;
    condition: string;
    listingStatus: string;
    weight: number;
    adjustedContribution: number;
  }[];
  marketComps: {
    compId: number;
    address: string;
    listPrice: number;
    condition: string;
    listingStatus: string;
  }[];
  marketSignal: string | null;
  pricePerSqft: number | null;
  totalWeightedComps: number;
}

export function calculateARV(
  dealSqft: number | null | undefined,
  compsWithJoin: CompWithJoin[]
): ARVEngineResult {
  const includedComps = compsWithJoin.filter((c) => c.dealComp.included);

  const primaryComps = includedComps.filter(
    (c) => !(c.comp.listingStatus === "active" && c.comp.condition === "remodeled")
  );

  const marketComps = includedComps.filter(
    (c) => c.comp.listingStatus === "active" && c.comp.condition === "remodeled"
  );

  const weightedEntries: { price: number; weight: number }[] = [];

  for (const item of primaryComps) {
    const { comp, dealComp } = item;
    const price = comp.salePrice ?? comp.listPrice;
    if (!price) continue;

    const conditionWeights = CONDITION_STATUS_WEIGHTS[comp.condition] ?? CONDITION_STATUS_WEIGHTS["unknown"];
    const baseWeight = conditionWeights[comp.listingStatus] ?? 0.1;
    const relevanceMultiplier = RELEVANCE_MULTIPLIER[dealComp.relevance] ?? 1.0;
    const finalWeight = baseWeight * relevanceMultiplier;

    weightedEntries.push({ price, weight: finalWeight });
  }

  if (weightedEntries.length === 0) {
    return {
      suggestedArv: 0,
      confidenceLevel: "low",
      confidenceExplanation: "No included comps with price data available.",
      methodology: "No comps available to calculate ARV.",
      contributingComps: [],
      marketComps: marketComps.map((m) => ({
        compId: m.comp.id,
        address: m.comp.address,
        listPrice: m.comp.listPrice ?? m.comp.salePrice ?? 0,
        condition: m.comp.condition,
        listingStatus: m.comp.listingStatus,
      })),
      marketSignal: null,
      pricePerSqft: null,
      totalWeightedComps: 0,
    };
  }

  const prices = weightedEntries.map((e) => e.price);
  const filteredPrices = removeOutliers(prices);
  const filteredEntries = weightedEntries.filter((e) => filteredPrices.includes(e.price));

  const totalWeight = filteredEntries.reduce((sum, e) => sum + e.weight, 0);
  const weightedSum = filteredEntries.reduce((sum, e) => sum + e.price * e.weight, 0);
  const suggestedArv = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const remodeledSoldCount = primaryComps.filter(
    (c) => c.comp.condition === "remodeled" && c.comp.listingStatus === "sold" && c.dealComp.included
  ).length;
  const remodeledPendingCount = primaryComps.filter(
    (c) => c.comp.condition === "remodeled" && c.comp.listingStatus === "pending" && c.dealComp.included
  ).length;
  const strongCompCount = remodeledSoldCount + remodeledPendingCount;

  let confidenceLevel: "high" | "medium" | "low";
  let confidenceExplanation: string;

  if (strongCompCount >= 3) {
    confidenceLevel = "high";
    confidenceExplanation = `${strongCompCount} renovated/remodeled sold or pending comps used — strong basis for ARV.`;
  } else if (strongCompCount >= 1) {
    confidenceLevel = "medium";
    confidenceExplanation = `Only ${strongCompCount} renovated comp(s) available. ARV has moderate confidence. Consider reviewing manually.`;
  } else {
    confidenceLevel = "low";
    confidenceExplanation = "No renovated comps found. ARV based on average or unknown-condition comps only. Manually verify before making an offer.";
  }

  const pricePerSqft =
    dealSqft && dealSqft > 0 ? Math.round((suggestedArv / dealSqft) * 10) / 10 : null;

  const marketActiveAvg =
    marketComps.length > 0
      ? marketComps.reduce((sum, m) => sum + (m.comp.listPrice ?? m.comp.salePrice ?? 0), 0) / marketComps.length
      : null;

  let marketSignal: string | null = null;
  if (marketActiveAvg !== null && marketActiveAvg < suggestedArv * 0.97) {
    marketSignal = `Active renovated comps average $${marketActiveAvg.toLocaleString()} — below the ARV estimate of $${suggestedArv.toLocaleString()}. This may signal a softening market. Use caution.`;
  }

  const contributing = filteredEntries.map((entry, i) => {
    const origItem = primaryComps.find((c) => {
      const price = c.comp.salePrice ?? c.comp.listPrice;
      return price === entry.price;
    });
    if (!origItem) return null;
    return {
      compId: origItem.comp.id,
      address: origItem.comp.address,
      salePrice: entry.price,
      condition: origItem.comp.condition,
      listingStatus: origItem.comp.listingStatus,
      weight: Math.round(entry.weight * 100) / 100,
      adjustedContribution: Math.round((entry.price * entry.weight) / totalWeight),
    };
  }).filter(Boolean) as ARVEngineResult["contributingComps"];

  const methodology = `Weighted average using ${filteredEntries.length} comp(s) after outlier removal. Weights: remodeled+sold=1.0, remodeled+pending=0.85, remodeled+active=0.30 (directional only), average+sold=0.35, unknown=0.20. Relevance multipliers applied (high=1.2x, normal=1.0x, low=0.6x).`;

  return {
    suggestedArv,
    confidenceLevel,
    confidenceExplanation,
    methodology,
    contributingComps: contributing,
    marketComps: marketComps.map((m) => ({
      compId: m.comp.id,
      address: m.comp.address,
      listPrice: m.comp.listPrice ?? m.comp.salePrice ?? 0,
      condition: m.comp.condition,
      listingStatus: m.comp.listingStatus,
    })),
    marketSignal,
    pricePerSqft,
    totalWeightedComps: filteredEntries.length,
  };
}

export function calculateOffer(params: {
  arv: number;
  rehabCost: number;
  closingCosts: number;
  holdingCosts: number;
  sellingCosts: number;
  otherCosts: number;
  desiredProfitAmount: number;
  targetReturnPct: number;
  purchasePrice?: number | null;
  askingPrice?: number | null;
}) {
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
    askingPrice,
  } = params;

  const totalCosts = rehabCost + closingCosts + holdingCosts + sellingCosts + otherCosts;
  const targetProfit = Math.max(desiredProfitAmount, arv * (targetReturnPct / 100));
  const maxOffer = arv - totalCosts - targetProfit;

  let projectedReturn: number | null = null;
  let projectedProfit: number | null = null;
  if (purchasePrice !== null && purchasePrice !== undefined) {
    const profit = arv - purchasePrice - totalCosts;
    projectedProfit = Math.round(profit);
    projectedReturn = arv > 0 ? Math.round((profit / arv) * 10000) / 100 : null;
  }

  const gapToAsking = askingPrice != null ? Math.round(askingPrice - maxOffer) : null;
  const flaggedFarApart = gapToAsking !== null && gapToAsking > 100000;

  let signal: "strong_candidate" | "close_review_manually" | "likely_pass";
  let signalExplanation: string;

  if (purchasePrice !== null && purchasePrice !== undefined) {
    const returnPct = projectedReturn ?? 0;
    if (returnPct >= targetReturnPct) {
      signal = "strong_candidate";
      signalExplanation = `Projected return of ${returnPct.toFixed(1)}% meets or exceeds the ${targetReturnPct}% target.`;
    } else if (returnPct >= targetReturnPct * 0.8) {
      signal = "close_review_manually";
      signalExplanation = `Projected return of ${returnPct.toFixed(1)}% is slightly below the ${targetReturnPct}% target. Review manually.`;
    } else {
      signal = "likely_pass";
      signalExplanation = `Projected return of ${returnPct.toFixed(1)}% is well below the ${targetReturnPct}% target.`;
    }
  } else if (askingPrice != null) {
    if (askingPrice <= maxOffer) {
      signal = "strong_candidate";
      signalExplanation = `Asking price of $${askingPrice.toLocaleString()} is at or below the max offer of $${Math.round(maxOffer).toLocaleString()}.`;
    } else if (gapToAsking !== null && gapToAsking <= 30000) {
      signal = "close_review_manually";
      signalExplanation = `Asking price is $${gapToAsking.toLocaleString()} above max offer. Close — worth negotiating.`;
    } else {
      signal = "likely_pass";
      signalExplanation = `Asking price is $${gapToAsking?.toLocaleString() ?? "unknown"} above max offer. Likely too far apart.`;
    }
  } else {
    signal = "likely_pass";
    signalExplanation = "Enter purchase price or asking price to get a signal.";
  }

  return {
    maxOffer: Math.round(maxOffer),
    projectedReturn,
    projectedProfit,
    signal,
    signalExplanation,
    totalCosts: Math.round(totalCosts),
    gapToAsking,
    flaggedFarApart,
  };
}
