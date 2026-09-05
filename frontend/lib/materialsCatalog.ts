// Photorealistic Architectural Materials & Finishes Catalog
// High-performance procedural Three.js canvas textures with singleton caching

import * as THREE from "three";
import { RoomName } from "./rooms";
import { WallGlazing } from "./glazing";
import { WallBandScheme } from "./wallBands";

export type FloorCategory = "marble" | "wood" | "tile";
export type WallCategory = "color" | "texture";

export interface FloorMaterialDef {
  id: string;
  name: string;
  category: FloorCategory;
  description: string;
  swatchColor: string;
  roughness: number;
  metalness: number;
}

export interface WallColorDef {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export interface WallTextureDef {
  id: string;
  name: string;
  description: string;
  roughness: number;
}

export interface DesignPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  globalFloor: string;
  globalWallColor: string;
  globalWallTexture: string;
  globalDoorColor?: string;
  roomFloors?: Partial<Record<RoomName, string>>;
  roomWallColors?: Partial<Record<RoomName, string>>;
  roomDoorColors?: Partial<Record<RoomName, string>>;
}

export type GraphicsFidelityTier = "standard" | "high" | "ultra_extreme";

export interface HouseMaterialConfig {
  globalFloor: string;
  globalWallColor: string;
  globalWallTexture: string;
  globalDoorColor?: string;
  roomFloors: Partial<Record<RoomName, string>>;
  roomWallColors: Partial<Record<RoomName, string>>;
  roomWallTextures: Partial<Record<RoomName, string>>;
  roomDoorColors?: Partial<Record<RoomName, string>>;
  // Wall paint bands — see lib/wallBands.ts. A band is a finish laid on the wall face, so it
  // lives here beside the wall colours rather than anywhere near the geometry.
  wallBands?: Record<string, WallBandScheme>;
  roomWallBands?: Partial<Record<RoomName, WallBandScheme>>;
  globalWallBands?: WallBandScheme;
  // Glazed walls and glass doors — see lib/glazing.ts. Same wall/room/building resolution as
  // the paint bands above; a glazed wall changes no geometry, only what the wall is made of.
  wallGlazing?: Record<string, WallGlazing>;
  roomGlazing?: Partial<Record<RoomName, WallGlazing>>;
  globalGlazing?: WallGlazing;
  textureSmoothness?: number; // 0.0 (Matte Textured) to 1.0 (Silky Mirror Polish)
  floorGlossLevel?: number; // 0.0 (Matte) to 1.0 (High-Gloss Mirror Polish)
  wallSmoothness?: number; // 0.0 (Heavy Stucco/Brick Relief) to 1.0 (Smooth Satin/Venetian Silk)
  graphicsFidelityTier?: GraphicsFidelityTier;
  textureResolution?: 1024 | 2048 | 4096;
  anisotropicFiltering?: 4 | 8 | 16;
}

export const DEFAULT_MATERIAL_CONFIG: HouseMaterialConfig = {
  globalFloor: "carrara_white",
  globalWallColor: "arctic_white",
  globalWallTexture: "matte_paint",
  globalDoorColor: "dark_walnut",
  // Reception rooms ship in chevron parquet. This is a DEFAULT, not an override: picking any
  // floor in the Finishes panel clears roomFloors and wins. It used to be enforced at render
  // time inside Scene.tsx, where nothing in the UI could displace it.
  roomFloors: { hall: "french_chevron_oak", dining: "french_chevron_oak" },
  roomWallColors: {},
  roomWallTextures: {},
  roomDoorColors: {},
  textureSmoothness: 0.88,
  floorGlossLevel: 0.92,
  wallSmoothness: 0.88,
  graphicsFidelityTier: "ultra_extreme",
  textureResolution: 4096,
  anisotropicFiltering: 16,
};

// --------------------------------------------------------------------------------------
// Catalog Definitions
// --------------------------------------------------------------------------------------

