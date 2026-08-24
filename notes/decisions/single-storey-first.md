---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Single storey first, but never assume one floor

**Decision.** Phase 1 solves one floor. The data model namespaces rooms by floor from day one.

**Because.** Indian plots commonly go vertical — G+1 is normal, not exotic. A model that assumes
a single floor is a rewrite when G+1 lands; a `floor` field that sits at `0` for a release is one
integer.

This is the same reasoning that puts `wall_thickness_in` and `openings` into the v1
[[output-schema]] as null and empty.

> [!note] Superseded by an explicit phase boundary
> This note originally just said "G+1 later." That is now [[project-phases|Phase 2]]: multi-level
> modelling with fire exits, egress, and staircase rules hardcoded as solver constraints —
> the same technique [[vaastu-as-constraints]] uses. See [[project-phases]] for the live
> definition of what Phase 1 vs Phase 2 actually cover.

Source: [[HANDOFF]] §3.7, §10, §13
