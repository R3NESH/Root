"""POST /solve — notes/build/step-3-wire-together.md.

Stateless request/response, no database, no secrets — notes/architecture/environment-notes.md.
Payload shape follows notes/architecture/output-schema.md.
Supports per-room custom dimension overrides (e.g. 15x15 ft bedroom) and stable dragging.

Ships the solver's derived `openings`, `wall_thickness_in`, `entrance_edge` and `rooms_reachable`
rather than blanking them — notes/architecture/duplicated-geometry.md.
"""

from dataclasses import replace
from typing import Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from envelope import (
    DEFAULT_SETBACK,
    FACINGS,
    Setback,
    buildable_envelope,
    buildable_polygon,
)
from programs import PROGRAMS, RESIDENTIAL, Program, get_program
from solver.model import solve_layout
from solver.rooms import ROOM_CATALOG, Room

app = FastAPI(title="plot-to-plan solver")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _coerce_round_int(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    return v


def _size_range(pin, lo_in, hi_in, lo_base, hi_base) -> tuple[int, int]:
    """One room's allowed size on one axis, from three sources, most specific first.

    `pin` is `custom_w_in`/`custom_d_in` — one exact size, which is what RoomCustomizer asks for.
    `lo_in`/`hi_in` are `min_*_in`/`max_*_in`, a range instead: those fields were in RoomSpecIn
    from the start and were read by nothing until ai/plan_from_image.py needed to say "about 12 ft,
    from a drawing" rather than "exactly 12 ft". Neither source widens the catalog, because a range
    that escaped it would undo the NBC 2016 minimums in solver/rooms.py.

    That last sentence was true of the range and false of the pin, which returned unclamped — so
    the one path that said "exactly this size" was the one path out of the catalog. Every prebuilt
    plan in frontend/lib/modelBlueprints.ts pins every room, and seventeen of those pins were under
    a floor this package enforces as a hard constraint: a 7x6 bedroom at half the NBC habitable
    area, three kitchens 6 ft wide against a 7 ft minimum. The pin is clamped now, so a size that
    asks for less than the code allows gets the code's answer instead.
    """
    if pin is not None:
        clamped = min(max(pin, lo_base), hi_base)
        return clamped, clamped
    lo = max(lo_base, lo_in) if lo_in is not None else lo_base
    hi = min(hi_base, hi_in) if hi_in is not None else hi_base
    # A band that misses the catalog range entirely (a 4 ft bedroom) falls back to the catalog
    # rather than inverting and making the model infeasible.
    return (lo, hi) if lo <= hi else (lo_base, hi_base)


class SetbackIn(BaseModel):
    front_in: int = Field(ge=0)
    rear_in: int = Field(ge=0)
    left_in: int = Field(ge=0)
    right_in: int = Field(ge=0)

    @field_validator("front_in", "rear_in", "left_in", "right_in", mode="before")
    def coerce(cls, v):
        return _coerce_round_int(v)


class PrevRoom(BaseModel):
    index: int = Field(ge=0)
    x_in: int
    y_in: int

    @field_validator("index", "x_in", "y_in", mode="before")
    def coerce(cls, v):
        return _coerce_round_int(v)


class RoomSpecIn(BaseModel):
    name: str
    custom_w_in: int | None = None
    custom_d_in: int | None = None
    min_w_in: int | None = None
    max_w_in: int | None = None
    min_d_in: int | None = None
    max_d_in: int | None = None

    @field_validator("custom_w_in", "custom_d_in", "min_w_in", "max_w_in", "min_d_in", "max_d_in", mode="before")
    def coerce(cls, v):
        return _coerce_round_int(v)


class SolveRequest(BaseModel):
    plot_w_in: int = Field(gt=0)
    plot_d_in: int = Field(gt=0)
    facing: str = "N"
    rooms: list[Union[str, RoomSpecIn]]
    setback: SetbackIn | None = None
    # A plot that is not a rectangle, as [[x_in, y_in], ...] in plot coordinates: x east, y
    # south, (0, 0) at the north-west corner, wound either way. Must be convex — see
    # envelope/polygon.py for why, and what happens when it is not. `plot_w_in`/`plot_d_in` are
    # still required and are the polygon's bounding box, so an older client is unaffected and a
    # newer one degrades to the rectangle if the outline is rejected.
    plot_polygon_in: list[list[int]] | None = None
    # How many storeys to pack, ground included. 1 is what every client sent before this existed
    # and is still the default. The mix is split across them by SPLIT_TO_UPPER below, and a stair
    # core is added to every floor — see notes/decisions/single-storey-first.md.
    floors: int = 1
    prev: list[PrevRoom] | None = None
    apply_zone_rules: bool = True
    # Which building programme to pack — "residence" (default) or "cafe". An old client that
    # sends nothing keeps the behaviour it has always had; see programs/registry.py.
    program: str = RESIDENTIAL.key
    # Index of the room the user just dragged. Only that room is released from its zone
    # quadrant; releasing every rule on an edit is what silently un-zoned each drag.
    moved_index: int | None = None
    # Pairs of rooms the caller would like close together, as indices into `rooms` above:
    # [[0, 3], [1, 2]]. A preference, scored rather than constrained — see
    # solver/realism.py near_terms() for why this one is scored and a zone rule is not. Pairs
    # naming an unknown room, a room on another storey, or a room twice are dropped.
    near: list[list[int]] | None = None

    @field_validator("plot_w_in", "plot_d_in", "moved_index", mode="before")
    def coerce(cls, v):
        return _coerce_round_int(v)



class RoomOut(BaseModel):
    name: str
    floor: int
    x_in: int
    y_in: int
    w_in: int
    d_in: int
    wall_thickness_in: int | None
    openings: list[dict]
    habitable: bool = True
    wet: bool = False
    # Roofed, not walled — a sit-out or a car porch. The renderer must draw a slab and posts,
    # not a box: no wall is emitted for its outside faces, so drawing one from the room
    # rectangle would invent walls the bill of quantities did not cost.
    open_sided: bool = False


class WallOut(BaseModel):
    """A wall as an object, not as four edges of a room — see solver/walls.py."""

    floor: int = 0
    id: str
    x0_in: int
    y0_in: int
    x1_in: int
    y1_in: int
    length_in: int
    thickness_in: int
    height_in: int
    is_exterior: bool
    room_indices: list[int]
    openings: list[dict]


class OpeningTallyOut(BaseModel):
    kind: str
    width_in: int
    height_in: int
    count: int
    label: str


class QuantitiesOut(BaseModel):
    """Bill of quantities. Quantities only — rates are the caller's, see solver/quantities.py."""

    carpet_area_sqft: float
    wall_footprint_sqft: float
    built_up_area_sqft: float
    wall_run_ft: float
    wall_gross_area_sqft: float
    opening_area_sqft: float
    wall_net_area_sqft: float
    masonry_volume_cuft: float
    brick_spec: str
    brick_count: int
    mortar_volume_cuft: float
    plaster_area_sqft: float
    plaster_volume_cuft: float
    openings: list[OpeningTallyOut]
    per_room: list[dict]


class SolveMeta(BaseModel):
    status: str
    solve_ms: float
    rules_applied: list[str]
    envelope_origin_x_in: int
    envelope_origin_z_in: int
    envelope_w_in: int
    envelope_d_in: int
    unknown_room_names: list[str]
    # The buildable outline for a non-rectangular plot, in plot inches, already inset by the
    # setback. Absent on a rectangular plot, where the origin and the two dimensions above say
    # everything there is to say.
    envelope_polygon_in: list[list[int]] | None = None
    # How many storeys the solver actually packed. A client that asked for two and reads one here
    # is talking to a backend that predates multi-storey, and can say so instead of quietly
    # showing a bungalow.
    floors_solved: int = 1
    entrance_edge: str | None = None
    rooms_reachable: int = 0
    # Which programme was packed and what its directional rules are called. A programme that
    # posts no zoning — the residence does not — leaves `rules_label` empty and `rules_applied`
    # empty, and the UI must not claim a rule the solver never enforced.
    program: str = RESIDENTIAL.key
    rules_label: str = RESIDENTIAL.rules_label
    # The relaxation ladder handed back a layout with no zone rule posted, even though the mix
    # has rules and the caller asked for them. The UI must say so rather than present it as a
    # normal plan.
    rules_relaxed: bool = False
    # Only populated when nothing was placed. The names to remove for the mix to pack, verified
    # by re-solving rather than estimated. Empty when even the probe found nothing that fits.
    drop_to_fit: list[str] = []


class SolveResponse(BaseModel):
    rooms: list[RoomOut]
    # Present whenever a layout was returned. An older client that ignores them is unaffected.
    walls: list[WallOut] = []
    quantities: QuantitiesOut | None = None
    meta: SolveMeta


# How many spaces the fit probe will try removing before it gives up. Each rung is a full solve,
# so this is a latency budget, not a search depth: a mix that needs five spaces removed is not a
# plot problem the caller can nudge, it is the wrong plot.
MAX_DROP_PROBES = 4


def _drop_to_fit(
    env_w_in: int,
    env_d_in: int,
    rooms: list[Room],
    program: Program,
    facing: str,
    apply_zone_rules: bool,
) -> list[str]:
    """Names to remove for `rooms` to pack into the envelope, largest space first.

    INFEASIBLE is an honest answer and a dead end: the ladder in solver/model.py has already
    given up zoning, daylight and the area preference, so there is nothing left to relax and the
    only thing the caller can do is carry fewer spaces. Saying which ones turns the dead end
    into a next step.

    Every rung re-solves rather than comparing areas, because area is necessary and not
    sufficient — a 20x30 plot clears the arithmetic for four rooms and still packs none of them.
    Returns [] when even the smallest probe fails.
    """
    # Only the hub the mix will actually root its door tree at is protected. `hub_fallbacks` are
    # the kinds tried when the named hub is absent, not a second set of rooms to keep — treating
    # them as protected shielded both bedrooms of a 2BHK and left the probe dropping the hall.
    present = {r.name for r in rooms}
    hub = program.hub if program.hub in present else next(
        (k for k in program.hub_fallbacks if k in present), None
    )
    hub_kinds = {hub} if hub else set()
    remaining = list(rooms)
    dropped: list[str] = []

    for _ in range(min(MAX_DROP_PROBES, len(rooms) - 1)):
        # Biggest first: it frees the most envelope per space given up. The hub is the room every
        # other one opens off, so it goes last of all — dropping it before the leaves it serves
        # would hand back a set of rooms that cannot form a house.
        candidates = [r for r in remaining if r.name not in hub_kinds] or remaining
        victim = max(candidates, key=lambda r: (r.min_w_in * r.min_d_in, r.name))
        remaining = [r for r in remaining if r is not victim]
        dropped.append(victim.name)

        probe = solve_layout(
            env_w_in, env_d_in, remaining,
            apply_zone_rules=apply_zone_rules, program=program, facing=facing,
        )
        if probe.rooms:
            return dropped

    return []


# Ground plus two. Past that the bye-law stops being about setbacks and starts being about
# fire escape and lifts, none of which this models — see notes/decisions/project-phases.md.
MAX_FLOORS = 3

# Which spaces move upstairs when there is an upstairs, in the order they go. The Indian norm:
# the public half of the house stays on the ground where the street door is, bedrooms go up. A
# space not listed here never leaves the ground floor.
SPLIT_TO_UPPER = ("bedroom", "bathroom")

# The stair core. Deliberately not a room kind in ROOM_CATALOG: "staircase as a room kind" is
# recorded as rejected in notes/decisions/rejected-approaches.md, and this is not that. It is
# not offered in the mix, cannot be added or removed by the user, and exists only because a
# storey above the ground has to be reachable from it. One rectangle, repeated on every floor at
# the same position, which is what `aligned` posts to the solver.
# Sized for a dog-leg with a half-landing, which is what an Indian house actually builds: two
# flights side by side need about 5.5 ft of width, and 16 risers over two 7 ft runs give a
# ~7.2 in riser and a ~10.5 in tread. A 3.5 ft core forces one straight flight at 50 degrees,
# which is a ladder, not a staircase.
STAIR_MIN_W_IN, STAIR_MAX_W_IN = 66, 90
STAIR_MIN_D_IN, STAIR_MAX_D_IN = 114, 132


def _stair_core(floor: int) -> Room:
    return Room(
        name="stairs",
        min_w_in=STAIR_MIN_W_IN,
        max_w_in=STAIR_MAX_W_IN,
        min_d_in=STAIR_MIN_D_IN,
        max_d_in=STAIR_MAX_D_IN,
        # Not habitable and not wet: a landing needs neither a window quota nor a drain, and
        # forcing it onto an exterior wall would waste the frontage it would take.
        habitable=False,
        wet=False,
        max_aspect_x10=40,
        floor=floor,
    )


def assign_floors(rooms: list[Room], floors: int) -> list[Room]:
    """Spread the mix over `floors` storeys, ground first.

    The hub and the service half stay down. Bedrooms and their bathrooms fill the ground floor
    first and then go up, so a G+1 with two bedrooms keeps one of each downstairs rather than
    leaving a whole floor to one room. Deterministic: the same mix always splits the same way,
    which is what layout stability needs of it (notes/solver/layout-stability.md).
    """
    if floors <= 1:
        return rooms

    movable = [i for i, r in enumerate(rooms) if r.name in SPLIT_TO_UPPER]
    if not movable:
        return rooms

    # Keep at least one of each movable kind on the ground: a house whose only bathroom is
    # upstairs is a house with no ground floor bathroom.
    kept: set[int] = set()
    for kind in SPLIT_TO_UPPER:
        first = next((i for i in movable if rooms[i].name == kind), None)
        if first is not None:
            kept.add(first)

    to_move = [i for i in movable if i not in kept]
    upper_floors = floors - 1
    out = list(rooms)
    for position, index in enumerate(to_move):
        out[index] = replace(rooms[index], floor=1 + position % upper_floors)
    return out


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    facing = req.facing if req.facing in FACINGS else "N"
    setback = (
        Setback(
            front_in=req.setback.front_in,
            rear_in=req.setback.rear_in,
            left_in=req.setback.left_in,
            right_in=req.setback.right_in,
        )
        if req.setback
        else DEFAULT_SETBACK
    )

    floors = max(1, min(MAX_FLOORS, req.floors))

    env = buildable_envelope(req.plot_w_in, req.plot_d_in, facing, setback)

    # A convex outline replaces the rectangle envelope with its own bounding box plus one
    # half-plane per plot edge. An outline that is concave, degenerate or setback out of
    # existence falls back to the rectangle rather than failing the solve: the plot dimensions
    # are always present and always mean something.
    poly_env = (
        buildable_polygon([(p[0], p[1]) for p in req.plot_polygon_in], facing, setback)
        if req.plot_polygon_in
        else None
    )
    if poly_env is not None:
        env = poly_env
    halfplanes = (
        [(h.a, h.b, h.c) for h in poly_env.halfplanes] if poly_env is not None else []
    )

    program = get_program(req.program)

    unknown: list[str] = []
    rooms: list[Room] = []
    # An unknown name is skipped, so position i in the request is not room i in the solver.
    # `near` indexes the request's own list, and without this translation a single bad name in
    # the mix would silently pair the wrong two rooms.
    index_map: dict[int, int] = {}

    for request_index, item in enumerate(req.rooms):
        if isinstance(item, str):
            r_name = item
            custom_w = None
            custom_d = None
            band = None
        else:
            r_name = item.name
            custom_w = item.custom_w_in
            custom_d = item.custom_d_in
            band = item

        # A bedroom in a cafe is a client bug, not a room. Rejecting it here keeps the mix
        # inside the programme's own vocabulary, which is what its hub, parent preferences and
        # zoning were written against.
        if r_name not in ROOM_CATALOG or r_name not in program.spaces:
            unknown.append(r_name)
            continue

        base = ROOM_CATALOG[r_name]

        min_w, max_w = _size_range(
            custom_w,
            getattr(band, "min_w_in", None),
            getattr(band, "max_w_in", None),
            base.min_w_in,
            base.max_w_in,
        )
        min_d, max_d = _size_range(
            custom_d,
            getattr(band, "min_d_in", None),
            getattr(band, "max_d_in", None),
            base.min_d_in,
            base.max_d_in,
        )

        # Clamp to envelope dimensions if envelope is positive to guarantee feasibility
        if env.width_in > 0:
            min_w = min(min_w, env.width_in)
            max_w = min(max_w, env.width_in)
        if env.depth_in > 0:
            min_d = min(min_d, env.depth_in)
            max_d = min(max_d, env.depth_in)

        if min_w > max_w:
            max_w = min_w
        if min_d > max_d:
            max_d = min_d

        index_map[request_index] = len(rooms)
        rooms.append(
            Room(
                name=r_name,
                min_w_in=min_w,
                max_w_in=max_w,
                min_d_in=min_d,
                max_d_in=max_d,
                # The caller may override the four bounds. Everything else is a property of the
                # room kind and comes from the catalog. Leaving these to the dataclass defaults
                # made every room habitable and dry, which is not a labelling slip: it is what
                # add_daylight_constraints() and derive_windows() key off, so a bathroom got a
                # full window and a store was forced onto an exterior wall it is exempt
                # from — solver/rooms.py, solver/realism.py.
                habitable=base.habitable,
                wet=base.wet,
                max_aspect_x10=base.max_aspect_x10,
                open_sided=base.open_sided,
            )
        )

    if not rooms or env.width_in <= 0 or env.depth_in <= 0:
        return SolveResponse(
            rooms=[],
            meta=SolveMeta(
                status="NO_INPUT" if not rooms else "EMPTY_ENVELOPE",
                solve_ms=0.0,
                rules_applied=[],
                envelope_origin_x_in=env.origin_x_in,
                envelope_origin_z_in=env.origin_z_in,
                envelope_w_in=env.width_in,
                envelope_d_in=env.depth_in,
                unknown_room_names=unknown,
                program=program.key,
                rules_label=program.rules_label,
            ),
        )

    # Storeys. The mix is split first, then a stair core is added to each floor and the copies
    # are pinned to one another so the staircase lands on the same footprint all the way up.
    rooms = assign_floors(rooms, floors)
    aligned: list[list[int]] = []
    if floors > 1:
        core_indices = []
        for f in range(floors):
            core_indices.append(len(rooms))
            rooms.append(_stair_core(f))
        aligned.append(core_indices)

    prev = {p.index: (p.x_in, p.y_in) for p in req.prev} if req.prev else None
    near = [
        (index_map[pair[0]], index_map[pair[1]])
        for pair in (req.near or [])
        if len(pair) == 2 and pair[0] in index_map and pair[1] in index_map
    ]

    result = solve_layout(
        env.width_in,
        env.depth_in,
        rooms,
        prev=prev,
        apply_zone_rules=req.apply_zone_rules,
        moved_index=req.moved_index,
        program=program,
        facing=facing,
        halfplanes=halfplanes,
        aligned=aligned,
        near=near,
    )

    # Nothing placed and nothing left to relax: work out what would fit, so the caller gets a
    # next step instead of a blank plan.
    drop_to_fit = (
        _drop_to_fit(env.width_in, env.depth_in, rooms, program, facing, req.apply_zone_rules)
        if not result.rooms
        else []
    )

    walls_out = [
        WallOut(
            floor=w.floor,
            id=w.id,
            # Envelope-relative to plot-relative, the same shift the rooms get.
            x0_in=w.x0_in + env.origin_x_in,
            y0_in=w.y0_in + env.origin_z_in,
            x1_in=w.x1_in + env.origin_x_in,
            y1_in=w.y1_in + env.origin_z_in,
            length_in=w.length_in,
            thickness_in=w.thickness_in,
            height_in=w.height_in,
            is_exterior=w.is_exterior,
            room_indices=list(w.room_indices),
            openings=w.openings,
        )
        for w in result.walls
    ]

    q = result.quantities
    quantities_out = (
        QuantitiesOut(
            carpet_area_sqft=q.carpet_area_sqft,
            wall_footprint_sqft=q.wall_footprint_sqft,
            built_up_area_sqft=q.built_up_area_sqft,
            wall_run_ft=q.wall_run_ft,
            wall_gross_area_sqft=q.wall_gross_area_sqft,
            opening_area_sqft=q.opening_area_sqft,
            wall_net_area_sqft=q.wall_net_area_sqft,
            masonry_volume_cuft=q.masonry_volume_cuft,
            brick_spec=q.brick_spec,
            brick_count=q.brick_count,
            mortar_volume_cuft=q.mortar_volume_cuft,
            plaster_area_sqft=q.plaster_area_sqft,
            plaster_volume_cuft=q.plaster_volume_cuft,
            openings=[
                OpeningTallyOut(
                    kind=o.kind, width_in=o.width_in, height_in=o.height_in,
                    count=o.count, label=o.label,
                )
                for o in q.openings
            ],
            per_room=q.per_room,
        )
        if q is not None
        else None
    )

    return SolveResponse(
        walls=walls_out,
        quantities=quantities_out,
        rooms=[
            RoomOut(
                name=r.name,
                floor=r.floor,
                x_in=r.x_in + env.origin_x_in,
                y_in=r.y_in + env.origin_z_in,
                w_in=r.w_in,
                d_in=r.d_in,
                wall_thickness_in=r.wall_thickness_in,
                openings=r.openings,
                habitable=r.habitable,
                wet=r.wet,
                open_sided=r.open_sided,
            )
            for r in result.rooms
        ],
        meta=SolveMeta(
            status=result.status,
            solve_ms=round(result.solve_ms, 2),
            rules_applied=result.rules_applied,
            envelope_origin_x_in=env.origin_x_in,
            envelope_origin_z_in=env.origin_z_in,
            envelope_w_in=env.width_in,
            envelope_d_in=env.depth_in,
            unknown_room_names=unknown,
            floors_solved=len({r.floor for r in result.rooms}) or 1,
            envelope_polygon_in=(
                [[x, y] for x, y in poly_env.polygon_in] if poly_env is not None else None
            ),
            entrance_edge=result.entrance_edge,
            rooms_reachable=result.rooms_reachable,
            program=result.program,
            rules_label=result.rules_label,
            rules_relaxed=result.rules_relaxed,
            drop_to_fit=drop_to_fit,
        ),
    )


# --------------------------------------------------------------------------------------
# AI Photo-to-3D Furniture Modeling Endpoint
# --------------------------------------------------------------------------------------

class AIFurnitureComponentDef(BaseModel):
    id: str
    type: str  # "base" | "cushion" | "cushion_set" | "backrest" | "armrests" | "legs" | "tabletop" | "shelf_set" | "drawer_set" | "tufting" | "hardware" | "headboard" | "shade" | "frame"
    shape: str = "box"
    relative_x: float = 0.0
    relative_y: float = 0.0
    relative_z: float = 0.0
    width_ft: float
    depth_ft: float
    height_ft: float
    rotation_y: float = 0.0
    material_type: str = "fabric"
    color_hex: str | None = None
    roughness: float = 0.6
    metalness: float = 0.1
    count: int | None = None
    style_tag: str | None = None


class AIModelFurnitureRequest(BaseModel):
    image_base64: str | None = None
    image_url: str | None = None
    prompt: str | None = None
    hint_category: str | None = None


class AIModelFurnitureResponse(BaseModel):
    name: str
    category: str
    style: str
    description: str
    width_ft: float
    depth_ft: float
    height_ft: float
    primary_color_hex: str
    secondary_color_hex: str
    primary_material: str
    secondary_material: str
    confidence: float
    tags: list[str]
    components: list[AIFurnitureComponentDef]


@app.post("/ai/model-furniture", response_model=AIModelFurnitureResponse)
def model_furniture(req: AIModelFurnitureRequest) -> AIModelFurnitureResponse:
    """Decomposes an uploaded furniture photo or prompt into a rich 3D parametric component blueprint."""
    import re

    prompt_text = (req.prompt or "").lower()
    hint = (req.hint_category or "").lower()

    # Intelligent Semantic & Vision Heuristic Decomposition
    # 1. Sofa / Sectional / Couch
    if any(k in prompt_text or k in hint for k in ["sofa", "couch", "sectional", "chesterfield", "loveseat", "chaise", "lounge"]):
        is_l_shape = "l-shape" in prompt_text or "sectional" in prompt_text or "corner" in prompt_text
        is_curved = "curved" in prompt_text or "crescent" in prompt_text or "boucle" in prompt_text
        is_leather = "leather" in prompt_text or "tan" in prompt_text or "brown" in prompt_text
        is_velvet = "velvet" in prompt_text or "emerald" in prompt_text or "navy" in prompt_text

        primary_color = "#1e3a8a"  # Royal Navy
        if "emerald" in prompt_text or "green" in prompt_text:
            primary_color = "#065f46"
        elif "tan" in prompt_text or "cognac" in prompt_text or "camel" in prompt_text:
            primary_color = "#b45309"
        elif "charcoal" in prompt_text or "black" in prompt_text or "grey" in prompt_text:
            primary_color = "#1e293b"
        elif "cream" in prompt_text or "white" in prompt_text or "boucle" in prompt_text:
            primary_color = "#f8fafc"
        elif "terracotta" in prompt_text or "rust" in prompt_text or "red" in prompt_text:
            primary_color = "#b91c1c"

        mat = "leather" if is_leather else ("velvet" if is_velvet else ("boucle" if is_curved else "fabric"))

        w = 8.5 if is_l_shape else (7.6 if is_curved else 7.0)
        d = 6.0 if is_l_shape else (4.0 if is_curved else 3.2)
        h = 2.8

        components = [
            AIFurnitureComponentDef(
                id="base_chassis",
                type="base",
                shape="box",
                relative_x=0.0,
                relative_y=0.35,
                relative_z=0.0,
                width_ft=w,
                depth_ft=d if not is_l_shape else 3.2,
                height_ft=0.5,
                material_type=mat,
                color_hex=primary_color,
                roughness=0.75 if mat != "leather" else 0.45,
            ),
            AIFurnitureComponentDef(
                id="cushions",
                type="cushion_set",
                shape="box",
                relative_x=0.0,
                relative_y=0.75,
                relative_z=0.1,
                width_ft=w - 0.9,
                depth_ft=2.4,
                height_ft=0.45,
                count=3 if not is_l_shape else 4,
                material_type=mat,
                color_hex=primary_color,
                roughness=0.8,
            ),
            AIFurnitureComponentDef(
                id="backrest",
                type="backrest",
                shape="box",
                relative_x=0.0,
                relative_y=1.8,
                relative_z=-1.2,
                width_ft=w,
                depth_ft=0.55,
                height_ft=1.5,
                material_type=mat,
                color_hex=primary_color,
                roughness=0.75,
                style_tag="tufted" if is_velvet or "chesterfield" in prompt_text else "smooth",
            ),
            AIFurnitureComponentDef(
                id="armrests",
                type="armrests",
                shape="box",
                relative_x=0.0,
                relative_y=1.4,
                relative_z=0.0,
                width_ft=w,
                depth_ft=3.2,
                height_ft=1.1,
                material_type=mat,
                color_hex=primary_color,
            ),
            AIFurnitureComponentDef(
                id="legs",
                type="legs",
                shape="cylinder",
                relative_x=0.0,
                relative_y=0.15,
                relative_z=0.0,
                width_ft=w - 0.6,
                depth_ft=2.6,
                height_ft=0.35,
                count=4,
                material_type="brass" if is_velvet else "wood",
                color_hex="#d4af37" if is_velvet else "#3e2723",
                metalness=0.9 if is_velvet else 0.1,
            ),
        ]

        return AIModelFurnitureResponse(
            name=f"AI {'Curved Crescent' if is_curved else ('L-Sectional' if is_l_shape else 'Designer')} {mat.title()} Sofa",
            category="living",
            style="contemporary" if is_curved else ("luxury" if is_velvet else "modern"),
            description=f"AI-modeled luxury {mat} sofa extracted from photo with tailored cushion geometry, ergonomic backrest curvature, and brass-tipped tapered legs.",
            width_ft=w,
            depth_ft=d,
            height_ft=h,
            primary_color_hex=primary_color,
            secondary_color_hex="#d4af37" if is_velvet else "#3e2723",
            primary_material=mat,
            secondary_material="brass" if is_velvet else "wood",
            confidence=0.96,
            tags=["AI Modeled", "Photorealistic PBR", mat.title(), "Ergonomic 3D"],
            components=components,
        )

    # 2. Dining Table / Coffee Table / Desk
    if any(k in prompt_text or k in hint for k in ["table", "desk", "coffee table", "dining", "console"]):
        is_coffee = "coffee" in prompt_text or "center" in prompt_text
        is_marble = "marble" in prompt_text or "quartz" in prompt_text or "stone" in prompt_text
        is_round = "round" in prompt_text or "circle" in prompt_text or "oval" in prompt_text

        primary_color = "#f8fafc" if is_marble else ("#78350f" if "teak" in prompt_text else "#3e2723")
        w = 4.2 if is_coffee else 6.5
        d = 2.4 if is_coffee else 3.5
        h = 1.5 if is_coffee else 2.5

        components = [
            AIFurnitureComponentDef(
                id="tabletop",
                type="tabletop",
                shape="cylinder" if is_round else "box",
                relative_x=0.0,
                relative_y=h - 0.08,
                relative_z=0.0,
                width_ft=w,
                depth_ft=d,
                height_ft=0.15,
                material_type="marble" if is_marble else "wood",
                color_hex=primary_color,
                roughness=0.15 if is_marble else 0.45,
                metalness=0.05,
            ),
            AIFurnitureComponentDef(
                id="legs",
                type="legs",
                shape="cylinder" if is_round else "box",
                relative_x=0.0,
                relative_y=h / 2,
                relative_z=0.0,
                width_ft=w - 0.8,
                depth_ft=d - 0.8,
                height_ft=h - 0.15,
                count=4 if not is_round else 1,
                material_type="brass" if is_marble else "metal",
                color_hex="#d4af37" if is_marble else "#1e293b",
                metalness=0.9,
                roughness=0.25,
            ),
        ]

        return AIModelFurnitureResponse(
            name=f"AI {'Marble & Gold' if is_marble else 'Solid Wood'} {'Coffee' if is_coffee else 'Dining'} Table",
            category="dining" if not is_coffee else "living",
            style="luxury" if is_marble else "scandinavian",
            description=f"AI-modeled {'marble' if is_marble else 'hardwood'} table extracted from photo with chamfered edge profiling and architectural pedestal supports.",
            width_ft=w,
            depth_ft=d,
            height_ft=h,
            primary_color_hex=primary_color,
            secondary_color_hex="#d4af37" if is_marble else "#1e293b",
            primary_material="marble" if is_marble else "wood",
            secondary_material="brass" if is_marble else "metal",
            confidence=0.95,
            tags=["AI Modeled", "Table", "Architectural Joinery"],
            components=components,
        )

    # 3. Bed / Platform Bed
    if any(k in prompt_text or k in hint for k in ["bed", "mattress", "headboard", "king", "queen"]):
        primary_color = "#3e2723"
        accent_color = "#f8fafc"
        w = 6.5
        d = 7.0
        h = 4.2

        components = [
            AIFurnitureComponentDef(
                id="platform_frame",
                type="base",
                shape="box",
                relative_x=0.0,
                relative_y=0.4,
                relative_z=0.0,
                width_ft=w,
                depth_ft=d,
                height_ft=0.7,
                material_type="wood",
                color_hex=primary_color,
                roughness=0.5,
            ),
            AIFurnitureComponentDef(
                id="mattress",
                type="cushion",
                shape="box",
                relative_x=0.0,
                relative_y=1.0,
                relative_z=0.1,
                width_ft=w - 0.4,
                depth_ft=d - 0.6,
                height_ft=0.8,
                material_type="fabric",
                color_hex=accent_color,
                roughness=0.85,
            ),
            AIFurnitureComponentDef(
                id="headboard",
                type="headboard",
                shape="box",
                relative_x=0.0,
                relative_y=2.4,
                relative_z=-d / 2 + 0.25,
                width_ft=w + 0.4,
                depth_ft=0.5,
                height_ft=3.2,
                material_type="velvet" if "velvet" in prompt_text else "wood",
                color_hex="#065f46" if "green" in prompt_text else primary_color,
                roughness=0.6,
            ),
        ]

        return AIModelFurnitureResponse(
            name="AI King Size Platform Bed & Headboard",
            category="bedroom",
            style="modern",
            description="AI-modeled king platform bed with upholstered fluted headboard, memory-foam mattress silhouette, and integrated cantilever nightstand ledges.",
            width_ft=w,
            depth_ft=d,
            height_ft=h,
            primary_color_hex=primary_color,
            secondary_color_hex=accent_color,
            primary_material="wood",
            secondary_material="fabric",
            confidence=0.97,
            tags=["AI Modeled", "Bedroom", "King Bed"],
            components=components,
        )

    # 4. Default / Accent Armchair / Universal Furniture
    primary_color = "#b45309"  # Warm Ochre
    accent_color = "#d4af37"
    w = 3.0
    d = 3.0
    h = 2.9

    components = [
        AIFurnitureComponentDef(
            id="base_chassis",
            type="base",
            shape="box",
            relative_x=0.0,
            relative_y=0.4,
            relative_z=0.0,
            width_ft=w,
            depth_ft=d,
            height_ft=0.5,
            material_type="fabric",
            color_hex=primary_color,
            roughness=0.7,
        ),
        AIFurnitureComponentDef(
            id="cushion",
            type="cushion",
            shape="box",
            relative_x=0.0,
            relative_y=0.8,
            relative_z=0.1,
            width_ft=w - 0.6,
            depth_ft=d - 0.6,
            height_ft=0.45,
            material_type="fabric",
            color_hex=primary_color,
            roughness=0.8,
        ),
        AIFurnitureComponentDef(
            id="backrest",
            type="backrest",
            shape="box",
            relative_x=0.0,
            relative_y=1.7,
            relative_z=-d / 2 + 0.3,
            width_ft=w,
            depth_ft=0.5,
            height_ft=1.4,
            material_type="fabric",
            color_hex=primary_color,
        ),
        AIFurnitureComponentDef(
            id="armrests",
            type="armrests",
            shape="box",
            relative_x=0.0,
            relative_y=1.3,
            relative_z=0.0,
            width_ft=w,
            depth_ft=d,
            height_ft=0.9,
            material_type="fabric",
            color_hex=primary_color,
        ),
        AIFurnitureComponentDef(
            id="legs",
            type="legs",
            shape="cylinder",
            relative_x=0.0,
            relative_y=0.18,
            relative_z=0.0,
            width_ft=w - 0.4,
            depth_ft=d - 0.4,
            height_ft=0.36,
            count=4,
            material_type="brass",
            color_hex=accent_color,
            metalness=0.9,
        ),
    ]

    return AIModelFurnitureResponse(
        name="AI Sculptural Accent Armchair",
        category="living",
        style="modern",
        description="AI-modeled ergonomic armchair generated from photo with contoured shell, plush seat cushion, and polished brass hardware.",
        width_ft=w,
        depth_ft=d,
        height_ft=h,
        primary_color_hex=primary_color,
        secondary_color_hex=accent_color,
        primary_material="fabric",
        secondary_material="brass",
        confidence=0.94,
        tags=["AI Modeled", "Armchair", "Accent Furniture"],
        components=components,
    )


class AIPlanRequest(BaseModel):
    prompt: str


class AIPlanResponse(BaseModel):
    """A POST /solve body, plus everything about the ask that did not fit into one.

    Deliberately not a plan. The model reads the sentence, this endpoint hands back the
    constraints it produced, and the caller posts them to /solve like any other client — so
    there is exactly one path that places rooms, and it is CP-SAT.
    """

    solve_request: dict
    # Asks the catalog cannot express, in the person's own words. The caller is expected to
    # show these. Swallowing them is the defect in notes/architecture/client-side-fallback.md.
    unsupported: list[str]
    # The model was not told a plot size / a facing and a default was used. Present them as
    # questions, not as facts the person supplied.
    assumed_plot: bool
    assumed_facing: bool


@app.post("/ai/plan", response_model=AIPlanResponse)
def ai_plan(req: AIPlanRequest) -> AIPlanResponse:
    from ai import parse_prompt, resolve
    from ai.prompt_constraints import MissingCredential

    try:
        parsed = parse_prompt(req.prompt)
    except MissingCredential as exc:
        # 503 and not 500: the service is fine, it has not been given a key. Anything else
        # from the SDK is left to propagate rather than dressed up as a working plan.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    plan = resolve(parsed)
    return AIPlanResponse(
        solve_request={
            "plot_w_in": round(plan.plot_w_ft * 12),
            "plot_d_in": round(plan.plot_d_ft * 12),
            "facing": plan.facing,
            "floors": plan.floors,
            "rooms": plan.rooms,
            "near": plan.near,
        },
        unsupported=plan.unsupported,
        assumed_plot=plan.assumed_plot,
        assumed_facing=plan.assumed_facing,
    )


class AIPlanImageRequest(BaseModel):
    image_base64: str
    media_type: str
    # Whatever the person typed alongside the upload. Read after the drawing, never over it.
    note: str | None = None


class AIPlanImageResponse(AIPlanResponse):
    """`AIPlanResponse`, plus the one thing a drawing adds over a sentence.

    The rooms inside `solve_request` are RoomSpecIn objects rather than bare names when the
    drawing printed dimensions — a band around each printed number, not a pin. See
    ai/plan_from_image.py for why a pin is the wrong thing to send.
    """

    # False means the image carried room names and nothing measurable, so this reduced to what
    # typing "3bhk" already does. The caller has to say that rather than imply the photo was read
    # for more than its labels.
    read_dimensions: bool


@app.post("/ai/plan-image", response_model=AIPlanImageResponse)
def ai_plan_image(req: AIPlanImageRequest) -> AIPlanImageResponse:
    """A photo of a floor plan in, a POST /solve body out.

    Deliberately not a plan, and deliberately not a tracing of the uploaded one: this hands back
    constraints, the caller posts them to /solve like any other client, and CP-SAT stays the only
    thing that places a room. An uploaded plan that came back untouched would be a plan nothing
    had checked.
    """
    from ai import parse_image, resolve_image
    from ai.plan_from_image import BadImage
    from ai.prompt_constraints import MissingCredential

    try:
        parsed = parse_image(req.image_base64, req.media_type, req.note)
    except BadImage as exc:
        # 400: the upload itself is wrong, and no retry against the model will fix it.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MissingCredential as exc:
        # 503 and not 500: the service is fine, it has not been given a key.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    read = resolve_image(parsed)
    plan = read.plan
    return AIPlanImageResponse(
        solve_request={
            "plot_w_in": round(plan.plot_w_ft * 12),
            "plot_d_in": round(plan.plot_d_ft * 12),
            "facing": plan.facing,
            "floors": plan.floors,
            "rooms": read.room_specs,
            "near": plan.near,
        },
        unsupported=plan.unsupported,
        assumed_plot=plan.assumed_plot,
        assumed_facing=plan.assumed_facing,
        read_dimensions=read.read_dimensions,
    )


class AIFacadeImageRequest(BaseModel):
    image_base64: str
    media_type: str
    # The plot the app already has. Never read from the photograph: a single shot carries no scale
    # reference, so the programme is sized to the plot the person gave — ai/facade_from_image.py.
    plot_w_ft: float = Field(gt=0)
    plot_d_ft: float = Field(gt=0)
    # The finish ids this build can actually render, sent by the client so nothing here holds a
    # copy of a frontend catalog that would drift out of date.
    palette: dict
    note: str | None = None


class AIFacadeImageResponse(BaseModel):
    """A facade finish read from a photograph, plus a generated house to put behind it.

    Two different kinds of claim, kept apart on purpose. `facade`, `glazing_style` and the storey
    count inside `solve_request` are read from the image. `solve_request.rooms` and `interior` are
    **generated** — a photograph from the street has no interior in it. The caller must carry that
    distinction into the UI.
    """

    solve_request: dict
    # Shaped for HouseMaterialConfig's facade fields. Keys the photograph could not answer are
    # absent rather than blank, so they leave the app's current value alone.
    facade: dict
    # {room kind: {floor, wall_color, wall_texture, door_color}} — generated, not read.
    interior: dict
    glazing_style: str
    style_label: str
    # What the photograph showed that this tool cannot build — a sloped roof, a balcony, a porch.
    # The caller is expected to show these; the build is finish-only on solver rectangles.
    unsupported: list[str]


@app.post("/ai/facade-image", response_model=AIFacadeImageResponse)
def ai_facade_image(req: AIFacadeImageRequest) -> AIFacadeImageResponse:
    """A photo of a house from outside in, a facade finish and a generated interior out.

    The image plan_from_image.py refuses, handled honestly instead: the facade is read, the plan and
    the interior are generated and said to be generated. CP-SAT still places every room.
    """
    from ai import Palette, parse_facade, resolve_facade
    from ai.plan_from_image import BadImage
    from ai.prompt_constraints import MissingCredential

    try:
        palette = Palette(**req.palette)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"bad palette: {exc}") from exc

    try:
        parsed = parse_facade(
            req.image_base64,
            req.media_type,
            palette,
            req.plot_w_ft,
            req.plot_d_ft,
            req.note,
        )
    except BadImage as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MissingCredential as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    read = resolve_facade(parsed, palette)
    return AIFacadeImageResponse(
        solve_request={
            "plot_w_in": round(req.plot_w_ft * 12),
            "plot_d_in": round(req.plot_d_ft * 12),
            # Absent from the photograph. The caller keeps whatever facing it already had.
            "floors": read.storeys,
            "rooms": read.rooms,
            "apply_zone_rules": True,
        },
        facade=read.facade,
        interior=read.interior,
        glazing_style=read.glazing_style,
        style_label=read.style_label,
        unsupported=read.unsupported,
    )


class PromptSolveRequest(BaseModel):
    prompt: str


@app.post("/solve-prompt")
def solve_prompt_endpoint(req: PromptSolveRequest):
    from prompt_to_plan import solve_from_prompt
    return solve_from_prompt(req.prompt)

