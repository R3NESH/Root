// Planting and paving on the setback strip.
//
// The plot renders as one flat green rectangle with the house sitting on it. In a real
// presentation drawing the land between the boundary and the building is the half of the image
// that tells you it is a home rather than a massing study: a planting bed against the wall, a
// driveway to the entrance, shrubs breaking the outline. None of that is decoration for its own
// sake — a plot with a hard, empty green margin reads as a diagram no matter how good the house
// on it looks.
//
// Everything here derives from the plot and the setback the solver already respected, so the
// landscape can never encroach on the building envelope.

import * as THREE from "three";

export type CardinalEdge = "N" | "S" | "E" | "W";

/** Below this there is no usable setback and the plot is left bare. */
const MIN_SETBACK_FT = 1.6;
const DRIVEWAY_WIDTH_FT = 16;

export interface SiteLandscapeArgs {
  /** Plot size in feet. The plot occupies x: 0..widthFt, z: 0..depthFt. */
  widthFt: number;
  depthFt: number;
  /** The building envelope the rooms sit inside, in the same feet. */
  envMinX: number;
  envMaxX: number;
  envMinZ: number;
  envMaxZ: number;
  /** Which boundary the house fronts. The driveway crosses the planting here. */
  entranceEdge: CardinalEdge;
  /**
   * The plot outline in feet, when it is not a rectangle — a splayed corner plot, a trapezoid on
   * a bend. Omitted means the rectangle `widthFt` x `depthFt`, which is what every plot was
   * before lib/plot.ts could describe anything else.
   */
  outlineFt?: Array<[number, number]>;
}

/** The outline the plot actually has: the one supplied, or the rectangle. */
function outlineOf(a: SiteLandscapeArgs): Array<[number, number]> {
  if (a.outlineFt && a.outlineFt.length >= 3) return a.outlineFt;
  return [
    [0, 0],
    [a.widthFt, 0],
    [a.widthFt, a.depthFt],
    [0, a.depthFt],
  ];
}

/**
 * The outline pulled `inset` feet toward its own centroid.
 *
 * A true inward offset of a polygon is a mitre-and-trim job. This is the cheap version, and for
 * a convex plot with a bed a few feet wide the difference is smaller than one shrub. It is a
 * planting bed, not a boundary line — the outline itself is drawn from the real polygon.
 */
function pulledIn(outline: Array<[number, number]>, inset: number): Array<[number, number]> {
  const cx = outline.reduce((t, p) => t + p[0], 0) / outline.length;
  const cz = outline.reduce((t, p) => t + p[1], 0) / outline.length;
  return outline.map(([x, z]) => {
    const dx = cx - x;
    const dz = cz - z;
    const len = Math.hypot(dx, dz) || 1;
    const t = Math.min(inset / len, 0.45);
    return [x + dx * t, z + dz * t] as [number, number];
  });
}

interface Spot {
  x: number;
  z: number;
}

/**
 * Walks the centreline of the planting bed and returns positions for shrubs, leaving the
 * driveway crossing clear.
 */
function bedSpots(
  a: SiteLandscapeArgs,
  bed: number,
  driveMin: number,
  driveMax: number,
  spacing: number
): Spot[] {
  const { widthFt: w, depthFt: d, entranceEdge } = a;
  const mid = bed / 2;
  const out: Spot[] = [];

  // A deterministic jitter: the same plot must landscape the same way every rebuild, or the
  // planting crawls every time the user nudges a room.
  let seed = Math.round(w * 31 + d * 17);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // The bed centreline, one run per outline edge. On a rectangle these are the same four runs
  // this always walked; on a splayed plot the extra run is the splay itself.
  const centre = pulledIn(outlineOf(a), mid);
  const runs: Array<{ from: Spot; to: Spot; edge: CardinalEdge }> = centre.map((p, i) => {
    const q = centre[(i + 1) % centre.length];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    // Which boundary this run belongs to, from the direction it faces outward. Only the
    // entrance edge matters, and only so the driveway crossing stays clear of planting.
    const edge: CardinalEdge =
      Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? "N" : "S") : dz > 0 ? "E" : "W";
    return { from: { x: p[0], z: p[1] }, to: { x: q[0], z: q[1] }, edge };
  });

  for (const run of runs) {
    const dx = run.to.x - run.from.x;
    const dz = run.to.z - run.from.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.floor(len / spacing);
    if (steps < 1) continue;

    for (let i = 0; i <= steps; i++) {
      const t = (i + (rand() - 0.5) * 0.55) / steps;
      if (t < 0 || t > 1) continue;
      const x = run.from.x + dx * t;
      const z = run.from.z + dz * t;

      if (run.edge === entranceEdge) {
        const along = entranceEdge === "N" || entranceEdge === "S" ? x : z;
        if (along > driveMin - 1.2 && along < driveMax + 1.2) continue;
      }

      out.push({
        x: x + (rand() - 0.5) * bed * 0.35,
        z: z + (rand() - 0.5) * bed * 0.35,
      });
    }
  }

  return out;
}

