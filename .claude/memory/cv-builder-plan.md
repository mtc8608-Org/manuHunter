---
name: cv-builder-plan
description: Master plan and index for the manuHunter LaTeX CV builder feature (typed section library, live PDF compile, attach to applications)
metadata:
  node_type: memory
  type: project
---

# LaTeX CV Builder: master plan

Goal: let manuHunter build LaTeX CVs the same way it builds content pages, with both a fully manual route and a Claude assisted route. CVs are assembled from a reusable stock of typed sections, compiled to PDF live (on a button press), saved to the file store, and attached to job applications.

This is a PLAN only. Nothing here is built yet. Do not start implementing without an explicit go ahead for a given phase (see [[do-only-what-is-asked]]). Writing style follows [[no-em-dashes]].

## Confirmed design decisions

1. Data model: separate `cv_*` tables, mirroring the survey precedent (surveys got their own `survey_components` tables rather than reusing `components`). Keeps LaTeX CV nodes isolated from HTML content cards.
2. LaTeX engine: TeX Live curated package set inside the Python image. Reliable and offline. Compilation is owned by the Python service.
3. Node granularity: a small, generic, typed vocabulary (like the content types), NOT opaque section blobs. Generic sections can be text only or hold typed children.

## Node taxonomy (the reusable stock)

Mirrors `CONTENT_TYPE`. Each type has its own edit form and its own LaTeX renderer.

- `cvTemplate`: shared boilerplate. Holds the preamble (documentclass, packages, tcolorbox, titleformat, the `\resumeSubheading` / `\resumeProject` / list macros) and the header/identity block layout. One template serves many documents.
- `cvDocument`: the root assembly. Holds identity values (name, phone, email, linkedin, github, location, tagline) and a `template_id`, and has an ordered list of sections as children. A CV = one cvDocument.
- `cvSection`: generic section. `data.title`, optional `data.body` (LaTeX text). Profile is a section with body and no children. Otherwise it holds children of one leaf type.
- `cvTextRow`: paragraph:text leaf. `data.label` (optional, rendered bold) + `data.text`. Used by Core Skills style lists.
- `cvEntry`: timed bullet block. `data.{title, org, location, dates, bullets[], kind}` where kind is experience | education | project. Renders through `\resumeSubheading` or `\resumeProject` plus a bullet list.
- `cvPublication`: numbered citation leaf. `data.{authors, title, venue, year}` (optional `data.raw` override). Rendered inside an `enumerate`.

A section's child layout is inferred from its child type (textrows, entries, or publications), with an optional `data.layout` override. Bullets live as an array inside a `cvEntry`; entries and publications are their own nodes so they are individually reusable across CVs.

## Assembly and rendering

Two separate concerns:
- Editing: the reused `TreeEditor` for manual build, with `FormRenderer` edit modals. There is no bespoke on screen renderer; the preview is the compiled PDF (see Frontend conventions below).
- PDF: a Node side assembler walks the cvDocument tree and emits one `.tex` string (preamble from the template, `\newcommand` identity block from cvDocument.data, header, then each section rendered by type). The full `.tex` is POSTed to the Python service, which compiles it with TeX Live and returns PDF bytes. Node streams the PDF back and, on save, stores it in MinIO plus a `cv_artifacts` row, and can link it to an application.

Raw LaTeX passthrough: node fields store raw LaTeX (authors are trusted admins), the same way content cards store raw HTML. No escaping. This is admin only.

## Storage, ownership, and PDF lifecycle

The compiled PDF bytes are stored like any file: the generic `files` table plus MinIO (`nodejs/routes/framework/files.js:17-45`). The `files` table and its listing are admin only backoffice; they mirror every file in the store regardless of use, for the admin's custom handling. Regular users never browse `files` directly.

Users see their own CVs through the CV domain, not the files list. A generated CV is recorded in `cv_artifacts` (owner_id, cv_component_id, file_id): the user facing 'CVs I have' list, and the realisation of the manuBeat model run analogy (a run produces a file plus a domain record). The editable CV trees and section library are `cv_components`, also per user.

Ownership and permissions:
- `cv_components` are per user: a user's CV documents and section library are visible only to that user and the main admin. There is an `owner_id` column on `cv_components`, NULL for shared/global nodes such as the default template. Queries filter `owner_id = user OR owner_id IS NULL`; admin sees all; writes set or check `owner_id = req.user.id`.
- `cv_artifacts` and their PDFs are per user via `owner_id` and `files.uploaded_by`. Per file download is scoped to the owner (or admin, or a file linked to an application the requester owns, or a file behind a `cv_artifacts` row the requester owns). The generic download route is NOT scoped today; scope it. Any files browser or listing endpoint stays admin only.
- Do not put CV specific columns on `files`; the source CV link lives on `cv_artifacts.cv_component_id`.
- Frontend is user facing (PrivateRoute), scoped to the requester; the admin gets a superset view.

PDF lifecycle (keep the MinIO object and the DB rows consistent, warn in UI):
- Generate: create the MinIO object, then the `files` row, then the `cv_artifacts` row, rolling back the object if an insert fails.
- Delete: one authoritative delete removes the `files` row and the MinIO object together. Deleting the `files` row cascades `application_files` and `cv_artifacts` via their `ON DELETE CASCADE` FKs, so attachments and the user facing artifact record detach automatically. A user 'deleting a CV they have' resolves the artifact to its file and takes this same path. The UI must warn first that the file and every application it is attached to will lose it.
- Unlinking a file from an application is a different, lighter action that leaves the PDF intact. Route detail in [[cv-builder-phase-3-latex-compile]].

