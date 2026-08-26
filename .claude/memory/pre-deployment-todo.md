---
name: pre-deployment-todo
description: Pre-deployment audit findings — the 2026-07-07 set is closed by the 2026-08-26 upstream merge; a fresh post-merge audit's findings are fixed too, with the open remainder at the bottom
metadata:
  type: project
---

# Pre-deployment TODO

**Status 2026-08-26:** every 2026-07-07 item below is **closed** — the framework
fixes landed upstream and arrived here in the `pull-upstream` merge of the
2026-08-26 security batch. A fresh `exposure-auditor` + `dead-code-auditor` gate
was run immediately after that merge; its findings were fixed in the same session
and are recorded in **Post-merge audit** at the bottom. Nothing here is
outstanding except the two items explicitly marked OPEN.

Audit run 2026-07-07 (exposure-auditor + deployment-config sweep) before manuHunter goes internet-facing served multi-user. See [[served-multi-user-plan]]. Deploy story itself is solid (`docker-compose.prod.yml`, `deploy/ship-app.sh`, Caddy template, env-only secrets) — nothing to invent there.

## BLOCKERS — must fix before deploy

- [x] **(FIXED, merge f510e24)** **File download routes: no auth, no owner scope, XSS vector.** `nodejs/routes/framework/files.js:55`
  - `GET /api/files/:id/download` — tokenless, no owner check: any file UUID streams any user's CVs/cover letters/attachments. This is the "download scoping" item [[cv-builder-phase-6-applications]] flags as unfinished.
  - Serves uploader's declared mime type `inline` with no upload mimetype allowlist (`nodejs/db.js:25-28`) → registered user uploads `evil.html`/scripted SVG, sends link, JS executes on app origin where JWT lives in `localStorage` → account takeover.
  - `GET /api/files/:key/download-by-key` (`files.js:110`) — same unscoped access; private uploads + generated CV PDFs share key namespace with seed images.
  - Fix as one unit: migrate content-image `data.src` → `/download-by-key`; restrict `/download-by-key` to content assets only (`seed-` prefix or `public` flag); require `req.user` + owner/admin on `/download`; allowlist inline mime types (images/PDF, else `attachment`); add `X-Content-Type-Options: nosniff`.

