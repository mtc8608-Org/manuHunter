---
name: predeploy-audit
description: Fan out a full pre-deployment audit before manuHunter goes internet-facing — backend auth-surface gate plus a deployment-config sweep — and consolidate the findings into .claude/memory/pre-deployment-todo.md. Use before a deploy, after a pull-upstream merge, or when asked to re-check deployment readiness.
---

# Pre-deployment audit

Runs two independent audits in parallel over the whole repo, then merges them into one prioritized TODO. Scope split so the agents never overlap: one owns the **auth surface**, the other owns **everything else that must change before internet-facing**. The app targets served multi-user ([[served-multi-user-plan]]) — audit for that even while dev is single-user.

## Steps

1. **Read context first** — `.claude/memory/pre-deployment-todo.md` if it exists (prior run's findings; you're updating, not starting fresh), plus `served-multi-user-plan.md` and `cv-builder-phase-6-applications.md` (download-scoping is a known open item). Note which prior findings claim to be fixed so this run can confirm or reopen them.

2. **Launch both agents in one message** (parallel, background):

   - **Auth surface** — `exposure-auditor` subagent. Prompt it to gate the full backend auth surface for internet-facing served-multi-user: every GraphQL op in the correct `permissions.js` tier; owner-scoping on all registered/user-tier ops (cv + jobs domains especially — `user_profile`/`cv_profile`, applications, artifacts, files, `user_secrets` keychain); every REST handler opens with an auth guard; no tokenless endpoints beyond the intentional set (login/register/downloads); permission-gate mechanism intact; file download/upload owner-scoping. Ask for findings marked **BLOCKER / SHOULD-FIX / OK-noted** with `file:line`.

   - **Deployment config** — `general-purpose` subagent. Tell it explicitly **not** to audit GraphQL/REST auth (the other agent owns it) and to cover: secrets/credentials injection (JWT, DB, minio, admin seed — dev defaults that could silently ship); CORS/helmet/security headers/introspection/error-leakage in Express + the Caddy template; docker prod-readiness (`docker-compose.prod.yml` vs dev, published ports, `NODE_ENV`, `./run`, `deploy/`); upload/body-size/rate limits (esp. login, register, the pdflatex compile endpoint); dev leftovers (debug flags, seeded personal data, security TODOs); dependency health (EOL/CVE deps, audit story); MinIO exposure; HTTPS/localhost-hardcoding/service-worker caching. Have it cross-check manuSpine's `deploy/` story rather than invent one. Ask for **BLOCKER / SHOULD-FIX / NICE-TO-HAVE** with quoted `file:line` evidence.

3. **Consolidate** into `.claude/memory/pre-deployment-todo.md` — checkbox list grouped BLOCKER → SHOULD-FIX → NICE-TO-HAVE, each with `file:line` and a one-line fix. Merge overlapping findings (both agents may hit the file routes — state it once). Keep a "Verified clean (no action)" section so a later run doesn't re-litigate settled items. Mark any prior finding that's now fixed as done; reopen any that regressed. Convert relative dates to absolute; date the run. Update the `MEMORY.md` pointer line if the blocker set changed.

4. **Report** the consolidated list to the user, blockers first, with the file path. Do **not** fix anything — this skill is advisory; the user drives fixes.

## Notes

- This is a **static** audit (reads code). It does not exercise a running instance — no live XSS/IDOR/rate-limit reproduction. Dynamic pen-testing against a staging URL is a separate, post-deploy tool.
- Frame every finding for multi-user even though dev is single-user; a single-user shortcut is itself a finding.
- Re-run after every `pull-upstream` merge — a framework change can silently move an op out of its tier or reopen a scoping hole.
