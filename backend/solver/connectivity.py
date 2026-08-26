"""Make the solved rooms an actually walkable house.

notes/solver/rooms-do-not-form-a-house.md is the finding that forced this: with Vaastu on, only
37% of layouts had every room reachable through a real door, and the mean layout was 60% void.
The solver was satisfying non-overlap by scattering rectangles.

## The fix: a hall-centric star topology

The hall is the circulation hub. Every other room must share at least DOOR_MIN_IN of wall with
it. Connectivity is then structural — a star is connected by construction, so no reachability
search is needed inside the model (which CP-SAT expresses badly).

This is also how Indian houses are actually laid out: rooms open onto a central hall, not off a
corridor. Measured: 100% of feasible layouts connected, worst solve ~152 ms, and **zero extra
infeasibility** — every mix that failed with the hub constraint also failed without it, because
the rooms genuinely did not fit the plot.

Adjacency is expressed with reified booleans rather than min/max aux vars: for two rectangles
sharing a vertical edge, `overlap >= DOOR` is exactly the pair of linear constraints
`a.y + DOOR <= b.ye` and `b.y + DOOR <= a.ye`, each posted under `only_enforce_if`.
"""

from ortools.sat.python import cp_model

from vaastu import applies_to

# 2'8" clear — a standard Indian internal door leaf. Anything narrower is not a doorway, and a
# "shared wall" of 2 in (observed in real solver output) is a coincidence, not a connection.
DOOR_MIN_IN = 32
DOOR_WIDTH_IN = 32
DOOR_HEIGHT_IN = 84  # 7 ft

# Indian brick convention: 9 in exterior load-bearing, 4.5 in interior partition.
EXTERIOR_WALL_IN = 9
INTERIOR_WALL_IN = 5  # 4.5 rounded up — integer inches only, per integer-inches.md

HUB_ROOM = "hall"

# Which room kinds a given kind prefers to open off, best first. A pure star — every room onto
# the hall — is how notes/solver/rooms-do-not-form-a-house.md first fixed reachability, and it
# works, but it is not how a house is laid out and it makes the hall's perimeter the binding
# constraint once there are more than five or six rooms. A utility opens off the kitchen; a
# second bathroom is an ensuite off the master bedroom, not another door onto the living room.
#
# The result is still connected *by construction*: every room attaches to a room that is
# already attached, so the door graph is a tree rooted at the hub. No reachability search is
# needed inside the model, which is the property CP-SAT expresses badly.
PARENT_PREFERENCE: dict[str, tuple[str, ...]] = {
    "bathroom": ("bedroom", "hall", "dining"),
    "store": ("kitchen", "hall"),
    "dining": ("hall", "kitchen"),
    "pooja": ("hall", "dining"),
    "kitchen": ("hall", "dining"),
    "bedroom": ("hall", "dining"),
}

# How many rooms may open off one room. Without a cap the hall collects every child, and at
# nine rooms the model goes INFEASIBLE in 17 ms: seven rooms cannot all sit flush against one
# hall *and* all reach an exterior wall for light. Overflow lands on the dining space, which is
# how Indian plans actually distribute circulation once the house is bigger than a 2BHK.
MAX_CHILDREN = 5

# Sharing a partition between these is a construction and cultural taboo in Indian building.
# Hoisted to module scope because assign_parents() must respect it too: handing the kitchen a
# bathroom as its parent asks add_room_separation() to forbid the very wall the door needs,
# and the model goes INFEASIBLE in 13 ms with no diagnosis.
FORBIDDEN_PAIRS = {("kitchen", "bathroom"), ("pooja", "bathroom")}


def _may_share_a_wall(a, b) -> bool:
    return (a.name, b.name) not in FORBIDDEN_PAIRS and (b.name, a.name) not in FORBIDDEN_PAIRS


