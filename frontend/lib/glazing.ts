// Glazed walls and glass doors — turning a real wall of a real room into glass, rather than
// standing a glass object in front of it.
//
// The catalogue already had glass *placeables*: a framed partition, a curved panoramic screen, a
// revolving door. Those are furniture — you drop them on the floor and they have nothing to do
// with the plan. What was missing is the thing a cafe actually needs: the shopfront wall IS glass,
// and the door in it IS glass, with the solver's own opening still cut through it.
//
// So glazing is a finish on a wall, resolved exactly like paint bands: this wall, then this room,
// then the whole building. It changes no geometry the solver produced — doors, windows and
// lintels stay exactly where they were, and the wall they sit in is simply made of glass.
//
// `door` is separate from `wall` on purpose. A shopfront is both. A study with a glass door into
// a solid wall is only the second, and that is a real thing people ask for.

import { RoomName } from "./rooms";

export interface GlazingStyle {
  id: string;
  name: string;
  description: string;
  /** Tint, as a Three.js hex. */
  colorHex: number;
  opacity: number;
  roughness: number;
  metalness: number;
  /** Frame and mullion colour. */
  frameHex: number;
  /**
   * Face width of the head rail, cill rail and mullions, in feet. Omitted means the joinery
   * profile every style used before structural glazing arrived. Structural curtain walling is
   * defined by how little frame it shows, so the profile has to be a property of the style
   * rather than a constant in the renderer — a slim style drawn at shopfront thickness is just
   * a shopfront.
   */
  frameThicknessFt?: number;
}

/** Profile used by any style that does not name its own. */
export const DEFAULT_FRAME_THICKNESS_FT = 0.16;

export const GLAZING_STYLES: GlazingStyle[] = [
  {
    id: "structural",
    name: "Structural Glazing",
    description:
      "Floor-to-ceiling low-iron glass on slim black mullions. The frameless curtain-wall look, where the glass is the wall rather than something set into one.",
    colorHex: 0xeaf4f2,
    // Low-iron glass is the clearest architectural glazing made — it lacks the green cast of
    // ordinary float glass, which is why a curtain wall reads as an opening rather than a pane.
    opacity: 0.12,
    roughness: 0.02,
    metalness: 0.05,
    frameHex: 0x0d0f12,
    // Under half the joinery profile. The whole point of the system is the sightline.
    frameThicknessFt: 0.07,
  },
  {
    id: "clear",
    name: "Clear",
    description: "Low-iron clear glazing. What a shopfront is unless someone decided otherwise.",
    colorHex: 0xdfefff,
    opacity: 0.22,
    roughness: 0.04,
    metalness: 0.1,
    frameHex: 0x2a3038,
  },
  {
    id: "industrial",
    name: "Industrial Grid",
    description: "Clear glass in a heavy black grid. The Crittall look.",
    colorHex: 0xe2f0ff,
    opacity: 0.2,
    roughness: 0.05,
    metalness: 0.12,
    frameHex: 0x14171b,
  },
  {
    id: "bronze",
    name: "Bronze Tint",
    description: "Warm bronze-tinted glass in a dark bronze frame. Cuts west glare.",
    colorHex: 0xc79a63,
    opacity: 0.34,
    roughness: 0.06,
    metalness: 0.2,
    frameHex: 0x3d2b1a,
  },
  {
    id: "smoked",
    name: "Smoked Grey",
    description: "Smoked grey glass. Privacy without blocking the light.",
    colorHex: 0x7d8794,
    opacity: 0.42,
    roughness: 0.07,
    metalness: 0.15,
    frameHex: 0x1f242b,
  },
  {
    id: "reeded",
    name: "Reeded / Fluted",
    description: "Fluted obscure glass. Light through, detail not.",
    colorHex: 0xd8e6e2,
    opacity: 0.5,
    roughness: 0.35,
    metalness: 0.05,
    frameHex: 0x8a6f4f,
  },
];

