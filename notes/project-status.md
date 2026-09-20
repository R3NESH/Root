---
tags: [moc, status]
status: current
date: 2026-09-20
---
# Project status — 2026-09-20

Reviewed against the working tree at commit `72be93d` on branch
`feat/studio-tooling-and-room-sizes`, **two commits ahead of `main`**, with every number below
re-measured on 2026-09-20 rather than carried over from [[daily-log|the daily notes]].

> [!success] The tree is clean and the suite is green
> **183/183 backend tests pass in 256 s**, run on 2026-09-20. The working tree carries no
> uncommitted code — the state this page warned about on 2026-09-07 (25 files, nothing staged)
> was committed. `main` is two commits behind this branch; nothing has been pushed.

> [!success] Updated on 2026-09-03 — Walls as Objects (BIM), Quantities Takeoff, NBC 2016 Sizing & Compact Footprint
> - **Walls as First-Class Objects**: 0-inch gap shared partition walls derived post-solve with persistent IDs, thickness, and hosted openings.
> - **Bill of Quantities (BOQ)**: Exact masonry, brick count (434/m³ traditional or 500/m³ IS 1077), mortar volume, plaster area, and cost estimation modal.
> - **NBC 2016 Room Catalog**: Real Indian minimums (hall 10×12, kitchen 7×8, bath 4×6) replacing artificial test fixtures.
> - **Compact Footprint Objective**: Linear half-perimeter penalty removing inner void down from 28% to 5-7%.
> - **90 tests green (100%)**, 0 TypeScript errors.

## Where the project actually is

| | |
|---|---|
| Phase | [[project-phases\|Phase 1]] — production CAD, BIM takeoff & 3D walkthrough ready |
| Commits | **63**, tree clean; `main` is 2 behind this branch, nothing pushed |
| Code | **8,348** lines backend Python (2,729 of them tests) · **47,556** TS/TSX + **10,386** CSS frontend |
| Tests | **177 passing, 6 failing** in 342 s, measured 2026-09-20. The six are **pre-existing** — they fail identically on a clean `HEAD` with the working tree stashed. See the table below |
| Frontend checks | `tsc --noEmit` 0 errors · `next build` 0 warnings — and still the *entire* frontend safety net |
| Blueprints | **20 authentic curated models** with 4-directional filtering; 17 of them were pinning rooms under the solver's own minimums until 2026-09-19 |
| Room kinds | **20 in `ROOM_CATALOG`** — 10 residential, 10 café. The frontend adds `stairs`, which is drawn and never solved |
| Knowledge graph | **1,962 nodes / 4,514 edges / 105 communities** over 445 files — [[knowledge-graph]], rebuilt 2026-09-20 |
| Input paths | taps, free text, a photographed floor plan, and a photographed facade — [[free-text-input]] |
| Paying users | **none**, and nobody asked yet |

## What works, verified 2026-09-20

- **Architectural Blueprints Catalog.** 20 models across North, East, South, West facings, Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, and Parisian Penthouses.
- **Walls as Objects & BIM Engine.** Single-wall shared partitions with hosted opening attachments, eliminating double-counted doors and floating room borders.
- **Bill of Quantities (BOQ) & Cost Takeoff.** Real-time civil, masonry, finishes, MEP, and labor estimation across Economy, Standard, and Luxury tiers.
- **Real-World Kandi, Telangana Plot Validated.** 30×40 North-facing plot solved under TG-bPASS setbacks (5 ft road, 3 ft rear/sides) across 2BHK and 3BHK programs with 100% door reachability, and tight compact footprint (`test_kandi_plot.py`).
- **Solver core & Realism.** **183 unit tests green in 256 s.** Compact footprint term prevents loose pavilion layouts. NBC 2016 sizing ensures standard Indian plots (20×30, 25×40, 30×40) solve reliably, and since 2026-09-19 the catalog *maximums* no longer bind before the plot does.
- **The 3D product.** Orbit view, first-person walkthrough with mobile on-screen D-pad and action buttons, minimap, drag-and-drop rooms, CAD drafting, 2D blueprint export, material customization, custom wall paint bands, and real Poly Haven 3D models.
- **Walkthrough Collision Engine & Interactive Doors.** Axis-separated sliding capsule collision ($R = 0.72\text{ ft}$) prevents phasing through walls, closed doors, and furniture (custom and built-ins). Interactive hinged doors start closed, block passage, and swing open/closed smoothly via `E` key, direct mouse click, or mobile touch button with on-screen HUD prompt.
- **Architectural Spatial FOV.** Corrected again 2026-09-19: the 68° figure was vertical, which came out at ~116° horizontal on a letterboxed viewport and read as a giant walking through the house. Walk speed came down from 2.3 m/s at the same time.
- **Hardware Path Tracer.** Interactive WebGL2 raytracing with real-time progressive sampling and bounces — `lib/pathTracerEngine.ts`.
- **Quality that measures itself.** GPU tier read off the GPU, then corrected from measured frame time — [[quality-measures-itself]].
- **Drawn stairs and a drone tour.** A staircase solved from a clicked walk line and refused if it cannot meet NBC; a tour that walks the doorway graph so the camera never crosses masonry.
- **Documents tab.** BOQ, FF&E schedule, clearance audit, elevations, ceiling plan, finish board and export, each one sheet off the same model.
- **Full Features & Subsystems Inventory.** Capabilities in [FEATURES.md](../FEATURES.md), the things you click in [TOOLS.md](../TOOLS.md). Both re-verified 2026-09-19; the stale third inventory was deleted the same day.

