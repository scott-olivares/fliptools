# Product Roadmap — Deal Analyzer

**Last updated:** April 2026  
**Vision:** The fastest, most accurate deal screening tool for residential house flippers.

---

## North Star

> "I can evaluate a deal in a few minutes instead of digging through comps manually — and the ones I don't have time to touch, the tool already screened for me."

---

## Why Batch Triage Is the Stickiness Driver

The primary user reviews 20–50 properties per week. At that volume, one-at-a-time address entry is not a workflow improvement — it's a different kind of manual work. The deep single-deal analysis view is necessary and must be accurate, but it is not what makes someone willing to pay for this tool.

**What creates stickiness and willingness to pay:** waking up to a pre-screened inbox of deals, ranked by signal, with the obvious passes already filtered out. That is the feature that saves hours per week and cannot be replicated with a spreadsheet.

Batch triage is therefore pulled forward to v1.2 — immediately after fixing the broken prototype — rather than waiting for v2.0. Auth and multi-user sharing follow in v1.3. Comp condition detection via photo analysis is a future enhancement (v2.5+) — valuable but not on the critical path to stickiness.

---

## Release Phases

### v1.1 — "Trustworthy" (Current focus)

**Goal:** Fix what's broken in the prototype so it's reliable for the primary user.  
**Target user:** Your flipper friend, solo, on their own machine.  
**Timeline estimate:** 1–2 weeks of focused engineering.

