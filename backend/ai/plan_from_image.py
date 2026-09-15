"""A photo of a floor plan in, solver constraints out.

The same contract as prompt_constraints.py, against a different kind of input: the model reads
what is *printed on the drawing* — room labels, dimension strings, the north arrow — and fills
in the constraint vocabulary the solver already enforces. It still emits no geometry. No
coordinates, no placement, no adjacency it decided on its own; CP-SAT places the rooms and stays
the only thing that can prove a plan legal, which is what notes/decisions/vaastu-as-constraints.md
requires.

**The output is not a tracing.** The plan that comes back is a legal plan resembling the one in
the photo, not the one in the photo. Room sizes read off the drawing are passed as a *band*
around the printed number, not as a pin: a pinned set of exact sizes plus setbacks, Vaastu,
connectivity and daylight is how you get INFEASIBLE instead of a house. The caller has to say
this out loud to the person who uploaded the photo — presenting a re-solved plan as their own
plan is the defect in notes/architecture/client-side-fallback.md with a camera attached.

**An image that is not a floor plan gets no rooms.** An exterior photograph does not contain the
interior walls, so any layout derived from one is invented. The model is told to report that in
`unsupported` and return nothing rather than hallucinate a house.
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass

from pydantic import Field

from programs import RESIDENTIAL

from .prompt_constraints import (
    MODEL,
    PlanRequest,
    ResolvedPlan,
    client_or_raise,
    resolve,
)

# What the Claude vision API accepts as an image. Anything else is rejected here rather than sent
# and refused — docs.claude.com/en/docs/build-with-claude/vision.
MEDIA_TYPES = ("image/jpeg", "image/png", "image/gif", "image/webp")

# Our cap on a decoded upload, not the API's. Chosen to sit well under the request ceiling and to
# keep a phone photo of a plan (2-4 MB) comfortably inside it.
MAX_IMAGE_BYTES = 6 * 1024 * 1024

# How far either side of a dimension read off the drawing the solver may move, in feet. A read
# number is evidence, not a specification: the drawing is at an unknown scale, printed in
# feet-and-inches, and photographed at an angle. Pinning it exactly is what makes a plan
# infeasible — see the module docstring.
SIZE_BAND_FT = 1.0

# A printed dimension larger than this is a misread — a whole-plot figure mistaken for a room, or
# millimetres read as feet. Dropped rather than clamped, so the solver falls back to its catalog
# range and the caller is not told a bedroom is 400 ft wide.
MAX_ROOM_FT = 60.0


class ImagePlanRequest(PlanRequest):
    """`PlanRequest` plus the dimensions printed on the drawing.

    Separate from the text path's schema on purpose. A sentence rarely carries a size for every
    room and prompt_constraints.py sends those to `unsupported`; a drawing carries them for
    nearly every room, and they are most of what reading a drawing is for.
    """

    room_sizes: list[list[float]] = Field(
        description=(
            "One [width_ft, depth_ft] pair for every entry in `rooms`, in the same order, in "
            "decimal feet. Convert what is printed: 12 ft 0 in by 10 ft 0 in is [12.0, 10.0], "
            "10 ft 6 in is 10.5, 3600 by 3000 mm is [11.8, 9.8]. Use [0, 0] for a room whose "
            "dimensions are not printed on the drawing — never estimate one from how big the "
            "room looks on the page. The list must be exactly as long as `rooms`."
        )
    )


SYSTEM = """You read a floor plan drawing and turn what is printed on it into constraints for a \
floor plan solver.

The image is a photograph, scan or screenshot of an architectural floor plan, most often an \
Indian builder's or draughtsman's plan for a single plot.

What to read, and only what to read:

- Room labels. A room goes in `rooms` only if the drawing labels it. Map the label onto the \
allowed names: BED ROOM and M.BED are bedroom, DRAWING and LIVING are hall, TOILET and W.C. are \
bathroom, PUJA and DEVARA MANE are pooja, SIT OUT and VERANDAH are sitout, CAR PARK and PORCH \
are parking, WASH AREA is utility.
- The dimension string printed beside each label, into `room_sizes`.
- The overall plot dimensions, from the boundary dimension line or the title block.
- The north arrow, or text like EAST FACING. `facing` is the direction the ROAD lies in from the \
plot, which on a plan is the side the main entrance and the sit-out or porch open onto.
- The storey, if the drawing says GROUND FLOOR of a set, or FIRST FLOOR PLAN.

Four rules that matter more than being helpful:

