---
tags: [finding]
status: current
date: 2026-09-06
---
# A room you cannot walk through

**Raised by the user, not by a test:** *"the blueprint houses feels unreal, for example in the
dining room, the dining table occupies so much space that it's difficult to walk."*

Correct. The cause was arithmetic in `frontend/lib/interiorDetails.ts`, and the same mistake was
in three rooms.

## The mistake

`fitSize(realFt, roomExtentFt, clearanceFt)` reserves clearance **once**, against a piece
measured by **its own top**. That is right for a piece standing against a wall — a bed, a
wardrobe, a sofa — and wrong for anything standing in the middle of the floor.

A dining table stands in the middle. Its chairs stick out past the table top on both sides, and
the walkway is needed on both sides too. Neither was counted:

```
12 x 8 ft dining room
  table depth   3.0 ft   fitSize said this fits: 8 − 3.5 = 4.5
+ chairs        2.8 ft   1.4 ft each side, never counted
= set           5.8 ft
  room          8.0 ft   →  1.1 ft of floor each side
```

`fitSize` also has a 1.2 ft floor, so it will happily return a dining table the size of a stool
rather than admit the room cannot take one.

**And orientation was never considered.** The set is built with its chairs on the z axis, so a
12 x 8 room pushed the chairs into the 8 ft direction while 12 ft sat unused beside it. A quarter
turn is most of the fix on its own.

## What replaced it

`fitDiningSet(rw, rd, chairReachFt)` picks the largest **real** table that leaves a walkway,
tries both orientations, and prefers seating both sides over seating more people. Folding those
two preferences into one pass takes a wall-side table in a 12 x 8 room and never notices that a
quarter turn would have seated both sides of the same table — that bug was written and caught in
the same hour.

| room | result |
|---|---|
| 12 x 12 | 6.0 x 3.0, both sides |
| 12 x 8 | 4.5 x 2.75, both sides, **rotated** |
| 8 x 12 | 4.5 x 2.75, both sides |
| 10 x 10 | 6.0 x 3.0, wall-side |
| 8 x 8 | 4.5 x 2.75, wall-side |

Clearances are the repo's own numbers, not invented: **3 ft route** — 36 in, the same ADA figure
`lib/cafeInteriors.ts` already cites for its perimeter aisle — **2 ft** on the far chair side,
**1.5 ft** at the table ends, which carry no chairs. When nothing seats both sides the table goes
back against a wall and seats one, which is what a house that size actually does.

## The same defect in two more rooms

**Bathtub.** `fitSize(5.25, rw, 2.0)` in the catalog's 4 ft wide bathroom returned a **2.0 ft
bathtub**. There is no such thing as a smaller soaking tub; a 4 x 6 Indian bathroom has a shower,
and the shower was already being drawn in every one of them. The tub is now full size or absent,
gated at `rw >= 6 && rd >= 6`.

**And it was being drawn through the washing machine.** Both stand in the same back corner: the
tub reaches `rx + 5.4` and the machine starts at `rx + rw − 2.4`, which overlap below 7.8 ft of
width. The catalog never makes a bathroom that wide, so a bathroom with a tub no longer also gets
a machine. Nobody had noticed — there is no test that could.

The machine belongs in the `utility` anyway now that [[free-text-input]] put one in the catalog.
`addRoomInteriorDetails()` cannot see the other rooms, so it cannot make that call. Noted rather
than guessed.

**Pooja altar.** Two tiers sized by two independent `fitSize` calls with different clearances,
which in the catalog's smallest 3 ft pooja room returned a 1.4 ft base under a 1.2 ft tier — the
tier only that wide because it had hit `fitSize`'s floor, not because anything chose it. A mandir
stands against a wall, so it is sized off that wall now, and the tier is a proportion of the base
and can never come out wider than the thing it stands on.

## What is still true of the other rooms

Bed, wardrobe, sofa and rug are fine. They sit against a wall, so clearance-once is the correct
rule for them and `fitSize` is the right tool. This finding is not "`fitSize` is broken" — it is
"`fitSize` was used on three pieces that do not stand against a wall".

## Nobody has looked at it

`tsc --noEmit` 0, `next build` clean, and the fit ladder checked numerically against a replica of
the logic. **No screenshot.** There is no browser driver in this repo. The frontend has no tests,
so nothing here proves the chairs land where the arithmetic says — and [[render-realism]] already
records that the last two render regressions were caught only because the user said the picture
looked wrong.

**Links.** [[render-realism]] · [[realism-gaps]] · [[free-text-input]] · [[codebase-map]]
