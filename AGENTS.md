# AGENTS.md

## Stack at a glance

- **Node 24**, **pnpm** (enforced — `npm`/`yarn` blocked by `preinstall` guard)
- Backend: Express 5, esbuild, Drizzle ORM + PostgreSQL (Neon)
- Frontend: React 19, Vite 7, Tailwind 4, TanStack Query
- Codegen: Orval (OpenAPI → React Query hooks + Zod schemas)
- TypeScript project references for `lib/` packages

---

## Monorepo layout

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

## Dev commands

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

## Critical quirks

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

### What was NOT done yet (blocked on GitHub push)

- **`git push` to GitHub is pending** — the commit exists locally on `main` but was never pushed
- Authentication failed with HTTPS. Homebrew was installed to get `gh` CLI
- Homebrew installed successfully. PATH was configured with the three `echo`/`eval` commands
- **Next step: open a new terminal and run `brew install gh && gh auth login`, then `git push`**

### Railway deployment — ready to configure

The app is wired for single-service Railway deployment:

- `artifacts/api-server/package.json` `build` script builds the frontend then the server
- `artifacts/api-server/src/app.ts` serves `deal-analyzer/dist/public` as static files in production
- `vite.config.ts` PORT/BASE_PATH are no longer required during build (only dev/preview)

**Railway settings (one service):**
| Setting | Value |
|---|---|
| Root directory | `artifacts/api-server` |
| Build command | `pnpm install && pnpm build` |
| Start command | `pnpm start` |
| NODE_ENV | `production` |
| PORT | `3000` |
| DATABASE_URL | _(Neon connection string)_ |
| RENTCAST_API_KEY | _(optional — omit for mock data)_ |

### What's next after Railway is live

1. Give friend the new Railway URL, retire `https://fliprate.replit.app/`
2. Begin v1.2 — see `docs/PRD_v1.2.md` for full scope
3. Start v1.2 with `/grill-me` on the batch screener architecture before building

### Key product docs

- `docs/PRODUCT_ASSESSMENT.md` — full audit of prototype vs brief
- `docs/PRD_v1.1a.md` — v1.1a requirements (complete)
- `docs/PRD_v1.2.md` — v1.2 requirements (batch screener + carried-over items)
- `docs/ROADMAP.md` — full release roadmap v1.1a → v3.0
- `project_brief.pdf` — original user questionnaire and brief