export const FLOOR_MATERIALS: FloorMaterialDef[] = [
  // Marbles
  {
    id: "carrara_white",
    name: "Italian Carrara White Marble",
    category: "marble",
    description: "Classic pristine white Italian marble with subtle smokey grey quartz veining and high specular sheen.",
    swatchColor: "#eceae5",
    roughness: 0.16,
    metalness: 0.08,
  },
  {
    id: "marquina_black",
    name: "Nero Marquina Black Marble",
    category: "marble",
    description: "Deep Spanish obsidian black marble with striking white crystalline lightning veining.",
    swatchColor: "#1a1916",
    roughness: 0.18,
    metalness: 0.12,
  },
  {
    id: "botticino_gold",
    name: "Royal Botticino Gold Marble",
    category: "marble",
    description: "Warm Italian ivory stone with luminous golden-amber and terracotta mineral plumes.",
    swatchColor: "#fef3c7",
    roughness: 0.18,
    metalness: 0.1,
  },
  {
    id: "oasis_green",
    name: "Verde Oasis Emerald Marble",
    category: "marble",
    description: "Extravagant Indian forest green serpentine marble with light jade crystalline waves.",
    swatchColor: "#064e3b",
    roughness: 0.19,
    metalness: 0.08,
  },
  {
    id: "travertine_beige",
    name: "Classic Roman Travertine",
    category: "marble",
    description: "Honed cream Italian travertine with soft linear sedimentary banding.",
    swatchColor: "#e8d6be",
    roughness: 0.28,
    metalness: 0.04,
  },

  // Hardwoods
  {
    id: "scandinavian_oak",
    name: "Nordic Blonde Oak Planks (Studio Clean)",
    category: "wood",
    description: "Light warm blonde Scandinavian oak floor planks with fine micro-bevel seams and soft satin sheen.",
    swatchColor: "#d8c3a5",
    roughness: 0.28,
    metalness: 0.02,
  },
  {
    id: "french_chevron_oak",
    name: "French Chevron Blonde Oak",
    category: "wood",
    description: "Light golden-blonde Parisian chevron parquet with subtle satin sheen and 45° beveled interlocking points.",
    swatchColor: "#dfc093",
    roughness: 0.28,
    metalness: 0.03,
  },
  {
    id: "walnut_plank",
    name: "American Dark Walnut Planks",
    category: "wood",
    description: "Rich chocolate brown wide-plank hardwood with deep grain texture and satin lacquer.",
    swatchColor: "#593318",
    roughness: 0.38,
    metalness: 0.02,
  },
  {
    id: "natural_oak",
    name: "European Natural Oak",
    category: "wood",
    description: "Warm golden honey timber with natural knots and authentic cathedral grain lines.",
    swatchColor: "#c99b5a",
    roughness: 0.42,
    metalness: 0.02,
  },
  {
    id: "chevron_teak",
    name: "Burma Teak Chevron Parquet",
    category: "wood",
    description: "Iconic diagonal 45° chevron parquet in warm golden-brown Burmese teak.",
    swatchColor: "#935324",
    roughness: 0.35,
    metalness: 0.04,
  },
  {
    id: "scandi_grey_ash",
    name: "Scandinavian Grey Ash",
    category: "wood",
    description: "Light Nordic white-washed grey ash planks for clean, minimalist spaces.",
    swatchColor: "#b8b9ba",
    roughness: 0.45,
    metalness: 0.02,
  },
  {
    id: "herringbone_mahogany",
    name: "Herringbone Royal Mahogany",
    category: "wood",
    description: "Deep reddish-brown interlocking herringbone weave with warm luster.",
    swatchColor: "#662619",
    roughness: 0.32,
    metalness: 0.05,
  },

  // Kitchen, Bath & Balcony Tiles
  {
    id: "terrace_grey_paver",
    name: "Architectural Balcony Stone Pavers",
    category: "tile",
    description: "Large 60x60cm modern light grey square patio tiles with subtle stone grain and dark grout lines.",
    swatchColor: "#9ca3af",
    roughness: 0.48,
    metalness: 0.05,
  },
  {
    id: "blue_mosaic_tile",
    name: "Deep Oceanic Blue Glass Mosaic",
    category: "tile",
    description: "Luminous dark cobalt and navy blue glass mosaic tiles for luxury shower enclosures and vanity wet walls.",
    swatchColor: "#1e3a5f",
    roughness: 0.18,
    metalness: 0.22,
  },
  {
    id: "hex_slate",
    name: "Hexagonal Charcoal Slate Tile",
    category: "tile",
    description: "Modern matte geometric dark tiles with fine cement grout lines.",
    swatchColor: "#1e293b",
    roughness: 0.55,
    metalness: 0.03,
  },
  {
    id: "moroccan_talavera",
    name: "Moroccan Geometric Talavera",
    category: "tile",
    description: "Artisanal Mediterranean star-and-cross encaustic tiles in cobalt blue & ivory.",
    swatchColor: "#1e40af",
    roughness: 0.3,
    metalness: 0.06,
  },
  {
    id: "black_granite",
    name: "Polished Absolute Black Granite",
    category: "tile",
    description: "Ultra-sleek mirror-polished black granite with microscopic silver mineral flecks.",
    swatchColor: "#111827",
    roughness: 0.15,
    metalness: 0.15,
  },
  {
    id: "terrazzo_venice",
    name: "Venetian Terrazzo Mosaic",
    category: "tile",
    description: "Chic cream aggregate base embedded with terracotta, sage, and obsidian marble chips.",
    swatchColor: "#f1ede4",
    roughness: 0.28,
    metalness: 0.05,
  },
  {
    id: "subway_ceramic",
    name: "Glossy Ceramic Subway Tile",
    category: "tile",
    description: "Classic staggered brick-bond glossy ceramic tiles ideal for kitchens and baths.",
    swatchColor: "#d8d4cb",
    roughness: 0.22,
    metalness: 0.06,
  },
  {
    id: "quartzite_calacatta",
    name: "Calacatta Quartzite Kitchen Slab",
    category: "tile",
    description: "Heavy-duty luxury kitchen stone with bold grey and gold dramatic river veins.",
    swatchColor: "#eceae5",
    roughness: 0.17,
    metalness: 0.09,
  },
];

export const WALL_COLORS: WallColorDef[] = [
  { id: "arctic_white", name: "Crisp Arctic White", hex: "#eceae5", description: "Modern, clean, luminous neutral white." },
  { id: "warm_alabaster", name: "Warm Alabaster / Cream", hex: "#f5f0e8", description: "Cozy warm white with gentle golden undertones." },
  { id: "sage_mist", name: "Nordic Sage Green", hex: "#b4c3b5", description: "Relaxing, earthy biophilic muted sage tone." },
  { id: "royal_navy", name: "Deep Royal Navy", hex: "#1e293b", description: "Sophisticated, dramatic dark accent wall color." },
  { id: "charcoal_slate", name: "Modern Charcoal Slate", hex: "#3a372f", description: "Contemporary urban industrial grey." },
  { id: "terracotta", name: "Warm Indian Terracotta", hex: "#b85d38", description: "Rich sun-baked clay tone full of warmth." },
  { id: "champagne_gold", name: "Soft Champagne Gold", hex: "#e4d6c4", description: "Luminous, elegant soft cream with gold tint." },
  { id: "dusty_rose", name: "Pastel Dusty Rose", hex: "#d8b4b8", description: "Subtle, romantic muted rose blush tone." },
];

