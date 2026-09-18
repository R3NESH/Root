// Several drawn walls combined into one run, and the shape of the corner where two of them meet.
//
// A drawn wall (lib/customArchitecture.ts) is one straight or bowed segment between two points.
// Two walls meeting at a right angle are two independent segments whose boxes happen to overlap.
// That is what a square corner looks like, and it was all a corner could ever look like: there
// was nowhere to say "take this one round".
//
// So walls are combined into a *chain* — an ordered, head-to-tail run sharing a `chainId` — and
// the chain carries a joint style. The chain is stored on the walls themselves rather than beside
// them, so it saves, loads and undoes with the walls and needs no state of its own.
//
// Nothing here edits the drawing. `resolveChainWalls` takes the walls as drawn and returns the
// walls as built: the two at a shaped joint trimmed back to their tangent points, with a short
// corner piece inserted between them. The user's own walls keep their endpoints, so turning a
// corner back to square puts the wall back exactly where it was.

import { CustomDrawnWall, CustomWallOpening, WallJoinStyle } from "./customArchitecture";

export const JOIN_STYLES: { id: WallJoinStyle; name: string; description: string }[] = [
  {
    id: "miter",
    name: "Square",
    description: "A sharp corner. The two walls run to a point and meet there.",
  },
  {
    id: "round",
    name: "Rounded",
    description: "The corner is swept out into an arc, tangent to both walls.",
  },
  {
    id: "chamfer",
    name: "Chamfer",
    description: "The corner is cut off flat across the two tangent points.",
  },
];

/** Corner radius a new chain starts with, in inches. Reads as deliberate at plan scale. */
export const DEFAULT_JOIN_RADIUS_IN = 18;
/** Below this the arc is shorter than the wall is thick and stops reading as a curve. */
export const MIN_JOIN_RADIUS_IN = 3;
/** Eight feet. Past this it is a curved wall, not a corner. */
export const MAX_JOIN_RADIUS_IN = 96;

/** Two wall ends this close are the same point. Combining snaps them together outright. */
export const JOIN_SNAP_IN = 18;

/** Outside this range the two walls are a straight line, and there is no corner to shape. */
const MIN_CORNER_DEG = 5;
const MAX_CORNER_DEG = 175;

/** The most of a wall's length one joint may eat. Both ends still leave a tenth of it standing. */
const MAX_TRIM_FRACTION = 0.45;

function lengthIn(w: CustomDrawnWall): number {
  return Math.hypot(w.endXIn - w.startXIn, w.endYIn - w.startYIn);
}

/** The same test Scene.tsx uses to decide a wall is drawn as an arc rather than a box. */
function isBowed(w: CustomDrawnWall): boolean {
  return Boolean(
    w.isCurved ||
      w.wallType.startsWith("curved") ||
      (w.curveBulgeIn && Math.abs(w.curveBulgeIn) > 1)
  );
}

function near(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.hypot(ax - bx, ay - by) <= JOIN_SNAP_IN;
}

function touchesPoint(w: CustomDrawnWall, x: number, y: number): boolean {
  return near(w.startXIn, w.startYIn, x, y) || near(w.endXIn, w.endYIn, x, y);
}

/** The same wall drawn the other way round, so a chain can be walked head to tail. */
function reverseWall(w: CustomDrawnWall): CustomDrawnWall {
  const len = lengthIn(w);
  return {
    ...w,
    startXIn: w.endXIn,
    startYIn: w.endYIn,
    endXIn: w.startXIn,
    endYIn: w.startYIn,
    // The bulge is measured off the left of the run, and the run has just turned around.
    curveBulgeIn: w.curveBulgeIn ? -w.curveBulgeIn : w.curveBulgeIn,
    openings: (w.openings || []).map((o) => ({
      ...o,
      offsetIn: Math.round(len - o.offsetIn - o.widthIn),
    })),
  };
}

/**
 * The selected walls put in order, each one turned to run head to tail, and their shared ends
 * snapped shut — or the reason they are not one run.
 *
 * The snap matters more than it looks. Every corner below is measured off one shared point; two
 * ends an inch apart would put the two tangent points on two different corners, and the arc
 * between them would miss both walls.
 */
