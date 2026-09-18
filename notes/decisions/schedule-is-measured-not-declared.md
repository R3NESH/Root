---
tags: [decision, frontend, interiors]
status: current
date: 2026-09-19
---
# The FF&E schedule reports the size a piece was built at, not the size its catalog row claims

## Decision

`frontend/lib/designSchedule.ts` turns the model into the two tables an interior designer already
keeps by hand — an **FF&E schedule** (every piece of furniture, fixture and equipment, room by
room, with size, finish, count and where it came from) and a **finish schedule** (each room's
floor, wall paint, wall texture and door finish, with areas). Both export to one CSV and to a
printable sheet.

Sizes for the automatic fit-out are **measured off the built scene**, not read out of
`FURNITURE_CATALOG`.

## Why measured

Two reasons, both load-bearing.

1. **The fit-out resizes pieces to fit.** `fitDiningSet()` and `fitSize()` in
   `frontend/lib/interiorDetails.ts` shrink a dining set or a bathtub so a walkway survives —
   that is the whole point of [[furniture-clearances]]. A catalog size would schedule the piece
   the designer did *not* get.
2. **The fit-out places pieces the catalog does not stock.** `dining_table` is placed in every
   dining room and has no `FURNITURE_CATALOG` row at all. A catalog lookup blanks its size.

So `Scene.tsx` takes a `THREE.Box3` of each built-in group and hands the list up through
`onFurnitureInventory`. Pieces the *user* placed keep their catalog dimensions times their scale,
because that is exactly what was placed.

The box is the **whole group**, unlike the collision box a few lines above it, which is
deliberately clipped to the walking band so a chimney duct does not become an obstacle. A
schedule wants the overall size including overhangs: that is what has to fit through a door and
what a joiner is quoted against.

## Millimetres as well as feet-inches

Every size is printed both ways. Indian joinery and sanitaryware are specified in mm; the rest of
this product is feet-inches because [[integer-inches]] makes that the native unit. Rounding is to
the nearest 5 mm — finer than that is false precision on a number derived from a bounding box.

## What it deliberately does not do

- **Paint areas are gross.** Openings are not deducted. `backend/solver/quantities.py` nets them
  off the solver's own wall objects for the BOQ; a painter quotes gross anyway. Saying so on the
  sheet is cheaper than two numbers that disagree.
- **No prices, no vendors, no lead times.** A real FF&E schedule carries them. This one has no
  procurement data to carry, and inventing a column of blanks would make the sheet look answered.
- **No floor filter on placed pieces.** `PlacedCustomObject` stores world feet and no storey, so
  a piece is matched to the first room whose rectangle contains it — the ground floor. That is
  also the only storey the 3D view lets you drop one on.

## The coupling this exposed

`designSchedule.ts` is pure arithmetic over data, but it imports `FURNITURE_CATALOG` from
`frontend/lib/furnitureCatalog.ts`, which imports `three` and builds meshes. So the schedule
cannot be exercised in Node without stubbing `three`. The data tables and the mesh factory being
one module is the reason. Not fixed — noted.

**Links.** [[furniture-clearances]] · [[integer-inches]] · [[three-pickers]] · [[codebase-map]] ·
[[project-status]]
