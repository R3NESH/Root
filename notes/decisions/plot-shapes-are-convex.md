---
tags: [decision, solver, geometry]
status: current
date: 2026-09-18
---
# A plot may be any convex shape, curved included — and nothing else

## Decision

The plot outline is editable: corners can be dragged, added and removed, each edge can be bowed,
and the result is what the solver packs. The outline may be **convex only**. A plot that caves
inward — an L, a dent, the inside of a cul-de-sac — is refused, and the refusal is shown.

## Why convex, and why that is not a shortcut

`backend/envelope/polygon.py` represents the buildable area as one half-plane per edge:

```
a·x + b·y <= c
```

For an axis-aligned room the largest value of `a·x + b·y` sits on a corner picked out by the
signs of `a` and `b`, and those signs are constants at model build time. So "this room is inside
the plot" is **one linear constraint per room per edge**, over integers, which is what CP-SAT is
good at. No polygon intersection at solve time, no new solver machinery, and [[integer-inches]]
survives intact.

The intersection of half-planes is convex. That is a definition, not a limitation of the code.
Supporting a concave plot means one of:

- convex decomposition of the plot, plus an indicator per room per piece and a "room lies wholly
  in one piece" disjunction; or
- a big-M encoding of the same disjunction.

Both change the CP-SAT model itself, add a rung to the relaxation ladder, and need their own
benchmarks. Neither was built. See [[realism-gaps]] for the shape of that argument elsewhere.

## Curves are chords, and the ceiling is integer inches, not the vertex cap

A curved edge reaches the solver as straight chords. Two things bound how many.

**`MAX_VERTICES`**, raised from 12 to 32 on 2026-09-18. Measured first: on a 40×50 plot with a
6 ft bow in the road edge, cold solve time did not move at all between a 4-edge rectangle and a
26-edge bow — every run returned FEASIBLE at ~2040 ms, because the 2 s budget in `solver/model.py`
is the binding constraint either way. Edge count is free at this scale.

> [!warning] That measurement is also a finding about the budget
> A **five**-room mix on a 40×50 plot never closed to OPTIMAL. [[project-status]] recorded this
> as a twelve-room problem. It is worse than recorded.

**Integer inches**, which is the tighter bound and the surprising one. Sampling a curve and
rounding each point to the nearest inch *reverses the turn* between short chords, so `is_convex()`
rejects the whole outline. Measured on a 30×40 plot:

| bow depth | chords before convexity breaks |
|---|---|
| 6 ft | 22 |
| 12 ft | 48 |

The fix is in the producer, not the checker: `frontend/lib/plot.ts` runs the rounded points
through a **convex hull**. The hull of rounded points is convex by construction and sits within
the rounding error of the curve it came from. It also collapses the near-collinear points a fine
tessellation produces, so 64 chords come out as 24 corners — the cap ends up binding on real
corners, not on how smoothly someone may draw.

The hull is applied **only** when the un-bowed outline was already convex and every bow points
outward. Hulling unconditionally would erase a dent the user drew on purpose and hand their plot
back with its shape quietly changed — the defect in [[client-side-fallback]] wearing a different
hat.

## The refusal is shown, not swallowed

`buildable_polygon()` returns `None` for an outline it will not take, and the API then falls back
to the plot's bounding rectangle. Silently. A user would see rooms packed into a shape they did
not draw and no indication why.

`plotShapeProblem()` in `frontend/lib/plot.ts` is the counterpart: it says which of the three
reasons applies — too few corners, past the cap, or concave — and the 2D view shows it as a
banner that does not time out, because the condition does not go away on its own.

## Typed entry walks the boundary; it does not ask for coordinates

The first typed-entry attempt was a table of each corner's X and Y. It was wrong twice.

**Nobody describes a plot that way.** The two conventions that exist in the world both describe
*edges*. A surveyor's deed is metes and bounds — one call per edge, a bearing and a distance,
walked round the parcel — and every deed-plotting tool reads and writes exactly that table
([Deed Reader Pro](https://www.deedreaderpro.com/), [MeteMap](https://metemap.com/),
[Sandy Knoll](https://www.tabberer.com/sandyknoll/more/metesandbounds/metes.html)). An Indian plot
owner with a tape measures the four sides and one diagonal, and takes the area from Heron's
formula on the two triangles
([EverydayCalculation](https://everydaycalculation.com/land-area.php)).

**A coordinate cannot be edited on its own.** Changing one corner's X leaves every other corner
where it was, so the outline passes through degenerate shapes on the way to the intended one —
and because each keystroke committed, re-normalised the outline and resized the plot, the table
fought the user mid-edit. A side length has no such coupling: change one and you have a different
plot, always a valid one.

So `frontend/lib/plotTraverse.ts` holds a plot as a **traverse** — a list of sides, each with a
length, the turn taken at the corner after it, and its bow. Bearings are replaced by turns
because "turn right 90°" needs no compass training, and each side's compass face is derived from
the winding and shown rather than typed.

Three consequences worth writing down:

- **Turns are floats.** Lengths are integer inches per [[integer-inches]] because a length is
  measured. A turn is derived, and rounding the tapered preset's lean to the nearest degree left
  a 5 in gap in a shape that is supposed to close exactly.
- **A traverse that does not close is shown, not fixed.** The gap is drawn dashed and stated in
  feet. Silently moving the last corner to meet the first would hand back a plot with a side
  length nobody asked for — the same dishonesty as [[client-side-fallback]].
- **Except after a structural edit.** Removing a side removes a vector, so the walk *cannot*
  still close and the open polyline it leaves can cross itself. Asking for one fewer side is
  asking for the shape to change, so that case closes automatically.

## What this does not do

- **No concave plots.** Stated above. The commonest real casualty is a plot on the inside of a
  bend.
- **No inward bow.** Same reason; it is drawable, refused, and explained.
- **The setback on a curved edge is approximate.** `_edge_setback_in()` reads the edge's outward
  normal and applies whichever cardinal setback it faces most squarely. A real bye-law reads the
  road each edge abuts. Same order of approximation as the hardcoded setbacks — [[environment-notes]].
- **The offline fallback ignores the outline entirely.** `solveClientSide()` packs an axis-aligned
  grid and always did; it reports `OFFLINE_ESTIMATE` and claims nothing — [[client-side-fallback]].

**Links.** [[integer-inches]] · [[realism-gaps]] · [[client-side-fallback]] · [[environment-notes]]
· [[curves-are-a-face-not-a-plan]] · [[preferences-are-scored]]
