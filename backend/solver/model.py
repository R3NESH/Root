"""CP-SAT room placement — notes/build/step-2-solver-core.md, step-4, step-5.

Rooms are placed as non-overlapping rectangles inside a fixed w x h envelope via
add_no_overlap_2d. Envelope containment falls out of the interval end variables' domains
(0..env_w / 0..env_d) — see notes/solver/cp-sat-api.md, verified by the tests in this step.

Step 4 adds the drift objective (notes/solver/layout-stability.md): minimise displacement from
the previous solution so the solver prefers the layout the user is already looking at.

Step 5 adds Vaastu direction constraints (notes/decisions/vaastu-as-constraints.md), applied up
front rather than scored afterwards.
"""

from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from vaastu import add_quadrant_constraint, applies_to

from .connectivity import (
    EXTERIOR_WALL_IN,
    INTERIOR_WALL_IN,
    add_entrance,
    add_room_separation,
    footprint,
    add_tree_adjacency,
    assign_parents,
    derive_openings,
    derive_windows,
    hub_index,
    reachable_count,
)
from .realism import (
    AREA_WEIGHT,
    DRIFT_WEIGHT,
    add_aspect_constraints,
    add_daylight_constraints,
    area_terms,
)
from .rooms import ROOM_CATALOG, Room

# Cold solve budget. Measured 2026-08-25 across a 3BHK and a twelve-room program: raising this
# from 2 s to 5 s moved envelope fill by about one point on the common case and never changed
# reachability or Vaastu. Three extra seconds of blank screen bought nothing anyone can see.
SOLVE_TIME_LIMIT_SECONDS = 2.0
INTERACTIVE_TIME_LIMIT_SECONDS = 0.4


@dataclass(frozen=True)
class PlacedRoom:
    name: str
    x_in: int
    y_in: int
    w_in: int
    d_in: int
    openings: list[dict] = field(default_factory=list)
    wall_thickness_in: int = INTERIOR_WALL_IN
    # Carried through from the catalog so post-solve code and the renderer do not have to
    # re-look-up room semantics by name — notes/solver/realism-gaps.md.
    habitable: bool = True
    wet: bool = False


@dataclass(frozen=True)
class SolveResult:
    status: str
    rooms: list[PlacedRoom]
    solve_ms: float
    vaastu_constraints_applied: list[str] = field(default_factory=list)
    entrance_edge: str | None = None
    rooms_reachable: int = 0


def _on_exterior(room, bounds: tuple[int, int, int, int]) -> bool:
    """Does this room own any of the building's outside face?

    Indian brick convention is 9 in load-bearing outside, 4.5 in partitions inside — a room on
    the perimeter carries the thicker wall. connectivity.py holds the constants.
    """
    fx0, fz0, fx1, fz1 = bounds
    return (
        room.x_in == fx0
        or room.y_in == fz0
        or room.x_in + room.w_in == fx1
        or room.y_in + room.d_in == fz1
    )


def _vaastu_targets(rooms: list[Room]) -> dict[int, str]:
    targets: dict[int, str] = {}
    claimed: set[str] = set()
    for i, room in enumerate(rooms):
        rule = applies_to(room.name)
        if rule is None or room.name in claimed:
            continue
        claimed.add(room.name)
        targets[i] = rule.description
    return targets


