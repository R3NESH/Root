"use client";

import React, { useState } from "react";
import {
  FURNITURE_CATALOG,
  FURNITURE_COLOR_SWATCHES,
  FurnitureCategory,
} from "@/lib/furnitureCatalog";
import {
  DESIGN_PRESETS,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
} from "@/lib/materialsCatalog";
import { Facing, PLOT_PRESETS, PlotDims } from "@/lib/plot";
import { ROOM_COLORS, ROOM_LABELS, ROOM_NAMES, RoomName } from "@/lib/rooms";
import { SolveMeta, SolvedRoom } from "@/lib/solve";
import { clampInches, feetToInches, inchesToFeet } from "@/lib/units";
import {
  WINDOW_FRAME_FINISHES,
  WINDOW_GLASS_TINTS,
  WINDOW_SHAPES,
  WindowConfig,
  WindowFrameFinishId,
  WindowGlassTintId,
  WindowShapeId,
} from "@/lib/windowCatalog";
import { CustomDim } from "./RoomCustomizer";
import styles from "./TopRibbonTaskbar.module.css";

export interface SelectedObjectItem {
  id: string;
  name: string;
  type?: string;
  isBuiltin?: boolean;
  isWindow?: boolean;
  isWall?: boolean;
  isWallRemoved?: boolean;
  windowShape?: WindowShapeId;
  windowFrameFinish?: WindowFrameFinishId;
  windowGlassTint?: WindowGlassTintId;
  windowHasCurtains?: boolean;
  windowWidthFt?: number;
  windowHeightFt?: number;
  roomIndex?: number;
  roomName?: string;
  edge?: "N" | "S" | "E" | "W";
  x?: number;
  y?: number;
  z?: number;
  rotationY?: number;
  scale?: number;
  colorHex?: number;
}

interface TopRibbonTaskbarProps {
  mode: "orbit" | "walkthrough" | "blueprint";
  onChangeMode: (mode: "orbit" | "walkthrough" | "blueprint") => void;
  plot: PlotDims;
  onChangePlot: (plot: PlotDims) => void;
  facing: Facing;
  onChangeFacing: (facing: Facing) => void;
  counts: Record<RoomName, number>;
  onChangeCounts: (counts: Record<RoomName, number>) => void;
  furnished: boolean;
  onToggleFurnished: (val: boolean) => void;
  rooms?: SolvedRoom[];
  customDims?: Record<string, CustomDim>;
  onChangeCustomDims?: (next: Record<string, CustomDim>) => void;
  meta?: SolveMeta | null;
  materialConfig: HouseMaterialConfig;
  onChangeMaterialConfig: (config: HouseMaterialConfig) => void;
  windowConfig: WindowConfig;
  onChangeWindowConfig?: (config: WindowConfig) => void;
  lightsOn: boolean;
  onToggleLights: () => void;
  isLayoutLocked?: boolean;
  onToggleLayoutLock?: () => void;
  onOpenMaterialModal: () => void;
  onOpenWindowModal: () => void;
  onOpenModelBlueprintsModal: () => void;
  onOpenExportModal: () => void;
  onOpenRoomDimensionsModal: () => void;
  placingItemType: string | null;
  placingRotationY?: number;
  onSelectPlaceItem: (type: string | null) => void;
  onRotatePlacing?: (angleDelta: number) => void;
  selectedObject: SelectedObjectItem | null;
  onOpenReplaceModal: () => void;
  onRotateSelected: (angleDelta: number) => void;
  onScaleSelected: (scaleDelta: number) => void;
  onChangeColorSelected: (colorHex: number) => void;
  onDeleteSelected: () => void;
  onChangeIndividualWindow?: (
    windowId: string,
    updates: {
      shape?: WindowShapeId;
      frameFinish?: WindowFrameFinishId;
      glassTint?: WindowGlassTintId;
      widthFt?: number;
      heightFt?: number;
      hasCurtains?: boolean;
    }
  ) => void;
  onDeleteIndividualWindow?: (windowId: string) => void;
  onToggleRemoveWall?: (roomIndex: number, edge: "N" | "S" | "E" | "W") => void;
  onAddWindowToWall?: (roomIndex: number, edge: "N" | "S" | "E" | "W") => void;
  onMoveSelected?: (dx: number, dz: number) => void;
  onClearAllFurniture: () => void;
  onDeselectObject: () => void;
  totalPlacedCount: number;
  deletedBuiltinCount: number;
  onRestoreDefaults: () => void;
}

