# backend

FastAPI + OR-Tools CP-SAT service. Single endpoint: `POST /solve`.

Implements: [[architecture]], [[output-schema]], [[environment-notes]].

Phase 1 complete. See [[project-phases]] for the Phase 1 / Phase 2 split, [[codebase-map]]
for the module ↔ note convention this README follows, and [[project-status]] for current state.

> [!success] Both blocking defects fixed 2026-08-25
> Only a *dragged* room is released from its zone quadrant, and connectivity is never dropped.
> The API ships the solver's `openings`, `wall_thickness_in`, `entrance_edge` and
> `rooms_reachable` — [[duplicated-geometry]].

## Modules

| Module | Implements | Status |
|---|---|---|
| `solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — [[step-2-solver-core]], [[step-4-drift-objective]], plus the relaxation ladder |
| `solver/realism.py` | [[realism-gaps]] | **done** — proportion, daylight/ventilation, area objective |
| `solver/connectivity.py` | [[rooms-do-not-form-a-house]], [[realism-gaps]] | **done** — parent tree, openings, windows, entrance, footprint, reachability |
| `zoning.py` | directional zone rules as constraints — [[zone-rule-is-a-constraint]] | **done** — used by the café pack; the residence posts none |
| `envelope/` | setbacks — hardcoded gap, see [[environment-notes]] | **done** — duplicates `frontend/lib/plot.ts`, see [[duplicated-geometry]] |
| `api/` | `POST /solve` + the three `POST /ai/*` routes, [[output-schema]] | **done** — [[step-3-wire-together]]. `_size_range()` clamps a pinned size to the catalog; it documented that and did not do it until 2026-09-19 |
| `ai/` | free text, a photographed plan, a photographed facade → solver constraints | **done** — see `ai/README.md`. Needs `ANTHROPIC_API_KEY`; returns 503 rather than guessing |
| `programs/` | building programme packs | **done** — residence and café as data: hub, parent tree, forbidden pairs, directional rules |
| `solver/walls.py`, `solver/quantities.py` | [[walls-as-objects]], bill of quantities | **done** — one wall per shared partition, with the openings it hosts; quantities only, no rates |
| `solver/bench_realism.py`, `solver/bench_stability.py` | the two instruments | **done** — the first measured [[room-sizes-from-code]] at both ends, the second settled [[claim-most-likely-wrong]] |
| `prompt_to_plan.py` | CLI: sentence → plan, ASCII, JSON, SVG | **done** — `python prompt_to_plan.py "30x40 north facing 2bhk with a store"`. No API key needed |
| `solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — **20 room kinds** (10 residential, 10 café), each carrying `habitable` / `wet` / `max_aspect_x10`. NBC 2016 minimums; maximums raised 2026-09-19 — [[room-sizes-from-code]] |
| `tests/` | [[test-baseline]] | **183/183 passing** in 256 s, measured 2026-09-20 |

## Dev

```
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m solver.demo
.venv\Scripts\python.exe -m solver.bench_stability
.venv\Scripts\python.exe -m solver.bench_realism
```

Run the suite on an otherwise-idle machine: the 0.4 s interactive solve cap is wall-clock, so
CPU contention makes `test_stability.py` fail spuriously. See [[test-baseline]].

## Environment

`.venv/` targets Python 3.14. `ortools==9.15.6755` verified installing cleanly — see
[[environment-notes]] (this was a flagged risk, now closed).
