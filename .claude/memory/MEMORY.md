# Memory Index

<!-- One line per memory file. Keep under 200 lines. -->
<!-- Standing rules live in CLAUDE.md; UI conventions in .claude/rules/; procedures in .claude/skills/. -->

- [User: Manuel](user-manuel.md) — senior full-stack/PhD; treat as senior, no trailing summaries
- [ManuLab context](manulab-context.md) — ManuSpine is the OSS framework manuHunter forks; body-analogy app family (ManuSkin/Lobe/Pulse/Beat/Cortex); the bigger federated-research vision
- [Sibling apps](sibling-apps.md) — pointers to manuSpine and manuBeat memory (bedside telemetry, cardio port, manuEdge Pi agent) and reusable framework takeaways
- [Served multi-user plan](served-multi-user-plan.md) — single-user today, but manuHunter (and all ManuLab apps) will be served multi-user; never take single-user shortcuts
- [User account keychain plan](user-account-keychain-plan.md) — SHIPPED: framework user_profile (ex cv_profile) + encrypted user_secrets keychain (write-only API, registry in secrets-registry.js) + Users backoffice page replacing Account's admin cards; prereq for phase 5
- [Framework upstream candidates](framework-upstream-candidates.md) — running list of generic changes to push back to manuSpine (FormRenderer `lines` + `code`/CodeEditor types, PdfViewer, TreeEditor rootEditable, DataTable column-aware filters, collapsible layout columns, BuildKit apt cache mount, the `.claude/` config layout)
- [CV builder plan](cv-builder-plan.md) — CV builder state: manual builder + templates shipped (phases 1-4), key divergences (per-user `cv_profile` identity, separate areas), remaining phases 5-6
- [CV builder phase 5: claude assisted](cv-builder-phase-5-claude-assisted.md) — (not built) /generate-cv route tailoring a CV from a job description, preview and save
- [CV builder phase 6: applications](cv-builder-phase-6-applications.md) — SHIPPED: Job Applications area remade (Applications + Artifacts), attach CV/files, owner-scoped files; remaining: download scoping, generate-from-application, table view
