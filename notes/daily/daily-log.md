---
tags: [daily, moc]
---
# Daily log

Index of daily notes. New one: `Ctrl+P` → *Daily notes: Open today's daily note*
(configured to `notes/daily/YYYY-MM-DD` off [[daily|the daily template]]).

## Entries

- [[2026-09-20]] — vault audit (14 modules had no [[codebase-map]] row, 3 code comments pointed at notes that do not exist, graph 1,873 → 1,962 nodes), then a ponytail pass: the BOQ was pricing a different building (wall run +35%, bricks −42% — [[boq-was-not-reading-the-takeoff]]), −458 lines net, and 6 pre-existing test failures surfaced
- [[2026-09-19]] — the heaviest day yet, 11 commits: wall joins, the interior-design package, drawn stairs, live plan, drone tour, room-catalog maximums (fill 69% → 92%), and three client-side performance bugs
- **2026-09-18** *(no daily note — written up in [[project-status]])* — Vaastu and the pooja room removed on instruction; custom and curved plot shapes; the drawn-wall delete bug that demolished room 0's north wall
- **2026-09-12** *(no daily note — written up in [[codebase-map]])* — plan-photo and facade-photo input paths
- [[2026-09-06]] — requested room pairs scored not constrained (`NEAR_WEIGHT = 60`, swept); size drift built and deleted after measuring 1 in of churn over 10 edits; two locked decisions reversed for [[free-text-input]]; [[furniture-clearances]] found from a user report
- [[2026-09-03]] — walls as objects, bill of quantities, NBC 2016 room sizing, compact footprint objective
- [[2026-08-30]] — 20 authentic prebuilt blueprints, contiguous snapping matrix, exterior window constraint, awning alignment; then structurize pass (5 modules out of the 3 biggest files, 2 duplications killed), graph 548→651 nodes, root `CLAUDE.md`, and [[client-side-fallback]] found
- [[2026-08-25]] — full project review: two blocking regressions found, vault drift corrected
- [[2026-08-24]] — step 2: CP-SAT solver core built, test baseline established (5/5 passing)
- [[2026-08-23]] — vault created; phasing corrected; step 1: Three.js shell built and verified

## What belongs here

Findings, measurements, dead ends, solve timings. Anything that would otherwise be lost.

**Promotion rule:** if an entry changes a decision or answers an open question, give it its own
note and link it from the daily. A finding buried in a dated file is a finding nobody will find
again. Use [[finding]] or [[decision]] from the templates folder.

Back to [[Home]].

Numbers go in with the number. "Solve got slower" is not an entry; "solve 47 ms → 890 ms after
adding drift, 6 rooms" is. Compare against [[test-baseline]].
