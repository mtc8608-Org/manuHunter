---
name: cv-builder-plan
description: CV builder state — the manual builder + templates shipped (phases 1-4); key divergences from the original plan; the two remaining phases (5 AI-assisted, 6 attach-to-application)
metadata:
  node_type: memory
  type: project
---

# LaTeX CV builder: state and remaining work

manuHunter builds LaTeX CVs from a reusable stock of typed nodes, compiled to PDF on demand and saved. The manual builder is shipped; two phases remain.

## Shipped (branch `cv-builder`, 2026-07)

Phases 1-4 of the original plan plus a templates UI are built. The code is now the source of truth, so the detailed phase-1..4 plan files were deleted. What exists:

- **Data:** `cv_components` (+ `_relationships`) hold the typed node tree — `cvTemplate`, `cvDocument`, `cvSection`, `cvTextRow`, `cvEntry`, `cvPublication` — owner-scoped via `owner_id` (NULL = shared, e.g. the default template). `cv_artifacts` records generated PDFs (bytes in MinIO + `files`). `cv_profile` holds per-user identity. Schema/forms/default template in `init-scripts/03-init-cv.sql`; personal sample data in the gitignored `init-scripts/seed-cv-samples.sql`.
- **Backend:** owner-scoped GraphQL CRUD (`nodejs/schema/resolvers/cv/documents.js`, helper `cv.js`), the LaTeX assembler (`cvAssemble.js`), and the compile/save/download/delete REST routes (`nodejs/routes/cv/compile.js`) calling the Python TeX Live service (`python/api/domains/latex/`).
- **Frontend — two separate nav areas:** *CV Builder* (`pages/cv/`: `Cv.tsx` build+preview, `GeneratedCvs.tsx`, `CvTemplates.tsx`) and *Applications* (`pages/jobs/Applications.tsx`). Area lists are `AREA_NAV.CV_BUILDER` / `AREA_NAV.APPLICATIONS`.

## Divergences from the original plan (so this isn't confusing later)

- **Identity is per-user, not per-CV.** It lives in its own `cv_profile` table (one row per user, JSONB `data`), edited on the **Account** page, and merged into every CV by the assembler. Only the per-CV `tagline` (plus `title`, `template_id`) lives on `cvDocument`. The original plan put identity on `cvDocument.data`; that changed. See the decision context in this file's history.
- **No "Identity"/"Details" tab.** The `cvDocument` is edited from the `TreeEditor` root — an Edit button on the root header (new `rootEditable` prop). The template is chosen from that root edit modal.
- **Templates have their own editor UI** (`CvTemplates.tsx`): list (own + shared default), clone-default to create, owner-scoped edit, delete own; the shared default is read-only to non-admins and never deletable. Template LaTeX fields use a collapsible, syntax-highlighted `code` field (see [[framework-upstream-candidates]]).
- **Library display-label convention:** seed node `name` follows `cv_<type>_<topic>_<variant>`; the list label is *derived* — strip the LaTeX, append the clinical/quant variant tag for sections, drop org/dates to a sub-label for entries. Keeps the picker readable without polluting the LaTeX content fields.

## Remaining phases

- [[cv-builder-phase-5-claude-assisted]] — paste a job description, tailor a CV from the library + identity, preview (compile) and save as a new `cvDocument`.
- [[cv-builder-phase-6-applications]] — attach a compiled CV PDF to a job application; launch build/compile from the Applications page.

## Cross-cutting (still true)

- LaTeX compile is code execution: shell-escape disabled, temp dir, timeout, owner/admin only.
- Raw LaTeX passthrough in node fields (admin-authored, not escaped), like content cards store raw HTML.
- A generated PDF is a `files` row + MinIO object + `cv_artifacts` row, created and destroyed together; deletes warn and cascade `application_files`.
- Confirmed data-model decisions: separate `cv_*` tables (survey precedent), TeX Live in the Python image, a small generic node vocabulary (not opaque section blobs).
