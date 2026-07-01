---
name: copy-from-original-project
description: Check the original project (cabeleira.net) before implementing anything; copy its patterns exactly, never invent independently. Includes the content-image seeding pattern.
metadata:
  node_type: memory
  type: feedback
---

# Copy patterns from the original project

Before implementing any feature or fixing any non-trivial issue, look at the original project at `/home/cabsman/Documents/cabeleira.net/` first. Copy patterns exactly as done there. This applies to the whole ManuSpine family (see [[manulab-context]]); cabeleira.net is the mature reference.

**Why:** the user explicitly corrected a mistake where seed images were added as static paths (`/screenshots/...`) instead of following the real pattern used in the original project (MinIO + files table + download-by-key URLs).

**How to apply:** before implementing anything non-trivial, grep or read the equivalent file in `/home/cabsman/Documents/cabeleira.net/` first. If the pattern exists there, replicate it. Only design something new if it genuinely does not exist there.

## Specific pattern: seeding content images

The correct pattern for content images (from `cabeleira.net/nodejs/backend.js`):

1. Place PNG files in `pwa/public/screenshots/` (or any subdirectory under `pwa/public/`).
2. `pwa/public` is mounted at `/public:ro` in the nodejs Docker container (`docker-compose.yml`).
3. On startup, `backend.js` recursively scans `/public/**/*.png` (skip `favicon.png`), seeds each into MinIO with key `seed-<basename>`, and inserts a record into the `files` table (`ON CONFLICT DO NOTHING`).
4. Content seed SQL (`seed-landing.sql`) references images as:
   `"src": "http://localhost:3000/api/files/seed-<filename>/download-by-key"`.
5. This means images appear in the Files tab (they have `files` rows) and survive DB resets (keys are stable).

**Never** use static paths like `"/screenshots/app-foo.png"` as `data.src` in content cards; always go through MinIO + files table. The CV builder plan reuses this same `files` + MinIO model for compiled PDFs (see [[cv-builder-plan]]).
