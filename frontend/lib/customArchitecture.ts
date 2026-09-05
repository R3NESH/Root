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
  | "tag_room";

export type CustomWallType =
  | "exterior"
  | "interior"
  | "glass"
  | "slat"
  | "arch"
  | "curved"
  | "curved_glass"
  | "curved_slat";

export type CustomFloorMaterial =
  | "marble"
  | "wood"
  | "tile"
  | "granite"
  | "paver"
  | "concrete";

export interface CustomWallOpening {
  id: string;
  kind: "door" | "entrance" | "window" | "opening" | "french_door" | "sliding_door" | "arch_door" | "curved_window" | "revolving_door";
  offsetIn: number; // Distance in inches from wall start along chord or arc
  widthIn: number;  // Width in inches (e.g. 36" for standard door, 48" for window, 60" for bow window)
  heightIn: number; // Height in inches (e.g. 84" for door, 48" for window)
  sillIn?: number;  // Height above finished floor (e.g. 32" for windows)
}

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
  isCurved?: boolean;  // whether the wall follows a circular/quadratic arc
  curveBulgeIn?: number; // arc midpoint offset in inches (e.g. +24" or -24")
  openings: CustomWallOpening[];
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

export const FLOOR_LEVEL_CONFIGS: FloorLevelDef[] = [
  { floor: 0, label: "Ground Floor", short: "G", icon: "L0", heightOffsetFt: 0 },
  { floor: 1, label: "First Floor", short: "1F", icon: "L1", heightOffsetFt: 10 },
  { floor: 2, label: "Second Floor", short: "2F", icon: "L2", heightOffsetFt: 20 },
  { floor: 3, label: "Terrace / Roof", short: "Roof", icon: "SUN", heightOffsetFt: 30 },
];

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

export const FLOOR_MATERIAL_CONFIGS: Record<
  CustomFloorMaterial,
  { name: string; icon: string; colorHex: number; roughness: number }
> = {
  marble: { name: "Italian Marble", icon: "CLS", colorHex: 0xf8fafc, roughness: 0.15 },
  wood: { name: "Hardwood Timber", icon: "WD", colorHex: 0xb45309, roughness: 0.45 },
  tile: { name: "Vitrified Tiles", icon: "PNL", colorHex: 0xe2e8f0, roughness: 0.3 },
  granite: { name: "Polished Granite", icon: "BLK", colorHex: 0x334155, roughness: 0.2 },
  paver: { name: "Outdoor Stone Paver", icon: "WAL", colorHex: 0x94a3b8, roughness: 0.8 },
  concrete: { name: "Polished Concrete", icon: "BLD", colorHex: 0x64748b, roughness: 0.5 },
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
 * Calculates wall angle in radians
 */
export function getWallAngleRad(wall: CustomDrawnWall): number {
  return Math.atan2(wall.endYIn - wall.startYIn, wall.endXIn - wall.startXIn);
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
