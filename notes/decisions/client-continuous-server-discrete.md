---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Continuous geometry client-side, discrete solve server-side

**Decision.** The browser owns everything that must move at 60fps. The server owns room placement.

**Because.** CP-SAT is a discrete solver, so re-solving on every input event makes rooms teleport.
Splitting by where the code runs resolves the tension without faking anything: the plot box
responds instantly because it is pure geometry, and rooms settle a beat later because they
genuinely had to be recomputed.

See [[architecture]] for the split, [[layout-stability]] for what happens between two solves.

Source: [[HANDOFF]] §3.3, §4
