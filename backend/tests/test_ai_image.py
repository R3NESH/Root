"""backend/ai — a floor plan photo to solver constraints.

No key and no network in here, for the reason test_ai_prompt.py gives: what a unit test can hold
the model to is nothing. What it can hold *this module* to is the three things that make the
feature honest rather than impressive — the upload is checked before it is sent, a printed
dimension becomes a band and not a pin, and an image that is not a floor plan produces no rooms.
"""

import base64
from types import SimpleNamespace

import pytest

from ai import ImagePlanRequest, MODEL, parse_image, resolve_image
from ai.plan_from_image import (
    MAX_IMAGE_BYTES,
    MAX_ROOM_FT,
    SIZE_BAND_FT,
    BadImage,
)
from ai.prompt_constraints import MissingCredential

PNG = base64.standard_b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()


def _answer(**overrides) -> ImagePlanRequest:
    """A plausible reading of a 30x40 plan, with the field under test overridden."""
    base = dict(
        plot_w_ft=30.0,
        plot_d_ft=40.0,
        facing="N",
        floors=1,
        rooms=["hall", "kitchen", "bedroom"],
        room_sizes=[[12.0, 10.0], [8.0, 7.0], [11.0, 10.0]],
        near=[],
        apply_vaastu=True,
        unsupported=[],
    )
    base.update(overrides)
    return ImagePlanRequest(**base)


# --- the upload, before anything is sent ----------------------------------------------


def test_a_media_type_the_api_does_not_accept_is_refused_here():
    with pytest.raises(BadImage, match="image/tiff"):
        parse_image(PNG, "image/tiff")


def test_a_missing_media_type_is_refused_by_name():
    with pytest.raises(BadImage, match="no image type"):
        parse_image(PNG, "")


def test_a_data_url_prefix_is_an_error_not_silently_discarded_bytes():
    """`data:image/png;base64,` in front of the payload is the commonest client bug.

    Without validate=True base64 drops the prefix and decodes the rest, which reaches the API as
    an unreadable image and comes back as something much harder to diagnose than a 400.
    """
    with pytest.raises(BadImage, match="base64"):
        parse_image(f"data:image/png;base64,{PNG}", "image/png")


def test_an_empty_image_is_refused():
    with pytest.raises(BadImage, match="empty"):
        parse_image("", "image/png")


def test_an_oversized_image_is_refused_before_it_is_uploaded():
    too_big = base64.standard_b64encode(b"0" * (MAX_IMAGE_BYTES + 1)).decode()
    with pytest.raises(BadImage, match="over the"):
        parse_image(too_big, "image/jpeg")


def test_the_upload_is_checked_before_the_credential_is():
    """A bad upload must not be reported as a missing key, or the client chases the wrong bug."""
    with pytest.raises(BadImage):
        parse_image("not base64 at all!!", "image/tiff")


# --- a printed dimension becomes a band, not a pin ------------------------------------


def test_a_printed_dimension_becomes_a_band_around_itself():
    """The whole reason this module exists. See ai/plan_from_image.py on why a pin is wrong."""
    read = resolve_image(_answer(rooms=["hall"], room_sizes=[[12.0, 10.0]]))
    spec = read.room_specs[0]
    band = round(SIZE_BAND_FT * 12)
    assert spec["min_w_in"] == round(12 * 12) - band
    assert spec["max_w_in"] == round(12 * 12) + band
    assert spec["min_d_in"] == round(10 * 12) - band
    assert spec["max_d_in"] == round(10 * 12) + band
    assert "custom_w_in" not in spec
    assert read.read_dimensions


def test_a_room_with_no_printed_dimension_is_left_to_the_catalog():
    read = resolve_image(_answer(rooms=["hall", "kitchen"], room_sizes=[[12.0, 10.0], [0, 0]]))
    assert read.room_specs[1] == {"name": "kitchen"}


def test_a_drawing_that_printed_nothing_says_so():
    read = resolve_image(_answer(rooms=["hall", "kitchen"], room_sizes=[[0, 0], [0, 0]]))
    assert not read.read_dimensions
    assert read.room_specs == [{"name": "hall"}, {"name": "kitchen"}]


def test_one_printed_axis_is_used_even_when_the_other_is_not():
    read = resolve_image(_answer(rooms=["hall"], room_sizes=[[12.0, 0]]))
    spec = read.room_specs[0]
    assert "min_w_in" in spec
    assert "min_d_in" not in spec
    assert read.read_dimensions


def test_a_misread_dimension_is_dropped_rather_than_believed():
    """A whole-plot figure read as a room, or millimetres read as feet."""
    read = resolve_image(_answer(rooms=["bedroom"], room_sizes=[[MAX_ROOM_FT + 1, 3000.0]]))
    assert read.room_specs == [{"name": "bedroom"}]
    assert not read.read_dimensions


def test_a_short_or_malformed_size_list_does_not_shift_the_remaining_rooms():
    """The model is told to keep the lists the same length. This is what happens when it does not."""
    read = resolve_image(_answer(rooms=["hall", "kitchen", "bedroom"], room_sizes=[[12.0, 10.0]]))
    assert [s["name"] for s in read.room_specs] == ["hall", "kitchen", "bedroom"]
    assert "min_w_in" in read.room_specs[0]
    assert read.room_specs[1] == {"name": "kitchen"}
    assert read.room_specs[2] == {"name": "bedroom"}


