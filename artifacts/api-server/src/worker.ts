/**
 * Batch job worker — runs as a separate process alongside the API server.
 *
 * Polls the batch_jobs table every 10 seconds for pending jobs, processes
 * them serially (one at a time with a 2.5s delay between each), and updates
 * the job status as it goes.
 *
 * Each job creates a deal, fetches comps, calculates ARV, saves an offer
 * analysis using sensible defaults, and stamps the usage_logs table.
 *
 * Run via: node dist/worker.mjs (after build)
 * Or via the "worker" npm script in package.json.
 */

import { eq, and, inArray, gte } from "drizzle-orm";
import {
  db,
  dealsTable,
  compsTable,
  dealCompsTable,
  offerAnalysesTable,
  batchJobsTable,
  usageLogsTable,
  digestEventsTable,
  userStateTable,
} from "@workspace/db";
import { calculateARV, calculateOffer } from "./lib/arvEngine.js";
import {
  rentcastCompProvider,
  isRentCastConfigured,
} from "./lib/rentcastProvider.js";
import { mockCompProvider } from "./lib/mockCompProvider.js";
import { pollEmailInbox, isEmailConfigured } from "./lib/emailPoller.js";
import {
  isOverCap,
  recordUsage,
  currentBillingMonth,
  MONTHLY_CAP,
} from "./lib/usageCap.js";

// ─── Config ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 10_000; // how often to check for pending jobs
const JOB_DELAY_MS = 2_500; // pause between jobs to avoid RentCast rate limits
const MAX_BATCH_SIZE = 100; // hard cap per month — see usageLogsTable
const EMAIL_POLL_INTERVAL_MS = 15 * 60 * 1_000; // check inbox every 15 minutes
const DIGEST_HOUR_UTC = 6; // 2 AM CT = 6 AM UTC (adjust for DST as needed)
const DEFAULT_REHAB_COST = 30_000; // default cost inputs for batch offer calc
const DEFAULT_CLOSING_COSTS = 5_000;
const DEFAULT_HOLDING_COSTS = 3_000;
const DEFAULT_SELLING_COSTS = 8_000;
const DEFAULT_OTHER_COSTS = 2_000;
const DEFAULT_TARGET_RETURN_PCT = 9;
const DEFAULT_DESIRED_PROFIT = 0;

function activeCompProvider() {
  return isRentCastConfigured() ? rentcastCompProvider : mockCompProvider;
}

/**
 * Process a single batch job end-to-end:
 * geocode → deal creation → comp fetch → ARV → offer analysis → usage log
 */
