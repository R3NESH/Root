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


def test_infeasible_mix_reports_what_to_drop():
    """INFEASIBLE is a dead end unless the response says what would fit — api/main.py."""
    body = client.post(
        "/solve",
        json={
            **BASE,
            "plot_w_in": 20 * 12,
            "plot_d_in": 30 * 12,
            "rooms": ["hall", "kitchen", "bedroom", "bedroom", "bathroom"],
        },
    ).json()

    assert body["rooms"] == []
    drop = body["meta"]["drop_to_fit"]
    assert drop, "a mix that does not fit should name the spaces to remove"
    # The hub every other room opens off is the last thing given up.
    assert "hall" not in drop


def test_solvable_mix_has_nothing_to_drop():
    body = client.post("/solve", json=BASE).json()
    assert body["rooms"]
    assert body["meta"]["drop_to_fit"] == []


def test_empty_room_list_is_not_an_error():
    body = client.post("/solve", json={**BASE, "rooms": []}).json()
    assert body["meta"]["status"] == "NO_INPUT"
    assert body["rooms"] == []


def test_tiny_plot_reports_empty_envelope():
    body = client.post("/solve", json={**BASE, "plot_w_in": 60, "plot_d_in": 60}).json()
    assert body["meta"]["status"] == "EMPTY_ENVELOPE"


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
    then forces stores onto an exterior wall, and derive_windows() cuts a habitable window where
    a high vent belongs.

    test_realism.py builds its Rooms straight from ROOM_CATALOG, so it asserts the intended
    behaviour on objects this endpoint never produces. This is that gap.
    """
    req = {**BASE, "rooms": ["hall", "kitchen", "bedroom", "bathroom", "utility", "store"]}
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


def test_solve_prompt_endpoint():
    req = {"prompt": "30x40 north facing 2bhk with a store"}
    r = client.post("/solve-prompt", json=req)
    assert r.status_code == 200
    data = r.json()
    assert data["data"]["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    assert data["data"]["plot"]["facing"] == "N"
    assert len(data["data"]["rooms"]) >= 5
    assert "<svg" in data["svg"]



def _pair_gap(rooms, i, j) -> float:
    a, b = rooms[i], rooms[j]
    return abs((a["x_in"] + a["w_in"] / 2) - (b["x_in"] + b["w_in"] / 2)) + abs(
        (a["y_in"] + a["d_in"] / 2) - (b["y_in"] + b["d_in"] / 2)
    )


def test_near_pairs_are_indexed_against_the_request_not_the_solver():
    """An unknown name is skipped, so request position is not solver index.

    Without the translation in solve(), a mix carrying one bad name would silently pair the
    wrong two rooms — or, as here, name an index the solver does not have and do nothing.
    """
    payload = {
        **BASE,
        "plot_w_in": 480,
        "plot_d_in": 660,
        "rooms": ["hall", "kitchen", "nonsense", "bedroom"],
    }
    loose = client.post("/solve", json=payload).json()
    # Request positions 1 and 3 — the kitchen and the bedroom, either side of the bad name.
    pulled = client.post("/solve", json={**payload, "near": [[1, 3]]}).json()

    assert loose["meta"]["unknown_room_names"] == ["nonsense"]
    assert len(loose["rooms"]) == 3
    # Which are solver indices 1 and 2 once "nonsense" is dropped.
    assert _pair_gap(pulled["rooms"], 1, 2) < _pair_gap(loose["rooms"], 1, 2)


def test_open_sided_rooms_are_flagged_to_the_renderer():
    """The renderer cannot tell a porch from a bedroom by name, and must not draw it a box.

    No exterior wall is emitted for these, so a renderer falling back to the room rectangle
    would invent walls the bill of quantities never costed.
    """
    payload = {
        **BASE,
        "plot_w_in": 480,
        "plot_d_in": 660,
        "rooms": ["hall", "kitchen", "bedroom", "sitout", "parking"],
    }
    body = client.post("/solve", json=payload).json()
    assert body["meta"]["unknown_room_names"] == []
    flags = {r["name"]: r["open_sided"] for r in body["rooms"]}
    assert flags["sitout"] is True
    assert flags["parking"] is True
    assert flags["hall"] is False


def test_ai_plan_says_503_when_there_is_no_credential(monkeypatch):
    """No offline path — notes/architecture/client-side-fallback.md.

    503 and not 500: the service is fine, it has not been given a key. The test strips the
    environment so it can never make a real request, on this machine or in CI.
    """
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    r = client.post("/ai/plan", json={"prompt": "30x40 north facing 2bhk with car parking"})
    assert r.status_code == 503
    assert "credential" in r.json()["detail"].lower()


# --- a size band on a room, from ai/plan_from_image.py --------------------------------


def test_a_min_max_band_is_honoured_and_not_widened_past_the_catalog():
    """`min_*_in`/`max_*_in` sat in RoomSpecIn unread until a plan photo needed "about 12 ft".

    The band is respected where it falls inside the catalog range and clipped where it does not —
    a drawing that prints a 4 ft bedroom must not undo the NBC 2016 minimums in solver/rooms.py.
    """
    bedroom = ROOM_CATALOG["bedroom"]
    r = client.post(
        "/solve",
        json={
            **BASE,
            "rooms": [
                "hall",
                "kitchen",
                {"name": "bedroom", "min_w_in": 132, "max_w_in": 156},
                {"name": "bedroom", "min_w_in": 12, "max_w_in": 24},
            ],
        },
    )
    assert r.status_code == 200
    banded, clipped = [x for x in r.json()["rooms"] if x["name"] == "bedroom"]
    assert 132 <= banded["w_in"] <= 156
    assert clipped["w_in"] >= bedroom.min_w_in


def test_a_bare_room_name_is_unaffected_by_the_band():
    r = client.post("/solve", json=BASE)
    assert r.status_code == 200
    for room in r.json()["rooms"]:
        base = ROOM_CATALOG[room["name"]]
        assert base.min_w_in <= room["w_in"] <= base.max_w_in


def test_an_upload_that_is_not_an_image_is_a_400_not_a_500():
    r = client.post(
        "/ai/plan-image",
        json={"image_base64": "not base64 at all!!", "media_type": "image/tiff"},
    )
    assert r.status_code == 400
    assert "image/tiff" in r.json()["detail"]
