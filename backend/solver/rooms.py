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


# Minimums are the National Building Code of India 2016 floor, not a test fixture.
#
# They used to be "deliberately generous ranges relative to a 30x40 test envelope", which is a
# sentence about making tests pass, and solver/bench_realism.py measured what it cost: a 1BHK
# would not fit a 20x30 plot, a 2BHK would not fit a 25x40, and a 3BHK would not fit a 30x40 —
# the three most common things India builds in this band. The old hall minimum alone was 11x12,
# a foot wider than any code or builder asks for.
#
# NBC 2016: a habitable room is at least 9.5 m2 (~102 sq ft) in a single-room dwelling and
# 7.5 m2 (~81 sq ft) for the second room onward, with a minimum width of 2.4 m (~7.9 ft) and a
# clear height of 2.75 m (~9 ft) — which is where WALL_HEIGHT_FT = 9.0 already sits. Bathrooms
# have a 1.5 m2 (~16 sq ft) floor. Market-typical sizes, which set the maximums, come from what
# Indian builders actually draw. Both are cited in notes/solver/room-sizes-from-code.md.
#
# Maximums are unchanged where they were already sane. They matter for a different reason:
# fill measured against catalog_fill_ceiling() shows when the CATALOG, not the plot, is what
# stops a house growing.
ROOM_CATALOG: dict[str, Room] = {
    # --- habitable, dry ---------------------------------------------------------------
    # 10x10 is the NBC-compliant bedroom floor (100 sq ft, 10 ft wide); 12x14 is a master.
    "bedroom": Room("bedroom", ft(10), ft(14), ft(10), ft(14)),
    # A 10x12 living room is the practical Indian minimum; 15x16 is a large hall.
    "hall": Room("hall", ft(10), ft(15), ft(12), ft(16)),
    "dining": Room("dining", ft(8), ft(12), ft(8), ft(12)),
    "entrance": Room("entrance", ft(4), ft(8), ft(4), ft(7)),
    # --- habitable, wet ---------------------------------------------------------------
    # 7x8 is the smallest kitchen that still works as one; below 7 ft wide the counter run and
    # the walkway stop coexisting.
    "kitchen": Room("kitchen", ft(7), ft(11), ft(8), ft(10), wet=True),
    # --- service: no daylight requirement ---------------------------------------------
    "pooja": Room("pooja", ft(3), ft(5), ft(3), ft(5), habitable=False),
    # 4x6 clears the NBC 1.5 m2 floor and is a real Indian bathroom. A 5 ft minimum was carried
    # briefly because test_every_room_gets_a_window_or_a_vent_where_it_can failed at 4 ft - but
    # the cause was connectivity gating VENTS on a WINDOW-sized wall, not the room being too
    # small. See VENT_MIN_WALL_IN.
    "bathroom": Room("bathroom", ft(4), ft(7), ft(6), ft(8), habitable=False, wet=True),
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
