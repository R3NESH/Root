---
tags: [decision]
status: current
date: 2026-09-06
---
# Free text is an input path, alongside the taps

**Decision, on the user's call, 2026-09-06.** Two entries in [[rejected-approaches]] are
reversed:

| Was rejected | Reversed to |
|---|---|
| Chatbot / conversational input | a single prompt box, one round trip, next to the room tray |
| Parking porch, sit-out, utility as room kinds | back in the catalog |

The staircase stays rejected as a room kind. It is structure the solver places, not something
anyone asks for — the note in [[rejected-approaches]] still stands unchanged.

## What [[zero-keyboard-events]] still gets

That decision said a person reaches their first plan without typing a character, because the
audience is a plot owner on a low-end phone and every text field is a place to stall. **The tap
path is untouched.** The room tray, the compass dial, the plot stepper all still work exactly as
they did, and still reach a plan with no keyboard. The prompt box is a second door into the same
room, not a replacement for the first.

What is genuinely given up: the prompt box is the most prominent thing over the viewport, so it
is now the path a first-time user is most likely to try. If the stall that decision predicted is
real, this is where it will show up, and the place to watch for it is a session that types
nothing and taps nothing.

## The rule that makes this safe

**The model emits constraints. CP-SAT emits geometry.** `backend/ai/prompt_constraints.py` maps
words onto the room vocabulary and nothing else — no coordinates, no sizes, no adjacency it
decided by itself. Every answer is validated against the catalog before it reaches the solver.

This is what keeps rules-as-constraints intact. A language model cannot reject a plan for
breaking a posted rule; the solver can, and still does, because the model never gets to place anything.

**Nothing is silently dropped.** An ask the catalog cannot express — a swimming pool, a lift, a
budget — comes back in `unsupported` and the UI shows it. A default the person never gave (plot
size, facing) is shown as an assumption, not presented as their answer. Both exist because the
alternative is [[client-side-fallback]]: a surface that looks complete and disagrees with what
was actually built.

**There is no offline path.** No key, no answer: `POST /ai/plan` returns 503 and the person is
told. A regex parser standing in for the model would be the same defect wearing a different hat.

## Cost

`claude-opus-5`, the skill default. Extraction this small runs fine on `claude-haiku-4-5` and
that is a one-line change in `MODEL` — but which model to pay for is the owner's call, not the
module's. Either way it is well under a rupee per call, which is not the number that decides
anything here: [[q-does-anyone-pay]] is still unanswered, and a chat box does not answer it.

## The three room kinds

Sit-out, car porch and utility are back because free text needs a vocabulary wide enough to
answer with. Someone typing "car parking" at a catalog that has no such room gets an
`unsupported` line where they expected a porch, which is honest and useless.

Sizes are sourced in `backend/solver/rooms.py` — NBC 2016 puts a common car space at 2.5 x 5.0 m
and an individual one at 3.0 x 6.0 m. The porch is pinned to the street edge, because a porch no
car can reach is not a porch.

Sit-out and porch are **open-sided**: roofed, not walled. That brings back the `open_sided`
concept [[rejected-approaches]] retired when its only two users went away. Three places respect
it — the daylight rule still makes them touch the outside face, `solver/walls.py` emits no
exterior wall for them, and `Scene.tsx` builds no wall mesh where the solver emitted none.
Without the last of those, a car porch renders as a garage and the bill of quantities bills for
bricks nobody laid.

Balcony is **not** added. It is a sit-out on an upper floor, and placing it correctly needs
floor-aware catalog rules that do not exist — [[single-storey-first]] is still most of the way
true.

**Links.** [[rejected-approaches]] · [[zero-keyboard-events]] · rules-as-constraints ·
[[client-side-fallback]] · [[preferences-are-scored]] · [[q-does-anyone-pay]]
