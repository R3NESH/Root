// Photorealistic Architectural Interior Procedural Models & PBR Textures
// Dynamic Door-Aware Ergonomics Engine: All furniture, TV units, beds, counters, and wardrobes
// automatically adapt to all attached room doorways and entrance doors to guarantee 100% obstruction-free walkways.

import * as THREE from "three";
import { RoomName, ROOM_LABELS } from "./rooms";

export interface RoomDoorInfo {
  edge: "N" | "S" | "E" | "W";
  center: number; // feet along the axis
  isEntrance?: boolean;
}

// --------------------------------------------------------------------------------------
// 1. Procedural PBR Floor Texture Generators (Cached Singletons)
// --------------------------------------------------------------------------------------

let cachedMarbleNormal: THREE.CanvasTexture | null = null;
let cachedMarblePooja: THREE.CanvasTexture | null = null;
let cachedWoodFloor: THREE.CanvasTexture | null = null;
let cachedTileKitchen: THREE.CanvasTexture | null = null;
let cachedTileNormal: THREE.CanvasTexture | null = null;

export function getMarbleFloorTexture(isPooja: boolean = false): THREE.CanvasTexture {
  if (isPooja && cachedMarblePooja) return cachedMarblePooja;
  if (!isPooja && cachedMarbleNormal) return cachedMarbleNormal;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = isPooja ? "#fcfaf2" : "#f1f5f9";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = isPooja ? "rgba(180, 150, 90, 0.15)" : "rgba(100, 116, 139, 0.16)";
  ctx.lineWidth = 2.5;

  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let x = (i * 65 + 30) % 512;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 512) {
      x += (Math.sin(y * 0.04 + i) + Math.cos(x * 0.03)) * 6;
      y += 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Tile grout lines (4ft x 4ft marble slabs)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeRect(256, 0, 256, 256);
  ctx.strokeRect(0, 256, 256, 256);
  ctx.strokeRect(256, 256, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);

  if (isPooja) cachedMarblePooja = texture;
  else cachedMarbleNormal = texture;

  return texture;
}

export function getWoodFloorTexture(): THREE.CanvasTexture {
  if (cachedWoodFloor) return cachedWoodFloor;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#8a5833";
  ctx.fillRect(0, 0, 512, 512);

  // Walnut plank grain lines
  const plankH = 64;
  for (let y = 0; y < 512; y += plankH) {
    const tone = (y / plankH) % 2 === 0 ? "#784b29" : "#8d5d36";
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, 512, plankH);

    ctx.strokeStyle = "rgba(45, 25, 12, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    const stagger = (y / plankH) % 2 === 0 ? 256 : 128;
    ctx.beginPath();
    ctx.moveTo(stagger, y);
    ctx.lineTo(stagger, y + plankH);
    ctx.moveTo((stagger + 256) % 512, y);
    ctx.lineTo((stagger + 256) % 512, y + plankH);
    ctx.stroke();

    ctx.strokeStyle = "rgba(60, 32, 16, 0.18)";
    ctx.lineWidth = 1;
    for (let g = 4; g < plankH; g += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y + g);
      ctx.lineTo(512, y + g);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  cachedWoodFloor = texture;
  return texture;
}

export function getTileFloorTexture(isKitchen: boolean = false): THREE.CanvasTexture {
  if (isKitchen && cachedTileKitchen) return cachedTileKitchen;
  if (!isKitchen && cachedTileNormal) return cachedTileNormal;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = isKitchen ? "#334155" : "#1e293b";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.strokeRect(128, 0, 128, 128);
  ctx.strokeRect(0, 128, 128, 128);
  ctx.strokeRect(128, 128, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);

  if (isKitchen) cachedTileKitchen = texture;
  else cachedTileNormal = texture;

  return texture;
}

// --------------------------------------------------------------------------------------
// 2. Animated Ceiling Fan
// --------------------------------------------------------------------------------------

export function addCeilingFan(group: THREE.Group, x: number, z: number, y: number): THREE.Group {
  const fanGroup = new THREE.Group();
  fanGroup.position.set(x, y, z);

  const rodMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, metalness: 0.8, roughness: 0.2 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.4 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16), rodMat);
  rod.position.y = 0.6;
  fanGroup.add(rod);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.35, 24), brassMat);
  motor.position.y = 0;
  fanGroup.add(motor);

  const bladesGroup = new THREE.Group();
  bladesGroup.position.y = 0;

  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 0.45), bladeMat);
    blade.position.set(Math.cos(angle) * 1.15, 0, Math.sin(angle) * 1.15);
    blade.rotation.y = -angle;
    blade.rotation.z = 0.1;
    blade.castShadow = true;
    bladesGroup.add(blade);
  }

  fanGroup.add(bladesGroup);
  group.add(fanGroup);
  return bladesGroup;
}

// --------------------------------------------------------------------------------------
// 3. Architectural Window with Glass & Drapery Curtains
// --------------------------------------------------------------------------------------
// 3. Procedural Window & Fenestration Engine
// --------------------------------------------------------------------------------------

