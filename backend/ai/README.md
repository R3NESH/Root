# backend/ai

Free text to solver constraints. The model does vocabulary; CP-SAT still decides everything
about the plan — [[vaastu-as-constraints]].

`prompt_constraints.py` — `parse_prompt()` calls Claude with a Pydantic output format;
`resolve()` validates the answer against `programs/registry.py` and moves anything the catalog
cannot express into `unsupported`. There is **no offline fallback**, on purpose:
[[client-side-fallback]] records what one costs.

Wired to `POST /ai/plan` in `../api/main.py`, which hands back a `POST /solve` body rather than
a plan — one endpoint, one job.

Needs `ANTHROPIC_API_KEY`. Without it the endpoint returns 503 rather than guessing.

Reverses the chatbot half of [[rejected-approaches]] on the user's call, 2026-09-06 —
[[free-text-input]].