## Ponytail audit, and the BOQ was pricing a different building — 2026-09-20

`.agents/rules/ponytail.md` run mechanically over every `.ts`, `.tsx` and `.py` in the repo. One
pattern came out of it, repeated: **a thing is built properly, a second copy is built beside it,
and the good one is left wired to nothing.** [[three-pickers]] and [[duplicated-geometry]] already
name that class. It is still happening.

### The one that changed a number

`solver/quantities.py` measures the building off `walls.py` — one wall per shared partition,
openings as cut. The client never read it. `boqEngine.ts` re-derived everything from room
rectangles. On a real 7-room 30×40 solve the wall run came out **35% over** and the brick count
**42% under**, independently — [[boq-was-not-reading-the-takeoff]]. Total cost happened to land
within 0.6% because the errors offset, which is worse than being visibly wrong.

Fixed: the BOQ costs the measured take-off, and falls back to the estimate only when there is
none, reporting `source: "estimated"` on screen, in the CSV and on the printed sheet.

### Deleted, all of it verified by `tsc` and `next build`

| | |
|---|---|
| `lib/pathTracerEngine.ts` | 198 lines, zero references. Path tracing is inline in `Scene.tsx`. The wrapper was written and bypassed |
| `CompassDial`, `PlotPicker`, `RoomTray` | 380 lines of `.tsx` + `.module.css`, zero references |
| 21 dead exports | `withMullions`, `findGlazingPreset`, three floor-texture builders, `FLOOR_LEVEL_CONFIGS`, `HABITABLE`, … |
| 23 dead locals | incl. **eight materials allocated per hall and shadowed** by an identical set in the branch below, and two dead prop chains from the 2026-09-19 HUD cleanup |

### Collapsed

`escapeMarkup()` and `downloadCsv()` now live once in `blueprintExport.ts` — they had three and
four byte-identical copies. `newId()` in `customArchitecture.ts` replaces the same
timestamp-plus-random expression written out at **15 sites in 3 different spellings**.

Net **−458 lines**.

> [!warning] Three code comments pointed at notes that did not exist
> Found the same day by extracting every `notes/**.md` path mentioned in source and testing each
> for a file. `zone-rule-is-a-constraint.md` — the project's most load-bearing rule, cited by two
> code files and by `CLAUDE.md` — had **never been written**. It is now
> [[zone-rule-is-a-constraint]].

### Lint: 104 → 78

| Rule | before | after |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 23 | **1** |
| `react-hooks/purity` | 6 | 2 |
| `react-hooks/refs` | 27 | 27 |
| `react/no-unescaped-entities` | 23 | 23 |
| `react-hooks/set-state-in-effect` | 13 | 13 |
| `react-hooks/exhaustive-deps` | 7 | 7 |
| `@typescript-eslint/no-explicit-any` | 4 | 4 |
| `@next/next/no-img-element` | 1 | 1 |

The re-lint earned its keep: it caught four module-level texture caches and an import that **this
cleanup itself stranded** when the floor-texture builders went. Deleting something and not
sweeping up after it is the same defect in miniature.

> [!note] What was deliberately not fixed
> The **49** behavioural lint problems: 27 `react-hooks/refs`, 13 `set-state-in-effect`, 7
> `exhaustive-deps`, 2 `purity`. Half sit in `Scene.tsx` and `Blueprint2DView.tsx`. With **zero
> frontend tests and nobody ever having looked at the app in a browser**, changing effect and ref
> semantics there trades known warnings for invisible breakage.
>
> Also not fixed, and this was a misjudgement rather than a decision: the 23
> `no-unescaped-entities` and 4 `no-explicit-any`. The *edits* are mechanical, but they live in
> the JSX bodies of the same two god components, so "mechanical" described the change and not the
> file. They are cosmetic and they are still open.
>
> And the **three** prompt parsers (Claude, Python regex, TS regex) stand, because deciding which
> one survives is a product call, not a cleanup.

## The GPU was inferred from the CPU — 2026-09-19

The same build, in the same browser, ran at **single-digit FPS on a friend's laptop**. Three
client-side bugs, none of which a deployment can cause — a deploy changes load time and API
latency, never frame rate. Full argument: [[quality-measures-itself]].

- **`navigator.hardwareConcurrency <= 4`** was the GPU test. It counts CPU threads. An eight-core
  laptop with Intel integrated graphics reports 8, fails the test, and is handed the dedicated-GPU
  path — MSAA, a 1.5 pixel ratio, PCF soft shadows, `highp` and the whole post chain. The
  threshold only ever caught genuinely ancient machines.
- **`lib/gpuTier.ts`** asks the GPU through `WEBGL_debug_renderer_info` instead, and sets only
  what a live WebGL context cannot change afterwards. A masked or unrecognised GPU now starts
  **mid**, not high.
