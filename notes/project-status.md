---
tags: [moc, status]
status: current
date: 2026-09-07
---
# Project status — 2026-09-07

Reviewed against the working tree at commit `8a29fcc` plus a large body of uncommitted work,
with every number below re-measured on 2026-09-07 rather than carried over from
[[daily-log|the daily notes]].

> [!warning] Nothing from the 2026-09-06 session is committed
> Twenty-five files, roughly +900 lines. Three features, two reversed decisions, one deleted
> experiment. It exists only in the working tree.

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
| Commits | **46** on `main`, plus 25 uncommitted files |
| Code | **6,900** lines backend Python incl. tests · **38,900** TS/TSX + **9,500** CSS frontend |
| Tests | **139 passing, 1 failing** in ~280 s — the failure is a pre-existing flake, measured below |
| Frontend checks | `tsc --noEmit` 0 errors · `next build` 0 warnings |
| Blueprints | **20 authentic curated models** with 4-directional filtering |
| Room kinds | **11 residential** — sit-out, car porch and utility returned 2026-09-06 |
| Input paths | taps **and** free text — [[free-text-input]] |
| Paying users | **none**, and nobody asked yet |

## What works, verified today

- **Architectural Blueprints Catalog.** 20 models across North, East, South, West facings, Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, and Parisian Penthouses.
- **Walls as Objects & BIM Engine.** Single-wall shared partitions with hosted opening attachments, eliminating double-counted doors and floating room borders.
- **Bill of Quantities (BOQ) & Cost Takeoff.** Real-time civil, masonry, finishes, MEP, and labor estimation across Economy, Standard, and Luxury tiers.
- **Real-World Kandi, Telangana Plot Validated.** 30×40 North-facing plot solved under TG-bPASS setbacks (5 ft road, 3 ft rear/sides) across 2BHK and 3BHK programs with 100% door reachability, and tight compact footprint (`test_kandi_plot.py`).
- **Solver core & Realism.** 93 unit tests green. Compact footprint term prevents loose pavilion layouts. NBC 2016 sizing ensures standard Indian plots (20×30, 25×40, 30×40) solve reliably.
- **The 3D product.** Orbit view, first-person walkthrough with mobile on-screen D-pad and action buttons, minimap, drag-and-drop rooms, CAD drafting, 2D blueprint export, material customization, custom wall paint bands, and real Poly Haven 3D models.
- **Walkthrough Collision Engine & Interactive Doors.** Axis-separated sliding capsule collision ($R = 0.72\text{ ft}$) prevents phasing through walls, closed doors, and furniture (custom and built-ins). Interactive hinged doors start closed, block passage, and swing open/closed smoothly via `E` key, direct mouse click, or mobile touch button with on-screen HUD prompt.
- **Architectural Spatial FOV.** Walkthrough camera FOV expanded from 45° to 68° (75° sprint), eliminating cramped tunnel vision and congestion.
- **Hardware Path Tracer.** Interactive WebGL2 raytracing with real-time progressive sampling and bounces.
- **Full Features & Subsystems Inventory.** Capabilities in [FEATURES.md](../FEATURES.md), the things you click in [TOOLS.md](../TOOLS.md). Both re-verified 2026-09-19; the stale third inventory was deleted the same day.

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

| Issue | Severity | Note |
|---|---|---|
| `test_the_house_fills_most_of_what_the_catalog_allows` fails on roughly 2 runs in 4 | **medium** | Pre-existing. It measures the 2 s budget, not the objective — [[2026-09-06]] |
| The free-text path has never made a real API call | **medium** | No `ANTHROPIC_API_KEY` on the dev machine; stub-tested only — [[free-text-input]] |
| Nothing from 2026-09-06 has been seen rendered | **medium** | No browser driver in the repo; `tsc` and `next build` are not eyes — [[furniture-clearances]] |
| A twelve-room program hits the 2 s cold budget and returns FEASIBLE, not OPTIMAL | low | [[realism-gaps]] |
| Renderer hard-depends on the API for doors; an old backend silently draws a doorless house (now flagged in the UI) | medium | [[realism-gaps]] |
| Setbacks still hardcoded | known gap | [[environment-notes]] |
| Test suite is wall-clock flaky under CPU load — `test_stability.py` by design | medium | [[test-baseline]] |
| A deployed visitor still gets the offline grid, because `NEXT_PUBLIC_SOLVER_URL` is unset and there is no hosted backend | **high** | [[client-side-fallback]], [[environment-notes]] |
| `Scene.tsx` and `Blueprint2DView.tsx` are ~4,000-line single components; zero frontend tests | medium | [[codebase-map]] |
| Single storey only | scope | [[project-phases]] |

### Fixed on 2026-08-25

| Was | Now |
|---|---|
| Zone rules + connectivity dropped after the first solve | only the *dragged* room is released; connectivity never dropped |
| Renderer ignored solver `openings`; 4.5 in vs 5 in walls | renderer consumes them; 99 lines of duplication deleted |
| Entrance in 38% of layouts | **90%**, and it reaches the renderer |
| Envelope fill ~60% of ceiling, rooms at minimum size | **92-100%** of ceiling |
| No proportion limit - a 5 ft x 16 ft bedroom was legal | per-kind aspect limits; worst observed 2.4:1 |
| No daylight or ventilation constraint | every habitable *and wet* room reaches an exterior wall |
| 5 room kinds | **8** - dining, store and entrance added; parking, sit-out, staircase and utility were added then removed ([[rejected-approaches]]) |
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

0. ~~**Fix or label [[client-side-fallback]].**~~ **Done 2026-08-31.** The offline engine reports
   `OFFLINE_ESTIMATE` with an empty rule list, no longer falls through on a non-`ok` response,
   and the ribbon shows a warning instead of a sparkle. Pointing the deploy at a hosted backend
   is the remaining half, and it needs a backend that does not exist yet — [[environment-notes]].
1. **Answer [[q-does-anyone-pay]].** Zero code, two weeks overdue. Four more features have been
   built on top of it since. Nobody has been asked for money, so nothing built so far is known to
   be wanted.
2. **Verify the free-text path against the real model.** It has never made a call. Set
   `ANTHROPIC_API_KEY` and try four prompts — normal, vague, impossible, adjacency. Everything in
   that layer is stub-tested, and the field descriptions that steer the model are guesses until
   one real call proves otherwise.
3. **Look at a car porch, a dining room and a bathroom in 3D.** Three rooms changed on 2026-09-06
   and none has been seen. This is a five-minute check that `tsc` structurally cannot do.
4. **Commit.** 25 files, nothing staged, three separable commits.
5. **Decide the flaky fill test.** It fails about half the time on committed code and measures
   the 2 s budget rather than the objective. Give it a fixed longer budget or delete it —
   `test_the_house_reads_as_one_building` already locks down what the compactness term buys.
   Leaving it red trains everyone to ignore a red suite.
6. **Host a backend.** A deployed visitor still gets the offline grid, and now also gets a prompt
   box that 503s or points at their own localhost. Free text made the deployment gap *worse*.
7. Check the catalog maximums against real house plans. The fill metric is only as honest as the
   ceiling it is measured against.
8. Only then: curved room footprints — [[curves-are-a-face-not-a-plan]] is the standing decision
   and a round room would be a change to it — touch controls, or [[project-phases|Phase 2]].

**Links.** [[Home]] · [[workflow]] · [[HANDOFF]] · [[build-order]] · [[test-baseline]] ·
[[codebase-map]] · [[knowledge-graph]] · [[client-side-fallback]] · [[free-text-input]] ·
[[furniture-clearances]]
