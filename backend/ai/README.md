# backend/ai

Free text or a photographed drawing to solver constraints. The model does vocabulary; CP-SAT still
decides everything about the plan.

`prompt_constraints.py` — `parse_prompt()` calls Claude with a Pydantic output format;
`resolve()` validates the answer against `programs/registry.py` and moves anything the catalog
cannot express into `unsupported`. There is **no offline fallback**, on purpose:
[[client-side-fallback]] records what one costs.

`plan_from_image.py` — `parse_image()` reads a photo, scan or screenshot of a floor plan with the
same schema plus `room_sizes`, the dimensions printed on the drawing; `resolve_image()` runs the
same validation and turns each printed number into a **band**, not a pin. Three things it refuses
to do, each with a test in `tests/test_ai_image.py`:

- **It does not trace.** The plan that comes back is a legal plan resembling the upload, not the
  upload. Pinning a house of exact read dimensions against setbacks, connectivity and
  daylight returns INFEASIBLE rather than a house, so the sizes go as `min_*_in`/`max_*_in` a foot
  either side. The caller must say this out loud — [[client-side-fallback]] with a camera attached.
- **It does not read a photograph of a building.** An exterior shot does not contain the interior
  walls, so a layout from one would be invented. The model returns no rooms and says what the image
  actually shows.
- **It does not estimate an unprinted dimension.** `[0, 0]` means the drawing does not say, and the
  room falls back to the catalog range in `solver/rooms.py`.

`facade_from_image.py` — the image `plan_from_image.py` refuses: a photograph of a house from
outside. It does **two different things and says which is which**.

- **Read** from the photograph: storey count, facade colour, facade texture, a two-tone band, the
  glazing style, a style label. Surfaces the camera saw.
- **Generated**: the floor plan and every interior finish. A street photograph has no interior walls
  in it, so this is a proposal for the plot the person already set, not a reading of their house.
  `lib/aiFacadeImage.ts:summary()` is the sentence that states this, and shipping the feature without
  it is [[client-side-fallback]] with a camera attached.

Two more constraints it holds to. **Massing is never read** — the build is finish-only on the
solver's rectangles, so a sloped roof, a balcony, a porch or a stepped storey goes into
`unsupported` in the words the model saw it. **Plot size and facing are never read** — one
photograph carries no scale reference and no north arrow, so both come from the caller.

The finish catalogs live in the frontend, so this module holds no copy of them: the client sends the
ids it can render as `palette`, the prompt offers exactly those, and `resolve_facade()` validates
the answer against the same list. A finish outside it is reported, never passed through to render as
nothing.

Wired to `POST /ai/plan`, `POST /ai/plan-image` and `POST /ai/facade-image` in `../api/main.py`, all
three of which hand back a `POST /solve` body rather than a plan — one endpoint, one job. The plan
route also reports `read_dimensions`, which is false when the drawing gave labels and nothing
measurable; the caller has to say that rather than imply the photo was read for more than its labels.

`min_*_in`/`max_*_in` on `RoomSpecIn` were declared from the start and read by nothing until the
image path needed "about 12 ft" instead of "exactly 12 ft". `api/main.py:_size_range()` now honours
them, clipped to the catalog so a band cannot undo the NBC 2016 minimums.

Needs `ANTHROPIC_API_KEY`. Without it both endpoints return 503 rather than guessing.

Reverses the chatbot half of [[rejected-approaches]] on the user's call, 2026-09-06 —
[[free-text-input]].
