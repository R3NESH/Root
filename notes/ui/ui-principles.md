---
tags: [ui]
date: 2026-08-23
---
# UI decisions

> [!tip] Governing principle
> **Never ask a question whose answer can be shown instead.**
> Setbacks are drawn as a dashed envelope, not asked. Buildable area is a number that updates
> itself.

Hard constraint on the whole surface: [[zero-keyboard-events]].

## Ranked, highest value first

1. **Preset plot cards** — 20×30, 30×40, 30×50, 40×60, 50×80, plus a custom escape. One tap, no
   keyboard, works on a low-end phone. Half a day. These are the market's own sizes
   ([[competitor-landscape]]).
2. **Drag handles on the plot edges**, replacing number fields. **Must snap to whole feet** —
   Indian plots are exact and raw dragging yields 29.7. See [[integer-inches]].
3. **Solve three, let them pick.** Users cannot answer "kitchen east or south?" — that is why
   they came. Show three plans from three objective weightings. Humans choose well and specify
   badly. This deletes roughly half the questionnaire.
4. **Steppers** (`− 2 BHK +`), never text inputs.
5. **Room tray** — drag chips (Bedroom / Kitchen / Bath / Pooja / Hall) into the plot; the solver
   snaps them legal. User supplies intent, machine supplies correctness. Build after the spine
   works.
6. **Compass dial** for facing — direction is spatial, so a rotating ring beats a dropdown, and
   [[vaastu-as-constraints]] makes it meaningful. Facing is half the input
   ([[input-is-plot-dimensions]]).

> [!missing] The prototype does not exist
> A 2D SVG prototype of patterns 1, 2, 4 and 6 was built and rendered in the originating
> conversation. **It was not saved to disk.** Rebuild from this note at
> [[step-1-threejs-shell]].

Note that #3 quietly increases solver load threefold — factor it into the timing at
[[step-4-drift-objective]].

Source: [[HANDOFF]] §8
