---
tags: [decision, locked]
status: locked
date: 2026-08-23
---
# Rejected — with reasons, so they are not retried

| Rejected | Why | Note |
|---|---|---|
| US / ADU market | AB 1332 gives plans away free | [[india-only]] |
| Permit submission / plan-check features | TG-bPASS grants instant approval in the target size band | — |
| Square-footage-first input | underdetermined, hides a design decision | [[input-is-plot-dimensions]] |
| Chatbot / conversational input | a questionnaire with more typing and no visual feedback | [[zero-keyboard-events]] |
| `add_hint` as the stability mechanism | unreliable in practice | [[layout-stability]] |
| The word "architect" anywhere in copy | Architects Act §37 protects the title | — |
| Time-of-day sun / solar path in the 3D view | built and working for 17.4N, removed the same day on the user's call | [[realism-gaps]] |
| Parking porch, sit-out, staircase, utility as room kinds | added by [[realism-gaps]], removed the same day on the user's call | [[realism-gaps]] |
| `open_sided` rooms (roofed but unwalled) | the only two were the porch and sit-out; with those gone the concept had no users, so it went rather than sit unreachable | [[realism-gaps]] |
| Client-side fallback when the API returns no `openings` | a fallback *is* the duplication that was just deleted; fail loudly instead | [[duplicated-geometry]] |

> [!note] On the sun
> It was not rejected for being wrong — the solar model was correct and cheap, and it made plot
> facing visible for the first time. It was rejected because it was not asked for. If daylight
> ever becomes a selling argument rather than a demo, `lib/sun.ts` is in the git history at the
> 2026-08-25 realism work.

## Not rejected — unverified

**Map-pick the plot from cadastral data.** Would delete the input step entirely. Requires
plot-level parcel geometry from Dharani / Bhu Bharati, which nobody has checked. High chance of
a dead end, so verify before spending time: [[q-telangana-parcel-geometry]].

Source: [[HANDOFF]] §3b
