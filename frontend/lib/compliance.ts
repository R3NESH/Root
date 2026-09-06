// What the bye-law lets you build, and what the current plan actually builds.
//
// Until now the app answered neither. Setbacks were the hardcoded 5/5/3/3 ft in lib/plot.ts —
// notes/architecture/environment-notes.md calls that a known gap, not a convention — and nothing
// anywhere computed ground coverage or floor area ratio. That is the first question every owner
// and every architect asks of a plot, and "buildable floor plan" is the product's whole claim.
//
// ## Which rules
//
// Telangana, because that is the market (notes/decisions/india-only.md). The operative bye-law
// for GHMC and HMDA is **G.O. Ms. No. 168, dated 07-04-2012** — the Revised Common Building
// Rules — now filed through BuildNow (which replaced TS-bPASS/DPMS in December 2025).
//
// The important structural fact, and the reason this module is not an FSI calculator:
// **Telangana does not impose a fixed FSI cap.** Buildable volume is governed by setbacks, by a
// height ceiling tied to the abutting road width, and by what those two leave you. FAR is an
// *outcome* here, not a limit — so this module reports the FAR a plan achieves and never claims
// it passes or fails one.
//
// ## Confidence
//
// The tables below are transcribed from secondary references to G.O. Ms. 168, not from the
// gazetted PDF:
//
//   - https://infralens.in/dcr/setbacks/hyderabad  (Tables II, III and the height ceiling)
//   - https://www.studiomatrx.org/india/hyderabad/setbacks
//
// Those two do not agree in every detail — one keys the setback off plot size, the other off road
// width — and neither is the primary source. Treat these numbers as a well-sourced default that
// still has to be checked against the current notification before anything is filed, which is
// why every consumer of this module shows the rule it applied rather than only the result, and
// why the setbacks stay overridable.

import { PlotDims, plotPolygonIn, Setback } from "./plot";
import { SolvedRoom } from "./solve";
import { feetToInches } from "./units";

const SQ_M_PER_SQ_FT = 0.092903;
const M_TO_FT = 3.280839895;

/** Plots at or under this, built to ground or ground-plus-one, need registration on BuildNow
 *  rather than a sanctioned permission. 75 sq yd. */
export const PERMISSION_EXEMPT_SQ_YD = 75;

export interface ComplianceRule {
  /** Metres, as the bye-law states them. */
  frontM: number;
  sideM: number;
  rearM: number;
  /** Height ceiling from the abutting road width, in metres. Null above 30 m roads, where the
   *  rules stop capping height here and govern it another way. */
  maxHeightM: number | null;
  /** Which band was matched, for showing the user the rule and not just the number. */
  plotBand: string;
  roadBand: string;
}

export interface ComplianceReport {
  plotAreaSqFt: number;
  plotAreaSqM: number;
  plotAreaSqYd: number;
  /** Ground floor only: what the building actually covers. */
  footprintSqFt: number;
  /** Every storey the solver packed. */
  builtUpSqFt: number;
  /** Footprint over plot area, as a percentage. */
  groundCoveragePct: number;
  /** Built-up over plot area. An outcome in Telangana, not a limit — see the header. */
  achievedFar: number;
  /** How many floors the height ceiling allows at 10 ft floor to floor, or null when uncapped. */
  maxFloors: number | null;
  rule: ComplianceRule;
  /** The setback this rule requires, in the app's own units and orientation. */
  requiredSetback: Setback;
  /** True when the plot is small enough to be registered rather than sanctioned. */
  permissionExempt: boolean;
}

/**
 * Side and rear setbacks for a single-family dwelling up to 15 m, by plot area — G.O. Ms. 168
 * Table II. Front comes from Table III and is raised by the road width below.
 */
const SIDE_REAR_BY_AREA_SQ_M: Array<{ upToSqM: number; sideM: number; rearM: number; label: string }> = [
  { upToSqM: 100, sideM: 0, rearM: 0, label: "under 100 sq m" },
  { upToSqM: 200, sideM: 1.0, rearM: 1.0, label: "100-200 sq m" },
  { upToSqM: 300, sideM: 1.5, rearM: 1.5, label: "200-300 sq m" },
  { upToSqM: 500, sideM: 1.5, rearM: 2.0, label: "300-500 sq m" },
  { upToSqM: 750, sideM: 2.0, rearM: 3.0, label: "500-750 sq m" },
  { upToSqM: 1000, sideM: 2.5, rearM: 3.5, label: "750-1000 sq m" },
  { upToSqM: 2000, sideM: 3.0, rearM: 4.0, label: "1000-2000 sq m" },
  { upToSqM: Infinity, sideM: 4.0, rearM: 5.0, label: "over 2000 sq m" },
];

/** Front setback by plot area — Table III, for roads up to 12 m. */
const FRONT_BY_AREA_SQ_M: Array<{ upToSqM: number; frontM: number }> = [
  { upToSqM: 200, frontM: 1.5 },
  { upToSqM: 300, frontM: 2.0 },
  { upToSqM: Infinity, frontM: 3.0 },
];

