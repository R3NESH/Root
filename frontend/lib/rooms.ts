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