export function findGlazingStyle(id: string): GlazingStyle {
  // Fall back by id, not by position. This list is ordered for the picker, and adding a style
  // at the top has already silently moved this fallback once; an unknown id should still land on
  // plain clear glass rather than on whatever happens to be listed first.
  return (
    GLAZING_STYLES.find((g) => g.id === id) ??
    GLAZING_STYLES.find((g) => g.id === "clear") ??
    GLAZING_STYLES[0]
  );
}

export interface WallGlazing {
  styleId: string;
  /** Glaze the wall itself. */
  wall: boolean;
  /** Glaze the doors hosted in this wall. */
  door: boolean;
  /** Vertical mullions across a glazed wall. 0 for a single unbroken sheet. */
  mullions: number;
}

export interface GlazingPreset {
  id: string;
  name: string;
  description: string;
  glazing: WallGlazing;
}

export const GLAZING_PRESETS: GlazingPreset[] = [
  {
    id: "structural",
    name: "Structural Glazing",
    description: "Floor-to-ceiling glass wall and matching glass door on slim black mullions.",
    // Four mullions give wide bays. Structural glazing is sold on the size of the pane, so
    // subdividing it the way a Crittall screen does would defeat the style.
    glazing: { styleId: "structural", wall: true, door: true, mullions: 4 },
  },
  {
    id: "shopfront",
    name: "Shopfront",
    description: "Full-height clear glazing with a glass door. The cafe frontage.",
    glazing: { styleId: "clear", wall: true, door: true, mullions: 3 },
  },
  {
    id: "crittall",
    name: "Crittall Partition",
    description: "Black-grid glazed partition with a matching glass door.",
    glazing: { styleId: "industrial", wall: true, door: true, mullions: 5 },
  },
  {
    id: "picture",
    name: "Picture Wall",
    description: "One unbroken sheet, no mullions. Solid doors kept.",
    glazing: { styleId: "clear", wall: true, door: false, mullions: 0 },
  },
  {
    id: "bronze_wall",
    name: "Bronze Curtain",
    description: "Bronze-tinted curtain wall for a west or south face.",
    glazing: { styleId: "bronze", wall: true, door: true, mullions: 4 },
  },
  {
    id: "glass_door",
    name: "Glass Door Only",
    description: "Solid wall, glazed door. A study or a meeting room.",
    glazing: { styleId: "clear", wall: false, door: true, mullions: 0 },
  },
  {
    id: "reeded_screen",
    name: "Reeded Screen",
    description: "Fluted obscure glazing. Light through, detail not.",
    glazing: { styleId: "reeded", wall: true, door: true, mullions: 6 },
  },
];

export function findGlazingPreset(id: string): GlazingPreset | undefined {
  return GLAZING_PRESETS.find((p) => p.id === id);
}

export interface GlazingConfig {
  wallGlazing?: Record<string, WallGlazing>;
  roomGlazing?: Partial<Record<RoomName, WallGlazing>>;
  globalGlazing?: WallGlazing;
}

/** The glazing that applies to one wall: wall override, then room, then building. */
export function resolveWallGlazing(
  config: GlazingConfig,
  wallKey: string,
  roomName: RoomName
): WallGlazing | undefined {
  const g =
    config.wallGlazing?.[wallKey] ?? config.roomGlazing?.[roomName] ?? config.globalGlazing;
  // Neither flag set is the same as no glazing at all; treat it as off rather than drawing a
  // glass wall nobody asked for.
  if (!g || (!g.wall && !g.door)) return undefined;
  return g;
}

export function withGlazingStyle(g: WallGlazing, styleId: string): WallGlazing {
  return { ...g, styleId };
}

export function withGlazingTarget(g: WallGlazing, target: "wall" | "door", on: boolean): WallGlazing {
  return { ...g, [target]: on };
}

export function withMullions(g: WallGlazing, mullions: number): WallGlazing {
  return { ...g, mullions: Math.max(0, Math.min(8, mullions)) };
}
