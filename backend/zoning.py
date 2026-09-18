"""Directional zone rules as CP-SAT constraints.

A programme may want a space in a particular part of the envelope — a cafe's queue near the
door, its wash-up at the back. The rule is posted as a constraint up front rather than scored
afterwards, because a layout that puts the wash-up in the shopfront is not a worse layout, it
is the wrong one.

programs/registry.py owns which rules a programme carries; this module only knows how to
express one. A programme with no zone rules posts none, which is the residence's case.

## Coordinate convention

Scene axes, matching frontend/lib/plot.ts: +X is East, +Z is South, origin at the plot's
North-West corner. So "south-east quadrant" means high X, high Z.

Rules are expressed as a preferred quadrant per space. A room satisfies its rule when its
CENTRE falls inside that quadrant — centre rather than corner, because a large room whose
corner clips the quadrant is not meaningfully "in the south-east".
"""

from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass(frozen=True)
class QuadrantRule:
    """Preferred quadrant for a room kind, as half-open fractions of the envelope.

    x_min_frac/x_max_frac and z_min_frac/z_max_frac are fractions in [0,1] of envelope width and
    depth. A rule spanning the full range on an axis (0..1) means that axis is unconstrained.
    """

    room_name: str
    x_min_frac: float
    x_max_frac: float
    z_min_frac: float
    z_max_frac: float
    description: str


def add_quadrant_constraint(
    model: cp_model.CpModel,
    rule: QuadrantRule,
    x: cp_model.IntVar,
    y: cp_model.IntVar,
    w: cp_model.IntVar,
    d: cp_model.IntVar,
    env_w_in: int,
    env_d_in: int,
) -> None:
    """Constrain the room's centre into the rule's quadrant.

    Centre is 2*x + w (i.e. twice the true centre) to stay in integers — CP-SAT is integer-only
    per notes/solver/cp-sat-gotchas.md, and halving would silently truncate.
    """
    x_lo = round(2 * rule.x_min_frac * env_w_in)
    x_hi = round(2 * rule.x_max_frac * env_w_in)
    z_lo = round(2 * rule.z_min_frac * env_d_in)
    z_hi = round(2 * rule.z_max_frac * env_d_in)

    if rule.x_min_frac > 0.0:
        model.add(2 * x + w >= x_lo)
    if rule.x_max_frac < 1.0:
        model.add(2 * x + w <= x_hi)
    if rule.z_min_frac > 0.0:
        model.add(2 * y + d >= z_lo)
    if rule.z_max_frac < 1.0:
        model.add(2 * y + d <= z_hi)


def satisfied(rule: QuadrantRule, x_in: int, y_in: int, w_in: int, d_in: int, env_w_in: int, env_d_in: int) -> bool:
    """Verification-side mirror of the constraint above, for tests and diagnostics."""
    cx2 = 2 * x_in + w_in
    cz2 = 2 * y_in + d_in
    return (
        cx2 >= round(2 * rule.x_min_frac * env_w_in)
        and cx2 <= round(2 * rule.x_max_frac * env_w_in)
        and cz2 >= round(2 * rule.z_min_frac * env_d_in)
        and cz2 <= round(2 * rule.z_max_frac * env_d_in)
    )
