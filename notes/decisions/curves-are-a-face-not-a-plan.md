---
tags: [decision]
status: locked
date: 2026-09-06
---
# Curves are a wall face, plots are convex polygons

Two separate answers to "not every wall is a rectangle", decided together because they get
confused with each other.

## What the solver packs is still rectangles

CP-SAT places rooms with `add_no_overlap_2d` over integer intervals — see
`backend/solver/model.py` and [[integer-inches]]. There is no arc primitive to give it. Every
downstream rule reads a room as one rectangle: adjacency and separation in `connectivity.py`,
daylight against the built footprint, the Vaastu quadrant test, `derive_walls`, the take-off.

So a curve is **a property of a wall face**, not of the plan. A room keeps the rectangle the
solver packed; the face of one of its walls bows out from the straight run by a bulge in inches.
Area, adjacency, quadrant and connectivity are all untouched, because none of them changed.

The bow is a quadratic Bézier, not a circular arc (`frontend/lib/wallCurves.ts`). At the bulges a
wall can take, capped at 30% of the run and 4 ft, the two are within a fraction of an inch, and
the Bézier needs no radius, no centre and no major/minor arc case. The same sampled polyline
feeds the 3D chords, the walkthrough collision and the bill of quantities, so what is drawn is
what is measured.

**A curved run carries no door or window.** Joinery on a curve is a problem this does not solve,
and quietly straightening a wall to fit a door in would be a lie told at draw time. The control
refuses the curve instead, and says why.

## What the plot is, is a convex polygon

The bigger lie was never the rooms — it was the plot. A corner plot is splayed where its two
roads meet; a plot on a bend is a trapezoid; a subdivision leaves whatever closed the layout.
`plot_w_in x plot_d_in` could not say any of that.

`backend/envelope/polygon.py` takes a convex outline and returns one **half-plane per plot edge**,
already inset by the setback:

    a·x + b·y <= c

For an axis-aligned rectangle the largest value of `a·x + b·y` sits on the corner picked out by
the signs of `a` and `b`, and those signs are constants at model build time. So "this room is
inside the plot" is one linear constraint per room per plot edge, over integers — which is
exactly what CP-SAT is good at. No new solver machinery, no polygon intersection at solve time,
integer inches intact.

### Why convex only

The half-plane intersection of a concave outline is its convex hull, which would quietly hand
back *more* ground than the plot has. A concave outline is rejected and the caller falls back to
the rectangle, which is always present and always means something. An L-shaped plot is therefore
still unrepresentable — the honest position until the solver can decompose a room into several
rectangles.

### Known approximations

- The setback for a splayed edge is chosen from whichever cardinal its outward normal faces more
  squarely. A real bye-law reads the road each edge abuts. Same order of approximation as the
  hardcoded setbacks in [[environment-notes]].
- Vaastu quadrants are still computed on the envelope's bounding box, not the polygon.
- The inset rounds *up*, so the buildable area errs on the legal side.
- The offline fallback in `frontend/lib/solve.ts` has no half-planes. On a splayed plot it packs
  the largest rectangle that misses every splay — smaller than the real answer, never larger. It
  does not claim ground the solver would have refused.

Related: [[input-is-plot-dimensions]], [[q-telangana-parcel-geometry]], [[rejected-approaches]].
