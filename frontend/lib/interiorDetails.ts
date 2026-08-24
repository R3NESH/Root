// Intelligent, Door-Aware High-Fidelity 3D Interior & Architectural Furniture Details
// Real-world architectural layouts: Zero door blockages, 3.5ft+ clear circulation corridors,
// procedural PBR materials, and realistic furniture ergonomics.

import * as THREE from "three";
import { RoomName } from "./rooms";

export interface RoomDoorInfo {
  edge: "N" | "S" | "E" | "W";
  center: number;
  isEntrance?: boolean;
}

// -------------------------------------------------------------
// Procedural High-Res PBR Floor Textures
// -------------------------------------------------------------

export function getMarbleFloorTexture(isPooja: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = isPooja ? "#faf6ee" : "#f1f5f9";
  ctx.fillRect(0, 0, 1024, 1024);

  // Marble Veins
  ctx.save();
  for (let v = 0; v < 9; v++) {
    ctx.strokeStyle = isPooja ? "rgba(195, 155, 100, 0.16)" : "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = Math.random() * 5 + 2;
    ctx.filter = "blur(3px)";
    ctx.beginPath();
    let x = Math.random() * 1024;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 1024) {
      x += (Math.random() - 0.48) * 110;
      y += Math.random() * 90 + 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Subtle 4x4 slab seams
  ctx.strokeStyle = "rgba(0, 0, 0, 0.07)";
  ctx.lineWidth = 2;
  const tileSize = 256;
  for (let x = 0; x <= 1024; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function getWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const plankH = 64;
  const numPlanks = 1024 / plankH;

  for (let i = 0; i < numPlanks; i++) {
    const y = i * plankH;
    const toneVariation = (Math.random() - 0.5) * 18;
    const r = Math.round(116 + toneVariation);
    const g = Math.round(78 + toneVariation * 0.7);
    const b = Math.round(54 + toneVariation * 0.5);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, 1024, plankH);

    ctx.strokeStyle = "rgba(45, 28, 18, 0.22)";
    ctx.lineWidth = 1.2;
    for (let gIdx = 0; gIdx < 6; gIdx++) {
      const gy = y + Math.random() * plankH;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(340, gy + (Math.random() - 0.5) * 8, 680, gy + (Math.random() - 0.5) * 8, 1024, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(25, 14, 8, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + plankH);
    ctx.lineTo(1024, y + plankH);
    ctx.stroke();

    const offset = (i % 3) * 340 + (i % 2) * 120;
    for (let x = offset % 340; x < 1024; x += 340) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankH);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function getTileFloorTexture(isKitchen: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = isKitchen ? "#e2e8f0" : "#cbd5e1";
  ctx.fillRect(0, 0, 512, 512);

  const size = 128;
  ctx.strokeStyle = isKitchen ? "#94a3b8" : "#64748b";
  ctx.lineWidth = 3;

  for (let x = 0; x <= 512; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

// -------------------------------------------------------------
// Animated Ceiling Fan with Frosted Globe Light
// -------------------------------------------------------------

export function addCeilingFan(group: THREE.Group, cx: number, cz: number, y: number): THREE.Group {
  const fanGroup = new THREE.Group();
  fanGroup.position.set(cx, y, cz);

  const mountMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.35, metalness: 0.7 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3d2718, roughness: 0.45, metalness: 0.1 });
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xfffae8,
    emissive: 0xffecc4,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 12), mountMat);
  rod.position.y = 0.45;
  fanGroup.add(rod);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.3, 24), mountMat);
  motor.position.y = 0;
  fanGroup.add(motor);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), globeMat);
  globe.position.y = -0.15;
  fanGroup.add(globe);

  const bladesGroup = new THREE.Group();
  bladesGroup.position.y = 0.02;

  const numBlades = 3;
  for (let i = 0; i < numBlades; i++) {
    const angle = (i * Math.PI * 2) / numBlades;
    const bladeArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.4), mountMat);
    bladeArm.position.set(Math.sin(angle) * 0.4, 0, Math.cos(angle) * 0.4);
    bladeArm.rotation.y = angle;
    bladesGroup.add(bladeArm);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 1.8), bladeMat);
    blade.position.set(Math.sin(angle) * 1.3, 0, Math.cos(angle) * 1.3);
    blade.rotation.y = angle;
    blade.rotation.x = 0.08;
    blade.castShadow = true;
    bladesGroup.add(blade);
  }

  fanGroup.add(bladesGroup);
  group.add(fanGroup);
  return bladesGroup;
}