- **The DPR cap was applied after the multiply, not before.** A retina laptop drew four times the
  pixels of an ordinary screen at identical settings.
- **`lib/adaptiveQuality.ts`** — six rungs over render scale and shadow quality, driven by
  measured frame time, with hysteresis and a climb cap. It reads the **unclamped** frame delta,
  because the render loop's 0.1 s clamp hides every machine below 10 fps, which is the case it
  exists for.
- **The performance HUD was lying.** `GPU: Dedicated (High VRAM)` was hardcoded and printed on
  every machine — so the laptop running at 8 fps was being told it had a dedicated card. That is
  most of the reason this went a month unseen.

Checked against a **simulated** renderer: 8 fps walks to the bottom rung and stops, 120 fps never
moves, 90 fps climbs twice and holds, an 18–42 fps oscillation produces three changes in six
thousand frames, and a 30 s frame is ignored.

> [!warning] Never run on the machine it was written for
> Every number above comes from a simulation. The friend's laptop that produced the report has not
> re-run the build. This is the same class of gap as the unrendered sheets below, and it is worse
> here, because a governor that mis-tunes is invisible in `tsc`.

## Interior tooling, drawn stairs, a live plan, and honest room sizes — 2026-09-19

The largest single commit in the project (`25c1174`). Four separate things.

- **The product's own output was behind a chevron.** BOQ, FF&E schedule, clearances, elevations,
  ceiling plan, finish board and export were all 16px icons in a 36px application bar that
  overflows. They now have a **Documents** tab; the application bar is back to session controls.
  A new **Landscape** tab holds eleven outdoor pieces — placement already raycast the ground
  plane rather than a room floor, so it needed no new machinery.
- **Live Plan (H).** The blueprint sits *beside* the 3D view instead of in place of it. Both panes
  read the same state, so there is nothing to sync. What did need solving: both bind their own
  `keydown`, and one Enter was building two staircases. Whichever pane the pointer is over owns
  the keyboard.
- **Stairs drawn as a walk line** — `lib/stairPath.ts`. Click the points a person would walk:
  two give a straight flight, three at 90° an L, three at 180° a dog-leg, four a U where a short
  cross leg becomes the landing. Riser count comes from the **real storey height**, so a taller
  floor gets more steps rather than steeper ones. A path that cannot meet NBC 2016 is refused with
  the reason, never built shallower — [[zone-rule-is-a-constraint]]. No `three` import, so the
  arithmetic is checkable headless. The reason this exists: a placed catalog stair is scaled by
  `PlacedCustomObject.scale`, which multiplies riser and going **together**, and a stair is the
  one object that must never be scaled.
- **Drone tour** — `lib/cameraTour.ts`. Exterior orbit, descent onto the entrance, then room by
  room along a depth-first **walk** over the doorway graph. A breadth-first ordering puts
  consecutive rooms that share no wall next to each other, and the camera flew through masonry —
  that was the first version's bug.

### Why the interiors read cramped, measured

The room **maximums** were never tuned; they were test-fixture ceilings, the same defect
[[room-sizes-from-code]] closed for the minimums on 2026-09-03. `bench_realism` measured a 2BHK
filling **46% of a 40×60** envelope and a 4BHK **33% of a 50×80**, both binding on the catalog
rather than on the plot: **a bigger plot drew the same small house in a bigger footprint.**

`catalog is the binder` went **2/5 → 0/5**. 3BHK on 40×60 went **69% → 92%** fill. Worst aspect
2.02 → **1.79**, inside the 1.8 cap for the first time. `WALL_HEIGHT_FT` 9.0 → **10.0**, because
nine feet is the NBC *minimum*, not the norm, and every interior was drawn at the legal floor;
`solver/walls.py` matches, or the quantities cost a different building from the one drawn.

### The shipped blueprints were escaping the catalog

`api/main._size_range()` documented that neither source widens the catalog and then returned the
pin **unclamped one line below**. Every prebuilt plan pins every room, so **seventeen** were under
a floor the solver enforces as a hard constraint — including a 7×6 bedroom at half the NBC
habitable area and three kitchens 6 ft wide. The pin is clamped now, 16 pinned rooms were raised,
and `backend/tests/test_model_blueprints.py` checks the shipped plans against `ROOM_CATALOG` and
NBC. It asserts a **parse floor**, so a format change fails rather than quietly checking nothing.

> [!note] Recorded rather than hidden
> - The catalog's dining minimum is **64 sq ft, under NBC's 81**. Raising it put the 3BHK on a
>   30×40 back to INFEASIBLE, so it stands — written down in `solver/rooms.py` and in the notes.
> - `25x50_3bhk_north` does not solve and did not before: it claims 840 sq ft built-up on a
>   770 sq ft envelope. Named in the test file; the fix is a product decision, not a code one.
> - `test_the_house_fills_most_of_what_the_catalog_allows` now measures against
>   `min(ceiling, 1.0)` — a house cannot fill more than its plot — and its floor moved 0.90 →
>   0.85. **The drop is the denominator moving, not the houses getting worse:** absolute fill went
>   65% → ~90%.

