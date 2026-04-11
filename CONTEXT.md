# CONTEXT.md

This file contains detailed context, session continuity notes, deployment status, and extended technical details. Read this file when working on deployment, complex builds, or when you need full project context.

---

## Monorepo layout (detailed)

```
lib/db/                  Drizzle schema, pg pool, insert Zod schemas — runtime
lib/api-spec/            openapi.yaml + Orval config — dev-time only, no runtime output
lib/api-client-react/    Orval-generated React Query hooks + custom-fetch
lib/api-zod/             Orval-generated Zod validators (used by api-server)
artifacts/api-server/    Express 5 backend — bundles to dist/index.mjs
artifacts/deal-analyzer/ React + Vite frontend
artifacts/mockup-sandbox/ Isolated UI prototype, no backend connection, ignore it
scripts/                 Internal utilities (tsx runner)
```

---

## Dev commands reference

### Starting the app locally (two separate processes required)

**API server** (port 3000):

```bash
# Must source .env first — PORT and DATABASE_URL are required, throws on startup if missing
cd artifacts/api-server
source .env && pnpm build && pnpm start
# OR for convenience:
source .env && pnpm dev   # does build + start in one command, no watch mode
```

**Frontend** (port 5173):

```bash
cd artifacts/deal-analyzer
source .env && pnpm dev   # PORT and BASE_PATH required, vite.config.ts throws if missing
```

Vite proxies `/api/*` → `http://localhost:3000` — both servers must be running simultaneously.

### Workspace-level

```bash
pnpm build          # typecheck:libs → build all packages (correct order)
pnpm typecheck      # tsc --build on lib/ then typecheck all artifacts/
pnpm typecheck:libs # tsc --build only (emits .d.ts into lib/*/dist/)
```

### DB schema changes

```bash
# Edit lib/db/src/schema/*.ts, then:
cd lib/db && source .env && pnpm push       # applies diff to DB (no migration files)
# pnpm push-force  — use if you need to bypass safety prompts
```

Push mode only — no `drizzle-kit generate` workflow. Schema changes go straight to the DB.

### API contract changes

```bash
# Edit lib/api-spec/openapi.yaml, then:
cd lib/api-spec && pnpm codegen
# Regenerates lib/api-client-react/src/generated/ and lib/api-zod/src/generated/
# Generated files are committed — do not delete them
```

After codegen, run `pnpm typecheck` to catch regressions.

---

## Required environment variables

### `artifacts/api-server/.env`

| Var                | Notes                                     |
| ------------------ | ----------------------------------------- |
| `DATABASE_URL`     | Neon Postgres connection string           |
| `PORT`             | API server port (`3000`)                  |
| `RENTCAST_API_KEY` | Optional — omit to use mock comp provider |

### `artifacts/deal-analyzer/.env`

| Var         | Notes              |
| ----------- | ------------------ |
| `PORT`      | Vite port (`5173`) |
| `BASE_PATH` | Vite base (`/`)    |

### `lib/db/.env`

| Var            | Notes                                         |
| -------------- | --------------------------------------------- |
| `DATABASE_URL` | Same Neon URL — needed for `drizzle-kit push` |

`.env` files are gitignored. Never commit secrets.

---

## Critical quirks (detailed)

**No watch mode on the API server.** `pnpm dev` does a full esbuild build + start. To pick up changes: kill, rebuild, restart. There is no `--watch` or nodemon.

**`lib/db` exports raw `.ts` source**, not compiled JS. Works because api-server (esbuild) and deal-analyzer (Vite) both consume TypeScript directly. Cannot be run with plain `node`.

**`zod/v4` sub-path import is intentional.** Schema files use `import { z } from "zod/v4"` — the v4 compat path in Zod 3.x. Do not change to `"zod"` — breaks `drizzle-zod` interop.

**pnpm catalog versions.** Many `package.json` entries use `"catalog:"` as the version — these are resolved from the `catalog:` block in `pnpm-workspace.yaml`. Do not write raw version strings for catalog entries.

**`autoInstallPeers: false`** (`.npmrc` and `pnpm-workspace.yaml`). Peer deps must be added explicitly.

**`customConditions: ["workspace"]`** in `tsconfig.base.json` enables TypeScript to resolve `lib/` packages' `.ts` source exports via project references. Required for the monorepo to type-check correctly.

**macOS native binaries.** The lockfile was created on Replit (Linux). On macOS, first-time setup requires these optional deps at the workspace root:

```bash
pnpm add @rollup/rollup-darwin-x64 lightningcss-darwin-x64 @tailwindcss/oxide-darwin-x64 --save-optional -w
```

