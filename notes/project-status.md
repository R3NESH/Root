---
tags: [moc, status]
status: current
date: 2026-08-25
---
# Project status — 2026-08-25

Reviewed against the working tree at commit `e855691`, with every number below re-measured
today rather than carried over from [[daily-log|the daily notes]].

> [!success] Updated later on 2026-08-25 — both blocking defects fixed, realism work landed
> [[vaastu-and-connectivity-drop-on-edit]] and [[duplicated-geometry]] are closed, and
> [[realism-gaps]] is implemented: the solver now produces something that reads as a house
> rather than a legal rectangle packing. **41 tests green.**
>
> What has *not* changed: still no paying user, and [[q-competitor-defects]] and
> [[q-does-anyone-pay]] are now ten days unanswered. Today added ~1,000 lines on top of them.

## Where the project actually is

| | |
|---|---|
| Phase | [[project-phases\|Phase 1]] — feature-complete, then regressed |
| Commits | **7**, all 2026-08-24 (16:30–17:18). The vault still says "no commit" in places |
| Code | ~1,950 lines backend Python · ~4,000 lines frontend TS/CSS |
| Tests | **41 passing** in ~30 s — up from the 23 recorded in [[test-baseline]] |
| Frontend checks | `tsc --noEmit` 0 errors · `eslint` 0 warnings — re-run today |
| Paying users | **none**, and nobody asked yet |

## What works, verified today

- **Solver core.** 4–6 rooms placed in the envelope, no overlaps, no escapes. OPTIMAL in
  **127 ms** for the 6-room Vaastu mix.
- **Layout stability.** [[claim-most-likely-wrong]] settled 2026-08-24 and it still holds — 0 in
  displacement across 10 perturbed edits, against 2381 in without the drift objective.
- **Connectivity, on a first solve.** [[rooms-do-not-form-a-house]]'s star-topology fix works:
  **24 of 24** random Vaastu-on mixes have every room reachable, against 37% before it.
- **The 3D product.** Orbit view, first-person walkthrough, minimap, drag-and-drop rooms,
  per-room custom dimensions, procedural interiors — see [[step-6-walkthrough]].

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

## Recommended order

1. **Answer [[q-competitor-defects]] and [[q-does-anyone-pay]].** Zero code, ten days overdue,
   and one plausible answer to the first - "competitors' plans are not realistic enough" - would
   make everything built today the roadmap. The other answers would make it wasted effort.
2. Test on the real 30x40 north-facing Kandi plot. Still never done.
3. Check the catalog maximums against real house plans. The fill metric is only as honest as
   the ceiling it is measured against.
4. Surface INFEASIBLE usefully in the UI: "this program does not fit - remove a room".
5. Only then: touch controls for the walkthrough, or [[project-phases|Phase 2]].

**Links.** [[Home]] · [[workflow]] · [[HANDOFF]] · [[build-order]] · [[test-baseline]] ·
[[codebase-map]]
