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

Both remaining failures are **INFEASIBLE with every constraint switched off**, including Vaastu,
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
