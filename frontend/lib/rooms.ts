// Room vocabulary — mirrors backend/solver/rooms.py ROOM_CATALOG. Keep the two in sync by hand.
// notes/solver/realism-gaps.md added six kinds to the original five; parking, sit-out,
// staircase and utility were removed again on 2026-08-25 — see
// notes/decisions/rejected-approaches.md. Three of those four came back on 2026-09-06 for
// free-text input, which needs a vocabulary wide enough to answer with — [[free-text-input]].
// The staircase did not: it is still structure the solver places, never a room anyone asks for.

export type RoomName =
  // residence
  | "hall"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "store"
  | "entrance"
  | "utility"
  // Roofed, not walled. The renderer must not draw these a box — see SolvedRoom.open_sided.
  | "sitout"
  | "parking"
  // cafe / small restaurant
  | "seating"
  | "lounge"
  | "entry"
  | "queue"
  | "counter"
  | "prep"
  | "pantry"
  | "wash"
  | "washroom"
  | "staff"
  // Placed by the solver, never by the user: the stair core that ties the storeys of a G+1
  // together. Deliberately absent from ROOM_NAMES below, so it appears in no mix and no counter
  // — "staircase as a room kind" stays rejected (notes/decisions/rejected-approaches.md); this
  // is structure the plan cannot be without once there is a floor above.
  | "stairs";

// One vocabulary across every building type; lib/programs.ts decides which subset a given
// programme offers. Keeping it one union means every Record below stays total and the twenty-odd
// consumers of RoomName keep compiling.
export const ROOM_NAMES: RoomName[] = [
  "hall",
  "dining",
  "kitchen",
  "bedroom",
  "bathroom",
  "store",
  "entrance",
  "utility",
  "sitout",
  "parking",
  "seating",
  "lounge",
  "entry",
  "queue",
  "counter",
  "prep",
  "pantry",
  "wash",
  "washroom",
  "staff",
];

export const ROOM_LABELS: Record<RoomName, string> = {
  hall: "Hall",
  dining: "Dining",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bath",
  store: "Store",
  entrance: "Entrance",
  utility: "Utility",
  sitout: "Sit-out",
  parking: "Car Porch",
  seating: "Seating",
  lounge: "Lounge",
  entry: "Entry",
  queue: "Order Queue",
  counter: "Counter",
  prep: "Kitchen",
  pantry: "Store",
  wash: "Wash-up",
  washroom: "Washroom",
  staff: "Staff",
  stairs: "Staircase",
};

// Distinct hues so adjacent rooms read as separate volumes in the 3D model.
export const ROOM_COLORS: Record<RoomName, number> = {
  hall: 0x4a9d6e,
  dining: 0x5cab8a,
  kitchen: 0xd9694a,
  bedroom: 0x4a7fd9,
  bathroom: 0x8a6fc4,
  store: 0x8d8577,
  entrance: 0xe8912d,
  utility: 0x7f9aa6,
  // The two open-sided spaces share a muted outdoor green so they read as "not indoors" at a
  // glance, the way the cafe's front/back split does below.
  sitout: 0x6f9c63,
  parking: 0x5c8457,
  // Cafe: front of house warm, back of house cool, so the 60/40 split reads at a glance in 3D.
  seating: 0xc98a5e,
  lounge: 0xb9745c,
  entry: 0xe8912d,
  queue: 0xd8b26a,
  counter: 0x8c5a3c,
  prep: 0x5b8ba0,
  pantry: 0x7d8792,
  wash: 0x6a93a8,
  washroom: 0x8a6fc4,
  staff: 0x6f7f6a,
  stairs: 0x8b8177,
};

// Rooms people spend time in. Drives the interior detailing.
export const HABITABLE: ReadonlySet<RoomName> = new Set<RoomName>([
  "hall",
  "dining",
  "kitchen",
  "bedroom",
  "entrance",
  "seating",
  "lounge",
  "entry",
  "prep",
]);

export const DEFAULT_MIX: RoomName[] = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"];

/** Every space at zero. The base for a counts map, so callers only name what they want. */
export const ZERO_COUNTS: Record<RoomName, number> = ROOM_NAMES.reduce((acc, name) => {
  acc[name] = 0;
  return acc;
}, {} as Record<RoomName, number>);

/**
 * Fill a sparse mix out to every space in the vocabulary.
 *
 * A counts map is total over RoomName so consumers can index it without a null check, but no
 * caller wants to write eighteen zeroes — and a residence literal listing only house rooms
 * would stop compiling the moment a programme adds a space.
 */
export function withCounts(
  partial: Partial<Record<RoomName, number>>
): Record<RoomName, number> {
  return { ...ZERO_COUNTS, ...partial };
}

export interface AdjacentRoomEdgeMatch {
  adjIndex: number;
  adjEdge: "N" | "S" | "E" | "W";
}

/**
 * Finds if another room is physically adjacent and touching along a specific wall edge.
 */
export function findAdjacentRoomEdge(
  rooms: {
    x_in: number;
    y_in: number;
    w_in: number;
    d_in: number;
    name?: string;
    floor?: number;
  }[],
  roomIndex: number,
  edge: "N" | "S" | "E" | "W"
): AdjacentRoomEdgeMatch | null {
  const r1 = rooms[roomIndex];
  if (!r1) return null;

  for (let j = 0; j < rooms.length; j++) {
    if (j === roomIndex) continue;
    const r2 = rooms[j];
    // Rooms on different storeys are not neighbours, however neatly their edges line up in plan.
    // Without this a first-floor bedroom sitting over a ground-floor hall counted as sharing a
    // wall with it: the shared run was built once, by the lower room, and the upper room was
    // left with a hole where its wall should be.
    if ((r1.floor ?? 0) !== (r2.floor ?? 0)) continue;

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
