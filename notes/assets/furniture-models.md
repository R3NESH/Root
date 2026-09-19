# Furniture models

Real scanned furniture that replaces the procedural boxes in
`frontend/lib/furnitureCatalog.ts` and the auto-furnished rooms in
`frontend/lib/interiorDetails.ts`.

## Source and licence

All 62 assets are from [Poly Haven](https://polyhaven.com/models), released under
**CC0 1.0** — public domain, no attribution required, commercial use permitted.
Recorded here for provenance, not obligation.

### 24 added 2026-09-19

Aimed at the categories the catalog was thinnest in. After: living 23, decor 15, bedroom 10,
lighting 8, dining 8.

- **Lighting** — Chandelier_01, Chandelier_03, lantern_chandelier_01
- **Dining** — painted_wooden_chair_01, round_wooden_table_01, folding_wooden_stool,
  painted_wooden_bench
- **Living** — WoodenChair_01, mid_century_lounge_chair, chinese_sofa, modern_coffee_table_01,
  side_table_tall_01, small_wooden_table_01, gallinera_table, modern_wooden_cabinet,
  wooden_display_shelves_01
- **Bedroom** — vintage_day_bed, painted_wooden_cabinet
- **Decor** — ceramic_vase_01, ceramic_vase_03, fancy_picture_frame_01,
  standing_picture_frame_01, wall_clock, marble_bust_01

**Dimensions are measured, not estimated.** Each catalog entry's `dimensions` came from the
POSITION accessor bounds in that model's own `.gltf`, times the node scale where one exists —
`Chandelier_01` carries a 0.01 node scale and reads as 245 ft without it. Same principle as
[[schedule-is-measured-not-declared]].

> [!warning] Poly Haven cannot fix two categories
> Checked against the full 1,100-asset index: there is **no sanitaryware** (no WC, basin, tub or
> shower) and **no soft furnishing** (no rug, curtain or cushion). Bath stays at 4 pieces and
> soft at 2. Those need a different source — see [[object-library-licensing]].

### Footprint

19 MB → **49 MB** across 62 model folders. Textures on the new 24 are 1k, where the original 38
were halved to 512, which is most of the jump. Still comfortably inside git; the ceiling is
around 200 MB before the repo gets unpleasant and object storage is the answer instead.

## Why committed rather than fetched

- CC0 removes licence risk from vendoring the binaries.
- The app keeps an offline solver fallback; a runtime CDN dependency for the
  furniture would undercut that.
- Hotlinking `dl.polyhaven.org` from every page load spends someone else's
  bandwidth for no benefit to them.

Cost is 19 MB in `frontend/public/models/`.

The first 15 covered the auto-furnished rooms. The 23 added since cover the
**fit-out set** — the pieces an interior designer places by hand: a lounge
chair, ottoman, side and console tables, nightstand, chest of drawers, dining
chair, bar stool, office desk and shelving, television, hob, microwave, AC
condenser, ceiling fan, and the whole lighting layer (chandelier, caged
pendant, flush ceiling lamp, desk lamp, wall sconce) plus planter, picture
frame, floor mirror, cushions and a brass diya.

`potted_plant_01` was fetched and dropped: 5.6 MB on its own, against 0.2-1.2 MB
for everything else, and `potted_plant_02` was already committed.

## Preparation

Downloaded at the **1k** LOD, then every texture halved to 512 px and re-encoded
as JPEG q82. Geometry (`.bin`) is untouched. That cut the set from 37 MB to
7.3 MB with no visible loss at dollhouse or walkthrough distance — a 512 px
albedo already exceeds what a 4 ft sofa resolves to on screen.

Each asset keeps its published layout, so the loader resolves the `.bin` and
`textures/` relative to the `.gltf` exactly as Poly Haven ships it:

```
public/models/<Asset>/<Asset>_1k.gltf
public/models/<Asset>/<Asset>_1k.bin
public/models/<Asset>/textures/*.jpg
```

## Scale and orientation

Poly Haven models real-world metric. The scene works in feet, so the only
transform applied is `× 3.280839895`. The models are deliberately **not** fitted
to the catalog's declared `dimensions` — that box is a placement footprint for
snapping, not a statement about the object's true proportions, and fitting to it
distorts pieces whose footprint was approximate.

Facing was measured, not assumed: for every seat and bed in the set the tall
vertex mass (backrest, headboard) sits at **−z**, so each piece faces **+z**.
That is the same convention the procedural furniture already used, so a lone
piece needs no yaw correction. Only composed sets carry `rotY`.

## How the swap works

`frontend/lib/furnitureModels.ts` maps a furniture `type` to one or more parts.
`mountRealModels` walks the finished scene group once per layout build and
swaps the children of any group whose `userData.type` has a mapping.

This works without touching `interiorDetails.ts` because every built-in group
already tags itself with `userData.isFurniture` and a catalog `type`. The two
vocabularies overlap but are not identical — the rooms emit `dining_table`
where the catalog says `dining_6seater` — so both keys are in the map.

The swap is additive and failure-tolerant:

- An unmapped type keeps its procedural geometry.
- A failed fetch keeps its procedural geometry and warns.
- Only children present when the swap was scheduled are removed, so the
  selection ring added later in the same build survives.
- Uploaded `glbUrl` objects and AI parametric pieces are skipped — they are
  already what the user asked for.

## Not yet mapped

`study_desk`, `vanity_table`, `tv_unit`, `refrigerator`, `kitchen_island`,
`bed_single`, `dining_round` and the café-specific pieces still
render procedurally. No CC0 model in the set is an honest match; a wrong model
reads worse than a clean box.

The same is true of everything in the `bath` category, the kitchen sink and
chimney, the washing machine, the geyser, the split AC indoor unit and the
curtains. Poly Haven has no sanitaryware and no Indian kitchen fittings at all,
so those are modelled in `furnitureCatalog.ts` and that is all they will ever
be. It is the largest remaining gap in the library.

## Mounting height

Catalog items carry an optional `mountHeightFt`. Ceiling and wall pieces — fan,
chandelier, pendant, flush lamp, sconce, wall TV, split AC, geyser, chimney,
hob, microwave, cushions — are modelled from their own base upward like
everything else, so without it they would be placed on the floor. The placement
ghost previews at the same height.
