"use client";

import { useState } from "react";
import { FURNITURE_CATALOG, FurnitureCategory } from "@/lib/furnitureCatalog";
import { BuildingProgram } from "@/lib/programs";
import { WALL_BAND_PRESETS } from "@/lib/wallBands";
import { GLAZING_PRESETS } from "@/lib/glazing";
import {
  DESIGN_PRESETS,
  DOOR_COLORS,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
  getDoorColorHexStr,
  getWallColorHexStr,
} from "@/lib/materialsCatalog";
import styles from "./LeftToolRail.module.css";

interface LeftToolRailProps {
  /** Which building type is being designed. Swapping it swaps the whole rail. */
  program: BuildingProgram;
  placingItemType: string | null;
  onSelectPlaceItem: (type: string | null) => void;
  materialConfig: HouseMaterialConfig;
  onChangeMaterialConfig: (config: HouseMaterialConfig) => void;
  onOpenMaterialModal: () => void;
  onOpenAIFurnitureModal?: () => void;
  onOpenCustomWallBlendModal?: () => void;
  totalPlacedCount: number;

  deletedBuiltinCount: number;
  onRestoreDefaults: () => void;
  onClearAllFurniture: () => void;
}

type SectionId = FurnitureCategory | "finishes" | "manage";

/**
 * Which cluster of the rail a section belongs to.
 *
 * The rail was one flat column of up to fifteen three-letter tags with a single divider in it,
 * so finding anything meant reading every button. Grouping is the move the ribbon above makes —
 * a small set of related commands under a heading — applied down the side instead of across the
 * top.
 */
/**
 * Rail glyphs: 16x16, stroked, one path array each.
 *
 * These replaced three-letter tags — SOF, MND, SAN, APP, LUM, SFT — which read as a code you had
 * to learn before the rail was usable at all. A picture of a sofa is not self-explanatory either;
 * Nielsen Norman's finding is that almost no icon is, which is why every one of these keeps its
 * word underneath it rather than hiding it in a tooltip. See
 * notes/architecture/ribbon-organisation.md.
 */
const RAIL_GLYPHS: Record<string, string[]> = {
  sofa: ["M2.5 9.5v-2.5a1.5 1.5 0 0 1 3 0v1h5v-1a1.5 1.5 0 0 1 3 0v2.5", "M2.5 9.5h11v3.5h-11z", "M4.5 13v1M11.5 13v1"],
  bed: ["M2.5 13V6.5", "M2.5 9.5h11v3.5h-11z", "M4.5 9.5V7.5h4.5v2", "M13.5 13v-3.5"],
  table: ["M2.5 5.5h11", "M8 5.5v7", "M5.5 12.5h5"],
  hob: ["M3 3.5h10v9H3z", "M6.6 6.6a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 1 1 2.2 0", "M11.9 6.6a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 1 1 2.2 0", "M4.5 10.5h7"],
  desk: ["M2.5 10.5h11", "M4 10.5v3M12 10.5v3", "M6 4.5h4.5v4H6z", "M8.2 8.5v2"],
  basin: ["M3 8.5h10v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", "M8 8.5V5.5a1.5 1.5 0 0 1 3 0"],
  stairs: ["M2.5 13.5V11h3V8.5h3V6h3V3.5h2"],
  divider: ["M3.5 2.5v11M12.5 2.5v11", "M3.5 8h2.5M10 8h2.5"],
  lamp: ["M8 2v3", "M4 10.5 8 5l4 5.5z", "M6.5 13h3"],
  washer: ["M3.5 2.5h9v11h-9z", "M10.6 8.5a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 1 1 5.2 0", "M5.5 4.5h1.5"],
  curtain: ["M2.5 3h11", "M5 3c1 3.5-1 6.5 0 10M8 3c1 3.5-1 6.5 0 10M11 3c1 3.5-1 6.5 0 10"],
  plant: ["M8 13.5V8", "M8 8C5 8 4 6 4 3.5 7 3.5 8 5.5 8 8z", "M8 8c3 0 4-2 4-4.5C9 3.5 8 5.5 8 8z", "M5.5 13.5h5"],
  counter: ["M2.5 7.5h11v2h-11z", "M4.5 9.5v4M11.5 9.5v4", "M5.5 7.5V4.5h5v3"],
  fridge: ["M4 2.5h8v11H4z", "M4 6.5h8", "M6 4.2v1.5M6 8.2v2"],
  umbrella: ["M8 8v4.5", "M2.5 8a5.5 5.5 0 0 1 11 0z", "M8 12.5a1.6 1.6 0 0 0 3.2 0"],
  sign: ["M3 3.5h10v6H3z", "M8 9.5v4", "M6 13.5h4", "M5.5 6.5h5"],
  roller: ["M3 3.5h7v3H3z", "M10 5h2.5v3.5H7.5V13", "M6.5 13.5h2"],
  layers: ["M8 2.5 14 6l-6 3.5L2 6z", "M2 9.5 8 13l6-3.5"],
};

