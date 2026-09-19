// A staircase solved from a drawn walk line, instead of chosen from a shelf of six.
//
// `lib/stairCatalog.ts` builds a stair from a catalog footprint: six named shapes, each a fixed
// width and depth, folded a fixed way. Two things are wrong with that. The footprint is a
// constant, so the stair cannot be fitted to the opening the house actually has; and a placed
// object is scaled uniformly by `PlacedCustomObject.scale`, which multiplies the riser and the
// going together — scale a compliant stair up and its riser passes 190 mm, scale it down and its
// going drops under 250 mm. A stair is the one object in the catalog that must never be scaled:
// the step size is fixed by code and by the human leg, and what changes with the space available
// is the *number* of steps and how they are folded.
//
// So the input here is the walk line. Click the points a person would walk, bottom to top, and
// the shape falls out of them:
//
//   2 points          one straight flight
//   3 points, 90 deg  a quarter-turn — an L
//   3 points, 180 deg a half-turn — the Indian dog-leg
//   4 points          two landings — a U, or a switchback round a core
//
// The six catalog shapes are that same set, pre-drawn. Nothing here replaces `stair_floating` or
// `stair_bifurcated`, which are construction styles rather than paths.
//
// ## The code minima are constraints, not preferences
//
// NBC 2016 for a one- or two-family dwelling: riser at most 190 mm (7.5 in), going at least
// 250 mm (9.8 in), flight at least 0.90 m (3 ft) wide, and a landing at least as long as the
// flight is wide. A path that cannot be walked inside those numbers is **rejected with the
// reason**, not built shallower — the same rule the plan solver holds to. See
// notes/decisions/zone-rule-is-a-constraint.md for why a posted rule is never a score.
//
// No `three` import, deliberately: this is arithmetic and wants to be runnable without a
// renderer. The mesh is built from the result elsewhere.

import { MAX_RISER_IN, MIN_FLIGHT_W_FT, MIN_TREAD_IN } from "./stairCatalog";

/**
 * Deepest going worth using. Past about 355 mm the tread stops reading as a step and the climb
 * starts asking for an odd stride; a path longer than the stair needs ends the stair early and
 * says so rather than stretching every tread to fill it.
 */
export const MAX_TREAD_IN = 14;

/** A point on the walk line, in plot feet. */
export interface StairPathPoint {
  xFt: number;
  zFt: number;
}

/** One straight run of steps along one segment of the walk line. */
export interface SolvedFlight {
  /** Which segment of the drawn path this flight sits on. */
  segment: number;
  /** Walk-line start of the first riser, in plot feet. */
  fromXFt: number;
  fromZFt: number;
  /** Walk-line end of the last riser, in plot feet. */
  toXFt: number;
  toZFt: number;
  /** Risers in this flight. The last one rises onto a landing or onto the upper floor. */
  risers: number;
  /** Height of the floor this flight starts from, in feet above the stair's base. */
  baseYFt: number;
  /** Bearing of the climb, radians, measured the way the renderer measures rotationY. */
  headingRad: number;
  /** Plan length consumed, ft. */
  runFt: number;
}

/** A square of floor where the stair turns. */
export interface SolvedLanding {
  xFt: number;
  zFt: number;
  /** Top of the landing slab, in feet above the stair's base. */
  yFt: number;
  sideFt: number;
  headingRad: number;
}

export interface SolvedStair {
  riserCount: number;
  riserIn: number;
  /** One going for the whole stair. Code requires every step in a flight to match. */
  treadIn: number;
  widthFt: number;
  totalRiseFt: number;
  flights: SolvedFlight[];
  landings: SolvedLanding[];
  /** Plan run the stair actually used, ft. */
  usedRunFt: number;
  /**
   * Run left over at the top, ft, when the drawn path was longer than the climb needed. The
   * stair stops short rather than stretching; this says by how much so the drawing can show it.
   */
  leftoverRunFt: number;
}

export type StairPathResult =
  | { ok: true; stair: SolvedStair }
  | { ok: false; problem: string };

