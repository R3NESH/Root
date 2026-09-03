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
| 2026-08-25 | **25** | 0 | none | re-measured at review; `pytest -q`, quiet machine, 11.5s wall |
| 2026-08-25 | **41** | 0 | none | after the regression fix and [[realism-gaps]]; `pytest -q`, 29.8s wall |
| 2026-08-25 | **40** | 0 | none | after removing four room kinds; `pytest -q`, 21.3s wall |
| 2026-08-30 | **43** | 0 | none | after fixing pooja NE rule, small custom room ladder bounds, and entrance room door; `pytest -q`, 21.4s wall |
| 2026-08-31 | **50** | 0 | none | after the audit fixes: room semantics across the API boundary, and `vaastu_relaxed`; `pytest -q`, 25.6s wall |
| 2026-09-03 | **90** | 0 | none | after walls as objects, quantities BOQ, NBC 2016 room sizes, compact footprint objective, programs registry and prompt-to-plan; `pytest`, 188.8s wall |

**Delta: +40 tests, 0 failures.** Composition as of 2026-09-03: `test_api.py` **14** ·
`test_programs.py` **23** · `test_prompt_to_plan.py` **3** · `test_realism.py` **15** ·
`test_solver.py` **6** · `test_stability.py` **4** · `test_vaastu.py` **13** · `test_walls.py` **12**.

The forty added on 2026-09-03 encompass two major development leaps:
- `test_walls.py` **+12** — walls as first-class objects derived from room bounds, 0-overlap partition deduplication, thickness assignment (9 in load-bearing exterior vs 4.5 in partition), hosted door attachment, and quantities takeoff (masonry volume, brick count from void/mortar physics, mortar, and plaster).
- `test_programs.py` **+23** — multi-program zoning registry (residence Vaastu vs café flow topology, hub connectivity, forbidden adjacencies).
- `test_prompt_to_plan.py` **+3** — natural language prompt to envelope and program resolution.
- `test_realism.py` **+1** — `test_the_house_reads_as_one_building` ensuring void ratio is capped below 20% on large envelopes via linear compact footprint half-perimeter term.
- `test_api.py` **+1** — wall output serialization and integer coordinate coercion.

The seven added on 2026-08-31 all close gaps the suite could not see:

- `test_api.py` **+2** — the catalog's `habitable` / `wet` flags survive the API boundary. Every
  other realism test builds its `Room`s straight from `ROOM_CATALOG`, so they asserted the
  intended behaviour on objects `POST /solve` never produced. It had been rebuilding each room
  without those fields since the endpoint was written.
- `test_vaastu.py` **+5** — a solve that drops Vaastu must say so (`vaastu_relaxed`), and the
  three cases where an empty rule list is the *correct* answer must not trip the flag (no ruled
  room in the mix, the dragged room released on purpose, and a roomy envelope). The fixture for
  the positive case is a hall/kitchen/bedroom 1BHK on a 260x220 in envelope, which returns
  **OPTIMAL with zero rules posted** — found by sweeping envelopes 150-340 in on both axes, 111
  of which do this.

The count went 41 -> 40 when the open-sided room test was removed along with the porch and
sit-out. A dropped test is only healthy when the behaviour it guarded is also gone; that is the
case here.

The suite is also faster — 86 s to 30 s — because the cold solve budget dropped from 5 s to 2 s
once it was measured that the extra three seconds moved envelope fill by about one point.

`test_20_random_room_mixes` uses seed 42 — deliberately fixed, reproducible rather than flaky.

> [!note] Every later step reports its delta against the latest row, not against zero.

> [!success] This baseline already earned its keep
> It caught a real regression during [[step-4-drift-objective]]: capping every solve at 0.4 s to
> meet the latency budget made hard 6-room packings return `UNKNOWN` — no valid layout at all.
> A latency fix had quietly broken correctness. Without this row, "still fast" would have read
> as "still working".

> [!danger] And it has a blind spot, found 2026-08-25
> 25 green tests do not notice that Vaastu and connectivity are switched off on every solve
> after the first — see [[vaastu-and-connectivity-drop-on-edit]]. `test_vaastu.py` never passes
> `prev`; `test_stability.py:80` passes `prev` with Vaastu on but asserts only status and time.
> **Two invariants were missing.** Both were added on 2026-08-25 and both now pass:
> `test_vaastu_still_holds_when_prev_is_supplied` and
> `test_rooms_stay_reachable_when_prev_is_supplied`, plus
> `test_only_the_dragged_room_is_released_from_its_quadrant`.

> [!warning] The suite is wall-clock flaky under CPU load
> Measured 2026-08-25. On a loaded machine: **2 failed, 23 passed in 44.4 s**, both failures in
> `test_stability.py` with `status == 'UNKNOWN'`. On a quiet machine, immediately after:
> **25 passed in 11.5 s and 15.2 s**, and `test_stability.py` alone passed 3 runs out of 3.
>
> Cause: `INTERACTIVE_TIME_LIMIT_SECONDS` (0.4 s) is a **wall-clock** cap, so contention turns a
> latency budget into a correctness failure. Nothing is wrong with the code — but record the
> machine state with the row, and re-run before believing a red result. A suite that goes red
> under load is a suite that gets ignored.

## Fixture rule

Do not commit solver output fixtures without a timestamp. A fixture older than the code makes a
green suite meaningless — see [[environment-notes]].

Source: [[HANDOFF]] §0, §9
