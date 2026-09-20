// The interior designer's deliverable, taken off the model instead of retyped into a spreadsheet.
//
// An FF&E schedule lists every loose and fixed piece in the job — furniture, fixtures and
// equipment — room by room, with size, finish and count, and a finish schedule says what each
// room's floor, walls and doors are made of. Both are tables the designer hands a contractor or
// a procurement agent, and both exist here already as scattered state: the built-in fit-out lives
// in the scene graph, the placed pieces in `customObjects`, the finishes in `HouseMaterialConfig`.
// This file is only the join.
//
// Sizes are reported in both feet-inches and millimetres. Indian joinery is specified in mm.

import { SolvedRoom } from "./solve";
import {
  FURNITURE_CATALOG,
  FURNITURE_COLOR_SWATCHES,
  PlacedCustomObject,
} from "./furnitureCatalog";
import { RoomName, ROOM_LABELS } from "./rooms";
import {
  DOOR_COLORS,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
  WALL_TEXTURES,
} from "./materialsCatalog";
import { WALL_HEIGHT_FT } from "./sceneConstants";
import {
  BuiltinFurnitureRecord,
  boxDepth,
  boxHeight,
  boxWidth,
  roomRect,
} from "./furnitureInventory";
import { inchesToFeet } from "./units";
import { downloadCsv } from "./blueprintExport";

const MM_PER_FOOT = 304.8;

// One piece of the automatic fit-out, as measured off the built scene rather than declared.
// The type lives in `furnitureInventory.ts` because the elevations and the clearance audit read
// it too; re-exported here so the schedule reads as one module.
export type { BuiltinFurnitureRecord };

export type FfeSource = "Built-in" | "Specified" | "AI model";

export interface FfeRow {
  code: string;
  room: string;
  item: string;
  category: string;
  qty: number;
  sizeFt: string;
  sizeMm: string;
  finish: string;
  source: FfeSource;
}

export interface FinishRow {
  room: string;
  areaSqFt: number;
  floor: string;
  wallPaint: string;
  wallTexture: string;
  doorFinish: string;
  paintAreaSqFt: number;
  notes: string;
}

