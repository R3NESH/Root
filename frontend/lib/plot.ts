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
