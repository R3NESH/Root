---
tags: [decision, assets, licensing]
status: current
date: 2026-09-19
---
# CC0 only, because the app redistributes the model file

## Decision

Furniture models ship in `frontend/public/models` and are served to every visitor. That is
**redistribution**, not use. So the bar is: commercial use **and** redistribution, granted by the
licence attached to the file.

**CC0 by default. CC BY only once an attribution surface exists. Never NC. Never SA.**

| Licence | Commercial | Redistribute | Verdict |
|---|---|---|---|
| CC0 | yes | yes | **use** |
| CC BY | yes | yes, with credit | allowed once credit is displayed everywhere the asset appears |
| CC BY-NC | **no** | — | blocked |
| CC BY-SA | yes | yes, virally | avoid — the share-alike term reaches the work it is combined with |
| Manufacturer BIM | per agreement | usually not | needs a contract |
| Marketplace (TurboSquid, CGTrader) | per model | usually not | needs a specific deal |

## Why redistribution is the operative word, not "commercial use"

A designer downloading a model into their own CAD file is *using* it. This product hands a copy
of the `.gltf` and its textures to every browser that opens the page. Several licences permit the
first and not the second, which is why "free to download" from BIMobject or 3D Warehouse does not
mean free to re-serve.

Three traps worth naming because they are easy to walk into:

1. **Free is not usable.** [Amazon Berkeley Objects](https://www.amazon.science/code-and-datasets/amazon-berkeley-objects-abo-dataset)
   is ~8,000 real product models with metadata and would be near-perfect — released **CC BY-NC
   4.0**, so it is out. Amazon's own pages disagree with each other on this (one says CC BY 4.0);
   an ambiguous licence is not a licence.
2. **Attribution is per-asset, forever.** CC BY credit has to follow the model into every render,
   export and printed sheet, not sit in a footer. That is a UI commitment, so CC BY waits until
   there is somewhere to put it.
3. **Git is publication.** A model committed and later deleted is still in history. Anything of
   unknown licence stays out of the repo, not "in for now".

## Sources actually surveyed

- **[Poly Haven](https://polyhaven.com/models)** — CC0, and what this repo uses. Full index
  checked: good on lighting, seating, tables, storage, decor; **no sanitaryware and no soft
  furnishing at all**. It cannot fill bath or rugs/curtains, and no amount of picking changes
  that.
- **[ambientCG](https://ambientcg.com/)** — CC0, but materials rather than models.
- **[Sketchfab Download API](https://sketchfab.com/developers/download-api)** — 1M+ models, most
  commercially licensed, delivered as glTF/GLB which is exactly what `modelLoader.ts` reads.
  Two costs, per [their guidelines](https://sketchfab.com/developers/download-api/guidelines):
  the end user must authenticate with a Sketchfab account *inside the app*, and the CC licence
  and creator credit must be displayed wherever the asset appears. The realistic route to scale.
- **[Objaverse](https://objaverse.allenai.org/)** — 800K objects, ODC-By dataset over mixed CC
  licences. Research-grade and unfiltered; needs per-object licence checking and heavy curation.
- **[BIMobject / Polantis](https://www.bimobject.com/en-us/categories/furniture)** — real
  products from 2,000+ manufacturers. This is the one that would make the
  [[schedule-is-measured-not-declared|FF&E schedule]] *procurable* — a schedule naming a
  manufacturer and model number is an order, not a drawing. Built for professional download, not
  third-party redistribution. Business development, not engineering.

## The rule that costs nothing now

Every model records its licence when it is added. `notes/assets/furniture-models.md` is that
record. The point is not legal defence at this stage — it is avoiding the rework where 200 models
are curated and half turn out unshippable, and the curation is lost with them.

**Links.** [[furniture-models]] · [[schedule-is-measured-not-declared]] · [[codebase-map]]
