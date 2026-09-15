"""A photo of a house from outside in, a facade finish and a generated interior out.

This is the endpoint for the image `plan_from_image.py` refuses. An exterior photograph does not
contain interior walls, so there is no layout in it to read — and the answer to that is not to
invent one and call it the person's house. It is to say plainly what is read and what is generated:

- **Read from the photograph:** storey count, facade colour, facade texture, a two-tone band if
  there is one, the glazing style, and a style label. These are properties of surfaces the camera
  actually saw.
- **Generated, and labelled as generated:** the floor plan and every interior finish. CP-SAT packs a
  room programme that fits the plot the person gave, and the model composes a finish scheme per
  room kind from the catalog the client supplied.

Nothing here claims the interior is theirs. The caller must carry that distinction into the UI;
presenting a generated layout as a reading of their house is the defect in
notes/architecture/client-side-fallback.md wearing an architect's hat.

**Massing is not read.** The build is finish-only on the solver's own rectangles: no balconies, no
projections, no sloped roof, no stepped upper storeys. Every such feature the model sees goes into
`unsupported` in the words it saw it, because the solver packs axis-aligned rectangles and a
rendered box with a read colour is honest where a box claiming to be a porch is not.

**Plot size and facing are never read.** A single photograph carries no scale reference and no
north arrow. Both come from the caller — the plot it already has, and the compass dial.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from programs import RESIDENTIAL

from .plan_from_image import MEDIA_TYPES, BadImage, check_image
from .prompt_constraints import MAX_FLOORS, MODEL, client_or_raise

# How many ids the client may offer per palette. A cap because the lists arrive over HTTP and are
# pasted into a prompt: the real catalogs hold tens of entries, not hundreds.
MAX_PALETTE_IDS = 80

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


class Palette(BaseModel):
    """The catalog ids the client will accept back, sent with the request.

    The finish catalogs live in the frontend (`lib/materialsCatalog.ts`, `lib/glazing.ts`), so this
    module does not hold a copy of them. Mirroring them here is how the two drift apart and how a
    finish the app cannot render gets offered anyway; taking them from the caller means the prompt
    always offers exactly what that build can draw, and validation checks against the same list.
    """

    floors: list[str] = Field(default_factory=list, max_length=MAX_PALETTE_IDS)
    wall_colors: list[str] = Field(default_factory=list, max_length=MAX_PALETTE_IDS)
    wall_textures: list[str] = Field(default_factory=list, max_length=MAX_PALETTE_IDS)
    door_colors: list[str] = Field(default_factory=list, max_length=MAX_PALETTE_IDS)
    glazing_styles: list[str] = Field(default_factory=list, max_length=MAX_PALETTE_IDS)


class RoomFinish(BaseModel):
    """One room kind's interior scheme. Per kind, not per room: the app keys finishes by kind."""

    kind: str = Field(description="One of the room names from the list you were given.")
    floor: str = Field(description="A floor id from the FLOORS list. Empty string to leave default.")
    wall_color: str = Field(
        description="A wall colour id from the WALL COLOURS list, or a raw #rrggbb."
    )
    wall_texture: str = Field(description="A wall texture id from the WALL TEXTURES list.")
    door_color: str = Field(
        description="A door colour id from the DOOR COLOURS list. Empty string to leave default."
    )


class FacadeRequest(BaseModel):
    """What the model fills in from an exterior photograph.

    The field descriptions are the prompt — they are written for the model, not for a reader.
    """

    storeys: int = Field(
        description=(
            "How many floors the building has above ground, counted from the photograph. A single "
            f"bungalow is 1, a G+1 duplex is 2. Cap at {MAX_FLOORS}. 0 if you cannot tell."
        )
    )
    facade_color_hex: str = Field(
        description=(
            "The dominant colour of the outside wall, as #rrggbb, sampled from the photograph "
            "under neutral light — not the shadowed side and not a sunlit highlight. Empty string "
            "if the facade is hidden or you cannot tell."
        )
    )
    facade_texture: str = Field(
        description=(
            "The id from the WALL TEXTURES list that best matches the facade's surface: smooth "
            "paint, plaster or stucco, exposed brick, bare concrete, stone, vertical wood slats. "
            "Empty string if you cannot tell."
        )
    )
    facade_band_color_hex: str = Field(
        description=(
            "A second facade colour where the building is two-tone — a dark plinth, a contrasting "
            "band at floor level, a painted parapet stripe — as #rrggbb. Empty string when the "
            "facade is one colour, which is the common case. Do not invent a band."
        )
    )
    facade_band_fraction: float = Field(
        description=(
            "How much of the wall's height that second colour covers, 0.0 to 1.0, measured from "
            "the bottom. A knee-high plinth on a two-storey house is about 0.1. 0 when there is no "
            "band."
        )
    )
    glazing_style: str = Field(
        description=(
            "The id from the GLAZING STYLES list that best matches the windows: clear glass in "
            "slim frames, dark industrial grids, bronze or smoked tint, or frameless structural "
            "glazing. Empty string if you cannot tell."
        )
    )
    style_label: str = Field(
        description=(
            "Three to six words naming the architectural style you see, for display: 'contemporary "
            "Indian duplex', 'Kerala sloped-roof bungalow', 'mid-century flat-roof villa'."
        )
    )
    rooms: list[str] = Field(
        description=(
            "A room programme for a house of this apparent size and storey count, on the plot "
            "dimensions given in the message. One entry per room, repeated for counts: three "
            "'bedroom' entries is a 3BHK. Use ONLY the room names from the list you were given. "
            "This is a proposal for a house behind this facade, not a reading of the real one — "
            "size it so it plausibly fits the plot given. Empty list if the image is not a "
            "building."
        )
    )
    interior: list[RoomFinish] = Field(
        description=(
            "One entry per distinct room kind in `rooms`, composing an interior scheme that suits "
            "the facade's style and era. Echo the facade's own palette where a designer would — a "
            "terracotta house wants warm interiors, not arctic white. Vary it by room: a bathroom "
            "is not finished like a hall."
        )
    )
    unsupported: list[str] = Field(
        description=(
            "Everything you can see in the photograph that this tool cannot build, in the words you "
            "would describe it: a sloped or tiled roof, balconies, a cantilevered porch, columns, "
            "arches, curved walls, a compound wall, stepped upper floors, a roof terrace room. The "
            "tool builds flat-roofed rectangular massing with a painted facade and nothing else, so "
            "be complete here rather than silent. Also put here what the image is, if it is not a "
            "photograph of a building from outside."
        )
    )


