"use client";

import React, { useState } from "react";
import { OPENINGS_CATALOG, OpeningItemDef } from "@/lib/openingsCatalog";
import styles from "./DoorsWindowsDrawer.module.css";

interface DoorsWindowsDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  placingOpeningDef: OpeningItemDef | null;
  onSelectPlaceOpening: (def: OpeningItemDef | null) => void;
  onOpenWindowShapeModal?: () => void;
}

export default function DoorsWindowsDrawer({
  isOpen,
  onToggleOpen,
  placingOpeningDef,
  onSelectPlaceOpening,
  onOpenWindowShapeModal,
}: DoorsWindowsDrawerProps) {
  const [activeCategory, setActiveCategory] = useState<"all" | "door" | "window">("all");

  const categories = [
    { id: "all" as const, label: "All Openings", icon: "✨" },
    { id: "door" as const, label: "Doors", icon: "🚪" },
    { id: "window" as const, label: "Windows", icon: "🪟" },
  ];

  const filteredItems = OPENINGS_CATALOG.filter(
    (item) => activeCategory === "all" || item.category === activeCategory
  );

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        className={`${styles.triggerBtn} ${isOpen ? styles.triggerBtnActive : ""}`}
        onClick={onToggleOpen}
        title="Open Doors & Windows Catalog (Drag & Drop onto any wall)"
      >
        <span className={styles.triggerIcon}>🚪</span>
        <span className={styles.triggerLabel}>Doors &amp; Windows</span>
      </button>

      {/* Floating Placement Banner when an opening is armed for drop */}
      {placingOpeningDef && (
        <div className={styles.placementBanner}>
          <span className={styles.bannerPulse}>🎯</span>
          <span>Click or drag onto any wall to place:</span>
          <span className={styles.placementItemTag}>
            {placingOpeningDef.icon} {placingOpeningDef.name} ({Math.round(placingOpeningDef.widthIn / 12)}ft)
          </span>
          <button
            className={styles.cancelPlacementBtn}
            onClick={() => onSelectPlaceOpening(null)}
            title="Cancel placement mode (ESC)"
          >
            Cancel (ESC)
          </button>
        </div>
      )}

      {/* Drawer Panel */}
      {isOpen && (
        <div className={styles.drawerPanel}>
          {/* Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleGroup}>
              <span className={styles.drawerTitleBadge}>CAD OPENINGS</span>
              <h3 className={styles.drawerTitle}>Doors &amp; Windows Catalog</h3>
            </div>
            <div className={styles.headerActions}>
              {onOpenWindowShapeModal && (
                <button
                  className={styles.styleStudioBtn}
                  onClick={onOpenWindowShapeModal}
                  title="Open Window Shapes & Frame Materials Studio"
                >
                  🎨 Window Shapes Studio
                </button>
              )}
              <button className={styles.closeDrawerBtn} onClick={onToggleOpen} title="Close drawer">
                ×
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className={styles.categoryTabs}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`${styles.categoryTab} ${activeCategory === cat.id ? styles.categoryTabActive : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className={styles.itemsGrid}>
            {filteredItems.map((item) => {
              const isSelected = placingOpeningDef?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`${styles.itemCard} ${isSelected ? styles.itemCardActive : ""}`}
                  onClick={() => {
                    if (isSelected) {
                      onSelectPlaceOpening(null);
                    } else {
                      onSelectPlaceOpening(item);
                    }
                  }}
                  title={`Click to arm and drop on any 2D/3D wall: ${item.name} (${item.description})`}
                >
                  <div className={styles.itemCardTop}>
                    <span className={styles.itemIcon}>{item.icon}</span>
                    {item.tag && <span className={styles.itemTag}>{item.tag}</span>}
                  </div>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemDims}>
                    {Math.round(item.widthIn / 12)}&apos; × {Math.round(item.heightIn / 12)}&apos; ({item.widthIn}&quot; × {item.heightIn}&quot;)
                  </div>
                  <div className={styles.itemDesc}>{item.description}</div>
                  <button
                    className={`${styles.placeBtn} ${isSelected ? styles.placeBtnActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlaceOpening(isSelected ? null : item);
                    }}
                  >
                    {isSelected ? "🎯 Ready to Drop..." : "➕ Drag / Place on Wall"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
