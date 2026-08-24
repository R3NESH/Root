# House Layout Generator (India) — project handoff

**Working name: unset.** Pick one before first commit.
**Reader: Claude Code, with no access to the conversation this came from. Treat this file as the only source of truth.**
**Written: 2026-08-23.**

---

## 0. Status — read this first

**Nothing is built. There is no repository, no code, no test baseline, no commit.**

Everything below is design and research output. No claim in this file has been validated by running the system, because the system does not exist yet.

| Thing | State |
|---|---|
| Repo | does not exist |
| Any code | none written |
| Test baseline | none — first suite run establishes it |
| User validation | **incomplete** — see §7, this is the largest open risk |
| Market research | done, sources cited in §2 |

Do not let a later summary in this project claim "no regressions" until a real baseline exists.

---

## 1. What the product is

A tool for an Indian plot owner who wants to build a house and does not want to hire an architect first.

Input: their plot dimensions and facing direction.
Output: a legal, buildable floor plan they can act on.

Core engine is a constraint solver (Google OR-Tools CP-SAT) that places rooms as non-overlapping rectangles inside a setback-derived buildable envelope, with Vaastu direction rules encoded as constraints.

**Target market: India. Not the US.** This is locked — see §3.

---

## 2. Market context — do not re-litigate these

These were verified against published sources. They constrain scope. If a future session proposes reversing one, it needs new evidence, not reasoning.

**The permit-automation angle is dead in Telangana.** TG-bPASS gives instant online building permission for residential plots up to 500 sq m and 10 m height. Plots up to 75 sq yards (ground or G+1) need no building permission and no occupancy certificate at all — ₹1 token registration. Written into TS-bPASS Act 2020, Section 7.
→ Consequence: **do not build permit-submission features.** The pain is legislated away for the target segment.

**Automated plan scrutiny for municipalities is taken.** SoftTech's AutoDCR / CivitPERMIT reads CAD drawings and checks them against regulations, deployed in 500+ Indian urban local bodies; Delhi Development Authority launched on it June 2026.
→ Consequence: **do not sell to municipalities.** B2C or nothing.

**Price ceiling is low.** Indian rates: floor plan ₹4,000–6,000 per floor; full set with structural + working drawings, single floor, ₹12,000–20,000. Roughly $140–240 for everything.
→ Consequence: unit economics must work at a ₹3,000–5,000 ticket. No enterprise SaaS assumptions.

**Legal lane is open, and this is a genuine advantage.** Supreme Court, March 2020: Section 37 of the Architects Act does not bar unregistered persons from practising architecture — it only bars use of the title "architect." Meanwhile the Council of Architecture's Scale of Charges sets a *mandatory minimum* of 7.5% of cost of works for individual houses, which registered architects cannot go below.
→ Consequence: incumbents have a legal price floor; this product has no licensing requirement. Never use the word "architect" in product copy.

**Vaastu is a hard requirement, not a nice-to-have.** NoBroker survey, 12,546 respondents: 73% check Vaastu before buying; Hyderabad 77%, Chennai 78%, Bengaluru 76%. A separate Hyderabad study puts it at ~82% as a major decision factor.
→ Consequence: Vaastu goes in as solver constraints, not as a post-hoc score.

**The field is crowded but shallow.** At least nine free tools already do questionnaire → Vaastu-aware 2D plan for Indian plot sizes (Forjit, Fix to Finish, Naksha AI, VastuAgent.ai, AI Cadbull, GrehYug, Coohom India, DesignDrafter). GrehYug additionally does 3D, DXF export, cost estimation, and WhatsApp delivery.
→ Consequence: **UI polish alone is not a differentiator.** The user tested Forjit and GrehYug and judged both inadequate — but see §7, the specific defects were never recorded, and that list is the actual product spec.

---

## 3. Decisions locked