SYSTEM = """You look at a photograph of a house from the outside and describe two different \
things: what its facade is made of, and what a sensible house behind that facade would be like.

Be exact about which is which, because they are not the same kind of claim.

**What you read.** The storey count, the facade's colour and surface, a second facade colour if the \
building is two-tone, the window glazing, and the architectural style. These are surfaces in the \
photograph. Sample colours from evenly lit wall, not from shadow or glare.

**What you generate.** The floor plan and the interior. A photograph from the street contains no \
interior walls, so you are not reading this person's layout — you cannot, and you must not pretend \
to. You are proposing a plausible house for the plot dimensions given in the message, and \
composing interior finishes that suit the style you see. A constraint solver places every room \
afterwards and is the only thing that can prove a plan legal.

Four rules:

1. **Never pick an id that is not in the list you were given.** The lists in the message are \
exactly what this build can draw. A finish you invent cannot be rendered.
2. **Never claim a feature this tool cannot build.** It builds flat-roofed rectangular massing with \
a painted facade. Sloped roofs, balconies, porches, columns, arches, curves, projections and \
stepped storeys all go in `unsupported`, described as you see them. Being complete there is more \
useful than being impressive.
3. **Never guess the plot size or which way the house faces.** A single photograph has no scale \
reference and no north arrow. Both are given to you or left alone.
4. **If the image is not a photograph of a building from outside** — a floor plan, an interior \
shot, a rendering, a streetscape with no clear single house — return an empty `rooms` list and say \
what it actually shows in `unsupported`."""


@dataclass(frozen=True)
class ResolvedFacade:
    """`FacadeRequest` after validation against the palette the client said it could render."""

    storeys: int
    rooms: list[str]
    # Shaped for HouseMaterialConfig's facade fields in lib/materialsCatalog.ts. Keys are omitted
    # rather than sent empty, so a field the photograph could not answer leaves the app's own value
    # alone instead of overwriting it with a blank.
    facade: dict
    # {room kind: {floor, wall_color, wall_texture, door_color}}, same omission rule.
    interior: dict[str, dict]
    glazing_style: str
    style_label: str
    unsupported: list[str] = field(default_factory=list)


def _hex_or_none(value: str) -> str | None:
    candidate = (value or "").strip()
    if not candidate:
        return None
    if not candidate.startswith("#"):
        candidate = f"#{candidate}"
    return candidate.lower() if HEX.match(candidate) else None


def _id_or_none(value: str, allowed: list[str]) -> str | None:
    candidate = (value or "").strip()
    return candidate if candidate and candidate in allowed else None


