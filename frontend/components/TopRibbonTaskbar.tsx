"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFitCount } from "@/lib/useFitCount";
import { FURNITURE_COLOR_SWATCHES, FURNITURE_CATALOG, FurnitureItemDef } from "@/lib/furnitureCatalog";
import { OPENINGS_CATALOG, OpeningItemDef } from "@/lib/openingsCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { ComplianceReport } from "@/lib/compliance";
import { PLAN_IMAGE_TYPES } from "@/lib/aiPlanImage";
import {
  Facing,
  MAX_DIM_IN,
  MAX_PLOT_VERTICES,
  MIN_DIM_IN,
  PLOT_PRESETS,
  PlotDims,
  PlotPoint,
  isRectangularPlot,
  maxCornerCutIn,
  outlineBoundsIn,
  plotPolygonIn,
  plotShapeProblem,
} from "@/lib/plot";
import { ROOM_COLORS, ROOM_LABELS, RoomName } from "@/lib/rooms";
import { BuildingProgram, maxCountFor, ProgramKey, PROGRAMS } from "@/lib/programs";
import { WALL_COLORS, getWallColorHexStr } from "@/lib/materialsCatalog";
import {
  GLAZING_PRESETS,
  GLAZING_STYLES,
  WallGlazing,
  withGlazingStyle,
  withGlazingTarget,
} from "@/lib/glazing";
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
  /** Drawn by the user rather than placed by the solver: no room index, no edge. */
  isCustomWall?: boolean;
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
  /** Glazing on the selected wall: glass wall, glass door, or both. */
  selectedWallGlazing?: WallGlazing;
  onChangeSelectedWallGlazing?: (glazing: WallGlazing | null) => void;
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
  placingOpeningDef?: OpeningItemDef | null;
  onSelectPlaceOpening?: (def: OpeningItemDef | null) => void;
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
  /** Abutting road width in metres, and what the bye-law makes of it — lib/compliance.ts. */
  roadWidthM?: number;
  onChangeRoadWidthM?: (next: number) => void;
  autoSetback?: boolean;
  onToggleAutoSetback?: (next: boolean) => void;
  compliance?: ComplianceReport | null;
  /** Storeys the solver packs, ground included. */
  floorsCount?: number;
  onChangeFloorsCount?: (next: number) => void;
  /** Storeys actually returned by whoever answered the solve. */
  solvedFloorCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** What the next undo or redo would take back, for the tooltip. */
  undoLabel?: string | null;
  redoLabel?: string | null;
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
  /**
   * The AI reading paths — backend/ai. These used to live in the prompt bar in app/page.tsx,
   * which is positioned at the same `top: 14px` as the CAD toolbar in Scene.tsx and sits under it
   * at a lower z-index, so none of it was ever reachable. They belong on this tab anyway.
   *
   * Each takes whatever is typed in the box above as a note that corrects the image without being
   * trusted over it.
   */
  onReadPlanPhoto?: (file: File, note: string) => void;
  onReadHousePhoto?: (file: File, note: string) => void;
  onBuildFromText?: (prompt: string) => void;
  /** What was assumed, what was generated rather than read, and what could not be built. */
  aiNotice?: string | null;
  aiError?: string | null;
  aiAssumed?: string[];
  aiUnsupported?: string[];
  isRaytracing?: boolean;
  onToggleRaytrace?: () => void;
  onOpenBOQModal?: () => void;
  onOpenScheduleModal?: () => void;
  onOpenCustomWallBlendModal?: () => void;
  /** Opens the Plot Shape studio. */
  onOpenPlotShapeModal?: () => void;
}

const WALL_ITEMS = FURNITURE_CATALOG.filter((i) => i.category === "walls");
// Straight partitions in one group, curved and arched pieces in the other, split on the type
// name because the catalog carries no shape field. The split is cosmetic: an item that lands in
// the wrong group is still reachable, which is the property the hardcoded lists never had.
const STRAIGHT_WALLS = WALL_ITEMS.filter(
  (i) => i.type.startsWith("wall_") && !i.type.includes("curved")
);
const CURVED_WALLS = WALL_ITEMS.filter((i) => !STRAIGHT_WALLS.includes(i));
const DOOR_OPENINGS = OPENINGS_CATALOG.filter((o) => o.category === "door");
const STAIR_ITEMS = FURNITURE_CATALOG.filter((i) => i.category === "stairs");

type RibbonTab = "architecture" | "site" | "draw" | "openings" | "view" | "ai_prompt";

// Width a panel takes once it is collapsed to its drop-down button. Must match
// .ribbonGroupCollapsed in the stylesheet, since the fit calculation is done in JS.
const COLLAPSED_PANEL_W = 76;

// Width the application bar keeps back for its overflow button. Must match .appBarOverflowBtn.
const OVERFLOW_BTN_W = 30;

/**
 * Application-bar glyphs. 16x16, stroked not filled, so they inherit the button's colour and
 * read at the one size the bar uses. Kept as path data rather than components because every one
 * of them is a single shape drawn the same way.
 */
const ICONS: Record<string, string[]> = {
  undo: ["M3.5 8.5h6.5a3 3 0 0 1 0 6H7", "M6.5 5.5 3.5 8.5l3 3"],
  redo: ["M12.5 8.5H6a3 3 0 0 0 0 6h3", "M9.5 5.5l3 3-3 3"],
  reset: ["M13 8a5 5 0 1 1-1.6-3.7", "M13 3v3h-3"],
  boq: ["M4 2.5h5l3 3v8H4z", "M9 2.5v3h3", "M6 9h4M6 11h4"],
  schedule: ["M2.5 3h11v10h-11z", "M2.5 6h11", "M6 6v7", "M9.5 6v7"],
  graphics: ["M2.5 11.5a5.5 5.5 0 0 1 11 0", "M8 11.5 11 7.5"],
  raytrace: ["M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4", "M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14", "M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1"],
  upgrade: ["M8 2.5 9.4 6.6 13.5 8l-4.1 1.4L8 13.5 6.6 9.4 2.5 8l4.1-1.4z"],
  day: ["M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5", "M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14", "M3.9 3.9l1.1 1.1M11 11l1.1 1.1M12.1 3.9 11 5M5 11l-1.1 1.1"],
  night: ["M12.5 9.6A5 5 0 0 1 6.4 3.5a5 5 0 1 0 6.1 6.1z"],
  locked: ["M4.5 7.5h7v6h-7z", "M6 7.5V5.5a2 2 0 0 1 4 0v2"],
  unlocked: ["M4.5 7.5h7v6h-7z", "M6 7.5V5.5a2 2 0 0 1 3.9-.6"],
};