def _build_and_solve(
    env_w_in: int,
    env_d_in: int,
    rooms: list[Room],
    prev: dict[int, tuple[int, int]] | None,
    apply_vaastu: bool,
    connect_rooms: bool,
    time_limit: float,
    vaastu_exempt: frozenset[int] = frozenset(),
    require_daylight: bool = True,
    maximise_area: bool = True,
) -> tuple[int, cp_model.CpSolver, list[tuple[Room, cp_model.IntVar, cp_model.IntVar, cp_model.IntVar, cp_model.IntVar]], list[str]]:
    model = cp_model.CpModel()

    placements: list[tuple[Room, cp_model.IntVar, cp_model.IntVar, cp_model.IntVar, cp_model.IntVar]] = []
    var_dicts: list[dict] = []
    x_intervals = []
    y_intervals = []

    for i, room in enumerate(rooms):
        x = model.new_int_var(0, env_w_in, f"x_{i}_{room.name}")
        w = model.new_int_var(room.min_w_in, room.max_w_in, f"w_{i}_{room.name}")
        xe = model.new_int_var(0, env_w_in, f"xe_{i}_{room.name}")
        x_interval = model.new_interval_var(x, w, xe, f"ix_{i}_{room.name}")

        y = model.new_int_var(0, env_d_in, f"y_{i}_{room.name}")
        d = model.new_int_var(room.min_d_in, room.max_d_in, f"d_{i}_{room.name}")
        ye = model.new_int_var(0, env_d_in, f"ye_{i}_{room.name}")
        y_interval = model.new_interval_var(y, d, ye, f"iy_{i}_{room.name}")

        placements.append((room, x, y, w, d))
        var_dicts.append({"x": x, "y": y, "w": w, "d": d, "xe": xe, "ye": ye})
        x_intervals.append(x_interval)
        y_intervals.append(y_interval)

    model.add_no_overlap_2d(x_intervals, y_intervals)

    hub = hub_index(rooms)
    if connect_rooms and len(rooms) > 1:
        add_tree_adjacency(model, var_dicts, assign_parents(rooms))
        add_room_separation(model, var_dicts, rooms, hub)

    # notes/solver/realism-gaps.md — proportion is free, daylight costs four booleans a room.
    add_aspect_constraints(model, var_dicts, rooms)
    if require_daylight:
        add_daylight_constraints(model, var_dicts, rooms, env_w_in, env_d_in)

    applied: list[str] = []
    if apply_vaastu:
        for i, description in _vaastu_targets(rooms).items():
            # A room the user dragged is released from its quadrant — but only that room.
            # notes/solver/vaastu-and-connectivity-drop-on-edit.md: releasing the whole rule set
            # because `prev` was supplied is what silently un-Vaastu'd every edit.
            if i in vaastu_exempt:
                continue
            room, x, y, w, d = placements[i]
            rule = applies_to(room.name)
            assert rule is not None
            add_quadrant_constraint(model, rule, x, y, w, d, env_w_in, env_d_in)
            applied.append(description)

    objective_terms = []
    if prev:
        for i, (room, x, y, _w, _d) in enumerate(placements):
            if i not in prev:
                continue
            px, py = prev[i]
            dx = model.new_int_var(0, env_w_in, f"dx_{i}_{room.name}")
            dy = model.new_int_var(0, env_d_in, f"dy_{i}_{room.name}")
            model.add_abs_equality(dx, x - px)
            model.add_abs_equality(dy, y - py)
            objective_terms.extend([dx, dy])

    # Drift outranks area by more than a whole envelope is worth, so a larger room is only ever
    # chosen between layouts that are equally stable — notes/solver/layout-stability.md stays
    # the differentiator. With no `prev` there is no drift term and this is pure area.
    objective = DRIFT_WEIGHT * sum(objective_terms) if objective_terms else 0
    if maximise_area:
        objective = objective - AREA_WEIGHT * sum(
            area_terms(model, var_dicts, rooms, env_w_in, env_d_in)
        )
    if objective_terms or maximise_area:
        model.minimize(objective)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    # notes/build/step-4-drift-objective.md found the cost is CP-SAT *proving* optimality, not
    # finding a layout — 1490 ms to prove against a 500 ms budget. The area objective made that
    # worse: a twelve-room program burned the whole 5 s cold budget closing the last few percent
    # of a gap nobody can see. Stop once the incumbent is within 2% of the bound.
    solver.parameters.relative_gap_limit = 0.02
    # CP-SAT's portfolio search parallelises well and this model is a packing problem, which is
    # exactly what its parallel workers are good at. Left at the default it runs single-threaded.
    solver.parameters.num_workers = 8
    status = solver.solve(model)
    return status, solver, placements, applied