1. **India only.** US market rejected: Higharc ($170M+ raised, permit-ready construction documents for builders) occupies it, and California AB 1332 mandates free pre-approved ADU plans from every city since Jan 1 2025.
2. **Input is plot dimensions + facing, never square footage.** Square footage is underdetermined — 1200 sq ft is 30×40, 20×60, 24×50, or L-shaped. A UI that morphs a box from an area figure is silently choosing an aspect ratio and hiding that choice from the user. Plot dimensions are also the native unit of the market (tools list 20×30, 30×40, 30×50, 40×60, 50×80 ft).
3. **Continuous geometry client-side, discrete solve server-side.** See §4.
4. **Integer units throughout — inches, not feet.** CP-SAT is integer-only. 30 ft = `360`.
5. **Vaastu as constraints, not post-check.** Placing then scoring produces plans that fail; constrain up front.
6. **Zero keyboard events** from first tap to first plan. See §6.
7. **Single storey first.** G+1 later — Indian plots commonly go vertical, so the data model must not assume one floor. Namespace rooms by floor from day one.

## 3b. Rejected — with reasons, so they are not retried

| Rejected | Why |
|---|---|
| US / ADU market | Higharc occupies it; AB 1332 gives plans away free |
| Selling to municipalities | AutoDCR in 500+ ULBs |
| Permit submission / plan-check features | TG-bPASS grants instant approval for the target size band |
| Square-footage-first input | underdetermined, hides a design decision |
| Chatbot / conversational input | a questionnaire with more typing and no visual feedback |
| `add_hint` as the stability mechanism | unreliable in practice — see §5 |
| Word "architect" anywhere in copy | Architects Act §37 protects the title |
| Map-pick the plot from cadastral data | **not rejected — unverified.** Check Dharani / Bhu Bharati for plot-level parcel geometry before spending time. High chance of dead end. |

---

## 4. Architecture

The core tension: CP-SAT is a discrete solver, so re-solving on every keystroke makes rooms teleport. Resolution is to split the two halves by where they run.

```
BROWSER (Three.js)                    SERVER (Python + CP-SAT)
60fps, no network                     debounced ~400ms after input settles
────────────────────                  ────────────────────────
plot box                              room placement only
setback envelope                      returns:
extrusion / height                    [{name, x, y, w, d, floor}, ...]
camera, drag handles
```

The box responds instantly because it is pure geometry. Rooms settle a beat later because they genuinely had to be recomputed. This is an honest illusion, not a fake one.

**Suggested stack** (not locked, no strong opinion): Next.js + TypeScript + Three.js front, FastAPI + `ortools` back. Single POST endpoint `/solve`.

---

## 5. Solver core

### Confirmed API

Verified against the OR-Tools Python reference:

- `add_no_overlap_2d(x_intervals, y_intervals)` — ensures all present rectangles do not overlap on a plane. Each rectangle is defined by two intervals: its projection onto X and onto Y.
- Interval variable constructors: `new_interval_var`, `new_fixed_size_interval_var`, `new_optional_interval_var`, `new_optional_fixed_size_interval_var`.
- `add_hint(var, value)` — adds `var == value` as a solution hint.

### Skeleton

```python
from ortools.sat.python import cp_model

def solve_layout(env_w, env_d, rooms, prev=None):
    """env_w, env_d in INCHES. rooms: objects with name, min_w, max_w, min_d, max_d.
    prev: {name: (x, y)} from the previous solve, or None."""
    m = cp_model.CpModel()
    X, Y, R = [], [], {}

    for r in rooms:
        x  = m.new_int_var(0, env_w, f"x_{r.name}")
        w  = m.new_int_var(r.min_w, r.max_w, f"w_{r.name}")
        xe = m.new_int_var(0, env_w, f"xe_{r.name}")
        xi = m.new_interval_var(x, w, xe, f"ix_{r.name}")

        y  = m.new_int_var(0, env_d, f"y_{r.name}")
        d  = m.new_int_var(r.min_d, r.max_d, f"d_{r.name}")
        ye = m.new_int_var(0, env_d, f"ye_{r.name}")
        yi = m.new_interval_var(y, d, ye, f"iy_{r.name}")

        X.append(xi); Y.append(yi); R[r.name] = (x, y, w, d)

    m.add_no_overlap_2d(X, Y)
    return m, R
```

Envelope containment is enforced by the variable domains (`0..env_w`) plus the interval end variables. Verify that on the first run — if rooms escape the envelope, add explicit `m.add(xe <= env_w)`.

### Gotchas that will bite

