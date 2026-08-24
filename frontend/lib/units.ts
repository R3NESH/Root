// All lengths are integer inches on the wire and in state — see notes/decisions/integer-inches.md.
// Feet are a display/input convenience only; snap back to whole feet before it becomes state.

export const INCHES_PER_FOOT = 12;

export function feetToInches(feet: number): number {
  return Math.round(feet * INCHES_PER_FOOT);
}

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

export function snapToFoot(inches: number): number {
  return Math.round(inches / INCHES_PER_FOOT) * INCHES_PER_FOOT;
}

export function clampInches(inches: number, minInches: number, maxInches: number): number {
  return Math.min(maxInches, Math.max(minInches, inches));
}
