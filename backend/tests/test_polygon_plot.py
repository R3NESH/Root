"""Non-rectangular plots — envelope/polygon.py and the half-plane path through the solver.

Real parcels are splayed at corners and trapezoidal on curved roads. The rectangle is the case
that has always worked; these are the cases that used to be unrepresentable.
"""

from fastapi.testclient import TestClient

from api.main import app
from envelope import DEFAULT_SETBACK, buildable_envelope, buildable_polygon, is_convex
from envelope.polygon import HalfPlane, inset, outward_halfplanes, signed_area2

client = TestClient(app)

W_IN, D_IN = 360, 480  # a 30 x 40 ft plot
RECT = [(0, 0), (W_IN, 0), (W_IN, D_IN), (0, D_IN)]
# 6 ft cut off the north-east corner: the ordinary corner-plot splay.
SPLAYED = [(0, 0), (W_IN - 72, 0), (W_IN, 72), (W_IN, D_IN), (0, D_IN)]


def test_convexity_check():
    assert is_convex(RECT)
    assert is_convex(SPLAYED)
    # An L-shape is the shape the half-plane method cannot represent, so it must be rejected
    # rather than silently reduced to its convex hull.
    assert not is_convex([(0, 0), (240, 0), (240, 240), (360, 240), (360, 480), (0, 480)])
    assert not is_convex([(0, 0), (360, 0)])


def test_normals_point_out_whichever_way_the_outline_is_wound():
    for poly in (RECT, list(reversed(RECT))):
        centre = (W_IN // 2, D_IN // 2)
        for plane in outward_halfplanes(poly):
            assert plane.a * centre[0] + plane.b * centre[1] <= plane.c


def test_signed_area_sign_flips_with_winding():
    assert signed_area2(RECT) == -signed_area2(list(reversed(RECT)))


def test_inset_never_grows_the_buildable_area():
    plane = HalfPlane(a=72, b=-72, c=18870)
    assert inset(plane, 36).c < plane.c
    assert inset(plane, 0) == plane


def test_rectangle_polygon_matches_the_rectangle_envelope():
    """The general path must agree with the fast path, or one of them is wrong."""
    rect_env = buildable_envelope(W_IN, D_IN, "N", DEFAULT_SETBACK)
    poly_env = buildable_polygon(RECT, "N", DEFAULT_SETBACK)
    assert poly_env is not None
    assert poly_env.origin_x_in == rect_env.origin_x_in
    assert poly_env.origin_z_in == rect_env.origin_z_in
    assert poly_env.width_in == rect_env.width_in
    assert poly_env.depth_in == rect_env.depth_in


def test_splayed_corner_is_cut_off_the_buildable_outline():
    env = buildable_polygon(SPLAYED, "N", DEFAULT_SETBACK)
    assert env is not None
    assert len(env.polygon_in) == 5
    # The buildable outline stays inside the plot outline on the splayed edge.
    for x, y in env.polygon_in:
        assert x + y * 0 <= W_IN
        assert x - (W_IN - 72) <= y + 1


def test_unusable_outlines_fall_back_rather_than_crash():
    assert buildable_polygon([(0, 0), (10, 0), (10, 10), (0, 10)], "N", DEFAULT_SETBACK) is None
    assert buildable_polygon([(0, 0), (360, 0)], "N", DEFAULT_SETBACK) is None
    assert buildable_polygon([(0, 0), (240, 0), (240, 240), (360, 240), (360, 480), (0, 480)], "N", DEFAULT_SETBACK) is None


def _solve(polygon):
    body = {
        "plot_w_in": W_IN,
        "plot_d_in": D_IN,
        "facing": "N",
        "rooms": ["hall", "kitchen", "bedroom", "bathroom"],
    }
    if polygon is not None:
        body["plot_polygon_in"] = [[x, y] for x, y in polygon]
    r = client.post("/solve", json=body)
    assert r.status_code == 200
    return r.json()


def test_solve_keeps_every_room_inside_a_splayed_plot():
    body = _solve(SPLAYED)
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    assert body["rooms"]

    env = buildable_polygon(SPLAYED, "N", DEFAULT_SETBACK)
    assert env is not None
    planes = outward_halfplanes(SPLAYED)
    planes = [inset(p, 36) for p in planes]  # the tightest setback in the default set

    for room in body["rooms"]:
        corners = [
            (room["x_in"], room["y_in"]),
            (room["x_in"] + room["w_in"], room["y_in"]),
            (room["x_in"], room["y_in"] + room["d_in"]),
            (room["x_in"] + room["w_in"], room["y_in"] + room["d_in"]),
        ]
        for plane in planes:
            for cx, cy in corners:
                assert plane.a * cx + plane.b * cy <= plane.c, (room["name"], plane)


def test_meta_carries_the_buildable_outline_only_when_there_is_one():
    assert _solve(SPLAYED)["meta"]["envelope_polygon_in"]
    assert _solve(None)["meta"]["envelope_polygon_in"] is None


def test_a_rejected_outline_still_solves_as_a_rectangle():
    concave = [(0, 0), (240, 0), (240, 240), (360, 240), (360, 480), (0, 480)]
    body = _solve(concave)
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    assert body["meta"]["envelope_polygon_in"] is None
    assert body["meta"]["envelope_w_in"] == buildable_envelope(W_IN, D_IN, "N", DEFAULT_SETBACK).width_in