function RailGlyph({ paths }: { paths: string[] }) {
  return (
    <svg className={styles.railIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

type RailGroup = "rooms" | "build" | "fit" | "dress" | "project";

const GROUP_LABELS: Record<RailGroup, string> = {
  rooms: "Rooms",
  build: "Build",
  fit: "Fit-out",
  dress: "Dress",
  project: "Project",
};

const GROUP_ORDER: RailGroup[] = ["rooms", "build", "fit", "dress", "project"];

interface RailSection {
  id: SectionId;
  /** Key into RAIL_GLYPHS. */
  icon: string;
  label: string;
  title: string;
  group: RailGroup;
}

// One entry per furniture category. Which of these the rail shows comes from the active
// programme's `furnitureCategories` — see lib/programs.ts.
const CATEGORY_META: Record<FurnitureCategory, Omit<RailSection, "id">> = {
  living: { icon: "sofa", label: "Living", title: "Sofas, coffee tables, TV units and living room pieces", group: "rooms" },
  bedroom: { icon: "bed", label: "Bedroom", title: "Beds, wardrobes, nightstands and dressers", group: "rooms" },
  dining: { icon: "table", label: "Dining", title: "Dining tables, chairs and sideboards", group: "rooms" },
  kitchen: { icon: "hob", label: "Kitchen", title: "Counters, hobs, sinks and kitchen appliances", group: "rooms" },
  office: { icon: "desk", label: "Study", title: "Desks, office chairs and bookshelves", group: "rooms" },
  bath: { icon: "basin", label: "Bathroom", title: "WC, basin, shower and bathtub", group: "rooms" },
  stairs: { icon: "stairs", label: "Stairs", title: "Straight, L-shaped, dog-leg, winder, floating and spiral stairs", group: "build" },
  walls: { icon: "divider", label: "Dividers", title: "Partitions, screens and room dividers", group: "build" },
  lighting: { icon: "lamp", label: "Lighting", title: "Chandeliers, pendants, wall sconces and task lights", group: "fit" },
  appliance: { icon: "washer", label: "Appliances", title: "Washing machine, geyser, air conditioner and fans", group: "fit" },
  soft: { icon: "curtain", label: "Curtains", title: "Curtains, cushions and soft furnishing", group: "dress" },
  decor: { icon: "plant", label: "Decor", title: "Plants, rugs, mirrors and wall art", group: "dress" },
  cafe_seating: { icon: "table", label: "Seating", title: "Tables, chairs, banquettes and bar stools", group: "rooms" },
  cafe_service: { icon: "counter", label: "Service", title: "Counter kit: espresso machine, till, display case, condiments, retail", group: "rooms" },
  cafe_boh: { icon: "fridge", label: "Back of house", title: "Fridge, prep bench, racking and ice machine", group: "build" },
  cafe_outdoor: { icon: "umbrella", label: "Terrace", title: "Outdoor covers, rope line and bike rack", group: "build" },
  cafe_signage: { icon: "sign", label: "Signage", title: "Menu boards and pavement signs", group: "fit" },
  cafe_decor: { icon: "plant", label: "Decor", title: "Lighting, planting, neon and wall art", group: "dress" },
  // Outside the building line, so no programme lists it and this rail never draws it. Present
  // because CATEGORY_META must cover every category.
  landscape: { icon: "plant", label: "Landscape", title: "Trees, hedges, paving and boundary — see the ribbon's Landscape tab", group: "project" },
};

const FIXED_SECTIONS: RailSection[] = [
  { id: "finishes", icon: "roller", label: "Finishes", title: "Floor materials, wall paint, door colours and whole-house themes", group: "project" },
  { id: "manage", icon: "layers", label: "Manage", title: "Everything you have placed, AI modelling and cleanup", group: "project" },
];

export default function LeftToolRail({
  program,
  placingItemType,
  onSelectPlaceItem,
  materialConfig,
  onChangeMaterialConfig,
  onOpenMaterialModal,
  onOpenAIFurnitureModal,
  onOpenCustomWallBlendModal,
  totalPlacedCount,

  deletedBuiltinCount,
  onRestoreDefaults,
  onClearAllFurniture,
}: LeftToolRailProps) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  // The programme decides which categories exist; the group decides where each one sits. Within
  // a group the programme's own order is kept, so a cafe still lists its covers before its till.
  const allSections: RailSection[] = [
    ...program.furnitureCategories.map((id) => ({ id, ...CATEGORY_META[id] })),
    ...FIXED_SECTIONS,
  ];
  const railGroups = GROUP_ORDER.map((group) => ({
    group,
    sections: allSections.filter((s) => s.group === group),
  })).filter((g) => g.sections.length > 0);
  const railSections = railGroups.flatMap((g) => g.sections);

  // Switching building type retires whole categories. A panel left open on one of them would
  // render an empty flyout, so fall back to closed rather than showing a dead panel.
  const active = railSections.find((s) => s.id === openSection) ?? null;
  const items = active ? FURNITURE_CATALOG.filter((item) => item.category === active.id) : [];
  const placingDef = placingItemType
    ? FURNITURE_CATALOG.find((item) => item.type === placingItemType)
    : null;

  const applyFloor = (matId: string) =>
    onChangeMaterialConfig({ ...materialConfig, globalFloor: matId, roomFloors: {} });

  const applyWallColor = (colorIdOrHex: string) =>
    onChangeMaterialConfig({ ...materialConfig, globalWallColor: colorIdOrHex, roomWallColors: {} });

  const applyDoorColor = (colorIdOrHex: string) =>
    onChangeMaterialConfig({ ...materialConfig, globalDoorColor: colorIdOrHex, roomDoorColors: {} });

  const isCustomWallColor = !WALL_COLORS.some(
    (c) =>
      c.id === materialConfig.globalWallColor ||
      c.hex.toLowerCase() === getWallColorHexStr(materialConfig.globalWallColor).toLowerCase()
  );

  const isCustomDoorColor = !DOOR_COLORS.some(
    (c) =>
      c.id === materialConfig.globalDoorColor ||
      c.hex.toLowerCase() === getDoorColorHexStr(materialConfig.globalDoorColor).toLowerCase()
  );

  return (
    <div className={styles.railRoot}>
      {/* Docked icon rail */}
      <nav className={styles.rail} aria-label="Interior design tools">
        <div className={styles.railCaption}>{program.railCaption}</div>
        {/* The rail is a set of drawers, and nothing about a column of buttons says so. One line
            costs almost nothing and is the difference between clicking to find out and knowing. */}
        <p className={styles.railHint}>Pick a category, then drag a piece onto the plan.</p>

        {railGroups.map(({ group, sections }) => (
          <div className={styles.railGroup} key={group}>
            <div className={styles.railGroupBtns}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`${styles.railBtn} ${openSection === section.id ? styles.railBtnActive : ""}`}
                  onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
                  title={section.title}
                >
                  <RailGlyph paths={RAIL_GLYPHS[section.icon]} />
                  <span className={styles.railLabel}>{section.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.railGroupLabel}>{GROUP_LABELS[group]}</div>
          </div>
        ))}
      </nav>

      {/* Placement hint while an item is armed */}
      {placingDef && (
        <div className={styles.placementBanner}>
          <span className={styles.placementText}>
            Click a room floor to place {placingDef.icon} {placingDef.name}
          </span>
          <button className={styles.placementCancel} onClick={() => onSelectPlaceItem(null)}>
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Flyout panel */}
      {active && (
        <div className={styles.flyout}>
          <div className={styles.flyoutHeader}>
            <span className={styles.flyoutTitle}>
              <RailGlyph paths={RAIL_GLYPHS[active.icon]} />
              {active.label}
            </span>
            <button className={styles.flyoutClose} onClick={() => setOpenSection(null)} title="Close panel">
              ✕
            </button>
          </div>

          {/* What is actually in this drawer, in words. It used to be the panel's only title,
              which meant the heading read as a sentence and the category name was nowhere. */}
          <p className={styles.flyoutSubtitle}>{active.title}</p>

          <div className={styles.flyoutBody}>
            {active.id === "finishes" ? (
              <>
                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Flooring</div>
                  <div className={styles.swatchGrid}>
                    {FLOOR_MATERIALS.map((m) => (
                      <button
                        key={m.id}
                        className={`${styles.matBtn} ${materialConfig.globalFloor === m.id ? styles.matBtnActive : ""}`}
                        onClick={() => applyFloor(m.id)}
                        title={`Apply ${m.name} to whole house`}
                      >
                        <span className={styles.matSwatch} style={{ backgroundColor: m.swatchColor }} />
                        <span className={styles.matName}>{m.name.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Wall paint</div>
                  <div className={styles.colorRow}>
                    {WALL_COLORS.map((c) => {
                      const isSelected =
                        materialConfig.globalWallColor === c.id ||
                        getWallColorHexStr(materialConfig.globalWallColor).toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          className={`${styles.colorDot} ${isSelected ? styles.colorDotActive : ""}`}
                          style={{ backgroundColor: c.hex }}
                          onClick={() => applyWallColor(c.id)}
                          title={`Paint whole house in ${c.name}`}
                        />
                      );
                    })}
                    <label
                      className={`${styles.colorWheel} ${isCustomWallColor ? styles.colorDotActive : ""}`}
                      title="Custom wall colour"
                    >
                      <input
                        type="color"
                        className={styles.hiddenColorInput}
                        value={getWallColorHexStr(materialConfig.globalWallColor)}
                        onChange={(e) => applyWallColor(e.target.value)}
                      />

                    </label>
                  </div>
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Door colour</div>
                  <div className={styles.colorRow}>
                    {DOOR_COLORS.map((c) => {
                      const isSelected =
                        materialConfig.globalDoorColor === c.id ||
                        getDoorColorHexStr(materialConfig.globalDoorColor).toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          className={`${styles.colorDot} ${isSelected ? styles.colorDotActive : ""}`}
                          style={{ backgroundColor: c.hex }}
                          onClick={() => applyDoorColor(c.id)}
                          title={`Finish all doors in ${c.name}`}
                        />
                      );
                    })}
                    <label
                      className={`${styles.colorWheel} ${isCustomDoorColor ? styles.colorDotActive : ""}`}
                      title="Custom door colour"
                    >
                      <input
                        type="color"
                        className={styles.hiddenColorInput}
                        value={getDoorColorHexStr(materialConfig.globalDoorColor)}
                        onChange={(e) => applyDoorColor(e.target.value)}
                      />

                    </label>
                  </div>
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Glazing</div>
                  <div className={styles.hint}>
                    Turns real walls and their doors to glass. Select one wall in 3D to glaze just
                    that one.
                  </div>
                  <div className={styles.themeGrid}>
                    {GLAZING_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        className={`${styles.themeBtn} ${
                          materialConfig.globalGlazing &&
                          materialConfig.globalGlazing.styleId === preset.glazing.styleId &&
                          materialConfig.globalGlazing.wall === preset.glazing.wall &&
                          materialConfig.globalGlazing.door === preset.glazing.door
                            ? styles.matBtnActive
                            : ""
                        }`}
                        onClick={() =>
                          onChangeMaterialConfig({
                            ...materialConfig,
                            globalGlazing: preset.glazing,
                            // Per-wall experiments would otherwise outrank the building-wide
                            // choice that was just made.
                            wallGlazing: {},
                            roomGlazing: {},
                          })
                        }
                        title={preset.description}
                      >
                        <span className={styles.themeIcon}>{preset.glazing.wall ? "\u25A7" : "\u25AF"}</span>
                        <span className={styles.themeName}>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  {materialConfig.globalGlazing && (
                    <button
                      className={styles.wideBtn}
                      onClick={() =>
                        onChangeMaterialConfig({
                          ...materialConfig,
                          globalGlazing: undefined,
                          wallGlazing: {},
                          roomGlazing: {},
                        })
                      }
                    >
                      Back to solid walls
                    </button>
                  )}
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Wall Blends &amp; Partitions</div>
                  <div className={styles.hint}>
                    Splits wall surfaces horizontally or vertically to test different permutations and color/material combinations.
                  </div>

                  {onOpenCustomWallBlendModal && (
                    <button
                      className={styles.wideBtn}
                      onClick={onOpenCustomWallBlendModal}
                      style={{
                        background: "linear-gradient(135deg, #3d5c69, #3d5c69)",
                        border: "1px solid #6f9aa8",
                        color: "#ffffff",
                        fontWeight: 700,
                        marginBottom: "10px",
                        padding: "8px 12px",
                        fontSize: "12px",
                      }}
                    >
                      Custom Partition &amp; Permutations Studio
                    </button>
                  )}

                  <div className={styles.themeGrid}>
                    {WALL_BAND_PRESETS.map((preset) => (

                      <button
                        key={preset.id}
                        className={`${styles.themeBtn} ${
                          materialConfig.globalWallBands &&
                          materialConfig.globalWallBands.axis === preset.scheme.axis &&
                          materialConfig.globalWallBands.bands.length === preset.scheme.bands.length
                            ? styles.matBtnActive
                            : ""
                        }`}
                        onClick={() =>
                          onChangeMaterialConfig({
                            ...materialConfig,
                            globalWallBands: preset.scheme,
                            // A building-wide scheme replaces per-wall experiments, otherwise the
                            // old overrides silently outrank the thing just clicked.
                            wallBands: {},
                            roomWallBands: {},
                          })
                        }
                        title={preset.description}
                      >
                        <span className={styles.themeIcon}>
                          {preset.scheme.axis === "horizontal" ? "\u2261" : "\u2016"}
                        </span>
                        <span className={styles.themeName}>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  {materialConfig.globalWallBands && (
                    <button
                      className={styles.wideBtn}
                      onClick={() =>
                        onChangeMaterialConfig({
                          ...materialConfig,
                          globalWallBands: undefined,
                          wallBands: {},
                          roomWallBands: {},
                        })
                      }
                    >
                      Clear all wall bands
                    </button>
                  )}
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>One-click themes</div>
                  <div className={styles.themeGrid}>
                    {DESIGN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        className={styles.themeBtn}
                        onClick={() =>
                          onChangeMaterialConfig({
                            ...materialConfig,
                            globalFloor: preset.globalFloor,
                            globalWallColor: preset.globalWallColor,
                            globalWallTexture: preset.globalWallTexture,
                            globalDoorColor: preset.globalDoorColor ?? materialConfig.globalDoorColor,
                            roomFloors: {},
                            roomWallColors: {},
                            roomWallTextures: {},
                            roomDoorColors: {},
                          })
                        }
                        title={`Apply ${preset.name} theme`}
                      >
                        <span className={styles.themeIcon}>{preset.icon}</span>
                        <span className={styles.themeName}>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button className={styles.wideBtn} onClick={onOpenMaterialModal}>
                  Open Materials Studio...
                </button>
              </>
            ) : active.id === "manage" ? (
              <>
                <div className={styles.statRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{totalPlacedCount}</span>
                    <span className={styles.statLabel}>Placed objects</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{deletedBuiltinCount}</span>
                    <span className={styles.statLabel}>Removed defaults</span>
                  </div>
                </div>

                {onOpenAIFurnitureModal && (
                  <button className={styles.wideBtnAccent} onClick={onOpenAIFurnitureModal}>
                    AI Photo-to-3D Furniture Studio...
                  </button>
                )}

                <button
                  className={styles.wideBtn}
                  onClick={onRestoreDefaults}
                  disabled={deletedBuiltinCount === 0}
                  title="Bring back every deleted built-in furniture piece"
                >
                  Restore default furniture
                </button>

                <button
                  className={styles.wideBtnDanger}
                  onClick={onClearAllFurniture}
                  disabled={totalPlacedCount === 0}
                  title="Remove every object you placed"
                >
                  Clear all placed objects
                </button>
              </>
            ) : (
              <>
                <div className={styles.hint}>Click an item, then click the floor to place it.</div>
                <div className={styles.itemGrid}>
                  {items.map((item) => {
                    const isPlacing = placingItemType === item.type;
                    return (
                      <button
                        key={item.type}
                        className={`${styles.itemCard} ${isPlacing ? styles.itemCardActive : ""}`}
                        onClick={() => onSelectPlaceItem(isPlacing ? null : item.type)}
                        title={item.description}
                      >
                        <span className={styles.itemIcon}>{item.icon}</span>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemDim}>
                          {item.dimensions.widthFt}ft &times; {item.dimensions.depthFt}ft
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
