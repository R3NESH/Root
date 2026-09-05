import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AIFurnitureParametricDef, createAIFurnitureMesh } from "./aiFurnitureEngine";

function createRoundedBox(
  w: number,
  h: number,
  d: number,
  radius: number = 0.05,
  segments: number = 4
): THREE.BufferGeometry {
  const minDim = Math.min(w, h, d);
  const safeRadius = Math.max(0.003, Math.min(radius, minDim / 2 - 0.002));
  return new RoundedBoxGeometry(w, h, d, segments, safeRadius);
}

export type FurnitureCategory =
  // residence
  | "living"| "bedroom"| "dining"| "kitchen"| "office"| "decor"| "sacred"// shared
  | "walls"// cafe. Split by where the piece lives in the service flow rather than lumped under one
  // "cafe" heading, so the left rail can offer a fit-out toolset instead of a bin.
  | "cafe_seating"| "cafe_service"| "cafe_decor"| "cafe_signage"| "cafe_boh"| "cafe_outdoor";

export interface FurnitureItemDef {
  type: string;
  name: string;
  category: FurnitureCategory;
  icon: string;
  dimensions: { widthFt: number; depthFt: number; heightFt: number };
  description: string;
  defaultColor?: number;
  glbUrl?: string;
  /**
   * Short label for the ribbon, where `name` is far too long to fit. The ribbon button has no
   * truncation and no max-width, so a full catalog name blows the row out sideways. Same idea as
   * `tag` on OpeningItemDef. Items without one fall back to `name`.
   */
  ribbonTag?: string;
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
  aiParametricDef?: AIFurnitureParametricDef;
  glbUrl?: string;
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
    icon: "SOF",
    dimensions: { widthFt: 7.0, depthFt: 3.2, heightFt: 2.8 },
    description: "Classic straight 3-seater sofa with deep cushions, padded armrests, and brass-tipped tapered legs.",
    defaultColor: 0x1e3a8a,
  },
  {
    type: "sofa_l_shape",
    name: "L-Shaped Sectional Corner Sofa",
    category: "living",
    icon: "SOF",
    dimensions: { widthFt: 8.5, depthFt: 6.5, heightFt: 2.8 },
    description: "Spacious modular L-shaped corner sectional with extended chaise lounge for luxury living rooms.",
    defaultColor: 0x1e293b,
  },
  {
    type: "sofa_curved",
    name: "Curved Crescent Lounge Sofa",
    category: "living",
    icon: "SOF",
    dimensions: { widthFt: 7.8, depthFt: 4.2, heightFt: 2.7 },
    description: "Ultra-modern organic curved crescent sofa with rounded bouclé upholstery.",
    defaultColor: 0xf3f4f6,
  },
  {
    type: "sofa_loveseat",
    name: "Compact 2-Seater Loveseat",
    category: "living",
    icon: "SOF",
    dimensions: { widthFt: 5.0, depthFt: 3.0, heightFt: 2.8 },
    description: "Cozy 2-seater apartment loveseat with tailored piping and walnut legs.",
    defaultColor: 0x065f46,
  },
  {
    type: "armchair",
    name: "Modern Accent Armchair",
    category: "living",
    icon: "CHR",
    dimensions: { widthFt: 2.8, depthFt: 2.8, heightFt: 2.7 },
    description: "Plush single-seater accent armchair with ergonomic curved backrest.",
    defaultColor: 0xb45309,
  },
  {
    type: "recliner_chair",
    name: "Leather Ergonomic Recliner",
    category: "living",
    icon: "CHR",
    dimensions: { widthFt: 3.2, depthFt: 3.4, heightFt: 3.4 },
    description: "Padded top-grain leather recliner with swivel base and extendable footrest.",
    defaultColor: 0x78350f,
  },
  {
    type: "coffee_table",
    name: "Marble & Gold Coffee Table",
    category: "living",
    icon: "CAF",
    dimensions: { widthFt: 3.8, depthFt: 2.4, heightFt: 1.4 },
    description: "Calacatta marble top coffee table with satin brass metal architectural frame.",
  },
  {
    type: "tv_unit",
    name: "Floating TV Entertainment Wall",
    category: "living",
    icon: "TV",
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
    icon: "BED",
    dimensions: { widthFt: 6.4, depthFt: 7.0, heightFt: 4.0 },
    description: "King bed with vertical channel tufted upholstered headboard, duvet, pillows, and dual nightstands.",
    defaultColor: 0x1e293b,
  },
  {
    type: "bed_queen_platform",
    name: "Modern Platform Bed (Queen)",
    category: "bedroom",
    icon: "BED",
    dimensions: { widthFt: 5.5, depthFt: 6.8, heightFt: 3.0 },
    description: "Sleek low-profile Japanese-inspired wood platform bed with floating nightstands.",
    defaultColor: 0x78350f,
  },
  {
    type: "bed_single",
    name: "Single Bed with Side Table",
    category: "bedroom",
    icon: "BED",
    dimensions: { widthFt: 3.6, depthFt: 6.5, heightFt: 3.0 },
    description: "Contemporary single bed with breathable linen mattress and compact side table.",
    defaultColor: 0x1e3a8a,
  },
  {
    type: "bed_bunk",
    name: "Wooden Double Bunk Bed",
    category: "bedroom",
    icon: "BED",
    dimensions: { widthFt: 3.8, depthFt: 6.6, heightFt: 5.8 },
    description: "Solid pine double-tier bunk bed with safety guard rails and integrated access ladder.",
    defaultColor: 0x78350f,
  },
  {
    type: "wardrobe",
    name: "3-Door Full-Height Wardrobe",
    category: "bedroom",
    icon: "DR",
    dimensions: { widthFt: 5.4, depthFt: 2.0, heightFt: 7.8 },
    description: "Floor-to-ceiling 3-door wardrobe closet in dark walnut with brushed brass handles.",
  },
  {
    type: "vanity_table",
    name: "Dressing Vanity & LED Mirror",
    category: "bedroom",
    icon: "MIR",
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
    icon: "DIN",
    dimensions: { widthFt: 6.2, depthFt: 3.5, heightFt: 2.8 },
    description: "Teakwood dining table with 6 cushioned dining chairs and central runner.",
    defaultColor: 0x78350f,
  },
  {
    type: "dining_round",
    name: "4-Seater Round Dining Table",
    category: "dining",
    icon: "POT",
    dimensions: { widthFt: 4.4, depthFt: 4.4, heightFt: 2.8 },
    description: "Round marble pedestal dining table with 4 curved upholstered dining armchairs.",
  },
  {
    type: "kitchen_island",
    name: "Kitchen Island & Bar Stools",
    category: "kitchen",
    icon: "KIT",
    dimensions: { widthFt: 6.0, depthFt: 2.8, heightFt: 3.2 },
    description: "Waterfall quartz kitchen prep island with 2 modern high-top bar stools.",
  },
  {
    type: "refrigerator",
    name: "Double-Door Smart Refrigerator",
    category: "kitchen",
    icon: "REF",
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
    icon: "DSK",
    dimensions: { widthFt: 4.5, depthFt: 2.2, heightFt: 3.2 },
    description: "Modern workstation desk with laptop, desk lamp, and high-back ergonomic mesh chair.",
  },
  {
    type: "bookshelf",
    name: "Tall Open Bookshelf",
    category: "office",
    icon: "BKS",
    dimensions: { widthFt: 3.6, depthFt: 1.2, heightFt: 6.5 },
    description: "Architectural 5-tier open bookcase with books and decorative ceramics.",
  },
  {
    type: "plant_pot",
    name: "Indoor Botanical Planter",
    category: "decor",
    icon: "PLT",
    dimensions: { widthFt: 1.8, depthFt: 1.8, heightFt: 4.4 },
    description: "Lush Fiddle Leaf Fig tree in a fluted minimalist ceramic pot.",
  },
  {
    type: "floor_lamp",
    name: "Curved Arc Floor Lamp",
    category: "decor",
    icon: "LGT",
    dimensions: { widthFt: 1.8, depthFt: 1.8, heightFt: 5.6 },
    description: "Gold/black metal arc standing lamp with warm ambient lampshade.",
  },
  {
    type: "floor_rug",
    name: "Geometric Area Rug",
    category: "decor",
    icon: "FAB",
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
    icon: "MND",
    dimensions: { widthFt: 3.4, depthFt: 2.2, heightFt: 5.0 },
    description: "Carved teakwood pooja mandir shrine with pyramid gopuram spire, brass kalash, and diya lamps.",
  },

  // --------------------------------------------------------------------------------------
  // 6. Custom Partition Walls & Architectural Dividers
  // --------------------------------------------------------------------------------------
  {
    type: "wall_partition_full",
    name: "Full-Height Interior Partition Wall",
    category: "walls",
    ribbonTag: "9ft Wall",
    icon: "WAL",
    dimensions: { widthFt: 8.0, depthFt: 0.5, heightFt: 9.0 },
    description: "Solid 9-foot architectural interior partition wall with top crown trim and bottom baseboards.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "wall_partition_short",
    name: "Half-Height Divider Wall (Pony Wall)",
    category: "walls",
    ribbonTag: "4ft Divider",
    icon: "WAL",
    dimensions: { widthFt: 6.0, depthFt: 0.5, heightFt: 4.0 },
    description: "4-foot pony wall room divider capped with a polished walnut wood ledge.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "wall_partition_slat",
    name: "Acoustic Slatted Wood Screen Wall",
    category: "walls",
    ribbonTag: "Slat Screen",
    icon: "WD",
    dimensions: { widthFt: 6.0, depthFt: 0.35, heightFt: 9.0 },
    description: "Floor-to-ceiling vertical teakwood fluted slats allowing ambient light penetration.",
    defaultColor: 0x78350f,
  },
  {
    type: "wall_glass_partition",
    name: "Crittall Glass Wall with Black Mullions",
    category: "walls",
    ribbonTag: "Glass Wall",
    icon: "WIN",
    dimensions: { widthFt: 8.0, depthFt: 0.3, heightFt: 9.0 },
    description: "Modern industrial glass partition wall framed in sleek black aluminum grid mullions.",
    defaultColor: 0x1e293b,
  },
  {
    type: "wall_archway_divider",
    name: "Neoclassical Arched Divider Wall",
    category: "walls",
    ribbonTag: "Arched Wall",
    icon: "CLS",
    dimensions: { widthFt: 8.0, depthFt: 0.5, heightFt: 9.0 },
    description: "Architectural partition wall featuring a grand roman arched walkthrough opening with decorative trim.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "wall_curved_partition",
    name: "Curved Architectural Feature Wall",
    category: "walls",
    ribbonTag: "Curved Wall",
    icon: "CRV",
    dimensions: { widthFt: 8.0, depthFt: 3.5, heightFt: 9.0 },
    description: "Smooth circular sweeping 9-foot architectural feature wall with crown molding and baseboard.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "wall_curved_glass",
    name: "Curved Cylindrical Glass Wall",
    category: "walls",
    ribbonTag: "Curved Glass",
    icon: "WIN",
    dimensions: { widthFt: 7.5, depthFt: 3.5, heightFt: 9.0 },
    description: "Curved panoramic glass partition with black aluminum frame tracks and vertical mullions.",
    defaultColor: 0x0284c7,
  },
  {
    type: "wall_curved_slat",
    name: "Curved Fluted Wood Slat Wall",
    category: "walls",
    ribbonTag: "Curved Slat",
    icon: "WD",
    dimensions: { widthFt: 7.5, depthFt: 3.5, heightFt: 9.0 },
    description: "Curved parametric acoustic partition with vertical teakwood fluted slats.",
    defaultColor: 0x78350f,
  },
  {
    type: "door_roman_arch",
    name: "Grand Roman Arched Door",
    category: "walls",
    ribbonTag: "Arched Door",
    icon: "DR",
    dimensions: { widthFt: 4.0, depthFt: 0.6, heightFt: 8.5 },
    description: "Solid hardwood paneled door with semicircular roman arched lunette and brass lever handle.",
    defaultColor: 0x3e2723,
  },
  {
    type: "door_revolving_curved",
    name: "Curved Glass Revolving Entrance",
    category: "walls",
    ribbonTag: "Revolving Door",
    icon: "CRS",
    dimensions: { widthFt: 6.5, depthFt: 6.5, heightFt: 9.0 },
    description: "Luxury curved glass cylindrical entrance vestibule with 4-wing rotating glass panels.",
    defaultColor: 0x1e293b,
  },
  {
    type: "window_curved_bow",
    name: "Panoramic Curved Bow Window",
    category: "walls",
    ribbonTag: "Bow Window",
    icon: "WIN",
    dimensions: { widthFt: 7.0, depthFt: 2.5, heightFt: 5.5 },
    description: "Sweeping 5-panel curved bow window projecting outward with deep interior display sill ledge.",
    defaultColor: 0x0284c7,
  },
  {
    type: "counter_curved_island",
    name: "Curved Waterfall Kitchen Island",
    category: "kitchen",
    icon: "KIT",
    dimensions: { widthFt: 8.0, depthFt: 3.8, heightFt: 3.0 },
    description: "Luxury curved fluted marble island counter with rounded breakfast bar seating overhang.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "staircase_spiral_curved",
    name: "Curved Spiral Helical Staircase",
    category: "decor",
    icon: "SPR",
    dimensions: { widthFt: 6.5, depthFt: 6.5, heightFt: 10.0 },
    description: "Architectural curved spiral staircase with central steel pillar, teakwood steps, and curved glass handrail.",
    defaultColor: 0x78350f,
  },

  // ------------------------------------------------------------------------------------
  // Haute Parisian Dollhouse Elements
  // ------------------------------------------------------------------------------------
  {
    type: "wall_fireplace_bookshelf",
    name: "Haute Fireplace & Recessed Bookshelf Wall",
    category: "decor",
    icon: "BKS",
    dimensions: { widthFt: 14.0, depthFt: 1.8, heightFt: 9.0 },
    description: "Classical Parisian fireplace mantel with hearth, decorative gilded mirror frame, and flanking backlit alcove bookshelves with book volumes.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "partition_planter_cacti",
    name: "Indoor Architectural Planter Divider",
    category: "decor",
    icon: "PLT",
    dimensions: { widthFt: 6.0, depthFt: 1.5, heightFt: 5.5 },
    description: "Crisp white wainscoted planter box with organic soil bed and architectural vertical snake plants & cacti.",
    defaultColor: 0xf8fafc,
  },
  {
    type: "dining_table_nero_marquina",
    name: "10-Seater Nero Marquina Dining Set",
    category: "dining",
    icon: "DIN",
    dimensions: { widthFt: 11.0, depthFt: 4.5, heightFt: 2.8 },
    description: "Grand oval Nero Marquina black marble dining table with brass pedestal legs and 8-10 curved cream shell dining chairs.",
    defaultColor: 0x0f172a,
  },
  {
    type: "sofa_boucle_curved_set",
    name: "Haute Bouclé Curved Living Set",
    category: "living",
    icon: "SOF",
    dimensions: { widthFt: 12.0, depthFt: 9.0, heightFt: 2.8 },
    description: "Parisian living suite with organic curved cream bouclé sofa, sculpted organic teak coffee table, and geometric textured area rug.",
    defaultColor: 0xfaf5ee,
  },
  {
    type: "kitchen_walnut_wall",
    name: "Floor-to-Ceiling Smoked Walnut Kitchen Wall",
    category: "kitchen",
    icon: "KIT",
    dimensions: { widthFt: 12.0, depthFt: 2.2, heightFt: 9.0 },
    description: "Modern luxury integrated kitchen wall with tall smoked walnut cabinetry, built-in refrigerator, and fluted slat screen divider.",
    defaultColor: 0x3e2723,
  },
  {
    type: "mirror_pebble_gilded",
    name: "Organic Pebble Gilded Brass Wall Mirror",
    category: "decor",
    icon: "MIR",
    dimensions: { widthFt: 3.5, depthFt: 0.3, heightFt: 3.5 },
    description: "Asymmetrical organic pebble gilded mirror with brushed brass frame and beveled reflective glass.",
    defaultColor: 0xd4af37,
  },
  // --------------------------------------------------------------------------------------
  // Cafe & small restaurant. Sizes follow notes/programs/cafe-layout-standards.md: a 2.5 ft
  // top with 42 in between tables, a 42 in bar stool at a 42 in counter, and a communal table
  // wide enough to seat both sides without breaking the 36 in aisle.
  // --------------------------------------------------------------------------------------
  {
    type: "cafe_two_top",
    name: "Two-Top Cafe Table",
    category: "cafe_seating",
    icon: "CAF",
    dimensions: { widthFt: 2.5, depthFt: 5.5, heightFt: 2.9 },
    description: "Round pedestal two-top with a chair either side. The unit a cover count is built from.",
    defaultColor: 0x8b5a2b,
  },
  {
    type: "cafe_communal_table",
    name: "Communal Table & Benches",
    category: "cafe_seating",
    icon: "DIN",
    dimensions: { widthFt: 8.0, depthFt: 5.0, heightFt: 2.5 },
    description: "Long shared table with a bench each side. Seats eight in the floor area of three two-tops.",
    defaultColor: 0x6b4423,
  },
  {
    type: "cafe_banquette_run",
    name: "Banquette Bench Run",
    category: "cafe_seating",
    icon: "SOF",
    dimensions: { widthFt: 8.0, depthFt: 2.6, heightFt: 3.6 },
    description: "Upholstered wall bench. Buys covers along a wall where free-standing chairs would eat the aisle.",
    defaultColor: 0x4a5a68,
  },
  {
    type: "cafe_bar_stool",
    name: "Counter Bar Stool",
    category: "cafe_seating",
    icon: "CHR",
    dimensions: { widthFt: 1.4, depthFt: 1.4, heightFt: 3.5 },
    description: "Backless stool at 42 in for a bar-height counter or window ledge.",
    defaultColor: 0x1a1d21,
  },
  {
    type: "cafe_display_case",
    name: "Pastry Display Case",
    category: "cafe_service",
    icon: "PST",
    dimensions: { widthFt: 4.0, depthFt: 2.2, heightFt: 4.6 },
    description: "Refrigerated glass case. Belongs at the order end of the counter, before the till.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_planter_divider",
    name: "Planter Room Divider",
    category: "cafe_decor",
    icon: "PLT",
    dimensions: { widthFt: 5.0, depthFt: 1.4, heightFt: 5.0 },
    description: "Planted trough on a frame. Splits the queue from the seating without building a wall.",
    defaultColor: 0x3f7d4f,
  },
  {
    type: "cafe_menu_board",
    name: "Hanging Menu Board",
    category: "cafe_signage",
    icon: "LST",
    dimensions: { widthFt: 5.0, depthFt: 0.3, heightFt: 3.0 },
    description: "Board over the counter, readable from the back of the queue.",
    defaultColor: 0x1f2733,
  },
  {
    type: "cafe_four_top",
    name: "Four-Top Table",
    category: "cafe_seating",
    icon: "CUT",
    dimensions: { widthFt: 5.5, depthFt: 5.5, heightFt: 2.9 },
    description: "Square four-top with a chair a side. Doubles a two-top's covers on 1.6x the floor area.",
    defaultColor: 0x8b5a2b,
  },
  {
    type: "cafe_window_bar",
    name: "Window Bar & Stools",
    category: "cafe_seating",
    icon: "WIN",
    dimensions: { widthFt: 8.0, depthFt: 1.6, heightFt: 3.6 },
    description: "Bar-height ledge against the glazing with three stools. Buys solo covers out of a wall.",
    defaultColor: 0x6b4423,
  },
  {
    type: "cafe_lounge_armchair",
    name: "Lounge Armchair",
    category: "cafe_seating",
    icon: "SET",
    dimensions: { widthFt: 2.8, depthFt: 2.9, heightFt: 2.7 },
    description: "Soft armchair for the slow corner. Commercial frame, not a domestic one.",
    defaultColor: 0x4a5a68,
  },
  {
    type: "cafe_espresso_station",
    name: "Espresso Machine & Grinder",
    category: "cafe_service",
    icon: "CAF",
    dimensions: { widthFt: 4.5, depthFt: 2.2, heightFt: 4.8 },
    description: "Two-group machine, grinder and knock box on a bench. The production heart of the bar.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_pos_counter",
    name: "POS & Till Stand",
    category: "cafe_service",
    icon: "SVC",
    dimensions: { widthFt: 2.4, depthFt: 2.0, heightFt: 4.2 },
    description: "Register on a plinth. Belongs at the order end, well clear of the pickup point.",
    defaultColor: 0x1a1d21,
  },
  {
    type: "cafe_condiment_station",
    name: "Condiment Station",
    category: "cafe_service",
    icon: "MLK",
    dimensions: { widthFt: 3.6, depthFt: 1.8, heightFt: 3.6 },
    description: "Milk, sugar, lids and napkins. Keep it off the queue so topping up does not block the line.",
    defaultColor: 0x6b4423,
  },
  {
    type: "cafe_retail_shelf",
    name: "Retail & Bean Shelf",
    category: "cafe_service",
    icon: "RTL",
    dimensions: { widthFt: 4.0, depthFt: 1.4, heightFt: 6.0 },
    description: "Merchandising unit for retail bags, mugs and brew kit. Works as a queue guide too.",
    defaultColor: 0x5d4037,
  },
  {
    type: "cafe_pendant_cluster",
    name: "Pendant Light Cluster",
    category: "cafe_decor",
    icon: "LGT",
    dimensions: { widthFt: 4.0, depthFt: 1.6, heightFt: 3.0 },
    description: "Three dropped pendants on a rail. Hangs over the counter or a communal table.",
    defaultColor: 0x1a1d21,
  },
  {
    type: "cafe_neon_sign",
    name: "Neon Wall Sign",
    category: "cafe_decor",
    icon: "BRT",
    dimensions: { widthFt: 4.4, depthFt: 0.3, heightFt: 2.2 },
    description: "Glowing wall script. The photo wall every branch gets tagged in.",
    defaultColor: 0xff5da2,
  },
  {
    type: "cafe_wall_art",
    name: "Framed Art Set",
    category: "cafe_decor",
    icon: "ART",
    dimensions: { widthFt: 5.0, depthFt: 0.2, heightFt: 3.2 },
    description: "Three framed prints in a gallery row, hung at eye level.",
    defaultColor: 0x3e2723,
  },
  {
    type: "cafe_floor_plant",
    name: "Large Floor Plant",
    category: "cafe_decor",
    icon: "GRN",
    dimensions: { widthFt: 3.0, depthFt: 3.0, heightFt: 6.5 },
    description: "Potted fiddle-leaf. Softens a corner and screens a table from the door draught.",
    defaultColor: 0x3f7d4f,
  },
  {
    type: "cafe_bookshelf",
    name: "Open Book & Plant Shelf",
    category: "cafe_decor",
    icon: "BKS",
    dimensions: { widthFt: 5.0, depthFt: 1.2, heightFt: 6.4 },
    description: "Open shelving of books and trailing plants. Reads as a divider without closing the room.",
    defaultColor: 0x5d4037,
  },
  {
    type: "cafe_a_frame",
    name: "A-Frame Chalkboard",
    category: "cafe_signage",
    icon: "SGN",
    dimensions: { widthFt: 2.4, depthFt: 2.0, heightFt: 3.6 },
    description: "Pavement sandwich board. Lives outside the door, never inside the decompression zone.",
    defaultColor: 0x1f2733,
  },
  {
    type: "cafe_reach_in_fridge",
    name: "Reach-In Fridge",
    category: "cafe_boh",
    icon: "REF",
    dimensions: { widthFt: 3.0, depthFt: 2.8, heightFt: 6.6 },
    description: "Upright commercial fridge for milk and cold stock. Back of house, off the customer path.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_prep_table",
    name: "Stainless Prep Table",
    category: "cafe_boh",
    icon: "PRP",
    dimensions: { widthFt: 6.0, depthFt: 2.6, heightFt: 3.0 },
    description: "Stainless bench with an undershelf. The commercial-kitchen workhorse.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_dunnage_rack",
    name: "Dry Store Racking",
    category: "cafe_boh",
    icon: "CAB",
    dimensions: { widthFt: 5.0, depthFt: 1.6, heightFt: 6.4 },
    description: "Four-tier wire racking. Dry goods off the floor, as the inspector expects.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_ice_machine",
    name: "Ice Machine",
    category: "cafe_boh",
    icon: "CLD",
    dimensions: { widthFt: 2.6, depthFt: 2.6, heightFt: 5.4 },
    description: "Bin-on-maker unit. Needs a drain and back-of-house air, not a spot behind the bar.",
    defaultColor: 0xc3c9ce,
  },
  {
    type: "cafe_patio_set",
    name: "Patio Set & Parasol",
    category: "cafe_outdoor",
    icon: "UMB",
    dimensions: { widthFt: 6.5, depthFt: 6.5, heightFt: 7.5 },
    description: "Outdoor two-top under a parasol. Terrace covers are where a lot of Indian cafe seating lives.",
    defaultColor: 0x6b7f6a,
  },
  {
    type: "cafe_bollard_rope",
    name: "Terrace Rope Bollards",
    category: "cafe_outdoor",
    icon: "CHN",
    dimensions: { widthFt: 6.0, depthFt: 0.8, heightFt: 3.2 },
    description: "Two posts and a slung rope. Marks the terrace boundary without a fence.",
    defaultColor: 0xd4af37,
  },
  {
    type: "cafe_bike_rack",
    name: "Bike Rack",
    category: "cafe_outdoor",
    icon: "BIK",
    dimensions: { widthFt: 5.0, depthFt: 1.4, heightFt: 2.8 },
    description: "Hooped stand by the frontage. Cheap footfall, and it keeps bikes off the shopfront glass.",
    defaultColor: 0x1a1d21,
  },
];