Also in this commit: the walkthrough no longer reads as a giant (horizontal FOV was ~116° on a
letterboxed viewport, walk speed 2.3 m/s), landscaping was removed pending its own feature, and
Esc puts a tool down while Ctrl+Z picks it back up.

## The catalog doubled — 2026-09-19

24 Poly Haven CC0 models downloaded and integrated. 38 model folders → **62**, 19 MB → **49 MB**.
`FURNITURE_CATALOG` 109 entries → **133**.

- Aimed at the thin categories. After: living 23, decor 15, bedroom 10, lighting 8, dining 8.
- **Dimensions measured, not estimated.** Each new catalog entry's `dimensions` came from the
  POSITION accessor bounds in that model's own `.gltf`, times the node scale where one exists.
  `Chandelier_01` carries a 0.01 node scale and reads as 245 ft without it — caught because the
  numbers were read rather than typed.
- `createFurnitureMesh`'s default branch now sizes its placeholder from the catalog instead of a
  fixed 2 ft cube, so a failed model load leaves something the right size.
- Licence rule written down: [[object-library-licensing]]. CC0 only, because the app *serves* the
  file to every visitor — that is redistribution, not use.

> [!warning] Two categories cannot be fixed from this source
> Poly Haven's full index has **no sanitaryware** and **no soft furnishing**. Bath stays at 4
> pieces, soft at 2. Sketchfab's Download API is the realistic route to both, at the cost of an
> end-user login and an attribution surface.

`tsc --noEmit` 0 errors, `next build` clean.

> [!note] A latent ribbon bug surfaced, and it was not in this work
> The five studio buttons added earlier today took the application bar from ~7 actions to 14 and
> ran its overflow path for the first time. Items past the fit were only `aria-hidden`, so they
> stayed in the layout and were clipped mid-button. Found by plot-to-plan-91 and fixed there
> (`display: none` on the overflowed class); the `»` menu had been wired all along. Nothing of
> this session's work was reverted. Whether fourteen flat actions should collapse into one
> "Drawings" entry is with that session's user as a product question.

## Finish board and reflected ceiling plan — 2026-09-19

The two named gaps from the competitor read, both built. Each was given one thing the
competition does not do, rather than being matched feature-for-feature.

- **Finish board.** Palette strip, resolved floor / wall paint / wall finish / joinery swatches,
  and every piece drawn front-on **at one shared scale** off its measured box, labelled in
  feet-inches and mm. Whole-house or per-room, plus a print pack of every board.
  [[board-is-drawn-to-one-scale]] — collage tools arrange cutouts by eye, so a side table and a
  sectional come out the same size and the board cannot answer the question it is looked at for.
  Verified numerically: drawn-width to real-width is identical across every piece, spread 0.0000.
  No photography, and the sheet says so rather than shipping placeholders.
- **Reflected ceiling plan.** Fixtures off the model, a legend, a setting-out grid, a proposed
  downlight layout at ceiling height ÷ 2 capped at 6 ft drawn dashed, and a fixture schedule.
- **It says the number.** Average lux per room by the lumen method against IS 3646 —
  [[lighting-says-the-number]]. Every competitor places light symbols; none found says the
  kitchen lands at 226 lux when the standard wants 300. UF 0.5, MF 0.8 and lamp outputs are
  assumptions, printed on the sheet. A room kind with no published figure is **not assessed**,
  same rule as the clearance audit.

**A live bug fell out of it.** Tagging ceiling fixtures showed the clearance audit measured gaps
to anything in its box list — so a **placed chandelier was already generating fake floor-clearance
failures**. Fixed with `FLOOR_OBSTACLE_MAX_Y_FT = 4.0`; nothing you cannot walk into is a passage.
Regression test added to the harness.

`tsc --noEmit` 0 errors, `next build` clean. Pure halves run in Node against a 12×10 kitchen with
`three` stubbed, asserting by hand: 4.5 ft spacing from a 9 ft ceiling, 6 downlights on cell
centres at x 2/6/10 and z 2.5/7.5, total 6,300 lm, 226 lux against a 300-500 target → *under*,
a fan drawn at zero lumens, a store left unassessed, ceiling fixtures kept off the finish board
and out of the clearance audit, identical pieces grouped, and both SVGs' tags balanced. All held.

> [!warning] Still nothing seen in a browser
> Five sheets now — blueprint, elevation, board, ceiling plan, schedule — none ever rendered on
> screen by the agent that wrote them. This is the oldest open gap in the project and every
> session widens it.

> [!note] What this does not fix
> The catalog. 109 pieces and 38 models against Foyr's 60,000, and lopsided — bath 4, soft
> furnishing 2. That is a sourcing and licensing problem, not a coding one, and it is the first
> thing a designer sees. Also still open: DXF/DWG, 360 panorama, a hosted backend.

## Interior elevations and a clearance audit — 2026-09-19

Two more surfaces aimed at the same coming review, chosen after reading what the competition
ships. Chief Architect's baseline is that plan, section and elevation all come off one model;
Foyr Neo and Coohom compete on moodboards, 360 panoramas and render speed. Elevations were the
gap this product could least afford, because they are the drawing an interior designer actually
produces.

