---
tags: [decision, frontend, design]
status: locked
date: 2026-09-04
---
# Chrome is monochrome — colour belongs to the drawing

**Decision.** The application chrome is a near-monochrome warm-graphite ramp with one
terracotta accent reserved for active state. Saturated colour is spent only on *data*:
room fills, Vaastu zones, material swatches, blueprint linework. Every dimension, count
and coordinate is set in IBM Plex Mono with `tabular-nums`.

Tokens live in `frontend/app/globals.css`: a seven-step type scale, a nine-step 2px
spacing scale, a three-step radius scale, and the ink/surface ramps.

**Because.** The product is a drafting tool. The interface should recede so the model reads;
a glowing toolbar competes with the 3D scene for the same attention. It also removes the whole family of signals that mark a page as machine-drafted
— glassmorphism, diagonal gradients, neon glow, stock Tailwind hues, emoji as iconography.

**What it replaced.** The first pass had grown 61 distinct hex values (mostly untouched
Tailwind defaults — `#38bdf8` alone appeared 155 times), 44 `backdrop-filter` blurs,
52 gradients, 26 font sizes, 15 border radii and roughly 400 emoji used as icons. Each
component had been styled in isolation, so nothing shared a scale.

**Consequences.**
- Emoji icon glyphs became 2–3 letter block codes (`SOF`, `WIN`, `DR`) in a hairline mono
  chip, the way a CAD block library labels its parts. The `icon:` field in every catalog
  now holds a code, not a pictograph.
- Pills are rectangles. Radius never exceeds 4px.
- `transition: all` is gone; only colour properties animate, at one duration.
- Adding a colour means asking whether it is chrome or data. If chrome, it is grey.

**Care.** Tailwind's palette is the default reach for any generated stylesheet. Picking
`#0ea5e9` again re-introduces the tell. Mix new values off the ramps already in
`globals.css`.
