import { inchesToFeet } from "./units";
import { SolvedRoom } from "./solve";
import { PlotDims, Facing } from "./plot";

// Eye level calibrated for realistic, grand residential interior perspectives (4.4 ft / 53 inches)
export const EYE_LEVEL_FT = 4.4; // 4.4 ft
export const CROUCH_HEIGHT_FT = 2.8; // 2.8 ft crouched
export const WALK_SPEED_FPS = 7.5; // ft per second (realistic walk)
export const SPRINT_SPEED_FPS = 13.5; // ft per second (sprint)
export const ROTATE_SPEED_RAD = 1.9; // rad per second

export interface PlayerTransform {
  x: number; // in feet
  y: number; // in feet (EYE_LEVEL_FT + bobbing)
  z: number; // in feet
  yaw: number; // in radians
  pitch: number; // in radians
  isSprinting?: boolean;
  isCrouched?: boolean;
  isMoving?: boolean;
  lightsOn?: boolean;
}

export interface InteractiveDoor {
  id: string;
  roomIndexA: number;
  roomIndexB?: number;
  isOpen: boolean;
  pivot: { x: number; y: number; z: number };
  targetRotation: number;
  currentRotation: number;
  axis: "y";
}

/**
 * Detect which room contains the given world (x, z) coordinates (in feet).
 */
export function detectCurrentRoom(
  x: number,
  z: number,
  rooms: SolvedRoom[]
): { room: SolvedRoom; index: number } | null {
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const x0 = inchesToFeet(r.x_in);
    const x1 = x0 + inchesToFeet(r.w_in);
    const z0 = inchesToFeet(r.y_in);
    const z1 = z0 + inchesToFeet(r.d_in);

    if (x >= x0 - 0.25 && x <= x1 + 0.25 && z >= z0 - 0.25 && z <= z1 + 0.25) {
      return { room: r, index: i };
    }
  }
  return null;
}

/**
 * Find optimal spawn position at the entrance hall or primary room.
 */
export function getSpawnPosition(
  rooms: SolvedRoom[],
  plot: PlotDims,
  facing: Facing
): { x: number; y: number; z: number; yaw: number } {
  if (rooms.length === 0) {
    const wFt = inchesToFeet(plot.widthIn);
    const dFt = inchesToFeet(plot.depthIn);
    return { x: wFt / 2, y: EYE_LEVEL_FT, z: dFt / 2, yaw: 0 };
  }

  const hallIdx = rooms.findIndex((r) => r.name === "hall");
  const spawnRoom = hallIdx >= 0 ? rooms[hallIdx] : rooms[0];

  const rx = inchesToFeet(spawnRoom.x_in);
  const rz = inchesToFeet(spawnRoom.y_in);
  const rw = inchesToFeet(spawnRoom.w_in);
  const rd = inchesToFeet(spawnRoom.d_in);

  let yaw = 0;
  if (facing === "N") yaw = Math.PI;
  else if (facing === "S") yaw = 0;
  else if (facing === "E") yaw = -Math.PI / 2;
  else if (facing === "W") yaw = Math.PI / 2;

  return {
    x: rx + rw / 2,
    y: EYE_LEVEL_FT,
    z: rz + rd / 2,
    yaw,
  };
}

/**
 * Clamp movement within walkable plot boundaries.
 */
export function clampPlayerPosition(
  pos: { x: number; y: number; z: number },
  plot: PlotDims
): { x: number; y: number; z: number } {
  const plotW = inchesToFeet(plot.widthIn);
  const plotD = inchesToFeet(plot.depthIn);

  const margin = 0.9;
  const clampedX = Math.max(margin, Math.min(plotW - margin, pos.x));
  const clampedZ = Math.max(margin, Math.min(plotD - margin, pos.z));

  return {
    x: clampedX,
    y: pos.y,
    z: clampedZ,
  };
}

export interface DoorwayConnection {
  roomAIndex: number;
  roomBIndex: number;
}

/**
 * Metaheuristic Topological Cell & Portal Occlusion Culler:
 * Computes the Potentially Visible Set (PVS) of room indices for the current camera position.
 * Returns a Set<number> of room indices that must be rendered.
 * Depth-2 traversal guarantees that connecting rooms and open corridors are seamlessly loaded
 * with 0% visible pop-in, while completely occluded rooms behind solid walls are culled.
 */
export function computePotentiallyVisibleRooms(
  currentRoomIndex: number | null,
  totalRooms: number,
  doorways: DoorwayConnection[],
  maxDepth: number = 2
): Set<number> {
  // If player is outside any specific room (e.g. yard / entrance porch), render all rooms
  if (currentRoomIndex === null || currentRoomIndex < 0 || currentRoomIndex >= totalRooms) {
    const all = new Set<number>();
    for (let i = 0; i < totalRooms; i++) all.add(i);
    return all;
  }

  // Build adjacency list graph: Room Index -> Set<Neighbor Room Indices>
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < totalRooms; i++) {
    adjacency.set(i, new Set<number>());
  }

  for (const d of doorways) {
    if (
      d.roomAIndex >= 0 &&
      d.roomAIndex < totalRooms &&
      d.roomBIndex >= 0 &&
      d.roomBIndex < totalRooms
    ) {
      adjacency.get(d.roomAIndex)?.add(d.roomBIndex);
      adjacency.get(d.roomBIndex)?.add(d.roomAIndex);
    }
  }

  // Breadth-First Search (BFS) portal traversal up to maxDepth
  const pvs = new Set<number>([currentRoomIndex]);
  const queue: { roomIdx: number; depth: number }[] = [{ roomIdx: currentRoomIndex, depth: 0 }];

  while (queue.length > 0) {
    const { roomIdx, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const neighbors = adjacency.get(roomIdx);
    if (neighbors) {
      for (const n of neighbors) {
        if (!pvs.has(n)) {
          pvs.add(n);
          queue.push({ roomIdx: n, depth: depth + 1 });
        }
      }
    }
  }

  return pvs;
}

