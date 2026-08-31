"use client";

import React, { useState } from "react";
import {
  FURNITURE_CATALOG,
  FurnitureItemDef,
  PlacedCustomObject,
} from "@/lib/furnitureCatalog";
import styles from "./FurnitureDrawer.module.css";

interface FurnitureDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  placingItemType: string | null;
  onSelectPlaceItem: (type: string | null) => void;
  selectedObject: PlacedCustomObject | null;
  onRotateSelected: (angleDelta: number) => void;
  onScaleSelected: (scaleMultiplier: number) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onDeselectObject: () => void;
  onOpenAIFurnitureModal?: () => void;
}

export default function FurnitureDrawer({
  isOpen,
  onToggleOpen,
  placingItemType,
  onSelectPlaceItem,
  selectedObject,
  onRotateSelected,
  onScaleSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onDeselectObject,
  onOpenAIFurnitureModal,
}: FurnitureDrawerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Items" },
    { id: "living", label: "🛋️ Living" },
    { id: "bedroom", label: "🛏️ Bedroom" },
    { id: "dining", label: "🍽️ Dining" },
    { id: "kitchen", label: "🍳 Kitchen" },
    { id: "bathroom", label: "🛁 Bathroom" },
    { id: "decor", label: "🪴 Decor & Pooja" },
  ];

  const filteredItems = FURNITURE_CATALOG.filter(
    (item) => activeCategory === "all" || item.category === activeCategory
  );

  const activePlacingDef = placingItemType
    ? FURNITURE_CATALOG.find((i) => i.type === placingItemType)
    : null;

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        className={`${styles.triggerBtn} ${isOpen ? styles.triggerBtnActive : ""}`}
        onClick={onToggleOpen}
        title="Open 3D Furniture & Objects Catalog"
      >
        <span>🛋️</span>
        <span>Add Furniture</span>
      </button>

      {/* Floating Placement Banner when an item is selected */}
      {activePlacingDef && (
        <div className={styles.placementBanner}>
          <span>🎯 Click on any room floor to place:</span>
          <span className={styles.placementItemTag}>
            {activePlacingDef.icon} {activePlacingDef.name}
          </span>
          <button
            className={styles.cancelPlacementBtn}
            onClick={() => onSelectPlaceItem(null)}
          >
            Cancel (ESC)
          </button>
        </div>
      )}

      {/* Furniture Catalog Drawer Panel */}
      {isOpen && (
        <div className={styles.drawerPanel}>
          {/* Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleGroup}>
              <span className={styles.drawerTitleBadge}>3D CATALOG</span>
              <h3 className={styles.drawerTitle}>Furniture &amp; Interior Decor</h3>
            </div>
            <button className={styles.closeDrawerBtn} onClick={onToggleOpen}>
              ×
            </button>
          </div>

          {/* AI Photo Scanner Banner */}
          {onOpenAIFurnitureModal && (
            <div
              style={{
                margin: "0 16px 12px 16px",
                padding: "10px 14px",
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f8fafc" }}>
                  📸 AI Photo-to-3D Scanner
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Upload any furniture photo to auto-model into 3D
                </div>
              </div>
              <button
                style={{
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  border: "1px solid #38bdf8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                onClick={onOpenAIFurnitureModal}
              >
                ✨ Scan Photo...
              </button>
            </div>
          )}

          {/* Category Tabs */}
          <div className={styles.categoryTabs}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`${styles.tabBtn} ${
                  activeCategory === cat.id ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid of Furniture Items */}
          <div className={styles.itemsGrid}>
            {filteredItems.map((item: FurnitureItemDef) => {
              const isSelectedForPlace = placingItemType === item.type;
              return (
                <div
                  key={item.type}
                  className={`${styles.itemCard} ${
                    isSelectedForPlace ? styles.itemCardActive : ""
                  }`}
                  onClick={() => {
                    onSelectPlaceItem(isSelectedForPlace ? null : item.type);
                  }}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemName}>{item.name}</span>
                  </div>
                  <span className={styles.itemDim}>
                    {item.dimensions.widthFt}′ × {item.dimensions.depthFt}′ × {item.dimensions.heightFt}′ ft
                  </span>
                  <span className={styles.itemDesc}>{item.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Object Inspector Gizmo Bar */}
      {selectedObject && (
        <div className={styles.objectInspector}>
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitle}>
              ✨ {selectedObject.name}
            </div>
            <button className={styles.closeDrawerBtn} onClick={onDeselectObject}>
              ×
            </button>
          </div>

          <div className={styles.inspectorActionsGrid}>
            <button
              className={styles.actionBtn}
              onClick={() => onRotateSelected(Math.PI / 4)}
              title="Rotate 45 degrees"
            >
              🔄 +45°
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onRotateSelected(Math.PI / 2)}
              title="Rotate 90 degrees"
            >
              🔄 +90°
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onScaleSelected(1.15)}
              title="Enlarge Size"
            >
              🔍 +Size
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onScaleSelected(0.85)}
              title="Reduce Size"
            >
              🔎 −Size
            </button>
            <button
              className={styles.actionBtn}
              onClick={onDuplicateSelected}
              title="Duplicate Item"
            >
              📋 Clone
            </button>
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={onDeleteSelected}
              title="Delete this object"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
