---
name: commit-and-git-style
description: Commit message style (short subject, no signature, no bullets) and push timing (commit per unit, push only at session end or when asked)
metadata:
  node_type: memory
  type: feedback
---

# Commit and git workflow style

Inherited from the original project (see [[copy-from-original-project]]). Applies to all repos in this family, including manuHunter.

## Commit messages
Keep them short and high-level. Subject line max 50 characters. One or two lines max, enough to understand what changed without opening the diff, not a full breakdown. **No bullet lists. No `Co-Authored-By` signature. No "net result" summaries.**

**Why:** this is a git log, not a PR description. Balance informative and concise.

**How to apply:** before every commit, re-read this. One clear subject line (<=50 chars), optional second line only if context is genuinely needed.

> Note: this overrides the harness default of appending a `Co-Authored-By: Claude` trailer. Do not add it in this repo.

## Push timing
Commit changes as each logical unit of work is completed during a session. Only `git push` at the end of the session or when the user explicitly asks ("push").

**Why:** keeps the remote clean (no half-done work pushed mid-session) while preserving local commit history as work progresses.

Also: only commit or push when the user asks (per the harness rule) and, on the default branch, branch first. See [[never-run]] for runtime commands and [[memory-location-rule]] for where knowledge is stored.
