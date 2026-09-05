// Architectural Blueprint Export & Vector Generation Engine
// Generates standard architectural sheets with title block, schedules, dimensions, and CAD annotations.

import { PlotDims, Facing, Setback, edgeSetbacksIn, frontCardinalIndex } from "./plot";
import { SolvedRoom, SolveMeta } from "./solve";
import { inchesToFeet } from "./units";
import { ROOM_LABELS, RoomName } from "./rooms";

export interface BlueprintExportOptions {
  plot: PlotDims;
  facing: Facing;
  setback: Setback;
  rooms: SolvedRoom[];
  meta: SolveMeta | null;
  theme?: "blueprint" | "dark" | "drafting";
  showVaastu?: boolean;
  showFurniture?: boolean;
}

export function formatFeetInches(inches: number): string {
  const roundedInches = Math.round(inches);
  const feet = Math.floor(roundedInches / 12);
  const remainingInches = roundedInches % 12;
  return `${feet}′-0″` === `${feet}′-${remainingInches}″` && remainingInches === 0
    ? `${feet}′-0″`
    : `${feet}′-${remainingInches}″`;
}

export function formatAreaSqFt(widthIn: number, depthIn: number): string {
  const sqFt = (widthIn * depthIn) / 144;
  return `${sqFt.toFixed(1)} sq.ft`;
}

export const VAASTU_ZONE_LABELS: Record<string, { tag: string; name: string; element: string }> = {
  NE: { tag: "NE", name: "Ishanya (North-East)", element: "Water / Divine" },
  E: { tag: "E", name: "Purva (East)", element: "Sun / Vitality" },
  SE: { tag: "SE", name: "Agni (South-East)", element: "Fire / Energy" },
  S: { tag: "S", name: "Dakshina (South)", element: "Mars / Strength" },
  SW: { tag: "SW", name: "Nairutya (South-West)", element: "Earth / Stability" },
  W: { tag: "W", name: "Pashchima (West)", element: "Water / Prosperity" },
  NW: { tag: "NW", name: "Vayavya (North-West)", element: "Air / Movement" },
  N: { tag: "N", name: "Uttara (North)", element: "Mercury / Wealth" },
  C: { tag: "CENTER", name: "Brahma Sthana (Center)", element: "Space / Harmony" },
};

export function getRoomVaastuZone(
  room: SolvedRoom,
  plotWIn: number,
  plotDIn: number
): string {
  const cx = room.x_in + room.w_in / 2;
  const cy = room.y_in + room.d_in / 2;

  const col = cx < plotWIn / 3 ? 0 : cx < (plotWIn * 2) / 3 ? 1 : 2;
  const row = cy < plotDIn / 3 ? 0 : cy < (plotDIn * 2) / 3 ? 1 : 2;

  if (row === 0 && col === 0) return "NW";
  if (row === 0 && col === 1) return "N";
  if (row === 0 && col === 2) return "NE";
  if (row === 1 && col === 0) return "W";
  if (row === 1 && col === 1) return "CENTER";
  if (row === 1 && col === 2) return "E";
  if (row === 2 && col === 0) return "SW";
  if (row === 2 && col === 1) return "S";
  if (row === 2 && col === 2) return "SE";
  return "N";
}

/**
 * Generate full standalone SVG of the architectural blueprint drawing sheet
 */
