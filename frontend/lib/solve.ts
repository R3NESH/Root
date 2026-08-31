// API client — notes/build/step-3-wire-together.md: fetch from FastAPI solver backend.

import { DEFAULT_SETBACK, edgeSetbacksIn, Facing, Setback } from "./plot";
import { RoomName } from "./rooms";

export interface RoomSpecIn {
  id?: string;
  name: string;
  custom_w_in?: number;
  custom_d_in?: number;
  min_w_in?: number;
  max_w_in?: number;
  min_d_in?: number;
  max_d_in?: number;
}

export interface SolvedRoom {
  name: string;
  floor: number;
  x_in: number;
  y_in: number;
  w_in: number;
  d_in: number;
  wall_thickness_in: number | null;
  // Room semantics carried through from the solver catalog so the renderer does not have to
  // re-derive them from the name — notes/solver/realism-gaps.md.
  habitable: boolean;
  wet: boolean;
  openings: RoomOpening[];
}

export interface RoomOpening {
  kind: "door" | "window" | "opening" | "entrance";
  edge: "N" | "S" | "E" | "W";
  offset_in: number;
  width_in: number;
  height_in: number;
  // Height of the sill above finished floor. Absent on doors, which start at the floor.
  sill_in?: number;
  to_room?: number | null;
}

export interface SolveMeta {
  status: string;
  solve_ms: number;
  vaastu_constraints_applied: string[];
  envelope_origin_x_in: number;
  envelope_origin_z_in: number;
  envelope_w_in: number;
  envelope_d_in: number;
  unknown_room_names: string[];
  entrance_edge: "N" | "S" | "E" | "W" | null;
  rooms_reachable: number;
  // The solver's relaxation ladder handed back a layout with no Vaastu rule posted, even though
  // the mix has rules. Distinct from an empty `vaastu_constraints_applied`, which is also the
  // correct answer for a mix that has no ruled room in it at all.
  vaastu_relaxed?: boolean;
}

export interface SolveResponse {
  rooms: SolvedRoom[];
  meta: SolveMeta;
}

export interface PrevRoomIn {
  index: number;
  x_in: number;
  y_in: number;
}

export interface SolveRequestArgs {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  rooms: (RoomName | RoomSpecIn)[];
  setback?: Setback;
  prev?: PrevRoomIn[];
  // Index of the room the user just dragged — only that room is released from its Vaastu
  // quadrant. See notes/solver/vaastu-and-connectivity-drop-on-edit.md.
  movedIndex?: number;
}

const SOLVER_API_URL = process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000";

// The status `solveClientSide()` reports. Deliberately not an OR-Tools status name: nothing about
// this layout was solved. The UI keys its warning off this exact string.
export const OFFLINE_ESTIMATE_STATUS = "OFFLINE_ESTIMATE";

function toCardinalEdge(facing: Facing): "N" | "S" | "E" | "W" {
  if (facing.includes("N")) return "N";
  if (facing.includes("S")) return "S";
  if (facing.includes("E")) return "E";
  return "W";
}

/**
 * Offline placeholder layout — NOT a solver.
 *
 * Runs in the browser only when the backend is unreachable. It drops rooms onto a fixed 2- or
 * 3-column grid: no CP-SAT, no Vaastu constraint, no adjacency, no daylight rule, no door graph.
 * It exists so the viewport has something to draw, not so the user has a plan.
 *
 * It must never report a guarantee it did not enforce — notes/architecture/client-side-fallback.md
 * and the "fallback must never claim Vaastu it did not enforce" rule in CLAUDE.md. That is why
 * `status`, `vaastu_constraints_applied` and `rooms_reachable` below say what they say.
 */
