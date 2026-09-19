---
tags: [solver, finding]
status: implemented
date: 2026-09-03
---
# The room catalog was test fixtures, and it cost three plot sizes

**Claim.** `ROOM_CATALOG` said of itself: *"Deliberately generous ranges relative to a 30x40 ft
test envelope — see backend/tests/test_solver.py for why headroom matters for reliably-feasible
test fixtures."* That is a sentence about making tests pass, not about houses.
[[project-status]] has flagged it as a known gap since 2026-08-30. This measures the cost and
closes it.

## Measured before, with `solver/bench_realism.py`

| mix | plot | envelope | status | fill | ceiling |
|---|---|---|---|---|---|
| 1BHK | 20×30 | 14×20 | **INFEASIBLE** | — | — |
| 2BHK | 25×40 | 19×30 | **INFEASIBLE** | — | — |
| 2BHK | 30×40 | 24×30 | OPTIMAL | 91% | 107% |
| 3BHK | 30×40 | 24×30 | **INFEASIBLE** | — | — |
| 2BHK | 40×60 | 34×50 | OPTIMAL | 45% | **45%** |
| 3BHK | 40×60 | 34×50 | FEASIBLE | 55% | 68% |
| 4BHK | 50×80 | 44×70 | FEASIBLE | 34% | 46% |

**Three of seven infeasible, and they are the three most common things India builds in this
band.** The old hall minimum alone was 11×12 ft — a foot wider than any code or builder asks
for. Four rooms at their minimums needed 300 sq ft on a plot that yields 280.

## What the code actually says

National Building Code of India 2016:

| | NBC 2016 | Old catalog min | New catalog min |
|---|---|---|---|
| Habitable room, single-room dwelling | 9.5 m² ≈ 102 sq ft | — | — |
| Habitable room, second onward | 7.5 m² ≈ 81 sq ft | — | — |
| Habitable room width | 2.4 m ≈ 7.9 ft | — | — |
| Clear height | 2.75 m ≈ 9 ft | `WALL_HEIGHT_FT = 9.0` ✓ | unchanged |
| Bedroom | — | 10×10 | 10×10 |
| Living / hall | — | **11×12** | **10×12** |
| Kitchen | — | **8×8** | **7×8** |
| Bathroom | 1.5 m² ≈ 16 sq ft | **5×7** | **4×6** |
| Entrance | — | 5×4 | 4×4 |

> [!warning] The 4 ft bathroom exposed a real bug, and it was not in the catalog
> At 4 ft wide, `test_every_room_gets_a_window_or_a_vent_where_it_can` failed — an unventilated
> wet room, exactly what [[realism-gaps]] added the wet rule to prevent. The obvious response is
> to widen the bathroom to 5 ft, and it works, and it is wrong: it also puts a 3BHK back out of
> reach on a 30×40.
>
> The actual cause was in `connectivity.derive_windows()`. It already distinguishes a habitable
> room's **window**, sized for light area, from a wet room's **vent** — narrower, higher sill,
> commented "a vent, not a view" — and then gated both on `WINDOW_MIN_WALL_IN = 60`, a *window's*
> wall minimum. A vent needs its 18 in opening plus a 9 in pier at each end: 36 in. `VENT_MIN_WALL_IN`
> now splits the two, and the bathroom goes back to 4 ft with its ventilation guaranteed.
>
> A constraint that forces a room to be bigger than it needs to be is a constraint worth reading
> twice.

`WALL_HEIGHT_FT = 9.0` landing within an inch of the NBC 2.75 m clear height was luck, not
design, but it holds — worth knowing before anyone "rounds it up".

