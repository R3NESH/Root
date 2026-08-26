---
tags: [build]
status: built-unplanned
date: 2026-08-25
---
# Step 6 — first-person walkthrough (unplanned)

> [!warning] This step was never in [[build-order]]
> [[build-order]] is a five-step plan and it finished on 2026-08-24. Everything here was built
> *after* that, in the same session, without a written done-condition. This note exists partly
> to resolve the dangling `[[step-6-walkthrough]]` link that [[rooms-do-not-form-a-house]] was
> already pointing at, and partly because ~2,600 lines of product shipped with no plan note
> behind them.

## What was built

| Piece | Where | Notes |
|---|---|---|
| First-person walkthrough | `Scene.tsx`, `lib/walkthrough.ts` | 5'5" eye level, walk/sprint/crouch/jump, head bob, collision |
| Walkthrough HUD | `components/WalkthroughOverlay.tsx` | key hints, current room, eye level, lights toggle |
| Minimap | `components/Minimap.tsx` | plan view with player position; click to teleport |
| Room customizer | `components/RoomCustomizer.tsx` | per-room custom dimensions in feet |
| Drag-and-drop rooms | `Scene.tsx` + `useSolve.moveRoom()` | optimistic local move, then re-solve |
| Procedural interiors | `lib/interiorDetails.ts` (759 lines) | canvas PBR floor textures, furniture, ceiling fans, windows with curtains, door-aware furniture placement |
| Stable instance IDs | `lib/useSolve.ts` | `roomId → position` map so adding a room does not reshuffle the others |

## What it bought

The walkthrough paid for itself immediately as a **correctness instrument**, not a sales demo:
it is what exposed [[rooms-do-not-form-a-house]]. A 60%-void layout looks like deliberate
spacing from a bird's-eye view and is undeniable the moment you walk out of a bedroom into
nothing. That finding is the most valuable thing this unplanned step produced.

## What it cost

Two regressions, both invisible to the green test suite, both traceable to this step:

1. [[vaastu-and-connectivity-drop-on-edit]] — drag-and-drop needed rooms to escape their Vaastu
   quadrant, and the implementation switched off **both** Vaastu and connectivity for every
   solve that carries `prev`, which is every solve after the first. **Blocking.**
2. [[duplicated-geometry]] — the renderer grew its own door/wall geometry rather than consuming
   the `openings` the backend already computes, adding a third frontend/backend duplication and
   one live disagreement (4.5 in vs 5 in interior walls).

## The tension with a locked decision

[[zero-keyboard-events]] locks: a user reaches their first plan without typing. The walkthrough
is **keyboard-and-mouse only** — WASD, Shift, Space, Ctrl, F, Esc — with no touch controls, no
joystick, and no `pointerType` branch anywhere in the frontend.

This is not strictly a violation: the decision governs the path *to the first plan*, and the
walkthrough comes after it. But the audience is a plot owner on a low-end phone
([[ui-principles]]), and on that device the walkthrough is currently unreachable. Recorded as a
tension to settle, not as a breach.

## If this step is continued

Give it a done-condition first, the way steps 1–5 had one. A candidate, in the spirit of
[[rooms-do-not-form-a-house]]: *a user can walk from the entrance to every room, through doors
the solver placed, on a touch device.* That single sentence would have caught both regressions
and the input-modality gap.

**Links.** [[build-order]] · [[project-phases]] · [[rooms-do-not-form-a-house]] ·
[[vaastu-and-connectivity-drop-on-edit]] · [[duplicated-geometry]] · [[project-status]]
