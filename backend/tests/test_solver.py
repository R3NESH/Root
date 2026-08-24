"""notes/build/step-2-solver-core.md — done when rooms never overlap and never exit the
envelope, across 20 random room mixes. This suite establishes notes/build/test-baseline.md.
"""

import random

from ortools.sat.python import cp_model

from solver.model import solve_layout
from solver.rooms import ROOM_CATALOG

ENV_W_IN = 360  # 30 ft, per the step-2 brief
ENV_D_IN = 480  # 40 ft

CATALOG_NAMES = sorted(ROOM_CATALOG)


def rectangles_overlap(a, b) -> bool:
    ax0, ay0, ax1, ay1 = a.x_in, a.y_in, a.x_in + a.w_in, a.y_in + a.d_in
    bx0, by0, bx1, by1 = b.x_in, b.y_in, b.x_in + b.w_in, b.y_in + b.d_in
    return ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1


def rooms_share_wall(a, b) -> bool:
    ax0, ax1 = a.x_in, a.x_in + a.w_in
    ay0, ay1 = a.y_in, a.y_in + a.d_in
    bx0, bx1 = b.x_in, b.x_in + b.w_in
    by0, by1 = b.y_in, b.y_in + b.d_in

    # Vertical touch
    if ax1 == bx0 or bx1 == ax0:
        if max(ay0, by0) < min(ay1, by1):
            return True
    # Horizontal touch
    if ay1 == by0 or by1 == ay0:
        if max(ax0, bx0) < min(ax1, bx1):
            return True
    return False


def assert_valid_layout(result, env_w_in: int, env_d_in: int) -> None:
    assert result.status in ("OPTIMAL", "FEASIBLE"), (
        f"solve failed with status={result.status}"
    )
    for room in result.rooms:
        assert room.x_in >= 0
        assert room.y_in >= 0
        assert room.x_in + room.w_in <= env_w_in, f"{room.name} exits envelope on X"
        assert room.y_in + room.d_in <= env_d_in, f"{room.name} exits envelope on Y"

    for i, a in enumerate(result.rooms):
        for b in result.rooms[i + 1 :]:
            assert not rectangles_overlap(a, b), f"{a.name} overlaps {b.name}"


def test_fixed_room_mix_fits():
    rooms = [ROOM_CATALOG[n] for n in ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms)
    assert_valid_layout(result, ENV_W_IN, ENV_D_IN)
    assert len(result.rooms) == len(rooms)


def test_duplicate_room_kinds_get_independent_positions():
    rooms = [ROOM_CATALOG["bedroom"], ROOM_CATALOG["bedroom"], ROOM_CATALOG["bathroom"]]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms)
    assert_valid_layout(result, ENV_W_IN, ENV_D_IN)
    positions = {(r.x_in, r.y_in) for r in result.rooms}
    assert len(positions) == len(rooms), "duplicate-named rooms collapsed onto one position"


def test_kitchen_and_bathroom_never_share_a_wall():
    rooms = [ROOM_CATALOG[n] for n in ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "pooja"]]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)
    assert_valid_layout(result, ENV_W_IN, ENV_D_IN)

    kitchen = next(r for r in result.rooms if r.name == "kitchen")
    bathroom = next(r for r in result.rooms if r.name == "bathroom")
    pooja = next(r for r in result.rooms if r.name == "pooja")

    assert not rooms_share_wall(kitchen, bathroom), "Kitchen and Bathroom must not share a wall"
    assert not rooms_share_wall(pooja, bathroom), "Pooja and Bathroom must not share a wall"


def test_20_random_room_mixes():
    rng = random.Random(42)
    failures = []

    for i in range(20):
        mix_size = rng.randint(4, 6)
        names = rng.choices(CATALOG_NAMES, k=mix_size)
        rooms = [ROOM_CATALOG[n] for n in names]
        result = solve_layout(ENV_W_IN, ENV_D_IN, rooms)
        try:
            assert_valid_layout(result, ENV_W_IN, ENV_D_IN)
        except AssertionError as e:
            failures.append(f"mix {i} {names}: {e}")

    assert not failures, "failed mixes:\n" + "\n".join(failures)


def test_envelope_domain_alone_blocks_escape():
    oversized = ROOM_CATALOG["hall"]
    huge = type(oversized)("huge", ENV_W_IN + 12, ENV_W_IN + 24, ENV_D_IN + 12, ENV_D_IN + 24)
    result = solve_layout(ENV_W_IN, ENV_D_IN, [huge])
    assert result.status not in ("OPTIMAL", "FEASIBLE")


def test_ortools_status_names_match_expectations():
    assert cp_model.CpSolver().status_name(cp_model.OPTIMAL) == "OPTIMAL"
    assert cp_model.CpSolver().status_name(cp_model.INFEASIBLE) == "INFEASIBLE"
