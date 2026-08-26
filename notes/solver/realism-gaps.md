---
tags: [solver, finding, build]
status: implemented
date: 2026-08-25
---
# The packing was legal, buildable and not a house

**Claim.** After [[rooms-do-not-form-a-house]] the solver guaranteed three things: rooms do not
overlap, rooms stay inside the envelope, every room is reachable through a real door. None of
them stopped it emitting a 5 ft × 16 ft "bedroom", a windowless bedroom in the middle of the
plan, a bathroom with no ventilation, or a house covering 40% of the plot it was given.

## What was missing, measured before

| Gap | Before |
|---|---|
| Envelope fill | 39.6% mean, against a 66.2% catalog ceiling — rooms solved at their minimums because nothing rewarded a larger one |
| Room proportion | unconstrained; nothing forbade a 5 ft × 16 ft bedroom |
| Daylight / ventilation | no constraint at all; the renderer decided windows, and refused bathrooms one outright |
| Entrance | present in 38% of layouts |
| Room vocabulary | 5 kinds — no dining or store |
| Bathrooms | every bath a leaf off the hall; no ensuite |
| Wall thickness | one value everywhere; renderer drew 4.5 in against the solver's 5 in |
| Roof | none — walls stopped at 9 ft |
| Sun | fixed at `(50, 80, 40)` — a time-of-day sun was built and then removed, see below |

## What now holds

Six constraint families, in `solver/realism.py`, `solver/connectivity.py` and the enlarged
`solver/rooms.py` catalog:

1. **Proportion.** Per-kind aspect limit, `w × 10 <= d × max_aspect_x10`, integral per
   [[integer-inches]]. A stair may be 3.5:1; a bedroom may be 1.8:1.
2. **Daylight and ventilation.** Every habitable *or wet* room must sit on the outside face of
   the building. Wet rooms are included because an unventilated bathroom is not buildable.
3. **Area preference.** One `add_multiplication_equality` per room, in the objective —
   deliberately not a constraint, per this note's predecessor.
4. **A parent tree, not a star.** See below.
5. **Openings as output.** Doors, windows and the front door are derived post-solve and shipped.
6. **Wall thickness from position.** 9 in load-bearing on the perimeter, 4.5 in partitions.

### The subtle one: "exterior wall" means the building, not the plot

The first implementation required a room to touch the *envelope* boundary. It was wrong, and
measurably so: a twelve-room house went **INFEASIBLE on a 40×60 plot while solving on a 30×40**.
Room maximums mean the house does not span a large plot, so no interior room can stretch to
reach the plot edge. The constraint now derives the built footprint —
`min(x), max(xe), min(y), max(ye)` — and constrains against that. `derive_windows()`,
`add_entrance()` and the wall-thickness rule all use the same box; when they disagreed, the
solver guaranteed a wall the geometry then refused to put a hole in.

### The star had to become a tree

A pure hall-centric star is how [[rooms-do-not-form-a-house]] fixed reachability, and it works,
but it makes the hall's perimeter the binding constraint. At nine rooms the model went
**INFEASIBLE in 17 ms**: seven rooms cannot sit flush against one hall *and* all reach an
exterior wall. Rooms now attach to a preferred parent — utility off the kitchen, ensuite off the
master bedroom, pooja and stair off the dining space — with a fan-out cap of five. Connectivity
is still structural: every room attaches to a room already attached, so the door graph is a tree
rooted at the hub and no reachability search is needed inside the model.

Two bugs this introduced, both caught by measurement rather than reasoning:

- **The taboo and the tree contradicted each other.** The fallback handed the kitchen a bathroom
  as its parent, so `add_room_separation` forbade the very wall the door needed: INFEASIBLE in
  13 ms with no diagnosis. `FORBIDDEN_PAIRS` is now consulted when parents are assigned.
- **Vaastu and the tree contradicted each other.** The fan-out cap pushed the pooja room onto
  the kitchen — north-east and south-east, opposite corners. On the real buildable envelope of a
  30×40 plot this took Vaastu from three rules applied to **zero**, because the model became
  infeasible and the ladder walked down to a rung with Vaastu off. On the plot size this product
  is aimed at, and the constraint the market treats as mandatory. Parent selection is now
  quadrant-aware.

