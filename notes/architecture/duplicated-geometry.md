---
tags: [architecture, finding]
status: measured
date: 2026-08-25
---
# The renderer ignores the solver's geometry and recomputes its own

**Claim.** `POST /solve` returns `openings`, `wall_thickness_in`, `entrance_edge` and
`rooms_reachable`. **The frontend consumes none of them.** It re-derives door and wall geometry
client-side from the room rectangles alone, with its own constants.

## Evidence

Searching the whole frontend for those four fields returns exactly two hits, both of them the
*type declaration* in `frontend/lib/solve.ts` — and zero uses:

```
frontend/lib/solve.ts:24:  wall_thickness_in: number | null;
frontend/lib/solve.ts:25:  openings: {
```

`components/Scene.tsx` instead carries its own copy of the door logic —
`getSharedOverlapBetween()` at line 876, mirroring `derive_openings()` in
`backend/solver/connectivity.py` — and its own constants at lines 56–59.

## The three duplications, and where they disagree

| Quantity | Backend | Frontend | Agrees? |
|---|---|---|---|
| Setback maths | `envelope/envelope.py` | `lib/plot.ts` | yes — verified numerically, nothing enforces it |
| Door width | `DOOR_MIN_IN = 32` | `DOOR_WIDTH_FT = 32/12` | yes, by coincidence of hand-copying |
| Interior wall | `INTERIOR_WALL_IN = 5` | `WALL_THICK_INT_FT = 4.5/12` | **no — 5 in vs 4.5 in** |

The wall thickness disagreement is live today. [[integer-inches]] rounds 4.5 up to 5 precisely
so the solver stays integral; the renderer draws the un-rounded 4.5. Every wall in the 3D model
is half an inch thinner than the one the solver reserved space for.

## Why this matters more than half an inch

[[HANDOFF]] §10 introduced `openings` and `wall_thickness_in` as v1 placeholders so that v2
"does not require a migration". They were then *implemented* on the backend during
[[rooms-do-not-form-a-house]] — and the migration still has not happened, because the client
never switched over to them.

Concretely:

- **The entrance is invisible.** `add_entrance()` picks a front door N→E→W→S per Vaastu and
  reports it as `entrance_edge`. The renderer never reads it, so the entrance the solver
  chose is not the door the customer walks through in [[step-6-walkthrough]].
- **Two sources of truth for the same house.** The backend's `reachable_count()` can report
  6/6 while the renderer, using a slightly different overlap test
  (`>= DOOR_WIDTH_FT - 0.2`), draws a different set of doors.
- **[[step-5-vaastu]]'s one recorded gap is already closed on the backend** and still open in
  the product, which is not what the vault currently says.

## Consequence

- The cheapest correct fix is subtraction, not addition: have `Scene.tsx` render the
  `openings` array it is already being sent, and delete `getSharedOverlapBetween()`.
- Until then, do not treat `entrance_edge` or `rooms_reachable` as describing what the user
  sees. They describe the solver's model of the house only.
- Reconcile `WALL_THICK_INT_FT` to 5 in, or reconcile [[integer-inches]] — not both.

**Links.** [[architecture]] · [[output-schema]] · [[integer-inches]] ·
[[rooms-do-not-form-a-house]] · [[step-6-walkthrough]] · [[project-status]]
