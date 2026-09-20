// The finish board — what a designer puts in front of a client before a single wall is drawn.
//
// A moodboard normally comes first and is made of photographs: swatches torn from a sample
// book, product shots, a hero image. This one is made last and out of the model, because that is
// what this product actually has. There is no product photography in the repo, and a board of
// placeholder images would be a lie dressed as a deliverable.
//
// What it has instead is something the photo collages do not: **one scale**. Morpholio Board and
// the rest arrange cutouts by eye, so a side table and a sectional end up the same size on the
// page. Every piece here is drawn to the same scale as every other, off its measured box, so the
// board answers "will that console read as too big next to the sofa" — which is the question the
// board is looked at for.

import { SolvedRoom } from "./solve";
import { FURNITURE_CATALOG, PlacedCustomObject } from "./furnitureCatalog";
import {
  BuiltinFurnitureRecord,
  boxHeight,
  boxWidth,
  boxDepth,
  roomRect,
} from "./furnitureInventory";
import {
  DOOR_COLORS,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
  WALL_TEXTURES,
} from "./materialsCatalog";
import { RoomName } from "./rooms";
import { formatFtIn, roomDisplayNames } from "./designSchedule";
import { escapeMarkup } from "./blueprintExport";

const MM_PER_FOOT = 304.8;
const NEUTRAL = "#b5b0a6";

export interface BoardSwatch {
  label: string;
  name: string;
  hex: string;
  note: string;
}

export interface BoardPiece {
  name: string;
  widthFt: number;
  depthFt: number;
  heightFt: number;
  hex: string;
  count: number;
}

export interface Moodboard {
  title: string;
  subtitle: string;
  scope: "house" | "room";
  areaSqFt: number;
  swatches: BoardSwatch[];
  pieces: BoardPiece[];
  pieceCount: number;
}

function hexOf(color: number | undefined): string | null {
  if (color === undefined) return null;
  return `#${color.toString(16).padStart(6, "0")}`;
}

function lookup<T extends { id: string }>(catalog: T[], id: string | undefined): T | undefined {
  return id ? catalog.find((e) => e.id === id) : undefined;
}

/**
 * The board for one room, or for the house.
 *
 * `roomIndex` of null means the whole house: finishes come from the global config and every
 * piece in the plan is on the board. Room scope resolves finishes room-then-building, the same
 * order the renderer resolves them, so the board shows the room that will be built.
 */
export function buildMoodboard(
  rooms: SolvedRoom[],
  builtins: BuiltinFurnitureRecord[],
  customObjects: PlacedCustomObject[],
  config: HouseMaterialConfig,
  roomIndex: number | null
): Moodboard {
  const names = roomDisplayNames(rooms);
  const room = roomIndex === null ? null : rooms[roomIndex];
  const key = room ? (room.name as RoomName) : null;

  const floor = lookup(FLOOR_MATERIALS, (key && config.roomFloors[key]) || config.globalFloor);
  const wall = lookup(WALL_COLORS, (key && config.roomWallColors[key]) || config.globalWallColor);
  const texture = lookup(
    WALL_TEXTURES,
    (key && config.roomWallTextures[key]) || config.globalWallTexture
  );
  const door = lookup(DOOR_COLORS, (key && config.roomDoorColors?.[key]) || config.globalDoorColor);

  const swatches: BoardSwatch[] = [];
  if (floor) {
    swatches.push({ label: "Floor", name: floor.name, hex: floor.swatchColor, note: floor.description });
  }
  if (wall) {
    swatches.push({ label: "Wall paint", name: wall.name, hex: wall.hex, note: wall.description });
  }
  if (texture) {
    // A texture has no colour of its own — it is a finish over the wall paint, so it is shown in
    // the paint's colour rather than invented one.
    swatches.push({
      label: "Wall finish",
      name: texture.name,
      hex: wall?.hex ?? NEUTRAL,
      note: texture.description,
    });
  }
  if (door) {
    swatches.push({ label: "Joinery", name: door.name, hex: door.hex, note: door.description });
  }

  // Pieces. Ceiling fixtures are left off: a board is about what you see at eye level, and a
  // flush fixture drawn to scale beside a sofa tells nobody anything.
  const drafts: BoardPiece[] = [];

  for (const b of builtins) {
    if (b.ceiling) continue;
    if (roomIndex !== null && b.roomIndex !== roomIndex) continue;
    const def = FURNITURE_CATALOG.find((f) => f.type === b.type);
    drafts.push({
      name: b.name,
      widthFt: boxWidth(b.box),
      depthFt: boxDepth(b.box),
      heightFt: boxHeight(b.box),
      hex: hexOf(def?.defaultColor) ?? NEUTRAL,
      count: 1,
    });
  }

  for (const obj of customObjects) {
    const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
    if (!def) continue;
    if (roomIndex !== null) {
      const rect = roomRect(rooms[roomIndex]);
      const inside =
        obj.x >= rect.x && obj.x <= rect.x + rect.w && obj.z >= rect.z && obj.z <= rect.z + rect.d;
      if (!inside) continue;
    }
    const s = obj.scale || 1;
    drafts.push({
      name: obj.name,
      widthFt: def.dimensions.widthFt * s,
      depthFt: def.dimensions.depthFt * s,
      heightFt: def.dimensions.heightFt * s,
      hex: hexOf(obj.colorHex) ?? hexOf(def.defaultColor) ?? NEUTRAL,
      count: 1,
    });
  }

  const grouped = new Map<string, BoardPiece>();
  for (const d of drafts) {
    const k = `${d.name}|${d.widthFt.toFixed(2)}|${d.heightFt.toFixed(2)}|${d.hex}`;
    const hit = grouped.get(k);
    if (hit) hit.count += 1;
    else grouped.set(k, { ...d });
  }
  // Biggest first: the board reads top-left to bottom-right, and the hero piece belongs first.
  const pieces = [...grouped.values()].sort(
    (a, b) => b.widthFt * b.heightFt - a.widthFt * a.heightFt
  );

  const areaSqFt =
    roomIndex === null
      ? Math.round(rooms.reduce((sum, r) => sum + roomRect(r).w * roomRect(r).d, 0))
      : Math.round(roomRect(rooms[roomIndex]).w * roomRect(rooms[roomIndex]).d);

  return {
    title: roomIndex === null ? "Whole house" : names[roomIndex],
    subtitle: roomIndex === null ? "Scheme board" : "Room board",
    scope: roomIndex === null ? "house" : "room",
    areaSqFt,
    swatches,
    pieces,
    pieceCount: pieces.reduce((sum, p) => sum + p.count, 0),
  };
}

