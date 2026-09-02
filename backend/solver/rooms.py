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

    # --- cafe / small restaurant -------------------------------------------------------
    # One vocabulary, not one per building type: a name means the same thing everywhere, and
    # programs/registry.py decides which subset a given programme offers. Sizes come from the
    # trade figures in notes/programs/cafe-layout-standards.md - 15-20 sq ft per seated
    # customer, a 36 in minimum aisle, a queue 36 in wide and 10-12 ft long, and the first
    # five feet inside the door kept clear.
    #
    # `habitable` still means "needs an exterior wall for light and air", which is why the
    # seating floor and the shopfront carry it and the till does not. `wet` still means
    # plumbing, so it decides ventilation for the kitchen, the wash-up and the WC.
    "seating": Room("seating", ft(12), ft(30), ft(12), ft(30), max_aspect_x10=22),
    "lounge": Room("lounge", ft(8), ft(16), ft(8), ft(16), max_aspect_x10=20),
    "entry": Room("entry", ft(5), ft(10), ft(5), ft(8), max_aspect_x10=25),
    # A queue is a corridor on purpose - the aspect cap that stops a bedroom becoming one is
    # exactly wrong here.
    "queue": Room("queue", ft(3.5), ft(6), ft(8), ft(14), habitable=False, max_aspect_x10=40),
    # So is a counter: it is a bar, and the order and pickup ends have to be far enough apart
    # that the handoff does not block the till.
    "counter": Room("counter", ft(8), ft(18), ft(3.5), ft(7), habitable=False, max_aspect_x10=45),
    "prep": Room("prep", ft(9), ft(18), ft(8), ft(14), wet=True, max_aspect_x10=20),
    "pantry": Room("pantry", ft(5), ft(9), ft(5), ft(9), habitable=False),
    "wash": Room("wash", ft(5), ft(8), ft(5), ft(8), habitable=False, wet=True),
    "washroom": Room("washroom", ft(5), ft(8), ft(6), ft(9), habitable=False, wet=True),
    "staff": Room("staff", ft(6), ft(10), ft(6), ft(10), habitable=False),
}
