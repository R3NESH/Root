// Curved wall faces on otherwise rectangular rooms.
//
// A bay window, a bowed entrance wall, an apsidal end. The solver still packs rectangles — a
// curve is not something CP-SAT's no-overlap can be given (backend/solver/model.py) — so the
// curve lives on the *face* of a wall the solver already placed, as a bulge measured from the
// straight run it replaces. The room's footprint, its area, its adjacencies and its Vaastu
// quadrant are all exactly what they were.
//
// The curve is a quadratic Bézier rather than a true circular arc. For the bulges a wall can
// take (capped below at a fraction of the run) the two are within a fraction of an inch of each
// other, and the Bézier needs no radius, no centre and no major/minor arc case. What is drawn is
// what is measured: the same sampled polyline feeds the geometry, the collision obstacles and
// the bill of quantities.

export type WallEdge = "N" | "E" | "S" | "W";

/** Bulge in inches per room edge, keyed by room id. Positive bulges outward, negative inward. */
export type RoomEdgeCurves = Record<string, Partial<Record<WallEdge, number>>>;

/** How far a wall may bow, as a fraction of the run it spans. Past this it stops reading as a
 *  wall and starts reading as a room. */
export const MAX_BULGE_FRACTION = 0.3;

/** Absolute ceiling, in inches, regardless of how long the run is. */
export const MAX_BULGE_IN = 48;

/** The outward normal of a room edge, in scene axes: +x east, +z south. */
export function edgeNormal(edge: WallEdge): [number, number] {
  if (edge === "N") return [0, -1];
  if (edge === "S") return [0, 1];
  if (edge === "W") return [-1, 0];
  return [1, 0];
}

/** The bulge this edge may actually take on a run of `runFt`, in feet, sign preserved. */
export function clampBulgeFt(bulgeFt: number, runFt: number): number {
  const limit = Math.min(MAX_BULGE_IN / 12, runFt * MAX_BULGE_FRACTION);
  return Math.max(-limit, Math.min(limit, bulgeFt));
}

/**
 * The curved face as a polyline, from (x0, z0) to (x1, z1), bowed `bulgeFt` along the outward
 * normal (nx, nz). The apex of a quadratic Bézier sits half way to its control point, so the
 * control point is placed at twice the bulge and the curve passes through exactly the bulge.
 */
export function curvedEdgePoints(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  bulgeFt: number,
  nx: number,
  nz: number,
  segments = 14
): Array<[number, number]> {
  const cx = (x0 + x1) / 2 + nx * bulgeFt * 2;
  const cz = (z0 + z1) / 2 + nz * bulgeFt * 2;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push([
      u * u * x0 + 2 * u * t * cx + t * t * x1,
      u * u * z0 + 2 * u * t * cz + t * t * z1,
    ]);
  }
  return points;
}

export function polylineLengthFt(points: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/**
 * How much longer every curved wall in the design is than the straight run it replaces, in feet.
 * The bill of quantities counts straight perimeters; without this a bowed wall would be built
 * and never costed.
 */
export function extraWallLengthFt(
  curves: RoomEdgeCurves | undefined,
  rooms: Array<{ id: string; widthFt: number; depthFt: number }>
): number {
  if (!curves) return 0;
  let extra = 0;
  for (const room of rooms) {
    const forRoom = curves[room.id];
    if (!forRoom) continue;
    for (const [edge, bulgeIn] of Object.entries(forRoom)) {
      if (!bulgeIn) continue;
      const runFt = edge === "N" || edge === "S" ? room.widthFt : room.depthFt;
      const bulgeFt = clampBulgeFt(bulgeIn / 12, runFt);
      if (Math.abs(bulgeFt) < 0.05) continue;
      // Length does not care which way the wall faces, only that the bulge is perpendicular to
      // the run, so this measures a straight run bowed sideways.
      const points = curvedEdgePoints(0, 0, runFt, 0, bulgeFt, 0, -1);
      extra += polylineLengthFt(points) - runFt;
    }
  }
  return extra;
}