export const WALL_TEXTURES: WallTextureDef[] = [
  { id: "matte_paint", name: "Smooth Matte Paint", description: "Seamless, velvety flat paint finish.", roughness: 0.85 },
  { id: "boiserie_paneling", name: "Parisian Boiserie Paneling", description: "Classical French picture-frame wall moldings, wainscoting relief, and crown borders.", roughness: 0.55 },
  { id: "venetian_stucco", name: "Venetian Plaster / Stucco", description: "Hand-troweled Italian plaster with subtle light depth.", roughness: 0.65 },
  { id: "wood_slat", name: "Vertical Teak Wood Slats", description: "Modern architectural acoustic slatted wood paneling.", roughness: 0.45 },
  { id: "exposed_brick", name: "Rustic White Brick", description: "Textured loft white-washed exposed brick.", roughness: 0.88 },
  { id: "linen_wallpaper", name: "Natural Woven Linen", description: "Subtle woven textile wallpaper with tactile texture.", roughness: 0.92 },
  { id: "concrete_loft", name: "Industrial Polished Concrete", description: "Sleek architectural concrete with formwork accents.", roughness: 0.72 },
];

export interface DoorColorDef {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const DOOR_COLORS: DoorColorDef[] = [
  { id: "dark_walnut", name: "Rich Dark Walnut", hex: "#2b1e16", description: "Deep classic dark walnut hardwood" },
  { id: "natural_teak", name: "Burmese Golden Teak", hex: "#8c531b", description: "Warm golden-amber natural teak grain" },
  { id: "nordic_oak", name: "Nordic White Oak", hex: "#c29b68", description: "Light modern Scandinavian bleached oak" },
  { id: "pure_white", name: "Architectural Pure White", hex: "#eceae5", description: "Clean minimalist modern satin white" },
  { id: "matte_black", name: "Industrial Matte Black", hex: "#1e293b", description: "Sleek contemporary obsidian black" },
  { id: "mahogany_red", name: "Royal Mahogany", hex: "#4a1515", description: "Lustrous deep reddish-brown mahogany" },
  { id: "sage_green", name: "Modern Sage Green", hex: "#475569", description: "Sophisticated muted earthy green" },
  { id: "navy_blue", name: "Colonial Navy Blue", hex: "#1e3a5f", description: "Regal classic deep navy blue" },
  { id: "rosewood", name: "Brazilian Rosewood", hex: "#3b1c11", description: "Exotic dark purplish-brown rosewood" },
  { id: "charcoal_grey", name: "Urban Charcoal Grey", hex: "#3a372f", description: "Modern architectural slate grey" },
];

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "architectural_studio_cutaway",
    name: "Architectural Studio Cutaway",
    icon: "RAY",
    description: "Nordic Blonde Oak planks, Crisp White Cutaway Plaster walls, Balcony Pavers, and Deep Blue Mosaic bathroom.",
    globalFloor: "scandinavian_oak",
    globalWallColor: "arctic_white",
    globalWallTexture: "matte_paint",
    globalDoorColor: "pure_white",
    roomFloors: {
      hall: "scandinavian_oak",
      dining: "scandinavian_oak",
      kitchen: "scandinavian_oak",
      bedroom: "scandinavian_oak",
      bathroom: "blue_mosaic_tile",
      entrance: "scandinavian_oak",
    },
    roomWallColors: {
      hall: "arctic_white",
      dining: "arctic_white",
      kitchen: "arctic_white",
      bedroom: "arctic_white",
      bathroom: "royal_navy",
    },
  },
  {
    id: "parisian_dollhouse",
    name: "Parisian Haute Dollhouse",
    icon: "CLS",
    description: "French Chevron Blonde Oak, Crisp Boiserie picture frame moldings, Nero Marquina accents, and bright studio sun.",
    globalFloor: "french_chevron_oak",
    globalWallColor: "arctic_white",
    globalWallTexture: "boiserie_paneling",
    roomFloors: {
      hall: "french_chevron_oak",
      kitchen: "marquina_black",
      bedroom: "french_chevron_oak",
      pooja: "botticino_gold",
      bathroom: "marquina_black",
    },
    roomWallColors: {
      hall: "arctic_white",
      bedroom: "warm_alabaster",
      kitchen: "arctic_white",
      pooja: "champagne_gold",
      bathroom: "arctic_white",
    },
  },
  {
    id: "modern_luxury",
    name: "Ultra-Modern Luxury",
    icon: "ULT",
    description: "Carrara White & Nero Marquina marble, Absolute Black Granite kitchen, Walnut bedroom, and Venetian Stucco walls.",
    globalFloor: "carrara_white",
    globalWallColor: "arctic_white",
    globalWallTexture: "venetian_stucco",
    roomFloors: {
      hall: "carrara_white",
      kitchen: "black_granite",
      bedroom: "walnut_plank",
      pooja: "botticino_gold",
      bathroom: "marquina_black",
    },
    roomWallColors: {
      hall: "arctic_white",
      bedroom: "warm_alabaster",
      kitchen: "arctic_white",
      pooja: "champagne_gold",
      bathroom: "royal_navy",
    },
  },
  {
    id: "scandinavian_warmth",
    name: "Scandinavian Warmth",
    icon: "GRN",
    description: "European Natural Oak & Scandi Grey Ash, Subway Tile kitchen, and Nordic Sage Green & Linen walls.",
    globalFloor: "natural_oak",
    globalWallColor: "sage_mist",
    globalWallTexture: "linen_wallpaper",
    roomFloors: {
      hall: "natural_oak",
      kitchen: "subway_ceramic",
      bedroom: "scandi_grey_ash",
      pooja: "natural_oak",
      bathroom: "hex_slate",
    },
    roomWallColors: {
      hall: "warm_alabaster",
      bedroom: "sage_mist",
      kitchen: "warm_alabaster",
      pooja: "warm_alabaster",
      bathroom: "arctic_white",
    },
  },
  {
    id: "royal_indian_classic",
    name: "Royal Indian Classic",
    icon: "CLS",
    description: "Royal Botticino Gold marble, Burma Teak Chevron wood, Warm Terracotta & Champagne Gold walls.",
    globalFloor: "botticino_gold",
    globalWallColor: "warm_alabaster",
    globalWallTexture: "venetian_stucco",
    roomFloors: {
      hall: "botticino_gold",
      kitchen: "black_granite",
      bedroom: "chevron_teak",
      pooja: "botticino_gold",
      bathroom: "terrazzo_venice",
    },
    roomWallColors: {
      hall: "champagne_gold",
      bedroom: "warm_alabaster",
      kitchen: "terracotta",
      pooja: "champagne_gold",
      bathroom: "warm_alabaster",
    },
  },
  {
    id: "industrial_urban_loft",
    name: "Industrial Urban Loft",
    icon: "L2",
    description: "Nero Marquina Black marble, Hexagonal Slate kitchen, Exposed Brick & Charcoal Slate walls.",
    globalFloor: "hex_slate",
    globalWallColor: "charcoal_slate",
    globalWallTexture: "exposed_brick",
    roomFloors: {
      hall: "marquina_black",
      kitchen: "hex_slate",
      bedroom: "walnut_plank",
      pooja: "carrara_white",
      bathroom: "hex_slate",
    },
    roomWallColors: {
      hall: "charcoal_slate",
      bedroom: "royal_navy",
      kitchen: "arctic_white",
      pooja: "warm_alabaster",
      bathroom: "charcoal_slate",
    },
  },
  {
    id: "mediterranean_coastal",
    name: "Mediterranean Coastal",
    icon: "WTR",
    description: "Moroccan Talavera tiles in Kitchen, Travertine Beige hall, Oak bedroom, and Crisp Arctic White walls.",
    globalFloor: "travertine_beige",
    globalWallColor: "arctic_white",
    globalWallTexture: "matte_paint",
    roomFloors: {
      hall: "travertine_beige",
      kitchen: "moroccan_talavera",
      bedroom: "natural_oak",
      pooja: "travertine_beige",
      bathroom: "terrazzo_venice",
    },
    roomWallColors: {
      hall: "arctic_white",
      bedroom: "sage_mist",
      kitchen: "arctic_white",
      pooja: "warm_alabaster",
      bathroom: "royal_navy",
    },
  },
];

