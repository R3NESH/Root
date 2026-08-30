---
tags: [moc, status]
status: current
date: 2026-08-30
---
# Project status — 2026-08-30

Reviewed against the working tree at commit `2871114`, with every number below re-measured
today rather than carried over from [[daily-log|the daily notes]].

> [!success] Updated on 2026-08-30 — 20 Authentic Architectural Model Blueprints & Contiguous Snapping
> - **20 Curated Architectural Model Blueprints** across 1BHK to 4BHK and 20×30 to 50×80 plots added to [[modelBlueprints.ts]].
> - **Contiguous Coordinate Snapping**: 0-inch gap partition walls, eliminating floating rooms and double walls.
> - **Strict Exterior Window Rule**: Windows prevented on interior shared walls.
> - **Roof Chajja Alignment**: Directly anchored above exterior openings.
> - **43 tests green (100%)**, 0 TypeScript errors.

## Where the project actually is

| | |
|---|---|
| Phase | [[project-phases\|Phase 1]] — production CAD & 3D walkthrough ready |
| Commits | **12+** on `main` |
| Code | **2,274** lines backend Python · **20,617** TS/TSX + **6,005** CSS frontend — re-measured, the old figure was half |
| Tests | **43 passing** in ~30 s — up from the 23 recorded in [[test-baseline]] |
| Frontend checks | `tsc --noEmit` 0 errors · `next build` 0 warnings |
| Blueprints | **20 authentic curated models** with 4-directional filtering |
| Paying users | **none**, and nobody asked yet |

## What works, verified today

- **Architectural Blueprints Catalog.** 20 models across North, East, South, West facings, Kerala Courtyard, Chettinad Heritage, Scandinavian Modernist, Japanese Zen, and Parisian Penthouses.
- **Contiguous Room Layouts.** 0-inch gap shared partition walls with automatic interior connecting doors.
- **Solver core.** 4–6 rooms placed in the envelope, no overlaps, no escapes. OPTIMAL in **127 ms** for the 6-room Vaastu mix.
- **Layout stability.** 0 in displacement across perturbed edits with drift objective.
- **Connectivity.** Star topology + parent hierarchy guarantees 100% reachable rooms.
- **The 3D product.** Orbit view, first-person walkthrough, minimap, drag-and-drop rooms, CAD drafting, 2D blueprint export, material customization, and procedural interiors.

## What is broken or unfinished

| Issue | Severity | Note |
|---|---|---|
| Catalog maximums were chosen as test fixtures, not from real house plans — and fill is measured against them | medium | [[realism-gaps]] |
| A twelve-room program hits the 2 s cold budget and returns FEASIBLE, not OPTIMAL | low | [[realism-gaps]] |
| A large programme returns INFEASIBLE; the UI shows the raw status, not "remove a room" | medium | [[realism-gaps]] |
| Renderer hard-depends on the API for doors; an old backend silently draws a doorless house (now flagged in the UI) | medium | [[realism-gaps]] |
| Walkthrough is keyboard-only; audience is on phones | medium | [[step-6-walkthrough]], [[zero-keyboard-events]] |
| Setbacks still hardcoded | known gap | [[environment-notes]] |
| Test suite is wall-clock flaky under CPU load | medium | [[test-baseline]] |
| **The deployed site runs a fake solver that claims Vaastu it never enforced** | **high** | [[client-side-fallback]] |
| `Scene.tsx` and `Blueprint2DView.tsx` are ~3,900-line single components; zero frontend tests | medium | [[codebase-map]] |
| Never tested on the real Kandi, Telangana plot | **validation gap** | [[build-order]] |
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
| 5 room kinds | **7** - dining and store added; parking, sit-out, staircase and utility were added then removed ([[rejected-approaches]]) |
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
- **Graph rebuilt** to 662 nodes — [[knowledge-graph]], which also now records that its own
  2026-08-25 warning about `notes/build/` came true five days later.
- **Root `CLAUDE.md`** — agent rules for the repo.
- **[[client-side-fallback]] found.** Highest-severity item on this page. Not fixed.

## Recommended order

0. **Fix or label [[client-side-fallback]].** Two lines. Everything else on this list assumes
   the product does what its status string says, and right now the deployed one does not.
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