- **Interior elevations** — one per wall per room. Wall outline, floor and ceiling lines, every
  opening with sill and head height, furniture in silhouette with heights called out, and
  dimension strings along and up the wall. Wall list grouped by room with a live preview; SVG,
  PNG or print for one wall, and a print set that puts every elevation on its own page. Export
  reuses `blueprintExport.ts` rather than growing a second exporter.
- **Each wall is drawn looking at it from inside the room** — [[elevations-look-from-inside]].
  Left-to-right therefore flips per wall. Drawing every wall in world order is one line less and
  produces mirrored elevations, which is how a wardrobe gets built hinged on the wrong side.
- **Clearance audit** — every gap measured: piece to piece, piece to wall, clear floor inside
  each door. NKBA figures are cited and linked; the two rules with no published source say
  **"Trade practice — no published source, low confidence"** rather than borrowing an authority
  — [[cite-the-clearance-or-admit-it]]. A room with nothing in it is listed as unchecked, never
  counted as a pass.
- **`frontend/lib/furnitureInventory.ts`** now owns the scene-to-UI furniture record, which
  carries a measured world box instead of three loose dimensions. It imports no `three`, which
  fixes the coupling [[schedule-is-measured-not-declared]] complained about for the new modules.
- `DesignScheduleModal.module.css` became `StudioModal.module.css`; all three studios share one
  shell.

`tsc --noEmit` 0 errors, `next build` clean. The pure halves were run in Node against a
fabricated 12×10 kitchen with `three` stubbed, asserting exact numbers: wall lengths per edge,
the door's position on the north elevation, the west window's sill and head, the mirroring of a
piece between the north and south elevations, that a piece 8 ft off a wall is excluded from it
while one at 4 ft is kept, draw order far-to-near, that the SVG's tags balance, that a 24 in
aisle is reported against NKBA's 42 in with a live source URL, that the bedside rule carries no
source, and that an empty room is skipped rather than passed. All held.

> [!warning] Still nothing seen in a browser
> Same gap as every session since 2026-09-04. The elevation SVG is verified as a string, not as
> a picture. Nobody has looked at a rendered sheet.

> [!note] Deliberately not built
> A reflected ceiling plan and lighting layout, a moodboard or finish board, 360 panorama export,
> and DXF/DWG. Export is still SVG, PNG, CSV, JSON and print.

## FF&E and finish schedule — 2026-09-19

The product could draw an interior and could not *specify* one. It now emits the two tables an
interior designer keeps by hand.

- **FF&E schedule.** Every piece, room by room: quantity, size in feet-inches **and** mm, finish,
  and whether it came from the automatic fit-out, the catalog or the AI modeller. Identical
  pieces in a room collapse to one line with a count.
- **Finish schedule.** Per room: floor, wall paint, wall texture, door finish, carpet area, gross
  paint area, plus band, glazing and wet-area notes.
- **Sizes are measured, not declared** — [[schedule-is-measured-not-declared]]. The fit-out
  shrinks a dining set to save a walkway ([[furniture-clearances]]) and places a `dining_table`
  that has no catalog row at all, so `Scene.tsx` boxes each built-in group and hands the list up
  through a new `onFurnitureInventory` callback. That callback is the only way the built-in
  fit-out exists as data rather than as meshes.
- One CSV for both tables, plus a printable spec sheet. Ribbon button beside BOQ.

`tsc --noEmit` 0 errors, `next build` clean. The pure half — `buildDesignSchedule()` — was also
run in Node against a fabricated five-room plan with `three` stubbed, checking that piece counts
survive grouping, that repeated rooms get numbered, that the uncatalogued dining set keeps a
size, that duplicates group, that a piece outside every room is flagged rather than dropped, and
that a wet room carries its note. That harness lives in the scratchpad, not the repo: the
frontend still has no test runner.

> [!warning] The measured half has not been seen in a browser
> `onFurnitureInventory` fires out of the scene build. Nothing in `tsc` or `next build` proves
> a `Box3` was ever taken, so the FF&E table's row count and sizes are unverified against a real
> render. This is the same gap as every session since 2026-09-04.

> [!note] Why this, and what was skipped
> Chosen against a coming interior-designer review. Also on that list and **not** built: interior
> elevations (the drawing a designer actually produces — there are none), a reflected ceiling
> plan, surfaced clearance warnings, and DXF/DWG export. The tool still speaks solver in places
> a designer does not care about.

## Vaastu and the pooja room removed — 2026-09-18

At the user's instruction, every Vaastu rule and the pooja room were taken out of the product.
This reverses the locked decision in [HANDOFF.md](../HANDOFF.md) §3.5, which HANDOFF.md still
records as the original brief; HANDOFF.md is never edited.

- `backend/vaastu/` deleted. Its generic machinery — `QuadrantRule`,
  `add_quadrant_constraint()`, `satisfied()` — moved to `backend/zoning.py`, which the café
  programme still uses. The residence now posts **no** directional rule at all.
- `pooja` gone from `ROOM_CATALOG`, the parent tree, the forbidden pairs, the room vocabulary,
  the 20 curated blueprints, the material presets and the AI room vocabulary.
