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

# 2'8" clear — a standard Indian internal door leaf. Anything narrower is not a doorway, and a
# "shared wall" of 2 in (observed in real solver output) is a coincidence, not a connection.
DOOR_MIN_IN = 32
DOOR_WIDTH_IN = 32
DOOR_HEIGHT_IN = 84  # 7 ft

# Indian brick convention: 9 in exterior load-bearing, 4.5 in interior partition.
EXTERIOR_WALL_IN = 9
INTERIOR_WALL_IN = 5  # 4.5 rounded up — integer inches only, per integer-inches.md

HUB_ROOM = "hall"


def hub_index(rooms) -> int:
    """Index of the circulation hub. Prefers hall, then bedroom, then room 0."""
    for i, r in enumerate(rooms):
        if r.name == HUB_ROOM:
            return i
    for i, r in enumerate(rooms):
        if r.name == "bedroom":
            return i
    return 0


def add_hub_adjacency(model: cp_model.CpModel, vars_by_index: list[dict], hub: int) -> None:
    """Force every non-hub room to share >= DOOR_MIN_IN of wall with the hub."""
    h = vars_by_index[hub]
    for i, v in enumerate(vars_by_index):
        if i == hub:
            continue
        options = []

        # v west of hub: v's east edge meets hub's west edge, with vertical overlap.
        b = model.new_bool_var(f"adj_w_{i}")
        model.add(v["xe"] == h["x"]).only_enforce_if(b)
        model.add(v["y"] + DOOR_MIN_IN <= h["ye"]).only_enforce_if(b)
        model.add(h["y"] + DOOR_MIN_IN <= v["ye"]).only_enforce_if(b)
        options.append(b)

        # v east of hub.
        b = model.new_bool_var(f"adj_e_{i}")
        model.add(h["xe"] == v["x"]).only_enforce_if(b)
        model.add(v["y"] + DOOR_MIN_IN <= h["ye"]).only_enforce_if(b)
        model.add(h["y"] + DOOR_MIN_IN <= v["ye"]).only_enforce_if(b)
        options.append(b)

        # v north of hub (smaller Z), horizontal overlap.
        b = model.new_bool_var(f"adj_n_{i}")
        model.add(v["ye"] == h["y"]).only_enforce_if(b)
        model.add(v["x"] + DOOR_MIN_IN <= h["xe"]).only_enforce_if(b)
        model.add(h["x"] + DOOR_MIN_IN <= v["xe"]).only_enforce_if(b)
        options.append(b)

        # v south of hub.
        b = model.new_bool_var(f"adj_s_{i}")
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
    FORBIDDEN_PAIRS = {("kitchen", "bathroom"), ("pooja", "bathroom")}

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


def derive_openings(rooms, hub: int) -> list[list[dict]]:
    """One list of openings per room, mirrored so both sides of a shared wall carry the door.

    Doors are centred on the shared run, which keeps them off the corners where two walls meet.
    """
    openings: list[list[dict]] = [[] for _ in rooms]
    for i, a in enumerate(rooms):
        for j, b in enumerate(rooms):
            if j <= i:
                continue
            if hub not in (i, j):
                continue
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
                "to_room": j,
            })
            openings[j].append({
                "kind": "door",
                "edge": _opposite(edge),
                "offset_in": start - _edge_origin(b, _opposite(edge)),
                "width_in": width,
                "height_in": DOOR_HEIGHT_IN,
                "to_room": i,
            })
    return openings


ENTRANCE_EDGE_PREFERENCE = ["N", "E", "W", "S"]


def add_entrance(rooms, openings: list[list[dict]], hub: int, env_w_in: int, env_d_in: int) -> str | None:
    """Cut the front door in the hub's outermost wall, preferring N then E per Vaastu.

    Returns the edge used, or None if the hub touches no exterior wall.
    """
    room = rooms[hub]
    on_exterior = {
        "N": room.y_in == 0,
        "S": room.y_in + room.d_in == env_d_in,
        "W": room.x_in == 0,
        "E": room.x_in + room.w_in == env_w_in,
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
