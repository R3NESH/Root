---
tags: [solver, finding]
status: implemented
date: 2026-09-03
---
# The plan was legal, buildable, and looked like scattered pavilions

**Reported from the screen, not the tests.** After [[room-sizes-from-code]] landed, the 3D view
showed a house in loose blocks with a wide gap through the middle. It was not a rendering bug.

## What was missing

Every constraint in the model is satisfied by a straggling L just as well as by a tight
rectangle. Non-overlap does not care about gaps. The adjacency tree only requires each room to
touch *its parent*. The daylight rule only requires a room to touch the built footprint's
boundary — a scattered plan has *more* boundary, so it passes more easily. And the area
objective counts room area and never looks at the space between.

So two layouts of the same rooms, both reported OPTIMAL, measured **8% and 28% void** inside
their own footprint. Nothing in the model preferred either. The good ones were luck.

[[room-sizes-from-code]] did not cause this; it perturbed which equally-scoring layout CP-SAT
happened to return, and the luck ran out.

> [!note] The benchmark missed it too
> `solver/bench_realism.py` was written the same day and did not measure void. A regression
> obvious at a glance did not move a single number. The metric is in it now — the lesson is that
> an instrument only catches what it was pointed at.

## The fix, and the version of it that was wrong

`realism.footprint_perimeter_term()` adds the half-perimeter of the built footprint to the
objective. Maximising room area while minimising the box those rooms sit in is the statement
that the plan should read as one building.

**The first attempt used the box's *area*.** It reads more directly as "minimise the void" and it
cost the cold solve its optimality proof: `add_multiplication_equality` on two spans that every
room's min/max feeds. The six-room 30×40 fixture stopped reaching OPTIMAL inside the 2 s budget,
and its fill started varying **85.6% to 98.3% run to run** — which is
`test_the_house_fills_most_of_what_the_catalog_allows` measuring the time limit rather than the
objective, precisely what that test's own comment warns about. Half-perimeter is linear, keeps
the model in the same complexity class, and pulls the footprint just as tight.

## Weight, measured not chosen

Five cold runs of the six-room 30×40 fixture at each weight:

| COMPACT_WEIGHT | fill / ceiling | spread | void | status |
|---|---|---|---|---|
| 0 | 100% | 0.0 pt | 25% | OPTIMAL ×5 |
| 50 | 100% | 0.0 pt | 17% | OPTIMAL ×5 |
| **120** | **94–96%** | **1.9 pt** | **5–7%** | FEASIBLE ×5 |
| 250 | 80% | — | 0% | FEASIBLE |

50 keeps the optimality proof and removes only a quarter of the void. 250 buys the last of it by
**shrinking rooms**, which is the opposite of the goal. 120 removes four fifths of the void for
two points of fill.

## Where it ended up

| mix | plot | void before | void after |
|---|---|---|---|
| 2BHK | 30×40 | 6% | 5% |
| 3BHK | 30×40 | 18% | 0% |
| 2BHK | 40×60 | **28%** | **4%** |
| 3BHK | 40×60 | 37% | 3% |
| 4BHK | 50×80 | 46% | 11% |

Large plots were where it showed, and that follows: a tight envelope leaves the rooms nowhere to
scatter to. Slack is what exposed the gap.

## Honest limits

- **The void is a range, not a number.** These solves hit the cold budget and return FEASIBLE, so
  the incumbent varies: six runs of the 40×60 measured 3.4% to 15.5%. The regression test uses
  20% as a tripwire against the 27.6% "term off" baseline, not as a quality target.
- **The proof is gone on the mixes that now carry the term.** Cold solves sit at the 2 s budget
  and return FEASIBLE where some previously proved OPTIMAL in 120–420 ms. The *interactive* path
  is unaffected and better: with `prev` supplied it returns OPTIMAL in 134–346 ms, because the
  drift objective gives CP-SAT a warm start. That is the path every edit in the app takes.
- **Perimeter is a proxy for void.** A footprint can be a tight rectangle with a courtyard in the
  middle and score well. No case like that has been observed, but nothing forbids it.
