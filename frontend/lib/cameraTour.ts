// The drone tour: a camera path round the outside of the house and then through the inside of
// it, solved from the plan rather than animated by hand.
//
// ## Why a path and not a generated video
//
// The trend this answers is photographs fed to a video model, which invents the space between
// the shots because there is no geometry anywhere. Here there is: rooms, walls, doors and
// furniture, all solved. A generated video would throw that away and hand back a walkthrough
// whose walls drift and whose doors move, which in a tool that outputs a buildable plan is a
// defect, not a feature — the same reason the offline fallback may never claim a constraint it
// did not enforce. So the camera move is generated and the pixels are rendered.
//
// ## The shape of the move
//
//   1. a high, wide orbit of the whole plot, starting and ending over the entrance
//   2. a descent onto the entrance, drone height falling to eye level
//   3. the inside, room by room, in the order the doors connect them
//   4. back out through the entrance and up
//
// Leg 3 walks the doorway graph rather than the room list, so the camera goes where a person
// could go. Every hop between two rooms is routed through the middle of the wall they share,
// which is the one point the two rectangles agree on — without it the spline cuts the corner and
// the camera passes through masonry.
//
// No `three` import: this is arithmetic over the plan and wants to be runnable, and checkable,
// without a renderer.

/** Metres per second is not this project's unit; everything here is feet and seconds. */
const DRONE_SPEED_FPS = 20;
/** Inside, a little above a walk — a tour that moves at survey pace is unwatchable. */
const INTERIOR_SPEED_FPS = 5.5;
/** How high the orbit flies above the ground. */
const DRONE_HEIGHT_FT = 30;
/** Orbit radius as a multiple of the building's own half-diagonal. */
const ORBIT_MARGIN = 1.9;
/** Samples round the exterior orbit. Enough that the spline reads as a circle. */
const ORBIT_SAMPLES = 16;

export interface TourRoom {
  name: string;
  xFt: number;
  zFt: number;
  wFt: number;
  dFt: number;
  floor: number;
}

export interface TourDoorway {
  a: number;
  b: number;
}

export interface TourInput {
  plotWFt: number;
  plotDFt: number;
  rooms: TourRoom[];
  doorways: TourDoorway[];
  /** Camera height while inside, feet. */
  eyeLevelFt: number;
  /** Floor to floor, feet — an upstairs room is toured at its own level. */
  storeyStepFt: number;
  /** Where the front door is, if the plan says. Otherwise the tour picks the outermost room. */
  entrance?: { xFt: number; zFt: number };
}

export interface TourKeyframe {
  x: number;
  y: number;
  z: number;
  /** Where the camera looks from this keyframe. */
  lx: number;
  ly: number;
  lz: number;
  /** Seconds from the start of the tour. */
  t: number;
}

