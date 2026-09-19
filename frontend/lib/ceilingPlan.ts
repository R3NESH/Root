// Reflected ceiling plan — the drawing the electrician and the false-ceiling contractor work
// from, and the one no floor plan can stand in for.
//
// "Reflected" is the convention, not a flourish: you imagine a mirror lying on the floor and
// draw what it shows, so the ceiling keeps the SAME left-right orientation as the plan. Drawing
// it as seen looking up mirrors everything — the same trap as [[elevations-look-from-inside]],
// with the same consequence on site.
//
// What sets this apart from placing light symbols on a plan: it estimates the average
// illuminance each room will actually get, by the lumen method, and says whether that clears the
// published target. Competitors let you lay out lights. None that I could find tell you the
// kitchen lands at 180 lux when the standard wants 300.
//
// Sources
//   Downlight spacing — ceiling height / 2, capped around 6 ft:
//     https://www.eaton.com/br/en-us/company/news-insights/lighting-resource/homes/spacing-guide-for-recessed-led-lighting0.html
//   Lumen method, E = (N x lumens x UF x MF) / area:
//     https://dialux4.support-en.dial.de/support/solutions/articles/9000078303-lumen-method-
//   IS 3646-1 (1992), Code of practice for interior illumination:
//     https://law.resource.org/pub/in/bis/S05/is.3646.1.1992.pdf

import { SolvedRoom } from "./solve";
import { FURNITURE_CATALOG, PlacedCustomObject } from "./furnitureCatalog";
import { BuiltinFurnitureRecord, RoomRect, roomRect } from "./furnitureInventory";
import { WALL_HEIGHT_FT } from "./sceneConstants";
import { formatFtIn, roomDisplayNames } from "./designSchedule";

const SQ_M_PER_SQ_FT = 0.092903;

/** Recessed downlights go no further apart than this however high the ceiling. */
const MAX_DOWNLIGHT_SPACING_FT = 6.0;

/**
 * Utilisation and maintenance factors for the lumen method.
 *
 * Both are assumptions, both are stated on the sheet. UF depends on room proportion and surface
 * reflectance and runs 0.4-0.8; MF on cleaning and lamp ageing, 0.6-0.8. The midpoints are used
 * because this is a sizing estimate, not a photometric calculation — a real one needs the
 * luminaire's photometric file, which this product does not have and will not pretend to.
 */
export const UTILISATION_FACTOR = 0.5;
export const MAINTENANCE_FACTOR = 0.8;

export type FixtureKind = "fan" | "flush" | "pendant" | "chandelier" | "downlight" | "sconce" | "other";

/**
 * Assumed output per fixture, in lumens. Assumptions, not measurements — the catalog carries
 * sizes, not photometry. A fan is drawn and never counted: it is not a light.
 */
const ASSUMED_LUMENS: Record<FixtureKind, number> = {
  downlight: 800,
  flush: 1500,
  pendant: 600,
  chandelier: 1800,
  sconce: 400,
  fan: 0,
  other: 0,
};

const KIND_BY_TYPE: Record<string, FixtureKind> = {
  ceiling_fan: "fan",
  ceiling_lamp: "flush",
  pendant_light: "pendant",
  chandelier: "chandelier",
  wall_sconce: "sconce",
};

export const FIXTURE_LABELS: Record<FixtureKind, string> = {
  downlight: "Recessed downlight",
  flush: "Surface / flush fixture",
  pendant: "Pendant",
  chandelier: "Chandelier",
  sconce: "Wall sconce",
  fan: "Ceiling fan",
  other: "Other ceiling-mounted",
};

export interface CeilingFixture {
  id: string;
  name: string;
  kind: FixtureKind;
  /** World feet, same axes as the plan. */
  x: number;
  z: number;
  /** Underside height above finished floor. */
  mountFt: number;
  /** True for the generated grid, which is a suggestion and says so everywhere it appears. */
  proposed: boolean;
  lumens: number;
}

export interface LuxTarget {
  minLux: number;
  maxLux: number;
  source: string;
}

/**
 * IS 3646-1 figures, for the room kinds the searched sources actually give a number for.
 * A room kind absent from this table is drawn and scheduled but **not** assessed, the same way
 * an unsourced clearance rule says so rather than borrowing an authority.
 */
export const LUX_TARGETS: Partial<Record<string, LuxTarget>> = {
  hall: { minLux: 100, maxLux: 200, source: "https://infralens.in/thumbrules/lux-living-room" },
  kitchen: { minLux: 300, maxLux: 500, source: "https://infralens.in/thumbrules/lux-kitchen" },
  bedroom: { minLux: 100, maxLux: 150, source: "https://law.resource.org/pub/in/bis/S05/is.3646.1.1992.pdf" },
  bathroom: { minLux: 300, maxLux: 500, source: "https://law.resource.org/pub/in/bis/S05/is.3646.1.1992.pdf" },
};

