// The face of a wall, and the holes in it, as 2D outlines.
//
// A wall used to be a box, and a hole in one was made by leaving boxes around it — a pier either
// side, a sill under, a lintel over. That is exactly right for a rectangle and cannot express
// anything else: a box has no rounded corner and no arched head.
//
// So a shaped wall is drawn instead as its elevation — one closed outline in the wall's own face
// coordinates, with a closed path per hole — and extruded through its thickness. The outline is
// what changes when the wall gets an arched top; the holes are what change when a cutout gets a
// radius. One mechanism covers both, which is why they arrived together.
//
// Face coordinates: x runs along the wall from the start of its run, y is up from finished floor.
// Both in feet. `wallFaceGeometry` re-centres on x so the mesh can be positioned by the wall's
// midpoint, exactly like the BoxGeometry it replaces.
//
// A plain wall is still a box. This path costs a triangulation and loses the geometry parameters
// that the paint bands read, so it is only taken when the wall actually needs a shape.

import * as THREE from "three";

export type CutoutShape = "rect" | "rounded" | "arch" | "circle";
export type WallProfile = "square" | "arched" | "rounded";

export const CUTOUT_SHAPES: { id: CutoutShape; name: string; description: string }[] = [
  { id: "rect", name: "Square", description: "Plain rectangular opening with sharp corners." },
  {
    id: "rounded",
    name: "Rounded",
    description: "Rectangular opening with the corners taken off — a soft-edged pass-through.",
  },
  {
    id: "arch",
    name: "Arch",
    description: "Square jambs with a semicircular head, the width of the opening.",
  },
  { id: "circle", name: "Circle", description: "An oculus. Width and height give its two axes." },
];

export const WALL_PROFILES: { id: WallProfile; name: string; description: string }[] = [
  { id: "square", name: "Square", description: "A flat top. The wall meets the slab across its whole run." },
  {
    id: "arched",
    name: "Arched",
    description: "The top of the wall springs into an arch. Leaves the storey open above the springing line.",
  },
  {
    id: "rounded",
    name: "Rounded",
    description: "The two top corners are taken off. The wall keeps its height in the middle.",
  },
];

/** Corner radius as a fraction of the opening's smaller side. */
const ROUNDED_CUTOUT_FRACTION = 0.22;
/** Corner radius on a rounded wall top, as a fraction of the wall's smaller side. */
const ROUNDED_WALL_FRACTION = 0.18;
/** How far an arched wall top rises, as a fraction of its height. Capped by half its run. */
const WALL_ARCH_RISE_FRACTION = 0.35;

/**
 * One hole, centred on (cx, cy), `w` wide and `h` tall. Returned closed, so it can go straight
 * into a Shape's `holes`.
 */
export function cutoutPath(
  shape: CutoutShape,
  cx: number,
  cy: number,
  w: number,
  h: number
): THREE.Path {
  const path = new THREE.Path();
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;

  if (shape === "circle") {
    path.absellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 2, false, 0);
    return path;
  }

  if (shape === "arch") {
    // The head is a semicircle the width of the opening, so the jambs are only as tall as what
    // is left. A hole shorter than its own half-width is all head and no jamb.
    const rise = Math.min(w / 2, h);
    const springLine = y1 - rise;
    path.moveTo(x0, y0);
    path.lineTo(x1, y0);
    path.lineTo(x1, springLine);
    // Quadratic apex sits half way to the control point, so the control goes at twice the rise.
    path.quadraticCurveTo(cx, springLine + 2 * rise, x0, springLine);
    path.lineTo(x0, y0);
    path.closePath();
    return path;
  }

  if (shape === "rounded") {
    const r = Math.min(w, h) * ROUNDED_CUTOUT_FRACTION;
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0);
    path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r);
    path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1);
    path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r);
    path.quadraticCurveTo(x0, y0, x0 + r, y0);
    path.closePath();
    return path;
  }

  path.moveTo(x0, y0);
  path.lineTo(x1, y0);
  path.lineTo(x1, y1);
  path.lineTo(x0, y1);
  path.closePath();
  return path;
}

/** The wall's own outline, from (0, 0) at the start of the run to (length, height). */
export function wallFaceShape(profile: WallProfile, length: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();

  if (profile === "arched") {
    const rise = Math.min(length / 2, height * WALL_ARCH_RISE_FRACTION);
    const springLine = height - rise;
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, springLine);
    shape.quadraticCurveTo(length / 2, springLine + 2 * rise, 0, springLine);
    shape.lineTo(0, 0);
    shape.closePath();
    return shape;
  }

  if (profile === "rounded") {
    const r = Math.min(length, height) * ROUNDED_WALL_FRACTION;
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height - r);
    shape.quadraticCurveTo(length, height, length - r, height);
    shape.lineTo(r, height);
    shape.quadraticCurveTo(0, height, 0, height - r);
    shape.lineTo(0, 0);
    shape.closePath();
    return shape;
  }

  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.lineTo(0, height);
  shape.closePath();
  return shape;
}

