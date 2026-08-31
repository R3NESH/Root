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


BIG_MIX = [
    "hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom",
    "bathroom", "bathroom", "pooja", "store",
]


# A 1BHK that fits the plot geometrically but not with the quadrants applied. Found by sweeping
# envelopes 150-340 in on both axes: 111 of them come back with a layout and no rule posted.
RELAXING_MIX = ["hall", "kitchen", "bedroom"]
RELAXING_W_IN, RELAXING_D_IN = 260, 220


def test_a_dropped_rule_set_is_declared():
    """The ladder's Vaastu rung is reachable on an ordinary plot, and must be visible.

    `solve_layout()` walks a relaxation ladder, and rung 4 drops Vaastu. That is sanctioned
    (CLAUDE.md: the ladder may drop Vaastu, daylight, area — never connectivity). What is not
    sanctioned is dropping it quietly: a plan that breaks Vaastu is a rejected plan, not a worse
    one (notes/decisions/vaastu-as-constraints.md), and the market note the product rests on is
    notes/market/vaastu-is-mandatory-demand.md.

    This is not an exotic case. A hall, a kitchen and a bedroom on a 260x220 in buildable
    envelope — a 1BHK on a small plot, the most ordinary program there is — returns
    **status OPTIMAL** with zero rules posted. Before `vaastu_relaxed`, nothing in the response
    distinguished that from a fully compliant plan.
    """
    rooms = [ROOM_CATALOG[n] for n in RELAXING_MIX]
    result = solve_layout(RELAXING_W_IN, RELAXING_D_IN, rooms, apply_vaastu=True)

    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.rooms, "this envelope does fit the program once Vaastu is dropped"
    assert result.vaastu_constraints_applied == [], (
        "fixture no longer exercises the Vaastu rung — pick another envelope"
    )
    assert result.vaastu_relaxed is True, "Vaastu was dropped and the result did not say so"


def test_the_same_mix_that_fits_declares_nothing():
    """Give the identical program room to breathe and the flag must clear."""
    rooms = [ROOM_CATALOG[n] for n in RELAXING_MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.vaastu_constraints_applied, "a roomy envelope should post the rules"
    assert result.vaastu_relaxed is False


def test_relaxation_flag_never_contradicts_the_rule_list():
    """Across budgets tight enough to make every ladder outcome appear, the two must agree.

    A solve that merely ran out of clock returns UNKNOWN, which is indistinguishable from
    INFEASIBLE where the ladder tests it — so a starved run can descend. Asserting *that* it
    descends would be asserting a race; this asserts the invariant instead.
    """
    import solver.model as model

    rooms = [ROOM_CATALOG[n] for n in BIG_MIX]
    base = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert base.status in ("OPTIMAL", "FEASIBLE")
    assert base.vaastu_relaxed is False

    prev = {i: (r.x_in, r.y_in) for i, r in enumerate(base.rooms)}
    original = model.INTERACTIVE_TIME_LIMIT_SECONDS
    try:
        for budget in (0.4, 0.05, 0.02, 0.01):
            model.INTERACTIVE_TIME_LIMIT_SECONDS = budget
            r = solve_layout(ENV_W_IN, ENV_D_IN, rooms, prev=prev, apply_vaastu=True)
            if not r.rooms:
                # Out of time with nothing to show. Honest, and it claims nothing.
                assert r.vaastu_relaxed is False
                continue
            assert r.vaastu_relaxed == (not r.vaastu_constraints_applied), (
                f"budget {budget}s: relaxed={r.vaastu_relaxed} but "
                f"rules={r.vaastu_constraints_applied}"
            )
    finally:
        model.INTERACTIVE_TIME_LIMIT_SECONDS = original


def test_no_ruled_rooms_is_not_a_relaxed_solve():
    """An empty rule list is only a relaxation when there was a rule to drop."""
    rooms = [ROOM_CATALOG[n] for n in ("hall", "bathroom")]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.vaastu_constraints_applied == []
    assert result.vaastu_relaxed is False


def test_a_dragged_room_alone_is_not_a_relaxed_solve():
    """Releasing the dragged room from its quadrant is deliberate, not a relaxation."""
    rooms = [ROOM_CATALOG[n] for n in ("hall", "kitchen")]
    base = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    prev = {i: (r.x_in, r.y_in) for i, r in enumerate(base.rooms)}
    kitchen = next(i for i, r in enumerate(rooms) if r.name == "kitchen")

    moved = solve_layout(
        ENV_W_IN, ENV_D_IN, rooms, prev=prev, apply_vaastu=True, moved_index=kitchen
    )
    assert moved.status in ("OPTIMAL", "FEASIBLE")
    assert moved.vaastu_constraints_applied == []
    assert moved.vaastu_relaxed is False
