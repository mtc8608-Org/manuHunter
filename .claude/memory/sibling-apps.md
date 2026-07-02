---
name: sibling-apps
description: Pointers to the sibling ManuSpine apps (manuBeat, manuSpine) and where their memory lives, for cross-app reference and reuse
metadata:
  node_type: memory
  type: reference
---

# Sibling apps and their memory

manuHunter shares the ManuSpine framework with several sibling apps (see [[manulab-context]]). Their detailed memory lives in their own repos, not here. Consult it before designing anything that overlaps their domain, and mirror any framework-level pattern they have already solved rather than reinventing it.

## manuSpine (the framework, upstream parent)
- Repo: `/home/cabsman/Documents/projects/manuSpine`, `git@github.com:mtc8608/manuSpine.git`.
- Memory: `manuSpine/.claude/memory/` and `/home/cabsman/.claude/projects/-home-cabsman-Documents-projects-manuSpine/memory/`.
- Holds: the ManuLab context and the "copy from original project" rule, captured here as [[manulab-context]] and CLAUDE.md "Reference project".

## manuBeat (cardio / bedside telemetry app)
- Repo: `/home/cabsman/Documents/projects/manuBeat`. Also forked from manuSpine via the same `upstream` merge workflow (see CLAUDE.md "Framework upstream").
- Memory: `manuBeat/.claude/memory/`. Rich, and mostly domain-specific to manuBeat (not needed for job-search work), but useful as a worked example of extending the framework. Key files there:
  - `project_cardio_port` : porting `CardioRespiratoryModelV2` (branch `V2.3`) into manuBeat as the cardio domain (Python compute).
  - `project_bedside_domain` : the `bedside` admin domain, where a patient IS a survey answer (survey `f000`), augmented via `bedside_nodes`/`beds`/`bed_assignments`/`patient_files`. Good example of adding a domain on top of the survey + component-tree framework and reusing shell components (SplitPageLayout, ResourcePanel, ModalShell, FormRenderer, DataTable, EmptyState).
  - `project_bedside_server` / `project_bedside_pi` / `project_bedside_hardware` : edge-telemetry system (Raspberry Pi agents streaming device data to the manuBeat server). The Pi agent lives in a separate repo, **manuEdge** (`git@github.com:mtc8608/manuEdge.git`, `/home/cabsman/Documents/projects/manuEdge`, native systemd Python agent). Hardware BOMs and Pi flashing details are here too. Not relevant to manuHunter, but this is the source of truth if the topic ever comes up.

## Reusable takeaways for manuHunter
- New domains follow the same recipe as manuBeat's `bedside`: `init-scripts/02-init-<domain>.sql`, `routes/<domain>/`, `resolvers/<domain>/`, frontend pages, reusing the shell components. manuHunter already did this for the jobs domain.
- GraphQL **queries are not admin-gated** by the permissions layer (only mutations are); manuBeat's bedside resolvers call `requireAdmin(ctx)` explicitly in every query that needs it. Apply the same care in manuHunter admin-only resolvers.
- New generic shell components built for a domain (e.g. manuBeat's `DetailList`) are candidates to push upstream to manuSpine so all apps get them.
