---
tags: [codebase, moc]
date: 2026-08-23
---
# Codebase map

> [!note] Phase 1 complete, plus an unplanned [[step-6-walkthrough]]. 183/183 tests green.
> This note is the code↔note index. As files land, add a row. The point is that Obsidian's graph
> then shows design notes and the code that implements them as one connected structure rather
> than two disconnected clouds.
>
> **Re-audited 2026-08-25.** Seven modules had landed without a row — the whole walkthrough and
> connectivity surface. Added below. See [[project-status]].
>
> **Re-audited 2026-09-20.** Fourteen more modules had landed without a row, and the audit went
> file-by-file rather than commit-by-commit this time: every `.ts`, `.tsx` and `.py` in the repo
> was diffed against this table. The gap was not the newest work — `wallJoins.ts`, `stairPath.ts`
> and `cameraTour.ts` were all already here. It was the **older** unglamorous machinery that had
> never been indexed at all: the BOQ costing engine, the blueprint exporter, the model loader,
> the path tracer, the snapping engine and the whole graphics-settings surface, some of it
> shipped as far back as 2026-08-27.

> [!tip] There is now a real graph as well as this hand-kept index
> [[knowledge-graph]] — **1,962 nodes, 4,514 edges, 105 communities** over 445 files, rebuilt
> 2026-09-20 with graphify over code + notes together. It now finds `Scene.tsx` (183 edges) and
> `page.tsx` (171) as the structural centres, which is the god-component warning at the bottom of
> this note measured rather than asserted. This note stays the human-readable index; the graph is
> the queryable one.

## How the graph stays connected

The vault root **is** the repo root, and `showUnsupportedFiles` is on, so `.py` and `.ts` files
appear in the file explorer alongside notes. Obsidian only graphs Markdown, so the convention is:

1. Every top-level module gets a `README.md` **inside its own folder**.
2. That README links the notes it implements — `[[layout-stability]]`, `[[cp-sat-api]]`, etc.
3. Notes here link back to the module README by name.

The module README is the graph node standing in for the code.

## Modules

