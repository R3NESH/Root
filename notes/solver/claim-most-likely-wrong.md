---
tags: [solver, risk]
status: settled-claim-holds
date: 2026-08-24
---
# The claim most likely to be wrong — SETTLED, and it holds

**The claim:** that [[layout-stability]] is a hard problem worth building around.
**The verdict, measured 2026-08-24: correct.** The differentiator survives.

> [!success] Measured, not reasoned
> `backend/solver/bench_stability.py` — 5 rooms, 10 perturbed edits, 30×40 ft envelope.
>
> | Configuration | Total displacement | Worst single-edit jump | Solve ms (max) |
> |---|---|---|---|
> | **Without** drift objective | 2381 in | **1153 in (96 ft)** | 59 |
> | **With** drift objective | **0 in** | 0 in | 66 |
> | With drift **+ Vaastu** | **0 in** | 0 in | 76 |
>
> A 96-foot jump is a room teleporting clean across the house and out the other side. That is
> exactly the failure [[layout-stability]] predicted, and it happens on a five-room plan — not
> some pathological large case. The null hypothesis ("CP-SAT is already stable enough") is dead.

The drift objective removes it **completely** (100% reduction) for ~17 ms.

## What this does not settle

It does not make stability a *moat*. It confirms the problem is real and that this project has
solved it. "We fixed a real problem" and "nobody else fixed it" are different claims.

## The predicted failure mode also happened — and was fixed

[[layout-stability]] warned solve time could jump to seconds once Vaastu stacked on the drift
objective. It did: **962 ms with drift alone, 1490 ms with drift + Vaastu**, against a 500 ms
budget.

The cause was CP-SAT *proving* the drift objective optimal, not finding a good layout — a good
one arrives in tens of ms. Fixed by capping the interactive solve
(`INTERACTIVE_TIME_LIMIT_SECONDS = 0.4`), which turns "prove the best layout" into "return the
best layout found by the deadline". A time-limited run still returns FEASIBLE: every hard
constraint holds, only optimality of the drift term is unproven — which no user can perceive.

The fallback [[layout-stability]] proposed (constrain relative room *ordering* instead of
absolute position) was **not needed**.

> [!warning] A regression this caused, caught by [[test-baseline]]
> Capping *all* solves at 0.4 s broke `test_20_random_room_mixes`: hard 6-room packings returned
> `UNKNOWN` — no feasible layout found in time. Cold solves and live edits want different
> things, so there are now two budgets. See [[step-4-drift-objective]].

## Reproducing it

```
cd backend && .venv\Scripts\python.exe -m solver.bench_stability
```

Re-run whenever the solver changes. The null-hypothesis row (drift off) is the one that matters:
if it ever comes back near zero displacement on its own, this verdict flips and the
differentiator has to come from somewhere else.

## Still-standing advantages, independent of this result

- buildability: wall thicknesses, dimensions, openings — [[output-schema]] reserves the fields

Source: [[HANDOFF]] §12 · benchmark: `backend/solver/bench_stability.py`
