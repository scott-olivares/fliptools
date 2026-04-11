# Product Requirements Document — Deal Analyzer v1.1

**Status:** Draft  
**Goal:** Fix critical issues identified in prototype review so the tool is reliable and trustworthy for the primary user before expanding to other flippers.

---

## Context

The prototype (v1.0) was built via vibe coding on Replit using a project brief and user questionnaire. The core ARV methodology and deal pipeline are working. This PRD defines the minimum changes required before v1.1 — the version you hand to your flipper friend for real use.

---

## User

**Primary user (v1.1):** A single experienced house flipper who reviews 20–50 properties per week, manually comps properties today, and wants to reduce time spent per deal without losing confidence in the output.

**Their #1 priority:** ARV accuracy.  
**Their #2 priority:** Offer calculation.  
**Their frustration:** Volume — too many deals to analyze manually.

---

## What v1.1 Must Do

### 1. Fix the Year Built Filter

**Problem:** The Year Built Range parameter is shown in the UI and stored in the database, but is never applied when selecting which comps to include. Users see comps that violate their own criteria.

**Required behavior:**

- When comps are fetched or re-fetched, the `compYearBuiltRange` must be applied as an auto-include/exclude filter, just like radius, sqft, beds, and baths.
- If RentCast does not return year built data for a comp, the comp should still be shown but flagged as "year unknown" — do not silently include it.

**Skill needed:** Builder (backend fix in `shouldIncludeComp()` in `deals.ts`)

---

### 2. Deal Status Control in the UI

**Problem:** Every deal is created with status "New" and there is no UI to change it. The pipeline shows status badges but they never change.

**Required behavior:**

- On the Deal Detail page header, add a status selector (dropdown or segmented control) with these options:
  - New
  - Reviewing
  - Offer Submitted
  - Passed
  - Closed
- Changing the status calls `PATCH /api/deals/:id` with `{status: newValue}`.
- The pipeline dashboard must reflect the updated status immediately.

**Skill needed:** Builder (frontend component + existing API already supports it)

---

### 3. Fix Dashboard Signal Consistency

**Problem:** The pipeline table computes its own signal on the client using hardcoded thresholds that differ from the Offer Calculator's saved signal. A deal can show "Review Close" in the pipeline but "Likely Pass" in the offer analysis — or vice versa.

**Required behavior:**

- The pipeline table should display the signal from the saved `offer_analyses` record when one exists.
- When no offer has been saved, the badge should show "Not calculated" or be absent — not a guess derived from `projectedReturn`.
- The signal definition (thresholds, labels) should be defined in one place and used everywhere.

**Skill needed:** Builder (frontend, possibly requires fetching offer data per deal in the dashboard)

---

### 4. Restore Saved Offer Inputs When Returning to the Offer Tab

**Problem:** The Offer Calculator tab does not pre-populate with previously saved values when a user navigates back to it. The user cannot tell if their save worked or what their last inputs were.

**Required behavior:**

- On load, the Offer Calculator tab calls `GET /api/deals/:id/offer`.
- If a saved offer exists, all input fields (rehab cost, closing costs, holding costs, selling costs, other costs, desired profit, target return, override purchase price) are pre-populated with the saved values.
- The ARV field always reflects the current deal ARV (override or estimated), not the stale value from the saved offer.

**Skill needed:** Builder (frontend, API already returns the saved data)

---

### 5. Confirmation Before Seeding

**Problem:** The "Load Sample Data" button on the dashboard immediately destroys all data with no warning.

**Required behavior:**

- Clicking "Load Sample Data" shows a modal/dialog: "This will erase all existing deals and replace them with sample data. Are you sure?"
- Only proceed if the user confirms.
- Rename the button to "Load Sample Data (erases all deals)" to be self-documenting.

**Skill needed:** Builder (frontend only)

---

### 6. Fix Deal Delete Cascade

**Problem:** Deleting a deal via `DELETE /api/deals/:id` does not delete associated `deal_comps` or `comps` rows. These become orphaned data.

**Required behavior:**

- When a deal is deleted, all associated `deal_comps` rows must be deleted.
- `comps` rows that are no longer associated with any deal should also be deleted (or the query should cascade via DB constraint).
- Add confirmation dialog in the UI before deletion: "Delete this deal? This cannot be undone."

