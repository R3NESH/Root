"use client";

import React, { useState } from "react";
import {
  WindowConfig,
  WindowShapeId,
  WindowFrameFinishId,
  WindowGlassTintId,
  WINDOW_SHAPES,
  WINDOW_FRAME_FINISHES,
  WINDOW_GLASS_TINTS,
  DEFAULT_WINDOW_CONFIG,
} from "@/lib/windowCatalog";
import { RoomName, ROOM_LABELS } from "@/lib/rooms";
import styles from "./WindowShapeModal.module.css";

interface WindowShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WindowConfig;
  onChangeConfig: (newConfig: WindowConfig) => void;
}

export default function WindowShapeModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}: WindowShapeModalProps) {
  const [selectedScope, setSelectedScope] = useState<"global" | RoomName>("global");
  const [localConfig, setLocalConfig] = useState<WindowConfig>(config);

  if (!isOpen) return null;

  const activeShapeId =
    selectedScope === "global"
      ? localConfig.globalShape
      : localConfig.roomWindowShapes[selectedScope] || localConfig.globalShape;

  const handleSelectShape = (shapeId: WindowShapeId) => {
    if (selectedScope === "global") {
      setLocalConfig((prev) => ({
        ...prev,
        globalShape: shapeId,
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        roomWindowShapes: {
          ...prev.roomWindowShapes,
          [selectedScope]: shapeId,
        },
      }));
    }
  };

  const handleSelectFrame = (finishId: WindowFrameFinishId) => {
    setLocalConfig((prev) => ({
      ...prev,
      globalFrameFinish: finishId,
    }));
  };

  const handleSelectTint = (tintId: WindowGlassTintId) => {
    setLocalConfig((prev) => ({
      ...prev,
      globalGlassTint: tintId,
    }));
  };

  const handleToggleCurtains = (enabled: boolean) => {
    setLocalConfig((prev) => ({
      ...prev,
      hasCurtains: enabled,
    }));
  };

  const handleApply = () => {
    onChangeConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_WINDOW_CONFIG);
  };

  const roomScopes: { id: "global" | RoomName; label: string }[] = [
    { id: "global", label: "🏠 Whole House (Global)" },
    { id: "hall", label: "🛋️ Living Hall" },
    { id: "bedroom", label: "🛏️ Bedroom" },
    { id: "kitchen", label: "🍳 Kitchen" },
    { id: "dining", label: "🍽️ Dining" },
    { id: "pooja", label: "🪔 Pooja Mandir" },
    { id: "bathroom", label: "🚿 Bathroom" },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerIcon}>🪟</span>
            <div>
              <h2 className={styles.modalTitle}>Window Shapes & Fenestration Studio</h2>
              <p className={styles.modalSubtitle}>
                Customize architectural window geometries, luxury frame finishes, and glass tinting
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Scope Selector */}
          <div className={styles.scopeSection}>
            <span className={styles.sectionLabel}>🎯 Room Scope</span>
            <div className={styles.scopeTabs}>
              {roomScopes.map((scope) => (
                <button
                  key={scope.id}
                  className={`${styles.scopeTab} ${
                    selectedScope === scope.id ? styles.scopeTabActive : ""
                  }`}
                  onClick={() => setSelectedScope(scope.id)}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>

          {/* Window Shapes Grid */}
          <div>
            <span className={styles.sectionLabel}>
              ✨ Choose Window Shape ({selectedScope === "global" ? "All Rooms" : ROOM_LABELS[selectedScope as RoomName] || selectedScope})
            </span>
            <div className={styles.shapesGrid} style={{ marginTop: "8px" }}>
              {WINDOW_SHAPES.map((shape) => {
                const isSelected = activeShapeId === shape.id;
                return (
                  <div
                    key={shape.id}
                    className={`${styles.shapeCard} ${isSelected ? styles.shapeCardSelected : ""}`}
                    onClick={() => handleSelectShape(shape.id)}
                  >
                    <div className={styles.shapeTopRow}>
                      <span className={styles.shapeIcon}>{shape.icon}</span>
                      <span className={styles.shapeTag}>{shape.tag}</span>
                    </div>
                    <div className={styles.shapeName}>{shape.name}</div>
                    <div className={styles.shapeDesc}>{shape.description}</div>
                    <div className={styles.shapeMeta}>
                      <span>📐 {shape.aspectRatio}</span>
                      <span>Best for {shape.recommendedFor.split(",")[0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options Row: Frame Finish & Glass Tint */}
          <div className={styles.optionsRow}>
            {/* Frame Finishes */}
            <div className={styles.optionSection}>
              <span className={styles.sectionLabel}>🎨 Frame Profile & Material</span>
              <div className={styles.swatchesGrid}>
                {WINDOW_FRAME_FINISHES.map((finish) => {
                  const isSelected = localConfig.globalFrameFinish === finish.id;
                  return (
                    <div
                      key={finish.id}
                      className={`${styles.swatchCard} ${
                        isSelected ? styles.swatchCardSelected : ""
                      }`}
                      onClick={() => handleSelectFrame(finish.id)}
                    >
                      <div
                        className={styles.colorPill}
                        style={{ background: finish.swatch }}
                      />
                      <span className={styles.swatchLabel}>{finish.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Glass Glazing Tints */}
            <div className={styles.optionSection}>
              <span className={styles.sectionLabel}>💎 Glass Glazing & Tint</span>
              <div className={styles.swatchesGrid}>
                {WINDOW_GLASS_TINTS.map((tint) => {
                  const isSelected = localConfig.globalGlassTint === tint.id;
                  return (
                    <div
                      key={tint.id}
                      className={`${styles.swatchCard} ${
                        isSelected ? styles.swatchCardSelected : ""
                      }`}
                      onClick={() => handleSelectTint(tint.id)}
                    >
                      <div
                        className={styles.colorPill}
                        style={{ background: tint.swatch }}
                      />
                      <span className={styles.swatchLabel}>{tint.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hardware & Curtains Options */}
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={localConfig.hasCurtains}
                onChange={(e) => handleToggleCurtains(e.target.checked)}
              />
              <span>Include Luxury Brass Rods & Velvet Drapery Curtains</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.resetBtn} onClick={handleReset}>
            ↩️ Reset to Defaults
          </button>
          <button className={styles.applyBtn} onClick={handleApply}>
            ✓ Apply Window Shapes
          </button>
        </div>
      </div>
    </div>
  );
}