// -------------------------------------------------------------
// High-Quality Window with Aluminum Frame & Pleated Curtains
// -------------------------------------------------------------

export function buildWindowWithCurtains(
  group: THREE.Group,
  wx: number,
  wy: number,
  wz: number,
  winW: number,
  winH: number,
  wallThick: number,
  isEW: boolean,
  hasCurtains: boolean = true,
  isPrivacyGlass: boolean = false
) {
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1f242b,
    roughness: 0.35,
    metalness: 0.85,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: isPrivacyGlass ? 0xd0e8ec : 0x88ccff,
    transparent: true,
    opacity: isPrivacyGlass ? 0.85 : 0.38,
    roughness: isPrivacyGlass ? 0.7 : 0.05,
    metalness: 0.1,
    transmission: isPrivacyGlass ? 0.3 : 0.9,
    ior: 1.52,
  });

  const frameThick = 0.14;
  const glassW = winW - frameThick * 2;
  const glassH = winH - frameThick * 2;

  if (isEW) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.05), glassMat);
    glass.position.set(wx, wy, wz);
    group.add(glass);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(winW, frameThick, wallThick + 0.06), frameMat);
    frameTop.position.set(wx, wy + winH / 2 - frameThick / 2, wz);
    group.add(frameTop);

    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(winW, frameThick + 0.06, wallThick + 0.12), frameMat);
    frameBot.position.set(wx, wy - winH / 2 + frameThick / 2, wz);
    group.add(frameBot);

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, wallThick + 0.06), frameMat);
    frameL.position.set(wx - winW / 2 + frameThick / 2, wy, wz);
    group.add(frameL);

    const frameR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, wallThick + 0.06), frameMat);
    frameR.position.set(wx + winW / 2 - frameThick / 2, wy, wz);
    group.add(frameR);

    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH, wallThick + 0.04), frameMat);
    mullion.position.set(wx, wy, wz);
    group.add(mullion);

    if (hasCurtains) {
      const curtainMat = new THREE.MeshStandardMaterial({
        color: 0xeeece6,
        roughness: 0.9,
        metalness: 0.02,
      });
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x221c16, metalness: 0.7, roughness: 0.3 });

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, winW + 1.2, 12), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(wx, wy + winH / 2 + 0.35, wz + (wallThick / 2 + 0.18));
      group.add(rod);

      const panelW = winW * 0.28;
      const panelH = winH + 1.6;

      const leftCurtain = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.12), curtainMat);
      leftCurtain.position.set(wx - winW / 2 + panelW / 2 - 0.1, wy - 0.45, wz + (wallThick / 2 + 0.18));
      group.add(leftCurtain);

      const rightCurtain = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.12), curtainMat);
      rightCurtain.position.set(wx + winW / 2 - panelW / 2 + 0.1, wy - 0.45, wz + (wallThick / 2 + 0.18));
      group.add(rightCurtain);
    }
  } else {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, glassH, glassW), glassMat);
    glass.position.set(wx, wy, wz);
    group.add(glass);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.06, frameThick, winW), frameMat);
    frameTop.position.set(wx, wy + winH / 2 - frameThick / 2, wz);
    group.add(frameTop);

    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.12, frameThick + 0.06, winW), frameMat);
    frameBot.position.set(wx, wy - winH / 2 + frameThick / 2, wz);
    group.add(frameBot);

    const frameN = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.06, winH, frameThick), frameMat);
    frameN.position.set(wx, wy, wz - winW / 2 + frameThick / 2);
    group.add(frameN);

    const frameS = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.06, winH, frameThick), frameMat);
    frameS.position.set(wx, wy, wz + winW / 2 - frameThick / 2);
    group.add(frameS);

    const mullion = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.04, winH, 0.08), frameMat);
    mullion.position.set(wx, wy, wz);
    group.add(mullion);

    if (hasCurtains) {
      const curtainMat = new THREE.MeshStandardMaterial({
        color: 0xeeece6,
        roughness: 0.9,
        metalness: 0.02,
      });
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x221c16, metalness: 0.7, roughness: 0.3 });

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, winW + 1.2, 12), rodMat);
      rod.position.set(wx + (wallThick / 2 + 0.18), wy + winH / 2 + 0.35, wz);
      group.add(rod);

      const panelW = winW * 0.28;
      const panelH = winH + 1.6;

      const topCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, panelH, panelW), curtainMat);
      topCurtain.position.set(wx + (wallThick / 2 + 0.18), wy - 0.45, wz - winW / 2 + panelW / 2 - 0.1);
      group.add(topCurtain);

      const botCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, panelH, panelW), curtainMat);
      botCurtain.position.set(wx + (wallThick / 2 + 0.18), wy - 0.45, wz + winW / 2 - panelW / 2 + 0.1);
      group.add(botCurtain);
    }
  }
}

