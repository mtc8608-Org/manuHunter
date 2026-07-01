---
name: cv-builder-phase-3-latex-compile
description: CV builder phase 3, Python TeX Live compile endpoint, Dockerfile changes, Node compile bridge, and compile security limits
metadata:
  node_type: memory
  type: project
---

# Phase 3: LaTeX compilation service

Parent plan: [[cv-builder-plan]]. Prereqs: [[cv-builder-phase-2-backend]] (needs the assembler).

Goal: compile an assembled `.tex` string to a PDF on a button press. Python owns compilation with TeX Live. Node assembles, calls Python, streams the PDF, and can persist it.

## Python side

New domain, following `python/api/domains/compute/routes.py`:

- `python/api/domains/latex/routes.py` with `router = APIRouter(prefix="/latex")` and `POST /latex/compile`.
  - Request (Pydantic): `{ latex_source: str, filename: str = "cv.pdf" }`.
  - Write `latex_source` to a `tempfile.TemporaryDirectory()`, run the compiler twice (references and section rules need a second pass), read the PDF, return it as a `StreamingResponse` with `media_type="application/pdf"`.
  - On failure return a structured error including the tail of the TeX log so the UI can show why it failed.
- Include the router in `python/api/main.py` next to the compute router.

Compiler invocation (security critical):
- Use `latexmk -pdf -interaction=nonstopmode -halt-on-error` OR `pdflatex` run twice, always with shell escape DISABLED (`-no-shell-escape`).
- Wrap in `subprocess.run(..., timeout=60, capture_output=True)`. Kill on timeout.
- Compile only inside the temp dir; never the repo. No network, no `\write18`.

## Dockerfile changes

Edit `python/Dockerfile`. Current install line adds only `hdf5-tools`. Add a curated TeX Live set. Start from this and expand until both sample CVs compile:

```
RUN apt-get update && apt-get install -y --no-install-recommends \
    hdf5-tools \
    texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-fonts-extra \
    latexmk \
    && rm -rf /var/lib/apt/lists/*
```

Package notes to verify during this phase: `cfr-lm` lives in `texlive-fonts-extra`; `fontawesome5`, `tcolorbox`, `marvosym`, `multicol`, `titlesec`, `enumitem` are in `texlive-latex-extra` / `-recommended`. If a package is missing, the sample compile will name it in the log. Rebuild with `./run rebuild python`.

## Node bridge

New route file `nodejs/routes/cv/compile.js`, registered in `backend.js` under a `// [CV]` marker:

- `POST /api/cv/:id/compile`: auth required and owner or admin. Call `assembleCvLatex(id)` (phase 2), POST the string to `http://${PYTHON_HOST}:${PYTHON_PORT}/latex/compile` with `axios` and `responseType: 'arraybuffer'` (same pattern as `nodejs/routes/framework/compute.js:42-46`). Stream the PDF back to the client with `Content-Type: application/pdf`. This powers the live preview button.
- `POST /api/cv/:id/save-pdf`: compile as above, then store the PDF in MinIO and insert into `files` (reuse the exact putObject plus INSERT flow from `nodejs/routes/framework/files.js:17-45`, key `${randomUUID()}-<cv name>.pdf`, mime `application/pdf`, `uploaded_by = req.user.id`), then insert a `cv_artifacts` row (`owner_id = req.user.id`, `cv_component_id = :id`, `file_id`, optional `label`). The `cv_artifacts` row is what the user sees; `files` stays generic and admin only. Return the artifact with its file fields. Attaching to an application is phase 6.
- `GET /api/cv/artifacts/:id/download` and `DELETE /api/cv/artifacts/:id`: user facing, scoped by `cv_artifacts.owner_id`. Download streams the underlying file; delete resolves `file_id` and calls the authoritative file delete below.

## PDF lifecycle and cascade (file and DB stay consistent)

The PDF is a normal `files` row plus a MinIO object. One authoritative delete keeps them in sync, and the UI always warns first. This is the manuBeat model run analogy: artifact = file + row, created and destroyed together.

- Generate to DB: covered above. Object, then `files` row, then `cv_artifacts` row, rolling back the object if an insert fails (the existing upload flow rolls back at `files.js:17-45`).
- Add a `DELETE /api/files/:id` route in `nodejs/routes/framework/files.js` (there is no delete route today). Auth required, allowed for the uploader (`files.uploaded_by`) or admin. It deletes the `files` row and removes the MinIO object in the same handler. Deleting the row cascades both `application_files` and `cv_artifacts` via their `file_id ... ON DELETE CASCADE` FKs (`init-scripts/02-init-jobs.sql:54-62` and the `cv_artifacts` table in [[cv-builder-phase-1-database]]), so every attachment and the user facing artifact record detach automatically.
- User facing delete: a user deleting one of 'their CVs' acts on a `cv_artifacts` row through `DELETE /api/cv/artifacts/:id` scoped by `owner_id`; that handler resolves `file_id` and calls this same authoritative file delete. The raw `files` routes and any files listing stay admin only backoffice.
- Order and failure: remove the object, then delete the row; if the object removal fails, still delete the row and log a warning. An orphaned object is safer than a `files` row pointing at a missing object. Never leave a dangling row.
- Ownership on download: scope `GET /api/files/:id/download` to uploader, admin, a file linked to an application the requester owns, or a file behind a `cv_artifacts` row the requester owns. It is unscoped today. Any files listing endpoint stays admin only.
- UI warnings: before delete, warn that the file and every application it is attached to will lose it. Since there is a single authoritative delete path, 'delete the DB entry' and 'delete the file' are the same warned action. Unlinking from one application (existing `unlinkApplicationFile`) is separate and leaves the PDF intact.
- The source CV link lives on `cv_artifacts.cv_component_id` (`ON DELETE SET NULL`), not on `files`. Deleting a cvDocument leaves its already generated PDFs intact but detached from the source; those PDFs are removed only by deleting their files.

## Acceptance criteria

- The rebuilt Python container compiles BOTH original sample CVs (`CV_CoMind.tex`, `CVquant.tex`) unchanged to PDF. This is the package coverage gate.
- `POST /api/cv/:id/compile` for a seed document returns a valid PDF.
- Shell escape is disabled; a `.tex` containing `\write18{...}` does not execute.

## Risks

- LaTeX compile is arbitrary code execution. The mitigations above (no shell escape, temp dir, timeout, admin or owner only) are mandatory, not optional.
- First image build is large and slow due to TeX Live. Expected and accepted.
- File and DB drift: mitigated by the single delete route and rollback on insert above. Do not add other delete paths that touch only one side.
