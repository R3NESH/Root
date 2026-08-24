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
