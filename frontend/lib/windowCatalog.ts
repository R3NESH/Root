// Comprehensive Window Styles, Shapes, Frame Finishes, and Glass Glazing Catalog
// Supports 3D procedural geometries for Modern Sliders, Roman Arches, French Grids, Panoramic Picture, Bay Windows, Clerestories, and Portholes.

import * as THREE from "three";
import { RoomName } from "./rooms";

export type WindowShapeId =
  | "modern_slider"
  | "roman_arch"
  | "french_grid"
  | "picture_panoramic"
  | "bay_window"
  | "clerestory_slit"
  | "circle_porthole"
  | "corner_glass";

export type WindowFrameFinishId =
  | "black_aluminum"
  | "warm_oak"
  | "brushed_bronze"
  | "white_upvc"
  | "gunmetal_steel"
  | "gold_brass";

export type WindowGlassTintId =
  | "clear"
  | "sky_blue"
  | "frosted"
  | "bronze_solar"
  | "charcoal_tint";

export interface WindowShapeDef {
  id: WindowShapeId;
  name: string;
  category: "modern" | "classical" | "luxury" | "accent";
  icon: string;
  tag: string;
  description: string;
  aspectRatio: string;
  recommendedFor: string;
}

export interface WindowFrameFinishDef {
  id: WindowFrameFinishId;
  name: string;
  colorHex: number;
  swatch: string;
  roughness: number;
  metalness: number;
  description: string;
}

export interface WindowGlassTintDef {
  id: WindowGlassTintId;
  name: string;
  colorHex: number;
  swatch: string;
  opacity: number;
  roughness: number;
  metalness: number;
  description: string;
}

export interface WindowConfig {
  globalShape: WindowShapeId;
  globalFrameFinish: WindowFrameFinishId;
  globalGlassTint: WindowGlassTintId;
  roomWindowShapes: Partial<Record<RoomName, WindowShapeId>>;
  hasCurtains: boolean;
  hasWindowGrille: boolean;
}

export const WINDOW_SHAPES: WindowShapeDef[] = [
  {
    id: "modern_slider",
    name: "Modern Sliding Window",
    category: "modern",
    icon: "🪟",
    tag: "Most Popular",
    description: "Sleek dual-panel horizontal sliding window with slim central mullions and extended bottom sill.",
    aspectRatio: "Wide (4:3)",
    recommendedFor: "Living Hall, Bedrooms, Kitchen",
  },
  {
    id: "roman_arch",
    name: "Palladian Roman Arch",
    category: "classical",
    icon: "🏛️",
    tag: "Classical Luxe",
    description: "Grand architectural semi-circular arched top with sunburst radiating glazing spokes.",
    aspectRatio: "Tall Arched (1:2)",
    recommendedFor: "Living Hall, Master Bedroom, Foyer",
  },
  {
    id: "french_grid",
    name: "French Colonial Grid",
    category: "classical",
    icon: "🔲",
    tag: "Timeless Tudor",
    description: "Classic 6-pane / 8-pane multi-pane lattice mullions for heritage and cottage charm.",
    aspectRatio: "Square / Tall (1:1)",
    recommendedFor: "Dining, Living Hall, Bedrooms",
  },
  {
    id: "picture_panoramic",
    name: "Panoramic Picture Glass",
    category: "luxury",
    icon: "🖼️",
    tag: "Ultra Minimal",
    description: "Floor-to-ceiling ultra-minimalist single pane glass maximizing natural daylight and garden views.",
    aspectRatio: "Expansive (16:9)",
    recommendedFor: "Living Hall, Dining Room",
  },
  {
    id: "bay_window",
    name: "Faceted Bay Window",
    category: "luxury",
    icon: "🛋️",
    tag: "With Cozy Bench",
    description: "Projecting 3-panel faceted bay window extending outward with a warm interior reading bench.",
    aspectRatio: "Projecting 3D",
    recommendedFor: "Master Bedroom, Living Hall",
  },
  {
    id: "clerestory_slit",
    name: "Clerestory Privacy Slit",
    category: "modern",
    icon: "➖",
    tag: "Contemporary",
    description: "High horizontal ribbon window providing private, glare-free diffused ceiling illumination.",
    aspectRatio: "Slit (5:1)",
    recommendedFor: "Bathrooms, Kitchen, Walk-in Closets",
  },
  {
    id: "circle_porthole",
    name: "Round Porthole Accent",
    category: "accent",
    icon: "🔘",
    tag: "Architectural Accent",
    description: "Circular round focal window with crosshair framing for a modern nautical or zen look.",
    aspectRatio: "Circular (1:1)",
    recommendedFor: "Pooja Room, Staircase, Foyer",
  },
  {
    id: "corner_glass",
    name: "Contemporary Corner Glass",
    category: "modern",
    icon: "📐",
    tag: "Modernist",
    description: "Seamless wrap-around dual-pane corner window eliminating the heavy corner column.",
    aspectRatio: "L-Shaped",
    recommendedFor: "Master Bedroom, Living Room",
  },
];

