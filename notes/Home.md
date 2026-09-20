---
tags: [moc]
---
# Home

Vault for **plot-to-plan** — a CP-SAT house layout generator for Indian plot owners.
Canonical source of truth is [[HANDOFF]] at the repo root. Every note here points back into it.

> [!success] Status as of 2026-09-20 — **183/183 tests green, tree clean**
> Full review: [[project-status]]. How the project is run: [[workflow]].
>
> **177/183 backend tests pass**; the six failures are pre-existing and reproduce on a clean
> `HEAD` — see [[project-status]]. 63 commits, nothing pushed.
> 8,348 lines of Python and 47,556 of TS/TSX. Twenty room kinds, four input paths (taps, free
> text, a photographed plan, a photographed facade), seven document sheets, and a quality
> governor that measures its own frame time — [[quality-measures-itself]].
>
> Still true, and now **four weeks** old: **no paying user**, and [[q-does-anyone-pay]] has never
> been started while everything above was built on top of it. That still outranks everything.
>
> Also still true: **nothing the frontend produces has ever been seen in a browser** by the agent
> that wrote it.

## Start here
- [[project-status]] — **current state, re-measured 2026-09-20**
- [FEATURES.md](../FEATURES.md) — **every shipped capability, by subsystem, with the file that owns it**
- [TOOLS.md](../TOOLS.md) — **every instrument you can pick up and operate**
- [[workflow]] — how this project is run, and where that broke down
- [[HANDOFF]] — the full brief, unedited, plus a dated addendum (§13)
- [[project-phases]] — **read this first**: Phase 1 (3D model, single storey) vs Phase 2+ (multi-level, fire exits/egress/staircase rules hardcoded)
- [[what-the-product-is]]
- [[build-order]] — Phase 1's two-week plan with done-conditions
- [[test-baseline]] — **177/183 passing** as of 2026-09-20; six failures, none of them new
- [[project-name]] — `plot-to-plan` is provisional; settle it before the first commit

## Build steps — Phase 1, all done
[[step-1-threejs-shell]] → [[step-2-solver-core]] → [[step-3-wire-together]] →
[[step-4-drift-objective]] → the direction-rules step (entrance gap now **closed** — see
[[realism-gaps]]) → [[step-6-walkthrough]] (**unplanned**, no done-condition, source of both
regressions, fixed 2026-08-25)

## Decisions (locked — need new evidence, not reasoning, to reverse)
- [[india-only]]
- [[input-is-plot-dimensions]]
- [[client-continuous-server-discrete]]
- [[integer-inches]]
- [[zone-rule-is-a-constraint]] — a posted rule is a constraint, never a score
- [[zero-keyboard-events]]
- [[single-storey-first]]
- [[project-phases]]
- [[quality-measures-itself]] — detection picks a rung, measurement corrects it
- [[rejected-approaches]] — and why, so they are not retried

## The solver's own rules
- [[preferences-are-scored]] — the one documented exception to
  [[zone-rule-is-a-constraint]], and where the line falls
- [[room-sizes-from-code]] — the catalog was test fixtures at **both** ends: minimums fixed
  2026-09-03, maximums 2026-09-19
- [[boq-was-not-reading-the-takeoff]] — the solver measured the building and nothing read it
- [[stair-styles]] — the six catalog stairs, and the drawn walk line that replaced choosing one

## The interior design package (2026-09-19)
Six surfaces built off one model, each with the decision that shaped it.
- [[schedule-is-measured-not-declared]] — FF&E and finish schedules, sized off the built scene
- [[elevations-look-from-inside]] — one elevation per wall, and why left-to-right flips
- [[cite-the-clearance-or-admit-it]] — NKBA where it exists, "no published source" where it does not
- [[lighting-says-the-number]] — reflected ceiling plan, and the lux estimate against IS 3646
- [[board-is-drawn-to-one-scale]] — the finish board, and why the single scale is the feature
- [[object-library-licensing]] — CC0 only, because the app redistributes the model file
- [[furniture-models]] — the 62 committed assets and their provenance

## Engineering
- [[architecture]] · [[output-schema]] · [[environment-notes]]
- [[cp-sat-api]] · [[cp-sat-gotchas]]
- [[layout-stability]] — the claimed moat
- [[claim-most-likely-wrong]] — and the claim that it is not
- [[rooms-do-not-form-a-house]] — the packing-vs-dwelling finding, and its fix
- [[realism-gaps]] — what made the packing not a house, and the six families that fixed it
- the drag regression — the drag regression, **fixed**
- [[duplicated-geometry]] — renderer vs solver geometry, **closed**
- [[client-side-fallback]] — the offline layout that claimed rules it never posted, **closed 2026-08-31**

## UI
- [[ui-principles]]

## Open questions
- [[q-does-anyone-pay]]
- [[q-telangana-parcel-geometry]]
- [[q-market-above-bpass-threshold]]

## Working notes
- [[daily-log]] — findings, entries, timings
- [[codebase-map]] — code ↔ note index, filled in as files land
- [[knowledge-graph]] — queryable graph over code + notes (**1,962 nodes, 4,514 edges, 105 communities**, rebuilt 2026-09-20)
