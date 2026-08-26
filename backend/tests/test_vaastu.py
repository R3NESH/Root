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


# --------------------------------------------------------------------------------------
# notes/solver/vaastu-and-connectivity-drop-on-edit.md — the invariants the suite was missing.
# Every test above solves from scratch. The regression lived entirely in the `prev` path.
# --------------------------------------------------------------------------------------


def _first_solve():
    rooms = [ROOM_CATALOG[n] for n in MIX]
    base = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert base.status in ("OPTIMAL", "FEASIBLE")
    return rooms, base, {i: (r.x_in, r.y_in) for i, r in enumerate(base.rooms)}


def _assert_rules_hold(result, exempt_name: str | None = None):
    seen: set[str] = set()
    for placed in result.rooms:
        rule = applies_to(placed.name)
        if rule is None or placed.name in seen:
            continue
        seen.add(placed.name)
        if placed.name == exempt_name:
            continue
        assert satisfied(
            rule, placed.x_in, placed.y_in, placed.w_in, placed.d_in, ENV_W_IN, ENV_D_IN
        ), f"{placed.name} violates '{rule.description}' at x={placed.x_in} y={placed.y_in}"


def test_vaastu_still_holds_when_prev_is_supplied():
    # The regression: passing `prev` dropped every Vaastu rule, so an edit silently produced a
    # non-compliant plan the UI still advertised as compliant.
    rooms, _, prev = _first_solve()
    edited = solve_layout(ENV_W_IN, ENV_D_IN, rooms, prev=prev, apply_vaastu=True)
    assert edited.status in ("OPTIMAL", "FEASIBLE")
    assert len(edited.vaastu_constraints_applied) == 3
    _assert_rules_hold(edited)


def test_rooms_stay_reachable_when_prev_is_supplied():
    # Same regression, second casualty: hub connectivity was dropped with Vaastu, and
    # reachability fell from 6/6 to 2/6 on the first edit.
    rooms, base, prev = _first_solve()
    assert base.rooms_reachable == len(base.rooms)
    edited = solve_layout(ENV_W_IN, ENV_D_IN, rooms, prev=prev, apply_vaastu=True)
    assert edited.rooms_reachable == len(edited.rooms), (
        f"only {edited.rooms_reachable} of {len(edited.rooms)} rooms reachable after an edit"
    )


def test_only_the_dragged_room_is_released_from_its_quadrant():
    # Dragging must free the dragged room and nothing else. MIX index 1 is the kitchen.
    rooms, _, prev = _first_solve()
    dragged = dict(prev)
    dragged[1] = (0, 0)  # north-west corner — the opposite of the kitchen's SE rule

    result = solve_layout(
        ENV_W_IN, ENV_D_IN, rooms, prev=dragged, apply_vaastu=True, moved_index=1
    )
    assert result.status in ("OPTIMAL", "FEASIBLE")

    # The kitchen's rule is gone from the report; the other two remain and still hold.
    assert not any("south-east" in d for d in result.vaastu_constraints_applied)
    assert len(result.vaastu_constraints_applied) == 2
    _assert_rules_hold(result, exempt_name="kitchen")

    # Releasing a quadrant must not release the house: it is still walkable.
    assert result.rooms_reachable == len(result.rooms)
