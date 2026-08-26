// 3D Architectural Furniture & Objects Catalog & Procedural Mesh Factories
import * as THREE from "three";

export interface FurnitureItemDef {
  type: string;
  name: string;
  category: "living" | "bedroom" | "dining" | "kitchen" | "bathroom" | "decor";
  icon: string;
  dimensions: { widthFt: number; depthFt: number; heightFt: number };
  description: string;
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

export const FURNITURE_CATALOG: FurnitureItemDef[] = [
  // Living / Lounge
  {
    type: "sofa_3seater",
    name: "Luxury 3-Seater Sofa",
    category: "living",
    icon: "🛋️",
    dimensions: { widthFt: 6.8, depthFt: 3.2, heightFt: 2.8 },
    description: "Comfortable velvet 3-seater sofa with accent cushions and walnut legs.",
  },
  {
    type: "armchair",
    name: "Modern Armchair",
    category: "living",
    icon: "🪑",
    dimensions: { widthFt: 2.8, depthFt: 2.8, heightFt: 2.7 },
    description: "Plush single-seater accent armchair with brass tipped legs.",
  },
  {
    type: "coffee_table",
    name: "Marble Coffee Table",
    category: "living",
    icon: "☕",
    dimensions: { widthFt: 3.6, depthFt: 2.2, heightFt: 1.4 },
    description: "Calacatta marble top coffee table with satin brass metal frame.",
  },
  {
    type: "tv_unit",
    name: "Floating TV Console",
    category: "living",
    icon: "📺",
    dimensions: { widthFt: 6.0, depthFt: 1.4, heightFt: 4.8 },
    description: "Wall-mounted walnut media console with 65-inch ultra-thin 4K TV screen.",
  },
  {
    type: "floor_lamp",
    name: "Arc Floor Lamp",
    category: "living",
    icon: "💡",
    dimensions: { widthFt: 1.6, depthFt: 1.6, heightFt: 5.5 },
    description: "Architectural arc standing lamp with warm ambient shade.",
  },
  {
    type: "plant_pot",
    name: "Fiddle Leaf Fig Plant",
    category: "decor",
    icon: "🪴",
    dimensions: { widthFt: 1.8, depthFt: 1.8, heightFt: 4.2 },
    description: "Lush indoor botanical plant in a fluted white ceramic pot.",
  },
  {
    type: "floor_rug",
    name: "Persian / Geometric Rug",
    category: "decor",
    icon: "🧶",
    dimensions: { widthFt: 7.0, depthFt: 5.0, heightFt: 0.05 },
    description: "Soft high-pile woven area rug with subtle geometric patterns.",
  },

  // Bedroom
  {
    type: "bed_king",
    name: "King Double Bed",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 6.2, depthFt: 6.8, heightFt: 3.8 },
    description: "Grand king bed with upholstered tufted headboard, duvet, and dual nightstands.",
  },
  {
    type: "bed_single",
    name: "Single Bed",
    category: "bedroom",
    icon: "🛏️",
    dimensions: { widthFt: 3.5, depthFt: 6.5, heightFt: 3.0 },
    description: "Minimalist contemporary single bed with linen mattress and nightstand.",
  },
  {
    type: "wardrobe",
    name: "3-Door Wardrobe Closet",
    category: "bedroom",
    icon: "🚪",
    dimensions: { widthFt: 5.2, depthFt: 2.0, heightFt: 7.8 },
    description: "Full-height dark walnut wardrobe closet with brushed gold handles.",
  },
  {
    type: "study_desk",
    name: "Study Desk & Ergonomic Chair",
    category: "bedroom",
    icon: "💻",
    dimensions: { widthFt: 4.2, depthFt: 2.2, heightFt: 3.2 },
    description: "Modern home office workstation desk with laptop, table lamp, and ergonomic chair.",
  },
  {
    type: "vanity_table",
    name: "Dressing Vanity Table",
    category: "bedroom",
    icon: "🪞",
    dimensions: { widthFt: 3.4, depthFt: 1.6, heightFt: 5.2 },
    description: "Dressing table with illuminated round mirror and cushioned vanity stool.",
  },

