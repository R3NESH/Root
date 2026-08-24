// Room vocabulary — mirrors backend/solver/rooms.py ROOM_CATALOG. Keep the two in sync by hand.

export type RoomName = "hall" | "kitchen" | "bedroom" | "bathroom" | "pooja";

export const ROOM_NAMES: RoomName[] = ["hall", "kitchen", "bedroom", "bathroom", "pooja"];

export const ROOM_LABELS: Record<RoomName, string> = {
  hall: "Hall",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bath",
  pooja: "Pooja",
};

// Distinct hues so adjacent rooms read as separate volumes in the 3D model.
export const ROOM_COLORS: Record<RoomName, number> = {
  hall: 0x4a9d6e,
  kitchen: 0xd9694a,
  bedroom: 0x4a7fd9,
  bathroom: 0x8a6fc4,
  pooja: 0xd9b64a,
};

export const DEFAULT_MIX: RoomName[] = ["hall", "kitchen", "bedroom", "bedroom", "bathroom"];
