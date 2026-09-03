---
tags: [moc, status]
status: current
date: 2026-09-03
---
# Project status — 2026-09-03

Reviewed against the working tree at commit `4e77ca7` plus uncommitted work, with every number
below re-measured on 2026-09-03 rather than carried over from [[daily-log|the daily notes]].

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
| Commits | **36** on `main` |
| Code | **3,600+** lines backend Python · **28,000+** TS/TSX + **9,000+** CSS frontend |
| Tests | **93 passing** in ~198 s — up from the 50 recorded in [[test-baseline]] |
| Frontend checks | `tsc --noEmit` 0 errors · `next build` 0 warnings |
| Blueprints | **20 authentic curated models** with 4-directional filtering |
| Paying users | **none**, and nobody asked yet |

## What works, verified today

- **Architectural Blueprints Catalog.** 20 models across North, East, South, West facings, Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, and Parisian Penthouses.
- **Walls as Objects & BIM Engine.** Single-wall shared partitions with hosted opening attachments, eliminating double-counted doors and floating room borders.
- **Bill of Quantities (BOQ) & Cost Takeoff.** Real-time civil, masonry, finishes, MEP, and labor estimation across Economy, Standard, and Luxury tiers.
- **Real-World Kandi, Telangana Plot Validated.** 30×40 North-facing plot solved under TG-bPASS setbacks (5 ft road, 3 ft rear/sides) across 2BHK and 3BHK programs with Vaastu (Agneya kitchen, Nairutya master bed, Ishanya pooja), 100% door reachability, and tight compact footprint (`test_kandi_plot.py`).
- **Solver core & Realism.** 93 unit tests green. Compact footprint term prevents loose pavilion layouts. NBC 2016 sizing ensures standard Indian plots (20×30, 25×40, 30×40) solve reliably.
- **The 3D product.** Orbit view, first-person walkthrough with mobile on-screen D-pad and action buttons, minimap, drag-and-drop rooms, CAD drafting, 2D blueprint export, material customization, custom wall paint bands, and real Poly Haven 3D models.
- **Walkthrough Collision Engine & Interactive Doors.** Axis-separated sliding capsule collision ($R = 0.72\text{ ft}$) prevents phasing through walls, closed doors, and furniture (custom and built-ins). Interactive hinged doors start closed, block passage, and swing open/closed smoothly via `E` key, direct mouse click, or mobile touch button with on-screen HUD prompt.
- **Architectural Spatial FOV.** Walkthrough camera FOV expanded from 45° to 68° (75° sprint), eliminating cramped tunnel vision and congestion.
- **Hardware Path Tracer.** Interactive WebGL2 raytracing with real-time progressive sampling and bounces.
- **Full Features & Subsystems Inventory.** Complete log of all features, tools, and graphics engines in [[features-and-tools]].

## What is broken or unfinished

| Issue | Severity | Note |
|---|---|---|
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
| Vaastu + connectivity dropped after the first solve | only the *dragged* room is released; connectivity never dropped |
| Renderer ignored solver `openings`; 4.5 in vs 5 in walls | renderer consumes them; 99 lines of duplication deleted |
| Entrance in 38% of layouts | **90%**, and it reaches the renderer |
| Envelope fill ~60% of ceiling, rooms at minimum size | **92-100%** of ceiling |
| No proportion limit - a 5 ft x 16 ft bedroom was legal | per-kind aspect limits; worst observed 2.4:1 |
| No daylight or ventilation constraint | every habitable *and wet* room reaches an exterior wall |
| 5 room kinds | **8** - dining, store and entrance added; parking, sit-out, staircase and utility were added then removed ([[rejected-approaches]]) |
| Every bathroom a leaf off the hall | master ensuite off the bedroom, common bath off the hall |
| No roof | RCC slab, parapet, and chajja over exterior openings |

## What has not moved at all

Both zero-code questions have been outranking the build since 2026-08-23 and remain
**completely unanswered**:

- [[q-competitor-defects]] — an hour of work; two of its five possible answers invalidate a
  fortnight of the code above.
- [[q-does-anyone-pay]] — ten WhatsApp conversations.

Nine days of building have happened on top of them. That is the most important fact on this
page, and the one no test can turn red.

## Added 2026-08-30 (second session)

- **Structurize pass.** Five modules out of the three largest files, two duplications removed,
  all mechanically verified — [[codebase-map]]. The god components remain god components.
- **Graph rebuilt** to 651 nodes — [[knowledge-graph]], which also now records that its own
  2026-08-25 warning about `notes/build/` came true five days later.
- **Root `CLAUDE.md`** — agent rules for the repo.
- **[[client-side-fallback]] found.** Highest-severity item on this page. Not fixed.

## Recommended order

0. ~~**Fix or label [[client-side-fallback]].**~~ **Done 2026-08-31.** The offline engine reports
   `OFFLINE_ESTIMATE` with an empty rule list, no longer falls through on a non-`ok` response,
   and the ribbon shows a warning instead of a sparkle. Pointing the deploy at a hosted backend
   is the remaining half, and it needs a backend that does not exist yet — [[environment-notes]].
1. **Answer [[q-competitor-defects]] and [[q-does-anyone-pay]].** Zero code, ten days overdue,
   and one plausible answer to the first - "competitors' plans are not realistic enough" - would
   make everything built today the roadmap. The other answers would make it wasted effort.
2. Test on the real 30x40 north-facing Kandi plot. Still never done.
3. Check the catalog maximums against real house plans. The fill metric is only as honest as
   the ceiling it is measured against.
4. Surface INFEASIBLE usefully in the UI: "this program does not fit - remove a room".
5. Only then: touch controls for the walkthrough, or [[project-phases|Phase 2]].

**Links.** [[Home]] · [[workflow]] · [[HANDOFF]] · [[build-order]] · [[test-baseline]] ·
[[codebase-map]] · [[knowledge-graph]] · [[client-side-fallback]]