- **Integers only.** All CP-SAT constraints must be defined using integers. Decimal feet round silently and walls stop meeting. Work in inches.
- **Interval vars are containers, not variables.** They bundle separately-declared start / size / end vars. Read the values off the underlying int vars, not the interval.
- **No true incremental solving.** It remains an open OR-Tools feature request; the documented workaround is re-solving the model from scratch each time.

---

## 6. Layout stability — the actual technical edge

None of the nine competing tools solve this. If this project has one defensible piece of engineering, it is this.

**Problem.** User edits an input, solver re-runs from scratch, bathroom teleports to the far side of the house. Jarring, and it destroys trust in the output.

**Rejected fix: `add_hint`.** The API exists, but users report it not affecting solve behaviour even with complete, feasible hints. Do not rely on it.

**Preferred fix: make stability an objective.** Penalise displacement from the previous solution so the solver *prefers* the layout it already showed.

```python
if prev:
    drift = []
    for name, (x, y, _, _) in R.items():
        px, py = prev[name]
        dx = m.new_int_var(0, env_w, f"dx_{name}")
        dy = m.new_int_var(0, env_d, f"dy_{name}")
        m.add_abs_equality(dx, x - px)
        m.add_abs_equality(dy, y - py)
        drift += [dx, dy]
    m.minimize(sum(drift))
```

**Status: inferred, not tested.** The concept is standard minimal-perturbation modelling. `add_abs_equality` is the one method name in this file that was **not** verified against the reference — confirm it before use.

**Expected failure mode:** solve time may jump from ~50 ms to seconds once Vaastu constraints stack on top of the drift objective. Time it at step 4 below. If it blows up, fall back to constraining relative room *ordering* rather than absolute position.

---

## 7. Open questions — these block real progress

**7.1 — What exactly was wrong with Forjit and GrehYug's output?** The user tested both and judged them inadequate but never recorded the specific defects. This list *is* the product spec. Different defects imply completely different products:

| Observed defect | What it means |
|---|---|
| rooms overlap, dimensions don't sum | their solver is fake → CP-SAT is a real weapon |
| ignored setbacks, exceeded plot | local-rules data gap → hard moat |
| Vaastu placement wrong | lookup table → weekend fix, no moat |
| looked ugly / clunky | taste → weakest possible wedge |
| unusable by a contractor | buildability gap → biggest opportunity, biggest work |

**Get this list before writing solver objectives.**

**7.2 — Does anyone pay?** No Indian plot owner has been asked to pay for this. The proposed test costs zero code: take one real person's plot dimensions and facing over WhatsApp, hand-make one plan, send it back, ask ₹500 for the full thing, watch what happens. Ten of these. Three payers = build. Zero payers = no UI fixes it.

**7.3 — Is plot-level parcel geometry available in Telangana?** Determines whether map-pick input is viable. Check Dharani / Bhu Bharati. Unverified.

**7.4 — What fraction of the market falls above the TG-bPASS instant-approval threshold** (>500 sq m or >10 m)? If tiny, the permit-adjacent framing has no market at all. Unverified.

---

## 8. UI decisions

Principle: **never ask a question whose answer can be shown instead.** Setbacks are drawn as a dashed envelope, not asked. Buildable area is a number that updates itself.

Ranked, highest value first:

1. **Preset plot cards** — 20×30, 30×40, 30×50, 40×60, 50×80, plus a custom escape. One tap, no keyboard, works on a low-end phone. Half a day.
2. **Drag handles on the plot edges** replacing number fields. **Must snap to whole feet** — Indian plots are exact, and raw dragging yields 29.7.
3. **Solve three, let them pick.** Users cannot answer "kitchen east or south?" — that is why they came. Show three plans from three objective weightings; humans choose well and specify badly. This deletes roughly half the questionnaire.
4. **Steppers** (`− 2 BHK +`), never text inputs.
5. **Room tray** — drag chips (Bedroom / Kitchen / Bath / Pooja / Hall) into the plot; solver snaps them legal. User supplies intent, machine supplies correctness. Build after the spine works.
6. **Compass dial** for facing — direction is spatial, so a rotating ring beats a dropdown, and Vaastu makes it meaningful.

A 2D SVG prototype of patterns 1, 2, 4 and 6 was built and rendered in the originating conversation. **It was not saved to disk and does not exist in this handoff.** Rebuild from this section.

