---
name: cv-builder-phase-1-database
description: CV builder phase 1, the cv_* tables, node type conventions, and seed data (shared template, section library from the two sample CVs, edit forms)
metadata:
  node_type: memory
  type: project
---

# Phase 1: database and seed

Parent plan: [[cv-builder-plan]]. Prereqs: none.

Goal: create the `cv_*` tables mirroring the component tree, and seed them so that phases 2 and 3 can assemble and compile a real CV immediately.

## New file

`init-scripts/03-init-cv.sql` (02 is taken by jobs; postgres runs files alphabetically on a fresh volume, so 03 runs after the framework and jobs).

## Tables (mirror components, keep separate like surveys)

Three tables: the tree pair plus a light artifact record. The CV document itself is a node in `cv_components` (type `cvDocument`), not a separate registry row.

- `cv_components`: `id UUID PK default uuid_generate_v4()`, `name VARCHAR(255) UNIQUE NOT NULL`, `type VARCHAR(50)`, `data JSONB`, `options JSONB`, plus `owner_id UUID REFERENCES users(id) ON DELETE CASCADE`. The `owner_id` is the one deliberate divergence from `components` (`init-scripts/01-init-db.sql:20-26`): content is global, but CV nodes are per user. `owner_id` NULL means a shared/global node (the default template); non NULL means owned by that user.
- `cv_components_relationships`: `parent_id UUID`, `child_id UUID`, `position INT NOT NULL DEFAULT 0`, FKs to `cv_components(id)`, PK `(parent_id, child_id)`. Same as `components_relationships` (`01-init-db.sql:28-35`).
- `cv_artifacts`: the user facing record of a generated CV PDF, the manuBeat model run analogy. Columns: `id UUID PK`, `cv_component_id UUID REFERENCES cv_components(id) ON DELETE SET NULL` (the cvDocument it was compiled from), `file_id UUID REFERENCES files(id) ON DELETE CASCADE` (the PDF in the generic files store), `owner_id UUID REFERENCES users(id) ON DELETE CASCADE`, `label TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`. This is how a user sees the CVs they have without ever touching the admin only `files` list.

No separate `cvs` registry table. The root `cvDocument` node is the CV: it holds the header and identity and is the attach point for sections, so listing a user's CVs is `cv_components WHERE type='cvDocument' AND owner_id = <user>`.

Ownership and access (confirmed):
- A user's `cv_components` (their documents and their section library) are visible only to that user and the main admin. Queries filter `owner_id = req.user.id OR owner_id IS NULL`; admin sees all; mutations set `owner_id = req.user.id`.
- The `files` table and its listing are admin only backoffice; `files` represents every file in the store regardless of use, for the admin's custom handling. Users never browse it. Users reach their own PDFs through `cv_artifacts` (and through applications), with per file download scoped to the owner. Do NOT put CV specific columns on `files`; the source link lives on `cv_artifacts.cv_component_id`.

## Node type conventions (data shapes)

Store raw LaTeX in text fields (no escaping, admin authored).

- `cvTemplate.data`: `{ preamble, header, docOpen, docClose }`. `preamble` is everything up to `\begin{document}` (documentclass, packages, tcolorbox, titleformat, the `\resumeSubheading` `\resumeProject` and list macros, copied verbatim from the sample CV preamble at `CV_CoMind.tex:7-80`). `header` is the tabularx identity block using macros `\name \phone \emaila` plus a `\tagline`. `docOpen` is `\begin{document}\fontfamily{cmr}\selectfont`. `docClose` is `\end{document}`.
- `cvDocument.data`: `{ name, phone, email, linkedin_url, linkedin_label, github_url, github_label, location, tagline, template_id }`. Ordered sections are children via `cv_components_relationships.position`.
- `cvSection.data`: `{ title, body?, layout? }`. `body` present and no children means a text section (Profile). `layout` optional override of textrows | entries | publications, otherwise inferred from child type.
- `cvTextRow.data`: `{ label?, text }`.
- `cvEntry.data`: `{ title, org, location, dates, bullets: string[], kind }`, kind in experience | education | project.
- `cvPublication.data`: `{ authors, title, venue, year, raw? }`.

## Seeds to create

Use a dedicated UUID prefix for CV seeds so they are stable and referenceable from `constants.ts` (follow the convention note in CLAUDE.md). Suggest prefix `c51c1e5f-5cc1-4b77-8832-2d10cccvXXXX` style, or a fresh clearly labelled block.

1. One `cvTemplate` named `cv_template_default`, preamble and header copied from the shared preamble both sample CVs use (they are identical at `CV_CoMind/CV_CoMind.tex:7-101` and `CV_Quant/CVquant.tex:5-97`).
2. A section library (unpaged nodes, mounted later) decomposed from both CVs:
   - Profile variants: `cv_section_profile_clinical` (CoMind profile, `CV_CoMind.tex:104-107`) and `cv_section_profile_quant` (Quant profile, `CVquant.tex:100-103`).
   - Skills sections with `cvTextRow` children: clinical core skills (`CV_CoMind.tex:111-120`) and quant skills (`CVquant.tex:129-137`), one cvTextRow per labelled line.
   - Experience entries as `cvEntry` nodes (UCL PhD, Imperial RA, Cambridge Digital Health, Cambridge RA), shareable across both CVs (`CV_CoMind.tex:127-165`).
   - Education entries as `cvEntry` nodes kind=education (`CV_CoMind.tex:194-213`).
   - Projects as `cvEntry` nodes kind=project for the Quant CV (`CVquant.tex:144-174`).
   - Publications as `cvPublication` nodes (`CV_CoMind.tex:178-187`), identical across CVs, prime reuse atoms.
3. Two seed `cvDocument` roots that reproduce the two existing CVs by mounting the library sections in the right order with the right identity values and taglines. These double as end to end fixtures: phase 3 acceptance is that compiling them yields PDFs matching the originals closely.
4. Edit forms: one form per cv node type, mirroring the content editor forms at `01-init-db.sql:271-307`, so `TreeEditor` renders an edit modal per type via `FormRenderer` in phase 4. Seed them as component form trees compatible with `FormRenderer` `mode='app'` (dot-path keys matching the `data` shapes above, for example `data.title`, `data.label`, `data.bullets`), the same mode the content editor forms use. Also seed an identity/config form for `cvDocument.data`. Give all forms stable UUIDs for `constants.ts`. These forms are framework config, so they live in `components` (global), not `cv_components`.

Ownership of seeds: the default `cvTemplate` is global (`owner_id` NULL) so every user can use it. The seeded sample section library and the two seed cvDocuments are owned by the admin user (the seeded admin from `01-init-db.sql`).

Before implementing, check `/home/cabsman/Documents/cabeleira.net/` for an existing seeding pattern to copy (see [[copy-from-original-project]]), especially the MinIO plus files table content-image seeding it already documents.

## Acceptance criteria

- On a fresh volume, 03-init-cv.sql runs clean and 02-init-jobs.sql still applies first (jobs before cv, alphabetical).
- The two seed cvDocuments exist with correctly ordered section children.
- The section library nodes exist unpaged and are linkable.

## Notes and open points

- Ownership is per user and confirmed: `owner_id` column on `cv_components`, global nodes via NULL. CV editing is user facing, not admin only (see [[cv-builder-phase-4-frontend-manual]]).
- A DB reset wipes data, so treat seeds as the source of truth during development. Do not run the reset yourself; state the command for the user (see [[never-run]]).
