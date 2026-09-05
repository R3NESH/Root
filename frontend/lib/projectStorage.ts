// Browser-local persistence for the whole design — notes/architecture/environment-notes.md:
// no database, no accounts, so the only place a build survives a refresh is localStorage.
//
// Extracted from app/page.tsx, which held the key as a magic string in three places and
// repeated the same try/catch around every access. The shape below is the autosave payload;
// everything in it is optional on read because an older save predates newer fields.

import { CustomDim } from "@/components/RoomCustomizer";
import {
  CustomDrawnWall,
  CustomRoomZone,
} from "@/lib/customArchitecture";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { Facing, PlotDims } from "@/lib/plot";
import { DEFAULT_PROGRAM, PROGRAMS, ProgramKey } from "@/lib/programs";
import { RoomName } from "@/lib/rooms";
import { RoomOpening } from "@/lib/solve";
import { WindowConfig } from "@/lib/windowCatalog";

export const PROJECT_STORAGE_KEY = "vastu_builder_project_data_v1";

export interface SavedProject {
  plot: PlotDims;
  facing: Facing;
  /**
   * Which building programme the mix belongs to.
   *
   * Optional because projects saved before programmes existed do not carry it — those are
   * recovered by inferring it from the spaces in `counts`. Without this field a cafe saved and
   * reloaded came back as a residence still holding `seating` and `counter`, and the solver
   * rejected every one of them as an unknown space.
   */
  program?: ProgramKey;
  counts: Record<RoomName, number>;
  customDims: Record<string, CustomDim>;
  customOpenings: Record<string, RoomOpening[]>;
  customWallThickness: Record<string, number>;
  customWalls: CustomDrawnWall[];
  customRoomZones: CustomRoomZone[];
  customObjects: PlacedCustomObject[];
  deletedBuiltinIds: string[];
  lightsOn: boolean;
  furnished: boolean;
  materialConfig: HouseMaterialConfig;
  windowConfig: WindowConfig;
  activeFloor: number;
  activeBlueprintName: string | null;
  savedAt: number;
}

/** Parsed save, or null when there is nothing stored or the stored value is unreadable. */
export function loadProject(): Partial<SavedProject> | null {
  try {
    const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Partial<SavedProject>) : null;
  } catch (e) {
    console.warn("Failed to load saved house build from localStorage", e);
    return null;
  }
}

/** Returns false when the write failed — a full quota or a blocked storage origin. */
export function saveProject(project: SavedProject): boolean {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch (e) {
    console.warn("Auto-save to localStorage failed", e);
    return false;
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  } catch {}
}

/**
 * The programme a saved project belongs to.
 *
 * Prefers the stored field. Falls back to reading the mix: a project holding any space that only
 * one programme offers belongs to that programme. This is what repairs projects saved before the
 * field existed, rather than leaving them permanently unsolvable.
 */
export function programOfSavedProject(data: Partial<SavedProject> | null): ProgramKey {
  if (!data) return DEFAULT_PROGRAM.key;
  if (data.program && PROGRAMS.some((p) => p.key === data.program)) return data.program;

  const used = Object.entries(data.counts ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([name]) => name as RoomName);
  if (used.length === 0) return DEFAULT_PROGRAM.key;

  const match = PROGRAMS.find(
    (p) => p.key !== DEFAULT_PROGRAM.key && used.some((space) => p.spaces.includes(space))
  );
  return match ? match.key : DEFAULT_PROGRAM.key;
}