export function solveClientSide(args: SolveRequestArgs): SolveResponse {
  // edgeSetbacksIn returns FIXED WORLD ORIENTATION — [N, E, S, W] — not front/rear/left/right.
  // Naming them front/right/rear/left is what made requestSolve() below rotate them a second
  // time on every plot that does not face north.
  const [northIn, eastIn, southIn, westIn] = args.setback
    ? edgeSetbacksIn(args.facing, args.setback)
    : edgeSetbacksIn("N", DEFAULT_SETBACK);

  const envOriginX = westIn;
  const envOriginZ = northIn;
  const envW = Math.max(120, args.plotWIn - westIn - eastIn);
  const envD = Math.max(120, args.plotDIn - northIn - southIn);
  const cardinalFacing = toCardinalEdge(args.facing);

  const rawRooms = args.rooms || [];
  if (rawRooms.length === 0) {
    return {
      rooms: [],
      meta: {
        status: "Empty Plot",
        solve_ms: 1,
        vaastu_constraints_applied: [],
        envelope_origin_x_in: envOriginX,
        envelope_origin_z_in: envOriginZ,
        envelope_w_in: envW,
        envelope_d_in: envD,
        unknown_room_names: [],
        entrance_edge: cardinalFacing,
        rooms_reachable: 0,
        vaastu_relaxed: false,
      },
    };
  }

  // Parse room specifications
  const roomSpecs: {
    index: number;
    id: string;
    name: RoomName;
    wIn: number;
    dIn: number;
  }[] = rawRooms.map((r, idx) => {
    const isObj = typeof r === "object";
    const name = (isObj ? r.name : r) as RoomName;
    const id = isObj && r.id ? r.id : `${name}_${idx}`;

    // Standard baseline dimensions if custom sizes not provided
    let defW = 144;
    let defD = 144;
    if (name === "hall") { defW = 192; defD = 180; }
    else if (name === "kitchen") { defW = 120; defD = 120; }
    else if (name === "dining") { defW = 132; defD = 132; }
    else if (name === "bedroom") { defW = 144; defD = 156; }
    else if (name === "bathroom") { defW = 72; defD = 84; }
    else if (name === "pooja") { defW = 60; defD = 60; }
    else if (name === "store") { defW = 60; defD = 72; }
    else if (name === "entrance") { defW = 84; defD = 72; }

    const wIn = isObj && r.custom_w_in ? r.custom_w_in : defW;
    const dIn = isObj && r.custom_d_in ? r.custom_d_in : defD;

    return { index: idx, id, name, wIn, dIn };
  });

  // Calculate layout grid partitioning (e.g. 2 columns for 2-4 rooms, 3 columns for 5+ rooms)
  const numRooms = roomSpecs.length;
  const cols = numRooms <= 4 ? 2 : 3;
  const rows = Math.ceil(numRooms / cols);

  const cellW = envW / cols;
  const cellH = envD / rows;

  const solvedRooms: SolvedRoom[] = roomSpecs.map((spec, i) => {
    // Check if user previously moved or custom placed this room
    const prevPos = args.prev?.find((p) => p.index === i);
    let rw = spec.wIn;
    let rd = spec.dIn;
    let rx = 0;
    let rz = 0;

    if (prevPos) {
      rx = prevPos.x_in + envOriginX;
      rz = prevPos.y_in + envOriginZ;
    } else {
      const col = i % cols;
      const row = Math.floor(i / cols);
      rx = envOriginX + col * cellW;
      rz = envOriginZ + row * cellH;
      rw = Math.min(rw, cellW);
      rd = Math.min(rd, cellH);
    }

    // Openings: Doors & Windows
    const openings: RoomOpening[] = [];

    // Grand Entrance on Hall or Entrance Room
    if (spec.name === "entrance") {
      openings.push({
        kind: "entrance",
        edge: cardinalFacing,
        offset_in: Math.max(12, rw / 2 - 24),
        width_in: 48,
        height_in: 96,
      });
      openings.push({
        kind: "door",
        edge: "S",
        offset_in: 12,
        width_in: 32,
        height_in: 84,
      });
    } else if (spec.name === "hall") {
      openings.push({
        kind: "entrance",
        edge: cardinalFacing,
        offset_in: Math.max(12, rw / 2 - 24),
        width_in: 48,
        height_in: 96,
      });
      openings.push({
        kind: "window",
        edge: cardinalFacing === "N" ? "E" : "N",
        offset_in: Math.max(12, rw - 54),
        width_in: 48,
        height_in: 60,
        sill_in: 32,
      });
    } else if (spec.name === "bedroom") {
      openings.push({
        kind: "door",
        edge: "N",
        offset_in: 18,
        width_in: 34,
        height_in: 84,
      });
      openings.push({
        kind: "window",
        edge: "S",
        offset_in: Math.max(12, rw / 2 - 24),
        width_in: 48,
        height_in: 54,
        sill_in: 32,
      });
    } else if (spec.name === "kitchen") {
      openings.push({
        kind: "door",
        edge: "W",
        offset_in: 12,
        width_in: 32,
        height_in: 84,
      });
      openings.push({
        kind: "window",
        edge: "E",
        offset_in: Math.max(12, rw / 2 - 20),
        width_in: 40,
        height_in: 48,
        sill_in: 36,
      });
    } else if (spec.name === "bathroom") {
      openings.push({
        kind: "door",
        edge: "E",
        offset_in: 12,
        width_in: 28,
        height_in: 80,
      });
      openings.push({
        kind: "window",
        edge: "W",
        offset_in: Math.max(6, rw / 2 - 12),
        width_in: 24,
        height_in: 24,
        sill_in: 60,
      });
    } else {
      openings.push({
        kind: "door",
        edge: "N",
        offset_in: 12,
        width_in: 32,
        height_in: 84,
      });
      openings.push({
        kind: "window",
        edge: "S",
        offset_in: Math.max(12, rw / 2 - 18),
        width_in: 36,
        height_in: 48,
        sill_in: 32,
      });
    }

    return {
      name: spec.name,
      floor: 0,
      x_in: Math.round(rx),
      y_in: Math.round(rz),
      w_in: Math.round(rw),
      d_in: Math.round(rd),
      wall_thickness_in: 9.0,
      habitable: ["hall", "bedroom", "dining", "pooja", "entrance"].includes(spec.name),
      wet: ["bathroom", "kitchen"].includes(spec.name),
      openings,
    };
  });

  return {
    rooms: solvedRooms,
    meta: {
      // This engine posts no Vaastu constraint, runs no adjacency check and derives no door
      // graph, so it may not report any of them as satisfied — notes/architecture/client-side-fallback.md.
      status: OFFLINE_ESTIMATE_STATUS,
      solve_ms: 8,
      vaastu_constraints_applied: [],
      envelope_origin_x_in: envOriginX,
      envelope_origin_z_in: envOriginZ,
      envelope_w_in: envW,
      envelope_d_in: envD,
      unknown_room_names: [],
      entrance_edge: cardinalFacing,
      // Every opening below leaves `to_room` undefined, so the door graph is empty and the only
      // room reachable from the start is the start room itself.
      rooms_reachable: solvedRooms.length > 0 ? 1 : 0,
      vaastu_relaxed: true,
    },
  };
}

