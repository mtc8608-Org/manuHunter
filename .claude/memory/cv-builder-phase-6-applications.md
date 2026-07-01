---
name: cv-builder-phase-6-applications
description: CV builder phase 6, attach a compiled CV PDF to a job application and add generate or compile entry points from the Applications page
metadata:
  node_type: memory
  type: project
---

# Phase 6: attach to applications

Parent plan: [[cv-builder-plan]]. Prereqs: [[cv-builder-phase-3-latex-compile]] (compile and save PDF), ideally [[cv-builder-phase-4-frontend-manual]].

Goal: close the loop. A compiled CV PDF can be attached to a job application, and the Applications page can launch CV build or compile for a specific role.

## Backend

The join table already supports this: `application_files(application_id, file_id, kind)` at `init-scripts/02-init-jobs.sql:54-62`, and the upload plus link flow at `nodejs/routes/jobs/applications.js:11-56`.

- Add `POST /api/cv/:id/attach/:applicationId`: check the requester owns both the cvDocument (`cv_components.owner_id`) and the application (existing application ownership check at `applications.js:18-23`), compile the cvDocument (reuse the phase 3 compile plus MinIO save, which also writes a `cv_artifacts` row), then insert into `application_files` with `kind='cv'` (or a new `generated-cv`), reusing the ON CONFLICT link pattern from `applications.js:44-49`. This produces the PDF, records the artifact, and attaches it in one call.
- Alternatively add a GraphQL mutation `attachCvToApplication(cv_id, application_id)` next to the applications mutations in `nodejs/schema/resolvers/jobs/applications.js`. Either is fine; the REST route matches the existing file upload style.

## Frontend

- In `pwa/src/pages/jobs/Applications.tsx` (artifacts section at lines 303-332, upload modal at 437-456), add an "Attach CV" button that opens a `ModalShell` + `ResourcePanel` (fetcher = the user's cvDocuments, no onAdd/onDelete) + confirm to pick one, per [[code-reuse-rule]] (never `IonSelect` or a hand-rolled list). On confirm, call the attach endpoint, then refresh the artifacts list (which already renders any `kind`).
- Optional: a "Tailor CV for this role" button that deep links to the CV AI tab ([[cv-builder-phase-5-claude-assisted]]) pre filled with this application's `job_description`, then attaches the result back.
- If using a distinct kind, add `{ value: 'generated-cv', label: 'Generated CV (PDF)' }` to `APP_FILE_KINDS` in `constants.ts:165`. Otherwise reuse `cv`.

## Api.ts

- `attachCvToApplication(cvId, applicationId)` calling the route above.

## Acceptance criteria

- From an application, the user selects a cvDocument, and a compiled PDF appears in that application's artifacts, downloadable via the existing `GET /api/files/:id/download` flow.
- The attached file is linked with the correct `kind` and survives a page refresh.

## Notes

- No schema migration needed: `application_files.kind` is a free text column.
- This reuses the whole existing files and MinIO layer; nothing new in storage.
- Unlink vs delete: unlinking a file from an application (existing `unlinkApplicationFile`) removes only the `application_files` row; the PDF and its `files` row survive and stay attached to any other application. Deleting the file itself goes through `DELETE /api/files/:id` (see [[cv-builder-phase-3-latex-compile]]), which removes the MinIO object, deletes the `files` row, and cascades every `application_files` link. Both actions warn in the UI, and the two buttons must be visually distinct so a user does not delete a shared PDF when they meant to detach it from one role.
