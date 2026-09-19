// Staircases you place by hand.
//
// The solver already puts a stair core in a multi-storey plan (backend/api/main.py) — one
// dog-leg, sized and positioned by the packer, take it or leave it. This is the other half: the
// stair as something an architect chooses and puts where they want it, in the shape the house
// asks for.
//
// ## The geometry is not decorative
//
// Every flight here is generated from the same floor-to-floor rise and holds to NBC 2016 for a
// one- or two-family dwelling: **riser at most 190 mm (7.5 in), tread at least 250 mm (9.8 in),
// flight at least 0.90 m (3 ft) wide, handrail at 0.90 m**. A 10.55 ft rise therefore needs 17
// risers, which is what every style below uses — the shapes differ in how those 17 are folded
// into the footprint, which is exactly what choosing a stair type means:
//
// The footprints in FURNITURE_CATALOG are sized so that the going stays over the 9.8 in floor at
// that riser count. They did not all clear it before: at the old 16 risers the L-shape came out
// at 9.75 in and the winder at 9.26 in, so two of the six presets had been quietly breaking the
// rule this file opens by stating. Raising the storey height is what surfaced it.
//
//   - straight    one run. Cheapest to build, longest footprint: 14 ft of floor.
//   - l_shaped    quarter turn on a landing. A 10.5 ft square, because 13.1 ft of run split over
//                 two legs plus the landing is what a compliant L actually measures.
//   - dog_leg     half turn on a landing. The Indian default, and what the solver's core is.
//   - winder      quarter turn on three kite treads instead of a landing. About a foot off each
//                 leg against the L-shape, which is the whole reason to accept a narrower walk
//                 line at the corner.
//   - floating    cantilevered treads off a wall, no stringer. Needs a structural wall behind.
//   - bifurcated  one wide flight to a landing, splitting into two returns. Wants 11 x 12 ft.
//
// Sources for the type vocabulary and the code minima are recorded in
// notes/blueprints/stair-styles.md.
//
// ## What it does not do
//
// A placed stair does not connect storeys the way the solver's core does: it cuts no opening in
// the slab above and is not part of the reachability check. It is drawn, walked around, and
// costed by its footprint like any other placed object. Raising Storeys is still what gets you a
// structural stair.

import * as THREE from "three";

// Type only, so importing the solver here does not make a runtime cycle: stairPath.ts reads the
// code minima out of this file.
import type { SolvedStair } from "./stairPath";

/** Floor to floor, in feet. Matches WALL_HEIGHT_FT + SLAB_T in the renderer. */
export const STAIR_RISE_FT = 10.55;

/** NBC 2016, one- and two-family dwellings. */
export const MAX_RISER_IN = 7.5;
export const MIN_TREAD_IN = 9.8;
export const MIN_FLIGHT_W_FT = 3.0;

/** 16 risers over the standard rise gives 7.16 in, inside the cap with room to spare. */
export const RISERS = Math.ceil((STAIR_RISE_FT * 12) / MAX_RISER_IN);

export type StairStyleId =
  | "stair_straight"
  | "stair_l_shaped"
  | "stair_dog_leg"
  | "stair_winder"
  | "stair_floating"
  | "stair_bifurcated";

export const STAIR_TYPES: StairStyleId[] = [
  "stair_straight",
  "stair_l_shaped",
  "stair_dog_leg",
  "stair_winder",
  "stair_floating",
  "stair_bifurcated",
];

export function isStairType(type: string): type is StairStyleId {
  return (STAIR_TYPES as string[]).includes(type);
}

interface Materials {
  tread: THREE.MeshStandardMaterial;
  landing: THREE.MeshStandardMaterial;
  rail: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

function materials(colorHex?: number): Materials {
  return {
    tread: new THREE.MeshStandardMaterial({ color: colorHex ?? 0x8d6e52, roughness: 0.55 }),
    landing: new THREE.MeshStandardMaterial({ color: 0xd9d3c8, roughness: 0.8 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.35, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
  };
}

/**
 * One flight, climbing along +z from (0, baseY, 0). `solid` draws each step down to the floor,
 * which is what a flight against a wall looks like; otherwise the treads are slabs with the
 * void under them, which is what a return flight over a stairwell looks like.
 */
function flight(
  group: THREE.Group,
  mats: Materials,
  opts: {
    steps: number;
    riser: number;
    tread: number;
    width: number;
    x: number;
    z: number;
    baseY: number;
    solid: boolean;
    /** -1 climbs along -z instead. */
    dir?: 1 | -1;
  }
): void {
  const { steps, riser, tread, width, x, z, baseY, solid } = opts;
  const dir = opts.dir ?? 1;
  for (let i = 0; i < steps; i++) {
    const top = baseY + riser * (i + 1);
    const h = solid ? top : 0.42;
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, h, tread), mats.tread);
    step.position.set(x, solid ? h / 2 : top - 0.21, z + dir * tread * (i + 0.5));
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }
}

function landingSlab(
  group: THREE.Group,
  mats: Materials,
  w: number,
  d: number,
  x: number,
  z: number,
  topY: number
): void {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), mats.landing);
  slab.position.set(x, topY - 0.21, z);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);
}