interface Segment {
  index: number;
  headingRad: number;
  lengthFt: number;
  /**
   * A segment too short to hold its own landings and a step is not a flight at all — it is the
   * landing. That is exactly the cross leg of a dog-leg, the commonest stair in an Indian house:
   * up, across, up. Drawing it as three legs has to give a dog-leg, not an error.
   */
  isLink: boolean;
  /** Run this segment gives up to the landings at its ends. */
  landingCostFt: number;
  usableFt: number;
}

const EPS = 1e-6;

function heading(a: StairPathPoint, b: StairPathPoint): number {
  // Matches the renderer's rotationY convention: 0 looks along -z, turning towards +x.
  return Math.atan2(b.xFt - a.xFt, -(b.zFt - a.zFt));
}

/** Smallest angle between two headings, radians, always 0..PI. */
function turnBetween(h1: number, h2: number): number {
  let d = Math.abs(h2 - h1) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Fit a compliant staircase to a drawn walk line.
 *
 * `points` runs bottom to top. `totalRiseFt` is floor to floor — the renderer's wall height plus
 * its slab, not a constant, so a stair to a higher storey gets more risers rather than steeper
 * ones. `widthFt` is the flight width; it also sets the landing size, because a landing must be
 * at least as long as the flight is wide.
 */
export function solveStairPath(
  points: StairPathPoint[],
  totalRiseFt: number,
  widthFt: number
): StairPathResult {
  if (points.length < 2) {
    return { ok: false, problem: "A stair needs at least two points: where the climb starts and where it ends." };
  }
  if (totalRiseFt <= 0) {
    return { ok: false, problem: "There is no height to climb between these two levels." };
  }
  if (widthFt < MIN_FLIGHT_W_FT - EPS) {
    return {
      ok: false,
      problem: `A flight must be at least ${MIN_FLIGHT_W_FT} ft wide (NBC 2016). This one is ${widthFt.toFixed(2)} ft.`,
    };
  }

  // 1. Segments of the walk line.
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].xFt - points[i].xFt, points[i + 1].zFt - points[i].zFt);
    if (len < EPS) {
      return { ok: false, problem: `Points ${i + 1} and ${i + 2} are on top of each other.` };
    }
    segs.push({
      index: i,
      headingRad: heading(points[i], points[i + 1]),
      lengthFt: len,
      isLink: false,
      landingCostFt: 0,
      usableFt: len,
    });
  }

  // 2. A half turn needs the return leg set over by the flight width, or the two flights occupy
  //    the same floor. The drawn path is the only place that offset can come from.
  for (let i = 1; i < segs.length; i++) {
    const turn = turnBetween(segs[i - 1].headingRad, segs[i].headingRad);
    if (turn > (170 * Math.PI) / 180) {
      const a = points[i - 1];
      const c = points[i + 1];
      const h = segs[i - 1].headingRad;
      // Distance from C to the line A->B: how far the return leg is set over.
      const offset = Math.abs((c.xFt - a.xFt) * Math.cos(h) + (c.zFt - a.zFt) * Math.sin(h));
      if (offset < widthFt - EPS) {
        return {
          ok: false,
          problem:
            `The turn at point ${i + 1} is a half turn, so the return flight has to be set over by ` +
            `at least the flight width (${widthFt.toFixed(2)} ft). It is set over ${offset.toFixed(2)} ft.`,
        };
      }
    }
  }

  // 3. Classify. A leg that cannot hold half a landing at each end plus one going is the
  //    landing itself. The first and last legs have to be flights — a stair that begins or ends
  //    on a landing has not started or finished climbing.
  const landingSide = widthFt;
  const linkThresholdFt = landingSide + MIN_TREAD_IN / 12;
  for (let i = 0; i < segs.length; i++) {
    const short = segs[i].lengthFt < linkThresholdFt;
    if (short && (i === 0 || i === segs.length - 1)) {
      return {
        ok: false,
        problem:
          `The ${i === 0 ? "first" : "last"} leg is only ${segs[i].lengthFt.toFixed(2)} ft, which is ` +
          `not enough for a landing (${landingSide.toFixed(2)} ft) and a step. A stair cannot start ` +
          `or finish on a landing.`,
      };
    }
    segs[i].isLink = short && segs.length > 1;
  }
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].isLink && segs[i - 1].isLink) {
      return { ok: false, problem: `Legs ${i} and ${i + 1} are both too short to carry steps — two landings in a row.` };
    }
  }

  const flightSegs = segs.filter((sg) => !sg.isLink);
  if (flightSegs.length === 0) {
    return { ok: false, problem: "None of the legs drawn is long enough to carry steps." };
  }

  // 4. Landings eat run from the flights beside them — half a landing at each shared vertex,
  //    except where the neighbour is itself a link, because then the link *is* the landing and
  //    the flight runs right up to it.
  for (const sg of flightSegs) {
    let cost = 0;
    const before = segs[sg.index - 1];
    const after = segs[sg.index + 1];
    if (before && !before.isLink) cost += landingSide / 2;
    if (after && !after.isLink) cost += landingSide / 2;
    sg.landingCostFt = cost;
    sg.usableFt = sg.lengthFt - cost;
    if (sg.usableFt < MIN_TREAD_IN / 12 - EPS) {
      return {
        ok: false,
        problem:
          `Leg ${sg.index + 1} is ${sg.lengthFt.toFixed(2)} ft long and its landings take ` +
          `${cost.toFixed(2)} ft of that. There is no room left for a step.`,
      };
    }
  }

  // 5. Riser count comes from the height, not from the drawing. Equal risers throughout is the
  //    rule; the count is the smallest that keeps each one inside the cap.
  const riserCount = Math.ceil((totalRiseFt * 12) / MAX_RISER_IN);
  const riserIn = (totalRiseFt * 12) / riserCount;
  const riserFt = totalRiseFt / riserCount;

  // Each flight's top riser steps onto a landing or onto the upper floor, so it has no going of
  // its own. That is why the number of goings is the risers less the number of flights.
  const flightCount = flightSegs.length;
  const treadTotal = riserCount - flightCount;
  if (treadTotal < flightCount) {
    return {
      ok: false,
      problem:
        `${riserCount} risers cannot be folded into ${flightCount} flights — that leaves a flight ` +
        `with no tread at all. Draw fewer turns.`,
    };
  }

  // 6. One going for the whole stair, because code requires every step to match.
  //
  //    Picking it from the total run and then sharing the steps out does not work: each flight
  //    holds a whole number of goings, so a going that fits the sum can still fail to fit the
  //    parts. What is wanted is the deepest going whose *integer* capacity still holds every
  //    step — `sum(floor(usable_i / t)) >= treadTotal` — which is monotonic in t, so bisect it.
  const capacityAt = (tFt: number) =>
    flightSegs.reduce((sum, sg) => sum + Math.floor(sg.usableFt / tFt + EPS), 0);

  const minTreadFt = MIN_TREAD_IN / 12;
  if (capacityAt(minTreadFt) < treadTotal) {
    const neededFt =
      (treadTotal * MIN_TREAD_IN) / 12 + segs.reduce((sum, sg) => sum + (sg.isLink ? 0 : sg.landingCostFt), 0);
    const haveFt = segs.reduce((sum, sg) => sum + sg.lengthFt, 0);
    return {
      ok: false,
      problem:
        `This path is too short to climb ${totalRiseFt.toFixed(2)} ft. ` +
        `${riserCount} risers need ${treadTotal} goings of at least ${MIN_TREAD_IN} in — about ` +
        `${neededFt.toFixed(1)} ft of walk line once the landings are taken out, and you drew ` +
        `${haveFt.toFixed(1)} ft. Draw it longer, or add a turn to fold it.`,
    };
  }

  let lo = minTreadFt;
  let hi = MAX_TREAD_IN / 12;
  if (capacityAt(hi) >= treadTotal) {
    lo = hi;
  } else {
    for (let iter = 0; iter < 40; iter++) {
      const mid = (lo + hi) / 2;
      if (capacityAt(mid) >= treadTotal) lo = mid;
      else hi = mid;
    }
  }
  const treadFt = lo;
  const treadIn = treadFt * 12;

  // 7. Share the goings out. Proportional to the run each flight has, capped by what it can
  //    actually hold, largest remainder first so the totals land exactly.
  const caps = flightSegs.map((sg) => Math.floor(sg.usableFt / treadFt + EPS));
  const usableTotal = flightSegs.reduce((sum, sg) => sum + sg.usableFt, 0);
  const ideal = flightSegs.map((sg) => (sg.usableFt / usableTotal) * treadTotal);
  const treadsPer = ideal.map((v, i) => Math.min(caps[i], Math.max(1, Math.floor(v))));
  let assigned = treadsPer.reduce((a, b) => a + b, 0);

  while (assigned < treadTotal) {
    let best = -1;
    let bestRem = -Infinity;
    for (let i = 0; i < treadsPer.length; i++) {
      if (treadsPer[i] >= caps[i]) continue;
      const rem = ideal[i] - treadsPer[i];
      if (rem > bestRem) {
        bestRem = rem;
        best = i;
      }
    }
    // The bisection guaranteed the capacity, so this cannot run dry.
    if (best < 0) return { ok: false, problem: "The drawn path cannot hold every step. Draw it longer." };
    treadsPer[best] += 1;
    assigned += 1;
  }
  while (assigned > treadTotal) {
    let worst = 0;
    let worstRem = Infinity;
    for (let i = 0; i < treadsPer.length; i++) {
      if (treadsPer[i] <= 1) continue;
      const rem = ideal[i] - treadsPer[i];
      if (rem < worstRem) {
        worstRem = rem;
        worst = i;
      }
    }
    treadsPer[worst] -= 1;
    assigned -= 1;
  }

  // 8. Lay the flights and landings out along the path.
  const flights: SolvedFlight[] = [];
  const landings: SolvedLanding[] = [];
  let baseYFt = 0;
  let usedRunFt = 0;
  let flightNo = 0;

  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    const dirX = Math.sin(sg.headingRad);
    const dirZ = -Math.cos(sg.headingRad);

    if (sg.isLink) {
      // The whole leg is the landing, sitting at the height the flight below it reached.
      landings.push({
        xFt: (points[i].xFt + points[i + 1].xFt) / 2,
        zFt: (points[i].zFt + points[i + 1].zFt) / 2,
        yFt: baseYFt,
        sideFt: landingSide,
        headingRad: sg.headingRad,
      });
      usedRunFt += sg.lengthFt;
      continue;
    }

    const treads = treadsPer[flightNo];
    flightNo += 1;
    const risers = treads + 1;
    const runFt = treads * treadFt;
    // Start past the half-landing shared with the flight below, if there was one.
    const before = segs[i - 1];
    const startOffset = before && !before.isLink ? landingSide / 2 : 0;
    const fromXFt = points[i].xFt + dirX * startOffset;
    const fromZFt = points[i].zFt + dirZ * startOffset;

    flights.push({
      segment: i,
      fromXFt,
      fromZFt,
      toXFt: fromXFt + dirX * runFt,
      toZFt: fromZFt + dirZ * runFt,
      risers,
      baseYFt,
      headingRad: sg.headingRad,
      runFt,
    });

    baseYFt += risers * riserFt;
    usedRunFt += runFt + startOffset;

    // A landing at a vertex between two flights. Where the next leg is a link, that leg draws
    // the landing instead.
    const after = segs[i + 1];
    if (after && !after.isLink) {
      landings.push({
        xFt: points[i + 1].xFt,
        zFt: points[i + 1].zFt,
        yFt: baseYFt,
        sideFt: landingSide,
        headingRad: sg.headingRad,
      });
      usedRunFt += landingSide / 2;
    }
  }

  const drawnRunFt = segs.reduce((sum, s) => sum + s.lengthFt, 0);

  return {
    ok: true,
    stair: {
      riserCount,
      riserIn,
      treadIn,
      widthFt,
      totalRiseFt,
      flights,
      landings,
      usedRunFt,
      leftoverRunFt: Math.max(0, drawnRunFt - usedRunFt),
    },
  };
}
