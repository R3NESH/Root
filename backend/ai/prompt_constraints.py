"""Free text in, solver constraints out.

The model's job here is vocabulary, not design. It maps what a person said — "car parking",
"veranda", "wash area", "mummy's room next to the kitchen" — onto the constraint vocabulary
that solver/model.py already enforces, and says so plainly when an ask has no such mapping.

**It never emits geometry.** No coordinates, no room sizes, no adjacency it decided on its own.
CP-SAT places the rooms and stays the only thing that can prove a plan legal, which is what
notes/decisions/vaastu-as-constraints.md requires: a plan that breaks Vaastu is a rejected
plan, and a language model cannot do the rejecting.

**Nothing is silently dropped.** An ask the catalog cannot express comes back in `unsupported`
and the caller is expected to show it. A swimming pool that quietly vanishes is the same class
of defect as notes/architecture/client-side-fallback.md — a surface that looks complete and
disagrees with what was actually built.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from envelope import FACINGS
from programs import RESIDENTIAL

# The default in the claude-api skill. Extraction this small runs fine on a cheaper model —
# claude-haiku-4-5 is the obvious swap and is a one-line change — but which model to pay for is
# the owner's call, not this module's.
MODEL = "claude-opus-5"

MAX_FLOORS = 3

# Plot dimensions when the person gave none. The same default the older regex parser used
# (prompt_to_plan.py): the most common Indian plot in the band this product targets. The caller
# is told this was assumed rather than stated — see ResolvedPlan.assumed_plot.
DEFAULT_PLOT_W_FT = 30.0
DEFAULT_PLOT_D_FT = 40.0


class PlanRequest(BaseModel):
    """Exactly what POST /solve accepts, and nothing it does not.

    The field descriptions are the prompt. They are what the model reads to decide how to fill
    this in, so they are written for it rather than for a human reader.
    """

    plot_w_ft: float = Field(
        description="Plot width in feet, measured along the road. 0 if the person did not say."
    )
    plot_d_ft: float = Field(
        description="Plot depth in feet, running back from the road. 0 if they did not say."
    )
    facing: str = Field(
        description=(
            "Which way the plot faces, meaning the direction the road lies in from the plot: "
            "exactly one of N, E, S, W. Empty string if the person did not say."
        )
    )
    floors: int = Field(
        description=(
            "How many storeys including the ground floor. 'G+1' is 2, 'duplex' is 2, "
            "'single storey' is 1. 0 if the person did not say."
        )
    )
    rooms: list[str] = Field(
        description=(
            "One entry per room, repeated for counts: a 3BHK is three 'bedroom' entries. Use "
            "ONLY these names: hall (living room, drawing room), dining, kitchen, bedroom, "
            "bathroom (toilet, washroom, attached bath), pooja (puja, prayer, mandir), store "
            "(storage, box room), entrance (foyer, entry lobby), utility (wash area, washing "
            "area, laundry), sitout (veranda, verandah, balcony, patio, portico), parking "
            "(car porch, car park, garage, car shed). A BHK count means bedrooms only: a 2BHK "
            "is hall + kitchen + 2 bedrooms, plus whatever bathrooms they asked for. Empty "
            "list if they named no rooms at all."
        )
    )
    near: list[list[int]] = Field(
        description=(
            "Pairs the person wants close together, as two 0-based indices into the `rooms` "
            "list you just produced — [[2, 4]] means rooms[2] and rooms[4]. Only a pair they "
            "actually asked for. Empty list if they asked for none."
        )
    )
    apply_vaastu: bool = Field(
        description=(
            "True unless the person said they do not want Vaastu. Default true: it is the "
            "normal expectation for an Indian house."
        )
    )
    unsupported: list[str] = Field(
        description=(
            "Every part of the request that cannot be expressed in the fields above, quoted in "
            "the person's own words — a swimming pool, a lift, a specific room size, a budget, "
            "a style, a material, anything about a room this catalog does not hold. Do not "
            "guess a substitute and do not leave an ask out of this list. Empty only if "
            "everything they asked for is covered above."
        )
    )


SYSTEM = """You turn an Indian plot owner's description of the house they want into \
constraints for a floor plan solver.

You do not design the house. You do not choose where rooms go, how big they are, or which \
rooms touch which. A constraint solver does all of that, and it is the only thing that can \
prove a plan is legal. Your one job is to read what the person asked for and put it in the \
fields.

Two rules that matter more than being helpful:

1. Never invent a room the person did not ask for, and never quietly substitute one. If they \
asked for something the room list cannot express, it goes in `unsupported` in their own words.
2. Never guess a plot size, a facing, or a storey count they did not give. Leave those 0 or \
empty and let the caller ask them."""


@dataclass(frozen=True)
class ResolvedPlan:
    """`PlanRequest` after validation against the catalog the solver actually holds."""

    plot_w_ft: float
    plot_d_ft: float
    facing: str
    floors: int
    rooms: list[str]
    near: list[list[int]]
    apply_vaastu: bool
    unsupported: list[str] = field(default_factory=list)
    # True when the model left a field empty and the default above was used instead. The caller
    # has to ask rather than present a 30x40 north-facing plot as though it had been stated.
    assumed_plot: bool = False
    assumed_facing: bool = False


def resolve(parsed: PlanRequest) -> ResolvedPlan:
    """Validate a model's answer against the catalog, defaulting only what is safe to default.

    A room name the solver does not hold is not dropped — it moves into `unsupported`, where
    the caller has to deal with it. `near` indices are remapped across that removal for the
    same reason api/main.py remaps them: an index into a list that has since lost an entry
    points at the wrong room, not at nothing.
    """
    unsupported = list(parsed.unsupported)

    rooms: list[str] = []
    index_map: dict[int, int] = {}
    for position, name in enumerate(parsed.rooms):
        clean = name.strip().lower()
        if clean in RESIDENTIAL.spaces:
            index_map[position] = len(rooms)
            rooms.append(clean)
        else:
            unsupported.append(f"{name} (no such room in the catalog)")

    near = [
        [index_map[pair[0]], index_map[pair[1]]]
        for pair in parsed.near
        if len(pair) == 2
        and pair[0] != pair[1]
        and pair[0] in index_map
        and pair[1] in index_map
    ]

    facing = parsed.facing.strip().upper()
    assumed_facing = facing not in FACINGS
    if assumed_facing:
        facing = "N"

    assumed_plot = parsed.plot_w_ft <= 0 or parsed.plot_d_ft <= 0
    plot_w = parsed.plot_w_ft if parsed.plot_w_ft > 0 else DEFAULT_PLOT_W_FT
    plot_d = parsed.plot_d_ft if parsed.plot_d_ft > 0 else DEFAULT_PLOT_D_FT

    floors = max(1, min(MAX_FLOORS, parsed.floors if parsed.floors > 0 else 1))

    return ResolvedPlan(
        plot_w_ft=plot_w,
        plot_d_ft=plot_d,
        facing=facing,
        floors=floors,
        rooms=rooms,
        near=near,
        apply_vaastu=parsed.apply_vaastu,
        unsupported=unsupported,
        assumed_plot=assumed_plot,
        assumed_facing=assumed_facing,
    )


class MissingCredential(RuntimeError):
    """No ANTHROPIC_API_KEY, so there is nothing to ask.

    Checked before the request rather than after: the SDK builds a client happily without a
    key and only fails when it tries to sign a request, which arrives as a 401 that reads like
    a broken key rather than an absent one.
    """


def client_or_raise(reason: str):
    """A real client, or `MissingCredential` naming what the caller cannot do without one.

    Shared with plan_from_image.py so the two input paths cannot drift on what counts as a
    credential: either one the SDK resolves does, and checking only `api_key` would refuse a
    machine authenticated by token.
    """
    import anthropic

    client = anthropic.Anthropic()
    if not (client.api_key or client.auth_token):
        raise MissingCredential(reason)
    return client


def parse_prompt(prompt: str, client=None) -> PlanRequest:
    """Ask the model to fill in PlanRequest.

    `client` is injectable so the resolve half of this module can be tested without a key and
    without spending money. It is not a fallback: there is deliberately no offline path here,
    because an offline path that guessed would be the defect in
    notes/architecture/client-side-fallback.md wearing a different hat.
    """
    if client is None:
        client = client_or_raise(
            "No Anthropic credential is set, so free-text input cannot be read. "
            "Set ANTHROPIC_API_KEY, or use the room tray."
        )

    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        output_format=PlanRequest,
    )
    # A safety classifier can decline the request: HTTP 200, nothing parsed. Saying so beats
    # handing the caller an empty house.
    parsed = getattr(response, "parsed_output", None)
    if parsed is None:
        raise RuntimeError(f"the model returned no plan ({response.stop_reason})")
    return parsed
