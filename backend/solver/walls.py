"""Walls as objects, derived once from the solved rooms.

Until this module, walls were not in the model at all. They were a rendering artifact: Scene.tsx
walked each room's four edges and drew a box per edge, deduplicating shared partitions by "skip
if the neighbour's index is lower". Two rooms sharing a partition each believed they owned a
wall, and no wall had an identity anything could point at.

That inversion is backwards from how a building is described. A wall is a thing; a room is what
walls enclose. The absence showed up the moment anything needed to name one — wall paint bands
had to invent the key `bedroom_1__N`, "room instance plus edge", because there was no wall id.

What a wall is here:

- **A maximal run along one room edge with the same neighbour.** Where two rooms overlap on an
  edge, that overlap is one shared wall, emitted once, listing both rooms. Where a room's edge
  faces nothing, that run is an exterior wall listing one room. This is the same segmentation the
  renderer computes, so the two agree by construction rather than by luck.
- **Thickness from what is on the other side**, matching the Indian brick convention already in
  connectivity.py: 9 in load-bearing where a wall is unshared, 4.5 in (rounded to 5, per
  integer-inches.md) where it is a partition between two rooms.
- **The host of its openings.** Doors are mirrored onto both rooms by derive_openings(); on a
  shared wall the door is one door, so it is attached here once.

Geometry convention: `(x0_in, y0_in) -> (x1_in, y1_in)` is the room-boundary line, not an offset
centreline. The renderer builds the solid inward from it. Length, and therefore every quantity
derived from it, is unaffected by that choice.
"""

from dataclasses import dataclass, field

from .connectivity import EXTERIOR_WALL_IN, INTERIOR_WALL_IN

# NBC 2016 requires 2.75 m clear for a habitable room; WALL_HEIGHT_FT in the renderer is 9.0 ft,
# which is 108 in and within an inch of it. Stated here so quantities do not have to guess.
WALL_HEIGHT_IN = 108

_OPPOSITE = {"N": "S", "S": "N", "E": "W", "W": "E"}


@dataclass(frozen=True)
class Wall:
    id: str
    x0_in: int
    y0_in: int
    x1_in: int
    y1_in: int
    thickness_in: int
    height_in: int
    is_exterior: bool
    # Room indices this wall bounds: one for an exterior wall, two for a partition.
    room_indices: tuple[int, ...]
    openings: list[dict] = field(default_factory=list)

    @property
    def length_in(self) -> int:
        return abs(self.x1_in - self.x0_in) + abs(self.y1_in - self.y0_in)


def _edge_line_and_span(room, edge: str) -> tuple[int, int, int]:
    """(line coordinate, span start, span end) for one room edge.

    N and S run along X at a fixed Y; E and W run along Y at a fixed X.
    """
    if edge == "N":
        return room.y_in, room.x_in, room.x_in + room.w_in
    if edge == "S":
        return room.y_in + room.d_in, room.x_in, room.x_in + room.w_in
    if edge == "W":
        return room.x_in, room.y_in, room.y_in + room.d_in
    return room.x_in + room.w_in, room.y_in, room.y_in + room.d_in


def _neighbours_on(rooms, i: int, edge: str) -> list[tuple[int, int, int]]:
    """(overlap start, overlap end, room index) for every room flush against this edge."""
    line, s0, s1 = _edge_line_and_span(rooms[i], edge)
    opposite = _OPPOSITE[edge]
    out = []
    for j, other in enumerate(rooms):
        if j == i:
            continue
        o_line, o_s0, o_s1 = _edge_line_and_span(other, opposite)
        if o_line != line:
            continue
        lo, hi = max(s0, o_s0), min(s1, o_s1)
        if hi > lo:
            out.append((lo, hi, j))
    out.sort()
    return out


