# Product Requirements Document — Deal Analyzer v1.2 "Batch Screener"

**Status:** Draft  
**Depends on:** v1.1a deployed to Railway and validated by primary user  
**Goal:** Two things in one release: (1) finish the single-deal polish items deferred from v1.1a, and (2) build batch triage — the feature that makes this worth paying for.

> **Note:** v1.1b was eliminated as a separate release. Manual comp entry, PDF export, and all code quality findings from the v1.1a review are absorbed here alongside the batch screener work.

---

## Why This Version Matters

The primary user's biggest problem is not ARV accuracy on the deals they analyze. It's that they can't analyze most deals at all — there are too many to touch manually. Today, deals they don't have time to screen are just skipped. Some of those are probably worth an offer.

This version solves that. The user should be able to dump their full weekly deal list into the tool — from a CSV, a paste, or a forwarded email — and come back to a ranked triage view with the obvious passes already filtered out and the strong candidates flagged for deeper review.

This is the feature that creates daily habit and willingness to pay.

---

## User

**Primary user (v1.2):** Same solo flipper as v1.1. No new users yet — this is about getting maximum value for the one person already using it before opening it up to others.

**Their workflow today:**

- Receive 20–50 deal leads per week via email (wholesalers), MLS alerts, driving for dollars
- Manually pull comps on maybe 5–10 of those — the ones that feel promising based on gut
- The rest are skipped or eyeballed without analysis
- Occasionally they miss a deal because they didn't have time to run comps

**What they want:**

> "If AI could even tell me I'm close, then I could dig into those a little more manually to really find out if it's worth offering."

---

## Part A — Carried Over from v1.1a

These items were deferred from v1.1a (features) or surfaced during the v1.1a code review (quality findings). They are lower risk than the batch screener work and should be completed first within the v1.2 sprint.

### A1: Manual Comp Entry

**Problem:** Experienced investors often know of a relevant comp that isn't in the API results. The API supports adding manual comps but the UI does not expose it.

**Required behavior:**

- Add an "Add Comp Manually" button on the Comps Review tab
- Opens a form: Address, Sale Price, Beds, Baths, SqFt, Lot Size, Sold Date, Listing Status, Condition
- Calls `POST /api/deals/:id/comps` with the new comp payload
- New comp appears in the comps table immediately, defaulting to included

**Skill needed:** Builder

---

### A2: Print / PDF Export

**Problem:** Investors share analyses with partners, lenders, and wholesalers. No export exists.

**Required behavior:**

- "Print / Export" button on the Deal Detail page
- Triggers `window.print()` with a print-specific CSS stylesheet
- Prints a clean summary: property address + details, ARV + confidence, contributing comps table, offer calculator results, signal badge
- No server-side PDF generation required

**Skill needed:** UX (layout), Builder (print CSS)

---

### A3: Code Quality Fixes (from v1.1a review)

These are engineering hygiene items — no new user-facing behavior, but they reduce runtime risk and technical debt before the codebase grows with batch processing logic.

| Item                                          | Description                                                                                                                                      | Severity |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| TOCTOU gap in delete cascade                  | Move the deal existence check inside the transaction, or use `DELETE ... RETURNING` to detect atomically                                         | 🟡       |
| Silent comp fetch failure on deal creation    | `POST /api/deals` swallows comp fetch errors with only `console.warn` — add structured error logging with deal ID and address                    | 🟡       |
| `useEffect` dependency stability in offer tab | Add a `hasInitialized` ref so the effect runs once on first load, not on every re-render — prevents form fields being reset mid-session          | 🟡       |
| Deal status update — optimistic UI            | `handleStatusChange` fires a PATCH and waits for query invalidation before the select reflects the new value — add optimistic local state update | 🟡       |
| Fix `as any` cast on `useCalculateArv`        | Replace `{ enabled: !!dealId } as any` with the generated `getCalculateArvQueryKey(dealId)` helper                                               | 🔵       |
| Remove unused `useRef` import in dashboard    | Cleanup                                                                                                                                          | 🔵       |
| Deduplicate variant maps in `button.tsx`      | Extract shared constants used by both `Button` and `buttonVariants`                                                                              | 🔵       |

**Skill needed:** Builder

---

## Part B — Batch Screener (Core v1.2 Feature)

## Feature 1: Batch Address Intake

### Problem

