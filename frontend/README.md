# frontend

Next.js 16 + TypeScript + Three.js. Owns everything continuous — see
[[client-continuous-server-discrete]] and [[architecture]].

## Modules

| Path | Implements |
|---|---|
| `components/Scene.tsx` | [[step-1-threejs-shell]], [[step-6-walkthrough]] — envelope, extrusion, drag-and-drop, first-person camera |
| `components/PlotPicker.tsx` | [[ui-principles]] #1, #4 |
| `components/CompassDial.tsx` | [[ui-principles]] #6 |
| `components/RoomTray.tsx` | [[ui-principles]] #4, #5 |
| `components/RoomCustomizer.tsx` | per-room dimensions — the [[zero-keyboard-events]] escape hatch |
| `components/Minimap.tsx`, `components/WalkthroughOverlay.tsx` | [[step-6-walkthrough]] |
| `lib/plot.ts`, `lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] |
| `lib/solve.ts`, `lib/useSolve.ts` | [[step-3-wire-together]] — the only network path |
| `lib/walkthrough.ts`, `lib/interiorDetails.ts` | [[step-6-walkthrough]] |
| `app/page.tsx` | composition root |

`lib/solve.ts` / `lib/useSolve.ts` hold the only `fetch()` in the app — `POST /solve` on a
350 ms debounce, per [[step-3-wire-together]] and [[client-continuous-server-discrete]].

> [!success] Both defects fixed 2026-08-25
> - `useSolve.ts` sends `moved_index`, so only a dragged room is released from its Vaastu
>   quadrant — [[vaastu-and-connectivity-drop-on-edit]].
> - `Scene.tsx` consumes the API's `openings` and `wall_thickness_in`; 99 lines of duplicated
>   door derivation are gone — [[duplicated-geometry]].

`Scene.tsx` also gained a roof (slab, parapet and chajja) shown only in walkthrough — see
[[realism-gaps]].

> [!important] The renderer depends on the API for all doors and windows
> There is deliberately no client-side fallback; a fallback is what [[duplicated-geometry]] was.
> **An out-of-date backend renders a house with solid walls and no doors.** `useSolve` detects
> an all-empty `openings` response and the header says so. If you see no doors, restart
> `uvicorn`.

See [[project-status]] for the full picture.

## Dev

```
npm run dev
```

`AGENTS.md` / `CLAUDE.md` are `create-next-app` boilerplate (Next.js 16 differs from training
data — read `node_modules/next/dist/docs/` before assuming an older API).
