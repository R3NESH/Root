// AI-Powered Parametric 3D Furniture Procedural Mesh Engine in Three.js
// Supports Multi-Mesh Density Tiers (Low / Medium / Ultra) and Hardware-Adaptive Procedural PBR Textures
import * as THREE from "three";

export type MeshQualityTier = "low" | "medium" | "ultra";
export type TextureMaterialType = "fabric" | "velvet" | "leather" | "boucle" | "wood" | "metal" | "brass" | "glass" | "marble" | "chrome";

export interface AIFurnitureComponent {
  id: string;
  type: string; // "base" | "cushion" | "cushion_set" | "backrest" | "armrests" | "legs" | "tabletop" | "shelf_set" | "drawer_set" | "tufting" | "hardware" | "headboard" | "shade" | "frame" | "piping" | "pillow" | "ferrule" | "bevel";
  shape?: "box" | "cylinder" | "sphere" | "capsule" | "cone" | "torus";
  relative_x: number; // offset in feet from center
  relative_y: number; // height in feet from floor
  relative_z: number; // offset in feet from center
  width_ft: number;
  depth_ft: number;
  height_ft: number;
  rotation_y?: number;
  material_type?: string;
  color_hex?: string | null;
  roughness?: number;
  metalness?: number;
  count?: number;
  style_tag?: string;
  min_tier?: MeshQualityTier; // Minimum tier required to render this extra detail mesh
}

export interface AIFurnitureParametricDef {
  id?: string;
  name: string;
  category: string;
  style: string;
  description: string;
  width_ft: number;
  depth_ft: number;
  height_ft: number;
  primary_color_hex: string;
  secondary_color_hex: string;
  primary_material: string;
  secondary_material: string;
  confidence?: number;
  tags?: string[];
  components: AIFurnitureComponent[];
  thumbnail_url?: string;
  quality_tier?: MeshQualityTier;
  mesh_count_target?: number;
}

// --------------------------------------------------------------------------------------
// Procedural PBR Texture Generator (Client-Side Canvas Textures)
// --------------------------------------------------------------------------------------

const textureCache = new Map<string, THREE.CanvasTexture>();

