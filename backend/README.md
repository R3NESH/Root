# backend

FastAPI + OR-Tools CP-SAT service. Single endpoint (planned): `POST /solve`.

Implements: [[architecture]], [[output-schema]], [[environment-notes]].

Phase 1 in progress. See [[project-phases]] for the Phase 1 / Phase 2 split and [[codebase-map]]
for the module ↔ note convention this README follows.

## Modules

| Module | Implements | Status |
|---|---|---|
| `solver/` | [[cp-sat-api]], [[cp-sat-gotchas]] | **done** — [[step-2-solver-core]] |
| `vaastu/` | [[vaastu-as-constraints]] | not started — [[step-5-vaastu]] |
| `envelope/` | setbacks — hardcoded gap, see [[environment-notes]] | not started |
| `api/` | `POST /solve`, [[output-schema]] | not started — [[step-3-wire-together]] |
| `tests/` | [[test-baseline]] | **5/5 passing**, see [[step-2-solver-core]] |

## Dev

```
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest -v
.venv\Scripts\python.exe -m solver.demo
```

## Environment

`.venv/` targets Python 3.14. `ortools==9.15.6755` verified installing cleanly — see
[[environment-notes]] (this was a flagged risk, now closed).