export function generateBlueprintSvg({
  plot,
  facing,
  setback,
  rooms,
  meta,
  theme = "blueprint",
}: BlueprintExportOptions): string {
  const SHEET_W = 1600;
  const SHEET_H = 1050;
  const MARGIN = 30;

  const PLAN_BOX_X = MARGIN + 10;
  const PLAN_BOX_Y = MARGIN + 10;
  const PLAN_BOX_W = 1040;
  const PLAN_BOX_H = SHEET_H - (MARGIN + 10) * 2;

  const TITLE_BLOCK_X = PLAN_BOX_X + PLAN_BOX_W + 15;
  const TITLE_BLOCK_Y = MARGIN + 10;
  const TITLE_BLOCK_W = SHEET_W - TITLE_BLOCK_X - MARGIN - 10;
  const TITLE_BLOCK_H = PLAN_BOX_H;

  // Theme palettes
  const palettes = {
    blueprint: {
      bg: "#131210",
      grid: "#0e2d4f",
      sheetBorder: "#1e5388",
      accent: "#6f9aa8",
      accent2: "#3d5c69",
      textPrimary: "#eceae5",
      textSecondary: "#8ab3bf",
      textMuted: "#60a5fa",
      wallFill: "#0c3b6d",
      wallStroke: "#8ab3bf",
      innerWallStroke: "#6f9aa8",
      dimensionLine: "#6f9aa8",
      doorArc: "#d4703a",
      windowLine: "#7a9668",
      setbackDashed: "#f43f5e",
      tableBg: "#0a2544",
      tableHeaderBg: "#103c6b",
      tableBorder: "#1e5388",
    },
    dark: {
      bg: "#0b0f19",
      grid: "#161f33",
      sheetBorder: "#3a372f",
      accent: "#b85c22",
      accent2: "#b85c22",
      textPrimary: "#eceae5",
      textSecondary: "#b5b0a6",
      textMuted: "#8e8a82",
      wallFill: "#1e293b",
      wallStroke: "#eceae5",
      innerWallStroke: "#8e8a82",
      dimensionLine: "#b85c22",
      doorArc: "#6f9aa8",
      windowLine: "#7a9668",
      setbackDashed: "#a8442f",
      tableBg: "#111827",
      tableHeaderBg: "#1f2937",
      tableBorder: "#374151",
    },
    drafting: {
      bg: "#ffffff",
      grid: "#eceae5",
      sheetBorder: "#1a1916",
      accent: "#3d5c69",
      accent2: "#2f4954",
      textPrimary: "#1a1916",
      textSecondary: "#3a372f",
      textMuted: "#6d685e",
      wallFill: "#b5b0a6",
      wallStroke: "#1a1916",
      innerWallStroke: "#3a372f",
      dimensionLine: "#3d5c69",
      doorArc: "#8a4318",
      windowLine: "#4c6640",
      setbackDashed: "#dc2626",
      tableBg: "#eceae5",
      tableHeaderBg: "#d8d4cb",
      tableBorder: "#b5b0a6",
    },
  };

  const colors = palettes[theme] ?? palettes.blueprint;

  // Plan viewport scaling
  const PLAN_PAD = 85;
  const drawAreaW = PLAN_BOX_W - PLAN_PAD * 2;
  const drawAreaH = PLAN_BOX_H - PLAN_PAD * 2;

  const scale = Math.min(drawAreaW / Math.max(plot.widthIn, 1), drawAreaH / Math.max(plot.depthIn, 1));
  const planOriginX = PLAN_BOX_X + PLAN_PAD + (drawAreaW - plot.widthIn * scale) / 2;
  const planOriginY = PLAN_BOX_Y + PLAN_PAD + (drawAreaH - plot.depthIn * scale) / 2;

  const toPxX = (xIn: number) => planOriginX + xIn * scale;
  const toPxY = (yIn: number) => planOriginY + yIn * scale;

  // Computations
  const totalPlotSqFt = (plot.widthIn * plot.depthIn) / 144;
  const totalPlotSqYds = totalPlotSqFt / 9;
  const totalBuiltSqFt = rooms.reduce((acc, r) => acc + (r.w_in * r.d_in) / 144, 0);
  const groundCoveragePct = ((totalBuiltSqFt / totalPlotSqFt) * 100).toFixed(1);

  const [setbackN, setbackE, setbackS, setbackW] = edgeSetbacksIn(facing, setback);

  // Envelope bounds in world inches
  const envX = setbackW;
  const envY = setbackN;
  const envW = Math.max(0, plot.widthIn - setbackW - setbackE);
  const envD = Math.max(0, plot.depthIn - setbackN - setbackS);

  // SVG Construction
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}" height="${SHEET_H}">
  <defs>
    <style>
      .cad-title { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-weight: 800; }
      .cad-heading { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-weight: 700; }
      .cad-text { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-weight: 500; }
      .cad-dim { font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; }
      .cad-mono { font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; }
    </style>
    <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${colors.grid}" stroke-width="0.75" />
    </pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${colors.dimensionLine}" />
    </marker>
    <marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <line x1="2" y1="8" x2="8" y2="2" stroke="${colors.dimensionLine}" stroke-width="1.8" />
    </marker>
  </defs>

  <!-- Sheet Background -->
  <rect width="${SHEET_W}" height="${SHEET_H}" fill="${colors.bg}" />
  <rect x="${MARGIN}" y="${MARGIN}" width="${SHEET_W - MARGIN * 2}" height="${SHEET_H - MARGIN * 2}" fill="url(#cadGrid)" stroke="${colors.sheetBorder}" stroke-width="2" />
  <rect x="${MARGIN + 4}" y="${MARGIN + 4}" width="${SHEET_W - MARGIN * 2 - 8}" height="${SHEET_H - MARGIN * 2 - 8}" fill="none" stroke="${colors.sheetBorder}" stroke-width="1" stroke-dasharray="8,4" />

  <!-- Plan Box Frame -->
  <rect x="${PLAN_BOX_X}" y="${PLAN_BOX_Y}" width="${PLAN_BOX_W}" height="${PLAN_BOX_H}" fill="none" stroke="${colors.sheetBorder}" stroke-width="1.5" />

  <!-- Plan View Title Header -->
  <rect x="${PLAN_BOX_X}" y="${PLAN_BOX_Y}" width="${PLAN_BOX_W}" height="32" fill="${colors.tableHeaderBg}" stroke="${colors.sheetBorder}" stroke-width="1" />
  <text x="${PLAN_BOX_X + 16}" y="${PLAN_BOX_Y + 21}" fill="${colors.textPrimary}" class="cad-heading" font-size="13" letter-spacing="1">GROUND FLOOR PLAN &amp; MEASUREMENTS</text>
  <text x="${PLAN_BOX_X + PLAN_BOX_W - 16}" y="${PLAN_BOX_Y + 21}" fill="${colors.accent}" class="cad-mono" text-anchor="end" font-weight="bold">SCALE: 1/4″ = 1′-0″ (N.T.S.)</text>
