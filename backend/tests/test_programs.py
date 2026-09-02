"""The engine packs more than one building type — backend/programs/registry.py.

What these lock down is the claim the programme pack makes: a cafe is not a house with the
labels swapped. Its back of house sits behind its front of house, its door is on the road
whichever way the plot faces, a customer WC never opens into food prep, and it never reports a
Vaastu rule it did not post.
"""

import pytest

from programs import CAFE, PROGRAMS, RESIDENTIAL, get_program, resolve_rules
from solver.connectivity import hub_index
from solver.model import (
    INTERACTIVE_TIME_CEILING_SECONDS,
    INTERACTIVE_TIME_LIMIT_SECONDS,
    interactive_budget,
    solve_layout,
)
from solver.rooms import ROOM_CATALOG

# The buildable envelope of a 30x40 ft plot at the default setbacks: 24x30 ft, 720 sq ft. The
# trade figure for a small cafe is 600-900 sq ft, so this is the real target, not a fixture.
ENV_W_IN = 24 * 12
ENV_D_IN = 30 * 12

FRONT_SPACES = ("entry", "queue", "seating")
BACK_SPACES = ("prep", "pantry", "wash", "staff")


def cafe_mix(names=None):
    return [ROOM_CATALOG[n] for n in (names or CAFE.default_mix)]


def solve_cafe(facing="N", names=None, **kw):
    return solve_layout(
        ENV_W_IN, ENV_D_IN, cafe_mix(names), apply_vaastu=True, program=CAFE, facing=facing, **kw
    )


def depth_from_street(room, facing: str) -> float:
    """Centre of the room measured inward from the street edge, in inches."""
    cx = room.x_in + room.w_in / 2
    cz = room.y_in + room.d_in / 2
    if facing == "N":
        return cz
    if facing == "S":
        return ENV_D_IN - cz
    if facing == "E":
        return ENV_W_IN - cx
    return cx  # "W"


def share_a_wall(a, b) -> bool:
    """Do these two rectangles touch along an edge with more than a hairline of overlap?"""
    x_touch = a.x_in + a.w_in == b.x_in or b.x_in + b.w_in == a.x_in
    z_touch = a.y_in + a.d_in == b.y_in or b.y_in + b.d_in == a.y_in
    z_overlap = min(a.y_in + a.d_in, b.y_in + b.d_in) - max(a.y_in, b.y_in)
    x_overlap = min(a.x_in + a.w_in, b.x_in + b.w_in) - max(a.x_in, b.x_in)
    return (x_touch and z_overlap > 0) or (z_touch and x_overlap > 0)


def test_cafe_default_mix_solves_on_a_small_shop_envelope():
    result = solve_cafe()
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert len(result.rooms) == len(CAFE.default_mix)


def test_every_cafe_space_is_reachable():
    """Connectivity is never dropped, whatever the building type."""
    result = solve_cafe()
    assert result.rooms_reachable == len(result.rooms)


@pytest.mark.parametrize("facing", ["N", "S", "E", "W"])
def test_back_of_house_sits_behind_front_of_house(facing):
    result = solve_cafe(facing=facing, names=("entry", "queue", "counter", "seating", "prep", "pantry", "washroom"))
    assert result.status in ("OPTIMAL", "FEASIBLE")

    by_name = {r.name: r for r in result.rooms}
    deepest_front = max(depth_from_street(by_name[n], facing) for n in FRONT_SPACES if n in by_name)
    shallowest_back = min(depth_from_street(by_name[n], facing) for n in BACK_SPACES if n in by_name)
    assert shallowest_back > deepest_front, (
        f"{facing}: kitchen at {shallowest_back} in is not behind the seating at {deepest_front} in"
    )


@pytest.mark.parametrize("facing", ["N", "S", "E", "W"])
def test_the_door_is_on_the_street(facing):
    """A shop opens onto the road. A house follows Vaastu instead — see the residence test."""
    result = solve_cafe(facing=facing)
    assert result.entrance_edge == facing


@pytest.mark.parametrize("facing", ["N", "S", "E", "W"])
def test_the_entry_reaches_the_shopfront(facing):
    """Not merely "in the front band" — its near edge is on the building's street face."""
    result = solve_cafe(facing=facing)
    entry = next(r for r in result.rooms if r.name == "entry")
    fx0 = min(r.x_in for r in result.rooms)
    fx1 = max(r.x_in + r.w_in for r in result.rooms)
    fz0 = min(r.y_in for r in result.rooms)
    fz1 = max(r.y_in + r.d_in for r in result.rooms)
    on_street = {
        "N": entry.y_in == fz0,
        "S": entry.y_in + entry.d_in == fz1,
        "E": entry.x_in + entry.w_in == fx1,
        "W": entry.x_in == fx0,
    }
    assert on_street[facing]


