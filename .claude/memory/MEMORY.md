# Memory Index

<!-- One line per memory file. Keep under 200 lines. -->

- [ManuLab context](manulab-context.md) — ManuSpine is the OSS framework manuHunter forks; body-analogy app family (ManuSkin/Lobe/Pulse/Beat/Cortex); the bigger federated-research vision
- [Framework upstream](framework-upstream.md) — manuSpine is upstream; pull framework updates with `git fetch upstream && git merge upstream/master`, never cherry-pick
- [Framework upstream candidates](framework-upstream-candidates.md) — running list of generic changes to push back to manuSpine (FormRenderer `lines` type, PDF viewer, BuildKit apt cache mount)
- [Copy from original project](copy-from-original-project.md) — check `/home/cabsman/Documents/cabeleira.net/` before implementing anything; includes the MinIO + files table content-image seeding pattern
- [Never run ./run](never-run.md) — never execute ./run/docker yourself; always end by stating which ./run command the user must run
- [Sibling apps](sibling-apps.md) — pointers to manuSpine and manuBeat memory (bedside telemetry, cardio port, manuEdge Pi agent) and reusable framework takeaways
- [User: Manuel](user-manuel.md) — senior full-stack/PhD; treat as senior, no trailing summaries, do only what is asked, use ./run
- [Code reuse rule](code-reuse-rule.md) — non-negotiable: reuse shell/form components (SplitPageLayout, TabPanel, ResourcePanel, ModalShell, FormRenderer, TreeEditor, DataTable), new component only for genuinely new behaviour
- [Page conventions](page-conventions.md) — page file structure: section order, figlet ASCII banners, 2-line JSX region comments, 3-line file header, naming
- [Page template rules](page-template-rules.md) — four SplitPageLayout left-column rules: leftTabs, fetcher+refreshToken, actions=buttons only, hidden prop
- [Commit and git style](commit-and-git-style.md) — commit subject <=50 chars, no Co-Authored-By, no bullets; push only at session end or when asked
- [Memory location rule](memory-location-rule.md) — only write to repo .claude/memory/, never harness auto-memory
- [CV builder plan](cv-builder-plan.md) — master plan and index for the LaTeX CV builder (typed section library, live PDF compile, attach to applications)
- [CV builder phase 1: database](cv-builder-phase-1-database.md) — cv_* tables, node type shapes, seed template + section library from the two sample CVs
- [CV builder phase 2: backend](cv-builder-phase-2-backend.md) — GraphQL CRUD for cv nodes/documents, Node side LaTeX assembler, permissions
- [CV builder phase 3: latex compile](cv-builder-phase-3-latex-compile.md) — Python TeX Live compile endpoint, Dockerfile, Node compile bridge, security limits
- [CV builder phase 4: frontend manual](cv-builder-phase-4-frontend-manual.md) — user facing CV builder page (owner scoped), TreeEditor, CvRenderer, compile+preview, artifact list, routing
- [CV builder phase 5: claude assisted](cv-builder-phase-5-claude-assisted.md) — /generate-cv route tailoring a CV from a job description, preview and save
- [CV builder phase 6: applications](cv-builder-phase-6-applications.md) — attach compiled CV PDF to applications, entry points from the Applications page