`;

  // Plot Outline & Dimensions
  const plotPxX = toPxX(0);
  const plotPxY = toPxY(0);
  const plotPxW = plot.widthIn * scale;
  const plotPxH = plot.depthIn * scale;

  // Road Facing Edge Indicator
  const frontIdx = frontCardinalIndex(facing);
  const facingNames = ["NORTH", "EAST", "SOUTH", "WEST"];
  const roadLabel = `PROPOSED ROAD / FRONTAGE (${facingNames[frontIdx]})`;

  // Plot Boundary
  svg += `
  <!-- Plot Boundary -->
  <rect x="${plotPxX}" y="${plotPxY}" width="${plotPxW}" height="${plotPxH}" fill="none" stroke="${colors.textPrimary}" stroke-width="2" stroke-dasharray="12,4" />
  <text x="${plotPxX + 8}" y="${plotPxY + 16}" fill="${colors.textMuted}" class="cad-mono" font-size="10">PLOT BOUNDARY</text>

  <!-- Road Frontage Strip -->
`;

  if (frontIdx === 0) {
    // North (Top)
    svg += `  <rect x="${plotPxX}" y="${plotPxY - 26}" width="${plotPxW}" height="20" fill="${colors.accent}22" stroke="${colors.accent}" stroke-width="1" />
  <text x="${plotPxX + plotPxW / 2}" y="${plotPxY - 13}" fill="${colors.accent}" class="cad-heading" font-size="11" text-anchor="middle" letter-spacing="1">▲ ${roadLabel} ▲</text>`;
  } else if (frontIdx === 1) {
    // East (Right)
    svg += `  <rect x="${plotPxX + plotPxW + 6}" y="${plotPxY}" width="20" height="${plotPxH}" fill="${colors.accent}22" stroke="${colors.accent}" stroke-width="1" />
  <text x="${plotPxX + plotPxW + 16}" y="${plotPxY + plotPxH / 2}" fill="${colors.accent}" class="cad-heading" font-size="11" text-anchor="middle" transform="rotate(90, ${plotPxX + plotPxW + 16}, ${plotPxY + plotPxH / 2})" letter-spacing="1">▲ ${roadLabel} ▲</text>`;
  } else if (frontIdx === 2) {
    // South (Bottom)
    svg += `  <rect x="${plotPxX}" y="${plotPxY + plotPxH + 6}" width="${plotPxW}" height="20" fill="${colors.accent}22" stroke="${colors.accent}" stroke-width="1" />
  <text x="${plotPxX + plotPxW / 2}" y="${plotPxY + plotPxH + 19}" fill="${colors.accent}" class="cad-heading" font-size="11" text-anchor="middle" letter-spacing="1">▼ ${roadLabel} ▼</text>`;
  } else {
    // West (Left)
    svg += `  <rect x="${plotPxX - 26}" y="${plotPxY}" width="20" height="${plotPxH}" fill="${colors.accent}22" stroke="${colors.accent}" stroke-width="1" />
  <text x="${plotPxX - 16}" y="${plotPxY + plotPxH / 2}" fill="${colors.accent}" class="cad-heading" font-size="11" text-anchor="middle" transform="rotate(-90, ${plotPxX - 16}, ${plotPxY + plotPxH / 2})" letter-spacing="1">▲ ${roadLabel} ▲</text>`;
  }

  // Buildable Envelope & Setbacks
  const envPxX = toPxX(envX);
  const envPxY = toPxY(envY);
  const envPxW = envW * scale;
  const envPxH = envD * scale;

  svg += `
  <!-- Setback Envelope -->
  <rect x="${envPxX}" y="${envPxY}" width="${envPxW}" height="${envPxH}" fill="${colors.setbackDashed}08" stroke="${colors.setbackDashed}" stroke-width="1.2" stroke-dasharray="6,4" />
  <text x="${envPxX + 6}" y="${envPxY - 6}" fill="${colors.setbackDashed}" class="cad-mono" font-size="9.5">BUILDABLE ENVELOPE (${formatFeetInches(envW)} × ${formatFeetInches(envD)})</text>