The current new deal form accepts one address at a time. Entering 30 addresses individually is not a realistic workflow improvement.

### Required behavior

- Add a "Batch Screen" button or tab on the dashboard (separate from "New Deal").
- User can either:
  - **Paste a list** — a textarea that accepts one address per line, or comma-separated, or copied from a spreadsheet column
  - **Upload a CSV** — single column of addresses, with or without a header row
- An optional second column in the CSV (or a second textarea) accepts the asking price for each address.
- After submission, the tool queues all addresses for background auto-analysis. The user does not wait on screen — they are taken to the Triage Dashboard immediately, where results populate as they complete.
- Each address is processed using the same logic as a normal deal creation: geocode → property lookup → comp fetch → ARV calculation → signal determination.
- Addresses that fail to geocode or return zero comps are flagged in the triage view as "Could not analyze" with a reason.

### Edge cases

- Duplicate addresses in the batch: process once, show once.
- Address not found by geocoder: mark as "Address not recognized" — do not create a deal record.
- Comp fetch returns zero results: mark as "No comps found" — create the deal record but flag it for manual review.
- Batch size limit: cap at 100 addresses per batch submission to manage API costs; show a clear error if exceeded.

---

## Feature 2: Triage Dashboard

### Problem

The current pipeline dashboard shows all saved deals in a flat list sorted by date. It has no concept of ranking by opportunity or filtering out obvious passes. A user with 40 deals in the list has no way to quickly see which 5 are worth their time today.

### Required behavior

**Layout:**

- The triage view is a separate tab or section from the existing pipeline (which remains for tracking deals in progress).
- Deals are displayed in a ranked table, sorted by signal strength: Strong candidates first, then Review Close, then Likely Pass.
- Within each signal group, sort by gap to asking (smallest gap = best opportunity, shown first).

**Each row shows:**

- Address
- Asking price (if provided at intake)
- ARV estimate
- Gap to asking (asking − max offer, or asking − ARV as a proxy if no offer calc has been run)
- Signal badge: **Strong** / **Review Close** / **Likely Pass**
- Confidence badge: High / Medium / Low (from the ARV engine)
- Status indicator: Analyzed / Analyzing... / Could not analyze
- "Open Deal" button → navigates to the full deal detail view for that property

**Filtering:**

- Filter by signal (show only Strong, show only Review Close, hide Likely Pass)
- Filter by confidence (hide Low confidence results)
- The $100k gap auto-filter: any deal where asking price exceeds the estimated max offer by more than $100k is automatically marked Likely Pass and visually de-emphasized (grayed out or collapsed by default)

**Empty state:**

- When no batch has been run yet, show a clear prompt: "Paste or upload your deal list to screen up to 100 properties at once."

### Edge cases

- Asking price not provided: show ARV but omit gap and signal; mark as "Needs asking price to score."
- ARV confidence is Low: surface the deal but add a warning: "Low confidence — fewer than 2 remodeled comps found. Verify manually."
- User opens full deal detail, makes changes (excludes comps, overrides ARV), returns to triage: triage row should reflect the updated signal.

---

## Feature 3: Quick-Pass Auto-Filter

### Problem

The user explicitly stated: "Typically if I'm off by more than $100k from their asking price I don't offer." This rule should be enforced automatically so the user never has to look at those deals.

### Required behavior

- After ARV + max offer is calculated for any deal (batch or single), compare asking price to estimated max offer.
- If `asking price − max offer > $100,000`, automatically set signal to **Likely Pass** and set a `flaggedFarApart` flag on the deal.
- In the triage view, Likely Pass deals are collapsed into a "Skipped (X deals too far apart)" summary row by default, with an option to expand them.
- The user can override this on any individual deal if they want to review it anyway.
- This threshold ($100k) should be user-configurable in a settings panel (not hardcoded) — different flippers use different thresholds.

---

## Feature 4: Email Forwarding Intake

### Problem

A large portion of the user's deal flow arrives via email from wholesalers. Today they manually copy addresses out of those emails. This is the friction point they most want eliminated.

> "What would make this insanely good is if it could go through my emails and analyze all of them automatically."

### Required behavior — MVP (v1.2)

