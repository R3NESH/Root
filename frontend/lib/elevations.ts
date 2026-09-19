// Interior elevations — the drawing this product did not have.
//
// A plan says where things are; an elevation says how high. Cabinet runs, wardrobe shutters,
// sill heights, headroom over a counter, where a switch plate lands — none of it is decidable in
// plan view, which is why an interior designer's drawing set is elevations before it is anything
// else. Chief Architect generates them off the model; so does this now.
// https://www.lifeofanarchitect.com/graphic-standards/architectural-cabinetry/
//
// Convention: each wall is drawn flat, straight on, looking AT it from inside the room, with no
// perspective. Left-to-right therefore depends on which wall you are facing — see `alongWall()`.

import { RoomOpening, SolvedRoom } from "./solve";
import { FURNITURE_CATALOG, PlacedCustomObject } from "./furnitureCatalog";
import {
  BuiltinFurnitureRecord,
  FurnitureBox,
  RoomRect,
  overlap,
  roomRect,
} from "./furnitureInventory";
import { HouseMaterialConfig, FLOOR_MATERIALS, WALL_COLORS } from "./materialsCatalog";
import { RoomName } from "./rooms";
import { WALL_HEIGHT_FT } from "./sceneConstants";
import { formatFtIn, roomDisplayNames } from "./designSchedule";
import { inchesToFeet } from "./units";

export type Edge = "N" | "S" | "E" | "W";

export const EDGE_NAMES: Record<Edge, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
};

/** How far off the wall a piece can stand and still belong on that wall's elevation. */
const WALL_BAND_FT = 4.0;

/** Below this, a piece is against the wall rather than standing in front of it. */
const AGAINST_WALL_FT = 0.4;

export interface ElevationPiece {
  name: string;
  /** Along-wall span in feet, measured left to right as drawn. */
  from: number;
  to: number;
  /** Height above finished floor, in feet. */
  bottom: number;
  top: number;
  /** Distance from the wall face to the piece's nearest face. Drives draw order and tone. */
  standoff: number;
}

export interface ElevationOpening {
  kind: RoomOpening["kind"];
  from: number;
  to: number;
  sill: number;
  head: number;
}

export interface WallElevation {
  key: string;
  roomIndex: number;
  roomLabel: string;
  edge: Edge;
  title: string;
  lengthFt: number;
  heightFt: number;
  openings: ElevationOpening[];
  pieces: ElevationPiece[];
  floorFinish: string;
  wallFinish: string;
}

/**
 * Map a world span onto the along-wall axis of the elevation being drawn.
 *
 * Facing a wall from inside the room, your right hand points a different way for each wall. The
 * scene is +X east, +Z south, Y up, so facing north your right is east and facing south your
 * right is west. Getting this backwards mirrors every elevation, which is the kind of error that
 * survives a screenshot and gets a wardrobe built hinged on the wrong side.
 */
function alongWall(edge: Edge, rect: RoomRect, min: number, max: number): { from: number; to: number } {
  switch (edge) {
    case "N": // looking north, +X runs left to right
      return { from: min - rect.x, to: max - rect.x };
    case "S": // looking south, +X runs right to left
      return { from: rect.x + rect.w - max, to: rect.x + rect.w - min };
    case "E": // looking east, +Z runs left to right
      return { from: min - rect.z, to: max - rect.z };
    case "W": // looking west, +Z runs right to left
      return { from: rect.z + rect.d - max, to: rect.z + rect.d - min };
  }
}

/** The length of the wall on this edge — the room's width for N/S, its depth for E/W. */
function wallLength(edge: Edge, rect: RoomRect): number {
  return edge === "N" || edge === "S" ? rect.w : rect.d;
}

