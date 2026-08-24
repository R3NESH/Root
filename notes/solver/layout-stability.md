---
tags: [solver, moat]
status: implemented-and-measured
date: 2026-08-24
---
# Layout stability — the claimed technical edge

None of the nine tools in [[competitor-landscape]] solve this. If this project has one defensible
piece of engineering, it is this one.

**Problem.** User edits an input, the solver re-runs from scratch ([[cp-sat-gotchas]] — there is
no incremental solve), and the bathroom teleports to the far side of the house. Jarring, and it
destroys trust in the output.

## Rejected: `add_hint`

The API exists ([[cp-sat-api]]) but users report it not affecting solve behaviour even with
complete, feasible hints. Do not rely on it. Listed in [[rejected-approaches]].

## Preferred: make stability an objective

Penalise displacement from the previous solution so the solver *prefers* the layout it already
showed.

```python
if prev:
    drift = []
    for name, (x, y, _, _) in R.items():
        px, py = prev[name]
        dx = m.new_int_var(0, env_w, f"dx_{name}")
        dy = m.new_int_var(0, env_d, f"dy_{name}")
        m.add_abs_equality(dx, x - px)
        m.add_abs_equality(dy, y - py)
        drift += [dx, dy]
    m.minimize(sum(drift))
```

> [!success] Implemented and measured 2026-08-24 — the code above works as written
> `add_abs_equality` **exists and behaves as expected** (verified directly against ortools
> 9.15.6755). It was the one unverified method name in the brief; it is real.
>
> Result: **total displacement 2381 in → 0 in** across 10 perturbed edits. Worst jump without
> the objective was **1153 in (96 ft)** — a room teleporting across the house and out the far
> side. See [[claim-most-likely-wrong]] for the full table.

> [!warning] The expected failure mode happened
> Solve time did jump — **962 ms** with drift, **1490 ms** with drift + [[vaastu-as-constraints]],
> against a 500 ms budget. Cause: CP-SAT *proving* the objective optimal, not finding a good
> layout.
>
> **The ordering-based fallback was not needed.** Capping the interactive solve
> (`INTERACTIVE_TIME_LIMIT_SECONDS = 0.4`) fixed it — a time-limited run still returns FEASIBLE,
> so every hard constraint holds and only optimality of the drift term is unproven. Worst case
> is now **76 ms** with everything on.
>
> Cold solves keep a longer 5 s ceiling; capping them too broke correctness on hard packings.
> See [[step-4-drift-objective]].

Implementation: `backend/solver/model.py`. Benchmark: `backend/solver/bench_stability.py`.
Tests: `backend/tests/test_stability.py`.

**This is solved, but not yet proven to be a moat** — see [[claim-most-likely-wrong]].

Source: [[HANDOFF]] §6
