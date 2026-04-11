# Product Requirements Document — Deal Analyzer v1.1a "Critical Fixes"

**Status:** Draft — approved for implementation  
**Scope:** Critical bug fixes only. No new features. Ship fast, validate, then add features in v1.1b.  
**Deployment target:** Railway (replacing Replit)

---

## Context

The prototype (v1.0) is currently live at `https://fliprate.replit.app/` — hosted on Replit, which is being replaced. v1.1a ships via Railway. Development happens locally with OpenCode + Claude; changes are pushed to GitHub and auto-deployed to Railway.

The primary user (the flipper) is currently using the Replit URL. The goal of v1.1a is to fix broken behavior and get a stable, trustworthy version onto Railway before the Replit deployment is retired.

---

## Decisions from pre-build review

1. **Year built filter** — RentCast does return `yearBuilt` on comp records, but the current code drops it during mapping and the `comps` table has no column for it. Fix requires: DB schema change + mapper update + filter logic. Worth fixing.
2. **Offer tab ARV behavior** — always initialize ARV from the current deal value (`deal.arvOverride || deal.arvEstimate`), never from the stale saved analysis. Restore cost inputs (rehab, closing, etc.) from saved analysis only. Show provenance label and stale ARV warning.
3. **PDF export** — `window.print()` with print CSS is acceptable for v1.1. Deferred to v1.1b.
4. **Release split** — 7 critical fixes ship as v1.1a. Manual comp entry and PDF export ship as v1.1b.
5. **Deployment** — Railway. GitHub repo must be connected before v1.1a ships.

---

## Pre-deployment requirement: Railway setup

Before any code changes ship to users, the app must be deployed on Railway.

**Steps:**

1. Push the full monorepo to a GitHub repository
2. Connect the repo to the existing Railway account
3. Create two Railway services: one for `artifacts/api-server`, one for `artifacts/deal-analyzer`
4. Set environment variables on the API server service: `DATABASE_URL`, `PORT`, `RENTCAST_API_KEY`
5. Set environment variables on the frontend service: `PORT`, `BASE_PATH`
6. Confirm the app is reachable at the Railway-provided URL
7. Share the new URL with the primary user; retire the Replit URL

---

## Fix 1: Year Built Filter

**Problem:** `compYearBuiltRange` is shown in the UI and stored on the deal, but never applied — `yearBuilt` is received from RentCast, dropped during comp mapping, and not stored on the `comps` table.

**Required changes:**

- Add `yearBuilt: integer("year_built")` column to the `comps` DB schema
- Run `pnpm push` to apply the schema change
- In `rentcastProvider.ts`, map `c.yearBuilt ?? null` into the returned `InsertComp`
- In `shouldIncludeComp()` in `deals.ts`, apply the year built range filter when both `comp.yearBuilt` and `deal.compYearBuiltRange` are present
- If `comp.yearBuilt` is null, include the comp but do not apply the filter — do not silently exclude comps with missing data

**Edge cases:**

- Comp has no year built data: include comp, show "Year N/A" in the comps table
- Subject property has no year built set: skip the filter entirely (no range to apply against)

---

## Fix 2: Deal Status Control in UI

**Problem:** Every deal is created as "New" and there is no UI control to change status. The pipeline shows status badges that never change.

**Required changes:**

- On the Deal Detail page header, add a status dropdown with values: New / Reviewing / Offer Submitted / Passed / Closed
- On change, call `PATCH /api/deals/:id` with `{ status: newValue }`
- Invalidate the deals list query so the pipeline badge updates immediately
- No new API work needed — the endpoint already supports this field

---

## Fix 3: Dashboard Signal Consistency

**Problem:** The pipeline table derives its signal client-side from `projectedReturn` using hardcoded thresholds. The Offer Calculator uses different thresholds. The same deal can show different signals in different views.

**Required changes:**

- The pipeline table must display the `signal` field from the saved `offer_analyses` record when one exists
- When no offer has been saved, show no signal badge — not a computed guess
- The `GET /api/deals` response must include the saved signal per deal (either join `offer_analyses` in the query, or add a separate field)
- Remove the client-side signal derivation from the dashboard

