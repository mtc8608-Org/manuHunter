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
in CLAUDE.md "Framework upstream"; reuse rules in `.claude/rules/code-reuse.md`. Domain code (the CV
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
  Now a proper shell component (the CV page uses it) and listed in `.claude/rules/code-reuse.md`. Lift
  into manuSpine's shell library as-is — no CV/domain coupling.

- **FormRenderer `code` field type + CodeEditor** — `pwa/src/components/forms/CodeEditor.tsx`
  is a dependency-free, collapsible, syntax-highlighted code editor (transparent textarea over
  a highlighted `<pre>`, scroll-synced; LaTeX token colouring). FormRenderer gained a `code`
  case (`renderCode`) that renders it, same pattern as the `lines`/`richtext` types. Highlighting
  is LaTeX-only today; generalise the tokenizer per a `language` prop before porting. Purely additive.

- **Small shell tweaks (bundle with the above)** — `TreeEditor` `rootEditable` prop (Edit button
  on the root header → `openEdit(root)`); `ResourcePanel` skips the sub-label line when
  `getSubLabel` returns empty; `AreaShell` ICON_MAP gained `download`. All generic and low-risk.

- **DataTable column-aware filters (Tier 1)** — `pwa/src/components/shell/DataTable.tsx` filters
  went from free-text "field key + value (contains)" to a **column dropdown** + per-type **operator**
  (text: contains/=, enum: =, number/date: =/≥/≤) + a value control that switches to a dropdown
  (`filterOptions`), date, or number input by column. Two new optional props — `filterOptions?:
  Record<col,string[]>` and `columnTypes?: Record<col,'text'|'enum'|'number'|'date'>` — fully
  backward-compatible (no props → text/contains, the old behaviour; verified Surveys still compiles).
  ≥/≤ are refined client-side; contains/= still go to the fetcher for server-side use. Benefits every
  DataTable (survey answers, applications table). Tier 2 (server-side structured filtering in the
  resolver) is the follow-up, not done. Clear upstream.

- **Collapsible layout columns (SplitPageLayout + AreaShell)** — both columns collapse to a
  thin 44px rail (rotated title via `writing-mode: vertical-rl`, chevron restore button; whole
  rail clickable). `SplitPageLayout` gained a `collapsibleLeft` prop (default on) that collapses
  the left/list column and widens the detail pane; `AreaShell` collapses the section nav sidebar.
  Collapsed state is persisted per-page/section in `localStorage` (`splitLeftCollapsed:<pathname>`,
  `areaSidebarCollapsed:<title>`), starts expanded. The two collapse buttons are aligned to a shared
  16px top offset (`AreaShell` sidebar `padding-top: 16px`; `SplitPageLayout` zeroes the Ionic
  grid/left-col top padding). Pure shell-library UX, zero domain coupling — clear upstream. Note:
  when the `AreaShell` sidebar is collapsed the nav links are hidden (restore to navigate); consider
  an icon-only rail variant before/at port time. Mobile not addressed (see the layout's `@media` +
  the responsive `sizeXs`/`IonSplitPane`/auto-collapse ideas from that discussion).

- **BuildKit apt cache mount** — `python/Dockerfile` now uses
  `RUN --mount=type=cache,target=/var/cache/apt … --mount=…/var/lib/apt/lists …` plus
  `rm -f /etc/apt/apt.conf.d/docker-clean` and `# syntax=docker/dockerfile:1`, so apt
  `.deb` downloads persist across builds (host-global BuildKit cache, shared by mount
  target across projects). Generic build-infra win — belongs in manuSpine's python image.
  Reuse in other projects by copying the same mount lines (Option A; use `id=apt` to
  make cross-project sharing explicit).

- **`.claude/` config layout (rules/, skills/, CLAUDE.md sections)** — manuHunter's Claude
  Code config was refactored (2026-07): path-gated conventions in `.claude/rules/`
  (code-reuse, page-structure, page-template), skills `/new-page` and `/which-component`,
  and always-on rules (never-run, git style, knowledge locations, upstream workflow,
  reference project) as CLAUDE.md sections. All framework-generic — port the layout and
  the rule/skill files to manuSpine so every fork inherits the conventions; each fork
  keeps only its domain memories.

- **User account: `user_profile` + `user_secrets` keychain + Users backoffice page (2026-07-02)** —
  the whole [[user-account-keychain-plan]] design is framework-generic: `user_profile` /
  `user_secrets` DDL in `01-init-db.sql` (+ `form_user_editor`/`form_user_create` seeds, d000/d010),
  `nodejs/lib/secrets.js` (AES-256-GCM, sole decrypt point) + `nodejs/secrets-registry.js`,
  the `userProfile`/`upsertUserProfile`/`userSecrets`/`setUserSecret`/`clearUserSecret` resolvers
  in `resolvers/framework/users.js` (+ `UserProfileType`/`UserSecretType`, permissions entries,
  `SECRETS_MASTER_KEY` env), Account's Profile + Integrations cards, and `backoffice/Users.tsx`
  (+ route/nav/PANEL_CONFIG.USERS). Only the profile *form shape* (`form_cv_profile`) is app-level.
  Port wholesale; each app seeds its own profile form.

- **`ResourcePanel.getBadge` accepts `Badge | Badge[]`** — `pwa/src/components/shell/ResourcePanel.tsx`
  exports `ResourceBadge` and renders one `IonBadge` per entry when an array is returned (Users page
  shows status + role). Backward-compatible two-line change; `AreaShell`/`Menu` also gained the
  `people` icon. Bundle with the shell tweaks above.

- **(Maybe) LaTeX compile service** — the `python/api/domains/latex/` compile endpoint
  (pdflatex, shell-escape disabled, temp dir, timeout) + the Node bridge pattern is
  largely generic ("compile a .tex string to PDF"). Borderline: it exists to serve the
  CV builder, but the compile primitive itself could live in manuSpine if another app
  needs LaTeX→PDF. Leave in manuHunter for now; revisit if a second consumer appears.

**Why:** manuSpine is the shared framework; generic improvements made in a derived app
should flow back so every app benefits and the fork doesn't drift.

**How to apply:** when porting, recreate the change in manuSpine (don't cherry-pick —
see CLAUDE.md "Framework upstream"), then merge upstream into manuHunter. Tick items off
here as they land in manuSpine.