export async function requestSolve(
  args: SolveRequestArgs,
  signal?: AbortSignal
): Promise<SolveResponse> {
  // SetbackIn on the wire is facing-RELATIVE: the backend runs it back through
  // envelope.edge_setbacks_in(facing, ...) itself. Pass the caller's values straight through.
  // Rotating them here first meant they were rotated twice, so on an east-facing plot the 5 ft
  // road setback landed on the side boundary and the 3 ft side setback on the frontage.
  const setback = args.setback ?? DEFAULT_SETBACK;

  const payload = {
    plot_w_in: args.plotWIn,
    plot_d_in: args.plotDIn,
    facing: args.facing,
    rooms: args.rooms,
    setback: {
      front_in: setback.frontIn,
      rear_in: setback.rearIn,
      left_in: setback.leftIn,
      right_in: setback.rightIn,
    },
    prev: args.prev,
    moved_index: args.movedIndex,
    apply_vaastu: true,
  };

  let res: Response;
  try {
    res = await fetch(`${SOLVER_API_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw err;
    }
    // A thrown fetch is the only thing that means "the backend is not there". Fall back.
    return solveClientSide(args);
  }

  // A reply we do not like is a bug to surface, not a reason to invent a layout. A 422 or a 500
  // used to become a plan here — notes/architecture/client-side-fallback.md.
  if (!res.ok) {
    throw new Error(`Solver rejected the request (HTTP ${res.status})`);
  }
  return await res.json();
}
