---
tags: [codebase, moc]
date: 2026-08-23
---
# Codebase map

> [!note] Phase 1 is complete — all five steps have landed. 23/23 tests green.
> This note is the code↔note index. As files land, add a row. The point is that Obsidian's graph
> then shows design notes and the code that implements them as one connected structure rather
> than two disconnected clouds.

## How the graph stays connected

The vault root **is** the repo root, and `showUnsupportedFiles` is on, so `.py` and `.ts` files
appear in the file explorer alongside notes. Obsidian only graphs Markdown, so the convention is:

1. Every top-level module gets a `README.md` **inside its own folder**.
2. That README links the notes it implements — `[[layout-stability]]`, `[[cp-sat-api]]`, etc.
3. Notes here link back to the module README by name.

The module README is the graph node standing in for the code.

## Modules

| Module | Implements | Status |
|---|---|---|
| `frontend/components/Scene.tsx` | [[step-1-threejs-shell]], [[architecture]], [[integer-inches]] | **done** — plot box, dashed setback envelope, translucent extrusion, two drag handles |
| `frontend/components/PlotPicker.tsx` | [[ui-principles]] #1 (preset cards), #4 (steppers) | **done** |
| `frontend/components/CompassDial.tsx` | [[ui-principles]] #6 | **done** |
| `frontend/lib/plot.ts`, `frontend/lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] | **done** — presets, setback math, edge-facing mapping |
| `frontend/app/page.tsx` | composition root; buildable-area readout per [[ui-principles]] | **done** |
| `frontend/components/RoomTray.tsx` | [[ui-principles]] #4/#5 — per-kind steppers | **done** |
| `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` | [[step-3-wire-together]] — 400ms debounced `POST /solve` | **done** — the only network path |
| `frontend/lib/rooms.ts` | room vocabulary + colours; mirrors `solver/rooms.py` | **done** |
| `backend/solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — placement + drift objective + Vaastu wiring |
| `backend/solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — 5 room kinds |
| `backend/solver/demo.py` | prints [[output-schema]]-shaped JSON | **done** — `python -m solver.demo` |
| `backend/solver/bench_stability.py` | settles [[claim-most-likely-wrong]] | **done** — `python -m solver.bench_stability` |
| `backend/vaastu/rules.py` | [[vaastu-as-constraints]] | **done** — [[step-5-vaastu]]; entrance N/E still missing |
| `backend/envelope/envelope.py` | setbacks — **hardcoded gap**, see [[environment-notes]] | **done** — duplicates `frontend/lib/plot.ts` maths |
| `backend/api/main.py` | `POST /solve`, [[output-schema]] | **done** — [[step-3-wire-together]] |
| `backend/tests/` | [[test-baseline]] | **23/23 passing** — solver 5, stability 4, vaastu 5, api 9 |

Each module folder (`frontend/README.md`, `backend/README.md`, and per-submodule READMEs under
`backend/`) carries the wikilinks back into this vault, per the convention above.

Ignored by the vault: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, `.next/`
(set in `.obsidian/app.json`). `backend/.venv/` now exists — verified `ortools==9.15.6755`
installs cleanly on Python 3.14, see [[environment-notes]].