export type LuxVerdict = "under" | "within" | "over" | "not assessed";

export interface RoomCeiling {
  roomIndex: number;
  floor: number;
  label: string;
  roomKind: string;
  rect: RoomRect;
  areaSqFt: number;
  fixtures: CeilingFixture[];
  spacingFt: number;
  totalLumens: number;
  estimatedLux: number;
  target: LuxTarget | null;
  verdict: LuxVerdict;
}

export interface CeilingPlan {
  rooms: RoomCeiling[];
  ceilingHeightFt: number;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  counts: Partial<Record<FixtureKind, number>>;
  existingCount: number;
  proposedCount: number;
}

/** Average illuminance by the lumen method. */
export function averageLux(totalLumens: number, areaSqFt: number): number {
  const areaSqM = areaSqFt * SQ_M_PER_SQ_FT;
  if (areaSqM <= 0) return 0;
  return Math.round((totalLumens * UTILISATION_FACTOR * MAINTENANCE_FACTOR) / areaSqM);
}

/**
 * A general-lighting grid for one room.
 *
 * Lights land on cell centres rather than at a fixed spacing from the wall, which keeps the
 * border half a cell all round — the layout a sparky would set out by eye anyway, and it never
 * puts a downlight tight against a cornice.
 */
function downlightGrid(rect: RoomRect, spacingFt: number, roomIndex: number): CeilingFixture[] {
  const cols = Math.max(1, Math.round(rect.w / spacingFt));
  const rows = Math.max(1, Math.round(rect.d / spacingFt));
  const out: CeilingFixture[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        id: `dl_${roomIndex}_${r}_${c}`,
        name: "Recessed downlight",
        kind: "downlight",
        x: rect.x + ((c + 0.5) * rect.w) / cols,
        z: rect.z + ((r + 0.5) * rect.d) / rows,
        mountFt: WALL_HEIGHT_FT,
        proposed: true,
        lumens: ASSUMED_LUMENS.downlight,
      });
    }
  }
  return out;
}

export function buildCeilingPlan(
  rooms: SolvedRoom[],
  builtins: BuiltinFurnitureRecord[],
  customObjects: PlacedCustomObject[],
  floor: number,
  proposeDownlights: boolean
): CeilingPlan {
  const names = roomDisplayNames(rooms);
  const spacing = Math.min(WALL_HEIGHT_FT / 2, MAX_DOWNLIGHT_SPACING_FT);
  const out: RoomCeiling[] = [];

  // Placed fixtures the user put up themselves. Only the ceiling- and wall-mounted ones: a desk
  // lamp is a light but it is not on the ceiling, so it has no place on this drawing.
  const placedFixtures: Array<{ fixture: CeilingFixture; x: number; z: number }> = [];
  for (const obj of customObjects) {
    const kind = KIND_BY_TYPE[obj.type];
    if (!kind) continue;
    const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
    placedFixtures.push({
      x: obj.x,
      z: obj.z,
      fixture: {
        id: obj.id,
        name: obj.name,
        kind,
        x: obj.x,
        z: obj.z,
        mountFt: (def?.mountHeightFt ?? 0) + (obj.y || 0),
        proposed: false,
        lumens: ASSUMED_LUMENS[kind],
      },
    });
  }

  rooms.forEach((room, i) => {
    if ((room.floor ?? 0) !== floor) return;
    if (room.open_sided) return;

    const rect = roomRect(room);
    const areaSqFt = rect.w * rect.d;
    const fixtures: CeilingFixture[] = [];

    for (const b of builtins) {
      if (!b.ceiling || b.roomIndex !== i) continue;
      const kind = KIND_BY_TYPE[b.type] ?? "other";
      fixtures.push({
        id: b.id,
        name: b.name,
        kind,
        x: (b.box.minX + b.box.maxX) / 2,
        z: (b.box.minZ + b.box.maxZ) / 2,
        mountFt: b.box.minY,
        proposed: false,
        lumens: ASSUMED_LUMENS[kind],
      });
    }

    for (const p of placedFixtures) {
      if (p.x >= rect.x && p.x <= rect.x + rect.w && p.z >= rect.z && p.z <= rect.z + rect.d) {
        fixtures.push(p.fixture);
      }
    }

    if (proposeDownlights) fixtures.push(...downlightGrid(rect, spacing, i));

    const totalLumens = fixtures.reduce((sum, f) => sum + f.lumens, 0);
    const estimatedLux = averageLux(totalLumens, areaSqFt);
    const target = LUX_TARGETS[room.name] ?? null;
    const verdict: LuxVerdict = !target
      ? "not assessed"
      : estimatedLux < target.minLux
        ? "under"
        : estimatedLux > target.maxLux
          ? "over"
          : "within";

    out.push({
      roomIndex: i,
      floor: room.floor ?? 0,
      label: names[i],
      roomKind: room.name,
      rect,
      areaSqFt: Math.round(areaSqFt),
      fixtures,
      spacingFt: spacing,
      totalLumens,
      estimatedLux,
      target,
      verdict,
    });
  });

  const counts: Partial<Record<FixtureKind, number>> = {};
  let existingCount = 0;
  let proposedCount = 0;
  for (const rc of out) {
    for (const f of rc.fixtures) {
      counts[f.kind] = (counts[f.kind] ?? 0) + 1;
      if (f.proposed) proposedCount += 1;
      else existingCount += 1;
    }
  }

  const bounds = out.reduce(
    (acc, rc) => ({
      minX: Math.min(acc.minX, rc.rect.x),
      minZ: Math.min(acc.minZ, rc.rect.z),
      maxX: Math.max(acc.maxX, rc.rect.x + rc.rect.w),
      maxZ: Math.max(acc.maxZ, rc.rect.z + rc.rect.d),
    }),
    { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }
  );

  return {
    rooms: out,
    ceilingHeightFt: WALL_HEIGHT_FT,
    bounds: Number.isFinite(bounds.minX) ? bounds : { minX: 0, minZ: 0, maxX: 1, maxZ: 1 },
    counts,
    existingCount,
    proposedCount,
  };
}