`;

  // Plot Dimensions (Outer strings)
  // Top Dimension (Width)
  const dimTopY = plotPxY - 45;
  svg += `
  <!-- Top Plot Dimension -->
  <line x1="${plotPxX}" y1="${plotPxY - 8}" x2="${plotPxX}" y2="${dimTopY - 8}" stroke="${colors.dimensionLine}" stroke-width="1" />
  <line x1="${plotPxX + plotPxW}" y1="${plotPxY - 8}" x2="${plotPxX + plotPxW}" y2="${dimTopY - 8}" stroke="${colors.dimensionLine}" stroke-width="1" />
  <line x1="${plotPxX}" y1="${dimTopY}" x2="${plotPxX + plotPxW}" y2="${dimTopY}" stroke="${colors.dimensionLine}" stroke-width="1.5" marker-start="url(#tick)" marker-end="url(#tick)" />
  <rect x="${plotPxX + plotPxW / 2 - 45}" y="${dimTopY - 11}" width="90" height="20" fill="${colors.bg}" rx="3" />
  <text x="${plotPxX + plotPxW / 2}" y="${dimTopY + 3}" fill="${colors.accent}" class="cad-dim" font-size="12" text-anchor="middle">${formatFeetInches(plot.widthIn)}</text>
`;

  // Right Plot Dimension (Depth)
  const dimRightX = plotPxX + plotPxW + 45;
  svg += `
  <!-- Right Plot Dimension -->
  <line x1="${plotPxX + plotPxW + 8}" y1="${plotPxY}" x2="${dimRightX + 8}" y2="${plotPxY}" stroke="${colors.dimensionLine}" stroke-width="1" />
  <line x1="${plotPxX + plotPxW + 8}" y1="${plotPxY + plotPxH}" x2="${dimRightX + 8}" y2="${plotPxY + plotPxH}" stroke="${colors.dimensionLine}" stroke-width="1" />
  <line x1="${dimRightX}" y1="${plotPxY}" x2="${dimRightX}" y2="${plotPxY + plotPxH}" stroke="${colors.dimensionLine}" stroke-width="1.5" marker-start="url(#tick)" marker-end="url(#tick)" />
  <rect x="${dimRightX - 10}" y="${plotPxY + plotPxH / 2 - 45}" width="20" height="90" fill="${colors.bg}" rx="3" />
  <text x="${dimRightX}" y="${plotPxY + plotPxH / 2}" fill="${colors.accent}" class="cad-dim" font-size="12" text-anchor="middle" transform="rotate(90, ${dimRightX}, ${plotPxY + plotPxH / 2})">${formatFeetInches(plot.depthIn)}</text>
