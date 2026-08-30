---
tags: [codebase, tooling]
status: built
date: 2026-08-30
---
# Knowledge graph (graphify)

A queryable graph over the whole corpus — 38 code files, 65 docs, 5 images — built with
[graphify](https://github.com/sponsors/safishamsi). It does in one artefact what
[[codebase-map]] does by hand: connect the design notes to the code that implements them.

## What was built

| | |
|---|---|
| Nodes | **548** — structural (AST) + semantic |
| Edges | **1,319** |
| Communities | **28** |
| Doc → code bridges | **28** edges linking a note's concept to real functions |

Outputs live in `graphify-out/` (gitignored, and excluded from the vault's
`userIgnoreFilters` so Obsidian does not index half a megabyte of generated JSON):

- `graph.html` — interactive, open in a browser, no server
- `GRAPH_REPORT.md` — god nodes, surprising connections, cohesion, suggested questions
- `graph.json` — raw graph, GraphRAG-ready
- `manifest.json`, `cache/` — make `--update` incremental

## Rebuilding

```
graphify                       # full rebuild from the repo root
graphify --update              # re-extract only changed files
graphify query "<question>"    # answer from the graph instead of rebuilding
graphify explain "solve_layout"
graphify path "Vaastu as constraints" "assign_parents"
```

> [!warning] `notes/build/` is excluded by default — and it is the most load-bearing folder here
> graphify's `_SKIP_DIRS` skips any directory named `build/` as a build artifact. In this repo
> `notes/build/` is **design documentation**: the Phase 1 plan, its six step notes, and
> [[test-baseline]]. A default run silently drops all eight.
>
> This build lifted `"build"` out of `_SKIP_DIRS` before detecting, which is safe here because
> nothing in this repo emits to a `build/` directory (Next.js uses `.next/`). **Any future
> rebuild has to do the same or the graph loses the entire build plan** — and it will not warn
> you, because a skipped directory looks identical to an empty one.

## What the graph says about this project

The god nodes are an honest read of where the weight sits:

| Node | Edges |
|---|---|
| `solve_layout()` | 47 |
| `Scene()` | 23 |
| `inchesToFeet()` | 21 |
| `_build_and_solve()` | 14 |
| **`Test baseline as a ratchet`** | **13** |

`solve_layout()` at 47 edges with a betweenness of 0.24 confirms what
[[realism-gaps]] already implied: it is the single point every constraint family passes
through. That is worth watching — it is also the function that carried
[[vaastu-and-connectivity-drop-on-edit]].

A design note appearing in the top five is the [[workflow]] convention working: the graph found
[[test-baseline]] to be structurally central, not just rhetorically central.

The two highest-betweenness *concept* nodes are both defects —
[[vaastu-and-connectivity-drop-on-edit]] (0.136) and [[duplicated-geometry]] (0.115). A bug that
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

Related: [[codebase-map]] · [[workflow]] · [[project-status]]
