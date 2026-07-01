---
name: cv-builder-phase-4-frontend-manual
description: CV builder phase 4, the user facing CV builder page reusing SplitPageLayout/TreeEditor/FormRenderer/ResourcePanel, compile-to-PDF preview, Api.ts calls, routing and nav
metadata:
  node_type: memory
  type: project
---

# Phase 4: frontend, manual builder

Parent plan: [[cv-builder-plan]]. Prereqs: [[cv-builder-phase-2-backend]], [[cv-builder-phase-3-latex-compile]].

Goal: a user facing CV page that reuses the structure of `pwa/src/pages/backoffice/Content.tsx`, where a logged in user builds their own CV by hand from their section library, sets identity values, and compiles to a live PDF preview. Owner scoped; admin sees everyone's. It lives under a user route like the Applications page.

This phase is bound by the reuse and layout conventions: [[code-reuse-rule]], [[page-template-rules]], [[page-conventions]]. The notes below are written to obey them; do not hand-roll anything a shell component covers.

## Reuse decisions (what NOT to build)

- No new `CvRenderer`. `ContentRenderer` only exists because content has no compile step. CVs compile to PDF, so the on screen preview IS the compiled PDF (reuse the phase 3 compile path) and node structure is shown by the reused `TreeEditor`. The only genuinely new UI element in this feature is the PDF viewer (an `<embed>` / `<iframe>` fed a blob URL).
- Node add, link existing, reorder, edit, delete: reuse `pwa/src/components/shell/TreeEditor.tsx` as is, pointed at the phase 2 cv mutations. Never hand-roll add/edit/delete modal logic.
- All edit modals (each node type, and the identity/config editor) render via `FormRenderer` against the seeded CV form trees from [[cv-builder-phase-1-database]] (`mode='app'`, dot-path keys). No bespoke field-state plus conditional JSX.
- Pick-one modals (choose the template for a document) use `ModalShell` + `ResourcePanel` (no onAdd/onDelete) + confirm. Never `IonSelect` or a hand-rolled list.
- Every list is a `ResourcePanel` with `fetcher` + `refreshToken`, or a `DataTable` for tabular data. Empty states use `EmptyState`. Every modal uses `ModalShell`.

## Constants and types

In `pwa/src/constants.ts`, add under a `// [CV]` marker (mirror `CONTENT_TYPE` at `constants.ts:18-37`):
- `CV_TYPE = { TEMPLATE, DOCUMENT, SECTION, TEXTROW, ENTRY, PUBLICATION }` (UPPER_SNAKE constants, camelCase type string values).
- `CV_ADDABLE_TYPES` per parent (a cvDocument accepts sections; a section accepts its leaf type), for the TreeEditor add flow.
- Stable form UUIDs from the phase 1 edit form seeds, and the default template UUID.
- `PANEL_CONFIG` entries for the CV, library, and artifact `ResourcePanel`s.

## Page (`pwa/src/pages/cv/Cv.tsx`)

Follow [[page-conventions]] exactly: 3-line file header, figlet banners (`STATE`, `LOAD`, `HANDLERS`, `RENDER`, plus reuse page-specific names `TREE`, `LIBRARY`, `PREVIEW`, `BUILD` where they fit rather than inventing), 2-line `═` JSX region comments with standard labels, and `SplitPageLayout` at the root.

Left column follows the four [[page-template-rules]]:
- `leftTabs={[...]}` (never `left={<TabPanel/>}`), one tab per list:
  - CVs: `ResourcePanel` `fetcher=fetchCvDocuments`, `refreshToken`, `onAdd` for "New CV" (never `rightHeader`). `actions` holds buttons only.
  - Section library: `ResourcePanel` of the user's unpaged sections, entries, textrows, publications (searchable, filter by type), so any atom can be linked into the open document. The global template (NULL owner) is available to all; everything else is the user's own.
  - Artifacts: `ResourcePanel` or `DataTable` from `cvArtifactList`, with download and owner-scoped delete (warned). This is the "CVs it has" surface, backed by `cv_artifacts`, never the admin files list.
- Errors render inside each tab's `content`, not in `actions`.
- Always-mounted DOM (the library `TreeEditor`, any file input) goes in `SplitPageLayout`'s `hidden` prop. Use `keepMounted` on a tab whose content holds a `useRef` other tabs read.

Right column:
- Build tab: `TreeEditor` on the selected cvDocument.
- Identity tab: `FormRenderer` bound to cvDocument.data (name, contacts, tagline, template chosen via the pick-one modal), saving through `updateCvDocument`.
- Preview tab: a Compile button (page-level control, fine in `rightHeader` or the tab `actions`) that calls `compileCv(id)` and shows the PDF blob in the viewer; a Save PDF button calling `saveCvPdf(id)`.

## Api.ts

Add to `pwa/src/services/Api.ts` (GraphQL node ops around 79-206, REST helpers near 487-514):
- Node CRUD and reorder calls hitting the phase 2 mutations.
- `cvDocumentList`, `cvDocument`, `createCvDocument`, `updateCvDocument`, `deleteCvDocument`, `cvArtifactList`.
- `compileCv(id) -> Blob`, `saveCvPdf(id) -> artifact`, `deleteCvArtifact(id)` (all with the auth header).

## Routing and nav

- Register the page in `pwa/src/App.tsx` as a `PrivateRoute`, under a user path like `/folder/CVs`, mirroring how Applications is mounted. Not `AdminRoute`.
- Add a nav entry in `pwa/src/components/.../Menu.tsx` next to Applications.
- Api.ts calls carry the auth header; the backend scopes by `owner_id`.

## Acceptance criteria

- A user opens their cvDocument, reorders and edits sections via `TreeEditor` + `FormRenderer`, and links a library atom into it.
- The Compile button renders the real PDF in the browser; Save PDF adds it to the Artifacts list.
- A new cvDocument is created via the CVs `ResourcePanel` `onAdd` and populated from the library.
- No new list/modal/form JSX was hand-rolled; a reviewer can point every panel at a shell component.

## Notes

- The library link flow is the reuse story: build a CV once, then mount the same Experience or Publications nodes into every variant.
- The PDF is the truth; there is no HTML approximation of LaTeX layout.
