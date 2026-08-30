---
tags: [codebase, moc]
date: 2026-08-23
---
# Codebase map

> [!note] Phase 1 complete, plus an unplanned [[step-6-walkthrough]]. 25/25 tests green.
> This note is the code↔note index. As files land, add a row. The point is that Obsidian's graph
> then shows design notes and the code that implements them as one connected structure rather
> than two disconnected clouds.
>
> **Re-audited 2026-08-25.** Seven modules had landed without a row — the whole walkthrough and
> connectivity surface. Added below. See [[project-status]].

> [!tip] There is now a real graph as well as this hand-kept index
> [[knowledge-graph]] — 435 nodes, 898 edges, built with graphify over code + notes together.
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
| `frontend/components/Scene.tsx` | [[step-1-threejs-shell]], [[architecture]], [[integer-inches]], [[step-6-walkthrough]], [[realism-gaps]] | **done** — envelope, extrusion, drag-and-drop, first-person camera, roof/parapet/chajja, strict exterior-only window filtering, and automatic doorway alignment |
| `frontend/components/TopRibbonTaskbar.tsx` | MS Paint / CAD Ribbon Taskbar | **done** — Architectural drafting tools, furniture catalog, finishes studio, window customizer, and CAD blueprints catalog |
| `frontend/components/Blueprint2DView.tsx` | 2D CAD Drafting Canvas | **done** — Wall drawing, dimension lines, snapping engine, room labels, door/window markers |
| `frontend/components/BlueprintExportModal.tsx` | High-Res CAD SVG & Blueprint Print Engine | **done** — 300 DPI architectural exports, title blocks, dimension annotations |
| `frontend/components/ModelBlueprintsModal.tsx` | Curated Architectural Blueprints Catalog | **done** — 20 prebuilt models, directional filtering, plot size filters |
| `frontend/components/MaterialCustomizerModal.tsx` | Architectural Finishes & Materials Studio | **done** — PBR floors, wallpapers, Venetian stucco, acoustic wood slats |
| `frontend/components/WindowShapeModal.tsx` | Window Architecture & Fenestration Studio | **done** — Palladian, French Casement, Clerestory, Bay, Glass tints, and Curtains |
| `frontend/lib/modelBlueprints.ts` | 20 Curated Architectural Model Blueprints | **done** — 1BHK-4BHK, 20x30 to 50x80, 100% contiguous coordinate matrices |
| `frontend/lib/furnitureCatalog.ts` | Complete 3D Architectural Furniture Catalog | **done** — Sofas, beds, dining sets, fireplaces, planters, kitchen walls |
| `frontend/lib/materialsCatalog.ts` | Material & Surface Finishes Definitions | **done** — Hardwood, marble, slate, stucco, boiserie |
| `frontend/lib/windowCatalog.ts` | Window Fenestration Geometry & Materials | **done** — 8 architectural shapes, 6 frame finishes, 5 glass tints |
| `frontend/lib/customArchitecture.ts` | Custom Freehand Wall Drafting & Room Zone Topology | **done** — 2D vector CAD graph, polygon cycle detection |
| `frontend/lib/plot.ts`, `frontend/lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] | **done** — presets, setback math, edge-facing mapping |
| `frontend/lib/sceneConstants.ts` | fixed 3D geometry, in feet | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneBadges.ts` | canvas→sprite room labels | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/sceneDoorways.ts` | door edge arithmetic; mirrors `_edge_origin()` in [[connectivity.py]] | **done** — extracted from `Scene.tsx` 2026-08-30 |
| `frontend/lib/blueprint2dPresets.ts` | SVG viewport + drafting preset pills | **done** — extracted from `Blueprint2DView.tsx` 2026-08-30 |
| `frontend/lib/projectStorage.ts` | `localStorage` persistence — see [[environment-notes]] | **done** — extracted from `page.tsx` 2026-08-30 |
| `frontend/lib/rooms.ts` | room vocabulary + colours; mirrors `solver/rooms.py` | **done** — 7 kinds |
| `frontend/lib/solve.ts`, `frontend/lib/useSolve.ts` | [[step-3-wire-together]] — 350 ms debounced `POST /solve` | **done** — sends `moved_index`, supports `setRoomPositions()` for contiguous blueprint layouts |
| `frontend/lib/walkthrough.ts` | [[step-6-walkthrough]] | **done** — 5'5" eye level, room detection, spawn |
| `frontend/lib/interiorDetails.ts` | [[step-6-walkthrough]] | **done** — procedural PBR textures, furniture, door-aware placement |
| `frontend/app/page.tsx` | composition root; CAD ribbon, 3D viewport, 2D blueprint modes | **done** |
| `backend/solver/model.py` | [[cp-sat-api]], [[cp-sat-gotchas]], [[layout-stability]] | **done** — placement, drift, Vaastu, relaxation ladder clamped bounds |
| `backend/solver/realism.py` | [[realism-gaps]] | **done** — proportion, daylight/ventilation against the built footprint, area objective |
| `backend/solver/connectivity.py` | [[rooms-do-not-form-a-house]], [[realism-gaps]] | **done** — parent tree, entrance priority, `derive_openings`, `derive_windows` |
| `backend/solver/rooms.py` | `Room` dataclass, `ROOM_CATALOG` | **done** — **7 room kinds**, each carrying `habitable` / `wet` / `max_aspect_x10` |
| `backend/vaastu/rules.py` | [[vaastu-as-constraints]] | **done** — corrected Ishanya NE pooja quadrant coordinates |
| `backend/api/main.py` | `POST /solve`, [[output-schema]] | **done** — [[step-3-wire-together]] |
| `backend/tests/` | [[test-baseline]] | **43/43 passing** (100%) |

Each module folder (`frontend/README.md`, `backend/README.md`, and per-submodule READMEs under
`backend/`) carries the wikilinks back into this vault, per the convention above.

Ignored by the vault: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, `.next/`
(set in `.obsidian/app.json`).

## Size, re-measured 2026-08-30

Backend **2,274** lines of Python (including 672 of tests). Frontend **20,617** lines of
TS/TSX plus **6,005** of CSS. The earlier "~10,000 lines frontend" figure was roughly half the
real number.

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
