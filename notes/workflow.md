---
tags: [moc, process]
status: current
date: 2026-08-25
---
# Workflow followed

How this project is actually run, reconstructed from the vault, the commit history and the
build notes. Recorded because the workflow is doing real work here — it caught several bugs
before they shipped — and because [[step-6-walkthrough]] is what happened when it was skipped.

## 1. One immutable source of truth

[[HANDOFF]] sits at the repo root and is **never edited**. Corrections are appended as dated
addenda (§13 is the phasing correction of 2026-08-23). Every vault note cites the section it
comes from. This means a note can go stale without the brief going stale with it.

## 2. The vault is the repo

Repo root **is** the Obsidian vault root, so design notes and code live in one graph.
`showUnsupportedFiles` is on, so `.py` and `.ts` show in the explorer; `node_modules/`, `.git/`,
`.venv/`, `__pycache__/`, `.next/` are filtered out.

Obsidian only graphs Markdown, so the convention in [[codebase-map]] is:

1. Every top-level module gets a `README.md` **inside its own folder**.
2. That README wikilinks the notes it implements.
3. Notes link back to the module README.

The module README is the graph node standing in for the code. Vault config is committed; only
per-machine workspace state is gitignored. Graph view is pre-coloured by folder — decisions
green, market amber, solver red, questions purple, build cyan, daily orange.

## 3. Decisions are locked, not revisited

`notes/decisions/` holds eight locked decisions, each with a **Because** and a source citation.
The rule: *reversing one needs new evidence, not new reasoning.* [[rejected-approaches]] records
what was turned down and why, so it is not quietly retried later.

## 4. Build steps carry explicit done-conditions

[[build-order]] is a table where every step has a condition written **before** the work starts —
"rooms never overlap and never exit the envelope, across 20 random room mixes", not "step 2
done". Do not advance without meeting it. Where a condition is *not* met, it is recorded rather
than dropped: [[step-5-vaastu]]'s missing entrance N/E is written into the plan, the daily note
and [[codebase-map]] rather than silently skipped.

## 5. The test baseline is a ratchet

Established at step 2, then every later step reports its **delta against the latest row**, never
against zero. [[test-baseline]] carries the date, pass count, fail count and the *name* of every
failing test, read from the runner's final output rather than from an impression of the run.

This has already earned its keep twice — it caught a latency fix that had quietly broken
correctness (0.4 s cap → `UNKNOWN` on hard 6-room packings), and its own blind spot is what let
[[vaastu-and-connectivity-drop-on-edit]] through.

## 6. Measure; do not reason

The strongest habit in this project. Concretely:

- Predictions get a **dedicated test** rather than trust — `test_envelope_domain_alone_blocks_escape`
  exists only to confirm that interval domains alone contain rooms.
- The riskiest assumption in the brief got its own note, [[claim-most-likely-wrong]], and an
  afternoon of benchmarking (`solver/bench_stability.py`) to settle it.
- `add_abs_equality` — the one API name in the whole brief nobody had checked — was verified
  against the real library before being built on.
- When a screenshot *looked* like rooms overflowed the envelope, it was checked numerically
  (0 violations, 0 overlaps) instead of by eye.
- Entries carry numbers: "solve 47 ms → 890 ms after adding drift, 6 rooms", not "solve got
  slower".

## 7. Daily notes, with a promotion rule

`notes/daily/YYYY-MM-DD` off [[daily|the template]], indexed in [[daily-log]]. Each has
**Working on / Findings / Measurements / Blocked on / Tomorrow**, with measurements in a table
against the baseline.

**Promotion rule:** if an entry changes a decision or answers an open question, it gets its own
note and is linked from the daily. *A finding buried in a dated file is a finding nobody will
find again.* [[rooms-do-not-form-a-house]] is that rule working.

## 8. Zero-code questions can outrank code

[[build-order]] lists [[q-competitor-defects]] and [[q-does-anyone-pay]] as running in parallel
and explicitly *outranking* steps 3–5 in decision value. The workflow ranks work by decision
value, not by how buildable it is.

This is the part of the workflow that is **not being followed**. Both questions have outranked
the build since 2026-08-23 and both are still unanswered — see [[project-status]].

## Where the workflow broke down

Worth recording honestly, because every current defect traces to one of these:

| Break | Consequence |
|---|---|
| [[step-6-walkthrough]] was built with **no plan note and no done-condition** | Two regressions shipped; ~2,600 lines with no design note behind them |
| Seven commits landed in 48 minutes with no baseline re-run between them | [[vaastu-and-connectivity-drop-on-edit]] went unnoticed for a day |
| Module READMEs were not updated as modules landed | `backend/README.md` still said `vaastu/`, `api/`, `envelope/` "not started" and "5/5 passing" long after all three were done |
| A finding linked `[[step-6-walkthrough]]` before that note existed | Dangling link in the graph — now resolved |
| The green suite was treated as sufficient evidence | The two properties that broke were the two nothing asserted |

The lesson is not "add more process". It is that the one step run *without* the existing
process is the one that produced both blocking defects.

## 9. The graph is now queryable, not just navigable

[[knowledge-graph]] builds a real graph over code and notes together, so "which note does this
function implement?" is a query rather than a memory exercise. It independently confirmed two
things this workflow asserts: [[test-baseline]] is structurally central (13 edges, top five in
the whole corpus), and the two highest-betweenness *concept* nodes are both defects —
[[vaastu-and-connectivity-drop-on-edit]] and [[duplicated-geometry]]. A bug that bridges five
communities is a bug that touched five parts of the system.

**Links.** [[Home]] · [[project-status]] · [[HANDOFF]] · [[build-order]] · [[test-baseline]] ·
[[codebase-map]] · [[knowledge-graph]] · [[daily-log]]
