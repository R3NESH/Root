"""Vaastu direction rules as CP-SAT constraints — notes/build/step-5-vaastu.md.

notes/decisions/vaastu-as-constraints.md: constrain up front, never place-then-score. A plan that
violates Vaastu is not a worse plan, it is a rejected plan (notes/market/vaastu-is-mandatory-demand.md).

v1 rule set: kitchen SE, master bedroom SW, pooja NE. Deliberately small — see
notes/open-questions/q-competitor-defects.md, which may reveal that correct Vaastu placement is a
lookup table and no moat at all.

NOT IMPLEMENTED: "entrance N/E", named in the step-5 brief. There is no entrance in the model —
doors live in `openings`, which is still empty per notes/architecture/output-schema.md. This rule
has to wait for openings to exist; it is not silently satisfied by anything below.

MASTER bedroom only: the SW rule applies to the FIRST bedroom in the room list, not every
bedroom. Constraining two bedrooms into the same half-plane over-constrains the model for no
Vaastu reason — see apply_rules() in solver/model.py.

## Coordinate convention

Scene axes, matching frontend/lib/plot.ts: +X is East, +Z is South, origin at the plot's
North-West corner. So "south-east quadrant" means high X, high Z.

Rules are expressed as a preferred quadrant per room kind. A room satisfies its rule when its
CENTRE falls inside that quadrant — centre rather than corner, because a large room whose corner
clips the quadrant is not meaningfully "in the south-east".
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


# Half-plane rules rather than tight quadrant boxes: on a small plot a strict quadrant makes the
# model infeasible fast, and the Vaastu requirement is directional, not metric.
V1_RULES: dict[str, QuadrantRule] = {
    "kitchen": QuadrantRule("kitchen", 0.5, 1.0, 0.5, 1.0, "kitchen in the south-east"),
    "bedroom": QuadrantRule("bedroom", 0.0, 0.5, 0.5, 1.0, "master bedroom in the south-west"),
    "pooja": QuadrantRule("pooja", 0.5, 1.0, 0.0, 0.5, "pooja room in the north-east"),
}


def applies_to(room_name: str) -> QuadrantRule | None:
    return V1_RULES.get(room_name)


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