---

## Fix 4: Offer Tab — ARV and Saved State

**Problem (confirmed in code review):** The `useEffect` in `offer-tab.tsx` restores ARV from `serverAnalysis.arv` — the value at time of last save, not the current deal ARV. If comps changed or an override was applied since the last save, the Offer Calculator shows a stale ARV with no warning.

**Additional UX problems identified:**

- No indicator of whether form is loaded from saved data or from defaults
- Save button has no persistent confirmation — toast disappears
- Save button is visually separated from the result summary card

**Required changes:**

_Logic (offer-tab.tsx line 55):_

- Always initialize `arv` from `deal.arvOverride || deal.arvEstimate`, never from `serverAnalysis.arv`
- Restore all other fields (rehab, closing, holding, selling, other, profit, targetReturn, purchasePrice) from `serverAnalysis` as before
- If `serverAnalysis.arv` differs from current deal ARV by more than $1,000, show an inline warning on the ARV field: `"ARV updated since last save ($X → $Y)"` with a dismissible note

_Provenance label:_

- When loaded from saved analysis: show `"Loaded from saved analysis · Last saved [date]"` near the top of the inputs card
- When loaded from defaults (no saved analysis): show `"Pre-filled from ARV estimate — not yet saved"`

_Save button:_

- After a successful save, update button label to show: `"Last saved [date at time]"`
- On subsequent loads with saved data, label the button `"Update Analysis"` instead of `"Save Offer Strategy"`
- Move the Save button inside the summary card, below the Signal badge

---

## Fix 5: Confirmation Before Seeding

**Problem:** "Load Sample Data" on the dashboard immediately destroys all data with no warning.

**Required changes:**

- Show a confirmation dialog before proceeding: `"This will erase all existing deals and replace them with sample data. This cannot be undone."`
- Only proceed on explicit confirmation
- Rename the button to make the consequence self-evident: `"Load Sample Data (erases all deals)"`

---

## Fix 6: Deal Delete Cascade

**Problem:** `DELETE /api/deals/:id` only deletes the deal row. Associated `deal_comps`, `comps`, and `offer_analyses` rows are orphaned.

**Required changes:**

- In the delete route, wrap deletion in a transaction:
  1. Delete `offer_analyses` where `dealId = id`
  2. Get all `compId` values from `deal_comps` where `dealId = id`
  3. Delete `deal_comps` where `dealId = id`
  4. Delete `comps` where `id IN (compIds from step 2)` AND not referenced by any other `deal_comps` row
  5. Delete `deals` where `id = id`
- Add a confirmation dialog in the UI before deletion: `"Delete this deal? This cannot be undone."`

---

## Fix 7: Safe Comp Refresh

**Problem:** `POST /api/deals/:id/comps/refresh` deletes all existing comps before fetching. If the fetch returns zero results, the deal ends up with no comps and no recovery path.

**Required changes:**

- Fetch new comps first; only delete-and-replace if at least one result is returned
- If fetch returns zero results: keep existing comps, return an error response, show toast: `"No comps found — your existing comps have been kept"`
- Show comp count in success toast: `"Found 12 comps"`

---

## What v1.1a Does NOT Include

Deferred to v1.1b:

- Manual comp entry
- PDF / print export

Deferred to v1.2:

- Authentication
- Batch address intake
- Email forwarding

---

## Success Criteria for v1.1a

- [ ] App is live on Railway and accessible via a stable URL
- [ ] Primary user can be given the new URL to replace the Replit link
- [ ] Year built filter is applied when data is available
- [ ] Deal status can be changed from the deal detail page
- [ ] Pipeline signal badge reflects saved offer signal (or is absent if no offer saved)
- [ ] Offer Calculator always shows current ARV, warns if stale, restores saved cost inputs
- [ ] Offer Calculator shows provenance label and persistent save confirmation
- [ ] Seeding requires explicit confirmation
- [ ] Deleting a deal removes all associated data and requires confirmation
- [ ] Refreshing comps never results in zero comps due to a failed fetch
