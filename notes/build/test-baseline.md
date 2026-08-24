---
tags: [build, testing]
status: established
date: 2026-08-24
---
# Test baseline

**Established 2026-08-24** at [[step-2-solver-core]] — `backend/tests/test_solver.py`,
run via `pytest` from `backend/` inside `.venv`.

## How to record it

Read the numbers from the test runner's **final output**, not from an impression of the run:

- total pass count
- total fail count
- the **name** of every failing test

Then fill the table below and date it. Every later step reports its delta against this row.

| Date | Pass | Fail | Failing tests | Recorded at |
|---|---|---|---|---|
| 2026-08-24 | 5 | 0 | none | baseline established at [[step-2-solver-core]] |
| 2026-08-24 | **23** | 0 | none | after steps 3–5; `pytest -q`, backend/, 5.51s wall |

**Delta: +18 tests, 0 failures.** `test_solver.py` 5 · `test_stability.py` 4 ([[step-4-drift-objective]])
· `test_vaastu.py` 5 ([[step-5-vaastu]]) · `test_api.py` 9 ([[step-3-wire-together]]).

`test_20_random_room_mixes` uses seed 42 — deliberately fixed, reproducible rather than flaky.

> [!note] Every later step reports its delta against the latest row, not against zero.

> [!success] This baseline already earned its keep
> It caught a real regression during [[step-4-drift-objective]]: capping every solve at 0.4 s to
> meet the latency budget made hard 6-room packings return `UNKNOWN` — no valid layout at all.
> A latency fix had quietly broken correctness. Without this row, "still fast" would have read
> as "still working".

## Fixture rule

Do not commit solver output fixtures without a timestamp. A fixture older than the code makes a
green suite meaningless — see [[environment-notes]].

Source: [[HANDOFF]] §0, §9
