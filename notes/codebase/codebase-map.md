---
tags: [codebase, moc]
date: 2026-08-23
---
# Codebase map

> [!note] Phase 1 complete, plus an unplanned [[step-6-walkthrough]]. 50/50 tests green.
> This note is the code↔note index. As files land, add a row. The point is that Obsidian's graph
> then shows design notes and the code that implements them as one connected structure rather
> than two disconnected clouds.
>
> **Re-audited 2026-08-25.** Seven modules had landed without a row — the whole walkthrough and
> connectivity surface. Added below. See [[project-status]].

> [!tip] There is now a real graph as well as this hand-kept index
> [[knowledge-graph]] — 651 nodes, 1,536 edges, built with graphify over code + notes together.
> It found `solve_layout()` (47 edges) and [[test-baseline]] (13 edges) as the two structural
> centres. This note stays the human-readable index; the graph is the queryable one.

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
| `frontend/components/TopRibbonTaskbar.tsx` | Flat CAD Ribbon Taskbar | **done** — Application bar, tab strip (Home / Structure / Blueprints / AI Prompt), panel shelf, and selection inspector |
| `frontend/components/LeftToolRail.tsx` | Interior Design Tool Rail | **done** — Docked icon rail with flyout panels for furniture categories, finishes, and placed-object management |
| `backend/solver/walls.py` | Walls as Objects | **done** — Derives every wall once from the placed rooms with an id, endpoints, thickness and the openings it hosts. A shared partition is one wall, not one per room. Implements [[walls-as-objects]] |
| `backend/solver/quantities.py` | Bill of Quantities | **done** — Carpet and built-up area, masonry, bricks, mortar, plaster and a door/window schedule counted off the walls. Quantities only; rates are the caller's |
| `backend/solver/bench_realism.py` | Realism Benchmark | **done** — Feasibility, fill vs catalog ceiling, wet-room spread, through-private rooms and worst aspect across 7 real plot/mix scenarios. The instrument [[room-sizes-from-code]] was measured with |
| `backend/programs/registry.py` | Building Programme Packs | **done** — Residence (Vaastu) and Café (service-flow zoning) as data; hub, parent tree, forbidden pairs and directional rules per building type |
| `frontend/lib/programs.ts` | Programme Mirror (TS) | **done** — Space vocabulary, default mix and per-space ceilings the ribbon offers per building type |
| `frontend/lib/cafeInteriors.ts` | Café Procedural Fit-Out | **done** — Seating grid at ADA/trade clearances, service counter with order-to-pickup split, commercial kitchen, queue, WC |
| `frontend/lib/furnitureCatalog.ts` | Furniture & Fit-Out Catalog | **done** — 43 residential pieces plus 27 café pieces across seating, service, decor, signage, back-of-house and terrace; the left rail offers whichever set the active programme names |
| `frontend/lib/furnitureModels.ts` | Real Furniture Models | **done** — Maps catalog and built-in furniture types onto CC0 Poly Haven models in `public/models`, then swaps them in over the procedural geometry once the layout is built. Additive: an unmapped type or a failed load keeps its boxes. See [[furniture-models]] |
| `frontend/lib/aoPass.ts` | Ambient Occlusion Pass | **done** — GTAO with the scene sprites, grids and glass held out of the depth-normal render, so room badges stop smearing occlusion onto the floor below them |
| `frontend/lib/siteLandscape.ts` | Site Planting & Driveway | **done** — Planting bed, seeded shrubs and an entrance driveway on the setback strip, derived from the plot and the setback the solver honoured so it can never reach the building envelope |
| `frontend/lib/glazing.ts` | Glazed Walls & Glass Doors | **done** — Turns a real wall and its doors to glass, resolved wall → room → building. A material pass over the pieces the solver already cut, so doors and windows stay exactly where they were. Adds a Structural Glazing style whose slim mullion profile is a property of the style, not a constant in the renderer; walls and door leaves are both transmissive glass — [[render-realism]] |
| `frontend/lib/wallBands.ts` | Wall Paint Bands | **done** — Splits any wall into 2-6 horizontal or vertical strips for side-by-side paint comparison; a finish laid on the wall face, never a geometry change. Resolves wall, then room, then building |
| `frontend/lib/cafeBlueprints.ts` | Curated Café Floor Plans | **done** — 8 plans from a 600 sq ft takeaway kiosk to a 2,400 sq ft café restaurant, every layout checked against the solver's own zoning, adjacency and forbidden-pair rules before shipping |
| `frontend/components/Blueprint2DView.tsx` | 2D CAD Drafting Canvas | **done** — Wall drawing, dimension lines, snapping engine, room labels, door/window markers |
| `frontend/components/BlueprintExportModal.tsx` | High-Res CAD SVG & Blueprint Print Engine | **done** — 300 DPI architectural exports, title blocks, dimension annotations |
| `frontend/components/ModelBlueprintsModal.tsx` | Curated Architectural Blueprints Catalog | **done** — 20 prebuilt models, directional filtering, plot size filters |
| `frontend/components/MaterialCustomizerModal.tsx` | Architectural Finishes & Materials Studio | **done** — PBR floors, wallpapers, Venetian stucco, acoustic wood slats |
| `frontend/components/WindowShapeModal.tsx` | Window Architecture & Fenestration Studio | **done** — Palladian, French Casement, Clerestory, Bay, Glass tints, and Curtains |
| `frontend/lib/modelBlueprints.ts` | 20 Curated Architectural Model Blueprints | **done** — 1BHK-4BHK, 20x30 to 50x80, 100% contiguous coordinate matrices |
| `frontend/lib/furnitureCatalog.ts` | Complete 3D Architectural Furniture Catalog | **done** — Sofas, beds, dining sets, fireplaces, planters, kitchen walls |
| `frontend/lib/materialsCatalog.ts` | Material & Surface Finishes Definitions | **done** — Hardwood, marble, slate, stucco, boiserie. Normal and roughness maps are derived by Sobel from the colour and height canvases already drawn, so a new finish gets them for free; colour maps are tagged sRGB and derived data stays linear — [[render-realism]] |
| `frontend/lib/openingsCatalog.ts` | Door & Window Openings Catalog | **done** — 7 doors and 7 windows for drag-and-drop onto any wall, including an 8ft twin-panel sliding glass door. Sliding is a leaf style carried by the custom wall opening and flattened to `door` for `RoomOpening`, so connectivity still sees a door. All three placement surfaces (drawer, 2D inspector, ribbon Structure tab) read this file — see [[three-pickers]] |
| `frontend/lib/windowCatalog.ts` | Window Fenestration Geometry & Materials | **done** — 8 architectural shapes, 6 frame finishes, 5 glass tints |
| `frontend/lib/customArchitecture.ts` | Custom Freehand Wall Drafting & Room Zone Topology | **done** — 2D vector CAD graph, polygon cycle detection |
| `frontend/lib/plot.ts`, `frontend/lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] | **done** — presets, setback math, edge-facing mapping |
| `frontend/lib/sceneConstants.ts` | fixed 3D geometry, in feet | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneBadges.ts` | canvas→sprite room labels | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneDoorways.ts` | door edge arithmetic; mirrors `_edge_origin()` in [[connectivity.py]] | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/blueprint2dPresets.ts` | SVG viewport + drafting preset pills | **done** — extracted from `Blueprint2DView.tsx` 2026-08-30 |
| `frontend/lib/projectStorage.ts` | `localStorage` persistence — see [[environment-notes]] | **done** — extracted from `page.tsx` 2026-08-30 |
| `frontend/lib/rooms.ts` | room vocabulary + colours; mirrors `solver/rooms.py` | **done** — 8 kinds |
| `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` | [[step-3-wire-together]] — 350 ms debounced `POST /solve` | **done** — sends `moved_index`, supports `setRoomPositions()` for contiguous blueprint layouts |
| `frontend/lib/walkthrough.ts` | [[step-6-walkthrough]] | **done** — 5'5" eye level, room detection, spawn |
| `frontend/lib/interiorDetails.ts` | [[step-6-walkthrough]] | **done** — procedural PBR textures, furniture, door-aware placement |
| `frontend/app/page.tsx` | composition root; CAD ribbon, 3D viewport, 2D blueprint modes | **done** |
| `frontend/app/globals.css` | [[chrome-is-monochrome]] — design tokens: ink/surface ramps, 7-step type scale, 2px spacing scale, 3-step radius | **done** — chrome is monochrome, colour reserved for data |
| `backend/solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — placement, drift, Vaastu, relaxation ladder clamped bounds |
| `backend/solver/realism.py` | [[realism-gaps]] | **done** — proportion, daylight/ventilation against the built footprint, area objective |
| `backend/solver/connectivity.py` | [[rooms-do-not-form-a-house]], [[realism-gaps]] | **done** — parent tree, entrance priority, `derive_openings`, `derive_windows` |
| `backend/solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — **8 room kinds**, each carrying `habitable` / `wet` / `max_aspect_x10` |
| `backend/vaastu/rules.py` | [[vaastu-as-constraints]] | **done** — corrected Ishanya NE pooja quadrant coordinates |
| `backend/api/main.py` | `POST /solve`, [[output-schema]] | **done** — [[step-3-wire-together]] |
| `backend/tests/` | [[test-baseline]] | **50/50 passing** (100%) |

Each module folder (`frontend/README.md`, `backend/README.md`, and per-submodule READMEs under
`backend/`) carries the wikilinks back into this vault, per the convention above.

Ignored by the vault: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, `.next/`
(set in `.obsidian/app.json`).

## Size, re-measured 2026-08-30

Backend **2,809** lines of Python (including 779 of tests). Frontend **25,662** lines of
TS/TSX plus **7,810** of CSS. Re-measured 2026-08-31; the 2026-08-30 figures below the
structurize table were already stale by about 20%.

The weight is lopsided and worth stating plainly: **93% of the code is frontend, and 100% of
the tests are backend.**

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
> `Scene.tsx` and `Blueprint2DView.tsx` are still one ~3,900-line component each. The bulk of
> both is welded to local renderer state and ~50 refs, so nothing else can be cut verbatim —
> splitting further means authoring props interfaces, which is a rewrite, and there are **no
> frontend tests** to catch a mistake. See [[project-status]].
