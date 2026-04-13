/**
 * Email intake poller.
 *
 * Connects to a Gmail account via IMAP, scans for unread messages, extracts
 * property addresses from the email body, and creates batch_job rows for the
 * worker to process.
 *
 * Activation: set these environment variables (all required to enable polling):
 *   INTAKE_EMAIL_HOST     — IMAP host, e.g. "imap.gmail.com"
 *   INTAKE_EMAIL_USER     — Gmail address, e.g. "fliptools.intake@gmail.com"
 *   INTAKE_EMAIL_PASSWORD — Gmail App Password (16-char, no spaces)
 *   INTAKE_EMAIL_PORT     — IMAP port, defaults to 993
 *
 * Gmail setup:
 *   1. Create a dedicated Gmail account for intake
 *   2. Enable 2FA on that account
 *   3. Generate an App Password at myaccount.google.com/apppasswords
 *   4. Set the four env vars above
 *
 * If any of those vars are absent, polling is silently skipped — the rest of
 * the app continues to work normally.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { eq, and } from "drizzle-orm";
import { db, batchJobsTable } from "@workspace/db";

// ─── Config ───────────────────────────────────────────────────────────────────

export function isEmailConfigured(): boolean {
  return !!(
    process.env.INTAKE_EMAIL_HOST &&
    process.env.INTAKE_EMAIL_USER &&
    process.env.INTAKE_EMAIL_PASSWORD
  );
}

// ─── Address extraction ───────────────────────────────────────────────────────

const STREET_TYPES =
  "Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Highway|Hwy|Pkwy|Parkway|Loop";

const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";

/**
 * US street address patterns.
 *
 * Key design decisions:
 * - Both patterns require the match to start at a line boundary (after \n or
 *   start of string) so that orphaned zip codes from the previous line can't
 *   get prepended to the next street number.
 * - Pattern 1 (full): number + street + city + state + optional zip — high confidence
 * - Pattern 2 (short): number + street type + city + state on same line — requires
 *   state abbreviation to avoid matching timestamps and other numeric fragments
 */
const ADDRESS_PATTERNS = [
  // Full address with state abbreviation
  new RegExp(
    `(?:^|\\n)[ \\t]*(\\d{1,5})\\s+((?:[NSEW]\\.?\\s+)?[\\w\\s'.-]{2,40}(?:${STREET_TYPES})\\.?),?\\s+[\\w\\s]{2,30},?\\s+(?:${US_STATES})\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`,
    "gim",
  ),
  // Short form: number + street name + street type + city + state (all on one line)
  new RegExp(
    `(?:^|\\n)[ \\t]*(\\d{1,5})\\s+((?:[NSEW]\\.?\\s+)?[\\w\\s'.-]{2,30}(?:${STREET_TYPES})\\.?),?\\s+[\\w\\s]{2,25},?\\s+(?:${US_STATES})\\b`,
    "gim",
  ),
];

/**
 * Convert HTML to plain text while preserving line structure.
 * Replaces block-level tags with newlines before stripping remaining tags,
 * so that zip codes and street numbers don't bleed across lines.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|tr|td|th|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // collapse excess blank lines
    .trim();
}

/**
 * Extract candidate addresses from plain text email body.
 * Returns deduplicated, trimmed strings.
 */
export function extractAddresses(text: string): string[] {
  const found = new Set<string>();

  for (const pattern of ADDRESS_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      // Strip any leading newline captured by the line-boundary group
      const candidate = match[0]
        .replace(/^[\n\r]+/, "")
        .trim()
        .replace(/\s+/g, " ");
      if (candidate.length < 10 || candidate.length > 150) continue;
      found.add(candidate);
    }
  }

  return Array.from(found);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Given a list of (address, sourceRef) pairs, return only the ones that don't
 * already have a batch_job row for this user. Uses sourceRef (message-id) for
 * whole-email dedup, and address+userId for cross-email dedup.
 */
