// Wall paint bands — splitting one wall into horizontal or vertical strips so two or more
// colours can be compared on it side by side.
//
// This is a *finish*, not architecture: a band never changes the wall's geometry, its thickness,
// its openings or where a door lands. It is a thin painted panel laid on the wall's face, which
// is also how the real decision gets made — you paint test patches on the wall you already have.
//
// Bands are held as fractions of the wall, not as feet, so the same scheme survives the room
// being resized by the solver. `sizeFrac` values are normalised on read, so a caller can hand in
// whatever it likes and still get a scheme that covers the wall exactly once.
//
// Resolution order, most specific first: this wall, then this room, then the whole building.
// Same shape as the existing roomWallColors / globalWallColor pair in materialsCatalog.ts.

import { RoomName } from "./rooms";

export type WallBandAxis = "horizontal" | "vertical";

export interface WallBand {
  /** Share of the wall this band takes, before normalisation. */
  sizeFrac: number;
  /** A WALL_COLORS id, or a raw "#rrggbb" from the colour wheel. */
  colorId: string;
}

export interface WallBandScheme {
  axis: WallBandAxis;
  bands: WallBand[];
}

export interface WallBandPreset {
  id: string;
  name: string;
  description: string;
  scheme: WallBandScheme;
}

/** A band's resolved span, as fractions of the wall along its axis. */
export interface ResolvedBand {
  start: number;
  end: number;
  colorId: string;
}

export const MAX_BANDS = 6;

// Presets are the real wall treatments, not arbitrary splits. A dado sits at roughly a third of
// wall height because that is where a chair back hits it; a picture rail sits high because it
// carries the frieze above it.
export const WALL_BAND_PRESETS: WallBandPreset[] = [
  {
    id: "dado",
    name: "Dado / Wainscot",
    description: "Darker lower third, light field above. The classic two-tone wall.",
    scheme: {
      axis: "horizontal",
      bands: [
        { sizeFrac: 0.35, colorId: "charcoal_slate" },
        { sizeFrac: 0.65, colorId: "arctic_white" },
      ],
    },
  },
  {
    id: "half_and_half",
    name: "Half and Half",
    description: "A single line straight across the middle. The bluntest comparison there is.",
    scheme: {
      axis: "horizontal",
      bands: [
        { sizeFrac: 0.5, colorId: "sage_mist" },
        { sizeFrac: 0.5, colorId: "warm_alabaster" },
      ],
    },
  },
  {
    id: "picture_rail",
    name: "Picture Rail",
    description: "Skirting band, field, and a frieze under the ceiling.",
    scheme: {
      axis: "horizontal",
      bands: [
        { sizeFrac: 0.14, colorId: "charcoal_slate" },
        { sizeFrac: 0.68, colorId: "warm_alabaster" },
        { sizeFrac: 0.18, colorId: "arctic_white" },
      ],
    },
  },
  {
    id: "accent_column",
    name: "Accent Column",
    description: "One deep vertical block against a neutral. Reads well behind a counter or bed.",
    scheme: {
      axis: "vertical",
      bands: [
        { sizeFrac: 0.62, colorId: "arctic_white" },
        { sizeFrac: 0.38, colorId: "royal_navy" },
      ],
    },
  },
  {
    id: "stripes_three",
    name: "Three Stripes",
    description: "Equal vertical thirds. Three candidate colours judged in the same light.",
    scheme: {
      axis: "vertical",
      bands: [
        { sizeFrac: 1, colorId: "warm_alabaster" },
        { sizeFrac: 1, colorId: "terracotta" },
        { sizeFrac: 1, colorId: "sage_mist" },
      ],
    },
  },
  {
    id: "swatch_four",
    name: "Four-Swatch Test",
    description: "Four equal vertical patches — a paint test board at full wall scale.",
    scheme: {
      axis: "vertical",
      bands: [
        { sizeFrac: 1, colorId: "arctic_white" },
        { sizeFrac: 1, colorId: "champagne_gold" },
        { sizeFrac: 1, colorId: "dusty_rose" },
        { sizeFrac: 1, colorId: "charcoal_slate" },
      ],
    },
  },
];

