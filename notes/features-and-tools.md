---
tags: [moc, features, tools, documentation]
date: 2026-08-30
status: complete
---

# 🛠️ Features & Tools Inventory

A complete, chronological and categorized record of all engineering systems, architectural tools, 3D graphics capabilities, AI workflows, and UI features built into **plot-to-plan** from project inception to date.

---

## 📑 Table of Contents

1. [[#1. 📐 Mathematical Layout Optimization & CP-SAT Solver Engine]]
2. [[#2. 🏛️ Curated Architectural Blueprint Catalog & Templates]]
3. [[#3. ✨ UPGRADE Engine (Photorealistic Studio Mode & Millwork)]]
4. [[#4. 🎮 AAA Graphics & Display Control Studio]]
5. [[#5. 🏠 3D Architectural Dollhouse Cutaway Mode]]
6. [[#6. ☀️ Day (Light Mode) vs 🌙 Night (Dark Mode) Sky & Lighting System]]
7. [[#7. 🛋️ Staged Multi-Piece Procedural Furniture & Interior Catalog]]
8. [[#8. 🤖 AI Photo-to-3D Furniture Synthesis Engine]]
9. [[#9. 🎨 Materials, Textures & Finishes Customizer Studio]]
10. [[#10. 🪟 Parametric Windows, Doors & Openings Studio]]
11. [[#11. 📐 2D CAD Drafting, Elevation Switcher & Floor Management]]
12. [[#12. 🚶 First-Person Walkthrough & Live Radar Minimap]]
13. [[#13. 📤 Production Export & Blueprint Documentation]]
14. [[#14. ⌨️ Unified Global Hotkeys & CAD Controls]]

---

## 1. 📐 Mathematical Layout Optimization & CP-SAT Solver Engine

*Core backend constraint optimization engine implemented in Python with Google OR-Tools CP-SAT.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **OR-Tools CP-SAT Layout Solver** | `backend/solver/model.py` | Mathematical rectangular room envelope packing solver. Guarantees 0-overlap, legal setback adherence, and envelope containment in $< 150\text{ ms}$. |
| **$L_1$ (Manhattan) Drift Objective** | `backend/solver/model.py` | Keeps layouts stable when editing. Minimises total Manhattan displacement from the previous solution, weighted 100,000x against the area preference so size never buys a jump. A dragged room is released from its Vaastu quadrant, not locked in place. |
| **Vaastu Shastra Cardinal Rules Engine** | `backend/vaastu/rules.py` | Three rules, posted as half-plane constraints before the search rather than scored after it: kitchen south-east, **first** bedroom south-west, pooja north-east. There is deliberately no living-room or bathroom rule — see `V1_RULES`. When the relaxation ladder cannot fit the program with these applied it drops them and the response sets `meta.vaastu_relaxed`. |
| **Topological Connectivity Graph** | `backend/solver/connectivity.py` | Enforces star topology & parent hierarchies ensuring 100% room reachability (Master Ensuite attached to Bedroom, Common Bath attached to Hall). |
| **Daylight & Ventilation Constraints** | `backend/solver/realism.py` | Every **habitable or wet** room must touch the outside face of the built footprint — the bathroom for ventilation, the pooja room and stores exempt. Measured against the footprint, not the plot boundary. |
| **Aspect Ratio & Proportion Limits** | `backend/solver/realism.py` | Caps every room at $1.8:1$ in either direction (held x10 as integers), preventing corridor-shaped bedrooms. |
| **Automatic Openings & Portals Extractor** | `backend/solver/connectivity.py` | Calculates shared wall intervals and exterior exposures, outputting exact coordinates for interior doors, main entrance, and exterior windows. |

---

## 2. 🏛️ Curated Architectural Blueprint Catalog & Templates

*Architectural template library providing authentic, code-compliant floor plans across all plot orientations.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **20 Authentic Model Blueprints** | `frontend/lib/modelBlueprints.ts` | Complete production floor plans spanning 1BHK, 2BHK, 3BHK, and 4BHK configurations across 20×30 ft to 50×80 ft plots. |
| **4-Directional Cardinal Filtering** | `frontend/components/ModelBlueprintsModal.tsx` | Filter blueprints instantly by North, East, South, or West road entrance facing. |
| **Regional & Modern Styles** | `frontend/lib/modelBlueprints.ts` | Templates curated for Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, Urban Contemporary, and Luxury Penthouses. |
| **Contiguous Coordinate Snapping** | `frontend/lib/modelBlueprints.ts` | 0-inch gap shared partition walls eliminating double walls and floating gaps. |

---

## 3. ✨ UPGRADE Engine (Photorealistic Studio Mode & Millwork)

*High-end photorealistic architectural staging engine transforming primitive CAD models into studio-quality architectural renders matching physical exhibition models.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Curved Bouclé Cloud Sofa Suite** | `frontend/lib/interiorDetails.ts` | Sculptural rounded cloud sectional in textured off-white bouclé (`#fcfaf7`) with cylindrical bolster cushions and cream throw pillows. |
| **Organic Pebble / Kidney Wood Coffee Table** | `frontend/lib/interiorDetails.ts` | Smooth organic rounded natural walnut top (`#b07548`, satin finish) with 3 chunky solid timber cylindrical peg legs. |
| **Wall-to-Wall Built-in Library & Fireplace** | `frontend/lib/interiorDetails.ts` | 8.2ft custom white joinery with multi-tier display shelves, warm integrated LED downlight bars (`#fffae0` emissive), and centerpiece fireplace mantle with black hearth and arched gold mirror. |
| **Half-Moon Divider & Cactus Planter Box** | `frontend/lib/interiorDetails.ts` | Architectural half-moon partition screen with built-in planter box housing tall snake plants and desert cacti. |
| **Oval Nero Marquina Black Marble Dining Suite** | `frontend/lib/interiorDetails.ts` | 8-to-10 seater large black Nero Marquina marble table with double fluted pedestal bases and 8 curved plush tub dining chairs with brass legs. |
| **French Chevron / Herringbone Blonde Oak Floor** | `frontend/lib/materialsCatalog.ts` | Seamless 45° Parisian chevron parquet in blonde oak (`french_chevron_oak`) with micro-bevels and soft satin sheen. |
| **Architectural Wainscoting (Boiserie Panels)** | `frontend/components/Scene.tsx` | Raised rectangular picture-frame relief moulding panels along the lower 3.2 ft of living and dining room walls. |
| **One-Click UPGRADE Toggle & Hotkey `U`** | `frontend/app/page.tsx` | Instant real-time hot-swap between standard CAD mode and photorealistic studio suite via ribbon button, 3D toolbar, or key `U`. |

---

## 4. 🎮 AAA Graphics & Display Control Studio

*Comprehensive in-engine graphics settings studio inspired by modern AAA game engines.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Resolution & DSR Scaling** | `frontend/lib/graphicsConfig.ts` | Dynamic viewport resolution scaling from 50% (Performance) to 200% (4K Ultra DSR Super-Resolution). |
| **Procedural 4K PBR Texture Rebuilder** | `frontend/lib/graphicsConfig.ts` | Canvas procedural texture generator rendering materials from 512px to 4096px with up to 16x anisotropic filtering. `graphicsConfig.ts` holds the enum; `materialsCatalog.ts` builds the textures. |
| **4K Soft Contact Shadows** | `frontend/components/Scene.tsx` | Directional sunlight shadow maps from 1024px to 4096px with PCF soft filtering and normal bias tuning. |
| **Cinematic Color Tone Mapping** | `frontend/lib/graphicsConfig.ts` | Switch between ACES Filmic, Reinhard, Cineon and Linear colour grading. |
| **Live Performance & VRAM HUD** | `frontend/components/Scene.tsx` | Real-time overlay displaying measured FPS, frame time (ms) and render resolution. The VRAM figure beside them is a **rough estimate from the active settings, not a measurement** — WebGL cannot report real allocation. |
| **Graphics Studio Modal (`G`)** | `frontend/components/GraphicsControlModal.tsx` | Dedicated modal with quick presets (Low, Medium, High, Ultra, High-Performance GPU Extreme) and hotkey `G`. |

---

## 5. 🏠 3D Architectural Dollhouse Cutaway Mode

*Photorealistic dollhouse cutaway rendering matching studio architectural models.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **One-Click Cutaway View** | `frontend/components/Scene.tsx` | Slices all exterior and interior house walls to a clean 4.8 – 5.2 ft section height for complete room overview. |
| **Solid White Matte Top Caps** | `frontend/components/Scene.tsx` | Adds crisp `#ffffff` matte plaster finish slabs across the top of all wall partitions. |
| **3D Hinged Open Door Leaves** | `frontend/components/Scene.tsx` | Doorways feature 3D open door leaves swung at 35°–40° angles with slim black lever handles and door frames. |
| **Automatic Full Height in Walkthrough** | `frontend/components/Scene.tsx` | Slicing automatically disables in first-person walkthrough mode, raising walls to 9.0 ft with full ceiling slabs. |

---

## 6. ☀️ Day (Light Mode) vs 🌙 Night (Dark Mode) Sky & Lighting System

*Dynamic environment and sky dome system for day and night visualization.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Atmospheric Clear Blue Sky Dome** | `frontend/components/Scene.tsx` | Multi-stop sky gradient (deep azure `#1d4ed8` $\rightarrow$ sky blue `#3b82f6` $\rightarrow$ horizon haze `#bae6fd` $\rightarrow$ `#e0f2fe`) with radiant glowing sun disc. |
| **Clean White CAD Grids (Day Mode)** | `frontend/components/Scene.tsx` | High-contrast crisp white primary axes (`0xffffff`) and soft sky secondary lines (`0xdbeafe`) at 85% opacity over sky-blue architectural ground. |
| **Daylight Lighting** | `frontend/components/Scene.tsx` | Warm high-angle sunlight (`0xfff8ee`, 2.2 intensity) and ambient sky hemisphere bounce (`0x93c5fd`, 1.25 intensity). |
| **Original Default Dark Mode (Night Mode)** | `frontend/components/Scene.tsx` | Restored obsidian `#0a0e17` canvas backdrop, matte `#111827` dark ground, `#334155` dark grid, and warm spotlights (`0xffedd5`, 1.6 intensity). |
| **Quick Toggle & Hotkey `L`** | `frontend/components/TopRibbonTaskbar.tsx` | One-click button in top ribbon and 3D toolbar, plus global hotkey `L` to switch Day/Night instantly. |

---

## 7. 🛋️ Staged Multi-Piece Procedural Furniture & Interior Catalog

*High-density architectural furniture and appliances for all room types.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Scandinavian Living Room** | `frontend/lib/interiorDetails.ts` | Off-white L-sectional sofa, dark glass coffee table with brass base, 65" OLED TV wall unit, and fiddle leaf fig tree. |
| **Master & Guest Bedrooms** | `frontend/lib/interiorDetails.ts` | King platform bed with upholstered headboard, multi-tier duvet, dual nightstands with lamps, 3-door wardrobe, and **Computer Study Workstation** (dual monitors, keyboard, ergonomic swivel chair). |
| **Modular L-Kitchen & Appliances** | `frontend/lib/interiorDetails.ts` | White cabinetry, black induction cooktop, stainless steel chimney range hood & duct, undermount sink with chrome mixer faucet, and double-door refrigerator. |
| **Modern 6-Seater Dining Suite** | `frontend/lib/interiorDetails.ts` | White dining table with 6 molded white shell chairs with thin angled chrome legs. |
| **Deluxe Bathroom Suite** | `frontend/lib/interiorDetails.ts` | Deep soaking bathtub, floating vanity with vessel sink & mirror cabinet, wall-hung commode, glass shower enclosure, and **front-loading washing machine**. |
| **Sacred Marble Pooja Mandir** | `frontend/lib/interiorDetails.ts` | White marble altar with gold finials, brass bells, and glowing diya flame. |
| **Furniture Catalog Drawer** | `frontend/components/FurnitureDrawer.tsx` | Bottom drawer shelf to browse, filter, and drag-and-drop custom furniture items into the scene. |
| **Interactive 3D Gizmos** | `frontend/components/Scene.tsx` | Move, rotate (45°/90° increments), scale, duplicate, and delete custom furniture pieces with collision guides. |

---

## 8. 🤖 AI Photo-to-3D Furniture Synthesis Engine

*Multimodal AI feature allowing users to upload furniture images and automatically generate 3D procedural models.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Image Upload Studio Modal** | `frontend/components/AIFurnitureStudioModal.tsx` | Image drag-and-drop or file selection with live preview and prompt editing. Samples the image's dominant colour and aspect ratio in-browser and passes those as hints. |
| **Prompt-Driven Component Blueprint** | `backend/api/main.py` | `POST /ai/model-furniture` maps the text prompt to a parametric component tree (sofa / table / bed / armchair) with PBR materials and dimensions. **It does not read the uploaded image** — `image_base64` is accepted and ignored. Colour and aspect come from client-side canvas sampling in the modal.
| **Procedural 3D Mesh Generator** | `backend/api/main.py` | Synthesizes multi-component 3D geometry with PBR materials, roughness, metalness, and bounding box dimensions. |
| **Zero-Latency In-Scene Spawning** | `frontend/app/page.tsx` | Spawns AI-generated 3D models directly onto the floor plan with full interactive move, rotate, scale, and delete controls. |

---

## 9. 🎨 Materials, Textures & Finishes Customizer Studio

*Interactive material and finish customizer for floors, walls, and architectural surfaces.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **PBR Flooring Materials Catalog** | `frontend/lib/materialsCatalog.ts` | Catalog of 8+ architectural materials: Scandinavian Oak, Italian Carrara Marble, Terracotta Tiles, Jet Black Granite, Herringbone Walnut, Moroccan Mosaic, Terrace Grey Paver, Oceanic Blue Tile. |
| **Procedural Texture Generators** | `frontend/lib/materialsCatalog.ts` | High-resolution canvas texture generators with micro-bevel joints, wood grain, marble veining, and tile grout. |
| **Wall Paint Palette** | `frontend/lib/materialsCatalog.ts` | Palette of 7 wall finishes: Matte White, Warm Ivory, Soft Sage, Muted Slate, Terracotta Rust, Deep Navy, Raw Concrete. |
| **Design Style Presets** | `frontend/components/MaterialCustomizerModal.tsx` | One-click themes: Modern Scandinavian, Classic Indian Heritage, Minimalist Industrial, Mediterranean Villa, Architectural Studio Cutaway. |

---

## 10. 🪟 Parametric Windows, Doors & Openings Studio

*Parametric fenestration system for windows, doors, and open-concept architectural passages.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Parametric Window Shapes** | `frontend/components/WindowShapeModal.tsx` | Standard Rectangular, Floor-to-Ceiling Ribbon, Arched Heritage, Circular Pinhole/Oculus, Louvered Frosted. |
| **Frame Materials & Glass Tints** | `frontend/lib/windowCatalog.ts` | Frame finishes (Black Aluminum, Golden Teak, White UPVC, Brass) and Glass tints (Clear, Blue Solar, Smoked Charcoal, Frosted). |
| **Architectural Window Sunshades (Chajja)** | `frontend/components/Scene.tsx` | Concrete sunshades automatically centered directly above all exterior window openings. |
| **Wall Demolition / Open-Concept Tool** | `frontend/components/TopRibbonTaskbar.tsx` | Click any wall to demolish into an open-concept passage with overhead lintel beam, or restore to a solid partition. |
| **Openings Shelf Drawer** | `frontend/components/DoorsWindowsDrawer.tsx` | Drag-and-drop catalog shelf for doors, windows, and passages. |

---

## 11. 📐 2D CAD Drafting, Elevation Switcher & Floor Management

*Professional 2D blueprint drafting and multi-storey elevation tools.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Interactive 2D Blueprint View** | `frontend/components/Blueprint2DView.tsx` | 2D CAD view with millimeter-accurate dimension strings, room area labels ($\text{sq ft}$ / $\text{sq m}$), door swings, and window callouts. |
| **Interactive Wall Drafting Tool** | `frontend/components/Scene.tsx` | Draw custom interior partition walls and exterior perimeter walls in 2D and 3D with magnetic vertex snapping. |
| **Multi-Storey Floor Switcher** | `frontend/components/Scene.tsx` | Switch elevations between Ground Floor (G), 1st Floor (1F), 2nd Floor (2F), and Terrace Roof (Roof) with intermediate RCC slabs. |
| **Interactive Plot & Setback Handles** | `frontend/components/Scene.tsx` | Interactive 3D handles to dynamically resize plot width and depth with automatic boundary validation. |

---

## 12. 🚶 First-Person Walkthrough & Live Radar Minimap

*Real-time first-person exploration engine with collision detection and minimap.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **First-Person Walkthrough Engine** | `frontend/components/Scene.tsx` | 5'5" eye-level navigation with WASD / Arrow movement, mouse-look camera control, and wall collision sliding. |
| **Live Radar Minimap HUD** | `frontend/components/Minimap.tsx` | Top-down 2D HUD minimap displaying live player coordinates, orientation field-of-view cone, room boundaries, and furniture. |
| **Room Teleportation System** | `frontend/app/page.tsx` | Click any room badge in the HUD or side drawer to instantly teleport the camera/player inside that room. |
| **Layout Lock Mode** | `frontend/components/TopRibbonTaskbar.tsx` | Locks all room positions and walls to prevent accidental dragging during exploration. |

---

## 13. 📤 Production Export & Blueprint Documentation

*Export tools for client presentations and CAD documentation.*

| Feature / Tool | File Location | Description & Capabilities |
| :--- | :--- | :--- |
| **Print-Ready 2D SVG / PNG Blueprint Export** | `frontend/components/Blueprint2DView.tsx` | High-resolution architectural floor plans with title block, room dimensions, north cardinal arrow, and area summary. |
| **3D Screenshot Capture** | `frontend/components/TopRibbonTaskbar.tsx` | Capture instant high-resolution 3D renders from the active camera angle. |
| **Full Project JSON Save / Load** | `frontend/app/page.tsx` | Export and import complete house layouts, custom walls, furniture, materials, and openings as JSON. |

---

## 14. ⌨️ Unified Global Hotkeys & CAD Controls

*Centralized keyboard navigation and shortcut matrix for desktop power users.*

| Key / Shortcut | Target Feature / Action | Description |
| :--- | :--- | :--- |
| **`G`** | **🎮 Graphics Control Studio** | Opens and closes the in-engine graphics, render-resolution, texture and shadow quality modal. |
| **`P`** | **💎 GPU Path Tracer / Raytracer** | Toggles real-time progressive hardware path tracing with multi-bounce global illumination. |
| **`U`** | **✨ UPGRADE Studio Suite** | Instantly hot-swaps between basic CAD blocks and photorealistic curved bouclé/library/fireplace suite. |
| **`L`** | **☀️ Day / 🌙 Night Atmosphere** | Toggles between sunny blue sky dome with white CAD grids and starry night sky with warm interior spots. |
| **`Esc`** | **Dismiss / Deselect** | Instantly closes any active dialog/drawer modal and deselects selected furniture/objects. |
| **`R`** | **Rotate Selected (45°)** | Rotates active furniture placement or selected custom object clockwise by 45°. |
| **`Del` / `Backspace`** | **Delete Selected** | Deletes the currently selected custom furniture item from the scene. |
| **`Arrow Keys`** | **0.5 ft Fine Nudge** | Nudges selected furniture item across the floor plan in 0.5 ft increments. |

---

## 📊 Summary of Implemented Capabilities

- **Backend Tests Passing**: **90 / 90 (100%)**
- **TypeScript Errors**: **0 Errors** (`npx tsc --noEmit`)
- **Production Build**: **Compiled Successfully (Code 0)**
- **BIM Core**: **Walls as first-class objects with persistent IDs, thicknesses, and single-hosted openings**
- **Estimation Core**: **Real-time Bill of Quantities (BOQ) with Economy, Premium, and Luxury tiers**
- **Supported Floor Plan Models**: **20 Curated Architectural Blueprints**
- **Supported Material Finishes**: **15+ High-Definition PBR Procedural Shaders & Wall Paint Blending**
- **Supported Graphic Modes**: **Hardware GPU Path Tracer, UPGRADE Studio Mode, DSR render scaling to 200%, 4096px procedural textures, 4096px PCF soft shadows, Day / Night, 3D Dollhouse Cutaway**
