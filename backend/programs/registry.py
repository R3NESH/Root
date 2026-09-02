"""Building programmes — what kind of building the solver is packing.

The engine was only ever house-specific in four places: which spaces exist, which space is the
circulation hub, which space opens off which, and which directional rules get posted up front.
All four are data, so a second building type is a data pack rather than a second solver.

A programme owns:

- `spaces`             — the subset of solver.rooms.ROOM_CATALOG it offers.
- `hub`                — the circulation space the door tree is rooted at.
- `parent_preference`  — which space each space prefers to open off, best first.
- `forbidden_pairs`    — pairs that may not share a partition.
- `zone_rules`         — directional constraints, posted before the solve, never scored after.
- `entrance_space`     — the space the front door belongs to.

## Two coordinate conventions, on purpose

Vaastu is **absolute**: the kitchen goes south-east whichever way the plot faces, because the
rule is about the sun, not about the road. `facing_relative_rules = False` for a residence, and
`zone_rules` are read straight as world (x, z) fractions — the convention in vaastu/rules.py.

A shop's rules are **relative to the street**: the entry, the queue and the till sit at the
front and the kitchen at the back, and "front" is whichever edge the road is on. So a café sets
`facing_relative_rules = True` and its rules are written in (front, lateral) fractions with
front = 0 at the shopfront. `resolve_rules()` rotates them into world coordinates per facing.

## Where the café numbers come from

Front-of-house / back-of-house at roughly 60/40 and 15-20 sq ft per seated customer are the
figures the trade press and the AIA both give; the ADA aisle minimum is 36 in with 44 in
preferred on main routes, and a queue wants 36 in of width and 10-12 ft of length before it
starts fouling the door. The decompression zone — the first five feet inside the door, kept
clear — is why `entry` exists as a space at all rather than being absorbed into the seating
floor. Sources are listed in notes/programs/cafe-layout-standards.md.
"""

from dataclasses import dataclass

from vaastu.rules import V1_RULES, QuadrantRule

# A rule is (min, max) on the front axis and (min, max) on the lateral axis, as fractions.
ZoneBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class Program:
    key: str
    label: str
    blurb: str
    spaces: tuple[str, ...]
    default_mix: tuple[str, ...]
    hub: str
    parent_preference: dict[str, tuple[str, ...]]
    forbidden_pairs: frozenset[tuple[str, str]]
    zone_rules: dict[str, ZoneBox]
    zone_descriptions: dict[str, str]
    rules_label: str
    entrance_space: str
    entrance_edges: tuple[str, ...]
    facing_relative_rules: bool
    # Fallback hub kinds, tried in order when the named hub is absent from the mix.
    hub_fallbacks: tuple[str, ...] = ()
    # (child kind, parent kind): with two or more of the child kind, the first one opens off the
    # first parent instead of the hub. The master ensuite of an Indian 2BHK; a cafe has no
    # equivalent, so it leaves this None.
    ensuite: tuple[str, str] | None = None
    # Spaces whose near edge must land on the building's street face, not merely in the front
    # band. A shopfront is on the road; a Vaastu quadrant is about direction, not frontage.
    street_edge_spaces: tuple[str, ...] = ()


RESIDENTIAL = Program(
    key="residence",
    label="Residence",
    blurb="Indian home. Vaastu quadrants posted as constraints, rooms opening onto a central hall.",
    spaces=("hall", "dining", "kitchen", "bedroom", "bathroom", "pooja", "store", "entrance"),
    default_mix=("hall", "kitchen", "bedroom", "bedroom", "bathroom"),
    hub="hall",
    hub_fallbacks=("bedroom",),
    parent_preference={
        "bathroom": ("bedroom", "hall", "dining"),
        "store": ("kitchen", "hall"),
        "dining": ("hall", "kitchen"),
        "pooja": ("hall", "dining"),
        "kitchen": ("hall", "dining"),
        "bedroom": ("hall", "dining"),
        "entrance": ("hall", "dining"),
    },
    forbidden_pairs=frozenset({("kitchen", "bathroom"), ("pooja", "bathroom")}),
    # Read as absolute world fractions: (x_min, x_max, z_min, z_max). Mirrors vaastu.V1_RULES,
    # which stays the source of truth — see resolve_rules().
    zone_rules={
        "kitchen": (0.5, 1.0, 0.5, 1.0),
        "bedroom": (0.0, 0.5, 0.5, 1.0),
        "pooja": (0.5, 1.0, 0.0, 0.5),
    },
    zone_descriptions={
        "kitchen": "kitchen in the south-east",
        "bedroom": "master bedroom in the south-west",
        "pooja": "pooja room in the north-east",
    },
    rules_label="Vaastu",
    entrance_space="entrance",
    entrance_edges=("N", "E", "W", "S"),
    facing_relative_rules=False,
    ensuite=("bathroom", "bedroom"),
)