// --------------------------------------------------------------------------------------
// Procedural 3D Mesh Generator Engine
// --------------------------------------------------------------------------------------

export function createFurnitureMesh(
  type: string,
  customColor?: number,
  aiDef?: AIFurnitureParametricDef
): THREE.Group {
  if (aiDef) {
    return createAIFurnitureMesh(aiDef, customColor);
  }

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
      const base = new THREE.Mesh(createRoundedBox(w, seatH * 0.4, d, 0.08, 4), fabricMat);
      base.position.y = 0.4 + (seatH * 0.4) / 2;
      root.add(base);

      for (let i = -1; i <= 1; i++) {
        const cushion = new THREE.Mesh(createRoundedBox(w / 3 - 0.08, 0.4, d - 0.3, 0.12, 5), fabricMat);
        cushion.position.set(i * (w / 3), seatH + 0.1, 0.1);
        root.add(cushion);
      }

      // Backrest
      const back = new THREE.Mesh(createRoundedBox(w, 1.6, 0.5, 0.12, 5), fabricMat);
      back.position.set(0, seatH + 0.8, -d / 2 + 0.25);
      root.add(back);

      // Armrests
      const armL = new THREE.Mesh(createRoundedBox(0.45, 1.2, d, 0.1, 4), fabricMat);
      armL.position.set(-w / 2 + 0.225, seatH + 0.3, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.225;
      root.add(armL, armR);

      // Throw Pillows
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
      const p1 = new THREE.Mesh(createRoundedBox(0.8, 0.8, 0.25, 0.12, 5), pillowMat);
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
      const mainBase = new THREE.Mesh(createRoundedBox(mainW, seatH * 0.4, mainD, 0.08, 4), fabricMat);
      mainBase.position.set(0, 0.4 + (seatH * 0.4) / 2, 0);
      root.add(mainBase);

      // Chaise Lounge Extension (on the right)
      const chaiseBase = new THREE.Mesh(createRoundedBox(3.0, seatH * 0.4, chaiseL - mainD, 0.08, 4), fabricMat);
      chaiseBase.position.set(mainW / 2 - 1.5, 0.4 + (seatH * 0.4) / 2, (chaiseL - mainD) / 2 + mainD / 2);
      root.add(chaiseBase);

      // Main Backrest
      const back = new THREE.Mesh(createRoundedBox(mainW, 1.6, 0.5, 0.12, 5), fabricMat);
      back.position.set(0, seatH + 0.8, -mainD / 2 + 0.25);
      root.add(back);

      // Left Armrest
      const armL = new THREE.Mesh(createRoundedBox(0.45, 1.2, mainD, 0.1, 4), fabricMat);
      armL.position.set(-mainW / 2 + 0.225, seatH + 0.3, 0);
      root.add(armL);

      // Cushions on main sofa
      for (let i = 0; i < 3; i++) {
        const cushion = new THREE.Mesh(createRoundedBox(1.8, 0.4, mainD - 0.4, 0.12, 5), fabricMat);
        cushion.position.set(-mainW / 2 + 1.2 + i * 1.9, seatH + 0.1, 0.1);
        root.add(cushion);
      }

      // Chaise Long Cushion
      const chaiseCushion = new THREE.Mesh(createRoundedBox(2.8, 0.4, chaiseL - 0.4, 0.12, 5), fabricMat);
      chaiseCushion.position.set(mainW / 2 - 1.5, seatH + 0.1, (chaiseL - mainD) / 2);
      root.add(chaiseCushion);

      // Throw Pillows
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
      const p1 = new THREE.Mesh(createRoundedBox(0.9, 0.9, 0.25, 0.12, 5), pillowMat);
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
      const arc = Math.PI * 0.75;
      const seatH = 1.3;

      // Curved Base Segment
      const curveSegments = 16;
      for (let i = 0; i < curveSegments; i++) {
        const theta1 = -arc / 2 + (i * arc) / curveSegments;
        const theta2 = -arc / 2 + ((i + 1) * arc) / curveSegments;
        const midTheta = (theta1 + theta2) / 2;
        const segW = (radius * arc) / curveSegments;

        const seg = new THREE.Mesh(createRoundedBox(segW + 0.1, 0.5, 2.6, 0.1, 4), fabricMat);
        seg.position.set(Math.sin(midTheta) * radius, 0.45, Math.cos(midTheta) * radius - radius * 0.6);
        seg.rotation.y = midTheta;
        root.add(seg);

        // Curved Backrest
        const backSeg = new THREE.Mesh(createRoundedBox(segW + 0.1, 1.4, 0.6, 0.1, 4), fabricMat);
        backSeg.position.set(
          Math.sin(midTheta) * (radius + 0.9),
          seatH + 0.6,
          Math.cos(midTheta) * (radius + 0.9) - radius * 0.6
        );
        backSeg.rotation.y = midTheta;
        root.add(backSeg);
      }

      // Plush Curved Throw Pillows
      for (const ang of [-0.6, 0, 0.6]) {
        const p = new THREE.Mesh(createRoundedBox(0.85, 0.85, 0.25, 0.12, 5), cushionMat);
        p.position.set(Math.sin(ang) * (radius + 0.4), seatH + 0.4, Math.cos(ang) * (radius + 0.4) - radius * 0.6);
        p.rotation.y = ang;
        root.add(p);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 4. Compact 2-Seater Loveseat
    // ----------------------------------------------------------------------------------
    case "sofa_loveseat": {
      const w = 5.0;
      const d = 3.0;
      const seatH = 1.3;

      const base = new THREE.Mesh(createRoundedBox(w, seatH * 0.4, d, 0.08, 4), fabricMat);
      base.position.y = 0.4 + (seatH * 0.4) / 2;
      root.add(base);

      for (let i = -0.5; i <= 0.5; i += 1.0) {
        const cushion = new THREE.Mesh(createRoundedBox(w / 2 - 0.12, 0.4, d - 0.35, 0.12, 5), fabricMat);
        cushion.position.set(i * (w / 2), seatH + 0.1, 0.1);
        root.add(cushion);
      }

      const back = new THREE.Mesh(createRoundedBox(w, 1.5, 0.5, 0.12, 5), fabricMat);
      back.position.set(0, seatH + 0.75, -d / 2 + 0.25);
      root.add(back);

      const armL = new THREE.Mesh(createRoundedBox(0.4, 1.1, d, 0.1, 4), fabricMat);
      armL.position.set(-w / 2 + 0.2, seatH + 0.25, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.2;
      root.add(armL, armR);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 5. Classic Armchair
    // ----------------------------------------------------------------------------------
    case "armchair": {
      const w = 3.2;
      const d = 3.0;
      const seatH = 1.3;

      const base = new THREE.Mesh(createRoundedBox(w, seatH * 0.4, d, 0.08, 4), fabricMat);
      base.position.y = 0.4 + (seatH * 0.4) / 2;
      root.add(base);

      const cushion = new THREE.Mesh(createRoundedBox(w - 0.8, 0.45, d - 0.4, 0.12, 5), fabricMat);
      cushion.position.set(0, seatH + 0.1, 0.1);
      root.add(cushion);

      const back = new THREE.Mesh(createRoundedBox(w, 1.7, 0.5, 0.12, 5), fabricMat);
      back.position.set(0, seatH + 0.85, -d / 2 + 0.25);
      root.add(back);

      const armL = new THREE.Mesh(createRoundedBox(0.4, 1.1, d, 0.1, 4), fabricMat);
      armL.position.set(-w / 2 + 0.2, seatH + 0.25, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.2;
      root.add(armL, armR);
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

      const seat = new THREE.Mesh(createRoundedBox(w - 0.6, 0.6, d - 0.8, 0.14, 5), leatherMat);
      seat.position.set(0, 1.3, 0);
      root.add(seat);

      const back = new THREE.Mesh(createRoundedBox(w - 0.6, 2.0, 0.5, 0.14, 5), leatherMat);
      back.position.set(0, 2.2, -d / 2 + 0.5);
      back.rotation.x = -0.15;
      root.add(back);

      const headrest = new THREE.Mesh(createRoundedBox(w - 0.8, 0.6, 0.4, 0.12, 4), leatherMat);
      headrest.position.set(0, 3.2, -d / 2 + 0.35);
      root.add(headrest);

      const armL = new THREE.Mesh(createRoundedBox(0.35, 0.8, d - 0.6, 0.1, 4), leatherMat);
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
      const top = new THREE.Mesh(createRoundedBox(3.8, 0.15, 2.4, 0.06, 4), marbleMat);
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
      const consoleMesh = new THREE.Mesh(createRoundedBox(w, 1.0, 1.4, 0.08, 4), walnutMat);
      consoleMesh.position.set(0, 1.2, 0);
      root.add(consoleMesh);

      // Backing Wall Slat Panel
      const panel = new THREE.Mesh(createRoundedBox(w + 0.5, 4.2, 0.15, 0.04, 3), darkWoodMat);
      panel.position.set(0, 3.0, -0.6);
      root.add(panel);

      // 65" TV Screen
      const tvScreen = new THREE.Mesh(
        createRoundedBox(5.0, 2.8, 0.1, 0.04, 3),
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
      const base = new THREE.Mesh(createRoundedBox(w, 0.8, d, 0.06, 4), darkWoodMat);
      base.position.set(0, 0.4, 0);
      root.add(base);

      // Mattress & Duvet
      const mattress = new THREE.Mesh(createRoundedBox(w - 0.2, 0.7, d - 0.4, 0.12, 5), cushionMat);
      mattress.position.set(0, 1.15, 0.1);
      root.add(mattress);

      const duvet = new THREE.Mesh(createRoundedBox(w - 0.3, 0.15, d * 0.65, 0.08, 4), fabricMat);
      duvet.position.set(0, 1.55, 0.5);
      root.add(duvet);

      // Tufted Headboard
      const headboard = new THREE.Mesh(createRoundedBox(w + 0.4, 3.2, 0.4, 0.08, 4), fabricMat);
      headboard.position.set(0, 2.0, -d / 2 + 0.2);
      root.add(headboard);

      // Pillows
      for (const px of [-1.5, 1.5]) {
        const pillow = new THREE.Mesh(createRoundedBox(1.8, 0.35, 1.2, 0.14, 5), cushionMat);
        pillow.position.set(px, 1.6, -d / 2 + 1.2);
        pillow.rotation.x = 0.2;
        root.add(pillow);
      }

      // Dual Nightstands
      for (const side of [-1, 1]) {
        const stand = new THREE.Mesh(createRoundedBox(1.6, 1.2, 1.4, 0.08, 4), darkWoodMat);
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

      const platform = new THREE.Mesh(createRoundedBox(w + 1.2, 0.4, d + 0.6, 0.06, 4), walnutMat);
      platform.position.set(0, 0.2, 0);
      root.add(platform);

      const mattress = new THREE.Mesh(createRoundedBox(w, 0.7, d, 0.12, 5), cushionMat);
      mattress.position.set(0, 0.75, 0);
      root.add(mattress);

      const duvet = new THREE.Mesh(createRoundedBox(w - 0.2, 0.15, d * 0.6, 0.08, 4), fabricMat);
      duvet.position.set(0, 1.15, 0.5);
      root.add(duvet);

      const headboard = new THREE.Mesh(createRoundedBox(w + 1.2, 2.2, 0.25, 0.06, 4), walnutMat);
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

      const base = new THREE.Mesh(createRoundedBox(w, 0.6, d, 0.06, 4), darkWoodMat);
      base.position.set(0, 0.3, 0);
      root.add(base);

      const mattress = new THREE.Mesh(createRoundedBox(w - 0.2, 0.6, d - 0.2, 0.12, 5), cushionMat);
      mattress.position.set(0, 0.9, 0);
      root.add(mattress);

      const headboard = new THREE.Mesh(createRoundedBox(w, 2.2, 0.3, 0.06, 4), darkWoodMat);
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
      const bed1 = new THREE.Mesh(createRoundedBox(w - 0.3, 0.5, d - 0.3, 0.1, 4), cushionMat);
      bed1.position.set(0, 1.2, 0);
      root.add(bed1);

      // Top Bunk
      const bed2 = new THREE.Mesh(createRoundedBox(w - 0.3, 0.5, d - 0.3, 0.1, 4), cushionMat);
      bed2.position.set(0, 4.2, 0);
      root.add(bed2);

      // Safety Guard Rail
      const rail = new THREE.Mesh(createRoundedBox(w - 0.3, 0.8, 0.15, 0.04, 3), darkWoodMat);
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

      const body = new THREE.Mesh(createRoundedBox(w, h, d, 0.08, 4), walnutMat);
      body.position.set(0, h / 2, 0);
      root.add(body);

      // 3 Doors with Grooves
      for (let i = -1; i <= 1; i++) {
        const door = new THREE.Mesh(createRoundedBox(w / 3 - 0.06, h - 0.2, 0.05, 0.02, 3), darkWoodMat);
        door.position.set(i * (w / 3), h / 2, d / 2 + 0.03);
        root.add(door);

        const handle = new THREE.Mesh(createRoundedBox(0.06, 1.2, 0.1, 0.02, 3), brassMat);
        handle.position.set(i * (w / 3) + (i === 1 ? -0.5 : 0.5), h / 2, d / 2 + 0.08);
        root.add(handle);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 14. Vanity Table
    // ----------------------------------------------------------------------------------
    case "vanity_table": {
      const desk = new THREE.Mesh(createRoundedBox(3.6, 0.8, 1.6, 0.06, 4), walnutMat);
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
      const tableTop = new THREE.Mesh(createRoundedBox(tw, 0.2, td, 0.08, 4), darkWoodMat);
      tableTop.position.set(0, 2.7, 0);
      root.add(tableTop);

      for (const lx of [-tw / 2 + 0.4, tw / 2 - 0.4]) {
        for (const lz of [-td / 2 + 0.4, td / 2 - 0.4]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 2.6, 12), darkWoodMat);
          leg.position.set(lx, 1.3, lz);
          root.add(leg);
        }
      }

      // 6 Chairs
      for (let i = -1; i <= 1; i++) {
        for (const side of [-1, 1]) {
          const chair = new THREE.Group();
          const seat = new THREE.Mesh(createRoundedBox(1.3, 0.15, 1.3, 0.05, 3), fabricMat);
          seat.position.y = 1.5;
          const chairBack = new THREE.Mesh(createRoundedBox(1.3, 1.4, 0.15, 0.06, 3), darkWoodMat);
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
      const body = new THREE.Mesh(createRoundedBox(5.8, 2.7, 2.6, 0.06, 4), darkWoodMat);
      body.position.set(0, 1.35, 0);
      root.add(body);

      const top = new THREE.Mesh(createRoundedBox(6.2, 0.25, 3.0, 0.08, 4), quartzMat);
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
      const fridge = new THREE.Mesh(createRoundedBox(3.0, 6.8, 2.6, 0.12, 5), chromeMat);
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
      const deskTop = new THREE.Mesh(createRoundedBox(4.5, 0.2, 2.2, 0.05, 3), darkWoodMat);
      deskTop.position.set(0, 2.5, 0);
      root.add(deskTop);

      for (const lx of [-2.0, 2.0]) {
        const leg = new THREE.Mesh(createRoundedBox(0.2, 2.4, 2.0, 0.04, 3), chromeMat);
        leg.position.set(lx, 1.2, 0);
        root.add(leg);
      }

      // Laptop
      const laptop = new THREE.Mesh(createRoundedBox(1.2, 0.05, 0.9, 0.02, 3), chromeMat);
      laptop.position.set(0, 2.65, 0);
      root.add(laptop);

      // Office Chair
      const chair = new THREE.Mesh(createRoundedBox(1.5, 1.6, 1.4, 0.14, 5), fabricMat);
      chair.position.set(0, 1.8, 1.6);
      root.add(chair);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 20. Tall Open Bookshelf
    // ----------------------------------------------------------------------------------
    case "bookshelf": {
      const frame = new THREE.Mesh(createRoundedBox(3.6, 6.5, 1.2, 0.06, 4), darkWoodMat);
      frame.position.set(0, 3.25, 0);
      root.add(frame);

      // 4 Internal Shelves with decorative items
      for (let s = 1; s <= 4; s++) {
        const shelf = new THREE.Mesh(createRoundedBox(3.4, 0.1, 1.15, 0.02, 3), brassMat);
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

    // ----------------------------------------------------------------------------------
    // 25. Full-Height Interior Partition Wall
    // ----------------------------------------------------------------------------------
    case "wall_partition_full": {
      const w = 8.0;
      const d = 0.5;
      const h = 9.0;
      const wallMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.82, metalness: 0.02 });
      const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.5 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });

      // Main Solid Wall
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(0, h / 2, 0);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);

      // Top Ceiling Crown Trim
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.08), trimMat);
      crown.position.set(0, h - 0.15, 0);
      root.add(crown);

      // Bottom Baseboards
      const baseboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.45, d + 0.06), baseboardMat);
      baseboard.position.set(0, 0.225, 0);
      root.add(baseboard);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 26. Half-Height Room Divider (Pony Wall)
    // ----------------------------------------------------------------------------------
    case "wall_partition_short": {
      const w = 6.0;
      const d = 0.5;
      const h = 4.0;
      const wallMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.82, metalness: 0.02 });
      const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.5 });
      const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.35 });

      // Wall Body
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(0, h / 2, 0);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);

      // Top Wood Capping Ledge
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), ledgeMat);
      ledge.position.set(0, h + 0.09, 0);
      root.add(ledge);

      // Bottom Baseboard
      const baseboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.45, d + 0.06), baseboardMat);
      baseboard.position.set(0, 0.225, 0);
      root.add(baseboard);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 27. Acoustic Slatted Wood Screen Wall
    // ----------------------------------------------------------------------------------
    case "wall_partition_slat": {
      const w = 6.0;
      const h = 9.0;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.7, roughness: 0.3 });
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.45 });

      // Top and Bottom Rails
      const railBottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.35), frameMat);
      railBottom.position.set(0, 0.1, 0);
      const railTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.35), frameMat);
      railTop.position.set(0, h - 0.1, 0);
      root.add(railBottom, railTop);

      // Vertical Slat Sliders
      const slatCount = 14;
      const slatSpacing = (w - 0.4) / (slatCount - 1);
      for (let i = 0; i < slatCount; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, h - 0.4, 0.25), slatMat);
        slat.position.set(-w / 2 + 0.2 + i * slatSpacing, h / 2, 0);
        slat.castShadow = true;
        root.add(slat);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 28. Crittall Glass Wall with Black Mullions
    // ----------------------------------------------------------------------------------
    case "wall_glass_partition": {
      const w = 8.0;
      const h = 9.0;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.2 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transmission: 0.88,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
        ior: 1.5,
        thickness: 0.1,
      });

      // Glass Pane
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, h - 0.2, 0.06), glassMat);
      glass.position.set(0, h / 2, 0);
      root.add(glass);

      // Outer Frame
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.25), frameMat);
      frameL.position.set(-w / 2 + 0.09, h / 2, 0);
      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.25), frameMat);
      frameR.position.set(w / 2 - 0.09, h / 2, 0);
      const frameB = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.25), frameMat);
      frameB.position.set(0, 0.09, 0);
      const frameT = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.25), frameMat);
      frameT.position.set(0, h - 0.09, 0);
      root.add(frameL, frameR, frameB, frameT);

      // Vertical & Horizontal Grid Mullions
      for (let i = 1; i <= 3; i++) {
        const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.36, 0.16), frameMat);
        vMullion.position.set(-w / 2 + (i * w) / 4, h / 2, 0);
        root.add(vMullion);
      }
      for (let j = 1; j <= 3; j++) {
        const hMullion = new THREE.Mesh(new THREE.BoxGeometry(w - 0.36, 0.08, 0.16), frameMat);
        hMullion.position.set(0, (j * h) / 4, 0);
        root.add(hMullion);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 29. Neoclassical Arched Divider Wall
    // ----------------------------------------------------------------------------------
    case "wall_archway_divider": {
      const w = 8.0;
      const d = 0.5;
      const h = 9.0;
      const archW = 4.0;
      const archH = 7.0;
      const wallMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.82, metalness: 0.02 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 });

      const sideW = (w - archW) / 2;
      const topH = h - archH;

      // Left Pillar Wall
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, d), wallMat);
      leftWall.position.set(-w / 2 + sideW / 2, h / 2, 0);
      leftWall.castShadow = true;

      // Right Pillar Wall
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, d), wallMat);
      rightWall.position.set(w / 2 - sideW / 2, h / 2, 0);
      rightWall.castShadow = true;

      // Top Header Wall
      const topWall = new THREE.Mesh(new THREE.BoxGeometry(archW, topH, d), wallMat);
      topWall.position.set(0, archH + topH / 2, 0);
      topWall.castShadow = true;

      // Arch Molding Trim
      const archTrim = new THREE.Mesh(new THREE.BoxGeometry(archW + 0.2, 0.25, d + 0.08), trimMat);
      archTrim.position.set(0, archH - 0.1, 0);

      root.add(leftWall, rightWall, topWall, archTrim);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 30. Curved Architectural Feature Wall
    // ----------------------------------------------------------------------------------
    case "wall_curved_partition": {
      const radius = 6.0;
      const arcAngle = Math.PI / 2.5; // ~72 degrees
      const h = 9.0;
      const thick = 0.5;
      const segCount = 18;
      const wallMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.8, metalness: 0.02 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.5 });
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });

      const dTheta = arcAngle / segCount;
      const segLen = 2 * radius * Math.sin(dTheta / 2) + 0.04;

      for (let i = 0; i < segCount; i++) {
        const theta = -arcAngle / 2 + (i + 0.5) * dTheta;
        const px = radius * Math.sin(theta);
        const pz = -radius * Math.cos(theta) + radius * Math.cos(arcAngle / 2);

        // Wall Segment
        const seg = new THREE.Mesh(new THREE.BoxGeometry(segLen, h, thick), wallMat);
        seg.position.set(px, h / 2, pz);
        seg.rotation.y = theta;
        seg.castShadow = true;
        seg.receiveShadow = true;

        // Baseboard Segment
        const base = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.02, 0.45, thick + 0.06), trimMat);
        base.position.set(px, 0.225, pz);
        base.rotation.y = theta;

        // Crown Molding Segment
        const crown = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.02, 0.3, thick + 0.08), crownMat);
        crown.position.set(px, h - 0.15, pz);
        crown.rotation.y = theta;

        root.add(seg, base, crown);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 31. Curved Cylindrical Glass Wall
    // ----------------------------------------------------------------------------------
    case "wall_curved_glass": {
      const radius = 5.5;
      const arcAngle = Math.PI / 2.5;
      const h = 9.0;
      const segCount = 14;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.2 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.88,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
        ior: 1.5,
        thickness: 0.1,
      });

      const dTheta = arcAngle / segCount;
      const segLen = 2 * radius * Math.sin(dTheta / 2) + 0.02;

      for (let i = 0; i < segCount; i++) {
        const theta = -arcAngle / 2 + (i + 0.5) * dTheta;
        const px = radius * Math.sin(theta);
        const pz = -radius * Math.cos(theta) + radius * Math.cos(arcAngle / 2);

        // Glass Pane
        const glass = new THREE.Mesh(new THREE.BoxGeometry(segLen - 0.06, h - 0.3, 0.06), glassMat);
        glass.position.set(px, h / 2, pz);
        glass.rotation.y = theta;

        // Top & Bottom Track Rails
        const railB = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.15, 0.2), frameMat);
        railB.position.set(px, 0.075, pz);
        railB.rotation.y = theta;

        const railT = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.15, 0.2), frameMat);
        railT.position.set(px, h - 0.075, pz);
        railT.rotation.y = theta;

        root.add(glass, railB, railT);

        // Vertical Mullion at segment joints
        if (i % 2 === 0 || i === segCount - 1) {
          const jointTheta = -arcAngle / 2 + i * dTheta;
          const jx = radius * Math.sin(jointTheta);
          const jz = -radius * Math.cos(jointTheta) + radius * Math.cos(arcAngle / 2);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.22), frameMat);
          post.position.set(jx, h / 2, jz);
          post.rotation.y = jointTheta;
          root.add(post);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 32. Curved Fluted Wood Slat Wall
    // ----------------------------------------------------------------------------------
    case "wall_curved_slat": {
      const radius = 5.5;
      const arcAngle = Math.PI / 2.5;
      const h = 9.0;
      const slatCount = 20;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.7, roughness: 0.3 });
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.45 });

      const dTheta = arcAngle / slatCount;
      const railSegLen = 2 * radius * Math.sin(dTheta / 2) + 0.05;

      for (let i = 0; i < slatCount; i++) {
        const theta = -arcAngle / 2 + i * dTheta;
        const px = radius * Math.sin(theta);
        const pz = -radius * Math.cos(theta) + radius * Math.cos(arcAngle / 2);

        // Slat
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.16, h - 0.4, 0.22), slatMat);
        slat.position.set(px, h / 2, pz);
        slat.rotation.y = theta;
        slat.castShadow = true;
        root.add(slat);

        // Rail Segments
        const railB = new THREE.Mesh(new THREE.BoxGeometry(railSegLen, 0.2, 0.3), frameMat);
        railB.position.set(px, 0.1, pz);
        railB.rotation.y = theta;

        const railT = new THREE.Mesh(new THREE.BoxGeometry(railSegLen, 0.2, 0.3), frameMat);
        railT.position.set(px, h - 0.1, pz);
        railT.rotation.y = theta;

        root.add(railB, railT);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 33. Grand Roman Arched Door
    // ----------------------------------------------------------------------------------
    case "door_roman_arch": {
      const w = 4.0;
      const frameThick = 0.5;
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4 });
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.85,
        opacity: 1,
        transparent: true,
        roughness: 0.1,
      });

      const jambH = 6.0;
      const archR = w / 2;

      // Left & Right Vertical Frame Jambs
      const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.3, jambH, frameThick), frameMat);
      jambL.position.set(-w / 2 + 0.15, jambH / 2, 0);
      const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.3, jambH, frameThick), frameMat);
      jambR.position.set(w / 2 - 0.15, jambH / 2, 0);
      root.add(jambL, jambR);

      // Semicircular Arch Transom Frame
      const archCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(archR, archR, frameThick, 24, 1, false, 0, Math.PI),
        frameMat
      );
      archCylinder.rotation.z = Math.PI / 2;
      archCylinder.rotation.y = Math.PI / 2;
      archCylinder.position.set(0, jambH, 0);
      root.add(archCylinder);

      // Glass inside the Arch Transom
      const archGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(archR - 0.2, archR - 0.2, 0.1, 20, 1, false, 0, Math.PI),
        glassMat
      );
      archGlass.rotation.z = Math.PI / 2;
      archGlass.rotation.y = Math.PI / 2;
      archGlass.position.set(0, jambH, 0);
      root.add(archGlass);

      // Door Leaf Panel
      const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, jambH - 0.1, 0.15), doorMat);
      doorLeaf.position.set(0, (jambH - 0.1) / 2, 0);
      doorLeaf.castShadow = true;
      root.add(doorLeaf);

      // Brass Handle Lever
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.25), brassMat);
      handle.position.set(w / 2 - 0.6, 3.2, 0.1);
      root.add(handle);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 34. Luxury Curved Glass Revolving Door
    // ----------------------------------------------------------------------------------
    case "door_revolving_curved": {
      const radius = 3.0;
      const h = 8.5;
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.25 });
      const brassTrim = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.9,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
      });

      // Top Ceiling Canopy Drum
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.2, radius + 0.2, 0.4, 32), metalMat);
      canopy.position.set(0, h - 0.2, 0);
      const canopyTrim = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.2, 0.05, 8, 32), brassTrim);
      canopyTrim.rotation.x = Math.PI / 2;
      canopyTrim.position.set(0, h - 0.4, 0);
      root.add(canopy, canopyTrim);

      // Left & Right Curved Glass Enclosure Shells
      const drumL = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, h - 0.5, 24, 1, true, Math.PI * 0.15, Math.PI * 0.7),
        glassMat
      );
      drumL.position.set(0, (h - 0.5) / 2, 0);
      const drumR = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, h - 0.5, 24, 1, true, Math.PI * 1.15, Math.PI * 0.7),
        glassMat
      );
      drumR.position.set(0, (h - 0.5) / 2, 0);
      root.add(drumL, drumR);

      // Central Rotating Pivot Column
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h - 0.5, 16), metalMat);
      spindle.position.set(0, (h - 0.5) / 2, 0);
      root.add(spindle);

      // 4 Radial Rotating Glass Wings
      for (let w = 0; w < 4; w++) {
        const wingAngle = (w * Math.PI) / 2;
        const wingGlass = new THREE.Mesh(
          new THREE.BoxGeometry(radius - 0.2, h - 0.6, 0.05),
          glassMat
        );
        wingGlass.position.set(
          ((radius - 0.2) / 2) * Math.cos(wingAngle),
          (h - 0.6) / 2,
          ((radius - 0.2) / 2) * Math.sin(wingAngle)
        );
        wingGlass.rotation.y = -wingAngle;

        // Push Bar
        const bar = new THREE.Mesh(new THREE.BoxGeometry(radius - 0.5, 0.08, 0.12), brassTrim);
        bar.position.set(
          ((radius - 0.2) / 2) * Math.cos(wingAngle),
          3.2,
          ((radius - 0.2) / 2) * Math.sin(wingAngle)
        );
        bar.rotation.y = -wingAngle;

        root.add(wingGlass, bar);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 35. Panoramic Curved Bow Window
    // ----------------------------------------------------------------------------------
    case "window_curved_bow": {
      const radius = 4.5;
      const arcAngle = Math.PI / 2.2;
      const h = 5.5;
      const paneCount = 5;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.75, roughness: 0.25 });
      const sillMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.88,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
      });

      const dTheta = arcAngle / paneCount;
      const paneLen = 2 * radius * Math.sin(dTheta / 2) + 0.02;

      for (let p = 0; p < paneCount; p++) {
        const theta = -arcAngle / 2 + (p + 0.5) * dTheta;
        const px = radius * Math.sin(theta);
        const pz = -radius * Math.cos(theta) + radius * Math.cos(arcAngle / 2);

        // Glass Pane
        const glass = new THREE.Mesh(new THREE.BoxGeometry(paneLen - 0.08, h - 0.3, 0.06), glassMat);
        glass.position.set(px, h / 2, pz);
        glass.rotation.y = theta;

        // Pane Mullion Frame
        const frameB = new THREE.Mesh(new THREE.BoxGeometry(paneLen, 0.12, 0.15), frameMat);
        frameB.position.set(px, 0.06, pz);
        frameB.rotation.y = theta;

        const frameT = new THREE.Mesh(new THREE.BoxGeometry(paneLen, 0.12, 0.15), frameMat);
        frameT.position.set(px, h - 0.06, pz);
        frameT.rotation.y = theta;

        root.add(glass, frameB, frameT);
      }

      // Curved Sill Ledge
      const sill = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 2.2), sillMat);
      sill.position.set(0, 0, 0.4);
      root.add(sill);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 36. Curved Waterfall Kitchen Island
    // ----------------------------------------------------------------------------------
    case "counter_curved_island": {
      const w = 7.5;
      const d = 3.5;
      const h = 3.0;
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.1 });
      const woodBaseMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
      const brassTrim = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });

      // Curved End Cylinder Pillars
      const endRadius = d / 2;
      const endL = new THREE.Mesh(new THREE.CylinderGeometry(endRadius, endRadius, h, 24), woodBaseMat);
      endL.position.set(-w / 2 + endRadius, h / 2, 0);
      endL.castShadow = true;

      const endR = new THREE.Mesh(new THREE.CylinderGeometry(endRadius, endRadius, h, 24), woodBaseMat);
      endR.position.set(w / 2 - endRadius, h / 2, 0);
      endR.castShadow = true;

      // Central Base Box
      const centerBase = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * endRadius, h, d), woodBaseMat);
      centerBase.position.set(0, h / 2, 0);
      centerBase.castShadow = true;

      root.add(endL, endR, centerBase);

      // Fluted Vertical Slats on Base
      for (let s = 0; s < 18; s++) {
        const theta = (s / 18) * Math.PI * 2;
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.2, 0.08), brassTrim);
        slat.position.set(
          -w / 2 + endRadius + (endRadius + 0.02) * Math.cos(theta),
          h / 2,
          (endRadius + 0.02) * Math.sin(theta)
        );
        root.add(slat);
      }

      // Curved Polished Marble Countertop
      const counterTopL = new THREE.Mesh(
        new THREE.CylinderGeometry(endRadius + 0.2, endRadius + 0.2, 0.25, 24),
        marbleMat
      );
      counterTopL.position.set(-w / 2 + endRadius, h + 0.125, 0);

      const counterTopR = new THREE.Mesh(
        new THREE.CylinderGeometry(endRadius + 0.2, endRadius + 0.2, 0.25, 24),
        marbleMat
      );
      counterTopR.position.set(w / 2 - endRadius, h + 0.125, 0);

      const counterTopMid = new THREE.Mesh(
        new THREE.BoxGeometry(w - 2 * endRadius, 0.25, d + 0.4),
        marbleMat
      );
      counterTopMid.position.set(0, h + 0.125, 0);

      root.add(counterTopL, counterTopR, counterTopMid);
      break;
    }

    // ----------------------------------------------------------------------------------
    // 37. Curved Spiral Helical Staircase
    // ----------------------------------------------------------------------------------
    case "staircase_spiral_curved": {
      const radius = 3.0;
      const totalH = 10.0;
      const stepCount = 16;
      const totalRot = Math.PI * 1.5; // 270 deg spiral
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.2 });
      const woodTreadMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.88,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
      });

      // Central Steel Pillar Column
      const centerPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, totalH, 20), steelMat);
      centerPillar.position.set(0, totalH / 2, 0);
      root.add(centerPillar);

      // Helical Floating Treads
      const dH = totalH / stepCount;
      const dRot = totalRot / stepCount;

      for (let s = 0; s < stepCount; s++) {
        const stepH = (s + 0.5) * dH;
        const stepAngle = s * dRot;

        // Step Tread
        const tread = new THREE.Mesh(new THREE.BoxGeometry(radius - 0.3, 0.15, 0.8), woodTreadMat);
        tread.position.set(
          ((radius - 0.3) / 2 + 0.3) * Math.cos(stepAngle),
          stepH,
          ((radius - 0.3) / 2 + 0.3) * Math.sin(stepAngle)
        );
        tread.rotation.y = -stepAngle;
        tread.castShadow = true;
        root.add(tread);

        // Outer Baluster Post & Glass Railing Segment
        const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8), steelMat);
        baluster.position.set(
          radius * Math.cos(stepAngle),
          stepH + 1.5,
          radius * Math.sin(stepAngle)
        );
        root.add(baluster);

        if (s < stepCount - 1) {
          const nextAngle = (s + 1) * dRot;
          const glassSeg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.04), glassMat);
          glassSeg.position.set(
            radius * Math.cos((stepAngle + nextAngle) / 2),
            stepH + 1.5,
            radius * Math.sin((stepAngle + nextAngle) / 2)
          );
          glassSeg.rotation.y = -((stepAngle + nextAngle) / 2);
          root.add(glassSeg);
        }
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // Haute Fireplace & Recessed Bookshelf Wall
    // ----------------------------------------------------------------------------------
    case "wall_fireplace_bookshelf": {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const fireboxMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const bookColors = [0x991b1b, 0x1e3a8a, 0x14532d, 0x78350f, 0x312e81, 0x0f766e];

      // Central Wall Panel
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(14.0, 9.0, 0.4), wallMat);
      wallMesh.position.set(0, 4.5, 0);
      root.add(wallMesh);

      // Classical Fireplace Mantel
      const mantel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.8, 1.2), wallMat);
      mantel.position.set(0, 1.9, 0.4);
      root.add(mantel);

      const mantelShelf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 1.4), wallMat);
      mantelShelf.position.set(0, 3.8, 0.4);
      root.add(mantelShelf);

      // Firebox Opening & Glowing Embers
      const firebox = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.4, 0.8), fireboxMat);
      firebox.position.set(0, 1.4, 0.6);
      root.add(firebox);

      const embers = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 0.5), emberMat);
      embers.position.set(0, 0.35, 0.6);
      root.add(embers);

      // Flanking Bookshelves (Left: x = -4.5, Right: x = 4.5)
      [-4.5, 4.5].forEach((shelfX) => {
        // Shelf frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 8.2, 1.0), wallMat);
        frame.position.set(shelfX, 4.3, 0.3);
        root.add(frame);

        // 4 Horizontal Tiers
        for (let t = 0; t < 4; t++) {
          const tierY = 1.2 + t * 1.8;
          const tier = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 0.9), shelfMat);
          tier.position.set(shelfX, tierY, 0.35);
          root.add(tier);

          // Books on shelves
          for (let b = 0; b < 10; b++) {
            const bCol = bookColors[(t * 3 + b) % bookColors.length];
            const bookMat = new THREE.MeshStandardMaterial({ color: bCol, roughness: 0.7 });
            const bookH = 0.8 + (b % 3) * 0.2;
            const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, bookH, 0.65), bookMat);
            book.position.set(shelfX - 1.6 + b * 0.36, tierY + bookH / 2 + 0.08, 0.35);
            root.add(book);
          }
        }
      });
      break;
    }

    // ----------------------------------------------------------------------------------
    // Indoor Architectural Planter Divider
    // ----------------------------------------------------------------------------------
    case "partition_planter_cacti": {
      const planterMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x271c19, roughness: 0.95 });
      const plantMat1 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 });
      const plantMat2 = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.65 });

      // Planter Box Trough
      const box = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.8, 1.5), planterMat);
      box.position.set(0, 0.9, 0);
      root.add(box);

      const soil = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.1, 1.3), soilMat);
      soil.position.set(0, 1.75, 0);
      root.add(soil);

      // Vertical Snake Plants & Cacti
      for (let p = 0; p < 14; p++) {
        const px = -2.4 + p * 0.38 + (p % 2) * 0.05;
        const pz = (p % 3 - 1) * 0.3;
        const pH = 2.2 + (p % 4) * 0.7;
        const pMat = p % 2 === 0 ? plantMat1 : plantMat2;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, pH, 8), pMat);
        stalk.position.set(px, 1.8 + pH / 2, pz);
        stalk.rotation.z = ((p % 5) - 2) * 0.04;
        root.add(stalk);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // 10-Seater Nero Marquina Dining Set
    // ----------------------------------------------------------------------------------
    case "dining_table_nero_marquina": {
      const marquinaMat = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.12,
        metalness: 0.15,
      });
      const chairMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.75 });
      const legMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });

      // Oval Nero Marquina Table Top (10ft × 4.2ft × 0.15ft)
      const topGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.15, 32);
      topGeo.scale(2.4, 1.0, 1.0);
      const topMesh = new THREE.Mesh(topGeo, marquinaMat);
      topMesh.position.set(0, 2.6, 0);
      topMesh.castShadow = true;
      root.add(topMesh);

      // Twin Brass Conical Pedestal Bases
      [-2.4, 2.4].forEach((bx) => {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.0, 2.5, 24), legMat);
        base.position.set(bx, 1.25, 0);
        root.add(base);
      });

      // 10 Dining Chairs Around Table
      const chairPositions: [number, number, number][] = [
        [-3.6, -1.8, 0], [-1.2, -1.8, 0], [1.2, -1.8, 0], [3.6, -1.8, 0],
        [-3.6, 1.8, Math.PI], [-1.2, 1.8, Math.PI], [1.2, 1.8, Math.PI], [3.6, 1.8, Math.PI],
        [-4.8, 0, Math.PI / 2], [4.8, 0, -Math.PI / 2],
      ];

      chairPositions.forEach(([cx, cz, crot]) => {
        const chair = new THREE.Group();
        chair.position.set(cx, 0, cz);
        chair.rotation.y = crot;

        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16), chairMat);
        seat.position.y = 1.4;
        chair.add(seat);

        const back = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 16, 1, true, 0, Math.PI), chairMat);
        back.position.set(0, 2.0, 0);
        chair.add(back);

        for (const lx of [-0.45, 0.45]) {
          for (const lz of [-0.45, 0.45]) {
            const cleg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.35, 8), legMat);
            cleg.position.set(lx, 0.68, lz);
            chair.add(cleg);
          }
        }
        root.add(chair);
      });
      break;
    }

    // ----------------------------------------------------------------------------------
    // Haute Bouclé Curved Living Set
    // ----------------------------------------------------------------------------------
    case "sofa_boucle_curved_set": {
      const boucleMat = new THREE.MeshStandardMaterial({ color: 0xfaf5ee, roughness: 0.88 });
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe2d9cc, roughness: 0.9 });
      const teakMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.45 });
      const rugMat = new THREE.MeshStandardMaterial({ color: 0xf5efe6, roughness: 0.95 });

      // Textured Geometric Cream Area Rug (11.5ft × 8.5ft)
      const rug = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.03, 8.5), rugMat);
      rug.position.set(0, 0.02, 0);
      root.add(rug);

      // Sinuous Curved Bouclé Crescent Sofa (3 smoothly joined segments)
      const sofaArc = new THREE.Group();
      sofaArc.position.set(0, 0, -1.2);

      const numSegs = 7;
      const arcR = 4.8;
      const angleSpan = Math.PI * 0.65;

      for (let i = 0; i < numSegs; i++) {
        const t = (i / (numSegs - 1) - 0.5) * angleSpan;
        const sx = arcR * Math.sin(t);
        const sz = arcR * (1 - Math.cos(t));

        const seatSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 16), boucleMat);
        seatSeg.position.set(sx, 0.7, sz);
        sofaArc.add(seatSeg);

        const backSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 16), boucleMat);
        backSeg.position.set(sx * 1.12, 1.4, sz * 1.12 - 0.3);
        sofaArc.add(backSeg);

        if (i % 2 === 0) {
          const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), cushionMat);
          pillow.scale.set(1.0, 0.8, 0.6);
          pillow.position.set(sx, 1.2, sz - 0.1);
          sofaArc.add(pillow);
        }
      }
      root.add(sofaArc);

      // Facing Petite Bouclé Armchair
      const chair = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.1, 20), boucleMat);
      chair.position.set(-3.2, 0.7, 2.0);
      chair.rotation.y = Math.PI * 0.3;
      root.add(chair);

      // Sculpted Organic Teak Coffee Table
      const table = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.7, 24), teakMat);
      table.scale.set(1.8, 1.0, 1.1);
      table.position.set(0.4, 0.45, 1.0);
      root.add(table);
      break;
    }

    // ----------------------------------------------------------------------------------
    // Floor-to-Ceiling Smoked Walnut Kitchen Wall
    // ----------------------------------------------------------------------------------
    case "kitchen_walnut_wall": {
      const walnutMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.45 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });

      // Main Tall Cabinet Wall Unit (12ft × 9ft × 2.2ft)
      const main = new THREE.Mesh(new THREE.BoxGeometry(12.0, 9.0, 2.0), walnutMat);
      main.position.set(0, 4.5, 0);
      root.add(main);

      // Integrated Double-Door Refrigerator (Center: x = 0)
      const fridge = new THREE.Mesh(new THREE.BoxGeometry(3.6, 7.0, 0.3), steelMat);
      fridge.position.set(0, 3.8, 1.0);
      root.add(fridge);

      // Refrigerator Handles
      [-0.4, 0.4].forEach((hx) => {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8), steelMat);
        handle.position.set(hx, 3.8, 1.25);
        root.add(handle);
      });

      // Built-in Double Oven Tower (Left: x = -3.8)
      const oven1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.2), glassMat);
      oven1.position.set(-3.8, 3.0, 1.05);
      root.add(oven1);

      const oven2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.2), glassMat);
      oven2.position.set(-3.8, 5.2, 1.05);
      root.add(oven2);

      // Vertical Slat Accent Screen (Right: x = 4.2)
      for (let s = 0; s < 6; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.5, 0.4), slatMat);
        slat.position.set(3.4 + s * 0.38, 4.5, 1.1);
        root.add(slat);
      }
      break;
    }

    // ----------------------------------------------------------------------------------
    // Organic Pebble Gilded Brass Wall Mirror
    // ----------------------------------------------------------------------------------
    case "mirror_pebble_gilded": {
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
      const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.05 });

      const frameGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.2, 32);
      frameGeo.scale(1.2, 1.0, 0.9);
      const frame = new THREE.Mesh(frameGeo, brassMat);
      frame.rotation.x = Math.PI / 2;
      frame.position.set(0, 1.8, 0);
      root.add(frame);

      const glassGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.05, 32);
      glassGeo.scale(1.2, 1.0, 0.9);
      const glass = new THREE.Mesh(glassGeo, mirrorMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(0, 1.8, 0.1);
      root.add(glass);
      break;
    }

    // ----------------------------------------------------------------------------------
    // Cafe & small restaurant
    // ----------------------------------------------------------------------------------
    case "cafe_two_top": {
      const topR = 1.25;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(topR, topR, 0.14, 24), walnutMat);
      top.position.y = 2.42;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.35, 12), darkWoodMat);
      column.position.y = 1.2;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.1, 20), darkWoodMat);
      foot.position.y = 0.05;
      root.add(top, column, foot);

      for (const side of [-1, 1]) {
        const cz = side * 2.05;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 1.4), fabricMat);
        seat.position.set(0, 1.48, cz);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.55, 0.14), fabricMat);
        back.position.set(0, 2.3, cz + side * 0.62);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.05), darkWoodMat);
        frame.position.set(0, 0.7, cz);
        root.add(seat, back, frame);
      }
      break;
    }

    case "cafe_communal_table": {
      const w = 8.0;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 3.0), walnutMat);
      top.position.y = 2.44;
      root.add(top);

      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.35, 2.6), darkWoodMat);
        leg.position.set(sx * (w / 2 - 0.6), 1.18, 0);
        root.add(leg);

        const bench = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.22, 1.2), walnutMat);
        bench.position.set(0, 1.48, sx * 2.2);
        root.add(bench);

        for (const bx of [-1, 1]) {
          const benchLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.4, 1.0), darkWoodMat);
          benchLeg.position.set(bx * (w / 2 - 1.1), 0.7, sx * 2.2);
          root.add(benchLeg);
        }
      }
      break;
    }

    case "cafe_banquette_run": {
      const w = 8.0;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, 2.4), fabricMat);
      seat.position.set(0, 0.68, 0);
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.3, 2.2), cushionMat);
      cushion.position.set(0, 1.5, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.5), fabricMat);
      back.position.set(0, 2.4, -1.2);
      root.add(seat, cushion, back);

      // Buttoned tufting, three points along the back
      for (let i = -1; i <= 1; i++) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brassMat);
        button.position.set(i * (w / 4), 2.6, -0.94);
        root.add(button);
      }
      break;
    }

    case "cafe_bar_stool": {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.24, 20), fabricMat);
      seat.position.y = 3.4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.3, 12), chromeMat);
      post.position.y = 1.7;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.1, 20), chromeMat);
      base.position.y = 0.05;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), chromeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      root.add(seat, post, base, ring);
      break;
    }

    case "cafe_display_case": {
      const caseGlass = new THREE.MeshStandardMaterial({
        color: 0xdfefff,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.3,
      });
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.6, 2.2), chromeMat);
      plinth.position.y = 1.3;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 2.2), chromeMat);
      deck.position.y = 2.66;
      const vitrine = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.8, 2.1), caseGlass);
      vitrine.position.y = 3.6;
      root.add(plinth, deck, vitrine);

      // Two trays of stock so the case does not read as an empty box
      for (const y of [3.1, 3.9]) {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.6), chromeMat);
        tray.position.y = y;
        root.add(tray);
        for (let i = -1; i <= 1; i++) {
          const pastry = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xd8a05a, roughness: 0.8 })
          );
          pastry.scale.set(1.3, 0.7, 1.0);
          pastry.position.set(i * 1.1, y + 0.2, 0);
          root.add(pastry);
        }
      }
      break;
    }

    case "cafe_planter_divider": {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, 1.4), darkWoodMat);
      frame.position.y = 2.6;
      root.add(frame);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.0, 0.2), darkWoodMat);
        post.position.set(sx * 2.4, 2.5, 0);
        root.add(post);
      }
      const trough = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 1.2), walnutMat);
      trough.position.y = 0.55;
      root.add(trough);

      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.9 });
      for (let i = -2; i <= 2; i++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), foliageMat);
        bush.scale.set(1.0, 1.4, 0.8);
        bush.position.set(i * 0.95, 1.7, 0);
        root.add(bush);
      }
      break;
    }

    case "cafe_menu_board": {
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x1f2733, roughness: 0.85 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.0, 0.16), boardMat);
      board.position.y = 6.0;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 0.08), walnutMat);
      trim.position.set(0, 6.0, -0.06);
      root.add(board, trim);

      // Three chalked menu lines
      const chalkMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.95 });
      for (let i = 0; i < 3; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(3.6 - i * 0.6, 0.14, 0.02), chalkMat);
        line.position.set(-0.3, 6.8 - i * 0.75, 0.1);
        root.add(line);
      }

      for (const sx of [-1, 1]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), brassMat);
        rod.position.set(sx * 2.2, 8.3, 0);
        root.add(rod);
      }
      break;
    }

    case "cafe_four_top": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 3.0), walnutMat);
      top.position.y = 2.42;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.35, 12), darkWoodMat);
      column.position.y = 1.2;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.1, 20), darkWoodMat);
      foot.position.y = 0.05;
      root.add(top, column, foot);

      const chairAt = (x: number, z: number, ry: number) => {
        const chair = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 1.4), fabricMat);
        seat.position.y = 1.48;
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.55, 0.14), fabricMat);
        back.position.set(0, 2.3, -0.62);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.05), darkWoodMat);
        frame.position.y = 0.7;
        chair.add(seat, back, frame);
        chair.position.set(x, 0, z);
        chair.rotation.y = ry;
        root.add(chair);
      };
      chairAt(0, 2.2, Math.PI);
      chairAt(0, -2.2, 0);
      chairAt(2.2, 0, -Math.PI / 2);
      chairAt(-2.2, 0, Math.PI / 2);
      break;
    }

    case "cafe_window_bar": {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.2, 1.4), walnutMat);
      ledge.position.set(0, 3.5, 0);
      root.add(ledge);

      for (const sx of [-1, 1]) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 1.1), chromeMat);
        bracket.position.set(sx * 3.4, 2.9, -0.15);
        root.add(bracket);
      }

      for (let i = -1; i <= 1; i++) {
        const stool = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 18), fabricMat);
        seat.position.y = 2.6;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 10), chromeMat);
        post.position.y = 1.3;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.75, 0.1, 18), chromeMat);
        base.position.y = 0.05;
        stool.add(seat, post, base);
        stool.position.set(i * 2.4, 0, 1.4);
        root.add(stool);
      }
      break;
    }

    case "cafe_lounge_armchair": {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 2.4), fabricMat);
      seat.position.y = 1.25;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 2.1), cushionMat);
      cushion.position.y = 1.65;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.45), fabricMat);
      back.position.set(0, 2.2, -1.0);
      root.add(seat, cushion, back);

      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 2.2), fabricMat);
        arm.position.set(sx * 1.1, 1.75, 0.1);
        root.add(arm);
        for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 1.0, 8), walnutMat);
          leg.position.set(sx * 1.0, 0.5, sz * 1.0);
          root.add(leg);
        }
      }
      break;
    }

    case "cafe_espresso_station": {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 2.2), chromeMat);
      bench.position.y = 1.6;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 2.3), chromeMat);
      deck.position.y = 3.27;
      root.add(bench, deck);

      // Two-group machine
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.5, 1.6), chromeMat);
      body.position.set(-0.6, 4.1, 0);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.5, 0.1), darkWoodMat);
      panel.position.set(-0.6, 4.5, 0.82);
      root.add(body, panel);
      for (const gx of [-1.2, 0.0]) {
        const group = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), chromeMat);
        group.position.set(gx, 3.7, 0.55);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.6), darkWoodMat);
        handle.position.set(gx, 3.55, 0.95);
        root.add(group, handle);
      }

      // Grinder and knock box
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.0, 14), darkWoodMat);
      hopper.position.set(1.7, 4.6, 0);
      const grinder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 1.0), chromeMat);
      grinder.position.set(1.7, 3.95, 0);
      const knock = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 14), darkWoodMat);
      knock.position.set(0.9, 3.64, 0.6);
      root.add(hopper, grinder, knock);
      break;
    }

    case "cafe_pos_counter": {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.3, 2.0), darkWoodMat);
      plinth.position.y = 1.65;
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 2.2), walnutMat);
      top.position.y = 3.4;
      root.add(plinth, top);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.12), fabricMat);
      screen.position.set(0, 4.1, -0.2);
      screen.rotation.x = -0.22;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.55, 10), chromeMat);
      stand.position.set(0, 3.72, -0.2);
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.6), chromeMat);
      drawer.position.set(0, 3.0, 0.1);
      root.add(screen, stand, drawer);
      break;
    }

    case "cafe_condiment_station": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.0, 1.8), walnutMat);
      body.position.y = 1.5;
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 2.0), darkWoodMat);
      top.position.y = 3.08;
      const bin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.2), chromeMat);
      bin.position.set(1.2, 3.3, 0);
      root.add(body, top, bin);

      // Milk jugs and a napkin caddy
      for (let i = 0; i < 2; i++) {
        const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12), chromeMat);
        jug.position.set(-1.2 + i * 0.7, 3.5, 0.1);
        root.add(jug);
      }
      const caddy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.7), chromeMat);
      caddy.position.set(0.2, 3.33, -0.2);
      root.add(caddy);
      break;
    }

    case "cafe_retail_shelf": {
      const frameMat = darkWoodMat;
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.0, 1.3), frameMat);
        post.position.set(sx * 1.9, 3.0, 0);
        root.add(post);
      }
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x8d6e5a, roughness: 0.85 });
      for (let s = 0; s < 4; s++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 1.3), walnutMat);
        shelf.position.y = 1.1 + s * 1.5;
        root.add(shelf);
        for (let i = -1; i <= 1; i++) {
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.5), bagMat);
          bag.position.set(i * 1.2, 1.65 + s * 1.5, 0);
          root.add(bag);
        }
      }
      break;
    }

    case "cafe_pendant_cluster": {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.3), darkWoodMat);
      rail.position.y = 8.4;
      root.add(rail);
      for (let i = -1; i <= 1; i++) {
        const drop = 0.8 + Math.abs(i) * 0.5;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, drop, 6), darkWoodMat);
        cord.position.set(i * 1.5, 8.35 - drop / 2, 0);
        const shade = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 0.7, 18, 1, true),
          new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.4, side: THREE.DoubleSide })
        );
        shade.position.set(i * 1.5, 8.35 - drop - 0.3, 0);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffca6a, emissiveIntensity: 1.5 })
        );
        bulb.position.set(i * 1.5, 8.35 - drop - 0.55, 0);
        root.add(cord, shade, bulb);
      }
      const glow = new THREE.PointLight(0xffc978, 0.7, 16, 1.6);
      glow.position.set(0, 6.6, 0);
      root.add(glow);
      break;
    }

    case "cafe_neon_sign": {
      const neonColor = customColor ?? 0xff5da2;
      const backing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.12), darkWoodMat);
      backing.position.y = 5.2;
      root.add(backing);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: neonColor,
        emissive: neonColor,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      // A looping script suggested with torus arcs and a connecting bar
      for (let i = -1; i <= 1; i++) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 20, Math.PI * 1.5), tubeMat);
        loop.position.set(i * 1.2, 5.3, 0.12);
        loop.rotation.z = -0.4;
        root.add(loop);
      }
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.12), tubeMat);
      stroke.position.set(0, 4.5, 0.12);
      root.add(stroke);

      const wash = new THREE.PointLight(neonColor, 0.8, 12, 1.8);
      wash.position.set(0, 5.2, 0.9);
      root.add(wash);
      break;
    }

    case "cafe_wall_art": {
      const matteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
      const artMat = new THREE.MeshStandardMaterial({ color: 0x8a6f5a, roughness: 0.85 });
      for (let i = -1; i <= 1; i++) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.12), darkWoodMat);
        frame.position.set(i * 1.7, 5.0, 0);
        const mount = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 0.04), matteMat);
        mount.position.set(i * 1.7, 5.0, 0.08);
        const art = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.25, 0.02), artMat);
        art.position.set(i * 1.7, 5.0, 0.11);
        root.add(frame, mount, art);
      }
      break;
    }

    case "cafe_floor_plant": {
      const potMat = new THREE.MeshStandardMaterial({ color: 0x9c6b4f, roughness: 0.8 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.9 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 2.0, 18), potMat);
      pot.position.y = 1.0;
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 18), darkWoodMat);
      soil.position.y = 2.0;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), darkWoodMat);
      stem.position.y = 3.7;
      root.add(pot, soil, stem);

      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), leafMat);
        leaf.scale.set(1.0, 0.35, 1.4);
        const a = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.75, 4.2 + (i % 3) * 0.75, Math.sin(a) * 0.75);
        leaf.rotation.y = a;
        leaf.rotation.z = 0.35;
        root.add(leaf);
      }
      break;
    }

    case "cafe_bookshelf": {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.4, 1.1), darkWoodMat);
        post.position.set(sx * 2.4, 3.2, 0);
        root.add(post);
      }
      const bookColors = [0x8c3b3b, 0x2f4f6d, 0x6b7f4a, 0xb08442, 0x5a4a6b];
      for (let s = 0; s < 4; s++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 1.1), walnutMat);
        shelf.position.y = 1.0 + s * 1.6;
        root.add(shelf);
        for (let b = 0; b < 8; b++) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.95 + (b % 3) * 0.12, 0.75),
            new THREE.MeshStandardMaterial({ color: bookColors[(s + b) % bookColors.length], roughness: 0.85 })
          );
          book.position.set(-2.0 + b * 0.24, 1.58 + s * 1.6, 0);
          root.add(book);
        }
        if (s % 2 === 1) {
          const trail = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.9 })
          );
          trail.scale.set(1.0, 0.8, 0.8);
          trail.position.set(1.7, 1.5 + s * 1.6, 0);
          root.add(trail);
        }
      }
      break;
    }

    case "cafe_a_frame": {
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x1f2733, roughness: 0.9 });
      const chalkMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.95 });
      for (const sz of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.12), boardMat);
        panel.position.set(0, 1.7, sz * 0.45);
        panel.rotation.x = sz * 0.22;
        root.add(panel);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.06), walnutMat);
        trim.position.set(0, 1.7, sz * 0.53);
        trim.rotation.x = sz * 0.22;
        root.add(trim);
        for (let i = 0; i < 3; i++) {
          const line = new THREE.Mesh(new THREE.BoxGeometry(1.5 - i * 0.3, 0.1, 0.02), chalkMat);
          line.position.set(-0.15, 2.5 - i * 0.6, sz * 0.52);
          line.rotation.x = sz * 0.22;
          root.add(line);
        }
      }
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8), brassMat);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.y = 3.35;
      root.add(hinge);
      break;
    }

    case "cafe_reach_in_fridge": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 6.2, 2.8), chromeMat);
      body.position.y = 3.4;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 2.8), darkWoodMat);
      plinth.position.y = 0.2;
      const vent = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.1), darkWoodMat);
      vent.position.set(0, 6.2, 1.42);
      root.add(body, plinth, vent);

      const glassDoorMat = new THREE.MeshStandardMaterial({
        color: 0xdfefff,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.32,
      });
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.6, 0.1), glassDoorMat);
      door.position.set(0, 3.6, 1.42);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 0.12), chromeMat);
      handle.position.set(1.1, 3.6, 1.55);
      root.add(door, handle);
      break;
    }

    case "cafe_prep_table": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.16, 2.6), chromeMat);
      top.position.y = 2.95;
      const under = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 2.2), chromeMat);
      under.position.y = 0.9;
      root.add(top, under);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 10), chromeMat);
          leg.position.set(sx * 2.7, 1.45, sz * 1.1);
          root.add(leg);
        }
      }
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.3), walnutMat);
      board.position.set(-1.5, 3.09, 0);
      root.add(board);
      break;
    }

    case "cafe_dunnage_rack": {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 10), chromeMat);
          post.position.set(sx * 2.4, 3.2, sz * 0.7);
          root.add(post);
        }
      }
      const cratMat = new THREE.MeshStandardMaterial({ color: 0x8d6e5a, roughness: 0.9 });
      for (let s = 0; s < 4; s++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.1, 1.6), chromeMat);
        shelf.position.y = 0.8 + s * 1.7;
        root.add(shelf);
        for (let i = -1; i <= 1; i++) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.2), cratMat);
          crate.position.set(i * 1.5, 1.25 + s * 1.7, 0);
          root.add(crate);
        }
      }
      break;
    }

    case "cafe_ice_machine": {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 2.6), chromeMat);
      bin.position.y = 1.5;
      const maker = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), chromeMat);
      maker.position.y = 4.1;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.7), darkWoodMat);
      seam.position.y = 3.02;
      const scoopDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.1), darkWoodMat);
      scoopDoor.position.set(0, 2.1, 1.32);
      root.add(bin, maker, seam, scoopDoor);
      break;
    }

    case "cafe_patio_set": {
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x6b7f6a, roughness: 0.5, metalness: 0.4 });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.14, 20), metalMat);
      top.position.y = 2.42;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.35, 10), metalMat);
      post.position.y = 1.2;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.12, 18), metalMat);
      foot.position.y = 0.06;
      root.add(top, post, foot);

      for (const side of [-1, 1]) {
        const chair = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 16), metalMat);
        seat.position.y = 1.5;
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 0.12), metalMat);
        back.position.set(0, 2.3, -0.6);
        chair.add(seat, back);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.45, 8), metalMat);
          leg.position.set(Math.cos(a) * 0.5, 0.73, Math.sin(a) * 0.5);
          chair.add(leg);
        }
        chair.position.set(0, 0, side * 2.4);
        chair.rotation.y = side > 0 ? Math.PI : 0;
        root.add(chair);
      }

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7.4, 10), walnutMat);
      mast.position.y = 3.7;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xe0d5c0, roughness: 0.9, side: THREE.DoubleSide })
      );
      canopy.position.y = 7.0;
      root.add(mast, canopy);
      break;
    }

    case "cafe_bollard_rope": {
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb08442, roughness: 0.9 });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.0, 12), brassMat);
        post.position.set(sx * 3.0, 1.5, 0);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), brassMat);
        cap.position.set(sx * 3.0, 3.1, 0);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.16, 16), darkWoodMat);
        base.position.set(sx * 3.0, 0.08, 0);
        root.add(post, cap, base);
      }
      // Slung rope, approximated as three segments dipping in the middle
      const spans: [number, number, number][] = [
        [-2.0, 2.35, 0.35],
        [0.0, 2.1, 0.0],
        [2.0, 2.35, -0.35],
      ];
      for (const [x, y, tilt] of spans) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 8), ropeMat);
        seg.rotation.z = Math.PI / 2 + tilt;
        seg.position.set(x, y, 0);
        root.add(seg);
      }
      break;
    }

    case "cafe_bike_rack": {
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.45, metalness: 0.7 });
      for (let i = -1; i <= 1; i++) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 10, 20, Math.PI), rackMat);
        hoop.position.set(i * 2.0, 1.5, 0);
        root.add(hoop);
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 10), rackMat);
          leg.position.set(i * 2.0 + sx * 1.0, 0.75, 0);
          root.add(leg);
        }
      }
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
