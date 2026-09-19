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
from solver.rooms import ROOM_CATALOG, Room

ENV_W_IN = 432  # 36 ft
ENV_D_IN = 600  # 50 ft

# Every kind the catalog holds, with the room counts a real programme would ask for.
FULL_HOUSE = [
    "hall", "dining", "kitchen",
    "bedroom", "bedroom", "bathroom", "bathroom",
    "utility", "store",
]


def _solve(mix, w=ENV_W_IN, d=ENV_D_IN, **kw):
    rooms = [ROOM_CATALOG[n] for n in mix]
    result = solve_layout(w, d, rooms, apply_zone_rules=True, **kw)
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
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "store"]
    rooms, result = _solve(mix, w=360, d=480)
    # This used to assert OPTIMAL, as a guard so the fill floor below could not silently become a
    # measurement of the time limit. COMPACT_WEIGHT (solver/realism.py) put this mix past the cold
    # budget: the footprint min/max variables couple every room to four globals and the proof no
    # longer closes in 2 s. The guard is kept in spirit by measurement instead. Five cold runs:
    #
    #   without the compactness term   fill/ceiling 100%     spread 0.0 pt   void 25%
    #   with it                        fill/ceiling 94-96%   spread 1.9 pt   void 5-7%
    #
    # A 1.9 point spread is the objective being measured, not the clock. The layout the term buys
    # is locked down separately by test_the_house_reads_as_one_building.
    assert result.status in ("OPTIMAL", "FEASIBLE"), result.status
    fill = sum(r.w_in * r.d_in for r in result.rooms) / (360 * 480)
    ceiling = catalog_fill_ceiling(rooms, 360, 480)
    # Against whichever ceiling is lower, the catalog's or the envelope's.
    #
    # This compared fill against the catalog ceiling alone, which was safe only while every room
    # maximum was small enough that six of them could not cover a 30x40 - the ceiling was 71% of
    # the envelope and the question "did we reach it" made sense. Once the maximums were raised
    # to what India builds at the top of the band, the ceiling for this mix is 105% of the
    # envelope, and no layout can reach a ceiling that is larger than the plot. The same solve
    # that fills 91% of the envelope - up from 65% before the maximums moved - scored 0.87
    # against it and failed.
    #
    # A house cannot fill more than the plot, so the reachable target is the lesser of the two.
    #
    # 0.85, not 0.90, and the drop is the denominator moving rather than the houses getting worse.
    # Raising the room maximums took this mix's ceiling from 71% of the envelope to 105%, so
    # `reachable` went from the ceiling to a flat 100% and the same solve now scores against a
    # larger number. In absolute terms the fill went the other way: 65% of the envelope before the
    # maximums moved, ~90% after.
    #
    # The remaining margin is the clock, not the objective. COMPACT_WEIGHT put this mix past the
    # cold budget, so it returns FEASIBLE and the fill varies run to run - measured here at 89.3%
    # to 91.3%, which straddled a 0.90 floor: six runs of this test alone all passed, and one run
    # in three of the whole module failed. A threshold inside the noise band measures the machine.
    reachable = min(ceiling, 1.0)
    assert fill / reachable >= 0.85, f"fill {fill:.1%} of a reachable {reachable:.1%}"


def test_the_house_reads_as_one_building():
    """No large void inside the building's own outline.

    Non-overlap, the adjacency tree and the daylight rule are all satisfied by a straggling L as
    well as by a tight rectangle, and the area objective scores the two identically because it
    counts room area and never looks at the gaps. Measured on a 40x60: two OPTIMAL layouts of the
    same rooms, 8% void and 28% void, the difference decided by nothing in the model. On screen
    the 28% one is a set of scattered pavilions rather than a house.

    The large plot is the case that matters. A 30x40 is tight enough that the rooms have nowhere
    to scatter to; slack is what exposes the gap.
    """
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]
    _rooms, result = _solve(mix, w=(40 - 6) * 12, d=(60 - 10) * 12)
    assert result.rooms

    fx0 = min(r.x_in for r in result.rooms)
    fx1 = max(r.x_in + r.w_in for r in result.rooms)
    fz0 = min(r.y_in for r in result.rooms)
    fz1 = max(r.y_in + r.d_in for r in result.rooms)
    bbox = (fx1 - fx0) * (fz1 - fz0)
    built = sum(r.w_in * r.d_in for r in result.rooms)
    void = 1 - built / bbox

    # A tripwire against the scattered layout, not a quality target. Six cold runs on this
    # scenario measured 3.4% to 15.5% void, against 27.6% with COMPACT_WEIGHT switched off. The
    # spread is real: these solves hit the cold budget and return FEASIBLE, so the incumbent
    # varies. 20% sits above the observed worst and well under the regression it guards.
    assert void <= 0.20, f"{void:.0%} of the footprint is void; the plan is scattered"


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
        result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_zone_rules=True)
        if result.status not in ("OPTIMAL", "FEASIBLE"):
            continue
        assert result.rooms_reachable == len(result.rooms), f"{mix} not walkable"
        for r in result.rooms:
            limit = ROOM_CATALOG[r.name].max_aspect_x10 / 10
            assert max(r.w_in / r.d_in, r.d_in / r.w_in) <= limit + 1e-6


