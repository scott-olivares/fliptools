# AGENTS.md

**Lean context for FlipTools comp analysis. See CONTEXT.md for full details.**

## Stack & Structure

- **Stack:** Node 24, pnpm, Express 5, React 19, Vite 7, Drizzle ORM, PostgreSQL (Neon)
- **Monorepo:** `lib/db/` (schema), `lib/api-spec/` (OpenAPI), `artifacts/api-server/` (backend), `artifacts/deal-analyzer/` (frontend)

## Rules

- **Package manager:** pnpm only (npm/yarn blocked)
- **Zod imports:** `import { z } from "zod/v4"` (NOT `"zod"`)
- **DB changes:** `cd lib/db && source .env && pnpm push` (push mode, no migrations)
- **API changes:** `cd lib/api-spec && pnpm codegen` (regenerates hooks + validators)
- **api-zod index:** Must ONLY contain `export * from "./generated/api"` (check after codegen)
- **No watch mode:** API server requires kill/rebuild/restart

## Commands

```bash
# Start dev
cd artifacts/api-server && source .env && pnpm dev      # API on :3000
cd artifacts/deal-analyzer && source .env && pnpm dev   # Frontend on :5173

# Deploy
cd artifacts/api-server && pnpm build && pnpm start    # Builds both frontend + backend
```

## Express 5 Routing (CRITICAL)

✅ **Correct:** `app.use(express.static(dir)); app.use((_req, res) => res.sendFile(path.join(dir, "index.html")));`  
❌ **WRONG:** `app.get("*")` or `app.get("/:path*")` (crashes with PathError)

## Key Docs

- **CONTEXT.md** — Full setup, progress tracking, command reference
- **docs/PRD_v1.2.md** — Batch screener requirements (current phase)
- **docs/ROADMAP.md** — Full release plan v1.1 → v3.0
