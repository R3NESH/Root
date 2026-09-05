// Smart Wall Snapping & Auto-Positioning Engine
// Automatically aligns walls to room edges, open passages, room midlines, and corner junctions.

import { SolvedRoom, RoomOpening } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import { ROOM_LABELS, RoomName } from "@/lib/rooms";
import { PlacedCustomObject, FURNITURE_CATALOG } from "@/lib/furnitureCatalog";

export interface SmartWallSnapResult {
  x: number; // feet
  z: number; // feet
  rotationY: number; // radians
  isSnapped: boolean;
  snapType?: "wall_edge" | "room_divider" | "open_passage" | "custom_wall";
  snapDescription?: string;
  guideLine?: {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
  };
}

/**
 * Computes the optimal magnetic snapping position and rotation for a wall being placed or dragged.
 */
export function computeSmartWallSnap(
  rawX: number,
  rawZ: number,
  wallLengthFt: number = 8.0,
  rooms: SolvedRoom[] = [],
  customObjects: PlacedCustomObject[] = [],
  customOpenings: Record<string, RoomOpening[]> = {},
  currentDraggingId?: string | null
): SmartWallSnapResult {
  const SNAP_THRESHOLD_FT = 2.2; // 2.2 feet magnetic pull radius
  let bestDist = SNAP_THRESHOLD_FT;
  let bestResult: SmartWallSnapResult = {
    x: Math.round(rawX * 2) / 2,
    z: Math.round(rawZ * 2) / 2,
    rotationY: 0,
    isSnapped: false,
  };

  // 1. Check Room Boundary Walls and Open-Concept Demolished Passages
  for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
    const room = rooms[rIdx];
    const rx = inchesToFeet(room.x_in);
    const rz = inchesToFeet(room.y_in);
    const rw = inchesToFeet(room.w_in);
    const rd = inchesToFeet(room.d_in);
    const roomLabel = ROOM_LABELS[room.name as RoomName] || room.name;

    const id = `${room.name}_${rIdx}`;
    const ops = customOpenings[id] !== undefined ? customOpenings[id] : (room.openings || []);

    // A. North Wall (Z = rz)
    const distN = Math.abs(rawZ - rz);
    if (distN < bestDist && rawX >= rx - 1.5 && rawX <= rx + rw + 1.5) {
      bestDist = distN;
      const isDemolished = ops.some((o) => o.kind === "opening" && o.edge === "N");
      const clampedX = Math.max(rx + wallLengthFt / 2, Math.min(rx + rw - wallLengthFt / 2, rawX));
      const snapX = rw <= wallLengthFt ? rx + rw / 2 : clampedX;

      bestResult = {
        x: Math.round(snapX * 2) / 2,
        z: rz,
        rotationY: 0,
        isSnapped: true,
        snapType: isDemolished ? "open_passage" : "wall_edge",
        snapDescription: isDemolished
          ? ` Attached to ${roomLabel} (North Open Passage)`
          : ` Attached to ${roomLabel} (North Wall)`,
        guideLine: { x1: rx, z1: rz, x2: rx + rw, z2: rz },
      };
    }

    // B. South Wall (Z = rz + rd)
    const distS = Math.abs(rawZ - (rz + rd));
    if (distS < bestDist && rawX >= rx - 1.5 && rawX <= rx + rw + 1.5) {
      bestDist = distS;
      const isDemolished = ops.some((o) => o.kind === "opening" && o.edge === "S");
      const clampedX = Math.max(rx + wallLengthFt / 2, Math.min(rx + rw - wallLengthFt / 2, rawX));
      const snapX = rw <= wallLengthFt ? rx + rw / 2 : clampedX;

      bestResult = {
        x: Math.round(snapX * 2) / 2,
        z: rz + rd,
        rotationY: 0,
        isSnapped: true,
        snapType: isDemolished ? "open_passage" : "wall_edge",
        snapDescription: isDemolished
          ? ` Attached to ${roomLabel} (South Open Passage)`
          : ` Attached to ${roomLabel} (South Wall)`,
        guideLine: { x1: rx, z1: rz + rd, x2: rx + rw, z2: rz + rd },
      };
    }

    // C. West Wall (X = rx)
    const distW = Math.abs(rawX - rx);
    if (distW < bestDist && rawZ >= rz - 1.5 && rawZ <= rz + rd + 1.5) {
      bestDist = distW;
      const isDemolished = ops.some((o) => o.kind === "opening" && o.edge === "W");
      const clampedZ = Math.max(rz + wallLengthFt / 2, Math.min(rz + rd - wallLengthFt / 2, rawZ));
      const snapZ = rd <= wallLengthFt ? rz + rd / 2 : clampedZ;

      bestResult = {
        x: rx,
        z: Math.round(snapZ * 2) / 2,
        rotationY: Math.PI / 2,
        isSnapped: true,
        snapType: isDemolished ? "open_passage" : "wall_edge",
        snapDescription: isDemolished
          ? ` Attached to ${roomLabel} (West Open Passage)`
          : ` Attached to ${roomLabel} (West Wall)`,
        guideLine: { x1: rx, z1: rz, x2: rx, z2: rz + rd },
      };
    }

    // D. East Wall (X = rx + rw)
    const distE = Math.abs(rawX - (rx + rw));
    if (distE < bestDist && rawZ >= rz - 1.5 && rawZ <= rz + rd + 1.5) {
      bestDist = distE;
      const isDemolished = ops.some((o) => o.kind === "opening" && o.edge === "E");
      const clampedZ = Math.max(rz + wallLengthFt / 2, Math.min(rz + rd - wallLengthFt / 2, rawZ));
      const snapZ = rd <= wallLengthFt ? rz + rd / 2 : clampedZ;

      bestResult = {
        x: rx + rw,
        z: Math.round(snapZ * 2) / 2,
        rotationY: Math.PI / 2,
        isSnapped: true,
        snapType: isDemolished ? "open_passage" : "wall_edge",
        snapDescription: isDemolished
          ? ` Attached to ${roomLabel} (East Open Passage)`
          : ` Attached to ${roomLabel} (East Wall)`,
        guideLine: { x1: rx + rw, z1: rz, x2: rx + rw, z2: rz + rd },
      };
    }

    // 2. Interior Room Center Divider Snapping (Splitting large rooms into 2 functional zones)
    if (rawX >= rx && rawX <= rx + rw && rawZ >= rz && rawZ <= rz + rd) {
      // Vertical Center Midline
      const midX = rx + rw / 2;
      const distMidX = Math.abs(rawX - midX);
      if (distMidX < 1.6 && distMidX < bestDist) {
        bestDist = distMidX;
        bestResult = {
          x: midX,
          z: rz + rd / 2,
          rotationY: Math.PI / 2,
          isSnapped: true,
          snapType: "room_divider",
          snapDescription: ` Center Divider in ${roomLabel} (N-S)`,
          guideLine: { x1: midX, z1: rz, x2: midX, z2: rz + rd },
        };
      }

      // Horizontal Center Midline
      const midZ = rz + rd / 2;
      const distMidZ = Math.abs(rawZ - midZ);
      if (distMidZ < 1.6 && distMidZ < bestDist) {
        bestDist = distMidZ;
        bestResult = {
          x: rx + rw / 2,
          z: midZ,
          rotationY: 0,
          isSnapped: true,
          snapType: "room_divider",
          snapDescription: ` Center Divider in ${roomLabel} (E-W)`,
          guideLine: { x1: rx, z1: midZ, x2: rx + rw, z2: midZ },
        };
      }
    }
  }

  // 3. Collinear and T-Junction Snapping to Other Placed Custom Partition Walls
  for (const obj of customObjects) {
    if (obj.id === currentDraggingId || !obj.type.startsWith("wall_")) continue;
    const itemDef = FURNITURE_CATALOG.find((i) => i.type === obj.type);
    const otherLen = itemDef?.dimensions.widthFt || 8.0;
    const isOtherEW = Math.abs(obj.rotationY % Math.PI) < 0.2;

    if (isOtherEW) {
      // Collinear along X
      const distZ = Math.abs(rawZ - obj.z);
      if (distZ < 1.5 && Math.abs(rawX - (obj.x + otherLen / 2 + wallLengthFt / 2)) < 2.0) {
        return {
          x: obj.x + otherLen / 2 + wallLengthFt / 2,
          z: obj.z,
          rotationY: 0,
          isSnapped: true,
          snapType: "custom_wall",
          snapDescription: ` Collinear Attachment with ${obj.name}`,
          guideLine: {
            x1: obj.x - otherLen / 2,
            z1: obj.z,
            x2: obj.x + otherLen / 2 + wallLengthFt,
            z2: obj.z,
          },
        };
      }
    } else {
      // Collinear along Z
      const distX = Math.abs(rawX - obj.x);
      if (distX < 1.5 && Math.abs(rawZ - (obj.z + otherLen / 2 + wallLengthFt / 2)) < 2.0) {
        return {
          x: obj.x,
          z: obj.z + otherLen / 2 + wallLengthFt / 2,
          rotationY: Math.PI / 2,
          isSnapped: true,
          snapType: "custom_wall",
          snapDescription: ` Collinear Attachment with ${obj.name}`,
          guideLine: {
            x1: obj.x,
            z1: obj.z - otherLen / 2,
            x2: obj.x,
            z2: obj.z + otherLen / 2 + wallLengthFt,
          },
        };
      }
    }
  }

  return bestResult;
}
