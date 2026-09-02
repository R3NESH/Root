# `backend/programs`

Building programmes: what kind of building the solver is packing.

Implements [[program-packs]] and, for the café pack, the figures collected in
[[cafe-layout-standards]]. Vaastu for the residence pack stays where it was, in
`backend/vaastu/` — this module reads it rather than copying it, so
[[vaastu-as-constraints]] is still the one place that decides what Vaastu means.

## Why this exists

The engine was house-specific in exactly four places:

| Was hardcoded | Now |
|---|---|
| `ROOM_CATALOG` was a house | one vocabulary, `Program.spaces` selects a subset |
| `HUB_ROOM = "hall"` | `Program.hub`, with `hub_fallbacks` |
| `PARENT_PREFERENCE` | `Program.parent_preference` |
| `V1_RULES` posted for everything | `resolve_rules(program, facing)` |

None of that is a second solver. `solver/model.py` builds the same CP-SAT model either way;
the pack decides which constraints go into it.

## The one real difference between the two packs

Vaastu is **absolute** — the kitchen goes south-east whichever way the plot faces, because the
rule is about the sun. A shop's zoning is **relative to the road** — the entry, the queue and
the till are at the front, and "front" is whichever edge the street is on. `Program` carries
`facing_relative_rules` to say which, and `resolve_rules()` rotates the relative ones into the
world (x, z) fractions `vaastu.add_quadrant_constraint()` expects.

`street_edge_spaces` exists because a quadrant rule constrains a room's **centre**. That is
enough for "kitchen in the south-east" and not enough for a shopfront: an entry whose centre is
in the front third can still sit an inch behind the seating floor, and then the front door gets
cut into a side wall. See `realism.add_street_edge_constraints()`.

## What the café pack encodes as constraints, not decoration

- **Front-to-back order**, as `zone_rules` bands: every back-of-house space sits behind every
  front-of-house one, for all four facings. Note this is the *order*, not the 60/40 area ratio —
  that is left to the area objective and lands nearer 75/25 on a 720 sq ft envelope.
- **The customer never crosses the production line**: the parent tree runs
  `seating → entry → queue → counter → prep`, so the only door between front and back of house
  is the one behind the till.
- **A WC never opens into food prep**, via `forbidden_pairs` — the same mechanism that keeps an
  Indian kitchen off a bathroom wall.
- **The door is on the road**, via `resolve_entrance_edges()`.

Locked down in `backend/tests/test_programs.py`, across all four facings.

## Adding a third programme

1. Add its spaces to `ROOM_CATALOG` in `solver/rooms.py` — one vocabulary, no per-type catalogs.
2. Add a `Program` here and register it in `PROGRAMS`.
3. Mirror it in `frontend/lib/programs.ts` and add the space names, labels and colours to
   `frontend/lib/rooms.ts`.
4. If it needs its own fit-out in 3D, add a module beside `frontend/lib/cafeInteriors.ts` and
   delegate to it from `addRoomInteriorDetails()`.

No change to `model.py` or `connectivity.py` should be needed. If one is, the seam is in the
wrong place — say so rather than special-casing the name.
