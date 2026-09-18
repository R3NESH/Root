// Describing a plot by walking its boundary.
//
// The first attempt at typed plot entry asked for each corner's X and Y. Nobody holds a plot in
// their head that way. Two conventions exist in the real world and both describe the *edges*:
//
// - A surveyor's deed is metes and bounds — one "call" per edge, a bearing and a distance,
//   walked around the parcel. Every deed-plotting tool reads and writes exactly that table.
// - An Indian plot owner with a tape measures the four sides and one diagonal, and the area
//   comes from Heron's formula on the two triangles.
//
// Both walk the boundary. So this module holds a plot as a **traverse**: a list of edges, each
// with a length, the turn taken at the corner after it, and how far it bows. Bearings are
// replaced by turns because "turn right 90 degrees" needs no compass training, and the compass
// name of each edge is derived and shown rather than typed.
//
// The practical win over coordinates is that every row is independently valid. Changing one side
// length gives a different plot; changing one X gives a plot whose other corners now disagree
// with it, which is how the coordinate table produced degenerate outlines mid-keystroke.

import { MAX_EDGE_BULGE_IN, PlotPoint } from "./plot";

export interface PlotEdge {
  /** How long this side runs, in inches. */
  lengthIn: number;
  /**
   * The turn taken at the corner at the END of this side, in degrees. Positive turns right
   * (clockwise on screen). A rectangle is four sides of 90.
   *
   * Not rounded to a whole degree. Lengths are integer inches per [[integer-inches]] because a
   * length is measured; a turn is derived, and rounding a tapered plot's lean to the nearest
   * degree opened a 5 inch gap in a preset that is supposed to close exactly.
   */
  turnDeg: number;
  /** How far this side bows outward at its midpoint, in inches. Zero is a straight run. */
  bulgeIn: number;
}

/** A closed traverse's turns sum to this. Anything else does not come back to where it started. */
export const FULL_TURN_DEG = 360;

/** Closure slack. Under an inch is rounding, not a gap the user needs to see. */
export const CLOSURE_TOLERANCE_IN = 1;

const DEG = Math.PI / 180;

/**
 * Walk the traverse and return the corner it starts each side from.
 *
 * Screen axes, matching lib/plot.ts: +X east, +Y south. Heading 0 is due east, and a positive
 * turn goes clockwise on screen. The walk starts at the origin heading east, which puts the
 * first side along the top of the plot — the road edge for a north-facing plot.
 */
export function traverseToVerts(edges: PlotEdge[]): PlotPoint[] {
  const pts: PlotPoint[] = [];
  let heading = 0;
  let x = 0;
  let y = 0;
  for (const e of edges) {
    pts.push([Math.round(x), Math.round(y)]);
    x += e.lengthIn * Math.cos(heading * DEG);
    y += e.lengthIn * Math.sin(heading * DEG);
    heading += e.turnDeg;
  }
  return pts;
}

/**
 * How far the walk misses its starting corner by, in inches.
 *
 * A traverse the user has edited will usually not close, and a shape that does not close is not
 * a plot. Reporting the gap is the honest move: silently moving the last corner to meet the
 * first would hand back a plot with a side length the user did not ask for.
 */
export function closureErrorIn(edges: PlotEdge[]): number {
  let heading = 0;
  let x = 0;
  let y = 0;
  for (const e of edges) {
    x += e.lengthIn * Math.cos(heading * DEG);
    y += e.lengthIn * Math.sin(heading * DEG);
    heading += e.turnDeg;
  }
  return Math.hypot(x, y);
}

/** Normalise to (-180, 180] so a turn reads as left or right rather than as 350 degrees. */
function normaliseTurn(deg: number): number {
  let t = deg % 360;
  if (t > 180) t -= 360;
  if (t <= -180) t += 360;
  return t;
}

/** Read an existing outline back as a traverse, so a dragged shape can be inspected as numbers. */
export function vertsToTraverse(verts: PlotPoint[], bulges: number[] = []): PlotEdge[] {
  const n = verts.length;
  if (n < 3) return [];
  const headings: number[] = [];
  const lengths: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = verts[i];
    const [x1, y1] = verts[(i + 1) % n];
    lengths.push(Math.hypot(x1 - x0, y1 - y0));
    headings.push(Math.atan2(y1 - y0, x1 - x0) / DEG);
  }
  return lengths.map((lengthIn, i) => ({
    lengthIn: Math.round(lengthIn),
    turnDeg: normaliseTurn(headings[(i + 1) % n] - headings[i]),
    bulgeIn: Math.round(bulges[i] ?? 0),
  }));
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/**
 * Which way each side faces, as a compass letter — the label the user reads instead of a bearing.
 *
 * A side's direction is its outward normal, not the way it runs: the side along the top of a
 * north-facing plot IS the north side even though you walk it eastward. Which of the two normals
 * points outward depends on the winding, so that is read off the signed area rather than assumed.
 */
