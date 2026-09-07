// Free text to a room mix, via POST /ai/plan — see backend/ai/README.md.
//
// The endpoint hands back constraints, not a plan: the same body any other client would post to
// /solve. Nothing here places a room, and nothing here invents one. What the catalog could not
// express comes back in `unsupported`, and the caller has to show it — swallowing it is the
// defect in notes/architecture/client-side-fallback.md.
//
// There is deliberately no offline path. When the backend or the key is missing this throws,
// and the person is told, rather than being handed a mix somebody guessed.

import { ProgramKey } from "./programs";
import { RoomName, ROOM_NAMES } from "./rooms";
import { Facing } from "./plot";

const SOLVER_API_URL = process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000";

/** A pair the person asked to keep together, held by room id rather than by index. */
export type NearPairIds = [string, string];

export interface AIPlan {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  floors: number;
  counts: Partial<Record<RoomName, number>>;
  /**
   * Held as `bedroom_1`-style ids, not as the indices the API returned.
   *
   * The API's indices point into the room list the model produced, in the model's order. The
   * app rebuilds its own list from `counts` in ROOM_NAMES order, so those indices would point
   * at the wrong rooms by the time anything used them. Ids survive the reordering.
   */
  near: NearPairIds[];
  applyVaastu: boolean;
  unsupported: string[];
  assumedPlot: boolean;
  assumedFacing: boolean;
}

interface AIPlanResponseBody {
  solve_request: {
    plot_w_in: number;
    plot_d_in: number;
    facing: string;
    floors: number;
    rooms: string[];
    near: number[][];
    apply_vaastu: boolean;
  };
  unsupported: string[];
  assumed_plot: boolean;
  assumed_facing: boolean;
}

const FACINGS: Facing[] = ["N", "E", "S", "W"];

export async function requestAIPlan(prompt: string, program: ProgramKey = "residence"): Promise<AIPlan> {
  if (program !== "residence") {
    throw new Error("Free-text input is only wired to the residence programme.");
  }

  let res: Response;
  try {
    res = await fetch(`${SOLVER_API_URL}/ai/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    throw new Error("Could not reach the backend.");
  }

  if (res.status === 503) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "The backend has no Anthropic credential set.");
  }
  if (!res.ok) {
    throw new Error(`The backend could not read that (HTTP ${res.status}).`);
  }

  const body: AIPlanResponseBody = await res.json();
  const req = body.solve_request;

  // Count by kind, and record the id each of the model's positions turned into, so the pairs
  // can be re-expressed against ids in the same pass.
  const counts: Partial<Record<RoomName, number>> = {};
  const idAt: string[] = [];
  const known = new Set<string>(ROOM_NAMES);
  for (const name of req.rooms) {
    if (!known.has(name)) {
      // The backend already validated against its own catalog, so this only fires when the two
      // vocabularies have drifted apart. Say so rather than dropping the room quietly.
      body.unsupported.push(`${name} (this build of the app has no such room)`);
      idAt.push("");
      continue;
    }
    const kind = name as RoomName;
    const occurrence = counts[kind] ?? 0;
    counts[kind] = occurrence + 1;
    idAt.push(`${kind}_${occurrence}`);
  }

  const near: NearPairIds[] = [];
  for (const pair of req.near) {
    const a = idAt[pair[0]];
    const b = idAt[pair[1]];
    if (a && b && a !== b) near.push([a, b]);
  }

  const facing = (FACINGS as string[]).includes(req.facing) ? (req.facing as Facing) : "N";

  return {
    plotWIn: req.plot_w_in,
    plotDIn: req.plot_d_in,
    facing,
    floors: req.floors,
    counts,
    near,
    applyVaastu: req.apply_vaastu,
    unsupported: body.unsupported,
    assumedPlot: body.assumed_plot,
    assumedFacing: body.assumed_facing,
  };
}

/**
 * Turn id pairs into the indices the solver wants, against the room list actually being sent.
 *
 * A pair naming a room that is no longer in the mix — the person deleted it after asking — is
 * dropped rather than remapped onto whatever now sits at that position.
 */
export function nearIndices(
  pairs: NearPairIds[],
  roomIds: string[]
): number[][] {
  const positionOf = new Map(roomIds.map((id, i) => [id, i]));
  const out: number[][] = [];
  for (const [a, b] of pairs) {
    const i = positionOf.get(a);
    const j = positionOf.get(b);
    if (i != null && j != null && i !== j) out.push([i, j]);
  }
  return out;
}
