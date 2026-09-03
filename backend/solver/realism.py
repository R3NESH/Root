"""Constraints that turn a legal rectangle packing into a plausible house.

notes/solver/realism-gaps.md. The solver already guaranteed three things — rooms do not
overlap, rooms stay inside the envelope (notes/build/step-2-solver-core.md), and every room
is reachable through a real door (notes/solver/rooms-do-not-form-a-house.md). None of those
stop it emitting a 5 ft x 16 ft "bedroom", a windowless bedroom in the middle of the plan, or
a house occupying 40% of the plot it was given.

Three families here, in increasing cost:

1. Proportion  — linear, free.
2. Daylight    — four reified booleans per habitable room.
3. Area        — one multiplication per room, used as an objective rather than a constraint.
                 notes/solver/rooms-do-not-form-a-house.md measured a *fill constraint* and
                 found it does not buy connectivity; it is kept here as a preference, which is
                 what it was always suited to be.
"""

from ortools.sat.python import cp_model

# Drift must outrank area by more than the whole envelope is worth, so that area only ever
# breaks ties between layouts that are equally stable. notes/solver/layout-stability.md is the
# differentiator; room size is a nicety. 100000 sq in is larger than any envelope we solve.
DRIFT_WEIGHT = 100_000
AREA_WEIGHT = 1
# Half-perimeter of the built footprint, minimised alongside maximised room area, so the plan
# reads as one building instead of scattered pavilions. See footprint_perimeter_term().
#
# 120 is measured. Sweeping it on the six-room 30x40 fixture, five cold runs each:
#
#   weight   fill/ceiling      void   status
#        0   100%  (0.0pt)      25%   OPTIMAL x5
#       50   100%  (0.0pt)      17%   OPTIMAL x5
#      120   94-96% (1.9pt)    5-7%   FEASIBLE x5
#      250   80%                 0%   FEASIBLE
#
# 50 keeps the optimality proof and only takes a quarter off the void. 250 buys the last of it
# by shrinking rooms, which is the opposite of what is wanted. 120 removes four fifths of the
# void for two points of fill, and the run-to-run spread stays under two points, so
# test_the_house_fills_most_of_what_the_catalog_allows is still measuring the objective rather
# than the time limit — the thing its comment warns about.
COMPACT_WEIGHT = 120


def add_aspect_constraints(model: cp_model.CpModel, var_dicts: list[dict], rooms) -> None:
    """Forbid absurdly elongated rooms.

    `w * 10 <= d * max_aspect_x10` in both directions. Ratios are held x10 so the whole
    thing stays in integers — notes/decisions/integer-inches.md.
    """
    for room, v in zip(rooms, var_dicts):
        limit = room.max_aspect_x10
        model.add(v["w"] * 10 <= v["d"] * limit)
        model.add(v["d"] * 10 <= v["w"] * limit)


def add_daylight_constraints(
    model: cp_model.CpModel, var_dicts: list[dict], rooms, env_w_in: int, env_d_in: int
) -> list[int]:
    """Every habitable or wet room must sit on the outside face of the *building*.

    A bedroom buried in the middle of the plan has no light and no ventilation, and under most
    Indian bye-laws no openable area either — it is not a bedroom, it is a cupboard.

    The subtle part is what "outside face" means. Requiring a room to touch the *envelope*
    boundary is wrong and measurably so: it made a twelve-room house INFEASIBLE on a 40x60 plot
    while solving on a 30x40, because room maximums mean the house does not span a large plot
    and no interior room can stretch to reach the plot edge. What matters is the boundary of
    the built footprint, which is derived here rather than assumed:

        fx0 = min(x)   fx1 = max(xe)   fz0 = min(y)   fz1 = max(ye)

    A room is on the outside face when it touches one of those four. That is true wherever the
    house sits on the plot, and it is what an exterior wall actually is.

    Wet rooms are held to the same rule even though they are not habitable: a bathroom with no
    exterior wall cannot be ventilated, and a plan that puts one in the middle of the house is
    asking for a shaft nobody costed. Stores, stairs and the pooja room are genuinely exempt.

    Returns the indices actually constrained, so callers can report them.
    """
    targets = [i for i, r in enumerate(rooms) if r.habitable or r.wet]
    if not targets:
        return []

    fx0 = model.new_int_var(0, env_w_in, "footprint_x0")
    fx1 = model.new_int_var(0, env_w_in, "footprint_x1")
    fz0 = model.new_int_var(0, env_d_in, "footprint_z0")
    fz1 = model.new_int_var(0, env_d_in, "footprint_z1")
    model.add_min_equality(fx0, [v["x"] for v in var_dicts])
    model.add_max_equality(fx1, [v["xe"] for v in var_dicts])
    model.add_min_equality(fz0, [v["y"] for v in var_dicts])
    model.add_max_equality(fz1, [v["ye"] for v in var_dicts])

    for i in targets:
        v = var_dicts[i]
        edges = []
        for label, expr, bound in (
            ("w", v["x"], fx0),
            ("e", v["xe"], fx1),
            ("n", v["y"], fz0),
            ("s", v["ye"], fz1),
        ):
            b = model.new_bool_var(f"light_{label}_{i}_{rooms[i].name}")
            model.add(expr == bound).only_enforce_if(b)
            model.add(expr != bound).only_enforce_if(b.Not())
            edges.append(b)
        model.add_bool_or(edges)
    return targets


