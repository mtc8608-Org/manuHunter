---
name: framework-upstream-candidates
description: Framework sync ledger — generic changes flowing between manuSpine and its forks; the Landed section doubles as the fork-side merge map for pull-upstream
metadata:
  node_type: memory
  type: project
---

# Framework sync ledger (upstream candidates + fork merge map)

Framework-generic changes built in a fork are flagged under **Pending**, recreated
here in manuSpine (never cherry-picked), and moved to **Landed**. Forks then run
`git fetch upstream && git merge upstream/master`. Three skills drive the cycle:

- `flag-upstream` — in a fork, right after building something generic: adds a Pending entry.
- `port-upstream` — here in manuSpine: lands Pending items, moves them to Landed.
- `pull-upstream` — in a fork: merges upstream and uses **Landed** below as its
  conflict map. Keep the per-item deviations and merge notes accurate — they are
  read by the next fork session before it merges.

## Fork status (as of 2026-08-26)

- **manuHunter** (`master`, at `9089e85`) — merged the 2026-07-02/07-04 batch on
  2026-07-07 (merge commit `ccc9d8c`), but has **NOT merged the 14 commits since**
  (`bb976c0..2ebbf71`): the whole 2026-08-26 security batch below, plus the
  tier-generic nav/route work. Its next pull brings all of it at once. Every one
  of the 16 `pwa/src` files that range touched currently differs, and **all of it
  is fork-behind debt — not one unflagged fork edit** (verified by blob-history
  match against manuSpine; see [[fork-verbatim-surface]]).

  Fork-side follow-ups the merge will **not** do on its own: re-add APPLICATIONS
  and CV_BUILDER as `NAV_AREAS` entries (its `Menu.tsx` still carries them as
  hand-written JSX blocks) and delete its hand-maintained `NAV_SECTIONS` literal,
  which upstream now derives; delete the orphaned `UserRoute.tsx` (already
  importer-less); collapse three hand-rolled `createObjectURL` copies
  (GeneratedCvs, Artifacts, Applications) onto `downloadBlob`; drop its local
  ownership helpers for `schema/helpers/ownership.js`.

  **Tier note — its `user` rung is empty by design.** Jobs, CV *and surveys* all
  sit in `registered`, so its `NAV_AREAS` entries take `tier: 'registered'`
  (SURVEYS included, where upstream uses `'user'`) and its domain routes stay on
  `PrivateRoute`. Do **not** let the merge pull its survey area onto
  `TierRoute minTier="user"` — that would hide a page its own permissions.js
  grants. Nav mirrors the fork's permissions.js, never upstream's.

  Resolution outcomes from the 2026-07-07 merge, still in force: no public tier kept (gate adapted — no
  `permissions.public` lookup in its `schema/index.js`); upstream's generic
  `form_user_profile` d050 seed block **deleted** from its `01-init-db.sql`
  (its richer same-name form in `03-init-cv.sql` wins — `components.name` is
  UNIQUE); CV template seeds set `options.language: "latex"` explicitly;
  Dockerfile keeps TeX Live but dropped `hdf5-tools` (only served the removed
  compute engine); surveys placed on `PrivateRoute`/registered tier; four
  role-inverting lines in shared rules/skills re-worded fork-side
  (backend-api public-tier paragraph, db-schema framework-repo line,
  new-api step 6, new-role ownership line).
- **manuBeat** (`master`) — has NOT merged; last merged upstream **pre-port**
  (at 67c3a10), so its next pull brings the entire batch at once — and the
  security-critical GraphQL gate fix: its `schema/index.js` carries the
  first-selection-only bypass until it merges. Heaviest follow-up is auth: the
  tier-based lockdown defaults every GraphQL op to admin-only and adds REST
  guards, so manuBeat's domain surface (bedside telemetry ingest, device-token
  routes, WebSocket monitor, medical content) must be explicitly placed in tiers
  during the merge or it breaks silently. Review device-token auth paths against
  the new REST guards; `SECRETS_MASTER_KEY` must be added to its env. The
  2026-07-04 survey reframe hits it hardest: its `bedside` domain models a
  patient as a survey answer on `f000` — see that item's merge note below. It
  additionally receives the whole 2026-08-26 security batch below, of which the
  **deactivation check** and **device-token routes** need real thought: the JWT
  middleware now requires a live `users.is_active` row, so any device or agent
  authenticating with something that is not a real user row will start getting
  `req.user = null`.


## Landed 2026-08-26 — the manuHunter audit batch (upstream-native)

Not ported from a fork: manuHunter's pre-deployment audit swept **shared
framework code**, so its findings were manuSpine bugs. Fixed here; both forks
receive them on their next `merge upstream/master`. Details and open follow-ups:
[[pre-deployment-todo]].

- ✅ **Owner-scoping primitives** (`schema/helpers/ownership.js`) — `userId`,
  `isAdmin`, `assertOwner`, `assertReadable`, `ownerScope`, extracted from
  manuHunter's `resolvers/cv/documents.js`. `users.js` and `survey.js`
  refactored onto them. On merge: **take upstream and delete the fork's local
  copies** — manuHunter's `assertWritable`/`assertReadable`/`readScope` in
  `cv/documents.js` and `assertApplicationOwner` in `jobs/applications.js` are
  the same functions; keep its `applications` table's `user_id` column name by
  passing `{ column: 'user_id' }`. **manuBeat: `survey.js` changed** — its
  `bedside` domain leans on survey answers, so re-check its resolvers.