def _quadrants_conflict(a, b) -> bool:
    """Do Vaastu rules pin these two rooms to regions that do not touch?

    Making one the parent of the other forces them to share a wall. If their quadrants are
    disjoint on either axis, that is a contradiction the solver can only report as INFEASIBLE.

    Measured: on the real buildable envelope of a 30x40 plot (24x30 ft), the fan-out cap pushed
    the pooja room onto the kitchen as its parent — north-east and south-east, opposite corners
    — and Vaastu went from three rules applied to zero, because the whole model became
    infeasible and the ladder walked down to a rung with Vaastu switched off. On the plot size
    this product is aimed at, and on the constraint the market treats as mandatory.
    """
    ra, rb = applies_to(a.name), applies_to(b.name)
    if ra is None or rb is None:
        return False
    x_disjoint = ra.x_max_frac <= rb.x_min_frac or rb.x_max_frac <= ra.x_min_frac
    z_disjoint = ra.z_max_frac <= rb.z_min_frac or rb.z_max_frac <= ra.z_min_frac
    return x_disjoint or z_disjoint


def _may_be_parent(child, parent) -> bool:
    return _may_share_a_wall(child, parent) and not _quadrants_conflict(child, parent)


def hub_index(rooms) -> int:
    """Index of the circulation hub. Prefers hall, then bedroom, then room 0."""
    for i, r in enumerate(rooms):
        if r.name == HUB_ROOM:
            return i
    for i, r in enumerate(rooms):
        if r.name == "bedroom":
            return i
    return 0


def assign_parents(rooms) -> list[int | None]:
    """Pick one concrete parent room per room, forming a tree rooted at the hub.

    Assignment is static — decided before the model is built — so adjacency is a constraint
    against a specific room rather than a choice among kinds. That keeps the encoding the same
    size as the old star while producing a realistic plan.

    Three rules beyond the preference table:
      - **Master ensuite.** With two or more bathrooms, the first opens off the first bedroom.
        That is the standard Indian 2BHK arrangement. A lone bathroom stays common, off the
        hall, because an ensuite-only house leaves guests nowhere to go.
      - **Fan-out cap.** No room takes more than MAX_CHILDREN doors.
    """
    hub = hub_index(rooms)
    parents: list[int | None] = [None] * len(rooms)
    children: dict[int, int] = {}

    baths = [i for i, r in enumerate(rooms) if r.name == "bathroom"]
    beds = [i for i, r in enumerate(rooms) if r.name == "bedroom"]
    ensuite = baths[0] if (len(baths) >= 2 and beds and beds[0] != hub) else None

    def preference(i: int) -> tuple[str, ...]:
        # A lone bathroom must not become an ensuite, so it skips the "bedroom" preference.
        if rooms[i].name == "bathroom" and i != ensuite:
            return ("hall", "dining", "bedroom")
        return PARENT_PREFERENCE.get(rooms[i].name, ("hall",))

    attached = {hub}
    remaining = [i for i in range(len(rooms)) if i != hub]

    def take(i: int, parent: int) -> None:
        parents[i] = parent
        children[parent] = children.get(parent, 0) + 1
        attached.add(i)
        remaining.remove(i)

    while remaining:
        progress = False
        for i in list(remaining):
            chosen: int | None = None
            if i == ensuite and beds[0] in attached and children.get(beds[0], 0) < MAX_CHILDREN:
                chosen = beds[0]
            else:
                for kind in preference(i):
                    for j, r in enumerate(rooms):
                        if (
                            j != i
                            and j in attached
                            and r.name == kind
                            and children.get(j, 0) < MAX_CHILDREN
                            and _may_be_parent(rooms[i], r)
                        ):
                            chosen = j
                            break
                    if chosen is not None:
                        break
            if chosen is not None:
                take(i, chosen)
                progress = True
        if not progress:
            # Every preferred parent is full, absent, or forbidden. Attach ONE room to whichever
            # legal attached room has the fewest doors, then go round again — attaching it may
            # be exactly what unblocks the others' preferences. Attaching them all at once here
            # is what left a kitchen parentless in a hall-less mix, because the dining room it
            # could legally have opened off was not attached yet when its turn came.
            best: tuple[int, int] | None = None
            for i in remaining:
                candidates = [
                    j for j in attached if j != i and _may_be_parent(rooms[i], rooms[j])
                ]
                if not candidates:
                    continue
                parent = min(candidates, key=lambda j: children.get(j, 0))
                if best is None or children.get(parent, 0) < children.get(best[1], 0):
                    best = (i, parent)
            if best is None:
                # Nothing legal is left to attach to — e.g. a kitchen in a house of nothing but
                # bathrooms. Leave the rest parentless rather than encoding a contradiction.
                break
            take(*best)

    return parents