| Module | Implements | Status |
|---|---|---|
| `frontend/components/Scene.tsx` | [[step-1-threejs-shell]], [[architecture]], [[integer-inches]], [[step-6-walkthrough]], [[realism-gaps]] | **done** — envelope, extrusion, drag-and-drop, first-person camera, roof/parapet/chajja, strict exterior-only window filtering, and automatic doorway alignment. Now also owns the image-based lighting and the GTAO composer — see [[render-realism]] |
| `frontend/components/TopRibbonTaskbar.tsx` | Flat CAD Ribbon Taskbar | **done** — Application bar, tab strip, panel shelf and selection inspector. Reorganised 2026-09-19: a **Documents** tab now holds BOQ, FF&E schedule, clearances, elevations, ceiling plan, finish board and export, and a **Landscape** tab holds the outdoor pieces. All six document buttons had been 16px icons in a 36px application bar that overflows, so the product's own output was reachable only behind a chevron. The bar is back to session controls |
| `frontend/components/LeftToolRail.tsx` | Interior Design Tool Rail | **done** — Docked icon rail with flyout panels for furniture categories, finishes, and placed-object management |
| `backend/solver/walls.py` | Walls as Objects | **done** — Derives every wall once from the placed rooms with an id, endpoints, thickness and the openings it hosts. A shared partition is one wall, not one per room. Implements [[walls-as-objects]] |
| `backend/solver/quantities.py` | Bill of Quantities | **done** — Carpet and built-up area, masonry, bricks, mortar, plaster and a door/window schedule counted off the walls. Quantities only; rates are the caller's |
| `frontend/lib/boqEngine.ts` | BOQ costing (TS) | **done**, corrected 2026-09-20 — applies rates across civil, masonry, finishes, openings, MEP and labour at three tiers. The split is deliberate: `quantities.py` counts and refuses to price, this file prices. It now **reads** that take-off instead of re-deriving it from room rectangles — [[boq-was-not-reading-the-takeoff]] |
| `frontend/components/BOQCostModal.tsx` | BOQ & Cost UI | **done** — category breakdown, tier switch, per-item rates and totals. Moved to the Documents tab 2026-09-19 |
| `backend/solver/bench_realism.py` | Realism Benchmark | **done** — Feasibility, fill vs catalog ceiling, wet-room spread, through-private rooms and worst aspect across 7 real plot/mix scenarios. The instrument [[room-sizes-from-code]] was measured with |
| `backend/programs/registry.py` | Building Programme Packs | **done** — Residence and Café (service-flow zoning) as data; hub, parent tree, forbidden pairs and directional rules per building type |
| `backend/ai/prompt_constraints.py` | Free-Text Input | **done** 2026-09-06 — Claude maps a sentence onto the room vocabulary, `resolve()` validates the answer against the catalog and moves what it cannot express into `unsupported`. Constraints only; CP-SAT still places every room. No offline path — [[free-text-input]] |
| `frontend/lib/aiPlan.ts` | Free-Text Client (TS) | **done** 2026-09-06 — Calls `POST /ai/plan`, re-expresses the model's room pairs as ids so they survive the app rebuilding its mix, and surfaces `unsupported` and the assumed plot/facing rather than swallowing them |
| `backend/ai/plan_from_image.py` | Plan-Photo Input | **done** 2026-09-12 — Claude reads a photographed floor plan into the same schema plus the dimensions printed on it. Each read dimension becomes a band, not a pin, so the plan is re-solved rather than traced; an image that is not a floor plan returns no rooms — [[free-text-input]] |
| `frontend/lib/aiPlanImage.ts` | Plan-Photo Client (TS) | **done** 2026-09-12 — Calls `POST /ai/plan-image`, recovers each size band as a centre plus a tolerance on `CustomDim`, and says in the UI that the plan was re-solved from the drawing rather than traced from it |
| `backend/ai/facade_from_image.py` | House-Photo Input | **done** 2026-09-12 — Reads a facade from a photo of a house outside (storeys, colour, texture, two-tone band, glazing style) and **generates** the plan and interior to go behind it. Massing, plot size and facing are never read. Finish ids come from the client, so no catalog is mirrored here |
| `frontend/lib/aiFacadeImage.ts` | House-Photo Client (TS) | **done** 2026-09-12 — Builds the finish palette from the real catalogs, calls `POST /ai/facade-image`, lays the facade and generated interior over the current material config, and owns `summary()` — the sentence separating what was read from what was invented |
| `frontend/lib/programs.ts` | Programme Mirror (TS) | **done** — Space vocabulary, default mix and per-space ceilings the ribbon offers per building type |
| `frontend/lib/cafeInteriors.ts` | Café Procedural Fit-Out | **done** — Seating grid at ADA/trade clearances, service counter with order-to-pickup split, commercial kitchen, queue, WC |
| `frontend/lib/furnitureCatalog.ts` | Furniture & Fit-Out Catalog | **done** — 43 residential pieces plus 27 café pieces across seating, service, decor, signage, back-of-house and terrace; the left rail offers whichever set the active programme names |
| `frontend/lib/furnitureModels.ts` | Real Furniture Models | **done** — Maps catalog and built-in furniture types onto CC0 Poly Haven models in `public/models`, then swaps them in over the procedural geometry once the layout is built. Additive: an unmapped type or a failed load keeps its boxes. See [[furniture-models]] |
| `frontend/lib/aoPass.ts` | Ambient Occlusion Pass | **done** — GTAO with the scene sprites, grids and glass held out of the depth-normal render, so room badges stop smearing occlusion onto the floor below them |
| `frontend/lib/gpuTier.ts` | What the machine can draw, asked of the GPU | **done** 2026-09-19 — `WEBGL_debug_renderer_info` instead of `navigator.hardwareConcurrency <= 4`, which counted CPU threads and handed every integrated-graphics laptop the dedicated-GPU path. Sets only what a live WebGL context cannot change afterwards: anti-alias, precision, DPR cap, shadow-map size, whether the composer is built at all. A masked or unrecognised GPU starts **mid**, never high — [[quality-measures-itself]] |
| `frontend/lib/adaptiveQuality.ts` | Quality that measures itself | **done** 2026-09-19 — six rungs over render scale and shadow quality driven by measured frame time, with hysteresis, a longer wait to climb than to fall, and a climb cap. Reads the **unclamped** frame delta, because the render loop's 0.1 s clamp hides every machine below 10 fps — the exact case it exists for. Opening the graphics modal and choosing anything turns it off — [[quality-measures-itself]] |
| `frontend/lib/graphicsConfig.ts` | Graphics presets and settings | **done** — render scale, procedural texture resolution, shadow-map size, anisotropy, tone mapping. Every field here is read by `Scene.tsx`; the DLSS/FSR, sharpening, bloom and AO controls that were never wired to anything were deleted rather than left as chips that did nothing |
| `frontend/components/GraphicsControlModal.tsx` | Graphics Studio UI | **done** — preset pills, per-setting controls, and the performance HUD that used to print a hardcoded `GPU: Dedicated (High VRAM)` on every machine and now prints the real renderer string, tier, rung and measured fps |
| `frontend/lib/modelLoader.ts` | GLTF/DRACO loading and cache | **done** — one shared `GLTFLoader` with a DRACO decoder, a model cache and a pending-promise map, so 62 model folders are fetched once each however many pieces reference them |
| `frontend/lib/glazing.ts` | Glazed Walls & Glass Doors | **done** — Turns a real wall and its doors to glass, resolved wall → room → building. A material pass over the pieces the solver already cut, so doors and windows stay exactly where they were. Adds a Structural Glazing style whose slim mullion profile is a property of the style, not a constant in the renderer; walls and door leaves are both transmissive glass — [[render-realism]] |
| `frontend/lib/ceilingPlan.ts` | Reflected Ceiling Plan | **done** — Fixtures off the model, a proposed downlight grid at ceiling height / 2, a legend, a fixture schedule, and a lumen-method illuminance estimate checked against IS 3646 — [[lighting-says-the-number]] |
| `frontend/components/CeilingPlanModal.tsx` | Reflected Ceiling Plan UI | **done** — Floor pills, proposal toggle, live sheet, per-room illuminance table with sources, SVG/PNG/print/CSV |
| `frontend/lib/moodboard.ts` | Finish Board | **done** — Palette strip, resolved finish swatches, and every piece drawn front-on at one shared scale off its measured box — [[board-is-drawn-to-one-scale]] |
| `frontend/components/MoodboardModal.tsx` | Finish Board UI | **done** — Whole-house and per-room scope, live board, SVG/PNG/print and a print pack of every board |
| `frontend/lib/elevations.ts` | Interior Elevations | **done** — One elevation per wall per room: openings from the solver, furniture silhouettes from the measured boxes, sill and head heights, dimension strings, title block. Drawn looking at the wall from inside it — [[elevations-look-from-inside]] |
| `frontend/components/ElevationsModal.tsx` | Interior Elevations UI | **done** — Wall list grouped by room, live sheet preview, SVG/PNG/print per wall and a print set of every wall |
| `frontend/lib/clearances.ts` | Clearance Audit | **done** — Measures piece-to-piece, piece-to-wall and clear-floor-at-a-door gaps against NKBA and trade minimums. Each rule cites its authority or admits it has none — [[cite-the-clearance-or-admit-it]] |
| `frontend/components/ClearanceAuditModal.tsx` | Clearance Audit UI | **done** — Findings worst-first with measured vs required, the rules applied with sources, CSV export |
| `frontend/lib/furnitureInventory.ts` | Furniture as Data | **done** — The scene-to-UI bridge: measured boxes for the built-in fit-out, plus room-rect and overlap helpers. Free of `three`, so the schedule, the elevations and the audit can all be exercised without a renderer |
| `frontend/lib/designSchedule.ts` | FF&E and Finish Schedule | **done** — Joins the built-in fit-out, the placed pieces and `HouseMaterialConfig` into the two tables an interior designer keeps by hand, in feet-inches and mm, with CSV and a printable sheet. Sizes are measured off the model — [[schedule-is-measured-not-declared]] |
| `frontend/components/DesignScheduleModal.tsx` | FF&E and Finish Schedule UI | **done** — Two tabs, a room filter, whole-house totals, CSV export and print |
| `frontend/lib/wallBands.ts` | Wall Paint Bands | **done** — Splits any wall into 2-6 horizontal or vertical strips for side-by-side paint comparison; a finish laid on the wall face, never a geometry change. Resolves wall, then room, then building |
| `frontend/lib/cafeBlueprints.ts` | Curated Café Floor Plans | **done** — 8 plans from a 600 sq ft takeaway kiosk to a 2,400 sq ft café restaurant, every layout checked against the solver's own zoning, adjacency and forbidden-pair rules before shipping |
| `frontend/components/Blueprint2DView.tsx` | 2D CAD Drafting Canvas | **done** — Wall drawing, dimension lines, snapping engine, room labels, door/window markers |
| `frontend/components/BlueprintExportModal.tsx` | High-Res CAD SVG & Blueprint Print Engine | **done** — 300 DPI architectural exports, title blocks, dimension annotations |
| `frontend/lib/blueprintExport.ts` | Architectural sheet generator | **done** — title block, dimension strings, schedules and CAD annotation as vector output. The one exporter: the elevations, the finish board and the ceiling plan all draw through it rather than growing their own. Also owns `escapeMarkup()` and `downloadCsv()`, which had three and four byte-identical copies scattered across `lib/` until 2026-09-20 |
| `frontend/components/ModelBlueprintsModal.tsx` | Curated Architectural Blueprints Catalog | **done** — 20 prebuilt models, directional filtering, plot size filters |
| `frontend/components/MaterialCustomizerModal.tsx` | Architectural Finishes & Materials Studio | **done** — PBR floors, wallpapers, Venetian stucco, acoustic wood slats |
| `frontend/components/WindowShapeModal.tsx` | Window Architecture & Fenestration Studio | **done** — Palladian, French Casement, Clerestory, Bay, Glass tints, and Curtains |
| `frontend/lib/modelBlueprints.ts` | 20 Curated Architectural Model Blueprints | **done** — 1BHK-4BHK, 20x30 to 50x80, 100% contiguous coordinate matrices |
| `frontend/lib/furnitureCatalog.ts` | Complete 3D Architectural Furniture Catalog | **done** — Sofas, beds, dining sets, fireplaces, planters, kitchen walls |
| `frontend/lib/materialsCatalog.ts` | Material & Surface Finishes Definitions | **done** — Hardwood, marble, slate, stucco, boiserie. Normal and roughness maps are derived by Sobel from the colour and height canvases already drawn, so a new finish gets them for free; colour maps are tagged sRGB and derived data stays linear — [[render-realism]] |
| `frontend/lib/openingsCatalog.ts` | Door & Window Openings Catalog | **done** — 7 doors and 7 windows for drag-and-drop onto any wall, including an 8ft twin-panel sliding glass door. Sliding is a leaf style carried by the custom wall opening and flattened to `door` for `RoomOpening`, so connectivity still sees a door. All three placement surfaces (drawer, 2D inspector, ribbon Structure tab) read this file — see [[three-pickers]] |
| `frontend/lib/windowCatalog.ts` | Window Fenestration Geometry & Materials | **done** — 8 architectural shapes, 6 frame finishes, 5 glass tints |
| `frontend/lib/customArchitecture.ts` | Custom Freehand Wall Drafting & Room Zone Topology | **done** — 2D vector CAD graph, polygon cycle detection |
| `frontend/lib/plot.ts`, `frontend/lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]], [[plot-shapes-are-convex]] | **done** — presets, setback math, edge-facing mapping, drawn outlines, bowed edges and the convex hull that survives integer rounding |
| `frontend/lib/plotTraverse.ts` | A plot is walked, not plotted | **done** — holds the outline as a **traverse**: one row per edge with a length, the turn at the corner after it, and its bow. Surveyor's metes-and-bounds and the tape-and-diagonal an owner actually has both describe edges, not coordinates; and every traverse row is independently valid, where changing one X in a coordinate table leaves the other corners disagreeing with it mid-keystroke — [[plot-shapes-are-convex]] |
| `frontend/components/PlotShapeModal.tsx` | Plot outline editor | **done** 2026-09-18 — drag a corner, bow an edge, double-click to add, right-click to remove; plus the typed corner/traverse table for a surveyed parcel — [[plot-shapes-are-convex]] |
| `frontend/lib/sceneConstants.ts` | fixed 3D geometry, in feet | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneBadges.ts` | canvas→sprite room labels | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneDoorways.ts` | door edge arithmetic; mirrors `_edge_origin()` in [[connectivity.py]] | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/blueprint2dPresets.ts` | SVG viewport + drafting preset pills | **done** — extracted from `Blueprint2DView.tsx` 2026-08-30 |
| `frontend/lib/projectStorage.ts` | `localStorage` persistence — see [[environment-notes]] | **done** — extracted from `page.tsx` 2026-08-30 |
| `frontend/lib/designHistory.ts` | Undo/redo — snapshot stack over the design document | **done** 2026-09-06 — watcher-driven, so new edits get undo without instrumenting their call site |
| `backend/envelope/polygon.py` | Convex polygon plots — [[plot-shapes-are-convex]] | **done** 2026-09-06, cap raised to 32 corners 2026-09-18 — one integer half-plane per plot edge, straight into CP-SAT |
| `frontend/lib/wallCurves.ts` | Bowed wall faces on rectangular rooms — [[curves-are-a-face-not-a-plan]] | **done** 2026-09-06 — one polyline feeds geometry, collision and the take-off |
| `frontend/lib/wallEdits.ts` | Per-wall thickness, height and rectangular cutouts | **done** 2026-09-06 — keyed by room instance id plus edge, the same pair `wallBandKey` already uses. Render-only, like the per-room `customWallThickness` beside it: never sent to `/solve` |
| `frontend/components/WallInspector.tsx` | Click a wall in 3D, edit its geometry | **done** 2026-09-06 — length (resizes the room), thickness, height, and holes cut through the face |
| `frontend/lib/wallShapes.ts` | Wall elevations and the holes in them, as extruded outlines | **done** 2026-09-06 — arched and rounded wall tops, and rounded / arched / circular cutouts. Only taken when a wall actually needs a shape; a plain wall is still a box |
| `frontend/lib/wallJoins.ts` | Drawn walls combined into one run, and the shape of its corners | **done** 2026-09-19 — square, rounded or chamfered corners. The run is stored on its own walls as a `chainId`, so it saves and undoes with them; `resolveChainWalls` turns walls as drawn into walls as built and feeds both the 3D scene and the 2D blueprint |
| `frontend/lib/smartWallSnap.ts` | Wall snapping and auto-positioning | **done** — aligns a placed wall or object to room edges, open passages, room midlines and corner junctions, and hands back the guide line the 3D view draws for it |
| `frontend/lib/aiFurnitureEngine.ts` | Parametric procedural furniture | **done** — builds a piece out of typed components (base, cushions, legs, tufting, hardware) at Low / Medium / Ultra mesh density with procedural PBR materials. The generative path; `furnitureModels.ts` is the real-asset path |
| `frontend/components/AIFurnitureStudioModal.tsx` | AI Furniture Studio UI | **done** — describes a piece, previews the generated mesh, places it |
| `frontend/lib/useFitCount.ts` | How many of a row's children fit; the rest go to an overflow | **done** 2026-09-06 — shared by the ribbon shelf and the application bar, which both had their own broken version |
| `frontend/lib/stairCatalog.ts` | Six placeable stair styles, generated to NBC minima — [[stair-styles]] | **done** 2026-09-06 — Structure tab, Stairs panel |
| `frontend/lib/stairPath.ts` | Solves a drawn walk line into a compliant staircase — flights, landings, riser count, going. No `three`, so it runs without a renderer. A path that cannot meet NBC minima is refused with the reason, never built shallower | **done** 2026-09-19 — Draw tab "Draw Stair", 2D blueprint and 3D |
| `frontend/lib/cameraTour.ts` | Solves a drone tour from the plan: exterior orbit, descent onto the entrance, then room by room along a **walk** over the doorway graph so every hop crosses a real shared wall. No `three`, so the path is checkable without a renderer | **done** 2026-09-19 — View tab, Presentation panel |
| `frontend/lib/compliance.ts` | Setbacks, coverage and FAR from G.O. Ms. 168 — [[bye-law-and-storeys]] | **done** 2026-09-06 — replaces the hardcoded 5/5/3/3 ft; road width is a new input |
| `backend/solver/model.py` (floors) | Per-floor packing and the stair core — [[bye-law-and-storeys]] | **done** 2026-09-06 — G+2, one core pinned across storeys, `tests/test_floors.py` |
| `frontend/lib/rooms.ts` | room vocabulary + colours; mirrors `solver/rooms.py` | **done** — 21 kinds: the solver's 20 plus `stairs`, which is drawn and never solved |
| `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` | [[step-3-wire-together]] — 350 ms debounced `POST /solve` | **done** — sends `moved_index`, supports `setRoomPositions()` for contiguous blueprint layouts, and `restoreRoomPositions()` which re-solves so an undo can put a dragged room back |
| `frontend/lib/walkthrough.ts` | [[step-6-walkthrough]] | **done** — 5'5" eye level, room detection, spawn |
| `frontend/lib/interiorDetails.ts` | [[step-6-walkthrough]] | **done** — procedural PBR textures, furniture, door-aware placement |
| `frontend/app/page.tsx` | composition root; CAD ribbon, 3D viewport, 2D blueprint modes | **done** — **Live Plan (H)** since 2026-09-19 puts the blueprint *beside* the 3D view instead of in place of it. Both panes read the same state, so there is nothing to sync; what did need solving is that both bind their own `keydown`, and one Enter was building two staircases. Whichever pane the pointer is over owns the keyboard |
| `frontend/app/globals.css` | [[chrome-is-monochrome]] — design tokens: ink/surface ramps, 7-step type scale, 2px spacing scale, 3-step radius | **done** — chrome is monochrome, colour reserved for data |
| `backend/solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — placement, drift, zoning, relaxation ladder clamped bounds |
| `backend/solver/realism.py` | [[realism-gaps]] | **done** — proportion, daylight/ventilation against the built footprint, area objective |
| `backend/solver/connectivity.py` | [[rooms-do-not-form-a-house]], [[realism-gaps]] | **done** — parent tree, entrance priority, `derive_openings`, `derive_windows` |
| `backend/solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — **20 room kinds**: 10 residential (bedroom, hall, dining, entrance, kitchen, bathroom, store, utility, sitout, parking) and 10 café. Each carries `habitable` / `wet` / `max_aspect_x10`. Minimums are NBC 2016; maximums were raised 2026-09-19 to what India builds, because they were test-fixture ceilings binding before the plot did — [[room-sizes-from-code]] |
| `backend/zoning.py` | directional zone rules | **done** — quadrant constraints; the café pack uses them, the residence posts none |
| `backend/envelope/envelope.py` | Setback-derived buildable envelope | **done** — mirrors `frontend/lib/plot.ts` by hand across the TS/Python boundary, which is [[duplicated-geometry]] accepted rather than solved. Setback values are hardcoded — [[environment-notes]] |
| `backend/solver/demo.py` | `python -m solver.demo` | **done** — solves a default 4-6 room mix in a fixed 30×40 envelope and prints [[output-schema]]-shaped JSON. The no-frontend way to see the solver's real answer |
| `backend/solver/bench_stability.py` | Stability benchmark | **done** — the instrument that settled [[claim-most-likely-wrong]] with numbers: does CP-SAT already return near-identical layouts across small perturbations *without* the drift objective — [[layout-stability]] |
| `backend/prompt_to_plan.py` | CLI prompt → plan | **done** — `python prompt_to_plan.py "30x40 north facing 2bhk with a store"`. Parses the sentence, solves, and prints specs, an ASCII preview, JSON and an SVG blueprint. A command-line surface over the same solver, independent of `backend/ai/` and its API key |
| `backend/api/main.py` | `POST /solve`, `POST /ai/plan`, `POST /ai/plan-image`, `POST /ai/facade-image`, [[output-schema]] | **done** — [[step-3-wire-together]]. `_size_range()` clamps a pinned size to the catalog: it documented that neither source widens the catalog and then returned the pin unclamped one line below, which let 17 shipped blueprints pin rooms under a floor the solver enforces |
| `backend/tests/` | [[test-baseline]] | **183/183 passing** (100%) |

