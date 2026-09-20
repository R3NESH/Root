---
tags: [decision, ui, performance]
status: implemented
date: 2026-09-19
---
# Quality measures itself, because detection cannot be trusted

**Decision.** The renderer picks a starting quality rung from what the browser says the GPU is,
then **corrects that guess from measured frame time** for as long as the session lasts. Detection
sets only the handful of things a live WebGL context cannot change afterwards. Everything else is
moved by the governor in `frontend/lib/adaptiveQuality.ts`.

**Because.** The same build, in the same browser, ran at single-digit FPS on a friend's laptop.
Three separate client-side bugs, none of which a deployment can cause — a deploy changes load
time and API latency, never frame rate.

1. **The GPU was inferred from the CPU.** `Scene.tsx` branched on
   `navigator.hardwareConcurrency <= 4`, which counts CPU threads and says nothing about
   graphics. A laptop with an eight-core CPU and Intel integrated graphics reports 8, fails the
   test, and is handed the dedicated-GPU path: MSAA, a 1.5 pixel ratio (2.25× the pixels of 1.0),
   PCF soft shadows, `highp` precision and the whole post chain. The threshold only ever caught
   genuinely ancient machines. Every modern integrated-graphics laptop sailed past it.
2. **The device pixel ratio cap was applied after the multiply, not before.**
   `Math.min(devicePixelRatio * renderScale, 3.5)` let the runtime value override the cap set
   when the context was created, so a retina laptop drew four times the pixels of an ordinary
   screen at identical settings. It is now `Math.min(devicePixelRatio, dprCap) * renderScale`:
   render scale means the same fraction of the same ceiling on every machine.
3. **The performance HUD was lying.** `<span>GPU: Dedicated (High VRAM)</span>` was hardcoded and
   printed on every machine, so a laptop running at 8 fps was being told it had a dedicated card.
   That is most of the reason this went unseen for a month. It now prints the real renderer
   string, the tier, the current rung and measured fps, and labels the VRAM figure **est.**
   because it is arithmetic over the settings rather than anything read off the device.

**Why detection alone is not enough.** `WEBGL_debug_renderer_info` is the only way to ask a
browser what the GPU is, and it is not dependable: Firefox masks it under
`privacy.resistFingerprinting`, and any browser is allowed to. The string it returns is a
marketing name, not a benchmark. And a thermally throttled laptop is a different machine at
minute ten than at minute one. The only fact actually available is the frame time.

So `gpuTier.ts` picks a **starting rung** and the settings that are frozen at context creation —
anti-alias, precision, DPR cap, shadow-map size, whether the composer is built at all. A masked
or unrecognised GPU starts **mid**, not high. `adaptiveQuality.ts` measures and corrects.

**Rejected alternatives.**

- **Move every setting.** Anti-aliasing and shader precision are WebGL context attributes and
  cannot be changed after the context exists. Texture quality *could* move, but the textures are
  generated on a canvas and cached, so changing it rebuilds every material mid-frame — a stall in
  the name of avoiding stalls. Only render scale (a framebuffer resize) and shadow quality (a
  shadow-map resize) move. Between them they are most of the cost.
- **Step down on one slow frame.** Produces a renderer that flickers between resolutions forever,
  which looks worse than either end. Instead: a window of frames, different thresholds down (under
  24 fps) and up (over 58 fps for six good windows), a longer wait to climb than to fall, and a
  **climb cap** — a machine that has been demoted twice has proved something.
- **Feed the governor the render loop's frame delta.** The loop clamps at 0.1 s so the physics
  does not explode after a stall. A governor fed clamped deltas can never observe a machine below
  10 fps, which is precisely the case it exists for. It reads the unclamped delta, and ignores a
  backgrounded tab's one enormous delta rather than counting it as a slow frame.
- **Let the governor overrule the user.** Opening the graphics modal and choosing anything sets
  `autoQuality` false. A setting a person picked is not the governor's to move.

**What would reverse it.** A measurement showing the governor oscillating in real use, or holding
a machine down that could run higher. It was checked against a simulated renderer — 8 fps walks to
the bottom rung and stops, 120 fps never moves, 90 fps climbs twice and holds, an 18–42 fps
oscillation produces three changes in six thousand frames, and a 30 s frame is ignored — but
**never against a real slow machine**, which is the machine it was written for.

**Links.** [[render-realism]] · [[codebase-map]] · [[project-status]] · [[environment-notes]]
