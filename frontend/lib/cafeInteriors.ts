// Procedural café fit-out — the cafe half of addRoomInteriorDetails().
//
// Kept out of interiorDetails.ts because that file is already 1,600 lines of house, and a second
// building type has no business growing it further. Same contract: mutate the room group, and tag
// anything a user should be able to select or delete with the builtin userData shape.
//
// The seating grid is the one piece here that is not decoration. Its pitch comes from the trade
// figures in notes/programs/cafe-layout-standards.md — 42-60 in between square tables, a 36 in
// ADA aisle with 44 in preferred on main routes, and 15-20 sq ft per seated customer. Laying the
// tables out at those numbers is what turns "a room labelled seating" into a cover count the
// manager can argue with.

import * as THREE from "three";
import { RoomName } from "./rooms";

export interface CafeDoorInfo {
  edge: "N" | "S" | "E" | "W";
  center: number;
  isEntrance?: boolean;
}

export const CAFE_SPACES: ReadonlySet<RoomName> = new Set<RoomName>([
  "seating",
  "lounge",
  "entry",
  "queue",
  "counter",
  "prep",
  "pantry",
  "wash",
  "washroom",
  "staff",
]);

// Clearances, in feet. TABLE_PITCH is table centre to table centre: a 2.5 ft top plus the 42 in
// minimum gap, rounded to 6 ft so two chairs pulled out still leave the aisle.
const TABLE_TOP_FT = 2.5;
const TABLE_PITCH_FT = 6.0;
// The ADA minimum aisle, 36 in. Anything more generous and the grid drops a whole column: at a
// 3.5 ft margin an 18 ft room fits two columns instead of three, which reads as 36 sq ft per
// seat against a trade target of 15-20.
const PERIMETER_AISLE_FT = 3.0;
const MAX_TABLES = 16;

const wood = () => new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.55 });
const darkWood = () => new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.5 });
const blackMetal = () =>
  new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.35, metalness: 0.7 });
const steel = () =>
  new THREE.MeshStandardMaterial({ color: 0xc3c9ce, roughness: 0.28, metalness: 0.85 });
const brass = () =>
  new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9 });
const glass = () =>
  new THREE.MeshStandardMaterial({
    color: 0xdfefff,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
  });
const porcelain = () => new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cyl(
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  segments = 20
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Wrap meshes as one selectable, deletable built-in object. */
function place(
  group: THREE.Group,
  deletedIds: Set<string> | undefined,
  id: string,
  name: string,
  type: string,
  x: number,
  z: number,
  parts: THREE.Object3D[],
  rotationY = 0
): void {
  if (deletedIds?.has(id)) return;
  const item = new THREE.Group();
  parts.forEach((p) => item.add(p));
  item.userData = {
    isFurniture: true,
    isBuiltin: true,
    id,
    name,
    type,
    x,
    y: 0,
    z,
    rotationY,
  };
  group.add(item);
}

/** A two-top: pedestal table plus a chair either side. */
function cafeTable(x: number, z: number): THREE.Object3D[] {
  const top = cyl(TABLE_TOP_FT / 2, TABLE_TOP_FT / 2, 0.14, wood(), x, 2.42, z, 24);
  const column = cyl(0.16, 0.16, 2.35, blackMetal(), x, 1.2, z, 12);
  const foot = cyl(0.75, 0.85, 0.1, blackMetal(), x, 0.05, z, 20);

  const parts: THREE.Object3D[] = [top, column, foot];
  for (const side of [-1, 1]) {
    const cz = z + side * 2.05;
    parts.push(box(1.45, 0.16, 1.4, wood(), x, 1.48, cz));
    parts.push(box(1.45, 1.55, 0.14, wood(), x, 2.3, cz + side * 0.62));
    parts.push(box(1.1, 1.4, 1.05, blackMetal(), x, 0.7, cz));
  }
  return parts;
}

function addSeating(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const usableW = rw - 2 * PERIMETER_AISLE_FT;
  const usableD = rd - 2 * PERIMETER_AISLE_FT;
  if (usableW < TABLE_TOP_FT || usableD < TABLE_TOP_FT) return;

  const cols = Math.max(1, Math.floor(usableW / TABLE_PITCH_FT) + 1);
  const rows = Math.max(1, Math.floor(usableD / TABLE_PITCH_FT) + 1);

  const spanW = (cols - 1) * TABLE_PITCH_FT;
  const spanD = (rows - 1) * TABLE_PITCH_FT;
  const startX = rx + rw / 2 - spanW / 2;
  const startZ = rz + rd / 2 - spanD / 2;

  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= MAX_TABLES) return;
      const x = startX + c * TABLE_PITCH_FT;
      const z = startZ + r * TABLE_PITCH_FT;
      place(
        group,
        deletedIds,
        `builtin_${roomIndex}_table_${r}_${c}`,
        `Two-Top Table ${placed + 1}`,
        "cafe_table_two_top",
        x,
        z,
        cafeTable(x, z)
      );
      placed++;
    }
  }
}

