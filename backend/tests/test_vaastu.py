"""notes/build/step-5-vaastu.md — Vaastu as constraints, verified on the placed output."""

from solver.model import solve_layout
from solver.rooms import ROOM_CATALOG
from vaastu.rules import V1_RULES, applies_to, satisfied

ENV_W_IN = 360
ENV_D_IN = 480

MIX = ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "pooja"]


def test_vaastu_rules_hold_in_the_output():
    rooms = [ROOM_CATALOG[n] for n in MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")

    # Only the first room of each ruled kind is constrained — the master-bedroom carve-out.
    seen: set[str] = set()
    for placed in result.rooms:
        rule = applies_to(placed.name)
        if rule is None or placed.name in seen:
            continue
        seen.add(placed.name)
        assert satisfied(rule, placed.x_in, placed.y_in, placed.w_in, placed.d_in, ENV_W_IN, ENV_D_IN), (
            f"{placed.name} violates '{rule.description}' at x={placed.x_in} y={placed.y_in}"
        )


def test_vaastu_constraints_are_reported():
    rooms = [ROOM_CATALOG[n] for n in MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    # kitchen, bedroom, pooja all appear in MIX and all have v1 rules.
    assert len(result.vaastu_constraints_applied) == 3
    assert any("south-east" in d for d in result.vaastu_constraints_applied)
    assert any("south-west" in d for d in result.vaastu_constraints_applied)
    assert any("north-east" in d for d in result.vaastu_constraints_applied)


def test_vaastu_off_by_default():
    rooms = [ROOM_CATALOG[n] for n in MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms)
    assert result.vaastu_constraints_applied == []


def test_only_first_bedroom_is_constrained():
    # Two bedrooms, both SW-constrained, would over-constrain for no Vaastu reason.
    rooms = [ROOM_CATALOG["bedroom"], ROOM_CATALOG["bedroom"]]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert len(result.vaastu_constraints_applied) == 1

    rule = V1_RULES["bedroom"]
    in_sw = [
        satisfied(rule, r.x_in, r.y_in, r.w_in, r.d_in, ENV_W_IN, ENV_D_IN) for r in result.rooms
    ]
    assert sum(in_sw) >= 1, "no bedroom landed in the south-west"


def test_vaastu_still_places_all_rooms():
    rooms = [ROOM_CATALOG[n] for n in MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert len(result.rooms) == len(rooms)