- The app provides a dedicated inbound email address (e.g. `screen@[appname].com` or a user-specific address).
- The user forwards a wholesaler email to that address.
- The system parses the email body to extract property addresses using a combination of regex patterns and an LLM extraction call.
- Each extracted address is queued for auto-analysis exactly as if it had been submitted via the batch intake form.
- The user receives a notification (in-app banner or email) when the analysis is complete: "3 properties from your forwarded email have been screened."
- Addresses the parser could not confidently extract are flagged for manual review, not silently dropped.

### Out of scope for v1.2

- Gmail/Outlook OAuth direct inbox access (the forwarding model is lower risk and doesn't require OAuth approval)
- Automatic daily inbox scanning (deferred — requires OAuth and background job scheduling)
- Extracting asking prices from email body (addresses only in v1.2; asking price entered manually if needed)

### Edge cases

- Email contains no recognizable addresses: reply to sender (or notify in-app) "No addresses found in this email."
- Email contains addresses in multiple states or formats: extract all, geocode each, flag ones that fail geocoding.
- Same address forwarded twice: deduplicate, do not re-run analysis (use existing result).

---

## Feature 5: Daily Digest View

### Problem

The user described wanting to open the app in the morning and have their deals pre-screened and waiting. This requires the triage to run overnight rather than only on demand.

### Required behavior

- A background job runs nightly (e.g. 2 AM) that re-screens any deals in the pipeline that were added in the last 24 hours but have not yet been fully analyzed.
- On login or app open, if new triage results are available since the user's last session, show a banner: "12 new deals screened overnight — 3 are worth a look."
- The banner links to the triage dashboard filtered to today's new results.
- This is not a push notification or email in v1.2 — it's an in-app banner only.

### Edge cases

- No new deals since last session: no banner shown.
- Background job fails (API outage, rate limit): log the failure, do not show the banner, retry next cycle.

---

## What v1.2 Will NOT Include

- Gmail/Outlook OAuth or automatic inbox scanning — too much surface area for v1.2; the forwarding model is sufficient
- Photo analysis for comp condition detection — deferred to v2.0
- Multi-user auth — deferred to v1.3
- Mobile app — the triage dashboard must be mobile-responsive (readable on a phone), but no native app in v1.2

---

## Inputs and Outputs

### New inputs

- Batch intake: textarea (addresses) + optional asking prices, or CSV upload
- Inbound forwarded email (system-side input)
- Quick-pass threshold setting (default $100k, user-configurable)

### New outputs

- Triage dashboard with ranked, filtered deal list
- "Analyzing..." live status per address during batch processing
- "Could not analyze" flagged rows with reason
- Daily digest banner on login
- In-app notification when forwarded email analysis completes

---

## Edge Cases Summary

| Scenario                            | Expected behavior                                                           |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Address in batch cannot be geocoded | Mark "Address not recognized," do not create deal record                    |
| Comp fetch returns 0 results        | Create deal record, mark "No comps found," show in triage as Low confidence |
| Asking price not provided           | Show ARV, omit signal score, prompt user to enter asking price to score     |
| Gap > $100k                         | Auto-mark Likely Pass, collapse in triage view by default                   |
| ARV confidence is Low               | Show deal but display warning label; do not hide it                         |
| Same address submitted twice        | Deduplicate, use existing result                                            |
| Forwarded email has no addresses    | Notify user, do not create any records                                      |
| Batch exceeds 100 addresses         | Block submission, show clear error with count                               |
| Background job fails overnight      | Log failure silently, no banner shown, retry next cycle                     |

---

## Success Criteria for v1.2

The primary user should be able to:

- [ ] Paste or upload 30+ addresses on Monday morning and have results within minutes, without entering each deal manually
- [ ] Open the app and immediately see which deals are worth investigating — without reading every row
- [ ] Forward a wholesaler email and have addresses automatically queued for screening
- [ ] Never have to look at a deal that's $100k+ off asking (auto-filtered)
- [ ] Click through from the triage view into a full deal analysis for any deal that looks promising
- [ ] Come back the next day and see overnight-processed deals flagged at the top

---

## Skills Needed to Build This

| Feature                                   | Skill                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Triage dashboard design                   | UX (run /ux before building — this view is the core value prop)   |
| Batch intake + background processing      | Builder + Grill-Me (architecture: job queue vs. async API calls)  |
| Email forwarding intake + address parsing | Builder + Grill-Me (email infrastructure decisions before coding) |
| Quick-pass auto-filter + settings         | Builder                                                           |
| Daily digest banner                       | Builder                                                           |