def _runs(s0: int, s1: int, neighbours: list[tuple[int, int, int]]) -> list[tuple[int, int, int | None]]:
    """Split an edge into runs: shared with a room, or facing nothing."""
    runs: list[tuple[int, int, int | None]] = []
    cursor = s0
    for lo, hi, j in neighbours:
        lo, hi = max(lo, cursor), min(hi, s1)
        if hi <= cursor:
            continue
        if lo > cursor:
            runs.append((cursor, lo, None))
        runs.append((lo, hi, j))
        cursor = hi
    if cursor < s1:
        runs.append((cursor, s1, None))
    return runs


def _opening_centre(room, opening: dict) -> int:
    """Centre of an opening along its edge, in the same coordinates as the runs above."""
    edge = opening["edge"]
    origin = room.y_in if edge in ("E", "W") else room.x_in
    return origin + opening["offset_in"] + opening["width_in"] // 2


def derive_walls(rooms, openings: list[list[dict]]) -> list[Wall]:
    """Every wall in the plan, once each, with its openings attached.

    `rooms` are the placed rooms and `openings` the per-room lists derive_openings() and
    derive_windows() produced — the same pair the renderer consumes.
    """
    walls: list[Wall] = []
    seen: set[tuple] = set()

    for i, room in enumerate(rooms):
        for edge in ("N", "S", "E", "W"):
            line, s0, s1 = _edge_line_and_span(room, edge)
            horizontal = edge in ("N", "S")

            for lo, hi, j in _runs(s0, s1, _neighbours_on(rooms, i, edge)):
                if hi - lo <= 0:
                    continue

                # A shared run belongs to both rooms; emit it from the lower index only.
                if j is not None and j < i:
                    continue

                key = ("h" if horizontal else "v", line, lo, hi)
                if key in seen:
                    continue
                seen.add(key)

                shared = j is not None
                if horizontal:
                    x0, y0, x1, y1 = lo, line, hi, line
                else:
                    x0, y0, x1, y1 = line, lo, line, hi

                walls.append(
                    Wall(
                        id=f"wall_{'h' if horizontal else 'v'}_{line}_{lo}_{hi}",
                        x0_in=x0,
                        y0_in=y0,
                        x1_in=x1,
                        y1_in=y1,
                        thickness_in=INTERIOR_WALL_IN if shared else EXTERIOR_WALL_IN,
                        height_in=WALL_HEIGHT_IN,
                        is_exterior=not shared,
                        room_indices=(i, j) if shared else (i,),
                        openings=[],
                    )
                )

    _host_openings(rooms, openings, walls)
    return walls


def _host_openings(rooms, openings: list[list[dict]], walls: list[Wall]) -> None:
    """Attach each opening to the wall that contains it, once.

    derive_openings() mirrors a door onto both rooms of a shared wall. That is right for the
    renderer, which draws each room independently, and wrong for a bill of quantities, which
    would count the door twice. A wall hosts one door.
    """
    by_line: dict[tuple, list[Wall]] = {}
    for w in walls:
        horizontal = w.y0_in == w.y1_in
        line = w.y0_in if horizontal else w.x0_in
        by_line.setdefault(("h" if horizontal else "v", line), []).append(w)

    for i, room in enumerate(rooms):
        for opening in openings[i]:
            edge = opening["edge"]
            line, _s0, _s1 = _edge_line_and_span(room, edge)
            horizontal = edge in ("N", "S")
            centre = _opening_centre(room, opening)

            for w in by_line.get(("h" if horizontal else "v", line), []):
                lo = min(w.x0_in, w.x1_in) if horizontal else min(w.y0_in, w.y1_in)
                hi = max(w.x0_in, w.x1_in) if horizontal else max(w.y0_in, w.y1_in)
                if not (lo <= centre <= hi):
                    continue
                if i not in w.room_indices:
                    continue
                # The mirrored copy on the other room is the same physical opening.
                duplicate = any(
                    o["kind"] == opening["kind"]
                    and o["width_in"] == opening["width_in"]
                    and abs(o["centre_in"] - centre) <= 1
                    for o in w.openings
                )
                if not duplicate:
                    w.openings.append({**opening, "centre_in": centre})
                break
