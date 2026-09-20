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
// setback treatment.
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
  /**
   * The outline drawn by hand, in plot inches, clockwise from the north-west. When present it
   * replaces the rectangle and its splays entirely: `widthIn`/`depthIn` are still carried and
   * still bound the plot, but they become the outline's bounding box rather than its shape.
   *
   * A surveyed parcel arrives as measured corners, so this is the honest representation of one.
   */
  vertsIn?: PlotPoint[];
  /**
   * How far each edge bows outward, in inches, indexed by the vertex the edge starts at. Zero
   * or absent is a straight run.
   *
   * A bow is the only curvature this stack can express. The solver holds a room inside the plot
   * with one linear constraint per edge (backend/envelope/polygon.py), so the outline reaches it
   * as chords, and an inward bow would make the plot concave, which a half-plane intersection
   * cannot describe at all. `plotShapeProblem()` says so rather than silently straightening it.
   */
  edgeBulgeIn?: number[];
}

export type PlotPoint = [number, number];

/**
 * Corners the solver will accept — backend/envelope/polygon.py MAX_VERTICES. Keep the two in
 * sync by hand, the same way lib/rooms.ts mirrors solver/rooms.py.
 */
export const MAX_PLOT_VERTICES = 32;

/** The most a single edge may bow, in inches. Beyond this the plot stops reading as a parcel. */
export const MAX_EDGE_BULGE_IN = 240;

/**
 * Corners held back from the chord budget, so a curved outline lands under the cap rather than
 * exactly on it. Measured: sampling a single 6 ft bow at 48 chords survives rounding as 32
 * corners, which is the cap itself and leaves a second bow nowhere to go.
 */
const VERTEX_HEADROOM = 6;

/** Twice the signed area. Only the sign is used, to read the winding. */
function signedArea2(poly: PlotPoint[]): number {
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    total += x0 * y1 - x1 * y0;
  }
  return total;
}

/**
 * True when every turn goes the same way — the mirror of `is_convex` in
 * backend/envelope/polygon.py, and the property the whole half-plane representation rests on.
 * Collinear points are allowed; a repeated point is not.
 */
export function isConvexOutline(poly: PlotPoint[]): boolean {
  if (poly.length < 3) return false;
  let sign = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % n];
    const [cx, cy] = poly[(i + 2) % n];
    if (ax === bx && ay === by) return false;
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross === 0) continue;
    const turn = cross > 0 ? 1 : -1;
    if (sign === 0) sign = turn;
    else if (turn !== sign) return false;
  }
  return sign !== 0;
}

/**
 * Monotone-chain convex hull over integer points, collinear points dropped.
 *
 * This exists because of integer inches, not because of the user. Sampling a curve and rounding
 * each point to the nearest inch reverses the turn between short chords, and the solver then
 * refuses the whole outline — measured: a 6 ft bow breaks at 22 chords. The hull of the rounded
 * points is convex by construction and sits within the rounding error of the curve it came from.
 *
 * Winding is restored to the input's afterwards, so the caller gets its own orientation back.
 */