// --------------------------------------------------------------------------------------
// Procedural Canvas Texture Generator & Caching Engine (Supports 4K & Anisotropy)
// --------------------------------------------------------------------------------------

const textureCache = new Map<string, THREE.CanvasTexture>();

export function clearTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}

function createAndCacheTexture(
  key: string,
  drawFn: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number] = [2, 2],
  resolution: number = 1024,
  anisotropy: number = 16,
  // Colour maps carry sRGB values and must say so, or the renderer treats the canvas as if it
  // were already linear and every mid-tone comes out too bright. Height and normal data is not
  // colour and stays linear.
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
): THREE.CanvasTexture {
  const cacheKey = `${key}_${resolution}`;
  if (textureCache.has(cacheKey)) {
    const cached = textureCache.get(cacheKey)!;
    cached.anisotropy = anisotropy;
    return cached;
  }

  if (typeof document === "undefined") {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }

  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    drawFn(ctx, resolution);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = anisotropy;
  texture.colorSpace = colorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

export function getEffectiveFloorRoughness(baseRoughness: number, config: HouseMaterialConfig): number {
  const gloss = config.floorGlossLevel ?? 0.92;
  const smooth = config.textureSmoothness ?? 0.88;
  return Math.max(0.03, Math.min(0.95, baseRoughness * (1.15 - gloss * 0.8) * (1.1 - smooth * 0.2)));
}

export function getEffectiveWallRoughness(baseRoughness: number, config: HouseMaterialConfig): number {
  const smooth = config.wallSmoothness ?? 0.88;
  return Math.max(0.08, Math.min(0.95, baseRoughness * (1.25 - smooth * 0.5)));
}

export function getEffectiveWallBumpScale(baseScale: number, config: HouseMaterialConfig): number {
  const smooth = config.wallSmoothness ?? 0.88;
  return Math.max(0.005, baseScale * (1.35 - smooth * 0.9));
}

/**
 * Returns procedural high-res floor canvas texture for the given material ID.
 */
export function getFloorTexture(
  materialId: string,
  resolution: number = 1024,
  anisotropy: number = 16
): THREE.CanvasTexture {
  // Bind the caller's resolution and anisotropy to every case below. Both were declared and
  // then never forwarded, so every texture was built at createAndCacheTexture's own 1024 px
  // default and the graphics Texture Quality control did nothing.
  const cache = (
    key: string,
    drawFn: (ctx: CanvasRenderingContext2D, size: number) => void,
    repeat: [number, number] = [2, 2]
  ) => createAndCacheTexture(key, drawFn, repeat, resolution, anisotropy);

  switch (materialId) {
    case "carrara_white":
      return cache("carrara_white", (ctx, size) => {
        ctx.fillStyle = "#eceae5";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(100, 116, 139, 0.18)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          let x = (i * 65 + 30) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.sin(y * 0.04 + i) + Math.cos(x * 0.03)) * 7;
            y += 18;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // Marble 4x4 ft tile grid
        ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "marquina_black":
      return cache("marquina_black", (ctx, size) => {
        ctx.fillStyle = "#0e0d0b";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          let x = (i * 70 + 40) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.sin(y * 0.05 + i * 2) - Math.cos(y * 0.03)) * 8;
            y += 24;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(58, 55, 47, 0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "botticino_gold":
      return cache("botticino_gold", (ctx, size) => {
        ctx.fillStyle = "#fcf8ee";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(180, 140, 60, 0.25)";
        ctx.lineWidth = 3.5;
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          let x = (i * 60 + 25) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.sin(y * 0.04 + i) + Math.cos(x * 0.03)) * 6;
            y += 18;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(190, 160, 100, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "oasis_green":
      return cache("oasis_green", (ctx, size) => {
        ctx.fillStyle = "#064e3b";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(122, 150, 104, 0.35)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          let x = (i * 80 + 30) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.sin(y * 0.03 + i) * 10);
            y += 20;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(4, 120, 87, 0.5)";
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "travertine_beige":
      return cache("travertine_beige", (ctx, size) => {
        ctx.fillStyle = "#e8d6be";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "rgba(180, 160, 130, 0.25)";
        for (let y = 0; y < size; y += 12) {
          ctx.fillRect(0, y, size, 4);
        }
        ctx.strokeStyle = "rgba(150, 130, 100, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "french_chevron_oak":
      return cache("french_chevron_oak", (ctx, size) => {
        ctx.fillStyle = "#dfc093";
        ctx.fillRect(0, 0, size, size);
        const step = 42;
        // Diagonal 45-degree Parisian chevron planks
        for (let y = -size; y < size * 2; y += step) {
          const isAlt = Math.floor(y / step) % 2 === 0;
          ctx.fillStyle = isAlt ? "#e5cba3" : "#d8b683";
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size / 2, y + size / 2);
          ctx.lineTo(size, y);
          ctx.lineTo(size, y + step);
          ctx.lineTo(size / 2, y + size / 2 + step);
          ctx.lineTo(0, y + step);
          ctx.closePath();
          ctx.fill();

          // Subtle wood grain lines
          ctx.strokeStyle = "rgba(160, 115, 60, 0.25)";
          ctx.lineWidth = 1;
          for (let g = 0; g < 3; g++) {
            ctx.beginPath();
            ctx.moveTo(0, y + g * 12);
            ctx.lineTo(size / 2, y + size / 2 + g * 12);
            ctx.lineTo(size, y + g * 12);
            ctx.stroke();
          }

          // Dark beveled chevron seam lines
          ctx.strokeStyle = "rgba(90, 55, 20, 0.45)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size / 2, y + size / 2);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
        // Center spine line
        ctx.strokeStyle = "rgba(75, 45, 15, 0.55)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(size / 2, 0);
        ctx.lineTo(size / 2, size);
        ctx.stroke();
      }, [3, 3]);

    case "scandinavian_oak":
      return cache("scandinavian_oak", (ctx, size) => {
        ctx.fillStyle = "#d8c3a5";
        ctx.fillRect(0, 0, size, size);
        const plankH = 48;
        const plankW = 192;
        for (let y = 0; y < size; y += plankH) {
          const rowShift = (Math.floor(y / plankH) % 3) * (plankW / 3);
          const tone = (y / plankH) % 2 === 0 ? "#dbc7ab" : "#d3be9f";
          ctx.fillStyle = tone;
          ctx.fillRect(0, y, size, plankH);

          // Subtle wood fiber streaks
          ctx.strokeStyle = "rgba(165, 135, 95, 0.22)";
          ctx.lineWidth = 1.2;
          for (let s = 4; s < plankH; s += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y + s);
            ctx.lineTo(size, y + s + (Math.sin(s) * 2));
            ctx.stroke();
          }

          // Horizontal plank seam
          ctx.strokeStyle = "rgba(110, 85, 55, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();

          // Vertical staggered end seams
          for (let x = -rowShift; x < size + plankW; x += plankW) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + plankH);
            ctx.stroke();
          }
        }
      }, [3, 3]);

    case "terrace_grey_paver":
      return cache("terrace_grey_paver", (ctx, size) => {
        ctx.fillStyle = "#a1a7b0";
        ctx.fillRect(0, 0, size, size);
        const tileSize = 128;
        for (let y = 0; y < size; y += tileSize) {
          for (let x = 0; x < size; x += tileSize) {
            const tileTone = ((x + y) / tileSize) % 2 === 0 ? "#9ca3ac" : "#a8aeb7";
            ctx.fillStyle = tileTone;
            ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

            // Fine speckled stone texture
            ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
            for (let dot = 0; dot < 30; dot++) {
              const rx = x + 4 + (Math.sin(dot * 7.3) * 0.5 + 0.5) * (tileSize - 8);
              const ry = y + 4 + (Math.cos(dot * 5.1) * 0.5 + 0.5) * (tileSize - 8);
              ctx.fillRect(rx, ry, 2, 2);
            }
          }
        }
        // Grout grid
        ctx.strokeStyle = "rgba(55, 60, 68, 0.75)";
        ctx.lineWidth = 2.5;
        for (let p = 0; p <= size; p += tileSize) {
          ctx.beginPath();
          ctx.moveTo(0, p);
          ctx.lineTo(size, p);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, size);
          ctx.stroke();
        }
      }, [2, 2]);

    case "blue_mosaic_tile":
      return cache("blue_mosaic_tile", (ctx, size) => {
        ctx.fillStyle = "#0c1e36";
        ctx.fillRect(0, 0, size, size);
        const mosSize = 24;
        const blues = ["#12365e", "#1b497d", "#154273", "#0f2f54", "#235b9b", "#1a4677"];
        for (let y = 0; y < size; y += mosSize) {
          for (let x = 0; x < size; x += mosSize) {
            const pick = Math.floor(Math.abs(Math.sin(x * 12.3 + y * 7.1)) * blues.length) % blues.length;
            ctx.fillStyle = blues[pick];
            ctx.fillRect(x + 1.5, y + 1.5, mosSize - 3, mosSize - 3);

            // Glass specular highlight
            ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
            ctx.fillRect(x + 2, y + 2, (mosSize - 3) * 0.45, (mosSize - 3) * 0.45);
          }
        }
        // Dark grout grid
        ctx.strokeStyle = "rgba(5, 12, 24, 0.85)";
        ctx.lineWidth = 2;
        for (let p = 0; p <= size; p += mosSize) {
          ctx.beginPath();
          ctx.moveTo(0, p);
          ctx.lineTo(size, p);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, size);
          ctx.stroke();
        }
      }, [4, 4]);

    case "walnut_plank":
      return cache("walnut_plank", (ctx, size) => {
        ctx.fillStyle = "#593318";
        ctx.fillRect(0, 0, size, size);
        const plankH = 64;
        for (let y = 0; y < size; y += plankH) {
          const tone = (y / plankH) % 2 === 0 ? "#4a2810" : "#5d371b";
          ctx.fillStyle = tone;
          ctx.fillRect(0, y, size, plankH);
          ctx.strokeStyle = "rgba(35, 18, 8, 0.65)";
          ctx.lineWidth = 2;
          ctx.strokeRect(0, y, size, plankH);
        }
      }, [3, 3]);

    case "natural_oak":
      return cache("natural_oak", (ctx, size) => {
        ctx.fillStyle = "#c99b5a";
        ctx.fillRect(0, 0, size, size);
        const plankH = 56;
        for (let y = 0; y < size; y += plankH) {
          const tone = (y / plankH) % 2 === 0 ? "#bd8f4e" : "#d1a362";
          ctx.fillStyle = tone;
          ctx.fillRect(0, y, size, plankH);
          ctx.strokeStyle = "rgba(120, 80, 30, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(0, y, size, plankH);
        }
      }, [3, 3]);

    case "chevron_teak":
      return cache("chevron_teak", (ctx, size) => {
        ctx.fillStyle = "#935324";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(60, 30, 10, 0.5)";
        ctx.lineWidth = 2.5;
        const step = 48;
        for (let y = -size; y < size * 2; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size / 2, y + size / 2);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
      }, [2, 2]);

    case "scandi_grey_ash":
      return cache("scandi_grey_ash", (ctx, size) => {
        ctx.fillStyle = "#b8b9ba";
        ctx.fillRect(0, 0, size, size);
        const plankH = 56;
        for (let y = 0; y < size; y += plankH) {
          const tone = (y / plankH) % 2 === 0 ? "#b0b1b2" : "#c0c1c2";
          ctx.fillStyle = tone;
          ctx.fillRect(0, y, size, plankH);
          ctx.strokeStyle = "rgba(80, 80, 85, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(0, y, size, plankH);
        }
      }, [3, 3]);

    case "herringbone_mahogany":
      return cache("herringbone_mahogany", (ctx, size) => {
        ctx.fillStyle = "#662619";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(40, 12, 6, 0.6)";
        ctx.lineWidth = 2.5;
        const step = 40;
        for (let y = -size; y < size * 2; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size / 2, y + size / 2);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
      }, [3, 3]);

    case "hex_slate":
      return cache("hex_slate", (ctx, size) => {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2;
        const r = 32;
        const h = r * Math.sqrt(3);
        for (let y = 0; y < size + h; y += h) {
          for (let x = 0; x < size + r * 3; x += r * 3) {
            ctx.beginPath();
            for (let a = 0; a < 6; a++) {
              const angle = (a * Math.PI) / 3;
              const px = x + r * Math.cos(angle);
              const py = y + r * Math.sin(angle);
              if (a === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      }, [3, 3]);

    case "moroccan_talavera":
      return cache("moroccan_talavera", (ctx, size) => {
        ctx.fillStyle = "#eceae5";
        ctx.fillRect(0, 0, size, size);
        const tileSize = 128;
        for (let y = 0; y < size; y += tileSize) {
          for (let x = 0; x < size; x += tileSize) {
            ctx.fillStyle = "#1e40af";
            ctx.fillRect(x + 12, y + 12, tileSize - 24, tileSize - 24);
            ctx.fillStyle = "#d4703a";
            ctx.beginPath();
            ctx.arc(x + tileSize / 2, y + tileSize / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#1a1916";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, tileSize, tileSize);
          }
        }
      }, [3, 3]);

    case "black_granite":
      return cache("black_granite", (ctx, size) => {
        ctx.fillStyle = "#1a1916";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        for (let i = 0; i < 400; i++) {
          const px = Math.random() * size;
          const py = Math.random() * size;
          ctx.fillRect(px, py, 2, 2);
        }
        ctx.strokeStyle = "rgba(58, 55, 47, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "terrazzo_venice":
      return cache("terrazzo_venice", (ctx, size) => {
        ctx.fillStyle = "#f1ede4";
        ctx.fillRect(0, 0, size, size);
        const colors = ["#c2593f", "#4b7a5a", "#1e293b", "#8a4318", "#78716c"];
        for (let i = 0; i < 350; i++) {
          ctx.fillStyle = colors[i % colors.length];
          const px = Math.random() * size;
          const py = Math.random() * size;
          const s = Math.random() * 8 + 3;
          ctx.fillRect(px, py, s, s);
        }
        ctx.strokeStyle = "rgba(168, 162, 158, 0.4)";
        ctx.strokeRect(0, 0, size / 2, size / 2);
        ctx.strokeRect(size / 2, 0, size / 2, size / 2);
        ctx.strokeRect(0, size / 2, size / 2, size / 2);
        ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
      }, [2, 2]);

    case "subway_ceramic":
      return cache("subway_ceramic", (ctx, size) => {
        ctx.fillStyle = "#eceae5";
        ctx.fillRect(0, 0, size, size);
        const tileW = 128;
        const tileH = 64;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
        ctx.lineWidth = 3;
        for (let y = 0; y < size; y += tileH) {
          const shift = (y / tileH) % 2 === 0 ? 0 : tileW / 2;
          for (let x = -tileW; x < size + tileW; x += tileW) {
            ctx.strokeRect(x + shift, y, tileW, tileH);
          }
        }
      }, [3, 3]);

    case "quartzite_calacatta":
      return cache("quartzite_calacatta", (ctx, size) => {
        ctx.fillStyle = "#eceae5";
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
        ctx.lineWidth = 5;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          let x = (i * 90 + 20) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.sin(y * 0.03 + i) * 12);
            y += 24;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(138, 67, 24, 0.25)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          let x = (i * 120 + 60) % size;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < size) {
            x += (Math.cos(y * 0.04 + i) * 8);
            y += 20;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }, [2, 2]);

    default:
      return getFloorTexture("carrara_white");
  }
}

/**
 * Returns procedural bump map texture for wall architectural finishes.
 */
export function getWallTextureBumpMap(
  textureId: string,
  resolution: number = 1024,
  anisotropy: number = 16
): THREE.CanvasTexture | null {
  if (textureId === "matte_paint") return null;

  return createAndCacheTexture(
    `wall_bump_${textureId}`,
    (ctx, size) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);

    if (textureId === "boiserie_paneling") {
      // Classical French Boiserie Moldings (double-framed picture panel relief + chair rail)
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, 0, size, size);

      // Chair rail line
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.lineTo(size, size * 0.35);
      ctx.stroke();
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35 + 4);
      ctx.lineTo(size, size * 0.35 + 4);
      ctx.stroke();

      // Upper Tall Panels (2 columns)
      const pW = size * 0.42;
      const topY = 24;
      const topH = size * 0.28;
      [size * 0.05, size * 0.53].forEach((px) => {
        // Outer frame
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(px, topY, pW, topH);
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, topY + 2, pW - 4, topH - 4);
        // Inner inset bead
        ctx.strokeStyle = "#dddddd";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 10, topY + 10, pW - 20, topH - 20);
      });

      // Lower Wainscoting Panels (2 columns)
      const btmY = size * 0.42;
      const btmH = size * 0.52;
      [size * 0.05, size * 0.53].forEach((px) => {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(px, btmY, pW, btmH);
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, btmY + 2, pW - 4, btmH - 4);
        ctx.strokeStyle = "#dddddd";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 12, btmY + 12, pW - 24, btmH - 24);
      });
    } else if (textureId === "venetian_stucco") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = Math.random() * 60 + 20;
        const h = Math.random() * 30 + 10;
        ctx.fillRect(x, y, w, h);
      }
    } else if (textureId === "wood_slat") {
      const slatW = 24;
      for (let x = 0; x < size; x += slatW) {
        ctx.fillStyle = (x / slatW) % 2 === 0 ? "#ffffff" : "#333333";
        ctx.fillRect(x, 0, slatW, size);
      }
    } else if (textureId === "exposed_brick") {
      const bW = 80;
      const bH = 36;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 4;
      for (let y = 0; y < size; y += bH) {
        const shift = (y / bH) % 2 === 0 ? 0 : bW / 2;
        for (let x = -bW; x < size + bW; x += bW) {
          ctx.strokeRect(x + shift, y, bW, bH);
        }
      }
    } else if (textureId === "linen_wallpaper") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 2);
      for (let x = 0; x < size; x += 4) ctx.fillRect(x, 0, 2, size);
    } else if (textureId === "concrete_loft") {
      ctx.fillStyle = "rgba(40, 40, 40, 0.25)";
      for (let i = 0; i < 300; i++) {
        ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
      }
      ctx.strokeStyle = "rgba(20, 20, 20, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, size / 2, size);
      ctx.strokeRect(size / 2, 0, size / 2, size);
    }
  }, [4, 4], resolution, anisotropy, THREE.NoColorSpace);
}

