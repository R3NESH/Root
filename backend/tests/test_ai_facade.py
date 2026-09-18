"""backend/ai — an exterior photograph to a facade finish and a generated interior.

No key and no network, same as the other two AI suites. What a unit test can hold the model to is
nothing; what it can hold this module to is the line between the two kinds of claim it makes.

The facade is *read* and may be wrong. The plan and the interior are *generated* and are not claims
about the building at all. Every test below is about keeping the second from dressing up as the
first, and about a finish id this build cannot render being reported rather than passed through.
"""

import base64
from types import SimpleNamespace

import pytest

from ai import FacadeRequest, MODEL, Palette, RoomFinish, parse_facade, resolve_facade
from ai.plan_from_image import BadImage
from ai.prompt_constraints import MAX_FLOORS, MissingCredential

PNG = base64.standard_b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()

PALETTE = Palette(
    floors=["scandinavian_oak", "carrara_white", "black_granite"],
    wall_colors=["arctic_white", "terracotta", "royal_navy"],
    wall_textures=["matte_paint", "venetian_stucco", "exposed_brick"],
    door_colors=["dark_walnut", "pure_white"],
    glazing_styles=["clear", "industrial", "structural"],
)


def _answer(**overrides) -> FacadeRequest:
    """A plausible reading of a two-storey painted house, with the field under test overridden."""
    base = dict(
        storeys=2,
        facade_color_hex="#d9cdb8",
        facade_texture="matte_paint",
        facade_band_color_hex="",
        facade_band_fraction=0.0,
        glazing_style="clear",
        style_label="contemporary Indian duplex",
        rooms=["hall", "kitchen", "bedroom", "bedroom", "bathroom"],
        interior=[
            RoomFinish(
                kind="hall",
                floor="scandinavian_oak",
                wall_color="arctic_white",
                wall_texture="matte_paint",
                door_color="dark_walnut",
            )
        ],
        unsupported=[],
    )
    base.update(overrides)
    return FacadeRequest(**base)


# --- the upload check is the same one, not a second copy -------------------------------


def test_the_upload_is_checked_before_anything_is_sent():
    with pytest.raises(BadImage, match="image/tiff"):
        parse_facade(PNG, "image/tiff", PALETTE, 30, 40)


def test_a_data_url_prefix_is_still_an_error():
    with pytest.raises(BadImage, match="base64"):
        parse_facade(f"data:image/png;base64,{PNG}", "image/png", PALETTE, 30, 40)


# --- what is read off the facade ------------------------------------------------------


def test_a_sampled_colour_reaches_the_facade_fields():
    read = resolve_facade(_answer(), PALETTE)
    assert read.facade["facadeColor"] == "#d9cdb8"
    assert read.facade["facadeTexture"] == "matte_paint"
    assert read.glazing_style == "clear"
    assert read.storeys == 2


def test_a_colour_without_a_hash_is_accepted():
    """The model is asked for #rrggbb and mostly complies. A bare six-digit hex is still a colour."""
    read = resolve_facade(_answer(facade_color_hex="B85D38"), PALETTE)
    assert read.facade["facadeColor"] == "#b85d38"


def test_a_colour_that_is_not_a_colour_is_dropped():
    read = resolve_facade(_answer(facade_color_hex="beige-ish"), PALETTE)
    assert "facadeColor" not in read.facade


def test_an_unreadable_facade_leaves_the_fields_absent_rather_than_blank():
    """An absent key leaves the app's current finish alone. A blank one would overwrite it."""
    read = resolve_facade(
        _answer(facade_color_hex="", facade_texture="", glazing_style=""), PALETTE
    )
    assert read.facade == {}
    assert read.glazing_style == ""


def test_storeys_are_clamped_to_what_the_solver_models():
    assert resolve_facade(_answer(storeys=0), PALETTE).storeys == 1
    assert resolve_facade(_answer(storeys=9), PALETTE).storeys == MAX_FLOORS


# --- a two-tone facade ----------------------------------------------------------------


def test_a_two_tone_facade_becomes_a_band_scheme():
    read = resolve_facade(
        _answer(facade_band_color_hex="#3a372f", facade_band_fraction=0.15), PALETTE
    )
    scheme = read.facade["facadeBands"]
    assert scheme["axis"] == "vertical"
    # Bottom band first, the way the model was asked to measure it, and the two shares fill the wall.
    assert scheme["bands"][0] == {"sizeFrac": 0.15, "colorId": "#3a372f"}
    assert scheme["bands"][1] == {"sizeFrac": 0.85, "colorId": "#d9cdb8"}


def test_a_band_colour_with_no_share_of_the_wall_is_not_a_band():
    read = resolve_facade(_answer(facade_band_color_hex="#3a372f"), PALETTE)
    assert "facadeBands" not in read.facade


def test_a_share_with_no_second_colour_is_not_a_band():
    read = resolve_facade(_answer(facade_band_fraction=0.2), PALETTE)
    assert "facadeBands" not in read.facade


def test_a_band_covering_the_whole_wall_is_a_misread_not_a_band():
    read = resolve_facade(
        _answer(facade_band_color_hex="#3a372f", facade_band_fraction=1.0), PALETTE
    )
    assert "facadeBands" not in read.facade


# --- a finish this build cannot render ------------------------------------------------


def test_a_texture_outside_the_palette_is_reported_not_passed_through():
    """The palette is what the client said it can draw. Anything else would render as nothing."""
    read = resolve_facade(_answer(facade_texture="rusted_corten_steel"), PALETTE)
    assert "facadeTexture" not in read.facade
    assert any("rusted_corten_steel" in u for u in read.unsupported)


