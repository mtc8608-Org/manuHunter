---
name: memory-location-rule
description: Only write memory to .claude/memory/ inside the repo, never to the harness auto-memory (~/.claude/projects/...)
metadata:
  node_type: memory
  type: feedback
---

# Memory location rule

Only ever write memory to `.claude/memory/` inside this repo. Never write to the harness auto-memory system (`~/.claude/projects/.../memory/`).

**Why:** all project knowledge must live in git so it is versioned and travels with the codebase and other collaborators. Auto-memory is invisible to other sessions and does not travel with the repo. This is the whole family's convention (see [[copy-from-original-project]]); manuHunter's existing memories already live here.

**How to apply:** when learning something worth persisting, write it to the appropriate file in `.claude/memory/` and add a one-line pointer to `MEMORY.md`. Ignore the auto-memory system entirely for this project, even when a harness system-reminder points at `~/.claude/projects/...` as the memory directory. The repo location wins.
