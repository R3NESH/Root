---
tags: [architecture, finding]
status: open
date: 2026-08-30
severity: high
---
# The client-side fallback claims Vaastu it never enforced

`frontend/lib/solve.ts` grew a second solver, `solveClientSide()`, and
[[duplicated-geometry]] is the note that says it should not exist. `frontend/README.md` still
carries the sentence it invalidates:

> There is deliberately no client-side fallback; a fallback is what [[duplicated-geometry]] was.

That sentence is now false. Corrected in the README on 2026-08-30; this note records what the
fallback actually does, because the interesting part is not that it exists.

## What it does

`requestSolve()` falls through to `solveClientSide()` on a network error **and** on any non-`ok`
response — a 422 or a 500 becomes a plan, not an error. The fallback then:

- places rooms on a fixed 2- or 3-column grid, with no CP-SAT, no adjacency, no daylight rule
  and no setback validation;
- returns `status: "Vastu Solved (Optimal)"`;
- returns four `vaastu_constraints_applied` entries — `"Agni SE Kitchen"`,
  `"Ishanya NE Hall & Entrance"`, `"Nairuthi SW Master Bedroom"`, `"Vayu NW Guest & Bath"` —
  none of which any line in the function enforces. The real solver emits the rule text from
  `V1_RULES` only after `add_quadrant_constraint()` has actually been posted;
- returns `rooms_reachable: solvedRooms.length` as an assertion. Every opening it emits leaves
  `to_room` undefined, so the door graph is empty and `reachable_count()` on that output would
  return 1;
- places doors on hardcoded edges per room kind, unrelated to which room is adjacent.

A dragged room in fallback mode also keeps its full spec dimensions with no cell clamp, so
rooms can overlap — the one guarantee [[step-2-solver-core]] establishes first.

## Why it fires in production, not just offline

`SOLVER_API_URL` is `process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000"`. There is
no `.env` in the repo, `netlify.toml` has no `[build.environment]`, and `next.config.ts` sets
`output: "export"` — a static bundle with the URL baked in at build time.

So unless the variable is set in the Netlify dashboard, **every deployed visitor** fails the
fetch and gets the grid, labelled optimal.

`useSolve`'s `staleBackend` flag cannot catch this: it fires only when every room comes back
with no openings, and the fallback always emits openings.

## Why this is the worst available failure mode

[[vaastu-is-mandatory-demand]] is the market note the whole product rests on, and
[[vaastu-as-constraints]] is the decision that a violating plan is *rejected*, not merely worse.
A plan that quietly violates Vaastu while displaying "Vastu Solved (Optimal)" is not a degraded
product — it is the one output this project exists to make impossible.

It also silently answers [[q-competitor-defects]] in the wrong direction: if the defect in
Forjit and GrehYug turns out to be "the plans are not actually compliant", this ships the same
defect with a more confident label.

## Smallest honest fix

Two lines, no new architecture:

1. Have `solveClientSide()` return `status: "OFFLINE_ESTIMATE"` and
   `vaastu_constraints_applied: []`, and surface that in the header the way `staleBackend`
   already is.
2. Stop falling through on `!res.ok` — only a thrown fetch means "offline".

Setting `NEXT_PUBLIC_SOLVER_URL` for the deploy is the separate, larger question, and it needs
a hosted backend that does not exist yet — see [[environment-notes]].

Related: [[duplicated-geometry]] · [[vaastu-as-constraints]] · [[output-schema]] ·
[[project-status]]
