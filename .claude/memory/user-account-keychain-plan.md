---
name: user-account-keychain-plan
description: Design of the framework-level user_profile + user_secrets keychain (encrypted, write-only API keys, starting with the Anthropic key) and the Users backoffice page — implemented 2026-07-02
metadata:
  node_type: memory
  type: project
---

# User account: framework-level user_profile + user_secrets keychain

Designed 2026-07-02 with Manuel, agreed in full; **implemented 2026-07-02** (all six steps, including the Users backoffice page; the deferred admin-keychain-status column remains deferred). Prerequisite for [[cv-builder-phase-5-claude-assisted]] (supersedes that file's "client supplied key / localStorage / admin only" handling). Driven by [[served-multi-user-plan]]: no single-user shortcuts. The whole design is an upstream candidate for manuSpine ([[framework-upstream-candidates]]).

## Design decisions (settled)

Three framework tables with three temperaments:

1. **`users`** — auth only (unchanged). Admin-managed, fixed columns; self-service writes never touch it.
2. **`user_profile`** — display data. Rename/move of `cv_profile` (same shape: `owner_id UUID UNIQUE NULL` FK cascade, `data JSONB`). JSONB because the shape is form-driven and mutates: the framework ships table + plumbing, each app defines the profile *shape* via its seeded FormRenderer form (manuHunter keeps the CV identity form). Freely echoed to forms/prompts. Keeps the NULL-owner seed row + startup admin re-stamp.
3. **`user_secrets`** — the keychain. One row per (user, secret); adding a future key is a registry entry, never a migration:

```sql
CREATE TABLE user_secrets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,          -- registry-validated, e.g. 'anthropic_api_key'
    ciphertext  BYTEA NOT NULL,         -- nonce ‖ auth tag ‖ AES-256-GCM ciphertext
    last4       TEXT,                   -- computed once at write time, for masked display
    key_version SMALLINT NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, name)
);
```

- `owner_id NOT NULL` (unlike `user_profile`): secrets are **never seeded**, so no NULL-claim row.
- **Write-only over the API**: queries return `{name, label, isSet, last4, updated_at}` only; the raw value never appears in any GraphQL/REST response, not even to its owner or an admin. Admin lifecycle = see set/unset, clear; never read.
- **Self-scoping via no-owner-argument resolvers** (the `cvProfile` pattern, `resolvers/cv/documents.js:105`): operations take no owner id, resolve `userId(ctx)` from the JWT — ownership violation is unexpressible.
- **Encryption**: AES-256-GCM, per-row random 12-byte nonce, master key from `SECRETS_MASTER_KEY` env var (32 bytes, in `.env` — nodejs uses `env_file: .env`). `key_version` enables master-key rotation without all-or-nothing re-encryption. `last4` stored at write time so display never decrypts.
- **One decrypt choke point**: `nodejs/lib/secrets.js` — `setUserSecret(ownerId, name, value)`, `getUserSecret(ownerId, name)` (the ONLY code that decrypts), `clearUserSecret`, `listUserSecrets` (metadata only). Server routes needing a key call `getUserSecret(req.user.id, ...)`.
- **Registry**: `nodejs/secrets-registry.js`, sibling of `permissions.js` (same framework-config idiom, apps extend with `// [MY DOMAIN]` entries). Entries `{name, label}`; starts with `{name: 'anthropic_api_key', label: 'Anthropic API Key'}`. `setUserSecret` rejects unknown names. The frontend does NOT duplicate the registry — the `userSecrets` query returns registry ⋈ per-user status and the Account Integrations card renders from it.

## Users backoffice area (moved out of Account)

User management leaves `Account.tsx` and becomes an admin page `pwa/src/pages/backoffice/Users.tsx`, so Account is purely self-service (Profile, Integrations, Change Password). Standard template (`.claude/rules/` page-template + code-reuse):

- `ROUTE.USERS` behind `AdminRoute`; entry in `AREA_NAV.BACKOFFICE` (the single shared list, same order on every backoffice page) and in Menu's Backoffice section.
- **Left**: one-tab `leftTabs` with `ResourcePanel` — `fetcher: getUsers` + `refreshToken`, free-text filter on email + type filter on role, badges for status AND role, `onAdd` for the create button. Requires extending `ResourcePanel.getBadge` to accept `Badge | Badge[]` (two-line change, upstream candidate).
- **Right**: one-tab `TabPanel` ("Detail") — editor for the selected user via FormRenderer on a seeded framework form `form_user_editor` (role select, is_active check; email read-only above it) saved with `patchUser`; `EmptyState` when unselected.
- **Create**: `onAdd` → `ModalShell` + FormRenderer on seeded `form_user_create` (email, password, role) → `createUser`.
- Both form trees seed in `01-init-db.sql` (`c51c1e5f` framework range). Backend needs nothing: `GET/POST/PATCH /users` already exist in `routes/framework/auth.js:59-86`.
- **Later** (explicitly deferred): the Detail column shows the selected user's keychain status (registry ⋈ set/unset, admin clear button, never read) — the admin half of the secret-lifecycle rule.

## Implementation steps

1. **DB** — in `01-init-db.sql`: `user_profile` DDL (moved from `03-init-cv.sql:75`, renamed) + `user_secrets` DDL + `idx_user_secrets_owner`. Remove profile DDL from `03-init-cv.sql`; the profile *form* seed (`form_cv_profile`, cf-range) stays app-level in `03-init-cv.sql`. Update `seed-cv-samples.sql` profile seed to `user_profile`. Needs `./run reset` (Manuel runs it — CLAUDE.md "Running the project").
2. **Env** — add `SECRETS_MASTER_KEY` to `.env`; backend warns (or disables secrets features) if unset.
3. **Backend** — `lib/secrets.js` + `secrets-registry.js` as above. Move `cvProfile`/`upsertCvProfile` resolvers out of `resolvers/cv/documents.js` into `resolvers/framework/` renamed `userProfile`/`upsertUserProfile`; add `userSecrets` query + `setUserSecret`/`clearUserSecret` mutations. Add all five names to the `user` list in `permissions.js`. Update the startup re-stamp (`backend.js:98`) and `cvAssemble.js:29` to `user_profile`. Migrate `routes/framework/content.js:70`: drop the `apiKey` body param, load the requester's key via `getUserSecret`, 400 with a clear message if unset.
4. **Frontend** — `Api.ts`: rename `getCvProfile`/`upsertCvProfile` → `getUserProfile`/`upsertUserProfile`; add `getUserSecrets`/`setUserSecret`/`clearUserSecret`; drop the apiKey param from `generateContent`. `Account.tsx`: rename the CV Identity card to Profile (same FormRenderer + form), add an Integrations card driven by `userSecrets` (per entry: label, set/unset badge, `····last4`, updated date, paste-to-set/replace input, clear button), REMOVE the two admin cards (Create User, Users). `Content.tsx`: remove the `gen_api_key` input + localStorage handling (lines ~114/154/586). `constants.ts`: rename `CV_FORM.PROFILE` accordingly.
5. **Users backoffice area** — build `backoffice/Users.tsx` as specified above (route, nav, ResourcePanel list with badges/filters, Detail editor, create modal, seeded forms, `getBadge` array extension).
6. **Phase 5 alignment** — `/generate-cv` reads the key server-side like content.js; the CV AI tab gets NO key input; the route can be user-accessible (per-user keys), not admin-only. [[cv-builder-phase-5-claude-assisted]] already reflects all of this (updated 2026-07-02).

## Acceptance criteria

- Fresh reset boots; admin claims the seed profile row in `user_profile`; CV compile still emits identity.
- Account page: profile editing unchanged in behaviour; Integrations card can set and clear the Anthropic key; after save, no network response ever contains the raw key (only `last4`).
- Content AI Import works with no key field, using the stored key; a user without a key gets a clear error.
- A DB dump exposes only ciphertext; `grep` confirms decryption happens solely in `lib/secrets.js`.
- Adding a hypothetical second key = one `secrets-registry.js` line + nothing else (no migration, no new UI code).
- Users backoffice page: list filters by email text and role, shows status + role badges, add button creates a user via modal, Detail edits role/active; Account no longer shows any admin card.
