---
tags: [build, step]
status: done
date: 2026-08-23
---
# Step 2 — CP-SAT core

**Work.** Place 4–6 rooms in a fixed 30×40 envelope. Print JSON in the shape of
[[output-schema]].

**Done when.** Rooms **never overlap and never exit the envelope**, across 20 random room mixes.

Start from the skeleton in [[cp-sat-api]]. Explicitly verify that envelope containment actually
holds from the variable domains alone — if rooms escape, add `m.add(xe <= env_w)`.

Watch for [[cp-sat-gotchas]], especially reading values off the underlying int vars rather than
the interval objects.

> [!important] This step establishes [[test-baseline]].
> Record pass/fail counts and the names of any failing tests, read from the runner's final
> output. Not an impression of it. Every later step reports its delta against that record.

Check the `ortools` wheel situation on Python 3.14 first — see [[environment-notes]].

> [!success] Done 2026-08-24
> Built at `backend/solver/` (`model.py`, `rooms.py`, `demo.py`) + `backend/tests/test_solver.py`.
> **Envelope containment verified with no extra constraint needed** — the interval end
> variables' domains (`0..env_w`) alone were sufficient, confirming the prediction in
> [[cp-sat-api]]; a dedicated test (`test_envelope_domain_alone_blocks_escape`) pins this so a
> future OR-Tools upgrade can't silently regress it.
>
> 5/5 tests pass, including the 20-random-room-mix requirement (fixed seed 42, so the baseline
> is reproducible rather than flaky) — see [[test-baseline]] for the exact run.
>
> One real bug caught while writing this: keying placed-room variables by `room.name` collapses
> two rooms of the same kind (two bedrooms) onto one CP-SAT variable set. Fixed by keying on
> list index instead; `test_duplicate_room_kinds_get_independent_positions` pins it.
>
> Sample solve: 5 rooms (hall, kitchen, 2× bedroom, bathroom), status `OPTIMAL`,
> **82.77 ms**. One data point, not the [[layout-stability]] answer — that needs the drift
> objective at [[step-4-drift-objective]] before it means anything, but it's a first read
> against [[claim-most-likely-wrong]]'s "maybe 50 ms is already enough" hypothesis.

Prev: [[step-1-threejs-shell]] · Next: [[step-3-wire-together]] · Plan: [[build-order]]