// --------------------------------------------------------------------------------------
// Derived Normal & Roughness Maps
// --------------------------------------------------------------------------------------
// Every finish above is drawn as a single colour canvas, and for walls a second height canvas.
// A colour map on its own gives a surface one uniform response to light: the veins in the
// marble and the grout between the tiles read as stripes painted on glass, because nothing
// tells the shader that the surface itself changes. Rather than hand-author a second and third
// canvas per finish - 30-odd more draw functions to keep in step with the first set - these
// derive the missing maps from the canvases that already exist. A new finish gets them by
// being drawn once.

const derivedCache = new Map<string, THREE.CanvasTexture>();

// Derivation runs on the CPU, one pass per pixel, so it is capped well below the colour map's
// resolution. Relief and roughness are low-frequency next to albedo; the 4K setting exists for
// the veining, which lives in the colour map and is untouched by this.
const DERIVED_SIZE = 512;

/** How much rougher a seam is allowed to be than the polished face around it. */
export const ROUGHNESS_MAP_HEADROOM = 1.6;

export function clearDerivedMapCache(): void {
  derivedCache.forEach((tex) => tex.dispose());
  derivedCache.clear();
}

function sampleSource(source: THREE.CanvasTexture): ImageData | null {
  const image = source.image as HTMLCanvasElement | undefined;
  if (typeof document === "undefined" || !image || !image.width) return null;

  const scratch = document.createElement("canvas");
  scratch.width = DERIVED_SIZE;
  scratch.height = DERIVED_SIZE;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, DERIVED_SIZE, DERIVED_SIZE);
  return ctx.getImageData(0, 0, DERIVED_SIZE, DERIVED_SIZE);
}

