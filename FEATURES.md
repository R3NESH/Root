---
tags: [features, moc, documentation]
date: 2026-09-19
status: current
---

# plot-to-plan — Complete Feature Inventory

Every shipped capability, grouped by subsystem, with the file that owns it.

Verified against the working tree on 2026-09-19. Counts were read out of the source, not carried
over from earlier notes.

This file and [TOOLS.md](TOOLS.md) are the only two inventories. A third,
`notes/features-and-tools.md`, was deleted on 2026-09-19: it had been superseded since
2026-09-05 but still carried `status: complete` and was still what [[Home]] and [[project-status]]
pointed readers at. Two inventories that disagree are worse than one that is merely incomplete.

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
| Relaxation ladder | `backend/solver/model.py` | On infeasibility drops, in order: zoning, daylight, then area preference. **Connectivity is never dropped.** The response reports which rules were relaxed. |
| L1 drift objective | `backend/solver/model.py` | Minimises total Manhattan displacement from the previous solution so an edit does not reshuffle the house. Weighted 100,000x against area preference. A dragged room is released from its zone quadrant; every other room stays constrained. |
| Compact footprint objective | `backend/solver/model.py` | Linear half-perimeter penalty. Cut inner void from 28% to 5-7% and stopped loose pavilion layouts. |
| Zone rules engine | `backend/zoning.py` | Directional half-plane constraints posted **before** the search, per programme. A zone rule is a constraint, never a score. The residence posts none; the café posts its service-flow bands. |
| Connectivity graph | `backend/solver/connectivity.py` | Star topology with parent hierarchies — master ensuite hangs off the bedroom, common bath off the hall. 100% room reachability enforced. |
| Openings extractor | `backend/solver/connectivity.py` | Computes shared-wall intervals and exterior exposure, emitting exact coordinates for interior doors, the main entrance and exterior windows. 32 in door leaf (`DOOR_WIDTH_IN`). |
| Daylight & ventilation | `backend/solver/realism.py` | Every habitable **and wet** room must touch the exterior face of the built footprint. Stores exempt. Measured against the footprint, not the plot boundary. |
| Aspect-ratio limits | `backend/solver/realism.py` | Per-kind proportion caps prevent corridor-shaped rooms. Worst observed 2.4:1. |
| NBC 2016 room catalog | `backend/solver/rooms.py` | Real Indian statutory minimums — hall 10x12, kitchen 7x8, bath 4x6 — replacing artificial test sizes. |
| Buildable envelope | `backend/envelope/envelope.py` | Applies per-edge setbacks from plot dimensions and road facing. TG-bPASS defaults: 5 ft road, 3 ft rear and sides. |
| Convex polygon plots | `backend/envelope/polygon.py` | A plot that is not a rectangle becomes one integer half-plane per edge, `a·x + b·y <= c`, inset by that edge's setback. Containment is then one linear constraint per room per edge — no polygon intersection at solve time. Up to 32 corners (`MAX_VERTICES`, raised from 12 on 2026-09-19). **Convex only**, which is what half-plane intersection means, not a gap — [[plot-shapes-are-convex]]. |
| Multi-storey packing | `backend/api/main.py` `assign_floors()` | Spreads the mix over up to `MAX_FLOORS = 3` storeys, ground first. Connectivity, separation and daylight are posted per floor, because a bedroom is not reachable from a hall one storey below it. `meta.floors_solved` reports what was actually packed. |
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
| Programme registry | `backend/programs/registry.py` | Building types as data — hub room, parent tree, forbidden pairs and directional rules per programme. Two shipped: **Residence** (no directional zoning) and **Café** (service-flow zoning). Unknown keys fall back to Residence rather than erroring. |
| Programme mirror (TS) | `frontend/lib/programs.ts` | Space vocabulary, default mix and per-space ceilings the ribbon offers for the active programme. |
| Room vocabulary | `frontend/lib/rooms.ts` | 18 room kinds. Residence: hall, dining, kitchen, bedroom, bathroom, store, entrance. Café: seating, lounge, entry, queue, counter, prep, pantry, wash, washroom, staff. |
| Café procedural fit-out | `frontend/lib/cafeInteriors.ts` | Seating grid at ADA/trade clearances, service counter with order-to-pickup split, commercial kitchen, queue line, WC. |

## 4. Natural-Language Input

