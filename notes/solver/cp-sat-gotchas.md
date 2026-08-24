---
tags: [solver]
date: 2026-08-23
---
# CP-SAT gotchas that will bite

**Integers only.** All CP-SAT constraints must be defined using integers. Decimal feet round
silently and walls stop meeting. Work in inches — [[integer-inches]].

**Interval vars are containers, not variables.** They bundle separately-declared start / size /
end vars. Read the values off the underlying int vars, not off the interval. Getting this wrong
produces a solver that appears to work and returns nothing usable.

**There is no true incremental solving.** It remains an open OR-Tools feature request; the
documented workaround is re-solving the model from scratch each time.

That last one is the whole reason [[layout-stability]] exists as a problem: every edit is a fresh
solve, and a fresh solve has no memory of what the user was just looking at unless you put it in
the objective.

API surface: [[cp-sat-api]].

Source: [[HANDOFF]] §5
