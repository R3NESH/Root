"use client";

import React, { useState } from "react";
import {
  FURNITURE_CATALOG,
  FurnitureCategory,
  FurnitureItemDef,
} from "@/lib/furnitureCatalog";
import styles from "./ReplaceObjectModal.module.css";

interface ReplaceObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetObjectName: string;
  targetItemType?: string;
  onConfirmReplace: (newType: string) => void;
}

export default function ReplaceObjectModal({
  isOpen,
  onClose,
  targetObjectName,
  targetItemType,
  onConfirmReplace,
}: ReplaceObjectModalProps) {
  const currentDef = targetItemType ? FURNITURE_CATALOG.find((i) => i.type === targetItemType) : null;
  const initialCategory = currentDef ? currentDef.category : "all";

  const [activeCategory, setActiveCategory] = useState<FurnitureCategory | "all">(initialCategory);

  if (!isOpen) return null;

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

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>🔄 Replace Object</h3>
            <p className={styles.subtitle}>
              Swap <b>&ldquo;{targetObjectName}&rdquo;</b> with a new style or shape at the exact same spot.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Categories Bar */}
        <div className={styles.categoriesBar}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.catTab} ${activeCategory === cat.id ? styles.catTabActive : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className={styles.gridContainer}>
          <div className={styles.itemsGrid}>
            {filteredItems.map((item) => (
              <div
                key={item.type}
                className={`${styles.itemCard} ${item.type === targetItemType ? styles.itemCardCurrent : ""}`}
                onClick={() => {
                  onConfirmReplace(item.type);
                  onClose();
                }}
              >
                <div className={styles.icon}>{item.icon}</div>
                <div className={styles.meta}>
                  <div className={styles.name}>{item.name}</div>
                  <div className={styles.dims}>
                    {item.dimensions.widthFt}&apos; × {item.dimensions.depthFt}&apos; ft
                  </div>
                  <div className={styles.desc}>{item.description}</div>
                </div>
                <button className={styles.replaceActionBtn}>
                  {item.type === targetItemType ? "Current Item" : "✓ Swap Here"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            💡 Pro-tip: The new item will automatically inherit the same 3D coordinates and rotation angle!
          </span>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
