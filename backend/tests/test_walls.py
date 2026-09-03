"""Walls are objects, and the bill of quantities is counted off them.

The claim under test is the one that made this module necessary: a partition between two rooms is
**one wall**, not one per room. Everything downstream — brick, plaster, the door schedule — is
wrong by a factor if that is not true.
"""

import pytest

from solver.connectivity import EXTERIOR_WALL_IN, INTERIOR_WALL_IN
from solver.model import solve_layout
from solver.quantities import MODULAR_BRICK, TRADITIONAL_BRICK, take_off
from solver.rooms import ROOM_CATALOG
from solver.walls import WALL_HEIGHT_IN, derive_walls

ENV_W_IN = 24 * 12
ENV_D_IN = 30 * 12
MIX = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]


@pytest.fixture(scope="module")
def solved():
    result = solve_layout(
        ENV_W_IN, ENV_D_IN, [ROOM_CATALOG[n] for n in MIX], apply_vaastu=True
    )
    assert result.rooms, result.status
    return result


def test_a_partition_is_one_wall_not_two(solved):
    """The bug this module exists to fix. Two rooms sharing a wall used to draw one each."""
    partitions = [w for w in solved.walls if not w.is_exterior]
    assert partitions, "a five-room plan has partitions"

    for w in partitions:
        assert len(w.room_indices) == 2, f"{w.id} is shared but names {w.room_indices}"

    # No two walls occupy the same line and span.
    footprints = [(w.x0_in, w.y0_in, w.x1_in, w.y1_in) for w in solved.walls]
    assert len(footprints) == len(set(footprints))


def test_thickness_follows_what_is_on_the_other_side(solved):
    """9 in load-bearing outside, 4.5 in partitions inside — the Indian brick convention."""
    for w in solved.walls:
        expected = EXTERIOR_WALL_IN if w.is_exterior else INTERIOR_WALL_IN
        assert w.thickness_in == expected, f"{w.id}"
        assert w.height_in == WALL_HEIGHT_IN


def test_every_room_edge_is_covered_by_walls(solved):
    """No room has a side with no wall on it, whatever the neighbours look like."""
    for i, room in enumerate(solved.rooms):
        for edge in ("N", "S", "E", "W"):
            covering = sum(
                w.length_in
                for w in solved.walls
                if i in w.room_indices and _wall_is_on(w, room, edge)
            )
            expected = room.w_in if edge in ("N", "S") else room.d_in
            assert covering == expected, f"room {i} {edge}: {covering} of {expected} in walled"


def _wall_is_on(wall, room, edge: str) -> bool:
    if edge in ("N", "S"):
        if wall.y0_in != wall.y1_in:
            return False
        line = room.y_in if edge == "N" else room.y_in + room.d_in
        return wall.y0_in == line and min(wall.x0_in, wall.x1_in) >= room.x_in \
            and max(wall.x0_in, wall.x1_in) <= room.x_in + room.w_in
    if wall.x0_in != wall.x1_in:
        return False
    line = room.x_in if edge == "W" else room.x_in + room.w_in
    return wall.x0_in == line and min(wall.y0_in, wall.y1_in) >= room.y_in \
        and max(wall.y0_in, wall.y1_in) <= room.y_in + room.d_in


def test_a_shared_door_is_hosted_once(solved):
    """derive_openings() mirrors a door onto both rooms. A bill of quantities must not."""
    mirrored = sum(len(r.openings) for r in solved.rooms)
    hosted = sum(len(w.openings) for w in solved.walls)
    doors_between_rooms = sum(
        1 for r in solved.rooms for o in r.openings if o["kind"] == "door"
    )
    # Every interior door appears twice across rooms and once on its wall.
    assert hosted == mirrored - doors_between_rooms // 2
    assert hosted < mirrored


def test_no_opening_is_wider_than_the_wall_holding_it(solved):
    for w in solved.walls:
        for o in w.openings:
            assert o["width_in"] <= w.length_in, f"{w.id} holds a {o['width_in']} in opening"


def test_the_brick_method_reproduces_the_published_figure():
    """Bricks are counted from brick-plus-joint, not from a magic constant.

    IS 1077 modular at a 10 mm joint is 200 x 100 x 100 mm laid, so exactly 500 fit a cubic
    metre — which is the figure BIS publishes. Deriving it is what makes the traditional-brick
    number trustworthy too.
    """
    assert MODULAR_BRICK.per_cubic_metre == pytest.approx(500.0, abs=0.5)
    assert TRADITIONAL_BRICK.per_cubic_metre == pytest.approx(434.0, abs=1.0)


def test_mortar_is_the_brick_void_fraction(solved):
    """Mortar is what is left of the masonry once the bricks are in it, not a percentage."""
    q = take_off(solved.rooms, solved.walls, brick=TRADITIONAL_BRICK)
    solid_fraction = (230 * 110 * 70) / (240 * 120 * 80)
    expected_mortar = q.masonry_volume_cuft * (1 - solid_fraction)
    assert q.mortar_volume_cuft == pytest.approx(expected_mortar, rel=0.02)


def test_built_up_is_carpet_plus_the_walls(solved):
    q = solved.quantities
    assert q is not None
    assert q.built_up_area_sqft == pytest.approx(
        q.carpet_area_sqft + q.wall_footprint_sqft, abs=0.2
    )
    assert q.carpet_area_sqft > 0
    assert q.built_up_area_sqft > q.carpet_area_sqft


def test_openings_are_deducted_from_the_masonry(solved):
    q = solved.quantities
    assert q.opening_area_sqft > 0, "a house has doors"
    assert q.wall_net_area_sqft == pytest.approx(
        q.wall_gross_area_sqft - q.opening_area_sqft, abs=0.2
    )


def test_the_schedule_counts_every_hosted_opening(solved):
    q = solved.quantities
    scheduled = sum(o.count for o in q.openings)
    hosted = sum(len(w.openings) for w in solved.walls)
    assert scheduled == hosted
    assert any(o.kind == "entrance" for o in q.openings), "the house has a front door"


def test_quantities_carry_no_prices(solved):
    """Rates move by district and by month. A number invented here would be believed."""
    fields = solved.quantities.__dataclass_fields__
    for banned in ("cost", "rate", "price", "total_inr", "rupees"):
        assert not any(banned in f for f in fields), f"{banned} leaked into the take-off"


def test_walls_are_derived_for_a_cafe_too():
    """Nothing here is keyed on room names, so a second programme needs no new code."""
    from programs import CAFE

    mix = ["entry", "queue", "counter", "seating", "prep", "pantry", "washroom"]
    result = solve_layout(
        ENV_W_IN, ENV_D_IN, [ROOM_CATALOG[n] for n in mix],
        apply_vaastu=True, program=CAFE, facing="N",
    )
    assert result.rooms
    assert result.walls
    assert result.quantities.brick_count > 0
    assert all(len(w.room_indices) in (1, 2) for w in result.walls)
