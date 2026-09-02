"""Tests for prompt-to-plan natural language parser and solver pipeline."""

import pytest
from prompt_to_plan import parse_prompt, solve_from_prompt


def test_parse_prompt_standard_2bhk():
    parsed = parse_prompt("30x40 north facing 2bhk with pooja")
    assert parsed.plot_w_ft == 30.0
    assert parsed.plot_d_ft == 40.0
    assert parsed.facing == "N"
    assert "pooja" in parsed.room_names
    assert "hall" in parsed.room_names
    assert "kitchen" in parsed.room_names
    assert parsed.room_names.count("bedroom") == 2
    assert parsed.apply_vaastu is True


def test_parse_prompt_variations():
    # East facing 3BHK with store
    p1 = parse_prompt("40 by 60 East facing 3 BHK with store and dining")
    assert p1.plot_w_ft == 40.0
    assert p1.plot_d_ft == 60.0
    assert p1.facing == "E"
    assert p1.room_names.count("bedroom") == 3
    assert "store" in p1.room_names
    assert "dining" in p1.room_names

    # South facing 1BHK no vaastu
    p2 = parse_prompt("20x30 south facing 1bhk without vaastu")
    assert p2.plot_w_ft == 20.0
    assert p2.plot_d_ft == 30.0
    assert p2.facing == "S"
    assert p2.room_names.count("bedroom") == 1
    assert p2.apply_vaastu is False


def test_solve_from_prompt_e2e():
    res = solve_from_prompt("30x40 north facing 2bhk with pooja")
    data = res["data"]
    meta = data["meta"]

    assert meta["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(data["rooms"]) >= 5
    assert data["plot"]["w_ft"] == 30.0
    assert data["plot"]["d_ft"] == 40.0
    assert data["plot"]["facing"] == "N"

    # Verify SVG and ASCII generated
    assert "<svg" in res["svg"]
    assert len(res["ascii"]) > 0
