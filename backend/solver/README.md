# backend/solver

CP-SAT room placement. Implements [[cp-sat-api]], [[cp-sat-gotchas]].

**Core placement done** — [[step-2-solver-core]]. `model.py` (solve_layout), `rooms.py`
(catalog + Room dataclass), `demo.py` (`python -m solver.demo` from `backend/`, prints
[[output-schema]]-shaped JSON). Tests: `../tests/test_solver.py`, baseline at [[test-baseline]].

Directional zone constraints live in `../zoning.py` and are posted only for a programme that
carries them — see `../programs/README.md`.

Requested room pairs are scored rather than constrained — the one preference in this solver
that is, and why: [[preferences-are-scored]].

All lengths in inches: [[integer-inches]].