**esbuild bundle shim.** `build.mjs` injects a CJS shim (`globalThis.require`, `__filename`, `__dirname`) for ESM/CJS interop. `pg-native` and other native modules are externalized. Do not remove `esbuild-plugin-pino` — Pino uses worker threads that require it.

**Active (not sold) remodeled comps** are excluded from the ARV weighted average by design — treated as directional signal only. See `arvEngine.ts`.

**RentCast cost-protection is in-memory.** 24-hour property cache + 1-hour comp TTL reset on server restart. Override with `?force=true` on the refresh endpoint.

**Geocoding** uses Photon (OpenStreetMap), no API key needed. Endpoint: `/api/geocode/autocomplete`.

**`@workspace/api-spec` has no build script** and no runtime consumers. It is a dev-time codegen tool only — never import from it.

**Vite blocks dotfiles** (`fs.deny: ["**/.*"]`). The `@assets` alias resolves to `attached_assets/` at the workspace root.

---

## Codegen / build dependency order

```
openapi.yaml → [orval] → api-zod (server validation)
                       → api-client-react (frontend hooks)

db schema → [drizzle-zod] → insertXxxSchema types in api-server routes
```

Build order for a clean start:

1. `pnpm typecheck:libs` — emits `.d.ts` for lib packages
2. `pnpm --filter @workspace/api-server build`
3. `pnpm --filter @workspace/deal-analyzer build`

**Production build (Railway):** Run only from `artifacts/api-server`:

```bash
pnpm build   # builds frontend first, then bundles api-server
pnpm start
```

This single command builds both the frontend (`deal-analyzer/dist/public`) and the server bundle. In production the Express server serves the frontend as static files.

---

## api-zod index quirk

`lib/api-zod/src/index.ts` must only contain:

```ts
export * from "./generated/api";
```

Do NOT add `export * from "./generated/types"` or `export * from "./generated/api.schemas"` — codegen may regenerate the index with these lines, causing duplicate export errors. Always check and fix after running `pnpm codegen`.

---

## Session continuity — last updated April 11 2026

### What was built (v1.1a)

All 7 critical fixes from `docs/PRD_v1.1a.md` are complete and committed to `main`:

1. Year built filter — DB column added, RentCast mapper updated, filter applied in `shouldIncludeComp()`
2. Deal status dropdown — interactive selector in deal detail header, writes via PATCH
3. Dashboard signal consistency — sourced from saved `offer_analyses.signal`, absent when none saved
4. Offer tab ARV + saved state — always uses current ARV, restores cost inputs, stale warning, provenance label, persistent save confirmation
5. Seed confirmation dialog — modal before wiping data; `POST /api/seed` blocked in production
6. Deal delete cascade — transaction cleans up offer_analyses → deal_comps → orphaned comps → deal
7. Safe comp refresh — fetch first, only delete-and-replace if results returned (returns 422 otherwise)

Also fixed during review: pre-existing type errors across comps-tab, property-tab, geocode, button.tsx, openapi spec gaps, api-zod duplicate exports.

### GitHub push status

✅ **COMPLETE** - All v1.1a commits pushed to GitHub

- Used `gh auth login` with personal access token to authenticate
- Successfully pushed commits including Railway configuration

### Railway deployment — IN PROGRESS

**Current status:**

- Railway project created: `accurate-abundance`
- GitHub repo connected: `scott-olivares/fliptools`
- Service: `@workspace/api-server` (keep ONLY this service, delete all others Railway auto-created)
- Environment variables configured:
  - ✅ NODE_ENV = production
  - ✅ PORT = 3000
  - ✅ DATABASE_URL = (Neon connection string set)
  - ✅ RENTCAST_API_KEY = (set)

**Configuration files created:**

- `nixpacks.toml` at workspace root (latest commit: a94967d)
- Configured to run from workspace root to access pnpm catalog

**NEXT STEPS (immediate):**

1. **In Railway Settings → Build section:**
   - Set Builder to: **Nixpacks** (ignore "deprecated" warning - it works better for pnpm monorepos)
   - **Remove the "Root Directory" setting** - leave it empty or set to `.`
     - This is CRITICAL - Railway needs to build from workspace root where `pnpm-workspace.yaml` and catalog are located
   - Custom Build Command should remain: `pnpm install && pnpm build`
   - Custom Start Command should remain: `pnpm start`

2. **After removing Root Directory:**
   - Railway will auto-deploy
   - The `nixpacks.toml` at workspace root will handle the build:
     - Runs `pnpm install --frozen-lockfile` from workspace root (has access to catalog)
     - Runs `cd artifacts/api-server && pnpm build` (builds frontend + server)
     - Runs `cd artifacts/api-server && pnpm start` (serves both)

3. **Check build logs** - should succeed this time since pnpm catalog will be accessible

**Previous deployment issues encountered:**