def test_a_customer_wc_never_opens_onto_food_prep():
    result = solve_cafe(names=("entry", "queue", "counter", "seating", "prep", "pantry", "washroom"))
    by_name = {r.name: r for r in result.rooms}
    assert not share_a_wall(by_name["washroom"], by_name["prep"])
    assert not share_a_wall(by_name["washroom"], by_name["pantry"])


def test_a_cafe_never_claims_vaastu():
    """A plan that breaks Vaastu is a rejected plan, so a plan that never checked it must not
    report it as applied — notes/decisions/vaastu-as-constraints.md."""
    result = solve_cafe()
    assert result.program == "cafe"
    assert result.rules_label == "Service flow"
    for description in result.vaastu_constraints_applied:
        assert "south-east" not in description
        assert "north-east" not in description


def test_the_seating_floor_is_the_circulation_hub():
    rooms = cafe_mix()
    assert rooms[hub_index(rooms, CAFE)].name == "seating"


def test_residence_is_untouched_by_the_programme_split():
    rooms = [ROOM_CATALOG[n] for n in RESIDENTIAL.default_mix]
    assert rooms[hub_index(rooms, RESIDENTIAL)].name == "hall"

    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.program == "residence"
    assert result.rules_label == "Vaastu"
    assert result.rooms_reachable == len(result.rooms)


def test_residence_rules_ignore_facing_and_cafe_rules_follow_it():
    """Vaastu is about the sun, service flow is about the road."""
    assert resolve_rules(RESIDENTIAL, "N") == resolve_rules(RESIDENTIAL, "S")
    assert resolve_rules(CAFE, "N") != resolve_rules(CAFE, "S")


def test_unknown_programme_falls_back_to_the_residence():
    assert get_program(None) is RESIDENTIAL
    assert get_program("") is RESIDENTIAL
    assert get_program("hospital") is RESIDENTIAL
    assert get_program("cafe") is CAFE


def test_every_programme_space_exists_in_the_catalog():
    """The catalog is one vocabulary; a programme only selects from it."""
    for program in PROGRAMS.values():
        for space in program.spaces:
            assert space in ROOM_CATALOG, f"{program.key} offers unknown space {space}"
        for space in program.default_mix:
            assert space in program.spaces
        assert program.hub in program.spaces
        assert program.entrance_space in program.spaces


# --------------------------------------------------------------------------------------
# The interactive budget, which a cafe programme is the first thing big enough to exhaust.
# --------------------------------------------------------------------------------------

# The 40x60 "Cafe Restaurant" plan from frontend/lib/cafeBlueprints.ts: eleven spaces, which is
# the largest the catalogue ships.
BIG_CAFE_MIX = (
    "entry",
    "queue",
    "seating",
    "lounge",
    "counter",
    "washroom",
    "washroom",
    "prep",
    "wash",
    "staff",
    "pantry",
)


def test_interactive_budget_grows_with_the_programme():
    """A flat 0.4 s was tuned on a six-room house and starves anything larger."""
    assert interactive_budget(5) == INTERACTIVE_TIME_LIMIT_SECONDS
    assert interactive_budget(6) == INTERACTIVE_TIME_LIMIT_SECONDS
    assert interactive_budget(11) > INTERACTIVE_TIME_LIMIT_SECONDS
    assert interactive_budget(50) == INTERACTIVE_TIME_CEILING_SECONDS


def test_a_large_cafe_still_returns_a_layout_when_edited():
    """Regression: with `prev` supplied, an eleven-space cafe returned UNKNOWN in 429 ms and the
    UI drew nothing. Applying any blueprint supplies `prev`, so this was every large plan in the
    catalogue, not an edge case."""
    rooms = [ROOM_CATALOG[n] for n in BIG_CAFE_MIX]
    env_w, env_d = 34 * 12, 50 * 12
    prev = {i: (0, i * 12) for i in range(len(rooms))}

    result = solve_layout(
        env_w, env_d, rooms, prev=prev, apply_vaastu=True, program=CAFE, facing="N"
    )
    assert result.status in ("OPTIMAL", "FEASIBLE"), result.status
    assert result.rooms_reachable == len(result.rooms)
