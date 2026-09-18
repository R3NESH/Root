"""Buildable envelope for a plot that is not a rectangle.

Real parcels are not rectangles. A corner plot is splayed where the two roads meet, a plot on a
curve has a splayed road edge, and a subdivision leaves trapezoids wherever the layout had to
close. `envelope.py` handles the rectangle case and is unchanged; this handles the general convex
polygon, and the rectangle remains the fast path.

The representation is deliberately half-planes rather than vertices. A convex polygon is exactly
the intersection of one half-plane per edge:

    a·x + b·y <= c

and for an axis-aligned rectangle the maximum of `a·x + b·y` over its four corners is reached at
a corner that is known from the signs of `a` and `b` *at model build time*. So "this room is
inside the plot" is one linear constraint per room per plot edge, over integers, which is
precisely what CP-SAT is good at — see solver/model.py. No new solver machinery, no polygon
intersection at solve time, and integer inches survive intact (notes/decisions/integer-inches.md).

Coordinates are the plot frame the rest of the stack uses: x runs east, y runs south, and (0, 0)
is the north-west corner.
"""

from dataclasses import dataclass
from math import ceil, floor, hypot

from .envelope import Facing, Setback, edge_setbacks_in

Point = tuple[int, int]

# A curved plot edge reaches the solver as chords, so the cap has to leave room for enough of
# them to stop the curve reading as a polygon. 32 is measured, not guessed: on a 40x50 plot with
# a 6 ft bow in the road edge, each extra edge is one linear constraint per room per floor and
# the cold solve time did not move at all between a 4-edge rectangle and a 26-edge bow - the 2 s
# budget in solver/model.py is the binding constraint either way, not the edge count.
#
# The producer caps itself well below this. Integer-inch vertices are the real ceiling: sampling
# a curve and rounding onto the inch lattice reverses chord turns once the chords get short (a
# 6 ft bow breaks convexity at 22 chords), so frontend/lib/plot.ts runs the rounded points
# through a convex hull, which both guarantees is_convex() and collapses the near-collinear
# points a fine tessellation produces. 64 chords come out as 26 vertices.
#
# Beyond that a polygon is not a plot, it is a mistake.
MAX_VERTICES = 32


@dataclass(frozen=True)
class HalfPlane:
    """`a·x + b·y <= c`, all integers. (a, b) points out of the polygon."""

    a: int
    b: int
    c: int


@dataclass(frozen=True)
class PolygonEnvelope:
    """The buildable area of a non-rectangular plot."""

    origin_x_in: int
    origin_z_in: int
    width_in: int
    depth_in: int
    # The inset polygon in plot coordinates, for drawing. Vertices are rounded; the half-planes
    # are the authority on what is inside.
    polygon_in: list[Point]
    # The same half-planes shifted into envelope-local coordinates, which is the frame the solver
    # places rooms in.
    halfplanes: list[HalfPlane]


def signed_area2(poly: list[Point]) -> int:
    """Twice the signed area. Positive means counter-clockwise in a y-down frame is clockwise on
    screen; only the sign is used, to find which way the normals face."""
    total = 0
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        total += x0 * y1 - x1 * y0
    return total


def is_convex(poly: list[Point]) -> bool:
    """True when every turn goes the same way. Collinear points are allowed; a repeated point or
    a self-intersection is not, and both fail here."""
    if len(poly) < 3:
        return False
    sign = 0
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        cx, cy = poly[(i + 2) % n]
        if (ax, ay) == (bx, by):
            return False
        cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
        if cross == 0:
            continue
        turn = 1 if cross > 0 else -1
        if sign == 0:
            sign = turn
        elif turn != sign:
            return False
    return sign != 0


def outward_halfplanes(poly: list[Point]) -> list[HalfPlane]:
    """One half-plane per edge, normal pointing out of the polygon."""
    ccw = signed_area2(poly) > 0
    planes: list[HalfPlane] = []
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        if dx == 0 and dy == 0:
            continue
        # Rotate the edge to get a normal; the winding decides which of the two is outward.
        a, b = (dy, -dx) if ccw else (-dy, dx)
        planes.append(HalfPlane(a, b, a * x0 + b * y0))
    return planes


