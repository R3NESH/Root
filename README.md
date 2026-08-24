# plot-to-plan

A CP-SAT house layout generator for Indian plot owners. Plot dimensions and facing in;
a legal, buildable floor plan out.

**Working name is provisional** — see [notes/project-name.md](notes/project-name.md).

> **Status: nothing is built.** No product code, no test baseline, no commit history worth
> trusting. Read [HANDOFF.md](HANDOFF.md) first — it is the source of truth.

## This repo is also an Obsidian vault

The repo root is the vault root, so design notes and code live in one graph.

- Open Obsidian → **Open folder as vault** → select this directory.
- `notes/Home.md` is the hub.
- `notes/daily/` holds dated working notes; the daily-notes plugin is pointed at it.
- `notes/templates/` holds daily / finding / decision templates.
- Graph view is pre-coloured by folder (decisions green, market amber, solver red, questions
  purple, build cyan, daily orange).

Vault config is committed; only per-machine workspace state is gitignored.
Convention for keeping code in the graph: [notes/codebase/codebase-map.md](notes/codebase/codebase-map.md).

## Layout

```
HANDOFF.md            source of truth, unedited
notes/
  Home.md             hub
  decisions/          7 locked decisions + rejected list
  market/             6 verified market facts
  architecture/       split, output schema, environment
  solver/             CP-SAT API, gotchas, stability, the risky claim
  ui/                 input patterns
  open-questions/     4 open, 2 of them blocking
  build/              5 steps + test baseline
  codebase/           code ↔ note index
  daily/              working notes
  templates/
```

## Before writing solver code

Two zero-code questions outrank every build step:

1. [What was actually wrong with Forjit and GrehYug?](notes/open-questions/q-competitor-defects.md)
2. [Does anyone pay?](notes/open-questions/q-does-anyone-pay.md)

Two of the five possible answers to (1) invalidate a fortnight of planned work.
