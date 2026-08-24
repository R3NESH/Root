"""Room definitions for the solver.

All sizes are in inches — see notes/decisions/integer-inches.md. This catalog is a starting
point for step 2's test fixtures; it becomes the real room-tray vocabulary at
notes/ui/ui-principles.md #5 once that UI lands.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Room:
    name: str
    min_w_in: int
    max_w_in: int
    min_d_in: int
    max_d_in: int


def ft(feet: float) -> int:
    return round(feet * 12)


# Deliberately generous ranges relative to a 30x40 ft (360x480 in) test envelope — see
# backend/tests/test_solver.py for why headroom matters for reliably-feasible test fixtures.
ROOM_CATALOG: dict[str, Room] = {
    "bedroom": Room("bedroom", ft(10), ft(14), ft(10), ft(13)),
    "kitchen": Room("kitchen", ft(8), ft(11), ft(8), ft(10)),
    "bathroom": Room("bathroom", ft(5), ft(7), ft(7), ft(8)),
    "hall": Room("hall", ft(11), ft(15), ft(12), ft(16)),
    "pooja": Room("pooja", ft(3), ft(5), ft(3), ft(5)),
}
