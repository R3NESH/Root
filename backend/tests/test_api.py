"""notes/build/step-3-wire-together.md — POST /solve, end-to-end through the API layer."""

from fastapi.testclient import TestClient

from api.main import app
from solver.rooms import ROOM_CATALOG

client = TestClient(app)

BASE = {
    "plot_w_in": 360,
    "plot_d_in": 480,
    "facing": "N",
    "rooms": ["hall", "kitchen", "bedroom", "bedroom", "bathroom"],
}


def test_solve_returns_rooms_inside_the_envelope():
    r = client.post("/solve", json=BASE)
    assert r.status_code == 200
    body = r.json()
    meta = body["meta"]
    assert meta["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(body["rooms"]) == len(BASE["rooms"])

    x0, z0 = meta["envelope_origin_x_in"], meta["envelope_origin_z_in"]
    x1, z1 = x0 + meta["envelope_w_in"], z0 + meta["envelope_d_in"]
    for room in body["rooms"]:
        assert room["x_in"] >= x0
        assert room["y_in"] >= z0
        assert room["x_in"] + room["w_in"] <= x1
        assert room["y_in"] + room["d_in"] <= z1


def test_solve_rooms_do_not_overlap():
    body = client.post("/solve", json=BASE).json()
    rooms = body["rooms"]
    for i, a in enumerate(rooms):
        for b in rooms[i + 1 :]:
            ax1, ay1 = a["x_in"] + a["w_in"], a["y_in"] + a["d_in"]
            bx1, by1 = b["x_in"] + b["w_in"], b["y_in"] + b["d_in"]
            assert not (a["x_in"] < bx1 and b["x_in"] < ax1 and a["y_in"] < by1 and b["y_in"] < ay1)


def test_custom_room_dimensions_are_honoured():
    # 15x15 ft bedroom (180x180 in)
    req = {
        "plot_w_in": 480,
        "plot_d_in": 600,
        "facing": "N",
        "rooms": [
            "hall",
            {"name": "bedroom", "custom_w_in": 180, "custom_d_in": 180},
            "kitchen",
            "bathroom",
        ],
    }
    r = client.post("/solve", json=req)
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")

    custom_bed = next(room for room in body["rooms"] if room["name"] == "bedroom")
    assert custom_bed["w_in"] == 180
    assert custom_bed["d_in"] == 180


def test_schema_fields_are_populated_not_placeholders():
    # These three started as HANDOFF.md §10 placeholders so that v2 would not need a schema
    # migration. They are real now — the solver derives them and the API ships them.
    # notes/architecture/duplicated-geometry.md is why blanking them was a defect.
    body = client.post("/solve", json=BASE).json()
    room = body["rooms"][0]
    assert room["floor"] == 0
    assert isinstance(room["wall_thickness_in"], int) and room["wall_thickness_in"] > 0
    assert room["openings"], "openings must be derived, not left empty"
    assert all(o["kind"] in ("door", "window", "opening", "entrance") for o in room["openings"])
    assert body["meta"]["rooms_reachable"] == len(body["rooms"])


def test_every_room_is_reachable_and_the_house_has_a_front_door():
    body = client.post("/solve", json=BASE).json()
    assert body["meta"]["rooms_reachable"] == len(body["rooms"])
    assert body["meta"]["entrance_edge"] in ("N", "S", "E", "W")
    entrances = [
        o for r in body["rooms"] for o in r["openings"] if o["kind"] == "entrance"
    ]
    assert len(entrances) == 1, "exactly one front door"


def test_prev_positions_are_honoured():
    first = client.post("/solve", json=BASE).json()
    prev = [
        {"index": i, "x_in": r["x_in"], "y_in": r["y_in"]}
        for i, r in enumerate(first["rooms"])
    ]
    x0 = first["meta"]["envelope_origin_x_in"]
    z0 = first["meta"]["envelope_origin_z_in"]
    for p in prev:
        p["x_in"] -= x0
        p["y_in"] -= z0

    second = client.post("/solve", json={**BASE, "prev": prev}).json()
    assert second["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    drift = sum(
        abs(a["x_in"] - b["x_in"]) + abs(a["y_in"] - b["y_in"])
        for a, b in zip(first["rooms"], second["rooms"])
    )
    assert drift == 0, f"unchanged input should reproduce the same layout, drifted {drift} in"


def test_unknown_room_names_are_reported_not_fatal():
    body = client.post("/solve", json={**BASE, "rooms": ["hall", "sauna"]}).json()
    assert body["meta"]["unknown_room_names"] == ["sauna"]
    assert [r["name"] for r in body["rooms"]] == ["hall"]


def test_empty_room_list_is_not_an_error():
    body = client.post("/solve", json={**BASE, "rooms": []}).json()
    assert body["meta"]["status"] == "NO_INPUT"
    assert body["rooms"] == []


def test_tiny_plot_reports_empty_envelope():
    body = client.post("/solve", json={**BASE, "plot_w_in": 60, "plot_d_in": 60}).json()
    assert body["meta"]["status"] == "EMPTY_ENVELOPE"


def test_vaastu_applied_by_default():
    body = client.post("/solve", json=BASE).json()
    assert body["meta"]["vaastu_constraints_applied"], "Vaastu should be on by default"


def test_facing_changes_the_envelope_origin():
    north = client.post("/solve", json=BASE).json()["meta"]
    east = client.post("/solve", json={**BASE, "facing": "E"}).json()["meta"]
    assert (north["envelope_origin_x_in"], north["envelope_origin_z_in"]) != (
        east["envelope_origin_x_in"],
        east["envelope_origin_z_in"],
    )


def test_room_semantics_survive_the_api_boundary():
    """The catalog's `habitable` / `wet` flags must reach the response.

    solve() rebuilds each Room from ROOM_CATALOG plus the caller's dimensions. It used to pass
    only the name and the four bounds, so the dataclass defaults (habitable=True, wet=False)
    silently overwrote the catalog for every room. That is not cosmetic: add_daylight_constraints()
    then forces the pooja room and stores onto an exterior wall, and derive_windows() cuts a
    habitable window where a high vent belongs.

    test_realism.py builds its Rooms straight from ROOM_CATALOG, so it asserts the intended
    behaviour on objects this endpoint never produces. This is that gap.
    """
    req = {**BASE, "rooms": ["hall", "kitchen", "bedroom", "bathroom", "pooja", "store"]}
    body = client.post("/solve", json=req).json()
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")

    got = {r["name"]: (r["habitable"], r["wet"]) for r in body["rooms"]}
    expected = {name: (ROOM_CATALOG[name].habitable, ROOM_CATALOG[name].wet) for name in got}
    assert got == expected, f"catalog semantics lost across the API: {got} != {expected}"


def test_custom_dimensions_do_not_drop_room_semantics():
    """A caller-supplied size must not turn a bathroom into a habitable room."""
    req = {
        **BASE,
        "rooms": ["hall", {"name": "bathroom", "custom_w_in": 72, "custom_d_in": 90}],
    }
    body = client.post("/solve", json=req).json()
    bathroom = next(r for r in body["rooms"] if r["name"] == "bathroom")
    assert bathroom["habitable"] is False
    assert bathroom["wet"] is True