| Feature | File | Description |
| :--- | :--- | :--- |
| Prompt-to-plan parser | `backend/prompt_to_plan.py` | Parses prompts like `"30x40 north facing 2bhk with a store"` into plot dimensions, facing and a room mix, then solves. |
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
| Plot picker | `frontend/components/PlotPicker.tsx` | Preset cards plus steppers — [[zero-keyboard-events]]. Clamped to legal min/max dimensions. |
| Typed plot dimensions | `frontend/components/TopRibbonTaskbar.tsx` | **Home** tab, "Plot Dimensions" panel. Width and depth as number inputs alongside the steppers. A surveyed plot is 33'6\" and reaching that a foot at a time is not a size control. The tap path is untouched, so [[zero-keyboard-events]] still holds for anyone who does not type. |
| Plot Shape studio | `frontend/components/PlotShapeModal.tsx` | Describe the plot by **walking its boundary**: one row per side — how long it runs, which way it turns at the corner after it, how far it bows. Live preview, enclosed area, and a closure check. Nothing is written to the plot until Apply. |
| Boundary traverse model | `frontend/lib/plotTraverse.ts` | The geometry behind that studio. Converts between an outline's corners and a list of sides, derives each side's compass face from the winding, and reports how far a walk misses its own starting corner. Turns are floats, not integer degrees — a length is measured, a turn is derived, and rounding one opened a 5 in gap in a preset. |
| Plot shape presets | `frontend/lib/plotTraverse.ts` | Rectangle, cut corner, tapered, curved front — the shapes Indian plots actually come in. Each closes to within an inch on every plot size tested, so picking one never leaves a gap to fix. |
| Closure check | `frontend/lib/plotTraverse.ts` `closureErrorIn()` | A traverse whose turns do not sum to 360° does not return to where it started. The gap is drawn dashed in the preview and stated in feet, with a "Close the loop" action, rather than being silently absorbed by moving a corner the user did not touch. |
| Corner splays | `frontend/lib/plot.ts` | Four symmetric corner cuts, clockwise from north-west — the ordinary corner-plot and bend-plot shapes. Superseded by a drawn outline when there is one. |
| Drawn plot outlines | `frontend/lib/plot.ts` | `PlotDims.vertsIn` carries hand-placed corners; `edgeBulgeIn` bows each edge outward. Both override the splays. Width and depth then mean the outline's bounding box. |
| Curved plot edges | `frontend/lib/plot.ts` | Each bowed edge is tessellated as a quadratic Bézier into chords, because chords are all CP-SAT can be given. The chord budget is shared between bowed edges so a second bow cannot push the outline past the corner cap. |
| Integer-rounding repair | `frontend/lib/plot.ts` `convexHull()` | Rounding a sampled curve onto the inch lattice reverses the turn between short chords, and the solver then refuses the whole outline — measured: a 6 ft bow breaks at 22 chords. The hull of the rounded points is convex by construction. Applied **only** when the un-bowed outline was already convex and every bow points outward, so a dent the user drew on purpose is never silently straightened. |
| Unsolvable-shape warning | `frontend/lib/plot.ts` `plotShapeProblem()` | `buildable_polygon()` returns `None` for an outline it will not take and the API falls back to the bounding rectangle, silently. This names which of the three reasons applies — too few corners, past the cap, or concave — and the 2D view shows it as a banner that does not time out. |
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
| Drone tour | `frontend/lib/cameraTour.ts` — one button flies the camera: a high orbit of the plot, a descent onto the front door, then room by room and back out. The interior leg is a depth-first **walk** over the doorway graph, so consecutive rooms always share a wall and the camera never crosses masonry; a breadth-first *ordering* does not have that property, and was the first version's bug. Nothing is hand-animated — the path is derived from the solved plan, the doors stand open for it, and OrbitControls is disabled so it cannot drag the camera off the path. Progress bar with Stop, or Esc. One storey per tour: there is no stair routing yet. |

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
| Furniture catalog | `frontend/lib/furnitureCatalog.ts` | **133 pieces** — 106 residential and 27 café. Residential by category: living 23, decor 15, walls 11, bedroom 10, kitchen 9, lighting 8, dining 8, stairs 7, appliance 5, office 4, bath 4, soft 2. Counted from source 2026-09-19; this row said 70 and was stale. The left rail offers whichever set the active programme names. |
| Real furniture models | `frontend/lib/furnitureModels.ts` | Maps catalog and built-in types onto **62 CC0 Poly Haven models** (49 MB), swapped in after the layout builds. 24 added 2026-09-19 into the thinnest categories, each one's catalog dimensions **measured out of its own glTF** rather than estimated — [[furniture-models]]. Additive: an unmapped type or a failed load keeps its procedural geometry, and that placeholder is now sized from the catalog instead of a fixed 2 ft cube. Models are metric; only a unit conversion is applied, never a fit-to-declared-box that would distort them. |
| Auto fit-out | `frontend/lib/interiorDetails.ts` | Every room type furnished on solve — Scandinavian living room, king bedroom with study workstation, modular L-kitchen with chimney and appliances, 6-seater dining, deluxe bath with washing machine. |
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
| CAD tool state | `frontend/lib/customArchitecture.ts` | One shared tool union — `select`, `draw_wall`, `place_door`, `place_window`, `tag_room`, `draw_stair`. |
| Custom wall types | `frontend/lib/customArchitecture.ts` | Exterior, interior, glass, slat, arch, curved, curved glass, curved slat. |
| Wall drawing | `frontend/components/Scene.tsx`, `frontend/components/Blueprint2DView.tsx` | Draw partitions and perimeter walls in 2D or 3D with magnetic vertex snapping. |
| Room zone tagging | `frontend/lib/customArchitecture.ts` | Tag a drawn enclosure as a named room so it takes finishes and labels. |
| Stair from a walk line | `frontend/lib/stairPath.ts`, `frontend/lib/stairCatalog.ts` | Click the line a person walks up — bottom, each turn, top — then Enter. 2 points give a straight flight, 3 at 90° an L, 3 at 180° a dog-leg, 4 a U; a cross leg too short to carry steps becomes the landing. Riser count comes from the actual floor-to-floor height, so a taller storey gets more steps rather than steeper ones. A path that cannot meet NBC 2016 (riser ≤ 190 mm, going ≥ 250 mm, flight ≥ 0.90 m, landing ≥ flight width) is **refused with the reason**, never built shallower. Works in the 2D blueprint and in 3D; flight width 3'0" to 4'6". |
| Stair storage | `frontend/lib/customArchitecture.ts` | `DrawnStair` holds the walk line, not a footprint, and is solved on read. A stair is the one object that must never be scaled — the step size is fixed by code, so what a bigger opening changes is the number of steps. Saved, restored and undone with the rest of the document. |
| Layout lock | `frontend/components/TopRibbonTaskbar.tsx` | Freezes room positions and walls against accidental dragging. Hotkey `L` in the 3D view. |

