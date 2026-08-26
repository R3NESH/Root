// API client — notes/build/step-3-wire-together.md: fetch from FastAPI solver backend.

import { edgeSetbacksIn, Facing, Setback } from "./plot";
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

export async function requestSolve(
  args: SolveRequestArgs,
  signal?: AbortSignal
): Promise<SolveResponse> {
  const [frontIn, rightIn, rearIn, leftIn] = args.setback
    ? edgeSetbacksIn(args.facing, args.setback)
    : [60, 36, 60, 36];

  const payload = {
    plot_w_in: args.plotWIn,
    plot_d_in: args.plotDIn,
    facing: args.facing,
    rooms: args.rooms,
    setback: {
      front_in: frontIn,
      rear_in: rearIn,
      left_in: leftIn,
      right_in: rightIn,
    },
    prev: args.prev,
    moved_index: args.movedIndex,
    apply_vaastu: true,
  };

  const res = await fetch(`${SOLVER_API_URL}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Solver returned HTTP ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
