"""notes/solver/realism-gaps.md — the constraints that make the packing a plausible house.

The suite up to here proved the output was *legal*: no overlaps, inside the envelope, every
room reachable. None of it stopped a 5 ft x 16 ft bedroom, a windowless bedroom in the middle
of the plan, or a house covering 40% of the plot. These are those invariants.
"""

import random

from solver.connectivity import (
    EXTERIOR_WALL_IN,
    INTERIOR_WALL_IN,
    assign_parents,
    footprint,
)
from solver.model import solve_layout
from solver.realism import catalog_fill_ceiling
from solver.rooms import ROOM_CATALOG

ENV_W_IN = 432  # 36 ft
ENV_D_IN = 600  # 50 ft

# Every kind the catalog holds, with the room counts a real programme would ask for.
FULL_HOUSE = [
    "hall", "dining", "kitchen",
    "bedroom", "bedroom", "bathroom", "bathroom",
    "pooja", "store",
]


def _solve(mix, w=ENV_W_IN, d=ENV_D_IN, **kw):
    rooms = [ROOM_CATALOG[n] for n in mix]
    result = solve_layout(w, d, rooms, apply_vaastu=True, **kw)
    assert result.status in ("OPTIMAL", "FEASIBLE"), f"{mix} -> {result.status}"
    return rooms, result


def _on_exterior(r, rooms) -> bool:
    # Against the built footprint, not the plot — the house does not fill its envelope.
    fx0, fz0, fx1, fz1 = footprint(rooms)
    return (
        r.x_in == fx0
        or r.y_in == fz0
        or r.x_in + r.w_in == fx1
        or r.y_in + r.d_in == fz1
    )


def test_a_full_indian_house_solves():
    # Nine rooms covering every kind in the catalog. If this cannot be placed, the vocabulary
    # is decorative.
    _, result = _solve(FULL_HOUSE)
    assert len(result.rooms) == len(FULL_HOUSE)
    assert result.rooms_reachable == len(result.rooms)


def test_habitable_and_wet_rooms_reach_an_exterior_wall():
    # A bedroom with no outside wall has no light, no ventilation and no openable area.
    _, result = _solve(FULL_HOUSE)
    for r in result.rooms:
        spec = ROOM_CATALOG[r.name]
        if not (spec.habitable or spec.wet):
            continue
        assert _on_exterior(r, result.rooms), f"{r.name} at ({r.x_in},{r.y_in}) has no exterior wall"


def test_rooms_are_not_absurdly_elongated():
    _, result = _solve(FULL_HOUSE)
    for r in result.rooms:
        limit = ROOM_CATALOG[r.name].max_aspect_x10 / 10
        ratio = max(r.w_in / r.d_in, r.d_in / r.w_in)
        assert ratio <= limit + 1e-6, f"{r.name} is {ratio:.2f}:1, limit {limit}:1"


def test_the_house_fills_most_of_what_the_catalog_allows():
    # Not "fills the plot" — six rooms at their maximums cannot cover a 30x40, so comparing
    # against 100% is meaningless. The honest target is the catalog ceiling.
    #
    # Measured before the area objective existed: 43.7% of a 30x40 envelope against a 66.2%
    # ceiling, i.e. two-thirds of what was reachable, because nothing rewarded a larger room.
    #
    # Deliberately the standard six-room mix rather than FULL_HOUSE: a large programme can run
    # out the cold budget and return FEASIBLE, so its fill varies run to run and the assertion
    # would be measuring the time limit rather than the objective.
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "pooja"]
    rooms, result = _solve(mix, w=360, d=480)
    assert result.status == "OPTIMAL", "this mix should solve to optimality inside the budget"
    fill = sum(r.w_in * r.d_in for r in result.rooms) / (360 * 480)
    ceiling = catalog_fill_ceiling(rooms, 360, 480)
    # Measured across four mixes on two plot sizes: seven of eight reach the ceiling exactly.
    # This one lands at 92% because the pooja room's north-east rule and a tight 30x40 cannot
    # both be satisfied at full size. 90% is the floor, not the target.
    assert fill / ceiling >= 0.90, f"fill {fill:.1%} of a {ceiling:.1%} ceiling"


def test_second_bathroom_is_an_ensuite_off_the_master_bedroom():
    # The standard Indian 2BHK: master gets an attached bath, the second bath stays common.
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "bathroom"]
    rooms = [ROOM_CATALOG[n] for n in mix]
    parents = assign_parents(rooms)
    assert rooms[parents[4]].name == "bedroom", "first bathroom should open off a bedroom"

    _, result = _solve(mix)
    ensuite_doors = [o for o in result.rooms[4].openings if o["to_room"] == 2]
    assert ensuite_doors, "ensuite has no door to the master bedroom"


def test_a_lone_bathroom_stays_common():
    # One bathroom behind a bedroom door would leave guests with nowhere to go.
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]
    rooms = [ROOM_CATALOG[n] for n in mix]
    parents = assign_parents(rooms)
    assert rooms[parents[4]].name == "hall"


def test_store_opens_off_the_kitchen_not_the_living_room():
    # A store is a pantry off the kitchen, not a cupboard people cross the hall to reach.
    mix = ["hall", "kitchen", "store", "bedroom"]
    rooms = [ROOM_CATALOG[n] for n in mix]
    parents = assign_parents(rooms)
    assert rooms[parents[2]].name == "kitchen"


def test_every_room_gets_a_window_or_a_vent_where_it_can():
    _, result = _solve(FULL_HOUSE)
    for r in result.rooms:
        if not _on_exterior(r, result.rooms):
            continue
        spec = ROOM_CATALOG[r.name]
        if not (spec.habitable or spec.wet):
            continue
        assert any(o["kind"] == "window" for o in r.openings), f"{r.name} has no window"


def test_perimeter_rooms_carry_the_load_bearing_wall():
    # 9 in outside, 4.5 in partitions — the Indian brick convention.
    _, result = _solve(FULL_HOUSE)
    for r in result.rooms:
        expected = EXTERIOR_WALL_IN if _on_exterior(r, result.rooms) else INTERIOR_WALL_IN
        assert r.wall_thickness_in == expected, f"{r.name} wall {r.wall_thickness_in}"


def test_the_house_has_exactly_one_front_door():
    _, result = _solve(FULL_HOUSE)
    entrances = [o for r in result.rooms for o in r.openings if o["kind"] == "entrance"]
    assert len(entrances) == 1
    assert result.entrance_edge in ("N", "S", "E", "W")


def test_realistic_mixes_stay_reachable_and_proportioned():
    # The step-2 done-condition, re-run over the enlarged vocabulary and the new invariants.
    rng = random.Random(42)
    kinds = [k for k in ROOM_CATALOG if k != "hall"]
    for _ in range(12):
        mix = ["hall"] + [rng.choice(kinds) for _ in range(rng.randint(4, 7))]
        rooms = [ROOM_CATALOG[n] for n in mix]
        result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
        if result.status not in ("OPTIMAL", "FEASIBLE"):
            continue
        assert result.rooms_reachable == len(result.rooms), f"{mix} not walkable"
        for r in result.rooms:
            limit = ROOM_CATALOG[r.name].max_aspect_x10 / 10
            assert max(r.w_in / r.d_in, r.d_in / r.w_in) <= limit + 1e-6
