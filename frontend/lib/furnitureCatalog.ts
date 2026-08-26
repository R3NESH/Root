// 3D Architectural Furniture & Objects Catalog & Procedural Mesh Factories
import * as THREE from "three";

export type FurnitureCategory = "living" | "bedroom" | "dining" | "kitchen" | "office" | "decor" | "sacred";

export interface FurnitureItemDef {
  type: string;
  name: string;
  category: FurnitureCategory;
  icon: string;
  dimensions: { widthFt: number; depthFt: number; heightFt: number };
  description: string;
  defaultColor?: number;
}

export interface PlacedCustomObject {
  id: string;
  type: string;
  name: string;
  x: number; // feet in world
  y: number; // feet in world (height off floor, usually 0)
  z: number; // feet in world
  rotationY: number; // radians
  scale: number; // 0.8 - 1.5
  colorHex?: number;
}

export const FURNITURE_COLOR_SWATCHES = [
  { name: "Royal Velvet Navy", hex: 0x1e3a8a, bg: "#1e3a8a" },
  { name: "Emerald Serpentine", hex: 0x065f46, bg: "#065f46" },
  { name: "Charcoal Obsidian", hex: 0x1e293b, bg: "#1e293b" },
  { name: "Warm Ochre / Tan", hex: 0xb45309, bg: "#b45309" },
  { name: "Indian Terracotta", hex: 0xb91c1c, bg: "#b91c1c" },
  { name: "Linen Cream", hex: 0xf3f4f6, bg: "#f3f4f6" },
  { name: "Teak Hardwood", hex: 0x78350f, bg: "#78350f" },
  { name: "Dark Walnut", hex: 0x3e2723, bg: "#3e2723" },
];

