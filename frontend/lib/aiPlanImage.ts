// A photo of a floor plan to a room mix, via POST /ai/plan-image — see backend/ai/README.md.
//
// Same contract as aiPlan.ts, one input wider. The endpoint reads what is printed on the drawing
// and hands back constraints; nothing here places a room and nothing here invents one.
//
// **What comes back is not a tracing.** CP-SAT re-solves the mix, so the plan the person sees is
// a legal plan resembling the one they uploaded, not the one they uploaded. Room sizes read off
// the drawing arrive as a tolerance around each printed number rather than a pin — pinning them
// all is how a plan becomes INFEASIBLE instead of a house. Callers must say this out loud:
// presenting a re-solved plan as the person's own plan is the defect in
// notes/architecture/client-side-fallback.md with a camera attached.
//
// There is deliberately no offline path. Without the backend or the key this throws.

import { CustomDim } from "@/components/RoomCustomizer";
import { NearPairIds } from "./aiPlan";
import { Facing } from "./plot";
import { RoomName, ROOM_NAMES } from "./rooms";

const SOLVER_API_URL = process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000";

/** What the backend will accept. Checked here so a HEIC from an iPhone fails before the upload. */
export const PLAN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Mirrors MAX_IMAGE_BYTES in backend/ai/plan_from_image.py. */
export const MAX_PLAN_IMAGE_BYTES = 6 * 1024 * 1024;

export interface AIPlanFromImage {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  floors: number;
  counts: Partial<Record<RoomName, number>>;
  /** Dimensions read off the drawing, keyed by the `bedroom_0`-style id the app uses. */
  customDims: Record<string, CustomDim>;
  near: NearPairIds[];
  unsupported: string[];
  assumedPlot: boolean;
  assumedFacing: boolean;
  /** False when the drawing carried room names and no measurements. */
  readDimensions: boolean;
}

interface RoomSpecBody {
  name: string;
  min_w_in?: number;
  max_w_in?: number;
  min_d_in?: number;
  max_d_in?: number;
}

interface AIPlanImageResponseBody {
  solve_request: {
    plot_w_in: number;
    plot_d_in: number;
    facing: string;
    floors: number;
    rooms: RoomSpecBody[];
    near: number[][];
  };
  unsupported: string[];
  assumed_plot: boolean;
  assumed_facing: boolean;
  read_dimensions: boolean;
}

const FACINGS: Facing[] = ["N", "E", "S", "W"];

/** The base64 payload and media type of a picked file, without the `data:` prefix. */
export function readImageFile(file: File): Promise<{ base64: string; mediaType: string }> {
  if (!PLAN_IMAGE_TYPES.includes(file.type)) {
    return Promise.reject(
      new Error(`${file.type || "That file"} is not a JPEG, PNG, GIF or WebP image.`)
    );
  }
  if (file.size > MAX_PLAN_IMAGE_BYTES) {
    return Promise.reject(
      new Error(
        `That image is ${Math.round(file.size / (1024 * 1024))} MB. The limit is ${
          MAX_PLAN_IMAGE_BYTES / (1024 * 1024)
        } MB.`
      )
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      // readAsDataURL gives `data:image/png;base64,AAAA`. The backend rejects the prefix rather
      // than decoding past it, so strip it here instead of sending it and reading a 400.
      const comma = url.indexOf(",");
      if (comma < 0) {
        reject(new Error("Could not read that file."));
        return;
      }
      resolve({ base64: url.slice(comma + 1), mediaType: file.type });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The tolerance the backend put around each printed dimension, recovered from the band.
 *
 * The band arrives as min/max inches; the app holds a centre plus a tolerance in feet, which is
 * what RoomCustomizer shows and what page.tsx sends back to the solver.
 */
function centreAndTolerance(
  lo: number | undefined,
  hi: number | undefined
): { ft: number; tolFt: number } | null {
  if (lo == null || hi == null) return null;
  const centreFt = (lo + hi) / 2 / 12;
  const tolFt = (hi - lo) / 2 / 12;
  return { ft: Math.round(centreFt * 10) / 10, tolFt: Math.round(tolFt * 10) / 10 };
}

export async function requestAIPlanFromImage(
  base64: string,
  mediaType: string,
  note?: string
): Promise<AIPlanFromImage> {
  let res: Response;
  try {
    res = await fetch(`${SOLVER_API_URL}/ai/plan-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: base64, media_type: mediaType, note: note ?? null }),
    });
  } catch {
    throw new Error("Could not reach the backend.");
  }

  if (res.status === 503) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "The backend has no Anthropic credential set.");
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "The backend would not accept that image.");
  }
  if (!res.ok) {
    throw new Error(`The backend could not read that drawing (HTTP ${res.status}).`);
  }

  const body: AIPlanImageResponseBody = await res.json();
  const req = body.solve_request;

  // Count by kind, and record the id each of the backend's positions turned into, so the sizes
  // and the pairs can both be re-expressed against ids in the same pass — aiPlan.ts explains
  // why an index cannot survive the trip.
  const counts: Partial<Record<RoomName, number>> = {};
  const customDims: Record<string, CustomDim> = {};
  const idAt: string[] = [];
  const known = new Set<string>(ROOM_NAMES);

  for (const spec of req.rooms) {
    if (!known.has(spec.name)) {
      // The backend already validated against its own catalog, so this only fires when the two
      // vocabularies have drifted apart. Say so rather than dropping the room quietly.
      body.unsupported.push(`${spec.name} (this build of the app has no such room)`);
      idAt.push("");
      continue;
    }
    const kind = spec.name as RoomName;
    const occurrence = counts[kind] ?? 0;
    counts[kind] = occurrence + 1;
    const id = `${kind}_${occurrence}`;
    idAt.push(id);

    const width = centreAndTolerance(spec.min_w_in, spec.max_w_in);
    const depth = centreAndTolerance(spec.min_d_in, spec.max_d_in);
    if (width || depth) {
      customDims[id] = {
        // A drawing that printed one axis and left the other to the eye still told the truth
        // about the one it printed. The missing axis falls back to the catalog range, which is
        // what an absent dimension means everywhere else in the app.
        wFt: width?.ft ?? 0,
        dFt: depth?.ft ?? 0,
        tolFt: Math.max(width?.tolFt ?? 0, depth?.tolFt ?? 0),
      };
    }
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
    customDims,
    near,
    unsupported: body.unsupported,
    assumedPlot: body.assumed_plot,
    assumedFacing: body.assumed_facing,
    readDimensions: body.read_dimensions,
  };
}
