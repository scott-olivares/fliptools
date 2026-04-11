# Railway Deployment Guide

**Read this file when setting up or troubleshooting Railway deployments.**

---

## Railway Configuration (Production)

### Service Settings

**Source:**
- Root Directory: `.` (workspace root, NOT `artifacts/api-server`)
- Branch: `main`
- Wait for CI: OFF

**Build:**
- Builder: Nixpacks
- Custom Build Command: LEAVE EMPTY
- Custom Start Command: LEAVE EMPTY
- Watch Paths: LEAVE EMPTY

**Environment Variables:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=<Neon connection string>
RENTCAST_API_KEY=<API key>
```

### nixpacks.toml (Required)

Must be at workspace root:

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "pnpm-9_x", "openssl"]

[phases.install]
cmds = ["pnpm install --no-frozen-lockfile"]

[phases.build]
cmds = ["cd artifacts/api-server && pnpm build"]

[start]
cmd = "cd artifacts/api-server && pnpm start"
```

**CRITICAL:** Must use `--no-frozen-lockfile` flag in install phase.

---

## Common Issues & Solutions

### Issue: Lockfile mismatch error

**Error:** `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

**Cause:** `pnpm-lock.yaml` doesn't match `pnpm-workspace.yaml` overrides

**Fix:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git commit -m "Regenerate lockfile"
git push
```

### Issue: Railway using npm instead of pnpm

**Cause:** Root Directory set to `artifacts/api-server` (can't detect workspace)

**Fix:** Set Root Directory to `.` in Railway settings

### Issue: Deployment not auto-triggering

**Cause:** Watch Paths filtering out changes

**Fix:** Clear Watch Paths in Railway settings (leave empty)

---

## Express 5 Routing Rules

### Catch-All Routes (Client-Side Routing)

⚠️ **NEVER use `app.get()` or `app.route()` with catch-all patterns**

**❌ WRONG:**
```typescript
app.get("*", handler)           // Invalid syntax
app.get("/:path*", handler)     // PathError crash
app.get("/:path(.*)", handler)  // Regex not supported
app.route("/:path*", handler)   // Doesn't work
```

**✅ CORRECT:**
```typescript
// For serving frontend with client-side routing:
app.use(express.static(staticDir));
app.use((_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});
```

**Why:** Express 5 uses path-to-regexp v8, which doesn't support regex syntax or modifiers like `*` in route parameters. Use `app.use()` middleware for catch-all handlers.

---

## Deployment Checklist

Before deploying:

- [ ] Root Directory is `.` (not `artifacts/api-server`)
- [ ] `nixpacks.toml` exists at workspace root
- [ ] `nixpacks.toml` uses `pnpm install --no-frozen-lockfile`
- [ ] Custom Build/Start Commands are EMPTY in Railway UI
- [ ] Watch Paths is EMPTY in Railway UI
- [ ] All environment variables are set
- [ ] No catch-all routes using `app.get()` or `app.route()`
- [ ] Lockfile regenerated after any package.json changes

---

## Project Structure Reference

```
/ (workspace root)          ← Root Directory points here
├── nixpacks.toml          ← Railway reads this
├── pnpm-workspace.yaml    ← Must be accessible to Railway
├── pnpm-lock.yaml         ← Must match workspace config
└── artifacts/
    └── api-server/
        ├── package.json
        └── src/
            └── app.ts     ← Catch-all routes defined here
```

---

## When Things Go Wrong

1. **Check build logs** for the actual error
2. **Verify Root Directory** is `.` in Railway settings
3. **Confirm nixpacks.toml** has `--no-frozen-lockfile`
4. **Check commit hash** in Railway deployment details matches GitHub
5. **Ask Railway agent** for specific deployment errors