def add_tree_adjacency(
    model: cp_model.CpModel, vars_by_index: list[dict], parents: list[int | None]
) -> None:
    """Force every room to share >= DOOR_MIN_IN of wall with its assigned parent."""
    for i, v in enumerate(vars_by_index):
        parent = parents[i]
        if parent is None:
            continue
        h = vars_by_index[parent]
        options = []

        # v west of parent: v's east edge meets parent's west edge, with vertical overlap.
        b = model.new_bool_var(f"adj_w_{i}_{parent}")
        model.add(v["xe"] == h["x"]).only_enforce_if(b)
        model.add(v["y"] + DOOR_MIN_IN <= h["ye"]).only_enforce_if(b)
        model.add(h["y"] + DOOR_MIN_IN <= v["ye"]).only_enforce_if(b)
        options.append(b)

        # v east of parent.
        b = model.new_bool_var(f"adj_e_{i}_{parent}")
        model.add(h["xe"] == v["x"]).only_enforce_if(b)
        model.add(v["y"] + DOOR_MIN_IN <= h["ye"]).only_enforce_if(b)
        model.add(h["y"] + DOOR_MIN_IN <= v["ye"]).only_enforce_if(b)
        options.append(b)

        # v north of parent (smaller Z), horizontal overlap.
        b = model.new_bool_var(f"adj_n_{i}_{parent}")
        model.add(v["ye"] == h["y"]).only_enforce_if(b)
        model.add(v["x"] + DOOR_MIN_IN <= h["xe"]).only_enforce_if(b)
        model.add(h["x"] + DOOR_MIN_IN <= v["xe"]).only_enforce_if(b)
        options.append(b)

        # v south of parent.
        b = model.new_bool_var(f"adj_s_{i}_{parent}")
        model.add(h["ye"] == v["y"]).only_enforce_if(b)
        model.add(v["x"] + DOOR_MIN_IN <= h["xe"]).only_enforce_if(b)
        model.add(h["x"] + DOOR_MIN_IN <= v["xe"]).only_enforce_if(b)
        options.append(b)

        model.add_bool_or(options)


