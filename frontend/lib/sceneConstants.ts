// Fixed 3D geometry for the renderer, in feet.
//
// Scene.tsx works in feet because Three.js does; state and the wire stay in integer inches per
// notes/decisions/integer-inches.md. The conversions below are written as `inches / 12` rather
// than a decimal so the Indian building dimension they come from stays legible.
//
// Anything the solver sends per-opening (`width_in`, `height_in`, `sill_in`) wins over the
// WINDOW_* and DOOR_* values here — those are only the fallback for an opening that arrives
// without dimensions. See notes/architecture/duplicated-geometry.md for why that direction
// matters: the renderer inventing its own geometry is the bug that note records.

export const PLOT_COLOR = 0xffffff;

// Day-mode site colours. The ground outside the plot used to be a sky blue (0x5a8ec6) that read
// as water rather than as a drawing sheet, and the plot itself a dark slate (0x1e293b) that made
// the house look like it sat on tarmac. White sheet, green plot: the plan reads as a building on
// a lawn, which is what the plot actually is before anyone builds on it.
//
// Not pure 0xffffff — under the day sun at 2.2 intensity with ACES tone mapping, pure white
// clips and the ground loses every shadow the building casts on it.
export const DAY_GROUND_COLOR = 0xf3f6f9;
export const DAY_PLOT_COLOR = 0x7fa663;   // mown lawn, not a golf green
export const NIGHT_PLOT_COLOR = 0x1e293b; // unchanged: the previous default dark slate
export const ACCENT = 0xe8912d;
export const HANDLE_RADIUS_FT = 0.55;

export const WALL_HEIGHT_FT = 9.0;
export const WALL_THICK_INT_FT = 4.5 / 12; // 0.375 ft — interior partition, Indian brick
export const DOOR_WIDTH_FT = 32 / 12; // 2.67 ft — matches connectivity.DOOR_WIDTH_IN
export const DOOR_HEIGHT_FT = 84 / 12; // 7.0 ft — matches connectivity.DOOR_HEIGHT_IN
export const BASEBOARD_H_FT = 4 / 12; // 0.33 ft
export const WINDOW_W_FT = 4.0;
export const WINDOW_H_FT = 4.2;
export const WINDOW_SILL_Y_FT = 2.8;
