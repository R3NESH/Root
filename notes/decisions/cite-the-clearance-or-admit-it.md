---
tags: [decision, frontend, interiors, standards]
status: current
date: 2026-09-19
---
# Every clearance rule either cites a published authority or says it has none

## Decision

`frontend/lib/clearances.ts` measures every gap in the plan — piece to piece, piece to wall, and
the clear floor inside each door — and reports the ones below the figure the trade works to.

Each rule carries an `authority` and a `source`. There are exactly two kinds:

| Rule | Minimum | Authority | Source |
|---|---|---|---|
| Kitchen work aisle | 42 in | NKBA | [Kitchen Planning Guidelines](https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf) |
| Walkway | 36 in | NKBA | same |
| Seating pull-out with traffic behind | 36 in | NKBA | same |
| Bedside passage | 24 in | Trade practice | **none** |
| Clear floor at a door | 36 in | Trade practice | **none** |

The UI prints the authority on every finding and links the source. Where there is no source it
says so in the row: *"Trade practice — no published source, low confidence."*

## Why the labelling is the feature

An interior designer knows the NKBA numbers. Quoting 42 in for a work aisle is checkable and
earns trust in a second. Quoting 24 in for a bedside gap as though a standards body published it
is checkable too, and loses the same trust just as fast.

The repo already respects clearances — `fitDiningSet()` and `fitSize()` in
`frontend/lib/interiorDetails.ts` exist for exactly that, see [[furniture-clearances]]. But a
silent fix is worth nothing in review: a plan that was checked and a plan that got lucky look
identical. This states the measurement.

NKBA's own figures are a range, not one number, and the rule notes carry the range: 42 in for one
cook and 48 in for two; 32 in from a table edge with no traffic, 36 in where traffic passes,
44 in to walk behind a seated diner. The audit applies the middle figure and prints the rest.

## What it measures, and what it refuses to claim

- A gap counts only where the two things **face** each other by at least a foot. Two pieces
  cornerwise across a room do not form a passage.
- A piece within 0.4 ft of a wall is *against* the wall, not forming a passage with it. Without
  this every sofa reports a failing 2 in gap behind itself.
- `gapsMeasured` is on the report. **A room with nothing in it is listed as unchecked, not passed** —
  a clean audit over zero measurements would be a lie, and it is the single easiest way for a
  compliance feature to become theatre.
- Findings are `fail` below the minimum and `tight` within 3 in over it.

## The limit worth knowing

Everything is measured between axis-aligned bounding boxes. A round table is audited as its
square. That is conservative for the table and wrong for the corners, and it is the same
simplification the collision engine in `Scene.tsx` already makes.

**Links.** [[furniture-clearances]] · [[schedule-is-measured-not-declared]] ·
[[elevations-look-from-inside]] · [[codebase-map]]
