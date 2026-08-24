"""Run the solver on a default 4-6 room mix in a fixed 30x40 ft envelope, print JSON.

    python -m solver.demo          (run from backend/, inside the venv)

Shape matches notes/architecture/output-schema.md — floor/wall_thickness_in/openings are
placeholders in Phase 1, per notes/decisions/single-storey-first.md.
"""

import json

from .model import solve_layout
from .rooms import ROOM_CATALOG

ENV_W_IN = 360  # 30 ft
ENV_D_IN = 480  # 40 ft

DEFAULT_MIX = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]


def main() -> None:
    rooms = [ROOM_CATALOG[name] for name in DEFAULT_MIX]
    result = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=True)

    payload = {
        "plot": {"w_in": ENV_W_IN, "d_in": ENV_D_IN, "facing": "N"},
        "rooms": [
            {
                "name": r.name,
                "floor": 0,
                "x_in": r.x_in,
                "y_in": r.y_in,
                "w_in": r.w_in,
                "d_in": r.d_in,
                "wall_thickness_in": None,
                "openings": [],
            }
            for r in result.rooms
        ],
        "meta": {
            "status": result.status,
            "solve_ms": round(result.solve_ms, 2),
            "vaastu_constraints_applied": result.vaastu_constraints_applied,
        },
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