**Skill needed:** Builder (backend route fix + optional DB schema cascade constraint)

---

### 7. Safe Comp Refresh (Don't Delete Before Confirming New Data)

**Problem:** `POST /api/deals/:id/comps/refresh` deletes all existing comps first, then fetches. If the API returns zero results (network failure, bad address), the deal ends up with no comps.

**Required behavior:**

- Fetch new comps first. Only delete-and-replace if the new fetch returns at least one result.
- If the fetch returns zero comps, keep the existing comps and show an error: "No comps found — your existing comps have been kept."
- Show the count of comps found after refresh in the success toast: "Found 12 comps."

**Skill needed:** Builder (backend route logic)

---

## What v1.1 Should Do (High Value, Lower Risk)

### 8. Manual Comp Entry

**Problem:** Experienced investors often know of a relevant comp that isn't in the API results — a nearby flip they saw personally, a deal from a wholesaler, etc. The API supports adding manual comps but the UI does not expose it.

**Required behavior:**

- Add an "Add Comp Manually" button on the Comps Review tab.
- Opens a form with fields: Address, Sale Price, Beds, Baths, SqFt, Lot Size, Sold Date, Listing Status, Condition.
- Calls `POST /api/deals/:id/comps` with the `newComp` payload.
- The new comp appears in the comps table immediately, defaulting to included.

**Skill needed:** Builder (frontend form + existing API already supports it)

---

### 9. Deal Summary Export (Print / PDF)

**Problem:** Investors share deal analyses with partners, hard money lenders, and wholesalers. There is no way to share the analysis from this tool.

**Required behavior:**

- A "Print / Export PDF" button on the Deal Detail page (or in each tab).
- Generates a clean, printable summary including: property address + details, ARV + confidence + contributing comps table, offer calculator inputs and outputs, signal badge.
- Use browser `window.print()` with a print-specific CSS stylesheet as a low-cost first implementation — no server-side PDF generation required in v1.1.

**Skill needed:** UX (design), Builder (implementation)

---

## What v1.1 Will NOT Include

These are deferred to a later version to keep scope manageable:

- Authentication / user accounts — defer to v1.2 (needed before sharing with other users)
- Batch / CSV address intake — defer to v2.0
- Email parsing — defer to v2.0
- Expense tracking — defer to v3.0
- Team / multi-user support — defer to v3.0

---

## Inputs and Outputs

### Inputs changed or added

- Status selector on deal detail header (dropdown, values: new/reviewing/offer_submitted/passed/closed)
- Manual comp form (address, price, beds, baths, sqft, lot size, sold date, status, condition)
- Confirmation dialogs for seed and delete actions

### Outputs improved

- Pipeline status badge now reflects actual status
- Pipeline signal badge reflects saved offer signal (or is absent if no offer saved)
- Offer tab pre-populated with saved values on return
- ARV tab: comps auto-filtered by year built range where data is available
- Comp refresh shows count in success toast

---

## Edge Cases

| Scenario                                             | Expected behavior                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Year built not available in comp data                | Include comp but show "Year N/A" label; do not exclude silently                                      |
| Offer saved but user changes ARV afterward           | Offer tab shows saved cost inputs but recalculates with current ARV                                  |
| Comp refresh returns 0 results                       | Keep existing comps, show error toast                                                                |
| User deletes a deal with a saved offer               | Delete deal, deal_comps, offer_analysis, and orphaned comps in a single transaction                  |
| Manual comp added with same address as existing comp | Allow it (investor may want a different condition or price point); no deduplication required in v1.1 |

---

## Success Criteria for v1.1

The primary user (the flipper) should be able to:

- [ ] Analyze a property from scratch in under 5 minutes
- [ ] Return to a saved deal and see exactly what they analyzed before (status, ARV, offer inputs restored)
- [ ] Move deals through the pipeline (New → Reviewing → Offer Submitted → Passed/Closed)
- [ ] Delete a deal without leaving orphaned data
- [ ] Refresh comps without fear of losing everything if the API fails
- [ ] Add a comp they know about that wasn't in the auto results
- [ ] Share a deal summary with someone else (print/PDF)