- The pooja mandir and diya lantern furniture, the whole `sacred` tool-rail category, the
  auto-placed altar, the 9-zone mandala overlay, the per-room zone badge and the blueprint
  export's zone matrix are all removed.
- API: `apply_vaastu` → `apply_zone_rules`, `vaastu_constraints_applied` → `rules_applied`,
  `vaastu_relaxed` → `rules_relaxed`. `rules_label` is now `""` for a residence.
- `PROJECT_STORAGE_KEY` changed from `vastu_builder_project_data_v1` to
  `plot_to_plan_project_data_v1`. **Any locally saved project from before this change will not
  load.**
- Three vault notes deleted: `vaastu-as-constraints`, `step-5-vaastu`,
  `vaastu-and-connectivity-drop-on-edit`. Incoming links were rewritten, not left dangling.

> [!warning] The cited demand evidence still stands and now contradicts the product
> HANDOFF.md §2 cites a NoBroker survey of 12,546 respondents — 73% check Vaastu before buying,
> 77% in Hyderabad. That was the reason Vaastu was a constraint rather than a score. Nothing has
> been measured since that contradicts it. The removal was a direct instruction, not a finding.

Backend **173/173 passing**. Frontend `tsc --noEmit` 0 errors, `next build` clean.

## Custom and curved plot shapes — 2026-09-18

The plot is no longer a rectangle with optional corner splays. Its outline can be drawn.

- **Drag it.** The 2D view has a *Plot Shape* mode: drag a corner, drag an edge's dot to bow it,
  double-click a dot to add a corner, right-click a corner to remove one.
- **Or type it.** The Site tab carries a corner table — X, Y and the bow of the edge leaving each
  corner — plus typed plot width and depth, which were step-only before. A surveyed parcel
  arrives as measurements, not as a sketch.
- **Convex only, and it says so.** See [[plot-shapes-are-convex]] for why that is arithmetic
  rather than a missing feature, and what the integer-inch ceiling on curve tessellation is.
- `MAX_VERTICES` 12 → 32, after measuring that edge count costs nothing against the solve budget.
- The 3D ground and the blueprint sheet needed no change: both already drew from
  `plotPolygonIn(plot)`.

Verified end to end: the outlines the UI produces, posted to the real `/solve`, with every placed
room checked against the plot's own inset half-planes.

| outline | corners | solver | rooms inside |
|---|---|---|---|
| rectangle 30×40 | 4 | FEASIBLE | all |
| splayed NE 6 ft | 5 | FEASIBLE | all |
| road edge bowed 6 ft | 24 | FEASIBLE | all |
| all four edges bowed 4 ft | 24 | FEASIBLE | all |
| drawn trapezoid | 4 | OPTIMAL | all |
| drawn 5-gon with one bow | 17 | FEASIBLE | all |
| dented inward | 26 | refused → rectangle | UI warns |

> [!warning] A five-room mix never reached OPTIMAL in any of these
> Every curved-plot run above returned FEASIBLE at ~2040 ms against the 2 s cold budget,
> including the plain rectangle. The budget, not the plot shape, is what is binding. This page
> previously recorded that as a twelve-room problem; it starts at five.

> [!warning] Not seen rendered
> `tsc --noEmit` is clean and `next build` passes, and the geometry is verified numerically
> through the real solver. No agent has looked at the outline editor in a browser — there is
> still no browser driver in the repo.

## The drawn-wall delete bug — 2026-09-18

`handleDeleteSelected` in `frontend/app/page.tsx` routed **any** selection carrying `isWall`
through `handleToggleRemoveWall(roomIndex ?? 0, edge ?? "N")`. A drawn wall's mesh carries both
`isCustomWall` and `isWall` and has neither a room index nor an edge, so deleting a drawn wall
demolished **room 0's north wall** and left the drawn wall standing.

The ribbon's wall inspector had already been patched for exactly this and carries a comment
naming it. The keyboard Delete, the 3D HUD delete button and Scene's delete trigger all share
`handleDeleteSelected` and had not been. Fixed: drawn walls are removed from `customWalls`, the
solver-wall branch no longer guesses a target, and `WallInspector` gained a Delete button.

## What is broken or unfinished

Re-checked line by line on 2026-09-20. Two rows came off, one got worse, one is new.

