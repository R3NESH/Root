---
tags: [architecture, env]
date: 2026-08-23
---
# Environment notes

- `pip install ortools` — CP-SAT ships inside it, no separate package.
- No secrets, no external APIs, no database in v1. Everything is stateless request/response.
- Do not commit solver output fixtures without a timestamp. A fixture older than the code makes a
  green suite meaningless — see [[test-baseline]].

> [!warning] Setbacks are a known gap, not a convention
> Setback values are currently hardcoded. The real values come from local building bye-laws and
> vary by plot size and road width. **Do not build logic that assumes 5 ft is correct.**
> Keep them in one data module with the source cited per value, so replacing them is a data edit
> rather than a hunt.

## Tooling installed for this repo

| Tool | Where | Why |
|---|---|---|
| `graphifyy` 0.9.49 | **system Python 3.14**, not `backend/.venv` | Knowledge graph over code + notes — [[knowledge-graph]]. Kept out of the venv deliberately: `requirements.txt` is the solver's reproducible environment and a dev tool does not belong in it. |

`graphify-out/` is gitignored and excluded from the vault's `userIgnoreFilters`; it is
regenerable and churns on every run.

## This machine (checked 2026-08-23)

| Tool | State |
|---|---|
| Python | 3.14, `C:\Users\vsury\AppData\Local\Programs\Python\Python314` |
| Node | present, `C:\Program Files\nodejs` |
| Git | present |
| Obsidian | installed 2026-08-23 via winget |

> [!success] Verified 2026-08-23
> `ortools==9.15.6755` installs cleanly on Python 3.14 (`ortools-9.15.6755-cp314-cp314-win_amd64.whl`,
> native wheel, no source build). Risk closed. venv lives at `backend/.venv`.

Source: [[HANDOFF]] §11

## Hosting the solver — 2026-09-20

The deployed site reported *"Asked for G+1, got one storey"* on every request. Correct message,
correct cause: **no backend was deployed at all.** `NEXT_PUBLIC_SOLVER_URL` was unset, so the
browser fell through to `http://localhost:8000` — the visitor's own machine — and the offline
estimator answered instead. That estimator packs the ground floor and nothing else, so a G+1
request could only ever come back as a bungalow.

What landed:

- **`backend/Dockerfile`** — `python:3.12-slim`, one uvicorn worker, binds `$PORT`. 3.12 rather
  than the 3.14 the local `.venv` uses, because every dependency publishes 3.12 wheels and the
  image then needs no compiler.
- **`backend/.dockerignore`** — the local `.venv` is Windows binaries and larger than the rest of
  the repo; copying it in would bloat the image *and* shadow the Linux packages pip installs.
- **`render.yaml`** — one Docker web service, Singapore region, health check on `/docs`.
  `ANTHROPIC_API_KEY` is declared `sync: false` so the value lives in the dashboard, never here.
- **`netlify.toml`** — a comment block, because the trap is not obvious: the frontend is
  `output: "export"`, so **`NEXT_PUBLIC_SOLVER_URL` is baked in at build time**. Setting it after
  a deploy changes nothing until the site is rebuilt.

**`solver/model.py` no longer asks for 8 workers.** `SOLVER_WORKERS = max(1, min(8, os.cpu_count()
or 1))`. Eight is right for a desktop and wrong for a free instance with a fraction of a core and
a few hundred MB — each worker carries its own copy of the model, so it is a memory decision as
much as a speed one. On this machine the value is unchanged at 8, so nothing local moved.

> [!note] A side effect worth knowing
> Fewer workers also makes the cold solve **more deterministic**. The nondeterminism recorded
> against [[layout-stability]] comes from eight workers racing a wall clock; at one worker the
> same mix returns the same layout every time. A small instance will therefore be steadier than
> the developer machine, and slower.

> [!warning] Free tier sleeps, and it looks like the bug that was just fixed
> Render's free plan stops the instance after ~15 minutes idle. The next request waits 30–60 s
> for it to wake, and for that whole time the UI shows the offline-estimate warning — the exact
> message this work set out to remove. Correct behaviour, but indistinguishable from a broken
> site to a first-time visitor. The paid starter plan is what removes it.

Verified locally by running the app the way the container does — `uvicorn api.main:app` with one
worker — and posting a real G+1 request: `floors_solved: 2`, rooms on floors 0 and 1,
`rules_relaxed: false`. **The image itself has not been built**: there is no Docker on this
machine.

Related: [[client-side-fallback]] · [[duplicated-geometry]] · [[project-status]]