/**
 * Height of the wall's top edge above the floor at `x` along its run.
 *
 * Exact rather than sampled, because it is what decides whether a hole fits: a hole that pokes
 * out through the outline is not a hole, it is an open shape, and the triangulator answers with
 * a torn mesh rather than an error.
 */
export function topBoundaryY(
  profile: WallProfile,
  length: number,
  height: number,
  x: number
): number {
  if (profile === "arched") {
    const rise = Math.min(length / 2, height * WALL_ARCH_RISE_FRACTION);
    const springLine = height - rise;
    // The quadratic used in wallFaceShape reduces to x = length * (1 - t), which gives this.
    const u = Math.max(0, Math.min(1, x / length));
    return springLine + 4 * rise * u * (1 - u);
  }

  if (profile === "rounded") {
    const r = Math.min(length, height) * ROUNDED_WALL_FRACTION;
    // Each corner is a quadratic where x = corner -/+ t^2 * r and y = height - (1 - t)^2 * r.
    const inset = x < r ? x : x > length - r ? length - x : r;
    if (inset >= r) return height;
    const t = Math.sqrt(Math.max(0, inset / r));
    return height - (1 - t) * (1 - t) * r;
  }

  return height;
}

export interface FaceHole {
  shape: CutoutShape;
  /** Centre in face coordinates: along the run from its start, and up from the floor. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * The wall as a solid, centred on all three axes so it drops in exactly where the BoxGeometry it
 * replaces would have gone — positioned by the wall's midpoint at half its height. Local axes:
 * x along the run, y up, z through the thickness.
 */
export function wallFaceGeometry(
  profile: WallProfile,
  length: number,
  height: number,
  thickness: number,
  holes: FaceHole[]
): THREE.BufferGeometry {
  const shape = wallFaceShape(profile, length, height);
  for (const hole of fitHoles(profile, length, height, holes)) {
    shape.holes.push(cutoutPath(hole.shape, hole.cx, hole.cy, hole.w, hole.h));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 16,
  });
  geometry.translate(-length / 2, -height / 2, -thickness / 2);
  return geometry;
}

/** Masonry left between a hole and the edge of the wall. Below this they touch and tear. */
const HOLE_MARGIN_FT = 0.08;

/** The smallest hole still worth cutting once it has been trimmed to fit. */
const MIN_HOLE_FT = 0.15;

/**
 * The holes that actually fit in this wall, trimmed to its outline.
 *
 * Nothing upstream can be trusted to have done this. A cutout on a solver wall is clamped
 * against a *rectangle* by `resolveCutouts`, which says nothing about an arched top; an opening
 * on a drawn wall is whatever the 2D inspector or the wall panel last wrote, and could be taller
 * than the wall it is in. Either way the result was a hole crossing its own outline, and what
 * came back was not a wall with a big hole in it — it was a torn silhouette that looked like the
 * wall had grown on one side.
 */
export function fitHoles(
  profile: WallProfile,
  length: number,
  height: number,
  holes: FaceHole[]
): FaceHole[] {
  const fitted: FaceHole[] = [];

  for (const hole of holes) {
    const x0 = Math.max(HOLE_MARGIN_FT, hole.cx - hole.w / 2);
    const x1 = Math.min(length - HOLE_MARGIN_FT, hole.cx + hole.w / 2);
    let y0 = Math.max(HOLE_MARGIN_FT, hole.cy - hole.h / 2);
    let y1 = Math.min(height - HOLE_MARGIN_FT, hole.cy + hole.h / 2);
    if (x1 - x0 < MIN_HOLE_FT) continue;

    // The top edge is only flat on a square wall. Take the lowest point of it over the span the
    // hole occupies, so an arch or a rounded corner keeps its masonry.
    let ceiling = Infinity;
    for (let k = 0; k <= 8; k++) {
      ceiling = Math.min(ceiling, topBoundaryY(profile, length, height, x0 + ((x1 - x0) * k) / 8));
    }
    y1 = Math.min(y1, ceiling - HOLE_MARGIN_FT);
    y0 = Math.min(y0, y1);
    if (y1 - y0 < MIN_HOLE_FT) continue;

    fitted.push({
      shape: hole.shape,
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2,
      w: x1 - x0,
      h: y1 - y0,
    });
  }

  return fitted;
}

/** True when the wall cannot be drawn as a box and has to go through the shaped path. */
export function needsShapedWall(
  profile: WallProfile | undefined,
  holes: { shape?: CutoutShape }[]
): boolean {
  if (profile && profile !== "square") return true;
  return holes.some((h) => h.shape != null && h.shape !== "rect");
}