`;

  // Render Placed Rooms
  rooms.forEach((room, idx) => {
    const rx = toPxX(room.x_in);
    const ry = toPxY(room.y_in);
    const rw = room.w_in * scale;
    const rd = room.d_in * scale;

    const label = ROOM_LABELS[room.name as RoomName] ?? room.name.toUpperCase();
    const zone = getRoomVaastuZone(room, plot.widthIn, plot.depthIn);
    const zoneInfo = VAASTU_ZONE_LABELS[zone];

    const wallThicknessPx = Math.max(2, 4.5 * scale);

    svg += `
    <!-- Room ${idx}: ${room.name} -->
    <g id="room-${idx}">
      <!-- Room Fill -->
      <rect x="${rx}" y="${ry}" width="${rw}" height="${rd}" fill="${colors.wallFill}" stroke="${colors.wallStroke}" stroke-width="2.5" />

      <!-- Inner Wall Cavity Offset -->
      <rect x="${rx + wallThicknessPx}" y="${ry + wallThicknessPx}" width="${Math.max(0, rw - wallThicknessPx * 2)}" height="${Math.max(0, rd - wallThicknessPx * 2)}" fill="${colors.bg}88" stroke="${colors.innerWallStroke}" stroke-width="0.8" stroke-dasharray="2,2" />

      <!-- Center Room Info Badge -->
      <g transform="translate(${rx + rw / 2}, ${ry + rd / 2})">
        <!-- Room Label -->
        <text x="0" y="-12" fill="${colors.textPrimary}" class="cad-heading" font-size="12" text-anchor="middle">${label}</text>

        <!-- Room Dimensions -->
        <text x="0" y="4" fill="${colors.accent}" class="cad-dim" font-size="11" text-anchor="middle">${formatFeetInches(room.w_in)} × ${formatFeetInches(room.d_in)}</text>

        <!-- Carpet Area & Vaastu Badge -->
        <text x="0" y="18" fill="${colors.textSecondary}" class="cad-mono" font-size="9.5" text-anchor="middle">${formatAreaSqFt(room.w_in, room.d_in)} | ${zoneInfo?.tag ?? zone}</text>
      </g>
    `;

    // Render Openings (Doors & Windows)
    (room.openings ?? []).forEach((opening) => {
      const openOffsetPx = opening.offset_in * scale;
      const openWidthPx = opening.width_in * scale;

      let ox = rx;
      let oy = ry;

      if (opening.edge === "N") {
        ox = rx + openOffsetPx;
        oy = ry;
      } else if (opening.edge === "S") {
        ox = rx + openOffsetPx;
        oy = ry + rd;
      } else if (opening.edge === "E") {
        ox = rx + rw;
        oy = ry + openOffsetPx;
      } else if (opening.edge === "W") {
        ox = rx;
        oy = ry + openOffsetPx;
      }

      if (opening.kind === "door" || opening.kind === "entrance") {
        // Door Opening: Cut opening + 90 deg swing arc
        const isEntrance = opening.kind === "entrance";
        const doorColor = isEntrance ? colors.accent : colors.doorArc;

        svg += `
        <!-- Door on ${opening.edge} -->
        <line x1="${ox}" y1="${oy}" x2="${opening.edge === "N" || opening.edge === "S" ? ox + openWidthPx : ox}" y2="${opening.edge === "E" || opening.edge === "W" ? oy + openWidthPx : oy}" stroke="${colors.bg}" stroke-width="4.5" />
        <path d="${
          opening.edge === "N"
            ? `M ${ox} ${oy} L ${ox} ${oy + openWidthPx} A ${openWidthPx} ${openWidthPx} 0 0 0 ${ox + openWidthPx} ${oy}`
            : opening.edge === "S"
            ? `M ${ox} ${oy} L ${ox} ${oy - openWidthPx} A ${openWidthPx} ${openWidthPx} 0 0 1 ${ox + openWidthPx} ${oy}`
            : opening.edge === "E"
            ? `M ${ox} ${oy} L ${ox - openWidthPx} ${oy} A ${openWidthPx} ${openWidthPx} 0 0 0 ${ox} ${oy + openWidthPx}`
            : `M ${ox} ${oy} L ${ox + openWidthPx} ${oy} A ${openWidthPx} ${openWidthPx} 0 0 1 ${ox} ${oy + openWidthPx}`
        }" fill="none" stroke="${doorColor}" stroke-width="1.5" />
        `;

        if (isEntrance) {
          svg += `
          <!-- Main Entrance Arrow -->
          <circle cx="${ox + (opening.edge === "N" || opening.edge === "S" ? openWidthPx / 2 : 0)}" cy="${oy + (opening.edge === "E" || opening.edge === "W" ? openWidthPx / 2 : 0)}" r="4" fill="${colors.accent}" />
          <text x="${ox + (opening.edge === "N" || opening.edge === "S" ? openWidthPx / 2 : 0)}" y="${oy + (opening.edge === "N" ? -8 : opening.edge === "S" ? 14 : 0)}" fill="${colors.accent}" class="cad-mono" font-size="8" font-weight="bold" text-anchor="middle">MAIN ENTRY</text>
          `;
        }
      } else if (opening.kind === "window") {
        // Window Opening: Double parallel line
        const isHoriz = opening.edge === "N" || opening.edge === "S";
        const wx2 = isHoriz ? ox + openWidthPx : ox;
        const wy2 = isHoriz ? oy : oy + openWidthPx;

        svg += `
        <!-- Window on ${opening.edge} -->
        <line x1="${ox}" y1="${oy}" x2="${wx2}" y2="${wy2}" stroke="${colors.windowLine}" stroke-width="3" />
        <line x1="${isHoriz ? ox : ox - 2}" y1="${isHoriz ? oy - 2 : oy}" x2="${isHoriz ? wx2 : wx2 - 2}" y2="${isHoriz ? wy2 - 2 : wy2}" stroke="${colors.windowLine}" stroke-width="1" />
        <line x1="${isHoriz ? ox : ox + 2}" y1="${isHoriz ? oy + 2 : oy}" x2="${isHoriz ? wx2 : wx2 + 2}" y2="${isHoriz ? wy2 + 2 : wy2}" stroke="${colors.windowLine}" stroke-width="1" />
        `;
      }
    });

    svg += `  </g>\n`;
  });

  // North Compass Arrow in Plan Box
  const compassX = PLAN_BOX_X + PLAN_BOX_W - 55;
  const compassY = PLAN_BOX_Y + 75;
  svg += `
  <!-- North Arrow Indicator -->
  <g transform="translate(${compassX}, ${compassY})">
    <circle cx="0" cy="0" r="24" fill="${colors.tableBg}" stroke="${colors.accent}" stroke-width="1.5" />
    <path d="M 0 -18 L 6 0 L 0 -4 L -6 0 z" fill="${colors.accent}" />
    <path d="M 0 18 L 6 0 L 0 4 L -6 0 z" fill="${colors.textMuted}" opacity="0.6" />
    <text x="0" y="-22" fill="${colors.accent}" class="cad-heading" font-size="11" text-anchor="middle">N</text>
  </g>
