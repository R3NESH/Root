---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Zero keyboard events from first tap to first plan

**Decision.** A user reaches their first floor plan without typing a single character.

**Because.** The audience is a plot owner on a low-end phone, not a drafter. Every text field is
a place to stall. Taps, drags, steppers and a compass dial carry the whole input surface.

The escape hatch — custom plot dimensions — may use a keyboard. The default path may not.

> [!warning] Partly reversed on 2026-09-06 — [[free-text-input]]
> A prompt box now sits over the viewport, and it is the most prominent thing there, so it is
> probably the first thing a new user reaches for. The tap path is unchanged and still reaches
> a plan with no keyboard; this decision is no longer the whole truth about the default path.
> The stall it predicts is now testable: watch for a session that types nothing and taps
> nothing.

Implementation: [[ui-principles]]. Rejected input styles: [[rejected-approaches]].

Source: [[HANDOFF]] §3.6
