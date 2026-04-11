# Product Assessment — Deal Analyzer Prototype

**Date:** April 2026  
**Prepared by:** Product Review (AI-assisted)  
**Status:** Prototype complete. Ready for structured improvement toward a sellable product.

---

## What Was Built

The prototype delivers the core loop described in the original brief:

1. Enter an address
2. Get comps automatically (via RentCast API or mock data)
3. Review and curate comps (include/exclude, condition label, relevance weight)
4. Get an ARV estimate via a weighted-average comp model
5. Run an offer calculator with full cost breakdown
6. Save the deal to a pipeline dashboard

The brief's stated #1 goal — **accurate ARV estimation** — is implemented with a legitimate methodology: a weighted average that prioritizes remodeled sold/pending comps, applies IQR-based outlier removal, and uses a condition × status weight matrix that closely mirrors how your friend actually evaluates comps. That is the strongest part of the prototype.

---

## What Is Working Well

- **ARV methodology is sound.** The weight matrix (remodeled > average > unknown, sold > pending > active), relevance multipliers, and IQR outlier removal are aligned with how the user described their manual process.
- **Comp criteria match user requirements.** Default radius (0.5mi), lookback (6 months), SqFt tolerance (±20%), SFR-only filtering — all match the brief answers exactly.
- **Active remodeled comps treated as market signal, not price inputs.** This is a nuanced and correct implementation of what the user described ("actives show where the market might be heading").
- **Offer calculator covers the right structure.** ARV minus all costs minus margin target is the right formula framework.
- **Address autocomplete + property auto-fill** reduces manual entry friction.
- **Deal pipeline** gives a working dashboard to track multiple properties.

---

## What Is Missing or Wrong

### Critical (Blocks trust in the tool)

| #   | Issue                                                                                                                                                                                                                                                                                               | Impact                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | **Year Built filter is configured but ignored.** The UI shows a Year Built Range field and the backend stores it — but it is never applied when auto-selecting comps. Users will see comps selected that violate this rule.                                                                         | Erodes trust in ARV quality.                        |
| 2   | **Deal status cannot be updated from the UI.** Every deal starts as "New" and stays that way forever. Status is stored, but no UI control exists to change it.                                                                                                                                      | The pipeline is cosmetically broken.                |
| 3   | **Dashboard signal badge is a client-side estimate, not the saved offer signal.** The pipeline table computes its own signal from `projectedReturn` with different thresholds than the Offer Calculator. A deal saved as "Likely Pass" in the Offer tab may show as "Review Close" in the pipeline. | Contradictory information across the app.           |
| 4   | **No manual comp entry.** Backend supports it; UI does not expose it. The user explicitly described wanting to pull in comps from their own research.                                                                                                                                               | Significant workflow gap for experienced investors. |
| 5   | **Deleting a deal leaves orphaned data.** Comps and deal_comps are not deleted when a deal is deleted. This grows database noise over time.                                                                                                                                                         | Data integrity issue.                               |

### High Priority (Needed before showing to other flippers)

| #   | Issue                                                                                                                                                                  | Impact                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 6   | **No export.** Investors share analyses with partners, lenders, and wholesalers. No PDF or even copy-paste-friendly summary exists.                                    | Major workflow gap in a sharing-heavy industry.                 |
| 7   | **Offer calculator has no saved state visible.** After saving an offer, if you return to the tab, you don't see previously saved inputs restored into the form.        | Confusing — user doesn't know if their save worked.             |
| 8   | **No authentication.** Any person with the URL can read or destroy all data.                                                                                           | Required before sharing with anyone outside your local machine. |
| 9   | **Seed button is silent and destructive.** "Load Sample Data" on the dashboard wipes everything without a confirmation dialog. A real user could click it by accident. | Risk of accidental data loss.                                   |
| 10  | **Comp refresh deletes first, then fetches.** If the API returns zero results (network error, bad address), the deal ends up with zero comps and no recovery path.     | Silent data loss.                                               |

### Medium Priority (Polish for a commercial product)

