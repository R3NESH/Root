# Furniture models

Real scanned furniture that replaces the procedural boxes in
`frontend/lib/furnitureCatalog.ts` and the auto-furnished rooms in
`frontend/lib/interiorDetails.ts`.

## Source and licence

All 15 assets are from [Poly Haven](https://polyhaven.com/models), released under
**CC0 1.0** — public domain, no attribution required, commercial use permitted.
Recorded here for provenance, not obligation.

## Why committed rather than fetched

- CC0 removes licence risk from vendoring the binaries.
- The app keeps an offline solver fallback; a runtime CDN dependency for the
  furniture would undercut that.
- Hotlinking `dl.polyhaven.org` from every page load spends someone else's
  bandwidth for no benefit to them.

Cost is 7.3 MB in `frontend/public/models/`.

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
`pooja_mandir`, `bed_single`, `dining_round` and the café-specific pieces still
render procedurally. No CC0 model in the set is an honest match; a wrong model
reads worse than a clean box.
