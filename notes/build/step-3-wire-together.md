---
tags: [build, step]
status: done
date: 2026-08-24
---
# Step 3 — Wire the halves together

**Work.** Debounced `POST /solve` (~400 ms after input settles). Extrude each returned room
rectangle into walls at a fixed height and render them in the existing Three.js scene — **not**
flat rectangles on the floor of the envelope box from [[step-1-threejs-shell]].

> [!important] This step is where Phase 1's actual deliverable lands
> Per [[project-phases]], Phase 1's output is a real 3D model of the house, not a 2D plan under
> a glass box. This is the step that turns CP-SAT's room rectangles into that model — extrude
> per room, not per envelope.

**Done when.** End-to-end on one plot, and the result is a walked-through-able 3D massing of
actual rooms — not a box with lines drawn on its floor.

The debounce is load-bearing, not a performance tweak — it is what keeps the box at 60fps while
the solve is discrete. See [[architecture]].

Populate `meta.solve_ms` from this step onward ([[output-schema]]). It is the number that decides
[[claim-most-likely-wrong]] one step later.

Expect rooms to jump on every edit here. That is the problem [[layout-stability]] exists to
solve, and seeing it plainly at this step is useful before fixing it.

> [!success] Done 2026-08-24
> `backend/api/main.py` (FastAPI, `POST /solve`, CORS scoped to the Next dev origin) +
> `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` (400ms debounce), and per-room extrusion
> in `Scene.tsx`. 9 API tests in `backend/tests/test_api.py`.
>
> **Phase 1's deliverable now exists**: the browser shows a real 3D model of colour-coded room
> volumes, not a flat plan under a ghost box. The envelope massing hides itself once rooms
> arrive — otherwise it just fogs them up.
>
> Verified end-to-end in a real browser: 5 rooms render, adding a bedroom re-solves to 6,
> changing facing recomputes the envelope (24×30 → 20×34 ft). **Exactly 3 solve calls for 3
> edits** — the debounce works. Zero console errors.
>
> Containment was checked numerically, not by eye: at facing E with 6 rooms, 0 containment
> violations and 0 overlaps. Worth recording because the screenshot *looks* like rooms overflow
> the dashed envelope — that is perspective from the 10 ft extrusion, not a bug.
>
> Two fixes made during the step:
> - Camera reframe moved to its own effect keyed on plot size alone. It had been in the geometry
>   rebuild, so every arriving solve (~every 400ms while editing) would have yanked the view out
>   from under anyone mid-orbit.
> - `useSolve` reset of the drift reference moved out of render and into the effect — React 19's
>   `react-hooks/refs` rule, same one hit in [[step-1-threejs-shell]].
>
> **Known duplication:** setback/envelope maths now exists in both `frontend/lib/plot.ts` and
> `backend/envelope/envelope.py`. Verified numerically identical for facing E. No shared code
> across the TS/Python boundary — keep them in sync by hand, or make the server authoritative
> for the dashed line too.

Prev: [[step-2-solver-core]] · Next: [[step-4-drift-objective]] · Plan: [[build-order]]
