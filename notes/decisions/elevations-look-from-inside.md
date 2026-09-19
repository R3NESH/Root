---
tags: [decision, frontend, drawing]
status: current
date: 2026-09-19
---
# An interior elevation is drawn looking at the wall from inside the room, so left-to-right changes per wall

## Decision

`frontend/lib/elevations.ts` generates one elevation per wall per room, straight on and to scale,
with openings, furniture silhouettes, sill and head heights, and dimension strings. Each drawing
is oriented as if you stood inside the room and faced that wall.

That makes the along-wall axis **different for every wall**, and `alongWall()` is the one place
that encodes it:

| Wall | You face | Left → right runs |
|---|---|---|
| North | −Z | +X (east) |
| South | +Z | −X (west) |
| East | +X | +Z (south) |
| West | −X | −Z (north) |

The scene is +X east, +Z south, Y up — see `frontend/lib/sceneDoorways.ts`, which shares the
convention.

## Why it has to be this way

The alternative is to draw every wall left-to-right in world order, which is one line of code
less and wrong. Facing south, world +X is on your **left**. A south elevation drawn in world
order is mirrored, and a mirrored elevation is not a cosmetic bug: it is how a wardrobe gets
built hinged on the wrong side and a switch bank lands behind the door. The error survives every
check this repo has, because a mirrored drawing is still a valid drawing.

## Why elevations at all

A plan cannot answer a height. Counter height, sill height, the run of a wardrobe shutter, the
headroom over a hob, where a socket sits — all of it is decidable only in elevation, which is why
elevations are the interior designer's drawing rather than a nice extra. Chief Architect
generates plan, section and elevation off one model and treats that as the baseline for a
coordinated set.

## What the drawing shows, and what it admits

- Openings come from the solver's own `RoomOpening` list, so a door in the drawing is the door
  the plan has. `offset_in` runs from the room's minimum corner on that edge's axis.
- Furniture is drawn from the measured box — same source as
  [[schedule-is-measured-not-declared]]. Solid outline means against the wall, dashed means
  standing in front of it and blocking the view of it.
- Pieces further than 4 ft off the wall are left out. An elevation is a drawing of a wall, not of
  a room.
- A piece rotated to anything other than a quarter turn is drawn at its **unrotated** footprint,
  because the record is an axis-aligned box. Stated on the sheet rather than hidden.
- The scale is whatever fits the frame, and the title block prints the real px-per-foot rather
  than claiming a nominal 1:50 the sheet does not hold.

Export reuses `downloadBlueprintSvg`, `downloadBlueprintPng` and `printBlueprintSheet` from
`frontend/lib/blueprintExport.ts` — an elevation is a sheet like any other. The sheet is sized
1600×1050 because that is what the PNG rasteriser assumes.

**Links.** [[schedule-is-measured-not-declared]] · [[cite-the-clearance-or-admit-it]] ·
[[integer-inches]] · [[codebase-map]]