function finishDerived(
  key: string,
  canvas: HTMLCanvasElement,
  source: THREE.CanvasTexture,
  anisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.repeat.copy(source.repeat);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.NoColorSpace;
  derivedCache.set(key, tex);
  return tex;
}

function luminanceField(src: ImageData): Float32Array {
  const out = new Float32Array(DERIVED_SIZE * DERIVED_SIZE);
  for (let i = 0; i < out.length; i++) {
    out[i] =
      (0.2126 * src.data[i * 4] + 0.7152 * src.data[i * 4 + 1] + 0.0722 * src.data[i * 4 + 2]) / 255;
  }
  return out;
}

/**
 * Sobel over the source's luminance, treated as a height field. Sampling wraps at the edges so
 * the tiling seam stays invisible.
 */
function deriveNormalMap(
  key: string,
  source: THREE.CanvasTexture | null,
  strength: number,
  anisotropy: number
): THREE.CanvasTexture | null {
  if (!source) return null;
  const cacheKey = "normal_" + key;
  const hit = derivedCache.get(cacheKey);
  if (hit) {
    hit.anisotropy = anisotropy;
    return hit;
  }

  const src = sampleSource(source);
  if (!src) return null;

  const n = DERIVED_SIZE;
  const height = luminanceField(src);

  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const out = ctx.createImageData(n, n);

  const at = (x: number, y: number) => height[((y + n) % n) * n + ((x + n) % n)];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));

      const nx = -dx * strength;
      const ny = -dy * strength;
      const len = Math.hypot(nx, ny, 1) || 1;

      const i = (y * n + x) * 4;
      out.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return finishDerived(cacheKey, canvas, source, anisotropy);
}

