// Custom Architecture Data Models for "Build From Scratch" Freeform CAD Studio
import { RoomName } from "./rooms";

// The drafting tool the CAD ribbon has armed. Declared here rather than inline because the
// same union was written out verbatim in page.tsx, Scene.tsx, Blueprint2DView.tsx and
// TopRibbonTaskbar.tsx — four copies that had to be edited together to add a tool.
export type CadTool =
  | "select"
  | "draw_wall"
  | "place_door"
  | "place_window"
  | "tag_room"
  | "draw_stair";

export type CustomWallType =
  | "exterior"
  | "interior"
  | "glass"
  | "slat"
  | "arch"
  | "curved"
  | "curved_glass"
  | "curved_slat";

/** How one wall of a combined run meets the next. See lib/wallJoins.ts. */
export type WallJoinStyle = "miter" | "round" | "chamfer";

/**
 * A picked wall, in the blueprint and in 3D. One colour in one place so a wall cannot read as
 * selected in one view and not the other. Brighter than every wall colour below, which are all
 * muted, so it stays legible on glass and on curved walls as well as on plain masonry.
 */
export const SELECTED_WALL_STROKE = "#38bdf8";
export const SELECTED_WALL_COLOR_HEX = 0x38bdf8;

export type CustomFloorMaterial =
  | "marble"
  | "wood"
  | "tile"
  | "granite"
  | "paver"
  | "concrete";

import { CutoutShape, WallProfile } from "./wallShapes";

export interface CustomWallOpening {
  id: string;
  kind: "door" | "entrance" | "window" | "opening" | "french_door" | "sliding_door" | "arch_door" | "curved_window" | "revolving_door";
  offsetIn: number; // Distance in inches from wall start along chord or arc
  widthIn: number;  // Width in inches (e.g. 36" for standard door, 48" for window, 60" for bow window)
  heightIn: number; // Height in inches (e.g. 84" for door, 48" for window)
  sillIn?: number;  // Height above finished floor (e.g. 32" for windows)
  /** Outline of the opening. Only read for `kind: "opening"` — a door leaf has its own shape. */
  shape?: CutoutShape;
}

/**
 * A staircase drawn as the line a person walks up, bottom to top.
 *
 * Points, not a footprint. A stair is the one object whose size is not the designer's to choose:
 * NBC fixes the riser and the going, so what a bigger or smaller opening changes is the number of
 * steps and how they fold, never their size. Storing the walk line and solving it on read is what
 * makes that true — see lib/stairPath.ts, and the note in lib/stairCatalog.ts on why the six
 * fixed-footprint shapes could not.
 *
 * Inches, and `yIn` is the plan's second axis, matching CustomDrawnWall.
 */
export interface DrawnStair {
  id: string;
  /** Storey the climb starts from. It arrives at `floor + 1`. */
  floor: number;
  /** Walk line, bottom of the climb first. At least two points. */
  pointsIn: Array<{ xIn: number; yIn: number }>;
  widthIn: number;
  colorHex?: number;
}

/** 3'6" — over the 3 ft code minimum, and what a comfortable Indian house stair is built at. */
export const DEFAULT_STAIR_WIDTH_IN = 42;

export interface CustomDrawnWall {
  id: string;
  floor?: number;   // 0 = Ground, 1 = 1st Floor, 2 = 2nd Floor, 3 = Roof
  startXIn: number;
  startYIn: number;
  endXIn: number;
  endYIn: number;
  wallType: CustomWallType;
  thicknessIn: number; // 9" for exterior, 4.5" for interior, 3" for partition
  heightFt?: number;   // default 9.0 ft
  /** Elevation outline. Absent means a flat top — see lib/wallShapes.ts. */
  profile?: WallProfile;
  isCurved?: boolean;  // whether the wall follows a circular/quadratic arc
  curveBulgeIn?: number; // arc midpoint offset in inches (e.g. +24" or -24")
  openings: CustomWallOpening[];
  /**
   * Walls sharing a `chainId` are one combined run, drawn head to tail in `chainIndex` order,
   * and `joinStyle` shapes every corner in it. The run lives on its walls rather than beside
   * them so it saves, loads and undoes with them. Resolved in lib/wallJoins.ts.
   */
  chainId?: string;
  chainIndex?: number;
  joinStyle?: WallJoinStyle;
  joinRadiusIn?: number;
}

export interface CustomFloorSlab {
  id: string;
  floor: number;
  material: CustomFloorMaterial;
  xIn: number;
  yIn: number;
  wIn: number;
  dIn: number;
  customLabel?: string;
}

export interface CustomRoomZone {
  id: string;
  floor?: number;   // 0 = Ground, 1 = 1st Floor, 2 = 2nd Floor
  name: RoomName;
  customLabel?: string;
  xIn: number;
  yIn: number;
  wIn: number;
  dIn: number;
  areaSqFt: number;
  colorHex?: number;
}

