# Deal Analyzer

## Overview

A full-stack deal-screening tool for a real estate investor who buys, rehabs, and resells houses. Built to evaluate potential flip deals quickly — pulling comps, calculating ARV, and backing into an offer price.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express 5 (TypeScript)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (backend bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (deals, comps, ARV, offers, seed)
│   └── deal-analyzer/      # React + Vite frontend (dashboard, deal detail, comps, ARV, offer)
├── lib/
│   ├── api-spec/           # OpenAPI spec (openapi.yaml) + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── deals.ts        # deals table
│           ├── comps.ts        # comps table
│           ├── deal_comps.ts   # deal_comps join table
│           └── offer_analyses.ts  # offer_analyses table
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml
```

## Key Server Files

- `artifacts/api-server/src/routes/deals.ts` — CRUD for deals, ARV calc, offer analysis
- `artifacts/api-server/src/routes/comps.ts` — CRUD for comps and deal-comp associations
- `artifacts/api-server/src/routes/seed.ts` — Seeds 5 sample deals + 9 mock comps
- `artifacts/api-server/src/lib/arvEngine.ts` — ARV weighting engine + offer calculator
- `artifacts/api-server/src/lib/mockCompProvider.ts` — Mock comp data provider (swap for real MLS later)

## Key Frontend Files

- `artifacts/deal-analyzer/src/pages/dashboard.tsx` — Deal pipeline list view
- `artifacts/deal-analyzer/src/pages/new-deal.tsx` — New deal form
- `artifacts/deal-analyzer/src/pages/deal-detail/` — 4-tab detail view
  - `property-tab.tsx` — Subject property edit
  - `comps-tab.tsx` — Comp review table with filters and include/exclude
  - `arv-tab.tsx` — ARV engine results + manual override
  - `offer-tab.tsx` — Offer calculator with live recalculation

## ARV Weighting Model

| Comp Type | Base Weight |
|-----------|-------------|
| Remodeled + Sold | 1.00 |
| Remodeled + Pending | 0.85 |
| Remodeled + Active (directional only) | 0.30 |
| Average + Sold | 0.35 |
| Unknown | 0.20 |

Relevance multipliers: high=1.2×, normal=1.0×, low=0.6×

## Offer Formula

Max Offer = ARV − Rehab − Closing Costs − Holding Costs − Selling Costs − Other Costs − max(Desired Profit, ARV × Target Return %)

## Plugging in Real Comp Data

To swap out the mock comp provider for a real MLS or brokerage feed:
1. Edit `artifacts/api-server/src/lib/mockCompProvider.ts`
2. Implement the `CompProvider` interface: `getCompsForProperty(address, filters): Promise<InsertComp[]>`
3. Replace the `mockCompProvider` export with your real provider

## Deal Statuses

`new` | `reviewing` | `offer_submitted` | `passed` | `closed`

## Sample Data

POST `/api/seed` seeds 5 realistic deals with 9 mock comps each. All labeled "SAMPLE DATA" in the UI.
