import { Router, type IRouter } from "express";
import { desc, eq, inArray, and, gte } from "drizzle-orm";
import {
  db,
  dealsTable,
  offerAnalysesTable,
  batchJobsTable,
} from "@workspace/db";

const router: IRouter = Router();

// How far back to look when loading the triage list.
// Keeps the query bounded at scale — older deals stay in the pipeline view.
const TRIAGE_WINDOW_DAYS = 30;

// Shape of a single triage row
interface TriageDeal {
  id: number;
  hasDeal: boolean; // true when a deal record exists; replaces the negative-id sentinel
  address: string;
  askingPrice: number | null;
  arvEstimate: number | null;
  maxOffer: number | null;
  gapToAsking: number | null;
  signal: string | null;
  confidenceLevel: string | null;
  flaggedFarApart: boolean;
  triageStatus: "pending" | "processing" | "done" | "failed";
  errorMessage: string | null;
  source: string;
  createdAt: Date;
}

// A deal needs an asking price when it's done processing and has an ARV
// but no asking price was provided — it can't be scored yet.
function needsAskingPrice(row: TriageDeal): boolean {
  return (
    row.triageStatus === "done" &&
    (row.askingPrice == null || row.askingPrice === 0) &&
    row.arvEstimate != null &&
    row.arvEstimate > 0
  );
}

// Shared grouping logic used by both the list and stats endpoints.
function groupBySignal(rows: TriageDeal[]) {
  const strong: TriageDeal[] = [];
  const closeCall: TriageDeal[] = [];
  const likelyPass: TriageDeal[] = [];
  const needsPrice: TriageDeal[] = [];
  const analyzing: TriageDeal[] = [];
  const failed: TriageDeal[] = [];

  for (const row of rows) {
    if (row.triageStatus === "failed") {
      failed.push(row);
    } else if (
      row.triageStatus === "pending" ||
      row.triageStatus === "processing"
    ) {
      analyzing.push(row);
    } else if (needsAskingPrice(row)) {
      // Done but no asking price — can't score, don't penalize as "Too Far Apart"
      needsPrice.push(row);
    } else if (row.flaggedFarApart || row.signal === "likely_pass") {
      likelyPass.push(row);
    } else if (row.signal === "strong_candidate") {
      strong.push(row);
    } else if (row.signal === "close_review_manually") {
      closeCall.push(row);
    } else {
      analyzing.push(row);
    }
  }

  // Sort within each group: smallest gap first (negative gap = asking below max offer = best)
  const byGap = (a: TriageDeal, b: TriageDeal) => {
    if (a.gapToAsking == null && b.gapToAsking == null) return 0;
    if (a.gapToAsking == null) return 1;
    if (b.gapToAsking == null) return -1;
    return a.gapToAsking - b.gapToAsking;
  };
  strong.sort(byGap);
  closeCall.sort(byGap);

  return { strong, closeCall, likelyPass, needsPrice, analyzing, failed };
}

// Fetch all batch jobs + offer data for a given user within the triage window,
// and assemble them into TriageDeal rows. Shared between both endpoints.
async function loadTriageRows(userId: string): Promise<TriageDeal[]> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - TRIAGE_WINDOW_DAYS);

  const jobs = await db
    .select()
    .from(batchJobsTable)
    .where(
      and(
        eq(batchJobsTable.userId, userId),
        gte(batchJobsTable.createdAt, windowStart),
      ),
    )
    .orderBy(desc(batchJobsTable.createdAt));

  if (jobs.length === 0) return [];

  const jobsWithDeal = jobs.filter((j) => j.dealId != null);
  const dealIds = jobsWithDeal.map((j) => j.dealId as number);

  const [deals, offerAnalyses] = await Promise.all([
    dealIds.length > 0
      ? db.select().from(dealsTable).where(inArray(dealsTable.id, dealIds))
      : Promise.resolve([]),
    dealIds.length > 0
      ? db
          .select()
          .from(offerAnalysesTable)
          .where(inArray(offerAnalysesTable.dealId, dealIds))
      : Promise.resolve([]),
  ]);

  const dealMap = new Map(deals.map((d) => [d.id, d]));
  // Fix: build map from offerAnalyses directly, keyed by dealId.
  // Previously built with a positional index that assumed DB return order
  // matched the filtered jobs array order — not guaranteed, causing signal swaps.
  const offerMap = new Map(offerAnalyses.map((o) => [o.dealId, o]));

  const rows: TriageDeal[] = [];

  for (const job of jobsWithDeal) {
    const deal = dealMap.get(job.dealId as number);
    if (!deal) continue;
    const offer = offerMap.get(deal.id);

    rows.push({
      id: deal.id,
      hasDeal: true,
      address: deal.address,
      askingPrice: deal.askingPrice,
      arvEstimate: deal.arvEstimate,
      maxOffer: offer?.maxOffer ?? deal.maxOffer,
      gapToAsking: offer?.gapToAsking ?? null,
      signal: offer?.signal ?? null,
      confidenceLevel: null, // ARV confidence not yet persisted — future enhancement
      flaggedFarApart: offer?.flaggedFarApart ?? false,
      triageStatus: job.status as TriageDeal["triageStatus"],
      errorMessage: job.errorMessage,
      source: job.source,
      createdAt: job.createdAt,
    });
  }

  // Jobs with no deal yet: pending/processing/failed before deal record was created
  for (const job of jobs.filter((j) => j.dealId == null)) {
    rows.push({
      id: job.id,
      hasDeal: false,
      address: job.address,
      askingPrice: job.askingPrice ? parseFloat(job.askingPrice) : null,
      arvEstimate: null,
      maxOffer: null,
      gapToAsking: null,
      signal: null,
      confidenceLevel: null,
      flaggedFarApart: false,
      triageStatus: job.status as TriageDeal["triageStatus"],
      errorMessage: job.errorMessage,
      source: job.source,
      createdAt: job.createdAt,
    });
  }

  return rows;
}

// GET /triage — full deal list grouped by signal.
router.get("/triage", async (_req, res): Promise<void> => {
  const userId: string = res.locals.userId;
  const rows = await loadTriageRows(userId);

  if (rows.length === 0) {
    res.json({
      strong: [],
      closeCall: [],
      likelyPass: [],
      needsPrice: [],
      analyzing: [],
      failed: [],
    });
    return;
  }

  res.json(groupBySignal(rows));
});

// GET /triage/stats — lightweight counts for the dashboard header/badge.
// Kept as a separate endpoint intentionally: at scale, stats can be cached
// or precomputed independently of the full list (different TTL, different query shape).
router.get("/triage/stats", async (_req, res): Promise<void> => {
  const userId: string = res.locals.userId;
  const rows = await loadTriageRows(userId);

  if (rows.length === 0) {
    res.json({
      total: 0,
      strong: 0,
      closeCall: 0,
      likelyPass: 0,
      analyzing: 0,
      failed: 0,
      lastUpdatedAt: null,
    });
    return;
  }

  const grouped = groupBySignal(rows);
  const lastUpdatedAt = rows.reduce(
    (latest, r) => (r.createdAt > latest ? r.createdAt : latest),
    rows[0].createdAt,
  );

  res.json({
    total: rows.length,
    strong: grouped.strong.length,
    closeCall: grouped.closeCall.length,
    likelyPass: grouped.likelyPass.length,
    needsPrice: grouped.needsPrice.length,
    analyzing: grouped.analyzing.length,
    failed: grouped.failed.length,
    lastUpdatedAt,
  });
});

export default router;
