---
tags: [reference]
date: 2026-09-06
---
# Where the duplex blueprints came from

Four G+1 plans in `frontend/lib/modelBlueprints.ts` — 20×30, 30×40, 30×50 and 40×60. They are the
first blueprints in the catalogue that set `floors: 2`, which the solver now honours
([[bye-law-and-storeys]]).

## Sources

Room programmes and sizes are taken from published Indian plans for the same plot sizes, not
invented:

| Plot | What was taken | Source |
|---|---|---|
| 30×40 | G+1 split: living 12×14, parents' bedroom + bath on the ground; master 12×14 with ensuite and a 10×10 second bedroom above | [PlanMyPlot 30×40](https://www.planmyplot.com/house-plans/30x40-house-plan) |
| 30×40 | 3BHK duplex programme on a 1,200 sq ft site | [Happho plan 028](https://happho.com/sample-floor-plan/30x40-duplex-3-bedroom-house-plan-028/) |
| 30×50 | East-facing 3–4BHK duplex with pooja room; living to the north-east, kitchen north-west | [MakeMyHouse 30×50](https://www.makemyhouse.com/architectural-design/30x50-1500sqft-home-design/1059/122), [Happho plan 042](https://happho.com/sample-floor-plan/30x50-vastu-3-bhk-house-plan-east-facing-042/) |
| 40×60 | Villa-scale duplex: 16×18 living, 10×14 island kitchen, 12×16 master, 12×12 and 10×12 beyond | [PlanMyPlot 40×60](https://www.planmyplot.com/house-plans/40x60-house-plan) |
| 20×30 | 600 sq ft site, ~492 sq ft of footprint per floor after setbacks, 2BHK over G+1 | [HouseYog 20×30](https://www.houseyog.com/20x30-house-plans) |

None of these are gazetted documents or licensed drawings — they are published sample plans, used
for the *programme* (which rooms, roughly what size, which floor) rather than copied geometry.
The solver packs the layout itself.

## What the card claims

`builtUpAreaSqFt` on each card is **measured from an actual solve of that blueprint**, not copied
from the source page. The published plans quote larger figures — around 2,100 sq ft built-up for
a 30×40 duplex against the ~1,090 this packs — because they fill the envelope on both floors
while the solver stops at each room's catalogue maximum. Quoting their number over our layout
would be a claim the plan does not deliver.

Verified at the time of writing: all four solve, every room reachable through the stair core, and
none of them needed the Vaastu rung of the relaxation ladder.

| Plan | Status | Carpet, ground | Carpet, first |
|---|---|---|---|
| 20×30 2BHK | OPTIMAL | 382 sq ft | 216 sq ft |
| 30×40 3BHK | OPTIMAL | 621 sq ft | 380 sq ft |
| 30×50 4BHK | FEASIBLE | 644 sq ft | 514 sq ft |
| 40×60 4BHK | OPTIMAL | 909 sq ft | 621 sq ft |

Re-measured after the stair core was widened for a dog-leg and upper storeys were made to land
on the ground floor's footprint.

## The one built from an elevation

`duplex_30x50_glazed_stair_tower` came from a rendered street elevation the user supplied — a
BungalowMakers design, watermarked, plot marker "B-09". No floor plan was available for it: the
published pages for their 30×50 duplex give the programme (3BHK, pooja, kitchen, parking, garden,
east-facing, 1,500 sq ft per floor) and no room dimensions, and the specific design did not turn
up in search.

**What the elevation actually says**, and all this blueprint takes from it:

- G+1 with an open terrace over the first floor, parapet and railing.
- The stair core is on the front, expressed as a full-height glazed tower — the defining move of
  the facade, and the reason `roomGlazing.stairs` is structural glazing with three mullions.
- Car porch beside it at ground level, with a balcony over it on the first floor.
- Charcoal render, an exposed-brick strip, wood slats and black metal.

**What it cannot say**, and what is therefore the solver's own: where any room goes. An elevation
is not a plan. The room sizes are typical for a 30×50 and the layout is packed from scratch, so
this is a house *in the manner of* that elevation, not a copy of that house. The description on
the card says so in as many words.

Porch, balcony and terrace are not modelled at all — parking porch and sit-out were removed as
room kinds on 2026-08-25 ([[rejected-approaches]]), so the plan carries the storeys and the stair
tower but not the two projections.

Measured: FEASIBLE, 13 rooms, 2 storeys, all reachable, 629 sq ft carpet on the ground and 446
above.

## Where the split is decided

Not here. `assign_floors` in `backend/api/main.py` puts the public half of the house on the ground
and moves the extra bedrooms and bathrooms up, always keeping one of each downstairs — the
parents' room, which is what these published plans do too.
