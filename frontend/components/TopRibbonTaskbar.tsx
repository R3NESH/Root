"use client";

import React, { useState } from "react";
import { FURNITURE_COLOR_SWATCHES } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { Facing, PLOT_PRESETS, PlotDims } from "@/lib/plot";
import { ROOM_COLORS, ROOM_LABELS, RoomName } from "@/lib/rooms";
import { BuildingProgram, maxCountFor, ProgramKey, PROGRAMS } from "@/lib/programs";
import { WALL_COLORS, getWallColorHexStr } from "@/lib/materialsCatalog";
import {
  MAX_BANDS,
  WALL_BAND_PRESETS,
  WallBandScheme,
  withAxis,
  withBandColor,
  withBandCount,
} from "@/lib/wallBands";
import { OFFLINE_ESTIMATE_STATUS, SolveMeta, SolvedRoom } from "@/lib/solve";
import { clampInches, feetToInches, inchesToFeet } from "@/lib/units";
import {
  WINDOW_SHAPES,
  WindowConfig,
  WindowFrameFinishId,
  WindowGlassTintId,
  WindowShapeId,
} from "@/lib/windowCatalog";
import { CadTool, CustomWallType } from "@/lib/customArchitecture";
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
  program: BuildingProgram;
  onChangeProgram: (key: ProgramKey) => void;
  /** Seats the solved seating holds. Zero for a programme that has none. */
  coverCount?: number;
  /** Paint bands on the selected wall, and the writer for them. */
  selectedWallBands?: WallBandScheme;
  onChangeSelectedWallBands?: (scheme: WallBandScheme | null) => void;
  furnished: boolean;
  onToggleFurnished: (val: boolean) => void;
  customDims?: Record<string, CustomDim>;
  onChangeCustomDims?: (next: Record<string, CustomDim>) => void;
  meta?: SolveMeta | null;
  materialConfig: HouseMaterialConfig;
  onChangeMaterialConfig: (config: HouseMaterialConfig) => void;
  windowConfig: WindowConfig;
  onChangeWindowConfig?: (config: WindowConfig) => void;
  lightsOn: boolean;
  onToggleLights: () => void;
  isUpgraded?: boolean;
  onToggleUpgrade?: () => void;
  isLayoutLocked?: boolean;
  onToggleLayoutLock?: () => void;
  onOpenWindowModal: () => void;
  onOpenModelBlueprintsModal: () => void;
  onOpenExportModal: () => void;
  onOpenRoomDimensionsModal: () => void;
  placingItemType: string | null;
  onSelectPlaceItem: (type: string | null) => void;
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
  onDeselectObject: () => void;
  onOpenGraphicsModal?: () => void;
  onStartFromScratch?: () => void;
  onResetDesign?: () => void;
  lastSavedTime?: number | null;
  activeFloor?: number;
  onChangeActiveFloor?: (floor: number) => void;
  activeCadTool?: CadTool;
  onChangeCadTool?: (tool: CadTool) => void;
  activeWallType?: CustomWallType;
  onChangeWallType?: (type: CustomWallType) => void;
  onToggleDoorsWindowsDrawer?: () => void;
  isDoorsWindowsDrawerOpen?: boolean;
  onPromptToSimulate?: (prompt: string) => void;
  isSimulatingPrompt?: boolean;
}

type RibbonTab = "architecture" | "windows" | "blueprints" | "ai_prompt";

const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: "architecture", label: "Home" },
  { id: "windows", label: "Structure" },
  { id: "blueprints", label: "Blueprints" },
  { id: "ai_prompt", label: "AI Prompt" },
];