export function findPreset(id: string): WallBandPreset | undefined {
  return WALL_BAND_PRESETS.find((p) => p.id === id);
}

/**
 * The room instance id the rest of the app keys custom dimensions and openings by.
 *
 * Reproduced from how page.tsx builds `roomListWithSpecs` — it walks ROOM_NAMES and numbers each
 * occurrence, and the solver returns rooms in the order it was handed them, so counting
 * same-named rooms before this index gives the same `${name}_${n}` the rest of the app uses.
 * Deriving it beats threading ids into the renderer, and it survives the solver moving rooms.
 */
export function roomInstanceId(rooms: { name: string }[], index: number): string {
  const target = rooms[index];
  if (!target) return `room_${index}`;
  let n = 0;
  for (let k = 0; k < index; k++) {
    if (rooms[k]?.name === target.name) n++;
  }
  return `${target.name}_${n}`;
}

/** Stable key for one wall: the room instance id the rest of the app uses, plus the edge. */
export function wallBandKey(roomId: string, edge: "N" | "S" | "E" | "W"): string {
  return `${roomId}__${edge}`;
}

/**
 * Turn a scheme into spans over 0..1, normalising whatever the caller stored.
 *
 * Returns an empty list for a scheme that cannot paint anything — one band, no bands, or every
 * size zero — because a single band is just a wall colour and should go through the normal
 * wall-colour path instead of laying a redundant panel over it.
 */
export function resolveBands(scheme: WallBandScheme | undefined): ResolvedBand[] {
  if (!scheme || scheme.bands.length < 2) return [];
  const sizes = scheme.bands.map((b) => Math.max(0, b.sizeFrac));
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const out: ResolvedBand[] = [];
  let cursor = 0;
  scheme.bands.forEach((band, i) => {
    const span = sizes[i] / total;
    if (span <= 0) return;
    out.push({ start: cursor, end: cursor + span, colorId: band.colorId });
    cursor += span;
  });
  // Absorb float drift into the last band so the wall is covered exactly once.
  if (out.length > 0) out[out.length - 1].end = 1;
  return out;
}

export interface WallBandConfig {
  wallBands?: Record<string, WallBandScheme>;
  roomWallBands?: Partial<Record<RoomName, WallBandScheme>>;
  globalWallBands?: WallBandScheme;
}

/** The scheme that actually applies to one wall: wall override, then room, then building. */
export function resolveWallBandScheme(
  config: WallBandConfig,
  roomId: string,
  roomName: RoomName,
  edge: "N" | "S" | "E" | "W"
): WallBandScheme | undefined {
  return (
    config.wallBands?.[wallBandKey(roomId, edge)] ??
    config.roomWallBands?.[roomName] ??
    config.globalWallBands
  );
}

/** Even split across `count` bands, keeping whatever colours the current scheme already had. */
export function withBandCount(scheme: WallBandScheme, count: number): WallBandScheme {
  const n = Math.max(2, Math.min(MAX_BANDS, count));
  const fallback = ["arctic_white", "charcoal_slate", "sage_mist", "terracotta", "champagne_gold", "royal_navy"];
  const bands: WallBand[] = [];
  for (let i = 0; i < n; i++) {
    bands.push({
      sizeFrac: 1,
      colorId: scheme.bands[i]?.colorId ?? fallback[i % fallback.length],
    });
  }
  return { axis: scheme.axis, bands };
}

export function withBandColor(scheme: WallBandScheme, index: number, colorId: string): WallBandScheme {
  return {
    axis: scheme.axis,
    bands: scheme.bands.map((b, i) => (i === index ? { ...b, colorId } : b)),
  };
}

export function withAxis(scheme: WallBandScheme, axis: WallBandAxis): WallBandScheme {
  return { axis, bands: scheme.bands.map((b) => ({ ...b })) };
}
