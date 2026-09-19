// Clearance audit — the numbers an interior designer was trained on, measured off the model.
//
// The fit-out already respects clearances quietly (see notes/findings/furniture-clearances.md).
// Quiet is worth nothing in a review: a designer cannot tell a plan that was checked from one
// that got lucky. This states every gap it measured, what the gap has to be, and who says so.
//
// Where a rule has a published authority it is cited. Where it does not, it says
// "Trade practice" and carries no source, because inventing an authority for a number is worse
// than admitting the number is convention.

import { SolvedRoom } from "./solve";
import { PlacedCustomObject } from "./furnitureCatalog";
import {
  BuiltinFurnitureRecord,
  FLOOR_OBSTACLE_MAX_Y_FT,
  FurnitureBox,
  RoomRect,
  overlap,
  roomRect,
} from "./furnitureInventory";
import { placedObjectBox } from "./elevations";
import { RoomName } from "./rooms";
import { roomDisplayNames } from "./designSchedule";
import { inchesToFeet } from "./units";

export type Authority = "NKBA" | "Trade practice";

export interface ClearanceRule {
  id: string;
  name: string;
  minIn: number;
  authority: Authority;
  /** Published source, or empty when the rule is convention rather than a standard. */
  source: string;
  note: string;
}

/**
 * NKBA figures are from the Kitchen Planning Guidelines with Access Standards.
 * https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf
 */
export const CLEARANCE_RULES: Record<string, ClearanceRule> = {
  kitchen_aisle: {
    id: "kitchen_aisle",
    name: "Kitchen work aisle",
    minIn: 42,
    authority: "NKBA",
    source: "https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf",
    note: "42 in for one cook, 48 in where two people work the kitchen at once.",
  },
  walkway: {
    id: "walkway",
    name: "Walkway",
    minIn: 36,
    authority: "NKBA",
    source: "https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf",
    note: "A walkway is at least 36 in. Where two walkways cross, one of them should be 42 in.",
  },
  dining_pull: {
    id: "dining_pull",
    name: "Seating pull-out with traffic behind",
    minIn: 36,
    authority: "NKBA",
    source: "https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf",
    note: "32 in from the table edge with no traffic, 36 in where traffic passes, 44 in to walk behind a seated diner.",
  },
  bed_side: {
    id: "bed_side",
    name: "Bedside passage",
    minIn: 24,
    authority: "Trade practice",
    source: "",
    note: "No standards body publishes this. 24 in is what the trade builds to; treat it as convention, not code.",
  },
  door_approach: {
    id: "door_approach",
    name: "Clear floor at a door",
    minIn: 36,
    authority: "Trade practice",
    source: "",
    note: "No published source found for a residential figure. 36 in of clear depth inside the leaf is convention.",
  },
};

export type Severity = "fail" | "tight";

export interface ClearanceFinding {
  ruleId: string;
  ruleName: string;
  room: string;
  between: string;
  measuredIn: number;
  requiredIn: number;
  severity: Severity;
  authority: Authority;
  source: string;
}

export interface ClearanceAudit {
  findings: ClearanceFinding[];
  /** How many gaps were actually measured. A clean report on zero measurements means nothing. */
  gapsMeasured: number;
  roomsChecked: number;
  roomsSkipped: string[];
}

/** Below this a piece is against a wall or touching its neighbour, not forming a passage. */
const TOUCHING_FT = 0.4;

/** You cannot walk into a pendant. Anything hung clear of the floor is not a gap. */
const isFloorObstacle = (box: FurnitureBox): boolean => box.minY < FLOOR_OBSTACLE_MAX_Y_FT;

/** Two pieces have to face each other by at least this much before the gap is a passage. */
const FACING_FT = 1.0;

/** A gap this much over the minimum still gets flagged, as "tight" rather than "fail". */
const TIGHT_MARGIN_IN = 3;

/** Which rule governs the open gaps in a room of this kind. */
function ruleForRoom(name: string): ClearanceRule {
  if (name === "kitchen" || name === "prep") return CLEARANCE_RULES.kitchen_aisle;
  if (name === "dining" || name === "seating") return CLEARANCE_RULES.dining_pull;
  if (name === "bedroom") return CLEARANCE_RULES.bed_side;
  return CLEARANCE_RULES.walkway;
}

function verdict(measuredIn: number, rule: ClearanceRule): Severity | null {
  if (measuredIn < rule.minIn) return "fail";
  if (measuredIn < rule.minIn + TIGHT_MARGIN_IN) return "tight";
  return null;
}

interface NamedBox {
  name: string;
  box: FurnitureBox;
}

/** The gap between two boxes, if they face each other at all. */
function gapBetween(a: FurnitureBox, b: FurnitureBox): number | null {
  if (overlap(a.minX, a.maxX, b.minX, b.maxX) >= FACING_FT) {
    return Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ);
  }
  if (overlap(a.minZ, a.maxZ, b.minZ, b.maxZ) >= FACING_FT) {
    return Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX);
  }
  return null;
}

/** The gap from a box to each wall it faces, as [wall label, gap in feet]. */
function gapsToWalls(rect: RoomRect, box: FurnitureBox): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  if (overlap(box.minX, box.maxX, rect.x, rect.x + rect.w) >= FACING_FT) {
    out.push(["north wall", box.minZ - rect.z]);
    out.push(["south wall", rect.z + rect.d - box.maxZ]);
  }
  if (overlap(box.minZ, box.maxZ, rect.z, rect.z + rect.d) >= FACING_FT) {
    out.push(["west wall", box.minX - rect.x]);
    out.push(["east wall", rect.x + rect.w - box.maxX]);
  }
  return out;
}

