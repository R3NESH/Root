// Per-wall geometry: how thick it is drawn, how tall it stands, and what is missing out of the
// middle of it.
//
// The solver owns the plan — where a wall runs and how long that run is. It does not own the
// other three numbers, and none of them change the packing, so they live here rather than in the
// model. The key is the one wall paint and wall glazing already use: room instance id plus edge,
// via `wallBandKey` in lib/wallBands.ts. A wall broken into several segments by the rooms behind
// it shares one entry, the same way its paint does.
//
// > Thickness here is render-only, exactly like the per-room `customWallThickness` it sits
// > beside. Neither is sent to /solve, so the packed layout still assumes the thickness the
// > solver chose. Drawing a 12 in wall does not move the rooms apart.

import { WallEdge } from "./wallCurves";
import { CutoutShape, WallProfile } from "./wallShapes";

/** A hole cut clean through a wall. Rectangular unless it says otherwise. */
export interface WallCutout {
  id: string;
  /** Absent means "rect", which is what every cutout was before shapes existed. */
  shape?: CutoutShape;
  /** From the start of the wall's run: its west end on an N/S wall, its north end on an E/W. */
  offsetIn: number;
  /** Underside of the hole above finished floor. 0 punches it through to the floor. */
  sillIn: number;
  widthIn: number;
  heightIn: number;
}

export interface WallEdit {
  /** Overrides the room's `wall_thickness_in` for this one wall. */
  thicknessIn?: number;
  /** Overrides the storey height for this one wall. Only ever shorter — see the clamp. */
  heightIn?: number;
  /** The wall's elevation outline. Absent means "square": a flat top across the whole run. */
  profile?: WallProfile;
  cutouts?: WallCutout[];
}

/** Keyed by `wallBandKey(roomInstanceId(rooms, i), edge)`. */
export type WallEdits = Record<string, WallEdit>;

/** Half brick on edge. Below this it is a screen, not a wall. */
export const MIN_WALL_THICKNESS_IN = 3;
/** Two and a half bricks. Past this the room loses more floor than the wall is worth. */
export const MAX_WALL_THICKNESS_IN = 18;
/** A parapet. Below it there is nothing left to call a wall. */
export const MIN_WALL_HEIGHT_IN = 24;
/** Small enough to be a service hatch, big enough to still read as deliberate. */
export const MIN_CUTOUT_IN = 6;

export function clampThicknessIn(inches: number): number {
  return Math.max(MIN_WALL_THICKNESS_IN, Math.min(MAX_WALL_THICKNESS_IN, Math.round(inches)));
}

/**
 * A wall may be made shorter than the storey but never taller: the slab above it is drawn at the
 * storey height and a wall poking through it would be a hole in the floor above.
 */
export function clampWallHeightIn(inches: number, storeyHeightIn: number): number {
  return Math.max(MIN_WALL_HEIGHT_IN, Math.min(storeyHeightIn, Math.round(inches)));
}

/**
 * The cutouts that can actually be built on a run of `runIn` in a wall `wallHeightIn` tall:
 * each one clamped inside the wall, sorted along the run, and any that overlaps the one before
 * it dropped.
 *
 * Overlap is dropped rather than merged because the geometry below builds one pier between
 * neighbouring holes — two holes sharing a span of wall would each subtract it and the piece
 * between them would come out inside-out.
 */
export function resolveCutouts(
  cutouts: WallCutout[] | undefined,
  runIn: number,
  wallHeightIn: number
): WallCutout[] {
  if (!cutouts || cutouts.length === 0) return [];

  const maxWidth = runIn - 2 * MIN_CUTOUT_IN;
  const maxHeight = wallHeightIn - MIN_CUTOUT_IN;
  if (maxWidth < MIN_CUTOUT_IN || maxHeight < MIN_CUTOUT_IN) return [];

  const clamped = cutouts.map((c) => {
    const widthIn = Math.max(MIN_CUTOUT_IN, Math.min(maxWidth, Math.round(c.widthIn)));
    const heightIn = Math.max(MIN_CUTOUT_IN, Math.min(maxHeight, Math.round(c.heightIn)));
    const sillIn = Math.max(0, Math.min(wallHeightIn - heightIn, Math.round(c.sillIn)));
    const offsetIn = Math.max(
      MIN_CUTOUT_IN,
      Math.min(runIn - MIN_CUTOUT_IN - widthIn, Math.round(c.offsetIn))
    );
    return { ...c, offsetIn, sillIn, widthIn, heightIn };
  });

  clamped.sort((a, b) => a.offsetIn - b.offsetIn);

  const kept: WallCutout[] = [];
  let usedTo = -Infinity;
  for (const c of clamped) {
    if (c.offsetIn < usedTo) continue;
    kept.push(c);
    usedTo = c.offsetIn + c.widthIn;
  }
  return kept;
}

/**
 * Where a new hole `widthIn` wide fits on this run, or null when it does not. Used by the
 * inspector's add button so a new cutout never lands on top of one already there.
 */
export function firstFreeOffsetIn(
  cutouts: WallCutout[] | undefined,
  runIn: number,
  widthIn: number
): number | null {
  const taken = resolveCutouts(cutouts, runIn, Number.MAX_SAFE_INTEGER)
    .map((c) => [c.offsetIn, c.offsetIn + c.widthIn] as const)
    .sort((a, b) => a[0] - b[0]);

  let cursor = MIN_CUTOUT_IN;
  for (const [start, end] of taken) {
    if (start - cursor >= widthIn) return cursor;
    cursor = Math.max(cursor, end);
  }
  return cursor + widthIn <= runIn - MIN_CUTOUT_IN ? cursor : null;
}

/** Nothing is overridden and nothing is cut. Lets a caller drop an entry rather than store {}. */
export function isEmptyWallEdit(edit: WallEdit | undefined): boolean {
  if (!edit) return true;
  return (
    edit.thicknessIn === undefined &&
    edit.heightIn === undefined &&
    (edit.profile === undefined || edit.profile === "square") &&
    (edit.cutouts === undefined || edit.cutouts.length === 0)
  );
}

/** The label the inspector puts on a wall. */
export function edgeName(edge: WallEdge): string {
  return edge === "N" ? "North" : edge === "S" ? "South" : edge === "E" ? "East" : "West";
}
