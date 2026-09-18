"""Non-rectangular plots — envelope/polygon.py and the half-plane path through the solver.

Real parcels are splayed at corners and trapezoidal on curved roads. The rectangle is the case
that has always worked; these are the cases that used to be unrepresentable.
"""

from fastapi.testclient import TestClient

from api.main import app
from envelope import DEFAULT_SETBACK, buildable_envelope, buildable_polygon, is_convex
from envelope.polygon import (
    MAX_VERTICES,
    HalfPlane,
    inset,
    outward_halfplanes,
    signed_area2,
)

client = TestClient(app)

W_IN, D_IN = 360, 480  # a 30 x 40 ft plot
RECT = [(0, 0), (W_IN, 0), (W_IN, D_IN), (0, D_IN)]
# 6 ft cut off the north-east corner: the ordinary corner-plot splay.
SPLAYED = [(0, 0), (W_IN - 72, 0), (W_IN, 72), (W_IN, D_IN), (0, D_IN)]


def _hull(points):
    """Monotone-chain convex hull over integer points, collinear points dropped.

    The same construction frontend/lib/plot.ts uses to turn a curve into chords. It is repeated
    here rather than imported because the backend must not depend on the client agreeing to be
    well behaved — these tests assert the backend accepts what a correct producer sends.
    """
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def half(seq):
        out = []
        for q in seq:
            while len(out) >= 2:
                (ax, ay), (bx, by) = out[-2], out[-1]
                if (bx - ax) * (q[1] - ay) - (by - ay) * (q[0] - ax) > 0:
                    break
                out.pop()
            out.append(q)
        return out

    return half(pts)[:-1] + half(list(reversed(pts)))[:-1]


def bowed_road_edge(chords: int, bulge_in: int = 72):
    """The 30x40 plot with its north edge bowed outward as `chords` straight segments.

    A plot on the outside of a bend. The bow is convex, which is the only curvature a
    half-plane intersection can express at all — see envelope/polygon.py.
    """
    from math import pi, sin

    pts = [
        (round(i / chords * W_IN), round(-bulge_in * sin(pi * i / chords)))
        for i in range(chords + 1)
    ]
    pts += [(W_IN, D_IN), (0, D_IN)]
    lift = -min(y for _, y in pts)
    return _hull([(x, y + lift) for x, y in pts])


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


# --- curved plot edges -----------------------------------------------------------------
#
# A curve reaches the solver as chords. Two things bound how many: MAX_VERTICES, and integer
# inches, which is the tighter of the two. Rounding a sampled curve onto the inch lattice
# reverses chord turns once the chords get short, and is_convex() then rejects the whole
# outline — measured at 22 chords for a 6 ft bow. Hulling the rounded points fixes it by
# construction, and these lock that in.


def test_a_finely_sampled_curve_rounds_itself_non_convex():
    """The reason the producer hulls. Without it, a fine tessellation is simply rejected."""
    from math import pi, sin

    raw = [
        (round(i / 32 * W_IN), round(-72 * sin(pi * i / 32)))
        for i in range(33)
    ]
    raw += [(W_IN, D_IN), (0, D_IN)]
    lift = -min(y for _, y in raw)
    raw = [(x, y + lift) for x, y in raw]

    assert not is_convex(raw), "expected integer rounding to break convexity at 32 chords"
    assert is_convex(bowed_road_edge(32)), "the hull must repair it"


def test_hulling_collapses_a_fine_curve_under_the_vertex_cap():
    """64 chords is more than MAX_VERTICES, and must not need to be refused.

    Rounding makes most of a fine tessellation collinear, so the hull drops it. The cap is
    therefore a cap on real corners, not on how smoothly the user may draw.
    """
    assert len(bowed_road_edge(64)) <= MAX_VERTICES
    assert len(bowed_road_edge(64)) > len(bowed_road_edge(4))


def test_a_bowed_road_edge_grows_the_plot_it_bows_out_of():
    """A bow outward is more land, so the buildable area may not shrink below the rectangle's."""
    flat = buildable_polygon(RECT, "N", DEFAULT_SETBACK)
    bowed = buildable_polygon(bowed_road_edge(16), "N", DEFAULT_SETBACK)
    assert flat is not None and bowed is not None
    assert bowed.depth_in >= flat.depth_in


def test_solve_keeps_every_room_inside_a_curved_plot():
    poly = bowed_road_edge(16)
    body = _solve(poly)
    assert body["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    assert body["rooms"]

    env = buildable_polygon(poly, "N", DEFAULT_SETBACK)
    assert env is not None
    planes = [inset(pl, 36) for pl in outward_halfplanes(poly)]
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


def test_an_outline_past_the_vertex_cap_is_refused_not_crashed():
    many = [(round(180 + 180 * __import__("math").cos(i * 2 * __import__("math").pi / 40)),
             round(240 + 240 * __import__("math").sin(i * 2 * __import__("math").pi / 40)))
            for i in range(40)]
    many = _hull(many)
    if len(many) > MAX_VERTICES:
        assert buildable_polygon(many, "N", DEFAULT_SETBACK) is None