/** Height ceiling by abutting road width. Null means the rules stop capping it here. */
const HEIGHT_BY_ROAD_M: Array<{ underRoadM: number; maxHeightM: number | null; label: string }> = [
  { underRoadM: 9, maxHeightM: 12, label: "road under 9 m" },
  { underRoadM: 12, maxHeightM: 15, label: "road 9-12 m" },
  { underRoadM: 18, maxHeightM: 18, label: "road 12-18 m" },
  { underRoadM: 24, maxHeightM: 30, label: "road 18-24 m" },
  { underRoadM: 30, maxHeightM: 45, label: "road 24-30 m" },
  { underRoadM: Infinity, maxHeightM: null, label: "road 30 m and over" },
];

/** Floor to floor, in feet. Matches WALL_HEIGHT_FT plus the slab in the renderer. */
export const FLOOR_TO_FLOOR_FT = 10.8;

export const DEFAULT_ROAD_WIDTH_M = 9;

/** The rule that applies to a plot of this area on a road of this width. */
export function ruleFor(plotAreaSqM: number, roadWidthM: number): ComplianceRule {
  const sideRear =
    SIDE_REAR_BY_AREA_SQ_M.find((b) => plotAreaSqM <= b.upToSqM) ??
    SIDE_REAR_BY_AREA_SQ_M[SIDE_REAR_BY_AREA_SQ_M.length - 1];
  const front =
    FRONT_BY_AREA_SQ_M.find((b) => plotAreaSqM <= b.upToSqM) ??
    FRONT_BY_AREA_SQ_M[FRONT_BY_AREA_SQ_M.length - 1];
  const height =
    HEIGHT_BY_ROAD_M.find((b) => roadWidthM < b.underRoadM) ??
    HEIGHT_BY_ROAD_M[HEIGHT_BY_ROAD_M.length - 1];

  // The front setback grows with the road: the table's plot-size value is the floor, and a wide
  // road raises it regardless of how small the plot is.
  let frontM = front.frontM;
  if (roadWidthM >= 30) frontM = Math.max(frontM, 6);
  else if (roadWidthM >= 18) frontM = Math.max(frontM, 4.5);
  else if (roadWidthM >= 12) frontM = Math.max(frontM, 3);

  return {
    frontM,
    sideM: sideRear.sideM,
    rearM: sideRear.rearM,
    maxHeightM: height.maxHeightM,
    plotBand: sideRear.label,
    roadBand: height.label,
  };
}

/** The rule's setbacks in the app's own units. */
export function setbackFromRule(rule: ComplianceRule): Setback {
  return {
    frontIn: Math.round(feetToInches(rule.frontM * M_TO_FT)),
    rearIn: Math.round(feetToInches(rule.rearM * M_TO_FT)),
    leftIn: Math.round(feetToInches(rule.sideM * M_TO_FT)),
    rightIn: Math.round(feetToInches(rule.sideM * M_TO_FT)),
  };
}

/** Area of a polygon in square feet, from vertices in inches. */
function polygonAreaSqFt(points: Array<[number, number]>): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    twice += x0 * y1 - x1 * y0;
  }
  return Math.abs(twice) / 2 / 144;
}

/**
 * What the plan builds, against what the rule allows. Every storey the solver packed is in
 * `rooms`, each carrying its own floor, so nothing here has to be told how many there are.
 */
export function assessCompliance(
  plot: PlotDims,
  rooms: SolvedRoom[],
  roadWidthM: number
): ComplianceReport {
  const plotAreaSqFt = polygonAreaSqFt(plotPolygonIn(plot));
  const plotAreaSqM = plotAreaSqFt * SQ_M_PER_SQ_FT;

  // Rooms are packed by add_no_overlap_2d *per floor*, so within a floor they never overlap and
  // the sum is the union exactly. Coverage is what the building puts on the ground — the ground
  // floor alone. Built-up is every storey, which is what FAR is measured on.
  const areaOf = (list: SolvedRoom[]) => list.reduce((t, r) => t + (r.w_in * r.d_in) / 144, 0);
  const footprintSqFt = areaOf(rooms.filter((r) => (r.floor ?? 0) === 0));
  const builtUpSqFt = areaOf(rooms);

  const rule = ruleFor(plotAreaSqM, roadWidthM);
  const maxFloors =
    rule.maxHeightM === null ? null : Math.max(1, Math.floor((rule.maxHeightM * M_TO_FT) / FLOOR_TO_FLOOR_FT));

  return {
    plotAreaSqFt: Math.round(plotAreaSqFt),
    plotAreaSqM: Math.round(plotAreaSqM),
    plotAreaSqYd: Math.round(plotAreaSqFt / 9),
    footprintSqFt: Math.round(footprintSqFt),
    groundCoveragePct: plotAreaSqFt > 0 ? Math.round((footprintSqFt / plotAreaSqFt) * 1000) / 10 : 0,
    builtUpSqFt: Math.round(builtUpSqFt),
    achievedFar: plotAreaSqFt > 0 ? Math.round((builtUpSqFt / plotAreaSqFt) * 100) / 100 : 0,
    maxFloors,
    rule,
    requiredSetback: setbackFromRule(rule),
    permissionExempt: plotAreaSqFt / 9 <= PERMISSION_EXEMPT_SQ_YD,
  };
}