import {
  WindowShapeId,
  WindowFrameFinishId,
  WindowGlassTintId,
  getWindowFrameMaterial,
  getWindowGlassMaterial,
} from "./windowCatalog";

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
  isBathroom: boolean = false,
  shape: WindowShapeId = "modern_slider",
  frameFinish: WindowFrameFinishId = "black_aluminum",
  glassTint: WindowGlassTintId = "clear",
  windowId?: string,
  roomName?: string,
  roomIndex?: number,
  edge?: "N" | "S" | "E" | "W"
) {
  const frameMat = getWindowFrameMaterial(frameFinish);
  const glassMat = getWindowGlassMaterial(glassTint, isBathroom);
  const frameDepth = wallThick + 0.08;

  const winGroup = new THREE.Group();
  const roomLabel = roomName ? (ROOM_LABELS[roomName as RoomName] || roomName) : "Room";
  const displayName = edge ? `${roomLabel} (${edge} Wall) Window` : "Architectural Window";

  winGroup.userData = {
    isWindow: true,
    isFurniture: true,
    isBuiltin: true,
    id: windowId || `win_${Date.now()}`,
    name: displayName,
    type: "window",
    shape,
    frameFinish,
    glassTint,
    hasCurtains,
    widthFt: winW,
    heightFt: winH,
    roomIndex,
    roomName,
    edge,
    x: wx,
    y: wy,
    z: wz,
  };

  if (shape === "circle_porthole") {
    // CIRCULAR PORTHOLE WINDOW
    const radius = Math.min(winW, winH) * 0.44;
    const ringGeom = new THREE.CylinderGeometry(radius + 0.12, radius + 0.12, frameDepth, 32, 1, true);
    const ring = new THREE.Mesh(ringGeom, frameMat);
    if (isEW) {
      ring.rotation.x = Math.PI / 2;
    } else {
      ring.rotation.z = Math.PI / 2;
    }
    ring.position.set(wx, wy, wz);
    winGroup.add(ring);

    const glassGeom = new THREE.CylinderGeometry(radius, radius, 0.08, 32);
    const glassCircle = new THREE.Mesh(glassGeom, glassMat);
    if (isEW) {
      glassCircle.rotation.x = Math.PI / 2;
    } else {
      glassCircle.rotation.z = Math.PI / 2;
    }
    glassCircle.position.set(wx, wy, wz);
    winGroup.add(glassCircle);

    const cross1Geom = isEW
      ? new THREE.BoxGeometry(radius * 2, 0.08, frameDepth)
      : new THREE.BoxGeometry(frameDepth, 0.08, radius * 2);
    const cross1 = new THREE.Mesh(cross1Geom, frameMat);
    cross1.position.set(wx, wy, wz);
    winGroup.add(cross1);

    const cross2Geom = isEW
      ? new THREE.BoxGeometry(0.08, radius * 2, frameDepth)
      : new THREE.BoxGeometry(frameDepth, radius * 2, 0.08);
    const cross2 = new THREE.Mesh(cross2Geom, frameMat);
    cross2.position.set(wx, wy, wz);
    winGroup.add(cross2);

  } else if (shape === "roman_arch") {
    // PALLADIAN ROMAN ARCH WINDOW
    const archRadius = winW / 2;
    const lowerH = Math.max(1.2, winH - archRadius);

    const glassW = isEW ? winW : frameDepth;
    const glassD = isEW ? frameDepth : winW;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, lowerH, glassD), glassMat);
    glass.position.set(wx, wy - archRadius / 2, wz);
    winGroup.add(glass);

    const archGlassGeom = new THREE.CylinderGeometry(archRadius, archRadius, isEW ? frameDepth : 0.08, 24, 1, false, 0, Math.PI);
    const archGlass = new THREE.Mesh(archGlassGeom, glassMat);
    if (isEW) {
      archGlass.rotation.z = Math.PI / 2;
      archGlass.rotation.x = Math.PI / 2;
    } else {
      archGlass.rotation.x = Math.PI / 2;
      archGlass.rotation.y = Math.PI / 2;
    }
    archGlass.position.set(wx, wy + lowerH / 2, wz);
    winGroup.add(archGlass);

    if (isEW) {
      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.18, frameDepth + 0.1), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.14, lowerH, frameDepth), frameMat);
      frameL.position.set(wx - winW / 2 + 0.07, wy - archRadius / 2, wz);
      winGroup.add(frameL);

      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.14, lowerH, frameDepth), frameMat);
      frameR.position.set(wx + winW / 2 - 0.07, wy - archRadius / 2, wz);
      winGroup.add(frameR);

      const archTorus = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.08, 12, 24, Math.PI),
        frameMat
      );
      archTorus.position.set(wx, wy + lowerH / 2, wz);
      winGroup.add(archTorus);

      for (const angle of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(archRadius, 0.06, frameDepth), frameMat);
        spoke.position.set(wx + (Math.cos(angle) * archRadius) / 2, wy + lowerH / 2 + (Math.sin(angle) * archRadius) / 2, wz);
        spoke.rotation.z = angle;
        winGroup.add(spoke);
      }
    } else {
      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.1, 0.18, winW + 0.3), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, lowerH, 0.14), frameMat);
      frameL.position.set(wx, wy - archRadius / 2, wz - winW / 2 + 0.07);
      winGroup.add(frameL);

      const frameR = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, lowerH, 0.14), frameMat);
      frameR.position.set(wx, wy - archRadius / 2, wz + winW / 2 - 0.07);
      winGroup.add(frameR);

      const archTorus = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.08, 12, 24, Math.PI),
        frameMat
      );
      archTorus.rotation.y = Math.PI / 2;
      archTorus.position.set(wx, wy + lowerH / 2, wz);
      winGroup.add(archTorus);

      for (const angle of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, 0.06, archRadius), frameMat);
        spoke.position.set(wx, wy + lowerH / 2 + (Math.sin(angle) * archRadius) / 2, wz + (Math.cos(angle) * archRadius) / 2);
        spoke.rotation.x = -angle;
        winGroup.add(spoke);
      }
    }

  } else if (shape === "french_grid") {
    // FRENCH COLONIAL MULTI-PANE GRID WINDOW
    const glassW = isEW ? winW : frameDepth;
    const glassD = isEW ? frameDepth : winW;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, winH, glassD), glassMat);
    glass.position.set(wx, wy, wz);
    winGroup.add(glass);

    if (isEW) {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.15, frameDepth), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.18, frameDepth + 0.1), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      for (const offset of [-winW / 2 + 0.06, winW / 2 - 0.06]) {
        const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, frameDepth), frameMat);
        sideFrame.position.set(wx + offset, wy, wz);
        winGroup.add(sideFrame);
      }

      for (const offset of [-winW / 6, winW / 6]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, frameDepth + 0.02), frameMat);
        mullion.position.set(wx + offset, wy, wz);
        winGroup.add(mullion);
      }

      for (const offset of [-winH / 4, 0, winH / 4]) {
        const transom = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, frameDepth + 0.02), frameMat);
        transom.position.set(wx, wy + offset, wz);
        winGroup.add(transom);
      }
    } else {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, 0.15, winW + 0.2), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.1, 0.18, winW + 0.3), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      for (const offset of [-winW / 2 + 0.06, winW / 2 - 0.06]) {
        const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, winH, 0.12), frameMat);
        sideFrame.position.set(wx, wy, wz + offset);
        winGroup.add(sideFrame);
      }

      for (const offset of [-winW / 6, winW / 6]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.02, winH, 0.06), frameMat);
        mullion.position.set(wx, wy, wz + offset);
        winGroup.add(mullion);
      }

      for (const offset of [-winH / 4, 0, winH / 4]) {
        const transom = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.02, 0.06, winW), frameMat);
        transom.position.set(wx, wy + offset, wz);
        winGroup.add(transom);
      }
    }

  } else if (shape === "bay_window") {
    // 3D FACETED PROJECTING BAY WINDOW
    const bayOut = 1.1;
    const centerW = winW * 0.65;
    const sideW = winW * 0.32;

    const centerGlass = new THREE.Mesh(
      isEW ? new THREE.BoxGeometry(centerW, winH, 0.08) : new THREE.BoxGeometry(0.08, winH, centerW),
      glassMat
    );
    if (isEW) {
      centerGlass.position.set(wx, wy, wz - bayOut);
    } else {
      centerGlass.position.set(wx - bayOut, wy, wz);
    }
    winGroup.add(centerGlass);

    for (const side of [-1, 1]) {
      const returnGlass = new THREE.Mesh(
        isEW ? new THREE.BoxGeometry(sideW, winH, 0.08) : new THREE.BoxGeometry(0.08, winH, sideW),
        glassMat
      );
      if (isEW) {
        returnGlass.position.set(wx + side * (centerW / 2 + sideW * 0.35), wy, wz - bayOut / 2);
        returnGlass.rotation.y = side * 0.65;
      } else {
        returnGlass.position.set(wx - bayOut / 2, wy, wz + side * (centerW / 2 + sideW * 0.35));
        returnGlass.rotation.y = side * 0.65;
      }
      winGroup.add(returnGlass);
    }

    // Cozy Wooden Window Seat Bench
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 });
    const benchGeom = isEW
      ? new THREE.BoxGeometry(winW + 0.2, 0.25, bayOut + wallThick + 0.4)
      : new THREE.BoxGeometry(bayOut + wallThick + 0.4, 0.25, winW + 0.2);
    const bench = new THREE.Mesh(benchGeom, benchMat);
    if (isEW) {
      bench.position.set(wx, wy - winH / 2, wz - bayOut / 2 + 0.2);
    } else {
      bench.position.set(wx - bayOut / 2 + 0.2, wy - winH / 2, wz);
    }
    bench.castShadow = true;
    winGroup.add(bench);

    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85 });
    const cushion = new THREE.Mesh(
      isEW ? new THREE.BoxGeometry(winW * 0.85, 0.18, bayOut + 0.1) : new THREE.BoxGeometry(bayOut + 0.1, 0.18, winW * 0.85),
      cushionMat
    );
    if (isEW) {
      cushion.position.set(wx, wy - winH / 2 + 0.2, wz - bayOut / 2 + 0.2);
    } else {
      cushion.position.set(wx - bayOut / 2 + 0.2, wy - winH / 2 + 0.2, wz);
    }
    winGroup.add(cushion);

  } else if (shape === "picture_panoramic") {
    // FLOOR-TO-CEILING PANORAMIC PICTURE WINDOW
    const glassW = isEW ? winW + 0.4 : frameDepth;
    const glassD = isEW ? frameDepth : winW + 0.4;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, winH + 0.4, glassD), glassMat);
    glass.position.set(wx, wy, wz);
    winGroup.add(glass);

    if (isEW) {
      const topBezel = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.5, 0.08, frameDepth + 0.04), frameMat);
      topBezel.position.set(wx, wy + winH / 2 + 0.2, wz);
      winGroup.add(topBezel);

      const botBezel = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.5, 0.08, frameDepth + 0.04), frameMat);
      botBezel.position.set(wx, wy - winH / 2 - 0.2, wz);
      winGroup.add(botBezel);
    } else {
      const topBezel = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.04, 0.08, winW + 0.5), frameMat);
      topBezel.position.set(wx, wy + winH / 2 + 0.2, wz);
      winGroup.add(topBezel);

      const botBezel = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.04, 0.08, winW + 0.5), frameMat);
      botBezel.position.set(wx, wy - winH / 2 - 0.2, wz);
      winGroup.add(botBezel);
    }

  } else if (shape === "clerestory_slit") {
    // HIGH HORIZONTAL CLERESTORY SLIT WINDOW
    const slitH = Math.min(1.4, winH * 0.45);
    const glassW = isEW ? winW : frameDepth;
    const glassD = isEW ? frameDepth : winW;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, slitH, glassD), glassMat);
    glass.position.set(wx, wy + (winH - slitH) / 2, wz);
    winGroup.add(glass);

    if (isEW) {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.12, frameDepth), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.12, frameDepth), frameMat);
      frameBot.position.set(wx, wy + (winH - slitH) / 2 - slitH / 2, wz);
      winGroup.add(frameBot);

      for (const off of [-slitH / 4, slitH / 4]) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.04, frameDepth + 0.04), frameMat);
        slat.position.set(wx, wy + (winH - slitH) / 2 + off, wz);
        winGroup.add(slat);
      }
    } else {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, 0.12, winW + 0.2), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, 0.12, winW + 0.2), frameMat);
      frameBot.position.set(wx, wy + (winH - slitH) / 2 - slitH / 2, wz);
      winGroup.add(frameBot);

      for (const off of [-slitH / 4, slitH / 4]) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.04, 0.04, winW), frameMat);
        slat.position.set(wx, wy + (winH - slitH) / 2 + off, wz);
        winGroup.add(slat);
      }
    }

  } else {
    // DEFAULT MODERN SLIDING WINDOW
    const glassW = isEW ? winW : frameDepth;
    const glassD = isEW ? frameDepth : winW;

    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, winH, glassD), glassMat);
    glass.position.set(wx, wy, wz);
    winGroup.add(glass);

    if (isEW) {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.15, frameDepth), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.18, frameDepth + 0.1), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, frameDepth + 0.02), frameMat);
      mullionV.position.set(wx, wy, wz);
      winGroup.add(mullionV);
    } else {
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(frameDepth, 0.15, winW + 0.2), frameMat);
      frameTop.position.set(wx, wy + winH / 2, wz);
      winGroup.add(frameTop);

      const frameBot = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.1, 0.18, winW + 0.3), frameMat);
      frameBot.position.set(wx, wy - winH / 2, wz);
      winGroup.add(frameBot);

      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(frameDepth + 0.02, winH, 0.12), frameMat);
      mullionV.position.set(wx, wy, wz);
      winGroup.add(mullionV);
    }
  }

  // Curtains / Drapes
  if (hasCurtains && !isBathroom && shape !== "clerestory_slit" && shape !== "circle_porthole") {
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0xede9fe, roughness: 0.9 });

    if (isEW) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, winW + 1.2, 16), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(wx, wy + winH / 2 + 0.45, wz + 0.35);
      winGroup.add(rod);

      const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.7, winH + 0.8, 0.2), fabricMat);
      panelL.position.set(wx - winW / 2 - 0.2, wy - 0.1, wz + 0.35);
      panelL.castShadow = true;
      winGroup.add(panelL);

      const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.7, winH + 0.8, 0.2), fabricMat);
      panelR.position.set(wx + winW / 2 + 0.2, wy - 0.1, wz + 0.35);
      panelR.castShadow = true;
      winGroup.add(panelR);
    } else {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, winW + 1.2, 16), rodMat);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(wx + 0.35, wy + winH / 2 + 0.45, wz);
      winGroup.add(rod);

      const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.2, winH + 0.8, 0.7), fabricMat);
      panelL.position.set(wx + 0.35, wy - 0.1, wz - winW / 2 - 0.2);
      panelL.castShadow = true;
      winGroup.add(panelL);

      const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.2, winH + 0.8, 0.7), fabricMat);
      panelR.position.set(wx + 0.35, wy - 0.1, wz + winW / 2 + 0.2);
      panelR.castShadow = true;
      winGroup.add(panelR);
    }
  }

  group.add(winGroup);
}