/**
 * Adds the planting bed, its shrubs and the driveway to `group`, in plot-local feet. Returns
 * false when the setback is too tight to landscape, in which case nothing was added.
 */
export function addSiteLandscape(group: THREE.Group, a: SiteLandscapeArgs): boolean {
  const { widthFt: w, depthFt: d } = a;

  const setbacks = [a.envMinX, w - a.envMaxX, a.envMinZ, d - a.envMaxZ];
  const tightest = Math.min(...setbacks);
  if (!Number.isFinite(tightest) || tightest < MIN_SETBACK_FT) return false;

  // The bed takes a little over half the tightest setback, so a path is always left between the
  // planting and the wall.
  const bed = Math.max(1.0, Math.min(4.0, tightest * 0.55));

  // Driveway, centred on the entrance edge and never wider than the plot allows.
  const entranceRun = a.entranceEdge === "N" || a.entranceEdge === "S" ? w : d;
  const driveW = Math.min(DRIVEWAY_WIDTH_FT, entranceRun * 0.42);
  const driveMin = (entranceRun - driveW) / 2;
  const driveMax = driveMin + driveW;

  // 1. Planting bed: the plot outline with the inner lawn cut out of it.
  const outline = outlineOf(a);
  const inner = pulledIn(outline, bed);
  // Built in (x, -z): the -90 degree rotation below sends the shape's y to -z, so negating here
  // is what puts the bed back on the plot. A rectangle survives the mirror unchanged and used to
  // hide this; a splayed plot does not.
  const outer = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  // The hole runs the other way round the ring, which is what Shape wants of a hole.
  outer.holes.push(new THREE.Path([...inner].reverse().map(([x, z]) => new THREE.Vector2(x, -z))));

  const bedMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(outer),
    new THREE.MeshStandardMaterial({ color: 0x3f3226, roughness: 0.96, metalness: 0 })
  );
  bedMesh.rotation.x = -Math.PI / 2;
  // Above the plot slab at y = 0, below the building floors at y = 0.04.
  bedMesh.position.y = 0.012;
  bedMesh.receiveShadow = true;
  bedMesh.userData = { isSiteLandscape: true };
  group.add(bedMesh);

  // 2. Driveway, from the boundary in to the building envelope.
  const driveDepth =
    a.entranceEdge === "N" ? a.envMinZ : a.entranceEdge === "S" ? d - a.envMaxZ : a.entranceEdge === "W" ? a.envMinX : w - a.envMaxX;

  if (driveDepth > 0.5) {
    const horizontal = a.entranceEdge === "N" || a.entranceEdge === "S";
    const drive = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? driveW : driveDepth, horizontal ? driveDepth : driveW),
      new THREE.MeshStandardMaterial({ color: 0xb9b3a7, roughness: 0.88, metalness: 0.02 })
    );
    drive.rotation.x = -Math.PI / 2;
    const centreAlong = driveMin + driveW / 2;
    if (a.entranceEdge === "N") drive.position.set(centreAlong, 0.02, driveDepth / 2);
    else if (a.entranceEdge === "S") drive.position.set(centreAlong, 0.02, d - driveDepth / 2);
    else if (a.entranceEdge === "W") drive.position.set(driveDepth / 2, 0.02, centreAlong);
    else drive.position.set(w - driveDepth / 2, 0.02, centreAlong);
    drive.receiveShadow = true;
    drive.userData = { isSiteLandscape: true };
    group.add(drive);
  }

  // 3. Shrubs along the bed. One InstancedMesh rather than a few hundred draw calls.
  const spots = bedSpots(a, bed, driveMin, driveMax, Math.max(1.6, bed * 0.9));
  if (spots.length === 0) return true;

  const shrubs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, flatShading: true }),
    spots.length
  );

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();

  let seed = spots.length * 7919;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  spots.forEach((s, i) => {
    const spread = bed * (0.30 + rand() * 0.26);
    const height = spread * (0.85 + rand() * 0.75);
    pos.set(s.x, height * 0.55, s.z);
    // Squashed to a dome and turned off-axis, so a row of them does not repeat.
    scl.set(spread, height * 0.62, spread * (0.85 + rand() * 0.3));
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, (rand() - 0.5) * 0.25));
    m.compose(pos, q, scl);
    shrubs.setMatrixAt(i, m);

    // Real planting is never one green. Vary hue and lightness a little per shrub.
    tint.setHSL(0.28 + (rand() - 0.5) * 0.05, 0.42 + rand() * 0.18, 0.18 + rand() * 0.11);
    shrubs.setColorAt(i, tint);
  });

  shrubs.instanceMatrix.needsUpdate = true;
  if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  shrubs.userData = { isSiteLandscape: true };
  group.add(shrubs);

  return true;
}
