---
name: pre-deployment-todo
description: Pre-deployment audit findings (2026-07-07) — blockers and hardening to fix before manuHunter goes internet-facing
metadata:
  type: project
---

# Pre-deployment TODO

Audit run 2026-07-07 (exposure-auditor + deployment-config sweep) before manuHunter goes internet-facing served multi-user. See [[served-multi-user-plan]]. Deploy story itself is solid (`docker-compose.prod.yml`, `deploy/ship-app.sh`, Caddy template, env-only secrets) — nothing to invent there.

## BLOCKERS — must fix before deploy

- [ ] **File download routes: no auth, no owner scope, XSS vector.** `nodejs/routes/framework/files.js:55`
  - `GET /api/files/:id/download` — tokenless, no owner check: any file UUID streams any user's CVs/cover letters/attachments. This is the "download scoping" item [[cv-builder-phase-6-applications]] flags as unfinished.
  - Serves uploader's declared mime type `inline` with no upload mimetype allowlist (`nodejs/db.js:25-28`) → registered user uploads `evil.html`/scripted SVG, sends link, JS executes on app origin where JWT lives in `localStorage` → account takeover.
  - `GET /api/files/:key/download-by-key` (`files.js:110`) — same unscoped access; private uploads + generated CV PDFs share key namespace with seed images.
  - Fix as one unit: migrate content-image `data.src` → `/download-by-key`; restrict `/download-by-key` to content assets only (`seed-` prefix or `public` flag); require `req.user` + owner/admin on `/download`; allowlist inline mime types (images/PDF, else `attachment`); add `X-Content-Type-Options: nosniff`.

- [ ] **`/register` wide open + unthrottled compute.** `nodejs/routes/framework/auth.js:49`
  - No rate limiter (login has one, register doesn't), no server-side password policy (any non-empty passes, `SignIn.tsx:29` only checks confirm-match).
  - Every new account reaches the unthrottled pdflatex compile endpoint (`nodejs/routes/cv/compile.js:56`) — up to 2×60s CPU/request, no concurrency cap. Unlimited signups + unlimited compiles = CPU DoS.
  - Fix: IP-keyed limiter on `/register` and on `/cv/:id/compile` + `/cv/:id/save-pdf`; server-side password length floor.

## SHOULD-FIX

- [ ] **CORS wide open.** `nodejs/backend.js:15` — `cors()` reflects all origins; prod is same-origin behind Caddy. Remove or origin-restrict.
- [ ] **No security headers.** No helmet; `deploy/caddy/Caddyfile.template` has no `header` block — missing HSTS, `X-Content-Type-Options`, `frame-ancestors`/CSP. Cheapest fix: one `header` block in the Caddy template.
- [ ] **REST 500s leak `e.message`.** `files.js:21,51,66,84,105` return raw pg/MinIO messages (schema/constraint names). GraphQL already uses generic messages; make REST match per `.claude/rules/backend-api.md`.
- [ ] **Deactivation doesn't revoke access.** JWTs live 7d (`auth.js:40`); GraphQL gate (`schema/index.js:99-108`) trusts token tier claim with no `is_active` DB check. Deactivated user works until token expiry.
- [ ] **multer 1.x is EOL** with unpatched DoS CVEs (`nodejs/package.json`). Upgrade to 2.x (API-compatible for this usage).
- [ ] **Prod publishes only the proxy.** Dev compose exposes python:5000 (unauth LaTeX) + MinIO 9000/9001 on 0.0.0.0; `docker-compose.prod.yml` already handles this — verify nothing dev-shaped reaches the box.
- [ ] **`deleteApplication` returns `true` on zero rows.** `nodejs/schema/resolvers/jobs/applications.js:140` — spec says throw "not found or not authorised". No leak, silent-success mismatch.

## NICE-TO-HAVE

- [ ] Dev compose binds 0.0.0.0 with example secrets (`.env` currently `JWT_SECRET=replace-this...`, `ADMIN_PASSWORD=123`) — bind to 127.0.0.1. Dev-only, not a prod path.
- [ ] `ship-app.sh` preflight checks secret *presence* not *strength* (`JWT_SECRET=x` passes); only `SECRETS_MASTER_KEY` is format-validated. Add a min-length check.
- [ ] `express.json()` default 100 kB cap (`backend.js:14`) applies to `/graphql` — large CMS saves via `updateComponent` may 413. Set a deliberate limit.
- [ ] Confirm `init-scripts/seed-cv-samples.sql` (real personal CV data, gitignored) is intentionally rsync'd to the multi-user box by `ship-app.sh` STEP 3.
- [ ] Consider default-deny ufw for non-docker ports in `deploy/provision.sh` (Docker bypasses ufw, so minor).

## Verified clean (no action)

Secrets never in git history; `.env` gitignored; admin seeded from env not SQL; GraphQL introspection admin-only; anonymous GraphQL fully rejected; no service worker (no authed-response caching); no hardcoded localhost in `pwa/src` (origin-relative `API_BASE`/`GQL_URL`); LaTeX service hardened (`-no-shell-escape`, temp dir, 60s timeout); no presigned URLs / public bucket / published minio console in prod. Permission-gate mechanism intact; 57 GraphQL ops all in correct tier; owner-scoping verified across all registered-tier ops; keychain write-only invariant holds.