/**
 * Service counter: order end, till, then a pickup shelf at the far end.
 *
 * The order-to-pickup split is the whole point — the handoff is the classic bottleneck, so it
 * sits at the opposite end of the run from the register.
 */
function addCounter(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const alongX = rw >= rd;
  const runLen = Math.max(4, (alongX ? rw : rd) - 1.0);
  const depth = Math.min(2.2, (alongX ? rd : rw) - 1.0);
  if (depth < 1.0) return;

  const cx = rx + rw / 2;
  const cz = rz + rd / 2;

  // Local axis helper: u runs along the counter, v across it.
  const at = (u: number, v: number): [number, number] =>
    alongX ? [cx + u, cz + v] : [cx + v, cz + u];

  const parts: THREE.Object3D[] = [];
  const push = (w: number, h: number, d: number, mat: THREE.Material, u: number, y: number, v: number) => {
    const [x, z] = at(u, v);
    parts.push(box(alongX ? w : d, h, alongX ? d : w, mat, x, y, z));
  };
  const pushCyl = (r: number, h: number, mat: THREE.Material, u: number, y: number, v: number) => {
    const [x, z] = at(u, v);
    parts.push(cyl(r, r, h, mat, x, y, z));
  };

  // Body and top
  push(runLen, 3.3, depth, darkWood(), 0, 1.65, 0);
  push(runLen + 0.3, 0.18, depth + 0.35, wood(), 0, 3.42, 0);
  // Kick rail
  push(runLen, 0.12, depth + 0.2, brass(), 0, 0.35, 0);

  const orderEnd = -runLen / 2 + 1.4;
  const pickupEnd = runLen / 2 - 1.4;

  // Pastry case over the order end
  push(3.0, 1.5, depth * 0.75, glass(), orderEnd, 4.26, 0);
  push(3.0, 0.1, depth * 0.75, steel(), orderEnd, 3.56, 0);

  // Till
  push(1.1, 0.9, 0.7, blackMetal(), orderEnd + 2.4, 3.96, -depth * 0.15);

  // Espresso machine and grinder, mid-run
  push(3.2, 1.5, 1.5, steel(), 0.2, 4.26, 0.1);
  pushCyl(0.12, 0.7, blackMetal(), -0.6, 3.85, -depth * 0.32);
  pushCyl(0.12, 0.7, blackMetal(), 0.9, 3.85, -depth * 0.32);
  pushCyl(0.38, 1.9, steel(), 2.4, 4.46, 0.1);

  // Pickup shelf, deliberately away from the till
  push(2.6, 0.14, depth * 0.6, wood(), pickupEnd, 3.7, 0);
  for (let i = 0; i < 3; i++) {
    pushCyl(0.2, 0.42, porcelain(), pickupEnd - 0.8 + i * 0.8, 3.98, 0);
  }

  // Pendants over the counter
  for (const u of [-runLen * 0.25, runLen * 0.25]) {
    const [x, z] = at(u, 0);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.7, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.4, side: THREE.DoubleSide })
    );
    shade.position.set(x, 6.6, z);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffca6a, emissiveIntensity: 1.4 })
    );
    bulb.position.set(x, 6.35, z);
    const lamp = new THREE.PointLight(0xffc978, 0.55, 14, 1.6);
    lamp.position.set(x, 6.2, z);
    parts.push(shade, bulb, lamp);
  }

  place(
    group,
    deletedIds,
    `builtin_${roomIndex}_counter`,
    "Service Counter & Espresso Bar",
    "cafe_counter",
    cx,
    cz,
    parts
  );
}

