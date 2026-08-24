---
tags: [overview]
date: 2026-08-23
---
# What the product is

A tool for an Indian plot owner who wants to build a house and does not want to hire a
professional designer first.

**Input:** plot dimensions and facing direction — see [[input-is-plot-dimensions]].
**Output:** a legal, buildable **3D model of the house** they can act on — not a flat plan.
See [[project-phases]] for why this is stated explicitly: it is a correction to the original
brief, not a restatement of it.

The engine is a constraint solver (Google OR-Tools CP-SAT) that places rooms as non-overlapping
rectangles inside a setback-derived buildable envelope, with Vaastu direction rules encoded as
constraints rather than checked afterwards. See [[cp-sat-api]] and [[vaastu-as-constraints]].
Those rectangles get extruded into a real 3D massing model — see [[step-3-wire-together]].

Market is India and only India: [[india-only]].

## Phased scope

**Phase 1 (current):** single storey, generates the 3D model above. **Phase 2+:** multi-level
(G+1, G+2, ...) with fire exits, egress paths, and staircase rules hardcoded as solver
constraints, so compliance is by construction rather than checked after. Full split:
[[project-phases]].

## The bar to clear

The success metric is **"would a mason build from this?"** — not "does the box look nice."
Nine tools already produce nice-looking boxes ([[competitor-landscape]]). That is why the
[[output-schema]] reserves space for wall thicknesses, dimension lines and openings from v1.

## What it is not

Not a permit tool ([[tg-bpass-kills-permits]]). Not a municipal product
([[autodcr-owns-municipal-scrutiny]]). Not a chatbot ([[rejected-approaches]]).
And the word "architect" never appears in it ([[architects-act-legal-lane]]).

Source: [[HANDOFF]] §1
