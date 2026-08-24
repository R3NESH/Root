---
tags: [solver, verified]
status: verified-against-reference
date: 2026-08-23
---
# CP-SAT API — confirmed surface

Verified against the OR-Tools Python reference:

- `add_no_overlap_2d(x_intervals, y_intervals)` — ensures all present rectangles do not overlap
  on a plane. Each rectangle is two intervals: its projection onto X and onto Y.
- Interval constructors: `new_interval_var`, `new_fixed_size_interval_var`,
  `new_optional_interval_var`, `new_optional_fixed_size_interval_var`.
- `add_hint(var, value)` — adds `var == value` as a solution hint.
  **Exists, but rejected as the stability mechanism** — see [[layout-stability]].

> [!success] The one unverified name is now verified
> `add_abs_equality`, used by the drift objective in [[layout-stability]], was the single method
> name in the brief not checked against the reference. **Confirmed 2026-08-24** against
> ortools 9.15.6755 — it exists and minimises as expected. Every API name in this file is now
> verified against a running install, not a doc.

## Skeleton

```python
from ortools.sat.python import cp_model

def solve_layout(env_w, env_d, rooms, prev=None):
    """env_w, env_d in INCHES. rooms: objects with name, min_w, max_w, min_d, max_d.
    prev: {name: (x, y)} from the previous solve, or None."""
    m = cp_model.CpModel()
    X, Y, R = [], [], {}

    for r in rooms:
        x  = m.new_int_var(0, env_w, f"x_{r.name}")
        w  = m.new_int_var(r.min_w, r.max_w, f"w_{r.name}")
        xe = m.new_int_var(0, env_w, f"xe_{r.name}")
        xi = m.new_interval_var(x, w, xe, f"ix_{r.name}")

        y  = m.new_int_var(0, env_d, f"y_{r.name}")
        d  = m.new_int_var(r.min_d, r.max_d, f"d_{r.name}")
        ye = m.new_int_var(0, env_d, f"ye_{r.name}")
        yi = m.new_interval_var(y, d, ye, f"iy_{r.name}")

        X.append(xi); Y.append(yi); R[r.name] = (x, y, w, d)

    m.add_no_overlap_2d(X, Y)
    return m, R
```

**Envelope containment** is enforced by the variable domains (`0..env_w`) plus the interval end
variables — **confirmed sufficient**; no explicit `m.add(xe <= env_w)` was needed. Pinned by
`test_envelope_domain_alone_blocks_escape` so an ortools upgrade can't silently regress it.

All dimensions are inches: [[integer-inches]]. Traps: [[cp-sat-gotchas]].

Source: [[HANDOFF]] §5
