---
tags: [architecture, schema, finding]
status: implemented
date: 2026-09-03
---
# Walls had no identity, and that was the thing blocking BIM

**Claim.** The question was "what would it take to build our own BIM?" The answer turned out not
to be IFC, or schedules, or drawing generation. It was that **walls were not in the model.**

## What was wrong

Rooms were rectangles. Walls were a rendering artifact: `Scene.tsx` walked each room's four edges
and drew a box per edge, deduplicating shared partitions with "skip if the neighbour's index is
lower". Two rooms sharing a partition each believed they owned a wall, and no wall had an id that
anything could point at.

That is backwards from how a building is described. A wall is a thing; a room is what walls
enclose.

The absence showed up every time something needed to name one. Wall paint bands had to invent the
key `bedroom_1__N` — "room instance plus edge" — because there was no wall to reference. That
hack was the schema asking for this module.

## What a wall is now

`backend/solver/walls.py`, derived post-solve beside `derive_openings()` and `derive_windows()`:

- **A maximal run along one room edge with the same neighbour.** Two rooms overlapping on an edge
  produce **one** shared wall listing both rooms. A run facing nothing is an exterior wall listing
  one. Same segmentation the renderer computes, so the two agree by construction.
- **Thickness from what is on the other side** — 9 in load-bearing unshared, 4.5 in (rounded to 5
  per [[integer-inches]]) shared. The convention already in `connectivity.py`.
- **The host of its openings.** `derive_openings()` mirrors a door onto both rooms, which is right
  for a renderer drawing rooms independently and wrong for anything counting. A wall hosts one
  door. Measured: 17 room-openings on a 2BHK collapse to 13 hosted — exactly the 4 interior doors
  that were double-counted.

Shipped on `/solve` as `walls[]`. An older client that ignores the field is unaffected.

## What it unlocked immediately

`backend/solver/quantities.py` — a bill of quantities counted off the wall objects. Carpet and
built-up area, wall run, gross and net face area, masonry volume, bricks, mortar, plaster, and a
door/window schedule. Surfaced in the export modal and carried in the exported JSON, which is the
file a contractor actually gets handed.

> [!important] Quantities only. No rates, no rupee totals.
> Material and labour rates move by district and by month, and a number invented here would be
> believed. The caller supplies rates. `test_quantities_carry_no_prices` enforces it.

### The brick number is derived, not quoted

Bricks come from brick-plus-joint, not a magic constant:

    bricks per m3 = 1 / ((L + joint)(W + joint)(H + joint))

For the IS 1077 modular brick, 190×90×90 at a 10 mm joint, that is 1 / (0.2 × 0.1 × 0.1) =
**exactly 500** — the figure BIS publishes. Reproducing the standard is what makes the default
trustworthy: the 9 in and 4.5 in walls this solver emits are *traditional* brickwork, so the
default spec is 230×110×70, which yields 434 per m³. Mortar is then what is left once the bricks
are in it — 23.1% for traditional brick, checked against the brick's own void fraction rather
than assumed.

Plaster thickness (12 mm internal, 15 mm external) is site convention, not code, and is named as
such at the top of the module so it can be argued with.

## Why not go further

[[price-ceiling]] settles it: the whole ticket is ₹3,000–5,000, which does not amortise a BIM.
A general BIM is a 10–100 person-year product. What a mason quoting a job needs is brick, mortar,
plaster and a door schedule — and all four fall out of walls having identity. IFC export via
IfcOpenShell is a few weeks on top of this and worth doing **only when someone asks**, which per
[[q-does-anyone-pay]] has not happened, because ₹500 has never been asked of anyone.

## Sample output

2BHK on a 30×40, from the live API:

| | |
|---|---|
| Carpet area | 654 sq ft |
| Built-up area | 763 sq ft |
| Wall run | 169 ft |
| Masonry, net of openings | 855 cu ft |
| Bricks | 10,504 |
| Mortar | 198 cu ft |
| Plaster | 2,637 sq ft |
| Schedule | 4 doors, 1 entrance, 7 windows |

## Also fixed on the way

The export button read *"Export Blueprint (PDF / DXF / JSON / PNG)"*. The modal has handlers for
JSON, SVG, PNG and print. **There was never a DXF exporter, and no PDF beyond print-to-PDF.** The
label now says what the buttons do. Real DXF is still worth building — it is the format Indian
draughtsmen open daily — but promising it in a tooltip is not the way.

## Sources

- [IS 1077 / bricks per cubic metre](https://grokipedia.com/page/Bricks_per_cubic_metre_in_India)
- [Standard brick size in India](https://civilplanets.com/brick-size-in-india/)
- [IfcOpenShell](https://ifcopenshell.org/), for the IFC step if it is ever wanted