export function createProceduralCanvasTexture(
  type: "fabric" | "leather" | "marble" | "wood",
  baseColorHex: number,
  resolution: number = 256
): THREE.CanvasTexture {
  const cacheKey = `${type}_${baseColorHex.toString(16)}_${resolution}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  if (typeof document === "undefined") {
    // SSR fallback dummy canvas texture
    const dummy = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const r = (baseColorHex >> 16) & 255;
  const g = (baseColorHex >> 8) & 255;
  const b = baseColorHex & 255;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, resolution, resolution);

  if (type === "fabric") {
    // Cross-hatch woven thread texture
    ctx.lineWidth = 1.5;
    for (let x = 0; x < resolution; x += 4) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + Math.random() * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, resolution);
      ctx.stroke();
    }
    for (let y = 0; y < resolution; y += 4) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(resolution, y);
      ctx.stroke();
    }
  } else if (type === "leather") {
    // Cellular pebble grain leather
    for (let i = 0; i < resolution * 8; i++) {
      const px = Math.random() * resolution;
      const py = Math.random() * resolution;
      const rad = 1.5 + Math.random() * 3.0;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === "marble") {
    // Organic Carrara marble veining
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 3;
    for (let v = 0; v < 5; v++) {
      ctx.beginPath();
      let cx = Math.random() * resolution;
      let cy = 0;
      ctx.moveTo(cx, cy);
      while (cy < resolution) {
        cx += (Math.random() - 0.5) * 30;
        cy += 15 + Math.random() * 20;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  } else if (type === "wood") {
    // Longitudinal natural wood grain
    for (let x = 0; x < resolution; x += 6) {
      ctx.strokeStyle = Math.random() > 0.5 ? "rgba(40, 20, 10, 0.15)" : "rgba(255, 230, 180, 0.08)";
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + (Math.random() - 0.5) * 20,
        resolution * 0.33,
        x + (Math.random() - 0.5) * 20,
        resolution * 0.66,
        x,
        resolution
      );
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Creates a photorealistic 3D Three.js Group for an AI-modeled furniture definition.
 * Dynamically scales mesh subdivisions and component complexity based on quality tier.
 */
export function createAIFurnitureMesh(
  def: AIFurnitureParametricDef,
  customColorHex?: number,
  overrideTier?: MeshQualityTier,
  customMeshTarget?: number
): THREE.Group {
  const root = new THREE.Group();
  root.name = def.name;

  const tier: MeshQualityTier = overrideTier || def.quality_tier || "ultra";
  const meshTarget = customMeshTarget || def.mesh_count_target || (tier === "ultra" ? 40 : tier === "medium" ? 20 : 8);

  const primaryColor = customColorHex !== undefined
    ? customColorHex
    : parseInt(def.primary_color_hex.replace("#", "0x"), 16) || 0x1e3a8a;

  const secondaryColor = parseInt(def.secondary_color_hex.replace("#", "0x"), 16) || 0xd4af37;

  // Subdivision segments based on hardware tier
  const radialSegs = tier === "ultra" ? 32 : tier === "medium" ? 16 : 8;

  // Material builder helper with hardware-adaptive procedural PBR maps
  const getMaterial = (
    matType?: string,
    compColorHex?: string | null,
    customRoughness?: number,
    customMetalness?: number
  ) => {
    const type = matType || def.primary_material || "fabric";
    let color = primaryColor;
    if (compColorHex) {
      const parsed = parseInt(compColorHex.replace("#", "0x"), 16);
      if (!isNaN(parsed)) color = parsed;
    } else if (type === "brass" || type === "metal" || type === "chrome" || type === "wood") {
      color = secondaryColor;
    }

    const useTextures = tier !== "low";

    switch (type) {
      case "velvet": {
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: customRoughness ?? 0.88,
          metalness: customMetalness ?? 0.05,
        });
        if (useTextures) {
          mat.bumpMap = createProceduralCanvasTexture("fabric", color, tier === "ultra" ? 512 : 256);
          mat.bumpScale = 0.02;
        }
        return mat;
      }
      case "leather": {
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: customRoughness ?? 0.42,
          metalness: customMetalness ?? 0.12,
        });
        if (useTextures) {
          mat.bumpMap = createProceduralCanvasTexture("leather", color, tier === "ultra" ? 512 : 256);
          mat.bumpScale = 0.035;
        }
        return mat;
      }
      case "marble": {
        const mat = new THREE.MeshStandardMaterial({
          color: color || 0xf8fafc,
          roughness: customRoughness ?? 0.12,
          metalness: 0.06,
        });
        if (useTextures) {
          mat.map = createProceduralCanvasTexture("marble", color || 0xf8fafc, tier === "ultra" ? 512 : 256);
        }
        return mat;
      }
      case "wood": {
        const mat = new THREE.MeshStandardMaterial({
          color: color || 0x5d4037,
          roughness: customRoughness ?? 0.5,
          metalness: 0.05,
        });
        if (useTextures) {
          mat.bumpMap = createProceduralCanvasTexture("wood", color || 0x5d4037, tier === "ultra" ? 512 : 256);
          mat.bumpScale = 0.025;
        }
        return mat;
      }
      case "brass":
        return new THREE.MeshStandardMaterial({
          color: color || 0xd4af37,
          metalness: customMetalness ?? 0.92,
          roughness: customRoughness ?? 0.18,
        });
      case "chrome":
        return new THREE.MeshStandardMaterial({
          color: color || 0xd1d5db,
          metalness: customMetalness ?? 0.96,
          roughness: customRoughness ?? 0.12,
        });
      case "metal":
        return new THREE.MeshStandardMaterial({
          color: color || 0x1e293b,
          metalness: customMetalness ?? 0.88,
          roughness: customRoughness ?? 0.3,
        });
      case "glass":
        return new THREE.MeshStandardMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.6,
          roughness: 0.08,
          metalness: 0.1,
        });
      case "fabric":
      case "boucle":
      default: {
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: customRoughness ?? 0.82,
          metalness: 0.02,
        });
        if (useTextures) {
          mat.bumpMap = createProceduralCanvasTexture("fabric", color, tier === "ultra" ? 512 : 256);
          mat.bumpScale = 0.03;
        }
        return mat;
      }
    }
  };

  // Build each component with tier filtering
  for (const comp of def.components || []) {
    // Skip ultra/medium-only extra detail meshes on lower tiers
    if (tier === "low" && (comp.min_tier === "medium" || comp.min_tier === "ultra")) continue;
    if (tier === "medium" && comp.min_tier === "ultra") continue;

    const mat = getMaterial(comp.material_type, comp.color_hex, comp.roughness, comp.metalness);
    const cw = Math.max(0.1, comp.width_ft);
    const cd = Math.max(0.1, comp.depth_ft);
    const ch = Math.max(0.1, comp.height_ft);

    // Multi-segment cushion set with welt seam piping (Ultra & Medium)
    if (comp.type === "cushion_set" && (comp.count ?? 1) > 1) {
      const count = comp.count || 3;
      const segW = (cw - (count - 1) * 0.06) / count;
      for (let i = 0; i < count; i++) {
        const segX = comp.relative_x - cw / 2 + segW / 2 + i * (segW + 0.06);
        const cushionGeom = new THREE.BoxGeometry(segW, ch, cd);
        const cushionMesh = new THREE.Mesh(cushionGeom, mat);
        cushionMesh.position.set(segX, comp.relative_y, comp.relative_z);
        cushionMesh.castShadow = true;
        cushionMesh.receiveShadow = true;
        root.add(cushionMesh);

        // Extra detail mesh: Welt Seam Piping along cushion border (Ultra Tier)
        if (tier === "ultra") {
          const pipeMat = new THREE.MeshStandardMaterial({
            color: primaryColor,
            roughness: 0.6,
          });
          const pipeGeom = new THREE.CylinderGeometry(0.02, 0.02, segW, 8);
          const pipeMesh = new THREE.Mesh(pipeGeom, pipeMat);
          pipeMesh.rotation.z = Math.PI / 2;
          pipeMesh.position.set(segX, comp.relative_y + ch / 2, comp.relative_z + cd / 2);
          root.add(pipeMesh);
        }
      }
    } else if (comp.type === "legs" && (comp.count ?? 4) >= 4) {
      const legRadius = 0.055;
      const legH = ch;
      const halfW = cw / 2;
      const halfD = cd / 2;
      const legPositions = [
        [comp.relative_x - halfW, comp.relative_y, comp.relative_z - halfD],
        [comp.relative_x + halfW, comp.relative_y, comp.relative_z - halfD],
        [comp.relative_x - halfW, comp.relative_y, comp.relative_z + halfD],
        [comp.relative_x + halfW, comp.relative_y, comp.relative_z + halfD],
      ];

      const brassCapMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.95,
        roughness: 0.18,
      });

      for (const [lx, ly, lz] of legPositions) {
        const legGeom = new THREE.CylinderGeometry(legRadius * 0.75, legRadius, legH, radialSegs);
        const legMesh = new THREE.Mesh(legGeom, mat);
        legMesh.position.set(lx, ly, lz);
        legMesh.castShadow = true;
        root.add(legMesh);

        // Extra detail mesh: Brass Ferrule Tip / Cap (Ultra & Medium)
        if (tier !== "low") {
          const capH = legH * 0.28;
          const capGeom = new THREE.CylinderGeometry(legRadius * 0.78, legRadius * 0.72, capH, radialSegs);
          const capMesh = new THREE.Mesh(capGeom, brassCapMat);
          capMesh.position.set(lx, ly - legH / 2 + capH / 2, lz);
          capMesh.castShadow = true;
          root.add(capMesh);
        }
      }
    } else if (comp.type === "armrests") {
      const armW = 0.45;
      const armGeom = new THREE.BoxGeometry(armW, ch, cd);

      const armLeft = new THREE.Mesh(armGeom, mat);
      armLeft.position.set(comp.relative_x - cw / 2 + armW / 2, comp.relative_y, comp.relative_z);
      armLeft.castShadow = true;
      root.add(armLeft);

      const armRight = new THREE.Mesh(armGeom, mat);
      armRight.position.set(comp.relative_x + cw / 2 - armW / 2, comp.relative_y, comp.relative_z);
      armRight.castShadow = true;
      root.add(armRight);

      // Extra detail mesh: Curved Padded Armrest Cap (Ultra Tier)
      if (tier === "ultra") {
        const capGeom = new THREE.CylinderGeometry(armW / 2, armW / 2, cd, 16);
        const capLeft = new THREE.Mesh(capGeom, mat);
        capLeft.rotation.x = Math.PI / 2;
        capLeft.position.set(comp.relative_x - cw / 2 + armW / 2, comp.relative_y + ch / 2, comp.relative_z);
        root.add(capLeft);

        const capRight = capLeft.clone();
        capRight.position.x = comp.relative_x + cw / 2 - armW / 2;
        root.add(capRight);
      }
    } else if (comp.shape === "cylinder") {
      const cylGeom = new THREE.CylinderGeometry(cw / 2, cw / 2, ch, radialSegs);
      const cylMesh = new THREE.Mesh(cylGeom, mat);
      cylMesh.position.set(comp.relative_x, comp.relative_y, comp.relative_z);
      if (comp.rotation_y) cylMesh.rotation.y = comp.rotation_y;
      cylMesh.castShadow = true;
      cylMesh.receiveShadow = true;
      root.add(cylMesh);
    } else if (comp.shape === "sphere") {
      const sphereGeom = new THREE.SphereGeometry(cw / 2, radialSegs, radialSegs);
      const sphereMesh = new THREE.Mesh(sphereGeom, mat);
      sphereMesh.position.set(comp.relative_x, comp.relative_y, comp.relative_z);
      sphereMesh.castShadow = true;
      root.add(sphereMesh);
    } else {
      // Default Box Component
      const boxGeom = new THREE.BoxGeometry(cw, ch, cd);
      const boxMesh = new THREE.Mesh(boxGeom, mat);
      boxMesh.position.set(comp.relative_x, comp.relative_y, comp.relative_z);
      if (comp.rotation_y) boxMesh.rotation.y = comp.rotation_y;
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      root.add(boxMesh);

      // Multi-Mesh Tufting Matrix (Ultra & Medium)
      if (comp.style_tag === "tufted" && tier !== "low") {
        const buttonMat = new THREE.MeshStandardMaterial({
          color: 0x18120d,
          roughness: 0.45,
          metalness: 0.1,
        });
        const numRows = tier === "ultra" ? 3 : 2;
        const numCols = tier === "ultra" ? 5 : 3;

        for (let row = -Math.floor(numRows / 2); row <= Math.floor(numRows / 2); row++) {
          for (let col = -Math.floor(numCols / 2); col <= Math.floor(numCols / 2); col++) {
            const btn = new THREE.Mesh(
              new THREE.SphereGeometry(0.04, radialSegs / 2, radialSegs / 2),
              buttonMat
            );
            btn.position.set(
              comp.relative_x + col * (cw / (numCols + 0.8)),
              comp.relative_y + row * (ch / (numRows + 0.8)),
              comp.relative_z + cd / 2 + 0.025
            );
            root.add(btn);
          }
        }
      }
    }
  }

  // Extra High-Fidelity Accent Bolster Throw Pillows for Sofas / Beds (Ultra Tier)
  if (tier === "ultra" && (def.category === "living" || def.category === "bedroom") && meshTarget >= 25) {
    const pillowMat = new THREE.MeshStandardMaterial({
      color: secondaryColor || 0xd4af37,
      roughness: 0.75,
      metalness: 0.05,
    });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 16), pillowMat);
    p1.rotation.z = Math.PI / 2;
    p1.rotation.y = 0.3;
    p1.position.set(-def.width_ft / 2 + 0.8, 1.1, 0.2);
    p1.castShadow = true;

    const p2 = p1.clone();
    p2.rotation.y = -0.3;
    p2.position.x = def.width_ft / 2 - 0.8;
    root.add(p1, p2);
  }

  return root;
}
