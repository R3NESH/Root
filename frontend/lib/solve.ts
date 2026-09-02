// API client — notes/build/step-3-wire-together.md: fetch from FastAPI solver backend.

import { DEFAULT_SETBACK, edgeSetbacksIn, Facing, Setback } from "./plot";
import { ProgramKey } from "./programs";
import { RoomName, withCounts } from "./rooms";

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
  // Which programme was packed and what its directional rules are called. A cafe posts
  // service-flow zoning, not Vaastu, so `rules_applied` is the generic carrier and
  // `vaastu_constraints_applied` stays empty for it — backend/programs/registry.py.
  program?: string;
  rules_label?: string;
  rules_applied?: string[];
  rules_relaxed?: boolean;
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
  // Which building programme to pack. Omitted means "residence", which is what every caller
  // meant before there was a second one.
  program?: ProgramKey;
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
        rules_applied: [],
        rules_relaxed: false,
        program: args.program ?? "residence",
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
    else if (name === "seating") { defW = 216; defD = 192; }
    else if (name === "lounge") { defW = 144; defD = 132; }
    else if (name === "entry") { defW = 84; defD = 72; }
    else if (name === "queue") { defW = 54; defD = 132; }
    else if (name === "counter") { defW = 156; defD = 60; }
    else if (name === "prep") { defW = 156; defD = 132; }
    else if (name === "pantry") { defW = 84; defD = 84; }
    else if (name === "wash") { defW = 72; defD = 72; }
    else if (name === "washroom") { defW = 72; defD = 90; }
    else if (name === "staff") { defW = 96; defD = 96; }

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

    // Grand Entrance on Hall, Entrance Room, or a shop's street-facing Entry
    if (spec.name === "entrance" || spec.name === "entry") {
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
      // Same honesty for the second programme: no service-flow zoning was posted either.
      program: args.program ?? "residence",
      rules_applied: [],
      rules_relaxed: true,
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
    program: args.program ?? "residence",
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

export interface ParsedPromptClient {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  counts: Record<RoomName, number>;
  applyVaastu: boolean;
  rawPrompt: string;
}

export function parsePromptClient(prompt: string): ParsedPromptClient {
  const text = prompt.trim().toLowerCase();

  // 1. Dimensions
  let wFt = 30;
  let dFt = 40;
  const dimMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|\*|by|\'|ft)?\s*(?:x|\*|by)?\s*(\d+(?:\.\d+)?)\s*(?:ft|\'|feet|m|meter)?/i
  );
  if (dimMatch) {
    wFt = parseFloat(dimMatch[1]);
    dFt = parseFloat(dimMatch[2]);
  }

  // 2. Facing
  let facing: Facing = "N";
  if (/\b(north\s*-\s*east|ne)\b/i.test(text)) facing = "NE";
  else if (/\b(north\s*-\s*west|nw)\b/i.test(text)) facing = "NW";
  else if (/\b(south\s*-\s*east|se)\b/i.test(text)) facing = "SE";
  else if (/\b(south\s*-\s*west|sw)\b/i.test(text)) facing = "SW";
  else if (/\b(north|n\s*facing)\b/i.test(text)) facing = "N";
  else if (/\b(east|e\s*facing)\b/i.test(text)) facing = "E";
  else if (/\b(south|s\s*facing)\b/i.test(text)) facing = "S";
  else if (/\b(west|w\s*facing)\b/i.test(text)) facing = "W";

  // 3. BHK Counts
  const counts: Record<RoomName, number> = withCounts({
    hall: 1,
    kitchen: 1,
    bedroom: 2,
    bathroom: 2,
  });

  const bhkMatch = text.match(/(\d+)\s*(?:bhk|bed|bedroom)/i);
  const bhkCount = bhkMatch ? parseInt(bhkMatch[1], 10) : 2;

  if (bhkCount === 1) {
    counts.bedroom = 1;
    counts.bathroom = 1;
    counts.dining = 0;
  } else if (bhkCount === 2) {
    counts.bedroom = 2;
    counts.bathroom = 2;
    counts.dining = 1;
  } else if (bhkCount === 3) {
    counts.bedroom = 3;
    counts.bathroom = 2;
    counts.dining = 1;
  } else if (bhkCount >= 4) {
    counts.bedroom = Math.min(4, bhkCount);
    counts.bathroom = 3;
    counts.dining = 1;
  }

  if (/\b(pooja|puja|mandir|prayer)\b/i.test(text)) counts.pooja = 1;
  if (/\b(store|storage|pantry)\b/i.test(text)) counts.store = 1;
  if (/\b(dining)\b/i.test(text)) counts.dining = 1;
  if (/\b(entrance|foyer)\b/i.test(text)) counts.entrance = 1;

  const applyVaastu = !/\b(no\s*vaastu|ignore\s*vaastu|without\s*vaastu|no\s*vastu)\b/i.test(
    text
  );

  return {
    plotWIn: Math.round(wFt * 12),
    plotDIn: Math.round(dFt * 12),
    facing,
    counts,
    applyVaastu,
    rawPrompt: prompt,
  };
}

export async function solvePromptApi(prompt: string): Promise<any> {
  try {
    const res = await fetch(`${SOLVER_API_URL}/solve-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline
  }
  return null;
}