function addQueue(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const alongX = rw >= rd;
  const runLen = (alongX ? rw : rd) - 1.0;
  const cx = rx + rw / 2;
  const cz = rz + rd / 2;
  const parts: THREE.Object3D[] = [];

  // Floor markers every 3 ft, the spacing a queue actually stands at.
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xd8b26a, roughness: 0.8 });
  const steps = Math.max(2, Math.min(5, Math.floor(runLen / 3)));
  for (let i = 0; i < steps; i++) {
    const u = -runLen / 2 + 1.0 + i * 3.0;
    const x = alongX ? cx + u : cx;
    const z = alongX ? cz : cz + u;
    parts.push(cyl(0.7, 0.7, 0.03, markerMat, x, 0.02, z, 24));
  }

  // A pair of stanchions at the head of the line.
  for (const side of [-1, 1]) {
    const u = -runLen / 2 + 0.6;
    const v = side * Math.min(1.4, (alongX ? rd : rw) / 2 - 0.5);
    const x = alongX ? cx + u : cx + v;
    const z = alongX ? cz + v : cz + u;
    parts.push(cyl(0.28, 0.34, 0.1, blackMetal(), x, 0.05, z, 16));
    parts.push(cyl(0.09, 0.09, 3.2, brass(), x, 1.6, z, 12));
    parts.push(cyl(0.14, 0.14, 0.16, brass(), x, 3.25, z, 12));
  }

  place(
    group,
    deletedIds,
    `builtin_${roomIndex}_queue`,
    "Queue Markers & Stanchions",
    "cafe_queue_line",
    cx,
    cz,
    parts
  );
}

/** The decompression zone stays clear on purpose — a mat and one planter, nothing in the path. */
function addEntry(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const cx = rx + rw / 2;
  const cz = rz + rd / 2;
  const mat = box(
    Math.min(rw - 1.0, 4.5),
    0.06,
    Math.min(rd - 1.0, 3.0),
    new THREE.MeshStandardMaterial({ color: 0x2f3a45, roughness: 0.95 }),
    cx,
    0.03,
    cz
  );
  place(group, deletedIds, `builtin_${roomIndex}_mat`, "Entrance Mat", "cafe_entry_mat", cx, cz, [mat]);

  const px = rx + 0.9;
  const pz = rz + rd - 0.9;
  place(
    group,
    deletedIds,
    `builtin_${roomIndex}_entry_planter`,
    "Entry Planter",
    "cafe_planter",
    px,
    pz,
    [
      cyl(0.55, 0.42, 1.5, new THREE.MeshStandardMaterial({ color: 0x9c6b4f, roughness: 0.8 }), px, 0.75, pz, 16),
      new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.9 })
      ).translateX(px).translateY(2.4).translateZ(pz),
    ]
  );
}

function addLounge(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const cx = rx + rw / 2;
  const cz = rz + rd / 2;
  const sofaW = Math.min(rw - 2.5, 7.0);

  place(group, deletedIds, `builtin_${roomIndex}_rug`, "Lounge Rug", "cafe_rug", cx, cz, [
    box(
      Math.min(rw - 1.5, 9),
      0.05,
      Math.min(rd - 1.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.95 }),
      cx,
      0.03,
      cz
    ),
  ]);

  const sz = rz + 1.8;
  const fabric = new THREE.MeshStandardMaterial({ color: 0x4a5a68, roughness: 0.85 });
  place(group, deletedIds, `builtin_${roomIndex}_banquette`, "Lounge Banquette", "cafe_banquette", cx, sz, [
    box(sofaW, 1.35, 2.6, fabric, cx, 0.68, sz),
    box(sofaW, 1.7, 0.5, fabric, cx, 2.2, sz - 1.05),
    box(sofaW, 0.28, 2.4, new THREE.MeshStandardMaterial({ color: 0x5d6f7e, roughness: 0.8 }), cx, 1.5, sz),
  ]);

  const tz = sz + 3.6;
  place(group, deletedIds, `builtin_${roomIndex}_lounge_table`, "Coffee Table", "cafe_coffee_table", cx, tz, [
    box(3.4, 0.16, 1.9, wood(), cx, 1.35, tz),
    box(3.0, 1.25, 1.5, darkWood(), cx, 0.65, tz),
  ]);
}

