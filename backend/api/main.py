"""POST /solve — notes/build/step-3-wire-together.md.

Stateless request/response, no database, no secrets — notes/architecture/environment-notes.md.
Payload shape follows notes/architecture/output-schema.md.
Supports per-room custom dimension overrides (e.g. 15x15 ft bedroom) and stable dragging.

Ships the solver's derived `openings`, `wall_thickness_in`, `entrance_edge` and `rooms_reachable`
rather than blanking them — notes/architecture/duplicated-geometry.md.
"""

from typing import Union
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from envelope import DEFAULT_SETBACK, FACINGS, Setback, buildable_envelope
from solver.model import solve_layout
from solver.rooms import ROOM_CATALOG, Room

app = FastAPI(title="plot-to-plan solver")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class SetbackIn(BaseModel):
    front_in: int = Field(ge=0)
    rear_in: int = Field(ge=0)
    left_in: int = Field(ge=0)
    right_in: int = Field(ge=0)


class PrevRoom(BaseModel):
    index: int = Field(ge=0)
    x_in: int
    y_in: int


class RoomSpecIn(BaseModel):
    name: str
    custom_w_in: int | None = None
    custom_d_in: int | None = None
    min_w_in: int | None = None
    max_w_in: int | None = None
    min_d_in: int | None = None
    max_d_in: int | None = None


class SolveRequest(BaseModel):
    plot_w_in: int = Field(gt=0)
    plot_d_in: int = Field(gt=0)
    facing: str = "N"
    rooms: list[Union[str, RoomSpecIn]]
    setback: SetbackIn | None = None
    prev: list[PrevRoom] | None = None
    apply_vaastu: bool = True
    # Index of the room the user just dragged. Only that room is released from its Vaastu
    # quadrant — notes/solver/vaastu-and-connectivity-drop-on-edit.md.
    moved_index: int | None = None


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


class SolveMeta(BaseModel):
    status: str
    solve_ms: float
    vaastu_constraints_applied: list[str]
    envelope_origin_x_in: int
    envelope_origin_z_in: int
    envelope_w_in: int
    envelope_d_in: int
    unknown_room_names: list[str]
    entrance_edge: str | None = None
    rooms_reachable: int = 0


class SolveResponse(BaseModel):
    rooms: list[RoomOut]
    meta: SolveMeta


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

    env = buildable_envelope(req.plot_w_in, req.plot_d_in, facing, setback)

    unknown: list[str] = []
    rooms: list[Room] = []

    for item in req.rooms:
        if isinstance(item, str):
            r_name = item
            custom_w = None
            custom_d = None
        else:
            r_name = item.name
            custom_w = item.custom_w_in
            custom_d = item.custom_d_in

        if r_name not in ROOM_CATALOG:
            unknown.append(r_name)
            continue

        base = ROOM_CATALOG[r_name]
        min_w = custom_w if custom_w is not None else base.min_w_in
        max_w = custom_w if custom_w is not None else base.max_w_in
        min_d = custom_d if custom_d is not None else base.min_d_in
        max_d = custom_d if custom_d is not None else base.max_d_in

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

        rooms.append(
            Room(
                name=r_name,
                min_w_in=min_w,
                max_w_in=max_w,
                min_d_in=min_d,
                max_d_in=max_d,
            )
        )

    if not rooms or env.width_in <= 0 or env.depth_in <= 0:
        return SolveResponse(
            rooms=[],
            meta=SolveMeta(
                status="NO_INPUT" if not rooms else "EMPTY_ENVELOPE",
                solve_ms=0.0,
                vaastu_constraints_applied=[],
                envelope_origin_x_in=env.origin_x_in,
                envelope_origin_z_in=env.origin_z_in,
                envelope_w_in=env.width_in,
                envelope_d_in=env.depth_in,
                unknown_room_names=unknown,
            ),
        )

    prev = {p.index: (p.x_in, p.y_in) for p in req.prev} if req.prev else None
    result = solve_layout(
        env.width_in,
        env.depth_in,
        rooms,
        prev=prev,
        apply_vaastu=req.apply_vaastu,
        moved_index=req.moved_index,
    )

    return SolveResponse(
        rooms=[
            RoomOut(
                name=r.name,
                floor=0,
                x_in=r.x_in + env.origin_x_in,
                y_in=r.y_in + env.origin_z_in,
                w_in=r.w_in,
                d_in=r.d_in,
                wall_thickness_in=r.wall_thickness_in,
                openings=r.openings,
                habitable=r.habitable,
                wet=r.wet,
            )
            for r in result.rooms
        ],
        meta=SolveMeta(
            status=result.status,
            solve_ms=round(result.solve_ms, 2),
            vaastu_constraints_applied=result.vaastu_constraints_applied,
            envelope_origin_x_in=env.origin_x_in,
            envelope_origin_z_in=env.origin_z_in,
            envelope_w_in=env.width_in,
            envelope_d_in=env.depth_in,
            unknown_room_names=unknown,
            entrance_edge=result.entrance_edge,
            rooms_reachable=result.rooms_reachable,
        ),
    )
