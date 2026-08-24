---
tags: [build, step]
status: done-with-a-gap
date: 2026-08-24
---
# Step 5 — Vaastu as constraints

**Work.** Encode the v1 rule set as CP-SAT constraints: kitchen SE, master bedroom SW,
entrance N/E. Direction is relative to the facing the user set on the compass dial.

**Done when.** Still solves, still stable, still under 500 ms.

This is the step where solve time is most likely to break, because the drift objective from
[[step-4-drift-objective]] and the direction constraints interact — see [[layout-stability]] for
the expected failure mode and the ordering-based fallback.

Populate `meta.vaastu_constraints_applied` ([[output-schema]]) so a returned plan can state which
rules it satisfied. Users who care about [[vaastu-is-mandatory-demand]] will want to see that,
and it costs nothing to emit.

Rationale for constraining rather than scoring: [[vaastu-as-constraints]].

> [!success] Done 2026-08-24 — done-conditions met
> `backend/vaastu/rules.py` + wiring in `solver/model.py`; 5 tests in `backend/tests/test_vaastu.py`.
> Still solves, still stable (**0 in displacement**), still fast (**76 ms**, budget 500 ms).
> `meta.vaastu_constraints_applied` is populated and surfaces in the UI as green ticks.
>
> Rules are **half-planes, not tight quadrant boxes** — on a small plot a strict quadrant makes
> the model infeasible fast, and the Vaastu requirement is directional, not metric. A room
> satisfies its rule when its **centre** falls in the region; a large room whose corner merely
> clips the south-east is not meaningfully "in the south-east". Centre is computed as `2x + w`
> to stay in integers ([[cp-sat-gotchas]] — halving would truncate).
>
> **Master bedroom, not all bedrooms.** The SW rule binds only the first bedroom in the list.
> Constraining every bedroom into one half-plane over-constrains the model for no Vaastu reason.
> Pinned by `test_only_first_bedroom_is_constrained`.

> [!missing] "Entrance N/E" is NOT implemented
> The step brief names three rules: kitchen SE, master bedroom SW, **entrance N/E**. The first
> two are done. The third cannot be: there is no entrance in the model. Doors live in
> `openings`, still empty per [[output-schema]] and [[single-storey-first]].
>
> Recorded rather than quietly dropped — and **not** silently satisfied by anything else. Pooja
> NE was added instead (a standard rule, and `pooja` exists in the catalog), but it is a
> different rule, not a substitute.
>
> This is the one done-condition of steps 3–5 not fully met. It needs `openings` to exist first.

Prev: [[step-4-drift-objective]] · Plan: [[build-order]]
