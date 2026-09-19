// What the 3D scene knows about the furniture standing in it, as data.
//
// The automatic fit-out in `interiorDetails.ts` writes meshes, not records, so this is the only
// description of it anything outside the renderer can read. `Scene.tsx` measures each built-in
// group and emits a list of these through `onFurnitureInventory`; the FF&E schedule counts them,
// the elevations draw them and the clearance audit measures the gaps between them.
//
// Deliberately free of `three` and of the furniture catalog, so all three of those consumers can
// be exercised without a renderer.

import { SolvedRoom } from "./solve";
import { inchesToFeet } from "./units";

/** A world-space axis-aligned box in feet. Y is up, +X east, +Z south — the scene's convention. */
export interface FurnitureBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface BuiltinFurnitureRecord {
  id: string;
  name: string;
  type: string;
  roomIndex: number;
  box: FurnitureBox;
  /**
   * Hung from the ceiling — a fan, a pendant, a flush fixture. The reflected ceiling plan draws
   * only these; the clearance audit ignores them, because nothing you cannot walk into is a
   * passage.
   */
  ceiling?: boolean;
}

/**
 * Nothing whose underside is above this is an obstacle on the floor. Without it a chandelier
 * reports a failing gap to every wall it hangs near.
 */
export const FLOOR_OBSTACLE_MAX_Y_FT = 4.0;

export const boxWidth = (b: FurnitureBox): number => b.maxX - b.minX;
export const boxDepth = (b: FurnitureBox): number => b.maxZ - b.minZ;
export const boxHeight = (b: FurnitureBox): number => b.maxY - b.minY;
export const boxCentreX = (b: FurnitureBox): number => (b.minX + b.maxX) / 2;
export const boxCentreZ = (b: FurnitureBox): number => (b.minZ + b.maxZ) / 2;

/** A room's footprint in world feet. Rooms are stored in plot inches; the scene draws in feet. */
export interface RoomRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function roomRect(room: SolvedRoom): RoomRect {
  return {
    x: inchesToFeet(room.x_in),
    z: inchesToFeet(room.y_in),
    w: inchesToFeet(room.w_in),
    d: inchesToFeet(room.d_in),
  };
}

/** How far two spans overlap on one axis. Zero or less means they do not face each other. */
export function overlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}
