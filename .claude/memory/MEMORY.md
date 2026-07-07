# Memory Index

<!-- One line per memory file. Keep under 200 lines. -->
<!-- Standing rules live in CLAUDE.md; UI conventions in .claude/rules/; procedures in .claude/skills/. -->

- [User: Manuel](user-manuel.md) — senior full-stack/PhD; treat as senior, no trailing summaries
- [ManuLab context](manulab-context.md) — ManuSpine is the OSS framework manuHunter forks; body-analogy app family (ManuSkin/Lobe/Pulse/Beat/Cortex); the bigger federated-research vision
- [Sibling apps](sibling-apps.md) — pointers to manuSpine and manuBeat memory (bedside telemetry, cardio port, manuEdge Pi agent) and reusable framework takeaways
- [Served multi-user plan](served-multi-user-plan.md) — single-user today, but manuHunter (and all ManuLab apps) will be served multi-user; never take single-user shortcuts
- [User secrets keychain](user-secrets-keychain.md) — SHIPPED design record: framework user_profile (ex cv_profile) + encrypted user_secrets keychain (write-only API, registry in secrets-registry.js) + Users backoffice page replacing Account's admin cards; invariants codified in rules/backend-api.md
- [Framework sync ledger](framework-upstream-candidates.md) — the 2026-07-02 port is fully landed upstream; Landed section is the fork-side merge map (per-item deviations) read by pull-upstream; Pending holds future flag-upstream entries
- [Mobile app path](mobile-app-path.md) — Capacitor removed upstream 2026-07-04 (unused, CVE-carrying); PWA install covers most needs; re-add procedure if app-store/native APIs ever needed
- [EChart owned wrapper](echart-owned-wrapper.md) — chart glue is ours (charts/EChart.tsx), engine stays echarts ^6; echarts-for-react removed
- [Project file tree](project-file-tree.md) — annotated repo map (framework + this fork's cv/jobs domains); consult before asserting structure, update on directory changes
- [CV builder plan](cv-builder-plan.md) — CV builder state: manual builder + templates shipped (phases 1-4), key divergences (per-user `cv_profile` identity, separate areas), remaining phases 5-6
- [CV builder phase 5: claude assisted](cv-builder-phase-5-claude-assisted.md) — (not built) /generate-cv route tailoring a CV from a job description, preview and save
- [CV builder phase 6: applications](cv-builder-phase-6-applications.md) — SHIPPED: Job Applications area remade (Applications + Artifacts), attach CV/files, owner-scoped files; remaining: download scoping, generate-from-application, table view