export function convexHull(points: PlotPoint[]): PlotPoint[] {
  const seen = new Set<string>();
  const pts: PlotPoint[] = [];
  for (const [x, y] of points) {
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pts.push([x, y]);
  }
  if (pts.length <= 2) return pts;
  pts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const half = (seq: PlotPoint[]): PlotPoint[] => {
    const out: PlotPoint[] = [];
    for (const q of seq) {
      while (out.length >= 2) {
        const [ax, ay] = out[out.length - 2];
        const [bx, by] = out[out.length - 1];
        if ((bx - ax) * (q[1] - ay) - (by - ay) * (q[0] - ax) > 0) break;
        out.pop();
      }
      out.push(q);
    }
    return out;
  };

  const lower = half(pts);
  const upper = half([...pts].reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * One edge as chords along a quadratic Bezier bowed `bulgeIn` outward at its midpoint.
 *
 * The same construction lib/wallCurves.ts uses on a wall face, for the same reason: a Bezier is
 * within a fraction of an inch of the true arc at the bulges a plot edge can take, and it is far
 * cheaper to evaluate. `outward` is the edge normal, decided by the outline's winding, so a
 * positive bulge always means more land.
 */
function bowedEdge(
  from: PlotPoint,
  to: PlotPoint,
  bulgeIn: number,
  outward: PlotPoint,
  chords: number
): PlotPoint[] {
  const bulge = Math.max(-MAX_EDGE_BULGE_IN, Math.min(MAX_EDGE_BULGE_IN, Math.round(bulgeIn)));
  if (Math.abs(bulge) < 1) return [from];

  // The control point of a quadratic Bezier sits at twice the peak offset, because the curve
  // reaches only half way to it at t = 0.5.
  const midX = (from[0] + to[0]) / 2 + outward[0] * bulge * 2;
  const midY = (from[1] + to[1]) / 2 + outward[1] * bulge * 2;

  const out: PlotPoint[] = [];
  for (let i = 0; i < chords; i++) {
    const t = i / chords;
    const u = 1 - t;
    out.push([
      Math.round(u * u * from[0] + 2 * u * t * midX + t * t * to[0]),
      Math.round(u * u * from[1] + 2 * u * t * midY + t * t * to[1]),
    ]);
  }
  return out;
}

/** Shift an outline so its tightest corner sits at (0, 0). Bowing an edge outward pushes it
 *  past the plot frame's origin, and every consumer downstream — the 2D sheet, the 3D ground,
 *  the solver's plot frame — assumes the outline starts there. */
function normalise(poly: PlotPoint[]): PlotPoint[] {
  if (poly.length === 0) return poly;
  const minX = Math.min(...poly.map(([x]) => x));
  const minY = Math.min(...poly.map(([, y]) => y));
  if (minX === 0 && minY === 0) return poly;
  return poly.map(([x, y]) => [x - minX, y - minY] as PlotPoint);
}

/** The straight outline, before any edge is bowed. */
function baseOutline(plot: PlotDims): PlotPoint[] {
  if (plot.vertsIn && plot.vertsIn.length >= 3) {
    return plot.vertsIn.map(([x, y]) => [Math.round(x), Math.round(y)] as PlotPoint);
  }
  return rectangleOutline(plot);
}

/**
 * The plot outline in plot inches: x east, y south, (0, 0) at the north-west corner.
 *
 * Three shapes arrive here and leave as one list of corners: the plain rectangle, the rectangle
 * with splayed corners, and an outline drawn by hand with any of its edges bowed. Curved edges
 * are tessellated into chords, because chords are all the solver can be given.
 *
 * The hull is applied only to an outline that was already convex before its edges were bowed.
 * Hulling unconditionally would quietly straighten a concave plot the user deliberately drew,
 * and present the result as theirs — `plotShapeProblem()` reports that case instead.
 */
export function plotPolygonIn(plot: PlotDims): PlotPoint[] {
  const base = baseOutline(plot);
  const bulges = plot.edgeBulgeIn;
  const curved = base.map((_, i) => Math.abs(bulges?.[i] ?? 0) >= 1);
  const curvedCount = curved.filter(Boolean).length;
  if (!bulges || curvedCount === 0) return normalise(base);

  // Share the corner budget between the bowed edges. Without this a single deep bow eats the
  // whole allowance and a second one puts the outline past the cap, where the solver drops it
  // for the bounding rectangle.
  const straightCount = base.length - curvedCount;
  const chords = Math.max(
    3,
    Math.floor((MAX_PLOT_VERTICES - VERTEX_HEADROOM - straightCount) / curvedCount)
  );

  const ccw = signedArea2(base) > 0;
  const n = base.length;
  const tessellated: PlotPoint[] = [];
  for (let i = 0; i < n; i++) {
    const from = base[i];
    const to = base[(i + 1) % n];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    // Same rotation the backend uses to pick an outward normal from the winding.
    const outward: PlotPoint = ccw ? [dy / len, -dx / len] : [-dy / len, dx / len];
    tessellated.push(...bowedEdge(from, to, bulges[i] ?? 0, outward, chords));
  }

  // The hull repairs rounding, and only rounding. An inward bow is concave on purpose, and a
  // hull would erase the dent and hand back the user's plot with its shape quietly changed —
  // so the outline is left as drawn and plotShapeProblem() reports it.
  const bowsOutwardOnly = bulges.every((b) => (b ?? 0) >= 0);
  const out =
    isConvexOutline(base) && bowsOutwardOnly ? convexHull(tessellated) : tessellated;
  return normalise(out);
}

/** The rectangle-and-splays outline, which is what every plot was before outlines were drawable. */
function rectangleOutline(plot: PlotDims): PlotPoint[] {
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
  if (plot.vertsIn && plot.vertsIn.length >= 3) return false;
  if (plot.edgeBulgeIn && plot.edgeBulgeIn.some((b) => b && Math.abs(b) >= 1)) return false;
  return !plot.cornerCutsIn || plot.cornerCutsIn.every((c) => c <= 0);
}

/**
 * Why the solver cannot take this outline, or null when it can.
 *
 * The solver's answer to an outline it will not accept is to fall back to the plot's bounding
 * rectangle — quietly, because `buildable_polygon()` just returns None. That is the same class
 * of defect as notes/architecture/client-side-fallback.md: a surface that looks like it worked.
 * The UI calls this so it can say what happened instead.
 */
export function plotShapeProblem(plot: PlotDims): string | null {
  if (isRectangularPlot(plot)) return null;
  const poly = plotPolygonIn(plot);
  if (poly.length < 3) return "An outline needs at least three corners.";
  if (poly.length > MAX_PLOT_VERTICES) {
    return `${poly.length} corners is more than the solver's limit of ${MAX_PLOT_VERTICES}. Remove a corner, or reduce a bow.`;
  }
  if (!isConvexOutline(poly)) {
    return "This outline caves inward. The solver holds rooms inside the plot with one straight rule per edge, which can only describe a shape that bulges outward everywhere — a dented or L-shaped plot cannot be expressed. Rooms will be packed into the plot's bounding rectangle instead.";
  }
  return null;
}

/** The outline's bounding box, in inches — what `widthIn`/`depthIn` mean once verts are drawn. */
export function outlineBoundsIn(poly: PlotPoint[]): { widthIn: number; depthIn: number } {
  if (poly.length === 0) return { widthIn: 0, depthIn: 0 };
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  return {
    widthIn: Math.max(...xs) - Math.min(...xs),
    depthIn: Math.max(...ys) - Math.min(...ys),
  };
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
