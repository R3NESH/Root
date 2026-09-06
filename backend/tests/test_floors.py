"""Multi-storey — notes/decisions/single-storey-first.md, cashed in.

The `floor` field was put in the schema on day one so that G+1 would be one integer rather than a
rewrite. These are the tests that say it actually is one: rooms compete for space only with their
own storey, the stair core lands on the same footprint all the way up, and the house stays
walkable end to end through it.
"""

from fastapi.testclient import TestClient

from api.main import MAX_FLOORS, SPLIT_TO_UPPER, app, assign_floors
from solver.rooms import ROOM_CATALOG

client = TestClient(app)

BASE = {
    "plot_w_in": 360,
    "plot_d_in": 480,
    "facing": "N",
    "rooms": ["hall", "kitchen", "bedroom", "bedroom", "bathroom", "bathroom"],
}


def solve(**overrides):
    body = {**BASE, **overrides}
    r = client.post("/solve", json=body)
    assert r.status_code == 200
    return r.json()


def overlaps(a, b) -> bool:
    return (
        a["x_in"] < b["x_in"] + b["w_in"]
        and b["x_in"] < a["x_in"] + a["w_in"]
        and a["y_in"] < b["y_in"] + b["d_in"]
        and b["y_in"] < a["y_in"] + a["d_in"]
    )


def test_single_storey_is_untouched():
    body = solve()
    assert {r["floor"] for r in body["rooms"]} == {0}
    assert not any(r["name"] == "stairs" for r in body["rooms"])


def test_g_plus_one_packs_both_floors():
    body = solve(floors=2)
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    floors = {r["floor"] for r in body["rooms"]}
    assert floors == {0, 1}


def test_rooms_only_compete_with_their_own_floor():
    body = solve(floors=2)
    rooms = body["rooms"]
    for i, a in enumerate(rooms):
        for b in rooms[i + 1 :]:
            if a["floor"] == b["floor"]:
                assert not overlaps(a, b), (a["name"], b["name"], a["floor"])
    # And the floors genuinely stack: a house whose upper floor shares no ground with the lower
    # one is two houses.
    ground = [r for r in rooms if r["floor"] == 0]
    upper = [r for r in rooms if r["floor"] == 1]
    assert any(overlaps(a, b) for a in ground for b in upper)


def test_one_staircase_not_two():
    body = solve(floors=2)
    stairs = [r for r in body["rooms"] if r["name"] == "stairs"]
    assert len(stairs) == 2
    first, second = stairs
    assert (first["x_in"], first["y_in"], first["w_in"], first["d_in"]) == (
        second["x_in"],
        second["y_in"],
        second["w_in"],
        second["d_in"],
    )
    assert {s["floor"] for s in stairs} == {0, 1}


def test_every_room_is_reachable_through_the_stair():
    body = solve(floors=2)
    assert body["meta"]["rooms_reachable"] == len(body["rooms"])


def test_doors_never_cross_a_floor():
    body = solve(floors=2)
    rooms = body["rooms"]
    for room in rooms:
        for opening in room["openings"]:
            other = opening.get("to_room")
            if other is None:
                continue
            assert rooms[other]["floor"] == room["floor"], (room["name"], opening)


def test_walls_are_derived_per_floor():
    body = solve(floors=2)
    rooms = body["rooms"]
    assert {w["floor"] for w in body["walls"]} == {0, 1}
    for wall in body["walls"]:
        for index in wall["room_indices"]:
            assert rooms[index]["floor"] == wall["floor"]


def test_the_front_door_is_on_the_ground():
    body = solve(floors=2)
    for room in body["rooms"]:
        for opening in room["openings"]:
            if opening["kind"] == "entrance":
                assert room["floor"] == 0


def test_split_keeps_one_of_each_kind_downstairs():
    rooms = [ROOM_CATALOG[n] for n in BASE["rooms"]]
    split = assign_floors(rooms, 2)
    for kind in SPLIT_TO_UPPER:
        ground = [r for r in split if r.name == kind and r.floor == 0]
        assert ground, f"{kind} left nothing on the ground floor"
    assert any(r.floor == 1 for r in split)


def test_split_is_deterministic():
    rooms = [ROOM_CATALOG[n] for n in BASE["rooms"]]
    assert [r.floor for r in assign_floors(rooms, 2)] == [r.floor for r in assign_floors(rooms, 2)]


def test_upper_storeys_land_on_the_ground_floor():
    """An upper floor hanging off the side of the building has nowhere to put its loads, and it
    is what made the first G+1 render look like two houses stacked badly."""
    body = solve(floors=2)
    ground = [r for r in body["rooms"] if r["floor"] == 0]
    gx0 = min(r["x_in"] for r in ground)
    gx1 = max(r["x_in"] + r["w_in"] for r in ground)
    gz0 = min(r["y_in"] for r in ground)
    gz1 = max(r["y_in"] + r["d_in"] for r in ground)
    for room in body["rooms"]:
        if room["floor"] == 0:
            continue
        assert room["x_in"] >= gx0 and room["x_in"] + room["w_in"] <= gx1, room["name"]
        assert room["y_in"] >= gz0 and room["y_in"] + room["d_in"] <= gz1, room["name"]


def test_meta_reports_the_storeys_it_packed():
    """A client that asked for two and is told one is talking to an old backend, and can say so
    rather than quietly presenting a bungalow as a duplex."""
    assert solve(floors=2)["meta"]["floors_solved"] == 2
    assert solve()["meta"]["floors_solved"] == 1


def test_storeys_are_capped():
    body = solve(floors=99)
    assert max(r["floor"] for r in body["rooms"]) <= MAX_FLOORS - 1
