// Architectural Door & Window Openings Catalog for Drag & Drop Placement
import { WindowShapeId } from "./windowCatalog";

export interface OpeningItemDef {
  id: string;
  // "sliding_door" is a leaf style, not a plan-level kind. Only custom drawn walls carry it;
  // on a solver room wall it is recorded as a plain door so connectivity still sees a door.
  kind: "door" | "window" | "entrance" | "opening" | "sliding_door";
  category: "door" | "window";
  name: string;
  icon: string;
  widthIn: number;
  heightIn: number;
  sillIn?: number;
  description: string;
  tag?: string;
  windowShape?: WindowShapeId;
}

export const OPENINGS_CATALOG: OpeningItemDef[] = [
  // ── DOORS ──
  {
    id: "door_standard",
    kind: "door",
    category: "door",
    name: "Standard Flush Door",
    icon: "DR",
    widthIn: 36,
    heightIn: 84,
    description: "3ft × 7ft standard single interior/exterior swing door.",
    tag: "Standard 3ft",
  },
  {
    id: "door_main_entrance",
    kind: "entrance",
    category: "door",
    name: "Grand Main Entrance Door",
    icon: "DR",
    widthIn: 42,
    heightIn: 84,
    description: "3.5ft × 7ft grand solid teak entrance door with brass hardware.",
    tag: "Main Door",
  },
  {
    id: "door_double_french",
    kind: "door",
    category: "door",
    name: "Double French Doors",
    icon: "DR",
    widthIn: 72,
    heightIn: 84,
    description: "6ft wide dual-leaf French glass double door with brass latches.",
    tag: "Double 6ft",
  },
  {
    id: "door_sliding_pocket",
    kind: "door",
    category: "door",
    name: "Sliding Pocket Door",
    icon: "DR",
    widthIn: 48,
    heightIn: 84,
    description: "4ft smooth sliding partition pocket door saving swing space.",
    tag: "Sliding 4ft",
  },
  {
    id: "door_sliding_glass",
    kind: "sliding_door",
    category: "door",
    name: "Sliding Glass Door",
    icon: "WIN",
    widthIn: 96,
    heightIn: 96,
    description:
      "8ft × 8ft twin-panel sliding glass door on slim black tracks. The full-height opening in a glazed wall; panels bypass on two tracks rather than swinging, so it costs no floor space.",
    tag: "Sliding Glass 8ft",
  },
  {
    id: "door_arched_passage",
    kind: "opening",
    category: "door",
    name: "Open Archway Passage",
    icon: "CLS",
    widthIn: 60,
    heightIn: 84,
    description: "5ft wide open-concept cased archway without door leaf.",
    tag: "Open Arch 5ft",
  },

  // ── WINDOWS ──
  {
    id: "window_modern_slider",
    kind: "window",
    category: "window",
    name: "Modern Slider Window",
    icon: "WIN",
    widthIn: 48,
    heightIn: 48,
    sillIn: 36,
    description: "4ft × 4ft dual-track horizontal sliding window.",
    tag: "Popular 4×4ft",
    windowShape: "modern_slider",
  },
  {
    id: "window_roman_arch",
    kind: "window",
    category: "window",
    name: "Palladian Roman Arch Window",
    icon: "CLS",
    widthIn: 48,
    heightIn: 60,
    sillIn: 30,
    description: "4ft × 5ft grand arched window with radiating sunburst spokes.",
    tag: "Arched 4×5ft",
    windowShape: "roman_arch",
  },
  {
    id: "window_french_grid",
    kind: "window",
    category: "window",
    name: "French Colonial Grid Window",
    icon: "PNL",
    widthIn: 48,
    heightIn: 48,
    sillIn: 36,
    description: "4ft × 4ft multi-pane grid window with cottage mullions.",
    tag: "Colonial Grid",
    windowShape: "french_grid",
  },
  {
    id: "window_panoramic_picture",
    kind: "window",
    category: "window",
    name: "Panoramic Picture Window",
    icon: "ART",
    widthIn: 72,
    heightIn: 60,
    sillIn: 24,
    description: "6ft × 5ft large fixed daylight picture glass.",
    tag: "Large 6×5ft",
    windowShape: "picture_panoramic",
  },
  {
    id: "window_bay_window",
    kind: "window",
    category: "window",
    name: "Faceted Bay Window",
    icon: "SOF",
    widthIn: 60,
    heightIn: 48,
    sillIn: 24,
    description: "5ft projecting bay window with cozy interior bench.",
    tag: "3D Bay 5ft",
    windowShape: "bay_window",
  },
  {
    id: "window_clerestory",
    kind: "window",
    category: "window",
    name: "Clerestory Privacy Slit",
    icon: "LIN",
    widthIn: 48,
    heightIn: 18,
    sillIn: 72,
    description: "4ft high-level privacy ribbon slit for bathrooms and kitchen.",
    tag: "Slit 4ft",
    windowShape: "clerestory_slit",
  },
  {
    id: "window_porthole",
    kind: "window",
    category: "window",
    name: "Round Porthole Accent Window",
    icon: "KNB",
    widthIn: 36,
    heightIn: 36,
    sillIn: 48,
    description: "3ft circular accent window for pooja and staircases.",
    tag: "Round 3ft",
    windowShape: "circle_porthole",
  },
];
