/**
 * Shared usage-cap logic used by both POST /deals (manual intake) and the
 * batch worker (email intake).
 *
 * Cap: 100 analyses per user per calendar month (YYYY-MM UTC).
 * Tracked in usage_logs. No billing system required — just a row count.
 *
 * In v1.3, userId will come from auth middleware. For now it's "default".
 */

import { eq, and, count } from "drizzle-orm";
import { db, usageLogsTable } from "@workspace/db";

export const MONTHLY_CAP = 100;

export function currentBillingMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Returns the number of analyses used this month for the given user. */
export async function getUsageThisMonth(userId = "default"): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(usageLogsTable)
    .where(
      and(
        eq(usageLogsTable.userId, userId),
        eq(usageLogsTable.billingMonth, currentBillingMonth()),
      ),
    );
  return row?.total ?? 0;
}

/** Returns true if the user is at or over the monthly cap. */
export async function isOverCap(userId = "default"): Promise<boolean> {
  const used = await getUsageThisMonth(userId);
  return used >= MONTHLY_CAP;
}

/** Records one analysis against the usage cap. */
export async function recordUsage(
  dealId: number,
  source: "manual" | "email",
  userId = "default",
): Promise<void> {
  await db.insert(usageLogsTable).values({
    userId,
    dealId,
    source,
    billingMonth: currentBillingMonth(),
  });
}
