// A photo of a house from outside to a facade finish and a generated interior, via
// POST /ai/facade-image — see backend/ai/facade_from_image.py.
//
// Two different kinds of claim come back and the UI has to keep them apart:
//
//   READ from the photograph — storey count, facade colour, facade texture, a two-tone band,
//   the glazing style, a style label. Surfaces the camera actually saw. Can be wrong.
//
//   GENERATED — the floor plan and every interior finish. A street photograph contains no interior
//   walls, so none of this is a reading of that house. It is a proposal for the plot the person
//   already set, solved by CP-SAT like any other plan.
//
// `summary()` below is the sentence that says so. Do not ship this feature without it: a generated
// layout presented as a reading of someone's house is notes/architecture/client-side-fallback.md
// with a camera attached.
//
// The palette is built here from the real catalogs and sent with the request, so the backend holds
// no copy of a frontend catalog to drift out of date, and the model can only pick ids this build
// can actually draw.

import { CustomDim } from "@/components/RoomCustomizer";
import {
  DOOR_COLORS,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
  WALL_TEXTURES,
} from "./materialsCatalog";
import { GLAZING_STYLES } from "./glazing";
import { PLAN_IMAGE_TYPES, readImageFile } from "./aiPlanImage";
import { RoomName, ROOM_NAMES } from "./rooms";
import { WallBandScheme } from "./wallBands";

const SOLVER_API_URL = process.env.NEXT_PUBLIC_SOLVER_URL ?? "http://localhost:8000";

export { PLAN_IMAGE_TYPES, readImageFile };

interface FacadeFields {
  facadeColor?: string;
  facadeTexture?: string;
  facadeBands?: WallBandScheme;
}

interface RoomFinishBody {
  floor?: string;
  wall_color?: string;
  wall_texture?: string;
  door_color?: string;
}

interface AIFacadeResponseBody {
  solve_request: {
    plot_w_in: number;
    plot_d_in: number;
    floors: number;
    rooms: string[];
    apply_vaastu: boolean;
  };
  facade: FacadeFields;
  interior: Record<string, RoomFinishBody>;
  glazing_style: string;
  style_label: string;
  unsupported: string[];
}

export interface AIFacadePlan {
  /** Read from the photograph. */
  floors: number;
  facade: FacadeFields;
  glazingStyle: string;
  styleLabel: string;
  /** Generated. Not a reading of the photographed building. */
  counts: Partial<Record<RoomName, number>>;
  /** Generated, keyed by room kind, ready to lay over the current material config. */
  interior: Pick<
    HouseMaterialConfig,
    "roomFloors" | "roomWallColors" | "roomWallTextures" | "roomDoorColors"
  >;
  unsupported: string[];
}

/** The finish ids this build can draw. Sent with the request so the model cannot invent one. */
function palette() {
  return {
    floors: FLOOR_MATERIALS.map((f) => f.id),
    wall_colors: WALL_COLORS.map((c) => c.id),
    wall_textures: WALL_TEXTURES.map((t) => t.id),
    door_colors: DOOR_COLORS.map((d) => d.id),
    glazing_styles: GLAZING_STYLES.map((g) => g.id),
  };
}

/**
 * The sentence the UI must show. Names what was read, what was invented, and what was dropped.
 *
 * Written here rather than at the call site so the honesty travels with the data instead of
 * depending on whoever wires the next surface up remembering to repeat it.
 */
export function summary(plan: AIFacadePlan): string {
  const read: string[] = [];
  if (plan.facade.facadeColor) read.push("facade colour");
  if (plan.facade.facadeTexture) read.push("facade finish");
  if (plan.facade.facadeBands) read.push("two-tone band");
  read.push(plan.floors === 1 ? "single storey" : `${plan.floors} storeys`);

  const rooms = Object.values(plan.counts).reduce((a, b) => a + (b ?? 0), 0);
  const style = plan.styleLabel ? ` Style read as ${plan.styleLabel}.` : "";

  return (
    `Read from your photo: ${read.join(", ")}.${style} ` +
    `The ${rooms}-room plan and every interior finish are GENERATED, not read — a photo from ` +
    `outside contains no interior walls. Plot size and facing came from your own settings, ` +
    `not from the image.`
  );
}

export async function requestAIFacade(
  base64: string,
  mediaType: string,
  plotWFt: number,
  plotDFt: number,
  note?: string
): Promise<AIFacadePlan> {
  let res: Response;
  try {
    res = await fetch(`${SOLVER_API_URL}/ai/facade-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: base64,
        media_type: mediaType,
        plot_w_ft: plotWFt,
        plot_d_ft: plotDFt,
        palette: palette(),
        note: note ?? null,
      }),
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
    throw new Error(`The backend could not read that photo (HTTP ${res.status}).`);
  }

  const body: AIFacadeResponseBody = await res.json();

  const counts: Partial<Record<RoomName, number>> = {};
  const known = new Set<string>(ROOM_NAMES);
  for (const name of body.solve_request.rooms) {
    if (!known.has(name)) {
      // The backend validated against its own catalog, so this only fires when the two
      // vocabularies have drifted apart. Say so rather than dropping the room quietly.
      body.unsupported.push(`${name} (this build of the app has no such room)`);
      continue;
    }
    const kind = name as RoomName;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }

  const interior: AIFacadePlan["interior"] = {
    roomFloors: {},
    roomWallColors: {},
    roomWallTextures: {},
    roomDoorColors: {},
  };
  for (const [kind, scheme] of Object.entries(body.interior)) {
    if (!known.has(kind)) continue;
    const room = kind as RoomName;
    if (scheme.floor) interior.roomFloors[room] = scheme.floor;
    if (scheme.wall_color) interior.roomWallColors[room] = scheme.wall_color;
    if (scheme.wall_texture) interior.roomWallTextures[room] = scheme.wall_texture;
    if (scheme.door_color) interior.roomDoorColors![room] = scheme.door_color;
  }

  return {
    floors: body.solve_request.floors,
    facade: body.facade,
    glazingStyle: body.glazing_style,
    styleLabel: body.style_label,
    counts,
    interior,
    unsupported: body.unsupported,
  };
}

/**
 * The material config this reading produces, laid over the one the app currently has.
 *
 * The facade fields and the per-room interior replace what is there; everything else — smoothness,
 * graphics tier, wall bands the person drew themselves — is left alone. The glazing style is
 * **stored with both targets off**: it is what the photo's windows look like, so it is the style
 * waiting in the panel if the person glazes a wall, but switching it on here would turn their
 * house into a glass box on the strength of one photograph.
 */
export function applyFacade(
  current: HouseMaterialConfig,
  plan: AIFacadePlan
): HouseMaterialConfig {
  return {
    ...current,
    ...plan.facade,
    roomFloors: plan.interior.roomFloors,
    roomWallColors: plan.interior.roomWallColors,
    roomWallTextures: plan.interior.roomWallTextures,
    roomDoorColors: plan.interior.roomDoorColors,
    globalGlazing: plan.glazingStyle
      ? { styleId: plan.glazingStyle, wall: false, door: false, mullions: 0 }
      : current.globalGlazing,
  };
}

/** A generated plan sets no per-room dimensions: the catalog and the solver size every room. */
export const NO_CUSTOM_DIMS: Record<string, CustomDim> = {};