- ✅ **`downloadBlob`** (`pwa/src/utils/download.ts`, new dir) — fixes a leaked
  object URL in `DataTable`'s CSV export. On merge: manuHunter should collapse
  its three hand-rolled copies (GeneratedCvs, Applications, Artifacts) onto it.
- ✅ **Navigation single-sourced** — `NAV_AREAS` (constants.ts) now drives the
  drawer, the top-bar sections (`NAV_SECTIONS`, derived) and the in-page rail;
  `ICON_MAP` lifted to `components/shell/icons.ts`; `Menu.tsx` no longer
  hardcodes areas. **`AREA_NAV`'s shape is unchanged**, so pages keep working.
  On merge: conflict in `constants.ts` and `Menu.tsx` is expected — take
  upstream's mechanism, then re-add fork areas as `NAV_AREAS` entries
  (manuHunter: APPLICATIONS and CV_BUILDER) instead of Menu JSX blocks.
- ✅ **`UserRoute` / `isUser` / `userOnly` deleted** — dead in all three repos.
  On merge: drop any remaining import.
- ✅ **File download lockdown** — `files.is_public` + owner-or-admin on both
  routes, `download-by-key` resolved through the `files` table, inline mime
  allowlist, `nosniff`, single not-found-or-not-authorised error.
  **Reset-only**: a fork picks the column up on its own `./run reset`, and until
  then its content images 403. **manuHunter especially**: its generated CV PDFs
  and application artifacts are served through these routes — they are private
  uploads and stay private, which is the intended fix for its own
  download-scoping blocker, but re-check every `data.src` it seeds.
- ✅ **`/register` throttled + password floor** — separate `registerLimiter`;
  `MIN_PASSWORD_LENGTH` on register, change-password and admin user create.
- ✅ **Deactivation revokes** — JWT middleware re-checks `users.is_active`,
  fails closed. See the manuBeat device-token warning in Fork status above.
- ✅ **CORS removed, body cap set** (`express.json({ limit: '2mb' })`), `cors`
  dependency dropped. On merge: a fork serving its frontend from a different
  host must re-add CORS scoped to an explicit origin list — never bare `cors()`.
- ✅ **Deploy hardening** — Caddy `header` block (HSTS/nosniff/frame-ancestors),
  dev compose ports on `127.0.0.1`, `ship-app.sh` secret-length preflight,
  `provision.sh` ufw default-deny. The Caddy block does **not** reach an
  already-provisioned box; hand-copy it.
- ✅ **Rules updated** — `backend-api.md` (ownership primitives, no existence
  oracle, both-ends link auth, deactivation), `db-schema.md` (shared NULL-owned
  rows), `files-storage.md` (`is_public`), `python-compute.md` (subprocess
  sandboxing), `code-reuse.md` (adding an area). Take upstream.
- ✅ **Lockfile regenerated** (60f12b9) — `nodejs/package-lock.json` now matches
  `multer ^2.0.2` with `cors` dropped. Take upstream; rebuild the node image.
- ✅ **`python/requirements.lock` orphans dropped** — `pandas`, `numpy` and their
  transitives `python-dateutil`, `six` removed; the lock now matches
  `requirements.txt` (fastapi, uvicorn[standard], psycopg2-binary, requests,
  minio) at 30 pins. Done by the **hand-delete route** in
  `.claude/rules/python-compute.md`, not a container freeze — deliberate, because
  it isolates the change to the four orphans instead of churning every other pin
  to today's versions. (The old Pending entry said "never hand-edit"; the rule it
  deferred to sanctions hand-deletion when the dependency tree is obvious, and it
  is. The rule wins — that parenthetical is gone with the entry.) On merge: take
  upstream, then `./run rebuild python`.

## Pending

- **Retire `ComponentForm.tsx` and `ListModal.tsx` (2026-07-07)** —
  Where: `pwa/src/components/forms/ComponentForm.tsx` (+ its `ShowComponentModal` export and the `ComponentModal` interface in `pwa/src/interfaces/types.ts`), `pwa/src/components/forms/ListModal.tsx`.
  What: unimported in manuSpine, manuHunter, and manuBeat (only comment references). Configuration.tsx carries its own live copy of the editor-ID map ComponentForm duplicated. Delete both files and the orphaned interface.
  Strip: none.
  Decisions: none.
  Depends: none.

- **(Maybe) LaTeX compile service** — the `python/api/domains/latex/` compile
  endpoint (pdflatex, shell-escape disabled, temp dir, timeout) + the Node bridge
  pattern is largely generic ("compile a .tex string to PDF"). Borderline: it
  exists to serve the CV builder, but the compile primitive could live in
  manuSpine if another app needs LaTeX→PDF. Stays in manuHunter; revisit if a
  second consumer appears.

**Why:** manuSpine is the shared framework; generic improvements made in a derived
app must flow back so every app benefits and forks don't drift — and forks need an
accurate map of what a merge will bring and where it will conflict.

**How to apply:** in manuSpine, run `port-upstream` on Pending items (recreate from
the fork source, commit, move to Landed with deviations recorded). In a fork, run
`pull-upstream`: read the Landed merge notes above first, then
`git fetch upstream && git merge upstream/master` — never cherry-pick. On conflict,
fork keeps app-tuned content (permission tiers, seeds, package lists, registry
entries), takes upstream mechanism/framework files. Update the **Fork status**
section here (in manuSpine) once a fork has merged.
