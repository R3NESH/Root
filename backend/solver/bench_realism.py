"""Turn "is the plan realistic?" into numbers, not an opinion.

    python -m solver.bench_realism        (from backend/, inside the venv)

notes/solver/realism-gaps.md fixed six families of nonsense — 5 ft x 16 ft bedrooms, windowless
rooms, 40% envelope fill — and measured every one before and after. This benchmark is the same
instrument pointed at what is still wrong, so the next round of realism work also has a before
and an after instead of a vibe.

Five metrics, each chosen because a real plan would fail it visibly:

1. **Feasibility.** Does the mix fit the plot at all? A 3BHK on a 30x40 is the most common thing
   India builds in this size band. If the solver cannot return one, no other metric matters.

2. **Void inside the footprint.** Empty space inside the building's own outline, as a share of
   its bounding box. This is the metric that says "it looks like one house" rather than
   scattered pavilions, and its absence from the first version of this benchmark is why a
   regression that was obvious on screen did not show up in the numbers. Two OPTIMAL layouts of
   the same rooms measured 8% and 28% here; nothing in the model preferred either until
   COMPACT_WEIGHT landed.

3. **Fill against the catalog ceiling.** Envelope fill on its own is meaningless — six rooms at
   their maximums cannot cover a 40x60. The number that matters is fill against
   `catalog_fill_ceiling()`. When the two are equal the CATALOG is the binding constraint, not
   the plot: the house cannot grow no matter how much land it is given, which is a statement
   about `rooms.py` being fixtures rather than houses.

4. **Wet-room spread.** Manhattan distance between the furthest-apart wet room centres. Real
   construction clusters kitchen and bathrooms so they share a stack; scattering them means
   independent runs of supply and waste, which is money nobody costed.

5. **Through-private rooms.** How many rooms reach the hub only by passing through a bedroom.
   Walking through someone's bedroom to leave the house is not a plan, and the door tree in
   connectivity.py has nothing that forbids it.

6. **Worst aspect.** The proportion rule is a per-kind cap, so this should sit under 1.8 for
   habitable rooms. Kept as a regression tripwire on constraints that already hold.

Nothing here asserts a target. It prints what the solver does today; the notes decide what is
acceptable.
"""

from .connectivity import assign_parents, hub_index
from .model import solve_layout
from .realism import catalog_fill_ceiling
from .rooms import ROOM_CATALOG

# Real Indian plot sizes, and the mixes people actually ask for on them. The 3BHK on 30x40 is
# deliberately included even though it is the case that fails: a benchmark that only runs the
# scenarios that pass measures nothing.
SCENARIOS: list[tuple[str, str, list[str]]] = [
    ("1BHK", "20x30", ["hall", "kitchen", "bedroom", "bathroom"]),
    ("2BHK", "25x40", ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]),
    ("2BHK", "30x40", ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]),
    ("3BHK", "30x40", ["hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom", "bathroom", "bathroom"]),
    ("2BHK", "40x60", ["hall", "kitchen", "bedroom", "bedroom", "bathroom"]),
    ("3BHK", "40x60", ["hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom", "bathroom", "bathroom"]),
    ("4BHK", "50x80", ["hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom", "bedroom",
                       "bathroom", "bathroom", "store", "pooja"]),
]

# Setbacks match envelope.DEFAULT_SETBACK: 5 ft front and rear, 3 ft each side, on a plot whose
# frontage is the short edge. Kept local so the benchmark states its own assumptions.
FRONT_REAR_FT = 5
SIDE_FT = 3

PRIVATE_KINDS = ("bedroom",)


def envelope_for(plot: str) -> tuple[int, int]:
    w_ft, d_ft = (int(v) for v in plot.split("x"))
    return (w_ft - 2 * SIDE_FT) * 12, (d_ft - 2 * FRONT_REAR_FT) * 12


def wet_spread_ft(placed) -> float:
    """Furthest Manhattan distance between wet room centres, in feet. 0 with fewer than two."""
    wet = [r for r in placed if getattr(r, "wet", False)]
    if len(wet) < 2:
        return 0.0
    worst = 0.0
    for a in wet:
        for b in wet:
            dx = abs((a.x_in + a.w_in / 2) - (b.x_in + b.w_in / 2))
            dz = abs((a.y_in + a.d_in / 2) - (b.y_in + b.d_in / 2))
            worst = max(worst, (dx + dz) / 12)
    return worst


def through_private(rooms) -> int:
    """Rooms whose route to the circulation hub passes through a private room."""
    parents = assign_parents(rooms)
    hub = hub_index(rooms)
    count = 0
    for i in range(len(rooms)):
        if i == hub:
            continue
        p = parents[i]
        seen = set()
        while p is not None and p != hub and p not in seen:
            seen.add(p)
            if rooms[p].name in PRIVATE_KINDS:
                count += 1
                break
            p = parents[p]
    return count


