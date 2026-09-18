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
| `zoning.py` | directional zone rules as constraints | **done** — used by the café pack; the residence posts none |
| `envelope/` | setbacks — hardcoded gap, see [[environment-notes]] | **done** — duplicates `frontend/lib/plot.ts`, see [[duplicated-geometry]] |
| `api/` | `POST /solve`, [[output-schema]] | **done** — [[step-3-wire-together]] |
| `solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — 8 room kinds, each carrying `habitable` / `wet` / `max_aspect_x10` |
| `tests/` | [[test-baseline]] | **173/173 passing** |

## Dev

```
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m solver.demo
.venv\Scripts\python.exe -m solver.bench_stability
```

Run the suite on an otherwise-idle machine: the 0.4 s interactive solve cap is wall-clock, so
CPU contention makes `test_stability.py` fail spuriously. See [[test-baseline]].

## Environment

`.venv/` targets Python 3.14. `ortools==9.15.6755` verified installing cleanly — see
[[environment-notes]] (this was a flagged risk, now closed).