export default function TopRibbonTaskbar({
  mode,
  onChangeMode,
  plot,
  onChangePlot,
  facing,
  onChangeFacing,
  counts,
  onChangeCounts,
  program,
  onChangeProgram,
  coverCount = 0,
  selectedWallBands,
  onChangeSelectedWallBands,
  furnished,
  onToggleFurnished,
  meta,
  materialConfig,
  onChangeMaterialConfig,
  windowConfig,
  onChangeWindowConfig,
  lightsOn,
  onToggleLights,
  isUpgraded = false,
  onToggleUpgrade,
  isLayoutLocked = false,
  onToggleLayoutLock,
  onOpenWindowModal,
  onOpenModelBlueprintsModal,
  onOpenExportModal,
  onOpenRoomDimensionsModal,
  onOpenGraphicsModal,
  placingItemType,
  onSelectPlaceItem,
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
  onDeselectObject,
  onStartFromScratch,
  onResetDesign,
  lastSavedTime,
  activeFloor = 0,
  onChangeActiveFloor,
  activeCadTool = "select",
  onChangeCadTool,
  activeWallType = "exterior",
  onChangeWallType,
  onToggleDoorsWindowsDrawer,
  isDoorsWindowsDrawerOpen = false,
  onPromptToSimulate,
  isSimulatingPrompt = false,
}: TopRibbonTaskbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState("");

  // Plot Dims Helpers
  const widthFt = Math.round(inchesToFeet(plot.widthIn));
  const depthFt = Math.round(inchesToFeet(plot.depthIn));
  const sqFt = widthFt * depthFt;

  // Name the rules the solver actually posted. A cafe zones for service flow, not Vaastu, and
  // saying otherwise is the dishonesty notes/decisions/vaastu-as-constraints.md forbids.
  const rulesLabel = meta?.rules_label ?? program.rulesLabel;
  const rulesRelaxed = meta?.rules_relaxed ?? meta?.vaastu_relaxed ?? false;

  const handleStepPlot = (dim: "widthIn" | "depthIn", deltaFt: number) => {
    const minIn = feetToInches(10);
    const maxIn = feetToInches(100);
    const next = clampInches(plot[dim] + feetToInches(deltaFt), minIn, maxIn);
    onChangePlot({ ...plot, [dim]: next });
  };

  const handleStepRoomCount = (name: RoomName, delta: number) => {
    const current = counts[name] ?? 0;
    // One shopfront, one till: the ceiling is the programme's, not a flat four.
    const next = Math.min(maxCountFor(program, name), Math.max(0, current + delta));
    if (next !== current) {
      onChangeCounts({ ...counts, [name]: next });
    }
  };

  const handleSelectQuickWindowShape = (shapeId: WindowShapeId) => {
    if (onChangeWindowConfig) {
      onChangeWindowConfig({
        ...windowConfig,
        globalShape: shapeId,
        roomWindowShapes: {},
        individualOverrides: {},
      });
    }
  };

  return (
    <header className={styles.taskbarRoot}>
      {/* 1. Application bar: identity, workspace tools, view modes */}
      <div className={styles.appBar}>
        <div className={styles.brandGroup}>
          <span className={styles.brandLogo}>📐</span>
          <span className={styles.brandTitle}>Plot to Plan</span>
          <span className={styles.brandBadge}>CAD Studio</span>
        </div>

        <div className={styles.appBarDivider} />

        <div className={styles.appBarTools}>
          <span
            className={styles.saveBadge}
            title={
              lastSavedTime
                ? `Changes saved locally at ${new Date(lastSavedTime).toLocaleTimeString()}`
                : "Auto-saves all changes in real-time to browser storage"
            }
          >
            <span className={styles.savePulseDot} />
            Auto-saved
          </span>

          {onResetDesign && (
            <button
              className={styles.appBarBtn}
              onClick={onResetDesign}
              title="Wipe current layout & reset to clean default"
            >
              🗑️ Reset
            </button>
          )}

          <span className={styles.appBarSep} />

          {onOpenGraphicsModal && (
            <button
              className={styles.appBarBtn}
              onClick={onOpenGraphicsModal}
              title="Graphics & Performance Control (Press 'G')"
            >
              🎮 Graphics
            </button>
          )}

          {onToggleUpgrade && (
            <button
              className={isUpgraded ? styles.appBarBtnActive : styles.appBarBtn}
              onClick={onToggleUpgrade}
              title="Toggle Photorealistic Studio Upgrade (Press 'U')"
            >
              ✨ Upgrade{isUpgraded ? " On" : ""}
            </button>
          )}

          <button
            className={lightsOn ? styles.appBarBtnActive : styles.appBarBtn}
            onClick={onToggleLights}
            title={lightsOn ? "Switch to night lighting" : "Switch to day lighting"}
          >
            {lightsOn ? "☀️ Day" : "🌙 Night"}
          </button>

          {mode === "orbit" && onToggleLayoutLock && (
            <button
              className={isLayoutLocked ? styles.appBarBtnActive : styles.appBarBtn}
              onClick={onToggleLayoutLock}
              title={
                isLayoutLocked
                  ? "3D View is Locked (Click to unlock room & dimension editing)"
                  : "Click to Lock 3D Orbit (prevents accidental room movements)"
              }
            >
              {isLayoutLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          )}
        </div>

        {/* Viewport mode switcher */}
        <div className={styles.modeSwitch}>
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
            title="First-Person Walkthrough (5'5&quot; Eye Level)"
          >
            🚶 Walk Inside
          </button>
          <button
            className={`${styles.modeTab} ${mode === "blueprint" ? styles.modeTabActive : ""}`}
            onClick={() => onChangeMode("blueprint")}
            title="2D CAD Architectural Blueprint"
          >
            📐 2D Blueprint
          </button>
        </div>
      </div>

      {/* 2. Ribbon tab strip */}
      <div className={styles.tabStrip}>
        <nav className={styles.tabList}>
          {RIBBON_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                setIsRibbonCollapsed(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          className={styles.collapseBtn}
          onClick={() => setIsRibbonCollapsed((prev) => !prev)}
          title={isRibbonCollapsed ? "Expand ribbon" : "Collapse ribbon"}
        >
          {isRibbonCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* 2. Ribbon Shelf: Contextual Tool Deck */}
      {!isRibbonCollapsed && (
        <div className={styles.ribbonShelf}>
          {/* TAB 1: HOME - PLOT, PROGRAM & DRAFTING */}
          {activeTab === "architecture" && (
            <div className={styles.tabContentRow}>
              {/* Group 0: Building Programme */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.programGroup}>
                    {PROGRAMS.map((p) => (
                      <button
                        key={p.key}
                        className={`${styles.programBtn} ${program.key === p.key ? styles.programBtnActive : ""}`}
                        onClick={() => onChangeProgram(p.key)}
                        title={p.blurb}
                      >
                        <span className={styles.programIcon}>{p.icon}</span>
                        <span className={styles.programLabel}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.groupLabel}>Building Type</div>
              </div>

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

              {/* Group 2: Road Facing */}
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

              {/* Group 3: Storey / Floor Level */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.floorButtonGroup}>
                    {[
                      { floor: 0, label: "Ground Floor", short: "G 🏡" },
                      { floor: 1, label: "1st Floor", short: "1F 🏢" },
                      { floor: 2, label: "2nd Floor", short: "2F 🏙️" },
                      { floor: 3, label: "Terrace Roof", short: "Roof ☀️" },
                    ].map((fl) => (
                      <button
                        key={fl.floor}
                        className={`${styles.floorBtn} ${activeFloor === fl.floor ? styles.floorBtnActive : ""}`}
                        onClick={() => onChangeActiveFloor?.(fl.floor)}
                        title={`Switch view & active drafting floor to ${fl.label}`}
                      >
                        {fl.short}
                      </button>
                    ))}
                  </div>
                  <div className={styles.facingInfoBadge}>
                    {activeFloor === 0
                      ? "Ground Floor (0 ft)"
                      : activeFloor === 1
                      ? "1st Floor (+10 ft)"
                      : activeFloor === 2
                      ? "2nd Floor (+20 ft)"
                      : "Terrace (+30 ft)"}
                  </div>
                </div>
                <div className={styles.groupLabel}>Floor Level</div>
              </div>

              {/* Group 4: Room Program */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.roomProgramGrid}>
                    {program.spaces.map((name) => {
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
                <div className={styles.groupLabel}>
                  {program.key === "cafe" ? "Space Program" : "Room Program"}
                </div>
              </div>

              {/* Group 5: Interiors & Sizing */}
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
                    📐 Custom Sizes...
                  </button>
                </div>
                <div className={styles.groupLabel}>Interiors &amp; Sizing</div>
              </div>

              {/* Group 6: CAD Freehand Tools */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.cadDraftingGroup}>
                    <button
                      className={`${styles.cadToolBtn} ${activeCadTool === "draw_wall" && activeWallType !== "curved" ? styles.cadToolBtnActive : ""}`}
                      onClick={() => {
                        onChangeMode("blueprint");
                        onChangeWallType?.("exterior");
                        onChangeCadTool?.(activeCadTool === "draw_wall" && activeWallType !== "curved" ? "select" : "draw_wall");
                      }}
                      title="Draw straight load-bearing or partition walls point-to-point"
                    >
                      ✏️ Wall
                    </button>
                    <button
                      className={`${styles.cadToolBtn} ${activeCadTool === "draw_wall" && activeWallType === "curved" ? styles.cadToolBtnActive : ""}`}
                      onClick={() => {
                        onChangeMode("blueprint");
                        onChangeWallType?.("curved");
                        onChangeCadTool?.(activeCadTool === "draw_wall" && activeWallType === "curved" ? "select" : "draw_wall");
                      }}
                      title="Draw curved architectural arc walls"
                    >
                      💫 Curved Wall
                    </button>
                    <button
                      className={`${styles.cadToolBtn} ${activeCadTool === "place_door" ? styles.cadToolBtnActive : ""}`}
                      onClick={() => {
                        onChangeMode("blueprint");
                        onChangeCadTool?.(activeCadTool === "place_door" ? "select" : "place_door");
                      }}
                      title="Place doors with swing arcs onto any wall"
                    >
                      🚪 Door
                    </button>
                    <button
                      className={`${styles.cadToolBtn} ${activeCadTool === "place_window" ? styles.cadToolBtnActive : ""}`}
                      onClick={() => {
                        onChangeMode("blueprint");
                        onChangeCadTool?.(activeCadTool === "place_window" ? "select" : "place_window");
                      }}
                      title="Place windows onto any wall"
                    >
                      🪟 Window
                    </button>
                    <button
                      className={`${styles.cadToolBtn} ${activeCadTool === "tag_room" ? styles.cadToolBtnActive : ""}`}
                      onClick={() => {
                        onChangeMode("blueprint");
                        onChangeCadTool?.(activeCadTool === "tag_room" ? "select" : "tag_room");
                      }}
                      title="Tag and label room zones with sq ft"
                    >
                      🏷️ Tag
                    </button>
                    <button
                      className={`${styles.cadToolBtn} ${isDoorsWindowsDrawerOpen ? styles.cadToolBtnActive : ""}`}
                      onClick={() => onToggleDoorsWindowsDrawer?.()}
                      title="Open Doors & Windows Catalog Shelf (Drag & Drop onto any wall)"
                    >
                      🚪 Openings Catalog
                    </button>
                    {onStartFromScratch && (
                      <button
                        className={styles.scratchBtn}
                        onClick={onStartFromScratch}
                        title="Clear automated rooms and start with a 100% clean plot to draft your custom house"
                      >
                        🏗️ Scratch
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.groupLabel}>CAD Drafting</div>
              </div>

              {/* Group 7: Render Fidelity */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.stackedGroup}>
                    <button
                      className={`${styles.actionPillBtn} ${
                        materialConfig.graphicsFidelityTier === "ultra_extreme" ? styles.actionPillActive : ""
                      }`}
                      onClick={() =>
                        onChangeMaterialConfig({
                          ...materialConfig,
                          graphicsFidelityTier:
                            materialConfig.graphicsFidelityTier === "ultra_extreme" ? "high" : "ultra_extreme",
                          textureResolution: 4096,
                          anisotropicFiltering: 16,
                          textureSmoothness: 0.9,
                          floorGlossLevel: 0.95,
                          wallSmoothness: 0.9,
                        })
                      }
                      title="Toggle 4K Ultra Textures & 16x Anisotropic Filtering"
                    >
                      💎 {materialConfig.graphicsFidelityTier === "ultra_extreme" ? "4K Ultra On" : "4K Ultra Mode"}
                    </button>
                    <div className={styles.facingInfoBadge}>
                      Smooth {Math.round((materialConfig.textureSmoothness ?? 0.88) * 100)}% · Gloss{" "}
                      {Math.round((materialConfig.floorGlossLevel ?? 0.92) * 100)}%
                    </div>
                  </div>
                </div>
                <div className={styles.groupLabel}>Render Fidelity</div>
              </div>

              {/* Group 8: Architectural Specs */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.solverBadge}>
                    {meta?.status === OFFLINE_ESTIMATE_STATUS ? (
                      <span
                        className={styles.solverStatusWarn}
                        title={`The solver is unreachable, so these spaces are a rough grid. No ${rulesLabel} rule was checked and no doors were derived. Start the backend to get a real plan.`}
                      >
                        ⚠ Offline estimate — {rulesLabel} not checked
                      </span>
                    ) : rulesRelaxed ? (
                      <span
                        className={styles.solverStatusWarn}
                        title={`This programme would not fit with the ${rulesLabel} rules applied, so the solver dropped them to return a layout at all. Remove a space or enlarge the plot to get a compliant plan.`}
                      >
                        ⚠ {rulesLabel} relaxed to fit
                      </span>
                    ) : (
                      <span className={styles.solverStatusText}>
                        ✨ {meta?.status ?? `${rulesLabel} Solved`}
                      </span>
                    )}
                    <span className={styles.solverSubText}>
                      {widthFt}&apos; × {depthFt}&apos; ({sqFt.toLocaleString()} sq ft)
                      {coverCount > 0 && ` · ${coverCount} covers`}
                    </span>
                  </div>
                </div>
                <div className={styles.groupLabel}>Specs</div>
              </div>
            </div>
          )}

          {/* TAB 2: STRUCTURE - WALLS, DOORS & WINDOWS */}
          {activeTab === "windows" && (
            <div className={styles.tabContentRow}>
              {/* Add Custom Partition Walls */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_partition_full" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_partition_full" ? null : "wall_partition_full")}
                      title="Place a 9ft Full-Height Interior Partition Wall (8ft × 9ft)"
                    >
                      <span className={styles.windowShapeIcon}>🧱</span>
                      <span className={styles.windowShapeName}>+ 9ft Wall</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_partition_short" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_partition_short" ? null : "wall_partition_short")}
                      title="Place a 4ft Half-Height Pony Divider Wall (6ft × 4ft)"
                    >
                      <span className={styles.windowShapeIcon}>🧱</span>
                      <span className={styles.windowShapeName}>+ 4ft Divider</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_partition_slat" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_partition_slat" ? null : "wall_partition_slat")}
                      title="Place an Acoustic Slatted Wood Screen Partition"
                    >
                      <span className={styles.windowShapeIcon}>🪵</span>
                      <span className={styles.windowShapeName}>+ Slat Screen</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_glass_partition" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_glass_partition" ? null : "wall_glass_partition")}
                      title="Place a Modern Industrial Glass Partition with Black Grid"
                    >
                      <span className={styles.windowShapeIcon}>🪟</span>
                      <span className={styles.windowShapeName}>+ Glass Wall</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_archway_divider" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_archway_divider" ? null : "wall_archway_divider")}
                      title="Place a Grand Neoclassical Arched Opening Wall Divider"
                    >
                      <span className={styles.windowShapeIcon}>🏛️</span>
                      <span className={styles.windowShapeName}>+ Arched Wall</span>
                    </button>
                  </div>
                </div>
                <div className={styles.groupLabel}>Partition Walls</div>
              </div>

              {/* Group: Curved Walls & Surfaces */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_curved_partition" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_curved_partition" ? null : "wall_curved_partition")}
                      title="Place a 9ft Smooth Curved Architectural Feature Wall"
                    >
                      <span className={styles.windowShapeIcon}>💫</span>
                      <span className={styles.windowShapeName}>+ Curved Wall</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_curved_glass" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_curved_glass" ? null : "wall_curved_glass")}
                      title="Place a Curved Panoramic Glass Partition Wall"
                    >
                      <span className={styles.windowShapeIcon}>🪟</span>
                      <span className={styles.windowShapeName}>+ Curved Glass</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "wall_curved_slat" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "wall_curved_slat" ? null : "wall_curved_slat")}
                      title="Place a Curved Parametric Fluted Wood Slat Wall"
                    >
                      <span className={styles.windowShapeIcon}>🪵</span>
                      <span className={styles.windowShapeName}>+ Curved Slat</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "door_roman_arch" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "door_roman_arch" ? null : "door_roman_arch")}
                      title="Place a Grand Roman Arched Door with Arched Transom"
                    >
                      <span className={styles.windowShapeIcon}>🚪</span>
                      <span className={styles.windowShapeName}>+ Arched Door</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "door_revolving_curved" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "door_revolving_curved" ? null : "door_revolving_curved")}
                      title="Place a Luxury Curved Glass Revolving Door"
                    >
                      <span className={styles.windowShapeIcon}>🎠</span>
                      <span className={styles.windowShapeName}>+ Revolving Door</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${placingItemType === "window_curved_bow" ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onSelectPlaceItem(placingItemType === "window_curved_bow" ? null : "window_curved_bow")}
                      title="Place a Panoramic Curved Bow Window"
                    >
                      <span className={styles.windowShapeIcon}>🪟</span>
                      <span className={styles.windowShapeName}>+ Bow Window</span>
                    </button>
                  </div>
                </div>
                <div className={styles.groupLabel}>Curved Walls &amp; Doors</div>
              </div>

              {/* Window Shapes */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    {WINDOW_SHAPES.map((shape) => {
                      const isSelected = windowConfig.globalShape === shape.id;
                      return (
                        <button
                          key={shape.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({
                                type: "window_style",
                                shapeId: shape.id,
                                name: shape.name,
                                icon: shape.icon,
                              })
                            );
                            e.dataTransfer.setData("text/plain", shape.id);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          className={`${styles.windowShapeBtn} ${isSelected ? styles.windowShapeBtnActive : ""}`}
                          onClick={() => handleSelectQuickWindowShape(shape.id)}
                          title={`Drag & drop onto any 3D/2D window or wall: ${shape.description}`}
                        >
                          <span className={styles.windowShapeIcon}>{shape.icon}</span>
                          <span className={styles.windowShapeName}>{shape.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.groupLabel}>Window Styles</div>
              </div>

              {/* Wall & Window Crop Options */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.presetsGrid}>
                    <button
                      className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 3.0 ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 3.0 })}
                      title="Crop Window Span to 3.0 ft (Slender)"
                    >
                      <span className={styles.windowShapeIcon}>✂️</span>
                      <span className={styles.windowShapeName}>3ft Win</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 4.0 ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 4.0 })}
                      title="Crop Window Span to 4.0 ft (Standard)"
                    >
                      <span className={styles.windowShapeIcon}>✂️</span>
                      <span className={styles.windowShapeName}>4ft Win</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 5.0 ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 5.0 })}
                      title="Crop Window Span to 5.0 ft (Wide)"
                    >
                      <span className={styles.windowShapeIcon}>✂️</span>
                      <span className={styles.windowShapeName}>5ft Win</span>
                    </button>
                    <button
                      className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 6.0 ? styles.windowShapeBtnActive : ""}`}
                      onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 6.0 })}
                      title="Crop Window Span to 6.0 ft (Panoramic)"
                    >
                      <span className={styles.windowShapeIcon}>✂️</span>
                      <span className={styles.windowShapeName}>6ft Win</span>
                    </button>
                  </div>
                </div>
                <div className={styles.groupLabel}>Window Spans</div>
              </div>

              {/* Wall Demolition & Open Concept */}
              <div className={styles.ribbonGroup}>
                <div className={styles.groupBody}>
                  <div className={styles.wallActionsColumn}>
                    <span className={styles.instructionHint}>
                      💡 Click any wall in 3D to Demolish, Add Windows, or Rebuild!
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
                <div className={styles.groupLabel}>Fenestration Studio</div>
              </div>
            </div>
          )}

          {/* TAB 3: BLUEPRINTS & EXPORT */}
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

          {/* TAB 4: AI PROMPT TO 3D SIMULATION */}
          {activeTab === "ai_prompt" && (
            <div className={styles.aiPromptDeck}>
              <form
                className={styles.aiPromptInputGroup}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (aiPromptInput.trim() && onPromptToSimulate) {
                    onPromptToSimulate(aiPromptInput);
                  }
                }}
              >
                <span className={styles.aiSparkleIcon}>✨</span>
                <input
                  type="text"
                  className={styles.aiPromptInput}
                  placeholder="Describe your plot & house (e.g. '30x40 North facing 2BHK with pooja room')..."
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  disabled={isSimulatingPrompt}
                />
                <button
                  type="submit"
                  className={styles.aiSimulateBtn}
                  disabled={isSimulatingPrompt || !aiPromptInput.trim()}
                >
                  {isSimulatingPrompt ? "⏳ Generating 3D..." : "🚀 Simulate 3D House"}
                </button>
              </form>

              <div className={styles.aiPillRow}>
                <span className={styles.aiPillLabel}>Quick Prompts:</span>
                {[
                  "30x40 North 2BHK Pooja",
                  "40x60 East 3BHK Luxury",
                  "20x30 South 1BHK Studio",
                  "50x80 North 4BHK Villa",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    className={styles.aiPill}
                    onClick={() => {
                      setAiPromptInput(pill);
                      if (onPromptToSimulate) onPromptToSimulate(pill);
                    }}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <div className={styles.aiFeatureBadges}>
                <div className={styles.aiBadge}>⚡ &lt;100ms CP-SAT</div>
                <div className={styles.aiBadge}>🧭 Vaastu Validated</div>
                <div className={styles.aiBadge}>🚪 100% Reachable</div>
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
                          ? "Add back solid wall partition to close this opening"
                          : "Delete this wall to merge both rooms into an open concept space"
                      }
                    >
                      {selectedObject.isWallRemoved ? "🧱 + Add / Rebuild Wall" : "🗑️ Delete Wall (Open Concept)"}
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

                  {/* Paint bands: split this wall and judge colours side by side on it. */}
                  {onChangeSelectedWallBands && (
                    <div className={styles.bandRow}>
                      <span className={styles.bandLabel}>Paint bands</span>

                      {WALL_BAND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={styles.bandPresetBtn}
                          onClick={() => onChangeSelectedWallBands(preset.scheme)}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}

                      {selectedWallBands && (
                        <>
                          <span className={styles.bandDivider} />

                          <button
                            className={styles.bandPresetBtn}
                            onClick={() =>
                              onChangeSelectedWallBands(
                                withAxis(
                                  selectedWallBands,
                                  selectedWallBands.axis === "horizontal" ? "vertical" : "horizontal"
                                )
                              )
                            }
                            title="Swap between bands stacked up the wall and bands run along it"
                          >
                            {selectedWallBands.axis === "horizontal" ? "↔ Vertical" : "↕ Horizontal"}
                          </button>

                          <div className={styles.bandCountCtrl} title="How many bands">
                            <button
                              className={styles.miniCountBtn}
                              onClick={() =>
                                onChangeSelectedWallBands(
                                  withBandCount(selectedWallBands, selectedWallBands.bands.length - 1)
                                )
                              }
                            >
                              -
                            </button>
                            <span className={styles.countNumber}>{selectedWallBands.bands.length}</span>
                            <button
                              className={styles.miniCountBtn}
                              onClick={() =>
                                onChangeSelectedWallBands(
                                  withBandCount(selectedWallBands, selectedWallBands.bands.length + 1)
                                )
                              }
                              disabled={selectedWallBands.bands.length >= MAX_BANDS}
                            >
                              +
                            </button>
                          </div>

                          {/* One picker per band, in band order. */}
                          {selectedWallBands.bands.map((band, idx) => (
                            <label
                              key={idx}
                              className={styles.bandSwatch}
                              style={{ backgroundColor: getWallColorHexStr(band.colorId) }}
                              title={`Band ${idx + 1}: click for any colour`}
                            >
                              <input
                                type="color"
                                className={styles.hiddenBandInput}
                                value={getWallColorHexStr(band.colorId)}
                                onChange={(e) =>
                                  onChangeSelectedWallBands(
                                    withBandColor(selectedWallBands, idx, e.target.value)
                                  )
                                }
                              />
                              <span className={styles.bandSwatchNum}>{idx + 1}</span>
                            </label>
                          ))}

                          <select
                            className={styles.bandColorSelect}
                            value=""
                            onChange={(e) => {
                              const [idxStr, colorId] = e.target.value.split("|");
                              if (!colorId) return;
                              onChangeSelectedWallBands(
                                withBandColor(selectedWallBands, Number(idxStr), colorId)
                              );
                            }}
                            title="Set a band to a catalogue colour"
                          >
                            <option value="">Catalogue…</option>
                            {selectedWallBands.bands.map((_, idx) => (
                              <optgroup key={idx} label={`Band ${idx + 1}`}>
                                {WALL_COLORS.map((c) => (
                                  <option key={c.id} value={`${idx}|${c.id}`}>
                                    {c.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <button
                            className={styles.bandClearBtn}
                            onClick={() => onChangeSelectedWallBands(null)}
                            title="Drop the bands and go back to the plain wall colour"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  )}
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
                      title="Delete selected window"
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
