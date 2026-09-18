"""CP-SAT room placement — notes/build/step-2-solver-core.md, step-4, step-5.

Rooms are placed as non-overlapping rectangles inside a fixed w x h envelope via
add_no_overlap_2d. Envelope containment falls out of the interval end variables' domains
(0..env_w / 0..env_d) — see notes/solver/cp-sat-api.md, verified by the tests in this step.

Step 4 adds the drift objective (notes/solver/layout-stability.md): minimise displacement from
the previous solution so the solver prefers the layout the user is already looking at.

Step 5 adds a programme's directional zone constraints (zoning.py), applied up front
rather than scored afterwards.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field, replace

from ortools.sat.python import cp_model

from programs import RESIDENTIAL, Program, primary_cardinal, resolve_rules

from zoning import QuadrantRule, add_quadrant_constraint
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
    COMPACT_WEIGHT,
    DRIFT_WEIGHT,
    NEAR_WEIGHT,
    add_aspect_constraints,
    add_daylight_constraints,
    add_street_edge_constraints,
    area_terms,
    footprint_perimeter_term,
    near_terms,
)
from .quantities import Quantities, take_off
from .rooms import ROOM_CATALOG, Room
from .walls import Wall, derive_walls

# Cold solve budget. Measured 2026-08-25 across a 3BHK and a twelve-room program: raising this
# from 2 s to 5 s moved envelope fill by about one point on the common case and never changed
# reachability or zoning. Three extra seconds of blank screen bought nothing anyone can see.
SOLVE_TIME_LIMIT_SECONDS = 2.0

# Interactive budget, for a solve that already has previous positions to drift from. 0.4 s is
# right for the five- and six-room house this was tuned on, and measurably wrong past that: an
# eleven-space cafe returns UNKNOWN in 429 ms and the UI draws nothing, because CP-SAT has not
# even found a first solution before the deadline. Measured need is 0.8 s at eleven spaces, so
# the budget grows with the programme instead of staying flat.
#
# This is a ceiling, not a cost. A six-room house still proves optimality in ~130 ms and returns
# then; only a program that actually needs the time spends it.
INTERACTIVE_TIME_LIMIT_SECONDS = 0.4
INTERACTIVE_TIME_PER_ROOM_SECONDS = 0.12
INTERACTIVE_TIME_CEILING_SECONDS = 1.2
INTERACTIVE_FREE_ROOMS = 6


def interactive_budget(room_count: int) -> float:
    """Seconds an edit-time solve gets, scaled by how many spaces are in the programme."""
    extra = max(0, room_count - INTERACTIVE_FREE_ROOMS) * INTERACTIVE_TIME_PER_ROOM_SECONDS
    return min(INTERACTIVE_TIME_CEILING_SECONDS, INTERACTIVE_TIME_LIMIT_SECONDS + extra)


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
    # Roofed, not walled — solver/rooms.py. derive_walls() reads it off the placed room, and
    # the renderer needs it to know not to draw a box.
    open_sided: bool = False
    floor: int = 0


@dataclass(frozen=True)
class SolveResult:
    status: str
    rooms: list[PlacedRoom]
    solve_ms: float
    rules_applied: list[str] = field(default_factory=list)
    entrance_edge: str | None = None
    rooms_reachable: int = 0
    # True when zone rules were asked for, some room in the mix has a rule, and the relaxation
    # ladder still handed back a layout with none of them posted. An empty `rules_applied` on
    # its own cannot say this: a mix with no rule to apply is not a relaxed one. Callers need
    # the difference — a plan that breaks its programme's zoning is a rejected plan, not a
    # worse one.
    rules_relaxed: bool = False
    # Which building programme was packed, and what its directional rules are called. A
    # programme that posts no zoning must not be reported as if it did.
    program: str = RESIDENTIAL.key
    rules_label: str = RESIDENTIAL.rules_label
    # Walls as objects, and what they cost to build. Derived post-solve from the placed rooms and
    # their openings — see solver/walls.py for why a wall needs an identity at all.
    walls: list[Wall] = field(default_factory=list)
    quantities: Quantities | None = None


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


def _rule_targets(rooms: list[Room], rules: dict[str, QuadrantRule]) -> dict[int, str]:
    """Which room index carries which directional rule.

    First room of a kind only: constraining two bedrooms into the same half-plane
    over-constrains the model for no zoning reason, and pinning every one of four cafe table
    zones to the same band does the same.
    """
    targets: dict[int, str] = {}
    claimed: set[str] = set()
    for i, room in enumerate(rooms):
        rule = rules.get(room.name)
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
    apply_zone_rules: bool,
    connect_rooms: bool,
    time_limit: float,
    zone_exempt: frozenset[int] = frozenset(),
    require_daylight: bool = True,
    maximise_area: bool = True,
    program: Program = RESIDENTIAL,
    facing: str = "N",
    halfplanes: Sequence[tuple[int, int, int]] = (),
    aligned: Sequence[Sequence[int]] = (),
    near: Sequence[tuple[int, int]] = (),
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

    # Rooms only compete for space with rooms on their own floor. One model still holds every
    # storey, because the stair core has to land on the same footprint on each of them and that
    # is a constraint across floors — see `aligned` below.
    floors = sorted({getattr(r, "floor", 0) for r in rooms})
    by_floor = {
        f: [i for i, r in enumerate(rooms) if getattr(r, "floor", 0) == f] for f in floors
    }

    for f in floors:
        idx = by_floor[f]
        model.add_no_overlap_2d([x_intervals[i] for i in idx], [y_intervals[i] for i in idx])

    # Walls stack. An upper storey has to land on the one below it — its loads have nowhere else
    # to go, and a first floor hanging off the side of the ground floor is what the renderer was
    # faithfully drawing. Constraining each upper room to the ground floor's own bounding box is
    # the cheap version of that rule: it does not force wall-on-wall, but it does stop a storey
    # floating off the building.
    if len(floors) > 1:
        ground_vars = [var_dicts[i] for i in by_floor[floors[0]]]
        gx0 = model.new_int_var(0, env_w_in, "ground_x0")
        gx1 = model.new_int_var(0, env_w_in, "ground_x1")
        gz0 = model.new_int_var(0, env_d_in, "ground_z0")
        gz1 = model.new_int_var(0, env_d_in, "ground_z1")
        model.add_min_equality(gx0, [v["x"] for v in ground_vars])
        model.add_max_equality(gx1, [v["xe"] for v in ground_vars])
        model.add_min_equality(gz0, [v["y"] for v in ground_vars])
        model.add_max_equality(gz1, [v["ye"] for v in ground_vars])
        for f in floors[1:]:
            for i in by_floor[f]:
                v = var_dicts[i]
                model.add(v["x"] >= gx0)
                model.add(v["xe"] <= gx1)
                model.add(v["y"] >= gz0)
                model.add(v["ye"] <= gz1)

    # The stair core: the same rectangle on every floor it serves. Without this a G+1 has two
    # staircases that do not meet, which is not a house — the vertical case of the rule in
    # notes/solver/rooms-do-not-form-a-house.md.
    for group in aligned:
        first = var_dicts[group[0]]
        for other_index in group[1:]:
            other = var_dicts[other_index]
            model.add(other["x"] == first["x"])
            model.add(other["y"] == first["y"])
            model.add(other["w"] == first["w"])
            model.add(other["d"] == first["d"])

    # A plot that is not a rectangle arrives as one half-plane per plot edge, already inset by
    # the setback and already in envelope-local inches — see envelope/polygon.py. For an
    # axis-aligned rectangle the largest value of a·x + b·y sits on the corner picked out by the
    # signs of a and b, and those signs are constants here, so containment is one linear
    # constraint per room per edge. A rectangular plot sends none of these and is unaffected.
    for a, b, c in halfplanes:
        for v in var_dicts:
            x_term = v["xe"] if a > 0 else v["x"]
            y_term = v["ye"] if b > 0 else v["y"]
            model.add(a * x_term + b * y_term <= c)

    rules = resolve_rules(program, facing)

    # Connectivity, separation and daylight are all statements about one floor: a bedroom is not
    # reachable from a hall one storey below it, and the outside face of the building is the
    # outside face of *that* floor's footprint. Each is posted per floor, over that floor's own
    # rooms, which is exactly what these functions already do for a single-storey house.
    for f in floors:
        idx = by_floor[f]
        floor_rooms = [rooms[i] for i in idx]
        floor_vars = [var_dicts[i] for i in idx]
        if connect_rooms and len(floor_rooms) > 1:
            add_tree_adjacency(model, floor_vars, assign_parents(floor_rooms, program, facing))
            add_room_separation(
                model, floor_vars, floor_rooms, hub_index(floor_rooms, program), program
            )
        if require_daylight:
            add_daylight_constraints(model, floor_vars, floor_rooms, env_w_in, env_d_in)

    # notes/solver/realism-gaps.md — proportion is free, daylight costs four booleans a room.
    add_aspect_constraints(model, var_dicts, rooms)

    applied: list[str] = []
    if apply_zone_rules:
        if program.street_edge_spaces:
            # Only the ground floor meets the street. A first-floor room held to the street edge
            # is a rule applied to a boundary it does not touch.
            ground = by_floor.get(floors[0], [])
            add_street_edge_constraints(
                model,
                [var_dicts[i] for i in ground],
                [rooms[i] for i in ground],
                program.street_edge_spaces,
                primary_cardinal(facing),
                env_w_in,
                env_d_in,
            )
        for i, description in _rule_targets(rooms, rules).items():
            # A room the user dragged is released from its quadrant — but only that room.
            # Releasing the whole rule set because `prev` was supplied is what silently
            # un-zoned every edit.
            if i in zone_exempt:
                continue
            room, x, y, w, d = placements[i]
            rule = rules.get(room.name)
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
    # Requested pairs sit below drift and in the same band as compactness: both are linear
    # measures in inches, so one pair's closeness is worth the same per inch as the building
    # not straggling.
    if near:
        objective = objective + NEAR_WEIGHT * sum(
            near_terms(model, var_dicts, near, env_w_in, env_d_in)
        )
    if maximise_area:
        objective = objective - AREA_WEIGHT * sum(
            area_terms(model, var_dicts, rooms, env_w_in, env_d_in)
        )
        # ... and against the box those rooms occupy, so the two together minimise the void
        # inside the footprint rather than only growing rooms wherever they happen to sit.
        objective = objective + COMPACT_WEIGHT * footprint_perimeter_term(
            model, var_dicts, env_w_in, env_d_in
        )
    if objective_terms or maximise_area or near:
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
    apply_zone_rules: bool = False,
    connect_rooms: bool = True,
    moved_index: int | None = None,
    program: Program = RESIDENTIAL,
    facing: str = "N",
    halfplanes: Sequence[tuple[int, int, int]] = (),
    aligned: Sequence[Sequence[int]] = (),
    near: Sequence[tuple[int, int]] = (),
) -> SolveResult:
    if not rooms or env_w_in <= 0 or env_d_in <= 0:
        return SolveResult(status="EMPTY", rooms=[], solve_ms=0.0)

    # Check if any room physically cannot fit within the envelope
    for r in rooms:
        if r.min_w_in > env_w_in or r.min_d_in > env_d_in:
            return SolveResult(status="INFEASIBLE", rooms=[], solve_ms=0.0)

    # A requested pair is a statement about one plan, and two rooms on different storeys never
    # appear on the same one. Out-of-range and self-pairs are dropped rather than raising: this
    # arrives from a client, and one bad pair is not a reason to refuse the house.
    near = [
        (i, j)
        for i, j in near
        if i != j
        and 0 <= i < len(rooms)
        and 0 <= j < len(rooms)
        and getattr(rooms[i], "floor", 0) == getattr(rooms[j], "floor", 0)
    ]

    time_limit = interactive_budget(len(rooms)) if prev else SOLVE_TIME_LIMIT_SECONDS

    # Only the room the user actually dragged is released from its zone quadrant. Having
    # `prev` at all means "we have previous positions", which is true on every solve after the
    # first, and releasing every rule on that basis silently un-zoned each edit.
    zone_exempt = frozenset({moved_index}) if moved_index is not None else frozenset()

    # The relaxation ladder. Each rung drops the least important thing still standing.
    #
    # Connectivity is never dropped. A layout whose rooms do not open onto each other is not a
    # worse house, it is not a house — notes/solver/rooms-do-not-form-a-house.md. The previous
    # ladder shed it as a last resort and produced exactly that: 1 of 8 rooms reachable, from a
    # solve reported as OPTIMAL. If nothing on this ladder fits, INFEASIBLE is the honest answer
    # and the UI can say "too many rooms for this plot", which is at least actionable.
    def attempt(rs, zoned, daylight, area):
        return _build_and_solve(
            env_w_in, env_d_in, rs, prev, zoned, connect_rooms, time_limit,
            zone_exempt, require_daylight=daylight, maximise_area=area,
            program=program, facing=facing, halfplanes=halfplanes, aligned=aligned,
            # The last rung drops the area preference to buy speed on a mix that is barely
            # fitting. The pair preference goes with it, for the same reason and at the same
            # point: at that rung the question is whether these rooms fit at all.
            near=near if area else (),
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
            open_sided=getattr(r, "open_sided", False),
            floor=getattr(r, "floor", 0),
        )
        for r in rooms
    ]

    ladder = [
        # rooms,          zoning,       daylight, area   — what this rung gives up
        (rooms,           apply_zone_rules, True,     True),   # nothing
        (flexible_rooms,  apply_zone_rules, True,     True),   # custom sizes
        (flexible_rooms,  apply_zone_rules, False,    True),   # daylight
        (flexible_rooms,  False,        False,    True),   # zone rules
        (flexible_rooms,  False,        False,    False),  # the area preference, for speed
    ]

    status = solver = placements = applied = None
    for rs, zoned, daylight, area in ladder:
        status, solver, placements, applied = attempt(rs, zoned, daylight, area)
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
            open_sided=getattr(room, "open_sided", False),
        )
        for room, x, y, w, d in placements
    ]

    # Doors, windows and the front door are per floor for the same reason the constraints are.
    # Each helper works on one floor's rooms and returns indices into that subset, so the
    # openings it produces are translated back to global indices before they are merged.
    floors_out = sorted({getattr(r, "floor", 0) for r in rooms})
    rooms_by_floor = {
        f: [i for i, r in enumerate(rooms) if getattr(r, "floor", 0) == f] for f in floors_out
    }

    openings: list[list[dict]] = [[] for _ in placed]
    bounds_by_floor: dict[int, tuple[int, int, int, int]] = {}
    entrance_edge = None

    for f in floors_out:
        idx = rooms_by_floor[f]
        subset_rooms = [rooms[i] for i in idx]
        subset_placed = [placed[i] for i in idx]
        subset_hub = hub_index(subset_rooms, program)
        subset_parents = assign_parents(subset_rooms, program, facing)
        bounds_by_floor[f] = footprint(subset_placed)
        subset_openings = derive_openings(subset_placed, subset_parents)

        # The front door belongs to the floor that meets the street, and there is one of it.
        if f == floors_out[0]:
            entrance_edge = add_entrance(
                subset_placed, subset_openings, subset_hub, program, facing
            )
        derive_windows(subset_placed, subset_openings)

        for local, global_index in enumerate(idx):
            for opening in subset_openings[local]:
                to_room = opening.get("to_room")
                if to_room is not None:
                    opening["to_room"] = idx[to_room]
            openings[global_index] = subset_openings[local]

    hub = hub_index(rooms, program)

    placed = [
        PlacedRoom(
            name=p.name,
            x_in=p.x_in,
            y_in=p.y_in,
            w_in=p.w_in,
            d_in=p.d_in,
            openings=openings[i],
            wall_thickness_in=(
                EXTERIOR_WALL_IN
                if _on_exterior(p, bounds_by_floor[getattr(rooms[i], "floor", 0)])
                else INTERIOR_WALL_IN
            ),
            habitable=p.habitable,
            wet=p.wet,
            open_sided=p.open_sided,
            floor=getattr(rooms[i], "floor", 0),
        )
        for i, p in enumerate(placed)
    ]

    # Which rules the mix *should* have carried, ignoring the room the user is dragging — it is
    # released on purpose and its absence is not a relaxation.
    expected_rules = {
        i
        for i in _rule_targets(rooms, resolve_rules(program, facing))
        if i not in zone_exempt
    }

    # Per floor, then re-indexed: derive_walls pairs rooms that share a run, and two rooms on
    # different storeys never do.
    walls = []
    for f in floors_out:
        idx = rooms_by_floor[f]
        floor_walls = derive_walls([placed[i] for i in idx], [openings[i] for i in idx])
        for wall in floor_walls:
            walls.append(
                replace(
                    wall,
                    id=f"f{f}_{wall.id}",
                    room_indices=tuple(idx[r] for r in wall.room_indices),
                    floor=f,
                )
            )

    return SolveResult(
        status=status_name,
        rooms=placed,
        solve_ms=solve_ms,
        walls=walls,
        quantities=take_off(placed, walls),
        rules_applied=applied,
        entrance_edge=entrance_edge,
        rooms_reachable=reachable_count(placed, openings, hub, aligned),
        rules_relaxed=bool(apply_zone_rules and expected_rules and not applied),
        program=program.key,
        rules_label=program.rules_label,
    )