## 16. 2D Blueprint View

`frontend/components/Blueprint2DView.tsx`, presets in `frontend/lib/blueprint2dPresets.ts`.

| Feature | Description |
| :--- | :--- |
| Live Plan | `H`, or the "Live Plan" button in the mode switcher, opens the blueprint beside the 3D orbit instead of in place of it. Both views read the same state, so a wall or stair drawn in 2D is already in the scene graph — nothing to sync. Orbit only: blueprint mode already is the window, and walkthrough is meant to be inside the house. The keyboard goes to whichever pane the pointer is over, because both views bind their own `keydown` and one Enter would otherwise build two stairs. Fixed pane width, no drag handle yet. |
| Drafting canvas | 1200x850 SVG coordinate system with dimension strings, room area labels in sq ft and sq m, door swing arcs and window callouts. |
| Catalog-driven openings | Door widths come from the same catalog the joiner stocks; 32 in matches the solver's `DOOR_WIDTH_IN`. |
| Floor level pills | Ground / 1F / 2F / Roof switching inside the 2D view. |
| Snapping engine | Vertex, edge and midline snap while drafting. |
| Inspector | Per-element properties for the selected wall or opening. |
| Plot shape editor | "Plot Shape" toggle. Drag a corner to move it, drag an edge's dot to bow it, double-click a dot to add a corner, right-click a corner to remove one. The straight skeleton is drawn behind the real outline so it is clear what a drag moves. "Reset Shape" returns to a plain rectangle. |
| Outline-aware sheet scaling | The sheet is scaled to the drawn outline's bounding box rather than to the typed width and depth. Bowing an edge outward makes the plot larger than those two numbers, and without this a bowed plot is drawn off the edge of the paper. |

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
| Landscape tab | `frontend/components/TopRibbonTaskbar.tsx` | Ribbon tab beside Interior. Three panels: Planting (tree, palm, hedge, shrub, planter), Ground (paving bay, stepping path, gravel bed), Boundary & Site (compound wall, main gate, bollard light). |
| Landscape pieces | `frontend/lib/furnitureCatalog.ts` | Eleven `landscape` catalog items with procedural meshes. Placed through the existing furniture path — the click raycasts the ground plane, not a room floor, so a piece drops anywhere on the plot. The category is in no programme's `furnitureCategories`, so it never reaches the interior rail. |

