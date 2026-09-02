"use client";

import React, { useState } from "react";
import { FURNITURE_CATALOG, FurnitureCategory } from "@/lib/furnitureCatalog";
import { BuildingProgram } from "@/lib/programs";
import { WALL_BAND_PRESETS } from "@/lib/wallBands";
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
  totalPlacedCount: number;
  deletedBuiltinCount: number;
  onRestoreDefaults: () => void;
  onClearAllFurniture: () => void;
}

type SectionId = FurnitureCategory | "finishes" | "manage";

interface RailSection {
  id: SectionId;
  icon: string;
  label: string;
  title: string;
}

// One entry per furniture category. Which of these the rail shows comes from the active
// programme's `furnitureCategories` — see lib/programs.ts.
const CATEGORY_META: Record<FurnitureCategory, Omit<RailSection, "id">> = {
  living: { icon: "🛋️", label: "Living", title: "Sofas, tables & living room objects" },
  bedroom: { icon: "🛏️", label: "Bed", title: "Beds, wardrobes & bedroom objects" },
  dining: { icon: "🍽️", label: "Dining", title: "Dining tables, chairs & servers" },
  kitchen: { icon: "🍳", label: "Kitchen", title: "Counters, appliances & kitchen units" },
  office: { icon: "💻", label: "Office", title: "Desks, chairs & study units" },
  decor: { icon: "🪴", label: "Decor", title: "Plants, lighting, rugs & wall art" },
  sacred: { icon: "🛕", label: "Mandir", title: "Pooja mandir & sacred objects" },
  walls: { icon: "🧱", label: "Divide", title: "Partitions, screens & room dividers" },
  cafe_seating: { icon: "☕", label: "Covers", title: "Tables, chairs, banquettes & bar stools" },
  cafe_service: { icon: "🧾", label: "Service", title: "Counter kit: espresso, till, display, condiments, retail" },
  cafe_decor: { icon: "💡", label: "Decor", title: "Lighting, planting, neon & wall art" },
  cafe_signage: { icon: "🪧", label: "Signage", title: "Menu boards & pavement signs" },
  cafe_boh: { icon: "🧊", label: "Back", title: "Back of house: fridge, prep bench, racking, ice" },
  cafe_outdoor: { icon: "⛱️", label: "Terrace", title: "Outdoor covers, rope line & bike rack" },
};

const FIXED_SECTIONS: RailSection[] = [
  { id: "finishes", icon: "🎨", label: "Finish", title: "Floors, wall paint, door colours & themes" },
  { id: "manage", icon: "🧩", label: "Manage", title: "Placed objects, AI modelling & cleanup" },
];

export default function LeftToolRail({
  program,
  placingItemType,
  onSelectPlaceItem,
  materialConfig,
  onChangeMaterialConfig,
  onOpenMaterialModal,
  onOpenAIFurnitureModal,
  totalPlacedCount,
  deletedBuiltinCount,
  onRestoreDefaults,
  onClearAllFurniture,
}: LeftToolRailProps) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const railSections: RailSection[] = [
    ...program.furnitureCategories.map((id) => ({ id, ...CATEGORY_META[id] })),
    ...FIXED_SECTIONS,
  ];

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

        {railSections.map((section) => (
          <React.Fragment key={section.id}>
            {section.id === "finishes" && <div className={styles.railDivider} />}
            <button
              className={`${styles.railBtn} ${openSection === section.id ? styles.railBtnActive : ""}`}
              onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
              title={section.title}
            >
              <span className={styles.railIcon}>{section.icon}</span>
              <span className={styles.railLabel}>{section.label}</span>
            </button>
          </React.Fragment>
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
              {active.icon} {active.title}
            </span>
            <button className={styles.flyoutClose} onClick={() => setOpenSection(null)} title="Close panel">
              ✕
            </button>
          </div>

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
                      🎨
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
                      🎨
                    </label>
                  </div>
                </div>

                <div className={styles.panelGroup}>
                  <div className={styles.panelGroupLabel}>Wall bands</div>
                  <div className={styles.hint}>
                    Splits every wall so you can compare paints. Select one wall in 3D to band just
                    that one.
                  </div>
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
                    📸 AI Photo-to-3D Furniture Studio...
                  </button>
                )}

                <button
                  className={styles.wideBtn}
                  onClick={onRestoreDefaults}
                  disabled={deletedBuiltinCount === 0}
                  title="Bring back every deleted built-in furniture piece"
                >
                  ♻️ Restore default furniture
                </button>

                <button
                  className={styles.wideBtnDanger}
                  onClick={onClearAllFurniture}
                  disabled={totalPlacedCount === 0}
                  title="Remove every object you placed"
                >
                  🗑️ Clear all placed objects
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
