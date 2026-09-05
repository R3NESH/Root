---
tags: [architecture, rendering, finding]
status: implemented
date: 2026-09-04
---
# The renderer had no environment, and everything else followed from that

**Claim.** The question was "why do the simulations not look like a real
architectural render?" The answer was not model detail, texture resolution or
tone mapping. It was that **every material was lit by three lights and nothing
else.** `scene.environment` was never set, so in a physically-based renderer
every surface had zero specular response. Marble reflected nothing. Glass
reflected nothing. Metal was grey paint.

This note records that pass and what it exposed. Companion to
[[realism-gaps]], which is about the *plan* being unrealistic; this one is
about the *picture* being unrealistic. They are unrelated failures.

## What was wrong, measured before

| Gap | Before |
|---|---|
| Image-based lighting | none — zero references to `scene.environment` anywhere |
| Path tracer | ran with `environmentIntensity` forced to 0, because that is what `three-gpu-pathtracer` does when `scene.environment` is null |
| Ambient occlusion | none — no `EffectComposer` in the project at all |
| Surface maps | colour only, plus one `bumpMap` on walls; no normal or roughness maps |
| Colour management | every procedural texture handed over as `NoColorSpace`, so sRGB canvas values were read as linear |
| Glass | alpha-blended `MeshStandardMaterial` with `depthWrite: false`, no Fresnel, no refraction |
| Furniture | 230 `BoxGeometry`/`CylinderGeometry` calls; [[modelLoader]] existed and only user uploads reached it |
| Site | one flat-coloured ground plane; the lawn canvas that had been written for it was orphaned |

## What now holds

1. **A half-float radiance map, not a canvas.** `createSkyEnvTexture` builds an
   equirectangular `DataTexture` of linear radiance, PMREM-prefiltered into
   `scene.environment`. It is half-float on purpose: an LDR canvas caps the sun
   at 1.0, the same value as white sky, so a polished floor reflects a sun no
   brighter than its surroundings and the reflection reads as flat ambient. The
   sun disc sits ~130× the sky mean, at the equirect uv of the sun
   `DirectionalLight`'s own direction, so the highlight agrees with the shadows.
   The horizon is a hard edge for the same reason: **a smooth gradient reflects
   as a smooth gradient**, which is indistinguishable from the hemisphere light
   it replaced.
2. **GTAO through an `EffectComposer`**, radius 1.5 ft — the 0.25 default is
   three inches in this scene's units and reads as an outline, not occlusion.
   See [[codebase-map]] for `lib/aoPass.ts`.
3. **Normal and roughness maps derived, not authored.** Sobel over the existing
   colour canvas for floors and the existing height canvas for walls, rather
   than 30-odd more draw functions to keep in step with the first set. A new
   finish gets them by being drawn once.
4. **Colour space fixed** at the texture factory, with height and normal data
   kept linear.
5. **Transmissive glass** on window panes, glazed walls and glass door leaves —
   `transmission`, `ior: 1.52`, tint moved to `attenuationColor`. It stays out
   of the transparent queue, which is what the old `depthWrite: false` dodge was
   compensating for.
6. **Real furniture and a landscaped setback** — [[furniture-models]] and
   `lib/siteLandscape.ts`.

## The two traps worth remembering

### Adding a composer silently removes anti-aliasing

`antialias: true` on the `WebGLRenderer` applies only to the default
framebuffer. The moment an `EffectComposer` exists, that stops being the render
destination, and `EffectComposer`'s own default target is single-sampled —
there is no mention of `samples` anywhere in it. So switching the AO pass on
cost every edge in the scene its anti-aliasing, which reads to a user as a drop
in *resolution*, not as a missing effect. The fix is to pass a
`WebGLRenderTarget` with `samples: 4`; `RenderTarget.copy()` carries `samples`,
so the cloned ping-pong buffer inherits it.

### Viewport width is not a GPU capability

`isMobileOrLowGPU` included `window.innerWidth < 800`. That one term gated
anti-aliasing, shadow filtering, shadow map size, pixel ratio **and** whether
the composer was built at all — and it was read once at mount, so resizing
never recovered. Docking the app beside an editor silently dropped all five.
Removed.

## Aliasing masquerades as content

Two separate symptoms in this pass turned out to be sampling artefacts rather
than the thing they looked like:

- Mower stripes on the lawn at 8 bands × 14 repeats put the stripe pitch under
  a pixel over most of the plot, and what reached the screen was moiré banding.
- A saturated catalog swatch used raw as a `transmission` colour renders a
  window as a lit blue panel. Under transmission the base colour tints
  everything passing through, so the tint belongs in attenuation — which is
  what a tint physically is, light coloured by the distance it travels through
  the glass.

## Still open

- Nothing here has been verified against a screenshot by the author of the
  change; it is verified by `tsc`, `npm run build`, and by reading the values
  out of the generated buffers. Frontend has no tests — see [[codebase-map]].
- The solver-room door leaf is still a hinged swing. Sliding glass doors render
  as twin bypassing panels only on custom drawn walls, because the solver-room
  path owns the interactive door from [[step-6-walkthrough]].
- `study_desk`, `vanity_table`, `tv_unit`, `refrigerator`, `kitchen_island` and
  `pooja_mandir` have no honest CC0 match and still render as primitives.

**Links.** [[codebase-map]] · [[furniture-models]] · [[realism-gaps]] ·
[[project-status]] · [[step-1-threejs-shell]]
