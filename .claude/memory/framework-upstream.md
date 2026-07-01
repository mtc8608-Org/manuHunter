---
name: framework-upstream
description: manuSpine is the parent framework for manuHunter; use the upstream merge workflow (never cherry-pick) to pull framework updates
metadata:
  node_type: memory
  type: project
---

# Framework upstream workflow

manuHunter is derived from the **manuSpine** framework (`git@github.com:mtc8608/manuSpine.git`, local clone at `/home/cabsman/Documents/projects/manuSpine`). Both repos share the initial commit `7515a54` ("Initial ManuSpine framework commit"). The `upstream` remote is already configured on manuHunter pointing at manuSpine.

To pull framework updates:

```bash
git fetch upstream
git merge upstream/master
```

**Why:** the framework keeps evolving and all derived apps (manuHunter, manuBeat, etc.) must pull updates cleanly. Cherry-picking individual commits does not scale; the upstream merge workflow is the correct approach.

**How to apply:** never suggest cherry-pick for pulling framework changes into manuHunter. Always use `git fetch upstream && git merge upstream/master`. Framework-level fixes should be made in manuSpine and flow up; job-search (domain) features live in manuHunter. Same pattern is used by [[sibling-apps]] (manuBeat).
