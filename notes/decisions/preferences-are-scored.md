---
tags: [decision]
status: current
date: 2026-09-06
---
# A stated preference is scored; a rule is constrained

**Decision.** When the person asks for two rooms to be near each other, that pair goes into the
CP-SAT **objective**, not into the constraint set. Implemented as `near_terms()` in
`backend/solver/realism.py`, weighted by `NEAR_WEIGHT`.

**This is not a softening of rules-as-constraints.** That decision stands unchanged, and
the two are about different kinds of statement:

| | Setbacks, daylight, connectivity | "put the kitchen near that bedroom" |
|---|---|---|
| What it is | a rule the plan meets or fails | one person's taste |
| Where it lives | constraint, posted up front | objective term |
| A plan that violates it | is rejected | is still a house, just less liked |

There is no threshold at which two rooms become "near", so there is nothing to constrain
*against*. Forcing a shared wall would turn an ordinary request INFEASIBLE on a plot with room
to spare, which is the failure mode the relaxation ladder in `solver/model.py` exists to avoid.

**The weight is measured, not chosen.** The sweep table sits above `NEAR_WEIGHT` in
`solver/realism.py`. The short version: a pair costs room area and it costs void inside the
footprint, and those two do not arrive together. Up to weight 60 the void does not move — the
pair is satisfied by picking among arrangements the compactness term already liked. Past 120 the
solver starts pulling rooms together by making the building straggle, and nobody asking for a
kitchen near a bedroom asked for that.

## Rejected while building this

**Size drift — holding each room's width and depth across an edit, alongside its position.**
Built, measured, removed the same hour. The measurement, run the way [[claim-most-likely-wrong]]
insists these are run — check whether the problem exists before fixing it — was ten perturbed
edits of the standard five-room mix, comparing total room size change with the term and without:

```
         prev only: total size change over 10 edits = 1 in
  prev + prev_size: total size change over 10 edits = 0 in
```

One inch. Position drift at `DRIFT_WEIGHT` plus non-overlap already pins size in practice, so
the term bought nothing and cost an API field, a solver parameter and an objective loop. Where
room sizes *do* change across an edit — widening the kitchen makes a bedroom give up a foot —
the change is forced by the geometry, and the size drift term did not prevent it either.

**Links.** rules-as-constraints · [[layout-stability]] · [[rejected-approaches]] ·
[[realism-gaps]]