/** How far a box stands off this wall, and how wide it reads along it. */
function pieceOnWall(
  edge: Edge,
  rect: RoomRect,
  box: FurnitureBox
): { standoff: number; from: number; to: number } | null {
  let standoff: number;
  let span: { from: number; to: number };

  if (edge === "N") {
    standoff = box.minZ - rect.z;
    span = alongWall(edge, rect, box.minX, box.maxX);
  } else if (edge === "S") {
    standoff = rect.z + rect.d - box.maxZ;
    span = alongWall(edge, rect, box.minX, box.maxX);
  } else if (edge === "W") {
    standoff = box.minX - rect.x;
    span = alongWall(edge, rect, box.minZ, box.maxZ);
  } else {
    standoff = rect.x + rect.w - box.maxX;
    span = alongWall(edge, rect, box.minZ, box.maxZ);
  }

  if (standoff > WALL_BAND_FT) return null;
  // A piece the far side of the room reads as negative standoff only when it overhangs the wall
  // it is measured against, which cannot happen; clamp anyway rather than draw it behind the wall.
  return { standoff: Math.max(0, standoff), ...span };
}

/** The world box a placed piece occupies, from its catalog size, scale and rotation. */
export function placedObjectBox(obj: PlacedCustomObject): FurnitureBox | null {
  const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
  if (!def) return null;
  const s = obj.scale || 1;
  // Rotation is free, but a box is axis-aligned, so only quarter turns can be represented
  // exactly. Anything else is reported at its unrotated footprint and is approximate — an
  // elevation of a piece skewed to the wall is approximate in any drawing set.
  const quarterTurned = Math.abs(Math.round(((obj.rotationY || 0) / (Math.PI / 2))) % 2) === 1;
  const w = (quarterTurned ? def.dimensions.depthFt : def.dimensions.widthFt) * s;
  const d = (quarterTurned ? def.dimensions.widthFt : def.dimensions.depthFt) * s;
  const h = def.dimensions.heightFt * s;
  const base = (def.mountHeightFt ?? 0) + (obj.y || 0);
  return {
    minX: obj.x - w / 2,
    maxX: obj.x + w / 2,
    minZ: obj.z - d / 2,
    maxZ: obj.z + d / 2,
    minY: base,
    maxY: base + h,
  };
}

function finishName<T extends { id: string; name: string }>(catalog: T[], id?: string): string {
  return (id && catalog.find((e) => e.id === id)?.name) || "—";
}

/**
 * Every wall of every room, as an elevation. Walls with nothing on them are kept: a blank wall
 * is a drawing too, and leaving it out makes a sheet set with holes in it.
 */
export function buildElevations(
  rooms: SolvedRoom[],
  builtins: BuiltinFurnitureRecord[],
  customObjects: PlacedCustomObject[],
  config: HouseMaterialConfig
): WallElevation[] {
  const names = roomDisplayNames(rooms);
  const out: WallElevation[] = [];

  // Placed pieces are matched to a room the same way the schedule matches them: by footprint
  // centre, ground floor first.
  const placed: Array<{ name: string; box: FurnitureBox; roomIndex: number }> = [];
  for (const obj of customObjects) {
    const box = placedObjectBox(obj);
    if (!box) continue;
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const idx = rooms.findIndex((r) => {
      const rect = roomRect(r);
      return cx >= rect.x && cx <= rect.x + rect.w && cz >= rect.z && cz <= rect.z + rect.d;
    });
    if (idx >= 0) placed.push({ name: obj.name, box, roomIndex: idx });
  }

  rooms.forEach((room, i) => {
    if (room.open_sided) return; // a car porch or sit-out has no wall to elevate
    const rect = roomRect(room);
    const key = room.name as RoomName;

    const inRoom = [
      ...builtins.filter((b) => b.roomIndex === i).map((b) => ({ name: b.name, box: b.box })),
      ...placed.filter((p) => p.roomIndex === i).map((p) => ({ name: p.name, box: p.box })),
    ];

    for (const edge of ["N", "E", "S", "W"] as Edge[]) {
      const len = wallLength(edge, rect);

      const openings: ElevationOpening[] = (room.openings ?? [])
        .filter((o) => o.edge === edge)
        .map((o) => {
          const originIn = edge === "N" || edge === "S" ? room.x_in : room.y_in;
          const startFt = inchesToFeet(originIn + o.offset_in);
          const endFt = startFt + inchesToFeet(o.width_in);
          const span = alongWall(edge, rect, startFt, endFt);
          const sill = inchesToFeet(o.sill_in ?? 0);
          return {
            kind: o.kind,
            from: span.from,
            to: span.to,
            sill,
            head: sill + inchesToFeet(o.height_in),
          };
        })
        .sort((a, b) => a.from - b.from);

      const pieces: ElevationPiece[] = [];
      for (const item of inRoom) {
        const hit = pieceOnWall(edge, rect, item.box);
        if (!hit) continue;
        // A piece that reads as a sliver against this wall belongs on the wall it actually faces.
        if (overlap(hit.from, hit.to, 0, len) < 0.4) continue;
        pieces.push({
          name: item.name,
          from: Math.max(0, hit.from),
          to: Math.min(len, hit.to),
          bottom: Math.max(0, item.box.minY),
          top: Math.min(WALL_HEIGHT_FT, item.box.maxY),
          standoff: hit.standoff,
        });
      }
      // Far pieces first, so what stands against the wall is drawn over what stands in front of
      // it — the same order you would see it in.
      pieces.sort((a, b) => b.standoff - a.standoff);

      out.push({
        key: `${i}-${edge}`,
        roomIndex: i,
        roomLabel: names[i],
        edge,
        title: `${names[i]} — ${EDGE_NAMES[edge]} elevation`,
        lengthFt: len,
        heightFt: WALL_HEIGHT_FT,
        openings,
        pieces,
        floorFinish: finishName(FLOOR_MATERIALS, config.roomFloors[key] ?? config.globalFloor),
        wallFinish: finishName(WALL_COLORS, config.roomWallColors[key] ?? config.globalWallColor),
      });
    }
  });

  return out;
}

