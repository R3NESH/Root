// Client for POST /solve — notes/build/step-3-wire-together.md.
// Supports custom per-room dimensions (e.g. 15x15 ft bedroom).

import { Facing, Setback } from "./plot";
import { RoomName } from "./rooms";

const SOLVE_URL = process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000/solve";

export interface SolvedRoom {
  name: RoomName;
  floor: number;
  x_in: number;
  y_in: number;
  w_in: number;
  d_in: number;
  wall_thickness_in: number | null;
  openings: unknown[];
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
}

export interface SolveResponse {
  rooms: SolvedRoom[];
  meta: SolveMeta;
}

export interface RoomSpecIn {
  name: RoomName;
  custom_w_in?: number;
  custom_d_in?: number;
}

export interface SolveArgs {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  rooms: (RoomName | RoomSpecIn)[];
  setback: Setback;
  prev?: { index: number; x_in: number; y_in: number }[];
}

export async function requestSolve(args: SolveArgs, signal?: AbortSignal): Promise<SolveResponse> {
  const res = await fetch(SOLVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      plot_w_in: args.plotWIn,
      plot_d_in: args.plotDIn,
      facing: args.facing,
      rooms: args.rooms,
      setback: {
        front_in: args.setback.frontIn,
        rear_in: args.setback.rearIn,
        left_in: args.setback.leftIn,
        right_in: args.setback.rightIn,
      },
      prev: args.prev ?? null,
      apply_vaastu: true,
    }),
  });
  if (!res.ok) throw new Error(`solve failed: ${res.status}`);
  return res.json();
}