export interface DesignSchedule {
  ffe: FfeRow[];
  finishes: FinishRow[];
  totals: {
    pieces: number;
    lineItems: number;
    rooms: number;
    carpetAreaSqFt: number;
    paintAreaSqFt: number;
    flooringSqFt: number;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  living: "Living",
  bedroom: "Bedroom",
  dining: "Dining",
  kitchen: "Kitchen",
  office: "Study",
  decor: "Decor & art",
  bath: "Sanitaryware",
  appliance: "Appliances",
  lighting: "Lighting",
  soft: "Soft furnishing",
  stairs: "Joinery — stair",
  walls: "Partitions",
  cafe_seating: "Seating",
  cafe_service: "Service counter",
  cafe_decor: "Decor & art",
  cafe_signage: "Signage",
  cafe_boh: "Back of house",
  cafe_outdoor: "Outdoor",
};

/** `6'-8"`, the way a schedule is read aloud on site. */
export function formatFtIn(feet: number): string {
  const totalIn = Math.round(feet * 12);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return `${ft}'-${inch}"`;
}

function sizeFt(w: number, d: number, h: number): string {
  return `${formatFtIn(w)} W × ${formatFtIn(d)} D × ${formatFtIn(h)} H`;
}

function sizeMm(w: number, d: number, h: number): string {
  const mm = (ft: number) => Math.round((ft * MM_PER_FOOT) / 5) * 5;
  return `${mm(w)} × ${mm(d)} × ${mm(h)}`;
}

function finishName<T extends { id: string; name: string }>(
  catalog: T[],
  id: string | undefined,
  fallback: string
): string {
  if (!id) return fallback;
  return catalog.find((entry) => entry.id === id)?.name ?? id;
}

/**
 * "Bedroom 2" rather than "bedroom". A schedule row has to name a room a person can walk to, and
 * a house with three bedrooms needs them numbered. Rooms that occur once keep the bare label.
 */
export function roomDisplayNames(rooms: SolvedRoom[]): string[] {
  const total = new Map<string, number>();
  for (const r of rooms) total.set(r.name, (total.get(r.name) ?? 0) + 1);

  const seen = new Map<string, number>();
  return rooms.map((r) => {
    const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
    if ((total.get(r.name) ?? 0) < 2) return label;
    const n = (seen.get(r.name) ?? 0) + 1;
    seen.set(r.name, n);
    return `${label} ${n}`;
  });
}

/**
 * Which room a placed piece stands in, by its footprint centre.
 *
 * A placed object carries world feet and no floor, so on a multi-storey plan a piece can match a
 * room on each storey. The first match wins, which is the ground floor, because that is the
 * storey the object was placed on — there is nowhere else the 3D view lets you drop one.
 */
function roomIndexAt(rooms: SolvedRoom[], xFt: number, zFt: number): number {
  for (let i = 0; i < rooms.length; i++) {
    const r = roomRect(rooms[i]);
    if (xFt >= r.x && xFt <= r.x + r.w && zFt >= r.z && zFt <= r.z + r.d) return i;
  }
  return -1;
}

function swatchName(colorHex: number | undefined): string | null {
  if (colorHex === undefined) return null;
  return FURNITURE_COLOR_SWATCHES.find((s) => s.hex === colorHex)?.name ?? `#${colorHex.toString(16).padStart(6, "0")}`;
}

interface DraftRow {
  room: string;
  roomOrder: number;
  item: string;
  category: string;
  sizeFt: string;
  sizeMm: string;
  finish: string;
  source: FfeSource;
}

export function buildDesignSchedule(
  rooms: SolvedRoom[],
  builtins: BuiltinFurnitureRecord[],
  customObjects: PlacedCustomObject[],
  config: HouseMaterialConfig
): DesignSchedule {
  const names = roomDisplayNames(rooms);
  const drafts: DraftRow[] = [];

  for (const b of builtins) {
    const def = FURNITURE_CATALOG.find((f) => f.type === b.type);
    const w = boxWidth(b.box);
    const d = boxDepth(b.box);
    const h = boxHeight(b.box);
    drafts.push({
      room: names[b.roomIndex] ?? "Unassigned",
      roomOrder: b.roomIndex,
      item: b.name,
      category: CATEGORY_LABELS[def?.category ?? ""] ?? "Fit-out",
      sizeFt: sizeFt(w, d, h),
      sizeMm: sizeMm(w, d, h),
      finish: "Scheme default",
      source: "Built-in",
    });
  }

  for (const obj of customObjects) {
    const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
    const idx = roomIndexAt(rooms, obj.x, obj.z);
    const scale = obj.scale || 1;
    const isGenerated = obj.type === "custom_3d_model" || !!obj.aiParametricDef;

    let ft = "—";
    let mm = "—";
    if (def) {
      const { widthFt, depthFt, heightFt } = def.dimensions;
      ft = sizeFt(widthFt * scale, depthFt * scale, heightFt * scale);
      mm = sizeMm(widthFt * scale, depthFt * scale, heightFt * scale);
    }

    drafts.push({
      room: idx >= 0 ? names[idx] : "Outside the plan",
      roomOrder: idx >= 0 ? idx : rooms.length,
      item: obj.name,
      category: isGenerated ? "Bespoke" : CATEGORY_LABELS[def?.category ?? ""] ?? "Fit-out",
      sizeFt: ft,
      sizeMm: mm,
      finish: swatchName(obj.colorHex) ?? swatchName(def?.defaultColor) ?? "Catalog default",
      source: isGenerated ? "AI model" : "Specified",
    });
  }

  // Identical pieces in the same room are one line with a count, which is how a schedule is read
  // and how it is ordered. Four dining chairs are one purchase, not four rows.
  const grouped = new Map<string, { draft: DraftRow; qty: number }>();
  for (const d of drafts) {
    const key = `${d.roomOrder}|${d.item}|${d.sizeFt}|${d.finish}`;
    const hit = grouped.get(key);
    if (hit) hit.qty += 1;
    else grouped.set(key, { draft: d, qty: 1 });
  }

  const ordered = [...grouped.values()].sort(
    (a, b) => a.draft.roomOrder - b.draft.roomOrder || a.draft.item.localeCompare(b.draft.item)
  );

  const ffe: FfeRow[] = ordered.map((entry, i) => ({
    code: `FF-${String(i + 1).padStart(2, "0")}`,
    room: entry.draft.room,
    item: entry.draft.item,
    category: entry.draft.category,
    qty: entry.qty,
    sizeFt: entry.draft.sizeFt,
    sizeMm: entry.draft.sizeMm,
    finish: entry.draft.finish,
    source: entry.draft.source,
  }));

  const finishes: FinishRow[] = rooms.map((r, i) => {
    const key = r.name as RoomName;
    const wFt = inchesToFeet(r.w_in);
    const dFt = inchesToFeet(r.d_in);
    const bands = config.roomWallBands?.[key] ?? config.globalWallBands;
    const glazing = config.roomGlazing?.[key] ?? config.globalGlazing;

    const notes: string[] = [];
    if (bands) notes.push(`${bands.bands.length}-band ${bands.axis} paint scheme`);
    if (glazing?.wall) notes.push(`glazed wall, ${glazing.mullions} mullions`);
    if (glazing?.door) notes.push("glazed door leaf");
    if (r.open_sided) notes.push("open-sided — no enclosing wall");
    if (r.wet) notes.push("wet area — specify anti-skid");

    return {
      room: names[i],
      areaSqFt: Math.round(wFt * dFt),
      floor: finishName(FLOOR_MATERIALS, config.roomFloors[key] ?? config.globalFloor, "—"),
      wallPaint: finishName(WALL_COLORS, config.roomWallColors[key] ?? config.globalWallColor, "—"),
      wallTexture: finishName(
        WALL_TEXTURES,
        config.roomWallTextures[key] ?? config.globalWallTexture,
        "—"
      ),
      doorFinish: finishName(
        DOOR_COLORS,
        config.roomDoorColors?.[key] ?? config.globalDoorColor,
        "—"
      ),
      // Gross wall face. Openings are not deducted here — the BOQ does that against the solver's
      // own wall objects, and a paint quote is taken gross anyway.
      paintAreaSqFt: Math.round(2 * (wFt + dFt) * WALL_HEIGHT_FT),
      notes: notes.join("; ") || "—",
    };
  });

  const carpetAreaSqFt = finishes.reduce((sum, f) => sum + f.areaSqFt, 0);

  return {
    ffe,
    finishes,
    totals: {
      pieces: ffe.reduce((sum, row) => sum + row.qty, 0),
      lineItems: ffe.length,
      rooms: rooms.length,
      carpetAreaSqFt,
      paintAreaSqFt: finishes.reduce((sum, f) => sum + f.paintAreaSqFt, 0),
      flooringSqFt: carpetAreaSqFt,
    },
  };
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportDesignScheduleToCsv(
  schedule: DesignSchedule,
  projectName: string = "Interior_Schedule"
): void {
  const lines: string[] = [];
  lines.push(csvCell("FF&E AND FINISH SCHEDULE"));
  lines.push([csvCell("Date"), csvCell(new Date().toLocaleDateString())].join(","));
  lines.push([csvCell("Rooms"), csvCell(schedule.totals.rooms)].join(","));
  lines.push([csvCell("Carpet area (sq ft)"), csvCell(schedule.totals.carpetAreaSqFt)].join(","));
  lines.push([csvCell("Pieces scheduled"), csvCell(schedule.totals.pieces)].join(","));
  lines.push("");

  lines.push(csvCell("FF&E SCHEDULE"));
  lines.push(
    ["Code", "Room", "Item", "Category", "Qty", "Size (ft-in)", "Size (mm)", "Finish", "Source"]
      .map(csvCell)
      .join(",")
  );
  for (const r of schedule.ffe) {
    lines.push(
      [r.code, r.room, r.item, r.category, r.qty, r.sizeFt, r.sizeMm, r.finish, r.source]
        .map(csvCell)
        .join(",")
    );
  }
  lines.push("");

  lines.push(csvCell("FINISH SCHEDULE"));
  lines.push(
    ["Room", "Area (sq ft)", "Floor", "Wall paint", "Wall texture", "Door finish", "Paint area (sq ft)", "Notes"]
      .map(csvCell)
      .join(",")
  );
  for (const f of schedule.finishes) {
    lines.push(
      [f.room, f.areaSqFt, f.floor, f.wallPaint, f.wallTexture, f.doorFinish, f.paintAreaSqFt, f.notes]
        .map(csvCell)
        .join(",")
    );
  }

  downloadCsv(lines, `${projectName}_FFE_Finish_Schedule.csv`);
}

export function printDesignSchedule(
  schedule: DesignSchedule,
  projectName: string = "Interior Package"
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const ffeRows = schedule.ffe
    .map(
      (r) => `<tr>
        <td>${r.code}</td><td>${r.room}</td><td><strong>${r.item}</strong></td>
        <td>${r.category}</td><td class="num">${r.qty}</td>
        <td>${r.sizeFt}</td><td class="num">${r.sizeMm}</td>
        <td>${r.finish}</td><td>${r.source}</td>
      </tr>`
    )
    .join("");

  const finishRows = schedule.finishes
    .map(
      (f) => `<tr>
        <td><strong>${f.room}</strong></td><td class="num">${f.areaSqFt}</td>
        <td>${f.floor}</td><td>${f.wallPaint}</td><td>${f.wallTexture}</td>
        <td>${f.doorFinish}</td><td class="num">${f.paintAreaSqFt}</td><td>${f.notes}</td>
      </tr>`
    )
    .join("");

  printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>FF&amp;E and Finish Schedule — ${projectName}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; }
      .header { border-bottom: 2px solid #1a1916; padding-bottom: 16px; margin-bottom: 24px; }
      h1 { margin: 0; font-size: 23px; color: #1a1916; letter-spacing: -0.01em; }
      h2 { font-size: 15px; margin: 30px 0 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #6d685e; }
      .meta { font-size: 13px; color: #6d685e; margin-top: 5px; }
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 8px; }
      .stat-card { background: #eceae5; border: 1px solid #d8d4cb; padding: 12px; border-radius: 8px; }
      .stat-label { font-size: 11px; color: #6d685e; text-transform: uppercase; font-weight: 600; }
      .stat-value { font-size: 18px; font-weight: 700; color: #1a1916; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
      th { background: #eceae5; text-align: left; padding: 8px 9px; border: 1px solid #b5b0a6; font-weight: 700; }
      td { padding: 7px 9px; border: 1px solid #d8d4cb; vertical-align: top; }
      tr:nth-child(even) { background: #f6f5f2; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .footer { margin-top: 34px; border-top: 1px solid #b5b0a6; padding-top: 12px; font-size: 11px; color: #8e8a82; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>FF&amp;E and Finish Schedule</h1>
      <div class="meta">Project: ${projectName} &bull; Date: ${new Date().toLocaleDateString()}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Rooms</div><div class="stat-value">${schedule.totals.rooms}</div></div>
      <div class="stat-card"><div class="stat-label">Pieces scheduled</div><div class="stat-value">${schedule.totals.pieces}</div></div>
      <div class="stat-card"><div class="stat-label">Carpet area</div><div class="stat-value">${schedule.totals.carpetAreaSqFt} sq ft</div></div>
      <div class="stat-card"><div class="stat-label">Paint area</div><div class="stat-value">${schedule.totals.paintAreaSqFt} sq ft</div></div>
    </div>

    <h2>FF&amp;E schedule</h2>
    <table>
      <thead><tr><th>Code</th><th>Room</th><th>Item</th><th>Category</th><th>Qty</th><th>Size (ft-in)</th><th>Size (mm)</th><th>Finish</th><th>Source</th></tr></thead>
      <tbody>${ffeRows}</tbody>
    </table>

    <h2>Finish schedule</h2>
    <table>
      <thead><tr><th>Room</th><th>Area</th><th>Floor</th><th>Wall paint</th><th>Wall texture</th><th>Door finish</th><th>Paint area</th><th>Notes</th></tr></thead>
      <tbody>${finishRows}</tbody>
    </table>

    <div class="footer">
      Sizes are taken off the 3D model. Millimetres are rounded to the nearest 5 mm.
      Paint areas are gross wall face at ${WALL_HEIGHT_FT} ft, openings not deducted.
    </div>
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
}
