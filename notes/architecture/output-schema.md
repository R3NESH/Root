---
tags: [architecture, schema]
date: 2026-08-23
---
# Output schema — design now, populate later

The success metric is **"would a mason build from this?"**, not "does the box look nice." So the
output eventually needs wall thicknesses, dimension lines, and door/window positions.

Do not ship coloured rectangles with no room for those fields. Adding `wall_thickness` to a
schema that anticipated it is one field. Discovering that rooms were centre-line-less rectangles
is a rewrite.

```json
{
  "plot":   { "w_in": 360, "d_in": 480, "facing": "N" },
  "setback":{ "front_in": 60, "rear_in": 60, "left_in": 36, "right_in": 36 },
  "rooms": [
    { "name": "kitchen", "floor": 0,
      "x_in": 0, "y_in": 0, "w_in": 96, "d_in": 120,
      "wall_thickness_in": null,
      "openings": [] }
  ],
  "meta": { "solve_ms": 0, "vaastu_constraints_applied": [] }
}
```

## Deliberately present, deliberately empty in v1

| Field | v1 value | Exists because |
|---|---|---|
| `floor` | `0` | [[single-storey-first]] — G+1 must not be a migration |
| `wall_thickness_in` | `null` | buildability, the real bar |
| `openings` | `[]` | doors and windows are what a mason needs |

Every length carries an `_in` suffix — [[integer-inches]].

`meta.solve_ms` is not decoration. It is the measurement that decides
[[claim-most-likely-wrong]] at [[step-4-drift-objective]]. Populate it from the first solve
onward.

`setback` values are **hardcoded for now and are a known gap** — see [[environment-notes]].

Source: [[HANDOFF]] §10
