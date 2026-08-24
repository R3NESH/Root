"""Settle notes/solver/claim-most-likely-wrong.md with numbers, not reasoning.

    python -m solver.bench_stability     (from backend/, inside the venv)

The claim under test: that layout stability is a hard problem worth building around. If CP-SAT
already returns near-identical layouts across small input perturbations WITHOUT the drift
objective, then notes/solver/layout-stability.md is solving a problem that does not exist and
the differentiator evaporates.

Runs the same 10-edit sequence with the objective off and on, and prints total displacement
(in inches) and solve time for each.
"""

import random

from .model import solve_layout
from .rooms import ROOM_CATALOG

ENV_W_IN = 360
ENV_D_IN = 480
MIX = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]


def positions(result) -> dict[int, tuple[int, int]]:
    return {i: (r.x_in, r.y_in) for i, r in enumerate(result.rooms)}


def displacement(a, b) -> int:
    return sum(abs(a[i][0] - b[i][0]) + abs(a[i][1] - b[i][1]) for i in a if i in b)


def edit_sequence(n: int = 10) -> list[int]:
    rng = random.Random(7)
    return [ENV_W_IN + rng.choice([-12, -6, 0, 6, 12]) for _ in range(n)]


def run(use_drift: bool, apply_vaastu: bool) -> tuple[list[int], list[float]]:
    rooms = [ROOM_CATALOG[n] for n in MIX]
    base = solve_layout(ENV_W_IN, ENV_D_IN, rooms, apply_vaastu=apply_vaastu)
    prev = positions(base)
    drifts, times = [], []
    for env_w in edit_sequence():
        result = solve_layout(
            env_w, ENV_D_IN, rooms, prev=prev if use_drift else None, apply_vaastu=apply_vaastu
        )
        current = positions(result)
        drifts.append(displacement(prev, current))
        times.append(result.solve_ms)
        prev = current
    return drifts, times


def report(label: str, drifts: list[int], times: list[float]) -> None:
    print(f"\n{label}")
    print(f"  displacement per edit (in): {drifts}")
    print(f"  total displacement:         {sum(drifts)} in")
    print(f"  max single-edit jump:       {max(drifts)} in")
    print(f"  solve ms  min/mean/max:     {min(times):.1f} / {sum(times) / len(times):.1f} / {max(times):.1f}")


def main() -> None:
    print("=" * 68)
    print("Layout stability benchmark — 5 rooms, 10 perturbed edits, 30x40ft envelope")
    print("=" * 68)

    off_d, off_t = run(use_drift=False, apply_vaastu=False)
    report("WITHOUT drift objective (the null hypothesis)", off_d, off_t)

    on_d, on_t = run(use_drift=True, apply_vaastu=False)
    report("WITH drift objective", on_d, on_t)

    von_d, von_t = run(use_drift=True, apply_vaastu=True)
    report("WITH drift + Vaastu (the predicted failure mode)", von_d, von_t)

    print("\n" + "-" * 68)
    print(f"VERDICT: drift objective reduces total displacement "
          f"{sum(off_d)} in -> {sum(on_d)} in "
          f"({100 * (1 - sum(on_d) / sum(off_d)):.1f}% reduction)" if sum(off_d) else "VERDICT: no drift without objective")
    print(f"         slowest solve with everything on: {max(von_t):.1f} ms (budget 500 ms)")
    print("-" * 68)


if __name__ == "__main__":
    main()
