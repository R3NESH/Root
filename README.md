# plot-to-plan

A CP-SAT house layout generator for Indian plot owners. Plot dimensions and facing in;
a legal, buildable floor plan out.

**Working name is provisional** — see [notes/project-name.md](notes/project-name.md).

> **Status (2026-08-31): Phase 1 is built. 48/48 backend tests pass.**
> The app generates a 3D house from plot dimensions and facing, with a first-person walkthrough.
> The offline fallback used to report `"Vastu Solved (Optimal)"` over a layout that enforced
> nothing — fixed; it now reports `OFFLINE_ESTIMATE` and the UI says so.
>
> Read [notes/project-status.md](notes/project-status.md) for the current state and
> [HANDOFF.md](HANDOFF.md) for the original brief (unedited source of truth).

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
backend/              FastAPI + OR-Tools CP-SAT — POST /solve
frontend/             Next.js 16 + Three.js — orbit view and walkthrough
notes/
  Home.md             hub
  project-status.md   current state, re-measured
  workflow.md         how the project is run
  decisions/          8 locked decisions + rejected list
  market/             6 verified market facts
  architecture/       split, output schema, environment
  solver/             CP-SAT API, gotchas, stability, the risky claim
  ui/                 input patterns
  open-questions/     4 open, 2 of them blocking
  build/              5 planned steps + an unplanned step 6 + test baseline
  codebase/           code ↔ note index
  daily/              working notes
  templates/
```

## Running it

```
# backend
cd backend && .venv\Scripts\python.exe -m uvicorn api.main:app --reload
# frontend
cd frontend && npm run dev
```

## Before writing more solver code

Two zero-code questions have outranked every build step since 2026-08-23, and both are still
unanswered while the code kept growing:

1. [What was actually wrong with Forjit and GrehYug?](notes/open-questions/q-competitor-defects.md)
2. [Does anyone pay?](notes/open-questions/q-does-anyone-pay.md)

Two of the five possible answers to (1) invalidate a fortnight of planned work.