  // Dining
  {
    type: "dining_6seater",
    name: "6-Seater Dining Set",
    category: "dining",
    icon: "🍽️",
    dimensions: { widthFt: 6.0, depthFt: 3.4, heightFt: 2.8 },
    description: "Teak dining table with 6 upholstered dining chairs and table runner.",
  },
  {
    type: "dining_round",
    name: "Round Dining Table",
    category: "dining",
    icon: "🍲",
    dimensions: { widthFt: 4.2, depthFt: 4.2, heightFt: 2.8 },
    description: "Round 4-seater contemporary glass & timber dining table with curved chairs.",
  },

  // Kitchen
  {
    type: "kitchen_island",
    name: "Kitchen Island Counter",
    category: "kitchen",
    icon: "🍳",
    dimensions: { widthFt: 5.5, depthFt: 2.6, heightFt: 3.0 },
    description: "Freestanding kitchen prep island with waterfall quartz countertop and storage.",
  },
  {
    type: "refrigerator",
    name: "Double-Door Refrigerator",
    category: "kitchen",
    icon: "🧊",
    dimensions: { widthFt: 2.8, depthFt: 2.5, heightFt: 6.8 },
    description: "Stainless steel double-door smart refrigerator.",
  },

  // Bathroom
  {
    type: "bath_vanity",
    name: "Floating Vanity & Basin",
    category: "bathroom",
    icon: "🪥",
    dimensions: { widthFt: 3.2, depthFt: 1.8, heightFt: 5.5 },
    description: "Wall-mounted timber vanity with porcelain washbasin and backlit LED mirror.",
  },
  {
    type: "toilet_wc",
    name: "Wall-Hung Toilet (WC)",
    category: "bathroom",
    icon: "🚽",
    dimensions: { widthFt: 1.6, depthFt: 2.2, heightFt: 2.4 },
    description: "Concealed cistern wall-hung ceramic WC with soft-close seat.",
  },
  {
    type: "bathtub",
    name: "Freestanding Oval Bathtub",
    category: "bathroom",
    icon: "🛁",
    dimensions: { widthFt: 5.2, depthFt: 2.8, heightFt: 2.0 },
    description: "Luxury freestanding acrylic soaking bathtub with floor-mounted chrome faucet.",
  },

  // Pooja & Decor
  {
    type: "pooja_mandir",
    name: "Sacred Pooja Mandir Temple",
    category: "decor",
    icon: "🛕",
    dimensions: { widthFt: 3.2, depthFt: 2.0, heightFt: 4.8 },
    description: "Carved teakwood pooja mandir shrine with brass kalash and oil diya lamps.",
  },
  {
    type: "wall_art",
    name: "Abstract Canvas Wall Art",
    category: "decor",
    icon: "🖼️",
    dimensions: { widthFt: 4.0, depthFt: 0.15, heightFt: 3.0 },
    description: "Framed contemporary minimalist canvas painting.",
  },
];

/**
 * Procedural 3D Mesh Generator for each Furniture Catalog Type
 */
