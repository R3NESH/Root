import { feetToInches } from "./units";

// notes/decisions/input-is-plot-dimensions.md — plot dimensions + facing, never square footage.

export type Facing = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export const FACINGS: Facing[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Angle from true north, clockwise, matching compass convention. Index into FACINGS.
export function facingAngleDeg(facing: Facing): number {
  return FACINGS.indexOf(facing) * 45;
}

// The plot is axis-aligned, so only a cardinal direction can cleanly own one edge as "front".
// An ordinal (corner) facing is rounded to its nearest cardinal for setback purposes only —
// a known simplification for Phase 1 step 1; revisit if corner-facing plots need their own
// Vaastu treatment at notes/build/step-5-vaastu.md.
export function frontCardinalIndex(facing: Facing): 0 | 1 | 2 | 3 {
  const nearest = Math.round(facingAngleDeg(facing) / 90) % 4;
  return nearest as 0 | 1 | 2 | 3; // 0=N, 1=E, 2=S, 3=W
}

export interface PlotDims {
  widthIn: number; // X axis, in scene: East–West
  depthIn: number; // Z axis, in scene: North–South
  /**
   * Corner splays, in inches, clockwise from the north-west corner: [NW, NE, SE, SW]. Zero is a
   * square corner and is what every plot used to be.
   *
   * A corner plot is cut where its two roads meet, and a plot on a bend is trapezoidal. Both are
   * ordinary and neither could be expressed before. The cut is symmetric — the same distance
   * back along each of the two edges — which is what a splay usually is and which keeps the
   * outline convex by construction, the one thing the solver requires (backend
   * envelope/polygon.py).
   */
  cornerCutsIn?: [number, number, number, number];
}

export type PlotPoint = [number, number];

/**
 * The plot outline in plot inches: x east, y south, (0, 0) at the north-west corner. Corners
 * with no splay contribute one point, splayed ones contribute two.
 */
export function plotPolygonIn(plot: PlotDims): PlotPoint[] {
  const cuts = plot.cornerCutsIn;
  const w = plot.widthIn;
  const d = plot.depthIn;
  if (!cuts || cuts.every((c) => c <= 0)) {
    return [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ];
  }

  // A cut can never eat more than its share of either edge it sits on, or the outline folds
  // through itself and stops being a plot.
  const clamp = (i: number, along: number) =>
    Math.max(0, Math.min(Math.round(cuts[i] ?? 0), Math.floor(along / 2) - 1));
  const nw = Math.min(clamp(0, w), clamp(0, d));
  const ne = Math.min(clamp(1, w), clamp(1, d));
  const se = Math.min(clamp(2, w), clamp(2, d));
  const sw = Math.min(clamp(3, w), clamp(3, d));

  const points: PlotPoint[] = [];
  // North edge, west to east.
  points.push(nw > 0 ? [nw, 0] : [0, 0]);
  points.push(ne > 0 ? [w - ne, 0] : [w, 0]);
  // East edge, north to south.
  if (ne > 0) points.push([w, ne]);
  points.push(se > 0 ? [w, d - se] : [w, d]);
  // South edge, east to west.
  if (se > 0) points.push([w - se, d]);
  points.push(sw > 0 ? [sw, d] : [0, d]);
  // West edge, south to north.
  if (sw > 0) points.push([0, d - sw]);
  if (nw > 0) points.push([0, nw]);
  return points;
}

/** True when the plot is a plain rectangle, which is the fast path everywhere downstream. */
export function isRectangularPlot(plot: PlotDims): boolean {
  return !plot.cornerCutsIn || plot.cornerCutsIn.every((c) => c <= 0);
}

/** Largest splay that still leaves a sane plot, in inches. */
export function maxCornerCutIn(plot: PlotDims): number {
  return Math.max(0, Math.floor(Math.min(plot.widthIn, plot.depthIn) / 2) - 1);
}

export interface PlotPreset {
  label: string;
  widthFt: number;
  depthFt: number;
}

// notes/ui/ui-principles.md — the market's own plot sizes, one tap, no keyboard.
export const PLOT_PRESETS: PlotPreset[] = [
  { label: "20×30", widthFt: 20, depthFt: 30 },
  { label: "30×40", widthFt: 30, depthFt: 40 },
  { label: "30×50", widthFt: 30, depthFt: 50 },
  { label: "40×60", widthFt: 40, depthFt: 60 },
  { label: "50×80", widthFt: 50, depthFt: 80 },
];

export const DEFAULT_PLOT: PlotDims = {
  widthIn: feetToInches(PLOT_PRESETS[1].widthFt),
  depthIn: feetToInches(PLOT_PRESETS[1].depthFt),
};

export const MIN_DIM_IN = feetToInches(10);
export const MAX_DIM_IN = feetToInches(100);

export interface Setback {
  frontIn: number;
  rearIn: number;
  leftIn: number;
  rightIn: number;
}

// notes/architecture/environment-notes.md — HARDCODED, a known gap, not a convention.
// Real values come from local building bye-laws and vary by plot size and road width.
// Matches the worked example in notes/architecture/output-schema.md.
export const DEFAULT_SETBACK: Setback = {
  frontIn: feetToInches(5),
  rearIn: feetToInches(5),
  leftIn: feetToInches(3),
  rightIn: feetToInches(3),
};

// Preview massing height only — not an architectural floor height. Real per-room extrusion
// lands at notes/build/step-3-wire-together.md once CP-SAT returns room rectangles.
export const ENVELOPE_HEIGHT_IN = feetToInches(10);

// Per-edge setback in fixed world orientation, index 0=N, 1=E, 2=S, 3=W (matches
// frontCardinalIndex). "Right" is clockwise from front, "left" is counter-clockwise —
// the convention of standing at the front edge facing outward.
export function edgeSetbacksIn(facing: Facing, setback: Setback): [number, number, number, number] {
  const front = frontCardinalIndex(facing);
  const rear = ((front + 2) % 4) as 0 | 1 | 2 | 3;
  const right = ((front + 1) % 4) as 0 | 1 | 2 | 3;
  const left = ((front + 3) % 4) as 0 | 1 | 2 | 3;
  const edges: [number, number, number, number] = [0, 0, 0, 0];
  edges[front] = setback.frontIn;
  edges[rear] = setback.rearIn;
  edges[right] = setback.rightIn;
  edges[left] = setback.leftIn;
  return edges;
}

// index 0=N, 2=S sit on the depth (Z) axis; 1=E, 3=W sit on the width (X) axis — regardless of
// which edge is "front", so these must go through edgeSetbacksIn rather than reading the
// Setback fields directly.
export function buildableWidthIn(plot: PlotDims, facing: Facing, setback: Setback): number {
  const edges = edgeSetbacksIn(facing, setback);
  return Math.max(0, plot.widthIn - edges[1] - edges[3]);
}

export function buildableDepthIn(plot: PlotDims, facing: Facing, setback: Setback): number {
  const edges = edgeSetbacksIn(facing, setback);
  return Math.max(0, plot.depthIn - edges[0] - edges[2]);
}