// ------------------------------------------------------------------------------------------
// The drawing
// ------------------------------------------------------------------------------------------

// Matches `downloadBlueprintPng`, which rasterises at 1600x1050 regardless of the source sheet.
const SHEET_W = 1600;
const SHEET_H = 1050;

const INK = "#1a1916";
const RULE = "#8e8a82";
const FAINT = "#c9c4b8";
const ACCENT = "#2f4954";
const PAPER = "#f6f5f2";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A horizontal dimension string: witness lines, arrow ticks and the measurement over it. */
function hDim(x1: number, x2: number, y: number, label: string, tick = 6): string {
  if (x2 - x1 < 1) return "";
  const mid = (x1 + x2) / 2;
  return `
    <line x1="${x1}" y1="${y - tick}" x2="${x1}" y2="${y + tick}" stroke="${RULE}" stroke-width="1"/>
    <line x1="${x2}" y1="${y - tick}" x2="${x2}" y2="${y + tick}" stroke="${RULE}" stroke-width="1"/>
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${RULE}" stroke-width="1"/>
    <rect x="${mid - 30}" y="${y - 8}" width="60" height="16" fill="${PAPER}"/>
    <text x="${mid}" y="${y + 4}" text-anchor="middle" font-family="monospace" font-size="11" fill="${INK}">${label}</text>`;
}

/** A vertical dimension string, read bottom-up the way a height is. */
function vDim(y1: number, y2: number, x: number, label: string, tick = 6): string {
  if (Math.abs(y2 - y1) < 10) return "";
  const mid = (y1 + y2) / 2;
  return `
    <line x1="${x - tick}" y1="${y1}" x2="${x + tick}" y2="${y1}" stroke="${RULE}" stroke-width="1"/>
    <line x1="${x - tick}" y1="${y2}" x2="${x + tick}" y2="${y2}" stroke="${RULE}" stroke-width="1"/>
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${RULE}" stroke-width="1"/>
    <rect x="${x - 26}" y="${mid - 9}" width="52" height="18" fill="${PAPER}"/>
    <text x="${x}" y="${mid + 4}" text-anchor="middle" font-family="monospace" font-size="11" fill="${INK}">${label}</text>`;
}

/**
 * One wall, drawn to scale on a sheet with a title block.
 *
 * The scale is whatever fits the wall in the frame, reported honestly in the title block rather
 * than rounded to a nominal 1:50 the drawing does not actually hold.
 */