// ------------------------------------------------------------------------------------------
// The board
// ------------------------------------------------------------------------------------------

const SHEET_W = 1600;
const SHEET_H = 1050;
const INK = "#1a1916";
const RULE = "#8e8a82";
const FAINT = "#d8d4cb";
const PAPER = "#f6f5f2";


/** Readable ink over an arbitrary swatch — the usual luminance test, not a guess per colour. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return INK;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? INK : "#f6f5f2";
}

const mm = (ft: number): number => Math.round((ft * MM_PER_FOOT) / 5) * 5;

interface Placed {
  piece: BoardPiece;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Shelf-pack the pieces at ONE scale.
 *
 * The scale is chosen so the largest piece fits a cell, then every other piece is drawn at that
 * same scale — which is the whole point, and the reason a stool comes out small. Anything that
 * would draw thinner than a couple of pixels is floored so it stays visible without lying about
 * its size; the label carries the real number either way.
 */
function packPieces(pieces: BoardPiece[], areaW: number, areaH: number): { placed: Placed[]; scale: number } {
  if (pieces.length === 0) return { placed: [], scale: 1 };
  const maxW = Math.max(...pieces.map((p) => p.widthFt));
  const maxH = Math.max(...pieces.map((p) => p.heightFt));
  const labelH = 32;
  const gap = 18;

  // Start from a scale that fits the biggest piece comfortably, then shrink until every row fits.
  let scale = Math.min(300 / maxW, 150 / maxH);
  for (let attempt = 0; attempt < 14; attempt++) {
    const placed: Placed[] = [];
    let cx = 0;
    let cy = 0;
    let rowH = 0;
    let fits = true;
    for (const p of pieces) {
      const w = Math.max(10, p.widthFt * scale);
      const h = Math.max(8, p.heightFt * scale);
      if (cx + w > areaW && cx > 0) {
        cx = 0;
        cy += rowH + labelH + gap;
        rowH = 0;
      }
      if (cy + h + labelH > areaH) {
        fits = false;
        break;
      }
      placed.push({ piece: p, x: cx, y: cy, w, h });
      cx += w + gap;
      rowH = Math.max(rowH, h);
    }
    if (fits) return { placed, scale };
    scale *= 0.82;
  }
  return { placed: [], scale };
}

