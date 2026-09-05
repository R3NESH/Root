---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Input is plot dimensions + facing, never square footage

**Decision.** The user gives width × depth and a facing direction. Never an area figure.

**Because.** Square footage is underdetermined. 1200 sq ft is 30×40, 20×60, 24×50, or L-shaped.
A UI that morphs a box out of an area number is silently picking an aspect ratio and hiding that
choice from the person whose house it is.

Plot dimensions are also the market's native unit — 20×30, 30×40, 30×50, 40×60, 50×80 ft.

**Consequences.** Drives [[ui-principles]] — preset plot cards, drag handles, a compass dial for
facing. Facing is what makes [[vaastu-as-constraints]] meaningful at all.

**Open.** [[q-telangana-parcel-geometry]] — if cadastral parcel geometry exists, map-pick could
replace typing entirely.

Source: [[HANDOFF]] §3.2