def void_pct(placed) -> float:
    """Empty space inside the built footprint's bounding box, as a percentage of it."""
    if not placed:
        return 0.0
    fx0 = min(r.x_in for r in placed)
    fx1 = max(r.x_in + r.w_in for r in placed)
    fz0 = min(r.y_in for r in placed)
    fz1 = max(r.y_in + r.d_in for r in placed)
    bbox = (fx1 - fx0) * (fz1 - fz0)
    if bbox <= 0:
        return 0.0
    built = sum(r.w_in * r.d_in for r in placed)
    return 100 * (1 - built / bbox)


def worst_aspect(placed) -> float:
    worst = 0.0
    for r in placed:
        if r.w_in <= 0 or r.d_in <= 0:
            continue
        worst = max(worst, max(r.w_in / r.d_in, r.d_in / r.w_in))
    return worst


def measure(label: str, plot: str, names: list[str]) -> dict:
    env_w, env_d = envelope_for(plot)
    rooms = [ROOM_CATALOG[n] for n in names]
    result = solve_layout(env_w, env_d, rooms, apply_vaastu=True)

    row = {
        "mix": label,
        "plot": plot,
        "env": f"{env_w // 12}x{env_d // 12}",
        "status": result.status,
        "rooms": len(result.rooms),
        "fill": 0.0,
        "void": 0.0,
        "ceiling": 100 * catalog_fill_ceiling(rooms, env_w, env_d),
        "wet_ft": 0.0,
        "through": through_private(rooms),
        "aspect": 0.0,
        "reachable": result.rooms_reachable,
        "vaastu_relaxed": result.vaastu_relaxed,
        "ms": result.solve_ms,
    }
    if not result.rooms:
        return row

    built = sum(r.w_in * r.d_in for r in result.rooms)
    row["fill"] = 100 * built / (env_w * env_d)
    row["void"] = void_pct(result.rooms)
    row["wet_ft"] = wet_spread_ft(result.rooms)
    row["aspect"] = worst_aspect(result.rooms)
    return row


def main() -> None:
    print("=" * 108)
    print("Realism benchmark - what the solver actually produces today")
    print("=" * 108)
    header = (
        f"{'mix':5} {'plot':7} {'env':7} {'status':9} {'fill%':>6} {'ceil%':>6} "
        f"{'binds':>5} {'void%':>6} {'wet ft':>7} {'thru':>5} {'aspect':>7} {'reach':>6} {'ms':>7}"
    )
    print(header)
    print("-" * 108)

    rows = [measure(label, plot, names) for label, plot, names in SCENARIOS]
    for r in rows:
        # "binds" flags fill sitting at the catalog ceiling: the room catalog, not the plot, is
        # what stops the house growing.
        binds = "CAT" if r["fill"] > 0 and r["fill"] >= r["ceiling"] - 1.0 else ""
        status = r["status"] if r["rooms"] else f"** {r['status']}"
        print(
            f"{r['mix']:5} {r['plot']:7} {r['env']:7} {status:9} {r['fill']:6.0f} "
            f"{r['ceiling']:6.0f} {binds:>5} {r['void']:6.0f} {r['wet_ft']:7.0f} {r['through']:5} "
            f"{r['aspect']:7.2f} {r['reachable']:6} {r['ms']:7.0f}"
        )

    solved = [r for r in rows if r["rooms"]]
    failed = [r for r in rows if not r["rooms"]]
    bound = [r for r in solved if r["fill"] >= r["ceiling"] - 1.0]
    unreachable = [r for r in solved if r["reachable"] != r["rooms"]]

    print("-" * 108)
    if solved:
        print(f"  void in footprint      min {min(r['void'] for r in solved):.0f}%, "
              f"max {max(r['void'] for r in solved):.0f}%   (does it read as one building?)")
    print(f"  feasible               {len(solved)}/{len(rows)} scenarios"
          + (f"   FAILING: {', '.join(f'{r['mix']} on {r['plot']}' for r in failed)}" if failed else ""))
    print(f"  catalog is the binder  {len(bound)}/{len(solved)}   "
          f"(fill has reached the catalog ceiling - more plot cannot help)")
    if solved:
        print(f"  wet-room spread        min {min(r['wet_ft'] for r in solved):.0f} ft, "
              f"max {max(r['wet_ft'] for r in solved):.0f} ft")
        print(f"  through-private rooms  {sum(r['through'] for r in solved)} across all scenarios")
        print(f"  worst aspect           {max(r['aspect'] for r in solved):.2f} (per-kind cap is 1.8 for habitable)")
    print(f"  connectivity            {'HELD' if not unreachable else 'BROKEN: ' + str(unreachable)}")
    relaxed = [r for r in solved if r["vaastu_relaxed"]]
    print(f"  vaastu relaxed          {len(relaxed)}/{len(solved)}"
          + (f"   {', '.join(f'{r['mix']} on {r['plot']}' for r in relaxed)}" if relaxed else ""))
    print("=" * 108)


if __name__ == "__main__":
    main()
