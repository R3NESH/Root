// Static chrome for the 2D CAD view: SVG viewport geometry and the preset pills in the
// drafting inspector.
//
// Extracted from Blueprint2DView.tsx, where each of these was an array literal written inline
// inside the JSX and therefore rebuilt on every render. Naming them also puts the buildable
// dimensions in one place — the door widths below are the ones a joiner in India actually
// stocks, and 32 in is the same leaf the solver assumes in
// backend/solver/connectivity.py (DOOR_WIDTH_IN).

/** Base SVG coordinate system. Everything else scales into `drawW` x `drawH`. */
export const VIEW_W = 1200;
export const VIEW_H = 850;
export const PADDING = 140;
export const drawW = VIEW_W - PADDING * 2;
export const drawH = VIEW_H - PADDING * 2;

/** Indexed by frontCardinalIndex(): 0=N, 1=E, 2=S, 3=W. */
export const FACING_NAMES = ["NORTH", "EAST", "SOUTH", "WEST"];

export const FLOOR_LEVEL_PILLS = [
  { floor: 0, short: "G 🏡", title: "Ground Floor" },
  { floor: 1, short: "1F 🏢", title: "1st Floor" },
  { floor: 2, short: "2F 🏙️", title: "2nd Floor" },
  { floor: 3, short: "Roof ☀️", title: "Terrace / Roof" },
];

export const WALL_EDGES = ["N", "E", "S", "W"] as const;

export const OPENING_KINDS = ["door", "entrance", "window", "opening"] as const;

/** Feet. */
export const WALL_LENGTH_PRESETS_FT = [10, 12, 14, 16, 18, 20];

export const OPENING_WIDTH_PRESETS = [
  { label: "2′6″ (30″)", w: 30 },
  { label: "2′8″ (32″)", w: 32 },
  { label: "3′0″ (36″)", w: 36 },
  { label: "3′6″ (42″)", w: 42 },
  { label: "4′0″ (48″)", w: 48 },
  { label: "5′0″ (60″)", w: 60 },
];

export const OPENING_HEIGHT_PRESETS = [
  { label: "6′6″", h: 78 },
  { label: "7′0″ (Std)", h: 84 },
  { label: "7′6″", h: 90 },
  { label: "8′0″", h: 96 },
];
