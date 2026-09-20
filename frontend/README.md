# frontend

Next.js 16 + TypeScript + Three.js. Owns everything continuous — see
[[client-continuous-server-discrete]] and [[architecture]].

## Modules

Re-audited 2026-09-20 against every file in `lib/` and `components/`. The full code ↔ note index
is [[codebase-map]]; this table is the frontend's own half of it.

### Composition and chrome

| Path | Implements |
|---|---|
| `app/page.tsx` | composition root — 2,977 lines. **Live Plan (H)** puts the blueprint beside the 3D view; whichever pane the pointer is over owns the keyboard |
| `components/Scene.tsx` | [[step-1-threejs-shell]], [[step-6-walkthrough]] — 7,321 lines. Envelope, extrusion, drag-and-drop, first-person camera, IBL and the GTAO composer |
| `components/TopRibbonTaskbar.tsx` | the ribbon — tabs, panel shelf, selection inspector. **Documents** and **Landscape** tabs added 2026-09-19 |
| `components/LeftToolRail.tsx` | docked icon rail, furniture categories, finishes, placed-object list |
| `app/globals.css` | [[chrome-is-monochrome]] — ink/surface ramps, type scale, spacing scale |
| `lib/useFitCount.ts` | how many children of a row fit; the rest overflow. Shared by the shelf and the application bar, which each had their own broken copy |
| `lib/designHistory.ts` | undo/redo as a snapshot stack over the design document; watcher-driven, so a new edit gets undo without instrumenting its call site |
| `lib/projectStorage.ts` | the whole design in `localStorage`; no accounts, no database — [[environment-notes]] |

### Plot, solve and rooms

