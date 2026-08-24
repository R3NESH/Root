---
tags: [architecture]
date: 2026-08-23
---
# Architecture

**The core tension.** CP-SAT is a discrete solver, so re-solving on every keystroke makes rooms
teleport. The resolution is to split the two halves by *where they run* — see
[[client-continuous-server-discrete]].

```
BROWSER (Three.js)                    SERVER (Python + CP-SAT)
60fps, no network                     debounced ~400ms after input settles
────────────────────                  ────────────────────────
plot box                              room placement only
setback envelope                      returns:
extrusion / height                    [{name, x, y, w, d, floor}, ...]
camera, drag handles
```

The box responds instantly because it is pure geometry. Rooms settle a beat later because they
genuinely had to be recomputed. **This is an honest illusion, not a fake one** — nothing is
animated to look busy while the answer is already known.

## Stack

Suggested, **not locked, no strong opinion**:

| Side | Choice |
|---|---|
| Front | Next.js + TypeScript + Three.js |
| Back | FastAPI + `ortools` |
| Wire | single `POST /solve` |

Payload shape both directions: [[output-schema]].
Statelessness and dependency notes: [[environment-notes]].

The one thing that crosses the boundary and matters is the previous solution, passed back in so
the solver can prefer it — [[layout-stability]].

Source: [[HANDOFF]] §4