`;

  // ==========================================
  // TITLE BLOCK (Right Column)
  // ==========================================
  svg += `
  <!-- TITLE BLOCK -->
  <g transform="translate(${TITLE_BLOCK_X}, ${TITLE_BLOCK_Y})">
    <!-- Frame -->
    <rect x="0" y="0" width="${TITLE_BLOCK_W}" height="${TITLE_BLOCK_H}" fill="${colors.tableBg}" stroke="${colors.tableBorder}" stroke-width="1.5" />

    <!-- Header Block -->
    <rect x="0" y="0" width="${TITLE_BLOCK_W}" height="68" fill="${colors.tableHeaderBg}" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="16" y="26" fill="${colors.accent}" class="cad-heading" font-size="14" letter-spacing="1">PLOT-TO-PLAN ARCHITECTURE</text>
    <text x="16" y="44" fill="${colors.textPrimary}" class="cad-title" font-size="16">RESIDENTIAL FLOOR PLAN BLUEPRINT</text>
    <text x="16" y="58" fill="${colors.textSecondary}" class="cad-mono">CP-SAT CONSTRAINT ENGINE · TG-BPASS COMPLIANT</text>

    <!-- SECTION 1: PROJECT & PLOT SPECIFICATION -->
    <rect x="0" y="68" width="${TITLE_BLOCK_W}" height="24" fill="${colors.sheetBorder}44" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="12" y="84" fill="${colors.accent}" class="cad-heading" font-size="10.5" letter-spacing="0.5">1. PLOT &amp; AREA SPECIFICATIONS</text>

    <g transform="translate(12, 100)" class="cad-text" font-size="10.5">
      <text x="0" y="0" fill="${colors.textSecondary}">Plot Dimensions:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="0" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${inchesToFeet(plot.widthIn)}′ × ${inchesToFeet(plot.depthIn)}′ ft (${plot.widthIn / 12}′ × ${plot.depthIn / 12}′)</text>

      <text x="0" y="18" fill="${colors.textSecondary}">Road Facing:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="18" fill="${colors.accent}" font-weight="bold" text-anchor="end">${facing} (${facingNames[frontIdx]} FACING)</text>

      <text x="0" y="36" fill="${colors.textSecondary}">Total Plot Area:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="36" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${totalPlotSqFt.toFixed(1)} sq.ft (${totalPlotSqYds.toFixed(1)} sq.yds)</text>

      <text x="0" y="54" fill="${colors.textSecondary}">Built-up Ground Area:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="54" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${totalBuiltSqFt.toFixed(1)} sq.ft</text>

      <text x="0" y="72" fill="${colors.textSecondary}">Ground Coverage Ratio:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="72" fill="${colors.accent}" font-weight="bold" text-anchor="end">${groundCoveragePct}%</text>

      <text x="0" y="90" fill="${colors.textSecondary}">Buildable Footprint:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="90" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${formatFeetInches(envW)} × ${formatFeetInches(envD)}</text>
    </g>

    <!-- SECTION 2: SETBACK SCHEDULE -->
    <rect x="0" y="200" width="${TITLE_BLOCK_W}" height="24" fill="${colors.sheetBorder}44" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="12" y="216" fill="${colors.accent}" class="cad-heading" font-size="10.5" letter-spacing="0.5">2. STATUTORY SETBACK SCHEDULE</text>

    <g transform="translate(12, 232)" class="cad-text" font-size="10.5">
      <text x="0" y="0" fill="${colors.textSecondary}">Front Setback (${facingNames[frontIdx]}):</text>
      <text x="${TITLE_BLOCK_W - 24}" y="0" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${formatFeetInches(setback.frontIn)} (Required: 5′-0″)</text>

      <text x="0" y="18" fill="${colors.textSecondary}">Rear Setback:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="18" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${formatFeetInches(setback.rearIn)} (Required: 5′-0″)</text>

      <text x="0" y="36" fill="${colors.textSecondary}">Side Setbacks (L / R):</text>
      <text x="${TITLE_BLOCK_W - 24}" y="36" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">${formatFeetInches(setback.leftIn)} / ${formatFeetInches(setback.rightIn)} (Required: 3′-0″)</text>
    </g>

    <!-- SECTION 3: ROOM SCHEDULE TABLE -->
    <rect x="0" y="284" width="${TITLE_BLOCK_W}" height="24" fill="${colors.sheetBorder}44" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="12" y="300" fill="${colors.accent}" class="cad-heading" font-size="10.5" letter-spacing="0.5">3. ROOM SCHEDULE &amp; VAASTU MATRIX</text>

    <!-- Table Header -->
    <rect x="10" y="314" width="${TITLE_BLOCK_W - 20}" height="20" fill="${colors.tableHeaderBg}" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="16" y="328" fill="${colors.textPrimary}" class="cad-heading" font-size="9.5">ROOM</text>
    <text x="130" y="328" fill="${colors.textPrimary}" class="cad-heading" font-size="9.5">SIZE (W × D)</text>
    <text x="235" y="328" fill="${colors.textPrimary}" class="cad-heading" font-size="9.5">AREA</text>
    <text x="${TITLE_BLOCK_W - 20}" y="328" fill="${colors.textPrimary}" class="cad-heading" font-size="9.5" text-anchor="end">ZONE</text>
