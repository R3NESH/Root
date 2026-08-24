---
tags: [moc]
---
# Home

Vault for **plot-to-plan** — a CP-SAT house layout generator for Indian plot owners.
Canonical source of truth is [[HANDOFF]] at the repo root. Every note here points back into it.

> [!success] Status as of 2026-08-24 — **Phase 1 complete**
> All five build steps done. The app generates a real 3D house model from plot dimensions +
> facing, with Vaastu constraints and a stable layout across edits. **23/23 tests green.**
> [[claim-most-likely-wrong]] is **settled and the claim held** — layout stability is a real
> problem, measured, and solved.
>
> Still true: no commit, **no paying user**, and [[q-competitor-defects]] and
> [[q-does-anyone-pay]] remain unanswered. Those now outrank all further building.

## Start here
- [[HANDOFF]] — the full brief, unedited, plus a dated addendum (§13)
- [[project-phases]] — **read this first**: Phase 1 (3D model, single storey) vs Phase 2+ (multi-level, fire exits/egress/staircase rules hardcoded)
- [[what-the-product-is]]
- [[build-order]] — Phase 1's two-week plan with done-conditions
- [[test-baseline]] — **23/23 passing** as of 2026-08-24
- [[project-name]] — `plot-to-plan` is provisional; settle it before the first commit

## Build steps — Phase 1, all done
[[step-1-threejs-shell]] → [[step-2-solver-core]] → [[step-3-wire-together]] →
[[step-4-drift-objective]] → [[step-5-vaastu]] (one gap: entrance N/E, needs `openings`)

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