function addPrep(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const cx = rx + rw / 2;

  // Stainless prep island down the middle — the commercial equivalent of a kitchen counter.
  const islandW = Math.min(rw - 4.0, 8.0);
  const iz = rz + rd / 2;
  place(group, deletedIds, `builtin_${roomIndex}_prep_island`, "Prep Island", "cafe_prep_island", cx, iz, [
    box(islandW, 2.9, 2.6, steel(), cx, 1.45, iz),
    box(islandW + 0.2, 0.14, 2.8, steel(), cx, 2.97, iz),
    box(islandW - 0.6, 0.1, 2.2, steel(), cx, 0.8, iz),
  ]);

  // Range against the back wall, with an extraction hood over it.
  const gz = rz + rd - 1.6;
  const rangeParts: THREE.Object3D[] = [
    box(4.2, 2.9, 2.4, steel(), cx, 1.45, gz),
    box(4.2, 0.12, 2.4, blackMetal(), cx, 2.98, gz),
  ];
  for (let i = 0; i < 4; i++) {
    rangeParts.push(
      cyl(0.42, 0.42, 0.06, blackMetal(), cx - 1.5 + i * 1.0, 3.06, gz, 16)
    );
  }
  rangeParts.push(box(5.0, 1.6, 3.0, steel(), cx, 6.0, gz));
  rangeParts.push(box(4.4, 0.5, 2.6, blackMetal(), cx, 5.1, gz));
  place(group, deletedIds, `builtin_${roomIndex}_range`, "Range & Extraction Hood", "cafe_range", cx, gz, rangeParts);

  // Reach-in fridge in a corner.
  const fx = rx + 1.7;
  const fz = rz + 1.6;
  place(group, deletedIds, `builtin_${roomIndex}_fridge`, "Reach-In Fridge", "cafe_fridge", fx, fz, [
    box(2.9, 6.4, 2.6, steel(), fx, 3.2, fz),
    box(0.12, 3.0, 0.12, blackMetal(), fx + 1.5, 4.0, fz - 0.7),
  ]);
}

function addPantry(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const shelfMat = steel();
  for (const [idx, wallZ] of [rz + 1.0, rz + rd - 1.0].entries()) {
    const cx = rx + rw / 2;
    const parts: THREE.Object3D[] = [];
    const unitW = Math.min(rw - 1.2, 6.5);
    for (let s = 0; s < 4; s++) {
      parts.push(box(unitW, 0.12, 1.5, shelfMat, cx, 1.2 + s * 1.7, wallZ));
    }
    for (const side of [-1, 1]) {
      parts.push(box(0.14, 6.4, 0.14, shelfMat, cx + side * (unitW / 2 - 0.1), 3.2, wallZ));
    }
    place(
      group,
      deletedIds,
      `builtin_${roomIndex}_racking_${idx}`,
      `Dry Store Racking ${idx + 1}`,
      "cafe_racking",
      cx,
      wallZ,
      parts
    );
  }
}

function addWash(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const cx = rx + rw / 2;
  const sz = rz + rd - 1.5;
  const parts: THREE.Object3D[] = [
    box(Math.min(rw - 1.2, 6.0), 2.9, 2.2, steel(), cx, 1.45, sz),
    box(Math.min(rw - 1.2, 6.0), 0.14, 2.2, steel(), cx, 3.0, sz),
  ];
  for (const side of [-1, 1]) {
    parts.push(box(1.6, 0.5, 1.4, blackMetal(), cx + side * 1.2, 2.85, sz));
  }
  parts.push(cyl(0.08, 0.08, 1.6, steel(), cx, 3.8, sz - 0.8, 12));
  place(group, deletedIds, `builtin_${roomIndex}_pot_sink`, "Double Pot Sink", "cafe_pot_sink", cx, sz, parts);
}

