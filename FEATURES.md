---
tags: [features, moc, documentation]
date: 2026-09-05
status: current
---

# plot-to-plan — Complete Feature Inventory

Every shipped capability, grouped by subsystem, with the file that owns it.

Verified against the working tree on 2026-09-05. Counts were read out of the source, not carried
over from earlier notes. Supersedes [[features-and-tools]] (last accurate 2026-08-30).

**Contents**

1. [Constraint Solver Engine](#1-constraint-solver-engine-backend)
2. [BIM & Quantities](#2-bim--quantities)
3. [Building Programmes](#3-building-programmes)
4. [Natural-Language Input](#4-natural-language-input)
5. [HTTP API](#5-http-api)
6. [Plot & Programme Input UI](#6-plot--programme-input-ui)
7. [Blueprint Catalogs](#7-blueprint-catalogs)
8. [3D Scene & Renderer](#8-3d-scene--renderer)
9. [Graphics Quality Studio](#9-graphics-quality-studio)
10. [Path Tracer](#10-path-tracer)
11. [Materials & Finishes](#11-materials--finishes)
12. [Openings — Doors, Windows, Glazing](#12-openings--doors-windows-glazing)
13. [Furniture & Fit-Out](#13-furniture--fit-out)
14. [AI Furniture Synthesis](#14-ai-furniture-synthesis)
15. [Freeform CAD Drafting](#15-freeform-cad-drafting)
16. [2D Blueprint View](#16-2d-blueprint-view)
17. [First-Person Walkthrough](#17-first-person-walkthrough)
18. [Site & Landscaping](#18-site--landscaping)
19. [Export & Documentation](#19-export--documentation)
20. [Persistence](#20-persistence)
21. [Keyboard & Input Reference](#21-keyboard--input-reference)
22. [Offline Fallback Solver](#22-offline-fallback-solver)
23. [Test & Verification Surface](#23-test--verification-surface)
24. [Known Limits](#24-known-limits)

---

## 1. Constraint Solver Engine (backend)

Google OR-Tools CP-SAT. Integer inches throughout — see [[integer-inches]].

| Feature | File | Description |
| :--- | :--- | :--- |
| Rectangular packing solver | `backend/solver/model.py` | Places every room as a non-overlapping rectangle inside the buildable envelope. Zero overlap, legal setbacks and containment guaranteed by construction, not by post-check. |
| Relaxation ladder | `backend/solver/model.py` | On infeasibility drops, in order: Vaastu, daylight, then area preference. **Connectivity is never dropped.** The response reports which rules were relaxed. |
| L1 drift objective | `backend/solver/model.py` | Minimises total Manhattan displacement from the previous solution so an edit does not reshuffle the house. Weighted 100,000x against area preference. A dragged room is released from its Vaastu quadrant; every other room stays constrained. |
| Compact footprint objective | `backend/solver/model.py` | Linear half-perimeter penalty. Cut inner void from 28% to 5-7% and stopped loose pavilion layouts. |
| Vaastu rules engine | `backend/vaastu/rules.py` | Three half-plane constraints posted **before** the search: kitchen south-east (Agneya), first bedroom south-west (Nairutya), pooja north-east (Ishanya). Vaastu is a constraint, never a score. |
| Connectivity graph | `backend/solver/connectivity.py` | Star topology with parent hierarchies — master ensuite hangs off the bedroom, common bath off the hall. 100% room reachability enforced. |
| Openings extractor | `backend/solver/connectivity.py` | Computes shared-wall intervals and exterior exposure, emitting exact coordinates for interior doors, the main entrance and exterior windows. 32 in door leaf (`DOOR_WIDTH_IN`). |
| Daylight & ventilation | `backend/solver/realism.py` | Every habitable **and wet** room must touch the exterior face of the built footprint. Pooja and store exempt. Measured against the footprint, not the plot boundary. |
| Aspect-ratio limits | `backend/solver/realism.py` | Per-kind proportion caps prevent corridor-shaped rooms. Worst observed 2.4:1. |
| NBC 2016 room catalog | `backend/solver/rooms.py` | Real Indian statutory minimums — hall 10x12, kitchen 7x8, bath 4x6 — replacing artificial test sizes. |
| Buildable envelope | `backend/envelope/envelope.py` | Applies per-edge setbacks from plot dimensions and road facing. TG-bPASS defaults: 5 ft road, 3 ft rear and sides. |
| Realism benchmark | `backend/solver/bench_realism.py` | Measures feasibility, fill vs catalog ceiling, wet-room spread, through-private rooms and worst aspect across 7 real plot/mix scenarios. |
| Stability benchmark | `backend/solver/bench_stability.py` | Measures layout drift across repeated edits. |

## 2. BIM & Quantities

| Feature | File | Description |
| :--- | :--- | :--- |
| Walls as first-class objects | `backend/solver/walls.py` | Every wall derived once from the placed rooms with a persistent id, endpoints, thickness and the openings it hosts. A shared partition is **one** wall, not one per room — no double-counted doors, no floating borders. |
| Bill of Quantities | `backend/solver/quantities.py` | Carpet and built-up area, masonry volume, brick count (434/m3 traditional or 500/m3 per IS 1077), mortar volume, plaster area and a door/window schedule counted off the walls. Quantities only; rates belong to the caller. |
| Cost estimation engine | `frontend/lib/boqEngine.ts` | Line items across civil, masonry, finishes, openings, MEP and labor, with category rollups and percentage split. Three quality tiers: Economy, Standard, Luxury. |
| BOQ modal | `frontend/components/BOQCostModal.tsx` | Live cost breakdown UI with tier switching, CSV export and a printable report. |

## 3. Building Programmes

| Feature | File | Description |
| :--- | :--- | :--- |
| Programme registry | `backend/programs/registry.py` | Building types as data — hub room, parent tree, forbidden pairs and directional rules per programme. Two shipped: **Residence** (Vaastu) and **Café** (service-flow zoning). Unknown keys fall back to Residence rather than erroring. |
| Programme mirror (TS) | `frontend/lib/programs.ts` | Space vocabulary, default mix and per-space ceilings the ribbon offers for the active programme. |
| Room vocabulary | `frontend/lib/rooms.ts` | 19 room kinds. Residence: hall, dining, kitchen, bedroom, bathroom, pooja, store, entrance. Café: seating, lounge, entry, queue, counter, prep, pantry, wash, washroom, staff. |
| Café procedural fit-out | `frontend/lib/cafeInteriors.ts` | Seating grid at ADA/trade clearances, service counter with order-to-pickup split, commercial kitchen, queue line, WC. |

## 4. Natural-Language Input

| Feature | File | Description |
| :--- | :--- | :--- |
| Prompt-to-plan parser | `backend/prompt_to_plan.py` | Parses prompts like `"30x40 north facing 2bhk with pooja room"` into plot dimensions, facing and a room mix, then solves. |
| CLI | `backend/prompt_to_plan.py` | `python prompt_to_plan.py "40x60 east facing 3bhk with dining and store" --svg plan.svg --json plan.json`. Emits ASCII preview, JSON and an SVG blueprint. |
| AI Prompt ribbon tab | `frontend/components/TopRibbonTaskbar.tsx` | In-app prompt entry that posts to `/solve-prompt`. |

## 5. HTTP API

FastAPI. `backend/api/main.py`.

| Endpoint | Description |
| :--- | :--- |
| `POST /solve` | Plot, facing, setbacks and room counts in; placed rooms, walls, openings and solve metadata out. Metadata reports which rules were relaxed. |
| `POST /solve-prompt` | Natural-language prompt in, full solved plan out. |
| `POST /ai/model-furniture` | Text prompt to a parametric component tree with PBR materials and dimensions. **`image_base64` is accepted and ignored** — colour and aspect come from client-side canvas sampling. |

## 6. Plot & Programme Input UI

| Feature | File | Description |
| :--- | :--- | :--- |
| Plot picker | `frontend/components/PlotPicker.tsx` | Preset cards plus steppers, never text inputs — [[zero-keyboard-events]]. Clamped to legal min/max dimensions. |
| Compass dial | `frontend/components/CompassDial.tsx` | Rotating ring for road facing. A spatial question gets a spatial control, not a dropdown. |
| Room tray | `frontend/components/RoomTray.tsx` | One stepper row per room kind, max 4 each. The user supplies intent; the solver supplies correctness. |
| Room customizer | `frontend/components/RoomCustomizer.tsx` | Per-room target width and depth in feet, fed back as a solver preference. |
| Room dimensions modal | `frontend/components/RoomDimensionsModal.tsx` | Full dimension table for every placed room with live editing. |
| Interactive plot handles | `frontend/components/Scene.tsx` | 3D drag handles to resize plot width and depth with boundary validation. |
| Top ribbon taskbar | `frontend/components/TopRibbonTaskbar.tsx` | Flat CAD ribbon — application bar, tab strip (Home / Structure / Blueprints / AI Prompt), panel shelf, selection inspector. |
| Left tool rail | `frontend/components/LeftToolRail.tsx` | Docked icon rail with flyout panels for furniture categories, finishes, glazing, wall bands and placed-object management. |

## 7. Blueprint Catalogs

| Feature | File | Description |
| :--- | :--- | :--- |
| 20 residential model blueprints | `frontend/lib/modelBlueprints.ts` | 1BHK-4BHK across 20x30 ft to 50x80 ft. Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, Urban Contemporary, Parisian Penthouse. 100% contiguous coordinate matrices — 0-inch gap shared partitions. |
| 8 café floor plans | `frontend/lib/cafeBlueprints.ts` | 600 sq ft takeaway kiosk to 2,400 sq ft café restaurant. Every layout checked against the solver's own zoning, adjacency and forbidden-pair rules before shipping. |
| Catalog browser | `frontend/components/ModelBlueprintsModal.tsx` | 4-directional cardinal filtering (N/E/S/W road facing) plus plot-size filters. |

## 8. 3D Scene & Renderer

`frontend/components/Scene.tsx` unless noted.

| Feature | Description |
| :--- | :--- |
| Envelope & extrusion | Solved rectangles extruded to walls with correct thickness, sharing partitions with the solver's wall objects. |
| Roof assembly | RCC slab, parapet and chajja sunshades over every exterior opening. |
| Doorway alignment | `frontend/lib/sceneDoorways.ts` — pure edge arithmetic placing each shared door once, with the edge each room sees it on. Cardinal convention matches the solver: +X east, +Z south, origin at the plot's north-west corner. |
| Room badges | `frontend/lib/sceneBadges.ts` — canvas-drawn floating sprite labels for rooms. |
| Dollhouse cutaway | Slices all walls to a 4.8-5.2 ft section with matte white top caps and 3D hinged door leaves at 35-40°. Auto-disables in walkthrough. |
| Day / night atmosphere | Multi-stop sky dome with sun disc and white CAD grids by day; obsidian backdrop, dark grid and warm interior spots by night. Hotkey `L`. |
| Image-based lighting | Environment map driving specular response across every material. Added 2026-09-04 — before it, nothing in the scene had a specular response at all. |
| Ambient occlusion | `frontend/lib/aoPass.ts` — GTAO with sprites, grids and glass held out of the depth-normal render so badges stop smearing occlusion onto the floor. |
| Multi-storey switcher | Ground / 1F / 2F / Terrace Roof with intermediate RCC slabs. Geometry only — the solver is single-storey. |
| Interactive gizmos | Move, rotate (45°/90°), scale, duplicate and delete placed objects with collision guides. |
| Smart wall snapping | `frontend/lib/smartWallSnap.ts` — auto-aligns to room edges, dividers, open passages, custom walls and midlines, with a live guide line and a named snap type. |
| Minimap | `frontend/components/Minimap.tsx` — top-down radar HUD with live player position, FOV cone, room boundaries and furniture. |
| Real 3D models | `frontend/lib/modelLoader.ts` — GLTF/GLB loader with DRACO support and a shared module-level cache. 15 CC0 Poly Haven models under `frontend/public/models`. |

## 9. Graphics Quality Studio

| Feature | File | Description |
| :--- | :--- | :--- |
| Graphics modal | `frontend/components/GraphicsControlModal.tsx` | Hotkey `G`. Presets: Low, Medium, High, Ultra, High-Performance GPU Extreme. |
| Resolution scaling | `frontend/lib/graphicsConfig.ts` | 50% (Performance) to 200% (4K Ultra DSR). |
| Procedural texture resolution | `frontend/lib/graphicsConfig.ts` | 512px to 4096px canvas-generated PBR textures with up to 16x anisotropic filtering. |
| Shadow quality | `frontend/components/Scene.tsx` | 1024px-4096px PCF soft shadow maps with normal-bias tuning. |
| Tone mapping | `frontend/lib/graphicsConfig.ts` | ACES Filmic, Reinhard, Cineon, Linear. |
| Performance HUD | `frontend/components/Scene.tsx` | Measured FPS, frame time and render resolution. The VRAM figure beside them is an **estimate from active settings, not a measurement** — WebGL cannot report real allocation. |

## 10. Path Tracer

| Feature | File | Description |
| :--- | :--- | :--- |
| Hardware path tracer | `frontend/lib/pathTracerEngine.ts` | WebGL2 progressive raytracing via `three-gpu-pathtracer`. Configurable bounces, target samples, render scale, tile split and glossy filtering. Reports samples, progress and elapsed time. Hotkey `P`. |

## 11. Materials & Finishes

| Feature | File | Description |
| :--- | :--- | :--- |
| Materials catalog | `frontend/lib/materialsCatalog.ts` | 50+ named finishes — Scandinavian Oak, Carrara Marble, French Chevron Oak, Terracotta, Jet Black Granite, Herringbone Walnut, Moroccan Mosaic, Venetian stucco, acoustic wood slats, boiserie. |
| Derived normal & roughness maps | `frontend/lib/materialsCatalog.ts` | Sobel-derived from the colour and height canvases already drawn, so a new finish gets them free. Colour maps tagged sRGB; derived data stays linear. |
| Wall paint palette | `frontend/lib/materialsCatalog.ts` | Matte White, Warm Ivory, Soft Sage, Muted Slate, Terracotta Rust, Deep Navy, Raw Concrete. |
| Design presets | `frontend/components/MaterialCustomizerModal.tsx` | One-click themes: Modern Scandinavian, Classic Indian Heritage, Minimalist Industrial, Mediterranean Villa, Architectural Studio Cutaway. |
| Wall paint bands | `frontend/lib/wallBands.ts` | Splits any wall into 2-6 horizontal or vertical strips for side-by-side paint comparison. A finish on the wall face, never a geometry change. Resolves wall then room then building. Includes designer permutation palettes and a random generator. |
| Wall blend modal | `frontend/components/CustomWallBlendModal.tsx` | Band count, axis, per-band colour and preset schemes. |
| UPGRADE studio mode | `frontend/lib/interiorDetails.ts` | Hotkey `U`. Hot-swaps CAD blocks for a photorealistic suite — bouclé cloud sectional, organic walnut pebble table, wall-to-wall joinery with integrated LED and fireplace, half-moon planter divider, Nero Marquina oval dining suite, boiserie wainscoting. |

## 12. Openings — Doors, Windows, Glazing

| Feature | File | Description |
| :--- | :--- | :--- |
| Openings catalog | `frontend/lib/openingsCatalog.ts` | 7 doors and 7 windows for drag-and-drop onto any wall, including an 8 ft twin-panel sliding glass door. Sliding is a leaf style carried by the opening and flattened to `door` for `RoomOpening`, so connectivity still sees a door. All three placement surfaces read this one file — see [[three-pickers]]. |
| Openings drawer | `frontend/components/DoorsWindowsDrawer.tsx` | Drag-and-drop shelf for doors, windows and passages. |
| Window geometry catalog | `frontend/lib/windowCatalog.ts` | 8 architectural shapes (Rectangular, Floor-to-Ceiling Ribbon, Arched Heritage, Palladian, French Casement, Clerestory, Bay, Circular Oculus), 6 frame finishes, 5 glass tints. |
| Window shape modal | `frontend/components/WindowShapeModal.tsx` | Shape, frame, tint and curtain selection. |
| Glazing | `frontend/lib/glazing.ts` | Turns a real wall and its doors to glass, resolved wall then room then building. A material pass over the pieces the solver already cut, so doors and windows stay put. Structural Glazing style carries its own slim mullion profile; walls and door leaves are both transmissive glass. |
| Wall demolition | `frontend/components/TopRibbonTaskbar.tsx` | Click any wall to open it into a passage with an overhead lintel, or restore it. |
| Chajja sunshades | `frontend/components/Scene.tsx` | Concrete sunshades auto-centred above every exterior window. |

## 13. Furniture & Fit-Out

| Feature | File | Description |
| :--- | :--- | :--- |
| Furniture catalog | `frontend/lib/furnitureCatalog.ts` | 70 pieces — 43 residential (living, bedroom, dining, kitchen, office, decor, sacred, walls) and 27 café (seating, service, decor, signage, back-of-house, outdoor). The left rail offers whichever set the active programme names. |
| Real furniture models | `frontend/lib/furnitureModels.ts` | Maps catalog and built-in types onto 15 CC0 Poly Haven models, swapped in after the layout builds. Additive — an unmapped type or a failed load keeps its procedural geometry. Models are metric; only a unit conversion is applied, never a fit-to-declared-box that would distort them. |
| Auto fit-out | `frontend/lib/interiorDetails.ts` | Every room type furnished on solve — Scandinavian living room, king bedroom with study workstation, modular L-kitchen with chimney and appliances, 6-seater dining, deluxe bath with washing machine, marble pooja mandir with lit diya. |
| Replace object | `frontend/components/ReplaceObjectModal.tsx` | Swap any placed piece for another catalog item in place. |

## 14. AI Furniture Synthesis

| Feature | File | Description |
| :--- | :--- | :--- |
| Studio modal | `frontend/components/AIFurnitureStudioModal.tsx` | Image drag-and-drop or file select with live preview and prompt editing. Samples the image's dominant colour and aspect ratio in-browser and passes those as hints. |
| Procedural mesh engine | `frontend/lib/aiFurnitureEngine.ts` | Builds multi-component meshes from a parametric tree. Three mesh density tiers (Low / Medium / Ultra) and 10 procedural PBR material types — fabric, velvet, leather, bouclé, wood, metal, brass, glass, marble, chrome. |
| In-scene spawning | `frontend/app/page.tsx` | Drops the generated model straight onto the plan with full move, rotate, scale and delete. |

> The backend does **not** read the uploaded image. See section 5.

## 15. Freeform CAD Drafting

| Feature | File | Description |
| :--- | :--- | :--- |
| CAD tool state | `frontend/lib/customArchitecture.ts` | One shared tool union — `select`, `draw_wall`, `place_door`, `place_window`, `tag_room`. |
| Custom wall types | `frontend/lib/customArchitecture.ts` | Exterior, interior, glass, slat, arch, curved, curved glass, curved slat. |
| Wall drawing | `frontend/components/Scene.tsx`, `frontend/components/Blueprint2DView.tsx` | Draw partitions and perimeter walls in 2D or 3D with magnetic vertex snapping. |
| Room zone tagging | `frontend/lib/customArchitecture.ts` | Tag a drawn enclosure as a named room so it takes finishes and labels. |
| Layout lock | `frontend/components/TopRibbonTaskbar.tsx` | Freezes room positions and walls against accidental dragging. Hotkey `L` in the 3D view. |

## 16. 2D Blueprint View

`frontend/components/Blueprint2DView.tsx`, presets in `frontend/lib/blueprint2dPresets.ts`.

| Feature | Description |
| :--- | :--- |
| Drafting canvas | 1200x850 SVG coordinate system with dimension strings, room area labels in sq ft and sq m, door swing arcs and window callouts. |
| Catalog-driven openings | Door widths come from the same catalog the joiner stocks; 32 in matches the solver's `DOOR_WIDTH_IN`. |
| Floor level pills | Ground / 1F / 2F / Roof switching inside the 2D view. |
| Snapping engine | Vertex, edge and midline snap while drafting. |
| Inspector | Per-element properties for the selected wall or opening. |

## 17. First-Person Walkthrough

| Feature | File | Description |
| :--- | :--- | :--- |
| Walkthrough engine | `frontend/lib/walkthrough.ts` | 4.4 ft eye level, 2.8 ft crouched. Walk 7.5 ft/s, sprint 13.5 ft/s, 1.9 rad/s turn. Head bob, sprint and crouch state. |
| Collision engine | `frontend/components/Scene.tsx` | Iterative push-out resolver on an axis-separated sliding capsule, radius 0.72 ft. Blocks walls, closed doors, and both custom and built-in furniture. Lintels and windows are excluded from obstacles. |
| Interactive doors | `frontend/components/Scene.tsx` | Hinged doors start closed and block passage. Open and close with `E`, a direct mouse click, or the mobile touch button, with an on-screen HUD prompt. |
| Spatial FOV | `frontend/components/Scene.tsx` | 68° walking, 75° sprinting. Replaced a 45° tunnel-vision default. |
| HUD overlay | `frontend/components/WalkthroughOverlay.tsx` | Crosshair, current-room badge, mobile D-pad and action buttons, and a room teleporter list. |
| Room teleport | `frontend/app/page.tsx` | Click any room badge in the HUD or drawer to jump the camera inside it. |
| Interior lights | `frontend/components/Scene.tsx` | `F` toggles interior lighting while walking. |

## 18. Site & Landscaping

| Feature | File | Description |
| :--- | :--- | :--- |
| Site landscaping | `frontend/lib/siteLandscape.ts` | Planting bed, seeded shrubs and a 16 ft entrance driveway on the setback strip, all derived from the plot and the setback the solver honoured — so it can never encroach on the building envelope. Skipped below a 1.6 ft usable setback. |

## 19. Export & Documentation

| Feature | File | Description |
| :--- | :--- | :--- |
| Blueprint export engine | `frontend/lib/blueprintExport.ts` | Vector architectural sheets with title block, room schedule, dimension annotations and CAD callouts. Three themes: blueprint, dark, drafting. Optional Vaastu and furniture layers. Feet-and-inches formatting. |
| Export modal | `frontend/components/BlueprintExportModal.tsx` | 300 DPI SVG and PNG output with north arrow and area summary. |
| 3D screenshot | `frontend/components/TopRibbonTaskbar.tsx` | High-resolution capture from the active camera. |
| BOQ export | `frontend/lib/boqEngine.ts` | CSV export and printable cost report. |
| CLI export | `backend/prompt_to_plan.py` | `--svg` and `--json` from a single prompt, no browser. |

## 20. Persistence

| Feature | File | Description |
| :--- | :--- | :--- |
| Browser-local autosave | `frontend/lib/projectStorage.ts` | Whole design in `localStorage` under `vastu_builder_project_data_v1` — plot, facing, programme, room counts, custom dimensions, drawn walls, room zones, placed objects, materials, openings, window config. Every field optional on read, so an older save still loads. No database and no accounts by design — [[environment-notes]]. |
| Project JSON import/export | `frontend/app/page.tsx` | Full layout out to a file and back in. |

## 21. Keyboard & Input Reference

| Key | Mode | Action |
| :--- | :--- | :--- |
| `V` | 2D canvas | Select & inspect tool |
| `W` | 2D canvas | Point-to-point wall drawer |
| `D` | 2D canvas | Door placer |
| `C` | 2D canvas | Toggle auto-crop while dragging rooms |
| `G` | any | Graphics Control Studio |
| `P` | any | GPU path tracer |
| `U` | any | UPGRADE studio suite |
| `L` | orbit | Day / night lighting; layout lock in the 3D view |
| `R` | any | Rotate placing ghost or selected object 45° |
| `E` | walkthrough | Open / close the nearest door, or inspect the crosshair object |
| `F` | walkthrough | Toggle interior lights |
| `W A S D` / arrows | walkthrough | Move |
| Arrow keys | orbit | Nudge selected object 0.5 ft |
| `Delete` / `Backspace` | orbit | Delete selected object |
| `Esc` | any | Close every modal, cancel placement, deselect |

Shortcuts are suppressed while focus is in an `INPUT`, `TEXTAREA` or `SELECT`.
Mobile walkthrough has an on-screen D-pad and action buttons; the default desktop path never
requires the keyboard — [[zero-keyboard-events]].

## 22. Offline Fallback Solver

`frontend/lib/solve.ts`, `frontend/lib/useSolve.ts`.

A grid-based layout engine that runs in the browser when `NEXT_PUBLIC_SOLVER_URL` is unset or the
API fails. It reports `OFFLINE_ESTIMATE` with an empty rule list and the ribbon shows a warning,
**never** a Vaastu claim it did not enforce. It does not fall through on a non-`ok` response.

## 23. Test & Verification Surface

| Surface | Command | State |
| :--- | :--- | :--- |
| Backend tests | `cd backend && .venv/Scripts/python.exe -m pytest -q` | 93 passing, ~198 s. Covers API, solver, Vaastu, realism, walls, programmes, prompt parsing, stability and the real Kandi plot. |
| Frontend types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Frontend build | `cd frontend && npm run build` | 0 warnings |
| Frontend tests | — | **None exist.** `tsc` and `build` are the whole safety net. |

## 24. Known Limits

Recorded so this file is not a brochure. Full detail in [[project-status]].

- **Single storey.** The multi-floor switcher is renderer geometry; the solver places one floor.
- **No hosted backend.** A deployed visitor gets the offline fallback, not CP-SAT.
- **Setbacks hardcoded** to TG-bPASS defaults.
- **No DWG and no IFC.** Export is SVG, PNG, CSV and JSON only.
- **`Scene.tsx` and `Blueprint2DView.tsx` are ~4,000-line components.**
- **A twelve-room programme** returns FEASIBLE rather than OPTIMAL inside the 2 s cold budget.
- **`test_stability.py` is wall-clock flaky** under CPU load, by design.
- **The AI furniture endpoint ignores the uploaded image.**
