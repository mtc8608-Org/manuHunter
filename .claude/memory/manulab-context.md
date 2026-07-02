---
name: manulab-context
description: What ManuLab is, ManuSpine as its OSS foundation, the body-analogy app family, and where manuHunter fits
metadata:
  node_type: memory
  type: project
---

# ManuLab / ManuSpine context

manuHunter is a fork of **ManuSpine** (`git@github.com:mtc8608/manuSpine.git`), the open-source full-stack template extracted from **ManuLab** (cabeleira.net), Manuel's personal platform built on his biomedical engineering background. ManuSpine is the reusable scaffold (auth, component tree, surveys, CMS, shell components); each app forks it and adds a domain. manuHunter's domain is job hunting (jobs, applications, and the planned LaTeX CV builder, see [[cv-builder-plan]]).

## Body-analogy app family
All ManuLab apps are named after organs and all run on ManuSpine:

| Name | Purpose |
|------|---------|
| **ManuSkin** | Portfolio / content (outer layer, what the world sees) |
| **ManuLobe** | Finance / investment (decision-making, risk, planning) |
| **ManuPulse** | Clinical surveys and forms |
| **ManuBeat** | Cardio simulation, cardiopulmonary modelling, HDF5 runs, bedside telemetry |
| **ManuCortex** | AI features (reserved, not yet built) |

manuHunter is a sibling of these (a job-search app rather than an organ), built on the same framework. See [[sibling-apps]] for pointers to their memory.

## Bigger vision
ManuSpine being generic and public is a prerequisite for splitting cabeleira.net into separate repos and for a Cardano Catalyst Fund16 grant. The long-term ManuLab vision is a federated clinical-research platform with patient-sovereign health data (Cardano: Aiken contracts, Identus DIDs, Hydra micropayments, Midnight ZK proofs). That vision is manuBeat/ManuLab territory, not manuHunter's, but it explains why the framework is kept generic.

**Why this matters for manuHunter:** framework-level infrastructure is shared and reused across all these apps, so framework fixes flow upstream and are not reinvented per app. See CLAUDE.md "Framework upstream" and "Reference project".
