// Room vocabulary — mirrors backend/solver/rooms.py ROOM_CATALOG. Keep the two in sync by hand.
// notes/solver/realism-gaps.md added six kinds to the original five; parking, sit-out,
// staircase and utility were removed again on 2026-08-25 — see
// notes/decisions/rejected-approaches.md.

export type RoomName =
  | "hall"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "pooja"
  | "store";

export const ROOM_NAMES: RoomName[] = [
  "hall",
  "dining",
  "kitchen",
  "bedroom",
  "bathroom",
  "pooja",
  "store",
];

export const ROOM_LABELS: Record<RoomName, string> = {
  hall: "Hall",
  dining: "Dining",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bath",
  pooja: "Pooja",
  store: "Store",
};

// Distinct hues so adjacent rooms read as separate volumes in the 3D model.
export const ROOM_COLORS: Record<RoomName, number> = {
  hall: 0x4a9d6e,
  dining: 0x5cab8a,
  kitchen: 0xd9694a,
  bedroom: 0x4a7fd9,
  bathroom: 0x8a6fc4,
  pooja: 0xd9b64a,
  store: 0x8d8577,
};

// Rooms people spend time in. Drives the interior detailing.
export const HABITABLE: ReadonlySet<RoomName> = new Set<RoomName>([
  "hall",
  "dining",
  "kitchen",
  "bedroom",
]);

export const DEFAULT_MIX: RoomName[] = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"];

export interface AdjacentRoomEdgeMatch {
  adjIndex: number;
  adjEdge: "N" | "S" | "E" | "W";
}

/**
 * Finds if another room is physically adjacent and touching along a specific wall edge.
 */
export function findAdjacentRoomEdge(
  rooms: { x_in: number; y_in: number; w_in: number; d_in: number; name?: string }[],
  roomIndex: number,
  edge: "N" | "S" | "E" | "W"
): AdjacentRoomEdgeMatch | null {
  const r1 = rooms[roomIndex];
  if (!r1) return null;

  for (let j = 0; j < rooms.length; j++) {
    if (j === roomIndex) continue;
    const r2 = rooms[j];

    if (edge === "E") {
      // r1 East edge (x = x1 + w1) touches r2 West edge (x = x2)
      if (Math.abs((r1.x_in + r1.w_in) - r2.x_in) <= 6) {
        const overlap = Math.min(r1.y_in + r1.d_in, r2.y_in + r2.d_in) - Math.max(r1.y_in, r2.y_in);
        if (overlap > 12) return { adjIndex: j, adjEdge: "W" };
      }
    } else if (edge === "W") {
      // r1 West edge (x = x1) touches r2 East edge (x = x2 + w2)
      if (Math.abs(r1.x_in - (r2.x_in + r2.w_in)) <= 6) {
        const overlap = Math.min(r1.y_in + r1.d_in, r2.y_in + r2.d_in) - Math.max(r1.y_in, r2.y_in);
        if (overlap > 12) return { adjIndex: j, adjEdge: "E" };
      }
    } else if (edge === "S") {
      // r1 South edge (y = y1 + d1) touches r2 North edge (y = y2)
      if (Math.abs((r1.y_in + r1.d_in) - r2.y_in) <= 6) {
        const overlap = Math.min(r1.x_in + r1.w_in, r2.x_in + r2.w_in) - Math.max(r1.x_in, r2.x_in);
        if (overlap > 12) return { adjIndex: j, adjEdge: "N" };
      }
    } else if (edge === "N") {
      // r1 North edge (y = y1) touches r2 South edge (y = y2 + d2)
      if (Math.abs(r1.y_in - (r2.y_in + r2.d_in)) <= 6) {
        const overlap = Math.min(r1.x_in + r1.w_in, r2.x_in + r2.w_in) - Math.max(r1.x_in, r2.x_in);
        if (overlap > 12) return { adjIndex: j, adjEdge: "S" };
      }
    }
  }
  return null;
}
