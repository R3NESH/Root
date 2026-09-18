"""backend/ai — free text to solver constraints.

No key and no network in here, and none wanted: what a unit test can hold the model to is
nothing. What it can hold *this module* to is that the model's answer is checked against the
catalog before it reaches the solver, which is the whole reason the module exists.

`parse_prompt()` is exercised through an injected stub, so the wiring is covered without
spending money on a request whose answer would not be asserted anyway.
"""

from types import SimpleNamespace

import pytest

from ai import MODEL, PlanRequest, parse_prompt, resolve
from ai.prompt_constraints import (
    DEFAULT_PLOT_D_FT,
    DEFAULT_PLOT_W_FT,
    MissingCredential,
)


def _answer(**overrides) -> PlanRequest:
    """A plausible model answer, with the field under test overridden."""
    base = dict(
        plot_w_ft=30.0,
        plot_d_ft=40.0,
        facing="N",
        floors=1,
        rooms=["hall", "kitchen", "bedroom"],
        near=[],
        unsupported=[],
    )
    base.update(overrides)
    return PlanRequest(**base)


# --- what the catalog cannot express --------------------------------------------------


def test_a_room_the_catalog_does_not_hold_is_reported_not_dropped():
    """The whole point. A swimming pool that quietly vanishes is a lie about the plan."""
    plan = resolve(_answer(rooms=["hall", "swimming pool", "kitchen"]))
    assert plan.rooms == ["hall", "kitchen"]
    assert any("swimming pool" in u for u in plan.unsupported)


def test_what_the_model_already_flagged_survives_validation():
    plan = resolve(_answer(unsupported=["a lift", "under 30 lakh"]))
    assert plan.unsupported == ["a lift", "under 30 lakh"]


# --- index remapping ------------------------------------------------------------------


def test_near_indices_are_remapped_across_a_rejected_room():
    """The model paired rooms[1] with rooms[3] — either side of a name the catalog lacks.

    After the removal those two are rooms[1] and rooms[2]. Left unmapped, the pair would name
    the wrong rooms rather than no rooms, which is the failure api/main.py has the same guard
    against.
    """
    plan = resolve(_answer(rooms=["hall", "kitchen", "gym", "bedroom"], near=[[1, 3]]))
    assert plan.rooms == ["hall", "kitchen", "bedroom"]
    assert plan.near == [[1, 2]]


def test_a_pair_naming_a_rejected_room_is_dropped():
    plan = resolve(_answer(rooms=["hall", "gym", "bedroom"], near=[[1, 2]]))
    assert plan.near == []


def test_a_room_paired_with_itself_is_dropped():
    plan = resolve(_answer(near=[[2, 2]]))
    assert plan.near == []


# --- defaults the caller has to be told about -----------------------------------------


def test_an_unstated_plot_and_facing_are_flagged_as_assumed():
    """A 30x40 north-facing plot the person never mentioned is a question, not an answer."""
    plan = resolve(_answer(plot_w_ft=0, plot_d_ft=0, facing=""))
    assert plan.assumed_plot
    assert plan.assumed_facing
    assert (plan.plot_w_ft, plan.plot_d_ft) == (DEFAULT_PLOT_W_FT, DEFAULT_PLOT_D_FT)
    assert plan.facing == "N"


def test_a_stated_plot_and_facing_are_not_flagged():
    plan = resolve(_answer(plot_w_ft=25.0, plot_d_ft=50.0, facing="e"))
    assert not plan.assumed_plot
    assert not plan.assumed_facing
    assert plan.facing == "E"


def test_a_facing_the_solver_does_not_know_falls_back_and_says_so():
    plan = resolve(_answer(facing="north-east"))
    assert plan.facing == "N"
    assert plan.assumed_facing


def test_floors_are_clamped_to_what_the_solver_models():
    assert resolve(_answer(floors=0)).floors == 1
    assert resolve(_answer(floors=9)).floors == 3


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


def test_parse_prompt_asks_for_the_schema_and_returns_what_came_back():
    answer = _answer(rooms=["hall", "kitchen", "bedroom", "bedroom", "parking"])
    stub = _StubClient(answer)

    result = parse_prompt("30x40 north facing 2bhk with car parking", client=stub)

    assert result is answer
    assert stub.messages.seen["model"] == MODEL
    assert stub.messages.seen["output_format"] is PlanRequest
    assert stub.messages.seen["messages"][0]["content"].startswith("30x40")


def test_a_declined_request_is_raised_rather_than_returned_empty():
    """A safety classifier can decline: HTTP 200, nothing parsed, no exception from the SDK."""
    refusing = _StubClient(None)
    refusing.messages.parse = lambda **_kwargs: SimpleNamespace(
        parsed_output=None, stop_reason="refusal"
    )

    with pytest.raises(RuntimeError, match="no plan"):
        parse_prompt("...", client=refusing)


def test_no_credential_is_its_own_error_not_a_guess(monkeypatch):
    """There is no offline path here on purpose — notes/architecture/client-side-fallback.md."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(MissingCredential):
        parse_prompt("30x40 north facing 2bhk")