def _edge_setback_in(plane: HalfPlane, facing: Facing, setback: Setback) -> int:
    """The setback that applies to an edge, from the direction its outward normal points.

    A splayed corner edge faces roughly north-east; it is held to whichever of the two it faces
    more squarely. That is a simplification — a real bye-law would read the road each edge abuts
    — and it is the same order of approximation as the hardcoded setbacks themselves.
    """
    north_in, east_in, south_in, west_in = edge_setbacks_in(facing, setback)
    if abs(plane.a) >= abs(plane.b):
        return east_in if plane.a > 0 else west_in
    return south_in if plane.b > 0 else north_in


def inset(plane: HalfPlane, inches: int) -> HalfPlane:
    """Push a half-plane inward by `inches`.

    `c` moves by the setback times the normal's length, which is irrational for a splayed edge.
    It is rounded *up*, so the buildable area is never larger than the bye-law allows — an
    envelope that errs is an envelope that errs on the legal side.
    """
    if inches <= 0:
        return plane
    length = hypot(plane.a, plane.b)
    return HalfPlane(plane.a, plane.b, plane.c - ceil(inches * length))


def clip(poly: list[tuple[float, float]], plane: HalfPlane) -> list[tuple[float, float]]:
    """Sutherland-Hodgman clip of a convex polygon against one half-plane."""
    if not poly:
        return []
    out: list[tuple[float, float]] = []
    n = len(poly)
    for i in range(n):
        cx, cy = poly[i]
        nx, ny = poly[(i + 1) % n]
        c_in = plane.a * cx + plane.b * cy <= plane.c
        n_in = plane.a * nx + plane.b * ny <= plane.c
        if c_in:
            out.append((cx, cy))
        if c_in != n_in:
            denom = plane.a * (nx - cx) + plane.b * (ny - cy)
            if denom != 0:
                t = (plane.c - plane.a * cx - plane.b * cy) / denom
                out.append((cx + t * (nx - cx), cy + t * (ny - cy)))
    return out


def _dedupe(poly: list[Point]) -> list[Point]:
    out: list[Point] = []
    for p in poly:
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def buildable_polygon(
    polygon_in: list[Point], facing: Facing, setback: Setback
) -> PolygonEnvelope | None:
    """The buildable envelope of a convex polygon plot, or None when the plot is unusable.

    None means the caller should fall back to the rectangle path: too few or too many corners, a
    non-convex outline, or setbacks that leave nothing to build on.
    """
    poly = _dedupe([(int(x), int(y)) for x, y in polygon_in])
    if len(poly) < 3 or len(poly) > MAX_VERTICES or not is_convex(poly):
        return None

    planes = [inset(p, _edge_setback_in(p, facing, setback)) for p in outward_halfplanes(poly)]

    clipped: list[tuple[float, float]] = [(float(x), float(y)) for x, y in poly]
    for plane in planes:
        clipped = clip(clipped, plane)
        if not clipped:
            return None

    xs = [p[0] for p in clipped]
    ys = [p[1] for p in clipped]
    # The bounding box is rounded outward so it always contains the polygon; the half-planes,
    # not the box, are what actually hold a room inside the plot.
    origin_x = floor(min(xs))
    origin_z = floor(min(ys))
    width = ceil(max(xs)) - origin_x
    depth = ceil(max(ys)) - origin_z
    if width <= 0 or depth <= 0:
        return None

    # Into envelope-local coordinates: a·(x + ox) + b·(y + oz) <= c.
    local = [HalfPlane(p.a, p.b, p.c - p.a * origin_x - p.b * origin_z) for p in planes]

    return PolygonEnvelope(
        origin_x_in=origin_x,
        origin_z_in=origin_z,
        width_in=width,
        depth_in=depth,
        polygon_in=_dedupe([(int(round(x)), int(round(y))) for x, y in clipped]),
        halfplanes=local,
    )
