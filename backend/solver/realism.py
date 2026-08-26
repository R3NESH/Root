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
