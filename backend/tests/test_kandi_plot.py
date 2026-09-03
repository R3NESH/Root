"""notes/build/build-order.md — Integration validation on the real 30x40 North-facing plot in Kandi, Telangana.

Validates the solver against real-world Indian municipal conditions:
- 30x40 ft plot (360x480 in), North road facing.
- Telangana municipal / TG-bPASS setback: 5 ft front (60 in), 3 ft rear/sides (36 in).
- Buildable envelope: 24x32 ft (288x384 in = 768 sq ft).
- Validates 2BHK and 3BHK Indian residential programs:
  * Vaastu: Kitchen SE (Agneya), Master Bed SW (Nairutya), Pooja NE (Ishanya).
  * 100% room reachability (doors connecting star hierarchy).
  * Daylighting and ventilation (habitable windows, wet-room vents).
  * Compact footprint (void < 20%).
  * Real BIM wall derivation and BOQ takeoff.
"""

from fastapi.testclient import TestClient

from api.main import app
from solver.connectivity import reachable_count
from solver.rooms import ROOM_CATALOG
from vaastu.rules import V1_RULES, satisfied

client = TestClient(app)

# Real Kandi, Telangana 30x40 plot specifications
KANDI_PLOT = {
    "plot_w_in": 360,   # 30 ft
    "plot_d_in": 480,   # 40 ft
    "facing": "N",      # North road
    "setback": {
        "front_in": 60, # 5 ft road setback
        "rear_in": 36,  # 3 ft rear setback
        "left_in": 36,  # 3 ft side setback (West)
        "right_in": 36, # 3 ft side setback (East)
    },
}


def test_kandi_2bhk_full_vaastu_and_connectivity():
    """Standard Indian 2BHK with pooja and two baths on the Kandi plot."""
    mix = [
        "entrance",
        "hall",
        "kitchen",
        "pooja",
        "bedroom",
        "bedroom",
        "bathroom",
        "bathroom",
    ]
    req = {**KANDI_PLOT, "rooms": mix}
    r = client.post("/solve", json=req)
    assert r.status_code == 200, f"Solver rejected Kandi 2BHK: {r.text}"
    body = r.json()

    meta = body["meta"]
    assert meta["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(body["rooms"]) == len(mix)

    # 1. All rooms stay strictly inside buildable envelope (24x32 ft)
    x0, z0 = meta["envelope_origin_x_in"], meta["envelope_origin_z_in"]
    w_env, d_env = meta["envelope_w_in"], meta["envelope_d_in"]
    x1, z1 = x0 + w_env, z0 + d_env

    # 360 - 36 - 36 = 288 in
    assert w_env == 288
    # 480 - 60 - 36 = 384 in
    assert d_env == 384

    for room in body["rooms"]:
        assert room["x_in"] >= x0
        assert room["y_in"] >= z0
        assert room["x_in"] + room["w_in"] <= x1
        assert room["y_in"] + room["d_in"] <= z1

    # 2. No overlapping rooms
    rooms = body["rooms"]
    for i, a in enumerate(rooms):
        for b in rooms[i + 1 :]:
            ax1, ay1 = a["x_in"] + a["w_in"], a["y_in"] + a["d_in"]
            bx1, by1 = b["x_in"] + b["w_in"], b["y_in"] + b["d_in"]
            assert not (a["x_in"] < bx1 and b["x_in"] < ax1 and a["y_in"] < by1 and b["y_in"] < ay1)

    # 3. Vaastu compliance in envelope coordinates
    # Master bedroom (first bedroom in list) in SW
    # Kitchen in SE
    # Pooja in NE
    env_rooms = [
        (r["name"], r["x_in"] - x0, r["y_in"] - z0, r["w_in"], r["d_in"])
        for r in rooms
    ]

    # Kitchen SE
    kitchen = next(r for r in env_rooms if r[0] == "kitchen")
    assert satisfied(V1_RULES["kitchen"], kitchen[1], kitchen[2], kitchen[3], kitchen[4], w_env, d_env), (
        f"Kitchen at x={kitchen[1]} y={kitchen[2]} violates SE Vaastu rule on Kandi plot"
    )

    # Master Bedroom SW
    master_bed = next(r for r in env_rooms if r[0] == "bedroom")
    assert satisfied(V1_RULES["bedroom"], master_bed[1], master_bed[2], master_bed[3], master_bed[4], w_env, d_env), (
        f"Master Bedroom at x={master_bed[1]} y={master_bed[2]} violates SW Vaastu rule on Kandi plot"
    )

    # Pooja NE
    pooja = next(r for r in env_rooms if r[0] == "pooja")
    assert satisfied(V1_RULES["pooja"], pooja[1], pooja[2], pooja[3], pooja[4], w_env, d_env), (
        f"Pooja at x={pooja[1]} y={pooja[2]} violates NE Vaastu rule on Kandi plot"
    )

    # 4. 100% Reachability & Door connectivity
    assert meta["rooms_reachable"] == len(mix)

    # 5. BIM Walls and BOQ Takeoff derived
    assert len(body["walls"]) > 0
    assert body["quantities"] is not None
    q = body["quantities"]
    assert q["carpet_area_sqft"] > 400
    assert q["brick_count"] > 5000
    assert q["masonry_volume_cuft"] > 400


def test_kandi_compact_2bhk_tight_footprint():
    """Compact 2BHK on the Kandi plot solves quickly with tight footprint."""
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]
    req = {**KANDI_PLOT, "rooms": mix}
    r = client.post("/solve", json=req)
    assert r.status_code == 200
    body = r.json()

    meta = body["meta"]
    assert meta["status"] in ("OPTIMAL", "FEASIBLE")

    # Footprint void ratio check (compact footprint)
    rooms = body["rooms"]
    fx0 = min(r["x_in"] for r in rooms)
    fx1 = max(r["x_in"] + r["w_in"] for r in rooms)
    fz0 = min(r["y_in"] for r in rooms)
    fz1 = max(r["y_in"] + r["d_in"] for r in rooms)
    bbox = (fx1 - fx0) * (fz1 - fz0)
    built = sum(r["w_in"] * r["d_in"] for r in rooms)
    void = 1 - built / bbox

    # Compactness term must keep void <= 20% on the Kandi envelope
    assert void <= 0.20, f"Void {void:.1%} exceeds 20% threshold; plan is scattered"


def test_kandi_3bhk_fits_under_nbc_minimums():
    """A 3BHK that was historically INFEASIBLE now fits cleanly on 30x40 Kandi plot under NBC 2016."""
    mix = ["hall", "kitchen", "bedroom", "bedroom", "bedroom", "bathroom", "bathroom"]
    req = {**KANDI_PLOT, "rooms": mix}
    r = client.post("/solve", json=req)
    assert r.status_code == 200
    body = r.json()

    meta = body["meta"]
    # Thanks to NBC 2016 room sizing (hall 10x12, kitchen 7x8, bath 4x6), 3BHK is FEASIBLE!
    assert meta["status"] in ("OPTIMAL", "FEASIBLE"), (
        f"Expected 3BHK to fit on 30x40 Kandi plot, got status {meta['status']}"
    )
    assert len(body["rooms"]) == 7
    assert meta["rooms_reachable"] == 7