/**
 * Grout, seams and the gaps between planks sit darker than the surface they interrupt, and they
 * are also the parts that never take a polish. Mapping darkness to roughness turns that one
 * observation into the difference between a printed floor and a laid one.
 */
function deriveRoughnessMap(
  key: string,
  source: THREE.CanvasTexture | null,
  anisotropy: number
): THREE.CanvasTexture | null {
  if (!source) return null;
  const cacheKey = "rough_" + key;
  const hit = derivedCache.get(cacheKey);
  if (hit) {
    hit.anisotropy = anisotropy;
    return hit;
  }

  const src = sampleSource(source);
  if (!src) return null;

  const n = DERIVED_SIZE;
  const lum = luminanceField(src);

  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const out = ctx.createImageData(n, n);

  const floorValue = 1 / ROUGHNESS_MAP_HEADROOM;
  for (let i = 0; i < n * n; i++) {
    // The map multiplies the material's scalar roughness, so it can only ever reduce it. The
    // scalar is raised by ROUGHNESS_MAP_HEADROOM at the call site to make room: a bright,
    // polished pixel lands back on the roughness the finish asked for, and a dark seam keeps
    // the raised one.
    const v = 1 - (1 - floorValue) * lum[i];
    const b = Math.round(Math.max(0, Math.min(1, v)) * 255);
    const o = i * 4;
    out.data[o] = b;
    out.data[o + 1] = b;
    out.data[o + 2] = b;
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return finishDerived(cacheKey, canvas, source, anisotropy);
}

/** Surface relief for a floor finish, derived from its colour map. */
export function getFloorNormalMap(
  materialId: string,
  resolution: number = 1024,
  anisotropy: number = 16
): THREE.CanvasTexture | null {
  // Colour stands in for height here, it does not measure it, so the gain stays low - enough to
  // catch the light along a vein or a plank edge, not enough to emboss the pattern.
  return deriveNormalMap(materialId, getFloorTexture(materialId, resolution, anisotropy), 1.6, anisotropy);
}

/** Per-pixel roughness for a floor finish, derived from its colour map. */
export function getFloorRoughnessMap(
  materialId: string,
  resolution: number = 1024,
  anisotropy: number = 16
): THREE.CanvasTexture | null {
  return deriveRoughnessMap(materialId, getFloorTexture(materialId, resolution, anisotropy), anisotropy);
}

/**
 * Surface relief for a wall finish. Unlike the floors this comes off a real height canvas - the
 * one that used to drive `bumpMap` - so the gain can be far higher.
 */
export function getWallNormalMap(
  textureId: string,
  resolution: number = 1024,
  anisotropy: number = 16
): THREE.CanvasTexture | null {
  return deriveNormalMap(
    "wall_" + textureId,
    getWallTextureBumpMap(textureId, resolution, anisotropy),
    3.2,
    anisotropy
  );
}

/**
 * Returns the effective floor material definition for a specific room.
 */
export function getRoomFloorMaterial(roomName: RoomName, config: HouseMaterialConfig): FloorMaterialDef {
  const customId = config.roomFloors[roomName] || config.globalFloor;
  return FLOOR_MATERIALS.find((m) => m.id === customId) || FLOOR_MATERIALS[0];
}

/**
 * Resolves a wall color ID or custom hex string to a valid 6-digit hex string like "#eceae5".
 */
export function getWallColorHexStr(colorId: string): string {
  if (!colorId) return "#eceae5";
  if (colorId.startsWith("#")) {
    return colorId;
  }
  if (/^[0-9a-fA-F]{6}$/.test(colorId)) {
    return `#${colorId}`;
  }
  const def = WALL_COLORS.find((c) => c.id === colorId);
  return def ? def.hex : "#eceae5";
}

/**
 * Returns the effective wall color hex for a specific room.
 */
export function getRoomWallColorHex(roomName: RoomName, config: HouseMaterialConfig): number {
  const colorId = config.roomWallColors[roomName] || config.globalWallColor;
  const hexStr = getWallColorHexStr(colorId);
  const parsed = parseInt(hexStr.replace("#", "0x"), 16);
  return isNaN(parsed) ? 0xf8fafc : parsed;
}

/**
 * Returns the effective wall texture ID for a specific room.
 */
export function getRoomWallTextureId(roomName: RoomName, config: HouseMaterialConfig): string {
  return config.roomWallTextures[roomName] || config.globalWallTexture;
}

/**
 * Resolves a door color ID or custom hex string to a valid 6-digit hex string like "#2b1e16".
 */
export function getDoorColorHexStr(colorId?: string): string {
  if (!colorId) return "#2b1e16";
  if (colorId.startsWith("#")) {
    return colorId;
  }
  if (/^[0-9a-fA-F]{6}$/.test(colorId)) {
    return `#${colorId}`;
  }
  const def = DOOR_COLORS.find((c) => c.id === colorId);
  return def ? def.hex : "#2b1e16";
}

/**
 * Returns the effective door color hex for a specific room.
 */
export function getRoomDoorColorHex(roomName: RoomName, config: HouseMaterialConfig): number {
  const colorId = config.roomDoorColors?.[roomName] || config.globalDoorColor;
  const hexStr = getDoorColorHexStr(colorId);
  const parsed = parseInt(hexStr.replace("#", "0x"), 16);
  return isNaN(parsed) ? 0x2b1e16 : parsed;
}

/**
 * General helper to resolve door color ID or hex string to a hex string.
 */
export function resolveDoorColorHex(colorIdOrHex?: string): string {
  return getDoorColorHexStr(colorIdOrHex);
}