## 19. Export & Documentation

| Feature | File | Description |
| :--- | :--- | :--- |
| Blueprint export engine | `frontend/lib/blueprintExport.ts` | Vector architectural sheets with title block, room schedule, dimension annotations and CAD callouts. Three themes: blueprint, dark, drafting. Optional furniture layer. Feet-and-inches formatting. |
| Reflected ceiling plan | `frontend/lib/ceilingPlan.ts` | The ceiling drawn reflected — same orientation as the floor plan — with every ceiling-mounted fixture off the model, a setting-out grid, and a legend. Symbols follow the common set: circle-in-circle for a recessed downlight, crossed square for a surface fixture, circle on a stem for a pendant, blades for a fan. |
| Proposed downlight layout | `frontend/lib/ceilingPlan.ts` | A general-lighting grid at ceiling height ÷ 2 capped at 6 ft, laid on cell centres so the border is never tight to a cornice. Drawn dashed and labelled "proposed" everywhere it appears, including the schedule. Toggleable. |
| Illuminance check | `frontend/lib/ceilingPlan.ts` | Average lux per room by the lumen method, `E = N × lumens × UF × MF ÷ area`, against the IS 3646 target for that room kind. Hall 100-200, kitchen 300-500, bedroom 100-150, bathroom 300-500; a room kind with no published figure is reported **not assessed** rather than given an invented target — [[lighting-says-the-number]]. UF, MF and lamp outputs are assumptions and are printed on the sheet. A fan is drawn and counts zero lumens. |
| Ceiling fixture schedule | `frontend/components/CeilingPlanModal.tsx` | Every fixture with room, type, position, mount height and assumed output, plus the illuminance check with its source, to CSV. |
| Finish board | `frontend/lib/moodboard.ts` | The scheme on one page: palette strip, floor / wall paint / wall finish / joinery swatches large enough to judge, and every piece of furniture drawn front-on **at one shared scale** off its measured box, labelled in feet-inches and mm. Collage tools arrange cutouts by eye and lose the comparison; this keeps it — [[board-is-drawn-to-one-scale]]. Whole-house or per-room, with a print pack of every board. |
| Interior elevations | `frontend/lib/elevations.ts` | One elevation per wall per room, drawn flat and straight on: wall outline, floor and ceiling lines, every opening with its sill and head height, furniture in silhouette with heights called out, and dimension strings along and up the wall. Each wall is drawn looking at it from inside the room, so left-to-right flips per wall — [[elevations-look-from-inside]]. Pieces more than 4 ft off the wall are left out; solid outlines are against the wall, dashed ones stand in front of it. |
| Elevation sheet set | `frontend/components/ElevationsModal.tsx` | Wall list grouped by room with a live sheet preview. SVG, high-resolution PNG or print for one wall, and a print set that puts every elevation on its own page. Reuses the blueprint sheet's own exporters. |
| Clearance audit | `frontend/lib/clearances.ts` | Measures every gap — piece to piece, piece to wall, and the clear floor inside each door — and reports what falls below the minimum. Kitchen work aisle 42 in, walkway 36 in and seating pull-out 36 in are cited to the NKBA Kitchen Planning Guidelines; bedside passage 24 in and clear floor at a door 36 in say **Trade practice, no published source** rather than borrowing an authority — [[cite-the-clearance-or-admit-it]]. A room with nothing in it is listed as unchecked, never counted as a pass. |
| Clearance report | `frontend/components/ClearanceAuditModal.tsx` | Findings worst-first with measured against required and the shortfall in inches, a rules tab with every source linked, and CSV export. |
| FF&E schedule | `frontend/lib/designSchedule.ts` | Every piece of furniture, fixture and equipment, room by room, with quantity, measured size in feet-inches **and** millimetres, finish, and whether it came from the automatic fit-out, the catalog or the AI modeller. Identical pieces in a room group into one line with a count. Sizes are taken off the built scene, not the catalog, so a dining set the fit-out shrank to leave a walkway is scheduled at the size it was built — [[schedule-is-measured-not-declared]]. |
| Finish schedule | `frontend/lib/designSchedule.ts` | Per room: floor, wall paint, wall texture, door finish, carpet area and gross paint area, with band, glazing and wet-area notes. Resolved room-then-building out of `HouseMaterialConfig`, the same order the renderer resolves. |
| Schedule export | `frontend/lib/designSchedule.ts` | Both tables to one CSV, or to a printable spec sheet. |
| Export modal | `frontend/components/BlueprintExportModal.tsx` | 300 DPI SVG and PNG output with north arrow and area summary. |
| 3D screenshot | `frontend/components/TopRibbonTaskbar.tsx` | High-resolution capture from the active camera. |
| BOQ export | `frontend/lib/boqEngine.ts` | CSV export and printable cost report. |
| CLI export | `backend/prompt_to_plan.py` | `--svg` and `--json` from a single prompt, no browser. |

