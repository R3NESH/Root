---
tags: [reference]
date: 2026-09-06
---
# Stair styles

`frontend/lib/stairCatalog.ts` generates six placeable staircases, listed in the **Stairs** panel
of the Structure tab. The spiral that was already in the catalogue moved into the same panel from
Decor rather than being duplicated.

## Where the shapes come from

The type vocabulary is the standard one — straight, L-shaped (quarter turn), U-shaped or dog-leg
(half turn), winder, spiral, floating/cantilever, bifurcated:

- [Lapeyre Stair — 16 types of stairs](https://www.lapeyrestair.com/blog/types-of-stairs/)
- [Viewrail — types of stairs](https://www.viewrail.com/floating-stairs/types-of-stairs/)
- [Keuka Studios — modern staircase types](https://www.keuka-studios.com/types-of-stairs-2/)

## Where the numbers come from

**NBC 2016, one- and two-family dwellings:** riser at most **190 mm (7.5 in)**, tread at least
**250 mm (9.8 in)**, flight at least **0.90 m (3 ft)** wide, handrail at 0.90 m, headroom 2.1–2.2 m.

- [Studio Matrx — staircase design and NBC compliance](https://www.studiomatrx.org/guides/staircase-design-india)
- [HouseYog — standard staircase dimensions in India](https://www.houseyog.com/blog/standard-staircase-dimensions-india/)
- [Infralens — staircase design calculation (IS 456, NBC 2016)](https://infralens.in/knowledge/staircase-design-calculation)

Same caveat as [[bye-law-and-storeys]]: these are secondary references to the code, not the
gazetted document.

## Why the footprints are what they are

A 9.55 ft floor-to-floor rise at a 7.5 in maximum riser needs **16 risers**, and 16 treads at the
9.8 in minimum need **13.1 ft of run**. Every style spends that same run; what differs is how it
is folded, and the footprint follows from the folding rather than from taste:

| Style | Footprint | Riser | Tread | Notes |
|---|---|---|---|---|
| Straight | 3.6 × 14 ft | 7.2 in | 10.1 in | One run, cheapest, longest |
| L-shaped | 10.5 × 10.5 ft | 7.2 in | 9.8 in | Two legs, landing in the corner |
| Dog-leg | 7.5 × 11 ft | 7.2 in | 11.1 in | Half turn; the solver's own core |
| Winder | 9.4 × 9.8 ft | 7.2 in | 9.9 / 10.8 in | Three kite treads instead of a landing |
| Floating | 3.6 × 14 ft | 7.2 in | 10.1 in | Cantilevered, glass balustrade, needs a wall |
| Bifurcated | 11 × 12 ft | 7.2 in | 12.3 in | Wide flight splitting into two returns |

Three of these failed the tread minimum on the first pass — the L at 6.5 in, the winder at 8.3 in,
the straight a hair under — because the footprints were guessed before the arithmetic was run.
The check that caught it is worth keeping: **run ≥ 13.1 ft, spent across the legs, or the treads
are too shallow to walk.**

## What a placed stair is not

It does not connect storeys the way the solver's core does. It cuts no opening in the slab above,
it is not part of the reachability flood-fill, and the walkthrough cannot climb it — it is drawn,
walked around and costed by its footprint like any other placed object. Raising **Storeys** in the
Bye-Law panel is still what produces a structural stair.