export function elevationSvg(el: WallElevation, projectName = "plot-to-plan"): string {
  const margin = { left: 150, right: 90, top: 96, bottom: 190 };
  const frameW = SHEET_W - margin.left - margin.right;
  const frameH = SHEET_H - margin.top - margin.bottom;

  const scale = Math.min(frameW / el.lengthFt, frameH / el.heightFt);
  const drawW = el.lengthFt * scale;
  const drawH = el.heightFt * scale;
  const x0 = margin.left + (frameW - drawW) / 2;
  const floorY = margin.top + drawH;

  const px = (ft: number) => x0 + ft * scale;
  const py = (ft: number) => floorY - ft * scale;

  const parts: string[] = [];

  parts.push(`<rect width="${SHEET_W}" height="${SHEET_H}" fill="${PAPER}"/>`);

  // Wall face, floor slab and ceiling line.
  parts.push(
    `<rect x="${x0}" y="${margin.top}" width="${drawW}" height="${drawH}" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`
  );
  parts.push(
    `<rect x="${x0 - 18}" y="${floorY}" width="${drawW + 36}" height="14" fill="${FAINT}" stroke="${INK}" stroke-width="1.5"/>`
  );
  parts.push(
    `<line x1="${x0 - 18}" y1="${margin.top}" x2="${x0 + drawW + 18}" y2="${margin.top}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="10 5"/>`
  );
  parts.push(
    `<text x="${x0 + drawW + 22}" y="${margin.top + 4}" font-family="monospace" font-size="11" fill="${RULE}">CEILING ${formatFtIn(el.heightFt)}</text>`
  );
  parts.push(
    `<text x="${x0 + drawW + 22}" y="${floorY + 4}" font-family="monospace" font-size="11" fill="${RULE}">FFL 0'-0"</text>`
  );

  // Furniture behind the openings, far pieces first.
  for (const p of el.pieces) {
    const against = p.standoff <= AGAINST_WALL_FT;
    const w = Math.max(2, (p.to - p.from) * scale);
    const h = Math.max(2, (p.top - p.bottom) * scale);
    parts.push(
      `<rect x="${px(p.from)}" y="${py(p.top)}" width="${w}" height="${h}" fill="${against ? "#e4e0d6" : "none"}" stroke="${against ? INK : RULE}" stroke-width="${against ? 1.6 : 1}" ${against ? "" : 'stroke-dasharray="6 4"'}/>`
    );
    if (w > 54 && h > 20) {
      parts.push(
        `<text x="${px(p.from) + w / 2}" y="${py(p.top) + h / 2 + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${INK}">${esc(p.name)}</text>`
      );
    }
    // Every piece gets its height called out; that is the whole reason for the drawing.
    if (against && h > 26) {
      parts.push(
        `<text x="${px(p.from) + 5}" y="${py(p.top) - 5}" font-family="monospace" font-size="10" fill="${ACCENT}">${formatFtIn(p.top)}</text>`
      );
    }
  }

  // Openings.
  for (const o of el.openings) {
    const w = (o.to - o.from) * scale;
    const h = (o.head - o.sill) * scale;
    const isDoor = o.kind === "door" || o.kind === "entrance";
    const isVoid = o.kind === "opening";
    parts.push(
      `<rect x="${px(o.from)}" y="${py(o.head)}" width="${w}" height="${h}" fill="${isVoid ? PAPER : "#ffffff"}" stroke="${INK}" stroke-width="2"/>`
    );
    if (isDoor && !isVoid) {
      // A door leaf reads as a panel inset; the hinge side is a plan question, not an elevation one.
      parts.push(
        `<rect x="${px(o.from) + 7}" y="${py(o.head) + 7}" width="${Math.max(2, w - 14)}" height="${Math.max(2, h - 14)}" fill="none" stroke="${RULE}" stroke-width="1"/>`
      );
    } else if (!isVoid) {
      parts.push(
        `<line x1="${px((o.from + o.to) / 2)}" y1="${py(o.head)}" x2="${px((o.from + o.to) / 2)}" y2="${py(o.sill)}" stroke="${RULE}" stroke-width="1"/>`
      );
      parts.push(
        `<rect x="${px(o.from) - 4}" y="${py(o.sill)}" width="${w + 8}" height="6" fill="${FAINT}" stroke="${INK}" stroke-width="1"/>`
      );
    }
    parts.push(
      `<text x="${px((o.from + o.to) / 2)}" y="${py(o.head) - 8}" text-anchor="middle" font-family="monospace" font-size="10" fill="${ACCENT}">${o.kind.toUpperCase()} ${formatFtIn(o.to - o.from)}</text>`
    );
  }

  // Vertical dimensions on the left: sill and head of the first opening, then the full height.
  const first = el.openings[0];
  if (first) {
    if (first.sill > 0.1) parts.push(vDim(floorY, py(first.sill), x0 - 46, formatFtIn(first.sill)));
    parts.push(vDim(py(first.sill), py(first.head), x0 - 46, formatFtIn(first.head - first.sill)));
  }
  parts.push(vDim(floorY, margin.top, x0 - 96, formatFtIn(el.heightFt)));

  // Horizontal dimensions below: each opening's position, then the overall run.
  const dimY = floorY + 52;
  let cursor = 0;
  for (const o of el.openings) {
    if (o.from - cursor > 0.25) parts.push(hDim(px(cursor), px(o.from), dimY, formatFtIn(o.from - cursor)));
    parts.push(hDim(px(o.from), px(o.to), dimY, formatFtIn(o.to - o.from)));
    cursor = o.to;
  }
  if (el.lengthFt - cursor > 0.25) {
    parts.push(hDim(px(cursor), px(el.lengthFt), dimY, formatFtIn(el.lengthFt - cursor)));
  }
  parts.push(hDim(px(0), px(el.lengthFt), dimY + 42, formatFtIn(el.lengthFt), 8));

  // Title block.
  const tbY = SHEET_H - 78;
  parts.push(`<line x1="40" y1="${tbY}" x2="${SHEET_W - 40}" y2="${tbY}" stroke="${INK}" stroke-width="1.5"/>`);
  parts.push(
    `<text x="40" y="${tbY + 30}" font-family="sans-serif" font-size="21" font-weight="700" fill="${INK}">${esc(el.title)}</text>`
  );
  parts.push(
    `<text x="40" y="${tbY + 52}" font-family="monospace" font-size="12" fill="${RULE}">Wall ${formatFtIn(el.lengthFt)} long, ${formatFtIn(el.heightFt)} floor to ceiling &#183; floor ${esc(el.floorFinish)} &#183; walls ${esc(el.wallFinish)}</text>`
  );
  parts.push(
    `<text x="${SHEET_W - 40}" y="${tbY + 30}" text-anchor="end" font-family="monospace" font-size="12" fill="${RULE}">${esc(projectName)} &#183; ${new Date().toLocaleDateString()}</text>`
  );
  parts.push(
    `<text x="${SHEET_W - 40}" y="${tbY + 52}" text-anchor="end" font-family="monospace" font-size="12" fill="${RULE}">1 ft = ${scale.toFixed(1)} px &#183; drawn looking ${EDGE_NAMES[el.edge].toLowerCase()}</text>`
  );

  parts.push(
    `<text x="40" y="52" font-family="sans-serif" font-size="12" letter-spacing="2" fill="${RULE}">INTERIOR ELEVATION</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">${parts.join("")}</svg>`;
}

/**
 * The whole set, one wall per page.
 *
 * A designer does not hand over an elevation; they hand over elevations. Printing them one at a
 * time is the difference between a feature and a deliverable.
 */
export function printElevationSet(
  elevations: WallElevation[],
  projectName = "plot-to-plan"
): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to open the print preview.");
    return;
  }
  const pages = elevations
    .map(
      (el, i) =>
        `<section><div class="cap">Sheet ${i + 1} of ${elevations.length} &#183; ${esc(el.title)}</div>${elevationSvg(el, projectName)}</section>`
    )
    .join("");

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Interior elevations — ${esc(projectName)}</title>
    <style>
      @page { size: A3 landscape; margin: 10mm; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
      section { page-break-after: always; padding: 8px 0; }
      section:last-child { page-break-after: auto; }
      .cap { font-family: monospace; font-size: 11px; color: #8e8a82; padding: 0 6px 6px; }
      svg { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>${pages}</body>
</html>`);
  win.document.close();
  win.focus();
}
