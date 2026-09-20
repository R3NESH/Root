---
tags: [codebase, tooling]
status: built
date: 2026-08-30
updated: 2026-09-20
---
# Knowledge graph (graphify)

A queryable graph over the whole corpus — **441 files** in `manifest.json`, code and notes — built with
[graphify](https://github.com/sponsors/safishamsi). It does in one artefact what
[[codebase-map]] does by hand: connect the design notes to the code that implements them.

## What was built

| | 2026-08-25 | 2026-08-30 | 2026-09-07 | 2026-09-19 | 2026-09-20 |
|---|---|---|---|---|---|
| Nodes | 548 | 651 | 1,538 | 1,873 | **1,962** |
| Edges | 1,319 | 1,536 | 3,355 | 4,341 | **4,514** |
| Communities | 28 | 38 | 84 | 89 | **105** |
| Files in manifest | — | — | — | 437 | **445** |

Built twice on 2026-09-20: once over the code as found (1,936 / 4,473 / 104 over 441 files), then
again after the vault audit added four notes. The second figures are the ones above.

Every column is counted the same way, off `graph.json` and not off the build log. On 2026-09-20
`notes/build/` again came through with **24 nodes**, so the skip-dir trap below did not bite — it
is still worth checking every run, because nothing warns you.

The 2026-09-20 rebuild covered the two commits the 2026-09-19 graph predates —
`25c1174` (interior tooling, drawn stairs, live plan, honest room sizes) and `72be93d`
(GPU detection and self-measuring quality). The modules that entered the graph with them:
`wallJoins.ts` (22 nodes), `cameraTour.ts` (15), `adaptiveQuality.ts` (13), `plotTraverse.ts` (13),
`stairPath.ts` (11) and `gpuTier.ts` (7).

> [!note] Community labels are hub-derived, not written
> `graphify cluster-only` re-clustered to **105** communities and named each one after its hub
> file (`Scene.tsx`, `main.py`, `RoomName`), because no LLM backend is configured. **0 of 105
> carry the `Community N` placeholder**, which is an improvement on the 2026-09-19 run, but a
> hub name is not a description. `graphify label .` with `GOOGLE_API_KEY` or an explicit
> `--backend` writes real ones — the same missing-key situation as [[free-text-input]].

> [!warning] The command in `CLAUDE.md` was wrong and has been corrected
> `graphify --update` is not a command any more: the CLI is now `graphify update <path>`, and it
> answers an unknown flag with `error: unknown command` rather than doing nothing quietly. The
> package has also moved on to 0.9.49 while the installed skill is still 0.9.31, which it warns
> about on every invocation. `graphify install` refreshes it; that writes into assistant config
> directories outside this repo, so it has not been run here.
>
> Community labels are stale for the same reason a rebuild always makes them stale: 62 saved
> labels against 84 communities now, 38 renamed by their hub. `graphify label` refreshes them
> and needs an LLM key, which this machine does not have.

> [!warning] Counted from `graph.json` on 2026-08-31, not from the build log
> The 2026-08-30 column previously read 662 / 1,547 / 35, and [[Home]] and [[codebase-map]]
> both still carried the 2026-08-25 figures (435 / 898). Three notes, three different answers,
> none of them the file's. Read the numbers off the artefact:
> ```python
> import json; g = json.load(open("graphify-out/2026-08-30/graph.json", encoding="utf-8"))
> print(len(g["nodes"]), len(g["links"]), len({n.get("community") for n in g["nodes"]}))
> ```

The 2026-08-30 rebuild followed the structurize pass in [[codebase-map]]; the five new `lib/`
modules account for 40 of the added nodes, and the new notes for the rest.

Outputs live in `graphify-out/` (gitignored, and excluded from the vault's
`userIgnoreFilters` so Obsidian does not index half a megabyte of generated JSON). The
2026-08-30 run wrote only the four below — no `graph.html`, which earlier revisions of this
note listed:

- `GRAPH_REPORT.md` — god nodes, surprising connections, cohesion, suggested questions
- `graph.json` — raw graph, GraphRAG-ready
- `manifest.json`, `cache/` — make `--update` incremental

## Rebuilding

```
graphify update .              # re-extract changed files and re-cluster (no LLM needed)
graphify query "<question>"    # answer from the graph instead of rebuilding
graphify explain "solve_layout"
graphify path "rooms do not form a house" "assign_parents"
graphify god-nodes --top 10    # the hub table below, recomputed
graphify affected "solve_layout"   # what a change to it reaches
```

`graphify --update` is **not** a command and never was on this CLI version; it exits with
`error: unknown command`. Neither is a bare `graphify` — the subcommand is required. And a
plain `graphify update .` drops `notes/build/`, so use the in-process recipe below instead.

> [!warning] `notes/build/` is excluded by default — and it is the most load-bearing folder here
> graphify's `_SKIP_DIRS` skips any directory named `build/` as a build artifact. In this repo
> `notes/build/` is **design documentation**: the Phase 1 plan, its six step notes, and
> [[test-baseline]]. A default run silently drops all eight.
>
> Safe to override here, because nothing in this repo emits to a `build/` directory — Next.js
> uses `.next/`. **Any rebuild has to override it or the graph loses the entire build plan**,
> with no warning, because a skipped directory looks identical to an empty one.
>
> **This warning was written on 2026-08-25 and then ignored on 2026-08-30.** A plain
> `graphify update .` dropped `notes/build/` to **0 nodes**, taking [[test-baseline]] — a
> top-five hub in the previous graph — out with it. Caught only by grepping `source_file`
> prefixes afterwards. Do that check every time; it is two lines:
>
> ```python
> import json; g = json.load(open("graphify-out/graph.json", encoding="utf-8"))
> print(len([n for n in g["nodes"] if (n.get("source_file") or "").startswith("notes/build")]))
> ```
>
> There is no supported config for this — `.graphifyinclude` was removed upstream (#2112), and
> `.graphifyignore` only subtracts. Patch the set in-process rather than editing the installed
> package, which `graphify install` would overwrite:
>
> ```python
> from pathlib import Path
> import graphify.detect as detect
> detect._SKIP_DIRS.discard("build")          # notes/build/ is documentation, not an artifact
> from graphify.watch import _rebuild_code
> _rebuild_code(Path("."), force=True, no_cluster=False, block_on_lock=True)
> ```
>
> Run it from a **file**, not a heredoc — the extractor's process pool needs an
> `if __name__ == "__main__":` guard and falls back to sequential without one.

## What the graph says about this project

The god nodes are an honest read of where the weight sits:

| Node | Edges (2026-08-30) |
|---|---|
| `solve_layout()` | 47 |
| `RoomName` | 38 |
| `Scene()` | 36 |
| `inchesToFeet()` | 33 |
| `Facing` | 26 |

By 2026-09-20 the weight has moved decisively to the frontend, and the top of the table is now
files rather than functions:

| Node | Edges (2026-09-19) | Edges (2026-09-20) |
|---|---|---|
| `frontend/components/Scene.tsx` | 166 | **183** |
| `frontend/app/page.tsx` | 171 | **171** |
| `frontend/components/TopRibbonTaskbar.tsx` | 89 | **95** |
| `frontend/components/Blueprint2DView.tsx` | 83 | **89** |
| `frontend/lib/materialsCatalog.ts` | 66 | 66 |
| `frontend/lib/solve.ts` | 64 | 64 |
| `backend/api/main.py` | 59 | 59 |
| `frontend/lib/rooms.ts:RoomName` | — | 58 |
| `backend/solver/model.py:solve_layout()` | 47 | 56 |
| `frontend/lib/plot.ts` | — | 56 |

That is the god-component problem in [[codebase-map]] measured rather than asserted: `Scene.tsx`
and `page.tsx` between them carry **354 edges**, and every studio added this month hangs off both.
`TopRibbonTaskbar.tsx` at 95 is the third, and it is the file whose overflow path only ran for
the first time once five buttons were added to it — see [[project-status]].

**The two commits since the last graph made all four god components bigger, none smaller.**
`Scene.tsx` took the top of the table off `page.tsx` for the first time, and it did so while
also growing from 4,834 lines to **7,321**. No rebuild has ever shown this trend reversing.

`solve_layout()` at 47 edges with a betweenness of 0.24 confirms what
[[realism-gaps]] already implied: it is the single point every constraint family passes
through. That is worth watching — it is also the function that carried
the drag regression.

A design note appearing in the top five is the [[workflow]] convention working: the graph found
[[test-baseline]] to be structurally central, not just rhetorically central.

The two highest-betweenness *concept* nodes are both defects —
the drag regression (0.136) and [[duplicated-geometry]] (0.115). A bug that
bridges five communities is a bug that touched five parts of the system, which is a reasonable
definition of "this was the important one".

> [!note] Known soft spots in the graph
> - **43 dangling edge endpoints**, all of them external imports (`react`, `ortools.sat.python`,
>   `three`, `fastapi`, CSS modules). Expected: those targets are not corpus files. None come
>   from the semantic layer.
> - **~30 collapsed parallel edges** — e.g. `solve_layout -> Room` holds `calls`, `references`
>   and `uses`, which an undirected simple graph merges into one. Use `--directed` if edge
>   direction and multiplicity ever matter.
> - **71 weakly-connected nodes**, mostly config keys (`tsconfig` options, font objects).
>   Noise, not a documentation gap.

## How this run was done

No `GEMINI_API_KEY` was set and this session does not dispatch subagents, so semantic extraction
was performed inline by the agent — the fallback graphify's own instructions sanction. Node IDs
follow graphify's path-based format exactly, which is what let 21 doc concepts attach to real
AST functions instead of forming a parallel ghost graph.

**2026-08-30 rebuild.** `graphify update` re-extracted the AST layer with no LLM and no API
cost; the semantic edges from the first build were carried through. `graphify label` was then
run and **failed** — `Claude Code CLI not found on $PATH`, no `GEMINI_API_KEY` — so the 35
communities carry hub-derived names (`page.tsx`, `solve_layout`, `connectivity.py`) rather than
the written ones the first build had (`CP-SAT Placement Engine`, `React UI Components`). The
structure is correct; only the labels are less readable. Re-run `graphify label .` with a
backend on `$PATH` to fix.

Related: [[codebase-map]] · [[workflow]] · [[project-status]]