| Feature                                                     | Priority | Skill   |
| ----------------------------------------------------------- | -------- | ------- |
| Fix year built filter (currently broken)                    | Critical | Builder |
| Deal status selector in UI                                  | Critical | Builder |
| Fix dashboard signal consistency                            | Critical | Builder |
| Restore saved offer inputs on tab return                    | Critical | Builder |
| Confirmation before seed (destructive)                      | Critical | Builder |
| Fix deal delete cascade                                     | Critical | Builder |
| Safe comp refresh (don't delete before confirming new data) | Critical | Builder |

**Definition of done:** The primary user can run a complete deal analysis — including status tracking, returning to saved deals — without encountering broken behavior. App is live on Railway.

---

### v1.2 — "Batch Screener" ← stickiness milestone

**Goal:** Two things: finish single-deal polish deferred from v1.1a, then build batch triage — the feature that makes this worth paying for.  
**Target user:** Your flipper friend, same solo setup — but now using it for all 20–50 deals/week, not just the ones they have time to hand-enter.  
**Timeline estimate:** 4–5 weeks.  
**Note:** v1.1b was eliminated. Manual comp entry, PDF export, and v1.1a code review findings are all carried into this release.

**Part A — Carried over from v1.1a:**

| Feature                                                           | Priority | Skill        |
| ----------------------------------------------------------------- | -------- | ------------ |
| Manual comp entry                                                 | High     | Builder      |
| Print / PDF export (window.print + print CSS)                     | High     | UX + Builder |
| TOCTOU fix in delete cascade                                      | Medium   | Builder      |
| Silent comp fetch failure — structured error logging              | Medium   | Builder      |
| Offer tab useEffect dependency stability                          | Medium   | Builder      |
| Deal status optimistic UI update                                  | Medium   | Builder      |
| Minor code quality (as any cast, unused imports, duplicated maps) | Low      | Builder      |

**Part B — Batch screener:**

| Feature                                                               | Priority | Skill        |
| --------------------------------------------------------------------- | -------- | ------------ |
| Batch address intake — paste a list or upload CSV                     | Critical | UX + Builder |
| Bulk auto-analysis — background ARV + signal per address              | Critical | Builder      |
| Triage dashboard — ranked by signal with gap to asking                | Critical | UX + Builder |
| Quick-pass auto-filter — >$100k gap auto-collapsed                    | Critical | Builder      |
| Hot deals surface — one-click into full deal detail                   | High     | Builder      |
| Email forwarding intake — forward wholesaler email, extract addresses | High     | Builder      |
| Daily digest — pre-screened deals ready on app open                   | High     | Builder      |
| Persist RentCast cache to database (survives server restarts)         | High     | Builder      |

**Definition of done:** The flipper can paste this week's deal list on Monday morning, walk away, and come back to a ranked triage view with the obvious passes already filtered out.

---

### v1.3 — "Shareable"

**Goal:** Authentication and per-user data isolation so you can give other flippers their own login.  
**Target user:** 2–5 flippers using it independently.  
**Timeline estimate:** 2–3 weeks.  
**Why this comes after triage:** Auth is a prerequisite for selling to others, not for proving value. Prove value first with the primary user via v1.2, then build the infrastructure to share it.

| Feature                                                                              | Priority | Skill        |
| ------------------------------------------------------------------------------------ | -------- | ------------ |
| User authentication — Clerk, Google OAuth + email/password                           | ✅ Done  | Builder      |
| Per-user deal isolation (each user sees only their own deals)                        | ✅ Done  | Builder      |
| Invite-only access control (Clerk allowlist)                                         | ✅ Done  | Builder      |
| Public marketing homepage (SEO-optimized, crawlable by search engines and AI agents) | High     | UX + Builder |
| Email + password login (Clerk already configured, one toggle)                        | Medium   | Builder      |
| Deal notes with timestamps (activity log per deal)                                   | High     | Builder      |
| Deal duplication (clone a deal to test different assumptions)                        | Medium   | Builder      |
| Migrate existing data from userId="default" to real Clerk ID                         | High     | Builder      |

**Definition of done:** You can give another flipper a login. Their deals are invisible to everyone else. You can onboard paying customers.

---

### v2.0 — "Smarter Comps"

**Goal:** Improve ARV accuracy by solving the hardest data quality problem: identifying which comps are remodeled vs. average condition without requiring the user to manually label every one.  
**Target user:** Existing paying users who trust the triage signal but want higher confidence on close calls.  
**Timeline estimate:** 6–10 weeks (research-heavy).

| Feature                                                                                                                 | Priority | Skill              |
| ----------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ |
| Price-per-sqft heuristic for condition detection (comps significantly above neighborhood median flagged as "remodeled") | High     | Builder + research |
| Listing description NLP — scan listing remarks for remodel keywords ("updated kitchen," "new roof," etc.)               | High     | Builder + research |
| Photo analysis — use vision AI to classify comp exterior/interior photos as remodeled vs. average                       | Medium   | Builder + research |
| Confidence score improvement — feed condition detection into the weight matrix automatically                            | High     | Builder            |
| User feedback loop — "was this ARV accurate?" post-close prompt to improve signal over time                             | Medium   | Product + Builder  |

**Definition of done:** The majority of comps arrive with a condition label the user trusts, rather than defaulting to "unknown." Manual labeling becomes the exception, not the norm.

---

### v3.0 — "Full Flip Management"

**Goal:** Expand beyond deal screening into active project management for flips in progress.  
**Target user:** Flippers managing multiple active rehab projects simultaneously.  
**Timeline estimate:** 3–6 months.

| Feature                                                                           | Priority | Skill        |
| --------------------------------------------------------------------------------- | -------- | ------------ |
| Per-deal expense tracking (log costs by category: demo, framing, plumbing, etc.)  | High     | Builder + UX |
| Bill payment logging (mark expense as paid, attach invoice)                       | High     | Builder      |
| Budget vs. actual tracking per project                                            | High     | Builder      |
| Before/after photo management                                                     | Medium   | Builder      |
| Vendor contact book (order termite report, staging, photography)                  | Medium   | Builder      |
| Utility management reminders (turn on/off, cancel insurance)                      | Low      | Builder      |
| Selling workflow (list price suggestion based on final comp pull at listing time) | High     | Builder      |

**Definition of done:** A flipper can manage a project from offer through sale — tracking costs, photos, vendors, and closing — inside one tool.

---

## Skills Required by Phase

| Phase | Skills Needed                                                                |
| ----- | ---------------------------------------------------------------------------- |
| v1.1  | Builder (primary), UX (export layout)                                        |
| v1.2  | UX (triage view design is critical), Builder, Product (email intake scoping) |
| v1.3  | Builder (primary), Grill-Me (run before auth architecture decisions)         |
| v2.0  | Builder + external research (NLP, vision AI APIs), Product (scoping)         |
| v3.0  | Product (full scoping required), UX, Builder                                 |

---

## Key Decisions to Make Before v1.2

These are architectural choices that should be made deliberately before building the screener:

1. **RentCast cost at batch scale.** At 50 addresses/week auto-analyzed, API costs add up fast. You need a cost model: cache aggressively, consider a fallback data source, or price the product to absorb it.
2. **Email integration approach.** Gmail/Outlook OAuth vs. a dedicated inbound email address (e.g. deals@yourapp.com) vs. a browser extension. Major architecture difference — decide before building.
3. **Mobile.** Flippers often evaluate properties in the field. The triage dashboard especially needs to be usable on a phone. Does v1.2 require a mobile-responsive layout?
4. **Pricing model.** Before onboarding paying customers in v1.3, decide: per-seat? per deal analyzed? monthly flat fee? This determines what you need to instrument now.
5. **Data ownership.** If a paying user cancels, can they export their deal history? This becomes a legal/trust issue at commercial scale — export capability (already planned) is part of the answer.

---

## What You Are NOT Building (Explicit Non-Goals)

- MLS access or data aggregation — use RentCast or similar APIs, do not attempt to scrape or replicate MLS data
- Automated offer submission — always a human decision, the tool assists but does not act
- Property management (rentals) — this is a flip tool, not a rental management tool
- Tax advice or accounting — expense tracking is for project management, not tax filing

---

## How to Use This Roadmap

- **v1.1 items** can be handed directly to a Builder with the PRD (`docs/PRD_v1.1.md`).
- **v1.2 and beyond** should go through a Grill-Me or Product session before engineering starts — the decisions get more complex.
- Revisit and update this roadmap after each version ships, based on what you actually learn from users.