function AppBarGlyph({ paths }: { paths: string[] }) {
  return (
    <svg className={styles.appBarIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export interface AppBarAction {
  id: string;
  label: string;
  title: string;
  icon: string[];
  /** Optional so a bar built from optional handler props needs no placeholder callbacks. */
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** A change of group number draws a divider before the item. */
  group: number;
}

/**
 * The application bar's action row.
 *
 * It used to be a flex row with `overflow-x: auto`, which meant that on a narrow window the last
 * few controls sat off the right-hand edge behind a scrollbar the 36px bar had no room to draw —
 * so they were unreachable rather than merely hidden. What does not fit now goes into an
 * overflow menu, which is where a ribbon has always put it. The width of the overflow button is
 * reserved in the fit rather than laid out, so adding it cannot push another item out and start
 * the measurement oscillating.
 */
function AppBarTools({
  actions,
  savedLabel,
}: {
  actions: AppBarAction[];
  savedLabel: string;
}) {
  const signature = actions.map((a) => `${a.id}:${a.active ? 1 : 0}:${a.disabled ? 1 : 0}`).join("|");
  const { ref, shown } = useFitCount<HTMLDivElement>(actions.length, signature, (hidden) =>
    hidden > 0 ? OVERFLOW_BTN_W : 0
  );
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hidden = actions.slice(shown);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing is hidden any more, so a menu left open would be an empty box.
  useEffect(() => {
    if (hidden.length === 0) setOpen(false);
  }, [hidden.length]);

  const classFor = (a: AppBarAction, i: number) =>
    [
      a.active ? styles.appBarBtnActive : styles.appBarBtn,
      i > 0 && actions[i - 1].group !== a.group ? styles.appBarBtnGroupStart : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className={styles.appBarTools} ref={hostRef}>
      <span className={styles.saveBadge} title={savedLabel}>
        <span className={styles.savePulseDot} />
        Auto-saved
      </span>
      <span className={styles.appBarSep} />

      <div className={styles.appBarActions} ref={ref}>
        {actions.map((a, i) => (
          <button
            key={a.id}
            className={classFor(a, i)}
            onClick={a.onClick}
            disabled={a.disabled}
            title={a.title}
            aria-hidden={i >= shown}
            tabIndex={i >= shown ? -1 : undefined}
          >
            <AppBarGlyph paths={a.icon} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {hidden.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.appBarOverflowBtn} ${open ? styles.appBarOverflowBtnOpen : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={`${hidden.length} more: ${hidden.map((a) => a.label).join(", ")}`}
          >
            &#187;
          </button>
          {open && (
            <div className={styles.appBarOverflowMenu}>
              {hidden.map((a) => (
                <button
                  key={a.id}
                  className={`${styles.appBarOverflowItem} ${
                    a.active ? styles.appBarOverflowItemActive : ""
                  }`}
                  onClick={() => {
                    a.onClick?.();
                    setOpen(false);
                  }}
                  disabled={a.disabled}
                  title={a.title}
                >
                  <AppBarGlyph paths={a.icon} />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One ribbon panel: controls on top, panel name underneath, divider to the right — the AutoCAD
 * arrangement. When the shelf runs out of room the panel shrinks to a labelled button that drops
 * its contents down on click, so a tab never scrolls sideways. `collapsed` is set by RibbonRow.
 */
function RibbonPanel({
  label,
  collapsed = false,
  children,
}: {
  label: React.ReactNode;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A panel that reopens as an expanded panel must not keep a stale flyout behind it.
  useEffect(() => {
    if (!collapsed) setOpen(false);
  }, [collapsed]);

  if (!collapsed) {
    return (
      <div className={styles.ribbonGroup}>
        <div className={styles.groupBody}>{children}</div>
        <div className={styles.groupLabel}>{label}</div>
      </div>
    );
  }

  return (
    <div className={styles.ribbonGroupCollapsed} ref={hostRef}>
      <button
        type="button"
        className={`${styles.collapsedPanelBtn} ${open ? styles.collapsedPanelBtnOpen : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={typeof label === "string" ? label : undefined}
      >
        <span className={styles.collapsedPanelLabel}>{label}</span>
        <span className={styles.collapsedPanelCaret}>&#9662;</span>
      </button>
      {open && (
        <div className={styles.panelFlyout}>
          <div className={styles.groupBody}>{children}</div>
        </div>
      )}
    </div>
  );
}

/**
 * The row of panels for one tab. Measures the panels at their natural width once, then keeps the
 * leading ones expanded and collapses the trailing ones until the row fits — AutoCAD's panel
 * priority, where the panels on the right give way first. Nothing here scrolls.
 */
function RibbonRow({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  // Which panels this row holds. Switching tab hands the same row a different set, and the
  // widths measured for the old set describe nothing about the new one.
  const signature = items
    .map((c) =>
      React.isValidElement<{ label?: React.ReactNode }>(c) && typeof c.props.label === "string"
        ? c.props.label
        : "?"
    )
    .join("|");
  const { ref: rowRef, shown } = useFitCount<HTMLDivElement>(
    items.length,
    signature,
    (hidden) => hidden * COLLAPSED_PANEL_W
  );

  return (
    <div ref={rowRef} className={styles.tabContentRow}>
      {items.map((child, i) =>
        React.isValidElement<{ collapsed?: boolean }>(child)
          ? React.cloneElement(child, { collapsed: i >= shown })
          : child
      )}
    </div>
  );
}

// Clockwise from the north-west, matching PlotDims.cornerCutsIn.
const CORNER_LABELS = ["NW", "NE", "SE", "SW"] as const;

/**
 * Tabs are phases of work and panels are small groups of related commands, which is the rule the
 * AutoCAD ribbon is built on — see the sources in notes/architecture/ribbon-organisation.md.
 *
 * Home used to carry eleven panels: the plot, its shape, its facing, the bye-law, the storeys,
 * the room mix, interiors, the drafting tools, render fidelity and the specs readout. The shelf
 * fits four or five, so six of them collapsed to anonymous 76px drop-downs every session and the
 * tab read as a row of unlabelled buttons. Five tabs of four or five panels each is the same
 * number of controls, all of them visible.
 */
const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: "architecture", label: "Home" },
  { id: "site", label: "Site" },
  { id: "draw", label: "Draw" },
  { id: "openings", label: "Openings" },
  { id: "view", label: "View" },
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
  selectedWallGlazing,
  onChangeSelectedWallGlazing,
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
  placingOpeningDef,
  onSelectPlaceOpening,
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
  roadWidthM,
  onChangeRoadWidthM,
  autoSetback = true,
  onToggleAutoSetback,
  compliance = null,
  floorsCount = 1,
  onChangeFloorsCount,
  solvedFloorCount = 1,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoLabel,
  redoLabel,
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
  onReadPlanPhoto,
  onReadHousePhoto,
  onBuildFromText,
  aiNotice = null,
  aiError = null,
  aiAssumed = [],
  aiUnsupported = [],
  isRaytracing = false,
  onToggleRaytrace,
  onOpenBOQModal,
  onOpenScheduleModal,
  onOpenCustomWallBlendModal,
  onOpenPlotShapeModal,
}: TopRibbonTaskbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState("");

  // Plot Dims Helpers
  const widthFt = Math.round(inchesToFeet(plot.widthIn));
  const depthFt = Math.round(inchesToFeet(plot.depthIn));
  const sqFt = widthFt * depthFt;

  // Name the rules the solver actually posted. A residence posts none and a cafe zones for
  // service flow, and claiming a rule that was never enforced is the dishonesty CLAUDE.md forbids.
  const rulesLabel = meta?.rules_label ?? program.rulesLabel;
  const rulesRelaxed = meta?.rules_relaxed ?? false;

  const handleStepPlot = (dim: "widthIn" | "depthIn", deltaFt: number) => {
    const next = clampInches(plot[dim] + feetToInches(deltaFt), MIN_DIM_IN, MAX_DIM_IN);
    // Stepping a dimension states a rectangle, exactly as typing one does, so it drops any drawn
    // outline rather than leaving widthIn disagreeing with the shape on screen.
    onChangePlot({ ...plot, [dim]: next, vertsIn: undefined, edgeBulgeIn: undefined });
  };

  const cornerCutFt = (index: number) =>
    Math.round(((plot.cornerCutsIn?.[index] ?? 0) / 12) * 10) / 10;

  // --- plot outline, typed ------------------------------------------------------------------
  //
  // The 2D view drags these same corners. A surveyed parcel arrives as a list of measured
  // dimensions rather than as a sketch, so both halves exist and both write the same two fields.

  /** Inches to feet for display, to one decimal. Kept exact enough to round-trip a half foot. */
  const exactFt = (inches: number) => Math.round((inches / 12) * 10) / 10;

  /** Corners before any edge is bowed — read only, purely to count them for the summary. */
  const outlineVerts: PlotPoint[] =
    plot.vertsIn && plot.vertsIn.length >= 3
      ? plot.vertsIn
      : plotPolygonIn({ ...plot, edgeBulgeIn: undefined });
  const shapeProblem = plotShapeProblem(plot);

  const plotShapeSummary = isRectangularPlot(plot)
    ? "Rectangular plot"
    : plot.edgeBulgeIn?.some((b) => Math.abs(b) >= 1)
    ? `Curved outline, ${plotPolygonIn(plot).length} corners`
    : plot.vertsIn
    ? `Drawn outline, ${outlineVerts.length} corners`
    : "Splayed plot";


  const handleTypePlot = (dim: "widthIn" | "depthIn", raw: string) => {
    const ft = Number(raw);
    if (!Number.isFinite(ft)) return;
    const inches = clampInches(Math.round(ft * 12), MIN_DIM_IN, MAX_DIM_IN);
    // Typing a size is a statement about a rectangle, so it replaces any drawn outline rather
    // than stretching one — a drawn plot has no single width to set.
    onChangePlot({ ...plot, [dim]: inches, vertsIn: undefined, edgeBulgeIn: undefined });
  };






  // A splay is cut symmetrically back along both edges of the corner, which is what a road
  // splay is and what keeps the outline convex — the one thing the solver requires of it.
  const handleStepCorner = (index: number, deltaFt: number) => {
    const cuts: [number, number, number, number] = [...(plot.cornerCutsIn ?? [0, 0, 0, 0])] as [
      number,
      number,
      number,
      number,
    ];
    const next = Math.max(0, Math.min(maxCornerCutIn(plot), cuts[index] + feetToInches(deltaFt)));
    if (next === cuts[index]) return;
    cuts[index] = next;
    onChangePlot({ ...plot, cornerCutsIn: cuts.some((c) => c > 0) ? cuts : undefined });
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

  const wallButton = (item: FurnitureItemDef) => (
    <button
      key={item.type}
      className={`${styles.windowShapeBtn} ${placingItemType === item.type ? styles.windowShapeBtnActive : ""}`}
      onClick={() => onSelectPlaceItem(placingItemType === item.type ? null : item.type)}
      title={item.description}
    >
      <span className={styles.windowShapeIcon}>{item.icon}</span>
      <span className={styles.windowShapeName}>+ {item.ribbonTag ?? item.name}</span>
    </button>
  );

  const openingButton = (item: OpeningItemDef) => {
    const isSelected = placingOpeningDef?.id === item.id;
    return (
      <button
        key={item.id}
        className={`${styles.windowShapeBtn} ${isSelected ? styles.windowShapeBtnActive : ""}`}
        onClick={() => onSelectPlaceOpening?.(isSelected ? null : item)}
        title={`${item.name} - ${item.description}`}
      >
        <span className={styles.windowShapeIcon}>{item.icon}</span>
        <span className={styles.windowShapeName}>+ {item.tag ?? item.name}</span>
      </button>
    );
  };

  return (
    <header className={styles.taskbarRoot}>
      {/* 1. Application bar: identity, workspace tools, view modes */}
      <div className={styles.appBar}>
        <div className={styles.brandGroup}>
          <svg
            className={styles.brandMark}
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M1.5 14.5V3.5h6v4h7v7z" />
            <path d="M7.5 7.5v7M1.5 10.5h6" />
          </svg>
          <span className={styles.brandTitle}>Plot to Plan</span>
        </div>

        <div className={styles.appBarDivider} />

        <AppBarTools
          savedLabel={
            lastSavedTime
              ? `Changes saved locally at ${new Date(lastSavedTime).toLocaleTimeString()}`
              : "Auto-saves all changes in real-time to browser storage"
          }
          actions={[
            {
              id: "undo",
              label: "Undo",
              title: canUndo ? `Undo ${undoLabel} (Ctrl+Z)` : "Nothing to undo",
              icon: ICONS.undo,
              onClick: onUndo,
              disabled: !canUndo,
              group: 0,
            },
            {
              id: "redo",
              label: "Redo",
              title: canRedo ? `Redo ${redoLabel} (Ctrl+Y)` : "Nothing to redo",
              icon: ICONS.redo,
              onClick: onRedo,
              disabled: !canRedo,
              group: 0,
            },
            ...(onResetDesign
              ? [
                  {
                    id: "reset",
                    label: "Reset",
                    title: "Wipe current layout & reset to clean default",
                    icon: ICONS.reset,
                    onClick: onResetDesign,
                    group: 0,
                  },
                ]
              : []),
            ...(onOpenBOQModal
              ? [
                  {
                    id: "boq",
                    label: "BOQ & Cost",
                    title: "Engineering Bill of Quantities (BOQ) & Cost Estimation",
                    icon: ICONS.boq,
                    onClick: onOpenBOQModal,
                    group: 1,
                  },
                ]
              : []),
            ...(onOpenScheduleModal
              ? [
                  {
                    id: "schedule",
                    label: "FF&E Schedule",
                    title: "FF&E and Finish Schedule — every piece and surface, room by room, in feet-inches and mm",
                    icon: ICONS.schedule,
                    onClick: onOpenScheduleModal,
                    group: 1,
                  },
                ]
              : []),
            ...(onOpenGraphicsModal
              ? [
                  {
                    id: "graphics",
                    label: "Graphics",
                    title: "Graphics & Performance Control (Press 'G')",
                    icon: ICONS.graphics,
                    onClick: onOpenGraphicsModal,
                    group: 2,
                  },
                ]
              : []),
            ...(onToggleRaytrace
              ? [
                  {
                    id: "raytrace",
                    label: "Raytrace",
                    title: "Toggle Real-Time GPU Path Tracer & Global Illumination (Press 'P')",
                    icon: ICONS.raytrace,
                    onClick: onToggleRaytrace,
                    active: isRaytracing,
                    group: 2,
                  },
                ]
              : []),
            ...(onToggleUpgrade
              ? [
                  {
                    id: "upgrade",
                    label: "Upgrade",
                    title: "Toggle Photorealistic Studio Upgrade (Press 'U')",
                    icon: ICONS.upgrade,
                    onClick: onToggleUpgrade,
                    active: isUpgraded,
                    group: 2,
                  },
                ]
              : []),
            {
              id: "daynight",
              label: lightsOn ? "Day" : "Night",
              title: lightsOn ? "Switch to night lighting" : "Switch to day lighting",
              icon: lightsOn ? ICONS.day : ICONS.night,
              onClick: onToggleLights,
              active: lightsOn,
              group: 2,
            },
            ...(mode === "orbit" && onToggleLayoutLock
              ? [
                  {
                    id: "lock",
                    label: isLayoutLocked ? "Locked" : "Unlocked",
                    title: isLayoutLocked
                      ? "3D View is Locked (Click to unlock room & dimension editing)"
                      : "Click to Lock 3D Orbit (prevents accidental room movements)",
                    icon: isLayoutLocked ? ICONS.locked : ICONS.unlocked,
                    onClick: onToggleLayoutLock,
                    active: isLayoutLocked,
                    group: 3,
                  },
                ]
              : []),
          ]}
        /> {/* Viewport mode switcher */}
        <div className={styles.modeSwitch}>
          <button
            className={`${styles.modeTab} ${mode === "orbit" ? styles.modeTabActive : ""}`}
            onClick={() => onChangeMode("orbit")}
            title="3D Aerial Orbit View">
              3D Orbit
          </button>
          <button
            className={`${styles.modeTab} ${mode === "walkthrough" ? styles.modeTabActive : ""}`}
            onClick={() => onChangeMode("walkthrough")}
            title="First-Person Walkthrough (5'5&quot; Eye Level)">
            Walk Inside
          </button>
          <button
            className={`${styles.modeTab} ${mode === "blueprint" ? styles.modeTabActive : ""}`}
            onClick={() => onChangeMode("blueprint")}
            title="2D CAD Architectural Blueprint">
              2D Blueprint
          </button>
        </div>
      </div> {/* 2. Ribbon tab strip */}
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
      </div> {/* 2. Ribbon Shelf: Contextual Tool Deck */}
      {!isRibbonCollapsed && (
        <div className={styles.ribbonShelf}>
          {/* TAB 1: HOME - THE PLAN ITSELF */}
          {activeTab === "architecture" && (
            <RibbonRow>
              {/* Group 0: Building Programme */}
              <RibbonPanel label={<>Building Type</>}>
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
              </RibbonPanel>
              {/* Group 1: Plot Dimensions */}
              <RibbonPanel label={<>Plot Dimensions</>}>
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
                            ...plot,
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
                <div className={styles.stackedGroup}>
                <div className={styles.dimensionSteppersRow}>
                  <div className={styles.dimStepper}>
                    <span className={styles.dimLabel}>W</span>
                    <button className={styles.stepperBtn} onClick={() => handleStepPlot("widthIn", -1)}>
                      -
                    </button>
                    {/* Typed, not only stepped. A surveyed plot is 33'6", and reaching that a foot
                        at a time from 30 is not a size control, it is a punishment. */}
                    <input
                      className={styles.dimValInput}
                      type="number"
                      min={MIN_DIM_IN / 12}
                      max={MAX_DIM_IN / 12}
                      step={0.5}
                      value={exactFt(plot.widthIn)}
                      onChange={(e) => handleTypePlot("widthIn", e.target.value)}
                      title="Plot width in feet"
                      aria-label="Plot width in feet"
                    />
                    <button className={styles.stepperBtn} onClick={() => handleStepPlot("widthIn", 1)}>
                      +
                    </button>
                  </div>
                  <div className={styles.dimStepper}>
                    <span className={styles.dimLabel}>D</span>
                    <button className={styles.stepperBtn} onClick={() => handleStepPlot("depthIn", -1)}>
                      -
                    </button>
                    <input
                      className={styles.dimValInput}
                      type="number"
                      min={MIN_DIM_IN / 12}
                      max={MAX_DIM_IN / 12}
                      step={0.5}
                      value={exactFt(plot.depthIn)}
                      onChange={(e) => handleTypePlot("depthIn", e.target.value)}
                      title="Plot depth in feet"
                      aria-label="Plot depth in feet"
                    />
                    <button className={styles.stepperBtn} onClick={() => handleStepPlot("depthIn", 1)}>
                      +
                    </button>
                  </div>
                </div>
                {plot.vertsIn && (
                  <div className={styles.facingInfoBadge} title="Width and depth are the drawn outline's bounding box while a shape is drawn.">
                    From the drawn outline
                  </div>
                )}
                </div>
              </RibbonPanel>
              {/* Group 4: Room Program */}
              <RibbonPanel label={program.key === "cafe" ? "Space Program" : "Room Program"}>
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
              </RibbonPanel>
              {/* Group 3: Storey / Floor Level */}
              <RibbonPanel label={<>Floor Level</>}>
                <div className={styles.floorButtonGroup}>
                  {[
                    { floor: 0, label: "Ground Floor", short: "G " },
                    { floor: 1, label: "1st Floor", short: "1F " },
                    { floor: 2, label: "2nd Floor", short: "2F " },
                    { floor: 3, label: "Terrace Roof", short: "Roof " },
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
                <div
                  className={activeFloor < solvedFloorCount ? styles.facingInfoBadge : styles.draftFloorBadge}
                  title={
                    activeFloor < solvedFloorCount
                      ? "The solver packs this floor: rooms, doors, windows and walls are all its own."
                      : "Above the storeys being solved. This floor is a drafting surface only — walls you draw yourself, over the plan below. Nothing here is solved, costed or checked. Raise Storeys in the Bye-Law panel to have it packed."
                  }
                >
                  {activeFloor < solvedFloorCount
                    ? `${activeFloor === 0 ? "Ground" : `${activeFloor}${activeFloor === 1 ? "st" : "nd"}`} Floor - solved`
                    : activeFloor === 3
                    ? "Terrace - draft only"
                    : `${activeFloor}${activeFloor === 1 ? "st" : "nd"} Floor - draft only`}
                </div>
              </RibbonPanel>
              {/* Architectural Model Blueprints */}
              <RibbonPanel label={<>Model Plans</>}>
                <button
                  className={styles.modelBlueprintsBtn}
                  onClick={onOpenModelBlueprintsModal}
                  title="Browse curated architectural model blueprints">
                  Architectural Model Blueprints...
                </button>
              </RibbonPanel>
            </RibbonRow>
          )}

          {/* TAB 2: SITE - THE PLOT AND WHAT THE BYE-LAW ALLOWS ON IT */}
          {activeTab === "site" && (
            <RibbonRow>
              {/* Plot Shape: corner splays */}
              <RibbonPanel label={<>Plot Shape</>}>
                <div className={styles.stackedGroup}>
                <div className={styles.cornerGrid}>
                  {CORNER_LABELS.map((corner, i) => (
                    <div key={corner} className={styles.dimStepper}>
                      <span className={styles.dimLabel}>{corner}</span>
                      <button
                        className={styles.stepperBtn}
                        onClick={() => handleStepCorner(i, -1)}
                        title={`Straighten the ${corner} corner`}
                      >
                        -
                      </button>
                      <span className={styles.dimValText}>{cornerCutFt(i)}&apos;</span>
                      <button
                        className={styles.stepperBtn}
                        onClick={() => handleStepCorner(i, 1)}
                        title={`Splay the ${corner} corner by another foot`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
                <div className={styles.facingInfoBadge}>{plotShapeSummary}</div>

                {/* The corner table this replaced asked for each corner's X and Y, which is
                    the one way nobody describes a plot, and could not be edited a field at a
                    time without passing through degenerate shapes. Sides and turns live in the
                    Plot Shape studio now — lib/plotTraverse.ts. */}
                <button
                  className={styles.shapeStudioBtn}
                  onClick={onOpenPlotShapeModal}
                  title="Open the Plot Shape studio: side lengths, corner turns and curved edges, with a live preview"
                >
                  Edit plot shape...
                </button>
                {shapeProblem && <div className={styles.vertexProblem}>{shapeProblem}</div>}
                </div>
              </RibbonPanel>
              {/* Group 2: Road Facing */}
              <RibbonPanel label={<>Road Facing</>}>
                <div className={styles.facingButtonsRow}>
                  {(["N", "E", "S", "W"] as Facing[]).map((f) => (
                    <button
                      key={f}
                      className={`${styles.facingBtn} ${facing === f ? styles.facingBtnActive : ""}`}
                      onClick={() => onChangeFacing(f)}
                      title={`Road facing ${f}`}
                    >
                      <span className={styles.facingIcon}>
                                                                                                                              </span>
                      <span className={styles.facingLetter}>{f}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.facingInfoBadge}>Facing {facing}</div>
              </RibbonPanel>
              {/* Bye-law: what this plot is allowed */}
              <RibbonPanel label={<>Bye-Law</>}>
                <div className={styles.stackedGroup}>
                  <div className={styles.dimStepper}>
                    <span className={styles.dimLabel}>Road</span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => onChangeRoadWidthM?.(Math.max(3, (roadWidthM ?? 9) - 1.5))}
                      title="Narrower abutting road"
                    >
                      -
                    </button>
                    <span className={styles.dimValText}>{roadWidthM ?? 9} m</span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => onChangeRoadWidthM?.(Math.min(45, (roadWidthM ?? 9) + 1.5))}
                      title="Wider abutting road"
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.dimStepper}>
                    <span className={styles.dimLabel}>Storeys</span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => onChangeFloorsCount?.(Math.max(1, floorsCount - 1))}
                      title="One storey fewer"
                    >
                      -
                    </button>
                    <span className={styles.dimValText}>
                      {floorsCount === 1 ? "G" : `G+${floorsCount - 1}`}
                    </span>
                    <button
                      className={styles.stepperBtn}
                      disabled={compliance?.maxFloors != null && floorsCount >= Math.min(3, compliance.maxFloors)}
                      onClick={() => onChangeFloorsCount?.(Math.min(3, floorsCount + 1))}
                      title={
                        compliance?.maxFloors != null && floorsCount >= Math.min(3, compliance.maxFloors)
                          ? `The ${compliance.rule.roadBand} height ceiling allows ${compliance.maxFloors} floors, and the solver models at most 3`
                          : "One storey more. The mix splits across floors and a stair core is added to each."
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    className={autoSetback ? styles.appBarBtnActive : styles.appBarBtn}
                    onClick={() => onToggleAutoSetback?.(!autoSetback)}
                    title={
                      autoSetback
                        ? "Setbacks are derived from G.O. Ms. 168 for this plot size and road width. Click to go back to the old fixed 5/5/3/3 ft."
                        : "Fixed 5/5/3/3 ft setbacks. Click to derive them from the bye-law instead."
                    }
                  >
                    {autoSetback ? "Bye-law setbacks" : "Fixed setbacks"}
                  </button>
                </div>
                <div className={styles.complianceReadout}>
                  <div className={styles.complianceRow}>
                    <span>Cover</span>
                    <strong>{compliance ? `${compliance.groundCoveragePct}%` : "-"}</strong>
                  </div>
                  <div className={styles.complianceRow}>
                    <span>FAR</span>
                    <strong>{compliance ? compliance.achievedFar.toFixed(2) : "-"}</strong>
                  </div>
                  <div className={styles.complianceRow}>
                    <span>Height</span>
                    <strong>
                      {compliance?.rule.maxHeightM == null
                        ? "uncapped"
                        : `${compliance.rule.maxHeightM} m / ${compliance.maxFloors} flr`}
                    </strong>
                  </div>
                </div>
                <div
                  className={styles.facingInfoBadge}
                  title={
                    compliance
                      ? `G.O. Ms. 168 - ${compliance.rule.plotBand}, ${compliance.rule.roadBand}. Front ${compliance.rule.frontM} m, side ${compliance.rule.sideM} m, rear ${compliance.rule.rearM} m. Telangana sets no fixed FSI cap, so the FAR above is what this plan achieves, not a limit.`
                      : undefined
                  }
                >
                  {compliance?.permissionExempt
                    ? "Under 75 sq yd - register, no sanction"
                    : compliance
                    ? `${compliance.plotAreaSqYd} sq yd - G.O. Ms. 168`
                    : "G.O. Ms. 168"}
                </div>
              </RibbonPanel>
              {/* Group 8: Architectural Specs */}
              <RibbonPanel label={<>Specs</>}>
                <div className={styles.solverBadge}>
                  {meta?.status === "INFEASIBLE" ? (
                    <div className={styles.solverInfeasibleBlock}>
                      <span
                        className={styles.solverStatusError}
                        title={`This room program is too large to fit inside the ${widthFt}' × ${depthFt}' envelope. Remove a room or enlarge the plot.`}
                      >
                        Does not fit envelope
                      </span>
                      <span className={styles.solverInfeasibleAction}>
                        Remove a room or enlarge plot
                      </span>
                    </div>
                  ) : meta?.status === OFFLINE_ESTIMATE_STATUS ? (
                    <span
                      className={styles.solverStatusWarn}
                      title={`The solver is unreachable, so these spaces are a rough grid. No ${rulesLabel || "layout"} rule was checked and no doors were derived. Start the backend to get a real plan.`}
                    >
                      ⚠ Offline estimate — {rulesLabel || "rules"} not checked
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
                        {meta?.status ?? (rulesLabel ? `${rulesLabel} Solved` : "Solved")}
                    </span>
                  )}
                  <span className={styles.solverSubText}>
                    {widthFt}&apos; × {depthFt}&apos; ({sqFt.toLocaleString()} sq ft)
                    {coverCount > 0 && ` · ${coverCount} covers`}
                  </span>
                </div>
              </RibbonPanel>
            </RibbonRow>
          )}

          {/* TAB 3: DRAW - PUTTING GEOMETRY DOWN BY HAND */}
          {activeTab === "draw" && (
            <RibbonRow>
              {/* Group 6: CAD Freehand Tools */}
              <RibbonPanel label={<>CAD Drafting</>}>
                <div className={styles.cadDraftingGroup}>
                  <button
                    className={`${styles.cadToolBtn} ${activeCadTool === "draw_wall" && activeWallType !== "curved" ? styles.cadToolBtnActive : ""}`}
                    onClick={() => {
                      onChangeMode("blueprint");
                      onChangeWallType?.("exterior");
                      onChangeCadTool?.(activeCadTool === "draw_wall" && activeWallType !== "curved" ? "select" : "draw_wall");
                    }}
                    title="Draw straight load-bearing or partition walls point-to-point">
                    Wall
                  </button>
                  <button
                    className={`${styles.cadToolBtn} ${activeCadTool === "draw_wall" && activeWallType === "curved" ? styles.cadToolBtnActive : ""}`}
                    onClick={() => {
                      onChangeMode("blueprint");
                      onChangeWallType?.("curved");
                      onChangeCadTool?.(activeCadTool === "draw_wall" && activeWallType === "curved" ? "select" : "draw_wall");
                    }}
                    title="Draw curved architectural arc walls">
                    Curved Wall
                  </button>
                  <button
                    className={`${styles.cadToolBtn} ${activeCadTool === "place_door" ? styles.cadToolBtnActive : ""}`}
                    onClick={() => {
                      onChangeMode("blueprint");
                      onChangeCadTool?.(activeCadTool === "place_door" ? "select" : "place_door");
                    }}
                    title="Place doors with swing arcs onto any wall">
                    Door
                  </button>
                  <button
                    className={`${styles.cadToolBtn} ${activeCadTool === "place_window" ? styles.cadToolBtnActive : ""}`}
                    onClick={() => {
                      onChangeMode("blueprint");
                      onChangeCadTool?.(activeCadTool === "place_window" ? "select" : "place_window");
                    }}
                    title="Place windows onto any wall">
                    Window
                  </button>
                  <button
                    className={`${styles.cadToolBtn} ${activeCadTool === "tag_room" ? styles.cadToolBtnActive : ""}`}
                    onClick={() => {
                      onChangeMode("blueprint");
                      onChangeCadTool?.(activeCadTool === "tag_room" ? "select" : "tag_room");
                    }}
                    title="Tag and label room zones with sq ft">
                    Tag
                  </button>
                  <button
                    className={`${styles.cadToolBtn} ${isDoorsWindowsDrawerOpen ? styles.cadToolBtnActive : ""}`}
                    onClick={() => onToggleDoorsWindowsDrawer?.()}
                    title="Open Doors & Windows Catalog Shelf (Drag & Drop onto any wall)">
                    Openings Catalog
                  </button>
                  {onStartFromScratch && (
                    <button
                      className={styles.scratchBtn}
                      onClick={onStartFromScratch}
                      title="Clear automated rooms and start with a 100% clean plot to draft your custom house">
                      Scratch
                    </button>
                  )}
                </div>
              </RibbonPanel>
              {/* Walls and openings, both read from their catalogs rather than restated here.
                  This tab used to hardcode one button per item, so anything added to a catalog
                  was unreachable from the ribbon with nothing in the code to say so - the
                  Sliding Glass Door sat in OPENINGS_CATALOG while "Structure", the tab you would
                  naturally look in for a door, could not show it. */}
              <RibbonPanel label={<>Partition Walls</>}>
                <div className={styles.presetsGrid}>{STRAIGHT_WALLS.map(wallButton)}</div>
              </RibbonPanel>

              <RibbonPanel label={<>Curved Walls &amp; Doors</>}>
                <div className={styles.presetsGrid}>{CURVED_WALLS.map(wallButton)}</div>
              </RibbonPanel>

              <RibbonPanel label={<>Stairs</>}>
                <div className={styles.presetsGrid}>{STAIR_ITEMS.map(wallButton)}</div>
                <div className={styles.facingInfoBadge} title="NBC 2016, one- and two-family dwellings: riser at most 190 mm, tread at least 250 mm, flight at least 0.90 m wide. Every style here is generated to those numbers from the floor-to-floor rise.">
                  16 risers · 7.2 in · NBC
                </div>
              </RibbonPanel>
            </RibbonRow>
          )}

          {/* TAB 4: OPENINGS - EVERY HOLE IN A WALL */}
          {activeTab === "openings" && (
            <RibbonRow>

              <RibbonPanel label={<>Doors</>}>
                <div className={styles.presetsGrid}> {DOOR_OPENINGS.map(openingButton)}
                  <button
                    className={styles.windowShapeBtn}
                    onClick={onToggleDoorsWindowsDrawer}
                    title="Open the full Doors & Windows catalog, including every window opening">
                    <span className={styles.windowShapeIcon}>OPN</span>
                    <span className={styles.windowShapeName}>All Openings</span>
                  </button>
                </div>
              </RibbonPanel>
              {/* Window Shapes */}
              <RibbonPanel label={<>Window Styles</>}>
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
              </RibbonPanel>
              {/* Wall & Window Crop Options */}
              <RibbonPanel label={<>Window Spans</>}>
                <div className={styles.presetsGrid}>
                  <button
                    className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 3.0 ? styles.windowShapeBtnActive : ""}`}
                    onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 3.0 })}
                    title="Crop Window Span to 3.0 ft (Slender)">
                    <span className={styles.windowShapeIcon}></span>
                    <span className={styles.windowShapeName}>3ft Win</span>
                  </button>
                  <button
                    className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 4.0 ? styles.windowShapeBtnActive : ""}`}
                    onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 4.0 })}
                    title="Crop Window Span to 4.0 ft (Standard)">
                    <span className={styles.windowShapeIcon}></span>
                    <span className={styles.windowShapeName}>4ft Win</span>
                  </button>
                  <button
                    className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 5.0 ? styles.windowShapeBtnActive : ""}`}
                    onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 5.0 })}
                    title="Crop Window Span to 5.0 ft (Wide)">
                    <span className={styles.windowShapeIcon}></span>
                    <span className={styles.windowShapeName}>5ft Win</span>
                  </button>
                  <button
                    className={`${styles.windowShapeBtn} ${(windowConfig.globalWidthFt ?? 4.0) === 6.0 ? styles.windowShapeBtnActive : ""}`}
                    onClick={() => onChangeWindowConfig?.({ ...windowConfig, globalWidthFt: 6.0 })}
                    title="Crop Window Span to 6.0 ft (Panoramic)">
                    <span className={styles.windowShapeIcon}></span>
                    <span className={styles.windowShapeName}>6ft Win</span>
                  </button>
                </div>
              </RibbonPanel>
              {/* Wall Demolition & Open Concept */}
              <RibbonPanel label={<>Fenestration Studio</>}>
                <div className={styles.wallActionsColumn}>
                  <span className={styles.instructionHint}>
                    Click any wall in 3D to Demolish, Add Windows, or Rebuild!
                  </span>
                  <button
                    className={styles.actionPillBtn}
                    onClick={onOpenWindowModal}
                    title="Open Multi-Room Window & Wall Demolition Studio">
                    Full Window &amp; Wall Studio...
                  </button>
                </div>
              </RibbonPanel>
            </RibbonRow>
          )}

          {/* TAB 5: VIEW - HOW IT IS DRAWN AND WHAT LEAVES THE APP */}
          {activeTab === "view" && (
            <RibbonRow>
              {/* Group 5: Interiors & Sizing */}
              <RibbonPanel label={<>Interiors &amp; Sizing</>}>
                <button
                  className={`${styles.actionPillBtn} ${furnished ? styles.actionPillActive : ""}`}
                  onClick={() => onToggleFurnished(!furnished)}
                  title="Auto-furnish rooms with sofas, beds, counters & fans">
                  Auto-Furnish: <b>{furnished ? "ON" : "OFF"}</b>
                </button>

                <button
                  className={styles.actionPillBtn}
                  onClick={onOpenRoomDimensionsModal}
                  title="Open Fine-Grained Room Dimensions Studio">
                  Custom Sizes...
                </button>
              </RibbonPanel>
              {/* Group 7: Render Fidelity */}
              <RibbonPanel label={<>Render Fidelity</>}>
                <div className={styles.stackedGroup}>
                  <button
                    className={`${styles.actionPillBtn} ${
                      materialConfig.graphicsFidelityTier === "ultra_extreme" ? styles.actionPillActive : ""}`}
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
                    title="Toggle 4K Ultra Textures & 16x Anisotropic Filtering"> {materialConfig.graphicsFidelityTier === "ultra_extreme" ? "4K Ultra On" : "4K Ultra Mode"}
                  </button>
                  <div className={styles.facingInfoBadge}>
                    Smooth {Math.round((materialConfig.textureSmoothness ?? 0.88) * 100)}% · Gloss{" "}
                    {Math.round((materialConfig.floorGlossLevel ?? 0.92) * 100)}%
                  </div>
                </div>
              </RibbonPanel>
              {/* 2D CAD Blueprint View */}
              <RibbonPanel label={<>Blueprint Mode</>}>
                <button
                  className={`${styles.cadViewBtn} ${mode === "blueprint" ? styles.cadViewBtnActive : ""}`}
                  onClick={() => onChangeMode("blueprint")}
                  title="Switch to 2D CAD Blueprint Plan">
                    2D CAD Blueprint View
                </button>
              </RibbonPanel>
              {/* Export Suite */}
              <RibbonPanel label={<>CAD Export Suite</>}>
                <button
                  className={styles.exportSuiteBtn}
                  onClick={onOpenExportModal}
                  title="Export the blueprint sheet: JSON model, SVG, high-res PNG, or print to PDF. No DXF yet.">
                  Export Blueprint (JSON / SVG / PNG / Print)...
                </button>
              </RibbonPanel>
            </RibbonRow>
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
                <span className={styles.aiSparkleIcon}>FX</span>
                <input
                  type="text"className={styles.aiPromptInput}
                  placeholder="Describe your plot & house (e.g. '30x40 North facing 2BHK with a store')..."value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  disabled={isSimulatingPrompt}
                />
                <button
                  type="submit"className={styles.aiSimulateBtn}
                  disabled={isSimulatingPrompt || !aiPromptInput.trim()}
                >
                  {isSimulatingPrompt ? "Generating 3D..." : "Simulate 3D House"}
                </button>
              </form>

              <div className={styles.aiPillRow}>
                <span className={styles.aiPillLabel}>Quick Prompts:</span>
                {[
                  "30x40 North 2BHK Store",
                  "40x60 East 3BHK Luxury",
                  "20x30 South 1BHK Studio",
                  "50x80 North 4BHK Villa",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"className={styles.aiPill}
                    onClick={() => {
                      setAiPromptInput(pill);
                      if (onPromptToSimulate) onPromptToSimulate(pill);
                    }}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* The three reading paths — backend/ai. Each sends the box above as a correcting
                  note: "this is the ground floor", "the road is on the left". */}
              <div className={styles.aiPillRow}>
                <span className={styles.aiPillLabel}>Read from:</span>
                <button
                  type="button"
                  className={styles.aiPill}
                  disabled={isSimulatingPrompt || !aiPromptInput.trim()}
                  onClick={() => onBuildFromText?.(aiPromptInput)}
                  title="Read the sentence above into a room mix. CP-SAT places every room."
                >
                  Text
                </button>
                <label
                  className={styles.aiPill}
                  title="A photo, scan or screenshot of an existing floor plan. Room names and printed dimensions are read; the plan is then re-solved, not traced."
                >
                  Plan photo
                  <input
                    type="file"
                    accept={PLAN_IMAGE_TYPES.join(",")}
                    className={styles.aiHiddenFile}
                    disabled={isSimulatingPrompt}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // Cleared before the handler so picking the same file twice fires again.
                      e.target.value = "";
                      if (file) onReadPlanPhoto?.(file, aiPromptInput);
                    }}
                  />
                </label>
                <label
                  className={styles.aiPill}
                  title="A photo of a house from outside. The facade is read; the plan and interior are generated."
                >
                  House photo
                  <input
                    type="file"
                    accept={PLAN_IMAGE_TYPES.join(",")}
                    className={styles.aiHiddenFile}
                    disabled={isSimulatingPrompt}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) onReadHousePhoto?.(file, aiPromptInput);
                    }}
                  />
                </label>
              </div>

              {/* Never collapsed into the plan itself: an ask that quietly vanishes, or a generated
                  layout passed off as a reading of someone's house, is
                  notes/architecture/client-side-fallback.md. */}
              {(aiError || aiNotice || aiAssumed.length > 0 || aiUnsupported.length > 0) && (
                <div className={styles.aiNotice} role="status">
                  {aiError && <div className={styles.aiNoticeError}>{aiError}</div>}
                  {aiNotice && <div className={styles.aiNoticeRead}>{aiNotice}</div>}
                  {aiAssumed.length > 0 && (
                    <div className={styles.aiNoticeRead}>
                      You did not say: {aiAssumed.join("; ")}. Change it in the ribbon if that is
                      wrong.
                    </div>
                  )}
                  {aiUnsupported.length > 0 && (
                    <div className={styles.aiNoticeUnsupported}>
                      Not built, because this tool cannot: {aiUnsupported.join("; ")}.
                    </div>
                  )}
                </div>
              )}

              <div className={styles.aiFeatureBadges}>
                <div className={styles.aiBadge}> &lt;100ms CP-SAT</div>
                <div className={styles.aiBadge}> 100% Reachable</div>
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
                        {selectedObject.name || "Wall Partition"}
                    </span>
                    <button className={styles.deselectBtn} onClick={onDeselectObject} title="Deselect">
                      ✕
                    </button>
                  </div>
                  {/* Demolish, glazing and paint bands are all keyed by room index plus edge. A
                      wall the user drew has neither, so these did nothing to it at best — and
                      "Delete Wall" fell back to `roomIndex ?? 0, edge ?? "N"` and demolished an
                      unrelated room's north wall. A drawn wall is edited in the 3D wall panel. */}
                  {selectedObject.isCustomWall ? (
                    <div className={styles.inspectorHint}>
                      Drawn wall. Its thickness, height, length and cutouts are in the wall panel
                      on the right of the 3D view.
                    </div>
                  ) : (
                  <div className={styles.inspectorActions}>
                    <button
                      className={selectedObject.isWallRemoved ? styles.rebuildWallBtn : styles.demolishWallBtn}
                      onClick={() =>
                        onToggleRemoveWall &&
                        onToggleRemoveWall(selectedObject.roomIndex ?? 0, selectedObject.edge ?? "N")
                      }
                      title={
                        selectedObject.isWallRemoved
                          ? "Add back solid wall partition to close this opening": "Delete this wall to merge both rooms into an open concept space"}
                    >
                      {selectedObject.isWallRemoved ? " + Add / Rebuild Wall" : "Delete Wall (Open Concept)"}
                    </button>
                    {!selectedObject.isWallRemoved && (
                      <button
                        className={styles.addWinBtn}
                        onClick={() =>
                          onAddWindowToWall &&
                          onAddWindowToWall(selectedObject.roomIndex ?? 0, selectedObject.edge ?? "N")
                        }
                      >
                        Add Window
                      </button>
                    )}
                  </div>
                  )}
                  {/* Glazing: make this wall glass, its door glass, or both. */}
                  {!selectedObject.isCustomWall && onChangeSelectedWallGlazing && (
                    <div className={styles.bandRow}>
                      <span className={styles.bandLabel}>Glazing</span> {GLAZING_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={styles.bandPresetBtn}
                          onClick={() => onChangeSelectedWallGlazing(preset.glazing)}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}

                      {selectedWallGlazing && (
                        <>
                          <span className={styles.bandDivider} />

                          <button
                            className={
                              selectedWallGlazing.wall ? styles.bandPresetActive : styles.bandPresetBtn
                            }
                            onClick={() =>
                              onChangeSelectedWallGlazing(
                                withGlazingTarget(selectedWallGlazing, "wall", !selectedWallGlazing.wall)
                              )
                            }
                            title="Glaze the wall itself">
                            Wall
                          </button>
                          <button
                            className={
                              selectedWallGlazing.door ? styles.bandPresetActive : styles.bandPresetBtn
                            }
                            onClick={() =>
                              onChangeSelectedWallGlazing(
                                withGlazingTarget(selectedWallGlazing, "door", !selectedWallGlazing.door)
                              )
                            }
                            title="Glaze the door in this wall">
                            Door
                          </button>

                          <select
                            className={styles.bandColorSelect}
                            value={selectedWallGlazing.styleId}
                            onChange={(e) =>
                              onChangeSelectedWallGlazing(
                                withGlazingStyle(selectedWallGlazing, e.target.value)
                              )
                            }
                            title="Glass type"> {GLAZING_STYLES.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>

                          <button
                            className={styles.bandClearBtn}
                            onClick={() => onChangeSelectedWallGlazing(null)}
                            title="Back to a solid wall">
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Paint bands: split this wall and judge colours side by side on it. */}
                  {!selectedObject.isCustomWall && onChangeSelectedWallBands && (
                    <div className={styles.bandRow}>
                      <span className={styles.bandLabel}>Paint bands</span> {WALL_BAND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={styles.bandPresetBtn}
                          onClick={() => onChangeSelectedWallBands(preset.scheme)}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}

                      {onOpenCustomWallBlendModal && (
                        <button
                          className={styles.bandPresetBtn}
                          onClick={onOpenCustomWallBlendModal}
                          style={{
                            background: "linear-gradient(135deg, rgba(61, 92, 105, 0.25), rgba(79, 70, 229, 0.25))",
                            borderColor: "#6f9aa8",
                            color: "#6f9aa8",
                            fontWeight: 700,
                          }}
                          title="Open Custom Wall Partitions & Permutations Studio">
                          Custom
                        </button>
                      )}

                      {selectedWallBands && (
                        <>
                          <span className={styles.bandDivider} />

                          <button
                            className={styles.bandPresetBtn}
                            onClick={() =>
                              onChangeSelectedWallBands(
                                withAxis(
                                  selectedWallBands,
                                  selectedWallBands.axis === "horizontal" ? "vertical" : "horizontal")
                              )
                            }
                            title="Swap between bands stacked up the wall and bands run along it"> {selectedWallBands.axis === "horizontal" ? "Vertical" : "Horizontal"}
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
                          </div> {/* One picker per band, in band order. */}
                          {selectedWallBands.bands.map((band, idx) => (
                            <label
                              key={idx}
                              className={styles.bandSwatch}
                              style={{ backgroundColor: getWallColorHexStr(band.colorId) }}
                              title={`Band ${idx + 1}: click for any colour`}
                            >
                              <input
                                type="color"className={styles.hiddenBandInput}
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
                            value=""onChange={(e) => {
                              const [idxStr, colorId] = e.target.value.split("|");
                              if (!colorId) return;
                              onChangeSelectedWallBands(
                                withBandColor(selectedWallBands, Number(idxStr), colorId)
                              );
                            }}
                            title="Set a band to a catalogue colour">
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
                            title="Drop the bands and go back to the plain wall colour">
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
                    <span className={styles.inspectorTitle}> {selectedObject.name}</span>
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
                    </div> {/* Drapes Toggle */}
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
                      {selectedObject.windowHasCurtains !== false ? "Drapes ON" : "Drapes OFF"}
                    </button> {/* Delete */}
                    <button
                      className={styles.deleteBtn}
                      onClick={() => {
                        if (onDeleteIndividualWindow) {
                          onDeleteIndividualWindow(selectedObject.id);
                        } else {
                          onDeleteSelected();
                        }
                      }}
                      title="Delete selected window">
                      
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
                        title="Move West (-X)">
                        ⬅
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(0, -1.0)}
                        title="Move North (-Z)">
                        ⬆
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(0, 1.0)}
                        title="Move South (+Z)">
                        ⬇
                      </button>
                      <button
                        className={styles.moveBtn}
                        onClick={() => onMoveSelected && onMoveSelected(1.0, 0)}
                        title="Move East (+X)">
                        ➡
                      </button>
                      {selectedObject.x !== undefined && selectedObject.z !== undefined && (
                        <span className={styles.positionBadge}>
                          {selectedObject.x.toFixed(1)}&apos;, {selectedObject.z.toFixed(1)}&apos;
                        </span>
                      )}
                    </div> {/* Rotate */}
                    <button
                      className={styles.transformBtn}
                      onClick={() => onRotateSelected(Math.PI / 4)}
                      title="Rotate 45°">
                        45°
                    </button> {/* Scale */}
                    {!selectedObject.isBuiltin && (
                      <>
                        <button
                          className={styles.transformBtn}
                          onClick={() => onScaleSelected(0.1)}
                          title="Scale Up (+10%)">
                            +
                        </button>
                        <button
                          className={styles.transformBtn}
                          onClick={() => onScaleSelected(-0.1)}
                          title="Scale Down (-10%)">
                            -
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
                                  ? "2px solid #d4703a": "none",
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
                      title="Replace with another object">
                      Replace...
                    </button> {/* Delete */}
                    <button
                      className={styles.deleteBtn}
                      onClick={onDeleteSelected}
                      title="Delete selected object">
                      
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