def add_room_separation(model: cp_model.CpModel, vars_by_index: list[dict], rooms, hub: int) -> None:
    """Forbid incompatible rooms from sharing a wall (e.g. Kitchen <-> Bathroom, Pooja <-> Bathroom).

    Sharing a common partition between Kitchen and Bathroom (or Pooja and Bathroom) is a strict
    construction and cultural taboo in Indian architecture.
    """
    for i, r_i in enumerate(rooms):
        for j, r_j in enumerate(rooms):
            if j <= i:
                continue
            pair = (r_i.name, r_j.name)
            rev_pair = (r_j.name, r_i.name)
            if pair not in FORBIDDEN_PAIRS and rev_pair not in FORBIDDEN_PAIRS:
                continue

            # If there's no intermediate room and one of these is the forced hub, separation is not applicable
            if (i == hub or j == hub) and not any(r.name in ("hall", "bedroom") for r in rooms):
                continue

            v_i, v_j = vars_by_index[i], vars_by_index[j]

            # Y-separation (one strictly above or below the other)
            b_sep_y1 = model.new_bool_var(f"sep_y1_{i}_{j}")
            b_sep_y2 = model.new_bool_var(f"sep_y2_{i}_{j}")
            model.add(v_i["ye"] <= v_j["y"]).only_enforce_if(b_sep_y1)
            model.add(v_j["ye"] <= v_i["y"]).only_enforce_if(b_sep_y2)

            # X-separation (one strictly to the left or right of the other)
            b_sep_x1 = model.new_bool_var(f"sep_x1_{i}_{j}")
            b_sep_x2 = model.new_bool_var(f"sep_x2_{i}_{j}")
            model.add(v_i["xe"] <= v_j["x"]).only_enforce_if(b_sep_x1)
            model.add(v_j["xe"] <= v_i["x"]).only_enforce_if(b_sep_x2)

            # Touch W: i's right meets j's left -> must have Y-separation
            b_touch_w = model.new_bool_var(f"touch_w_{i}_{j}")
            model.add(v_i["xe"] == v_j["x"]).only_enforce_if(b_touch_w)
            model.add(v_i["xe"] != v_j["x"]).only_enforce_if(b_touch_w.Not())
            model.add_bool_or([b_touch_w.Not(), b_sep_y1, b_sep_y2])

            # Touch E: j's right meets i's left -> must have Y-separation
            b_touch_e = model.new_bool_var(f"touch_e_{i}_{j}")
            model.add(v_j["xe"] == v_i["x"]).only_enforce_if(b_touch_e)
            model.add(v_j["xe"] != v_i["x"]).only_enforce_if(b_touch_e.Not())
            model.add_bool_or([b_touch_e.Not(), b_sep_y1, b_sep_y2])

            # Touch N: i's bottom meets j's top -> must have X-separation
            b_touch_n = model.new_bool_var(f"touch_n_{i}_{j}")
            model.add(v_i["ye"] == v_j["y"]).only_enforce_if(b_touch_n)
            model.add(v_i["ye"] != v_j["y"]).only_enforce_if(b_touch_n.Not())
            model.add_bool_or([b_touch_n.Not(), b_sep_x1, b_sep_x2])

            # Touch S: j's bottom meets i's top -> must have X-separation
            b_touch_s = model.new_bool_var(f"touch_s_{i}_{j}")
            model.add(v_j["ye"] == v_i["y"]).only_enforce_if(b_touch_s)
            model.add(v_j["ye"] != v_i["y"]).only_enforce_if(b_touch_s.Not())
            model.add_bool_or([b_touch_s.Not(), b_sep_x1, b_sep_x2])


# --------------------------------------------------------------------------------------
# Post-solve: derive doors and walls from the placed rectangles.
# --------------------------------------------------------------------------------------

def _shared_run(a, b) -> tuple[str, int, int] | None:
    """If a and b share a wall, return (edge_of_a, overlap_start, overlap_end)."""
    ax0, ax1 = a.x_in, a.x_in + a.w_in
    az0, az1 = a.y_in, a.y_in + a.d_in
    bx0, bx1 = b.x_in, b.x_in + b.w_in
    bz0, bz1 = b.y_in, b.y_in + b.d_in

    ov_z0, ov_z1 = max(az0, bz0), min(az1, bz1)
    ov_x0, ov_x1 = max(ax0, bx0), min(ax1, bx1)

    if ax1 == bx0 and ov_z1 - ov_z0 >= DOOR_MIN_IN:
        return "E", ov_z0, ov_z1
    if bx1 == ax0 and ov_z1 - ov_z0 >= DOOR_MIN_IN:
        return "W", ov_z0, ov_z1
    if az1 == bz0 and ov_x1 - ov_x0 >= DOOR_MIN_IN:
        return "S", ov_x0, ov_x1
    if bz1 == az0 and ov_x1 - ov_x0 >= DOOR_MIN_IN:
        return "N", ov_x0, ov_x1
    return None