---

## 9. Build order

Two weeks. Each step has an explicit done-condition — do not advance without meeting it.

| Step | Work | Done when |
|---|---|---|
| 1 | Three.js: plot box, setback envelope, extrusion, drag handles snapping to 1 ft. No solver. | box responds instantly, zero network calls |
| 2 | CP-SAT: place 4–6 rooms in a fixed 30×40 envelope, print JSON | rooms never overlap and never exit the envelope, across 20 random room mixes |
| 3 | Wire together: debounced POST, render returned rects | end-to-end on one plot |
| 4 | Drift objective (§6). **Time the solve.** | rooms nudge rather than jump across 10 consecutive edits; solve stays under 500 ms |
| 5 | Vaastu as constraints: kitchen SE, master bedroom SW, entrance N/E | still solves, still stable, still under 500 ms |

**Test on a real 30×40 north-facing plot in Kandi, Telangana — not a synthetic one.** Competing tools reportedly fail on real plots, not toy ones.

**Establish the test baseline at step 2.** Record pass/fail counts and the names of any failing tests, read from the runner's final output. Every later step reports the delta against that.

---

## 10. Schema — design now, populate later

The success metric is **"would a mason build from this?"**, not "does the box look nice." That means the output eventually needs wall thicknesses, dimension lines, and door/window positions.

Do not ship coloured rectangles with no room for those fields. Adding `wall_thickness` to a schema that anticipated it is one field; discovering rooms were centre-line-less rectangles is a rewrite.

```json
{
  "plot":   { "w_in": 360, "d_in": 480, "facing": "N" },
  "setback":{ "front_in": 60, "rear_in": 60, "left_in": 36, "right_in": 36 },
  "rooms": [
    { "name": "kitchen", "floor": 0,
      "x_in": 0, "y_in": 0, "w_in": 96, "d_in": 120,
      "wall_thickness_in": null,
      "openings": [] }
  ],
  "meta": { "solve_ms": 0, "vaastu_constraints_applied": [] }
}
```

`floor`, `wall_thickness_in` and `openings` are null/empty in v1 and exist so v2 does not require a migration.

---

## 11. Environment notes

- `pip install ortools` — CP-SAT ships inside it, no separate package.
- Do not commit solver output fixtures without a timestamp; a fixture older than the code makes a green test suite meaningless.
- No secrets, no external APIs, no database in v1. Everything is stateless request/response.
- Setback values are currently hardcoded. Real values come from local building bye-laws and vary by plot size and road width — **this is a known gap, not a convention.** Do not build logic that assumes 5 ft is correct.

---

## 12. The claim most likely to be wrong

**That layout stability (§6) is a hard problem worth building around.** The evidence for it is GitHub issue threads, not benchmarks. For 8–10 rooms CP-SAT may re-solve in 50 ms stably enough that none of §6 matters, and the differentiator evaporates.

**Test it at step 4 before treating it as the moat.** One afternoon settles it.

---

## 13. Addendum — phasing corrected (2026-08-23)

The original brief above did not state a phase boundary explicitly beyond "single storey first,
G+1 later" (§3.7). That has been corrected and sharpened:

**Phase 1 (baseline).** The deliverable is a generated **3D model of the house** from the
customer's plot dimensions and facing — not a 2D floor plan with a box extruded around it. Rooms
placed by CP-SAT (§5) get extruded into walls at a fixed height and rendered as a real massing
model the customer can look at from any angle. Everything in §9's build order (steps 1–5) is
Phase 1 work, retargeted at this output.

**Phase 2 and beyond (multi-level + code compliance).** Once Phase 1 is solid, scope moves to
multi-storey buildings (G+1, G+2, ...) with **important building regulations hardcoded as solver
constraints** — fire exits, egress paths, staircase placement and width, and whatever else the
applicable code requires — so that a generated multi-level building satisfies them by
construction, the same way §3.5 already treats Vaastu: constrain up front, don't score after the
fact.

None of the Phase 2 regulatory content (fire code specifics, egress widths, staircase rules) has
been researched yet. Treat it as unverified scope, not a spec, until it is.

See the vault note `project-phases` for the live version of this split.