export const FURNITURE_CATALOG: FurnitureItemDef[] = [
  // --------------------------------------------------------------------------------------
  // 1. Living Room & Sofas (Multiple Shapes & Styles)
  // --------------------------------------------------------------------------------------
  {
    type: "sofa_3seater",
    name: "Luxury 3-Seater Sofa",
    category: "living",
    icon: "🛋️",
    dimensions: { widthFt: 7.0, depthFt: 3.2, heightFt: 2.8 },
    description: "Classic straight 3-seater sofa with deep cushions, padded armrests, and brass-tipped tapered legs.",
    defaultColor: 0x1e3a8a,
  },
  {
    type: "sofa_l_shape",
    name: "L-Shaped Sectional Corner Sofa",
    category: "living",
    icon: "🛋️",
    dimensions: { widthFt: 8.5, depthFt: 6.5, heightFt: 2.8 },
    description: "Spacious modular L-shaped corner sectional with extended chaise lounge for luxury living rooms.",
    defaultColor: 0x1e293b,
  },
  {
    type: "sofa_curved",
    name: "Curved Crescent Lounge Sofa",
    category: "living",
    icon: "🛋️",
    dimensions: { widthFt: 7.8, depthFt: 4.2, heightFt: 2.7 },
    description: "Ultra-modern organic curved crescent sofa with rounded bouclé upholstery.",
    defaultColor: 0xf3f4f6,
  },
  {
    type: "sofa_loveseat",
    name: "Compact 2-Seater Loveseat",
    category: "living",
    icon: "🛋️",
    dimensions: { widthFt: 5.0, depthFt: 3.0, heightFt: 2.8 },
    description: "Cozy 2-seater apartment loveseat with tailored piping and walnut legs.",
    defaultColor: 0x065f46,
  },
  {
    type: "armchair",
    name: "Modern Accent Armchair",
    category: "living",
    icon: "🪑",
    dimensions: { widthFt: 2.8, depthFt: 2.8, heightFt: 2.7 },
    description: "Plush single-seater accent armchair with ergonomic curved backrest.",
    defaultColor: 0xb45309,
  },
  {
    type: "recliner_chair",
    name: "Leather Ergonomic Recliner",
    category: "living",
    icon: "🪑",
    dimensions: { widthFt: 3.2, depthFt: 3.4, heightFt: 3.4 },
    description: "Padded top-grain leather recliner with swivel base and extendable footrest.",
    defaultColor: 0x78350f,
  },
  {
    type: "coffee_table",
    name: "Marble & Gold Coffee Table",
    category: "living",
    icon: "☕",
    dimensions: { widthFt: 3.8, depthFt: 2.4, heightFt: 1.4 },
    description: "Calacatta marble top coffee table with satin brass metal architectural frame.",
  },
  {
    type: "tv_unit",
    name: "Floating TV Entertainment Wall",
    category: "living",
    icon: "📺",
    dimensions: { widthFt: 6.5, depthFt: 1.4, heightFt: 5.2 },
    description: "Wall-mounted dark walnut media console with 65-inch ultra-thin 4K OLED TV screen.",
  },

  // --------------------------------------------------------------------------------------
  // 2. Bedroom (Multiple Bed Shapes & Storage)
  // --------------------------------------------------------------------------------------
  {
    type: "bed_king",
    name: "Grand King Bed with Headboard",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 6.4, depthFt: 7.0, heightFt: 4.0 },
    description: "King bed with vertical channel tufted upholstered headboard, duvet, pillows, and dual nightstands.",
    defaultColor: 0x1e293b,
  },
  {
    type: "bed_queen_platform",
    name: "Modern Platform Bed (Queen)",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 5.5, depthFt: 6.8, heightFt: 3.0 },
    description: "Sleek low-profile Japanese-inspired wood platform bed with floating nightstands.",
    defaultColor: 0x78350f,
  },
  {
    type: "bed_single",
    name: "Single Bed with Side Table",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 3.6, depthFt: 6.5, heightFt: 3.0 },
    description: "Contemporary single bed with breathable linen mattress and compact side table.",
    defaultColor: 0x1e3a8a,
  },
  {
    type: "bed_bunk",
    name: "Wooden Double Bunk Bed",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 3.8, depthFt: 6.6, heightFt: 5.8 },
    description: "Solid pine double-tier bunk bed with safety guard rails and integrated access ladder.",
    defaultColor: 0x78350f,
  },
  {
    type: "wardrobe",
    name: "3-Door Full-Height Wardrobe",
    category: "bedroom",
    icon: "🚪",
    dimensions: { widthFt: 5.4, depthFt: 2.0, heightFt: 7.8 },
    description: "Floor-to-ceiling 3-door wardrobe closet in dark walnut with brushed brass handles.",
  },
  {
    type: "vanity_table",
    name: "Dressing Vanity & LED Mirror",
    category: "bedroom",
    icon: "🪞",
    dimensions: { widthFt: 3.6, depthFt: 1.6, heightFt: 5.2 },
    description: "Dressing console with backlit circular LED mirror and cushioned velvet vanity stool.",
  },

  // --------------------------------------------------------------------------------------
  // 3. Dining & Kitchen
  // --------------------------------------------------------------------------------------
  {
    type: "dining_6seater",
    name: "6-Seater Rectangular Dining Set",
    category: "dining",
    icon: "🍽️",
    dimensions: { widthFt: 6.2, depthFt: 3.5, heightFt: 2.8 },
    description: "Teakwood dining table with 6 cushioned dining chairs and central runner.",
    defaultColor: 0x78350f,
  },
  {
    type: "dining_round",
    name: "4-Seater Round Dining Table",
    category: "dining",
    icon: "🍲",
    dimensions: { widthFt: 4.4, depthFt: 4.4, heightFt: 2.8 },
    description: "Round marble pedestal dining table with 4 curved upholstered dining armchairs.",
  },
  {
    type: "kitchen_island",
    name: "Kitchen Island & Bar Stools",
    category: "kitchen",
    icon: "🍳",
    dimensions: { widthFt: 6.0, depthFt: 2.8, heightFt: 3.2 },
    description: "Waterfall quartz kitchen prep island with 2 modern high-top bar stools.",
  },
  {
    type: "refrigerator",
    name: "Double-Door Smart Refrigerator",
    category: "kitchen",
    icon: "🧊",
    dimensions: { widthFt: 3.0, depthFt: 2.6, heightFt: 6.8 },
    description: "Brushed stainless steel French door smart refrigerator with ice dispenser.",
  },

  // --------------------------------------------------------------------------------------
  // 4. Work, Study & Decor
  // --------------------------------------------------------------------------------------
  {
    type: "study_desk",
    name: "Executive Desk & Ergonomic Chair",
    category: "office",
    icon: "💻",
    dimensions: { widthFt: 4.5, depthFt: 2.2, heightFt: 3.2 },
    description: "Modern workstation desk with laptop, desk lamp, and high-back ergonomic mesh chair.",
  },
  {
    type: "bookshelf",
    name: "Tall Open Bookshelf",
    category: "office",
    icon: "📚",
    dimensions: { widthFt: 3.6, depthFt: 1.2, heightFt: 6.5 },
    description: "Architectural 5-tier open bookcase with books and decorative ceramics.",
  },
  {
    type: "plant_pot",
    name: "Indoor Botanical Planter",
    category: "decor",
    icon: "🪴",
    dimensions: { widthFt: 1.8, depthFt: 1.8, heightFt: 4.4 },
    description: "Lush Fiddle Leaf Fig tree in a fluted minimalist ceramic pot.",
  },
  {
    type: "floor_lamp",
    name: "Curved Arc Floor Lamp",
    category: "decor",
    icon: "💡",
    dimensions: { widthFt: 1.8, depthFt: 1.8, heightFt: 5.6 },
    description: "Gold/black metal arc standing lamp with warm ambient lampshade.",
  },
  {
    type: "floor_rug",
    name: "Geometric Area Rug",
    category: "decor",
    icon: "🧶",
    dimensions: { widthFt: 7.5, depthFt: 5.5, heightFt: 0.05 },
    description: "High-pile luxury woven area rug with subtle geometric borders.",
  },

  // --------------------------------------------------------------------------------------
  // 5. Sacred & Spiritual
  // --------------------------------------------------------------------------------------
  {
    type: "pooja_mandir",
    name: "Sacred Teakwood Pooja Mandir",
    category: "sacred",
    icon: "🛕",
    dimensions: { widthFt: 3.4, depthFt: 2.2, heightFt: 5.0 },
    description: "Carved teakwood pooja mandir shrine with pyramid gopuram spire, brass kalash, and diya lamps.",
  },
];