def _opposite(edge: str) -> str:
    return {"N": "S", "S": "N", "E": "W", "W": "E"}[edge]


def _edge_origin(room, edge: str) -> int:
    """Offsets run along the edge from the room's minimum corner on that edge's axis."""
    return room.y_in if edge in ("E", "W") else room.x_in


def derive_openings(rooms, parents: list[int | None]) -> list[list[dict]]:
    """One list of openings per room, mirrored so both sides of a shared wall carry the door.

    Doors follow the parent tree from assign_parents(), not a star onto the hub — so a utility
    opens off the kitchen and an ensuite off its bedroom, which is where those doors belong.

    Doors are centred on the shared run, which keeps them off the corners where two walls meet.
    """
    openings: list[list[dict]] = [[] for _ in rooms]
    for i, parent in enumerate(parents):
        if parent is None:
            continue
        a, b = rooms[i], rooms[parent]
        shared = _shared_run(a, b)
        if shared is None:
            continue
        edge, s0, s1 = shared
        centre = (s0 + s1) // 2
        width = min(DOOR_WIDTH_IN, s1 - s0)
        start = centre - width // 2

        openings[i].append({
            "kind": "door",
            "edge": edge,
            "offset_in": start - _edge_origin(a, edge),
            "width_in": width,
            "height_in": DOOR_HEIGHT_IN,
            "to_room": parent,
        })
        openings[parent].append({
            "kind": "door",
            "edge": _opposite(edge),
            "offset_in": start - _edge_origin(b, _opposite(edge)),
            "width_in": width,
            "height_in": DOOR_HEIGHT_IN,
            "to_room": i,
        })
    return openings


def footprint(rooms) -> tuple[int, int, int, int]:
    """Bounding box of the built area: (x0, z0, x1, z1).

    The house rarely fills its envelope — room maximums see to that — so "exterior wall" means
    the outside face of *this* box, not the plot boundary. realism.add_daylight_constraints()
    constrains against the same box; windows and the front door have to agree with it or the
    solver guarantees a wall that the geometry then refuses to put a hole in.
    """
    return (
        min(r.x_in for r in rooms),
        min(r.y_in for r in rooms),
        max(r.x_in + r.w_in for r in rooms),
        max(r.y_in + r.d_in for r in rooms),
    )


WINDOW_SILL_IN = 36
WINDOW_HEIGHT_IN = 48
WINDOW_MIN_WALL_IN = 60          # below this the wall is too short to take a window
WINDOW_MAX_WIDTH_IN = 72         # 6 ft, a large-but-buildable opening
# Indian bye-laws generally require openable area of roughly a tenth of the floor area for a
# habitable room. Approximated here as a target window width per exterior wall.
LIGHT_AREA_FRACTION = 0.10


def _free_gaps(room, edge: str, openings_on_edge: list[dict]) -> list[tuple[int, int]]:
    """Runs of wall on `edge` not already occupied by a door or another opening.

    Offsets are measured along the edge from the room's minimum corner, matching the
    convention in _edge_origin().
    """
    run = room.d_in if edge in ("E", "W") else room.w_in
    taken = sorted(
        (o["offset_in"], o["offset_in"] + o["width_in"]) for o in openings_on_edge
    )
    gaps: list[tuple[int, int]] = []
    cursor = 0
    for start_in, end_in in taken:
        if start_in - cursor > 0:
            gaps.append((cursor, start_in))
        cursor = max(cursor, end_in)
    if run - cursor > 0:
        gaps.append((cursor, run))
    return gaps


