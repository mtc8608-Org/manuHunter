---
name: cv-builder-phase-5-claude-assisted
description: CV builder phase 5, the Claude assisted route that tailors a CV from a job description into cv node JSON, previews and saves as a new cvDocument
metadata:
  node_type: memory
  type: project
---

# Phase 5: Claude assisted route

Parent plan: [[cv-builder-plan]]. Prereqs: the shipped backend + manual builder (both done — see [[cv-builder-plan]]) AND [[user-account-keychain-plan]] (not built): the Anthropic key comes from the `user_secrets` keychain server-side, never from the client.

Goal: mirror the content AI Import flow for CVs. Paste a job description, let Claude tailor a CV from the existing section library and identity, preview the generated nodes, and save as a new cvDocument.

## Backend route

New route `nodejs/routes/cv/generate.js`, cloned from `nodejs/routes/framework/content.js`:
- `POST /generate-cv`, multipart, SSE stream, blocks split on the `<<<END>>>` sentinel, `{ _done: true, message }` completion. API key: loaded server-side via `getUserSecret(req.user.id, 'anthropic_api_key')` ([[user-account-keychain-plan]]), 400 with a clear message if unset — NO client-supplied key, NO localStorage (content.js is migrated to the same pattern as part of the keychain plan). Use the same model the content route uses (`claude-sonnet-4-6` at the time of writing); confirm the current model id against the claude-api reference when implementing rather than assuming.
- Context sent to Claude: the pasted job description, the user's master identity values, and the current section library (names, types, and LaTeX of existing sections, entries, publications) so Claude can pick, reorder, and lightly reword rather than invent facts. This mirrors how content.js feeds the source `.tex` at `content.js:64-126`.
- System prompt tuned to the cv node taxonomy (see [[cv-builder-plan]]): output JSON nodes of type cvSection, cvTextRow, cvEntry, cvPublication with the exact `data` shapes (now documented by the seed `init-scripts/03-init-cv.sql` and the assembler `cvAssemble.js`, since the phase-1 doc was deleted). One node per block. Emphasise: use only facts present in the provided library and identity, tailor emphasis and ordering to the job description, do not fabricate experience or publications.

## Frontend

- Add an AI tab to `pwa/src/pages/cv/Cv.tsx`, mirroring the Content AI Import tab (`Content.tsx:551-699`) but obeying `.claude/rules/code-reuse.md`: JD textarea, Generate button, live delta stream, a Save button. NO API key input — the key lives in the keychain, set on the Account Integrations card; if the user has no key, show a hint pointing there. Preview the draft by assembling the generated nodes and compiling them to a PDF (reuse the compile path), NOT via a bespoke HTML renderer. Reuse `ModalShell` / `FormRenderer` / shell components for any inputs rather than hand-rolling.
- `generateCv(...)` in `Api.ts`, cloned from `generateContent` (`Api.ts:522-565`), same SSE parsing (delta, node, done, error).
- Save flow (clone of `handleGenSave`): create a new cvDocument (title + tailored tagline + template_id — identity is NOT on the document, it comes from the user's `user_profile`, the renamed `cv_profile`) owned by the requester (`owner_id = req.user.id`), create each generated node (also owned by the requester), and link them in order. Prefer linking to the user's existing library atoms when a generated node matches one, to keep the reuse graph clean; at minimum create fresh nodes under the new document.

## Acceptance criteria

- Pasting a JD produces a set of tailored section nodes previewed in the UI.
- Saving creates a new cvDocument that compiles (phase 3) to a tailored PDF.
- Claude does not invent employers or papers not in the library (prompt discipline plus review before save).

## Notes

- The manual route (shipped — see [[cv-builder-plan]]) and this AI route converge on the same DB state: a cvDocument tree, compiled by the same assembler and Python compiler.
- Key handling superseded 2026-07-02 by [[user-account-keychain-plan]]: per-user key from `user_secrets`, read server-side only. Because keys are per-user, this route is user-accessible (add to the `user` list in `permissions.js`), not admin-only.