## 20. Persistence

| Feature | File | Description |
| :--- | :--- | :--- |
| Browser-local autosave | `frontend/lib/projectStorage.ts` | Whole design in `localStorage` under `plot_to_plan_project_data_v1` — plot, facing, programme, room counts, custom dimensions, drawn walls, room zones, placed objects, materials, openings, window config. Every field optional on read, so an older save still loads. No database and no accounts by design — [[environment-notes]]. |
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
| `Esc` | any | Put down whatever tool is held — a catalog piece, an opening, or a drafting mode — and remember it. Also clears the selection, any open modal and the drone tour. |
| `Ctrl+Z` | any | Undo — **except** immediately after `Esc` put a tool down with nothing edited since, when it picks that tool back up instead. The memory is consumed, so a second press undoes. A pill names the tool while the offer stands. |
| `H` | orbit | Live Plan — blueprint beside the 3D view |
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
**never** a rule claim it did not enforce. It does not fall through on a non-`ok` response.

## 23. Test & Verification Surface

| Surface | Command | State |
| :--- | :--- | :--- |
| Backend tests | `cd backend && .venv/Scripts/python.exe -m pytest -q` | **178 passing**, ~257 s. Covers API, solver, zoning, realism, walls, programmes, polygon and curved plots, prompt parsing, stability and the real Kandi plot. |
| Frontend types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Frontend build | `cd frontend && npm run build` | 0 warnings |
| Frontend tests | — | **None exist.** `tsc` and `build` are the whole safety net. |

## 24. Known Limits

Recorded so this file is not a brochure. Full detail in [[project-status]].

- **Three storeys, not one.** This file said "single storey" until 2026-09-19; it was wrong. `assign_floors()` spreads the mix over up to `MAX_FLOORS = 3` and posts connectivity and daylight per floor. What is *not* solved is the Terrace level, which stays a drafting surface.
- **Plots must be convex.** An L-shaped plot, a dented one, or the inside of a cul-de-sac cannot be expressed at all — half-plane intersection is convex by definition. The UI says so rather than quietly packing the bounding rectangle — [[plot-shapes-are-convex]].
- **An inward-bowed plot edge is drawable and unsolvable.** Same reason, same warning.
- **No hosted backend.** A deployed visitor gets the offline fallback, not CP-SAT.
- **Setbacks hardcoded** to TG-bPASS defaults.
- **No DWG and no IFC.** Export is SVG, PNG, CSV and JSON only.
- **No sanitaryware and no soft furnishing worth the name.** Bath is 4 pieces, soft furnishing 2.
  Poly Haven's full index has neither category, so this cannot be fixed from the current source —
  [[object-library-licensing]].
- **`Scene.tsx` and `Blueprint2DView.tsx` are ~4,000-line components.**
- **A five-room programme** already returns FEASIBLE rather than OPTIMAL inside the 2 s cold budget on a 40x50 plot. This file said twelve; measured on 2026-09-19 it starts at five, and the plot outline's edge count is not what costs the time — the budget is.
- **The offline fallback ignores the plot outline entirely.** It packs an axis-aligned grid, reports `OFFLINE_ESTIMATE` and claims nothing — [[client-side-fallback]].
- **`test_stability.py` is wall-clock flaky** under CPU load, by design.
- **The AI furniture endpoint ignores the uploaded image.**