| #   | Issue                                                                                                                                                                                                       | Impact                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 11  | **No notes or activity log per deal.** There is a single text "notes" field. No timestamps, no deal history, no way to see what changed.                                                                    | Fine for solo use, breaks for teams. |
| 12  | **No deal duplication.** Cannot test different rehab scenarios side-by-side.                                                                                                                                | Minor workflow friction.             |
| 13  | **ARV GET endpoint has side effects.** `GET /api/deals/:id/arv` writes back to the database. Unusual pattern that could cause unexpected overwrites.                                                        | Technical debt risk.                 |
| 14  | **In-memory caches reset on server restart.** The RentCast cost-protection cache (24hr property, 1hr comps) is lost on restart. On any hosted environment with restarts, API cost protection is unreliable. | Operational cost risk.               |

---

## What the User Actually Needs (From the Brief)

The brief reveals the real job-to-be-done more clearly than the feature list:

> "I get so many properties to look at, it's just not possible to analyze them all. But if AI could even tell me I'm close, then I could dig into those a little more manually."

The user analyzes **20–50 properties per week**. The prototype requires manually entering each address one at a time. The ARV + offer calculation is the easy part — the bottleneck is **triage at scale**.

The most valuable thing you could build for this user is **batch triage**: the ability to load many addresses at once (CSV, email, MLS export) and get a quick "worth looking at / skip" signal for each, before doing the full manual comp review.

This changes the product shape significantly:

- Current design: **deep single-deal analysis tool**
- User's actual need: **fast multi-deal screener that surfaces the ones worth deeper analysis**

The deep analysis UI is still necessary — it's the "dig in manually" step. But without a fast intake layer, the tool only helps with the last 10% of the workflow.

---

## Alignment Check: Brief vs. Prototype

| Brief Requirement                                  | Implemented? | Notes                                                                                     |
| -------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Enter address                                      | Yes          | With autocomplete                                                                         |
| Auto comp lookup                                   | Yes          | Via RentCast or mock                                                                      |
| Comp filtering (radius, time, size, beds/baths)    | Yes          | All configurable                                                                          |
| Exclude irrelevant comps                           | Yes          | Include/exclude toggle                                                                    |
| ARV estimate                                       | Yes          | Weighted avg with condition weighting                                                     |
| Override ARV                                       | Yes          | Manual override stored and respected                                                      |
| Rehab + cost inputs                                | Yes          | Full cost breakdown                                                                       |
| Offer price calculator                             | Yes          | ARV − costs − profit = max offer                                                          |
| Save deal for later                                | Yes          | Pipeline dashboard                                                                        |
| Filter: only fixed-up/remodeled homes              | Partial      | Condition label exists but auto-labeling is not done — user must manually label each comp |
| Solds + pendings for ARV, actives as market signal | Yes          | Correctly implemented                                                                     |
| Other flip/active comps shown as market signal     | Yes          | "Active Competition" section in ARV tab                                                   |
| ~9% ROI target                                     | Yes          | Default target return is 9%                                                               |
| $100k gap flag                                     | Yes          | Warning shown if gap > $100k                                                              |

**Biggest alignment gap:** Comps are not auto-labeled as "remodeled." They arrive from RentCast with a `condition` field that may or may not be populated. If it's blank, every comp defaults to "unknown" — which means the ARV engine gives them a very low weight (0.20 for sold unknowns vs. 1.00 for sold remodeled). **The user's entire methodology depends on identifying remodeled comps, but the tool does not help them do that reliably.**

---

## Summary: What Needs to Happen Next

### Before this is useful to the person it was built for:

1. Fix the year built filter (it's broken by omission)
2. Add deal status controls to the UI
3. Fix dashboard signal to use saved offer data
4. Restore saved offer inputs when returning to the Offer Calculator tab
5. Add confirmation before seeding (destructive action)
6. Fix delete cascade

### Before showing to other house flippers:

7. Add authentication (even basic email/password)
8. Add export (PDF deal summary)
9. Add manual comp entry
10. Persist caches to the database (not in-memory)

### Before charging money:

11. Build a batch intake / triage mode
12. Add comp auto-condition detection (price-per-sqft heuristic or exterior photo analysis)
13. Add team/multi-user support
14. Add deal history / activity log
15. Build the email intake the user described ("have the hot properties ready when I get to work")
