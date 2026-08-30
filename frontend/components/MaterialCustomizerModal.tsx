"use client";

import React, { useState } from "react";
import {
  DESIGN_PRESETS,
  FLOOR_MATERIALS,
  FloorCategory,
  HouseMaterialConfig,
  WALL_COLORS,
  WALL_TEXTURES,
  getWallColorHexStr,
} from "@/lib/materialsCatalog";
import { ROOM_LABELS, RoomName } from "@/lib/rooms";
import styles from "./MaterialCustomizerModal.module.css";

interface MaterialCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HouseMaterialConfig;
  onChangeConfig: (next: HouseMaterialConfig) => void;
  activeRooms?: RoomName[];
}

export default function MaterialCustomizerModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  activeRooms = ["hall", "kitchen", "bedroom", "pooja", "bathroom"],
}: MaterialCustomizerModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<"global" | RoomName>("global");
  const [activeTab, setActiveTab] = useState<"floor" | "wall" | "presets">("floor");
  const [floorCategoryFilter, setFloorCategoryFilter] = useState<"all" | FloorCategory>("all");

  if (!isOpen) return null;

  // Active Floor for current target
  const currentFloorId =
    selectedTarget === "global"
      ? config.globalFloor
      : config.roomFloors[selectedTarget] || config.globalFloor;

  // Active Wall Color for current target
  const currentWallColorId =
    selectedTarget === "global"
      ? config.globalWallColor
      : config.roomWallColors[selectedTarget] || config.globalWallColor;

  // Active Wall Texture for current target
  const currentWallTextureId =
    selectedTarget === "global"
      ? config.globalWallTexture
      : config.roomWallTextures[selectedTarget] || config.globalWallTexture;

  const handleSelectFloor = (matId: string) => {
    if (selectedTarget === "global") {
      onChangeConfig({
        ...config,
        globalFloor: matId,
        roomFloors: {}, // Clear room overrides so Whole House instantly updates all rooms!
      });
    } else {
      onChangeConfig({
        ...config,
        roomFloors: {
          ...(config.roomFloors || {}),
          [selectedTarget]: matId,
        },
      });
    }
  };

  const handleSelectWallColor = (colorId: string) => {
    if (selectedTarget === "global") {
      onChangeConfig({
        ...config,
        globalWallColor: colorId,
        roomWallColors: {}, // Clear room overrides so Whole House instantly updates all rooms!
      });
    } else {
      onChangeConfig({
        ...config,
        roomWallColors: {
          ...(config.roomWallColors || {}),
          [selectedTarget]: colorId,
        },
      });
    }
  };

  const handleSelectWallTexture = (textureId: string) => {
    if (selectedTarget === "global") {
      onChangeConfig({
        ...config,
        globalWallTexture: textureId,
        roomWallTextures: {}, // Clear room overrides so Whole House instantly updates all rooms!
      });
    } else {
      onChangeConfig({
        ...config,
        roomWallTextures: {
          ...(config.roomWallTextures || {}),
          [selectedTarget]: textureId,
        },
      });
    }
  };

  const handleResetRoomToGlobal = (roomName: RoomName) => {
    const nextFloors = { ...(config.roomFloors || {}) };
    delete nextFloors[roomName];
    const nextColors = { ...(config.roomWallColors || {}) };
    delete nextColors[roomName];
    const nextTextures = { ...(config.roomWallTextures || {}) };
    delete nextTextures[roomName];

    onChangeConfig({
      ...config,
      roomFloors: nextFloors,
      roomWallColors: nextColors,
      roomWallTextures: nextTextures,
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    onChangeConfig({
      globalFloor: preset.globalFloor,
      globalWallColor: preset.globalWallColor,
      globalWallTexture: preset.globalWallTexture,
      roomFloors: { ...(preset.roomFloors || {}) },
      roomWallColors: { ...(preset.roomWallColors || {}) },
      roomWallTextures: {},
    });
  };

  const handleRandomizeCombination = () => {
    const randomFloor = () =>
      FLOOR_MATERIALS[Math.floor(Math.random() * FLOOR_MATERIALS.length)].id;
    const randomColor = () =>
      WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)].id;
    const randomTexture = () =>
      WALL_TEXTURES[Math.floor(Math.random() * WALL_TEXTURES.length)].id;

    onChangeConfig({
      globalFloor: randomFloor(),
      globalWallColor: randomColor(),
      globalWallTexture: randomTexture(),
      roomFloors: {
        hall: randomFloor(),
        kitchen: randomFloor(),
        bedroom: randomFloor(),
        pooja: randomFloor(),
        bathroom: randomFloor(),
      },
      roomWallColors: {
        hall: randomColor(),
        kitchen: randomColor(),
        bedroom: randomColor(),
        pooja: randomColor(),
        bathroom: randomColor(),
      },
      roomWallTextures: {
        hall: randomTexture(),
        bedroom: randomTexture(),
      },
    });
  };

  const filteredFloors = FLOOR_MATERIALS.filter(
    (m) => floorCategoryFilter === "all" || m.category === floorCategoryFilter
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>🎨 Materials & Finishes Studio</h2>
            <p className={styles.subtitle}>
              Customize luxury marbles, hardwoods, kitchen tiles, and wall designs with real-time 3D preview.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.randomBtn}
              onClick={handleRandomizeCombination}
              title="Try a random harmonious combination of materials"
            >
              🎲 Shuffle Design
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* 1-Click Design Presets Bar */}
        <div className={styles.presetsSection}>
          <div className={styles.presetLabel}>✨ Quick Design Presets:</div>
          <div className={styles.presetsList}>
            {DESIGN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={styles.presetCard}
                onClick={() => handleApplyPreset(preset.id)}
              >
                <span className={styles.presetIcon}>{preset.icon}</span>
                <span className={styles.presetName}>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Target Room Selector */}
        <div className={styles.targetSection}>
          <span className={styles.targetHeading}>Apply Changes To:</span>
          <div className={styles.targetTabs}>
            <button
              className={`${styles.targetTab} ${selectedTarget === "global" ? styles.targetTabActive : ""}`}
              onClick={() => setSelectedTarget("global")}
            >
              🌐 Whole House
            </button>
            {activeRooms.map((r) => {
              const hasOverride = Boolean(
                config.roomFloors?.[r] ||
                  config.roomWallColors?.[r] ||
                  config.roomWallTextures?.[r]
              );
              return (
                <button
                  key={r}
                  className={`${styles.targetTab} ${selectedTarget === r ? styles.targetTabActive : ""}`}
                  onClick={() => setSelectedTarget(r)}
                >
                  {r === "hall" && "🛋️ "}
                  {r === "kitchen" && "🍳 "}
                  {r === "bedroom" && "🛏️ "}
                  {r === "pooja" && "🪔 "}
                  {r === "bathroom" && "🚿 "}
                  {ROOM_LABELS[r] ?? r}
                  {hasOverride && " *"}
                </button>
              );
            })}
          </div>
          {selectedTarget !== "global" &&
            Boolean(
              config.roomFloors?.[selectedTarget] ||
                config.roomWallColors?.[selectedTarget] ||
                config.roomWallTextures?.[selectedTarget]
            ) && (
              <button
                style={{
                  background: "transparent",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                  marginTop: "4px",
                }}
                onClick={() => handleResetRoomToGlobal(selectedTarget)}
              >
                ↩️ Reset {ROOM_LABELS[selectedTarget] ?? selectedTarget} to Whole House Defaults
              </button>
            )}
        </div>

        {/* Category Tabs: Flooring vs Walls */}
        <div className={styles.tabsRow}>
          <button
            className={`${styles.mainTab} ${activeTab === "floor" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("floor")}
          >
            🏛️ Flooring Materials ({filteredFloors.length})
          </button>
          <button
            className={`${styles.mainTab} ${activeTab === "wall" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("wall")}
          >
            🧱 Walls & Finishes
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {activeTab === "floor" && (
            <div>
              {/* Filter Pills */}
              <div className={styles.filterPills}>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "all" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("all")}
                >
                  All ({FLOOR_MATERIALS.length})
                </button>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "marble" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("marble")}
                >
                  🏛️ Luxury Marbles
                </button>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "wood" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("wood")}
                >
                  🪵 Premium Hardwoods
                </button>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "tile" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("tile")}
                >
                  🍳 Kitchen & Bath Tiles
                </button>
              </div>

              {/* Floor Materials Grid */}
              <div className={styles.materialsGrid}>
                {filteredFloors.map((mat) => {
                  const isSelected = currentFloorId === mat.id;
                  return (
                    <div
                      key={mat.id}
                      className={`${styles.materialCard} ${isSelected ? styles.materialCardActive : ""}`}
                      onClick={() => handleSelectFloor(mat.id)}
                    >
                      <div
                        className={styles.swatchPreview}
                        style={{
                          backgroundColor: mat.swatchColor,
                          border: `1px solid ${isSelected ? "#e8912d" : "rgba(255,255,255,0.15)"}`,
                        }}
                      >
                        {mat.category === "marble" && "🏛️"}
                        {mat.category === "wood" && "🪵"}
                        {mat.category === "tile" && "🍳"}
                        {isSelected && <span className={styles.checkBadge}>✓</span>}
                      </div>
                      <div className={styles.materialMeta}>
                        <div className={styles.materialName}>{mat.name}</div>
                        <div className={styles.materialDesc}>{mat.description}</div>
                        <div className={styles.tagBadge}>
                          {mat.category === "marble" && "Polished Marble"}
                          {mat.category === "wood" && "Hardwood Grain"}
                          {mat.category === "tile" && "Engineered Tile"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "wall" && (
            <div className={styles.wallSection}>
              {/* Wall Colors & Color Wheel */}
              <div className={styles.sectionHeading}>🎨 Wall Colors & Color Wheel</div>

              {/* Color Wheel & Custom Color Picker Card */}
              <div className={styles.customColorWheelCard}>
                <div className={styles.wheelLeft}>
                  <label className={styles.colorWheelPickerWrapper} title="Click to open Color Wheel spectrum">
                    <input
                      type="color"
                      className={styles.colorWheelInput}
                      value={getWallColorHexStr(currentWallColorId)}
                      onChange={(e) => handleSelectWallColor(e.target.value)}
                    />
                    <div
                      className={styles.colorWheelPreviewCircle}
                      style={{
                        backgroundColor: getWallColorHexStr(currentWallColorId),
                      }}
                    >
                      <span className={styles.colorWheelIcon}>🌈</span>
                    </div>
                  </label>
                  <div className={styles.wheelInfo}>
                    <div className={styles.wheelTitle}>Custom Color Wheel</div>
                    <div className={styles.wheelSubtitle}>Pick any RGB / Hex paint color</div>
                  </div>
                </div>

                <div className={styles.wheelRight}>
                  <div className={styles.hexInputWrapper}>
                    <span className={styles.hexPrefix}>#</span>
                    <input
                      type="text"
                      className={styles.hexInput}
                      maxLength={6}
                      value={getWallColorHexStr(currentWallColorId).replace("#", "").toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value.trim().replace("#", "");
                        if (/^[0-9a-fA-F]{0,6}$/.test(val)) {
                          if (val.length === 6) {
                            handleSelectWallColor(`#${val}`);
                          }
                        }
                      }}
                      placeholder="FFFFFF"
                    />
                  </div>
                  <label className={styles.pickColorBtn}>
                    <input
                      type="color"
                      className={styles.colorWheelInput}
                      value={getWallColorHexStr(currentWallColorId)}
                      onChange={(e) => handleSelectWallColor(e.target.value)}
                    />
                    🎨 Pick Color
                  </label>
                </div>
              </div>

              <div className={styles.paletteHeading}>Curated Architectural Paint Swatches</div>
              <div className={styles.colorsGrid}>
                {WALL_COLORS.map((col) => {
                  const isSelected =
                    currentWallColorId === col.id ||
                    getWallColorHexStr(currentWallColorId).toLowerCase() === col.hex.toLowerCase();
                  return (
                    <div
                      key={col.id}
                      className={`${styles.colorCard} ${isSelected ? styles.colorCardActive : ""}`}
                      onClick={() => handleSelectWallColor(col.id)}
                    >
                      <div
                        className={styles.colorCircle}
                        style={{
                          backgroundColor: col.hex,
                          boxShadow: isSelected ? "0 0 0 3px #e8912d" : "none",
                        }}
                      >
                        {isSelected && <span className={styles.colorCheck}>✓</span>}
                      </div>
                      <div className={styles.colorName}>{col.name}</div>
                    </div>
                  );
                })}
              </div>

              {/* Wall Architectural Textures */}
              <div className={styles.sectionHeading} style={{ marginTop: "24px" }}>
                🧱 Wall Architectural Finishes & Textures
              </div>
              <div className={styles.texturesGrid}>
                {WALL_TEXTURES.map((tex) => {
                  const isSelected = currentWallTextureId === tex.id;
                  return (
                    <div
                      key={tex.id}
                      className={`${styles.textureCard} ${isSelected ? styles.textureCardActive : ""}`}
                      onClick={() => handleSelectWallTexture(tex.id)}
                    >
                      <div className={styles.textureHeader}>
                        <span className={styles.textureName}>{tex.name}</span>
                        {isSelected && <span className={styles.activePill}>Active</span>}
                      </div>
                      <p className={styles.textureDesc}>{tex.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerNote}>
            💡 Pro-tip: Walk through the house in <b>3D Walkthrough Mode</b> to inspect specular reflections and wood grain up close!
          </div>
          <button className={styles.doneBtn} onClick={onClose}>
            ✓ Done Customizing
          </button>
        </div>
      </div>
    </div>
  );
}
