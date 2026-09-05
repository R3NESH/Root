"use client";

import React, { useState } from "react";
import {
  DESIGN_PRESETS,
  FLOOR_MATERIALS,
  FloorCategory,
  HouseMaterialConfig,
  WALL_COLORS,
  WALL_TEXTURES,
  DOOR_COLORS,
  getWallColorHexStr,
  getDoorColorHexStr,
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
  const [activeTab, setActiveTab] = useState<"floor" | "wall" | "doors" | "smoothness" | "presets">("floor");
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

  // Active Door Color for current target
  const currentDoorColorId =
    selectedTarget === "global"
      ? config.globalDoorColor || "dark_walnut"
      : config.roomDoorColors?.[selectedTarget] || config.globalDoorColor || "dark_walnut";

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

  const handleSelectDoorColor = (colorIdOrHex: string) => {
    if (selectedTarget === "global") {
      onChangeConfig({
        ...config,
        globalDoorColor: colorIdOrHex,
        roomDoorColors: {}, // Clear room overrides so Whole House instantly updates all rooms!
      });
    } else {
      onChangeConfig({
        ...config,
        roomDoorColors: {
          ...(config.roomDoorColors || {}),
          [selectedTarget]: colorIdOrHex,
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
    const nextDoors = { ...(config.roomDoorColors || {}) };
    delete nextDoors[roomName];

    onChangeConfig({
      ...config,
      roomFloors: nextFloors,
      roomWallColors: nextColors,
      roomWallTextures: nextTextures,
      roomDoorColors: nextDoors,
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
            <h2 className={styles.title}> Materials & Finishes Studio</h2>
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
              Shuffle Design
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* 1-Click Design Presets Bar */}
        <div className={styles.presetsSection}>
          <div className={styles.presetLabel}> Quick Design Presets:</div>
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
              Whole House
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
                  border: "1px solid rgba(111, 154, 168, 0.4)",
                  color: "#6f9aa8",
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
                Reset {ROOM_LABELS[selectedTarget] ?? selectedTarget} to Whole House Defaults
              </button>
            )}
        </div>

        {/* Category Tabs: Flooring vs Walls vs Doors */}
        <div className={styles.tabsRow}>
          <button
            className={`${styles.mainTab} ${activeTab === "floor" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("floor")}
          >
            Flooring Materials ({filteredFloors.length})
          </button>
          <button
            className={`${styles.mainTab} ${activeTab === "wall" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("wall")}
          >
            Walls & Finishes
          </button>
          <button
            className={`${styles.mainTab} ${activeTab === "doors" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("doors")}
          >
            Doors & Color Wheel
          </button>
          <button
            className={`${styles.mainTab} ${activeTab === "smoothness" ? styles.mainTabActive : ""}`}
            onClick={() => setActiveTab("smoothness")}
          >
            Graphics &amp; Smoothness (4K Ultra)
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* TAB 4: GRAPHICS & TEXTURE SMOOTHNESS (ULTRA EXTREME 4K) */}
          {activeTab === "smoothness" && (
            <div className={styles.smoothnessContainer}>
              {/* Graphics Fidelity Tiers */}
              <div className={styles.graphicsTierGrid}>
                <div
                  className={`${styles.graphicsTierBtn} ${config.graphicsFidelityTier === "ultra_extreme" ? styles.graphicsTierBtnActive : ""}`}
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      graphicsFidelityTier: "ultra_extreme",
                      textureResolution: 4096,
                      anisotropicFiltering: 16,
                      textureSmoothness: 0.90,
                      floorGlossLevel: 0.95,
                      wallSmoothness: 0.90,
                    })
                  }
                >
                  <div className={styles.tierTitle}>
                    <span>ULT</span> Ultra Extreme (4K)
                  </div>
                  <div className={styles.tierDesc}>
                    4K Ultra Textures (4096px), 4K PCF Soft Shadows, 16x Anisotropy &amp; Mirror Polish.
                  </div>
                </div>

                <div
                  className={`${styles.graphicsTierBtn} ${config.graphicsFidelityTier === "high" ? styles.graphicsTierBtnActive : ""}`}
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      graphicsFidelityTier: "high",
                      textureResolution: 2048,
                      anisotropicFiltering: 8,
                      textureSmoothness: 0.80,
                      floorGlossLevel: 0.80,
                      wallSmoothness: 0.80,
                    })
                  }
                >
                  <div className={styles.tierTitle}>
                    <span>FX</span> High Definition (2K)
                  </div>
                  <div className={styles.tierDesc}>
                    2K Textures (2048px), 2K Shadows, 8x Anisotropy &amp; Semi-Gloss Reflections.
                  </div>
                </div>

                <div
                  className={`${styles.graphicsTierBtn} ${config.graphicsFidelityTier === "standard" ? styles.graphicsTierBtnActive : ""}`}
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      graphicsFidelityTier: "standard",
                      textureResolution: 1024,
                      anisotropicFiltering: 4,
                      textureSmoothness: 0.65,
                      floorGlossLevel: 0.60,
                      wallSmoothness: 0.65,
                    })
                  }
                >
                  <div className={styles.tierTitle}>
                    <span>PWR</span> Standard (1K)
                  </div>
                  <div className={styles.tierDesc}>
                    1K Textures (1024px), Basic Shadows &amp; Balanced Performance.
                  </div>
                </div>
              </div>

              {/* Slider 1: Whole-House Texture Smoothness Master */}
              <div className={styles.smoothnessCard}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderTitle}>
                    <span>FX</span> Whole-House Texture Smoothness Master
                  </span>
                  <span className={styles.sliderBadge}>
                    {Math.round((config.textureSmoothness ?? 0.88) * 100)}% Smooth
                  </span>
                </div>
                <div className={styles.smoothnessSliderRow}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round((config.textureSmoothness ?? 0.88) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) / 100;
                      onChangeConfig({ ...config, textureSmoothness: val });
                    }}
                    className={styles.smoothSlider}
                  />
                </div>
                <div className={styles.sliderLabels}>
                  <span>Matte / Heavy Grain (0%)</span>
                  <span>Silky Ultra-Smooth (100%)</span>
                </div>
              </div>

              {/* Slider 2: Floor Mirror Gloss & Polish */}
              <div className={styles.smoothnessCard}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderTitle}>
                    <span>CLS</span> Floor Surface Mirror Gloss &amp; Polish
                  </span>
                  <span className={styles.sliderBadge}>
                    {Math.round((config.floorGlossLevel ?? 0.92) * 100)}% Gloss
                  </span>
                </div>
                <div className={styles.smoothnessSliderRow}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round((config.floorGlossLevel ?? 0.92) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) / 100;
                      onChangeConfig({ ...config, floorGlossLevel: val });
                    }}
                    className={styles.smoothSlider}
                  />
                </div>
                <div className={styles.sliderLabels}>
                  <span>Matte Stone / Non-Reflective (0%)</span>
                  <span>Polished Mirror Reflection (100%)</span>
                </div>
              </div>

              {/* Slider 3: Wall Silkiness & Stucco Relief */}
              <div className={styles.smoothnessCard}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderTitle}>
                    <span>WAL</span> Wall Silkiness &amp; Embossed Relief
                  </span>
                  <span className={styles.sliderBadge}>
                    {Math.round((config.wallSmoothness ?? 0.88) * 100)}% Silk
                  </span>
                </div>
                <div className={styles.smoothnessSliderRow}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round((config.wallSmoothness ?? 0.88) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) / 100;
                      onChangeConfig({ ...config, wallSmoothness: val });
                    }}
                    className={styles.smoothSlider}
                  />
                </div>
                <div className={styles.sliderLabels}>
                  <span>Heavy 3D Brick / Stucco Relief (0%)</span>
                  <span>Smooth Satin Venetian Silk (100%)</span>
                </div>
              </div>

              {/* Hardware Super-Sampling Options */}
              <div className={styles.smoothnessCard}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderTitle}>
                    <span>CFG</span> Texture Resolution &amp; Anisotropic Filtering
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#8e8a82", marginBottom: "4px" }}>Texture Resolution:</div>
                    <div className={styles.resButtonGroup}>
                      {[
                        { val: 4096, label: "4K Ultra (4096px)" },
                        { val: 2048, label: "2K HD (2048px)" },
                        { val: 1024, label: "1K Standard (1024px)" },
                      ].map((r) => (
                        <button
                          key={r.val}
                          className={`${styles.resBtn} ${(config.textureResolution || 4096) === r.val ? styles.resBtnActive : ""}`}
                          onClick={() => onChangeConfig({ ...config, textureResolution: r.val as 1024 | 2048 | 4096 })}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "#8e8a82", marginBottom: "4px" }}>Anisotropic Filtering:</div>
                    <div className={styles.resButtonGroup}>
                      {[
                        { val: 16, label: "16x Maximum Clarity" },
                        { val: 8, label: "8x Standard" },
                        { val: 4, label: "4x Performance" },
                      ].map((a) => (
                        <button
                          key={a.val}
                          className={`${styles.resBtn} ${(config.anisotropicFiltering || 16) === a.val ? styles.resBtnActive : ""}`}
                          onClick={() => onChangeConfig({ ...config, anisotropicFiltering: a.val as 4 | 8 | 16 })}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                  Luxury Marbles
                </button>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "wood" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("wood")}
                >
                  Premium Hardwoods
                </button>
                <button
                  className={`${styles.filterPill} ${floorCategoryFilter === "tile" ? styles.filterPillActive : ""}`}
                  onClick={() => setFloorCategoryFilter("tile")}
                >
                  Kitchen & Bath Tiles
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
                          border: `1px solid ${isSelected ? "#b85c22" : "rgba(255,255,255,0.15)"}`,
                        }}
                      >
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
              <div className={styles.sectionHeading}> Wall Colors & Color Wheel</div>

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
                      <span className={styles.colorWheelIcon}>SPC</span>
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
                    Pick Color
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
                          boxShadow: isSelected ? "0 0 0 3px #b85c22" : "none",
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
                Wall Architectural Finishes & Textures
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

          {activeTab === "doors" && (
            <div className={styles.wallSection}>
              {/* Door Colors & Color Wheel */}
              <div className={styles.sectionHeading}> Door Colors & Hardwood Finishes</div>

              {/* Door Color Wheel & Custom Color Picker Card */}
              <div className={styles.customColorWheelCard}>
                <div className={styles.wheelLeft}>
                  <label className={styles.colorWheelPickerWrapper} title="Click to open Color Wheel spectrum">
                    <input
                      type="color"
                      className={styles.colorWheelInput}
                      value={getDoorColorHexStr(currentDoorColorId)}
                      onChange={(e) => handleSelectDoorColor(e.target.value)}
                    />
                    <div
                      className={styles.colorWheelPreviewCircle}
                      style={{
                        backgroundColor: getDoorColorHexStr(currentDoorColorId),
                      }}
                    >
                      <span className={styles.colorWheelIcon}>DR</span>
                    </div>
                  </label>
                  <div className={styles.wheelInfo}>
                    <div className={styles.wheelTitle}>Custom Door Color Wheel</div>
                    <div className={styles.wheelSubtitle}>Pick any custom hardwood or paint finish for doors</div>
                  </div>
                </div>

                <div className={styles.wheelRight}>
                  <div className={styles.hexInputWrapper}>
                    <span className={styles.hexPrefix}>#</span>
                    <input
                      type="text"
                      className={styles.hexInput}
                      maxLength={6}
                      value={getDoorColorHexStr(currentDoorColorId).replace("#", "").toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value.trim().replace("#", "");
                        if (/^[0-9a-fA-F]{0,6}$/.test(val)) {
                          if (val.length === 6) {
                            handleSelectDoorColor(`#${val}`);
                          }
                        }
                      }}
                      placeholder="2B1E16"
                    />
                  </div>
                  <label className={styles.pickColorBtn}>
                    <input
                      type="color"
                      className={styles.colorWheelInput}
                      value={getDoorColorHexStr(currentDoorColorId)}
                      onChange={(e) => handleSelectDoorColor(e.target.value)}
                    />
                    Pick Door Color
                  </label>
                </div>
              </div>

              <div className={styles.paletteHeading}>Curated Hardwood & Architectural Door Finishes</div>
              <div className={styles.colorsGrid}>
                {DOOR_COLORS.map((col) => {
                  const isSelected =
                    currentDoorColorId === col.id ||
                    getDoorColorHexStr(currentDoorColorId).toLowerCase() === col.hex.toLowerCase();
                  return (
                    <div
                      key={col.id}
                      className={`${styles.colorCard} ${isSelected ? styles.colorCardActive : ""}`}
                      onClick={() => handleSelectDoorColor(col.id)}
                    >
                      <div
                        className={styles.colorCircle}
                        style={{
                          backgroundColor: col.hex,
                          boxShadow: isSelected ? "0 0 0 3px #b85c22" : "none",
                        }}
                      >
                        {isSelected && <span className={styles.colorCheck}>✓</span>}
                      </div>
                      <div className={styles.colorName}>{col.name}</div>
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
            Pro-tip: Walk through the house in <b>3D Walkthrough Mode</b> to inspect specular reflections and wood grain up close!
          </div>
          <button className={styles.doneBtn} onClick={onClose}>
            ✓ Done Customizing
          </button>
        </div>
      </div>
    </div>
  );
}
