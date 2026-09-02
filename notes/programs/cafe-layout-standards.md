---
tags: [reference, programs, cafe]
status: current
date: 2026-09-02
---
# Café layout standards

Where the numbers in [[registry.py|backend/programs/registry.py]] and the café space sizes in
`backend/solver/rooms.py` come from. Collected 2026-09-02 for the first non-residential
programme — see [[program-packs]].

These are trade and code figures, not house rules. Anything the solver posts as a *constraint*
should be traceable to a line below; anything that is only taste belongs in the renderer.

## Space per seated customer

| Figure | Source |
|---|---|
| 15–18 sq ft per customer in seating areas | American Institute of Architects, quoted by Toast |
| 18–20 sq ft per guest, comfortable | Toast, *How to Design a Cafe Floor Plan* |
| ~15 sq ft per person, general-menu coffee shop average | Toast |

Used for: the `seating` minimum of 12×12 ft (144 sq ft ≈ 8 covers) and the maximum of 30×30.

## Front of house vs back of house

**60 % guest / 40 % prep, bar, staff and kitchen.** This shapes the café `zone_rules`:
`seating`, `entry`, `queue` and `lounge` are held to the front bands (0.0–0.7 of depth from the
shopfront); `prep`, `wash`, `pantry` and `staff` to the back (0.55–1.0). Posted up front as
CP-SAT constraints, never scored afterwards — same discipline as [[vaastu-as-constraints]].

> [!warning] What is enforced is the order, not the ratio
> The bands guarantee back of house sits **behind** front of house, verified across all four
> facings in `test_programs.py`. They do not pin the area split. Measured on the 24×30 ft
> envelope with the default seven-space mix, the result is **74 % FOH / 26 % BOH**, because the
> area objective grows `seating` (the space with the largest maximum) into whatever is left.
> Forcing 60/40 would make small plots infeasible for a number an owner should be free to
> argue with. If a real café needs a bigger kitchen, raise `prep`'s minimum in
> `solver/rooms.py` — that is the honest lever.

## Overall size

| Café size | Area |
|---|---|
| Small | 600–900 sq ft |
| Medium | 1,000–1,750 sq ft |
| Full service with BOH kitchen, ADA-compliant aisles throughout | 1,000–1,500 sq ft minimum |

The buildable envelope of a 30×40 ft plot at the project's default setbacks is 24×30 ft =
**720 sq ft**, which lands inside the "small café" band. That is the fixture in
`backend/tests/test_programs.py`, chosen because it is the real target, not because it is easy.

## Circulation and clearances

- **ADA aisle between occupied tables: 36 in minimum, 44 in preferred** on main routes.
- **Table spacing: 42–60 in** between square tables, 24–30 in when set diagonally.
- **Queue: at least 36 in wide, 10–12 ft long** to hold a morning rush without fouling the door.
  Hence `queue` at 3.5–6 ft wide × 8–14 ft long, with the aspect cap raised to 4:1 — a queue is
  a corridor on purpose, and the rule that stops a bedroom becoming one is exactly wrong here.
- **Leave ~1.2 m between the order line and the seating** so the two flows do not collide.

## Decompression zone

**The first five feet inside the door stay clear** so an arriving customer can get their
bearings. This is why `entry` is a space in its own right rather than part of the seating floor,
and why its minimum is 5 ft deep. It is also why `entry` is in `street_edge_spaces`: a quadrant
rule holds a room's *centre* in a band, which is not enough to guarantee frontage.

## Order-to-pickup separation

The handoff point is the classic bottleneck and must be separate from the register, so the line
keeps moving while drinks are made. Encoded as the `counter` aspect allowance (up to 4.5:1, 8–18
ft long) rather than as two spaces — one long counter with order at one end and pickup at the
other is how small shops actually do it.

## Flow

Small shops work best **linear**: entrance → queue → order → pickup → seating, with customers
never crossing the staff production path. In the pack this is the parent tree: `entry` opens off
`seating`, `queue` off `entry`, `counter` off `queue`, and `prep` off `counter` — so the only
door between front and back of house is the one behind the till.

## Health and code separations

A customer WC opening directly into food prep or dry store fails inspection. `forbidden_pairs`
carries `(washroom, prep)` and `(washroom, pantry)`, the same mechanism that keeps an Indian
kitchen off a bathroom wall.

## Sources

- [Toast — How to Design a Cafe Floor Plan](https://pos.toasttab.com/blog/on-the-line/cafe-floor-plans)
- [Toast — How to Design a Coffee Shop Floor Plan](https://pos.toasttab.com/blog/on-the-line/coffee-shop-floor-plans)
- [The Restaurant HQ — Coffee Shop Floor Plan Examples & Steps](https://www.therestauranthq.com/startups/coffee-shop-floor-plan/)
- [Plan7Architect — How Big Should a Café Be?](https://plan7architect.com/how-big-should-a-cafe-be-size-guide-ai2/)
- [Foyr — Cafe Floor Plan Layout Standards](https://foyr.com/learn/cafe-floor-plan/)
- [The Restaurant Warehouse — Coffee Shop Layout](https://therestaurantwarehouse.com/blogs/restaurant-equipment/coffee-shop-layout)
- [Superior Seating — Restaurant Seating Layout & Dimensions Guide](https://www.superiorseating.com/design-specs-center)
- [Barista Life — Coffee Shop Layout Design Guide](https://baristalife.co/blogs/blog/coffee-shop-layout-design)

## Size bands used by the blueprint catalogue

| Band | Area | Seats | Plans in `frontend/lib/cafeBlueprints.ts` |
|---|---|---|---|
| Takeaway | under 400 sq ft built | 0 | Grab-and-Go Kiosk (20×30) |
| Small | 600–900 sq ft | 15–25 | Corner Coffee Bar (25×40), Neighbourhood Café (30×40), Laneway Café (25×50) |
| Medium | 900–1,200 sq ft | 25–40 | Daylight Café & Lounge (30×50), Bakery Café (36×48), Roastery (35×50) |
| Full service | 1,200+ sq ft | 40+ | Café Restaurant (40×60) |

Seat counts as laid out run 8–26 at 20–35 sq ft per seat measured over the seating room alone.
That is above the 15–20 trade figure because the built-in grid uses the 42 in minimum table gap
*and* a 36 in perimeter aisle; packing to the trade number means hand-placing tables tighter than
the ADA route allows on at least one side.

> [!note] Only north and south facings
> The eight plans face N or S. The catalogue's min/max are axis-aligned — a `counter` is 8–18 ft
> on X and 3.5–7 ft on Y, a `queue` the other way round — so an east- or west-facing shop cannot
> express a counter running across its flow. Rotating a space is a solver change, not a data one.
> An E/W plot still *solves* (the zoning rotates correctly and the tests cover all four facings);
> there is just no curated plan for it.

## What is NOT encoded yet

- Occupant load and egress width. A café over a certain occupancy needs two exits; the solver
  cuts one entrance and no second means of egress.
- Grease interceptor, exhaust hood routing, and the make-up air path.
- Outdoor seating as a *space*. There is no `terrace` in the catalog, so the solver never sizes
  it or counts its covers. The fit-out has patio furniture, a rope line and a bike rack, which
  is decoration on the plot, not a planned zone — and a lot of Indian café covers are out there.
- Counter height variation (bar 42 in, table 30 in, ADA 34 in max for a service counter).
