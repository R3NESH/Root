---
tags: [decision, solver]
status: locked
date: 2026-09-20
---
# A posted rule is a constraint, not a score

**Decision.** Any rule the product posts about *where* a space goes is expressed as a CP-SAT
constraint before the solve, never as a term in the objective afterwards. A layout that breaks a
posted rule is a **rejected** layout, not a worse one. Place-then-score is forbidden.

> [!note] This note was written on 2026-09-20 to close a dangling reference
> `frontend/lib/stairPath.ts` and `backend/tests/test_model_blueprints.py` both cite
> `notes/decisions/zone-rule-is-a-constraint.md` by path, and [[Home]] has listed "rules-as-constraints" among the locked decisions with no link
> behind it. The file had **never been created** — the rule was load-bearing in `CLAUDE.md` and in
> three code comments and existed nowhere in the vault. The content below is read off the code
> that implements it, not invented for the note.

**Because.** A directional rule is about correctness, not preference. `backend/zoning.py` puts it
plainly: *a layout that puts the wash-up in the shopfront is not a worse layout, it is the wrong
one.* Scoring it means the solver will happily trade it away for a slightly tighter footprint, and
then report the result as OPTIMAL — which is a plan the product cannot stand behind while calling
it solved.

## Where this holds today

| Surface | Rule | How posted |
|---|---|---|
| Café programme | Queue near the door, wash-up at the back, per-space preferred quadrant | `QuadrantRule` in `backend/zoning.py`, posted on the room's **centre**, not its corner |
| Residence programme | **None** | The residence posts no directional rule at all, since the Vaastu removal on 2026-09-18 |
| Stairs drawn as a walk line | NBC 2016 riser ≤ 190 mm, going ≥ 250 mm, flight ≥ 0.90 m, landing ≥ flight width | `frontend/lib/stairPath.ts` **refuses the path with the reason** rather than building it shallower |
| Room sizes | NBC 2016 minimums | Hard bounds in `ROOM_CATALOG`; `api/main._size_range()` clamps a pinned size to them — [[room-sizes-from-code]] |
| Connectivity | Every room reachable | Never relaxed, at any rung — see below |

`programs/registry.py` owns *which* rules a programme carries; `zoning.py` only knows how to
express one. A programme with no zone rules posts none. **Never add Vaastu back unless the user
asks** — its removal was a direct instruction, and the evidence that originally justified it still
stands unrefuted in [HANDOFF.md](../../HANDOFF.md) §2.

## The relaxation ladder is not an exception

`solver/model.py` drops constraints in a fixed order when a mix will not fit, each rung giving up
the least important thing still standing:

```
rooms            zoning   daylight  area     — what this rung gives up
rooms            on       on        on       nothing
flexible sizes   on       on        on       custom sizes
flexible sizes   on       off       on       daylight
flexible sizes   off      off       on       zone rules
flexible sizes   off      off       off      the area preference, for speed
```

Two things make this compatible with the decision rather than a hole in it:

1. **The drop is reported.** `rules_relaxed` is true when rules were asked for, the mix had one to
   apply, and the ladder handed back a layout with none posted. An empty `rules_applied` on its own
   cannot say that — a mix with no rule to apply is not a relaxed one. The caller is told, and the
   UI says so. A silently un-zoned plan would be the violation.
2. **Connectivity is never on the ladder.** A layout whose rooms do not open onto each other is not
   a worse house, it is not a house — [[rooms-do-not-form-a-house]]. An earlier ladder shed it as a
   last resort and produced exactly that: **1 of 8 rooms reachable, from a solve reported as
   OPTIMAL.** If nothing on the ladder fits, INFEASIBLE is the honest answer, and "too many rooms
   for this plot" is at least actionable.

**Rejected alternatives.**

- **Score the rules and rank layouts.** Rejected above. It produces a confident OPTIMAL over a plan
  that breaks the thing the rule existed to protect.
- **Relax silently when a mix is tight.** Rejected: that is the same failure with better manners.
  Every rung of the ladder that gives something up has to be visible in the response.
- **Build the stair shallower rather than refuse the drawn path.** Rejected for the same reason —
  a stair that quietly lands under the going minimum is worse than an error message, because
  nobody finds out until it is built.

**The one documented exception, and it is a preference, not a rule.** Requested room *pairs* are
scored, not constrained — [[preferences-are-scored]]. That is deliberate and argued there: "put the
study near the bedroom" is a wish, and refusing to produce a house because it could not be honoured
would be the wrong trade. The line is whether breaking it makes the plan **wrong** or merely
**less nice**.

**What would reverse it.** Evidence that a constrained rule makes a common mix INFEASIBLE where the
scored version would produce a plan a builder accepts — measured with `solver/bench_realism.py`
across the seven real plot/mix scenarios, not reasoned about. The catalog-maximums work on
2026-09-19 is the model for that kind of measurement.

**Links.** [[rooms-do-not-form-a-house]] · [[preferences-are-scored]] · [[room-sizes-from-code]] ·
[[stair-styles]] · [[realism-gaps]] · [[cp-sat-api]] · [[codebase-map]]