def derive_windows(rooms, openings: list[list[dict]]) -> None:
    """Cut a window in each room's free exterior wall. Mutates `openings` in place.

    Runs post-solve, like the doors. realism.add_daylight_constraints() is what guarantees a
    habitable room actually *has* an exterior wall to cut into; this decides how big the hole is
    and where it goes.

    Placement is gap-aware rather than edge-exclusive. A hall whose only outside wall carries
    the front door still needs a window, and a 15 ft wall holds both comfortably — refusing one
    because the edge was "taken" left the main room of the house dark.

    Bathrooms and utilities get a small high vent rather than nothing: an unventilated wet room
    is not buildable, and the renderer previously refused them a window outright.
    """
    fx0, fz0, fx1, fz1 = footprint(rooms)
    for i, room in enumerate(rooms):
        habitable = getattr(room, "habitable", True)
        wet = getattr(room, "wet", False)
        if not (habitable or wet):
            continue

        exterior = {
            "N": room.y_in == fz0,
            "S": room.y_in + room.d_in == fz1,
            "W": room.x_in == fx0,
            "E": room.x_in + room.w_in == fx1,
        }

        floor_area = room.w_in * room.d_in
        wanted = int((floor_area * LIGHT_AREA_FRACTION) / max(WINDOW_HEIGHT_IN, 1))

        for edge, is_exterior in exterior.items():
            if not is_exterior:
                continue
            if any(o["kind"] == "window" and o["edge"] == edge for o in openings[i]):
                continue

            on_edge = [o for o in openings[i] if o["edge"] == edge]
            gaps = _free_gaps(room, edge, on_edge)
            if not gaps:
                continue
            g0, g1 = max(gaps, key=lambda g: g[1] - g[0])
            free = g1 - g0
            if free < WINDOW_MIN_WALL_IN:
                continue

            # Leave a pier of at least a wall thickness at each end of the gap.
            usable = free - 2 * EXTERIOR_WALL_IN
            if habitable:
                width = min(max(wanted, DOOR_WIDTH_IN), WINDOW_MAX_WIDTH_IN, usable)
            else:
                width = min(DOOR_WIDTH_IN, usable)  # a vent, not a view
            if width < 18:
                continue

            openings[i].append({
                "kind": "window",
                "edge": edge,
                "offset_in": g0 + (free - width) // 2,
                "width_in": int(width),
                "height_in": WINDOW_HEIGHT_IN,
                "sill_in": WINDOW_SILL_IN if habitable else WINDOW_SILL_IN + 18,
                "to_room": None,
            })


ENTRANCE_EDGE_PREFERENCE = ["N", "E", "W", "S"]


def add_entrance(rooms, openings: list[list[dict]], hub: int) -> str | None:
    """Cut the front door in the hub's outermost wall, preferring N then E per Vaastu.

    Returns the edge used, or None if the hub touches no exterior wall.
    """
    room = rooms[hub]
    fx0, fz0, fx1, fz1 = footprint(rooms)
    on_exterior = {
        "N": room.y_in == fz0,
        "S": room.y_in + room.d_in == fz1,
        "W": room.x_in == fx0,
        "E": room.x_in + room.w_in == fx1,
    }
    for edge in ENTRANCE_EDGE_PREFERENCE:
        if not on_exterior[edge]:
            continue
        run = room.d_in if edge in ("E", "W") else room.w_in
        if run < DOOR_WIDTH_IN:
            continue
        width = min(DOOR_WIDTH_IN, run)
        openings[hub].append({
            "kind": "entrance",
            "edge": edge,
            "offset_in": (run - width) // 2,
            "width_in": width,
            "height_in": DOOR_HEIGHT_IN,
            "to_room": None,
        })
        return edge
    return None


def reachable_count(rooms, openings: list[list[dict]], start: int = 0) -> int:
    """Flood-fill the door graph. Used by tests to assert the house is actually walkable."""
    adj: dict[int, set[int]] = {i: set() for i in range(len(rooms))}
    for i, ops in enumerate(openings):
        for o in ops:
            if o["to_room"] is not None:
                adj[i].add(o["to_room"])
                adj[o["to_room"]].add(i)
    seen = {start}
    stack = [start]
    while stack:
        n = stack.pop()
        for k in adj[n]:
            if k not in seen:
                seen.add(k)
                stack.append(k)
    return len(seen)
