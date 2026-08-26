"use client";

import React, { useState } from "react";
import {
  FURNITURE_CATALOG,
  FURNITURE_COLOR_SWATCHES,
  FurnitureCategory,
  FurnitureItemDef,
  PlacedCustomObject,
} from "@/lib/furnitureCatalog";
import styles from "./TopRibbonTaskbar.module.css";

interface TopRibbonTaskbarProps {
  mode: "orbit" | "walkthrough" | "blueprint";
  onChangeMode: (mode: "orbit" | "walkthrough" | "blueprint") => void;
  lightsOn: boolean;
  onToggleLights: () => void;
  onOpenMaterialModal: () => void;
  onOpenModelBlueprintsModal: () => void;
  onOpenExportModal: () => void;
  placingItemType: string | null;
  onSelectPlaceItem: (type: string | null) => void;
  selectedObject: PlacedCustomObject | null;
  onRotateSelected: (angleDelta: number) => void;
  onScaleSelected: (scaleDelta: number) => void;
  onChangeColorSelected: (colorHex: number) => void;
  onDeleteSelected: () => void;
  onClearAllFurniture: () => void;
  onDeselectObject: () => void;
  totalPlacedCount: number;
}

export default function TopRibbonTaskbar({
  mode,
  onChangeMode,
  lightsOn,
  onToggleLights,
  onOpenMaterialModal,
  onOpenModelBlueprintsModal,
  onOpenExportModal,
  placingItemType,
  onSelectPlaceItem,
  selectedObject,
  onRotateSelected,
  onScaleSelected,
  onChangeColorSelected,
  onDeleteSelected,
  onClearAllFurniture,
  onDeselectObject,
  totalPlacedCount,
}: TopRibbonTaskbarProps) {
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory | "all">("living");
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);

  const categories: { id: FurnitureCategory | "all"; label: string; icon: string }[] = [
    { id: "living", label: "Living & Sofas", icon: "🛋️" },
    { id: "bedroom", label: "Bedrooms & Beds", icon: "🛏️" },
    { id: "dining", label: "Dining & Kitchen", icon: "🍽️" },
    { id: "office", label: "Office & Study", icon: "💻" },
    { id: "decor", label: "Decor & Lighting", icon: "🪴" },
    { id: "sacred", label: "Sacred Mandir", icon: "🛕" },
    { id: "all", label: "All Items", icon: "📦" },
  ];

  const filteredItems = FURNITURE_CATALOG.filter(
    (item) => activeCategory === "all" || item.category === activeCategory
  );

  const activePlacingDef = placingItemType
    ? FURNITURE_CATALOG.find((i) => i.type === placingItemType)
    : null;

  return (
    <header className={styles.taskbarRoot}>
      {/* 1. Top Ribbon Title & Main Actions Bar */}
      <div className={styles.titleBar}>
        <div className={styles.brandGroup}>
          <div className={styles.brandLogo}>📐</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Plot to Plan Studio</span>
            <span className={styles.brandSub}>Architectural 3D &amp; Interior Designer</span>
          </div>
        </div>

        {/* Center: Mode Switcher Tabs */}
        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeBtn} ${mode === "orbit" ? styles.modeBtnActive : ""}`}
            onClick={() => onChangeMode("orbit")}
            title="3D Orbit View (Aerial Camera)"
          >
            🌐 3D Orbit
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "walkthrough" ? styles.modeBtnActive : ""}`}
            onClick={() => onChangeMode("walkthrough")}
            title="First-Person Walkthrough (5'5' Eye Level)"
          >
            🚶 Walk Inside
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "blueprint" ? styles.modeBtnActiveBlueprint : ""}`}
            onClick={() => onChangeMode("blueprint")}
            title="2D Architectural Blueprint & Dimension Plan"
          >
            📐 2D Blueprint
          </button>
        </div>

        {/* Right Quick Action Tools */}
        <div className={styles.quickTools}>
          <button
            className={styles.toolBtn}
            onClick={onToggleLights}
            title={lightsOn ? "Switch to Night Lighting" : "Switch to Day Lighting"}
          >
            {lightsOn ? "💡 Lights On" : "🌙 Lights Off"}
          </button>

          <button
            className={styles.materialStudioBtn}
            onClick={onOpenMaterialModal}
            title="Customize Marbles, Hardwoods, Kitchen Tiles & Wall Finishes"
          >
            🎨 Finishes &amp; Materials
          </button>

          <button
            className={styles.modelBlueprintsBtn}
            onClick={onOpenModelBlueprintsModal}
            title="Explore Curated Architectural Floor Plan Blueprints"
          >
            🏛️ Blueprints
          </button>

          <button
            className={styles.exportBtn}
            onClick={onOpenExportModal}
            title="Export Architectural Drawing Sheet as 4K PNG, SVG, or Print PDF"
          >
            📥 Export Plan
          </button>

          <button
            className={styles.collapseBtn}
            onClick={() => setIsRibbonCollapsed(!isRibbonCollapsed)}
            title={isRibbonCollapsed ? "Expand Ribbon" : "Collapse Ribbon"}
          >
            {isRibbonCollapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* 2. Ribbon Furniture Shelf & Customizer Deck */}
      {!isRibbonCollapsed && (
        <div className={styles.ribbonBody}>
          {/* Left: Category Filter Tabs */}
          <div className={styles.categoryColumn}>
            <span className={styles.sectionLabel}>FURNITURE TYPE</span>
            <div className={styles.categoryList}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catBtnActive : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span>{cat.icon}</span>
                  <span className={styles.catLabelText}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Center: Furniture Items Carousel / Strip */}
          <div className={styles.itemsSection}>
            <div className={styles.shelfHeader}>
              <span className={styles.sectionLabel}>
                CLICK AN ITEM TO PLACE ANYWHERE IN 3D ({filteredItems.length} options)
              </span>
              {totalPlacedCount > 0 && (
                <span className={styles.placedCountTag}>
                  {totalPlacedCount} item{totalPlacedCount > 1 ? "s" : ""} placed in house
                </span>
              )}
            </div>

            <div className={styles.itemsStrip}>
              {filteredItems.map((item) => {
                const isArmingThis = placingItemType === item.type;
                return (
                  <div
                    key={item.type}
                    className={`${styles.furnitureCard} ${isArmingThis ? styles.furnitureCardArming : ""}`}
                    onClick={() => onSelectPlaceItem(isArmingThis ? null : item.type)}
                    title={item.description}
                  >
                    <div className={styles.itemIconBox}>
                      <span className={styles.itemIcon}>{item.icon}</span>
                      {isArmingThis && <span className={styles.placingBadge}>Targeting...</span>}
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{item.name}</div>
                      <div className={styles.itemDims}>
                        {item.dimensions.widthFt}&apos; × {item.dimensions.depthFt}&apos; ft
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selection Transform & Color Studio (Appears when item is selected) */}
          <div className={styles.selectionSection}>
            <span className={styles.sectionLabel}>OBJECT CONTROLS</span>
            {selectedObject ? (
              <div className={styles.selectedControls}>
                <div className={styles.selectedTitleRow}>
                  <span className={styles.selectedObjName}>{selectedObject.name}</span>
                  <button className={styles.deselectBtn} onClick={onDeselectObject} title="Deselect">
                    ✕
                  </button>
                </div>

                {/* Transform Buttons */}
                <div className={styles.transformRow}>
                  <button
                    className={styles.transformBtn}
                    onClick={() => onRotateSelected(Math.PI / 4)}
                    title="Rotate 45° (or press R)"
                  >
                    🔄 45°
                  </button>
                  <button
                    className={styles.transformBtn}
                    onClick={() => onRotateSelected(Math.PI / 2)}
                    title="Rotate 90°"
                  >
                    🔄 90°
                  </button>
                  <button
                    className={styles.transformBtn}
                    onClick={() => onScaleSelected(0.1)}
                    title="Scale Up (+10%)"
                  >
                    🔍 +
                  </button>
                  <button
                    className={styles.transformBtn}
                    onClick={() => onScaleSelected(-0.1)}
                    title="Scale Down (-10%)"
                  >
                    🔍 -
                  </button>
                </div>

                {/* Color Tint Palette */}
                <div className={styles.colorPaletteRow}>
                  {FURNITURE_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      className={styles.swatchBtn}
                      style={{
                        backgroundColor: swatch.bg,
                        outline: selectedObject.colorHex === swatch.hex ? "2px solid #fbbf24" : "none",
                      }}
                      onClick={() => onChangeColorSelected(swatch.hex)}
                      title={`Tint: ${swatch.name}`}
                    />
                  ))}
                </div>

                {/* Delete Button */}
                <button className={styles.deleteBtn} onClick={onDeleteSelected} title="Delete selected object">
                  🗑️ Delete Item
                </button>
              </div>
            ) : (
              <div className={styles.noSelectionPlaceholder}>
                <span className={styles.placeholderIcon}>👆</span>
                <span className={styles.placeholderText}>
                  Click any placed 3D furniture to rotate, recolor, scale, or delete.
                </span>
                {totalPlacedCount > 0 && (
                  <button className={styles.clearAllBtn} onClick={onClearAllFurniture}>
                    🧹 Clear All Placed
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Placement Banner when active */}
      {activePlacingDef && (
        <div className={styles.placingHUD}>
          <span className={styles.placingPulse}>🎯</span>
          <span>
            Click anywhere on the room floor to place <b>{activePlacingDef.name}</b>
          </span>
          <button className={styles.cancelPlaceBtn} onClick={() => onSelectPlaceItem(null)}>
            Cancel (ESC)
          </button>
        </div>
      )}
    </header>
  );
}