export function auditClearances(
  rooms: SolvedRoom[],
  builtins: BuiltinFurnitureRecord[],
  customObjects: PlacedCustomObject[]
): ClearanceAudit {
  const names = roomDisplayNames(rooms);
  const findings: ClearanceFinding[] = [];
  const roomsSkipped: string[] = [];
  let gapsMeasured = 0;
  let roomsChecked = 0;

  // Placed pieces, matched to a room by footprint centre — the same rule the schedule uses.
  const placedByRoom = new Map<number, NamedBox[]>();
  for (const obj of customObjects) {
    const box = placedObjectBox(obj);
    if (!box) continue;
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const idx = rooms.findIndex((r) => {
      const rect = roomRect(r);
      return cx >= rect.x && cx <= rect.x + rect.w && cz >= rect.z && cz <= rect.z + rect.d;
    });
    if (idx < 0 || !isFloorObstacle(box)) continue;
    const list = placedByRoom.get(idx) ?? [];
    list.push({ name: obj.name, box });
    placedByRoom.set(idx, list);
  }

  const record = (
    rule: ClearanceRule,
    room: string,
    between: string,
    gapFt: number
  ): void => {
    gapsMeasured += 1;
    const measuredIn = Math.round(gapFt * 12);
    const severity = verdict(measuredIn, rule);
    if (!severity) return;
    findings.push({
      ruleId: rule.id,
      ruleName: rule.name,
      room,
      between,
      measuredIn,
      requiredIn: rule.minIn,
      severity,
      authority: rule.authority,
      source: rule.source,
    });
  };

  rooms.forEach((room, i) => {
    const boxes: NamedBox[] = [
      ...builtins
        .filter((b) => b.roomIndex === i && isFloorObstacle(b.box))
        .map((b) => ({ name: b.name, box: b.box })),
      ...(placedByRoom.get(i) ?? []),
    ];
    if (boxes.length === 0) {
      roomsSkipped.push(`${names[i]} — nothing placed in it`);
      return;
    }
    roomsChecked += 1;

    const rect = roomRect(room);
    const rule = ruleForRoom(room.name);
    const label = names[i];

    // Passage between two pieces.
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const gap = gapBetween(boxes[a].box, boxes[b].box);
        if (gap === null || gap < TOUCHING_FT) continue;
        record(rule, label, `${boxes[a].name} ↔ ${boxes[b].name}`, gap);
      }
    }

    // Passage between a piece and a wall. A piece pushed up against the wall is not a passage.
    for (const item of boxes) {
      for (const [wall, gap] of gapsToWalls(rect, item.box)) {
        if (gap < TOUCHING_FT) continue;
        record(rule, label, `${item.name} ↔ ${wall}`, gap);
      }
    }

    // Clear floor inside each door. Measured as how far you can step in before you hit something.
    const doorRule = CLEARANCE_RULES.door_approach;
    for (const o of room.openings ?? []) {
      if (o.kind !== "door" && o.kind !== "entrance") continue;
      const originIn = o.edge === "N" || o.edge === "S" ? room.x_in : room.y_in;
      const start = inchesToFeet(originIn + o.offset_in);
      const end = start + inchesToFeet(o.width_in);

      let clear = doorRule.minIn / 12;
      for (const item of boxes) {
        const box = item.box;
        let depth: number | null = null;
        if (o.edge === "N" && overlap(box.minX, box.maxX, start, end) > 0) depth = box.minZ - rect.z;
        else if (o.edge === "S" && overlap(box.minX, box.maxX, start, end) > 0)
          depth = rect.z + rect.d - box.maxZ;
        else if (o.edge === "W" && overlap(box.minZ, box.maxZ, start, end) > 0)
          depth = box.minX - rect.x;
        else if (o.edge === "E" && overlap(box.minZ, box.maxZ, start, end) > 0)
          depth = rect.x + rect.w - box.maxX;
        if (depth !== null && depth < clear) clear = Math.max(0, depth);
      }
      record(doorRule, label, `${o.kind === "entrance" ? "Main entrance" : "Door"} on the ${o.edge} wall ↔ nearest piece`, clear);
    }
  });

  // Worst first: a fail before a tight, and within each, the biggest shortfall.
  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "fail" ? -1 : 1;
    return b.requiredIn - b.measuredIn - (a.requiredIn - a.measuredIn);
  });

  return { findings, gapsMeasured, roomsChecked, roomsSkipped };
}

export function exportClearanceAuditToCsv(
  audit: ClearanceAudit,
  projectName = "Clearance_Audit"
): void {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(cell("CLEARANCE AUDIT"));
  lines.push([cell("Date"), cell(new Date().toLocaleDateString())].join(","));
  lines.push([cell("Gaps measured"), cell(audit.gapsMeasured)].join(","));
  lines.push([cell("Rooms checked"), cell(audit.roomsChecked)].join(","));
  lines.push([cell("Findings"), cell(audit.findings.length)].join(","));
  lines.push("");
  lines.push(
    ["Severity", "Rule", "Room", "Between", "Measured (in)", "Required (in)", "Authority", "Source"]
      .map(cell)
      .join(",")
  );
  for (const f of audit.findings) {
    lines.push(
      [
        f.severity,
        f.ruleName,
        f.room,
        f.between,
        f.measuredIn,
        f.requiredIn,
        f.authority,
        f.source || "no published source",
      ]
        .map(cell)
        .join(",")
    );
  }
  const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
  const a = document.createElement("a");
  a.setAttribute("href", csv);
  a.setAttribute("download", `${projectName}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