def test_sizes_stay_with_their_rooms_across_a_label_the_catalog_cannot_express():
    """A GYM between two real rooms must not slide the kitchen's dimensions onto the bedroom."""
    read = resolve_image(
        _answer(
            rooms=["hall", "gym", "kitchen"],
            room_sizes=[[12.0, 10.0], [20.0, 20.0], [8.0, 7.0]],
        )
    )
    assert [s["name"] for s in read.room_specs] == ["hall", "kitchen"]
    assert read.room_specs[1]["min_w_in"] == round(8 * 12) - round(SIZE_BAND_FT * 12)
    assert any("gym" in u for u in read.plan.unsupported)


# --- an image that is not a floor plan ------------------------------------------------


def test_a_photograph_of_a_house_yields_no_rooms_and_says_why():
    """An exterior photo has no interior walls in it. A layout from one would be invented."""
    read = resolve_image(
        _answer(
            rooms=[],
            room_sizes=[],
            plot_w_ft=0,
            plot_d_ft=0,
            facing="",
            unsupported=["a photograph of a house from the street, not a floor plan"],
        )
    )
    assert read.room_specs == []
    assert not read.read_dimensions
    assert read.plan.rooms == []
    assert read.plan.assumed_plot
    assert any("not a floor plan" in u for u in read.plan.unsupported)


# --- everything the text path already validates still happens -------------------------


def test_the_shared_validation_still_runs():
    read = resolve_image(
        _answer(rooms=["hall", "gym", "bedroom"], room_sizes=[[0, 0]] * 3, near=[[0, 2]], facing="x")
    )
    assert read.plan.rooms == ["hall", "bedroom"]
    assert read.plan.near == [[0, 1]]
    assert read.plan.facing == "N"
    assert read.plan.assumed_facing


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


def test_parse_image_sends_the_image_and_asks_for_the_schema():
    answer = _answer()
    stub = _StubClient(answer)

    result = parse_image(PNG, "image/png", client=stub)

    assert result is answer
    assert stub.messages.seen["model"] == MODEL
    assert stub.messages.seen["output_format"] is ImagePlanRequest
    content = stub.messages.seen["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"] == {
        "type": "base64",
        "media_type": "image/png",
        "data": PNG,
    }


def test_a_note_is_sent_after_the_drawing_not_instead_of_it():
    stub = _StubClient(_answer())
    parse_image(PNG, "image/png", note="this is the ground floor", client=stub)

    content = stub.messages.seen["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert "ground floor" in content[-1]["text"]


def test_a_blank_note_adds_nothing():
    stub = _StubClient(_answer())
    parse_image(PNG, "image/png", note="   ", client=stub)
    assert len(stub.messages.seen["messages"][0]["content"]) == 2


def test_a_declined_request_is_raised_rather_than_returned_empty():
    refusing = _StubClient(None)
    refusing.messages.parse = lambda **_kwargs: SimpleNamespace(
        parsed_output=None, stop_reason="refusal"
    )

    with pytest.raises(RuntimeError, match="no plan"):
        parse_image(PNG, "image/png", client=refusing)


def test_no_credential_is_its_own_error_not_a_guess(monkeypatch):
    """There is no offline path here on purpose — notes/architecture/client-side-fallback.md."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(MissingCredential, match="uploaded plan"):
        parse_image(PNG, "image/png")


# --- the body this produces is one /solve accepts --------------------------------------


def test_a_resolved_reading_solves():
    """The end the endpoint stops at. resolve_image() hands back constraints, not a plan, so the
    thing worth checking is that CP-SAT accepts them and the bands land on the rooms.

    This is also the guard on the band itself: the same mix pinned instead of banded is what
    ai/plan_from_image.py exists to avoid sending.
    """
    from fastapi.testclient import TestClient

    from api.main import app

    read = resolve_image(
        _answer(
            rooms=["hall", "kitchen", "bedroom", "bedroom", "bathroom"],
            room_sizes=[[12.0, 14.0], [8.0, 9.0], [11.0, 12.0], [10.0, 11.0], [5.0, 7.0]],
        )
    )
    plan = read.plan
    body = {
        "plot_w_in": round(plan.plot_w_ft * 12),
        "plot_d_in": round(plan.plot_d_ft * 12),
        "facing": plan.facing,
        "rooms": read.room_specs,
        "apply_vaastu": plan.apply_vaastu,
    }

    r = TestClient(app).post("/solve", json=body)
    assert r.status_code == 200
    out = r.json()
    assert out["meta"]["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(out["rooms"]) == 5

    # Every room landed inside the band read off the drawing, not at a pinned size.
    by_spec = {s["name"]: s for s in read.room_specs if s["name"] != "bedroom"}
    for room in out["rooms"]:
        spec = by_spec.get(room["name"])
        if spec and "min_w_in" in spec:
            assert spec["min_w_in"] <= room["w_in"] <= spec["max_w_in"]
            assert spec["min_d_in"] <= room["d_in"] <= spec["max_d_in"]
