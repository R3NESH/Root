---
tags: [moc]
---
# Home

Vault for **plot-to-plan** — a CP-SAT house layout generator for Indian plot owners.
Canonical source of truth is [[HANDOFF]] at the repo root. Every note here points back into it.

> [!success] Status as of 2026-08-31 — **realism landed; the fallback no longer lies**
> Full review: [[project-status]]. How the project is run: [[workflow]].
>
> **50/50 tests pass.** Three blocking defects are closed
> ([[vaastu-and-connectivity-drop-on-edit]], [[duplicated-geometry]], [[client-side-fallback]])
> and [[realism-gaps]] is implemented: 8 room kinds, daylight and proportion as constraints, a
> parent tree with a master ensuite, and a roof. The output now reads as a house rather than a legal rectangle
> packing, and **Auto-Furnish Interiors** can be switched off for the bare shell.
>
> Still true: **no paying user**, and [[q-competitor-defects]] and [[q-does-anyone-pay]] have
> been unanswered for ten days while the code kept growing. Those now outrank everything.

## Start here
- [[project-status]] — **current state, re-measured 2026-08-30**
- [[features-and-tools]] — **comprehensive inventory of all features & tools implemented**
- [[workflow]] — how this project is run, and where that broke down
- [[HANDOFF]] — the full brief, unedited, plus a dated addendum (§13)
- [[project-phases]] — **read this first**: Phase 1 (3D model, single storey) vs Phase 2+ (multi-level, fire exits/egress/staircase rules hardcoded)
- [[what-the-product-is]]
- [[build-order]] — Phase 1's two-week plan with done-conditions
- [[test-baseline]] — **50/50 passing** as of 2026-08-31
- [[project-name]] — `plot-to-plan` is provisional; settle it before the first commit

## Build steps — Phase 1, all done
[[step-1-threejs-shell]] → [[step-2-solver-core]] → [[step-3-wire-together]] →
[[step-4-drift-objective]] → [[step-5-vaastu]] (entrance gap now **closed** — see
[[realism-gaps]]) → [[step-6-walkthrough]] (**unplanned**, no done-condition, source of both
regressions, fixed 2026-08-25)

## Decisions (locked — need new evidence, not reasoning, to reverse)
- [[india-only]]
- [[input-is-plot-dimensions]]
- [[client-continuous-server-discrete]]
- [[integer-inches]]
- [[vaastu-as-constraints]]
- [[zero-keyboard-events]]
- [[single-storey-first]]
- [[project-phases]]
- [[rejected-approaches]] — and why, so they are not retried

## Market
- [[tg-bpass-kills-permits]]
- [[autodcr-owns-municipal-scrutiny]]
- [[price-ceiling]]
- [[architects-act-legal-lane]]
- [[vaastu-is-mandatory-demand]]
- [[competitor-landscape]]

## Engineering
- [[architecture]] · [[output-schema]] · [[environment-notes]]
- [[cp-sat-api]] · [[cp-sat-gotchas]]
- [[layout-stability]] — the claimed moat
- [[claim-most-likely-wrong]] — and the claim that it is not
- [[rooms-do-not-form-a-house]] — the packing-vs-dwelling finding, and its fix
- [[realism-gaps]] — what made the packing not a house, and the six families that fixed it
- [[vaastu-and-connectivity-drop-on-edit]] — the drag regression, **fixed**
- [[duplicated-geometry]] — renderer vs solver geometry, **closed**
- [[client-side-fallback]] — the offline layout that claimed Vaastu, **closed 2026-08-31**

## UI
- [[ui-principles]]

## Open questions
- [[q-competitor-defects]]
- [[q-does-anyone-pay]]
- [[q-telangana-parcel-geometry]]
- [[q-market-above-bpass-threshold]]

## Working notes
- [[daily-log]] — findings, entries, timings
- [[codebase-map]] — code ↔ note index, filled in as files land
- [[knowledge-graph]] — queryable graph over code + notes (651 nodes, 1,536 edges)
