---
name: cv-builder-phase-6-applications
description: CV builder phase 6 (job applications) — SHIPPED: Applications remade to conventions, Artifacts area, attach CV/files, owner-scoped files. Remaining: download scoping, generate-from-application, table view.
metadata:
  node_type: memory
  type: project
---

# Phase 6: job applications — shipped state

Parent plan: [[cv-builder-plan]]. The Job Applications domain has been fully remade (the earlier version was legacy code that broke the UI conventions, now in `.claude/rules/`). This file records what shipped; the code is the source of truth.

## Shipped (branch `cv-builder`, 2026-07)

**Area: "Job Applications"** — `AREA_NAV.APPLICATIONS = [Applications, Artifacts]` (title "Job Applications"), two nav entries, same shape as CV Builder's CVs/Generated CVs/Templates.

- **`pages/jobs/Applications.tsx`** (rewritten to conventions): left `ResourcePanel` of applications (search + status filter); right single `Detail` tab — Overview (read card + quick status select + Edit/Delete), then **Job Description**, then **Attached** files (`ResourcePanel`: attach / unlink / download), then **Timeline** (`ResourcePanel`: log). All editors are `FormRenderer` over seeded forms (`form_application`, `form_application_event`); all confirms are `ModalShell`; no hand-rolled forms/lists/`window.confirm` left.
- **`pages/jobs/Artifacts.tsx`** (its own area, cloned from `GeneratedCvs.tsx`): the user's files — list left, `PdfViewer` preview + download right, upload + delete. Backed by owner-scoped `getFiles`.
- **Attach flow**: `ModalShell` + `ResourcePanel` picker of the user's files + a kind select → `linkApplicationFile` (GraphQL). Generated CVs are `files` rows (owner = user), so they appear in the picker and attach with no re-upload — this is the "attach a CV to an application" loop.

**Backend**
- `nodejs/routes/framework/files.js`: `GET /files` now owner-scoped (non-admin sees only own); `DELETE /files/:id` allowed for the uploader (was admin-only), cascading `application_files` + `cv_artifacts`.
- `linkApplicationFile` mutation already existed in `resolvers/jobs/applications.js`; `Api.ts` gained `linkApplicationFile` + `fetchFileBlob`.
- Seeded `form_application` + `form_application_event` (global `components`) in `init-scripts/02-init-jobs.sql` (UUID prefix `aaaaf0…`; names in `constants.ts` `APP_FORM`). Needs a DB reset to appear.
- `application_files` join table (`02-init-jobs.sql`) is unchanged; attach/upload/unlink all go through it.

## Known gap (deliberate)

**Generic file download is NOT owner-scoped.** `GET /files/:id/download` stays unauthenticated because content images load through it via `<img src>` (ImagePicker → `data.src`), and browsers can't attach the auth header. Scoping it would break every content image. Proper fix = migrate content images to the existing unauthenticated `/files/:key/download-by-key` path, then lock `/download` to auth+ownership (uploader/admin, or a file behind an app/`cv_artifact` the requester owns). Separate content-domain change; not done.

## Remaining / ideas

- **Owner-scope the download route** (above) before treating personal files as private.
- **Generate/compile a tailored CV from an application** — the original phase-6 "Tailor CV for this role" entry point (deep-link to the AI route, ties to [[cv-builder-phase-5-claude-assisted]]) — not built.
- **Applications table view** (like the survey answers `DataTable`): a right-column `Table` tab over `getApplications` with key/value filters, column toggles, CSV export, row Edit → the existing `form_application` modal, row delete → `deleteApplication`. Editing is row-level via the modal (DataTable has `onEdit(row)`/`onDelete(id)`; no inline cell editing — that would be a bespoke component and is out of scope). Planned, not built.