export interface CameraTour {
  frames: TourKeyframe[];
  durationSec: number;
  /** Rooms visited, in order, for the caption strip. */
  roomOrder: number[];
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const rectOf = (r: TourRoom): Rect => ({
  minX: r.xFt,
  maxX: r.xFt + r.wFt,
  minZ: r.zFt,
  maxZ: r.zFt + r.dFt,
});

const centreOf = (r: TourRoom) => ({ x: r.xFt + r.wFt / 2, z: r.zFt + r.dFt / 2 });

/**
 * The point in the middle of the wall two rooms share.
 *
 * Returns null when they do not touch, which the caller treats as "no route that way" rather
 * than flying through the gap. The overlap test is deliberately loose by an inch: rooms that
 * abut are stored with their faces at the same coordinate, and an exact test loses to floating
 * point about half the time.
 */
export function sharedWallPoint(a: TourRoom, b: TourRoom): { x: number; z: number } | null {
  const ra = rectOf(a);
  const rb = rectOf(b);
  const EPS = 1 / 12;

  const zOverlap = Math.min(ra.maxZ, rb.maxZ) - Math.max(ra.minZ, rb.minZ);
  const xOverlap = Math.min(ra.maxX, rb.maxX) - Math.max(ra.minX, rb.minX);

  // Vertical wall: one room's right face is the other's left face.
  if (zOverlap > EPS) {
    if (Math.abs(ra.maxX - rb.minX) < EPS || Math.abs(rb.maxX - ra.minX) < EPS) {
      const x = Math.abs(ra.maxX - rb.minX) < EPS ? ra.maxX : ra.minX;
      return { x, z: (Math.max(ra.minZ, rb.minZ) + Math.min(ra.maxZ, rb.maxZ)) / 2 };
    }
  }
  // Horizontal wall.
  if (xOverlap > EPS) {
    if (Math.abs(ra.maxZ - rb.minZ) < EPS || Math.abs(rb.maxZ - ra.minZ) < EPS) {
      const z = Math.abs(ra.maxZ - rb.minZ) < EPS ? ra.maxZ : ra.minZ;
      return { x: (Math.max(ra.minX, rb.minX) + Math.min(ra.maxX, rb.maxX)) / 2, z };
    }
  }
  return null;
}

/**
 * The route: a walk over the doorway graph, not a list of rooms.
 *
 * Breadth first was wrong here, and wrong in a way that only shows up on screen. A breadth-first
 * *order* of a house whose rooms all open off the hall is hall, kitchen, bedroom, bath — and
 * kitchen and bedroom do not touch, so the camera crosses from one to the other through a wall.
 * A tour has to traverse edges, which means going back through the hall between branches.
 *
 * So this is a depth-first walk that emits the backtracking: enter a room, tour its subtree,
 * come back out the way it came in. Consecutive entries in the returned array are therefore
 * always connected by a door, which is exactly the property the camera path needs. The cost is
 * repeats — the hall is passed through several times, as a person would.
 *
 * Rooms the graph cannot reach are appended at the end rather than dropped: an unreachable room
 * is a bug worth seeing, not one worth hiding. `buildCameraTour` cuts the camera to those rather
 * than flying through a wall to reach them.
 */
export function tourOrder(rooms: TourRoom[], doorways: TourDoorway[], startIndex: number): number[] {
  const adj = new Map<number, number[]>();
  rooms.forEach((_, i) => adj.set(i, []));
  for (const d of doorways) {
    if (d.a < 0 || d.b < 0 || d.a >= rooms.length || d.b >= rooms.length) continue;
    // A doorway between storeys is not something the camera can fly along; the stair is, and
    // this graph does not model it. Same-floor edges only.
    if ((rooms[d.a].floor ?? 0) !== (rooms[d.b].floor ?? 0)) continue;
    adj.get(d.a)?.push(d.b);
    adj.get(d.b)?.push(d.a);
  }

  const seen = new Set<number>([startIndex]);
  const walk: number[] = [startIndex];

  const visit = (cur: number) => {
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      walk.push(n);
      visit(n);
      // Back out through the door we came in by, so the next branch starts from somewhere that
      // actually connects to it.
      walk.push(cur);
    }
  };
  visit(startIndex);

  // Trailing return to the room we started in is a wasted beat; the exit leg goes there anyway.
  while (walk.length > 1 && walk[walk.length - 1] === startIndex && walk[walk.length - 2] === startIndex) {
    walk.pop();
  }

  rooms.forEach((_, i) => {
    if (!seen.has(i)) walk.push(i);
  });
  return walk;
}

/** Which room the tour starts in: the one the entrance is in, or the one nearest the plot edge. */
function entranceRoom(input: TourInput): number {
  const ground = input.rooms.map((r, i) => ({ r, i })).filter((e) => (e.r.floor ?? 0) === 0);
  if (ground.length === 0) return 0;

  if (input.entrance) {
    const hit = ground.find((e) => {
      const rc = rectOf(e.r);
      return (
        input.entrance!.xFt >= rc.minX - 1 &&
        input.entrance!.xFt <= rc.maxX + 1 &&
        input.entrance!.zFt >= rc.minZ - 1 &&
        input.entrance!.zFt <= rc.maxZ + 1
      );
    });
    if (hit) return hit.i;
  }
  const hall = ground.find((e) => e.r.name === "hall");
  if (hall) return hall.i;

  // Nearest to any plot edge: the room a front door would most plausibly open into.
  let best = ground[0].i;
  let bestDist = Infinity;
  for (const e of ground) {
    const c = centreOf(e.r);
    const d = Math.min(c.x, input.plotWFt - c.x, c.z, input.plotDFt - c.z);
    if (d < bestDist) {
      bestDist = d;
      best = e.i;
    }
  }
  return best;
}