> [!info] Rounded up anyway, on 2026-09-19 — and the warning was about the wrong risk
> The warning reads as "do not break the code floor". Ten feet does not break it; it clears it.
> The risk that mattered was the opposite one: **9.0 ft is the floor, and the tool was drawing
> every house at it.** Indian practice is 9–10 ft clear and 10–12 ft floor to floor
> ([houseyog](https://www.houseyog.com/blog/standard-ceiling-height-india/)), so every interior
> rendered as a legal-minimum room and read like one. `WALL_HEIGHT_FT` is now 10.0, floor to
> floor 10.55 — which also closes most of the gap to `compliance.FLOOR_TO_FLOOR_FT = 10.8`, a
> number the renderer had never matched.
>
> It cost the stairs. `STAIR_RISE_FT` 9.55 → 10.55 takes the riser count 16 → 17, and three of
> the six presets then fell under the 9.8 in going minimum. Checking them turned up that **two
> already had**: the L-shape at 9.75 in and the winder at 9.26 in, on the old rise. The
> footprints are resized so all six clear it. See [[stair-styles]].

## Measured after

| mix | plot | status | fill | ceiling | void |
|---|---|---|---|---|---|
| 1BHK | 20×30 | INFEASIBLE | — | — | — |
| 2BHK | 25×40 | INFEASIBLE | — | — | — |
| 2BHK | 30×40 | OPTIMAL | 92% | 111% | 5% |
| **3BHK** | **30×40** | **FEASIBLE** | **100%** | 166% | 0% |
| 2BHK | 40×60 | FEASIBLE | 45% | 47% | 4% |
| 3BHK | 40×60 | FEASIBLE | 58% | 70% | 3% |
| 4BHK | 50×80 | FEASIBLE | 38% | 48% | 11% |

Feasible 4/7 → 5/7. The 3BHK on a 30×40 — the headline failure — now solves at 100% envelope
fill. All 78 tests stay green.

The `void` column arrived later and is a separate finding: see [[compact-footprint]].

## The two that did not move are a different bug

Both remaining failures are **INFEASIBLE with every constraint switched off**, including zoning,
connectivity, daylight and the area objective. Raw rectangle packing cannot do it, so no
constraint is to blame — the envelope is simply too small, and the envelope is too small because
[[environment-notes|setbacks are hardcoded]] at 5 ft front and rear, 3 ft each side regardless of
plot size.

The arithmetic is one sentence: **two 10 ft bedrooms side by side need 20 ft, and a 25 ft plot
with 3 ft side setbacks leaves 19.**

Swapping in setbacks a small plot would really get:

| mix | plot | 3 ft sides (current) | 0 ft sides, 5 ft front, 3 ft rear |
|---|---|---|---|
| 1BHK | 20×30 | INFEASIBLE | **OPTIMAL, 95% fill** |
| 2BHK | 25×40 | INFEASIBLE | **OPTIMAL, 90% fill** |

So the next lever is plot-size-aware setbacks, not more catalog work. That needs real Telangana
bye-law numbers rather than invented ones — the same discipline this note applied to NBC.

## The other thing the benchmark exposed

`binds = CAT` fires on three scenarios now: fill has reached `catalog_fill_ceiling()`, meaning
the **catalog maximums** stop the house growing and more plot cannot help. A 2BHK on a 40×60
fills 47% and can never fill more. That is correct behaviour for a 2BHK on a large plot — nobody
builds a 900 sq ft bedroom — but it means "fill" must always be read against the ceiling, never
against 100%.

## Sources

- [NBC 2016 room-size standards, Sobha](https://www.sobha.com/blog/national-building-code-of-india-residential-apartments/)
- [Minimum room sizes for Indian homes, HouseYog](https://www.houseyog.com/blog/minimum-room-size-standards-india/)
- [NBC 2016 thumb rules — ceiling 2.75 m, room sizes, Infralens](https://infralens.in/thumbrules)


## The maximums were never tuned either — 2026-09-19

The minimums above were the fix; the maximums were left as they were, with a note that they
"matter for a different reason". They mattered more than that.

`bench_realism.py` measured a 2BHK filling **46%** of a 40×60 envelope and a 4BHK **33%** of a
50×80, both flagged `CAT` — every room had hit its cap, so more plot could not help. A 3BHK could
never exceed 1194 sq ft of rooms whatever it was drawn on. On the common 30×40 the plot binds and
rooms land near the NBC minimum, which is correct; above that the catalog bound and the tool drew
the same small house in a bigger footprint. That is the whole of the long-running "why does the
interior look cramped" complaint.

| | old max | new max | source |
|---|---|---|---|
| bedroom | 14×14 | **16×18** | comfortable master 12×14, large 14×16, villa 16×18–18×20 — [houseyog](https://www.houseyog.com/blog/master-bedroom-size-layout-india/) |
| hall | 15×16 | **18×20** | comfortable living 14×16, 20×20 large for a spacious independent house — [civilguide](https://civilguide.in/standard-room-size-for-house-in-india/) |
| dining | 12×12 | 14×16 | |
| kitchen | 11×10 | 12×14 | |
| bathroom | 7×8 | 8×10 | |
| store | 7×7 | 8×10 | |
| utility | 6×10 | 8×12 | |

Minimums untouched — they are the NBC floor and they are what makes a 3BHK fit a 30×40.

### Measured after

| mix | plot | fill before | fill after |
|---|---|---|---|
| 2BHK | 30×40 | 98% | **100%** |
| 3BHK | 30×40 | 100% | 98% |
| 2BHK | 40×60 | 46% `CAT` | **68%** |
| 3BHK | 40×60 | 69% `CAT` | **92%** |
| 4BHK | 50×80 | 33% | **46%** |

`catalog is the binder` went **2/5 → 0/5**. Void in footprint 18% → 11%, so the houses also read
more as one building. Worst aspect 2.02 → 1.79, inside the 1.8 cap for the first time.
Connectivity held, zone rules relaxed 0/5, 178 tests green.

### One test had to change, and it was measuring the wrong thing

`test_the_house_fills_most_of_what_the_catalog_allows` compared fill against the catalog ceiling.
That is only meaningful while the ceiling is below the envelope. With the new maximums the
ceiling for its mix is **105% of a 30×40** — and no layout can reach a ceiling larger than the
plot. The same solve that now fills **91% of the envelope, up from 65%**, scored 0.87 against it
and failed. It now measures against `min(ceiling, 1.0)`: a house cannot fill more than its plot.

The two INFEASIBLE rows in the benchmark are unchanged and are still the setback issue described
above — and note the benchmark uses its own hardcoded 5/5/3/3 setbacks, not the compliance-derived
ones the app ships, under which a 20×30 gets a 20×25.1 envelope and should solve.
