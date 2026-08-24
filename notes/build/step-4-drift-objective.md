---
tags: [build, step, decision-point]
status: done
date: 2026-08-24
---
# Step 4 — Drift objective, and the measurement that matters

**Work.** Implement the drift objective from [[layout-stability]]. **Time the solve.**

**Done when.** Rooms nudge rather than jump across 10 consecutive edits, and the solve stays
under 500 ms.

> [!important] Measure the null case first
> Before adding the objective, run 10 perturbed solves *without* it and log positions.
> If rooms already stay put, [[claim-most-likely-wrong]] is confirmed wrong and the drift
> objective is solving a problem that does not exist. **One afternoon settles it.**

Confirm `add_abs_equality` exists before writing the loop — it is the one unverified name in
[[cp-sat-api]].

**Fallback if solve time blows up:** constrain relative room *ordering* rather than absolute
position.

Remember that [[ui-principles]] #3 wants three plans per interaction, so the real budget is
roughly a third of 500 ms per solve if that ships.

Record actual numbers in the [[daily-log]], against [[test-baseline]].

> [!success] Done 2026-08-24 — both done-conditions met
> Drift objective in `backend/solver/model.py`; benchmark in `solver/bench_stability.py`;
> 4 tests in `backend/tests/test_stability.py`.
>
> | Done-condition | Result |
> |---|---|
> | rooms nudge rather than jump across 10 edits | **0 in total displacement** (was 2381 in, worst jump 96 ft) |
> | solve stays under 500 ms | **76 ms worst case** with drift + Vaastu |
>
> **`add_abs_equality` verified to exist and work** — the one method name in the whole brief
> that [[cp-sat-api]] flagged as unchecked. It is real; the drift loop from [[layout-stability]]
> works as written.
>
> The null case was measured first, as instructed — that is what settles
> [[claim-most-likely-wrong]], and the claim held.

> [!warning] The predicted blow-up happened, and the fix has a subtlety worth keeping
> Solve time hit **962 ms** (drift) and **1490 ms** (drift + Vaastu) before capping — the exact
> failure [[layout-stability]] predicted. Cause: CP-SAT *proving* the objective optimal, not
> finding a good layout.
>
> Capping every solve at 0.4 s fixed latency but **broke `test_20_random_room_mixes`** — hard
> 6-room packings returned `UNKNOWN`, i.e. no valid layout at all. Caught by [[test-baseline]],
> which is exactly what it exists for.
>
> So there are two budgets, because a cold solve and a live edit want different things:
> - `SOLVE_TIME_LIMIT_SECONDS = 5.0` — cold solve, nothing on screen, finding *a* valid layout
>   beats latency
> - `INTERACTIVE_TIME_LIMIT_SECONDS = 0.4` — live edit, a layout is already on screen, so
>   good-enough-now beats provably-optimal-later
>
> The ordering-based fallback [[layout-stability]] proposed was not needed.

Prev: [[step-3-wire-together]] · Next: [[step-5-vaastu]] · Plan: [[build-order]]
