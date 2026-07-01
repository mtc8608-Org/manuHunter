---
name: framework-upstream-candidates
description: Running list of manuHunter changes that are framework-generic and should be pushed back to manuSpine (not domain-specific CV/jobs code)
metadata:
  node_type: memory
  type: project
---

# Framework upstream candidates

Changes made in manuHunter that are generic (framework, not domain) and should be
moved back into **manuSpine** so all derived apps get them. Pull/merge workflow is
in [[framework-upstream]]; reuse rules in [[code-reuse-rule]]. Domain code (the CV
builder, jobs) stays in manuHunter — only the reusable primitives below go up.

Convention: framework fixes are made *in manuSpine* and flow up via merge. These
were made here first (during CV builder work); port them to manuSpine when convenient.

## Pending candidates (from CV builder work, 2026-07)

- **FormRenderer `lines` field type** — added a `lines` case to the shared
  `pwa/src/components/forms/FormRenderer.tsx` (switch at ~L90, `renderLines` at ~L216):
  edits a `string[]` as a multi-line textarea (join on `\n` for display, split on
  `\n` for value). Purely additive, no risk to existing types. Generic form-library
  capability — clear upstream. Was needed for CV entry bullets.

- **PdfViewer shell component** — `pwa/src/components/shell/PdfViewer.tsx`: renders a PDF
  from a `Blob` (owns the object-URL lifecycle) or a `src` URL, falls back to `EmptyState`.
  Now a proper shell component (the CV page uses it) and listed in [[code-reuse-rule]]. Lift
  into manuSpine's shell library as-is — no CV/domain coupling.

- **BuildKit apt cache mount** — `python/Dockerfile` now uses
  `RUN --mount=type=cache,target=/var/cache/apt … --mount=…/var/lib/apt/lists …` plus
  `rm -f /etc/apt/apt.conf.d/docker-clean` and `# syntax=docker/dockerfile:1`, so apt
  `.deb` downloads persist across builds (host-global BuildKit cache, shared by mount
  target across projects). Generic build-infra win — belongs in manuSpine's python image.
  Reuse in other projects by copying the same mount lines (Option A; use `id=apt` to
  make cross-project sharing explicit).

- **(Maybe) LaTeX compile service** — the `python/api/domains/latex/` compile endpoint
  (pdflatex, shell-escape disabled, temp dir, timeout) + the Node bridge pattern is
  largely generic ("compile a .tex string to PDF"). Borderline: it exists to serve the
  CV builder, but the compile primitive itself could live in manuSpine if another app
  needs LaTeX→PDF. Leave in manuHunter for now; revisit if a second consumer appears.

**Why:** manuSpine is the shared framework; generic improvements made in a derived app
should flow back so every app benefits and the fork doesn't drift.

**How to apply:** when porting, recreate the change in manuSpine (don't cherry-pick —
see [[framework-upstream]]), then merge upstream into manuHunter. Tick items off here as
they land in manuSpine.
