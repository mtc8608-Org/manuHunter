---
name: framework-upstream-candidates
description: Framework sync ledger — generic changes flowing between manuSpine and its forks; the Landed section doubles as the fork-side merge map for pull-upstream
metadata:
  node_type: memory
  type: project
---

# Framework sync ledger (upstream candidates + fork merge map)

Framework-generic changes built in a fork are flagged under **Pending**, recreated
here in manuSpine (never cherry-picked), and moved to **Landed**. Forks then run
`git fetch upstream && git merge upstream/master`. Three skills drive the cycle:

- `flag-upstream` — in a fork, right after building something generic: adds a Pending entry.
- `port-upstream` — here in manuSpine: lands Pending items, moves them to Landed.
- `pull-upstream` — in a fork: merges upstream and uses **Landed** below as its
  conflict map. Keep the per-item deviations and merge notes accurate — they are
  read by the next fork session before it merges.

## Fork status (as of 2026-07-04)

Neither fork has merged the 2026-07-02 framework batch yet. Both also receive
the 2026-07-04 hardening items below in their next merge — the GraphQL gate fix
is security-critical: every fork's copy of `schema/index.js` carries the
first-selection-only bypass until it merges.

- **manuHunter** (`cv-builder` branch) — the port source; its merge is mostly
  echo-back of its own work. The real conflicts are exactly the recorded
  deviations below: public permissions tier, CodeEditor `language` prop, generic
  `form_user_profile` seed, Dockerfile apt package list. It also receives the
  post-port items (surveys→registered tier, sync skills, dev-loop agents).
- **manuBeat** (`master`) — last merged upstream **pre-port** (at 67c3a10), so its
  next pull brings the entire batch at once. Heaviest follow-up is auth: the
  tier-based lockdown defaults every GraphQL op to admin-only and adds REST
  guards, so manuBeat's domain surface (bedside telemetry ingest, device-token
  routes, WebSocket monitor, medical content) must be explicitly placed in tiers
  during the merge or it breaks silently. Review device-token auth paths against
  the new REST guards; `SECRETS_MASTER_KEY` must be added to its env. The
  2026-07-04 survey reframe hits it hardest: its `bedside` domain models a
  patient as a survey answer on `f000` — see that item's merge note below.


## Pending

- **(Maybe) LaTeX compile service** — the `python/api/domains/latex/` compile
  endpoint (pdflatex, shell-escape disabled, temp dir, timeout) + the Node bridge
  pattern is largely generic ("compile a .tex string to PDF"). Borderline: it
  exists to serve the CV builder, but the compile primitive could live in
  manuSpine if another app needs LaTeX→PDF. Stays in manuHunter; revisit if a
  second consumer appears.

**Why:** manuSpine is the shared framework; generic improvements made in a derived
app must flow back so every app benefits and forks don't drift — and forks need an
accurate map of what a merge will bring and where it will conflict.

**How to apply:** in manuSpine, run `port-upstream` on Pending items (recreate from
the fork source, commit, move to Landed with deviations recorded). In a fork, run
`pull-upstream`: read the Landed merge notes above first, then
`git fetch upstream && git merge upstream/master` — never cherry-pick. On conflict,
fork keeps app-tuned content (permission tiers, seeds, package lists, registry
entries), takes upstream mechanism/framework files. Update the **Fork status**
section here (in manuSpine) once a fork has merged.