// --------------------------------------------------------------------------------------
// Procedural 3D Mesh Generator Engine
// --------------------------------------------------------------------------------------

export function createFurnitureMesh(type: string, customColor?: number): THREE.Group {
  const root = new THREE.Group();

  // Shared reusable materials
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.15 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.55 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.45 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
  const quartzMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.18, metalness: 0.08 });
  const fabricColor = customColor ?? (FURNITURE_CATALOG.find((i) => i.type === type)?.defaultColor || 0x1e3a8a);
  const fabricMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.8 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });

  switch (type) {
    // ----------------------------------------------------------------------------------
    // 1. Luxury 3-Seater Sofa
    // ----------------------------------------------------------------------------------
    case "sofa_3seater": {
      const w = 7.0;
      const d = 3.2;
      const seatH = 1.3;

      // Base & Seat Cushions
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, seatH * 0.4, d), fabricMat);
      base.position.y = 0.4 + (seatH * 0.4) / 2;
      root.add(base);

      for (let i = -1; i <= 1; i++) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(w / 3 - 0.08, 0.4, d - 0.3), fabricMat);
        cushion.position.set(i * (w / 3), seatH + 0.1, 0.1);
        root.add(cushion);
      }

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 0.5), fabricMat);
      back.position.set(0, seatH + 0.8, -d / 2 + 0.25);
      root.add(back);

      // Armrests
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, d), fabricMat);
      armL.position.set(-w / 2 + 0.225, seatH + 0.3, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.225;
      root.add(armL, armR);

      // Throw Pillows
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.25), pillowMat);
      p1.position.set(-w / 2 + 0.75, seatH + 0.5, -d / 2 + 0.6);
      p1.rotation.y = 0.2;
      const p2 = p1.clone();
      p2.position.x = w / 2 - 0.75;
      p2.rotation.y = -0.2;
      root.add(p1, p2);

      // Brass Legs
      for (const lx of [-w / 2 + 0.3, w / 2 - 0.3]) {
        for (const lz of [-d / 2 + 0.3, d / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.4, 16), brassMat);
          leg.position.set(lx, 0.2, lz);
          root.add(leg);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 2. L-Shaped Sectional Corner Sofa
    // ----------------------------------------------------------------------------------
    case "sofa_l_shape": {
      const mainW = 8.5;
      const mainD = 3.2;
      const chaiseL = 6.5;
      const seatH = 1.3;

      // Main Section Base
      const mainBase = new THREE.Mesh(new THREE.BoxGeometry(mainW, seatH * 0.4, mainD), fabricMat);
      mainBase.position.set(0, 0.4 + (seatH * 0.4) / 2, 0);
      root.add(mainBase);

      // Chaise Lounge Extension (on the right)
      const chaiseBase = new THREE.Mesh(new THREE.BoxGeometry(3.0, seatH * 0.4, chaiseL - mainD), fabricMat);
      chaiseBase.position.set(mainW / 2 - 1.5, 0.4 + (seatH * 0.4) / 2, (chaiseL - mainD) / 2 + mainD / 2);
      root.add(chaiseBase);

      // Main Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(mainW, 1.6, 0.5), fabricMat);
      back.position.set(0, seatH + 0.8, -mainD / 2 + 0.25);
      root.add(back);

      // Left Armrest
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, mainD), fabricMat);
      armL.position.set(-mainW / 2 + 0.225, seatH + 0.3, 0);
      root.add(armL);

      // Cushions on main sofa
      for (let i = 0; i < 3; i++) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, mainD - 0.4), fabricMat);
        cushion.position.set(-mainW / 2 + 1.2 + i * 1.9, seatH + 0.1, 0.1);
        root.add(cushion);
      }

      // Chaise Long Cushion
      const chaiseCushion = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, chaiseL - 0.4), fabricMat);
      chaiseCushion.position.set(mainW / 2 - 1.5, seatH + 0.1, (chaiseL - mainD) / 2);
      root.add(chaiseCushion);

      // Throw Pillows
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.25), pillowMat);
      p1.position.set(-mainW / 2 + 0.8, seatH + 0.5, -mainD / 2 + 0.6);
      p1.rotation.y = 0.2;
      root.add(p1);

      // Legs
      for (const [lx, lz] of [
        [-mainW / 2 + 0.3, -mainD / 2 + 0.3],
        [-mainW / 2 + 0.3, mainD / 2 - 0.3],
        [mainW / 2 - 0.3, -mainD / 2 + 0.3],
        [mainW / 2 - 0.3, chaiseL - 0.3],
        [mainW / 2 - 2.8, chaiseL - 0.3],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.4, 16), darkWoodMat);
        leg.position.set(lx, 0.2, lz);
        root.add(leg);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 3. Curved Crescent Lounge Sofa
    // ----------------------------------------------------------------------------------
    case "sofa_curved": {
      const radius = 4.0;
      const tube = 1.0;
      const arc = Math.PI * 0.65;

      const curveGeom = new THREE.TorusGeometry(radius, tube * 0.7, 16, 32, arc);
      const curveMesh = new THREE.Mesh(curveGeom, fabricMat);
      curveMesh.rotation.x = Math.PI / 2;
      curveMesh.rotation.z = -arc / 2 - Math.PI / 2;
      curveMesh.position.set(0, 0.8, -1.2);
      root.add(curveMesh);

      // Curved Backrest
      const backGeom = new THREE.TorusGeometry(radius + 0.4, tube * 0.55, 16, 32, arc);
      const backMesh = new THREE.Mesh(backGeom, fabricMat);
      backMesh.rotation.x = Math.PI / 2;
      backMesh.rotation.z = -arc / 2 - Math.PI / 2;
      backMesh.position.set(0, 1.6, -1.2);
      root.add(backMesh);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 4. Compact 2-Seater Loveseat
    // ----------------------------------------------------------------------------------
    case "sofa_loveseat": {
      const w = 5.0;
      const d = 3.0;
      const seatH = 1.2;

      const base = new THREE.Mesh(new THREE.BoxGeometry(w, seatH * 0.4, d), fabricMat);
      base.position.y = 0.4 + (seatH * 0.4) / 2;
      root.add(base);

      for (let i = -0.5; i <= 0.5; i += 1.0) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.1, 0.4, d - 0.3), fabricMat);
        cushion.position.set(i * (w / 2), seatH + 0.1, 0.1);
        root.add(cushion);
      }

      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, 0.5), fabricMat);
      back.position.set(0, seatH + 0.75, -d / 2 + 0.25);
      root.add(back);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, d), fabricMat);
      armL.position.set(-w / 2 + 0.2, seatH + 0.25, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.2;
      root.add(armL, armR);

      for (const lx of [-w / 2 + 0.3, w / 2 - 0.3]) {
        for (const lz of [-d / 2 + 0.3, d / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.4, 16), brassMat);
          leg.position.set(lx, 0.2, lz);
          root.add(leg);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 5. Armchair
    // ----------------------------------------------------------------------------------
    case "armchair": {
      const w = 2.8;
      const d = 2.8;
      const seatH = 1.3;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.4, d - 0.4), fabricMat);
      seat.position.set(0, seatH, 0.1);
      root.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 1.4, 0.4), fabricMat);
      back.position.set(0, seatH + 0.7, -d / 2 + 0.3);
      root.add(back);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, d - 0.2), fabricMat);
      armL.position.set(-w / 2 + 0.15, seatH + 0.25, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.15;
      root.add(armL, armR);

      for (const lx of [-w / 2 + 0.3, w / 2 - 0.3]) {
        for (const lz of [-d / 2 + 0.3, d / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, seatH, 16), brassMat);
          leg.position.set(lx, seatH / 2, lz);
          root.add(leg);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 6. Leather Recliner
    // ----------------------------------------------------------------------------------
    case "recliner_chair": {
      const w = 3.2;
      const d = 3.4;
      const leatherMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.45 });

      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 32), chromeMat);
      baseRing.position.y = 0.08;
      root.add(baseRing);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.6, d - 0.8), leatherMat);
      seat.position.set(0, 1.3, 0);
      root.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 2.0, 0.5), leatherMat);
      back.position.set(0, 2.2, -d / 2 + 0.5);
      back.rotation.x = -0.15;
      root.add(back);

      const headrest = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.6, 0.4), leatherMat);
      headrest.position.set(0, 3.2, -d / 2 + 0.35);
      root.add(headrest);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, d - 0.6), leatherMat);
      armL.position.set(-w / 2 + 0.2, 1.6, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.2;
      root.add(armL, armR);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 7. Coffee Table
    // ----------------------------------------------------------------------------------
    case "coffee_table": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 2.4), marbleMat);
      top.position.y = 1.4;
      root.add(top);

      for (const lx of [-1.6, 1.6]) {
        for (const lz of [-0.9, 0.9]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 16), brassMat);
          leg.position.set(lx, 0.675, lz);
          root.add(leg);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 8. Floating TV Unit
    // ----------------------------------------------------------------------------------
    case "tv_unit": {
      const w = 6.5;
      const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, 1.4), walnutMat);
      consoleMesh.position.set(0, 1.2, 0);
      root.add(consoleMesh);

      // Backing Wall Slat Panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 4.2, 0.15), darkWoodMat);
      panel.position.set(0, 3.0, -0.6);
      root.add(panel);

      // 65" TV Screen
      const tvScreen = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 2.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 })
      );
      tvScreen.position.set(0, 3.2, -0.45);
      root.add(tvScreen);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 9. Grand King Bed
    // ----------------------------------------------------------------------------------
    case "bed_king": {
      const w = 6.4;
      const d = 7.0;

      // Base
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), darkWoodMat);
      base.position.set(0, 0.4, 0);
      root.add(base);

      // Mattress & Duvet
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.7, d - 0.4), cushionMat);
      mattress.position.set(0, 1.15, 0.1);
      root.add(mattress);

      const duvet = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.15, d * 0.65), fabricMat);
      duvet.position.set(0, 1.55, 0.5);
      root.add(duvet);

      // Tufted Headboard
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 3.2, 0.4), fabricMat);
      headboard.position.set(0, 2.0, -d / 2 + 0.2);
      root.add(headboard);

      // Pillows
      for (const px of [-1.5, 1.5]) {
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.2), cushionMat);
        pillow.position.set(px, 1.6, -d / 2 + 1.2);
        pillow.rotation.x = 0.2;
        root.add(pillow);
      }

      // Dual Nightstands
      for (const side of [-1, 1]) {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), darkWoodMat);
        stand.position.set(side * (w / 2 + 1.0), 0.6, -d / 2 + 1.0);
        root.add(stand);

        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.6, 16), brassMat);
        lamp.position.set(side * (w / 2 + 1.0), 1.5, -d / 2 + 1.0);
        root.add(lamp);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 10. Platform Bed (Queen)
    // ----------------------------------------------------------------------------------
    case "bed_queen_platform": {
      const w = 5.5;
      const d = 6.8;

      const platform = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.4, d + 0.6), walnutMat);
      platform.position.set(0, 0.2, 0);
      root.add(platform);

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), cushionMat);
      mattress.position.set(0, 0.75, 0);
      root.add(mattress);

      const duvet = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.15, d * 0.6), fabricMat);
      duvet.position.set(0, 1.15, 0.5);
      root.add(duvet);

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 2.2, 0.25), walnutMat);
      headboard.position.set(0, 1.3, -d / 2 - 0.1);
      root.add(headboard);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 11. Single Bed
    // ----------------------------------------------------------------------------------
    case "bed_single": {
      const w = 3.6;
      const d = 6.5;

      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), darkWoodMat);
      base.position.set(0, 0.3, 0);
      root.add(base);

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.6, d - 0.2), cushionMat);
      mattress.position.set(0, 0.9, 0);
      root.add(mattress);

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.3), darkWoodMat);
      headboard.position.set(0, 1.3, -d / 2 + 0.15);
      root.add(headboard);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 12. Bunk Bed
    // ----------------------------------------------------------------------------------
    case "bed_bunk": {
      const w = 3.8;
      const d = 6.6;
      const h = 5.8;

      // 4 Corner Posts
      for (const lx of [-w / 2 + 0.15, w / 2 - 0.15]) {
        for (const lz of [-d / 2 + 0.15, d / 2 - 0.15]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), darkWoodMat);
          post.position.set(lx, h / 2, lz);
          root.add(post);
        }
      }

      // Bottom Bunk
      const bed1 = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.5, d - 0.3), cushionMat);
      bed1.position.set(0, 1.2, 0);
      root.add(bed1);

      // Top Bunk
      const bed2 = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.5, d - 0.3), cushionMat);
      bed2.position.set(0, 4.2, 0);
      root.add(bed2);

      // Safety Guard Rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.8, 0.15), darkWoodMat);
      rail.position.set(0, 4.8, d / 2 - 0.2);
      root.add(rail);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 13. 3-Door Wardrobe
    // ----------------------------------------------------------------------------------
    case "wardrobe": {
      const w = 5.4;
      const d = 2.0;
      const h = 7.8;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walnutMat);
      body.position.set(0, h / 2, 0);
      root.add(body);

      // 3 Doors with Grooves
      for (let i = -1; i <= 1; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(w / 3 - 0.06, h - 0.2, 0.05), darkWoodMat);
        door.position.set(i * (w / 3), h / 2, d / 2 + 0.03);
        root.add(door);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.1), brassMat);
        handle.position.set(i * (w / 3) + (i === 1 ? -0.5 : 0.5), h / 2, d / 2 + 0.08);
        root.add(handle);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 14. Vanity Table
    // ----------------------------------------------------------------------------------
    case "vanity_table": {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 1.6), walnutMat);
      desk.position.set(0, 2.4, 0);
      root.add(desk);

      // Round LED Mirror
      const mirror = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.08, 32),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.05 })
      );
      mirror.rotation.x = Math.PI / 2;
      mirror.position.set(0, 4.4, -0.6);
      root.add(mirror);

      // Stool
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 24), fabricMat);
      stool.position.set(0, 0.6, 0.8);
      root.add(stool);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 15. 6-Seater Dining Set
    // ----------------------------------------------------------------------------------
    case "dining_6seater": {
      const tw = 6.2;
      const td = 3.5;
      const tableTop = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.2, td), darkWoodMat);
      tableTop.position.set(0, 2.7, 0);
      root.add(tableTop);

      for (const lx of [-tw / 2 + 0.4, tw / 2 - 0.4]) {
        for (const lz of [-td / 2 + 0.4, td / 2 - 0.4]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), darkWoodMat);
          leg.position.set(lx, 1.3, lz);
          root.add(leg);
        }
      }

      // 6 Chairs
      for (let i = -1; i <= 1; i++) {
        for (const side of [-1, 1]) {
          const chair = new THREE.Group();
          const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 1.3), fabricMat);
          seat.position.y = 1.5;
          const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.15), darkWoodMat);
          chairBack.position.set(0, 2.2, side * 0.6);
          chair.add(seat, chairBack);
          chair.position.set(i * 1.8, 0, side * (td / 2 + 0.8));
          root.add(chair);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 16. Round Dining Table
    // ----------------------------------------------------------------------------------
    case "dining_round": {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.15, 32), marbleMat);
      top.position.set(0, 2.7, 0);
      root.add(top);

      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 2.6, 24), brassMat);
      pedestal.position.set(0, 1.3, 0);
      root.add(pedestal);

      // 4 Chairs in circle
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 2;
        const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.4, 24), fabricMat);
        chair.position.set(Math.cos(angle) * 3.0, 0.7, Math.sin(angle) * 3.0);
        root.add(chair);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 17. Kitchen Island
    // ----------------------------------------------------------------------------------
    case "kitchen_island": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.7, 2.6), darkWoodMat);
      body.position.set(0, 1.35, 0);
      root.add(body);

      const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 3.0), quartzMat);
      top.position.set(0, 2.8, 0);
      root.add(top);

      // 2 Bar Stools
      for (const bx of [-1.5, 1.5]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16), fabricMat);
        stool.position.set(bx, 1.1, 2.2);
        root.add(stool);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 18. Refrigerator
    // ----------------------------------------------------------------------------------
    case "refrigerator": {
      const fridge = new THREE.Mesh(new THREE.BoxGeometry(3.0, 6.8, 2.6), chromeMat);
      fridge.position.set(0, 3.4, 0);
      root.add(fridge);

      // Handle Bars
      for (const side of [-0.3, 0.3]) {
        const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 12), brassMat);
        hBar.position.set(side, 4.0, 1.38);
        root.add(hBar);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 19. Executive Study Desk
    // ----------------------------------------------------------------------------------
    case "study_desk": {
      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.2), darkWoodMat);
      deskTop.position.set(0, 2.5, 0);
      root.add(deskTop);

      for (const lx of [-2.0, 2.0]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 2.0), chromeMat);
        leg.position.set(lx, 1.2, 0);
        root.add(leg);
      }

      // Laptop
      const laptop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.9), chromeMat);
      laptop.position.set(0, 2.65, 0);
      root.add(laptop);

      // Office Chair
      const chair = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 1.4), fabricMat);
      chair.position.set(0, 1.8, 1.6);
      root.add(chair);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 20. Tall Open Bookshelf
    // ----------------------------------------------------------------------------------
    case "bookshelf": {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6.5, 1.2), darkWoodMat);
      frame.position.set(0, 3.25, 0);
      root.add(frame);

      // 4 Internal Shelves with decorative items
      for (let s = 1; s <= 4; s++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.15), brassMat);
        shelf.position.set(0, s * 1.3, 0.05);
        root.add(shelf);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 21. Plant Pot
    // ----------------------------------------------------------------------------------
    case "plant_pot": {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.5, 1.4, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      pot.position.set(0, 0.7, 0);
      root.add(pot);

      // Stem & Foliage
      const plantMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 12), darkWoodMat);
      stem.position.set(0, 2.2, 0);
      root.add(stem);

      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), plantMat);
        leaf.scale.set(1.4, 0.3, 0.8);
        const a = (i * Math.PI) / 3;
        leaf.position.set(Math.cos(a) * 0.7, 2.0 + i * 0.35, Math.sin(a) * 0.7);
        leaf.rotation.y = a;
        leaf.rotation.z = 0.3;
        root.add(leaf);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 22. Floor Lamp
    // ----------------------------------------------------------------------------------
    case "floor_lamp": {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 24), brassMat);
      base.position.set(0, 0.05, 0);
      root.add(base);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.0, 16), brassMat);
      pole.position.set(0, 2.5, 0);
      root.add(pole);

      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 0.9, 24),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0x422006, roughness: 0.5 })
      );
      shade.position.set(0, 5.0, 0);
      root.add(shade);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 23. Sacred Pooja Mandir Temple
    // ----------------------------------------------------------------------------------
    case "pooja_mandir": {
      const w = 3.4;
      const d = 2.2;

      // Base Platform
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), darkWoodMat);
      base.position.set(0, 0.6, 0);
      root.add(base);

      // Inner Sanctum Pillars
      for (const px of [-w / 2 + 0.3, w / 2 - 0.3]) {
        for (const pz of [-d / 2 + 0.3, d / 2 - 0.3]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 16), brassMat);
          pillar.position.set(px, 2.4, pz);
          root.add(pillar);
        }
      }

      // Temple Canopy / Shikhara
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), darkWoodMat);
      canopy.position.set(0, 3.6, 0);
      root.add(canopy);

      const dome = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 4), brassMat);
      dome.position.set(0, 4.4, 0);
      dome.rotation.y = Math.PI / 4;
      root.add(dome);

      // Brass Kalash Top
      const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), brassMat);
      kalash.position.set(0, 5.2, 0);
      root.add(kalash);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 24. Floor Area Rug
    // ----------------------------------------------------------------------------------
    case "floor_rug": {
      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.04, 5.5),
        new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.95 })
      );
      rug.position.set(0, 0.02, 0);
      root.add(rug);
      break;
    }

    default: {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), fabricMat);
      cube.position.y = 1;
      root.add(cube);
      break;
    }
  }

  return root;
}
