---
tags: [architecture, finding]
status: fixed
date: 2026-08-30
fixed: 2026-08-31
severity: high
---
# The client-side fallback claimed Vaastu it never enforced

> [!success] Fixed 2026-08-31 — the labelling half
> `solveClientSide()` now returns `status: OFFLINE_ESTIMATE` (exported as
> `OFFLINE_ESTIMATE_STATUS`, which the ribbon keys off), `vaastu_constraints_applied: []`,
> `rooms_reachable: 1` — the honest count for an empty door graph — and `vaastu_relaxed: true`.
> `requestSolve()` no longer falls through on `!res.ok`: only a thrown fetch means offline, so
> a 422 or 500 now surfaces through `useSolve`'s `error` instead of becoming a plan.
>
> The "smallest honest fix" below said to surface it "the way `staleBackend` already is".
> That was wrong — `staleBackend` is destructured in `page.tsx` and never rendered. The warning
> went into the solver badge in `TopRibbonTaskbar.tsx` instead, which was already showing
> `meta.status` behind a ✨.
>
> **Still open:** the deploy question. `NEXT_PUBLIC_SOLVER_URL` is unset, so a Netlify visitor
> still gets the grid — correctly labelled now, but still a grid. Needs a hosted backend
> ([[environment-notes]]).
>
> A related defect surfaced while fixing this: the solver's own relaxation ladder descends on
> a **timeout** as well as on INFEASIBLE, so a loaded machine can drop Vaastu server-side too.
> Measured 10/10 on a ten-room mix at a 50 ms interactive budget. The response now carries
> `meta.vaastu_relaxed` and the same badge warns on it.

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