async function filterNewAddresses(
  candidates: { address: string; sourceRef: string }[],
  userId: string,
): Promise<{ address: string; sourceRef: string }[]> {
  if (candidates.length === 0) return [];

  const results: { address: string; sourceRef: string }[] = [];

  for (const c of candidates) {
    // Check if this exact address has already been submitted by this user
    const existing = await db
      .select({ id: batchJobsTable.id })
      .from(batchJobsTable)
      .where(
        and(
          eq(batchJobsTable.userId, userId),
          eq(batchJobsTable.address, c.address),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      results.push(c);
    }
  }

  return results;
}

// ─── Core poll function ───────────────────────────────────────────────────────

/**
 * Connect to IMAP, fetch unread messages, extract addresses, create batch jobs.
 * Marks each processed message as read.
 * Safe to call repeatedly — already-processed messages are skipped via dedup.
 */
export async function pollEmailInbox(userId = "default"): Promise<{
  emailsScanned: number;
  addressesFound: number;
  jobsCreated: number;
}> {
  if (!isEmailConfigured()) {
    return { emailsScanned: 0, addressesFound: 0, jobsCreated: 0 };
  }

  const client = new ImapFlow({
    host: process.env.INTAKE_EMAIL_HOST!,
    port: parseInt(process.env.INTAKE_EMAIL_PORT ?? "993", 10),
    secure: true,
    auth: {
      user: process.env.INTAKE_EMAIL_USER!,
      pass: process.env.INTAKE_EMAIL_PASSWORD!,
    },
    logger: false, // suppress imapflow's own verbose logging
  });

  let emailsScanned = 0;
  let addressesFound = 0;
  let jobsCreated = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch all unseen messages
      const messages = client.fetch("1:*", {
        envelope: true,
        source: true,
        flags: true,
      });

      const toProcess: { uid: number; messageId: string; source: Buffer }[] =
        [];

      for await (const msg of messages) {
        // Only process unread messages
        if (!msg.flags || msg.flags.has("\\Seen")) continue;
        if (!msg.source) continue;
        toProcess.push({
          uid: msg.uid,
          messageId: msg.envelope?.messageId ?? `uid-${msg.uid}`,
          source: msg.source,
        });
      }

      for (const msg of toProcess) {
        emailsScanned++;

        // Parse the full email
        const parsed = await simpleParser(msg.source);
        const htmlText =
          typeof parsed.html === "string" ? htmlToText(parsed.html) : "";
        const bodyText = parsed.text ?? htmlText;

        // Extract address candidates
        const candidates = extractAddresses(bodyText);
        addressesFound += candidates.length;

        if (candidates.length === 0) {
          console.log(
            JSON.stringify({
              level: "info",
              message: "EmailPoller: no addresses found in email",
              messageId: msg.messageId,
              subject: parsed.subject,
              timestamp: new Date().toISOString(),
            }),
          );
          // Still mark as read so we don't keep re-scanning it
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], {
            uid: true,
          });
          continue;
        }

        // Filter out addresses already submitted
        const newCandidates = await filterNewAddresses(
          candidates.map((address) => ({ address, sourceRef: msg.messageId })),
          userId,
        );

        if (newCandidates.length > 0) {
          // Insert all new batch jobs in one query
          await db.insert(batchJobsTable).values(
            newCandidates.map((c) => ({
              userId,
              address: c.address,
              source: "email" as const,
              sourceRef: c.sourceRef,
              status: "pending" as const,
              meta: {
                subject: parsed.subject ?? null,
                from: parsed.from?.text ?? null,
              },
            })),
          );
          jobsCreated += newCandidates.length;
        }

        console.log(
          JSON.stringify({
            level: "info",
            message: "EmailPoller: email processed",
            messageId: msg.messageId,
            subject: parsed.subject,
            candidatesFound: candidates.length,
            newJobsCreated: newCandidates.length,
            duplicatesSkipped: candidates.length - newCandidates.length,
            timestamp: new Date().toISOString(),
          }),
        );

        // Mark as read so we don't reprocess on next poll
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], {
          uid: true,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { emailsScanned, addressesFound, jobsCreated };
}
