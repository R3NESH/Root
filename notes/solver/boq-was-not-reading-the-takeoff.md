---
tags: [finding, solver]
status: fixed
date: 2026-09-20
---
# The BOQ was not reading the take-off, and the price was wrong

**Claim.** `backend/solver/quantities.py` measures this building properly — off `walls.py`, where a
shared partition is **one** wall and the openings are the ones actually cut. The API ships that
take-off on every `/solve`. The cost estimate the user reads never touched it. It re-derived every
figure from room rectangles in `frontend/lib/boqEngine.ts`, which counts each shared partition
twice.

Found by the ponytail audit on 2026-09-20 — the same defect class as [[duplicated-geometry]] and
[[three-pickers]]: a thing is built properly, a second copy is built beside it, and the good one is
left wired to nothing.

## Evidence

The take-off reached exactly one place: a JSON dump in `BlueprintExportModal.tsx`.
`blueprintExport.ts` never read it. `BOQCostModal.tsx` did not take the prop at all.

```ts
// lib/boqEngine.ts, before
totalWallLengthFt += 2 * (rw + rd);          // per room — every partition counted twice
builtUpAreaSqFt = carpetAreaSqFt * 1.15;     // a flat 15%, not the wall footprint
brickCount = netWallAreaSqFt * 3.4;          // a per-sq.ft rule of thumb
doorCount = Math.max(3, rooms.length + 1);   // guessed from the room count
```

Measured against a real `/solve` — 7 rooms (hall, kitchen, dining, 2 bedroom, 2 bathroom) on a
30×40 north-facing plot, through `TestClient(app)`:

| | measured by the solver | re-derived by the client | error |
|---|---|---|---|
| wall run | **203.2 ft** | 274.3 ft | **+35%** |
| gross wall area | 1,951.7 sq ft | 2,743 sq ft | +41% |
| opening deduction | 226.3 sq ft (7 doors, 10 windows, as cut) | 328 sq ft (8 and 10, guessed) | +45% |
| bricks | **14,083** | 8,211 | **−42%** |
| built-up area | 825 sq ft | 802 sq ft | −3% |
| carpet area | 697 sq ft | 697 sq ft | 0 |

**Both directions at once.** The wall run was 35% too long, and the brick count still came out 42%
too low, because the `3.4 bricks per sq ft` rule of thumb is wrong by more than the wall length was.
The two errors do not cancel; they are independent. Carpet area agreeing is the control: it is the
one figure both paths computed the same way.

Total cost landed within 0.6% by coincidence — the over-counted concrete and plaster offset the
under-counted brick. **A right answer from two wrong numbers is not a right answer**, and the
material schedule a mason would actually order from was wrong line by line.

## What changed

`calculateBoq()` takes the take-off and costs the measured figures: `wall_run_ft`,
`wall_gross_area_sqft`, `opening_area_sqft`, `built_up_area_sqft`, `brick_count`,
`plaster_area_sqft`, and the real opening tally for the door and window line items. The front door
is reported as `kind: "entrance"`, not `"door"`, so it is counted in explicitly — the internal-door
line prices `doorCount - 1`.

The estimate path is kept, because an older backend and the offline fallback ship no `quantities`
at all. It now reports `source: "estimated"`, and the modal, the CSV and the printed sheet all say
so — the [[client-side-fallback]] rule: a fallback never claims a measurement it did not make.

The curve allowance survives in both paths. The solver never saw a bowed face, so its take-off
cannot have counted those bricks; `extraWallLengthFt` is still added on top —
[[curves-are-a-face-not-a-plan]].

**Consequence.** [[walls-as-objects]] said the double count was fixed. It was fixed in the
*geometry* and never in the *price*. That note and [[codebase-map]] are updated. Worth asking of
every other backend output: does anything read it?

**Links.** [[walls-as-objects]] · [[duplicated-geometry]] · [[three-pickers]] ·
[[client-side-fallback]] · [[codebase-map]] · [[2026-09-20]]
