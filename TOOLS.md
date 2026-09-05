---
tags: [tools, moc, documentation]
date: 2026-09-05
status: current
---

# plot-to-plan — Complete Tool Inventory

Every instrument a person can pick up and operate, grouped by where it lives.

A **tool** here is something you invoke: a button, a mode, a studio, a script. The capabilities
they drive are in [FEATURES.md](FEATURES.md).

Verified against the working tree on 2026-09-05. Labels are quoted from the source.

**Contents**

1. [Top Ribbon Taskbar](#1-top-ribbon-taskbar)
2. [Left Tool Rail](#2-left-tool-rail)
3. [3D Viewport Tools](#3-3d-viewport-tools)
4. [2D CAD Canvas Tools](#4-2d-cad-canvas-tools)
5. [Selection Inspector](#5-selection-inspector)
6. [Studios & Modals](#6-studios--modals)
7. [Drawers & Shelves](#7-drawers--shelves)
8. [Input Panels](#8-input-panels)
9. [Walkthrough Controls](#9-walkthrough-controls)
10. [Export Tools](#10-export-tools)
11. [Backend CLI Tools](#11-backend-cli-tools)
12. [Developer & Verification Tools](#12-developer--verification-tools)
13. [Keyboard Tool Bindings](#13-keyboard-tool-bindings)

---

## 1. Top Ribbon Taskbar

`frontend/components/TopRibbonTaskbar.tsx`. Flat CAD ribbon: application bar, tab strip, panel
shelf, selection inspector. Four tabs — **Home**, **Structure**, **Blueprints**, **AI Prompt**.

| Tool | Label in app | What it does |
| :--- | :--- | :--- |
| View switcher — 3D | "3D Aerial Orbit View" | Orbit camera over the plan. |
| View switcher — 2D | "2D CAD Architectural Blueprint" | Switch to the drafting canvas. |
| Walkthrough | "First-Person Walkthrough (5'5\" Eye Level)" | Enter first-person mode. |
| Auto-furnish | "Auto-furnish rooms with sofas, beds, counters & fans" | Fit out every solved room in one click. |
| Start from scratch | "Clear automated rooms and start with a 100% clean plot to draft your custom house" | Drops solver output, leaves a bare plot for freeform drafting. |
| Reset layout | "Wipe current layout & reset to clean default" | Back to defaults. |
| Blueprint browser | "Browse 100% Vastu Architectural Model Blueprints" | Opens the curated catalog. |
| BOQ | "Engineering Bill of Quantities (BOQ) & Cost Estimation" | Opens the cost studio. |
| Export | "Export the blueprint sheet: JSON model, SVG, high-res PNG, or print to PDF. No DXF yet." | Opens the export modal. |
| Graphics | "Graphics & Performance Control (Press 'G')" | Opens the graphics studio. |
| Path tracer | "Toggle Real-Time GPU Path Tracer & Global Illumination (Press 'P')" | Progressive raytraced render. |
| UPGRADE | "Toggle Photorealistic Studio Upgrade (Press 'U')" | Swap CAD blocks for the photoreal suite. |
| Ultra textures | "Toggle 4K Ultra Textures & 16x Anisotropic Filtering" | One-switch texture quality jump. |
| Room dimensions | "Open Fine-Grained Room Dimensions Studio" | Per-room width/depth editor. |
| Wall demolition | "Open Multi-Room Window & Wall Demolition Studio" | Open walls into passages, or restore them. |
| Restore wall | "Back to a solid wall" | Undo a demolition. |
| Wall bands | "Open Custom Wall Partitions & Permutations Studio" | Multi-band paint comparison. |
| Openings shelf | "Open Doors & Windows Catalog Shelf (Drag & Drop onto any wall)" | Opens the CAD openings drawer. |
| Window span crops | "Crop Window Span to 3.0 / 4.0 / 5.0 / 6.0 ft" | Slender, Standard, Wide, Panoramic. |
| Glaze wall | "Glaze the wall itself" | Turn the selected wall to glass. |
| Glaze door | "Glaze the door in this wall" | Turn just the door leaf to glass. |
| Glass type | "Glass type" | Pick the glazing style and tint. |
| Layout lock | — | Freeze room positions against accidental drags. |
| Screenshot | — | High-resolution capture from the active camera. |

## 2. Left Tool Rail

`frontend/components/LeftToolRail.tsx`. Docked icon rail; each icon opens a flyout panel. The rail
offers the residence set or the café set depending on the active programme.

### Residence panels

| Panel | Tooltip |
| :--- | :--- |
| Living | "Sofas, tables & living room objects" |
| Bed | "Beds, wardrobes & bedroom objects" |
| Dining | "Dining tables, chairs & servers" |
| Kitchen | "Counters, appliances & kitchen units" |
| Office | "Desks, chairs & study units" |
| Decor | "Plants, lighting, rugs & wall art" |
| Mandir | "Pooja mandir & sacred objects" |
| Divide | "Partitions, screens & room dividers" |

### Café panels

| Panel | Tooltip |
| :--- | :--- |
| Seating (Living slot) | "Tables, chairs, banquettes & bar stools" |
| Service | "Counter kit: espresso, till, display, condiments, retail" |
| Back | "Back of house: fridge, prep bench, racking, ice" |
| Signage | "Menu boards & pavement signs" |
| Terrace | "Outdoor covers, rope line & bike rack" |
| Covers / Decor | "Lighting, planting, neon & wall art" |

### Always available

| Panel | Tooltip |
| :--- | :--- |
| Finish | "Floors, wall paint, door colours & themes" |
| Manage | "Placed objects, AI modelling & cleanup" |

### Rail actions

| Tool | Label |
| :--- | :--- |
| Custom wall colour | "Custom wall colour" |
| Custom door colour | "Custom door colour" |
| Wall permutations | "Custom wall partition permutations & combinations" |
| Restore built-ins | "Bring back every deleted built-in furniture piece" |
| Clear placed objects | "Remove every object you placed" |

## 3. 3D Viewport Tools

`frontend/components/Scene.tsx`.

| Tool | What it does |
| :--- | :--- |
| Room drag | Drag any solved room; the solver re-solves with the L1 drift objective so only that room moves. |
| Plot resize handles | Drag 3D handles to change plot width and depth, with boundary validation. |
| Object gizmos | Move, rotate 45°/90°, scale, duplicate, delete a placed object, with collision guides. |
| Smart wall snap | Live snapping to room edges, dividers, open passages, custom walls and midlines, with a guide line and a named snap type. |
| Wall picker | Click a wall to demolish, glaze, band-paint, or host an opening. |
| Dollhouse cutaway | Slice walls to section height for a top-down room overview. |
| Day / night toggle | Sky dome and lighting swap. Hotkey `L`. |
| Floor switcher | Ground / 1F / 2F / Terrace Roof. |
| Performance HUD | FPS, frame time, render resolution, estimated VRAM. |
| Minimap | `frontend/components/Minimap.tsx` — top-down radar with player position and FOV cone. |

## 4. 2D CAD Canvas Tools

`frontend/components/Blueprint2DView.tsx`. This is the drafting toolset proper.

### Drafting tools

| Tool | Label | Key |
| :--- | :--- | :--- |
| Select & inspect | "Select & Inspect Objects (V)" | `V` |
| Wall drawer | "Point-to-Point Wall Drawer (W)" | `W` |
| Door placer | "Place Doors onto Walls (D)" | `D` |
| Window placer | "Place Windows onto Walls" | — |
| Room tagger | "Tag and Label Room Zone with Area sq ft" | — |

### Modifiers

| Tool | Label |
| :--- | :--- |
| Curved wall | "Toggle Curved Wall Arc" |
| Arc curvature | "Increase / Decrease Arc Curvature" |
| Room width | "Increase / Decrease Width" |
| Room depth | "Increase / Decrease Depth" |
| Fine width | "Increase / Decrease width by 2 inches" |
| Room rotate | "Rotate Room Clockwise (+90°)" / "Anticlockwise (-90°)" |
| Auto-crop | "Auto-Crop room dimensions when dragging across map boundaries (Press 'C' to toggle)" |
| Delete wall | "Delete this wall" |
| Clear walls | "Clear all custom drawn walls" |
| Deselect | "Deselect" |

### Overlays

| Tool | Label |
| :--- | :--- |
| Vaastu mandala | "Toggle 9-Zone Vaastu Mandala Grid" |
| Dimensions | "Toggle Dimension Lines & Strings" |
| Room labels | "Toggle Room Names & Areas" |
| Setbacks | "Toggle Setback Boundary & Offsets" |

### Canvas & data

| Tool | Label |
| :--- | :--- |
| Zoom | "Zoom In" / "Zoom Out" |
| Fit view | "Reset View Fit" |
| Blank plot | "Start with a blank plot (clears automated solver rooms)" |
| Load prebuilt | "Exit scratch mode and load a prebuilt Vastu floor plan model" |
| Blueprint browser | "Browse pre-designed architectural model blueprints or import custom plans" |
| JSON import | "Import a blueprint JSON file directly into 2D Layout" |

## 5. Selection Inspector

Ribbon-hosted panel that appears when something is selected.

| Tool | Label |
| :--- | :--- |
| Nudge | "Nudge Position (or use Arrow Keys)" — "Move North (-Z)", "South (+Z)", "East (+X)", "West (-X)" |
| Rotate | "Rotate 45°" |
| Scale | "Scale Up (+10%)" / "Scale Down (-10%)" |
| Replace | "Replace with another object" |
| Delete | "Delete selected object" / "Delete selected window" |
| Deselect | "Deselect" |

## 6. Studios & Modals

| Studio | File | Purpose |
| :--- | :--- | :--- |
| Graphics Control Studio | `GraphicsControlModal.tsx` | Resolution scale, texture resolution, shadow map size, tone mapping, anisotropy, quality presets. Hotkey `G`. |
| Materials & Finishes Studio | `MaterialCustomizerModal.tsx` | Floor finishes, wall paint, door colours, and five one-click design themes. |
| Window Shapes & Frames Studio | `WindowShapeModal.tsx` | 8 shapes, 6 frame finishes, 5 glass tints, curtains. |
| Custom Wall Blend Studio | `CustomWallBlendModal.tsx` | 2-6 paint bands per wall, axis swap, per-band colour, designer palettes, random permutation. |
| Room Dimensions Studio | `RoomDimensionsModal.tsx` | Per-room width and depth table with live editing. |
| BOQ & Cost Studio | `BOQCostModal.tsx` | Quantity and cost breakdown by category, three quality tiers, CSV export, printable report. |
| Blueprint Catalog | `ModelBlueprintsModal.tsx` | 20 residential models and 8 café plans, filtered by facing and plot size. |
| Blueprint Export Studio | `BlueprintExportModal.tsx` | 300 DPI SVG/PNG sheets, title block, north arrow, area summary, three themes. |
| AI Furniture Studio | `AIFurnitureStudioModal.tsx` | Upload an image, edit the prompt, generate a parametric 3D piece, spawn it into the scene. |
| Replace Object | `ReplaceObjectModal.tsx` | Swap a placed piece for another catalog item in place. |

## 7. Drawers & Shelves

| Drawer | File | Contents |
| :--- | :--- | :--- |
| CAD Openings | `DoorsWindowsDrawer.tsx` | "CAD OPENINGS" shelf — 7 doors and 7 windows for drag-and-drop onto any wall, plus a jump to the Window Shapes studio and a "Cancel placement mode (ESC)" escape. |
| Furniture flyouts | `LeftToolRail.tsx` | Per-category drag-and-drop shelves, 70 pieces total. |

## 8. Input Panels

| Panel | File | Purpose |
| :--- | :--- | :--- |
| Plot picker | `PlotPicker.tsx` | Preset plot cards plus width/depth steppers, clamped to legal dimensions. |
| Compass dial | `CompassDial.tsx` | Rotating ring to set road facing. |
| Room tray | `RoomTray.tsx` | One stepper per room kind, max 4 each. |
| Room customizer | `RoomCustomizer.tsx` | Target width and depth per room, fed to the solver as a preference. |
| AI Prompt tab | `TopRibbonTaskbar.tsx` | Natural-language plan request posted to `/solve-prompt`. |

## 9. Walkthrough Controls

`frontend/components/WalkthroughOverlay.tsx` and `frontend/lib/walkthrough.ts`.

| Tool | Control |
| :--- | :--- |
| Move | `W A S D` or arrow keys; on-screen D-pad on mobile |
| Look | Mouse; drag on mobile |
| Sprint | Hold to run at 13.5 ft/s, FOV widens to 75° |
| Crouch | Drop to 2.8 ft eye level |
| Open / close door | `E`, direct click, or the mobile action button, with a HUD prompt |
| Interior lights | `F` |
| Room teleport | Click a room in the HUD list to jump inside it |
| Crosshair inspect | `E` on a piece of furniture to read it |
| Room badge | Live readout of the room you are standing in |

## 10. Export Tools

| Tool | Where | Output |
| :--- | :--- | :--- |
| Blueprint sheet export | `BlueprintExportModal.tsx` | SVG, high-res PNG, print to PDF, JSON model. **No DXF** — the button says so. |
| BOQ export | `BOQCostModal.tsx` | CSV and printable cost report |
| 3D screenshot | ribbon | PNG from the active camera |
| Project save / load | `frontend/lib/projectStorage.ts`, `frontend/app/page.tsx` | Full-design JSON; `localStorage` autosave under `vastu_builder_project_data_v1` |
| CLI sheet export | `backend/prompt_to_plan.py` | `--svg`, `--json` |

## 11. Backend CLI Tools

Run from `backend/`, inside the venv.

| Tool | Command | Purpose |
| :--- | :--- | :--- |
| Prompt-to-plan | `python prompt_to_plan.py "30x40 north facing 2bhk with pooja"` | Parse a plain-English brief, solve it, print an ASCII preview. Add `--svg plan.svg --json plan.json` for files. |
| Solver demo | `python -m solver.demo` | Solve a default 4-6 room mix in a fixed 30x40 ft envelope and print the JSON. |
| Realism benchmark | `python -m solver.bench_realism` | Feasibility, fill vs catalog ceiling, wet-room spread, through-private rooms and worst aspect across 7 scenarios. |
| Stability benchmark | `python -m solver.bench_stability` | Layout drift across repeated edits. |
| API server | `.venv/Scripts/python.exe -m uvicorn api.main:app --reload` | FastAPI on port 8000. |

## 12. Developer & Verification Tools

| Tool | Command | Notes |
| :--- | :--- | :--- |
| Full dev launcher | `./dev.ps1` | Starts FastAPI on :8000 and Next.js on :3000 in two PowerShell windows. |
| Frontend dev server | `cd frontend && npm run dev` | |
| Type check | `cd frontend && npx tsc --noEmit` | The only real frontend check. |
| Production build | `cd frontend && npm run build` | Second half of the frontend safety net. |
| Lint | `cd frontend && npm run lint` | ESLint. |
| Backend tests | `cd backend && .venv/Scripts/python.exe -m pytest -q` | 93 tests. `test_stability.py` is wall-clock flaky under load, by design. |
| Knowledge graph | `graphify --update` from the repo root | Rebuilds the code+notes graph. **Gotcha:** graphify skips any folder named `build/`; `notes/build/` here is design documentation, so lift `"build"` out of `_SKIP_DIRS` or the whole Phase 1 plan vanishes silently. |

## 13. Keyboard Tool Bindings

| Key | Mode | Tool |
| :--- | :--- | :--- |
| `V` | 2D canvas | Select & inspect |
| `W` | 2D canvas | Point-to-point wall drawer |
| `D` | 2D canvas | Door placer |
| `C` | 2D canvas | Toggle auto-crop on drag |
| `G` | any | Graphics Control Studio |
| `P` | any | GPU path tracer |
| `U` | any | UPGRADE studio suite |
| `L` | 3D | Day / night; layout lock |
| `R` | any | Rotate placing ghost or selection 45° |
| `E` | walkthrough | Open / close door, inspect object |
| `F` | walkthrough | Interior lights |
| `W A S D` / arrows | walkthrough | Move |
| Arrow keys | 3D | Nudge selection 0.5 ft |
| `Delete` / `Backspace` | 3D | Delete selection |
| `Esc` | any | Close modals, cancel placement, deselect |

Bindings are suppressed while focus is in an `INPUT`, `TEXTAREA` or `SELECT`.
The default desktop path never requires the keyboard — [[zero-keyboard-events]].