async function processJob(jobId: number): Promise<void> {
  // Mark as processing
  await db
    .update(batchJobsTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(batchJobsTable.id, jobId));

  const [job] = await db
    .select()
    .from(batchJobsTable)
    .where(eq(batchJobsTable.id, jobId));

  if (!job) return;

  try {
    const provider = activeCompProvider();
    const askingPriceNum = job.askingPrice ? parseFloat(job.askingPrice) : 0;

    // 1. Create the deal record
    const [deal] = await db
      .insert(dealsTable)
      .values({
        address: job.address,
        askingPrice: askingPriceNum,
        status: "new",
        dataSource: provider.name === "RentCast" ? "rentcast" : "mock",
        propertyType: "SFR",
      })
      .returning();

    // Link job → deal immediately so triage can show partial progress
    await db
      .update(batchJobsTable)
      .set({ dealId: deal.id, updatedAt: new Date() })
      .where(eq(batchJobsTable.id, jobId));

    // 2. Fetch comps
    let comps: Awaited<ReturnType<typeof provider.getCompsForProperty>> = [];
    try {
      comps = await provider.getCompsForProperty(job.address, {
        radiusMiles: 0.5,
      });

      // Retry with wider radius if empty
      if (comps.length === 0 && provider.name === "RentCast") {
        comps = await provider.getCompsForProperty(job.address, {
          radiusMiles: 2.0,
        });
      }
    } catch (err: any) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Worker: comp fetch failed",
          jobId,
          dealId: deal.id,
          address: job.address,
          error: err?.message,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    if (comps.length > 0) {
      const insertedComps = await db
        .insert(compsTable)
        .values(comps)
        .returning();

      // Bulk insert all dealComp join records in one query instead of one per comp
      await db.insert(dealCompsTable).values(
        insertedComps.map((comp) => ({
          dealId: deal.id,
          compId: comp.id,
          included: true, // include all comps by default for batch screening
          relevance: "normal" as const,
          notes: null,
        })),
      );

      await db
        .update(dealsTable)
        .set({ compsLastFetchedAt: new Date() })
        .where(eq(dealsTable.id, deal.id));
    }

    // 3. Calculate ARV using all fetched comps
    const dealComps =
      comps.length > 0
        ? await db
            .select()
            .from(dealCompsTable)
            .where(eq(dealCompsTable.dealId, deal.id))
        : [];

    const compIds = dealComps.map((dc) => dc.compId);
    const allCompsData =
      compIds.length > 0
        ? await db
            .select()
            .from(compsTable)
            .where(inArray(compsTable.id, compIds))
        : [];

    const compMap = new Map(allCompsData.map((c) => [c.id, c]));
    const compsWithJoin = dealComps
      .map((dc) => ({ dealComp: dc, comp: compMap.get(dc.compId)! }))
      .filter((item) => item.comp);

    const arvResult = calculateARV(deal.sqft, compsWithJoin);
    const arv = arvResult.suggestedArv;

    // Save ARV estimate on the deal
    await db
      .update(dealsTable)
      .set({ arvEstimate: arv })
      .where(eq(dealsTable.id, deal.id));

    // 4. Run offer calculation with default cost inputs
    const offerResult = calculateOffer({
      arv,
      rehabCost: DEFAULT_REHAB_COST,
      closingCosts: DEFAULT_CLOSING_COSTS,
      holdingCosts: DEFAULT_HOLDING_COSTS,
      sellingCosts: DEFAULT_SELLING_COSTS,
      otherCosts: DEFAULT_OTHER_COSTS,
      desiredProfitAmount: DEFAULT_DESIRED_PROFIT,
      targetReturnPct: DEFAULT_TARGET_RETURN_PCT,
      purchasePrice: null,
      askingPrice: askingPriceNum > 0 ? askingPriceNum : null,
    });

    // 5. Save offer analysis
    await db.insert(offerAnalysesTable).values({
      dealId: deal.id,
      arv,
      rehabCost: DEFAULT_REHAB_COST,
      closingCosts: DEFAULT_CLOSING_COSTS,
      holdingCosts: DEFAULT_HOLDING_COSTS,
      sellingCosts: DEFAULT_SELLING_COSTS,
      otherCosts: DEFAULT_OTHER_COSTS,
      desiredProfitAmount: DEFAULT_DESIRED_PROFIT,
      targetReturnPct: DEFAULT_TARGET_RETURN_PCT,
      purchasePrice: null,
      ...offerResult,
    });

    // Update deal with max offer from the calculation
    await db
      .update(dealsTable)
      .set({
        maxOffer: offerResult.maxOffer,
        projectedReturn: offerResult.projectedReturn,
      })
      .where(eq(dealsTable.id, deal.id));

    // 6. Log usage via shared helper
    await recordUsage(deal.id, job.source as "manual" | "email", "default");

    // 7. Mark job done
    await db
      .update(batchJobsTable)
      .set({ status: "done", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(batchJobsTable.id, jobId));

    console.log(
      JSON.stringify({
        level: "info",
        message: "Worker: job complete",
        jobId,
        dealId: deal.id,
        address: job.address,
        arv,
        signal: offerResult.signal,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Worker: job failed",
        jobId,
        address: job.address,
        error: err?.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
        timestamp: new Date().toISOString(),
      }),
    );

    await db
      .update(batchJobsTable)
      .set({
        status: "failed",
        errorMessage: err?.message ?? "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(batchJobsTable.id, jobId));
  }
}

/**
 * One poll cycle: pick up to 5 pending jobs and process them serially.
 */
async function pollAndProcess(): Promise<void> {
  try {
    // Check monthly usage cap via shared helper
    if (await isOverCap("default")) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Worker: monthly usage cap reached, skipping pending jobs",
          cap: MONTHLY_CAP,
          billingMonth: currentBillingMonth(),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // Fetch pending jobs (up to 5 at a time, oldest first)
    const pendingJobs = await db
      .select({ id: batchJobsTable.id })
      .from(batchJobsTable)
      .where(eq(batchJobsTable.status, "pending"))
      .orderBy(batchJobsTable.createdAt)
      .limit(5);

    if (pendingJobs.length === 0) return;

    console.log(
      JSON.stringify({
        level: "info",
        message: `Worker: processing ${pendingJobs.length} pending job(s)`,
        timestamp: new Date().toISOString(),
      }),
    );

    for (const job of pendingJobs) {
      await processJob(job.id);
      // Brief pause between jobs to avoid hammering the RentCast API
      await new Promise((resolve) => setTimeout(resolve, JOB_DELAY_MS));
    }
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Worker: poll cycle failed",
        error: err?.message,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// ─── Shutdown flag — declared here so both poll wrappers can read it ─────────
let shuttingDown = false;

// ─── Email poll wrapper ───────────────────────────────────────────────────────

async function pollEmailGuarded(): Promise<void> {
  if (shuttingDown) return;
  if (!isEmailConfigured()) return;

  try {
    const result = await pollEmailInbox("default"); // TODO: v1.3 — per-user inbox routing
    if (result.emailsScanned > 0 || result.jobsCreated > 0) {
      console.log(
        JSON.stringify({
          level: "info",
          message: "Worker: email poll complete",
          ...result,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Worker: email poll failed",
        error: err?.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// ─── Nightly digest ───────────────────────────────────────────────────────────

/**
 * Scans all batch jobs processed in the last 24 hours, counts signal
 * categories, and writes a digest_event row. The frontend polls for the
 * latest unread digest and shows a banner.
 *
 * Only runs once per calendar day — checks digest_events to skip if already run.
 */
async function runDigest(userId = "default"): Promise<void> {
  // Skip if already ran a digest today (UTC date)
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const alreadyRan = await db
    .select({ id: digestEventsTable.id })
    .from(digestEventsTable)
    .where(
      and(
        eq(digestEventsTable.userId, userId),
        gte(digestEventsTable.ranAt, todayUtc),
      ),
    )
    .limit(1);

  if (alreadyRan.length > 0) return;

  // Look at jobs completed in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const recentJobs = await db
    .select({ dealId: batchJobsTable.dealId })
    .from(batchJobsTable)
    .where(
      and(
        eq(batchJobsTable.userId, userId),
        eq(batchJobsTable.status, "done"),
        gte(batchJobsTable.processedAt, since),
      ),
    );

  if (recentJobs.length === 0) return; // nothing new — skip writing a digest row

  const dealIds = recentJobs
    .filter((j) => j.dealId != null)
    .map((j) => j.dealId as number);

  const offers =
    dealIds.length > 0
      ? await db
          .select({
            signal: offerAnalysesTable.signal,
            flaggedFarApart: offerAnalysesTable.flaggedFarApart,
          })
          .from(offerAnalysesTable)
          .where(inArray(offerAnalysesTable.dealId, dealIds))
      : [];

  let worthALook = 0;
  let closeCall = 0;
  for (const o of offers) {
    if (!o.flaggedFarApart && o.signal === "strong_candidate") worthALook++;
    else if (!o.flaggedFarApart && o.signal === "close_review_manually")
      closeCall++;
  }

  await db.insert(digestEventsTable).values({
    userId,
    totalScreened: recentJobs.length,
    worthALook,
    closeCall,
  });

  console.log(
    JSON.stringify({
      level: "info",
      message: "Worker: digest run complete",
      totalScreened: recentJobs.length,
      worthALook,
      closeCall,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Scheduler: fires runDigest once per day at DIGEST_HOUR_UTC.
 * Checks every minute whether it's time, then calls runDigest (which is
 * idempotent — it skips if already run today).
 */
function scheduleDailyDigest(): void {
  setInterval(async () => {
    if (shuttingDown) return;
    const now = new Date();
    if (now.getUTCHours() === DIGEST_HOUR_UTC && now.getUTCMinutes() === 0) {
      try {
        await runDigest("default"); // TODO: v1.3 — run for each active user
      } catch (err: any) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Worker: digest failed",
            error: err?.message,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }, 60_000); // check every minute
}

// ─── Entry point ──────────────────────────────────────────────────────────────
console.log(
  JSON.stringify({
    level: "info",
    message: "Batch job worker started",
    pollIntervalMs: POLL_INTERVAL_MS,
    emailPollIntervalMs: EMAIL_POLL_INTERVAL_MS,
    emailConfigured: isEmailConfigured(),
    timestamp: new Date().toISOString(),
  }),
);

async function pollAndProcessGuarded(): Promise<void> {
  if (shuttingDown) return;
  return pollAndProcess();
}

process.on("SIGTERM", () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Worker: SIGTERM received, draining current job then exiting",
      timestamp: new Date().toISOString(),
    }),
  );
  shuttingDown = true;
  // Give any in-flight job up to 30s to finish, then exit cleanly.
  setTimeout(() => process.exit(0), 30_000);
});

process.on("SIGINT", () => {
  shuttingDown = true;
  setTimeout(() => process.exit(0), 30_000);
});

// Job processing: run immediately on startup, then every 10s
pollAndProcessGuarded();
setInterval(pollAndProcessGuarded, POLL_INTERVAL_MS);

// Email polling: run once at startup (so first check is immediate), then every 15 min
pollEmailGuarded();
setInterval(pollEmailGuarded, EMAIL_POLL_INTERVAL_MS);

// Daily digest: schedule the nightly run (fires at DIGEST_HOUR_UTC each day)
scheduleDailyDigest();
