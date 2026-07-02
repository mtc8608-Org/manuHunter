---
name: served-multi-user-plan
description: manuHunter (and every ManuLab app) is single-user today but planned to be served as multi-user — never take single-user shortcuts in design
metadata:
  node_type: memory
  type: project
---

# Single-user now, served multi-user later

As of July 2026 manuHunter has one real user (Manuel), but the plan is to serve it as a multi-user app. This is true of **all ManuLab apps** (see [[manulab-context]]) — the same fact is recorded framework-wide in `manuSpine/.claude/memory/served-multi-user-plan.md`.

**Why:** "it's just me" is never a valid argument in design discussions. Choices that only work single-user (server env-var API keys, global unscoped state, skipping `owner_id` scoping, admin-only gates standing in for per-user permissions) become migrations later.

**How to apply:** when weighing options, pick the multi-user-safe shape even if a single-user shortcut is simpler today: owner-scope domain data, keep user settings/secrets per user (e.g. per-user Anthropic API key, not a shared env var), and keep self-service user-writable surfaces isolated from the auth-critical `users` table.