def resolve_facade(parsed: FacadeRequest, palette: Palette) -> ResolvedFacade:
    """Validate the model's answer against the palette and the room catalog.

    Nothing is silently dropped and nothing is substituted. A room the catalog does not hold, or a
    finish id this build cannot render, is reported in `unsupported` where the caller has to show
    it — the same contract prompt_constraints.py holds to.
    """
    unsupported = list(parsed.unsupported)

    rooms: list[str] = []
    for name in parsed.rooms:
        clean = name.strip().lower()
        if clean in RESIDENTIAL.spaces:
            rooms.append(clean)
        else:
            unsupported.append(f"{name} (no such room in the catalog)")

    facade: dict = {}
    colour = _hex_or_none(parsed.facade_color_hex)
    if colour:
        facade["facadeColor"] = colour
    texture = _id_or_none(parsed.facade_texture, palette.wall_textures)
    if texture:
        facade["facadeTexture"] = texture
    elif parsed.facade_texture.strip():
        unsupported.append(f"{parsed.facade_texture} facade finish (not in this build's catalog)")

    # A band needs both halves to mean anything: a second colour and a share of the wall for it to
    # cover. Either one alone is a misread, not a two-tone facade.
    band = _hex_or_none(parsed.facade_band_color_hex)
    fraction = parsed.facade_band_fraction
    if band and colour and 0.0 < fraction < 1.0:
        # Bottom-up, matching how the model was asked to measure it — lib/wallBands.ts resolves a
        # scheme's bands along its axis in order.
        facade["facadeBands"] = {
            "axis": "vertical",
            "bands": [
                {"sizeFrac": round(fraction, 3), "colorId": band},
                {"sizeFrac": round(1.0 - fraction, 3), "colorId": colour},
            ],
        }

    interior: dict[str, dict] = {}
    for entry in parsed.interior:
        kind = entry.kind.strip().lower()
        if kind not in RESIDENTIAL.spaces:
            unsupported.append(f"{entry.kind} finishes (no such room in the catalog)")
            continue
        scheme: dict = {}
        for key, value, allowed in (
            ("floor", entry.floor, palette.floors),
            ("wall_texture", entry.wall_texture, palette.wall_textures),
            ("door_color", entry.door_color, palette.door_colors),
        ):
            chosen = _id_or_none(value, allowed)
            if chosen:
                scheme[key] = chosen
        # Wall colour alone takes a raw hex as well as an id, because getWallColorHexStr() in
        # lib/materialsCatalog.ts has always accepted both.
        wall = _id_or_none(entry.wall_color, palette.wall_colors) or _hex_or_none(entry.wall_color)
        if wall:
            scheme["wall_color"] = wall
        if scheme:
            interior[kind] = scheme

    glazing = _id_or_none(parsed.glazing_style, palette.glazing_styles)
    if not glazing and parsed.glazing_style.strip():
        unsupported.append(f"{parsed.glazing_style} glazing (not in this build's catalog)")

    return ResolvedFacade(
        storeys=max(1, min(MAX_FLOORS, parsed.storeys if parsed.storeys > 0 else 1)),
        rooms=rooms,
        facade=facade,
        interior=interior,
        glazing_style=glazing or "",
        style_label=parsed.style_label.strip(),
        unsupported=unsupported,
    )


def _palette_prompt(palette: Palette, plot_w_ft: float, plot_d_ft: float) -> str:
    """The lists the model may choose from, and the plot it is proposing a house for."""
    return "\n".join(
        [
            f"PLOT: {plot_w_ft:g} ft wide by {plot_d_ft:g} ft deep. Size the room programme to fit it.",
            f"ROOM NAMES: {', '.join(sorted(RESIDENTIAL.spaces))}",
            f"FLOORS: {', '.join(palette.floors)}",
            f"WALL COLOURS: {', '.join(palette.wall_colors)}",
            f"WALL TEXTURES: {', '.join(palette.wall_textures)}",
            f"DOOR COLOURS: {', '.join(palette.door_colors)}",
            f"GLAZING STYLES: {', '.join(palette.glazing_styles)}",
        ]
    )


def parse_facade(
    image_base64: str,
    media_type: str,
    palette: Palette,
    plot_w_ft: float,
    plot_d_ft: float,
    note: str | None = None,
    client=None,
) -> FacadeRequest:
    """Ask the model to read the photograph into FacadeRequest.

    `client` is injectable for the same reason as in the other two paths: the resolve half is
    testable without a key and without spending money. There is deliberately no offline path.
    """
    check_image(image_base64, media_type)

    if client is None:
        client = client_or_raise(
            "No Anthropic credential is set, so a photograph of a house cannot be read. "
            "Set ANTHROPIC_API_KEY, or pick a finish by hand."
        )

    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image_base64},
        },
        {"type": "text", "text": _palette_prompt(palette, plot_w_ft, plot_d_ft)},
        {
            "type": "text",
            "text": (
                "Read this building's facade, and propose a house to go behind it. If it is not a "
                "photograph of a building from outside, return no rooms and say what it shows."
            ),
        },
    ]
    if note and note.strip():
        content.append(
            {"type": "text", "text": f"The person who uploaded it added: {note.strip()}"}
        )

    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=FacadeRequest,
    )
    # A safety classifier can decline the request: HTTP 200, nothing parsed.
    parsed = getattr(response, "parsed_output", None)
    if parsed is None:
        raise RuntimeError(f"the model returned no facade ({response.stop_reason})")
    return parsed


__all__ = [
    "MEDIA_TYPES",
    "BadImage",
    "FacadeRequest",
    "Palette",
    "ResolvedFacade",
    "RoomFinish",
    "parse_facade",
    "resolve_facade",
]
