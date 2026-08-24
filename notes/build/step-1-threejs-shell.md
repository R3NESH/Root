---
tags: [build, step]
status: done
date: 2026-08-23
---
# Step 1 — Three.js shell, no solver

**Work.** Plot box, setback envelope, extrusion, drag handles snapping to 1 ft. No solver at all.

**Done when.** The box responds instantly and makes **zero network calls**. Check the network
tab; the claim is falsifiable.

> [!success] Done 2026-08-23
> Built at `frontend/` (Next.js 16 + TypeScript + Three.js, scaffolded via `create-next-app`).
> Verified with Playwright against the running dev server, not just typecheck/lint:
> - preset cards, custom steppers, and the 8-direction compass dial all update state correctly
> - both drag handles (width, depth) resize independently, snapping to whole feet, math checked
>   against [[integer-inches]] (e.g. 40→47 ft drag, buildable 30→37 ft, matching the 5 ft
>   front/rear setback exactly)
> - zero browser console errors across every interaction
> - camera reframes to keep the plot in view on preset/stepper jumps, preserving the user's
>   orbit angle (a bug caught mid-verification: the box was initially left poking out of frame
>   after a 30×40 → 50×80 preset jump)
> - `git add -n` confirms `node_modules/` and `.venv/` stay out of version control
>
> No dedicated screenshot/browser tool was preinstalled — Playwright + Chromium were installed
> temporarily to verify, then removed (`npm uninstall playwright`, scratch scripts deleted).
> If this project keeps needing visual verification, worth running `/run-skill-generator` to
> capture a proper project skill instead of repeating the ad-hoc install.

This is the client half of [[client-continuous-server-discrete]]. Everything here is pure
geometry, which is exactly why it can be instant.

Rebuild the input patterns from [[ui-principles]] — the original SVG prototype was never saved.
Priority order: preset plot cards, drag handles, steppers, compass dial.

Snapping is not cosmetic: [[integer-inches]].

> [!note] Scope note — [[project-phases]]
> The extrusion here is the **outer plot/setback envelope only** — a single box, so the client
> stays solver-free per [[client-continuous-server-discrete]]. Per-room wall extrusion (the
> actual Phase 1 deliverable, a real 3D house model) happens in [[step-3-wire-together]] once
> CP-SAT has returned room rectangles to extrude.

Next: [[step-2-solver-core]] · Plan: [[build-order]]
