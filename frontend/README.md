# frontend

Next.js 16 + TypeScript + Three.js. Owns everything continuous — see
[[client-continuous-server-discrete]] and [[architecture]].

## Modules

| Path | Implements |
|---|---|
| `components/Scene.tsx` | [[step-1-threejs-shell]] — plot box, setback envelope, extrusion, drag handles |
| `components/PlotPicker.tsx` | [[ui-principles]] #1, #4 |
| `components/CompassDial.tsx` | [[ui-principles]] #6 |
| `lib/plot.ts`, `lib/units.ts` | [[input-is-plot-dimensions]], [[integer-inches]] |
| `app/page.tsx` | composition root |

Zero `fetch()` calls until [[step-3-wire-together]] wires up `POST /solve`.

## Dev

```
npm run dev
```

`AGENTS.md` / `CLAUDE.md` are `create-next-app` boilerplate (Next.js 16 differs from training
data — read `node_modules/next/dist/docs/` before assuming an older API).