def solve_layout(
    env_w_in: int,
    env_d_in: int,
    rooms: list[Room],
    prev: dict[int, tuple[int, int]] | None = None,
    apply_vaastu: bool = False,
    connect_rooms: bool = True,
    moved_index: int | None = None,
) -> SolveResult:
    if not rooms or env_w_in <= 0 or env_d_in <= 0:
        return SolveResult(status="EMPTY", rooms=[], solve_ms=0.0)

    # Check if any room physically cannot fit within the envelope
    for r in rooms:
        if r.min_w_in > env_w_in or r.min_d_in > env_d_in:
            return SolveResult(status="INFEASIBLE", rooms=[], solve_ms=0.0)

    time_limit = INTERACTIVE_TIME_LIMIT_SECONDS if prev else SOLVE_TIME_LIMIT_SECONDS

    # Only the room the user actually dragged is released from its Vaastu quadrant. Having
    # `prev` at all means "we have previous positions", which is true on every solve after the
    # first — see notes/solver/vaastu-and-connectivity-drop-on-edit.md for what that cost.
    vaastu_exempt = frozenset({moved_index}) if moved_index is not None else frozenset()

    # The relaxation ladder. Each rung drops the least important thing still standing.
    #
    # Connectivity is never dropped. A layout whose rooms do not open onto each other is not a
    # worse house, it is not a house — notes/solver/rooms-do-not-form-a-house.md. The previous
    # ladder shed it as a last resort and produced exactly that: 1 of 8 rooms reachable, from a
    # solve reported as OPTIMAL. If nothing on this ladder fits, INFEASIBLE is the honest answer
    # and the UI can say "too many rooms for this plot", which is at least actionable.
    def attempt(rs, vaastu, daylight, area):
        return _build_and_solve(
            env_w_in, env_d_in, rs, prev, vaastu, connect_rooms, time_limit,
            vaastu_exempt, require_daylight=daylight, maximise_area=area,
        )

    def ok(st) -> bool:
        return st in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    flexible_rooms = [
        Room(
            name=r.name,
            min_w_in=min(ROOM_CATALOG.get(r.name, r).min_w_in, r.max_w_in),
            max_w_in=r.max_w_in,
            min_d_in=min(ROOM_CATALOG.get(r.name, r).min_d_in, r.max_d_in),
            max_d_in=r.max_d_in,
            habitable=r.habitable,
            wet=r.wet,
            max_aspect_x10=r.max_aspect_x10,
        )
        for r in rooms
    ]

    ladder = [
        # rooms,          vaastu,       daylight, area   — what this rung gives up
        (rooms,           apply_vaastu, True,     True),   # nothing
        (flexible_rooms,  apply_vaastu, True,     True),   # custom sizes
        (flexible_rooms,  apply_vaastu, False,    True),   # daylight
        (flexible_rooms,  False,        False,    True),   # Vaastu
        (flexible_rooms,  False,        False,    False),  # the area preference, for speed
    ]

    status = solver = placements = applied = None
    for rs, vaastu, daylight, area in ladder:
        status, solver, placements, applied = attempt(rs, vaastu, daylight, area)
        if ok(status):
            break

    solve_ms = solver.wall_time * 1000
    status_name = solver.status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResult(status=status_name, rooms=[], solve_ms=solve_ms)

    placed = [
        PlacedRoom(
            name=room.name,
            x_in=solver.value(x),
            y_in=solver.value(y),
            w_in=solver.value(w),
            d_in=solver.value(d),
            habitable=room.habitable,
            wet=room.wet,
        )
        for room, x, y, w, d in placements
    ]

    hub = hub_index(rooms)
    parents = assign_parents(rooms)
    bounds = footprint(placed)
    openings = derive_openings(placed, parents)
    entrance_edge = add_entrance(placed, openings, hub)
    derive_windows(placed, openings)

    placed = [
        PlacedRoom(
            name=p.name,
            x_in=p.x_in,
            y_in=p.y_in,
            w_in=p.w_in,
            d_in=p.d_in,
            openings=openings[i],
            wall_thickness_in=EXTERIOR_WALL_IN if _on_exterior(p, bounds) else INTERIOR_WALL_IN,
            habitable=p.habitable,
            wet=p.wet,
        )
        for i, p in enumerate(placed)
    ]

    return SolveResult(
        status=status_name,
        rooms=placed,
        solve_ms=solve_ms,
        vaastu_constraints_applied=applied,
        entrance_edge=entrance_edge,
        rooms_reachable=reachable_count(placed, openings, hub),
    )
