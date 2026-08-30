// Edge arithmetic for placing doors between adjacent rooms in the 3D view.
//
// Extracted from Scene.tsx verbatim. All three are pure functions of their arguments, so they
// were being redefined on every run of the render effect that held them.
//
// Edge letters are world-fixed cardinals, matching the solver's `openings[].edge` and the
// coordinate convention in backend/vaastu/rules.py: +X is East, +Z is South, origin at the
// plot's North-West corner.

import { Facing } from "./plot";
import { SolvedRoom } from "./solve";
import { inchesToFeet } from "./units";

export type Edge = "N" | "S" | "E" | "W";

/** A door shared by two rooms, held once with the edge each room sees it on. */
export interface Doorway {
  roomAIndex: number;
  roomBIndex: number;
  edgeA: Edge;
  edgeB: Edge;
  center: number;
}

export const oppositeEdge: Record<Edge, Edge> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

/** An ordinal facing (NE, SW, ...) resolves to the cardinal the front door sits on. */
export function getPrimaryCardinalEdge(facing: Facing): Edge {
  if (facing === "N" || facing === "NE" || facing === "NW") return "N";
  if (facing === "S" || facing === "SE" || facing === "SW") return "S";
  if (facing === "E") return "E";
  if (facing === "W") return "W";
  return "N";
}

/**
 * Centre of an opening along its wall, in feet.
 *
 * `offset_in` runs from the room's minimum corner on that edge's axis — the same convention as
 * `_edge_origin()` in backend/solver/connectivity.py. N/S edges run along X, E/W along Z.
 */
export function openingCentreFt(
  r: SolvedRoom,
  o: { edge: Edge; offset_in: number; width_in: number }
): number {
  const originIn = o.edge === "N" || o.edge === "S" ? r.x_in : r.y_in;
  return inchesToFeet(originIn + o.offset_in + o.width_in / 2);
}