// ------------------------------------------------------------------------------------------
// The drawing
// ------------------------------------------------------------------------------------------

const SHEET_W = 1600;
const SHEET_H = 1050;
const INK = "#1a1916";
const RULE = "#8e8a82";
const FAINT = "#c9c4b8";
const ACCENT = "#2f4954";
const PROPOSED = "#6f9aa8";
const WARN = "#a8442f";
const PAPER = "#f6f5f2";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One fixture symbol, centred on (cx, cy).
 *
 * Symbol conventions vary by office, which is why every RCP carries a legend and why this sheet
 * draws one. These follow the common set: a circle-in-circle for a recessed downlight, a square
 * for a surface fixture, a circle on a stem for a pendant, blades for a fan.
 */
function fixtureSymbol(kind: FixtureKind, cx: number, cy: number, proposed: boolean): string {
  const stroke = proposed ? PROPOSED : INK;
  const w = proposed ? 1.4 : 1.8;
  const dash = proposed ? ' stroke-dasharray="4 3"' : "";

  switch (kind) {
    case "downlight":
      return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${stroke}" stroke-width="${w}"${dash}/><circle cx="${cx}" cy="${cy}" r="3.4" fill="${stroke}"/>`;
    case "flush":
      return `<rect x="${cx - 9}" y="${cy - 9}" width="18" height="18" fill="none" stroke="${stroke}" stroke-width="${w}"/><line x1="${cx - 9}" y1="${cy - 9}" x2="${cx + 9}" y2="${cy + 9}" stroke="${stroke}" stroke-width="1"/><line x1="${cx + 9}" y1="${cy - 9}" x2="${cx - 9}" y2="${cy + 9}" stroke="${stroke}" stroke-width="1"/>`;
    case "pendant":
    case "chandelier": {
      const r = kind === "chandelier" ? 12 : 8;
      return `<line x1="${cx}" y1="${cy - r - 7}" x2="${cx}" y2="${cy - r}" stroke="${stroke}" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="${stroke}"/>`;
    }
    case "fan": {
      const blades = [0, 90, 180, 270]
        .map((a) => {
          const rad = (a * Math.PI) / 180;
          return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(rad) * 16}" y2="${cy + Math.sin(rad) * 16}" stroke="${stroke}" stroke-width="${w}"/>`;
        })
        .join("");
      return `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="3 3"/>${blades}<circle cx="${cx}" cy="${cy}" r="4" fill="${stroke}"/>`;
    }
    case "sconce":
      return `<path d="M ${cx - 8} ${cy} A 8 8 0 0 1 ${cx + 8} ${cy} Z" fill="none" stroke="${stroke}" stroke-width="${w}"/><line x1="${cx - 9}" y1="${cy}" x2="${cx + 9}" y2="${cy}" stroke="${stroke}" stroke-width="${w}"/>`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="${stroke}" stroke-width="${w}"${dash}/>`;
  }
}

export function ceilingPlanSvg(plan: CeilingPlan, projectName = "plot-to-plan"): string {
  const margin = { left: 60, right: 330, top: 92, bottom: 120 };
  const frameW = SHEET_W - margin.left - margin.right;
  const frameH = SHEET_H - margin.top - margin.bottom;
  const spanX = Math.max(1, plan.bounds.maxX - plan.bounds.minX);
  const spanZ = Math.max(1, plan.bounds.maxZ - plan.bounds.minZ);
  const scale = Math.min(frameW / spanX, frameH / spanZ);
  const ox = margin.left + (frameW - spanX * scale) / 2;
  const oy = margin.top + (frameH - spanZ * scale) / 2;

  // Reflected: +X still runs right and +Z still runs down, exactly as the floor plan draws them.
  const px = (x: number) => ox + (x - plan.bounds.minX) * scale;
  const py = (z: number) => oy + (z - plan.bounds.minZ) * scale;

  const parts: string[] = [`<rect width="${SHEET_W}" height="${SHEET_H}" fill="${PAPER}"/>`];

  for (const rc of plan.rooms) {
    const x = px(rc.rect.x);
    const y = py(rc.rect.z);
    const w = rc.rect.w * scale;
    const h = rc.rect.d * scale;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="${INK}" stroke-width="1.8"/>`
    );

    // Ceiling grid, faint, at the downlight spacing — the setting-out the layout was built on.
    const step = rc.spacingFt * scale;
    for (let gx = x + step; gx < x + w - 1; gx += step) {
      parts.push(`<line x1="${gx}" y1="${y}" x2="${gx}" y2="${y + h}" stroke="${FAINT}" stroke-width="0.5"/>`);
    }
    for (let gy = y + step; gy < y + h - 1; gy += step) {
      parts.push(`<line x1="${x}" y1="${gy}" x2="${x + w}" y2="${gy}" stroke="${FAINT}" stroke-width="0.5"/>`);
    }

    if (w > 78 && h > 44) {
      parts.push(
        `<text x="${x + 8}" y="${y + 18}" font-family="sans-serif" font-size="13" font-weight="700" fill="${INK}">${esc(rc.label)}</text>`
      );
      parts.push(
        `<text x="${x + 8}" y="${y + 33}" font-family="monospace" font-size="10" fill="${RULE}">${rc.areaSqFt} sq ft &#183; CH ${formatFtIn(plan.ceilingHeightFt)}</text>`
      );
      const luxColor = rc.verdict === "under" ? WARN : rc.verdict === "within" ? ACCENT : RULE;
      const luxText =
        rc.target === null
          ? `${rc.estimatedLux} lux est. &#183; no published target`
          : `${rc.estimatedLux} lux est. &#183; target ${rc.target.minLux}-${rc.target.maxLux}`;
      parts.push(
        `<text x="${x + 8}" y="${y + h - 9}" font-family="monospace" font-size="10" font-weight="700" fill="${luxColor}">${luxText}</text>`
      );
    }

    for (const f of rc.fixtures) {
      parts.push(fixtureSymbol(f.kind, px(f.x), py(f.z), f.proposed));
    }
  }

  // Legend and schedule, down the right-hand margin.
  const lx = SHEET_W - margin.right + 34;
  let ly = margin.top + 6;
  parts.push(
    `<text x="${lx}" y="${ly}" font-family="sans-serif" font-size="11" letter-spacing="2" fill="${RULE}">LEGEND</text>`
  );
  ly += 24;
  const kinds = Object.keys(plan.counts) as FixtureKind[];
  for (const kind of kinds) {
    parts.push(fixtureSymbol(kind, lx + 12, ly - 4, kind === "downlight"));
    parts.push(
      `<text x="${lx + 38}" y="${ly}" font-family="sans-serif" font-size="12" fill="${INK}">${FIXTURE_LABELS[kind]}</text>`
    );
    parts.push(
      `<text x="${SHEET_W - 46}" y="${ly}" text-anchor="end" font-family="monospace" font-size="12" font-weight="700" fill="${ACCENT}">${plan.counts[kind]}</text>`
    );
    ly += 30;
  }

  ly += 8;
  parts.push(`<line x1="${lx}" y1="${ly - 14}" x2="${SHEET_W - 46}" y2="${ly - 14}" stroke="${FAINT}" stroke-width="1"/>`);
  parts.push(
    `<text x="${lx}" y="${ly}" font-family="sans-serif" font-size="11" letter-spacing="2" fill="${RULE}">ILLUMINANCE</text>`
  );
  ly += 22;
  for (const rc of plan.rooms) {
    const mark = rc.verdict === "under" ? "UNDER" : rc.verdict === "within" ? "OK" : rc.verdict === "over" ? "OVER" : "—";
    const color = rc.verdict === "under" ? WARN : rc.verdict === "within" ? ACCENT : RULE;
    parts.push(
      `<text x="${lx}" y="${ly}" font-family="sans-serif" font-size="11" fill="${INK}">${esc(rc.label)}</text>`
    );
    parts.push(
      `<text x="${SHEET_W - 46}" y="${ly}" text-anchor="end" font-family="monospace" font-size="11" font-weight="700" fill="${color}">${rc.estimatedLux} lx ${mark}</text>`
    );
    ly += 19;
  }

  parts.push(
    `<text x="40" y="52" font-family="sans-serif" font-size="12" letter-spacing="2" fill="${RULE}">REFLECTED CEILING PLAN</text>`
  );

  const tbY = SHEET_H - 74;
  parts.push(`<line x1="40" y1="${tbY}" x2="${SHEET_W - 40}" y2="${tbY}" stroke="${INK}" stroke-width="1.5"/>`);
  parts.push(
    `<text x="40" y="${tbY + 26}" font-family="sans-serif" font-size="19" font-weight="700" fill="${INK}">Ceiling plan &#183; ${plan.existingCount} existing, ${plan.proposedCount} proposed</text>`
  );
  parts.push(
    `<text x="40" y="${tbY + 46}" font-family="monospace" font-size="11" fill="${RULE}">Dashed = proposed. Downlights at ${formatFtIn(plan.rooms[0]?.spacingFt ?? 4.5)} centres (ceiling height / 2). Lux by the lumen method, UF ${UTILISATION_FACTOR}, MF ${MAINTENANCE_FACTOR}, assumed lamp output — an estimate, not a photometric calculation.</text>`
  );
  parts.push(
    `<text x="${SHEET_W - 40}" y="${tbY + 26}" text-anchor="end" font-family="monospace" font-size="12" fill="${RULE}">${esc(projectName)} &#183; ${new Date().toLocaleDateString()}</text>`
  );
  parts.push(
    `<text x="${SHEET_W - 40}" y="${tbY + 46}" text-anchor="end" font-family="monospace" font-size="11" fill="${RULE}">Drawn reflected — same orientation as the floor plan</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">${parts.join("")}</svg>`;
}

