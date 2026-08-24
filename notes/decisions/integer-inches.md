---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Integer units throughout — inches, not feet

**Decision.** Every length in the model and on the wire is an integer count of inches.
30 ft is `360`. Field names carry the unit: `w_in`, `d_in`, `front_in`.

**Because.** CP-SAT is integer-only — see [[cp-sat-gotchas]]. Decimal feet round silently and
walls stop meeting.

**Consequence.** The UI must snap drag handles to whole feet (see [[ui-principles]]) — raw
dragging yields 29.7, and a plot in India is an exact number.

The [[output-schema]] uses `_in` suffixes everywhere for exactly this reason.

Source: [[HANDOFF]] §3.4
