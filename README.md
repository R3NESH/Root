# plot-to-plan

A CP-SAT house layout generator for Indian plot owners. Plot dimensions and facing in;
a legal, buildable floor plan out.

**Working name is provisional** — see [notes/project-name.md](notes/project-name.md).

> **Status (2026-09-20): Phase 1 is built. 183/183 backend tests pass in 256 s.**
> The app generates a 3D house from plot dimensions and facing, with a first-person walkthrough,
> a 2D drafting canvas, and seven document sheets — BOQ, FF&E and finish schedules, interior
> elevations, a clearance audit, a reflected ceiling plan and a finish board — all drawn off the
> same model. Four input paths: taps, free text, a photographed floor plan, a photographed facade.
>
> **No paying user, and nobody has been asked.** That question has outranked every build step
> since 2026-08-23 and has never been started.
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
There is also a real queryable graph over code and notes together —
[notes/codebase/knowledge-graph.md](notes/codebase/knowledge-graph.md), 1,962 nodes and 4,514
edges as of 2026-09-20. Rebuilding it needs an override or it silently drops `notes/build/`; the
recipe is in that note.

## Layout

```
HANDOFF.md            source of truth, unedited
FEATURES.md           every shipped capability, by subsystem
TOOLS.md              every instrument you can pick up and operate
backend/              FastAPI + OR-Tools CP-SAT — POST /solve + three /ai/* routes
frontend/             Next.js 16 + Three.js — orbit view, walkthrough, 2D drafting, sheets
notes/
  Home.md             hub
  project-status.md   current state, re-measured
  workflow.md         how the project is run
  decisions/          21 locked decisions + the rejected list
  architecture/       split, output schema, environment, render realism
  solver/             CP-SAT API, gotchas, stability, room sizes, the risky claim
  blueprints/         stair styles, duplex sources
  programs/           café layout standards
  assets/             furniture model provenance
  ui/                 input patterns
  open-questions/     3 open, 1 of them blocking and unstarted
  build/              5 planned steps + an unplanned step 6 + test baseline
  codebase/           code ↔ note index, and the graphify knowledge graph
  daily/              working notes
  templates/
```

`notes/market/` was deleted in `07b01f2` on the user's instruction, along with every competitor
comparison. Earlier revisions of this file listed it.

## Running it

```
# both at once
./dev.ps1

# backend
cd backend && .venv\Scripts\python.exe -m uvicorn api.main:app --reload
cd backend && .venv\Scripts\python.exe -m pytest -q      # 183 tests, must stay green

# frontend
cd frontend && npm run dev
cd frontend && npx tsc --noEmit                          # the only real frontend check
cd frontend && npm run build
```

The frontend has **no tests**. `tsc --noEmit` and `npm run build` are the whole safety net —
run both on every frontend change.

## Before writing more solver code

One zero-code question has outranked every build step since 2026-08-23, and it is still
unanswered while the code kept growing:

1. [Does anyone pay?](notes/open-questions/q-does-anyone-pay.md)
