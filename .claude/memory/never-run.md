---
name: never-run
description: Never execute ./run (or docker compose) yourself; always end a task by stating which ./run command the user must run
metadata:
  node_type: memory
  type: feedback
---

# Never run ./run yourself

Never execute anything related to `./run` (or raw `docker compose`) yourself, not start, rebuild, reset, or down. Instead, **always end a task by stating which `./run` command the user needs to run** to apply the changes.

**Why:** the user controls the runtime/DB lifecycle. Running it for them (especially `./run reset`, which wipes DB + MinIO) is destructive and theirs to trigger.

**How to apply:** after making changes, finish with an explicit line like "Run `./run reset` to apply" (reset for init-script/seed changes, `./run rebuild <service>` for Dockerfile/deps changes, plain `./run` otherwise). See CLAUDE.md "Running the project" for the full command list. This is the same rule the sibling app manuBeat follows (see [[sibling-apps]]).
