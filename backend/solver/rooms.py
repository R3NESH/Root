"""Room definitions for the solver.

All sizes are in inches — see notes/decisions/integer-inches.md.

The v1 catalog held five kinds (hall, kitchen, bedroom, bathroom, pooja). That is enough to
test a packer and not enough to describe a house — see notes/solver/realism-gaps.md, which
added six more. Four of those (parking porch, sit-out, staircase, utility) were removed again
on 2026-08-25; the reasons are in notes/decisions/rejected-approaches.md.

Each room carries the properties the constraints need, rather than the solver special-casing
names:

- `habitable`  — people spend time here, so it needs an exterior wall for light and
                 ventilation (and, in most Indian bye-laws, an openable area of roughly a
                 tenth of the floor area). Stores and bathrooms are exempt from the daylight
                 half of that; see `wet` for why bathrooms are not exempt from the rest.
- `wet`        — carries plumbing, and therefore needs ventilation even though nobody lingers.
- `max_aspect` — how elongated the room may be, x10 to stay integral. A bedroom that is four
                 times as long as it is wide is a corridor.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Room:
    name: str
    min_w_in: int
    max_w_in: int
    min_d_in: int
    max_d_in: int
    habitable: bool = True
    wet: bool = False
    max_aspect_x10: int = 18  # 1.8:1


def ft(feet: float) -> int:
    return round(feet * 12)


# Deliberately generous ranges relative to a 30x40 ft (360x480 in) test envelope — see
# backend/tests/test_solver.py for why headroom matters for reliably-feasible test fixtures.
ROOM_CATALOG: dict[str, Room] = {
    # --- habitable, dry ---------------------------------------------------------------
    "bedroom": Room("bedroom", ft(10), ft(14), ft(10), ft(13)),
    "hall": Room("hall", ft(11), ft(15), ft(12), ft(16)),
    "dining": Room("dining", ft(8), ft(12), ft(8), ft(12)),
    "entrance": Room("entrance", ft(5), ft(8), ft(4), ft(7)),
    # --- habitable, wet ---------------------------------------------------------------
    "kitchen": Room("kitchen", ft(8), ft(11), ft(8), ft(10), wet=True),
    # --- service: no daylight requirement ---------------------------------------------
    "pooja": Room("pooja", ft(3), ft(5), ft(3), ft(5), habitable=False),
    "bathroom": Room("bathroom", ft(5), ft(7), ft(7), ft(8), habitable=False, wet=True),
    "store": Room("store", ft(4), ft(7), ft(4), ft(7), habitable=False),
}