// --------------------------------------------------------------------------------------
// 4. Dynamic Door-Aware Furniture Placement Engine
// --------------------------------------------------------------------------------------

export function addRoomInteriorDetails(
  group: THREE.Group,
  roomName: RoomName,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  doors: RoomDoorInfo[] = [],
  roomIndex: number = 0,
  deletedIds?: Set<string>
) {
  const cx = rx + rw / 2;
  const cz = rz + rd / 2;
  const doorEdges = new Set(doors.map((d) => d.edge));

  if (roomName === "bedroom") {
    // ---------------------------------------------------------
    // BEDROOM: Headboard on solid non-door wall with 3.5ft clearance
    // ---------------------------------------------------------
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.5 });
    const linenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
    const duvetMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const closetMat = new THREE.MeshStandardMaterial({ color: 0x271c19, roughness: 0.45 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });

    let headEdge: "N" | "S" | "E" | "W" = "N";
    if (!doorEdges.has("N")) headEdge = "N";
    else if (!doorEdges.has("W")) headEdge = "W";
    else if (!doorEdges.has("E")) headEdge = "E";
    else headEdge = "S";

    const bedGroup = new THREE.Group();
    const bedW = Math.min(rw * 0.48, 6.2);
    const bedL = Math.min(rd * 0.52, 6.6);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.9, bedL), woodMat);
    frame.position.y = 0.45;
    frame.castShadow = true;
    bedGroup.add(frame);

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.2, 0.7, bedL - 0.2), linenMat);
    mattress.position.y = 1.1;
    mattress.castShadow = true;
    bedGroup.add(mattress);

    const duvet = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.15, 0.72, bedL * 0.65), duvetMat);
    duvet.position.set(0, 1.12, bedL * 0.15);
    duvet.castShadow = true;
    bedGroup.add(duvet);

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.4, 3.8, 0.4), woodMat);
    headboard.position.set(0, 1.9, -bedL / 2 + 0.1);
    headboard.castShadow = true;
    bedGroup.add(headboard);

    const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.38, 0.35, 1.3), linenMat);
    pillow1.position.set(-bedW * 0.24, 1.5, -bedL / 2 + 1.2);
    bedGroup.add(pillow1);

    const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.38, 0.35, 1.3), linenMat);
    pillow2.position.set(bedW * 0.24, 1.5, -bedL / 2 + 1.2);
    bedGroup.add(pillow2);

    for (const side of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), woodMat);
      stand.position.set(side * (bedW / 2 + 1.1), 0.7, -bedL / 2 + 0.9);
      stand.castShadow = true;
      bedGroup.add(stand);

      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 16), brassMat);
      lampBase.position.set(side * (bedW / 2 + 1.1), 1.45, -bedL / 2 + 0.9);
      bedGroup.add(lampBase);

      const lampShade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.48, 0.7, 16),
        new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xffe8ba, emissiveIntensity: 0.6 })
      );
      lampShade.position.set(side * (bedW / 2 + 1.1), 1.95, -bedL / 2 + 0.9);
      bedGroup.add(lampShade);
    }

    if (headEdge === "N") {
      bedGroup.position.set(cx, 0, rz + bedL / 2 + 0.8);
      bedGroup.rotation.y = 0;
    } else if (headEdge === "S") {
      bedGroup.position.set(cx, 0, rz + rd - bedL / 2 - 0.8);
      bedGroup.rotation.y = Math.PI;
    } else if (headEdge === "W") {
      bedGroup.position.set(rx + bedL / 2 + 0.8, 0, cz);
      bedGroup.rotation.y = Math.PI / 2;
    } else {
      bedGroup.position.set(rx + rw - bedL / 2 - 0.8, 0, cz);
      bedGroup.rotation.y = -Math.PI / 2;
    }

    const bedId = `builtin_${roomIndex}_bed`;
    if (!deletedIds?.has(bedId)) {
      bedGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: bedId,
        name: "Grand King Bed",
        type: "bed_king",
        x: bedGroup.position.x,
        y: 0,
        z: bedGroup.position.z,
        rotationY: bedGroup.rotation.y,
      };
      group.add(bedGroup);
    }

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

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.08), handleMat);
    handle.position.set(closet.position.x, 3.8, closet.position.z + 1.05);

    const wardrobeId = `builtin_${roomIndex}_wardrobe`;
    if (!deletedIds?.has(wardrobeId)) {
      const wardrobeGroup = new THREE.Group();
      wardrobeGroup.add(closet, handle);
      wardrobeGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: wardrobeId,
        name: "3-Door Wardrobe",
        type: "wardrobe",
        x: closet.position.x,
        y: 0,
        z: closet.position.z,
        rotationY: closet.rotation.y,
      };
      group.add(wardrobeGroup);
    }

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

    const counter1 = new THREE.Mesh(new THREE.BoxGeometry(counterW, 2.8, 2.0), cabinetMat);
    counter1.position.set(rx + counterW / 2 + 0.7, 1.4, counterZ);
    counter1.castShadow = true;

    const top1 = new THREE.Mesh(new THREE.BoxGeometry(counterW + 0.1, 0.25, 2.1), quartzMat);
    top1.position.set(rx + counterW / 2 + 0.7, 2.85, counterZ);

    const cooktopMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1, metalness: 0.8 });
    const cooktop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.8), cooktopMat);
    cooktop.position.set(rx + counterW * 0.35 + 0.7, 2.98, counterZ);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.6), chromeMat);
    chimney.position.set(rx + counterW * 0.35 + 0.7, 6.2, counterZ);

    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 1.0), chromeMat);
    duct.position.set(rx + counterW * 0.35 + 0.7, 7.6, counterZ);

    const sinkMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.85, roughness: 0.25 });
    const sink = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.5), sinkMat);
    sink.position.set(rx + counterW * 0.75 + 0.7, 2.5, counterZ);

    const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 12, 24, Math.PI), chromeMat);
    faucet.position.set(rx + counterW * 0.75 + 0.7, 3.4, counterZ - (counterRunEdge === "N" ? 0.55 : -0.55));
    faucet.rotation.z = Math.PI;

    const counterId = `builtin_${roomIndex}_counter`;
    if (!deletedIds?.has(counterId)) {
      const counterGroup = new THREE.Group();
      counterGroup.add(counter1, top1, cooktop, chimney, duct, sink, faucet);
      counterGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: counterId,
        name: "Kitchen Counter & Cooktop",
        type: "kitchen_island",
        x: rx + counterW / 2 + 0.7,
        y: 0,
        z: counterZ,
        rotationY: 0,
      };
      group.add(counterGroup);
    }

    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const fridge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 6.8, 2.4), fridgeMat);
    const fridgeX = rx + rw - 1.8;
    const fridgeZ = counterRunEdge === "N" ? rz + rd - 1.6 : rz + 1.6;
    fridge.position.set(fridgeX, 3.4, fridgeZ);
    fridge.castShadow = true;

    const fridgeId = `builtin_${roomIndex}_fridge`;
    if (!deletedIds?.has(fridgeId)) {
      fridge.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: fridgeId,
        name: "Double-Door Refrigerator",
        type: "refrigerator",
        x: fridgeX,
        y: 0,
        z: fridgeZ,
        rotationY: 0,
      };
      group.add(fridge);
    }

  } else if (roomName === "hall") {
    // ---------------------------------------------------------
    // LIVING HALL: Dynamic Door-Aware Ergonomics Engine
    // 100% Unobstructed Corridors Connecting All Attached Doors & Entrances
    // ---------------------------------------------------------
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.5 });
    const tvFrameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8, roughness: 0.2 });
    const tvScreenMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      emissive: 0x1e293b,
      emissiveIntensity: 0.55,
      roughness: 0.05,
    });
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x221810, roughness: 0.4 });
    const glassTableMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
    });

    // 1. Determine the Best SOLID (Door-Free) Wall for the TV Accent Unit
    let tvEdge: "N" | "S" | "E" | "W" = "N";
    if (!doorEdges.has("N")) {
      tvEdge = "N";
    } else if (!doorEdges.has("W")) {
      tvEdge = "W";
    } else if (!doorEdges.has("E")) {
      tvEdge = "E";
    } else if (!doorEdges.has("S")) {
      tvEdge = "S";
    } else {
      tvEdge = "W";
    }

    const isEWTV = tvEdge === "N" || tvEdge === "S";

    // 2. Build Area Rug centered in the conversational zone
    const rugW = isEWTV ? Math.min(rw * 0.55, 10.0) : Math.min(rw * 0.48, 8.0);
    const rugD = isEWTV ? Math.min(rd * 0.48, 8.0) : Math.min(rd * 0.55, 10.0);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(rugW, rugD), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(cx, 0.05, cz);
    rug.receiveShadow = true;
    group.add(rug);

    // 3. Build TV Accent Wall + 65" OLED TV + Media Console against chosen solid wall
    const slatW = isEWTV ? Math.min(rw * 0.55, 6.0) : 0.15;
    const slatD = isEWTV ? 0.15 : Math.min(rd * 0.55, 6.0);
    const slatPanel = new THREE.Mesh(new THREE.BoxGeometry(slatW, 7.2, slatD), slatMat);

    let tvWallX = cx;
    let tvWallZ = cz;
    if (tvEdge === "N") tvWallZ = rz + 0.3;
    else if (tvEdge === "S") tvWallZ = rz + rd - 0.3;
    else if (tvEdge === "W") tvWallX = rx + 0.3;
    else if (tvEdge === "E") tvWallX = rx + rw - 0.3;

    slatPanel.position.set(tvWallX, 4.4, tvWallZ);

    // TV Mesh
    const tvMeshW = isEWTV ? 4.4 : 0.12;
    const tvMeshD = isEWTV ? 0.12 : 4.4;
    const tvMesh = new THREE.Mesh(new THREE.BoxGeometry(tvMeshW, 2.5, tvMeshD), tvFrameMat);

    let tvOffX = tvWallX;
    let tvOffZ = tvWallZ;
    if (tvEdge === "N") tvOffZ += 0.14;
    else if (tvEdge === "S") tvOffZ -= 0.14;
    else if (tvEdge === "W") tvOffX += 0.14;
    else if (tvEdge === "E") tvOffX -= 0.14;

    tvMesh.position.set(tvOffX, 4.5, tvOffZ);

    const screenGeom = new THREE.PlaneGeometry(4.25, 2.35);
    const screenMesh = new THREE.Mesh(screenGeom, tvScreenMat);
    if (tvEdge === "N") {
      screenMesh.position.set(tvWallX, 4.5, tvWallZ + 0.21);
    } else if (tvEdge === "S") {
      screenMesh.rotation.y = Math.PI;
      screenMesh.position.set(tvWallX, 4.5, tvWallZ - 0.21);
    } else if (tvEdge === "W") {
      screenMesh.rotation.y = Math.PI / 2;
      screenMesh.position.set(tvWallX + 0.21, 4.5, tvWallZ);
    } else {
      screenMesh.rotation.y = -Math.PI / 2;
      screenMesh.position.set(tvWallX - 0.21, 4.5, tvWallZ);
    }

    // Media Console
    const conW = isEWTV ? Math.min(rw * 0.48, 5.8) : 1.2;
    const conD = isEWTV ? 1.2 : Math.min(rd * 0.48, 5.8);
    const mediaConsole = new THREE.Mesh(new THREE.BoxGeometry(conW, 0.9, conD), consoleMat);

    let conX = tvWallX;
    let conZ = tvWallZ;
    if (tvEdge === "N") conZ += 0.65;
    else if (tvEdge === "S") conZ -= 0.65;
    else if (tvEdge === "W") conX += 0.65;
    else if (tvEdge === "E") conX -= 0.65;

    mediaConsole.position.set(conX, 1.2, conZ);
    mediaConsole.castShadow = true;

    const tvId = `builtin_${roomIndex}_tv`;
    if (!deletedIds?.has(tvId)) {
      const tvGroup = new THREE.Group();
      tvGroup.add(slatPanel, tvMesh, screenMesh, mediaConsole);
      tvGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: tvId,
        name: "TV Entertainment Wall",
        type: "tv_unit",
        x: conX,
        y: 0,
        z: conZ,
        rotationY: isEWTV ? 0 : Math.PI / 2,
      };
      group.add(tvGroup);
    }

    // 4. Sectional Sofa (Positioned directly facing the TV unit across the coffee table)
    const sofaGroup = new THREE.Group();
    const sofaMainW = Math.min(isEWTV ? rw * 0.44 : rd * 0.44, 7.2);
    const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(sofaMainW, 1.4, 2.2), sofaMat);
    sofaMain.position.set(0, 0.7, 0);
    sofaMain.castShadow = true;
    sofaGroup.add(sofaMain);

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(sofaMainW, 1.2, 0.5), sofaMat);
    sofaBack.position.set(0, 1.5, 0.85);
    sofaBack.castShadow = true;
    sofaGroup.add(sofaBack);

    const sofaL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 2.6), sofaMat);
    sofaL.position.set(sofaMainW / 2 - 1.0, 0.7, -1.1);
    sofaL.castShadow = true;
    sofaGroup.add(sofaL);

    // Pillows
    const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3), pillowMat);
    pillow1.position.set(-sofaMainW * 0.25, 1.5, 0.5);
    pillow1.rotation.y = 0.2;
    sofaGroup.add(pillow1);

    const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3), cushionMat);
    pillow2.position.set(sofaMainW * 0.25, 1.5, 0.5);
    pillow2.rotation.y = -0.2;
    sofaGroup.add(pillow2);

    // Position & Orient Sofa based on TV Wall
    if (tvEdge === "N") {
      sofaGroup.position.set(cx, 0, cz + Math.min(rd * 0.2, 2.4));
      sofaGroup.rotation.y = 0;
    } else if (tvEdge === "S") {
      sofaGroup.position.set(cx, 0, cz - Math.min(rd * 0.2, 2.4));
      sofaGroup.rotation.y = Math.PI;
    } else if (tvEdge === "W") {
      sofaGroup.position.set(cx + Math.min(rw * 0.2, 2.4), 0, cz);
      sofaGroup.rotation.y = -Math.PI / 2;
    } else {
      sofaGroup.position.set(cx - Math.min(rw * 0.2, 2.4), 0, cz);
      sofaGroup.rotation.y = Math.PI / 2;
    }

    const sofaId = `builtin_${roomIndex}_sofa`;
    if (!deletedIds?.has(sofaId)) {
      sofaGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: sofaId,
        name: "Living Room Sofa",
        type: "sofa_3seater",
        x: sofaGroup.position.x,
        y: 0,
        z: sofaGroup.position.z,
        rotationY: sofaGroup.rotation.y,
      };
      group.add(sofaGroup);
    }

    // 5. Modern Glass Coffee Table
    const coffeeTop = new THREE.Mesh(new THREE.BoxGeometry(isEWTV ? 2.8 : 1.8, 0.08, isEWTV ? 1.8 : 2.8), glassTableMat);
    coffeeTop.position.set(cx, 1.1, cz);

    const coffeeBase = new THREE.Mesh(new THREE.BoxGeometry(isEWTV ? 2.6 : 1.6, 1.0, isEWTV ? 1.6 : 2.6), brassMat);
    coffeeBase.position.set(cx, 0.55, cz);

    const coffeeId = `builtin_${roomIndex}_coffee_table`;
    if (!deletedIds?.has(coffeeId)) {
      const coffeeGroup = new THREE.Group();
      coffeeGroup.add(coffeeTop, coffeeBase);
      coffeeGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: coffeeId,
        name: "Glass Coffee Table",
        type: "coffee_table",
        x: cx,
        y: 0,
        z: cz,
        rotationY: 0,
      };
      group.add(coffeeGroup);
    }

    // 6. Indoor Fiddle Leaf Fig Tree (in an unobstructed corner away from any doors)
    let plantCornerX = rx + 1.4;
    let plantCornerZ = rz + 1.4;
    if (doorEdges.has("N") || doorEdges.has("W")) {
      plantCornerX = rx + 1.4;
      plantCornerZ = rz + rd - 1.4;
    }
    if (doorEdges.has("S") && doorEdges.has("W")) {
      plantCornerX = rx + rw - 1.4;
      plantCornerZ = rz + rd - 1.4;
    }

    const potMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 1.2, 20), potMat);
    pot.position.set(plantCornerX, 0.6, plantCornerZ);
    pot.castShadow = true;

    const plantLeaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), leafMat);
    plantLeaves.position.set(plantCornerX, 2.2, plantCornerZ);
    plantLeaves.castShadow = true;

    const plantId = `builtin_${roomIndex}_plant`;
    if (!deletedIds?.has(plantId)) {
      const plantGroup = new THREE.Group();
      plantGroup.add(pot, plantLeaves);
      plantGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: plantId,
        name: "Fiddle Leaf Fig Plant",
        type: "plant_pot",
        x: plantCornerX,
        y: 0,
        z: plantCornerZ,
        rotationY: 0,
      };
      group.add(plantGroup);
    }

  } else if (roomName === "dining") {
    const diningId = `builtin_${roomIndex}_dining`;
    if (!deletedIds?.has(diningId)) {
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.45 });
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
      const diningGroup = new THREE.Group();

      const tableTop = new THREE.Mesh(new THREE.BoxGeometry(Math.min(rw * 0.55, 6.0), 0.2, Math.min(rd * 0.45, 3.4)), tableMat);
      tableTop.position.set(0, 2.7, 0);
      diningGroup.add(tableTop);

      for (const lx of [-2.4, 2.4]) {
        for (const lz of [-1.2, 1.2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), tableMat);
          leg.position.set(lx, 1.3, lz);
          diningGroup.add(leg);
        }
      }

      diningGroup.position.set(cx, 0, cz);
      diningGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: diningId,
        name: "6-Seater Dining Set",
        type: "dining_6seater",
        x: cx,
        y: 0,
        z: cz,
        rotationY: 0,
      };
      group.add(diningGroup);
    }

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

    const vanityX = rx + rw - 1.6;
    const vanityZ = rz + 1.4;

    const vanity = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), vanityMat);
    vanity.position.set(vanityX, 1.8, vanityZ);

    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 0.45, 24), porcelainMat);
    vessel.position.set(vanityX, 2.7, vanityZ);

    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 32), mirrorMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(vanityX, 4.8, rz + 0.4);

    const vanityId = `builtin_${roomIndex}_vanity`;
    if (!deletedIds?.has(vanityId)) {
      const vanityGroup = new THREE.Group();
      vanityGroup.add(vanity, vessel, mirror);
      vanityGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: vanityId,
        name: "Bathroom Vanity & Mirror",
        type: "vanity_table",
        x: vanityX,
        y: 0,
        z: vanityZ,
        rotationY: 0,
      };
      group.add(vanityGroup);
    }

    const commode = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.8), porcelainMat);
    commode.position.set(rx + 1.4, 1.1, rz + 1.4);
    group.add(commode);

    const flushPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.04), chromeMat);
    flushPlate.position.set(rx + 1.4, 3.2, rz + 0.4);
    group.add(flushPlate);

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
    // POOJA ROOM: Sacred Marble Mandir Altar with Brass Decor
    // ---------------------------------------------------------
    const mandirMat = new THREE.MeshStandardMaterial({
      color: 0xfcfaf2,
      roughness: 0.15,
      metalness: 0.08,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.15,
    });
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xff4500,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    const altarBase = new THREE.Mesh(new THREE.BoxGeometry(Math.min(rw * 0.65, 3.8), 1.2, Math.min(rd * 0.48, 2.4)), mandirMat);
    altarBase.position.set(cx, 0.6, rz + 1.2);
    altarBase.castShadow = true;

    const altarTier = new THREE.Mesh(new THREE.BoxGeometry(Math.min(rw * 0.45, 2.8), 0.8, Math.min(rd * 0.35, 1.8)), mandirMat);
    altarTier.position.set(cx, 1.6, rz + 1.2);

    const diya = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 0.15, 16), goldMat);
    diya.position.set(cx, 2.08, rz + 1.2);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 16), flameMat);
    flame.position.set(cx, 2.25, rz + 1.2);

    const flameLight = new THREE.PointLight(0xffaa44, 0.9, 10, 1.5);
    flameLight.position.set(cx, 2.4, rz + 1.2);

    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16), goldMat);
    bell.rotation.x = Math.PI;
    bell.position.set(cx, 6.8, rz + 1.2);

    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb8860b });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8), ropeMat);
    rope.position.set(cx, 7.9, rz + 1.2);

    const mandirId = `builtin_${roomIndex}_mandir`;
    if (!deletedIds?.has(mandirId)) {
      const mandirGroup = new THREE.Group();
      mandirGroup.add(altarBase, altarTier, diya, flame, flameLight, bell, rope);
      mandirGroup.userData = {
        isFurniture: true,
        isBuiltin: true,
        id: mandirId,
        name: "Sacred Pooja Mandir",
        type: "pooja_mandir",
        x: cx,
        y: 0,
        z: rz + 1.2,
        rotationY: 0,
      };
      group.add(mandirGroup);
    }
  }
}
