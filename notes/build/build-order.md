---
tags: [build, moc]
date: 2026-08-23
---
# Build order — Phase 1

This is the [[project-phases|Phase 1]] plan: a baseline generator that produces a real **3D
model of the house**, single storey. Multi-level modelling and hardcoded regulations (fire
exits, egress, staircases) are Phase 2, out of scope here — see [[project-phases]].

Two weeks. **Each step has an explicit done-condition — do not advance without meeting it.**

| Step | Work | Done when |
|---|---|---|
| [[step-1-threejs-shell\|1]] | Three.js: plot box, setback envelope, extrusion, drag handles snapping to 1 ft. No solver. | box responds instantly, zero network calls |
| [[step-2-solver-core\|2]] | CP-SAT: place 4–6 rooms in a fixed 30×40 envelope, print JSON | rooms never overlap and never exit the envelope, across 20 random room mixes |
| [[step-3-wire-together\|3]] | Wire together: debounced POST, render returned rects | end-to-end on one plot |
| [[step-4-drift-objective\|4]] | Drift objective. **Time the solve.** | rooms nudge rather than jump across 10 consecutive edits; solve stays under 500 ms |
| [[step-5-vaastu\|5]] | Vaastu as constraints: kitchen SE, master bedroom SW, entrance N/E | still solves, still stable, still under 500 ms |

> [!important] Test on a real plot
> A real **30×40 north-facing plot in Kandi, Telangana** — not a synthetic one.

**Establish the [[test-baseline]] at step 2.** Every later step reports the delta against it.

## Running in parallel, needing no code

- [[q-does-anyone-pay]] — ten WhatsApp conversations

This outranks steps 3–5 in decision value. It blocks neither step 1 nor step 2.

> [!success] All five steps done, 2026-08-24
> Every done-condition met except one, recorded explicitly: **entrance N/E** in
> [[step-5-vaastu]], which needs `openings` to exist first. [[test-baseline]] 5 → 23 passing.
> [[claim-most-likely-wrong]] settled — the claim held.
>
> **Not done, and this matters more than the code:** the plan says to test on a real 30×40
> north-facing plot in **Kandi, Telangana**. Everything so far has been synthetic. Competing
> tools reportedly fail on real plots, not toy ones — so this is still an open validation gap.

## What actually happened after the plan completed

Not Phase 2 — an unplanned [[step-6-walkthrough]], built the same day with no done-condition
written first. It produced the project's most valuable finding ([[rooms-do-not-form-a-house]])
and both of its current blocking defects. See [[workflow]] for why that is not a coincidence.

## After this plan completes

[[project-phases|Phase 2]]: multi-level (G+1, G+2, ...) with fire exits, egress paths and
staircase rules hardcoded as solver constraints. Not started, not scheduled — see
[[project-phases]] for what's known and what isn't.

Source: [[HANDOFF]] §9, §13 · Back to [[Home]]