export function createFurnitureMesh(type: string, customColor?: number): THREE.Group {
  const root = new THREE.Group();

  // Shared reusable materials
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.15 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.55 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.45 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
  const fabricColor = customColor ?? 0x1e3a8a; // Navy / Custom velvet
  const fabricMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.8 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.05 });

  switch (type) {
    case "sofa_3seater": {
      const sofaW = 6.8;
      const sofaD = 3.2;

      // Base & Seat Cushions
      const base = new THREE.Mesh(new THREE.BoxGeometry(sofaW, 0.6, sofaD), fabricMat);
      base.position.y = 0.5;
      base.castShadow = true;
      root.add(base);

      // Seat cushions (3 sections)
      for (let i = 0; i < 3; i++) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(sofaW / 3 - 0.08, 0.45, sofaD - 0.7), fabricMat);
        cushion.position.set(-sofaW / 3 + i * (sofaW / 3), 0.9, 0.25);
        cushion.castShadow = true;
        root.add(cushion);
      }

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(sofaW, 1.8, 0.65), fabricMat);
      back.position.set(0, 1.7, -sofaD / 2 + 0.35);
      back.castShadow = true;
      root.add(back);

      // Armrests (Left & Right)
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.3, sofaD), fabricMat);
        arm.position.set(side * (sofaW / 2 - 0.25), 1.1, 0);
        arm.castShadow = true;
        root.add(arm);
      }

      // 4 Walnut Legs
      for (const lx of [-sofaW / 2 + 0.3, sofaW / 2 - 0.3]) {
        for (const lz of [-sofaD / 2 + 0.3, sofaD / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.5, 12), brassMat);
          leg.position.set(lx, 0.25, lz);
          root.add(leg);
        }
      }
      break;
    }

    case "armchair": {
      const chairW = 2.8;
      const chairD = 2.8;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(chairW, 0.5, chairD - 0.4), fabricMat);
      seat.position.set(0, 0.85, 0.1);
      seat.castShadow = true;
      root.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(chairW, 1.8, 0.45), fabricMat);
      back.position.set(0, 1.6, -chairD / 2 + 0.25);
      back.castShadow = true;
      root.add(back);

      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, chairD), fabricMat);
        arm.position.set(side * (chairW / 2 - 0.15), 1.1, 0);
        arm.castShadow = true;
        root.add(arm);
      }

      for (const lx of [-chairW / 2 + 0.3, chairW / 2 - 0.3]) {
        for (const lz of [-chairD / 2 + 0.3, chairD / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.6, 12), brassMat);
          leg.position.set(lx, 0.3, lz);
          root.add(leg);
        }
      }
      break;
    }

    case "coffee_table": {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 32), marbleMat);
      top.position.y = 1.35;
      top.castShadow = true;
      root.add(top);

      for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 16), brassMat);
        leg.position.set(Math.cos(angle) * 1.4, 0.65, Math.sin(angle) * 1.4);
        root.add(leg);
      }
      break;
    }

    case "tv_unit": {
      const unitW = 6.0;
      const unitD = 1.4;

      // Floating cabinet
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(unitW, 1.2, unitD), walnutMat);
      cabinet.position.set(0, 1.4, 0);
      cabinet.castShadow = true;
      root.add(cabinet);

      // Backlit wall panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(unitW + 0.4, 3.8, 0.1), marbleMat);
      panel.position.set(0, 3.6, -unitD / 2 + 0.05);
      root.add(panel);

      // TV Screen
      const tvMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 });
      const tv = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.7, 0.08), tvMat);
      tv.position.set(0, 3.6, -unitD / 2 + 0.2);
      root.add(tv);
      break;
    }

    case "floor_lamp": {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.15, 24), marbleMat);
      base.position.y = 0.075;
      root.add(base);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.0, 16), brassMat);
      stem.position.y = 2.5;
      root.add(stem);

      const shadeMat = new THREE.MeshStandardMaterial({
        color: 0xfffaed,
        emissive: 0xffe8ba,
        emissiveIntensity: 0.8,
      });
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.9, 24), shadeMat);
      shade.position.y = 4.8;
      root.add(shade);
      break;
    }

    case "plant_pot": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 1.5, 24), ceramicMat);
      pot.position.y = 0.75;
      pot.castShadow = true;
      root.add(pot);

      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16), darkWoodMat);
      soil.position.y = 1.45;
      root.add(soil);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.35 });
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 5), leafMat);
        const angle = (i * 2 * Math.PI) / 7;
        leaf.position.set(Math.cos(angle) * 0.4, 2.4 + (i % 3) * 0.4, Math.sin(angle) * 0.4);
        leaf.rotation.z = Math.cos(angle) * 0.35;
        leaf.rotation.x = Math.sin(angle) * 0.35;
        root.add(leaf);
      }
      break;
    }

    case "floor_rug": {
      const rugW = 7.0;
      const rugD = 5.0;
      const rugMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.95 });
      const rug = new THREE.Mesh(new THREE.BoxGeometry(rugW, 0.03, rugD), rugMat);
      rug.position.y = 0.015;
      root.add(rug);
      break;
    }

    case "bed_king": {
      const bedW = 6.2;
      const bedL = 6.8;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.8, bedL), darkWoodMat);
      frame.position.y = 0.4;
      frame.castShadow = true;
      root.add(frame);

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.2, 0.7, bedL - 0.2), linenMat);
      mattress.position.y = 1.05;
      mattress.castShadow = true;
      root.add(mattress);

      const duvet = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.15, 0.72, bedL * 0.65), fabricMat);
      duvet.position.set(0, 1.07, bedL * 0.15);
      duvet.castShadow = true;
      root.add(duvet);

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.4, 3.8, 0.4), darkWoodMat);
      headboard.position.set(0, 1.9, -bedL / 2 + 0.1);
      headboard.castShadow = true;
      root.add(headboard);

      // Pillows
      for (const px of [-bedW * 0.24, bedW * 0.24]) {
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.38, 0.35, 1.3), linenMat);
        pillow.position.set(px, 1.45, -bedL / 2 + 1.2);
        root.add(pillow);
      }

      // Nightstands
      for (const side of [-1, 1]) {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), darkWoodMat);
        stand.position.set(side * (bedW / 2 + 1.1), 0.7, -bedL / 2 + 0.9);
        stand.castShadow = true;
        root.add(stand);

        const lampShade = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 0.6, 16),
          new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xffe8ba, emissiveIntensity: 0.6 })
        );
        lampShade.position.set(side * (bedW / 2 + 1.1), 1.9, -bedL / 2 + 0.9);
        root.add(lampShade);
      }
      break;
    }

    case "bed_single": {
      const bedW = 3.5;
      const bedL = 6.5;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.8, bedL), darkWoodMat);
      frame.position.y = 0.4;
      frame.castShadow = true;
      root.add(frame);

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.2, 0.7, bedL - 0.2), linenMat);
      mattress.position.y = 1.05;
      root.add(mattress);

      const duvet = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.15, 0.72, bedL * 0.65), fabricMat);
      duvet.position.set(0, 1.07, bedL * 0.15);
      root.add(duvet);

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.2, 3.0, 0.35), darkWoodMat);
      headboard.position.set(0, 1.5, -bedL / 2 + 0.15);
      root.add(headboard);
      break;
    }

    case "wardrobe": {
      const wardW = 5.2;
      const wardD = 2.0;
      const wardH = 7.8;

      const closet = new THREE.Mesh(new THREE.BoxGeometry(wardW, wardH, wardD), walnutMat);
      closet.position.y = wardH / 2;
      closet.castShadow = true;
      root.add(closet);

      for (let i = 0; i < 3; i++) {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.08), brassMat);
        handle.position.set(-wardW / 3 + i * (wardW / 3) + 0.5, 3.8, wardD / 2 + 0.05);
        root.add(handle);
      }
      break;
    }

    case "study_desk": {
      const deskW = 4.2;
      const deskD = 2.2;

      // Tabletop
      const top = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.15, deskD), walnutMat);
      top.position.y = 2.65;
      top.castShadow = true;
      root.add(top);

      // Legs
      for (const lx of [-deskW / 2 + 0.2, deskW / 2 - 0.2]) {
        for (const lz of [-deskD / 2 + 0.2, deskD / 2 - 0.2]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 12), chromeMat);
          leg.position.set(lx, 1.3, lz);
          root.add(leg);
        }
      }

      // Laptop
      const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.8), chromeMat);
      laptopBase.position.set(0, 2.74, 0);
      root.add(laptopBase);

      const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.03), chromeMat);
      laptopScreen.position.set(0, 3.08, -0.38);
      laptopScreen.rotation.x = -0.15;
      root.add(laptopScreen);
      break;
    }

    case "vanity_table": {
      const tableW = 3.4;
      const tableD = 1.6;

      const top = new THREE.Mesh(new THREE.BoxGeometry(tableW, 1.0, tableD), marbleMat);
      top.position.y = 2.5;
      top.castShadow = true;
      root.add(top);

      const mirror = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 32), chromeMat);
      mirror.position.set(0, 4.4, -tableD / 2 + 0.1);
      mirror.rotation.x = Math.PI / 2;
      root.add(mirror);
      break;
    }

    case "dining_6seater": {
      const tableW = 6.0;
      const tableD = 3.4;

      const top = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.2, tableD), darkWoodMat);
      top.position.y = 2.75;
      top.castShadow = true;
      root.add(top);

      for (const lx of [-tableW / 2 + 0.3, tableW / 2 - 0.3]) {
        for (const lz of [-tableD / 2 + 0.3, tableD / 2 - 0.3]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.65, 0.2), darkWoodMat);
          leg.position.set(lx, 1.32, lz);
          root.add(leg);
        }
      }

      // 6 Chairs
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const chairGroup = new THREE.Group();
          const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.4), fabricMat);
          chairSeat.position.y = 1.6;
          chairGroup.add(chairSeat);

          const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), fabricMat);
          chairBack.position.set(0, 2.3, -side * 0.65);
          chairGroup.add(chairBack);

          chairGroup.position.set(-tableW / 3 + i * (tableW / 3), 0, side * (tableD / 2 + 0.85));
          chairGroup.rotation.y = side === 1 ? Math.PI : 0;
          root.add(chairGroup);
        }
      }
      break;
    }

    case "dining_round": {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.15, 32), darkWoodMat);
      table.position.y = 2.75;
      table.castShadow = true;
      root.add(table);

      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.65, 24), darkWoodMat);
      pedestal.position.y = 1.32;
      root.add(pedestal);
      break;
    }

    case "kitchen_island": {
      const islandW = 5.5;
      const islandD = 2.6;

      const base = new THREE.Mesh(new THREE.BoxGeometry(islandW, 2.8, islandD), darkWoodMat);
      base.position.y = 1.4;
      base.castShadow = true;
      root.add(base);

      const top = new THREE.Mesh(new THREE.BoxGeometry(islandW + 0.3, 0.25, islandD + 0.3), marbleMat);
      top.position.y = 2.9;
      top.castShadow = true;
      root.add(top);
      break;
    }

    case "refrigerator": {
      const fridgeW = 2.8;
      const fridgeD = 2.5;
      const fridgeH = 6.8;

      const body = new THREE.Mesh(new THREE.BoxGeometry(fridgeW, fridgeH, fridgeD), chromeMat);
      body.position.y = fridgeH / 2;
      body.castShadow = true;
      root.add(body);
      break;
    }

    case "bath_vanity": {
      const vanW = 3.2;
      const vanD = 1.8;

      const cab = new THREE.Mesh(new THREE.BoxGeometry(vanW, 1.8, vanD), walnutMat);
      cab.position.set(0, 2.1, 0);
      cab.castShadow = true;
      root.add(cab);

      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 0.4, 24), ceramicMat);
      basin.position.set(0, 3.2, 0);
      root.add(basin);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 0.08), chromeMat);
      mirror.position.set(0, 5.0, -vanD / 2 + 0.04);
      root.add(mirror);
      break;
    }

    case "toilet_wc": {
      const wcMat = ceramicMat;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 2.0), wcMat);
      base.position.set(0, 0.65, 0);
      base.castShadow = true;
      root.add(base);

      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.8), wcMat);
      tank.position.set(0, 1.7, -0.6);
      tank.castShadow = true;
      root.add(tank);
      break;
    }

    case "bathtub": {
      const tub = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 2.8), ceramicMat);
      tub.position.y = 0.9;
      tub.castShadow = true;
      root.add(tub);
      break;
    }

    case "pooja_mandir": {
      const mandirW = 3.2;
      const mandirD = 2.0;

      const base = new THREE.Mesh(new THREE.BoxGeometry(mandirW, 1.6, mandirD), darkWoodMat);
      base.position.y = 0.8;
      root.add(base);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(mandirW, 0.3, mandirD), darkWoodMat);
      canopy.position.y = 3.8;
      root.add(canopy);

      for (const px of [-mandirW / 2 + 0.15, mandirW / 2 - 0.15]) {
        for (const pz of [-mandirD / 2 + 0.15, mandirD / 2 - 0.15]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 16), brassMat);
          pillar.position.set(px, 2.7, pz);
          root.add(pillar);
        }
      }

      const dome = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 16), brassMat);
      dome.position.y = 4.4;
      root.add(dome);
      break;
    }

    case "wall_art": {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.0, 0.12), darkWoodMat);
      frame.position.y = 4.5;
      root.add(frame);

      const canvasMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
      const art = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.7, 0.14), canvasMat);
      art.position.y = 4.5;
      root.add(art);
      break;
    }

    default: {
      const placeholder = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), fabricMat);
      placeholder.position.y = 1;
      root.add(placeholder);
    }
  }

  return root;
}