export function orderChain(
  walls: CustomDrawnWall[]
): { ordered: CustomDrawnWall[] } | { error: string } {
  if (walls.length < 2) return { error: "Select two or more walls to combine." };
  if (new Set(walls.map((w) => w.floor ?? 0)).size > 1) {
    return { error: "All the walls have to be on one floor." };
  }

  const remaining = walls.slice();

  // Seed on a wall with a free end so the walk runs from one end of the chain to the other. A run
  // where every end is matched is a closed loop, which this does not build.
  let seedIndex = -1;
  let seedFlip = false;
  for (let i = 0; i < remaining.length && seedIndex < 0; i++) {
    const w = remaining[i];
    if (!remaining.some((o, j) => j !== i && touchesPoint(o, w.startXIn, w.startYIn))) {
      seedIndex = i;
      seedFlip = false;
    } else if (!remaining.some((o, j) => j !== i && touchesPoint(o, w.endXIn, w.endYIn))) {
      seedIndex = i;
      seedFlip = true;
    }
  }
  if (seedIndex < 0) {
    return { error: "These walls close a loop. Leave one out and combine the rest." };
  }

  const seed = remaining.splice(seedIndex, 1)[0];
  const ordered: CustomDrawnWall[] = [seedFlip ? reverseWall(seed) : seed];

  while (remaining.length > 0) {
    const tail = ordered[ordered.length - 1];
    let foundIndex = -1;
    let flip = false;
    for (let i = 0; i < remaining.length; i++) {
      const w = remaining[i];
      if (near(w.startXIn, w.startYIn, tail.endXIn, tail.endYIn)) {
        foundIndex = i;
        flip = false;
        break;
      }
      if (near(w.endXIn, w.endYIn, tail.endXIn, tail.endYIn)) {
        foundIndex = i;
        flip = true;
        break;
      }
    }
    if (foundIndex < 0) {
      return { error: "These walls are not one continuous run. Move their ends together first." };
    }

    const picked = remaining.splice(foundIndex, 1)[0];
    const next = flip ? reverseWall(picked) : picked;
    const meetX = Math.round((tail.endXIn + next.startXIn) / 2);
    const meetY = Math.round((tail.endYIn + next.startYIn) / 2);
    ordered[ordered.length - 1] = { ...tail, endXIn: meetX, endYIn: meetY };
    ordered.push({ ...next, startXIn: meetX, startYIn: meetY });
  }

  return { ordered };
}

/** Every wall of one chain, in the order it runs. */
export function chainWalls(walls: CustomDrawnWall[], chainId: string): CustomDrawnWall[] {
  return walls
    .filter((w) => w.chainId === chainId)
    .sort((a, b) => (a.chainIndex ?? 0) - (b.chainIndex ?? 0));
}

/** The chain the given walls all belong to, or null when they do not share exactly one. */
export function commonChainId(walls: CustomDrawnWall[], ids: string[]): string | null {
  const chosen = walls.filter((w) => ids.includes(w.id));
  if (chosen.length === 0) return null;
  const first = chosen[0].chainId;
  if (!first) return null;
  return chosen.every((w) => w.chainId === first) ? first : null;
}

