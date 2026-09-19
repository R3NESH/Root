---
tags: [decision, frontend, interiors, presentation]
status: current
date: 2026-09-19
---
# The finish board draws every piece at one scale, and carries no photography

## Decision

`frontend/lib/moodboard.ts` builds a one-page board per room and one for the whole house:
a palette strip, the resolved floor / wall paint / wall finish / joinery swatches at a size you
can judge a colour by, and every piece of furniture in that scope drawn **front-on at a single
shared scale**, labelled with its real dimensions in feet-inches and millimetres.

No photographs. No collage.

## Why one scale is the feature

A moodboard is normally a collage — cutouts arranged by eye. That is fine for mood and useless
for judgement: a side table and a three-seater end up the same size on the page, so the board
cannot answer the question it is actually looked at for, which is *will that console read as too
big next to the sofa*.

Here every piece is drawn off its measured box at one scale, chosen so the largest piece fits a
cell and then applied to everything. A stool comes out small. That is correct, and it is the
point. The scale is printed on the sheet in px-per-foot, and the packer is a shelf-pack that
shrinks the scale until every piece fits rather than rescaling any piece independently.

Verified numerically rather than by eye: the drawn-width-to-real-width ratio is identical across
every piece on the board, spread 0.0000.

## Why no photography, stated rather than hidden

There are no product photographs in this repo and no licensed catalogue behind it. A board of
placeholder images would be a lie dressed as a deliverable — the exact failure mode
[[client-side-fallback]] was about. The sheet says so in the title block: *"No product
photography — these are the real dimensions, not a catalogue shot."*

Colours are not invented either. A finish shows its own catalog swatch; a piece shows its placed
colour, or its catalog default, or a neutral. A wall **texture** has no colour of its own, so it
is shown in the wall paint's colour and labelled as the finish over it.

## Scope and resolution

Whole-house scope reads the global finishes; room scope resolves room-then-building, the same
order the renderer resolves them, so the board shows the room that will be built rather than a
default. Ceiling fixtures are left off — a flush fixture drawn to scale beside a sofa tells
nobody anything. Identical pieces group with a count, as on the
[[schedule-is-measured-not-declared|FF&E schedule]].

## What would change this

Real product imagery, if a licensed catalogue ever backs the furniture. Then the board becomes a
collage *and* keeps the scale, which nothing else does. Until then the honest version is the
scaled one.

**Links.** [[schedule-is-measured-not-declared]] · [[lighting-says-the-number]] ·
[[elevations-look-from-inside]] · [[client-side-fallback]] · [[codebase-map]]