def area_terms(
    model: cp_model.CpModel, var_dicts: list[dict], rooms, env_w_in: int, env_d_in: int
) -> list[cp_model.IntVar]:
    """One area variable per room, for use in the objective.

    Rooms otherwise solve at their catalog minimum, because nothing rewards a larger one:
    measured 43.7% envelope fill against a 66.2% ceiling for the standard six-room mix.
    """
    cap = env_w_in * env_d_in
    out = []
    for i, (room, v) in enumerate(zip(rooms, var_dicts)):
        area = model.new_int_var(0, cap, f"area_{i}_{room.name}")
        model.add_multiplication_equality(area, [v["w"], v["d"]])
        out.append(area)
    return out


def catalog_fill_ceiling(rooms, env_w_in: int, env_d_in: int) -> float:
    """The best fill this room set could possibly reach, as a fraction of the envelope.

    Comparing fill against 100% is meaningless — six rooms at their catalog maximums cannot
    cover a 30x40 plot. This is the number the fill measurement should be read against.
    """
    if env_w_in <= 0 or env_d_in <= 0:
        return 0.0
    best = sum(r.max_w_in * r.max_d_in for r in rooms)
    return best / (env_w_in * env_d_in)


def add_street_edge_constraints(
    model: cp_model.CpModel,
    var_dicts: list[dict],
    rooms,
    street_spaces: tuple[str, ...],
    street: str,
    env_w_in: int,
    env_d_in: int,
) -> list[int]:
    """Pin named spaces to the building's street-facing face.

    A quadrant rule holds a room's *centre* inside a band, which is enough for "kitchen in the
    south-east" and not enough for a shopfront: an entry whose centre is in the front third can
    still sit an inch behind the seating floor, and then the front door gets cut in whichever
    side wall happens to be exterior. A shop entrance is on the road, so the constraint is on
    the room's near edge, not its centre.

    Measured against the *footprint*, not the envelope, for the same reason
    add_daylight_constraints() does: rooms have maximums, so the built footprint does not span a
    large plot and nothing could reach the plot edge.

    Returns the indices actually constrained.
    """
    targets = [i for i, r in enumerate(rooms) if r.name in street_spaces]
    if not targets:
        return []

    fx0 = model.new_int_var(0, env_w_in, "street_x0")
    fx1 = model.new_int_var(0, env_w_in, "street_x1")
    fz0 = model.new_int_var(0, env_d_in, "street_z0")
    fz1 = model.new_int_var(0, env_d_in, "street_z1")
    model.add_min_equality(fx0, [v["x"] for v in var_dicts])
    model.add_max_equality(fx1, [v["xe"] for v in var_dicts])
    model.add_min_equality(fz0, [v["y"] for v in var_dicts])
    model.add_max_equality(fz1, [v["ye"] for v in var_dicts])

    for i in targets:
        v = var_dicts[i]
        if street == "N":
            model.add(v["y"] == fz0)
        elif street == "S":
            model.add(v["ye"] == fz1)
        elif street == "E":
            model.add(v["xe"] == fx1)
        else:  # "W"
            model.add(v["x"] == fx0)
    return targets


def footprint_perimeter_term(
    model: cp_model.CpModel, var_dicts: list[dict], env_w_in: int, env_d_in: int
) -> cp_model.IntVar:
    """Half-perimeter of the box the built footprint sits in, for use in the objective.

    Nothing else in this model cares where the rooms sit relative to each other. Non-overlap,
    the adjacency tree and the daylight rule are all satisfied by a straggling L just as well as
    by a tight rectangle, and the area objective scores the two identically because it counts
    room area and never looks at the gaps. Measured on a 40x60: two OPTIMAL layouts of the same
    rooms, one with 8% void inside its footprint and one with 28%. The difference was luck.

    **Half-perimeter, not area, and that is the whole point.** The first version multiplied the
    two spans to get the box's area, which reads more directly as "minimise the void" — and it
    cost the cold solve its proof. A six-room 30x40 stopped reaching OPTIMAL inside the budget
    and its fill started varying 85.6% to 98.3% run to run, which is
    test_the_house_fills_most_of_what_the_catalog_allows measuring the time limit instead of the
    objective, exactly as that test's comment predicted. `span_w + span_d` is linear, keeps the
    model in the same complexity class as before, and pulls the footprint just as tight.
    """
    fx0 = model.new_int_var(0, env_w_in, "bbox_x0")
    fx1 = model.new_int_var(0, env_w_in, "bbox_x1")
    fz0 = model.new_int_var(0, env_d_in, "bbox_z0")
    fz1 = model.new_int_var(0, env_d_in, "bbox_z1")
    model.add_min_equality(fx0, [v["x"] for v in var_dicts])
    model.add_max_equality(fx1, [v["xe"] for v in var_dicts])
    model.add_min_equality(fz0, [v["y"] for v in var_dicts])
    model.add_max_equality(fz1, [v["ye"] for v in var_dicts])

    half_perimeter = model.new_int_var(0, env_w_in + env_d_in, "bbox_half_perimeter")
    model.add(half_perimeter == (fx1 - fx0) + (fz1 - fz0))
    return half_perimeter
