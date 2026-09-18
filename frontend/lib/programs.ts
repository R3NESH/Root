// Building programmes — mirrors backend/programs/registry.py. Keep the two in sync by hand,
// the same way lib/rooms.ts mirrors solver/rooms.py.
//
// A programme is what kind of building the solver is packing. It decides which spaces the UI
// offers, what the default mix is, and what the directional rules posted before the solve are
// called — a residence posts none, a cafe posts service-flow zoning. The backend is the
// authority on the rules themselves; this file only needs to know what to show and what to send.

import { FurnitureCategory } from "./furnitureCatalog";
import { RoomName } from "./rooms";

export type ProgramKey = "residence" | "cafe";

export interface BuildingProgram {
  key: ProgramKey;
  label: string;
  icon: string;
  blurb: string;
  /** Spaces this programme offers, in the order the room-program grid shows them. */
  spaces: RoomName[];
  /** Spaces the mix starts with, one entry per instance. */
  defaultMix: RoomName[];
  /** Ceiling on how many of one space the ribbon lets you add. */
  maxPerSpace: Partial<Record<RoomName, number>>;
  /** What this programme's directional constraints are called, for honest UI copy. */
  rulesLabel: string;
  /** Short heading over the left tool rail. */
  railCaption: string;
  /**
   * Interior tool categories the left rail offers, in order. Swapping the building type swaps
   * the whole fit-out toolset: a cafe has no wardrobes and a house has no condiment station.
   */
  furnitureCategories: FurnitureCategory[];
  /** Plot presets that suit this programme, in feet. */
  plotHint: string;
}

export const RESIDENCE_PROGRAM: BuildingProgram = {
  key: "residence",
  label: "Residence",
  icon: "HSE",
  blurb: "Indian home. Rooms opening onto a central hall.",
  spaces: [
    "hall", "dining", "kitchen", "bedroom", "bathroom", "store", "entrance",
    "utility", "sitout", "parking",
  ],
  defaultMix: ["hall", "kitchen", "bedroom", "bedroom", "bathroom"],
  // One car porch and one sit-out. A house with two front porches is a data entry mistake, and
  // both eat street frontage the rooms need — backend/programs/registry.py street_edge_spaces.
  maxPerSpace: { parking: 1, sitout: 1, utility: 1 },
  rulesLabel: "",
  railCaption: "Interior",
  furnitureCategories: [
    "living",
    "bedroom",
    "dining",
    "kitchen",
    "bath",
    "office",
    "appliance",
    "lighting",
    "soft",
    "decor",
    "walls",
  ],
  plotHint: "30x40 to 50x80 ft plots",
};

export const CAFE_PROGRAM: BuildingProgram = {
  key: "cafe",
  label: "Café",
  icon: "CAF",
  blurb:
    "Coffee shop or small restaurant. Front of house at the street, back of house behind it, and the customer never crosses the production line.",
  spaces: [
    "entry",
    "queue",
    "counter",
    "seating",
    "lounge",
    "washroom",
    "prep",
    "pantry",
    "wash",
    "staff",
  ],
  defaultMix: ["entry", "queue", "counter", "seating", "prep", "pantry", "washroom"],
  // One shopfront, one queue, one till. Duplicating those is not a bigger cafe, it is a broken
  // service flow — and the solver would pin both copies into the same band anyway.
  maxPerSpace: { entry: 1, queue: 1, counter: 1, prep: 1 },
  rulesLabel: "Service flow",
  railCaption: "Fit-Out",
  furnitureCategories: [
    "cafe_seating",
    "cafe_service",
    "cafe_decor",
    "cafe_signage",
    "cafe_boh",
    "cafe_outdoor",
    "walls",
  ],
  plotHint: "600-900 sq ft suits a small cafe",
};

export const PROGRAMS: BuildingProgram[] = [RESIDENCE_PROGRAM, CAFE_PROGRAM];

export const DEFAULT_PROGRAM = RESIDENCE_PROGRAM;

export function getProgram(key: ProgramKey | string | undefined | null): BuildingProgram {
  return PROGRAMS.find((p) => p.key === key) ?? DEFAULT_PROGRAM;
}

/** Counts for a programme's starting mix, zero for every space it offers but does not use. */
export function defaultCounts(program: BuildingProgram): Record<RoomName, number> {
  const counts = {} as Record<RoomName, number>;
  for (const space of program.spaces) counts[space] = 0;
  for (const space of program.defaultMix) counts[space] = (counts[space] ?? 0) + 1;
  return counts;
}

/** Drop any space the programme does not offer, so a mix never crosses building types. */
export function countsForProgram(
  program: BuildingProgram,
  counts: Record<RoomName, number>
): Record<RoomName, number> {
  const next = {} as Record<RoomName, number>;
  for (const space of program.spaces) next[space] = counts[space] ?? 0;
  return next;
}

export function maxCountFor(program: BuildingProgram, space: RoomName): number {
  return program.maxPerSpace[space] ?? 4;
}