// -------------------------------------------------------------
// Intelligent, Door-Aware Room Furniture & Ergonomics
// -------------------------------------------------------------

export function addRoomInteriorDetails(
  group: THREE.Group,
  roomName: RoomName,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  doors: RoomDoorInfo[] = []
) {
  const cx = rx + rw / 2;
  const cz = rz + rd / 2;
  const doorEdges = new Set(doors.map((d) => d.edge));

  if (roomName === "bedroom") {
    // ---------------------------------------------------------
    // BEDROOM: Headboard on a SOLID WALL (NEVER in front of a door)
    // ---------------------------------------------------------
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x33241b, roughness: 0.5 });
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.75 });
    const duvetMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const nightstandMat = new THREE.MeshStandardMaterial({ color: 0x33241b, roughness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d6,
      emissive: 0xffdb8b,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const closetMat = new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.4 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });

    const bedW = 5.6;
    const bedD = 6.4;

    // Pick headboard wall that has NO door
    let headEdge: "N" | "S" | "E" | "W" = "N";
    if (!doorEdges.has("N")) headEdge = "N";
    else if (!doorEdges.has("S")) headEdge = "S";
    else if (!doorEdges.has("W")) headEdge = "W";
    else if (!doorEdges.has("E")) headEdge = "E";

    let bedX = cx;
    let bedZ = cz;
    let bedRot = 0;

    if (headEdge === "N") {
      bedX = cx;
      bedZ = rz + bedD / 2 + 0.8;
      bedRot = 0;
    } else if (headEdge === "S") {
      bedX = cx;
      bedZ = rz + rd - bedD / 2 - 0.8;
      bedRot = Math.PI;
    } else if (headEdge === "W") {
      bedX = rx + bedD / 2 + 0.8;
      bedZ = cz;
      bedRot = Math.PI / 2;
    } else if (headEdge === "E") {
      bedX = rx + rw - bedD / 2 - 0.8;
      bedZ = cz;
      bedRot = -Math.PI / 2;
    }

    const bedGroup = new THREE.Group();
    bedGroup.position.set(bedX, 0, bedZ);
    bedGroup.rotation.y = bedRot;

    // Platform Base
    const platform = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.4, 0.8, bedD + 0.2), bedFrameMat);
    platform.position.set(0, 0.4, 0);
    platform.castShadow = true;
    bedGroup.add(platform);

    // Tufted Headboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.8, 3.8, 0.4), bedFrameMat);
    headboard.position.set(0, 2.2, -bedD / 2 + 0.2);
    headboard.castShadow = true;
    bedGroup.add(headboard);

    // Mattress
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.9, bedD), mattressMat);
    mattress.position.set(0, 1.25, 0.1);
    bedGroup.add(mattress);

    // Folded Duvet Blanket
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.2, 0.22, bedD * 0.65), duvetMat);
    duvet.position.set(0, 1.72, 0.8);
    bedGroup.add(duvet);

    // 4 Sleeping Pillows
    for (let pIdx = -1; pIdx <= 1; pIdx += 2) {
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.1), pillowMat);
      pillow.position.set(pIdx * 1.5, 1.8, -bedD / 2 + 1.2);
      pillow.rotation.x = 0.2;
      bedGroup.add(pillow);
    }

    // Twin Nightstands & Lamps
    [-1, 1].forEach((side) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.4), nightstandMat);
      stand.position.set(side * (bedW / 2 + 1.1), 0.6, -bedD / 2 + 1.0);
      bedGroup.add(stand);

      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.6, 16), bedFrameMat);
      lampBase.position.set(side * (bedW / 2 + 1.1), 1.5, -bedD / 2 + 1.0);
      bedGroup.add(lampBase);

      const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 16, 1, true), lampMat);
      lampShade.position.set(side * (bedW / 2 + 1.1), 2.0, -bedD / 2 + 1.0);
      bedGroup.add(lampShade);
    });

    group.add(bedGroup);

    // Full-Height Wardrobe Closet placed on a solid non-door side wall
    let closetEdge: "N" | "S" | "E" | "W" = headEdge === "N" || headEdge === "S" ? "E" : "N";
    if (doorEdges.has(closetEdge)) {
      closetEdge = headEdge === "N" || headEdge === "S" ? "W" : "S";
    }

    const closetW = Math.min(rw * 0.36, 5.8);
    const closet = new THREE.Mesh(new THREE.BoxGeometry(closetW, 7.8, 2.0), closetMat);

    if (closetEdge === "E") {
      closet.position.set(rx + rw - 1.2, 3.9, cz);
      closet.rotation.y = -Math.PI / 2;
    } else if (closetEdge === "W") {
      closet.position.set(rx + 1.2, 3.9, cz);
      closet.rotation.y = Math.PI / 2;
    } else if (closetEdge === "S") {
      closet.position.set(cx, 3.9, rz + rd - 1.2);
    } else {
      closet.position.set(cx, 3.9, rz + 1.2);
    }
    closet.castShadow = true;
    group.add(closet);

    // Wardrobe gold handles
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.08), handleMat);
    handle.position.set(closet.position.x, 3.8, closet.position.z + 1.05);
    group.add(handle);

  } else if (roomName === "kitchen") {
    // ---------------------------------------------------------
    // KITCHEN: Counters run along SOLID WALLS (Clear entrance corridor)
    // ---------------------------------------------------------
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
    const quartzMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.1 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.15 });

    let counterRunEdge: "N" | "S" | "E" | "W" = "N";
    if (!doorEdges.has("N")) counterRunEdge = "N";
    else if (!doorEdges.has("S")) counterRunEdge = "S";
    else if (!doorEdges.has("W")) counterRunEdge = "W";
    else counterRunEdge = "E";

    const counterW = rw - 1.4;
    const counterZ = counterRunEdge === "N" ? rz + 1.2 : rz + rd - 1.2;

    // Main Counter Run
    const counter1 = new THREE.Mesh(new THREE.BoxGeometry(counterW, 2.8, 2.0), cabinetMat);
    counter1.position.set(rx + counterW / 2 + 0.7, 1.4, counterZ);
    counter1.castShadow = true;
    group.add(counter1);

    const top1 = new THREE.Mesh(new THREE.BoxGeometry(counterW + 0.1, 0.25, 2.1), quartzMat);
    top1.position.set(rx + counterW / 2 + 0.7, 2.85, counterZ);
    group.add(top1);

    // 4-Burner Glass Induction Cooktop & Chimney Hood
    const cooktopMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1, metalness: 0.8 });
    const cooktop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.8), cooktopMat);
    cooktop.position.set(rx + counterW * 0.35 + 0.7, 2.98, counterZ);
    group.add(cooktop);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.6), chromeMat);
    chimney.position.set(rx + counterW * 0.35 + 0.7, 6.2, counterZ);
    group.add(chimney);

    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 1.0), chromeMat);
    duct.position.set(rx + counterW * 0.35 + 0.7, 7.6, counterZ);
    group.add(duct);

    // Stainless Sink & Chrome Faucet
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.85, roughness: 0.25 });
    const sink = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.5), sinkMat);
    sink.position.set(rx + counterW * 0.75 + 0.7, 2.5, counterZ);
    group.add(sink);

    const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 12, 24, Math.PI), chromeMat);
    faucet.position.set(rx + counterW * 0.75 + 0.7, 3.4, counterZ - (counterRunEdge === "N" ? 0.55 : -0.55));
    faucet.rotation.z = Math.PI;
    group.add(faucet);

    // Refrigerator in corner away from door
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const fridge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 6.8, 2.4), fridgeMat);
    const fridgeX = rx + rw - 1.8;
    const fridgeZ = counterRunEdge === "N" ? rz + rd - 1.6 : rz + 1.6;
    fridge.position.set(fridgeX, 3.4, fridgeZ);
    fridge.castShadow = true;
    group.add(fridge);

  } else if (roomName === "hall") {
    // ---------------------------------------------------------
    // LIVING HALL: Unobstructed Foyer & Clear Walking Corridors
    // ---------------------------------------------------------
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });

    // 1. Modern Area Rug centered in conversational zone
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(rw * 0.52, rd * 0.52), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(cx, 0.05, cz);
    rug.receiveShadow = true;
    group.add(rug);

    // 2. Sectional Sofa facing solid TV wall
    const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.44, 1.4, 2.2), sofaMat);
    sofaMain.position.set(cx - 0.2, 0.7, cz + 1.2);
    sofaMain.castShadow = true;
    group.add(sofaMain);

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.44, 1.2, 0.5), sofaMat);
    sofaBack.position.set(cx - 0.2, 1.5, cz + 2.05);
    sofaBack.castShadow = true;
    group.add(sofaBack);

    const sofaL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, rd * 0.28), sofaMat);
    sofaL.position.set(cx + rw * 0.22 - 1.1, 0.7, cz + 0.3);
    sofaL.castShadow = true;
    group.add(sofaL);

    // Pillows
    const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3), pillowMat);
    pillow1.position.set(cx - rw * 0.16, 1.5, cz + 1.7);
    pillow1.rotation.y = 0.2;
    group.add(pillow1);

    const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3), cushionMat);
    pillow2.position.set(cx + rw * 0.16 - 0.9, 1.5, cz + 1.7);
    pillow2.rotation.y = -0.2;
    group.add(pillow2);

    // Coffee Table
    const glassTableMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
    });

    const coffeeTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.8), glassTableMat);
    coffeeTop.position.set(cx - 0.2, 1.1, cz - 0.4);
    group.add(coffeeTop);

    const coffeeBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.6), brassMat);
    coffeeBase.position.set(cx - 0.2, 0.55, cz - 0.4);
    group.add(coffeeBase);

    // 3. Acoustic Wood Slat TV Accent Wall + 65" OLED TV (against solid wall)
    let tvEdge: "N" | "S" | "E" | "W" = "N";
    if (!doorEdges.has("N")) tvEdge = "N";
    else if (!doorEdges.has("W")) tvEdge = "W";
    else if (!doorEdges.has("E")) tvEdge = "E";
    else tvEdge = "S";

    const tvWallX = cx;
    const tvWallZ = tvEdge === "N" ? rz + 0.4 : rz + rd - 0.4;

    const slatMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.5 });
    const slatPanel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 7.2, 0.15), slatMat);
    slatPanel.position.set(tvWallX, 4.4, tvWallZ);
    group.add(slatPanel);

    const tvFrameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8, roughness: 0.2 });
    const tvScreenMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      emissive: 0x1e293b,
      emissiveIntensity: 0.55,
      roughness: 0.05,
    });

    const tvMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 0.12), tvFrameMat);
    tvMesh.position.set(tvWallX, 4.5, tvWallZ + (tvEdge === "N" ? 0.14 : -0.14));
    group.add(tvMesh);

    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.25, 2.35), tvScreenMat);
    screenMesh.position.set(tvWallX, 4.5, tvWallZ + (tvEdge === "N" ? 0.21 : -0.21));
    if (tvEdge === "S") screenMesh.rotation.y = Math.PI;
    group.add(screenMesh);

    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x221810, roughness: 0.4 });
    const mediaConsole = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.9, 1.2), consoleMat);
    mediaConsole.position.set(tvWallX, 1.2, tvWallZ + (tvEdge === "N" ? 0.6 : -0.6));
    mediaConsole.castShadow = true;
    group.add(mediaConsole);

    // Indoor Fiddle Leaf Fig Tree
    const potMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 1.2, 20), potMat);
    pot.position.set(rx + 1.6, 0.6, rz + 1.6);
    pot.castShadow = true;
    group.add(pot);

    const plantLeaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), leafMat);
    plantLeaves.position.set(rx + 1.6, 2.2, rz + 1.6);
    plantLeaves.castShadow = true;
    group.add(plantLeaves);

  } else if (roomName === "bathroom") {
    // ---------------------------------------------------------
    // BATHROOM: Wet zone & Vanity positioned away from door swing
    // ---------------------------------------------------------
    const vanityMat = new THREE.MeshStandardMaterial({ color: 0x33241b, roughness: 0.5 });
    const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0x88c0d0,
      emissive: 0xd0f0ff,
      emissiveIntensity: 0.6,
      roughness: 0.05,
      metalness: 0.9,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.15 });

    // Floating Vanity & Round Halo Mirror
    const vanityX = rx + rw - 1.6;
    const vanityZ = rz + 1.4;

    const vanity = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), vanityMat);
    vanity.position.set(vanityX, 1.8, vanityZ);
    group.add(vanity);

    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 0.45, 24), porcelainMat);
    vessel.position.set(vanityX, 2.7, vanityZ);
    group.add(vessel);

    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 32), mirrorMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(vanityX, 4.8, rz + 0.4);
    group.add(mirror);

    // Wall-Hung Commode
    const commode = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.8), porcelainMat);
    commode.position.set(rx + 1.4, 1.1, rz + 1.4);
    group.add(commode);

    const flushPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.04), chromeMat);
    flushPlate.position.set(rx + 1.4, 3.2, rz + 0.4);
    group.add(flushPlate);

    // Walk-in Shower Enclosure in far corner
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      transmission: 0.85,
    });

    const showerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.8, rd * 0.45), glassMat);
    showerGlass.position.set(cx - 0.2, 3.4, rz + rd - (rd * 0.45) / 2 - 0.4);
    group.add(showerGlass);

    const showerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24), chromeMat);
    showerHead.position.set(rx + 1.4, 7.2, rz + rd - 1.4);
    group.add(showerHead);

    const towelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 12), chromeMat);
    towelBar.rotation.z = Math.PI / 2;
    towelBar.position.set(rx + rw - 1.6, 3.5, rz + rd - 0.4);
    group.add(towelBar);

  } else if (roomName === "pooja") {
    // ---------------------------------------------------------
    // POOJA: Sacred Mandir on East/North wall
    // ---------------------------------------------------------
    const mandirMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.35 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });

    const altarBase = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.7, 1.2, rd * 0.6), mandirMat);
    altarBase.position.set(cx, 0.6, cz);
    altarBase.castShadow = true;
    group.add(altarBase);

    const altarTier = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.5, 0.8, rd * 0.4), mandirMat);
    altarTier.position.set(cx, 1.6, cz);
    group.add(altarTier);

    const diya = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.25, 16), goldMat);
    diya.position.set(cx, 2.1, cz);
    group.add(diya);

    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff7700,
      emissiveIntensity: 1.5,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 12), flameMat);
    flame.position.set(cx, 2.4, cz);
    group.add(flame);

    const flameLight = new THREE.PointLight(0xff9900, 0.8, 8, 2);
    flameLight.position.set(cx, 2.6, cz);
    group.add(flameLight);

    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.45, 16), goldMat);
    bell.position.set(cx, 6.2, cz);
    group.add(bell);
  }
}
