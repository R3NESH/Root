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
  onAddWindow?: (roomIndex: number, edge: "N" | "S" | "E" | "W") => void;
}

export default function WindowShapeModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  rooms = [],
  selectedWindowId = null,
  onAddWindow,
}: WindowShapeModalProps) {
  const [selectedScope, setSelectedScope] = useState<"global" | RoomName | "individual">("global");
  const [activeWindowId, setActiveWindowId] = useState<string | null>(selectedWindowId);
  const [localConfig, setLocalConfig] = useState<WindowConfig>(config);

  const [addRoomIdx, setAddRoomIdx] = useState<number>(0);
  const [addEdge, setAddEdge] = useState<"N" | "S" | "E" | "W">("N");

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

  const activeWidthFt =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.widthFt ?? 4.0
      : localConfig.globalWidthFt ?? 4.0;

  const activeHeightFt =
    selectedScope === "individual" && currentWinProps
      ? currentWinProps.heightFt ?? 4.0
      : localConfig.globalHeightFt ?? 4.0;

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

  const handleChangeWidth = (delta: number) => {
    const nextW = Math.max(2.0, Math.min(10.0, +(activeWidthFt + delta).toFixed(1)));
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            widthFt: nextW,
          },
        },
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        globalWidthFt: nextW,
      }));
    }
  };

  const handleChangeHeight = (delta: number) => {
    const nextH = Math.max(1.5, Math.min(7.0, +(activeHeightFt + delta).toFixed(1)));
    if (selectedScope === "individual" && targetWindowId) {
      setLocalConfig((prev) => ({
        ...prev,
        individualOverrides: {
          ...(prev.individualOverrides || {}),
          [targetWindowId]: {
            ...(prev.individualOverrides?.[targetWindowId] || {}),
            heightFt: nextH,
          },
        },
      }));
    } else {
      setLocalConfig((prev) => ({
        ...prev,
        globalHeightFt: nextH,
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

  const handleInstallWindow = () => {
    if (onAddWindow) {
      onAddWindow(addRoomIdx, addEdge);
      const newWinId = `win_${addRoomIdx}_${addEdge}`;
      setActiveWindowId(newWinId);
      setSelectedScope("individual");
    }
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
                Install new windows, customize window sizes (width/height), shapes, luxury frames, and glazing
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

          {/* Quick Install Window Bar */}
          {onAddWindow && rooms.length > 0 && (
            <div className={styles.scopeSection}>
              <span className={styles.sectionLabel}>➕ Install New Window on Any Room Wall</span>
              <div className={styles.addWindowBar}>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Select Room:</span>
                <select
                  className={styles.modalSelect}
                  value={addRoomIdx}
                  onChange={(e) => setAddRoomIdx(Number(e.target.value))}
                >
                  {rooms.map((room, rIdx) => (
                    <option key={rIdx} value={rIdx}>
                      {ROOM_LABELS[room.name as RoomName] || room.name} (Room #{rIdx + 1})
                    </option>
                  ))}
                </select>

                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Wall Edge:</span>
                <select
                  className={styles.modalSelect}
                  value={addEdge}
                  onChange={(e) => setAddEdge(e.target.value as "N" | "S" | "E" | "W")}
                >
                  <option value="N">North (Top Wall)</option>
                  <option value="S">South (Bottom Wall)</option>
                  <option value="E">East (Right Wall)</option>
                  <option value="W">West (Left Wall)</option>
                </select>

                <button className={styles.installWinBtn} onClick={handleInstallWindow}>
                  ➕ Install Window
                </button>
              </div>
            </div>
          )}

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
                        <span>
                          {shapeDef?.icon} {shapeDef?.name} ({(winP.widthFt ?? 4.0).toFixed(1)}' × {(winP.heightFt ?? 4.0).toFixed(1)}')
                        </span>
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

          {/* Window Dimensions (Width & Height) */}
          <div>
            <span className={styles.sectionLabel}>📐 Window Dimensions (Size)</span>
            <div className={styles.dimensionsRow} style={{ marginTop: "8px" }}>
              <div className={styles.dimensionControl}>
                <span className={styles.dimLabel}>Window Width (Opening Span)</span>
                <div className={styles.dimSteppers}>
                  <button className={styles.dimBtn} onClick={() => handleChangeWidth(-0.5)}>
                    -
                  </button>
                  <span className={styles.dimValue}>{activeWidthFt.toFixed(1)} ft</span>
                  <button className={styles.dimBtn} onClick={() => handleChangeWidth(+0.5)}>
                    +
                  </button>
                </div>
              </div>

              <div className={styles.dimensionControl}>
                <span className={styles.dimLabel}>Window Height (Vertical Frame)</span>
                <div className={styles.dimSteppers}>
                  <button className={styles.dimBtn} onClick={() => handleChangeHeight(-0.5)}>
                    -
                  </button>
                  <span className={styles.dimValue}>{activeHeightFt.toFixed(1)} ft</span>
                  <button className={styles.dimBtn} onClick={() => handleChangeHeight(+0.5)}>
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Crop Size Presets */}
            <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>
                ✂️ Quick Crop:
              </span>
              {[
                { label: "2.5ft (Slender)", w: 2.5, h: 4.0 },
                { label: "3.5ft (Standard)", w: 3.5, h: 4.0 },
                { label: "4.5ft (Wide)", w: 4.5, h: 4.5 },
                { label: "5.5ft (Grand)", w: 5.5, h: 5.0 },
                { label: "6.5ft (Panoramic)", w: 6.5, h: 5.0 },
                { label: "8.0ft (Wall-Fit)", w: 8.0, h: 5.5 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  style={{
                    background: activeWidthFt === preset.w && activeHeightFt === preset.h ? "#0284c7" : "rgba(15, 23, 42, 0.6)",
                    color: "#ffffff",
                    border: activeWidthFt === preset.w && activeHeightFt === preset.h ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => {
                    if (selectedScope === "individual" && targetWindowId) {
                      setLocalConfig((prev) => ({
                        ...prev,
                        individualOverrides: {
                          ...(prev.individualOverrides || {}),
                          [targetWindowId]: {
                            ...(prev.individualOverrides?.[targetWindowId] || {}),
                            widthFt: preset.w,
                            heightFt: preset.h,
                          },
                        },
                      }));
                    } else {
                      setLocalConfig((prev) => ({
                        ...prev,
                        globalWidthFt: preset.w,
                        globalHeightFt: preset.h,
                      }));
                    }
                  }}
                >
                  ✂️ {preset.label}
                </button>
              ))}
            </div>
          </div>

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