/** A rail following a flight: a sloped top rail on two posts. */
function railAlong(
  group: THREE.Group,
  mats: Materials,
  opts: { run: number; rise: number; x: number; z: number; baseY: number; dir?: 1 | -1 }
): void {
  const dir = opts.dir ?? 1;
  const len = Math.hypot(opts.run, opts.rise);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), mats.rail);
  rail.position.set(opts.x, opts.baseY + opts.rise / 2 + 3.0, opts.z + (dir * opts.run) / 2);
  rail.rotation.x = -dir * Math.atan2(opts.rise, opts.run);
  group.add(rail);

  for (const t of [0.05, 0.95]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 0.1), mats.rail);
    post.position.set(
      opts.x,
      opts.baseY + opts.rise * t + 1.5,
      opts.z + dir * opts.run * t
    );
    group.add(post);
  }
}

/**
 * Build one staircase, centred on its own footprint origin like every other placed object.
 * `footprint` is the catalog's declared width and depth, so the flight fills what the plan
 * reserved for it rather than floating inside it.
 */
export function buildStair(
  type: StairStyleId,
  footprintWFt: number,
  footprintDFt: number,
  colorHex?: number
): THREE.Group {
  const root = new THREE.Group();
  const mats = materials(colorHex);
  const rise = STAIR_RISE_FT;
  const riser = rise / RISERS;
  // Origin at the middle of the footprint; build from its near-left corner.
  const x0 = -footprintWFt / 2;
  const z0 = -footprintDFt / 2;

  if (type === "stair_straight" || type === "stair_floating") {
    const width = Math.max(MIN_FLIGHT_W_FT, footprintWFt - 0.5);
    const tread = (footprintDFt - 0.5) / RISERS;
    flight(root, mats, {
      steps: RISERS,
      riser,
      tread,
      width,
      x: 0,
      z: z0 + 0.25,
      baseY: 0,
      solid: type === "stair_straight",
    });
    if (type === "stair_floating") {
      // Cantilevered off the wall it is fixed to, with a glass balustrade on the open side.
      const balustrade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 3.2, Math.hypot(footprintDFt - 0.5, rise)),
        mats.glass
      );
      balustrade.position.set(width / 2, rise / 2 + 1.6, 0);
      balustrade.rotation.x = -Math.atan2(rise, footprintDFt - 0.5);
      root.add(balustrade);
    } else {
      railAlong(root, mats, {
        run: footprintDFt - 0.5,
        rise,
        x: width / 2,
        z: z0 + 0.25,
        baseY: 0,
      });
    }
    return root;
  }

  if (type === "stair_dog_leg") {
    const flightW = Math.max(MIN_FLIGHT_W_FT, footprintWFt / 2 - 0.4);
    const landingD = 3.2;
    const run = footprintDFt - landingD - 0.4;
    const per = RISERS / 2;
    const tread = run / per;

    flight(root, mats, {
      steps: per,
      riser,
      tread,
      width: flightW,
      x: x0 + flightW / 2 + 0.2,
      z: z0 + 0.2,
      baseY: 0,
      solid: true,
    });
    landingSlab(root, mats, footprintWFt - 0.4, landingD, 0, z0 + footprintDFt - landingD / 2 - 0.2, rise / 2);
    flight(root, mats, {
      steps: per,
      riser,
      tread,
      width: flightW,
      x: x0 + footprintWFt - flightW / 2 - 0.2,
      z: z0 + footprintDFt - landingD - 0.2,
      baseY: rise / 2,
      solid: false,
      dir: -1,
    });
    railAlong(root, mats, { run, rise: rise / 2, x: x0 + flightW + 0.3, z: z0 + 0.2, baseY: 0 });
    return root;
  }

  if (type === "stair_l_shaped" || type === "stair_winder") {
    // Capped, not just floored: letting the flight grow with the footprint eats the run the
    // treads need, and a wider flight with a shorter tread is the wrong trade every time.
    const flightW = Math.max(MIN_FLIGHT_W_FT, Math.min(3.6, Math.min(footprintWFt, footprintDFt) / 2));
    const isWinder = type === "stair_winder";
    // The winder turns on three kite treads instead of a landing, which is the 3 ft of run it
    // saves and the reason anyone builds one.
    const turnSteps = isWinder ? 3 : 0;
    const lower = Math.round((RISERS - turnSteps) / 2);
    const upper = RISERS - turnSteps - lower;
    const runLower = footprintDFt - flightW - 0.4;
    const runUpper = footprintWFt - flightW - 0.4;

    flight(root, mats, {
      steps: lower,
      riser,
      tread: runLower / lower,
      width: flightW,
      x: x0 + flightW / 2 + 0.2,
      z: z0 + 0.2,
      baseY: 0,
      solid: true,
    });

    const turnY = riser * lower;
    const turnX = x0 + flightW / 2 + 0.2;
    const turnZ = z0 + footprintDFt - flightW / 2 - 0.2;

    if (isWinder) {
      for (let i = 0; i < turnSteps; i++) {
        const kite = new THREE.Mesh(
          new THREE.BoxGeometry(flightW, riser * (lower + i + 1), flightW / turnSteps),
          mats.tread
        );
        kite.position.set(
          turnX,
          (riser * (lower + i + 1)) / 2,
          turnZ - flightW / 2 + (flightW / turnSteps) * (i + 0.5)
        );
        kite.rotation.y = ((i + 1) * Math.PI) / (turnSteps * 2 + 2);
        kite.castShadow = true;
        root.add(kite);
      }
    } else {
      landingSlab(root, mats, flightW, flightW, turnX, turnZ, turnY);
    }

    // Upper flight, turning 90 degrees and climbing along +x. Built as a rotated child so the
    // same flight() writes it.
    const upperGroup = new THREE.Group();
    flight(upperGroup, mats, {
      steps: upper,
      riser,
      tread: runUpper / upper,
      width: flightW,
      x: 0,
      z: 0,
      baseY: riser * (lower + turnSteps),
      solid: !isWinder,
    });
    upperGroup.rotation.y = -Math.PI / 2;
    upperGroup.position.set(turnX + flightW / 2, 0, turnZ);
    root.add(upperGroup);
    return root;
  }

  // Bifurcated: one wide flight to a half-landing, then two returns going back either side.
  const wideW = Math.max(MIN_FLIGHT_W_FT * 1.6, footprintWFt * 0.45);
  const returnW = Math.max(MIN_FLIGHT_W_FT, footprintWFt * 0.26);
  const landingD = 3.4;
  const run = footprintDFt - landingD - 0.4;
  const per = RISERS / 2;

  flight(root, mats, {
    steps: per,
    riser,
    tread: run / per,
    width: wideW,
    x: 0,
    z: z0 + 0.2,
    baseY: 0,
    solid: true,
  });
  landingSlab(root, mats, footprintWFt - 0.4, landingD, 0, z0 + footprintDFt - landingD / 2 - 0.2, rise / 2);
  for (const side of [-1, 1]) {
    flight(root, mats, {
      steps: per,
      riser,
      tread: run / per,
      width: returnW,
      x: side * (footprintWFt / 2 - returnW / 2 - 0.2),
      z: z0 + footprintDFt - landingD - 0.2,
      baseY: rise / 2,
      solid: false,
      dir: -1,
    });
  }
  railAlong(root, mats, { run, rise: rise / 2, x: wideW / 2, z: z0 + 0.2, baseY: 0 });
  railAlong(root, mats, { run, rise: rise / 2, x: -wideW / 2, z: z0 + 0.2, baseY: 0 });
  return root;
}

