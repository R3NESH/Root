---
tags: [decision]
status: locked
date: 2026-09-06
---
# The bye-law is an input, and the storeys are real

Three things landed together, because the first two are what make the third mean anything.

## 1. Setbacks come from the rule, not from a constant

`frontend/lib/plot.ts` held `DEFAULT_SETBACK` at 5/5/3/3 ft — [[environment-notes]] called it
hardcoded, a known gap, not a convention. Every envelope, every solve and every area figure sat
on that guess.

`frontend/lib/compliance.ts` now derives them from **G.O. Ms. No. 168 (07-04-2012)**, the Revised
Common Building Rules for GHMC and HMDA, keyed on plot area (Tables II and III) and raised by the
abutting road width. Road width is a new input, because the bye-law asks for it and the app never
did. The old fixed values stay one click away for a plot these tables do not describe.

## 2. Coverage and FAR are reported; FSI is not a cap here

Nothing in the app computed ground coverage or floor area ratio. Both now sit in the Bye-Law
panel, along with the height ceiling the road width buys.

The structural fact worth knowing: **Telangana sets no fixed FSI cap.** Buildable volume comes
from the setbacks, the height ceiling and what those leave. So FAR is reported as an *outcome* of
the plan and never presented as passing or failing a limit. Coverage is measured on the ground
floor alone; FAR on every storey.

### Confidence

The tables are transcribed from two secondary references to G.O. Ms. 168
([infralens](https://infralens.in/dcr/setbacks/hyderabad),
[studiomatrx](https://www.studiomatrx.org/india/hyderabad/setbacks)), which do not agree in every
detail and neither of which is the gazetted PDF. Every readout shows the band it matched, not
just the number, and the setbacks stay overridable. Verify against the current notification on
BuildNow before anything is filed.

## 3. G+1 and G+2 are solved, not drawn

[[single-storey-first]] promised the `floor` field would make this one integer rather than a
rewrite. It very nearly was.

- Rooms compete for space only within their own storey: `add_no_overlap_2d` is posted per floor.
- Connectivity, separation and daylight are posted per floor too. A bedroom is not reachable from
  a hall one storey below it, and the outside face of the building is the outside face of *that*
  floor's footprint.
- Doors, windows, walls and the front door are derived per floor. The front door is on the ground.
- The mix is split by `assign_floors`: the public half stays down, bedrooms and their bathrooms go
  up, and one of each kind is always kept on the ground.

### The stair core

[[rejected-approaches]] records "staircase as a room kind" as rejected, and it stays rejected: the
stair is not in `ROOM_CATALOG`, appears in no mix, and cannot be added or removed by the user.
What exists instead is a solver-placed **core** — one rectangle repeated on every floor, pinned to
the same position by an equality constraint across storeys, and treated as a link in the
reachability flood-fill so a G+1 does not report half its rooms unreachable. A storey above the
ground has to be reachable from it; that is the vertical form of the rule in
[[rooms-do-not-form-a-house]], and it is the reason the core exists at all.

It also roots the parent tree on any floor with no hall. Without that the upstairs bedrooms of a
G+1 opened off the bathroom.

## What is still missing

This is a slice of [[project-phases|Phase 2]], not all of it:

- **No egress or fire rules.** No second exit, no travel distance, no fire tender access. The
  height ceiling is checked against the road width and nothing else.
- **The stair is a rectangle, not a staircase.** No rise, no run, no landing count, no headroom,
  and no slab opening cut for it in the floor above.
- **Three storeys is the ceiling** (`MAX_FLOORS`). Past that the bye-law is about lifts and fire
  escape, none of which is modelled.
- **The offline engine still packs one floor.** It reports the floors it actually solved, and the
  floor badge reads from that rather than from what was asked for.
