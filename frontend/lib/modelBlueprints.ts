import { Facing } from "./plot";
import { RoomName } from "./rooms";
import { RoomOpening } from "./solve";
import { CustomDim } from "@/components/RoomCustomizer";

export interface ModelBlueprint {
  id: string;
  name: string;
  type: "1BHK" | "2BHK" | "3BHK" | "4BHK";
  plotSizeLabel: string;
  plotWidthFt: number;
  plotDepthFt: number;
  facing: Facing;
  builtUpAreaSqFt: number;
  totalSqFt: number;
  vaastuRating: string;
  description: string;
  highlights: string[];
  counts: Record<RoomName, number>;
  customDims: Record<string, CustomDim>;
  customOpenings?: Record<string, RoomOpening[]>;
  customWallThickness?: Record<string, number>;
}

export const MODEL_BLUEPRINTS: ModelBlueprint[] = [
  // 1. 20x30 (600 sq ft) — 1BHK Urban Sanctuary
  {
    id: "20x30_1bhk_north",
    name: "Urban 1BHK Studio Sanctuary",
    type: "1BHK",
    plotSizeLabel: "20×30 (600 sq ft)",
    plotWidthFt: 20,
    plotDepthFt: 30,
    facing: "N",
    builtUpAreaSqFt: 420,
    totalSqFt: 600,
    vaastuRating: "100% Vaastu Compliant",
    description:
      "A smart, ultra-efficient compact home designed for urban plots. Features an airy front living room, a Vaastu-compliant South-East kitchen, and a private master bedroom suite.",
    highlights: [
      "Open-concept Living & Dining",
      "Agni Kitchen in South-East",
      "Master Suite in South-West",
      "Zero Corridor Space Waste",
    ],
    counts: {
      hall: 1,
      kitchen: 1,
      dining: 0,
      bedroom: 1,
      bathroom: 1,
      pooja: 1,
      store: 0,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 10, dFt: 12 },
      kitchen_0: { wFt: 7, dFt: 8 },
      bedroom_0: { wFt: 10, dFt: 11 },
      bathroom_0: { wFt: 5, dFt: 7 },
      pooja_0: { wFt: 4, dFt: 4 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "N", offset_in: 24, width_in: 38, height_in: 84 },
        { kind: "window", edge: "N", offset_in: 72, width_in: 42, height_in: 48 },
        { kind: "door", edge: "S", offset_in: 36, width_in: 32, height_in: 84 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 18, width_in: 32, height_in: 84 },
        { kind: "window", edge: "S", offset_in: 36, width_in: 48, height_in: 48 },
      ],
      kitchen_0: [
        { kind: "door", edge: "N", offset_in: 12, width_in: 30, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 24, width_in: 36, height_in: 40 },
      ],
      bathroom_0: [
        { kind: "door", edge: "W", offset_in: 12, width_in: 28, height_in: 78 },
        { kind: "window", edge: "S", offset_in: 18, width_in: 24, height_in: 24 },
      ],
    },
  },

  // 2. 20x30 (600 sq ft) — 2BHK Starter Haven
  {
    id: "20x30_2bhk_east",
    name: "Compact 2BHK Starter Haven",
    type: "2BHK",
    plotSizeLabel: "20×30 (600 sq ft)",
    plotWidthFt: 20,
    plotDepthFt: 30,
    facing: "E",
    builtUpAreaSqFt: 460,
    totalSqFt: 600,
    vaastuRating: "East-Facing Sunlit",
    description:
      "Clever dual-bedroom layout maximizing every square inch with morning natural sunlight, dual bedrooms, and a central gathering hall.",
    highlights: [
      "East-Facing Morning Sunlight",
      "Two Cozy Bedrooms",
      "Dedicated Pooja Niche",
      "Optimized Cross-Ventilation",
    ],
    counts: {
      hall: 1,
      kitchen: 1,
      dining: 0,
      bedroom: 2,
      bathroom: 1,
      pooja: 0,
      store: 0,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 10, dFt: 11 },
      kitchen_0: { wFt: 6, dFt: 8 },
      bedroom_0: { wFt: 9, dFt: 10 },
      bedroom_1: { wFt: 8, dFt: 9 },
      bathroom_0: { wFt: 5, dFt: 6 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "E", offset_in: 24, width_in: 36, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 70, width_in: 40, height_in: 48 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 12, width_in: 32, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 24, width_in: 40, height_in: 48 },
      ],
      bedroom_1: [
        { kind: "door", edge: "N", offset_in: 12, width_in: 30, height_in: 84 },
        { kind: "window", edge: "S", offset_in: 24, width_in: 36, height_in: 48 },
      ],
      kitchen_0: [
        { kind: "door", edge: "W", offset_in: 12, width_in: 30, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 18, width_in: 32, height_in: 40 },
      ],
    },
  },

  // 3. 30x40 (1,200 sq ft) — 2BHK Classic Vaastu Home
  {
    id: "30x40_2bhk_north",
    name: "Classic 2BHK Vaastu Residence",
    type: "2BHK",
    plotSizeLabel: "30×40 (1,200 sq ft)",
    plotWidthFt: 30,
    plotDepthFt: 40,
    facing: "N",
    builtUpAreaSqFt: 880,
    totalSqFt: 1200,
    vaastuRating: "100% Vaastu Compliant",
    description:
      "The quintessential Indian family home plan. Spacious living hall with North-East entry, dedicated dining space, South-East modular kitchen, Ishanya Pooja mandir, and South-West Master Suite.",
    highlights: [
      "North-East Main Entry",
      "South-West Master Bedroom",
      "South-East Agni Modular Kitchen",
      "Formal Dining Hall & Pooja Mandir",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 2,
      bathroom: 2,
      pooja: 1,
      store: 0,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 14, dFt: 15 },
      dining_0: { wFt: 10, dFt: 11 },
      kitchen_0: { wFt: 9, dFt: 11 },
      bedroom_0: { wFt: 12, dFt: 14 },
      bedroom_1: { wFt: 11, dFt: 12 },
      bathroom_0: { wFt: 5, dFt: 8 },
      bathroom_1: { wFt: 5, dFt: 7 },
      pooja_0: { wFt: 5, dFt: 6 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "N", offset_in: 36, width_in: 42, height_in: 84 },
        { kind: "window", edge: "N", offset_in: 96, width_in: 54, height_in: 54 },
        { kind: "opening", edge: "S", offset_in: 36, width_in: 48, height_in: 84 },
      ],
      dining_0: [
        { kind: "opening", edge: "N", offset_in: 18, width_in: 48, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 24, width_in: 48, height_in: 48 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 18, width_in: 36, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 36, width_in: 48, height_in: 54 },
      ],
      bedroom_1: [
        { kind: "door", edge: "E", offset_in: 18, width_in: 32, height_in: 84 },
        { kind: "window", edge: "S", offset_in: 30, width_in: 48, height_in: 48 },
      ],
      kitchen_0: [
        { kind: "door", edge: "W", offset_in: 12, width_in: 32, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 24, width_in: 40, height_in: 42 },
      ],
      pooja_0: [
        { kind: "door", edge: "S", offset_in: 12, width_in: 30, height_in: 84 },
      ],
    },
  },

  // 4. 30x40 (1,200 sq ft) — 3BHK Modern Family Residence
  {
    id: "30x40_3bhk_east",
    name: "Modern 3BHK Family Residence",
    type: "3BHK",
    plotSizeLabel: "30×40 (1,200 sq ft)",
    plotWidthFt: 30,
    plotDepthFt: 40,
    facing: "E",
    builtUpAreaSqFt: 960,
    totalSqFt: 1200,
    vaastuRating: "East-Facing Master Plan",
    description:
      "A high-demand 3-bedroom blueprint crafted for growing families. Generous living area, three well-proportioned bedrooms, separate dining and pantry store room.",
    highlights: [
      "3 Private Bedrooms",
      "East-Facing Entrance Foyer",
      "Dedicated Pantry / Store Room",
      "Optimal Privacy Zoning",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 3,
      bathroom: 2,
      pooja: 0,
      store: 1,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 13, dFt: 16 },
      dining_0: { wFt: 10, dFt: 11 },
      kitchen_0: { wFt: 9, dFt: 10 },
      bedroom_0: { wFt: 12, dFt: 13 },
      bedroom_1: { wFt: 10, dFt: 12 },
      bedroom_2: { wFt: 10, dFt: 11 },
      bathroom_0: { wFt: 5, dFt: 8 },
      bathroom_1: { wFt: 5, dFt: 7 },
      store_0: { wFt: 5, dFt: 6 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "E", offset_in: 36, width_in: 42, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 96, width_in: 54, height_in: 54 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 18, width_in: 36, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 36, width_in: 48, height_in: 54 },
      ],
      bedroom_1: [
        { kind: "door", edge: "S", offset_in: 18, width_in: 32, height_in: 84 },
        { kind: "window", edge: "N", offset_in: 24, width_in: 42, height_in: 48 },
      ],
      bedroom_2: [
        { kind: "door", edge: "E", offset_in: 18, width_in: 32, height_in: 84 },
        { kind: "window", edge: "S", offset_in: 24, width_in: 42, height_in: 48 },
      ],
      kitchen_0: [
        { kind: "door", edge: "W", offset_in: 12, width_in: 32, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 24, width_in: 40, height_in: 42 },
      ],
    },
  },

  // 5. 30x50 (1,500 sq ft) — 3BHK Contemporary Villa
  {
    id: "30x50_3bhk_east",
    name: "Contemporary 3BHK with Pooja & Dining",
    type: "3BHK",
    plotSizeLabel: "30×50 (1,500 sq ft)",
    plotWidthFt: 30,
    plotDepthFt: 50,
    facing: "E",
    builtUpAreaSqFt: 1220,
    totalSqFt: 1500,
    vaastuRating: "100% Vaastu Compliant",
    description:
      "A grand 1,500 sq ft layout with elongated depth. Expansive living hall, formal dining, chef's kitchen with attached utility/store, luxurious master suite with ensuite bath, and sacred pooja mandir.",
    highlights: [
      "Expansive 16×18 ft Living Salon",
      "Private Master Suite in South-West",
      "Dedicated Ishanya Pooja Room",
      "Walk-in Pantry Store & Dining",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 3,
      bathroom: 2,
      pooja: 1,
      store: 1,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 15, dFt: 17 },
      dining_0: { wFt: 11, dFt: 13 },
      kitchen_0: { wFt: 10, dFt: 12 },
      bedroom_0: { wFt: 13, dFt: 15 },
      bedroom_1: { wFt: 11, dFt: 13 },
      bedroom_2: { wFt: 11, dFt: 12 },
      bathroom_0: { wFt: 6, dFt: 8 },
      bathroom_1: { wFt: 5, dFt: 8 },
      pooja_0: { wFt: 6, dFt: 6 },
      store_0: { wFt: 5, dFt: 7 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "E", offset_in: 48, width_in: 48, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 110, width_in: 60, height_in: 60 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 24, width_in: 36, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 48, width_in: 54, height_in: 54 },
      ],
      bedroom_1: [
        { kind: "door", edge: "S", offset_in: 18, width_in: 36, height_in: 84 },
        { kind: "window", edge: "N", offset_in: 36, width_in: 48, height_in: 48 },
      ],
      bedroom_2: [
        { kind: "door", edge: "E", offset_in: 18, width_in: 32, height_in: 84 },
        { kind: "window", edge: "S", offset_in: 30, width_in: 48, height_in: 48 },
      ],
      kitchen_0: [
        { kind: "opening", edge: "W", offset_in: 18, width_in: 42, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 30, width_in: 48, height_in: 48 },
      ],
      pooja_0: [
        { kind: "door", edge: "W", offset_in: 12, width_in: 32, height_in: 84 },
      ],
    },
  },

  // 6. 30x50 (1,500 sq ft) — 2BHK Sunlit Villa
  {
    id: "30x50_2bhk_north",
    name: "Sunlit 2BHK + Grand Living Villa",
    type: "2BHK",
    plotSizeLabel: "30×50 (1,500 sq ft)",
    plotWidthFt: 30,
    plotDepthFt: 50,
    facing: "N",
    builtUpAreaSqFt: 1150,
    totalSqFt: 1500,
    vaastuRating: "Premium North-Facing",
    description:
      "Designed for spacious living with extra-large bedroom suites, huge light-filled living salon, dining overlooking gardens, and maximum setbacks for cross breezes.",
    highlights: [
      "Massive 16×20 ft Living Hall",
      "Two Deluxe Master Bedrooms",
      "North-Facing Sunlit Foyer",
      "Generous Garden Setbacks",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 2,
      bathroom: 2,
      pooja: 1,
      store: 0,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 16, dFt: 18 },
      dining_0: { wFt: 12, dFt: 13 },
      kitchen_0: { wFt: 10, dFt: 12 },
      bedroom_0: { wFt: 14, dFt: 16 },
      bedroom_1: { wFt: 12, dFt: 14 },
      bathroom_0: { wFt: 6, dFt: 9 },
      bathroom_1: { wFt: 6, dFt: 8 },
      pooja_0: { wFt: 6, dFt: 7 },
    },
  },

  // 7. 40x60 (2,400 sq ft) — 3BHK Executive Luxury Bungalow
  {
    id: "40x60_3bhk_north",
    name: "Executive 3BHK Luxury Bungalow",
    type: "3BHK",
    plotSizeLabel: "40×60 (2,400 sq ft)",
    plotWidthFt: 40,
    plotDepthFt: 60,
    facing: "N",
    builtUpAreaSqFt: 1850,
    totalSqFt: 2400,
    vaastuRating: "100% Vaastu Compliant",
    description:
      "An estate-class single-level bungalow with an impressive double-door entrance, formal living salon, banquet-ready dining, gourmet kitchen, pantry store, and three grand king-size bedroom suites with attached baths.",
    highlights: [
      "Palatial Living Salon (18×20 ft)",
      "3 King-Size En-suite Bedrooms",
      "Gourmet Kitchen + Walk-in Store",
      "Sacred Ishanya Corner Pooja",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 3,
      bathroom: 3,
      pooja: 1,
      store: 1,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 18, dFt: 20 },
      dining_0: { wFt: 13, dFt: 15 },
      kitchen_0: { wFt: 12, dFt: 14 },
      bedroom_0: { wFt: 15, dFt: 17 },
      bedroom_1: { wFt: 13, dFt: 15 },
      bedroom_2: { wFt: 13, dFt: 14 },
      bathroom_0: { wFt: 7, dFt: 9 },
      bathroom_1: { wFt: 6, dFt: 8 },
      bathroom_2: { wFt: 6, dFt: 8 },
      pooja_0: { wFt: 7, dFt: 8 },
      store_0: { wFt: 6, dFt: 8 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "N", offset_in: 48, width_in: 60, height_in: 96 },
        { kind: "window", edge: "N", offset_in: 140, width_in: 60, height_in: 60 },
        { kind: "window", edge: "W", offset_in: 36, width_in: 60, height_in: 60 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 24, width_in: 38, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 48, width_in: 60, height_in: 60 },
        { kind: "window", edge: "S", offset_in: 48, width_in: 60, height_in: 60 },
      ],
      kitchen_0: [
        { kind: "opening", edge: "W", offset_in: 24, width_in: 48, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 36, width_in: 48, height_in: 48 },
      ],
    },
  },

  // 8. 40x60 (2,400 sq ft) — 4BHK Royal Grand Estate
  {
    id: "40x60_4bhk_east",
    name: "Royal 4BHK Grand Estate",
    type: "4BHK",
    plotSizeLabel: "40×60 (2,400 sq ft)",
    plotWidthFt: 40,
    plotDepthFt: 60,
    facing: "E",
    builtUpAreaSqFt: 1980,
    totalSqFt: 2400,
    vaastuRating: "East-Facing Royal Plan",
    description:
      "A complete 4-bedroom luxury layout offering separate zones for entertaining, private family gatherings, culinary prep, traditional pooja, and 4 dedicated master suites.",
    highlights: [
      "4 Deluxe Bedrooms",
      "East-Facing Auspicious Entrance",
      "Formal Dining & Modular Kitchen",
      "Dedicated Pooja & Storage",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 4,
      bathroom: 3,
      pooja: 1,
      store: 1,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 17, dFt: 19 },
      dining_0: { wFt: 13, dFt: 14 },
      kitchen_0: { wFt: 11, dFt: 13 },
      bedroom_0: { wFt: 14, dFt: 16 },
      bedroom_1: { wFt: 12, dFt: 14 },
      bedroom_2: { wFt: 12, dFt: 13 },
      bedroom_3: { wFt: 11, dFt: 13 },
      bathroom_0: { wFt: 6, dFt: 9 },
      bathroom_1: { wFt: 6, dFt: 8 },
      bathroom_2: { wFt: 5, dFt: 7 },
      pooja_0: { wFt: 6, dFt: 7 },
      store_0: { wFt: 6, dFt: 7 },
    },
  },

  // 9. 50x80 (4,000 sq ft) — 4BHK Palatial Courtyard Mansion
  {
    id: "50x80_4bhk_north",
    name: "Palatial 4BHK Courtyard Mansion",
    type: "4BHK",
    plotSizeLabel: "50×80 (4,000 sq ft)",
    plotWidthFt: 50,
    plotDepthFt: 80,
    facing: "N",
    builtUpAreaSqFt: 3100,
    totalSqFt: 4000,
    vaastuRating: "100% Vaastu Compliant",
    description:
      "A magnificent luxury mansion designed for expansive 50×80 plots. Grand royal salon, banquet dining, chef's kitchen, presidential master wing with private bath, and 3 guest/children suites.",
    highlights: [
      "Royal Grand Salon (20×24 ft)",
      "Presidential Master Wing (16×20 ft)",
      "Chef's Kitchen with Pantry & Store",
      "Traditional Ishanya Pooja Mandir",
    ],
    counts: {
      hall: 1,
      dining: 1,
      kitchen: 1,
      bedroom: 4,
      bathroom: 4,
      pooja: 1,
      store: 1,
      entrance: 0,
    },
    customDims: {
      hall_0: { wFt: 20, dFt: 24 },
      dining_0: { wFt: 15, dFt: 18 },
      kitchen_0: { wFt: 14, dFt: 16 },
      bedroom_0: { wFt: 16, dFt: 20 },
      bedroom_1: { wFt: 14, dFt: 17 },
      bedroom_2: { wFt: 14, dFt: 16 },
      bedroom_3: { wFt: 13, dFt: 15 },
      bathroom_0: { wFt: 8, dFt: 10 },
      bathroom_1: { wFt: 7, dFt: 9 },
      bathroom_2: { wFt: 6, dFt: 8 },
      bathroom_3: { wFt: 6, dFt: 8 },
      pooja_0: { wFt: 8, dFt: 8 },
      store_0: { wFt: 7, dFt: 9 },
    },
    customOpenings: {
      hall_0: [
        { kind: "entrance", edge: "N", offset_in: 60, width_in: 72, height_in: 96 },
        { kind: "window", edge: "N", offset_in: 160, width_in: 72, height_in: 60 },
        { kind: "window", edge: "W", offset_in: 48, width_in: 72, height_in: 60 },
      ],
      bedroom_0: [
        { kind: "door", edge: "N", offset_in: 24, width_in: 42, height_in: 84 },
        { kind: "window", edge: "W", offset_in: 60, width_in: 72, height_in: 60 },
        { kind: "window", edge: "S", offset_in: 60, width_in: 72, height_in: 60 },
      ],
      kitchen_0: [
        { kind: "opening", edge: "W", offset_in: 24, width_in: 60, height_in: 84 },
        { kind: "window", edge: "E", offset_in: 48, width_in: 60, height_in: 48 },
      ],
    },
  },
];
