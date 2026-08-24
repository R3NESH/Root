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
    add_hub_adjacency,
    add_room_separation,
    derive_openings,
    hub_index,
    reachable_count,
)
from .rooms import ROOM_CATALOG, Room

SOLVE_TIME_LIMIT_SECONDS = 5.0
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


@dataclass(frozen=True)
class SolveResult:
    status: str
    rooms: list[PlacedRoom]
    solve_ms: float
    vaastu_constraints_applied: list[str] = field(default_factory=list)
    entrance_edge: str | None = None
    rooms_reachable: int = 0


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
        add_hub_adjacency(model, var_dicts, hub)
        add_room_separation(model, var_dicts, rooms, hub)

    applied: list[str] = []
    if apply_vaastu:
        for i, description in _vaastu_targets(rooms).items():
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

    if objective_terms:
        model.minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    status = solver.solve(model)
    return status, solver, placements, applied


def solve_layout(
    env_w_in: int,
    env_d_in: int,
    rooms: list[Room],
    prev: dict[int, tuple[int, int]] | None = None,
    apply_vaastu: bool = False,
    connect_rooms: bool = True,
) -> SolveResult:
    if not rooms or env_w_in <= 0 or env_d_in <= 0:
        return SolveResult(status="EMPTY", rooms=[], solve_ms=0.0)

    # Check if any room physically cannot fit within the envelope
    for r in rooms:
        if r.min_w_in > env_w_in or r.min_d_in > env_d_in:
            return SolveResult(status="INFEASIBLE", rooms=[], solve_ms=0.0)

    time_limit = INTERACTIVE_TIME_LIMIT_SECONDS if prev else SOLVE_TIME_LIMIT_SECONDS

    # If prev is provided (user drag-and-drop or manual placement),
    # prioritize placing rooms at the user's specified positions without fighting Vaastu quadrants.
    effective_vaastu = apply_vaastu if not prev else False
    effective_connect = connect_rooms if not prev else False

    # 1. Primary solve: requested dimensions + user positions / constraints
    status, solver, placements, applied = _build_and_solve(
        env_w_in, env_d_in, rooms, prev, effective_vaastu, effective_connect, time_limit
    )

    # 2. If infeasible and vaastu was active, retry without Vaastu
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE) and effective_vaastu:
        status, solver, placements, applied = _build_and_solve(
            env_w_in, env_d_in, rooms, prev, False, effective_connect, time_limit
        )

    # 3. If still infeasible with custom dimensions, relax minimums down to catalog minimums
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE) and any(r.name in ROOM_CATALOG for r in rooms):
        flexible_rooms = [
            Room(
                name=r.name,
                min_w_in=ROOM_CATALOG.get(r.name, r).min_w_in,
                max_w_in=r.max_w_in,
                min_d_in=ROOM_CATALOG.get(r.name, r).min_d_in,
                max_d_in=r.max_d_in,
            )
            for r in rooms
        ]
        status, solver, placements, applied = _build_and_solve(
            env_w_in, env_d_in, flexible_rooms, prev, False, effective_connect, time_limit
        )

    # 4. If still infeasible, solve flexible rooms without strict hub connectivity
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE) and len(rooms) > 1:
        flexible_rooms = [
            Room(
                name=r.name,
                min_w_in=ROOM_CATALOG.get(r.name, r).min_w_in,
                max_w_in=r.max_w_in,
                min_d_in=ROOM_CATALOG.get(r.name, r).min_d_in,
                max_d_in=r.max_d_in,
            )
            for r in rooms
        ]
        status, solver, placements, applied = _build_and_solve(
            env_w_in, env_d_in, flexible_rooms, prev, False, False, time_limit
        )

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
        )
        for room, x, y, w, d in placements
    ]

    hub = hub_index(rooms)
    openings = derive_openings(placed, hub)
    entrance_edge = add_entrance(placed, openings, hub, env_w_in, env_d_in)

    placed = [
        PlacedRoom(
            name=p.name,
            x_in=p.x_in,
            y_in=p.y_in,
            w_in=p.w_in,
            d_in=p.d_in,
            openings=openings[i],
            wall_thickness_in=p.wall_thickness_in,
        )
        for i, p in enumerate(placed)
    ]

    # When vaastu was requested on initial generation, record applied constraints
    if apply_vaastu and not prev:
        applied_names = list(_vaastu_targets(rooms).values())
    else:
        applied_names = applied

    return SolveResult(
        status=status_name,
        rooms=placed,
        solve_ms=solve_ms,
        vaastu_constraints_applied=applied_names,
        entrance_edge=entrance_edge,
        rooms_reachable=reachable_count(placed, openings, hub),
    )
