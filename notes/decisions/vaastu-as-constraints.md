---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Vaastu as constraints, not post-check

**Decision.** Vaastu direction rules are encoded as CP-SAT constraints on room position.
They are not a score applied to a finished layout.

**Because.** Placing first and scoring afterwards produces plans that fail — the solver has
already committed the space. Constrain up front and every returned plan is compliant by
construction.

Demand side: [[vaastu-is-mandatory-demand]]. Mechanism: [[cp-sat-api]].

**v1 rule set** (step 5 of [[build-order]]): kitchen SE, master bedroom SW, entrance N/E.
Facing comes from the user — see [[input-is-plot-dimensions]].

**Risk.** Stacking Vaastu on top of the drift objective is the point where solve time may blow
up. See [[layout-stability]]. Measure it at [[step-5-vaastu]].

**Caveat.** If a competitor's only real defect is wrong Vaastu placement, this is a lookup table
and a weekend of work, not a moat — see [[q-competitor-defects]].

Source: [[HANDOFF]] §3.5