/**
 * Build the whole path.
 *
 * Keyframes carry a time, not an index, and the time is set from the distance travelled divided
 * by the speed for that leg. That is what keeps the camera moving at one pace: without it a 40 ft
 * hop round the outside and a 6 ft step through a doorway would each take one interval, and the
 * tour would lurch every time it went indoors.
 */
export function buildCameraTour(input: TourInput): CameraTour | null {
  if (input.rooms.length === 0) return null;

  // Building bounds, from the rooms themselves rather than a passed-in envelope.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of input.rooms) {
    minX = Math.min(minX, r.xFt);
    maxX = Math.max(maxX, r.xFt + r.wFt);
    minZ = Math.min(minZ, r.zFt);
    maxZ = Math.max(maxZ, r.zFt + r.dFt);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const halfDiag = Math.hypot(maxX - minX, maxZ - minZ) / 2;
  const radius = Math.max(halfDiag * ORBIT_MARGIN, 24);

  const startIdx = entranceRoom(input);
  const order = tourOrder(input.rooms, input.doorways, startIdx);
  const startCentre = centreOf(input.rooms[startIdx]);
  const tourFloor = input.rooms[startIdx].floor ?? 0;

  // The orbit begins and ends on the entrance side, so the descent flows out of the last lap
  // instead of cutting across the plot.
  const entryAngle = Math.atan2(startCentre.z - cz, startCentre.x - cx);

  // A keyframe is position plus a look-at; timing comes later, from the distances.
  const raw: Array<{ x: number; y: number; z: number; lx: number; ly: number; lz: number; speed: number }> = [];

  // 1. Exterior orbit, one full lap, looking at the middle of the house.
  for (let i = 0; i <= ORBIT_SAMPLES; i++) {
    const a = entryAngle + (i / ORBIT_SAMPLES) * Math.PI * 2;
    raw.push({
      x: cx + Math.cos(a) * radius,
      y: DRONE_HEIGHT_FT,
      z: cz + Math.sin(a) * radius,
      lx: cx,
      ly: 6,
      lz: cz,
      speed: DRONE_SPEED_FPS,
    });
  }

  // 2. Descent onto the entrance. Two steps, so the drop eases instead of dropping like a stone.
  const approachDir = { x: Math.cos(entryAngle), z: Math.sin(entryAngle) };
  const doorX = startCentre.x + approachDir.x * (halfDiag * 0.55);
  const doorZ = startCentre.z + approachDir.z * (halfDiag * 0.55);
  raw.push({
    x: cx + approachDir.x * radius * 0.62,
    y: DRONE_HEIGHT_FT * 0.55,
    z: cz + approachDir.z * radius * 0.62,
    lx: doorX,
    ly: input.eyeLevelFt,
    lz: doorZ,
    speed: DRONE_SPEED_FPS * 0.7,
  });
  raw.push({
    x: doorX,
    y: input.eyeLevelFt,
    z: doorZ,
    lx: startCentre.x,
    ly: input.eyeLevelFt,
    lz: startCentre.z,
    speed: DRONE_SPEED_FPS * 0.4,
  });

  // 3. Inside, room by room, routed through the wall each pair shares.
  // One storey per tour: the camera walks through doors, and there is no door between floors —
  // a stair is, and routing a flight is a different problem from routing a doorway. An upstairs
  // room is reached by flying through the slab, which looks like a bug because it is one.
  const interior = order.filter((idx) => (input.rooms[idx].floor ?? 0) === tourFloor);

  for (let k = 0; k < interior.length; k++) {
    const idx = interior[k];
    const room = input.rooms[idx];
    const c = centreOf(room);
    const floorY = tourFloor * input.storeyStepFt + input.eyeLevelFt;

    // A repeat is the walk backing out of a branch; it needs no second keyframe of its own.
    if (k > 0 && interior[k - 1] === idx) continue;

    if (k > 0) {
      const prev = input.rooms[interior[k - 1]];
      const gate = sharedWallPoint(prev, room);
      if (gate) {
        raw.push({
          x: gate.x,
          y: floorY,
          z: gate.z,
          lx: c.x,
          ly: floorY,
          lz: c.z,
          speed: INTERIOR_SPEED_FPS,
        });
      } else {
        // No shared wall: the walk should never produce this, and if it does the honest move is
        // to lift over the roof rather than pretend the wall is not there.
        raw.push({
          x: (centreOf(prev).x + c.x) / 2,
          y: DRONE_HEIGHT_FT * 0.7,
          z: (centreOf(prev).z + c.z) / 2,
          lx: c.x,
          ly: floorY,
          lz: c.z,
          speed: DRONE_SPEED_FPS * 0.6,
        });
      }
    }

    // Look ahead to the next room so the camera is already turning as it arrives; on the last
    // room there is nothing ahead, so it looks back the way it came.
    const nextIdx = interior[k + 1];
    const target =
      nextIdx !== undefined && nextIdx !== idx
        ? centreOf(input.rooms[nextIdx])
        : k > 0
        ? centreOf(input.rooms[interior[k - 1]])
        : { x: c.x, z: c.z - 1 };

    raw.push({
      x: c.x,
      y: floorY,
      z: c.z,
      lx: target.x,
      ly: floorY,
      lz: target.z,
      speed: INTERIOR_SPEED_FPS,
    });
  }

  // 4. Out and up, ending where the orbit began so the tour can loop.
  raw.push({
    x: doorX,
    y: input.eyeLevelFt,
    z: doorZ,
    lx: cx + approachDir.x * radius,
    ly: DRONE_HEIGHT_FT,
    lz: cz + approachDir.z * radius,
    speed: INTERIOR_SPEED_FPS,
  });
  raw.push({
    x: cx + Math.cos(entryAngle) * radius,
    y: DRONE_HEIGHT_FT,
    z: cz + Math.sin(entryAngle) * radius,
    lx: cx,
    ly: 6,
    lz: cz,
    speed: DRONE_SPEED_FPS * 0.6,
  });

  // Timing: distance since the last keyframe, over the speed for that leg.
  const frames: TourKeyframe[] = [];
  let t = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) {
      const p = raw[i - 1];
      const q = raw[i];
      const dist = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      t += dist / Math.max(0.5, q.speed);
    }
    frames.push({ x: raw[i].x, y: raw[i].y, z: raw[i].z, lx: raw[i].lx, ly: raw[i].ly, lz: raw[i].lz, t });
  }

  return { frames, durationSec: t, roomOrder: interior };
}

