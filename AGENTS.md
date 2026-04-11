# AGENTS.md

Agent context file for FlipTools comp analysis tool. **See CONTEXT.md for detailed setup, deployment status, and extended technical notes.**

---

## Stack

- **Node 24**, **pnpm** (enforced — `npm`/`yarn` blocked by preinstall guard)
- Backend: Express 5, esbuild, Drizzle ORM + PostgreSQL (Neon)
- Frontend: React 19, Vite 7, Tailwind 4, TanStack Query
- Codegen: Orval (OpenAPI → React Query hooks + Zod schemas)

---

## Monorepo structure

```
lib/db/                  Drizzle schema (exports .ts source, not compiled JS)
lib/api-spec/            openapi.yaml + Orval config (dev-time only)
lib/api-client-react/    Orval-generated React Query hooks
lib/api-zod/             Orval-generated Zod validators
artifacts/api-server/    Express backend
artifacts/deal-analyzer/ React frontend
artifacts/mockup-sandbox/ UI prototype (ignore)
```

---

## Critical rules

**Package manager:** NEVER use npm/yarn — pnpm only (enforced by preinstall guard)

**Zod imports:** Always `import { z } from "zod/v4"` — NOT `"zod"` (required for drizzle-zod compatibility)

**Catalog versions:** Use `"catalog:"` in package.json — versions resolved from `pnpm-workspace.yaml`

**DB schema changes:** `cd lib/db && source .env && pnpm push` (push mode only, no migration files)

**API contract changes:** `cd lib/api-spec && pnpm codegen` (regenerates api-client-react + api-zod)

**api-zod index:** `lib/api-zod/src/index.ts` must ONLY contain `export * from "./generated/api"` — codegen may add duplicate exports that break builds; always verify after codegen

**lib/db exports:** Raw TypeScript source (no compiled output) — works because esbuild + Vite consume TS directly

**No watch mode:** API server has no hot reload — kill/rebuild/restart to see changes

---

## Deployment

**Production URL:** https://fliptools.up.railway.app/  
**Railway Project:** believable-renewal (production environment)  
**Status:** ✅ v1.1a deployed and live

---

## Quick dev commands

**Start API (port 3000):** `cd artifacts/api-server && source .env && pnpm dev`  
**Start frontend (port 5173):** `cd artifacts/deal-analyzer && source .env && pnpm dev`  
**Typecheck all:** `pnpm typecheck` (from workspace root)  
**Build for production:** `cd artifacts/api-server && pnpm build && pnpm start` (builds frontend + server)

---

## Express 5 catch-all route pattern (CRITICAL)

⚠️ **Never use `app.get()` or `app.route()` with catch-all patterns** — Express 5 + path-to-regexp v8 doesn't support `/:path*` or `/:path(.*)` syntax.

✅ **Correct pattern for client-side routing:**
```typescript
app.use(express.static(staticDir));
app.use((_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});
```

❌ **WRONG:**
- `app.get("*", handler)` — Invalid syntax
- `app.get("/:path*", handler)` — Crashes with PathError
- `app.get("/:path(.*)", handler)` — Regex not supported

---

## Important files

- **DEPLOYMENT.md** — Railway deployment guide, Express 5 routing rules, troubleshooting (read when deploying)
- **CONTEXT.md** — Detailed setup, deployment status, session notes, full command reference
- **docs/PRD_v1.1a.md** — v1.1a requirements (complete)
- **docs/PRD_v1.2.md** — v1.2 requirements (batch screener)
- **docs/ROADMAP.md** — Full release roadmap
- **docs/PRODUCT_ASSESSMENT.md** — Prototype audit vs original brief