| Path | Implements |
|---|---|
| `lib/plot.ts`, `lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]], [[plot-shapes-are-convex]] |
| `lib/plotTraverse.ts` | the plot as a **traverse** — edge length, turn, bow — because a deed and a tape both describe edges, and every traverse row is independently valid where a coordinate row is not |
| `components/PlotShapeModal.tsx`, `components/PlotPicker.tsx` | outline editor and presets — [[ui-principles]] #1, #4 |
| `lib/compliance.ts` | setbacks, coverage and FAR from G.O. Ms. 168 — [[bye-law-and-storeys]] |
| `lib/solve.ts`, `lib/useSolve.ts` | [[step-3-wire-together]] — the only network path |
| `lib/rooms.ts`, `lib/programs.ts` | room vocabulary, colours, per-programme mix — mirrors `solver/rooms.py` and `programs/registry.py` |
| `lib/aiPlan.ts`, `lib/aiPlanImage.ts`, `lib/aiFacadeImage.ts` | the three model-backed input paths — [[free-text-input]] |
| `components/RoomCustomizer.tsx`, `components/RoomDimensionsModal.tsx`, `components/RoomTray.tsx` | per-room sizes and the room shelf — the [[zero-keyboard-events]] escape hatch, [[ui-principles]] #4, #5 |

### Walls, openings, stairs

| Path | Implements |
|---|---|
| `lib/customArchitecture.ts` | 2D vector CAD graph, polygon cycle detection, the shared `CadTool` union |
| `lib/wallJoins.ts` | drawn walls combined into one run; the run lives on its own walls as a `chainId`, so it saves and undoes with them |
| `lib/wallEdits.ts`, `lib/wallShapes.ts`, `lib/wallCurves.ts`, `lib/wallBands.ts` | per-wall thickness/height/cutouts, arched and rounded tops, bowed faces — [[curves-are-a-face-not-a-plan]] — and paint bands |
| `lib/smartWallSnap.ts` | snapping to room edges, passages, midlines and corners, plus the guide line 3D draws |
| `lib/glazing.ts` | a wall and its doors turned to glass, resolved wall → room → building — [[render-realism]] |
| `lib/openingsCatalog.ts`, `lib/windowCatalog.ts` | the one source all three placement surfaces read — [[three-pickers]] |
| `lib/sceneDoorways.ts` | door edge arithmetic — mirrors `_edge_origin()` in `connectivity.py` |
| `lib/stairCatalog.ts`, `lib/stairPath.ts` | six catalog stairs, and a stair solved from a drawn walk line that is refused rather than built shallow — [[stair-styles]] |
| `components/WallInspector.tsx`, `components/CustomWallBlendModal.tsx`, `components/DoorsWindowsDrawer.tsx`, `components/WindowShapeModal.tsx` | the editing surfaces for all of the above |

### Render, furniture, performance

| Path | Implements |
|---|---|
| `lib/walkthrough.ts`, `lib/interiorDetails.ts` | [[step-6-walkthrough]] — eye level, room detection, spawn, procedural fit-out |
| `lib/cafeInteriors.ts` | café fit-out at ADA/trade clearances |
| `lib/furnitureCatalog.ts`, `lib/furnitureModels.ts`, `lib/modelLoader.ts` | 133 catalog entries, their CC0 Poly Haven models, and one cached DRACO-enabled loader — [[furniture-models]], [[object-library-licensing]] |
| `lib/aiFurnitureEngine.ts`, `components/AIFurnitureStudioModal.tsx` | parametric procedural pieces at three mesh densities |
| `lib/furnitureInventory.ts` | the scene→UI bridge; imports no `three`, so the sheets are testable without a renderer |
| `lib/materialsCatalog.ts`, `components/MaterialCustomizerModal.tsx` | finishes, with normal/roughness derived by Sobel — [[render-realism]] |
| `lib/aoPass.ts`, `lib/pathTracerEngine.ts` | GTAO, and the progressive WebGL2 path tracer |
| `lib/gpuTier.ts`, `lib/adaptiveQuality.ts`, `lib/graphicsConfig.ts`, `components/GraphicsControlModal.tsx` | quality that measures itself — [[quality-measures-itself]] |
| `lib/sceneConstants.ts`, `lib/sceneBadges.ts` | fixed geometry in feet; canvas→sprite room labels |
| `lib/cameraTour.ts` | a drone tour that walks the doorway graph, so the camera never crosses masonry |
| `components/Minimap.tsx`, `components/WalkthroughOverlay.tsx`, `components/CompassDial.tsx` | [[step-6-walkthrough]], [[ui-principles]] #6 |

### The document sheets

| Path | Implements |
|---|---|
| `lib/blueprintExport.ts` | the one sheet generator — title block, dimensions, schedules. Everything below draws through it rather than growing its own |
| `components/Blueprint2DView.tsx`, `lib/blueprint2dPresets.ts` | the 2D drafting canvas — 4,448 lines — and its viewport presets |
| `lib/designSchedule.ts`, `components/DesignScheduleModal.tsx` | FF&E and finish schedules — [[schedule-is-measured-not-declared]] |
| `lib/elevations.ts`, `components/ElevationsModal.tsx` | one elevation per wall per room — [[elevations-look-from-inside]] |
| `lib/clearances.ts`, `components/ClearanceAuditModal.tsx` | every gap measured, every rule cited or admitted — [[cite-the-clearance-or-admit-it]] |
| `lib/ceilingPlan.ts`, `components/CeilingPlanModal.tsx` | reflected ceiling plan and the lux figure — [[lighting-says-the-number]] |
| `lib/moodboard.ts`, `components/MoodboardModal.tsx` | the finish board, every piece at one shared scale — [[board-is-drawn-to-one-scale]] |
| `lib/boqEngine.ts`, `components/BOQCostModal.tsx` | rates over the backend's quantities, at three tiers |
| `lib/modelBlueprints.ts`, `lib/cafeBlueprints.ts`, `components/ModelBlueprintsModal.tsx` | 20 curated residential plans and 8 café plans |

`lib/solve.ts` / `lib/useSolve.ts` hold the only `fetch()` in the app — `POST /solve` on a
350 ms debounce, per [[step-3-wire-together]] and [[client-continuous-server-discrete]].

> [!success] Both defects fixed 2026-08-25
> - `useSolve.ts` sends `moved_index`, so only a dragged room is released from its zone
>   quadrant.
> - `Scene.tsx` consumes the API's `openings` and `wall_thickness_in`; 99 lines of duplicated
>   door derivation are gone — [[duplicated-geometry]].

`Scene.tsx` also gained a roof (slab, parapet and chajja) shown only in walkthrough — see
[[realism-gaps]].

> [!important] The renderer depends on the API for all doors and windows
> **An out-of-date backend renders a house with solid walls and no doors.** `useSolve` detects
> an all-empty `openings` response and the header says so. If you see no doors, restart
> `uvicorn`.

> [!warning] There *is* a client-side fallback — it no longer lies, but it is still a grid
> This README used to say "there is deliberately no client-side fallback". That stopped being
> true when `solve.ts` grew `solveClientSide()`. Fixed 2026-08-31 ([[client-side-fallback]]):
> it now reports `OFFLINE_ESTIMATE` with an empty rule list and `rooms_reachable: 1`, and
> `requestSolve()` only falls back on a *thrown* fetch — a 422 or 500 surfaces as an error
> instead of becoming a plan. The ribbon shows "⚠ Offline estimate — rules not checked".
>
> What is **not** fixed: `NEXT_PUBLIC_SOLVER_URL` is still unset in the deploy, so a Netlify
> visitor gets the grid — now correctly labelled, but still a grid. That needs a hosted
> backend — [[environment-notes]].

See [[project-status]] for the full picture.

## Dev

```
npm run dev
npx tsc --noEmit     # run this and the build on EVERY frontend change
npm run build
```

> [!warning] There are no frontend tests, and the frontend is 87% of the code
> 47,556 lines of TS/TSX and 10,386 of CSS, against zero tests. `tsc --noEmit` and `next build`
> are the entire safety net, and neither one can tell you a sheet renders, a governor tunes
> correctly or a camera does not fly through a wall. Every regression this project has caught by
> eye was caught by the **user's** eye. See [[project-status]].

`AGENTS.md` / `CLAUDE.md` are `create-next-app` boilerplate (Next.js 16 differs from training
data — read `node_modules/next/dist/docs/` before assuming an older API).