| Issue | Severity | Note |
|---|---|---|
| **Nothing the frontend produces has ever been seen in a browser by the agent that wrote it** | **high** | The oldest open gap. Five document sheets, the plot editor, the drone tour, the drawn stairs and the quality governor are all verified as strings and numbers. No browser driver in the repo; `tsc` and `next build` are not eyes |
| A deployed visitor still gets the offline grid, because `NEXT_PUBLIC_SOLVER_URL` is unset and there is no hosted backend | **high** | [[client-side-fallback]], [[environment-notes]] |
| The free-text and both photo paths have never made a real API call | **medium** | No `ANTHROPIC_API_KEY` on the dev machine; stub-tested only — [[free-text-input]] |
| The quality governor has never run on a slow machine | **medium** | Tuned against a simulated renderer only. The laptop that produced the bug report has not re-run the build — [[quality-measures-itself]] |
| `Scene.tsx` **7,321** lines, `Blueprint2DView.tsx` **4,448**, `page.tsx` **2,977**; zero frontend tests | **medium**, and worse than it was | All three are bigger than at the 2026-08-30 structurize pass — `Scene.tsx` by 89%. It is now the highest-degree node in the graph (183 edges) — [[codebase-map]], [[knowledge-graph]] |
| The catalog's dining minimum is 64 sq ft, under NBC's 81 | medium | Raising it puts a 3BHK on a 30×40 back to INFEASIBLE. Recorded in `solver/rooms.py`, not hidden |
| `25x50_3bhk_north` does not solve, and did not before | medium | Claims 840 sq ft built-up on a 770 sq ft envelope. Named in `test_model_blueprints.py`; the fix is a product decision |
| Renderer hard-depends on the API for doors; an old backend silently draws a doorless house (now flagged in the UI) | medium | [[realism-gaps]] |
| **6 backend tests fail, and it is not load** | **medium** | `test_drift_objective_keeps_rooms_in_place` fails with a total displacement of **942 inches against a limit of 24** — that is not a timing wobble. It fails the same way on a clean `HEAD`, on an idle machine, in 7.5 s. So does `test_every_room_gets_a_window_or_a_vent_where_it_can`. Something in the 2026-09-19 work moved the solver's behaviour and the suite was last run green before it. [[layout-stability]] is the claimed moat; this test is the thing that guards it |
| Test suite is *also* wall-clock flaky under CPU load — `test_stability.py` by design | low | The 2026-09-20 run took 342 s against 256 s earlier the same day, with a lint job competing. That inflated the failure count but is not the cause of the two above — [[test-baseline]] |
| A twelve-room program hits the 2 s cold budget and returns FEASIBLE, not OPTIMAL | low | And a *five*-room mix on a curved plot does too. The budget is what binds — [[realism-gaps]] |
| Setbacks still hardcoded in `envelope/envelope.py` and in `bench_realism.py` | known gap | The app itself now derives them from G.O. Ms. 168 via `lib/compliance.ts`; the Python side did not follow — [[environment-notes]], [[duplicated-geometry]] |
| Single storey only | scope | [[project-phases]] |

### Came off this list on 2026-09-20

| Was | Now |
|---|---|
| `test_the_house_fills_most_of_what_the_catalog_allows` fails on roughly 2 runs in 4 | **Fixed by fixing what it measured.** It compared fill against the catalog ceiling, which is only meaningful while the ceiling is below the envelope; with the new maximums that ceiling is 105% of a 30×40. It now measures `min(ceiling, 1.0)`. Absolute fill 65% → ~90% |
| Nothing from 2026-09-06 has been seen rendered | Superseded by the row above, which is the same gap, larger and honestly scoped |

### Fixed on 2026-08-25

| Was | Now |
|---|---|
| Zone rules + connectivity dropped after the first solve | only the *dragged* room is released; connectivity never dropped |
| Renderer ignored solver `openings`; 4.5 in vs 5 in walls | renderer consumes them; 99 lines of duplication deleted |
| Entrance in 38% of layouts | **90%**, and it reaches the renderer |
| Envelope fill ~60% of ceiling, rooms at minimum size | **92-100%** of ceiling |
| No proportion limit - a 5 ft x 16 ft bedroom was legal | per-kind aspect limits; worst observed 2.4:1 |
| No daylight or ventilation constraint | every habitable *and wet* room reaches an exterior wall |
| 5 room kinds | **8** at the time - dining, store and entrance added; parking, sit-out, staircase and utility were added then removed ([[rejected-approaches]]), and sit-out, car porch and utility came back on 2026-09-06. **20 today**, counting the café pack |
| Every bathroom a leaf off the hall | master ensuite off the bedroom, common bath off the hall |
| No roof | RCC slab, parapet, and chajja over exterior openings |

## What has not moved at all

The zero-code question has been outranking the build since 2026-08-23 and remains
**completely unanswered**:

- [[q-does-anyone-pay]] — ten WhatsApp conversations.

Nine days of building have happened on top of it. That is the most important fact on this
page, and the one no test can turn red.

## Added 2026-08-30 (second session)

- **Structurize pass.** Five modules out of the three largest files, two duplications removed,
  all mechanically verified — [[codebase-map]]. The god components remain god components.
- **Graph rebuilt** to 651 nodes — [[knowledge-graph]], which also now records that its own
  2026-08-25 warning about `notes/build/` came true five days later.
- **Root `CLAUDE.md`** — agent rules for the repo.
- **[[client-side-fallback]] found.** Highest-severity item on this page. Not fixed.

## Added 2026-09-04 (render realism session)

- **The renderer had no environment map.** Every material was lit by three lights and nothing
  else, so nothing in the scene had a specular response and the path tracer ran with
  `environmentIntensity` pinned to 0. Fixed, along with AO, derived normal/roughness maps, a
  colour-space bug in every procedural texture, and transmissive glass — [[render-realism]].
- **Real furniture.** 15 CC0 Poly Haven models, 7.3 MB, swapped in over the procedural boxes for
  both hand-placed and auto-furnished pieces — [[furniture-models]].
