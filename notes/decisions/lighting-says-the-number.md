---
tags: [decision, frontend, interiors, standards, lighting]
status: current
date: 2026-09-19
---
# The ceiling plan estimates the lux and says whether it clears the standard

## Decision

`frontend/lib/ceilingPlan.ts` draws a reflected ceiling plan — fixtures, a legend, a fixture
schedule — and does one thing beyond that: for every room it estimates the average illuminance
by the lumen method and compares it against the published target for that room kind.

It also **proposes** a general-lighting downlight grid, drawn dashed, at ceiling height ÷ 2
capped at 6 ft. Existing fixtures are solid; proposed ones are dashed everywhere they appear,
including in the schedule.

## Why the number, not just the symbols

Every competitor lets you place light symbols on a plan. None of the ones searched tells you the
kitchen lands at 226 lux when IS 3646 wants 300. Placing symbols is drafting; saying the room is
under-lit is design review, and it is the same move that makes the
[[cite-the-clearance-or-admit-it|clearance audit]] worth having.

That is the whole differentiator. It cost about eighty lines.

## The arithmetic, and what is assumed

```
E = (N × lumens × UF × MF) / area_m²
```

- **UF = 0.5**, **MF = 0.8**. Both assumptions, both printed on the sheet and in the CSV.
  Utilisation runs 0.4-0.8 with room proportion and reflectance; maintenance 0.6-0.8 with
  cleaning and lamp age. Midpoints, because this is sizing, not photometry.
- **Lamp output is assumed per fixture kind** — 800 lm a downlight, 1500 a flush fixture, 1800 a
  chandelier. The furniture catalog carries sizes, not photometric files, and this product will
  not pretend otherwise. The sheet says "an estimate, not a photometric calculation".
- **A fan counts zero lumens.** It is drawn, because it is on the ceiling and the contractor
  needs it, and it contributes nothing, because it is not a light.

## Cite or admit, again

`LUX_TARGETS` holds only the room kinds a searched source actually gives a figure for — hall
100-200, kitchen 300-500, bedroom 100-150, bathroom 300-500. A store, a dining room or an
entrance is drawn, scheduled, and reported as **"not assessed — no published figure found"**.
Same rule as the clearance audit: an invented authority is worse than an admitted gap.

## Reflected means reflected

The plan is drawn with +X still to the right and +Z still down — identical orientation to the
floor plan, as though read in a mirror lying on the floor. Drawn as seen looking up it would
mirror, which is the same failure mode as [[elevations-look-from-inside]] and has the same
consequence: fittings set out on the wrong side of the room.

## Sources

- Downlight spacing, ceiling height ÷ 2 capped near 6 ft —
  [Eaton spacing guide](https://www.eaton.com/br/en-us/company/news-insights/lighting-resource/homes/spacing-guide-for-recessed-led-lighting0.html)
- Lumen method — [DIALux knowledge base](https://dialux4.support-en.dial.de/support/solutions/articles/9000078303-lumen-method-)
- IS 3646-1 (1992), Code of practice for interior illumination —
  [full text](https://law.resource.org/pub/in/bis/S05/is.3646.1.1992.pdf)
- RCP symbol conventions, and that a legend is always drawn because conventions vary by office —
  [EdrawMax](https://www.edrawsoft.com/reflectedceiling-plan-symbols.html)

## What it needed from the renderer

`Scene.tsx` now tags the flush fixture every room already had and the ceiling fan in halls and
bedrooms with `isCeilingFixture`, deliberately **not** `isFurniture` — that flag drives selection
and collision, and neither applies to a disc of light 9 ft up. They ride into the same
`onFurnitureInventory` list with `ceiling: true`.

That exposed a live bug: the clearance audit measured gaps to anything in its box list, so a
**placed chandelier was already generating fake floor-clearance failures**. Fixed with
`FLOOR_OBSTACLE_MAX_Y_FT = 4.0` — nothing you cannot walk into is a passage.

**Links.** [[cite-the-clearance-or-admit-it]] · [[elevations-look-from-inside]] ·
[[board-is-drawn-to-one-scale]] · [[schedule-is-measured-not-declared]] · [[codebase-map]]