type RibbonTab = "architecture" | "furniture" | "materials" | "windows" | "blueprints";

export default function TopRibbonTaskbar({
  mode,
  onChangeMode,
  plot,
  onChangePlot,
  facing,
  onChangeFacing,
  counts,
  onChangeCounts,
  furnished,
  onToggleFurnished,
  rooms = [],
  meta,
  materialConfig,
  onChangeMaterialConfig,
  windowConfig,
  onChangeWindowConfig,
  lightsOn,
  onToggleLights,
  isLayoutLocked = false,
  onToggleLayoutLock,
  onOpenMaterialModal,
  onOpenWindowModal,
  onOpenModelBlueprintsModal,
  onOpenExportModal,
  onOpenRoomDimensionsModal,
  placingItemType,
  placingRotationY = 0,
  onSelectPlaceItem,
  onRotatePlacing,
  selectedObject,
  onOpenReplaceModal,
  onRotateSelected,
  onScaleSelected,
  onChangeColorSelected,
  onDeleteSelected,
  onChangeIndividualWindow,
  onDeleteIndividualWindow,
  onToggleRemoveWall,
  onAddWindowToWall,
  onMoveSelected,
  onClearAllFurniture,
  onDeselectObject,
  totalPlacedCount,
  deletedBuiltinCount,
  onRestoreDefaults,
}: TopRibbonTaskbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
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

  // Plot Dims Helpers
  const widthFt = Math.round(inchesToFeet(plot.widthIn));
  const depthFt = Math.round(inchesToFeet(plot.depthIn));
  const sqFt = widthFt * depthFt;

  const handleStepPlot = (dim: "widthIn" | "depthIn", deltaFt: number) => {
    const minIn = feetToInches(10);
    const maxIn = feetToInches(100);
    const next = clampInches(plot[dim] + feetToInches(deltaFt), minIn, maxIn);
    onChangePlot({ ...plot, [dim]: next });
  };

  const handleStepRoomCount = (name: RoomName, delta: number) => {
    const current = counts[name] ?? 0;
    const next = Math.min(4, Math.max(0, current + delta));
    if (next !== current) {
      onChangeCounts({ ...counts, [name]: next });
    }
  };

  const handleSelectQuickFloor = (matId: string) => {
    onChangeMaterialConfig({
      ...materialConfig,
      globalFloor: matId,
      roomFloors: {}, // Apply whole house
    });
  };

  const handleSelectQuickWallColor = (colorId: string) => {
    onChangeMaterialConfig({
      ...materialConfig,
      globalWallColor: colorId,
      roomWallColors: {}, // Apply whole house
    });
  };

  const handleSelectQuickWindowShape = (shapeId: WindowShapeId) => {
    if (onChangeWindowConfig) {
      onChangeWindowConfig({
        ...windowConfig,
        globalShape: shapeId,
      });
    }
  };

  return (
    <header className={styles.taskbarRoot}>
      {/* 1. MS Paint / Ansys Style Window Title & Main Tab Strip */}
      <div className={styles.topMenuBar}>
        {/* Brand Logo & Title */}
        <div className={styles.brandGroup}>
          <div className={styles.brandLogo}>📐</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Plot to Plan Studio</span>
            <span className={styles.brandSub}>Architectural CAD &amp; 3D Studio</span>
          </div>
        </div>

        {/* Primary Ribbon Tabs */}
        <nav className={styles.ribbonTabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === "architecture" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab("architecture");
              setIsRibbonCollapsed(false);
            }}
          >
            🏠 Architecture &amp; Plot
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "furniture" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab("furniture");
              setIsRibbonCollapsed(false);
            }}
          >
            🛋️ Furniture Catalog
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "materials" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab("materials");
              setIsRibbonCollapsed(false);
            }}
          >
            🎨 Materials &amp; Finishes
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "windows" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab("windows");
              setIsRibbonCollapsed(false);
            }}
          >
            🪟 Windows &amp; Openings
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "blueprints" ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab("blueprints");
              setIsRibbonCollapsed(false);
            }}
          >
            📐 CAD &amp; Blueprints
          </button>
        </nav>

        {/* Right Mode Switchers & View Controls */}
        <div className={styles.rightViewControls}>
          {/* View Modes */}
          <div className={styles.modeTabsGroup}>
            <button
              className={`${styles.modeTab} ${mode === "orbit" ? styles.modeTabActive : ""}`}
              onClick={() => onChangeMode("orbit")}
              title="3D Aerial Orbit View"
            >
              🌐 3D Orbit
            </button>
            <button
              className={`${styles.modeTab} ${mode === "walkthrough" ? styles.modeTabActive : ""}`}
              onClick={() => onChangeMode("walkthrough")}
              title="First-Person Walkthrough (5'5' Eye Level)"
            >
              🚶 Walk Inside
            </button>
            <button
              className={`${styles.modeTab} ${mode === "blueprint" ? styles.modeTabActiveBlueprint : ""}`}
              onClick={() => onChangeMode("blueprint")}
              title="2D CAD Architectural Blueprint"
            >
              📐 2D Blueprint
            </button>
          </div>

          {/* Quick Tools */}
          <button
            className={styles.quickIconBtn}
            onClick={onToggleLights}
            title={lightsOn ? "Switch to Night Lighting" : "Switch to Day Lighting"}
          >
            {lightsOn ? "💡 Day" : "🌙 Night"}
          </button>

          {mode === "orbit" && onToggleLayoutLock && (
            <button
              className={isLayoutLocked ? styles.lockBtnActive : styles.lockBtn}
              onClick={onToggleLayoutLock}
              title={
                isLayoutLocked
                  ? "3D View is Locked (Click to unlock room & dimension editing)"
                  : "Click to Lock 3D Orbit (prevents accidental room movement)"
              }
            >
              {isLayoutLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          )}

          {/* Collapse Ribbon Chevron */}
          <button
            className={styles.collapseBtn}
            onClick={() => setIsRibbonCollapsed((prev) => !prev)}
            title={isRibbonCollapsed ? "Expand Ribbon Taskbar" : "Collapse Ribbon Taskbar"}
          >
            {isRibbonCollapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* 2. Ribbon Shelf: Contextual Groups (Like MS Paint / Ansys) */}
      {!isRibbonCollapsed && (
        <div className={styles.ribbonShelf}>
          {/* TAB 1: ARCHITECTURE & PLOT */}
          {activeTab === "architecture" && (
            <div className={styles.tabContentRow}>
              {/* Group 1: Plot Dimensions */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    {PLOT_PRESETS.map((p) => {
                      const isActive =
                        feetToInches(p.widthFt) === plot.widthIn &&
                        feetToInches(p.depthFt) === plot.depthIn;
                      return (
                        <button
                          key={p.label}
                          className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ""}`}
                          onClick={() =>
                            onChangePlot({
                              widthIn: feetToInches(p.widthFt),
                              depthIn: feetToInches(p.depthFt),
                            })
                          }
                        >
                          {p.label}&apos;
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.dimensionSteppersRow}>
                    <div className={styles.dimStepper}>
                      <span className={styles.dimLabel}>W</span>
                      <button className={styles.stepperBtn} onClick={() => handleStepPlot("widthIn", -1)}>
                        -
                      </button>
                      <span className={styles.dimValText}>{widthFt}&apos;</span>
                      <button className={styles.stepperBtn} onClick={() => handleStepPlot("widthIn", 1)}>
                        +
                      </button>
                    </div>
                    <div className={styles.dimStepper}>
                      <span className={styles.dimLabel}>D</span>
                      <button className={styles.stepperBtn} onClick={() => handleStepPlot("depthIn", -1)}>
                        -
                      </button>
                      <span className={styles.dimValText}>{depthFt}&apos;</span>
                      <button className={styles.stepperBtn} onClick={() => handleStepPlot("depthIn", 1)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.groupLabel}>Plot Dimensions</div>
              </div>

              {/* Group 2: Road Facing (Vastu Orientation) */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.facingButtonsRow}>
                    {(["N", "E", "S", "W"] as Facing[]).map((f) => (
                      <button
                        key={f}
                        className={`${styles.facingBtn} ${facing === f ? styles.facingBtnActive : ""}`}
                        onClick={() => onChangeFacing(f)}
                        title={`Road facing ${f}`}
                      >
                        <span className={styles.facingIcon}>
                          {f === "N" && "🧭"}
                          {f === "E" && "🌅"}
                          {f === "S" && "☀️"}
                          {f === "W" && "🌇"}
                        </span>
                        <span className={styles.facingLetter}>{f}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.facingInfoBadge}>Facing {facing}</div>
                </div>
                <div className={styles.groupLabel}>Road Facing</div>
              </div>

              {/* Group 3: Room Program */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.roomProgramGrid}>
                    {ROOM_NAMES.map((name) => {
                      const count = counts[name] ?? 0;
                      return (
                        <div key={name} className={styles.roomStepperItem}>
                          <span
                            className={styles.roomColorDot}
                            style={{
                              backgroundColor: `#${(ROOM_COLORS[name] ?? 0xe8912d).toString(16).padStart(6, "0")}`,
                            }}
                          />
                          <span className={styles.roomItemLabel}>{ROOM_LABELS[name].split(" ")[0]}</span>
                          <div className={styles.roomCountCtrl}>
                            <button
                              className={styles.miniCountBtn}
                              onClick={() => handleStepRoomCount(name, -1)}
                            >
                              -
                            </button>
                            <span className={styles.countNumber}>{count}</span>
                            <button
                              className={styles.miniCountBtn}
                              onClick={() => handleStepRoomCount(name, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.groupLabel}>Room Program</div>
              </div>

              {/* Group 4: Interiors & Custom Sizing */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <button
                    className={`${styles.actionPillBtn} ${furnished ? styles.actionPillActive : ""}`}
                    onClick={() => onToggleFurnished(!furnished)}
                    title="Auto-furnish rooms with sofas, beds, counters & fans"
                  >
                    🛋️ Auto-Furnish: <b>{furnished ? "ON" : "OFF"}</b>
                  </button>

                  <button
                    className={styles.actionPillBtn}
                    onClick={onOpenRoomDimensionsModal}
                    title="Open Fine-Grained Room Dimensions Studio"
                  >
                    📐 Custom Room Sizes...
                  </button>
                </div>
                <div className={styles.groupLabel}>Interiors &amp; Sizing</div>
              </div>

              {/* Group 5: Vastu Solver Specs */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.solverBadge}>
                    <span className={styles.solverStatusText}>
                      ✨ {meta?.status ?? "Vastu Solved"}
                    </span>
                    <span className={styles.solverSubText}>
                      {widthFt}&apos; × {depthFt}&apos; ({sqFt.toLocaleString()} sq ft)
                    </span>
                  </div>
                </div>
                <div className={styles.groupLabel}>Architectural Specs</div>
              </div>
            </div>
          )}

          {/* TAB 2: FURNITURE CATALOG */}
          {activeTab === "furniture" && (
            <div className={styles.tabContentRow}>
              {/* Category Filter */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.categoryPills}>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`${styles.catPill} ${activeCategory === cat.id ? styles.catPillActive : ""}`}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.groupLabel}>Category Filter</div>
              </div>

              {/* Scrollable Furniture Shelf */}
              <div className={styles.furnitureShelfGroup}>
                <div className={styles.furnitureScrollRow}>
                  {filteredItems.map((item) => {
                    const isPlacingThis = placingItemType === item.type;
                    return (
                      <button
                        key={item.type}
                        className={`${styles.itemCard} ${isPlacingThis ? styles.itemCardActive : ""}`}
                        onClick={() => onSelectPlaceItem(isPlacingThis ? null : item.type)}
                        title={`Click to place ${item.name} (${item.dimensions.widthFt}'×${item.dimensions.depthFt}')`}
                      >
                        <span className={styles.itemIcon}>{item.icon}</span>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemDim}>
                          {item.dimensions.widthFt}&apos;×{item.dimensions.depthFt}&apos;
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.groupLabel}>Click or Drag Item to Place onto 3D Floor</div>
              </div>

              {/* Furniture Management Actions */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  {deletedBuiltinCount > 0 && (
                    <button
                      className={styles.restoreBtn}
                      onClick={onRestoreDefaults}
                      title="Restore all default furniture deleted from rooms"
                    >
                      ↩️ Restore Defaults ({deletedBuiltinCount})
                    </button>
                  )}
                  {totalPlacedCount > 0 && (
                    <button
                      className={styles.clearBtn}
                      onClick={onClearAllFurniture}
                      title="Remove all custom placed furniture"
                    >
                      🧹 Clear All ({totalPlacedCount})
                    </button>
                  )}
                </div>
                <div className={styles.groupLabel}>Management</div>
              </div>
            </div>
          )}

          {/* TAB 3: MATERIALS & FINISHES */}
          {activeTab === "materials" && (
            <div className={styles.tabContentRow}>
              {/* Quick Flooring */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.swatchesRow}>
                    {FLOOR_MATERIALS.slice(0, 6).map((m) => {
                      const isSelected = materialConfig.globalFloor === m.id;
                      return (
                        <button
                          key={m.id}
                          className={`${styles.quickMaterialBtn} ${isSelected ? styles.quickMaterialActive : ""}`}
                          onClick={() => handleSelectQuickFloor(m.id)}
                          title={`Apply ${m.name} to Whole House`}
                        >
                          <span
                            className={styles.materialPreviewSquare}
                            style={{ backgroundColor: m.swatchColor }}
                          />
                          <span className={styles.materialShortName}>{m.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.groupLabel}>Whole House Flooring</div>
              </div>

              {/* Quick Wall Colors */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.swatchesRow}>
                    {WALL_COLORS.slice(0, 7).map((c) => {
                      const isSelected = materialConfig.globalWallColor === c.id;
                      return (
                        <button
                          key={c.id}
                          className={`${styles.quickColorBtn} ${isSelected ? styles.quickColorActive : ""}`}
                          style={{ backgroundColor: c.hex }}
                          onClick={() => handleSelectQuickWallColor(c.id)}
                          title={`Paint Whole House in ${c.name}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className={styles.groupLabel}>Whole House Wall Colors</div>
              </div>

              {/* Quick 1-Click Design Themes */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    {DESIGN_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.id}
                        className={styles.themePresetBtn}
                        onClick={() =>
                          onChangeMaterialConfig({
                            globalFloor: preset.globalFloor,
                            globalWallColor: preset.globalWallColor,
                            globalWallTexture: preset.globalWallTexture,
                            roomFloors: {},
                            roomWallColors: {},
                            roomWallTextures: {},
                          })
                        }
                        title={`Apply ${preset.name} Theme`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.groupLabel}>Design Presets</div>
              </div>

              {/* Open Full Studio */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <button
                    className={styles.bigStudioBtn}
                    onClick={onOpenMaterialModal}
                    title="Open Full Material & Texture Customizer Studio"
                  >
                    🎨 Open Materials Studio...
                  </button>
                </div>
                <div className={styles.groupLabel}>Full Studio</div>
              </div>
            </div>
          )}

          {/* TAB 4: WINDOWS & OPENINGS */}
          {activeTab === "windows" && (
            <div className={styles.tabContentRow}>
              {/* Window Shapes */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    {WINDOW_SHAPES.map((shape) => {
                      const isSelected = windowConfig.globalShape === shape.id;
                      return (
                        <button
                          key={shape.id}
                          className={`${styles.windowShapeBtn} ${isSelected ? styles.windowShapeBtnActive : ""}`}
                          onClick={() => handleSelectQuickWindowShape(shape.id)}
                          title={shape.description}
                        >
                          <span className={styles.windowShapeIcon}>{shape.icon}</span>
                          <span className={styles.windowShapeName}>{shape.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.groupLabel}>Global Window Style</div>
              </div>

              {/* Wall Demolition & Open Concept */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.wallActionsColumn}>
                    <span className={styles.instructionHint}>
                      💡 Click any wall in 3D to Demolish or Install Windows!
                    </span>
                    <button
                      className={styles.actionPillBtn}
                      onClick={onOpenWindowModal}
                      title="Open Multi-Room Window & Wall Demolition Studio"
                    >
                      🪟 Full Window &amp; Wall Studio...
                    </button>
                  </div>
                </div>
                <div className={styles.groupLabel}>Wall Demolition &amp; Windows</div>
              </div>
            </div>
          )}

          {/* TAB 5: CAD & BLUEPRINTS */}
          {activeTab === "blueprints" && (
            <div className={styles.tabContentRow}>
              {/* Architectural Model Blueprints */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <button
                    className={styles.modelBlueprintsBtn}
                    onClick={onOpenModelBlueprintsModal}
                    title="Browse 100% Vastu Architectural Model Blueprints"
                  >
                    ✨ Architectural Model Blueprints...
                  </button>
                </div>
                <div className={styles.groupLabel}>Vastu Models</div>
              </div>

              {/* 2D CAD Blueprint View */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <button
                    className={`${styles.cadViewBtn} ${mode === "blueprint" ? styles.cadViewBtnActive : ""}`}
                    onClick={() => onChangeMode("blueprint")}
                    title="Switch to 2D CAD Blueprint Plan"
                  >
                    📐 2D CAD Blueprint View
                  </button>
                </div>
                <div className={styles.groupLabel}>Blueprint Mode</div>
              </div>

              {/* Export Suite */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <button
                    className={styles.exportSuiteBtn}
                    onClick={onOpenExportModal}
                    title="Export PDF Blueprint, AutoCAD DXF, JSON Data, and High-Res PNG"
                  >
                    📥 Export Blueprint (PDF / DXF / JSON / PNG)...
                  </button>
                </div>
                <div className={styles.groupLabel}>CAD Export Suite</div>
              </div>
            </div>
          )}

          {/* 3. CONTEXTUAL SELECTION INSPECTOR DECK (Pinned on right when object/window/wall selected) */}
          {selectedObject && (
            <div className={styles.selectedInspectorDeck}>
              {/* Wall Inspector */}
              {selectedObject.isWall ? (
                <div className={styles.inspectorContent}>
                  <div className={styles.inspectorHeader}>
                    <span className={styles.inspectorTitle}>
                      🧱 {selectedObject.name || "Wall Partition"}
                    </span>
                    <button className={styles.deselectBtn} onClick={onDeselectObject} title="Deselect">
                      ✕
                    </button>
                  </div>
                  <div className={styles.inspectorActions}>
                    <button
                      className={selectedObject.isWallRemoved ? styles.rebuildWallBtn : styles.demolishWallBtn}
                      onClick={() =>
                        onToggleRemoveWall &&
                        onToggleRemoveWall(selectedObject.roomIndex ?? 0, selectedObject.edge ?? "N")
                      }
                      title={
                        selectedObject.isWallRemoved
                          ? "Rebuild solid wall partition"
                          : "Delete this wall to merge both rooms into an open concept space"
                      }
                    >
                      {selectedObject.isWallRemoved ? "🧱 Rebuild Wall" : "🗑️ Delete Wall (Open Concept)"}
                    </button>
                    {!selectedObject.isWallRemoved && (
                      <button
                        className={styles.addWinBtn}
                        onClick={() =>
                          onAddWindowToWall &&
                          onAddWindowToWall(selectedObject.roomIndex ?? 0, selectedObject.edge ?? "N")
                        }
                      >
                        ➕ Add Window
                      </button>
                    )}
                  </div>
                </div>
              ) : selectedObject.isWindow ? (
                /* Window Inspector */
                <div className={styles.inspectorContent}>
                  <div className={styles.inspectorHeader}>
                    <span className={styles.inspectorTitle}>🪟 {selectedObject.name}</span>
                    <button className={styles.deselectBtn} onClick={onDeselectObject} title="Deselect">
                      ✕
                    </button>
                  </div>

                  <div className={styles.inspectorActions}>
                    {/* Width / Height Steppers */}
                    <div className={styles.dimStepperMini}>
                      <span>W:</span>
                      <button
                        className={styles.stepperMiniBtn}
                        onClick={() =>
                          onChangeIndividualWindow &&
                          onChangeIndividualWindow(selectedObject.id, {
                            widthFt: Math.max(2, (selectedObject.windowWidthFt || 4.0) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <span className={styles.stepperMiniVal}>
                        {(selectedObject.windowWidthFt || 4.0).toFixed(1)}&apos;
                      </span>
                      <button
                        className={styles.stepperMiniBtn}
                        onClick={() =>
                          onChangeIndividualWindow &&
                          onChangeIndividualWindow(selectedObject.id, {
                            widthFt: Math.min(12, (selectedObject.windowWidthFt || 4.0) + 0.5),
                          })
                        }
                      >
                        +
                      </button>
                    </div>

                    <div className={styles.dimStepperMini}>
                      <span>H:</span>
                      <button
                        className={styles.stepperMiniBtn}
                        onClick={() =>
                          onChangeIndividualWindow &&
                          onChangeIndividualWindow(selectedObject.id, {
                            heightFt: Math.max(2, (selectedObject.windowHeightFt || 4.2) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <span className={styles.stepperMiniVal}>
                        {(selectedObject.windowHeightFt || 4.2).toFixed(1)}&apos;
                      </span>
                      <button
                        className={styles.stepperMiniBtn}
                        onClick={() =>
                          onChangeIndividualWindow &&
                          onChangeIndividualWindow(selectedObject.id, {
                            heightFt: Math.min(8, (selectedObject.windowHeightFt || 4.2) + 0.5),
                          })
                        }
                      >
                        +
                      </button>
                    </div>

                    {/* Drapes Toggle */}
                    <button
                      className={
                        selectedObject.windowHasCurtains !== false
                          ? styles.curtainBtnActive
                          : styles.curtainBtn
                      }
                      onClick={() =>
                        onChangeIndividualWindow &&
                        onChangeIndividualWindow(selectedObject.id, {
                          hasCurtains: !(selectedObject.windowHasCurtains !== false),
                        })
                      }
                    >
                      {selectedObject.windowHasCurtains !== false ? "🪟 Drapes ON" : "🪟 Drapes OFF"}
                    </button>

                    {/* Delete */}
                    <button
                      className={styles.deleteBtn}
                      onClick={() => {
                        if (onDeleteIndividualWindow) {
                          onDeleteIndividualWindow(selectedObject.id);
                        } else {
                          onDeleteSelected();
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ) : (
                /* Furniture Object Inspector */
                <div className={styles.inspectorContent}>
                  <div className={styles.inspectorHeader}>
                    <div className={styles.inspectorTitleWrapper}>
                      <span className={styles.inspectorTitle}>{selectedObject.name}</span>
                      {selectedObject.isBuiltin && (
                        <span className={styles.builtinBadge}>Default</span>
                      )}
                    </div>
                    <button className={styles.deselectBtn} onClick={onDeselectObject} title="Deselect">
                      ✕
                    </button>
                  </div>

                  <div className={styles.inspectorActions}>
                    {/* Directional Move Pad */}
                    <div className={styles.moveControlsRow} title="Nudge Position (or use Arrow Keys)">
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(-1.0, 0)}
                        title="Move West (-X)"
                      >
                        ⬅️
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(0, -1.0)}
                        title="Move North (-Z)"
                      >
                        ⬆️
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(0, 1.0)}
                        title="Move South (+Z)"
                      >
                        ⬇️
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(1.0, 0)}
                        title="Move East (+X)"
                      >
                        ➡️
                      </button>
                      {selectedObject.x !== undefined && selectedObject.z !== undefined && (
                        <span className={styles.positionBadge}>
                          {selectedObject.x.toFixed(1)}&apos;, {selectedObject.z.toFixed(1)}&apos;
                        </span>
                      )}
                    </div>

                    {/* Rotate */}
                    <button
                      className={styles.transformBtn}
                      onClick={() => onRotateSelected(Math.PI / 4)}
                      title="Rotate 45°"
                    >
                      🔄 45°
                    </button>

                    {/* Scale */}
                    {!selectedObject.isBuiltin && (
                      <>
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
                      </>
                    )}

                    {/* Color Palette */}
                    {!selectedObject.isBuiltin && (
                      <div className={styles.colorPaletteRow}>
                        {FURNITURE_COLOR_SWATCHES.map((swatch) => (
                          <button
                            key={swatch.hex}
                            className={styles.swatchBtn}
                            style={{
                              backgroundColor: swatch.bg,
                              outline:
                                selectedObject.colorHex === swatch.hex
                                  ? "2px solid #fbbf24"
                                  : "none",
                            }}
                            onClick={() => onChangeColorSelected(swatch.hex)}
                            title={`Tint: ${swatch.name}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Replace */}
                    <button
                      className={styles.replaceBtn}
                      onClick={onOpenReplaceModal}
                      title="Replace with another object"
                    >
                      🔄 Replace...
                    </button>

                    {/* Delete */}
                    <button
                      className={styles.deleteBtn}
                      onClick={onDeleteSelected}
                      title="Delete selected object"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
