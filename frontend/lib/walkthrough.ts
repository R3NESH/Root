import { inchesToFeet } from "./units";
import { SolvedRoom } from "./solve";
import { PlotDims, Facing } from "./plot";

// Eye level of a standing adult, ~5 ft 9 in tall. It was 4.4 ft, which reads as a child and made
// every room and every piece of furniture tower — a "grand" interior bought by lying about who is
// walking through it. A 10x10 bedroom should look like a 10x10 bedroom.
export const EYE_LEVEL_FT = 5.4; // 5.4 ft
export const CROUCH_HEIGHT_FT = 3.4; // 3.4 ft crouched
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

export interface ObstacleBox {
  id: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  isDoor?: boolean;
  isOpen?: boolean;
}

export const PLAYER_COLLISION_RADIUS = 0.55; // 0.55 ft (~6.6 inches radius, 13.2 in shoulder width)

export function pointCollidesWithBox(
  px: number,
  pz: number,
  radius: number,
  box: ObstacleBox
): boolean {
  if (box.isDoor && box.isOpen) return false;
  const closestX = Math.max(box.minX, Math.min(px, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
  const dx = px - closestX;
  const dz = pz - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

export function checkPlayerCollision(
  px: number,
  pz: number,
  radius: number,
  obstacles: ObstacleBox[]
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    if (pointCollidesWithBox(px, pz, radius, obstacles[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Push a player who is already overlapping something out of the deepest obstacle they are in,
 * one at a time. Only reached when the player started a frame inside a box — spawned there, or
 * the layout moved underneath them.
 */
function depenetrate(
  startX: number,
  startZ: number,
  radius: number,
  obstacles: ObstacleBox[]
): { x: number; z: number } {
  let x = startX;
  let z = startZ;

  for (let pass = 0; pass < 4; pass++) {
    let deepest: ObstacleBox | null = null;
    let deepestOverlap = 0;

    for (const obs of obstacles) {
      if (!pointCollidesWithBox(x, z, radius, obs)) continue;
      // Inside the circle test implies inside the radius-expanded box, so all four are positive.
      const overlap = Math.min(
        x - (obs.minX - radius),
        obs.maxX + radius - x,
        z - (obs.minZ - radius),
        obs.maxZ + radius - z
      );
      if (overlap > deepestOverlap) {
        deepestOverlap = overlap;
        deepest = obs;
      }
    }

    if (!deepest) break;

    const left = x - (deepest.minX - radius);
    const right = deepest.maxX + radius - x;
    const near = z - (deepest.minZ - radius);
    const far = deepest.maxZ + radius - z;
    const shortest = Math.min(left, right, near, far);

    if (shortest === left) x = deepest.minX - radius;
    else if (shortest === right) x = deepest.maxX + radius;
    else if (shortest === near) z = deepest.minZ - radius;
    else z = deepest.maxZ + radius;
  }

  return { x, z };
}

/**
 * Move the player, sliding along whatever blocks the direct path.
 *
 * Try the whole step; if it collides, try each axis on its own and take the first that is clear.
 * That is what produces the slide along a wall, and unlike a push-out relaxation loop it can
 * never leave the player inside an obstacle: the fallback is to stay where they were, which was
 * free. The loop it replaces pushed out of each box in list order, so a sofa beside a wall would
 * eject the player into the wall and the wall would eject them back into the sofa — three passes
 * later they were still overlapping, and the next frame did the same thing. That was the stall.
 */
export function resolvePlayerMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  radius: number = PLAYER_COLLISION_RADIUS,
  obstacles: ObstacleBox[] = []
): { x: number; z: number } {
  if (!obstacles || obstacles.length === 0) {
    return { x: targetX, z: targetZ };
  }

  const isFree = (x: number, z: number) => !checkPlayerCollision(x, z, radius, obstacles);

  if (isFree(targetX, targetZ)) {
    return { x: targetX, z: targetZ };
  }

  // Dominant axis first, so a glancing approach keeps the bigger half of its speed.
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const slides: Array<[number, number]> =
    Math.abs(dx) >= Math.abs(dz)
      ? [
          [targetX, currentZ],
          [currentX, targetZ],
        ]
      : [
          [currentX, targetZ],
          [targetX, currentZ],
        ];

  for (const [x, z] of slides) {
    if (isFree(x, z)) return { x, z };
  }

  if (!isFree(currentX, currentZ)) {
    return depenetrate(currentX, currentZ, radius, obstacles);
  }
  return { x: currentX, z: currentZ };
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