/** Catmull-Rom through four control values. */
function catmull(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3)
  );
}

/**
 * Where the camera is, and what it is looking at, `seconds` into the tour.
 *
 * Position and look-at are splined separately. Deriving the look-at from the direction of travel
 * instead would whip the view round every corner, because the corner is where the direction
 * changes fastest and where the eye most wants to be still.
 */
export function sampleCameraTour(
  tour: CameraTour,
  seconds: number
): { pos: [number, number, number]; look: [number, number, number] } {
  const f = tour.frames;
  if (f.length === 1) {
    return { pos: [f[0].x, f[0].y, f[0].z], look: [f[0].lx, f[0].ly, f[0].lz] };
  }
  const clamped = Math.max(0, Math.min(tour.durationSec, seconds));

  let i = 0;
  while (i < f.length - 2 && f[i + 1].t < clamped) i += 1;
  const span = Math.max(1e-6, f[i + 1].t - f[i].t);
  const s = Math.max(0, Math.min(1, (clamped - f[i].t) / span));

  const at = (k: number) => f[Math.max(0, Math.min(f.length - 1, k))];
  const p0 = at(i - 1);
  const p1 = at(i);
  const p2 = at(i + 1);
  const p3 = at(i + 2);

  return {
    pos: [
      catmull(p0.x, p1.x, p2.x, p3.x, s),
      catmull(p0.y, p1.y, p2.y, p3.y, s),
      catmull(p0.z, p1.z, p2.z, p3.z, s),
    ],
    look: [
      catmull(p0.lx, p1.lx, p2.lx, p3.lx, s),
      catmull(p0.ly, p1.ly, p2.ly, p3.ly, s),
      catmull(p0.lz, p1.lz, p2.lz, p3.lz, s),
    ],
  };
}
