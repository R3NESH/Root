---
tags: [solver, finding, blocking, regression]
status: measured
date: 2026-08-25
---
# Vaastu and connectivity are silently dropped on every edit after the first

**Claim.** The two constraint families this product is built on — Vaastu quadrants
([[vaastu-as-constraints]]) and hall-centric connectivity ([[rooms-do-not-form-a-house]]) — are
enforced **only on the very first solve of a session**. Every subsequent solve runs without
them, and the 25-test suite stays green throughout.

## The mechanism

`backend/solver/model.py` (introduced by commit `2e56f54`, "allow free placement of dragged
rooms without Vaastu quadrant lock"):

```python
effective_vaastu  = apply_vaastu  if not prev else False
effective_connect = connect_rooms if not prev else False
```

The intent was narrow — let a *dragged* room escape its quadrant. But `prev` does not mean
"a drag happened". `frontend/lib/useSolve.ts` writes every returned room into
`savedPositionsRef` after **every** response, and sends the whole map as `prev` on the next
request. So `prev` is non-empty from the second solve onward, for *any* input change: plot
size, facing, room counts, custom dimensions, a drag, anything.

Result: `prev` is a proxy for "not the first solve", and it switches off both differentiators.

## Evidence

Live solver, mix `hall, kitchen, bedroom, bedroom, bathroom, pooja`, `apply_vaastu=True`
throughout, simulating what the client actually sends:

| Solve | `vaastu_constraints_applied` | Rooms reachable |
|---|---|---|
| first (no `prev`) | kitchen SE, master bedroom SW, pooja NE | **6 / 6** |
| after one edit (`prev` sent) | **`[]`** | **2 / 6** |
| after a drag | **`[]`** | **2 / 6** |

The kitchen was then placed at `(0, 0)` — the **north-west** corner, the exact placement
[[vaastu-as-constraints]] exists to forbid, on a plan the UI still presents as Vaastu-compliant.

Reachability collapsing 6/6 → 2/6 is the [[rooms-do-not-form-a-house]] defect returning in
full: four of six rooms have no door to anywhere. The star-topology fix that took reachability
from 37% to 100% is off for the entire rest of the session.

## Why the test suite does not catch it

A blind spot, not a gap in rigour — the two test files divide the space so that neither sees it:

- `tests/test_vaastu.py` never passes `prev` (0 occurrences). It only ever tests first solves.
- `tests/test_stability.py:80` *does* combine `prev` with `apply_vaastu=True`, but asserts only
  `status` and `solve_ms` — never that the Vaastu rule still holds or that rooms stay reachable.

So the one test that exercises the broken path checks the two properties that still work.
This is exactly the shape [[test-baseline]] warns about: "still fast" reading as "still working".

## Consequence

- **This outranks every open engineering candidate.** [[vaastu-is-mandatory-demand]] puts Vaastu
  at 73–82% of buyers; the product currently honours it for one solve and then quietly stops.
- The fallback chain is broken in the same edit: step 2 (`retry without Vaastu`) is guarded by
  `if ... and effective_vaastu`, which is already `False` whenever `prev` is set — so an
  interactive solve that fails has no Vaastu retry to fall back to.
- The fix is to distinguish *"this specific room was dragged"* from *"we have previous
  positions"*. Only the dragged room needs its quadrant released; the rest of the model should
  keep both constraint families. The client already knows which room moved — `moveRoom()` has
  `roomIndex` — and does not send it.
- New invariants needed in [[test-baseline]]: with `prev` set and `apply_vaastu=True`, the
  Vaastu rules must still hold and every room must still be reachable.

**Links.** [[rooms-do-not-form-a-house]] · [[vaastu-as-constraints]] · [[layout-stability]] ·
[[test-baseline]] · [[project-status]] · [[step-6-walkthrough]]

Measured with the live solver, 2026-08-25, during the [[project-status|project review]].