/**
 * Build a staircase from a solved walk line (lib/stairPath.ts).
 *
 * Meshes land at absolute plot feet, with y measured from the stair's own base, so the caller
 * lifts the whole group to the storey's floor level and nothing else. That matches how a drawn
 * wall is handled — rebuilt from its coordinates rather than carried around by a transform.
 *
 * Each flight is a sub-group parked at the flight's start and turned to its bearing, which lets
 * `flight()`, `railAlong()` and `landingSlab()` above be reused exactly as the catalog shapes use
 * them: `dir: -1` climbs along local -z, and heading 0 is -z in the renderer's convention, so the
 * rotation maps one onto the other with no second code path.
 */
export function buildStairFromPath(stair: SolvedStair, colorHex?: number): THREE.Group {
  const root = new THREE.Group();
  const mats = materials(colorHex);
  const riserFt = stair.totalRiseFt / stair.riserCount;
  const treadFt = stair.treadIn / 12;

  for (const f of stair.flights) {
    const sub = new THREE.Group();
    sub.position.set(f.fromXFt, f.baseYFt, f.fromZFt);
    sub.rotation.y = f.headingRad;
    root.add(sub);

    // Solid steps: a drawn stair sits on the floor it climbs from, so there is no stairwell void
    // under it to show. A return flight over its own well would want `solid: false`, which is a
    // question about the slab opening this tool does not cut yet.
    flight(sub, mats, {
      steps: f.risers,
      riser: riserFt,
      tread: treadFt,
      width: stair.widthFt,
      x: 0,
      z: 0,
      baseY: 0,
      solid: true,
      dir: -1,
    });

    for (const side of [-1, 1]) {
      railAlong(sub, mats, {
        run: f.runFt,
        rise: f.risers * riserFt,
        x: (side * stair.widthFt) / 2,
        z: 0,
        baseY: 0,
        dir: -1,
      });
    }
  }

  for (const l of stair.landings) {
    const sub = new THREE.Group();
    sub.position.set(l.xFt, 0, l.zFt);
    sub.rotation.y = l.headingRad;
    root.add(sub);
    landingSlab(sub, mats, l.sideFt, l.sideFt, 0, 0, l.yFt);
  }

  return root;
}
