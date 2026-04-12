import { Router, type IRouter } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import { db, digestEventsTable, userStateTable } from "@workspace/db";
import {
  getUsageThisMonth,
  MONTHLY_CAP,
  currentBillingMonth,
} from "../lib/usageCap.js";

const router: IRouter = Router();

// GET /digest/pending
// Returns the most recent digest event if it was created after the user's
// last dismiss. The frontend uses this to decide whether to show the banner.
// TODO: v1.3 — replace "default" with req.user.id
router.get("/digest/pending", async (_req, res): Promise<void> => {
  const userId = "default";

  // Get the user's last dismiss time (null if never dismissed)
  const [state] = await db
    .select({ digestDismissedAt: userStateTable.digestDismissedAt })
    .from(userStateTable)
    .where(eq(userStateTable.userId, userId));

  const dismissedAt = state?.digestDismissedAt ?? null;

  // Find the most recent digest event after the last dismiss
  const query = db
    .select()
    .from(digestEventsTable)
    .where(
      dismissedAt
        ? and(
            eq(digestEventsTable.userId, userId),
            gte(digestEventsTable.ranAt, dismissedAt),
          )
        : eq(digestEventsTable.userId, userId),
    )
    .orderBy(desc(digestEventsTable.ranAt))
    .limit(1);

  const [latest] = await query;

  if (!latest) {
    res.json({
      hasPending: false,
      totalScreened: 0,
      worthALook: 0,
      closeCall: 0,
      ranAt: null,
    });
    return;
  }

  res.json({
    hasPending: true,
    totalScreened: latest.totalScreened,
    worthALook: latest.worthALook,
    closeCall: latest.closeCall,
    ranAt: latest.ranAt,
  });
});

// POST /digest/dismiss
// Records that the user dismissed the banner. Next call to /digest/pending
// will return hasPending: false until a new digest is written after this time.
// TODO: v1.3 — replace "default" with req.user.id
router.post("/digest/dismiss", async (_req, res): Promise<void> => {
  const userId = "default";

  await db
    .insert(userStateTable)
    .values({ userId, digestDismissedAt: new Date() })
    .onConflictDoUpdate({
      target: userStateTable.userId,
      set: { digestDismissedAt: new Date(), updatedAt: new Date() },
    });

  res.sendStatus(204);
});

// POST /session/ping
// Updates the user's last_seen_at. Called on app load. Used by the digest
// and future features that need to know when the user was last active.
// TODO: v1.3 — replace "default" with req.user.id
router.post("/session/ping", async (_req, res): Promise<void> => {
  const userId = "default";

  await db
    .insert(userStateTable)
    .values({ userId, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: userStateTable.userId,
      set: { lastSeenAt: new Date(), updatedAt: new Date() },
    });

  res.sendStatus(204);
});

// GET /usage — current monthly analysis count for the user.
// Shown in the UI so users know how close they are to the 100/month cap.
// TODO: v1.3 — replace "default" with req.user.id
router.get("/usage", async (_req, res): Promise<void> => {
  const userId = "default";
  const used = await getUsageThisMonth(userId);
  const remaining = Math.max(0, MONTHLY_CAP - used);

  res.json({
    used,
    cap: MONTHLY_CAP,
    billingMonth: currentBillingMonth(),
    remaining,
  });
});

export default router;