- Railpack tried to use `npm install` instead of `pnpm` - failed on workspace:\* protocol
- First nixpacks.toml was in `artifacts/api-server/` but Root Directory prevented access to workspace catalog
- Solution: moved nixpacks.toml to workspace root + must remove Root Directory setting

---

## v1.2 Task Brief — Batch Screener (Apr 11, 2026)

### What we're building
A batch address screening system that processes 20-100 property addresses asynchronously, displays ranked results in a triage dashboard, and accepts addresses via paste/CSV upload or email forwarding.

### Why
The primary user receives 20-50 deal leads per week but only has time to manually analyze 5-10. The rest are skipped. This feature enables screening the full list automatically, surfacing the strong candidates and filtering out obvious passes so no good deals are missed.

### Scope (in)
**Part A — Carried over from v1.1a:**
- Manual comp entry UI
- Print/PDF export via `window.print()`
- 7 code quality fixes from v1.1a review

**Part B — Batch screener core:**
- Batch intake: textarea (paste addresses) + CSV upload
- Email forwarding: dedicated Gmail + IMAP poller checking every 15 min
- Triage dashboard: ranked deal list sorted by signal strength
- Quick-pass auto-filter: deals >$100k off asking auto-flagged as "Likely Pass"
- Daily digest: re-process new unanalyzed deals overnight, show banner on login
- Usage tracking: hard-coded 100 properties/month limit with counter in UI

### Scope (out / later)
- Payment integration (deferred until 2-3 paying users)
- Gmail/Outlook OAuth (using IMAP poller instead)
- Automatic inbox scanning (manual forwarding only)
- Photo analysis for comp condition detection (v2.0)
- Multi-user auth (v1.3)

### Key decisions made

**1. Pricing/Monetization:**
- Free tier: 10 properties/month, no batch upload
- Pro tier: 100 properties/month, $29-49/mo (not built yet, just track usage)
- v1.2 ships with hard-coded 100/mo limit for primary user
- Usage tracked in `usage_logs` table
- Return 429 error when exceeded

**2. Job infrastructure:**
- Database-backed queue (`batch_jobs` table)
- Worker process runs in same Railway container as API (separate npm script)
- Worker polls DB every 10 seconds for pending jobs
- Serial processing: one property at a time, 2-3 sec delay between each
- Jobs survive server restarts (persisted in DB)
- No Redis/BullMQ (keeps it simple and free)

**3. Email infrastructure:**
- Dedicated Gmail account (e.g., `fliptools.intake@gmail.com`)
- IMAP poller checks inbox every 15 minutes
- Parse email body with regex for addresses
- Create batch jobs same as manual upload
- Mark emails as read after processing
- Upgrade to paid service (SendGrid/Postmark) only when needed

**4. Batch processing UX:**
- Show partial results immediately as they complete (don't wait for full batch)
- Live progress: "23 of 50 complete" with updating list
- User can click into completed deals while others process
- Processing continues if user closes browser
- Show banner when they return: "Your batch of 50 properties finished"
- Failed addresses: flag with clear reason ("Address not found → Check for typos"), no auto-retry

**5. Daily digest:**
- Only process NEW deals that haven't been analyzed yet
- Don't re-fetch comps for existing deals (too expensive)
- Run nightly at 2 AM
- In-app banner only (no email/push in v1.2)

### Risks / watch-outs
- **API costs:** Serial processing with delays keeps this manageable, but monitor RentCast usage ($0.15-0.40/property)
- **Email parsing accuracy:** Regex-based parsing may miss addresses in weird formats—flag for manual review instead of silently dropping
- **Gmail rate limits:** IMAP polling every 15 min is well under limits for single user, but track if issues arise
- **Worker process reliability:** If worker crashes, jobs stay in DB as "pending" but won't auto-restart—add health check or manual restart command

### Suggested starting point
1. **Part A first** (lower risk, builds confidence):
   - A1: Manual comp entry (1-2 hours)
   - A2: Print CSS (1 hour)
   - A3: Code quality fixes (3-4 hours)
2. **Then Part B:**
   - Create `batch_jobs` and `usage_logs` tables
   - Build batch intake UI (paste/CSV)
   - Implement worker process
   - Build triage dashboard (run `/ux` first on layout)
   - Add email IMAP poller
   - Add daily digest job

---

### Key product docs

- `docs/PRODUCT_ASSESSMENT.md` — full audit of prototype vs brief
- `docs/PRD_v1.1a.md` — v1.1a requirements (complete)
- `docs/PRD_v1.2.md` — v1.2 requirements (batch screener + carried-over items)
- `docs/ROADMAP.md` — full release roadmap v1.1a → v3.0
- `project_brief.pdf` — original user questionnaire and brief