export function moodboardSvg(board: Moodboard, projectName = "plot-to-plan"): string {
  const parts: string[] = [`<rect width="${SHEET_W}" height="${SHEET_H}" fill="${PAPER}"/>`];

  parts.push(
    `<text x="56" y="56" font-family="sans-serif" font-size="12" letter-spacing="2.5" fill="${RULE}">${escapeMarkup(board.subtitle.toUpperCase())}</text>`
  );
  parts.push(
    `<text x="56" y="96" font-family="sans-serif" font-size="34" font-weight="700" fill="${INK}">${escapeMarkup(board.title)}</text>`
  );
  parts.push(
    `<text x="56" y="120" font-family="monospace" font-size="12" fill="${RULE}">${board.areaSqFt} sq ft &#183; ${board.pieceCount} pieces &#183; ${board.swatches.length} finishes</text>`
  );

  // Palette strip — the scheme in one line, before any detail.
  let sx = 56;
  for (const s of board.swatches) {
    parts.push(`<rect x="${sx}" y="140" width="${1488 / board.swatches.length - 8}" height="14" fill="${s.hex}"/>`);
    sx += 1488 / board.swatches.length;
  }

  // Left column: the finishes, large enough to judge a colour by.
  const colTop = 196;
  parts.push(
    `<text x="56" y="${colTop - 16}" font-family="sans-serif" font-size="11" letter-spacing="2" fill="${RULE}">FINISHES</text>`
  );
  let fy = colTop;
  for (const s of board.swatches) {
    parts.push(`<rect x="56" y="${fy}" width="440" height="104" fill="${s.hex}" stroke="${FAINT}" stroke-width="1"/>`);
    const ink = inkOn(s.hex);
    parts.push(
      `<text x="74" y="${fy + 28}" font-family="monospace" font-size="10" letter-spacing="1.5" fill="${ink}" opacity="0.75">${escapeMarkup(s.label.toUpperCase())}</text>`
    );
    parts.push(
      `<text x="74" y="${fy + 54}" font-family="sans-serif" font-size="17" font-weight="700" fill="${ink}">${escapeMarkup(s.name)}</text>`
    );
    parts.push(
      `<text x="74" y="${fy + 76}" font-family="monospace" font-size="10" fill="${ink}" opacity="0.7">${escapeMarkup(s.hex.toUpperCase())}</text>`
    );
    fy += 118;
  }

  // Right column: every piece at one scale.
  const gridX = 552;
  const gridY = colTop;
  const gridW = SHEET_W - gridX - 56;
  const gridH = SHEET_H - gridY - 150;
  const { placed, scale } = packPieces(board.pieces, gridW, gridH);

  parts.push(
    `<text x="${gridX}" y="${colTop - 16}" font-family="sans-serif" font-size="11" letter-spacing="2" fill="${RULE}">FURNITURE &#8212; ALL AT ONE SCALE, FRONT VIEW</text>`
  );

  if (placed.length === 0) {
    parts.push(
      `<text x="${gridX}" y="${gridY + 40}" font-family="sans-serif" font-size="14" fill="${RULE}">Nothing placed yet. Auto-furnish the plan and the board fills.</text>`
    );
  }

  for (const p of placed) {
    const x = gridX + p.x;
    const y = gridY + p.y;
    parts.push(
      `<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" fill="${p.piece.hex}" stroke="${INK}" stroke-width="1.2" rx="3"/>`
    );
    const label = p.piece.count > 1 ? `${p.piece.name} ×${p.piece.count}` : p.piece.name;
    parts.push(
      `<text x="${x}" y="${y + p.h + 16}" font-family="sans-serif" font-size="11.5" font-weight="600" fill="${INK}">${escapeMarkup(label)}</text>`
    );
    parts.push(
      `<text x="${x}" y="${y + p.h + 29}" font-family="monospace" font-size="9.5" fill="${RULE}">${formatFtIn(p.piece.widthFt)} × ${formatFtIn(p.piece.depthFt)} × ${formatFtIn(p.piece.heightFt)} &#183; ${mm(p.piece.widthFt)}mm W</text>`
    );
  }

  const tbY = SHEET_H - 74;
  parts.push(`<line x1="56" y1="${tbY}" x2="${SHEET_W - 56}" y2="${tbY}" stroke="${INK}" stroke-width="1.5"/>`);
  parts.push(
    `<text x="56" y="${tbY + 26}" font-family="monospace" font-size="11" fill="${RULE}">Every piece drawn to the same scale, 1 ft = ${scale.toFixed(1)} px, from its measured size — not arranged by eye.</text>`
  );
  parts.push(
    `<text x="56" y="${tbY + 44}" font-family="monospace" font-size="11" fill="${RULE}">Colours are the specified finish and the piece's own colour. No product photography — these are the real dimensions, not a catalogue shot.</text>`
  );
  parts.push(
    `<text x="${SHEET_W - 56}" y="${tbY + 26}" text-anchor="end" font-family="monospace" font-size="12" fill="${RULE}">${escapeMarkup(projectName)} &#183; ${new Date().toLocaleDateString()}</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">${parts.join("")}</svg>`;
}

/** Every board, one per page — the pack a client is walked through. */
export function printMoodboardSet(boards: Moodboard[], projectName = "plot-to-plan"): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to open the print preview.");
    return;
  }
  const pages = boards
    .map((b) => `<section>${moodboardSvg(b, projectName)}</section>`)
    .join("");
  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Finish boards — ${escapeMarkup(projectName)}</title>
    <style>
      @page { size: A3 landscape; margin: 8mm; }
      body { margin: 0; background: #fff; }
      section { page-break-after: always; }
      section:last-child { page-break-after: auto; }
      svg { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>${pages}</body>
</html>`);
  win.document.close();
  win.focus();
}