### The ladder never drops connectivity

The old fallback chain shed hub connectivity as a last resort and returned `OPTIMAL` with **1 of
8 rooms reachable**. Relaxation now goes: custom sizes → daylight → Vaastu → the area
preference, and stops. If none of those fit, `INFEASIBLE` is the honest answer and the UI can
say "too many rooms for this plot", which is at least actionable. Ten rooms on a 30×40 needs 703
sqft of rooms inside 720 sqft of buildable area — 98% packing, which no house with walls
achieves.

## Measured after

| Metric | Before | After |
|---|---|---|
| Envelope fill (of catalog ceiling) | ~60% | **92–100%**, 7 of 8 mixes exactly at the ceiling |
| Worst aspect ratio | unbounded | **2.4:1**, and that is the porch's own limit |
| Entrance present | 38% | **90%** |
| Rooms reachable | 100% first solve, **2/6 after an edit** | **100%, including after edits and drags** |
| Room kinds | 5 | **7** — 11 were added, then parking, sit-out, staircase and utility were removed the same day ([[rejected-approaches]]) |
| Cold solve, real 30×40 2BHK | — | **OPTIMAL in ~1.0 s**, all 3 Vaastu rules |
| Interactive solve | 138 ms mean | **129–304 ms**, budget 500 ms |
| Cold budget | 5.0 s | **2.0 s** — raising it to 5 s moved fill by ~1 point and changed nothing else |

### A side effect worth recording: the stability benchmark went blind

`solver/bench_stability.py` measured 5 rooms on a 30x40. Under the new constraints that mix is
so over-determined that it reproduces itself with the drift objective **switched off** — the
null hypothesis read 0, which looks like [[claim-most-likely-wrong]] finally dying.

It is not. Isolated across sixteen configurations, every run with the drift objective showed
**0 displacement** and almost every run without it showed large drift. Given slack, the effect
is *bigger* than in August: 7 rooms on a 40x60 drift **12,423 in, worst jump 2,877 in (240 ft)**
without the objective and **0 in** with it. The benchmark now runs that scenario, and keeps the
tight one as a labelled second row so nobody reads its zero as a verdict.

## Consequence

- [[step-5-vaastu]]'s entrance gap is closed: the front door exists, prefers N→E, and now
  reaches the renderer.
- [[duplicated-geometry]] is closed on all three counts — the renderer consumes `openings`,
  and 99 lines of duplicated door-derivation were deleted from `Scene.tsx`.
- [[test-baseline]] 25 → **41**, with `tests/test_realism.py` carrying the new invariants.
- **Four room kinds were removed again the same day** — parking porch, sit-out, staircase and
  utility — leaving hall, dining, kitchen, bedroom, bathroom, pooja and store. The `open_sided`
  concept went with them: the porch and sit-out were its only users, and code no input can
  reach is a trap for whoever reads it next. The removed kinds are now reported in
  `unknown_room_names` rather than silently placed. See [[rejected-approaches]].
- **Rejected: a time-of-day sun.** A solar path for 17.4N with a time slider was built, worked,
  and was removed the same day at the user's request. Recorded in [[rejected-approaches]] so it
  is not proposed again as an obvious win. The lighting is back to the fixed architectural rig.
- **The renderer now hard-depends on the API.** Doors and windows come only from `openings`;
  there is deliberately no client-side fallback, because a fallback is what
  [[duplicated-geometry]] was. An out-of-date backend therefore renders a house with solid walls
  and no way in. That failure is silent and looks exactly like a rendering bug — it happened —
  so `useSolve` now detects an all-empty `openings` response and the UI says
  "Solver is out of date — restart the backend".
- Still open: fill is measured against the *catalog* ceiling, and for a twelve-room program that
  ceiling is itself only 77% of the plot. Whether the catalog maximums are the right numbers is
  unverified — they were chosen as test fixtures, not from real house plans.

**Links.** [[rooms-do-not-form-a-house]] · [[vaastu-and-connectivity-drop-on-edit]] ·
[[duplicated-geometry]] · [[step-6-walkthrough]] · [[project-status]] · [[test-baseline]]