- [x] **(FIXED, merge 79646d4 — register throttled; compile endpoint itself still unthrottled, see OPEN below)** **`/register` wide open + unthrottled compute.** `nodejs/routes/framework/auth.js:49`
  - No rate limiter (login has one, register doesn't), no server-side password policy (any non-empty passes, `SignIn.tsx:29` only checks confirm-match).
  - Every new account reaches the unthrottled pdflatex compile endpoint (`nodejs/routes/cv/compile.js:56`) — up to 2×60s CPU/request, no concurrency cap. Unlimited signups + unlimited compiles = CPU DoS.
  - Fix: IP-keyed limiter on `/register` and on `/cv/:id/compile` + `/cv/:id/save-pdf`; server-side password length floor.

## SHOULD-FIX

- [x] **(FIXED, 022afda)** **CORS wide open.** `nodejs/backend.js:15` — `cors()` reflects all origins; prod is same-origin behind Caddy. Remove or origin-restrict.
- [x] **(FIXED, 221c25f — Caddy block does NOT reach an already-provisioned box; hand-copy it)** **No security headers.** No helmet; `deploy/caddy/Caddyfile.template` has no `header` block — missing HSTS, `X-Content-Type-Options`, `frame-ancestors`/CSP. Cheapest fix: one `header` block in the Caddy template.
- [x] **(FIXED, 022afda upstream + this session for the fork's compile.js)** **REST 500s leak `e.message`.** `files.js:21,51,66,84,105` return raw pg/MinIO messages (schema/constraint names). GraphQL already uses generic messages; make REST match per `.claude/rules/backend-api.md`.
- [x] **(FIXED, 022afda)** **Deactivation doesn't revoke access.** JWTs live 7d (`auth.js:40`); GraphQL gate (`schema/index.js:99-108`) trusts token tier claim with no `is_active` DB check. Deactivated user works until token expiry.
- [x] **(FIXED, 60f12b9)** **multer 1.x is EOL** with unpatched DoS CVEs (`nodejs/package.json`). Upgrade to 2.x (API-compatible for this usage).
- [x] **(FIXED, 221c25f)** **Prod publishes only the proxy.** Dev compose exposes python:5000 (unauth LaTeX) + MinIO 9000/9001 on 0.0.0.0; `docker-compose.prod.yml` already handles this — verify nothing dev-shaped reaches the box.
- [x] **(FIXED, this session)** **`deleteApplication` returns `true` on zero rows.** `nodejs/schema/resolvers/jobs/applications.js:140` — spec says throw "not found or not authorised". No leak, silent-success mismatch.

## NICE-TO-HAVE

- [x] **(FIXED, 221c25f)** Dev compose binds 0.0.0.0 with example secrets (`.env` currently `JWT_SECRET=replace-this...`, `ADMIN_PASSWORD=123`) — bind to 127.0.0.1. Dev-only, not a prod path.
- [x] **(FIXED, 221c25f)** `ship-app.sh` preflight checks secret *presence* not *strength* (`JWT_SECRET=x` passes); only `SECRETS_MASTER_KEY` is format-validated. Add a min-length check.
- [x] **(FIXED, 022afda)** `express.json()` default 100 kB cap (`backend.js:14`) applies to `/graphql` — large CMS saves via `updateComponent` may 413. Set a deliberate limit.
- [ ] Confirm `init-scripts/seed-cv-samples.sql` (real personal CV data, gitignored) is intentionally rsync'd to the multi-user box by `ship-app.sh` STEP 3.
- [x] **(FIXED, 221c25f)** Consider default-deny ufw for non-docker ports in `deploy/provision.sh` (Docker bypasses ufw, so minor).

## Verified clean (no action)

Secrets never in git history; `.env` gitignored; admin seeded from env not SQL; GraphQL introspection admin-only; anonymous GraphQL fully rejected; no service worker (no authed-response caching); no hardcoded localhost in `pwa/src` (origin-relative `API_BASE`/`GQL_URL`); LaTeX service hardened (`-no-shell-escape`, temp dir, 60s timeout); no presigned URLs / public bucket / published minio console in prod. Permission-gate mechanism intact; 57 GraphQL ops all in correct tier; owner-scoping verified across all registered-tier ops; keychain write-only invariant holds.


## Post-merge audit (2026-08-26, after the upstream merge)

`exposure-auditor` + `dead-code-auditor` re-run as the `pull-upstream` gate. The
gate confirmed the merged framework gate is sound (all 57 GraphQL ops correctly
tiered, zero dead entries, the no-public-tier adaptation strictly stronger than
upstream) and that the `pwa/src` verbatim surface now holds exactly. Findings:

- [x] **BLOCKER — raw-LaTeX file read reachable from the `registered` tier.** CV
  nodes are user-authored but rendered as raw LaTeX and compiled by `pdflatex`;
  `-no-shell-escape` blocks `\write18` but not `\input`, and stock TeX Live ships
  `openin_any = a`. Dev compose also handed the python service `.env`, so the
  read reached `JWT_SECRET`/`SECRETS_MASTER_KEY` → registered-to-admin.
  **Fixed three ways:** `openin_any=p`/`openout_any=p` in the pdflatex subprocess
  (`python/api/domains/latex/routes.py`), compiler log tails no longer returned to
  non-admins (`routes/cv/compile.js`), and upstream dropped `env_file: .env` from
  the dev python service. The framework rule gained both requirements so no fork
  reintroduces it.
- [x] **Cross-user template dereference.** `data.template_id` was followed by
  `cvAssemble` with no owner check — a link mutation in disguise. Now
  `assertReadable`-guarded in `createCvDocument`/`updateCvDocument`.
- [x] **Existence oracle in the CV routes.** `loadOwnedDocument`/`loadOwnedArtifact`
  split 404 from 403; collapsed to one message, matching `helpers/ownership.js`.
- [x] **Any owner could publish their own upload** via `PATCH /files/:id`
  `is_public`, exposing it through the tokenless streams. Now admin-only —
  fixed upstream, inherited here.
- [x] **Artifact download missed the download hardening.** The fork's route
  hand-rolled a MinIO pipe, so the batch's `nosniff` + inline-mime allowlist never
  applied to it. Upstream extracted `lib/filestream.js`; the route now uses
  `streamFile`.
- [x] **Merge artifacts and leftover duplication** — duplicate `UserProfileType`/
  `UserSecretType` exports in `schema/types.js`; the surveys route left on
  upstream's `TierRoute minTier="user"` while this fork puts surveys in
  `registered`; seven inline owner-scope checks superseded by `helpers/ownership.js`.

**OPEN:**

- [ ] **The compile endpoint is still unthrottled.** `POST /api/cv/:id/compile`
  runs two 60 s pdflatex passes per call with no rate limit — a CPU DoS reachable
  by any registered account. `openin_any=p` closes the file-read half, not this.
  Needs a limiter like `auth.js`'s, or a per-user concurrency cap.
- [ ] **Re-run the Caddy header block onto the provisioned box.** `221c25f` added
  it to the template; an already-provisioned host does not get it from a merge.