export interface FloorLevelDef {
  floor: number;
  label: string;
  short: string;
  icon: string;
  heightOffsetFt: number;
}

export const WALL_TYPE_CONFIGS: Record<
  CustomWallType,
  { name: string; icon: string; thicknessIn: number; colorHex: number; defaultHeightFt: number }
> = {
  exterior: {
    name: "Exterior Wall (9\")",
    icon: "WAL",
    thicknessIn: 9.0,
    colorHex: 0x334155,
    defaultHeightFt: 9.0,
  },
  interior: {
    name: "Interior Wall (4.5\")",
    icon: "WAL",
    thicknessIn: 4.5,
    colorHex: 0x475569,
    defaultHeightFt: 9.0,
  },
  glass: {
    name: "Glass Grid Partition",
    icon: "WIN",
    thicknessIn: 3.0,
    colorHex: 0x0284c7,
    defaultHeightFt: 9.0,
  },
  slat: {
    name: "Acoustic Wood Slat",
    icon: "WD",
    thicknessIn: 3.5,
    colorHex: 0xd97706,
    defaultHeightFt: 9.0,
  },
  arch: {
    name: "Arched Opening Divider",
    icon: "CLS",
    thicknessIn: 6.0,
    colorHex: 0x64748b,
    defaultHeightFt: 9.0,
  },
  curved: {
    name: "Curved Feature Wall (9\")",
    icon: "CRV",
    thicknessIn: 9.0,
    colorHex: 0x38bdf8,
    defaultHeightFt: 9.0,
  },
  curved_glass: {
    name: "Curved Panoramic Glass Wall",
    icon: "WIN",
    thicknessIn: 3.0,
    colorHex: 0x0284c7,
    defaultHeightFt: 9.0,
  },
  curved_slat: {
    name: "Curved Fluted Wood Slat Wall",
    icon: "WD",
    thicknessIn: 3.5,
    colorHex: 0xd97706,
    defaultHeightFt: 9.0,
  },
};

/**
 * Calculates wall chord length in inches
 */
export function getWallLengthIn(wall: CustomDrawnWall): number {
  const chord = Math.hypot(wall.endXIn - wall.startXIn, wall.endYIn - wall.startYIn);
  if ((wall.isCurved || wall.wallType.startsWith("curved")) && wall.curveBulgeIn) {
    const h = Math.abs(wall.curveBulgeIn);
    // Approximation for arc length: L ≈ chord + (8/3)*(h^2 / chord)
    return chord + (8 / 3) * (h * h / Math.max(1, chord));
  }
  return chord;
}

/**
 * Computes sampled points along a curved wall arc in inches
 */
export function getCurvedWallArcPoints(
  wall: CustomDrawnWall,
  numSegments = 16
): { x: number; y: number; angle: number }[] {
  const x1 = wall.startXIn;
  const y1 = wall.startYIn;
  const x2 = wall.endXIn;
  const y2 = wall.endYIn;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 1) return [{ x: x1, y: y1, angle: 0 }, { x: x2, y: y2, angle: 0 }];

  const bulge = wall.curveBulgeIn !== undefined ? wall.curveBulgeIn : 24.0;
  // Perpendicular unit vector (normal)
  const nx = -dy / chordLen;
  const ny = dx / chordLen;

  // Quadratic control point
  const ctrlX = (x1 + x2) / 2 + nx * (bulge * 2);
  const ctrlY = (y1 + y2) / 2 + ny * (bulge * 2);

  const points: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const invT = 1 - t;
    // Quadratic Bezier B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
    const px = invT * invT * x1 + 2 * invT * t * ctrlX + t * t * x2;
    const py = invT * invT * y1 + 2 * invT * t * ctrlY + t * t * y2;

    // Derivative B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
    const dpx = 2 * invT * (ctrlX - x1) + 2 * t * (x2 - ctrlX);
    const dpy = 2 * invT * (ctrlY - y1) + 2 * t * (y2 - ctrlY);
    const angle = Math.atan2(dpy, dpx);

    points.push({ x: px, y: py, angle });
  }

  return points;
}

/**
 * A unique id for a thing the user just placed — a wall, an opening, a stair, an object.
 *
 * This expression was written out at fifteen call sites across `Scene.tsx`,
 * `Blueprint2DView.tsx`, `page.tsx`, `wallJoins.ts` and the AI furniture studio, in three
 * different spellings (`substring(2, 6)`, `substring(2, 7)`, `slice(2, 7)`). One copy.
 *
 * Not `crypto.randomUUID()`: these ids are read in saved-project JSON and in the wall inspector,
 * and `wall_m2x9f1_k3p` says what it is where `f47ac10b-58cc-…` does not. Collision risk is a
 * millisecond timestamp plus 5 random base-36 characters, for ids that live in one local
 * document — see `projectStorage.ts`.
 */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