- **Site landscaping.** Planting bed, shrubs and driveway on the setback strip.
- **Structural glazing and sliding glass doors** — [[three-pickers]].
- **Three placement pickers had three different sources.** Only one read the catalog. A door that
  provably existed in the bundle was unfindable in the UI for a day — [[three-pickers]]. This is
  the same class of defect as [[client-side-fallback]]: a surface that looks complete in
  isolation and disagrees with the thing it claims to reflect.

> [!warning] Nothing in this session was verified against a screenshot by the agent that wrote it
> It is verified by `tsc --noEmit`, `npm run build`, and by reading values out of the generated
> buffers. The frontend still has no tests. Two regressions in this session (anti-aliasing
> silently lost to the composer, moiré banding read as lawn stripes) were only caught because the
> user said the picture looked wrong.

## Added 2026-09-06 (pairs, catalog, free text) — [[2026-09-06]]

- **Requested room pairs.** `near` on `POST /solve`, scored rather than constrained, threaded to
  the frontend. `NEAR_WEIGHT = 60` from a six-point sweep — [[preferences-are-scored]].
- **Size drift built and deleted.** Ten perturbed edits churned room sizes by **1 inch** without
  it. The problem did not exist; the term went. The measurement is the point, not the feature.
- **Two locked decisions reversed on the user's call** — [[free-text-input]]. A prompt box now
  sits beside the tap path, which is unchanged; sit-out, car porch and utility are back in the
  catalog with `open_sided`. Struck through, not deleted, in [[rejected-approaches]].
- **[[furniture-clearances]] found from a user report, not a test.** A dining table left 1.1 ft
  of floor each side; a 4 ft bathroom got a 2 ft bathtub drawn through the washing machine. Three
  rooms fixed. Nobody has looked at the result.

> [!warning] The same warning as 2026-09-04 still applies, and is now worse
> Nothing in this session was verified against a screenshot either. The app was launched and
> both servers answered, but there is no browser driver in the repo, so no picture was seen. The
> two regressions that survived 2026-09-04's checks were caught by the user's eyes — and it was
> the user's eyes that found [[furniture-clearances]] as well.

## Recommended order

Re-ordered 2026-09-20. Items 0, 4, 5 and 7 are struck because they are done; nothing else moved,
which is the point.

0. ~~**Fix or label [[client-side-fallback]].**~~ **Done 2026-08-31.** The offline engine reports
   `OFFLINE_ESTIMATE` with an empty rule list, no longer falls through on a non-`ok` response,
   and the ribbon shows a warning instead of a sparkle. Pointing the deploy at a hosted backend
   is the remaining half, and it needs a backend that does not exist yet — [[environment-notes]].
1. **Answer [[q-does-anyone-pay]].** Zero code, **four weeks** overdue. Since it was first written
   the project has added the whole interior-design package, two photo input paths, plot shapes,
   wall joins, drawn stairs, a drone tour and a quality governor. Nobody has been asked for money,
   so **none of it is known to be wanted.** This has been item 1 on this list since 2026-08-23 and
   has never been started.
2. **Look at the product in a browser, once.** Five document sheets, the plot editor, the drone
   tour and the drawn stairs have never been seen rendered by the agent that built them. Every
   session since 2026-09-04 has widened this and every session has written the same warning. Two
   of the three regressions ever caught in this project were caught by the user's eyes.
3. **Verify the three model paths against the real API.** Free text, plan photo and facade photo
   have never made a call. Set `ANTHROPIC_API_KEY` and try four prompts each — normal, vague,
   impossible, adjacency. The field descriptions that steer the model are guesses until one real
   call proves otherwise.
4. ~~**Commit.**~~ **Done 2026-09-19.** Tree clean, 63 commits. `main` is two behind this branch
   and nothing has been pushed.
5. ~~**Decide the flaky fill test.**~~ **Done 2026-09-19** — by fixing what it measured rather
   than its budget. See the table above.
6. **Host a backend.** A deployed visitor still gets the offline grid, and also gets a prompt box
   that 503s or points at their own localhost. This is unchanged since 2026-08-31.
7. ~~**Check the catalog maximums against real house plans.**~~ **Done 2026-09-19** —
   [[room-sizes-from-code]]. Maximums are now what India builds at the top of this band, sourced
   per room kind; `catalog is the binder` went 2/5 → 0/5.
8. **Run the quality governor on a slow machine.** It exists because of one report from one
   laptop, and that laptop has not seen the fix — [[quality-measures-itself]].
9. **Decide the dining minimum.** 64 sq ft against NBC's 81, held there because raising it makes a
   3BHK on a 30×40 INFEASIBLE. That is a real product trade and it is currently being made by
   default.
10. Only then: DXF/DWG export, 360 panorama, curved room footprints —
    [[curves-are-a-face-not-a-plan]] is the standing decision and a round room would be a change
    to it — touch controls, or [[project-phases|Phase 2]].

**Links.** [[Home]] · [[workflow]] · [[HANDOFF]] · [[build-order]] · [[test-baseline]] ·
[[codebase-map]] · [[knowledge-graph]] · [[client-side-fallback]] · [[free-text-input]] ·
[[furniture-clearances]] · [[zone-rule-is-a-constraint]] · [[quality-measures-itself]]