export function edgeCompassLabels(edges: PlotEdge[]): string[] {
  const verts = traverseToVerts(edges);
  let area2 = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x0, y0] = verts[i];
    const [x1, y1] = verts[(i + 1) % verts.length];
    area2 += x0 * y1 - x1 * y0;
  }
  // +Y is south, so a positive signed area here is a clockwise walk on screen.
  const outwardOffset = area2 > 0 ? -90 : 90;

  const labels: string[] = [];
  let heading = 0;
  for (const e of edges) {
    // Screen angle to compass: 0 degrees is east, and north is up, which is -Y.
    const normal = heading + outwardOffset;
    const compassDeg = (((normal + 90) % 360) + 360) % 360;
    labels.push(COMPASS[Math.round(compassDeg / 45) % 8]);
    heading += e.turnDeg;
  }
  return labels;
}

/** The four sides of a plain rectangle, walked clockwise from its north-west corner. */
export function rectangleTraverse(widthIn: number, depthIn: number): PlotEdge[] {
  return [
    { lengthIn: Math.round(widthIn), turnDeg: 90, bulgeIn: 0 },
    { lengthIn: Math.round(depthIn), turnDeg: 90, bulgeIn: 0 },
    { lengthIn: Math.round(widthIn), turnDeg: 90, bulgeIn: 0 },
    { lengthIn: Math.round(depthIn), turnDeg: 90, bulgeIn: 0 },
  ];
}

export interface PlotShapePreset {
  id: string;
  label: string;
  /** One line saying what real plot this is, not what the geometry is. */
  blurb: string;
  build: (widthIn: number, depthIn: number) => PlotEdge[];
}

/**
 * The shapes Indian plots actually come in. Each one closes exactly, so picking one never leaves
 * the user with a gap to fix.
 */
export const PLOT_SHAPE_PRESETS: PlotShapePreset[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    blurb: "The ordinary plot. Four square corners.",
    build: rectangleTraverse,
  },
  {
    id: "cut_corner",
    label: "Cut corner",
    blurb: "A corner plot, splayed where two roads meet.",
    build: (w, d) => {
      // A 45 degree splay eats the same run off both sides it touches, so the two 90 degree
      // corners it replaces become two 45s and the shape still closes.
      const cut = Math.round(Math.min(w, d) * 0.2);
      const run = Math.round(cut * Math.SQRT2);
      return [
        { lengthIn: Math.round(w) - cut, turnDeg: 45, bulgeIn: 0 },
        { lengthIn: run, turnDeg: 45, bulgeIn: 0 },
        { lengthIn: Math.round(d) - cut, turnDeg: 90, bulgeIn: 0 },
        { lengthIn: Math.round(w), turnDeg: 90, bulgeIn: 0 },
        { lengthIn: Math.round(d), turnDeg: 90, bulgeIn: 0 },
      ];
    },
  },
  {
    id: "trapezoid",
    label: "Tapered",
    blurb: "Wider at the road than at the back, or the reverse.",
    build: (w, d) => {
      // The back is a fifth narrower. The two side turns follow from that taper, so the walk
      // still returns to its start.
      const back = Math.round(w * 0.8);
      const inset = (w - back) / 2;
      const side = Math.hypot(d, inset);
      const lean = Math.atan2(inset, d) / DEG;
      return [
        { lengthIn: Math.round(w), turnDeg: 90 + lean, bulgeIn: 0 },
        { lengthIn: Math.round(side), turnDeg: 90 - lean, bulgeIn: 0 },
        { lengthIn: back, turnDeg: 90 - lean, bulgeIn: 0 },
        { lengthIn: Math.round(side), turnDeg: 90 + lean, bulgeIn: 0 },
      ];
    },
  },
  {
    id: "curved_front",
    label: "Curved front",
    blurb: "A plot on the outside of a bend, bowed along the road.",
    build: (w, d) => {
      const edges = rectangleTraverse(w, d);
      edges[0] = {
        ...edges[0],
        bulgeIn: Math.min(MAX_EDGE_BULGE_IN, Math.round(w * 0.15)),
      };
      return edges;
    },
  },
];
