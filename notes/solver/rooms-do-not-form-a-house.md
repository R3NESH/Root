---
tags: [solver, finding, blocking]
status: measured
date: 2026-08-24
---
# The solver does not produce a house — it produces a rectangle packing

**Found by trying to add a walkthrough.** Asking "can a customer walk through this?" exposed a
defect that every prior test missed, because every prior test asked only "do rooms overlap or
escape the envelope?" — and the answer to that was correctly "no".

## The measurement

24 random room mixes across four plot sizes, Vaastu on, requiring a **32 in (2'8") clear door**
to count two rooms as connected:

| Metric | Result |
|---|---|
| Layouts where some room is **unreachable** | **12 of 19 — 63%** |
| Mean share of the buildable envelope left **empty** | **60%** |
| Worst case | **1 of 6 rooms reachable** |

A concrete failure: `['hall','bedroom','pooja','pooja','bathroom']` → 1 of 5 rooms reachable,
79% of the envelope void.

Even a layout that *is* connected can be connected by nothing usable. In one 6-room solve the
kitchen and pooja shared exactly **2 inches** of wall — a shared edge, but not a doorway.

## Why

[[cp-sat-api]] applies exactly two families of constraint: `add_no_overlap_2d`, and the Vaastu
quadrant half-planes from [[vaastu-as-constraints]]. **Nothing requires rooms to touch, to tile
the envelope, or to be mutually reachable.** Non-overlap is satisfied perfectly by scattering
rectangles with voids between them, and that is what the solver does — correctly, per its
constraints.

### The specific culprit is Vaastu, and that is measured

Same 24 mixes, same door width, only the Vaastu flag changed:

| Configuration | Rooms all reachable |
|---|---|
| Vaastu **off** | **16 of 19 — 84%** |
| Vaastu **on** | **7 of 19 — 37%** |

The quadrant half-planes pin kitchen to the south-east and master bedroom to the south-west —
**opposite corners** — so the solver satisfies them by pushing rooms outward and hollowing out
the middle. Vaastu compliance and walkability are in direct tension under the current encoding.

This cannot be fixed by dropping Vaastu: it is the market's hard requirement. The encoding has
to change instead.

### A fill constraint alone does NOT fix it

Tested `add_multiplication_equality` on `w × d` with `sum(areas) >= fill × envelope`:

| Fill target | Connected | Worst solve |
|---|---|---|
| none | 84% | 61 ms |
| ≥85% (capped to what the room set can reach) | 81% | 84 ms |
| ≥92% (capped) | 81% | 182 ms |

Filling area does not imply connecting rooms — rectangles can tile diagonally and still leave
door-less contacts. **Area is the wrong invariant; reachability is the right one.**

Useful side results: area products via `add_multiplication_equality` are cheap (90% fill in
77–117 ms, inside the 400 ms interactive cap), and the fill target **must be clamped** to
`sum(max_w × max_d)` or small room sets go infeasible — a 4-room mix can only reach 82%.

[[step-2-solver-core]]'s done-condition ("rooms never overlap and never exit the envelope,
across 20 random room mixes") is met in full. It was simply never a sufficient definition of a
house.

## Why this was invisible until now

The render draws each room as a filled translucent box floating over the plot. Voids between
rooms read as deliberate spacing, not as missing house. From a bird's-eye view at 40 ft it
looks plausible. **First-person is what makes it undeniable** — you would walk out of a bedroom
into nothing.

This is a good argument for the walkthrough as a *correctness* tool, not only a sales one.

## Consequences

- [[layout-stability]] is unaffected — drift still works, it just stabilises a packing.
- The [[test-baseline]] is not wrong, but it is **incomplete**: 23 passing tests and none of
  them assert the output is a connected, mostly-filled dwelling. New invariants needed:
  every room reachable from the entrance through an opening ≥ door width; envelope fill above
  some threshold.
- **This project's own solver produces 60%-void layouts.** Fix that before anything else.
- [[claim-most-likely-wrong]] stands: stability was measured and held. But stability of a
  layout that isn't a house is worth less than it looked.

Measured with the live solver, 2026-08-24, during [[step-6-walkthrough]].