1. Never invent a room the drawing does not label, and never quietly substitute one. A label the \
allowed names cannot express goes in `unsupported`, quoted as printed.
2. Never estimate a dimension that is not printed. Not from the room's size on the page, not \
from what is usual. [0, 0] means the drawing does not say, and that is a useful answer.
3. Never guess a plot size, a facing or a storey count the drawing does not carry. Leave those 0 \
or empty.
4. **If the image is not a floor plan, return no rooms at all.** A photograph of a house from the \
street, a photograph of a room, a rendering, an elevation, a site plan — none of these contain \
the interior walls, and a layout derived from one would be invented. Return an empty `rooms` list \
and say what the image actually shows in `unsupported`."""


@dataclass(frozen=True)
class ResolvedImagePlan:
    """A `ResolvedPlan`, plus the size band for each room that survived validation."""

    plan: ResolvedPlan
    # One entry per room in `plan.rooms`, same order, shaped for api/main.py's RoomSpecIn. A room
    # whose dimensions were not printed contributes a bare {"name": ...} and is left to the
    # catalog range.
    room_specs: list[dict]
    # True when the drawing carried at least one usable dimension. False means this reduced to
    # what typing "3bhk" already does, and the caller should say so rather than imply the photo
    # was read for more than its room names.
    read_dimensions: bool


def _band(value_ft: float) -> tuple[int, int] | None:
    """A printed dimension as (min_in, max_in), or None if it is not usable."""
    if value_ft <= 0 or value_ft > MAX_ROOM_FT:
        return None
    low = max(1.0, value_ft - SIZE_BAND_FT)
    return round(low * 12), round((value_ft + SIZE_BAND_FT) * 12)


def resolve_image(parsed: ImagePlanRequest) -> ResolvedImagePlan:
    """Validate the model's answer, carrying the printed dimensions onto the surviving rooms.

    `resolve()` does every check the text path already does — catalog names, `near` remapping, the
    defaults the caller has to be told about. This adds one thing: `room_sizes` is indexed by
    position in `parsed.rooms`, and `resolve()` drops the names the catalog does not hold, so the
    sizes are walked against the same predicate to stay aligned with what survived.
    """
    plan = resolve(parsed)

    sizes = list(parsed.room_sizes)
    specs: list[dict] = []
    read_dimensions = False

    for position, name in enumerate(parsed.rooms):
        clean = name.strip().lower()
        if clean not in RESIDENTIAL.spaces:
            continue

        pair = sizes[position] if position < len(sizes) else None
        usable = pair is not None and len(pair) == 2
        width = _band(pair[0]) if usable else None
        depth = _band(pair[1]) if usable else None

        spec: dict = {"name": clean}
        # Either axis can be usable on its own: a drawing that prints one dimension and leaves the
        # other to the eye is still telling the truth about the one it printed.
        if width:
            spec["min_w_in"], spec["max_w_in"] = width
        if depth:
            spec["min_d_in"], spec["max_d_in"] = depth
        if width or depth:
            read_dimensions = True
        specs.append(spec)

    return ResolvedImagePlan(plan=plan, room_specs=specs, read_dimensions=read_dimensions)


class BadImage(ValueError):
    """The upload is not something that can be sent — wrong type, not base64, or too large.

    Its own error because this is a trust boundary: the bytes arrived from a browser, and the
    caller turns this into a 400 rather than letting a decode failure surface as a 500.
    """


def check_image(image_base64: str, media_type: str) -> None:
    """Reject an upload that cannot be sent. Shared with facade_from_image.py."""
    if media_type not in MEDIA_TYPES:
        raise BadImage(f"{media_type or 'no image type'} is not one of {', '.join(MEDIA_TYPES)}")
    try:
        # validate=True so a data: URL prefix or stray whitespace is an error rather than silently
        # discarded bytes that then fail at the API as an unreadable image.
        decoded = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise BadImage(f"the image is not valid base64 ({exc})") from exc
    if not decoded:
        raise BadImage("the image is empty")
    if len(decoded) > MAX_IMAGE_BYTES:
        raise BadImage(
            f"the image is {len(decoded) // (1024 * 1024)} MB, over the "
            f"{MAX_IMAGE_BYTES // (1024 * 1024)} MB limit"
        )


def parse_image(
    image_base64: str,
    media_type: str,
    note: str | None = None,
    client=None,
) -> ImagePlanRequest:
    """Ask the model to read the drawing into ImagePlanRequest.

    `note` is whatever the person typed alongside the upload — "this is the ground floor", "the
    road is on the short side". It goes in after the image as ordinary user text, so it can
    correct a misread without being trusted over what is printed.

    `client` is injectable for the same reason it is in prompt_constraints.py: the resolve half is
    testable without a key and without spending money. There is deliberately no offline path.
    """
    check_image(image_base64, media_type)

    if client is None:
        client = client_or_raise(
            "No Anthropic credential is set, so an uploaded plan cannot be read. "
            "Set ANTHROPIC_API_KEY, or enter the rooms by hand."
        )

    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image_base64},
        },
        {
            "type": "text",
            "text": (
                "Read this floor plan into the fields. If it is not a floor plan, return no "
                "rooms and say what it shows."
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
        output_format=ImagePlanRequest,
    )
    # A safety classifier can decline the request: HTTP 200, nothing parsed. Saying so beats
    # handing the caller an empty house.
    parsed = getattr(response, "parsed_output", None)
    if parsed is None:
        raise RuntimeError(f"the model returned no plan ({response.stop_reason})")
    return parsed
