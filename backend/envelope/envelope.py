"""Setback-derived buildable envelope.

Mirrors frontend/lib/plot.ts's edgeSetbacksIn/buildableWidthIn/buildableDepthIn exactly — no
shared code across the TS/Python boundary, so keep the two in sync by hand if either changes.

notes/architecture/environment-notes.md: setback values are HARDCODED, a known gap, not a
convention. Real values come from local building bye-laws and vary by plot size and road width.
"""

from dataclasses import dataclass

Facing = str  # one of FACINGS, kept as str (not an enum) to match the frontend's plain strings

FACINGS: list[Facing] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


@dataclass(frozen=True)
class Setback:
    front_in: int
    rear_in: int
    left_in: int
    right_in: int


# Matches frontend/lib/plot.ts DEFAULT_SETBACK and the worked example in
# notes/architecture/output-schema.md.
DEFAULT_SETBACK = Setback(front_in=60, rear_in=60, left_in=36, right_in=36)


def facing_angle_deg(facing: Facing) -> int:
    return FACINGS.index(facing) * 45


def front_cardinal_index(facing: Facing) -> int:
    """0=N, 1=E, 2=S, 3=W. An ordinal (corner) facing rounds to its nearest cardinal — see the
    matching comment in frontend/lib/plot.ts."""
    return round(facing_angle_deg(facing) / 90) % 4


def edge_setbacks_in(facing: Facing, setback: Setback) -> tuple[int, int, int, int]:
    """Per-edge setback in fixed world orientation: index 0=N, 1=E, 2=S, 3=W."""
    front = front_cardinal_index(facing)
    rear = (front + 2) % 4
    right = (front + 1) % 4
    left = (front + 3) % 4
    edges = [0, 0, 0, 0]
    edges[front] = setback.front_in
    edges[rear] = setback.rear_in
    edges[right] = setback.right_in
    edges[left] = setback.left_in
    return edges[0], edges[1], edges[2], edges[3]


@dataclass(frozen=True)
class BuildableEnvelope:
    origin_x_in: int  # offset from the plot's (0,0) corner — West edge setback
    origin_z_in: int  # offset from the plot's (0,0) corner — North edge setback
    width_in: int
    depth_in: int


def buildable_envelope(plot_w_in: int, plot_d_in: int, facing: Facing, setback: Setback) -> BuildableEnvelope:
    n, e, s, w = edge_setbacks_in(facing, setback)
    width = max(0, plot_w_in - e - w)
    depth = max(0, plot_d_in - n - s)
    return BuildableEnvelope(origin_x_in=w, origin_z_in=n, width_in=width, depth_in=depth)