def test_small_custom_dimensions_solve_without_inverting_ladder_bounds():
    # A custom room smaller than catalog minimum (e.g. 3x3 ft store vs 4x4 ft catalog min)
    # must not cause inverted CP-SAT domain bounds (min > max) on the relaxation ladder.
    store_custom = Room("store", 36, 36, 36, 36, habitable=False)
    mix = [ROOM_CATALOG["hall"], ROOM_CATALOG["kitchen"], ROOM_CATALOG["bedroom"], store_custom]
    result = solve_layout(ENV_W_IN, ENV_D_IN, mix, apply_zone_rules=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    placed_store = next(r for r in result.rooms if r.name == "store")
    assert placed_store.w_in == 36 and placed_store.d_in == 36


def test_entrance_foyer_receives_main_front_door():
    # When a dedicated entrance foyer is present, the front door should be placed on it.
    mix = ["entrance", "hall", "kitchen", "bedroom", "bathroom"]
    rooms = [ROOM_CATALOG[n] for n in mix]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_zone_rules=True)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    entrance_room = next(r for r in result.rooms if r.name == "entrance")
    assert any(o["kind"] == "entrance" for o in entrance_room.openings), (
        "dedicated entrance room should carry the front door opening"
    )



# --- requested pairs ------------------------------------------------------------------
#
# solver/realism.py near_terms(): "put the kitchen near that bedroom" is a taste, not a
# bye-law, so it is the one thing in this solver that is scored rather than constrained.

# This mix on the full envelope returns the same layout on every run, so the pair tests below
# compare two solves rather than two samples of a distribution.
NEAR_MIX = ["hall", "kitchen", "bedroom", "bathroom"]
NEAR_PAIR = (1, 2)  # kitchen <-> bedroom


def _centre_distance(a, b) -> float:
    """Manhattan distance between two placed rooms' centres, in inches."""
    return abs((a.x_in + a.w_in / 2) - (b.x_in + b.w_in / 2)) + abs(
        (a.y_in + a.d_in / 2) - (b.y_in + b.d_in / 2)
    )


def test_a_requested_pair_lands_closer_than_it_otherwise_would():
    """The invariant that says the pair term actually reaches the objective.

    Measured at 162 in apart unpaired and 132 in paired on this fixture; the weight sweep
    behind that number is in solver/realism.py.
    """
    _, loose = _solve(NEAR_MIX)
    _, pulled = _solve(NEAR_MIX, near=[NEAR_PAIR])
    i, j = NEAR_PAIR
    assert _centre_distance(pulled.rooms[i], pulled.rooms[j]) < _centre_distance(
        loose.rooms[i], loose.rooms[j]
    )


def test_a_requested_pair_costs_neither_a_rule_nor_reachability():
    """A preference may cost room area. It may not cost a rule or a door.

    A plan that breaks a posted rule is a rejected plan, not a worse one. The pair term sits in
    the objective precisely so that it can never trade one away, and this is the test that says
    so.
    """
    _, loose = _solve(NEAR_MIX)
    _, pulled = _solve(NEAR_MIX, near=[NEAR_PAIR])
    assert pulled.rules_applied == loose.rules_applied
    assert not pulled.rules_relaxed
    assert pulled.rooms_reachable == len(pulled.rooms)


def test_a_pair_naming_a_room_that_is_not_there_is_ignored():
    """Pairs arrive from a client. One bad pair is not a reason to refuse the house."""
    _, result = _solve(NEAR_MIX, near=[(0, 99), (3, 3), (-1, 2)])
    assert result.rooms_reachable == len(result.rooms)


# --- outdoor and service space --------------------------------------------------------
#
# sit-out, car porch and utility came back into the catalog on 2026-09-06 — solver/rooms.py.
# The first two are roofed and not walled, which is a property nothing in the solver had
# before and three separate places now have to respect.

OUTDOOR_MIX = ["hall", "kitchen", "bedroom", "bathroom", "utility", "sitout", "parking"]


def test_an_open_sided_room_owns_no_exterior_wall():
    """A sit-out with four walls is a room, and a car porch with four walls is a garage.

    Its partitions against the rooms behind it are real and stay. Only the outside faces go,
    which is also what keeps them out of the bill of quantities.
    """
    _, result = _solve(OUTDOOR_MIX)
    open_indices = {i for i, r in enumerate(result.rooms) if r.open_sided}
    assert open_indices, "fixture no longer contains an open-sided room"

    for wall in result.walls:
        if not wall.is_exterior:
            continue
        offenders = set(wall.room_indices) & open_indices
        assert not offenders, (
            f"exterior wall {wall.id} was emitted for open-sided room(s) "
            f"{[result.rooms[i].name for i in offenders]}"
        )


def test_an_open_sided_room_still_reaches_the_outside_of_the_building():
    """It has no windows to need, but a roofed porch behind four rooms is not a porch."""
    _, result = _solve(OUTDOOR_MIX)
    for room in result.rooms:
        if room.open_sided:
            assert _on_exterior(room, result.rooms), f"{room.name} is buried in the plan"


def test_the_car_porch_lands_on_the_street_edge():
    """A porch no car can reach is not a porch — programs/registry.py street_edge_spaces.

    The fixture faces north, so the street edge is the north face of the footprint.
    """
    _, result = _solve(OUTDOOR_MIX)
    _fx0, fz0, _fx1, _fz1 = footprint(result.rooms)
    porch = next(r for r in result.rooms if r.name == "parking")
    assert porch.y_in == fz0


def test_the_utility_opens_off_the_kitchen():
    """Not off the hall: that runs wet washing through the living room."""
    rooms, _ = _solve(OUTDOOR_MIX)
    parents = assign_parents(rooms)
    names = [r.name for r in rooms]
    assert parents[names.index("utility")] == names.index("kitchen")