## Frontend conventions (non-negotiable)

All CV frontend work obeys the existing rules: [[code-reuse-rule]], [[page-template-rules]], [[page-conventions]]. Consequences for this feature:

- No bespoke `CvRenderer`. The on screen preview is the compiled PDF (reuse the compile path); node structure is shown by the reused `TreeEditor`. The only genuinely new UI element is the PDF viewer (an embed fed a blob URL). This is a deliberate change from an earlier draft that mirrored `ContentRenderer`.
- Reuse the shell library: `SplitPageLayout` (with `leftTabs`, never `left={<TabPanel/>}`), `ResourcePanel` with `fetcher` + `refreshToken` (never `data={array}`) for every list, `onAdd` for the "New CV" control (never `rightHeader`), `TreeEditor` for all node add/edit/reorder/delete, `FormRenderer` (seeded form trees, `mode='app'`) for every edit modal including the identity editor, `ModalShell` + `ResourcePanel` + confirm for pick-one choices (template, or which CV to attach), `EmptyState`, `ModalShell`, `PrivateRoute`.
- Page files follow [[page-conventions]]: 3-line header, figlet banners, 2-line region comments, standard labels reused, snake_case DB / camelCase JS / PascalCase components / UPPER_SNAKE constants.
- Left column follows the four [[page-template-rules]]: `leftTabs`, `fetcher`+`refreshToken`, `actions` buttons only, `hidden` for always-mounted DOM (library TreeEditor, file inputs).

## Reference map (existing code the feature mirrors)

- Content tree tables: `init-scripts/01-init-db.sql:20-56` (components, components_relationships).
- Component resolvers to clone: `nodejs/schema/resolvers/framework/components.js` (createComponent, updateComponent, deleteComponent, createComponentRelation, deleteComponentRelation, swapComponentPositions) and helpers `nodejs/schema/helpers/components.js`.
- Manual editor: `pwa/src/components/shell/TreeEditor.tsx`, renderer `pwa/src/components/content/ContentRenderer.tsx`, backoffice page `pwa/src/pages/backoffice/Content.tsx`.
- Claude assisted route: `nodejs/routes/framework/content.js` (POST /generate-content, SSE, client supplied Anthropic key, model claude-sonnet-4-6, JSON node blocks split on `<<<END>>>`), frontend `pwa/src/services/Api.ts:522-565` and Content.tsx AI Import tab.
- Jobs and files: `init-scripts/02-init-jobs.sql` (applications, application_events, application_files), `nodejs/routes/jobs/applications.js` (POST /api/applications/:id/files), MinIO client `nodejs/db.js:14-25`, `nodejs/routes/framework/files.js`.
- Python service: `python/api/main.py`, domain pattern `python/api/domains/compute/routes.py`, Dockerfile `python/Dockerfile`, Node to Python call pattern `nodejs/schema/resolvers/framework/survey.js` and `nodejs/routes/framework/compute.js` (axios to `http://${PYTHON_HOST}:${PYTHON_PORT}`, `responseType: 'arraybuffer'` for binary).

## Phases (each in its own file to stay small)

1. [[cv-builder-phase-1-database]] : cv_* tables, node type conventions, seed the shared template and decompose the two sample CVs into a section library and two seed documents, seed edit forms.
2. [[cv-builder-phase-2-backend]] : GraphQL CRUD for cv nodes and documents, the Node side LaTeX assembler, permissions, wiring.
3. [[cv-builder-phase-3-latex-compile]] : Python TeX Live compile endpoint, Dockerfile changes, Node compile bridge, security limits.
4. [[cv-builder-phase-4-frontend-manual]] : user facing CV builder page (owner scoped), TreeEditor, CvRenderer, identity form, compile and preview button, artifact list, Api.ts calls, routing and nav.
5. [[cv-builder-phase-5-claude-assisted]] : /generate-cv route tailored to the node taxonomy, JD input, preview and save as a new cvDocument.
6. [[cv-builder-phase-6-applications]] : attach a compiled CV PDF to an application, generate or compile entry points from the Applications page.

Suggested build order: 1, 2, 3 give a compilable CV from seeds. 4 makes it usable by hand. 5 adds AI. 6 closes the loop with applications. Phases 3 and 4 can overlap once 2 lands.

## Cross cutting risks

- LaTeX compile is code execution. Compile with shell escape DISABLED, in a temp dir, with a timeout and nonstopmode, admin only. See [[cv-builder-phase-3-latex-compile]].
- Package coverage: the CVs need fontawesome5, cfr-lm, tcolorbox, marvosym, multicol. Acceptance test for phase 3 is that the container compiles both existing sample CVs unchanged.
- Image size grows by roughly 2 to 4 GB from TeX Live. Acceptable per the decision above.
- File and DB consistency: a generated PDF must never leave a dangling row or an orphaned object. Deletes go through one route that removes both and cascades links, with a UI confirmation. See [[cv-builder-phase-3-latex-compile]].
- Generic file download is not ownership scoped today; scope it before exposing personal CVs to non admin users.