export function combineWalls(
  walls: CustomDrawnWall[],
  ids: string[]
): { walls: CustomDrawnWall[] } | { error: string } {
  const result = orderChain(walls.filter((w) => ids.includes(w.id)));
  if ("error" in result) return result;

  const chainId = `chain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const stamped = new Map(
    result.ordered.map((w, i) => [
      w.id,
      {
        ...w,
        chainId,
        chainIndex: i,
        joinStyle: w.joinStyle ?? ("miter" as WallJoinStyle),
        joinRadiusIn: w.joinRadiusIn ?? DEFAULT_JOIN_RADIUS_IN,
      },
    ])
  );
  return { walls: walls.map((w) => stamped.get(w.id) ?? w) };
}

/** Back to loose walls. They keep the ends the combine snapped them to. */
export function breakChain(walls: CustomDrawnWall[], chainId: string): CustomDrawnWall[] {
  return walls.map((w) => {
    if (w.chainId !== chainId) return w;
    const loose = { ...w };
    delete loose.chainId;
    delete loose.chainIndex;
    delete loose.joinStyle;
    delete loose.joinRadiusIn;
    return loose;
  });
}

/** One style and one radius for every corner in the chain. */
export function setChainJoin(
  walls: CustomDrawnWall[],
  chainId: string,
  style: WallJoinStyle,
  radiusIn: number
): CustomDrawnWall[] {
  const clamped = Math.max(
    MIN_JOIN_RADIUS_IN,
    Math.min(MAX_JOIN_RADIUS_IN, Math.round(radiusIn))
  );
  return walls.map((w) =>
    w.chainId === chainId ? { ...w, joinStyle: style, joinRadiusIn: clamped } : w
  );
}

/**
 * The openings that survive a trim, moved back along the shortened wall.
 *
 * A door half swallowed by a corner is not a door, so it is dropped rather than squeezed. It
 * comes back the moment the corner is squared off again, because the drawn wall never lost it.
 */
function trimOpenings(
  openings: CustomWallOpening[],
  trimStartIn: number,
  newLenIn: number
): CustomWallOpening[] {
  const kept: CustomWallOpening[] = [];
  for (const o of openings) {
    const offsetIn = o.offsetIn - trimStartIn;
    if (offsetIn < 0 || offsetIn + o.widthIn > newLenIn) continue;
    kept.push({ ...o, offsetIn: Math.round(offsetIn) });
  }
  return kept;
}

/** The piece that stands in the corner itself: an arc for a round joint, a flat for a chamfer. */
function cornerWall(
  a: CustomDrawnWall,
  b: CustomDrawnWall,
  jointIndex: number,
  t1x: number,
  t1y: number,
  t2x: number,
  t2y: number,
  cornerX: number,
  cornerY: number,
  style: WallJoinStyle,
  radiusIn: number,
  halfAngle: number
): CustomDrawnWall {
  let curveBulgeIn = 0;
  if (style === "round") {
    // How far the arc stands off the chord between the two tangent points. The arc subtends
    // pi - theta, so its half-chord is r*cos(theta/2) and its rise is r*(1 - sin(theta/2)).
    const sagitta = radiusIn * (1 - Math.sin(halfAngle));
    // getCurvedWallArcPoints bows along the left normal of start -> end. Pick the sign that puts
    // the apex on the same side as the corner the arc is replacing, or it bulges into the room.
    const dx = t2x - t1x;
    const dy = t2y - t1y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const midX = (t1x + t2x) / 2;
    const midY = (t1y + t2y) / 2;
    const towardCorner = (cornerX - midX) * nx + (cornerY - midY) * ny;
    curveBulgeIn = towardCorner >= 0 ? sagitta : -sagitta;
  }

  const corner: CustomDrawnWall = {
    ...a,
    id: `${a.chainId}~corner${jointIndex}`,
    startXIn: Math.round(t1x),
    startYIn: Math.round(t1y),
    endXIn: Math.round(t2x),
    endYIn: Math.round(t2y),
    thicknessIn: Math.max(a.thicknessIn, b.thicknessIn),
    openings: [],
    isCurved: style === "round",
    curveBulgeIn,
  };
  // Derived geometry, not one of the user's walls. It keeps `chainId` so the views can tell which
  // run it belongs to and light it up with the rest, but loses the rest: it is not a link in the
  // chain, has no place in the order, and its own corners are not shaped again.
  delete corner.chainIndex;
  delete corner.joinStyle;
  delete corner.joinRadiusIn;
  return corner;
}

function buildChain(list: CustomDrawnWall[]): CustomDrawnWall[] {
  const n = list.length;
  const trimStart = new Array<number>(n).fill(0);
  const trimEnd = new Array<number>(n).fill(0);
  const corners: CustomDrawnWall[] = [];

  for (let i = 0; i < n - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    const style = a.joinStyle ?? "miter";
    if (style === "miter") continue;
    // A bowed wall arrives at the joint on a tangent this does not follow, so its corner is left
    // square rather than drawn in the wrong place.
    if (isBowed(a) || isBowed(b)) continue;
    // Deleting a link out of the middle of a run, or dragging one away, leaves two walls that are
    // still in the same chain and no longer meet. The corner is measured off one shared point, so
    // without one there is no corner: leave the gap visible rather than bridge it with an arc
    // hanging in mid air.
    if (!near(a.endXIn, a.endYIn, b.startXIn, b.startYIn)) continue;

    const aLen = lengthIn(a);
    const bLen = lengthIn(b);
    if (aLen < 1 || bLen < 1) continue;

    // Unit vectors pointing away from the shared corner, back down each wall.
    const cornerX = a.endXIn;
    const cornerY = a.endYIn;
    const ux = (a.startXIn - cornerX) / aLen;
    const uy = (a.startYIn - cornerY) / aLen;
    const vx = (b.endXIn - cornerX) / bLen;
    const vy = (b.endYIn - cornerY) / bLen;

    const theta = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const deg = (theta * 180) / Math.PI;
    if (deg < MIN_CORNER_DEG || deg > MAX_CORNER_DEG) continue;

    // The tangent point sits r/tan(theta/2) back from the corner. Cap that distance against the
    // walls first and read the radius back out of it, so a big radius on a short wall shrinks to
    // what the walls can give instead of eating them.
    const halfAngle = theta / 2;
    const requested = a.joinRadiusIn ?? DEFAULT_JOIN_RADIUS_IN;
    const trim = Math.min(
      requested / Math.tan(halfAngle),
      Math.min(aLen, bLen) * MAX_TRIM_FRACTION
    );
    if (trim < 1) continue;

    trimEnd[i] = trim;
    trimStart[i + 1] = trim;
    corners.push(
      cornerWall(
        a,
        b,
        i,
        cornerX + ux * trim,
        cornerY + uy * trim,
        cornerX + vx * trim,
        cornerY + vy * trim,
        cornerX,
        cornerY,
        style,
        trim * Math.tan(halfAngle),
        halfAngle
      )
    );
  }

  const built: CustomDrawnWall[] = [];
  for (let i = 0; i < n; i++) {
    const w = list[i];
    if (trimStart[i] <= 0 && trimEnd[i] <= 0) {
      built.push(w);
      continue;
    }
    const len = lengthIn(w);
    const newLen = len - trimStart[i] - trimEnd[i];
    // Both joints ate the whole wall. The corner pieces either side already cover the ground.
    if (newLen < 1) continue;
    const dx = (w.endXIn - w.startXIn) / len;
    const dy = (w.endYIn - w.startYIn) / len;
    built.push({
      ...w,
      startXIn: Math.round(w.startXIn + dx * trimStart[i]),
      startYIn: Math.round(w.startYIn + dy * trimStart[i]),
      endXIn: Math.round(w.endXIn - dx * trimEnd[i]),
      endYIn: Math.round(w.endYIn - dy * trimEnd[i]),
      openings: trimOpenings(w.openings || [], trimStart[i], newLen),
    });
  }

  return [...built, ...corners];
}

/**
 * The walls as built rather than as drawn: chains resolved into trimmed walls plus their corner
 * pieces, everything else passed straight through.
 *
 * Both the 3D scene and the 2D blueprint draw from this, so a corner cannot come out round in one
 * view and square in the other.
 */
export function resolveChainWalls(walls: CustomDrawnWall[]): CustomDrawnWall[] {
  if (!walls.some((w) => w.chainId)) return walls;

  const out: CustomDrawnWall[] = [];
  const chains = new Map<string, CustomDrawnWall[]>();
  for (const w of walls) {
    if (!w.chainId) {
      out.push(w);
      continue;
    }
    const list = chains.get(w.chainId);
    if (list) list.push(w);
    else chains.set(w.chainId, [w]);
  }
  for (const list of chains.values()) {
    list.sort((a, b) => (a.chainIndex ?? 0) - (b.chainIndex ?? 0));
    out.push(...buildChain(list));
  }
  return out;
}