Each module folder (`frontend/README.md`, `backend/README.md`, and per-submodule READMEs under
`backend/`) carries the wikilinks back into this vault, per the convention above.

Ignored by the vault: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, `.next/`
(set in `.obsidian/app.json`).

## Size, re-measured 2026-09-20

| | 2026-08-31 | 2026-09-20 |
|---|---|---|
| Backend Python | 2,809 (779 tests) | **8,348** (2,729 tests) |
| Frontend TS/TSX | 25,662 | **47,556** |
| Frontend CSS | 7,810 | **10,386** |
| Backend tests | 50 | **183** |

Counted with `wc -l` over `backend/**/*.py` (excluding `.venv`) and
`frontend/{lib,components,app}/**/*.{ts,tsx,css}`.

The weight is still lopsided and still worth stating plainly: **87% of the code is frontend,
and 100% of the tests are backend.** The ratio improved only because the backend nearly tripled;
the frontend also nearly doubled, and none of it is tested.

## Structurize pass, 2026-08-30

Five modules were lifted out of the three largest files. Every move was mechanical — cut
verbatim, add `export`, add an import — and verified three ways: `tsc --noEmit` clean,
`next build` clean, and `eslint` problem counts *identical* to the pre-change baseline
(20 for `Scene.tsx`+`page.tsx`, 17 for `Blueprint2DView.tsx`).