export const WINDOW_FRAME_FINISHES: WindowFrameFinishDef[] = [
  {
    id: "black_aluminum",
    name: "Matte Black Aluminum",
    colorHex: 0x18181b,
    swatch: "#18181b",
    roughness: 0.35,
    metalness: 0.25,
    description: "Architectural matte powder-coated black aluminum.",
  },
  {
    id: "warm_oak",
    name: "Warm Natural Oak",
    colorHex: 0x854d0e,
    swatch: "#854d0e",
    roughness: 0.65,
    metalness: 0.05,
    description: "Rich natural solid oak timber with organic grain.",
  },
  {
    id: "brushed_bronze",
    name: "Antique Brushed Bronze",
    colorHex: 0x78350f,
    swatch: "#78350f",
    roughness: 0.3,
    metalness: 0.85,
    description: "Warm metallic antique bronze with subtle reflections.",
  },
  {
    id: "white_upvc",
    name: "Crisp White UPVC",
    colorHex: 0xf8fafc,
    swatch: "#f8fafc",
    roughness: 0.45,
    metalness: 0.05,
    description: "Clean modern thermal-insulated white UPVC profile.",
  },
  {
    id: "gunmetal_steel",
    name: "Gunmetal Industrial Steel",
    colorHex: 0x334155,
    swatch: "#334155",
    roughness: 0.25,
    metalness: 0.9,
    description: "Loft-style industrial steel profile with dark graphite sheen.",
  },
  {
    id: "gold_brass",
    name: "Luxe Brushed Brass",
    colorHex: 0xd4af37,
    swatch: "#d4af37",
    roughness: 0.2,
    metalness: 0.92,
    description: "Opulent satin brushed gold brass for luxury interiors.",
  },
];

export const WINDOW_GLASS_TINTS: WindowGlassTintDef[] = [
  {
    id: "clear",
    name: "Crystal Clear Low-E",
    colorHex: 0x93c5fd,
    swatch: "#93c5fd",
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.15,
    description: "Ultra-clear high-transmittance architectural Low-E glass.",
  },
  {
    id: "sky_blue",
    name: "Azure Sky Tint",
    colorHex: 0x38bdf8,
    swatch: "#38bdf8",
    opacity: 0.45,
    roughness: 0.12,
    metalness: 0.2,
    description: "Subtle daylight blue tint filtering harsh solar glare.",
  },
  {
    id: "frosted",
    name: "Privacy Satin Frosted",
    colorHex: 0xe2e8f0,
    swatch: "#e2e8f0",
    opacity: 0.72,
    roughness: 0.65,
    metalness: 0.05,
    description: "Acid-etched translucent frosted glass for total privacy.",
  },
  {
    id: "bronze_solar",
    name: "Solar Bronze Glazing",
    colorHex: 0x92400e,
    swatch: "#92400e",
    opacity: 0.5,
    roughness: 0.15,
    metalness: 0.35,
    description: "Warm amber-bronze solar reflective tint.",
  },
  {
    id: "charcoal_tint",
    name: "Smoke Charcoal Tint",
    colorHex: 0x1e293b,
    swatch: "#1e293b",
    opacity: 0.55,
    roughness: 0.18,
    metalness: 0.4,
    description: "Modern high-contrast dark smoke tinted glass.",
  },
];

export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  globalShape: "modern_slider",
  globalFrameFinish: "black_aluminum",
  globalGlassTint: "clear",
  roomWindowShapes: {
    hall: "modern_slider",
    bedroom: "modern_slider",
    kitchen: "modern_slider",
    pooja: "circle_porthole",
    dining: "french_grid",
    bathroom: "clerestory_slit",
  },
  hasCurtains: true,
  hasWindowGrille: false,
};

export function getRoomWindowShape(
  roomName: RoomName | undefined,
  config: WindowConfig = DEFAULT_WINDOW_CONFIG
): WindowShapeId {
  if (roomName && config.roomWindowShapes[roomName]) {
    return config.roomWindowShapes[roomName]!;
  }
  return config.globalShape;
}

export function getWindowFrameMaterial(
  finishId: WindowFrameFinishId = "black_aluminum"
): THREE.MeshStandardMaterial {
  const def = WINDOW_FRAME_FINISHES.find((f) => f.id === finishId) || WINDOW_FRAME_FINISHES[0];
  return new THREE.MeshStandardMaterial({
    color: def.colorHex,
    roughness: def.roughness,
    metalness: def.metalness,
  });
}

export function getWindowGlassMaterial(
  tintId: WindowGlassTintId = "clear",
  isBathroom: boolean = false
): THREE.MeshStandardMaterial {
  const def = WINDOW_GLASS_TINTS.find((t) => t.id === tintId) || WINDOW_GLASS_TINTS[0];
  return new THREE.MeshStandardMaterial({
    color: def.colorHex,
    transparent: true,
    opacity: isBathroom ? Math.max(0.68, def.opacity) : def.opacity,
    roughness: isBathroom ? Math.max(0.6, def.roughness) : def.roughness,
    metalness: def.metalness,
  });
}