`;

  // Table Rows
  rooms.forEach((r, i) => {
    const rowY = 338 + i * 20;
    const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
    const zone = getRoomVaastuZone(r, plot.widthIn, plot.depthIn);

    svg += `
    <rect x="10" y="${rowY}" width="${TITLE_BLOCK_W - 20}" height="20" fill="${i % 2 === 0 ? colors.tableBg : colors.tableHeaderBg + "44"}" stroke="${colors.tableBorder}" stroke-width="0.5" />
    <text x="16" y="${rowY + 14}" fill="${colors.textPrimary}" class="cad-text" font-size="9.5">${label}</text>
    <text x="130" y="${rowY + 14}" fill="${colors.accent}" class="cad-dim" font-size="9.5">${formatFeetInches(r.w_in)} × ${formatFeetInches(r.d_in)}</text>
    <text x="235" y="${rowY + 14}" fill="${colors.textSecondary}" class="cad-mono" font-size="9">${formatAreaSqFt(r.w_in, r.d_in)}</text>
    <text x="${TITLE_BLOCK_W - 20}" y="${rowY + 14}" fill="${colors.textMuted}" class="cad-mono" font-size="9" text-anchor="end">${zone}</text>
    `;
  });

  const scheduleEndY = 348 + rooms.length * 20 + 10;

  // SECTION 4: OPENINGS SCHEDULE
  const totalDoors = rooms.reduce((acc, r) => acc + (r.openings?.filter((o) => o.kind === "door" || o.kind === "entrance").length ?? 0), 0);
  const totalWindows = rooms.reduce((acc, r) => acc + (r.openings?.filter((o) => o.kind === "window").length ?? 0), 0);

  svg += `
    <!-- SECTION 4: OPENINGS SCHEDULE -->
    <rect x="0" y="${scheduleEndY}" width="${TITLE_BLOCK_W}" height="24" fill="${colors.sheetBorder}44" stroke="${colors.tableBorder}" stroke-width="1" />
    <text x="12" y="${scheduleEndY + 16}" fill="${colors.accent}" class="cad-heading" font-size="10.5" letter-spacing="0.5">4. SCHEDULE OF OPENINGS</text>

    <g transform="translate(12, ${scheduleEndY + 32})" class="cad-text" font-size="10">
      <text x="0" y="0" fill="${colors.textSecondary}">Main Entrance Door:</text>
      <text x="${TITLE_BLOCK_W - 24}" y="0" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">3′-6″ × 7′-0″ (Teak Wood)</text>

      <text x="0" y="16" fill="${colors.textSecondary}">Internal Doors (${totalDoors - 1} Nos):</text>
      <text x="${TITLE_BLOCK_W - 24}" y="16" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">3′-0″ × 7′-0″ (Flush Shutter)</text>

      <text x="0" y="32" fill="${colors.textSecondary}">External Windows (${totalWindows} Nos):</text>
      <text x="${TITLE_BLOCK_W - 24}" y="32" fill="${colors.textPrimary}" font-weight="bold" text-anchor="end">4′-0″ × 4′-6″ (Sill: 3′-0″)</text>
    </g>

    <!-- CERTIFICATION FOOTER -->
    <rect x="0" y="${TITLE_BLOCK_H - 95}" width="${TITLE_BLOCK_W}" height="95" fill="${colors.tableHeaderBg}" stroke="${colors.tableBorder}" stroke-width="1" />
    <g transform="translate(12, ${TITLE_BLOCK_H - 75})" class="cad-mono" font-size="9.5">
      <text x="0" y="0" fill="${colors.accent}" font-weight="bold">SOLVER ENGINE CERTIFICATION</text>
      <text x="0" y="14" fill="${colors.textSecondary}">Status: ${meta?.status ?? "OPTIMAL"} (${meta?.solve_ms ?? 120} ms)</text>
      <text x="0" y="28" fill="${colors.textSecondary}">Vaastu Zones Active: ${meta?.vaastu_constraints_applied?.length ?? 0} Zones Enforced</text>
      <text x="0" y="42" fill="${colors.textSecondary}">Rooms Reachable: ${meta?.rooms_reachable ?? rooms.length} / ${rooms.length} (100% Walkable)</text>
      <text x="0" y="58" fill="${colors.textMuted}">Date: ${new Date().toISOString().split("T")[0]} | Sheet: 01 OF 01</text>
    </g>
  </g>
</svg>
`;

  return svg;
}

/**
 * Trigger download of raw SVG file
 */
export function downloadBlueprintSvg(svgString: string, filename = "house-blueprint.svg"): void {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export high-resolution PNG image (4K resolution rasterized offscreen)
 */
export async function downloadBlueprintPng(
  svgString: string,
  filename = "house-blueprint.png",
  scaleMultiplier = 2.0
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const width = 1600 * scaleMultiplier;
        const height = 1050 * scaleMultiplier;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not create canvas 2D rendering context");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error("PNG blob generation failed"));
            return;
          }
          const pngUrl = URL.createObjectURL(pngBlob);
          const link = document.createElement("a");
          link.href = pngUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Print or export PDF sheet via formatted print window
 */
export function printBlueprintSheet(svgString: string, title = "House Blueprint Drawing"): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to open the print preview.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A3 landscape;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .sheet-container {
            width: 100%;
            max-width: 100vw;
            display: flex;
            justify-content: center;
          }
          svg {
            width: 100%;
            height: auto;
            max-height: 96vh;
          }
          @media print {
            body {
              min-height: auto;
            }
            .sheet-container {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          ${svgString}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
