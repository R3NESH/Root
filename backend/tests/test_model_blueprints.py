"""The prebuilt plans must obey the same floors the solver does.

`frontend/lib/modelBlueprints.ts` ships 25 hand-drawn plans, and each one pins its room sizes
through `customDims`. Pinned means the solver does not size that room: the number in the TypeScript
file is the number that gets built. So every minimum this package enforces as a hard constraint --
the NBC floors in `solver/rooms.py` -- is simply not applied to a prebuilt plan. It was a hole, and
17 of 181 pinned rooms were through it, including a 7x6 bedroom at half the NBC habitable floor and
three kitchens 6 ft wide against a 7 ft minimum whose own comment says the counter run and the
walkway stop coexisting below it.

A posted rule is a constraint, not a score -- notes/decisions/zone-rule-is-a-constraint.md. That has
always held inside the model and had never been checked out here.

## Why a Python test reads a TypeScript file

The minimums live in `ROOM_CATALOG`, in this package. Re-stating them in TypeScript to test them in
TypeScript would create a second source of truth that can drift from the first, which is the bug
this test exists to prevent, one layer up. The parse is a regex over a file whose shape is stable,
and the counts asserted below are there so that a format change makes this test *fail* rather than
quietly stop checking anything.
"""

import re
from pathlib import Path

import pytest

from solver.rooms import ROOM_CATALOG

BLUEPRINTS_TS = (
    Path(__file__).resolve().parents[2] / "frontend" / "lib" / "modelBlueprints.ts"
)

# NBC 2016, habitable room, second onward: 7.5 m2 and 2.4 m of width. The first room in a
# single-room dwelling is held to 9.5 m2, which none of these plans is.
NBC_HABITABLE_SQ_FT = 81
NBC_HABITABLE_WIDTH_FT = 7.9

# Hall and bedroom only, and `dining` is left out for a reason worth stating rather than hiding.
#
# The catalog's dining minimum is 8x8 = 64 sq ft, under the NBC floor. Raising it to 8x11 was
# tried and put the 3BHK on a 30x40 back to INFEASIBLE, which is the plot size this whole catalog
# was retuned to make work. The defensible reading is that an 8x8 dining in an Indian plan is an
# open area off the hall, not an enclosed room, and NBC's room minimum does not bind it.
#
# That reading is not modelled anywhere, so this exclusion is a known compromise and not a
# finding. See solver/rooms.py and notes/solver/room-sizes-from-code.md. Dining rooms are still
# held to the catalog floor by the test above.
HABITABLE = {"hall", "bedroom"}

# A parse that finds far fewer than this has broken, and a test that checks nothing is worse than
# no test. Both are floors, not exact counts: adding plans should not fail the suite.
MIN_PLANS_PARSED = 20
MIN_PINNED_ROOMS_PARSED = 150


def _pinned_rooms() -> list[tuple[str, str, float, float]]:
    """(plan id, room kind, width ft, depth ft) for every pinned room in every plan."""
    src = BLUEPRINTS_TS.read_text(encoding="utf-8")
    out: list[tuple[str, str, float, float]] = []
    plans = 0
    for block in re.split(r"\n  \{\n", src):
        plan_id = re.search(r'id:\s*"([^"]+)"', block)
        if not plan_id:
            continue
        plans += 1
        dims = re.search(r"customDims:\s*\{(.*?)\n    \}", block, re.S)
        if not dims:
            continue
        for m in re.finditer(
            r'"?([A-Za-z_]+)_\d+"?:\s*\{\s*wFt:\s*([\d.]+),\s*dFt:\s*([\d.]+)', dims.group(1)
        ):
            out.append((plan_id.group(1), m.group(1), float(m.group(2)), float(m.group(3))))

    assert plans >= MIN_PLANS_PARSED, f"only parsed {plans} plans - has the file format changed?"
    assert (
        len(out) >= MIN_PINNED_ROOMS_PARSED
    ), f"only parsed {len(out)} pinned rooms - has the file format changed?"
    return out


def test_the_blueprints_file_is_still_parseable():
    """Guards the two assertions above on their own, so a format change reads as a format change."""
    rooms = _pinned_rooms()
    kinds = {kind for _, kind, _, _ in rooms}
    assert kinds, "no room kinds parsed"
    unknown = kinds - set(ROOM_CATALOG)
    assert not unknown, f"prebuilt plans name rooms the catalog does not have: {sorted(unknown)}"


def test_every_pinned_room_clears_the_catalog_minimum():
    """A pinned size is the size that gets built, so it has to be one the solver would allow.

    Either orientation counts: the catalog states a minimum width and a minimum depth, and a room
    turned through ninety degrees is the same room.
    """
    bad = []
    for plan, kind, w, d in _pinned_rooms():
        room = ROOM_CATALOG[kind]
        min_w = room.min_w_in / 12
        min_d = room.min_d_in / 12
        fits = (w >= min_w and d >= min_d) or (w >= min_d and d >= min_w)
        if not fits:
            bad.append(f"{plan}: {kind} {w:g}x{d:g} under catalog minimum {min_w:g}x{min_d:g}")
    assert not bad, "pinned rooms below the catalog floor:\n  " + "\n  ".join(bad)


def test_every_pinned_habitable_room_clears_nbc():
    """Floor area and least width, for the rooms people live in.

    Separate from the catalog test because the catalog minimum is a design floor that happens to
    sit above the code in most places; this is the code itself, and it is the one that would stop a
    plan being sanctioned.
    """
    bad = []
    for plan, kind, w, d in _pinned_rooms():
        if kind not in HABITABLE:
            continue
        if w * d < NBC_HABITABLE_SQ_FT:
            bad.append(f"{plan}: {kind} {w:g}x{d:g} = {w * d:g} sq ft, NBC floor is {NBC_HABITABLE_SQ_FT}")
        if min(w, d) < NBC_HABITABLE_WIDTH_FT:
            bad.append(
                f"{plan}: {kind} {w:g}x{d:g} is {min(w, d):g} ft wide, NBC minimum is {NBC_HABITABLE_WIDTH_FT}"
            )
    assert not bad, "pinned habitable rooms below NBC 2016:\n  " + "\n  ".join(bad)


@pytest.mark.parametrize("kind", sorted(HABITABLE))
def test_the_catalog_itself_clears_nbc_for_habitable_rooms(kind: str):
    """The floor the test above measures against has to be met by the catalog too.

    Without this, raising a catalog minimum could silently drop below the code and every prebuilt
    plan would still pass, because they are only ever measured against the catalog.
    """
    room = ROOM_CATALOG[kind]
    w = room.min_w_in / 12
    d = room.min_d_in / 12
    assert w * d >= NBC_HABITABLE_SQ_FT, f"{kind} minimum {w:g}x{d:g} is under the NBC floor"
    assert min(w, d) >= NBC_HABITABLE_WIDTH_FT, f"{kind} minimum is {min(w, d):g} ft wide"