function addWashroom(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const wx = rx + 1.4;
  const wz = rz + rd - 1.6;
  place(group, deletedIds, `builtin_${roomIndex}_wc`, "WC", "cafe_wc", wx, wz, [
    box(1.5, 1.3, 2.2, porcelain(), wx, 0.65, wz),
    box(1.5, 0.18, 1.4, porcelain(), wx, 1.38, wz + 0.3),
    box(1.6, 2.0, 0.7, porcelain(), wx, 1.6, wz - 1.0),
  ]);

  const bx = rx + rw - 1.5;
  const bz = rz + 1.5;
  place(group, deletedIds, `builtin_${roomIndex}_basin`, "Basin & Mirror", "cafe_basin", bx, bz, [
    box(2.2, 0.5, 1.5, porcelain(), bx, 2.6, bz),
    cyl(0.07, 0.07, 0.9, brass(), bx, 3.2, bz - 0.5, 12),
    box(
      2.0,
      2.6,
      0.08,
      new THREE.MeshStandardMaterial({ color: 0xdfe9f2, roughness: 0.05, metalness: 0.9 }),
      bx,
      4.6,
      bz - 0.85
    ),
  ]);
}

function addStaff(
  group: THREE.Group,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number,
  deletedIds?: Set<string>
): void {
  const lx = rx + rw / 2;
  const lz = rz + 0.9;
  const lockerParts: THREE.Object3D[] = [box(Math.min(rw - 1.5, 5.0), 5.6, 1.4, blackMetal(), lx, 2.8, lz)];
  for (let i = 0; i < 3; i++) {
    lockerParts.push(box(0.1, 5.4, 0.06, steel(), lx - 1.6 + i * 1.6, 2.8, lz + 0.72));
  }
  place(group, deletedIds, `builtin_${roomIndex}_lockers`, "Staff Lockers", "cafe_lockers", lx, lz, lockerParts);

  const tx = rx + rw / 2;
  const tz = rz + rd - 2.0;
  place(group, deletedIds, `builtin_${roomIndex}_staff_table`, "Break Table", "cafe_break_table", tx, tz, [
    box(3.4, 0.16, 2.4, wood(), tx, 2.42, tz),
    box(3.0, 2.3, 2.0, darkWood(), tx, 1.2, tz),
  ]);
}

/**
 * Fit out one cafe space. Returns false when the name is not a cafe space, so the caller can
 * fall through to the residential fit-out.
 */
export function addCafeInteriorDetails(
  group: THREE.Group,
  roomName: RoomName,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  roomIndex: number = 0,
  deletedIds?: Set<string>
): boolean {
  if (rw <= 1 || rd <= 1) return CAFE_SPACES.has(roomName);

  switch (roomName) {
    case "seating":
      addSeating(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "counter":
      addCounter(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "queue":
      addQueue(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "entry":
      addEntry(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "lounge":
      addLounge(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "prep":
      addPrep(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "pantry":
      addPantry(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "wash":
      addWash(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "washroom":
      addWashroom(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    case "staff":
      addStaff(group, rx, rz, rw, rd, roomIndex, deletedIds);
      return true;
    default:
      return false;
  }
}

/**
 * Seats the laid-out grid actually fits, and the sq ft per seat that implies.
 *
 * The trade figure is 15-20 sq ft per seated customer including circulation; anything under 15
 * means the tables are packed tighter than the aisles allow.
 */
export function seatingCapacity(rw: number, rd: number): { seats: number; sqFtPerSeat: number } {
  const usableW = rw - 2 * PERIMETER_AISLE_FT;
  const usableD = rd - 2 * PERIMETER_AISLE_FT;
  if (usableW < TABLE_TOP_FT || usableD < TABLE_TOP_FT) return { seats: 0, sqFtPerSeat: 0 };
  const cols = Math.max(1, Math.floor(usableW / TABLE_PITCH_FT) + 1);
  const rows = Math.max(1, Math.floor(usableD / TABLE_PITCH_FT) + 1);
  const tables = Math.min(cols * rows, MAX_TABLES);
  const seats = tables * 2;
  return { seats, sqFtPerSeat: seats > 0 ? Math.round((rw * rd) / seats) : 0 };
}
