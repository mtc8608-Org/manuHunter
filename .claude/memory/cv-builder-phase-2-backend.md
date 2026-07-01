---
name: cv-builder-phase-2-backend
description: CV builder phase 2, GraphQL CRUD for cv nodes and documents, the Node side LaTeX assembler, permissions and wiring
metadata:
  node_type: memory
  type: project
---

# Phase 2: backend (GraphQL, assembler, wiring)

Parent plan: [[cv-builder-plan]]. Prereqs: [[cv-builder-phase-1-database]].

Goal: expose the cv tree over GraphQL (clone of the component resolvers) and build the Node side assembler that turns a cvDocument tree into one `.tex` string. No compilation yet (that is [[cv-builder-phase-3-latex-compile]]).

## Files to add

- `nodejs/schema/helpers/cv.js`: low level ops cloned from `nodejs/schema/helpers/components.js` (fetchChildren by position, postComponent with recursive children, updateComponent, deleteComponent, deleteComponentRelation, relateComponents with auto increment position). Point them at `cv_components` / `cv_components_relationships`.
- `nodejs/schema/resolvers/cv/documents.js`: exports `{ queries, mutations }`, cloned from `nodejs/schema/resolvers/framework/components.js`:
  - Queries (all owner scoped: `owner_id = req.user.id OR owner_id IS NULL`, admin sees all): `cvComponent(id)`, `cvComponentByName(name)`, `cvComponentList(type)`, `cvComponentParents(child_id)`, `cvDocumentList` (the user's roots: `type='cvDocument' AND owner_id = req.user.id`), `cvDocument(id)` with nested resolved section tree, `cvArtifactList` (the user's generated PDFs from `cv_artifacts`, joined to their `files` row for filename and size).
  - Mutations: `createCvComponent`, `updateCvComponent`, `deleteCvComponent`, `createCvRelation`, `deleteCvRelation`, `swapCvPositions` (drag reorder), `createCvDocument`, `updateCvDocument` (identity values), `deleteCvDocument`. All writes set or check `owner_id = req.user.id` (admin may act on any). Compile and save-pdf and delete-artifact are REST, in [[cv-builder-phase-3-latex-compile]].
- `nodejs/schema/helpers/cvAssemble.js`: the assembler. `assembleCvLatex(cvDocumentId) -> string`.
- GraphQL types for the cv nodes in `nodejs/schema/types.js` (mirror the component and Application types there).

## Assembler algorithm (assembleCvLatex)

1. Load the cvDocument and its `data` (identity + `template_id`).
2. Load the referenced `cvTemplate`.
3. Emit an identity block: `\newcommand{\name}{...}`, `\phone`, `\emaila`, `\tagline`, and link macros, from cvDocument.data.
4. Fetch ordered section children (by `position`), recurse for each section's children.
5. Render each section by type:
   - text section (body, no children): `\section{\textbf{title}}` then `\small{ body }`.
   - textrows: `\section{...}` then `\small{ ` each cvTextRow as `\textbf{label:} text \\[2pt]` (omit the bold label if absent) ` }`.
   - entries: `\section{...}` then `\resumeSubHeadingListStart` then per cvEntry a `\resumeSubheading{title}{location}{org}{dates}` (or `\resumeProject{...}` when kind=project) plus `\resumeItemListStart` bullets `\resumeItemListEnd`, then `\resumeSubHeadingListEnd`. Match the macro argument order in the template (`CV_CoMind.tex:58-65`: #1 title, #2 right lower, #3 left lower, #4 right upper).
   - publications: `\section{...}` then the enumerate wrapper (`CV_CoMind.tex:176-188`) with each cvPublication as `\item \textbf{authors} \textit{title} venue.` or `data.raw` if present.
6. Concatenate: `preamble` + identity block + `docOpen` + `header` + rendered sections + `docClose`. Return the string.

Keep each node type's LaTeX emitter as a small pure function so phase 5 (Claude assisted) and phase 4 (preview) can reuse them.

## Wiring

- Merge the cv resolvers into `nodejs/schema/index.js` under a `// [CV]` marker, the same way domain resolvers are registered.
- Register any cv REST routes in `backend.js` (the compile route is added in phase 3; nothing REST here yet unless we expose assemble for debugging).
- Add the new mutation names to `nodejs/permissions.js` as user accessible (like the applications ops at `permissions.js:25-38`), so a logged in user can build their own CVs. Reads and writes are scoped by `cv_components.owner_id` (owner or admin; global nodes with NULL owner are readable by all).
- `createCvComponent` / `createCvDocument` set `owner_id = req.user.id`. The helper `postComponent` clone should accept and persist `owner_id`.

## Acceptance criteria

- `cvDocument(id)` returns the full ordered tree for a seed document.
- CRUD and reorder mutations work against `cv_components`.
- `assembleCvLatex(seedDocId)` returns a `.tex` string that is byte for byte plausible against the original sample `.tex` (diff should be small and structural only).

## Notes

- Do not escape field content; it is raw LaTeX by design (see [[cv-builder-plan]]).
- The assembler is the single source of truth for LaTeX output, shared by manual preview, AI preview, and compile.