CAFE = Program(
    key="cafe",
    label="Café",
    blurb=(
        "Coffee shop or small restaurant. Front of house at the street, back of house behind it, "
        "and the customer never crosses the production line."
    ),
    spaces=(
        "entry",
        "queue",
        "counter",
        "seating",
        "lounge",
        "prep",
        "pantry",
        "wash",
        "washroom",
        "staff",
    ),
    default_mix=("entry", "queue", "counter", "seating", "prep", "pantry", "washroom"),
    hub="seating",
    hub_fallbacks=("lounge", "entry"),
    # The tree is the service flow read backwards. Customers meet entry -> queue -> counter and
    # stop there; prep, pantry, wash and staff hang off the counter, so the only door between
    # front and back of house is the one behind the till.
    parent_preference={
        "entry": ("seating", "lounge"),
        "queue": ("entry", "seating"),
        "counter": ("queue", "seating"),
        "prep": ("counter", "seating"),
        "pantry": ("prep", "counter"),
        "wash": ("prep", "counter"),
        "staff": ("prep", "pantry", "counter"),
        "washroom": ("seating", "lounge", "entry"),
        "lounge": ("seating",),
        "seating": ("lounge", "entry"),
    },
    # A customer WC opening straight into food prep or dry store fails health inspection.
    forbidden_pairs=frozenset(
        {("washroom", "prep"), ("washroom", "pantry"), ("wash", "seating")}
    ),
    # (front_min, front_max, lateral_min, lateral_max). front = 0 at the shopfront.
    #
    # What this enforces is the front/back ORDER, not the 60/40 area ratio: every back-of-house
    # space is behind every front-of-house one. The ratio itself is left to the area objective
    # and comes out nearer 75/25 on a small envelope, because seating has the largest maximum.
    # Posting the ratio as a constraint would make small plots infeasible for a number the owner
    # should be free to argue with, so it is reported rather than forced.
    zone_rules={
        "entry": (0.0, 0.35, 0.0, 1.0),
        "queue": (0.0, 0.55, 0.0, 1.0),
        "counter": (0.30, 0.75, 0.0, 1.0),
        "seating": (0.0, 0.65, 0.0, 1.0),
        "lounge": (0.0, 0.70, 0.0, 1.0),
        "washroom": (0.45, 1.0, 0.0, 1.0),
        "prep": (0.55, 1.0, 0.0, 1.0),
        "wash": (0.55, 1.0, 0.0, 1.0),
        "pantry": (0.60, 1.0, 0.0, 1.0),
        "staff": (0.60, 1.0, 0.0, 1.0),
    },
    zone_descriptions={
        "entry": "entry inside the shopfront, kept clear",
        "queue": "order queue in the front half, off the door",
        "counter": "service counter between queue and kitchen",
        "seating": "seating on the daylit street side",
        "lounge": "lounge seating front of house",
        "washroom": "washroom off the shopfront",
        "prep": "kitchen in the back of house",
        "wash": "wash-up in the back of house",
        "pantry": "store at the back, off the kitchen",
        "staff": "staff room at the back",
    },
    rules_label="Service flow",
    entrance_space="entry",
    # Overridden per facing — a shop door goes on the street, whichever edge that is.
    entrance_edges=("N", "E", "W", "S"),
    facing_relative_rules=True,
    street_edge_spaces=("entry",),
)


PROGRAMS: dict[str, Program] = {p.key: p for p in (RESIDENTIAL, CAFE)}

DEFAULT_PROGRAM = RESIDENTIAL


def get_program(key: str | None) -> Program:
    """Unknown keys fall back to the residence rather than erroring — an old client that sends
    no programme at all is asking for the behaviour it has always had."""
    if not key:
        return DEFAULT_PROGRAM
    return PROGRAMS.get(key, DEFAULT_PROGRAM)


def primary_cardinal(facing: str) -> str:
    """The cardinal edge the road is on. Mirrors getPrimaryCardinalEdge in sceneDoorways.ts."""
    if facing in ("N", "NE", "NW"):
        return "N"
    if facing in ("S", "SE", "SW"):
        return "S"
    if facing in ("E", "W"):
        return facing
    return "N"


def _to_world(box: ZoneBox, street: str) -> ZoneBox:
    """Rotate (front, lateral) fractions into world (x, z) fractions.

    +X is East and +Z is South with the origin at the north-west corner — the convention in
    vaastu/rules.py and frontend/lib/plot.ts. `front` runs inward from the street edge.
    """
    f0, f1, l0, l1 = box
    if street == "N":  # road to the north, depth runs south
        return (l0, l1, f0, f1)
    if street == "S":  # road to the south, depth runs north
        return (1.0 - l1, 1.0 - l0, 1.0 - f1, 1.0 - f0)
    if street == "E":  # road to the east, depth runs west
        return (1.0 - f1, 1.0 - f0, l0, l1)
    return (f0, f1, 1.0 - l1, 1.0 - l0)  # "W"


def resolve_rules(program: Program, facing: str = "N") -> dict[str, QuadrantRule]:
    """The programme's directional rules in world coordinates, ready to post.

    A residence hands back vaastu.V1_RULES untouched — that module stays the source of truth for
    Vaastu, so a rule added there is picked up here without being copied.
    """
    if not program.facing_relative_rules:
        return dict(V1_RULES)

    street = primary_cardinal(facing)
    rules: dict[str, QuadrantRule] = {}
    for space, box in program.zone_rules.items():
        x0, x1, z0, z1 = _to_world(box, street)
        rules[space] = QuadrantRule(
            room_name=space,
            x_min_frac=x0,
            x_max_frac=x1,
            z_min_frac=z0,
            z_max_frac=z1,
            description=program.zone_descriptions.get(space, space),
        )
    return rules


def resolve_entrance_edges(program: Program, facing: str = "N") -> tuple[str, ...]:
    """Preferred edges for the front door, best first.

    A house follows Vaastu's N-then-E preference regardless of the road. A shop opens onto the
    road, so the facing edge comes first and the rest are only fallbacks for a corner unit.
    """
    if not program.facing_relative_rules:
        return program.entrance_edges
    street = primary_cardinal(facing)
    rest = tuple(e for e in ("N", "E", "W", "S") if e != street)
    return (street,) + rest