| File | Before | After |
|---|---|---|
| `components/Scene.tsx` | 3,972 | 3,878 |
| `components/Blueprint2DView.tsx` | 3,273 | 3,263 |
| `app/page.tsx` | 1,229 | 1,210 |

Those are the numbers **on the day of that pass**. All three have grown since: measured
2026-08-31 they are **4,834**, **3,649** and **1,337**.

Two duplications died with it:

- `Scene.tsx` carried its own `snapToFoot()` and `clampInches()`, byte-equivalent to the ones
  already exported from `lib/units.ts` — a file `Scene.tsx` already imported from.
- The CAD tool union `"select" | "draw_wall" | "place_door" | "place_window" | "tag_room"` was
  written out verbatim in **four** files. It is now `CadTool` in `lib/customArchitecture.ts`.

> [!warning] This was a seam pass, not a decomposition
> `Scene.tsx` and `Blueprint2DView.tsx` are still one component each. The bulk of both is welded
> to local renderer state and ~50 refs, so nothing else can be cut verbatim — splitting further
> means authoring props interfaces, which is a rewrite, and there are **no frontend tests** to
> catch a mistake. See [[project-status]].

> [!warning] And they have grown every month since, measured 2026-09-20
>
> | File | 2026-08-30 (after the pass) | 2026-08-31 | 2026-09-20 |
> |---|---|---|---|
> | `components/Scene.tsx` | 3,878 | 4,834 | **7,321** |
> | `components/Blueprint2DView.tsx` | 3,263 | 3,649 | **4,448** |
> | `app/page.tsx` | 1,210 | 1,337 | **2,977** |
>
> `Scene.tsx` is now **89% larger** than the day it was "structurized", and `page.tsx` is
> **146%** larger. [[knowledge-graph]] measures the same thing from the other side: `Scene.tsx`
> carries 183 graph edges and `page.tsx` 171, the two highest in the repo. Every studio,
> document sheet and tool added since hangs off one or both. The seam pass bought a month.
> Nothing since has been cut out of either file.
