---
tags: [architecture, ui, finding]
status: implemented
date: 2026-09-04
---
# Three pickers, three sources, and a door nobody could find

**Claim.** A Sliding Glass Door was added to `OPENINGS_CATALOG`, verified in the
source, verified in the built client bundle — and the user could not find it
anywhere in the UI for a day. The catalog was never the problem. **Three
separate surfaces let you place an opening, and only one of them read the
catalog.**

## The three surfaces

| Surface | Read from | Before |
|---|---|---|
| Floating **Doors & Windows** drawer | `OPENINGS_CATALOG` | correct |
| **2D blueprint** inspector, "Add Opening on this Wall" | nothing | `widthIn = kind === "door" ? 36 : 48` |
| Ribbon **Structure** tab | nothing | 11 hardcoded `onSelectPlaceItem("wall_...")` buttons |

The second and third could not show a catalog entry no matter what was added to
it, and nothing in the code said so. Each looked complete in isolation.

## Why it took a day to find

The searching was done by grepping the catalog and the drawer, both of which
were correct, and concluding the feature shipped. Three compounding reasons the
answer stayed hidden:

- **The tab named "Structure" is the one place a door does not live.** Its id is
  `windows`, its groups are *Partition Walls* and *Curved Walls & Doors* — it
  carries `door_roman_arch` and `door_revolving_curved` as furniture-catalog
  objects. So it looks exactly like where a door should be.
- **A stale dev server.** One had been running for six hours across many edits
  and Fast Refresh had drifted; the browser was being served a chunk compiled
  before the catalog entry existed. A `netstat` check for it used a pattern that
  did not match Windows' output, and the empty result was reported as "nothing
  is running" — so the stale server was ruled out on bad evidence.
- **Fixing one instance did not prompt a search for others.** The 2D picker was
  found and fixed without asking whether a third existed. It did.

## What now holds

All three read the catalogs. Hardcoded placement buttons remaining in the
Structure tab: **0**, down from 11.

Two supporting changes were needed:

- **`ribbonTag` on `FurnitureItemDef`.** The ribbon button CSS has no
  `max-width` and no truncation, so rendering a full catalog name blows the row
  out sideways. This mirrors `tag`, which `OpeningItemDef` already had for the
  same reason. Items without one fall back to `name`.
- **`OpeningItemDef["kind"]` in the drag payload.** `Blueprint2DView` restated
  that union by hand while the drawer serialises an `OpeningItemDef` straight
  into it, so the annotation had already drifted and a new kind would have
  arrived unannounced.

The straight/curved wall split is now derived from the type name rather than a
hand-written list. It is cosmetic: an oddly-named future item may land in the
wrong group, but it will *appear*, which is the property the hardcoded lists
never had.

## The rule this suggests

A catalog with more than one consumer needs every consumer to read it, or the
divergence is invisible until a user goes looking for something that is
provably present in the source. When one hardcoded consumer of a shared list is
found, **look for the others before declaring it fixed.**

**Links.** [[codebase-map]] · [[render-realism]] · [[project-status]]
