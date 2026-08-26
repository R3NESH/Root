---
tags: [codebase, moc]
date: 2026-08-23
---
# Codebase map

> [!note] Phase 1 complete, plus an unplanned [[step-6-walkthrough]]. 25/25 tests green.
> This note is the code↔note index. As files land, add a row. The point is that Obsidian's graph
> then shows design notes and the code that implements them as one connected structure rather
> than two disconnected clouds.
>
> **Re-audited 2026-08-25.** Seven modules had landed without a row — the whole walkthrough and
> connectivity surface. Added below. See [[project-status]].

> [!tip] There is now a real graph as well as this hand-kept index
> [[knowledge-graph]] — 435 nodes, 898 edges, built with graphify over code + notes together.
> It found `solve_layout()` (47 edges) and [[test-baseline]] (13 edges) as the two structural
> centres. This note stays the human-readable index; the graph is the queryable one.

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
| `frontend/components/Scene.tsx` | [[step-1-threejs-shell]], [[architecture]], [[integer-inches]], [[step-6-walkthrough]], [[realism-gaps]] | **done** — envelope, extrusion, drag-and-drop, first-person camera, roof/parapet/chajja. **Consumes the solver's `openings`** — the duplicate derivation is deleted |
| `frontend/components/PlotPicker.tsx` | [[ui-principles]] #1 (preset cards), #4 (steppers) | **done** |
| `frontend/components/CompassDial.tsx` | [[ui-principles]] #6 | **done** |
| `frontend/components/RoomTray.tsx` | [[ui-principles]] #4/#5 — per-kind steppers | **done** |
| `frontend/components/RoomCustomizer.tsx` | per-room custom dimensions — [[step-6-walkthrough]] | **done** — the [[zero-keyboard-events]] escape hatch |
| `frontend/components/Minimap.tsx` | [[step-6-walkthrough]] | **done** — plan view, click-to-teleport |
| `frontend/components/WalkthroughOverlay.tsx` | [[step-6-walkthrough]] | **done** — HUD; keyboard-only, see [[zero-keyboard-events]] |
| `frontend/lib/plot.ts`, `frontend/lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] | **done** — presets, setback math, edge-facing mapping |
| `frontend/lib/rooms.ts` | room vocabulary + colours; mirrors `solver/rooms.py` | **done** — 7 kinds |
| `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` | [[step-3-wire-together]] — 350 ms debounced `POST /solve` | **done** — the only network path. Sends `moved_index` so only a dragged room is released from its quadrant; flags an out-of-date backend that returns no `openings` |
| `frontend/lib/walkthrough.ts` | [[step-6-walkthrough]] | **done** — 5'5" eye level, room detection, spawn |
| `frontend/lib/interiorDetails.ts` | [[step-6-walkthrough]] | **done** — procedural PBR textures, furniture, door-aware placement. Gated by the **Auto-Furnish Interiors** checkbox; unchecked renders the bare shell |
| `frontend/app/page.tsx` | composition root; buildable-area readout per [[ui-principles]] | **done** |
| `backend/solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — placement, drift, Vaastu, and the relaxation ladder that never drops connectivity |
| `backend/solver/realism.py` | [[realism-gaps]] | **done** — proportion, daylight/ventilation against the built footprint, area objective |
| `backend/solver/connectivity.py` | [[rooms-do-not-form-a-house]], [[realism-gaps]] | **done** — parent tree (`assign_parents`), `derive_openings`, `derive_windows`, `add_entrance` (90% of layouts), `footprint`, `reachable_count` |
| `backend/solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — **7 room kinds**, each carrying `habitable` / `wet` / `max_aspect_x10` |
| `backend/solver/demo.py` | prints [[output-schema]]-shaped JSON | **done** — `python -m solver.demo` |
| `backend/solver/bench_stability.py` | settles [[claim-most-likely-wrong]] | **done** — `python -m solver.bench_stability` |
| `backend/vaastu/rules.py` | [[vaastu-as-constraints]] | **done** — [[step-5-vaastu]]; entrance N/E now exists in `connectivity.py` |
| `backend/envelope/envelope.py` | setbacks — **hardcoded gap**, see [[environment-notes]] | **done** — duplicates `frontend/lib/plot.ts` maths, see [[duplicated-geometry]] |
| `backend/api/main.py` | `POST /solve`, [[output-schema]] | **done** — [[step-3-wire-together]] |
| `backend/tests/` | [[test-baseline]] | **40/40 passing** — api 11, solver 6, stability 4, vaastu 8, realism 11 |

Each module folder (`frontend/README.md`, `backend/README.md`, and per-submodule READMEs under
`backend/`) carries the wikilinks back into this vault, per the convention above.

Ignored by the vault: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, `.next/`
(set in `.obsidian/app.json`). `backend/.venv/` now exists — verified `ortools==9.15.6755`
installs cleanly on Python 3.14, see [[environment-notes]].

## Size, as of 2026-08-25 (end of day)

Backend ~**1,950** lines of Python. Frontend ~**4,000** lines of TS/CSS.
`Scene.tsx` went 1,423 to 1,324 despite gaining a roof and a sun: consuming the solver's
`openings` deleted 99 lines of duplicated door derivation ([[duplicated-geometry]]).
