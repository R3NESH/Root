---
tags: [decision, locked, phasing]
status: locked
date: 2026-08-23
---
# Project phases

**Correction to the original brief** — dated the same day as the brief itself, so this note is
the live version and [[HANDOFF]] §13 is the append-only record of the correction. Where they
disagree, this note wins.

## Phase 1 — baseline: generate a 3D model of the house

**Deliverable.** From the customer's plot dimensions and facing ([[input-is-plot-dimensions]]),
generate an actual **3D model of the house** — not a 2D floor plan with a box extruded around
its outer envelope. CP-SAT places rooms as rectangles ([[cp-sat-api]]); each room boundary gets
extruded into walls at a fixed height and rendered as a real massing model the customer can
orbit and look at from any angle.

**This is a scope correction, not just a rename.** [[step-1-threejs-shell]] originally described
extruding the *setback envelope* (one box). Phase 1 now means extruding *every room*, so the
rendered model shows actual rooms and walls, not a single outer shell. [[step-3-wire-together]]
is where the CP-SAT room rectangles need to reach the extrusion step, not just get drawn flat.

**Everything in [[build-order]] (steps 1–5) is Phase 1 work**, single storey, per
[[single-storey-first]]. No change to that build order's steps or done-conditions — only to what
step 1 and step 3 render.

## Phase 2+ — multi-level, with regulations hardcoded as constraints

**Once Phase 1 is solid.** Scope moves to multi-storey buildings: G+1, G+2, and beyond.

**Important rules and regulations get hardcoded as solver constraints** — the same philosophy
[[vaastu-as-constraints]] already established for Vaastu: constrain up front so every generated
plan is compliant by construction, rather than placing rooms and checking compliance afterward.

The regulations named so far:

| Rule | Status |
|---|---|
| Fire exits / egress paths | named, **not yet researched** |
| Staircase placement and width | named, **not yet researched** |
| Whatever else the applicable code requires | unenumerated |

> [!warning] This is scope, not a spec
> None of the Phase 2 regulatory content has been verified against an actual building code
> yet — no source, no citation, no jurisdiction confirmed. Do not write solver constraints from
> this table directly; treat each row the way [[HANDOFF]] treats every other unverified claim —
> find the source first. The India-wide precedent in this vault is the National Building Code
> and state-specific bye-laws (the same category [[environment-notes]] already flags for
> setbacks, which are hardcoded and known-wrong for the same reason).

**Data model implication.** [[single-storey-first]] already namespaces rooms by `floor` in
[[output-schema]] for exactly this reason — Phase 2 should not require a schema migration, only
new constraint code and new fields (stair objects, egress-path metadata) that were anticipated.

## What does not change

- [[india-only]] — market fact, phase-agnostic.
- [[vaastu-as-constraints]] ships in Phase 1 (step 5 of [[build-order]]); it is not deferred to
  Phase 2 — Vaastu and building-code regulations are two different constraint families that
  happen to use the same technique.
- [[layout-stability]] and [[claim-most-likely-wrong]] — measured in Phase 1, apply unchanged to
  Phase 2's larger models, likely under more strain (more rooms × more floors × more constraints).

## Open question this creates

Which jurisdiction's fire/egress code is authoritative for the first real multi-storey plot?
The rest of this vault anchors on Telangana / Kandi ([[build-order]]) — the same anchor should
hold here unless stated otherwise. Not yet logged as a numbered open question because Phase 2
work hasn't started; log it under `notes/open-questions/` when it does.

Source: this correction, plus [[HANDOFF]] §13, §3.7, §9