def test_a_glazing_style_outside_the_palette_is_reported():
    read = resolve_facade(_answer(glazing_style="stained_glass"), PALETTE)
    assert read.glazing_style == ""
    assert any("stained_glass" in u for u in read.unsupported)


def test_an_interior_id_outside_the_palette_is_dropped_field_by_field():
    """One bad id must not cost the room its whole scheme."""
    read = resolve_facade(
        _answer(
            interior=[
                RoomFinish(
                    kind="hall",
                    floor="brazilian_slate",
                    wall_color="terracotta",
                    wall_texture="matte_paint",
                    door_color="",
                )
            ]
        ),
        PALETTE,
    )
    assert read.interior["hall"] == {"wall_texture": "matte_paint", "wall_color": "terracotta"}


def test_an_interior_wall_colour_may_be_a_raw_hex():
    """getWallColorHexStr() in lib/materialsCatalog.ts has always taken a hex as well as an id."""
    read = resolve_facade(
        _answer(
            interior=[
                RoomFinish(
                    kind="bedroom",
                    floor="",
                    wall_color="#b4c3b5",
                    wall_texture="",
                    door_color="",
                )
            ]
        ),
        PALETTE,
    )
    assert read.interior["bedroom"] == {"wall_color": "#b4c3b5"}


def test_a_room_kind_the_catalog_does_not_hold_is_reported():
    read = resolve_facade(
        _answer(
            interior=[
                RoomFinish(
                    kind="home theatre",
                    floor="carrara_white",
                    wall_color="royal_navy",
                    wall_texture="matte_paint",
                    door_color="",
                )
            ]
        ),
        PALETTE,
    )
    assert "home theatre" not in read.interior
    assert any("home theatre" in u for u in read.unsupported)


# --- the generated programme ----------------------------------------------------------


def test_a_generated_room_the_catalog_cannot_express_is_reported_not_dropped():
    read = resolve_facade(_answer(rooms=["hall", "gym", "kitchen"]), PALETTE)
    assert read.rooms == ["hall", "kitchen"]
    assert any("gym" in u for u in read.unsupported)


def test_what_the_model_flagged_about_the_building_survives():
    """A sloped roof and a balcony are real things in the photo that this tool will not build."""
    read = resolve_facade(
        _answer(unsupported=["clay-tiled sloped roof", "first-floor balcony with railing"]),
        PALETTE,
    )
    assert "clay-tiled sloped roof" in read.unsupported
    assert "first-floor balcony with railing" in read.unsupported


def test_an_image_that_is_not_a_building_yields_no_rooms_and_says_why():
    read = resolve_facade(
        _answer(
            rooms=[],
            interior=[],
            facade_color_hex="",
            facade_texture="",
            glazing_style="",
            unsupported=["a floor plan drawing, not a photograph of a building"],
        ),
        PALETTE,
    )
    assert read.rooms == []
    assert read.interior == {}
    assert read.facade == {}
    assert any("not a photograph" in u for u in read.unsupported)


# --- the call itself ------------------------------------------------------------------


class _StubMessages:
    def __init__(self, payload):
        self.payload = payload
        self.seen: dict | None = None

    def parse(self, **kwargs):
        self.seen = kwargs
        return SimpleNamespace(parsed_output=self.payload, stop_reason="end_turn")


class _StubClient:
    def __init__(self, payload):
        self.messages = _StubMessages(payload)


def test_parse_facade_sends_the_image_the_palette_and_the_plot():
    """The palette has to reach the prompt, or the model picks ids this build cannot draw."""
    answer = _answer()
    stub = _StubClient(answer)

    result = parse_facade(PNG, "image/png", PALETTE, 30, 40, client=stub)

    assert result is answer
    assert stub.messages.seen["model"] == MODEL
    assert stub.messages.seen["output_format"] is FacadeRequest
    content = stub.messages.seen["messages"][0]["content"]
    assert content[0]["type"] == "image"
    listing = content[1]["text"]
    assert "30 ft wide by 40 ft deep" in listing
    for ids in (PALETTE.floors, PALETTE.wall_textures, PALETTE.glazing_styles):
        for one in ids:
            assert one in listing


def test_a_note_is_sent_after_the_photograph():
    stub = _StubClient(_answer())
    parse_facade(PNG, "image/png", PALETTE, 30, 40, note="the road is on the left", client=stub)
    assert "road is on the left" in stub.messages.seen["messages"][0]["content"][-1]["text"]


def test_a_declined_request_is_raised_rather_than_returned_empty():
    refusing = _StubClient(None)
    refusing.messages.parse = lambda **_kwargs: SimpleNamespace(
        parsed_output=None, stop_reason="refusal"
    )
    with pytest.raises(RuntimeError, match="no facade"):
        parse_facade(PNG, "image/png", PALETTE, 30, 40, client=refusing)


def test_no_credential_is_its_own_error_not_a_guess(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(MissingCredential, match="photograph of a house"):
        parse_facade(PNG, "image/png", PALETTE, 30, 40)


# --- the body this produces is one /solve accepts --------------------------------------


def test_a_resolved_facade_reading_solves():
    """The generated programme has to be a programme CP-SAT will actually pack."""
    from fastapi.testclient import TestClient

    from api.main import app

    read = resolve_facade(_answer(), PALETTE)
    r = TestClient(app).post(
        "/solve",
        json={
            "plot_w_in": 360,
            "plot_d_in": 480,
            "facing": "N",
            "floors": read.storeys,
            "rooms": read.rooms,
            "apply_zone_rules": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
