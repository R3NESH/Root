"""Bill of quantities, counted off the wall objects.

This is the half of BIM worth having at this price point. notes/market/price-ceiling.md puts the
whole ticket at Rs 3,000-5,000, which does not amortise a BIM; but a mason quoting a job needs
brick, mortar, plaster and a door schedule, and all four fall straight out of solver/walls.py
once walls have identity.

**Quantities only. No rates, no totals in rupees.** Material and labour rates move by district
and by month, and a number invented here would be believed. The caller supplies rates.

Everything derives from measured geometry, with two exceptions that are convention and are named
as such: the brick specification and the plaster thicknesses. Both are constants at the top of
this module so a user with different practice can change one line.

## Where the brick number comes from

Not a magic "500 per cubic metre". Bricks are counted from the brick plus its mortar joint:

    bricks per m3 = 1 / ((L + joint)(W + joint)(H + joint))

For the modular brick of IS 1077 (190x90x90 at a 10 mm joint) that is 1 / (0.2 x 0.1 x 0.1) =
**exactly 500**, which is the figure BIS publishes — so the method reproduces the standard rather
than quoting it. The default here is the traditional 230x110x70 brick instead, because that is
what the 9 in and 4.5 in wall thicknesses in connectivity.py describe; it yields 434 per m3.
"""

from dataclasses import dataclass, field

from .walls import Wall

CUBIC_IN_PER_CUBIC_M = 61023.7
SQ_IN_PER_SQ_FT = 144
CUBIC_IN_PER_CUBIC_FT = 1728


@dataclass(frozen=True)
class BrickSpec:
    """A brick and the joint it is laid with. Millimetres, because bricks are sold in them."""

    name: str
    length_mm: float
    width_mm: float
    height_mm: float
    joint_mm: float = 10.0

    @property
    def per_cubic_metre(self) -> float:
        l = (self.length_mm + self.joint_mm) / 1000
        w = (self.width_mm + self.joint_mm) / 1000
        h = (self.height_mm + self.joint_mm) / 1000
        return 1.0 / (l * w * h)

    @property
    def net_volume_m3(self) -> float:
        return (self.length_mm / 1000) * (self.width_mm / 1000) * (self.height_mm / 1000)


# The 9 in / 4.5 in walls this solver emits are traditional brickwork, so that is the default.
TRADITIONAL_BRICK = BrickSpec("Traditional 230x110x70", 230, 110, 70)
# IS 1077 modular, kept because it is the codified standard and reproduces the published 500/m3.
MODULAR_BRICK = BrickSpec("Modular 190x90x90 (IS 1077)", 190, 90, 90)

# Indian site convention, not code: 12 mm internal, 15 mm external. Named so it can be argued
# with rather than assumed.
PLASTER_INTERNAL_MM = 12.0
PLASTER_EXTERNAL_MM = 15.0


@dataclass(frozen=True)
class OpeningTally:
    kind: str
    width_in: int
    height_in: int
    count: int

    @property
    def label(self) -> str:
        return f"{self.width_in // 12}'{self.width_in % 12}\" x {self.height_in // 12}'{self.height_in % 12}\""


@dataclass(frozen=True)
class Quantities:
    # Areas
    carpet_area_sqft: float
    wall_footprint_sqft: float
    built_up_area_sqft: float
    # Walls
    wall_run_ft: float
    wall_gross_area_sqft: float
    opening_area_sqft: float
    wall_net_area_sqft: float
    # Masonry
    masonry_volume_cuft: float
    brick_spec: str
    brick_count: int
    mortar_volume_cuft: float
    # Finishes
    plaster_area_sqft: float
    plaster_volume_cuft: float
    # Schedules
    openings: list[OpeningTally] = field(default_factory=list)
    per_room: list[dict] = field(default_factory=list)


def _opening_area_in2(wall: Wall) -> float:
    return float(sum(o["width_in"] * o["height_in"] for o in wall.openings))


def take_off(rooms, walls: list[Wall], brick: BrickSpec = TRADITIONAL_BRICK) -> Quantities:
    """Measure the plan. Rooms give areas; walls give everything else."""
    carpet_in2 = sum(r.w_in * r.d_in for r in rooms)

    gross_in2 = 0.0
    openings_in2 = 0.0
    masonry_in3 = 0.0
    plaster_in2 = 0.0
    plaster_in3 = 0.0
    wall_footprint_in2 = 0.0
    run_in = 0

    for w in walls:
        gross = float(w.length_in * w.height_in)
        holes = _opening_area_in2(w)
        net = max(0.0, gross - holes)

        gross_in2 += gross
        openings_in2 += holes
        masonry_in3 += net * w.thickness_in
        wall_footprint_in2 += float(w.length_in * w.thickness_in)
        run_in += w.length_in

        # Both faces are plastered. A partition gets internal plaster twice; an exterior wall
        # gets internal on the inside and the thicker external mix on the weather face.
        plaster_in2 += net * 2
        internal_mm = PLASTER_INTERNAL_MM
        other_mm = PLASTER_INTERNAL_MM if not w.is_exterior else PLASTER_EXTERNAL_MM
        plaster_in3 += net * ((internal_mm + other_mm) / 25.4)

    masonry_m3 = masonry_in3 / CUBIC_IN_PER_CUBIC_M
    brick_count = int(round(masonry_m3 * brick.per_cubic_metre))
    brick_solid_m3 = brick_count * brick.net_volume_m3
    mortar_m3 = max(0.0, masonry_m3 - brick_solid_m3)

    tally: dict[tuple, int] = {}
    for w in walls:
        for o in w.openings:
            key = (o["kind"], o["width_in"], o["height_in"])
            tally[key] = tally.get(key, 0) + 1

    openings = [
        OpeningTally(kind=k, width_in=wd, height_in=ht, count=n)
        for (k, wd, ht), n in sorted(tally.items(), key=lambda kv: (kv[0][0], -kv[0][1]))
    ]

    per_room = [
        {
            "name": r.name,
            "w_ft": round(r.w_in / 12, 1),
            "d_ft": round(r.d_in / 12, 1),
            "area_sqft": round(r.w_in * r.d_in / SQ_IN_PER_SQ_FT, 1),
        }
        for r in rooms
    ]

    return Quantities(
        carpet_area_sqft=round(carpet_in2 / SQ_IN_PER_SQ_FT, 1),
        wall_footprint_sqft=round(wall_footprint_in2 / SQ_IN_PER_SQ_FT, 1),
        built_up_area_sqft=round((carpet_in2 + wall_footprint_in2) / SQ_IN_PER_SQ_FT, 1),
        wall_run_ft=round(run_in / 12, 1),
        wall_gross_area_sqft=round(gross_in2 / SQ_IN_PER_SQ_FT, 1),
        opening_area_sqft=round(openings_in2 / SQ_IN_PER_SQ_FT, 1),
        wall_net_area_sqft=round((gross_in2 - openings_in2) / SQ_IN_PER_SQ_FT, 1),
        masonry_volume_cuft=round(masonry_in3 / CUBIC_IN_PER_CUBIC_FT, 1),
        brick_spec=brick.name,
        brick_count=brick_count,
        mortar_volume_cuft=round(mortar_m3 * 35.3147, 1),
        plaster_area_sqft=round(plaster_in2 / SQ_IN_PER_SQ_FT, 1),
        plaster_volume_cuft=round(plaster_in3 / CUBIC_IN_PER_CUBIC_FT, 1),
        openings=openings,
        per_room=per_room,
    )
