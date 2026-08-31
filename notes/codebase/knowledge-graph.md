---
tags: [codebase, tooling]
status: built
date: 2026-08-30
updated: 2026-08-30
---
# Knowledge graph (graphify)

A queryable graph over the whole corpus — 135 files in `manifest.json`, code and notes — built with
[graphify](https://github.com/sponsors/safishamsi). It does in one artefact what
[[codebase-map]] does by hand: connect the design notes to the code that implements them.

## What was built

| | 2026-08-25 | 2026-08-30 |
|---|---|---|
| Nodes | 548 | **651** |
| Edges | 1,319 | **1,536** |
| Communities | 28 | **38** |

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

**2026-08-30 rebuild.** `graphify update` re-extracted the AST layer with no LLM and no API
cost; the semantic edges from the first build were carried through. `graphify label` was then
run and **failed** — `Claude Code CLI not found on $PATH`, no `GEMINI_API_KEY` — so the 35
communities carry hub-derived names (`page.tsx`, `solve_layout`, `connectivity.py`) rather than
the written ones the first build had (`CP-SAT Placement Engine`, `React UI Components`). The
structure is correct; only the labels are less readable. Re-run `graphify label .` with a
backend on `$PATH` to fix.

Related: [[codebase-map]] · [[workflow]] · [[project-status]]
