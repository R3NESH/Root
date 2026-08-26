"use client";

import React, { useState, useMemo } from "react";
import {
  WindowConfig,
  WindowShapeId,
  WindowFrameFinishId,
  WindowGlassTintId,
  WINDOW_SHAPES,
  WINDOW_FRAME_FINISHES,
  WINDOW_GLASS_TINTS,
  DEFAULT_WINDOW_CONFIG,
  getIndividualWindowProps,
} from "@/lib/windowCatalog";
import { RoomName, ROOM_LABELS } from "@/lib/rooms";
import { SolvedRoom, RoomOpening } from "@/lib/solve";
import styles from "./WindowShapeModal.module.css";

interface DiscoveredWindowItem {
  id: string;
  roomIndex: number;
  roomName: RoomName;
  edge: "N" | "S" | "E" | "W";
  label: string;
}

interface WindowShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WindowConfig;
  onChangeConfig: (newConfig: WindowConfig) => void;
  rooms?: SolvedRoom[];
  selectedWindowId?: string | null;
}

export default function WindowShapeModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  rooms = [],
  selectedWindowId = null,
}: WindowShapeModalProps) {
  const [selectedScope, setSelectedScope] = useState<"global" | RoomName | "individual">("global");
  const [activeWindowId, setActiveWindowId] = useState<string | null>(selectedWindowId);
  const [localConfig, setLocalConfig] = useState<WindowConfig>(config);

  // Discover all architectural windows from room openings
  const discoveredWindows: DiscoveredWindowItem[] = useMemo(() => {
    const list: DiscoveredWindowItem[] = [];
    rooms.forEach((room: SolvedRoom, rIdx: number) => {
      (room.openings || []).forEach((op: RoomOpening) => {
        if (op.kind === "window") {
          const id = `win_${rIdx}_${op.edge}`;
          const roomLabel = ROOM_LABELS[room.name as RoomName] || room.name;
          list.push({
            id,
            roomIndex: rIdx,
            roomName: room.name as RoomName,
            edge: op.edge,
            label: `${roomLabel} (${op.edge} Wall) Window`,
          });
        }
      });
    });
    return list;
  }, [rooms]);

  if (!isOpen) return null;

  const currentActiveWindow = discoveredWindows.find((w) => w.id === activeWindowId) || discoveredWindows[0];
  const targetWindowId = selectedScope === "individual" && currentActiveWindow ? currentActiveWindow.id : null;
  const currentWinProps = targetWindowId
    ? getIndividualWindowProps(targetWindowId, currentActiveWindow.roomName, localConfig)
    : null;

  const activeShapeId: WindowShapeId =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.shape
      : selectedScope === "global" || selectedScope === "individual"
      ? localConfig.globalShape
      : localConfig.roomWindowShapes[selectedScope as RoomName] || localConfig.globalShape;

  const activeFrameFinishId =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.frameFinish
      : localConfig.globalFrameFinish;

  const activeGlassTintId =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.glassTint
      : localConfig.globalGlassTint;

  const activeHasCurtains =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.hasCurtains
      : localConfig.hasCurtains;

  const handleSelectShape = (shapeId: WindowShapeId) => {
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            shape: shapeId,
          },
        },
      }));
    } else if (selectedScope === "global") {
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
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            frameFinish: finishId,
          },
        },
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        globalFrameFinish: finishId,
      }));
    }
  };

  const handleSelectTint = (tintId: WindowGlassTintId) => {
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            glassTint: tintId,
          },
        },
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        globalGlassTint: tintId,
      }));
    }
  };

  const handleToggleCurtains = (enabled: boolean) => {
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            hasCurtains: enabled,
          },
        },
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        hasCurtains: enabled,
      }));
    }
  };

  const handleResetIndividualWindow = (winId: string) => {
    setLocalConfig((prev) => {
      const nextOverrides = { ...(prev.individualOverrides || {}) };
      delete nextOverrides[winId];
      return {
        ...prev,
        individualOverrides: nextOverrides,
        deletedWindowIds: (prev.deletedWindowIds || []).filter((id) => id !== winId),
      };
    });
  };

  const handleToggleDeleteWindow = (winId: string) => {
    setLocalConfig((prev) => {
      const isDeleted = prev.deletedWindowIds?.includes(winId);
      return {
        ...prev,
        deletedWindowIds: isDeleted
          ? (prev.deletedWindowIds || []).filter((id) => id !== winId)
          : [...(prev.deletedWindowIds || []), winId],
      };
    });
  };

  const handleApply = () => {
    onChangeConfig(localConfig);
    onClose();
  };

  const handleResetAll = () => {
    setLocalConfig(DEFAULT_WINDOW_CONFIG);
  };

  const roomScopes: { id: "global" | RoomName | "individual"; label: string }[] = [
    { id: "global", label: "🏠 Whole House" },
    { id: "individual", label: `🎯 Individual Windows (${discoveredWindows.length})` },
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
              <h2 className={styles.modalTitle}>Architectural Window & Fenestration Studio</h2>
              <p className={styles.modalSubtitle}>
                Customize individual windows, room-level profiles, luxury frame finishes, and glass glazing
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
            <span className={styles.sectionLabel}>🎯 Customization Scope</span>
            <div className={styles.scopeTabs}>
              {roomScopes.map((scope) => (
                <button
                  key={scope.id}
                  className={`${styles.scopeTab} ${
                    selectedScope === scope.id ? styles.scopeTabActive : ""
                  }`}
                  onClick={() => {
                    setSelectedScope(scope.id);
                    if (scope.id === "individual" && !activeWindowId && discoveredWindows.length > 0) {
                      setActiveWindowId(discoveredWindows[0].id);
                    }
                  }}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Windows Picker (When in Individual Scope) */}
          {selectedScope === "individual" && (
            <div className={styles.scopeSection}>
              <span className={styles.sectionLabel}>🔍 Select Window to Customize</span>
              <div className={styles.individualWindowsGrid}>
                {discoveredWindows.map((win) => {
                  const isSelected = (activeWindowId || discoveredWindows[0]?.id) === win.id;
                  const winP = getIndividualWindowProps(win.id, win.roomName, localConfig);
                  const shapeDef = WINDOW_SHAPES.find((s) => s.id === winP.shape);
                  const hasCustomOverride = Boolean(localConfig.individualOverrides?.[win.id]);

                  return (
                    <div
                      key={win.id}
                      className={`${styles.windowCard} ${isSelected ? styles.windowCardSelected : ""}`}
                      onClick={() => setActiveWindowId(win.id)}
                    >
                      <div className={styles.windowCardName}>{win.label}</div>
                      <div className={styles.windowCardDetails}>
                        <span>{shapeDef?.icon} {shapeDef?.name}</span>
                        {winP.isDeleted ? (
                          <span className={styles.windowDeletedTag}>Removed</span>
                        ) : hasCustomOverride ? (
                          <span className={styles.windowCustomTag}>Custom</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentActiveWindow && (
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    className={styles.resetBtn}
                    onClick={() => handleResetIndividualWindow(currentActiveWindow.id)}
                    title="Reset this window back to room default"
                  >
                    ↩️ Reset this Window to Default
                  </button>
                  <button
                    className={styles.resetBtn}
                    style={{
                      borderColor: currentWinProps?.isDeleted ? "#38bdf8" : "rgba(239, 68, 68, 0.4)",
                      color: currentWinProps?.isDeleted ? "#38bdf8" : "#ef4444",
                    }}
                    onClick={() => handleToggleDeleteWindow(currentActiveWindow.id)}
                  >
                    {currentWinProps?.isDeleted ? "➕ Restore Window" : "🗑️ Remove Window"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Window Shapes Grid */}
          <div>
            <span className={styles.sectionLabel}>
              ✨ Choose Window Shape (
              {selectedScope === "individual" && currentActiveWindow
                ? currentActiveWindow.label
                : selectedScope === "global"
                ? "All Rooms"
                : ROOM_LABELS[selectedScope as RoomName] || selectedScope}
              )
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
                  const isSelected = activeFrameFinishId === finish.id;
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
                  const isSelected = activeGlassTintId === tint.id;
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
                checked={activeHasCurtains}
                onChange={(e) => handleToggleCurtains(e.target.checked)}
              />
              <span>Include Luxury Brass Rods & Velvet Drapery Curtains</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.resetBtn} onClick={handleResetAll}>
            ↩️ Reset All to Defaults
          </button>
          <button className={styles.applyBtn} onClick={handleApply}>
            ✓ Apply Window Shapes
          </button>
        </div>
      </div>
    </div>
  );
}