/** Every fixture on the plan as schedule rows, proposed and existing alike. */
export function ceilingScheduleCsv(plan: CeilingPlan, projectName = "Ceiling_Plan"): void {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(cell("REFLECTED CEILING PLAN — FIXTURE SCHEDULE"));
  lines.push([cell("Date"), cell(new Date().toLocaleDateString())].join(","));
  lines.push([cell("Ceiling height"), cell(formatFtIn(plan.ceilingHeightFt))].join(","));
  lines.push([cell("Utilisation factor (assumed)"), cell(UTILISATION_FACTOR)].join(","));
  lines.push([cell("Maintenance factor (assumed)"), cell(MAINTENANCE_FACTOR)].join(","));
  lines.push("");
  lines.push(
    ["Room", "Fixture", "Type", "Status", "X (ft)", "Z (ft)", "Mount (ft)", "Assumed lumens"]
      .map(cell)
      .join(",")
  );
  for (const rc of plan.rooms) {
    for (const f of rc.fixtures) {
      lines.push(
        [
          rc.label,
          f.name,
          FIXTURE_LABELS[f.kind],
          f.proposed ? "proposed" : "existing",
          f.x.toFixed(2),
          f.z.toFixed(2),
          f.mountFt.toFixed(2),
          f.lumens,
        ]
          .map(cell)
          .join(",")
      );
    }
  }
  lines.push("");
  lines.push(cell("ILLUMINANCE CHECK"));
  lines.push(
    ["Room", "Area (sq ft)", "Total lumens", "Estimated lux", "Target", "Verdict", "Source"]
      .map(cell)
      .join(",")
  );
  for (const rc of plan.rooms) {
    lines.push(
      [
        rc.label,
        rc.areaSqFt,
        rc.totalLumens,
        rc.estimatedLux,
        rc.target ? `${rc.target.minLux}-${rc.target.maxLux}` : "no published figure found",
        rc.verdict,
        rc.target?.source ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }

  const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
  const a = document.createElement("a");
  a.setAttribute("href", csv);
  a.setAttribute("download", `${projectName}_Fixture_Schedule.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
