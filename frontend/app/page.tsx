"use client";

// Phase 1 composition root + 3D First-Person Walkthrough Engine + 2D Architectural Blueprint & Export Engine
// Plot geometry is instant and local; rooms arrive from POST /solve on a 400ms debounce.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Scene from "@/components/Scene";
import { CustomDim } from "@/components/RoomCustomizer";
import Minimap from "@/components/Minimap";
import WalkthroughOverlay from "@/components/WalkthroughOverlay";
import Blueprint2DView from "@/components/Blueprint2DView";
import BlueprintExportModal from "@/components/BlueprintExportModal";
import RoomDimensionsModal from "@/components/RoomDimensionsModal";
import PlotShapeModal from "@/components/PlotShapeModal";
import {
  buildableDepthIn,
  buildableWidthIn,
  DEFAULT_PLOT,
  DEFAULT_SETBACK,
  Facing,
  PlotDims,
} from "@/lib/plot";
import { findAdjacentRoomEdge, RoomName, ROOM_NAMES, ROOM_LABELS, withCounts } from "@/lib/rooms";
import WallInspector from "@/components/WallInspector";
import { WALL_HEIGHT_FT } from "@/lib/sceneConstants";
import { edgeName, isEmptyWallEdit, WallEdit, WallEdits } from "@/lib/wallEdits";
import { defaultCounts, getProgram, ProgramKey } from "@/lib/programs";
import { NearPairIds, nearIndices, requestAIPlan } from "@/lib/aiPlan";
import { readImageFile, requestAIPlanFromImage } from "@/lib/aiPlanImage";
import { applyFacade, requestAIFacade, summary as facadeSummary } from "@/lib/aiFacadeImage";
import { seatingCapacity } from "@/lib/cafeInteriors";
import {
  resolveWallBandScheme,
  roomInstanceId,
  wallBandKey,
  WallBandScheme,
} from "@/lib/wallBands";
import { resolveWallGlazing, WallGlazing } from "@/lib/glazing";
import { useSolve } from "@/lib/useSolve";
import { parsePromptClient, RoomOpening, RoomSpecIn, solvePromptApi } from "@/lib/solve";
import { feetToInches, inchesToFeet } from "@/lib/units";
import { ModelBlueprint } from "@/lib/modelBlueprints";
import ModelBlueprintsModal from "@/components/ModelBlueprintsModal";
import MaterialCustomizerModal from "@/components/MaterialCustomizerModal";
import WindowShapeModal from "@/components/WindowShapeModal";
import TopRibbonTaskbar from "@/components/TopRibbonTaskbar";
import ReplaceObjectModal from "@/components/ReplaceObjectModal";
import DoorsWindowsDrawer from "@/components/DoorsWindowsDrawer";
import AIFurnitureStudioModal from "@/components/AIFurnitureStudioModal";
import GraphicsControlModal from "@/components/GraphicsControlModal";
import BOQCostModal from "@/components/BOQCostModal";
import DesignScheduleModal from "@/components/DesignScheduleModal";
import ElevationsModal from "@/components/ElevationsModal";
import ClearanceAuditModal from "@/components/ClearanceAuditModal";
import MoodboardModal from "@/components/MoodboardModal";
import CeilingPlanModal from "@/components/CeilingPlanModal";
import { BuiltinFurnitureRecord } from "@/lib/furnitureInventory";
import CustomWallBlendModal from "@/components/CustomWallBlendModal";

import { GraphicsSettings, DEFAULT_GRAPHICS_SETTINGS } from "@/lib/graphicsConfig";
import { OpeningItemDef } from "@/lib/openingsCatalog";
import { SelectedObjectInfo } from "@/components/Scene";
import { PlacedCustomObject, FURNITURE_CATALOG } from "@/lib/furnitureCatalog";
import { computeSmartWallSnap } from "@/lib/smartWallSnap";
import {
  DEFAULT_MATERIAL_CONFIG,
  HouseMaterialConfig,
} from "@/lib/materialsCatalog";
import {
  DEFAULT_WINDOW_CONFIG,
  WindowConfig,
  WindowFrameFinishId,
  WindowGlassTintId,
  WindowShapeId,
} from "@/lib/windowCatalog";
import {
  detectCurrentRoom,
  EYE_LEVEL_FT,
  PlayerTransform,
} from "@/lib/walkthrough";
import {
  CustomDrawnWall,
  CustomRoomZone,
  CustomWallOpening,
  CustomWallType,
  CadTool,
  WALL_TYPE_CONFIGS,
  WallJoinStyle,
  DrawnStair,
  DEFAULT_STAIR_WIDTH_IN,
} from "@/lib/customArchitecture";
import { DesignSnapshot, describeDesignChange, useDesignHistory } from "@/lib/designHistory";
import { OFFLINE_ESTIMATE_STATUS } from "@/lib/solve";
import { assessCompliance, DEFAULT_ROAD_WIDTH_M } from "@/lib/compliance";
import { MAX_BULGE_IN, RoomEdgeCurves } from "@/lib/wallCurves";
import {
  JOIN_STYLES,
  MAX_JOIN_RADIUS_IN,
  MIN_JOIN_RADIUS_IN,
  DEFAULT_JOIN_RADIUS_IN,
  autoJoinWalls,
  breakChain,
  chainWalls,
  combineWalls,
  commonChainId,
  setChainJoin,
} from "@/lib/wallJoins";
import { clearProject, loadProject, programOfSavedProject, saveProject } from "@/lib/projectStorage";
import styles from "./page.module.css";

const DEFAULT_COUNTS: Record<RoomName, number> = withCounts({
  hall: 1,
  dining: 1,
  kitchen: 1,
  bedroom: 2,
  bathroom: 1,
});

/** What each drafting tool is called on screen, for the "picked back up" hint. */
const CAD_TOOL_LABELS: Record<CadTool, string> = {
  select: "Select",
  draw_wall: "Wall",
  place_door: "Door",
  place_window: "Window",
  tag_room: "Room Tag",
  draw_stair: "Stair",
};

export default function Home() {
  const [plot, setPlot] = useState<PlotDims>(DEFAULT_PLOT);
  const [facing, setFacing] = useState<Facing>("N");
  const [counts, setCounts] = useState<Record<RoomName, number>>(DEFAULT_COUNTS);
  // Which building type the solver is packing. Swapping it swaps the space vocabulary, the
  // circulation hub and the rules posted before the solve — see lib/programs.ts.
  const [programKey, setProgramKey] = useState<ProgramKey>("residence");
  const program = getProgram(programKey);
  const [customDims, setCustomDims] = useState<Record<string, CustomDim>>({});
  const [customOpenings, setCustomOpenings] = useState<Record<string, RoomOpening[]>>({});
  const [customWallThickness, setCustomWallThickness] = useState<Record<string, number>>({});
  // Bowed wall faces, per room edge — lib/wallCurves.ts. The solver still packs rectangles; only
  // the face of a wall it placed bows.
  const [roomEdgeCurves, setRoomEdgeCurves] = useState<RoomEdgeCurves>({});
  // Thickness, height and rectangular cutouts, per wall — lib/wallEdits.ts. Keyed by room
  // instance id plus edge, the same pair the paint bands and the glazing use.
  const [wallEdits, setWallEdits] = useState<WallEdits>({});
  // What Ctrl+C picked up. A wall copies its geometry — thickness, height, outline and the holes
  // in it — which is the same shape for both kinds of wall, so a drawn wall's profile pastes onto
  // a solver one. Anything else copies the placed object itself.
  const [clipboard, setClipboard] = useState<
    { kind: "wall"; edit: WallEdit } | { kind: "object"; obj: PlacedCustomObject } | null
  >(null);
  // The abutting road width, in metres. G.O. Ms. 168 keys both the front setback and the height
  // ceiling off it, so it is an input the plan cannot be honest without — lib/compliance.ts.
  const [roadWidthM, setRoadWidthM] = useState<number>(DEFAULT_ROAD_WIDTH_M);
  // Setbacks derived from the bye-law rather than the old hardcoded 5/5/3/3 ft. Off puts the
  // fixed values back, for a plot whose rules this does not cover.
  const [autoSetback, setAutoSetback] = useState<boolean>(true);
  // Storeys the solver packs, ground included. The mix is split across them in the API and a
  // stair core is added to each — notes/decisions/single-storey-first.md, finally cashed in.
  const [floorsCount, setFloorsCount] = useState<number>(1);
  const [customWalls, setCustomWalls] = useState<CustomDrawnWall[]>([]);
  // Walk lines, not footprints. Solved into flights on read — see lib/stairPath.ts.
  const [drawnStairs, setDrawnStairs] = useState<DrawnStair[]>([]);
  const [customRoomZones, setCustomRoomZones] = useState<CustomRoomZone[]>([]);
  const [customObjects, setCustomObjects] = useState<PlacedCustomObject[]>([]);
  const [deletedBuiltinIds, setDeletedBuiltinIds] = useState<string[]>([]);
  const [placingItemType, setPlacingItemType] = useState<string | null>(null);
  const [placingRotationY, setPlacingRotationY] = useState<number>(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectInfo, setSelectedObjectInfo] = useState<SelectedObjectInfo | null>(null);
  /**
   * Drawn walls picked in 3D for combining. Separate from `selectedObjectInfo`, which holds one
   * object and is what everything else in orbit mode reads: combining needs several at once, and
   * teaching the whole picker about multiple selection to serve one panel is not worth it.
   */
  const [selectedRunWallIds, setSelectedRunWallIds] = useState<string[]>([]);
  const [runJoinError, setRunJoinError] = useState<string | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isRoomDimensionsOpen, setIsRoomDimensionsOpen] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [activeCadTool, setActiveCadTool] = useState<CadTool>("select");

  const [activeWallType, setActiveWallType] = useState<CustomWallType>("exterior");
  // Flight width the stair tool gives the next stair it draws.
  const [stairWidthIn, setStairWidthIn] = useState<number>(DEFAULT_STAIR_WIDTH_IN);
  // Blueprint alongside the 3D view rather than instead of it. `H` toggles it.
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  // Which pane owns the keyboard. Both Scene and Blueprint2DView bind their own window keydown,
  // so with both mounted one Enter would build two stairs and one Escape would cancel twice.
  // Whichever pane the pointer is over is the one that hears it — the rule a split CAD view has
  // to have, and the cheapest one that is never ambiguous.
  const [activePane, setActivePane] = useState<"3d" | "2d">("3d");
  const [mode, setMode] = useState<"orbit" | "walkthrough" | "blueprint">("orbit");

  // Only orbit has something to put the blueprint beside: in blueprint mode the 2D view already
  // is the window, and in walkthrough the point is to be inside the house, not looking at a plan.
  const splitActive = isSplitView && mode === "orbit";
  // The drone tour: exterior orbit, in through the door, room by room, out again.
  const [tourPlaying, setTourPlaying] = useState<boolean>(false);
  const [tourProgress, setTourProgress] = useState<{ atSec: number; totalSec: number } | null>(null);
  // Sessions open at night. A saved project still wins: the loader below reads `lightsOn` back,
  // so this is what a new build starts on, not an override of what someone chose last time.
  const [lightsOn, setLightsOn] = useState(false);
  const [furnished, setFurnished] = useState(true);
  const [materialConfig, setMaterialConfig] = useState<HouseMaterialConfig>(DEFAULT_MATERIAL_CONFIG);
  const [windowConfig, setWindowConfig] = useState<WindowConfig>(DEFAULT_WINDOW_CONFIG);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isModelBlueprintsOpen, setIsModelBlueprintsOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isWindowModalOpen, setIsWindowModalOpen] = useState(false);
  const [isDoorsWindowsDrawerOpen, setIsDoorsWindowsDrawerOpen] = useState(false);
  const [isAIFurnitureModalOpen, setIsAIFurnitureModalOpen] = useState(false);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(DEFAULT_GRAPHICS_SETTINGS);
  const [isGraphicsModalOpen, setIsGraphicsModalOpen] = useState(false);
  const [placingOpeningDef, setPlacingOpeningDef] = useState<OpeningItemDef | null>(null);
  /**
   * The tool that was put down, so it can be picked back up.
   *
   * "A tool" is three separate pieces of state here — a catalog piece being placed, a door or
   * window being placed, and the CAD drafting mode — and only one of them is ever armed at once.
   * Escape clears all three; this remembers which one had been holding.
   */
  const [lastTool, setLastTool] = useState<
    | { kind: "item"; type: string; rotationY: number }
    | { kind: "opening"; def: OpeningItemDef }
    | { kind: "cad"; tool: CadTool }
    | null
  >(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [isUpgraded, setIsUpgraded] = useState(true);
  const [isRaytracing, setIsRaytracing] = useState(false);
  const [isBOQModalOpen, setIsBOQModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isElevationsModalOpen, setIsElevationsModalOpen] = useState(false);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  const [isMoodboardModalOpen, setIsMoodboardModalOpen] = useState(false);
  const [isCeilingPlanModalOpen, setIsCeilingPlanModalOpen] = useState(false);
  // The automatic fit-out only exists as meshes; Scene measures it and hands the list back so
  // the FF&E schedule can count it. See Scene's onFurnitureInventory.
  const [builtinInventory, setBuiltinInventory] = useState<BuiltinFurnitureRecord[]>([]);
  const [isCustomWallBlendModalOpen, setIsCustomWallBlendModalOpen] = useState(false);
  const [isPlotShapeModalOpen, setIsPlotShapeModalOpen] = useState(false);

  const handleSpawnAIFurniture = useCallback((placedObj: PlacedCustomObject) => {
    setCustomObjects((prev) => [...prev, placedObj]);
    setSelectedObjectId(placedObj.id);
    setSelectedObjectInfo({
      id: placedObj.id,
      name: placedObj.name,
      type: placedObj.type,
      x: placedObj.x,
      y: placedObj.y,
      z: placedObj.z,
      rotationY: placedObj.rotationY,
      colorHex: placedObj.colorHex,
      scale: placedObj.scale,
    });
  }, []);

  const handleSelectPlaceOpening = useCallback((def: OpeningItemDef | null) => {
    setPlacingOpeningDef(def);
    if (def) {
      setActiveCadTool(def.category === "door" ? "place_door" : "place_window");
    } else {
      setActiveCadTool("select");
    }
  }, []);

  const handleToggleLayoutLock = useCallback(() => {
    setIsLayoutLocked((prev) => !prev);
  }, []);

  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number } | null>(null);
  const [activeBlueprintName, setActiveBlueprintName] = useState<string | null>(null);

  // Load design state from LocalStorage on mount
  useEffect(() => {
    const data = loadProject();
    if (data) {
      if (data.plot) setPlot(data.plot);
      if (data.facing) setFacing(data.facing);
      // Before the counts, so the mix and the programme it belongs to are never out of step.
      setProgramKey(programOfSavedProject(data));
      if (data.counts) setCounts(data.counts);
      if (data.customDims) setCustomDims(data.customDims);
      if (data.customOpenings) setCustomOpenings(data.customOpenings);
      if (data.customWallThickness) setCustomWallThickness(data.customWallThickness);
      if (data.roomEdgeCurves) setRoomEdgeCurves(data.roomEdgeCurves);
      if (data.wallEdits) setWallEdits(data.wallEdits);
      if (typeof data.roadWidthM === "number") setRoadWidthM(data.roadWidthM);
      if (typeof data.autoSetback === "boolean") setAutoSetback(data.autoSetback);
      if (typeof data.floorsCount === "number") setFloorsCount(data.floorsCount);
      if (Array.isArray(data.customWalls)) setCustomWalls(data.customWalls);
      if (Array.isArray(data.drawnStairs)) setDrawnStairs(data.drawnStairs);
      if (Array.isArray(data.customRoomZones)) setCustomRoomZones(data.customRoomZones);
      if (Array.isArray(data.customObjects)) setCustomObjects(data.customObjects);
      if (Array.isArray(data.deletedBuiltinIds)) setDeletedBuiltinIds(data.deletedBuiltinIds);
      if (typeof data.lightsOn === "boolean") setLightsOn(data.lightsOn);
      if (typeof data.furnished === "boolean") setFurnished(data.furnished);
      if (data.materialConfig) setMaterialConfig(data.materialConfig);
      if (data.windowConfig) setWindowConfig(data.windowConfig);
      if (typeof data.activeFloor === "number") setActiveFloor(data.activeFloor);
      if (data.activeBlueprintName) setActiveBlueprintName(data.activeBlueprintName);
      if (data.savedAt) setLastSavedTime(data.savedAt);
    }
    setIsLoadedFromStorage(true);
  }, []);

  // Player location (5'5" perspective)
  const [player, setPlayer] = useState<PlayerTransform>({
    x: inchesToFeet(plot.widthIn) / 2,
    y: EYE_LEVEL_FT,
    z: inchesToFeet(plot.depthIn) / 2,
    yaw: Math.PI,
    pitch: 0,
    isSprinting: false,
    isCrouched: false,
    isMoving: false,
    lightsOn: false,
  });

  // Free text input — backend/ai/README.md. Pairs are held by room id, not by index, because
  // the mix is rebuilt from `counts` in ROOM_NAMES order and the model's indices would point at
  // the wrong rooms by the time the solver saw them.
  const [nearPairIds, setNearPairIds] = useState<NearPairIds[]>([]);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptUnsupported, setPromptUnsupported] = useState<string[]>([]);
  const [promptAssumed, setPromptAssumed] = useState<string[]>([]);
  // What an uploaded drawing did and did not become. Separate from promptAssumed: this is not a
  // default the person failed to give, it is what the solver did to their plan.
  const [planImageNotice, setPlanImageNotice] = useState<string | null>(null);

  const [activeMoveCmd, setActiveMoveCmd] = useState<string | null>(null);
  const [doorPrompt, setDoorPrompt] = useState<{ doorId: string; label: string; isOpen: boolean } | null>(null);
  const doorTriggerRef = useRef<(() => void) | null>(null);

  const roomListWithSpecs: RoomSpecIn[] = useMemo(() => {
    const list: RoomSpecIn[] = [];
    for (const name of ROOM_NAMES) {
      const count = counts[name] ?? 0;
      for (let c = 0; c < count; c++) {
        const id = `${name}_${c}`;
        const custom = customDims[id];
        // A tolerance makes it a band rather than a pin, and a zero on one axis means that axis
        // was never given and is left to the room catalog — see CustomDim in RoomCustomizer.tsx.
        const tol = custom?.tolFt ? custom.tolFt * 12 : 0;
        const wIn = custom && custom.wFt > 0 ? custom.wFt * 12 : undefined;
        const dIn = custom && custom.dFt > 0 ? custom.dFt * 12 : undefined;
        list.push({
          id,
          name,
          custom_w_in: tol ? undefined : wIn,
          custom_d_in: tol ? undefined : dIn,
          min_w_in: tol && wIn != null ? wIn - tol : undefined,
          max_w_in: tol && wIn != null ? wIn + tol : undefined,
          min_d_in: tol && dIn != null ? dIn - tol : undefined,
          max_d_in: tol && dIn != null ? dIn + tol : undefined,
        });
      }
    }
    return list;
  }, [counts, customDims]);

  // Resolved against the room list actually going to the solver, so a pair whose room has since
  // been deleted from the tray drops out instead of pointing at whatever took its place.
  const nearForSolver = useMemo(
    () => nearIndices(nearPairIds, roomListWithSpecs.map((r) => r.id ?? "")),
    [nearPairIds, roomListWithSpecs]
  );

  // What the bye-law requires for this plot on this road, and the setback actually in force.
  // The report is recomputed below once the solver has answered; this first pass only needs the
  // rule, which depends on the plot and the road, not on the rooms.
  const activeSetback = useMemo(
    () => (autoSetback ? assessCompliance(plot, [], roadWidthM).requiredSetback : DEFAULT_SETBACK),
    [plot, roadWidthM, autoSetback]
  );

  const {
    rooms: solvedRooms,
    quantities,
    meta,
    pending,
    error,
    staleBackend,
    moveRoom,
    resizeRoom,
    resetPositions,
    setRoomPositions,
    restoreRoomPositions,
  } = useSolve({
    plotWIn: plot.widthIn,
    plotDIn: plot.depthIn,
    facing,
    rooms: roomListWithSpecs,
    setback: activeSetback,
    program: programKey,
    cornerCutsIn: plot.cornerCutsIn,
    vertsIn: plot.vertsIn,
    edgeBulgeIn: plot.edgeBulgeIn,
    floors: floorsCount,
    near: nearForSolver,
  });

  // Read a sentence into a room mix. The model maps words onto the catalog; CP-SAT still does
  // every placement, and anything the catalog could not express is shown rather than dropped —
  // backend/ai/README.md.
  const applyPromptText = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || promptBusy) return;
    setPromptBusy(true);
    setPromptError(null);
    try {
      const plan = await requestAIPlan(text, programKey);
      setPlot({ widthIn: plan.plotWIn, depthIn: plan.plotDIn });
      setFacing(plan.facing);
      setFloorsCount(plan.floors);
      setCounts(withCounts(plan.counts as Record<RoomName, number>));
      setNearPairIds(plan.near);
      setPromptUnsupported(plan.unsupported);
      // A default the person never gave is a question, not an answer. Naming both the field and
      // the value used means they can correct it instead of discovering it in the 3D view.
      setPromptAssumed([
        ...(plan.assumedPlot
          ? [`plot size — using ${Math.round(plan.plotWIn / 12)}x${Math.round(plan.plotDIn / 12)} ft`]
          : []),
        ...(plan.assumedFacing ? ["facing — using north"] : []),
      ]);
      // A new mix is a new house. Drifting it towards where the last one's rooms sat is what
      // the drift objective is for and exactly wrong here.
      resetPositions();
    } catch (e) {
      setPromptError((e as Error).message);
    } finally {
      setPromptBusy(false);
    }
  }, [promptBusy, programKey, resetPositions]);

  // Read a photographed floor plan into a room mix. The model reads what is printed on the
  // drawing; CP-SAT still does every placement, so what comes back is a legal plan resembling the
  // upload rather than a tracing of it. `planImageNotice` is where that gets said out loud —
  // backend/ai/plan_from_image.md.
  const applyPlanImage = useCallback(
    async (file: File, note: string) => {
      if (promptBusy) return;
      setPromptBusy(true);
      setPromptError(null);
      setPlanImageNotice(null);
      try {
        const { base64, mediaType } = await readImageFile(file);
        const plan = await requestAIPlanFromImage(base64, mediaType, note.trim() || undefined);

        if (plan.counts && Object.keys(plan.counts).length === 0) {
          // The backend found no rooms, which is what it returns for an image that is not a floor
          // plan. Saying why beats applying an empty mix and blanking the viewport.
          setPromptUnsupported(plan.unsupported);
          setPromptError("No floor plan found in that image.");
          return;
        }

        setPlot({ widthIn: plan.plotWIn, depthIn: plan.plotDIn });
        setFacing(plan.facing);
        setFloorsCount(plan.floors);
        setCounts(withCounts(plan.counts as Record<RoomName, number>));
        setCustomDims(plan.customDims);
        setNearPairIds(plan.near);
        setPromptUnsupported(plan.unsupported);
        setPromptAssumed([
          ...(plan.assumedPlot
            ? [`plot size — using ${Math.round(plan.plotWIn / 12)}x${Math.round(plan.plotDIn / 12)} ft`]
            : []),
          ...(plan.assumedFacing ? ["facing — using north"] : []),
        ]);
        setPlanImageNotice(
          plan.readDimensions
            ? "Re-solved from your drawing, not traced from it. Room sizes are held within a foot of what was printed; setbacks and door reachability are enforced, so rooms will have moved."
            : "The drawing's room labels were read, but no dimensions were printed clearly enough to use. Sizes come from the room catalog."
        );
        // A new mix is a new house. Drifting it towards where the last one's rooms sat is what the
        // drift objective is for and exactly wrong here.
        resetPositions();
      } catch (e) {
        setPromptError((e as Error).message);
      } finally {
        setPromptBusy(false);
      }
    },
    [promptBusy, resetPositions]
  );

  // Read a photo of a house from outside: the facade is read, the plan and the interior are
  // generated. facadeSummary() is the sentence that says which is which, and it is not optional —
  // backend/ai/facade_from_image.py.
  const applyFacadePhoto = useCallback(
    async (file: File, note: string) => {
      if (promptBusy) return;
      setPromptBusy(true);
      setPromptError(null);
      setPlanImageNotice(null);
      try {
        const { base64, mediaType } = await readImageFile(file);
        // The plot is never read from a photograph — no scale reference, no north arrow. The
        // programme is sized to the plot the person already set.
        const plan = await requestAIFacade(
          base64,
          mediaType,
          plot.widthIn / 12,
          plot.depthIn / 12,
          note.trim() || undefined
        );

        if (Object.keys(plan.counts).length === 0) {
          setPromptUnsupported(plan.unsupported);
          setPromptError("No building found in that photo.");
          return;
        }

        setFloorsCount(plan.floors);
        setCounts(withCounts(plan.counts as Record<RoomName, number>));
        // A generated plan sets no per-room sizes: the catalog and the solver size every room.
        setCustomDims({});
        setMaterialConfig((current) => applyFacade(current, plan));
        setNearPairIds([]);
        setPromptUnsupported(plan.unsupported);
        setPromptAssumed([]);
        setPlanImageNotice(facadeSummary(plan));
        resetPositions();
      } catch (e) {
        setPromptError((e as Error).message);
      } finally {
        setPromptBusy(false);
      }
    },
    [promptBusy, plot.widthIn, plot.depthIn, resetPositions]
  );

  // ---- Undo and redo ---------------------------------------------------------------------
  const captureDesign = useCallback(
    (): DesignSnapshot => ({
      plot,
      facing,
      programKey,
      counts,
      customDims,
      customOpenings,
      customWallThickness,
      roomEdgeCurves,
      wallEdits,
      roadWidthM,
      autoSetback,
      floorsCount,
      customWalls,
      drawnStairs,
      customRoomZones,
      customObjects,
      deletedBuiltinIds,
      materialConfig,
      windowConfig,
      roomPositions: Object.fromEntries(
        solvedRooms.map((r, i) => [
          roomListWithSpecs[i]?.id ?? `${r.name}_${i}`,
          {
            xFt: inchesToFeet(r.x_in - (meta?.envelope_origin_x_in ?? 0)),
            yFt: inchesToFeet(r.y_in - (meta?.envelope_origin_z_in ?? 0)),
          },
        ])
      ),
    }),
    [
      plot,
      facing,
      programKey,
      counts,
      customDims,
      customOpenings,
      customWallThickness,
      roomEdgeCurves,
      wallEdits,
      roadWidthM,
      autoSetback,
      floorsCount,
      customWalls,
      drawnStairs,
      customRoomZones,
      customObjects,
      deletedBuiltinIds,
      materialConfig,
      windowConfig,
      solvedRooms,
      roomListWithSpecs,
      meta,
    ]
  );

  const restoreDesign = useCallback(
    (snapshot: DesignSnapshot) => {
      setPlot(snapshot.plot);
      setFacing(snapshot.facing);
      setProgramKey(snapshot.programKey);
      setCounts(snapshot.counts);
      setCustomDims(snapshot.customDims);
      setCustomOpenings(snapshot.customOpenings);
      setCustomWallThickness(snapshot.customWallThickness);
      setRoomEdgeCurves(snapshot.roomEdgeCurves);
      setWallEdits(snapshot.wallEdits);
      setRoadWidthM(snapshot.roadWidthM);
      setAutoSetback(snapshot.autoSetback);
      setFloorsCount(snapshot.floorsCount);
      setCustomWalls(snapshot.customWalls);
      setDrawnStairs(snapshot.drawnStairs ?? []);
      setCustomRoomZones(snapshot.customRoomZones);
      setCustomObjects(snapshot.customObjects);
      setDeletedBuiltinIds(snapshot.deletedBuiltinIds);
      setMaterialConfig(snapshot.materialConfig);
      setWindowConfig(snapshot.windowConfig);
      // The restored document may not contain whatever was selected or half-placed, and an
      // inspector describing an object that no longer exists is worse than no selection.
      setSelectedObjectId(null);
      setSelectedObjectInfo(null);
      setPlacingItemType(null);
      // Entries pushed before the first solve answered carry no layout. Replaying an empty map
      // would throw away the packing rather than restore it.
      if (Object.keys(snapshot.roomPositions).length > 0) {
        restoreRoomPositions(snapshot.roomPositions);
      }
    },
    [restoreRoomPositions]
  );

  const history = useDesignHistory(captureDesign, restoreDesign);

  // The memory of the last tool lasts only until the document changes.
  //
  // That is the whole of the rule that lets Ctrl+Z mean two things without being unpredictable:
  // right after Escape put a tool down, nothing has been edited, so Ctrl+Z can only sensibly
  // mean "put that back". The moment anything is drawn, placed or resized, there is a real edit
  // to undo and Ctrl+Z goes back to undoing it. `captureDesign` is rebuilt whenever any part of
  // the document does, so its identity is exactly that signal.
  useEffect(() => {
    setLastTool(null);
  }, [captureDesign]);
  const { record: recordHistory, commitBefore: commitHistory, reset: resetHistory } = history;

  // The document is watched rather than instrumented at each mutation: an author adding a new
  // edit tomorrow gets undo for it without knowing this exists, and no call site can forget.
  // Room geometry is the one exception — see lib/designHistory.ts.
  const prevDocRef = useRef<DesignSnapshot | null>(null);
  useEffect(() => {
    const next = captureDesign();
    const prev = prevDocRef.current;
    prevDocRef.current = next;
    // No prev is the first settle: record it anyway, to give the history a baseline to undo back
    // to. A re-run with nothing changed — React runs mount effects twice in development — gets
    // no label and no entry.
    const label = prev === null ? "Edit" : describeDesignChange(prev, next);
    if (label) recordHistory(label);
    // Intentionally not keyed on captureDesign: it also closes over the solved rooms, which
    // change on their own every time the solver answers, and a re-solve is not an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plot,
    facing,
    programKey,
    counts,
    customDims,
    customOpenings,
    customWallThickness,
    roomEdgeCurves,
    wallEdits,
    roadWidthM,
    autoSetback,
    floorsCount,
    customWalls,
    drawnStairs,
    customRoomZones,
    customObjects,
    deletedBuiltinIds,
    materialConfig,
    windowConfig,
    recordHistory,
  ]);

  // A loaded project is where history starts, not something to undo back out of.
  useEffect(() => {
    if (isLoadedFromStorage) resetHistory();
  }, [isLoadedFromStorage, resetHistory]);

  // Rooms are solver output, so moving one changes nothing the watcher can see.
  const handleRoomMove = useCallback(
    (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => {
      commitHistory("Move room");
      moveRoom(roomIndex, targetPlotXIn, targetPlotYIn);
    },
    [commitHistory, moveRoom]
  );

  // Why the viewport is empty, when it is. Every one of these used to render as a blank screen
  // that looks like a rendering bug and is not one: a backend that predates a space in the mix
  // rejects it by name and returns nothing at all. `staleBackend` already existed for the
  // related case and was computed but never shown.
  // How many storeys came back, not how many were asked for. The offline engine packs one floor
  // whatever the request said (lib/solve.ts), and a floor badge that reads "solved" over a floor
  // nobody solved is the kind of claim this app does not make.
  const solvedFloorCount = useMemo(
    () => new Set(solvedRooms.map((r) => r.floor ?? 0)).size || 1,
    [solvedRooms]
  );

  // Whether the app is being used on the machine that runs the solver, or on a deployed site.
  //
  // The advice for an unreachable backend is completely different in the two cases and only one
  // of them was ever written down. "Start the backend (./dev.ps1)" is the right thing to tell a
  // developer and useless to someone on a deployed URL, where there is no terminal to start it
  // in — the backend has to be hosted somewhere the browser can reach, and
  // NEXT_PUBLIC_SOLVER_URL has to point at it. Read in an effect rather than during render so a
  // prerendered build and its hydration agree.
  const [isLocalDev, setIsLocalDev] = useState(true);
  useEffect(() => {
    setIsLocalDev(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname));
  }, []);

  const backendAdvice = isLocalDev
    ? "Start the backend (./dev.ps1) and reload."
    : "This site is deployed without one: the browser is trying http://localhost:8000, which is your own machine. Host the FastAPI backend and point NEXT_PUBLIC_SOLVER_URL at it, over HTTPS.";

  const requestedSpaceCount = roomListWithSpecs.length;
  const solverNotice: { title: string; detail: string } | null = (() => {
    if (pending) return null;
    if (error) {
      return {
        title: "The solver rejected the request",
        detail: `${error}. ${
          isLocalDev ? "Check the backend terminal, then reload." : backendAdvice
        }`,
      };
    }
    // Asked for a duplex, got a bungalow. Silent before this: the offline engine packs one floor
    // whatever the request said, and a backend started before multi-storey ignores `floors`
    // outright, so a duplex blueprint came back as a single storey with nothing said about it.
    if (floorsCount > 1 && solvedRooms.length > 0 && solvedFloorCount < floorsCount) {
      const offline = meta?.status === OFFLINE_ESTIMATE_STATUS;
      return {
        title: `Asked for ${floorsCount === 2 ? "G+1" : `G+${floorsCount - 1}`}, got ${
          solvedFloorCount === 1 ? "one storey" : `${solvedFloorCount} storeys`
        }`,
        detail: offline
          ? `The offline engine packs the ground floor only - it has no half-planes, no stair core and no per-floor packing, and it is not a solver at all. ${backendAdvice}`
          : "The backend answered with fewer storeys than were asked for, which means it predates multi-storey solving. Restart it so it picks up the current code.",
      };
    }

    const unknown = meta?.unknown_room_names ?? [];
    if (unknown.length > 0) {
      return {
        title: `The ${program.label} programme does not have ${unknown.length} of these spaces`,
        detail: `It rejected ${unknown.join(", ")}. The mix belongs to a different building type - switch the building type to the one these spaces come from, or restart the backend if it predates them.`,
      };
    }
    if (requestedSpaceCount > 0 && solvedRooms.length === 0) {
      // "Remove a space" on its own leaves the user guessing which one. The backend re-solves
      // without the largest spaces until the mix packs and sends the names back, so say them.
      const drop = meta?.drop_to_fit ?? [];
      const fits = requestedSpaceCount - drop.length;
      return {
        title: "The solver returned no layout",
        detail:
          drop.length > 0
            ? `This plot fits ${fits} of your ${requestedSpaceCount} spaces. Remove ${drop
                .map((name) => ROOM_LABELS[name as RoomName] ?? name)
                .join(" and ")}, or enlarge the plot.`
            : `Status ${meta?.status ?? "unknown"}. The programme may not fit this plot - remove a space or enlarge the plot.`,
      };
    }
    if (staleBackend) {
      return {
        title: "The solver returned no doors or windows",
        detail:
          "The backend is out of date, so the house has solid walls and no way in. Restart it to get openings.",
      };
    }
    return null;
  })();

  // Paint bands on the wall the user has selected, and the writer that changes them. Keyed by
  // the room instance id plus the edge, the same pair the wall inspector already works in.
  const selectedWallBands = useMemo(() => {
    const info = selectedObjectInfo;
    if (!info?.isWall || info.roomIndex == null || !info.edge) return undefined;
    const room = solvedRooms[info.roomIndex];
    if (!room) return undefined;
    return resolveWallBandScheme(
      materialConfig,
      roomInstanceId(solvedRooms, info.roomIndex),
      room.name as RoomName,
      info.edge
    );
  }, [selectedObjectInfo, solvedRooms, materialConfig]);

  const handleChangeSelectedWallBands = useCallback(
    (scheme: WallBandScheme | null) => {
      const info = selectedObjectInfo;
      if (!info?.isWall || info.roomIndex == null || !info.edge) return;
      const room = solvedRooms[info.roomIndex];
      if (!room) return;
      const key = wallBandKey(roomInstanceId(solvedRooms, info.roomIndex), info.edge);
      setMaterialConfig((prev) => {
        const next = { ...(prev.wallBands ?? {}) };
        // Clearing drops the override so the wall falls back to its room, then the building.
        if (scheme === null) delete next[key];
        else next[key] = scheme;
        return { ...prev, wallBands: next };
      });
    },
    [selectedObjectInfo, solvedRooms]
  );

  const handleApplyCustomWallBlend = useCallback(
    (scheme: WallBandScheme, scope: "wall" | "room" | "global") => {
      const info = selectedObjectInfo;
      if (scope === "wall" && info?.isWall && info.roomIndex != null && info.edge) {
        handleChangeSelectedWallBands(scheme);
      } else if (scope === "room" && info?.isWall && info.roomIndex != null) {
        const room = solvedRooms[info.roomIndex];
        if (room) {
          setMaterialConfig((prev) => ({
            ...prev,
            roomWallBands: {
              ...(prev.roomWallBands ?? {}),
              [room.name as RoomName]: scheme,
            },
          }));
        }
      } else {
        setMaterialConfig((prev) => ({
          ...prev,
          globalWallBands: scheme,
          wallBands: {},
          roomWallBands: {},
        }));
      }
    },
    [selectedObjectInfo, solvedRooms, handleChangeSelectedWallBands]
  );

  // Glazing on the selected wall. Same key and same resolution as the paint bands — a wall is
  // either glazed or painted, never both.
  const selectedWallGlazing = useMemo(() => {
    const info = selectedObjectInfo;
    if (!info?.isWall || info.roomIndex == null || !info.edge) return undefined;
    const room = solvedRooms[info.roomIndex];
    if (!room) return undefined;
    return resolveWallGlazing(
      materialConfig,
      wallBandKey(roomInstanceId(solvedRooms, info.roomIndex), info.edge),
      room.name as RoomName
    );
  }, [selectedObjectInfo, solvedRooms, materialConfig]);

  const handleChangeSelectedWallGlazing = useCallback(
    (glazing: WallGlazing | null) => {
      const info = selectedObjectInfo;
      if (!info?.isWall || info.roomIndex == null || !info.edge) return;
      const room = solvedRooms[info.roomIndex];
      if (!room) return;
      const key = wallBandKey(roomInstanceId(solvedRooms, info.roomIndex), info.edge);
      setMaterialConfig((prev) => {
        const next = { ...(prev.wallGlazing ?? {}) };
        if (glazing === null) delete next[key];
        else next[key] = glazing;
        // Glazing wins over a paint band on the same wall; leaving the band would mean the
        // renderer picks one and the panel shows the other.
        const bands = { ...(prev.wallBands ?? {}) };
        if (glazing?.wall) delete bands[key];
        return { ...prev, wallGlazing: next, wallBands: bands };
      });
    },
    [selectedObjectInfo, solvedRooms]
  );

  // Covers the solved seating actually holds at the laid-out table pitch. The number a cafe
  // owner cares about first, and the one a labelled rectangle does not give them.
  const coverCount = useMemo(() => {
    if (program.key !== "cafe") return 0;
    return solvedRooms.reduce((total, r) => {
      if (r.name !== "seating" && r.name !== "lounge") return total;
      return total + seatingCapacity(r.w_in / 12, r.d_in / 12).seats;
    }, 0);
  }, [program.key, solvedRooms]);

  // Apply a curated or imported model blueprint to instantly configure and construct the house in 2D & 3D
  const handleRoomResize = useCallback(
    (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number, targetWIn: number, targetDIn: number) => {
      if (roomIndex < 0 || roomIndex >= solvedRooms.length) return;
      let curr = 0;
      let targetId = `room_${roomIndex}`;
      for (const name of ROOM_NAMES) {
        const count = counts[name] ?? 0;
        for (let c = 0; c < count; c++) {
          if (curr === roomIndex) {
            targetId = `${name}_${c}`;
            break;
          }
          curr++;
        }
        if (targetId !== `room_${roomIndex}`) break;
      }

      setCustomDims((prev) => ({
        ...prev,
        [targetId]: {
          wFt: Math.round((targetWIn / 12) * 10) / 10,
          dFt: Math.round((targetDIn / 12) * 10) / 10,
        },
      }));
      resizeRoom(roomIndex, targetPlotXIn, targetPlotYIn, targetWIn, targetDIn);
    },
    [solvedRooms, counts, resizeRoom]
  );

  const [isSimulatingPrompt, setIsSimulatingPrompt] = useState(false);

  const handlePromptToSimulate = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;
      setIsSimulatingPrompt(true);

      // The prompt parser only speaks the residence vocabulary — "2bhk", "store", "dining".
      // Running it while the cafe programme is active sent hall, kitchen and bedroom to a
      // solver whose active programme rejects them all, which returns NO_INPUT and a blank
      // viewport. Switch the programme first, exactly as handleApplyModelBlueprint() does,
      // rather than through handleChangeProgram(), which would reset the mix we are about
      // to write.
      if (programKey !== "residence") {
        setProgramKey("residence");
        setCustomObjects([]);
        setPlacingItemType(null);
        setPlacingRotationY(0);
      }

      try {
        const apiRes = await solvePromptApi(promptText);

        if (apiRes && apiRes.data) {
          const { plot: plotData, rooms: roomData } = apiRes.data;
          setPlot({
            widthIn: plotData.w_in,
            depthIn: plotData.d_in,
          });
          setFacing(plotData.facing as Facing);

          const newCounts: Record<RoomName, number> = withCounts({});
          for (const r of roomData) {
            const name = r.name.toLowerCase() as RoomName;
            if (name in newCounts) {
              newCounts[name] = (newCounts[name] || 0) + 1;
            }
          }
          setCounts(newCounts);
          setCustomDims({});
          setCustomWalls([]);
          setCustomRoomZones([]);
          setDeletedBuiltinIds([]);
          setSelectedObjectId(null);
          setSelectedObjectInfo(null);
          setActiveBlueprintName(null);

          if (roomData.length > 0) {
            setRoomPositions(
              roomData.map((r: any) => ({
                name: r.name,
                floor: 0,
                x_in: r.x_in,
                y_in: r.y_in,
                w_in: r.w_in,
                d_in: r.d_in,
                wall_thickness_in: r.wall_thickness_in ?? 5,
                habitable: r.habitable ?? true,
                wet: r.wet ?? false,
                openings: r.openings ?? [],
              }))
            );
          }
        } else {
          const parsed = parsePromptClient(promptText);
          setPlot({
            widthIn: parsed.plotWIn,
            depthIn: parsed.plotDIn,
          });
          setFacing(parsed.facing);
          setCounts(parsed.counts);
          setCustomDims({});
          setCustomWalls([]);
          setCustomRoomZones([]);
          setDeletedBuiltinIds([]);
          setSelectedObjectId(null);
          setSelectedObjectInfo(null);
          setActiveBlueprintName(null);
          resetPositions();
        }

        setMode("walkthrough");
      } catch (err) {
        console.error("Prompt simulation error:", err);
      } finally {
        setIsSimulatingPrompt(false);
      }
    },
    [setRoomPositions, resetPositions, programKey]
  );

  const handleApplyModelBlueprint = (
    bp: ModelBlueprint,
    targetMode: "blueprint" | "orbit" | "walkthrough" = "blueprint") => {
    // A cafe plan carries cafe spaces. Applying it while the residence programme is active
    // would send `seating` and `counter` to a solver that rejects them as unknown, so switch
    // the programme first — and do it here rather than through handleChangeProgram(), which
    // resets the mix to the programme default and would clobber the plan we are applying.
    const bpProgram = bp.program ?? "residence";
    if (bpProgram !== programKey) {
      setProgramKey(bpProgram);
      setCustomObjects([]);
      setPlacingItemType(null);
      setPlacingRotationY(0);
    }

    if (bp.customPositions) {
      setRoomPositions(bp.customPositions);
    } else {
      resetPositions();
    }
    setActiveBlueprintName(bp.name);
    setPlot({
      widthIn: feetToInches(bp.plotWidthFt),
      depthIn: feetToInches(bp.plotDepthFt),
    });
    setFacing(bp.facing);
    // Finishes the plan is drawn with, laid over the current config rather than replacing it, so
    // a plan that names only a wall colour does not silently reset every floor in the house.
    if (bp.materialConfig) {
      setMaterialConfig((prev) => ({ ...prev, ...bp.materialConfig }));
    }
    // A duplex plan is a G+1 plan; a single-storey one has to put the storeys back, or the last
    // duplex applied would leave every plan after it two floors tall.
    setFloorsCount(bp.floors ?? 1);
    setCounts(withCounts(bp.counts));
    setCustomDims(bp.customDims);
    setCustomOpenings(bp.customOpenings ?? {});
    setCustomWallThickness(bp.customWallThickness ?? {});
    // No blueprint carries wall cutouts, so applying one has to clear the last plan's — a hole
    // is cut in a named wall of a named room, and the next plan's room of that name is a
    // different wall in a different place.
    setWallEdits({});
    setCustomWalls([]);
    setCustomRoomZones([]);
    setDeletedBuiltinIds([]);
    setSelectedObjectId(null);
    setSelectedObjectInfo(null);
    setActiveFloor(0);
    setFurnished(true);

    if (bp.id === "parisian_haute_penthouse") {
      setMaterialConfig({
        globalFloor: "french_chevron_oak",
        globalWallColor: "arctic_white",
        globalWallTexture: "boiserie_paneling",
        roomFloors: {
          hall: "french_chevron_oak",
          kitchen: "marquina_black",
          bedroom: "french_chevron_oak",
          dining: "french_chevron_oak",
        },
        roomWallColors: {
          hall: "arctic_white",
          bedroom: "warm_alabaster",
          kitchen: "arctic_white",
          dining: "arctic_white",
        },
        roomWallTextures: {},
      });
      setCustomObjects([
        {
          id: `custom_fp_${Date.now()}`,
          type: "wall_fireplace_bookshelf",
          name: "Haute Fireplace & Bookshelf Wall",
          x: 0,
          y: 0,
          z: -6,
          rotationY: 0,
          scale: 1.0,
        },
        {
          id: `custom_sofa_${Date.now()}`,
          type: "sofa_boucle_curved_set",
          name: "Haute Bouclé Curved Living Set",
          x: 0,
          y: 0,
          z: 2,
          rotationY: 0,
          scale: 1.0,
        },
        {
          id: `custom_dining_${Date.now()}`,
          type: "dining_table_nero_marquina",
          name: "10-Seater Nero Marquina Dining Set",
          x: 10,
          y: 0,
          z: -2,
          rotationY: Math.PI / 2,
          scale: 1.0,
        },
        {
          id: `custom_planter_${Date.now()}`,
          type: "partition_planter_cacti",
          name: "Indoor Architectural Planter Divider",
          x: 4,
          y: 0,
          z: -4,
          rotationY: Math.PI / 2,
          scale: 1.0,
        },
        {
          id: `custom_kitchen_${Date.now()}`,
          type: "kitchen_walnut_wall",
          name: "Floor-to-Ceiling Smoked Walnut Kitchen Wall",
          x: 10,
          y: 0,
          z: 8,
          rotationY: Math.PI,
          scale: 1.0,
        },
      ]);
    } else {
      setCustomObjects([]);
    }

    setMode(targetMode);
  };

  // Switching building type restarts the programme: the mix, the custom sizes and the placed
  // furniture all belong to the old vocabulary, and a cafe carrying a bedroom's dimensions is
  // not a smaller edit than starting clean.
  const handleChangeProgram = useCallback(
    (next: ProgramKey) => {
      if (next === programKey) return;
      const nextProgram = getProgram(next);
      setProgramKey(next);
      setCounts(defaultCounts(nextProgram));
      setCustomDims({});
      setCustomOpenings({});
      setCustomObjects([]);
      setDeletedBuiltinIds([]);
      setSelectedObjectId(null);
      setSelectedObjectInfo(null);
      // An armed item from the old rail no longer exists in the new one.
      setPlacingItemType(null);
      setPlacingRotationY(0);
      setActiveBlueprintName(nextProgram.label);
      resetPositions();
    },
    [programKey, resetPositions]
  );

  // Start From Scratch Blank Canvas Mode: Clears automated pre-built rooms to allow 100% custom CAD drafting
  const handleStartFromScratch = useCallback(() => {
    resetPositions();
    setActiveBlueprintName("Custom Freehand Draft");
    setCounts(withCounts({}));
    setCustomDims({});
    setCustomOpenings({});
    setCustomWallThickness({});
    setWallEdits({});
    setCustomObjects([]);
    setActiveCadTool("draw_wall");
    setMode("blueprint");
  }, [resetPositions]);

  // Reset entire design to pristine defaults
  const handleResetDesign = useCallback(() => {
    if (confirm("Reset entire design and start with default layout?")) {
      clearProject();
      setPlot(DEFAULT_PLOT);
      setFacing("N");
      setCounts(DEFAULT_COUNTS);
      setCustomDims({});
      setCustomOpenings({});
      setCustomWallThickness({});
      setWallEdits({});
      setCustomWalls([]);
      setCustomRoomZones([]);
      setCustomObjects([]);
      setActiveFloor(0);
      setActiveBlueprintName(null);
      setLastSavedTime(null);
      resetPositions();
    }
  }, [resetPositions]);

  // Debounced Auto-Save to localStorage on any state change
  useEffect(() => {
    if (!isLoadedFromStorage) return;
    const timeout = setTimeout(() => {
      const now = Date.now();
      const saved = saveProject({
        plot,
        facing,
        program: programKey,
        counts,
        customDims,
        customOpenings,
        customWallThickness,
        roomEdgeCurves,
        wallEdits,
        roadWidthM,
        autoSetback,
        floorsCount,
        customWalls,
        customRoomZones,
        customObjects,
        deletedBuiltinIds,
        lightsOn,
        furnished,
        materialConfig,
        windowConfig,
        activeFloor,
        activeBlueprintName,
        savedAt: now,
      });
      if (saved) setLastSavedTime(now);
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    isLoadedFromStorage,
    plot,
    facing,
    programKey,
    counts,
    customDims,
    customOpenings,
    customWallThickness,
    customWalls,
    customRoomZones,
    customObjects,
    deletedBuiltinIds,
    lightsOn,
    furnished,
    materialConfig,
    windowConfig,
    activeFloor,
    activeBlueprintName,
  ]);

  // Merge custom door / window openings and wall thicknesses into solved rooms
  const rooms = useMemo(() => {
    return solvedRooms.map((room, idx) => {
      const spec = roomListWithSpecs[idx];
      const id = spec?.id || `${room.name}_${idx}`;
      const customOps = customOpenings[id];
      const customThick = customWallThickness[id];
      return {
        ...room,
        wall_thickness_in: customThick !== undefined ? customThick : room.wall_thickness_in,
        openings: customOps !== undefined ? customOps : room.openings,
      };
    });
  }, [solvedRooms, customOpenings, customWallThickness, roomListWithSpecs]);

  // The wall the user clicked in 3D, in the shape the inspector wants.
  //
  // There are two kinds and they store this differently. A wall the solver placed has a room and
  // an edge, keeps its overrides in `wallEdits`, and its length is the room's. A wall the user
  // drew has neither, keeps thickness and height on itself, and owns its own length — its holes
  // are already expressible as openings of the kind that draws no leaf. The panel is handed the
  // same four numbers either way.
  const selectedWall = useMemo(() => {
    const info = selectedObjectInfo;
    if (!info?.isWall) return null;

    if (info.isCustomWall) {
      const wall = customWalls.find((w) => w.id === info.id);
      if (!wall) return null;
      const cfg = WALL_TYPE_CONFIGS[wall.wallType];
      const lenIn = Math.hypot(wall.endXIn - wall.startXIn, wall.endYIn - wall.startYIn);
      return {
        kind: "custom" as const,
        wallId: wall.id,
        title: cfg?.name ?? `${wall.wallType} Wall`,
        subtitle: "Drawn wall",
        runFt: lenIn / 12,
        defaultThicknessIn: cfg?.thicknessIn ?? 9,
        edit: {
          thicknessIn: wall.thicknessIn,
          heightIn: Math.round((wall.heightFt ?? cfg?.defaultHeightFt ?? WALL_HEIGHT_FT) * 12),
          profile: wall.profile ?? "square",
          cutouts: (wall.openings ?? [])
            .filter((o) => o.kind === "opening")
            .map((o) => ({
              id: o.id,
              shape: o.shape,
              offsetIn: o.offsetIn,
              sillIn: o.sillIn ?? 0,
              widthIn: o.widthIn,
              heightIn: o.heightIn,
            })),
        } as WallEdit,
        curveIn: wall.curveBulgeIn ?? 0,
      };
    }

    if (info.roomIndex == null || !info.edge) return null;
    const room = rooms[info.roomIndex];
    if (!room) return null;
    const isEW = info.edge === "E" || info.edge === "W";
    const roomId = roomInstanceId(solvedRooms, info.roomIndex);
    const key = wallBandKey(roomId, info.edge);
    return {
      kind: "room" as const,
      roomIndex: info.roomIndex,
      edge: info.edge,
      key,
      roomId,
      title: `${edgeName(info.edge)} Wall`,
      subtitle: ROOM_LABELS[room.name as RoomName] ?? room.name,
      // An N or S wall runs along the room's width; an E or W wall along its depth.
      runFt: inchesToFeet(isEW ? room.d_in : room.w_in),
      isEW,
      defaultThicknessIn: room.wall_thickness_in ?? 4.5,
      edit: wallEdits[key],
      lengthNote: "Length belongs to the room — this resizes it and re-solves.",
      curveIn: roomEdgeCurves[roomId]?.[info.edge] ?? 0,
      // Same rule the room customiser posts: joinery on a bowed wall is a problem this does not
      // solve, so the control refuses rather than quietly straightening the wall to fit a door.
      curveBlocked: (room.openings ?? []).some((o) => o.edge === info.edge)
        ? "This wall carries a door or window, so it cannot be bowed."
        : undefined,
    };
  }, [selectedObjectInfo, rooms, solvedRooms, customWalls, wallEdits, roomEdgeCurves]);

  const handleChangeSelectedWallEdit = useCallback(
    (next: WallEdit) => {
      const sel = selectedWall;
      if (!sel) return;

      if (sel.kind === "custom") {
        setCustomWalls((prev) =>
          prev.map((w) => {
            if (w.id !== sel.wallId) return w;
            // A hole is an opening with no leaf, so it round-trips through the wall's own
            // openings list. Doors and windows already on the wall are left untouched.
            const keep = (w.openings ?? []).filter((o) => o.kind !== "opening");
            const holes: CustomWallOpening[] = (next.cutouts ?? []).map((c) => ({
              id: c.id,
              kind: "opening",
              shape: c.shape,
              offsetIn: Math.round(c.offsetIn),
              widthIn: Math.round(c.widthIn),
              heightIn: Math.round(c.heightIn),
              sillIn: Math.round(c.sillIn),
            }));
            return {
              ...w,
              thicknessIn: next.thicknessIn ?? w.thicknessIn,
              heightFt: next.heightIn != null ? next.heightIn / 12 : w.heightFt,
              profile: next.profile ?? w.profile,
              openings: [...keep, ...holes],
            };
          })
        );
        return;
      }

      setWallEdits((prev) => {
        const merged = { ...prev };
        // An entry that overrides nothing is dropped, so the wall falls back to its room rather
        // than carrying an empty object around in every save.
        if (isEmptyWallEdit(next)) delete merged[sel.key];
        else merged[sel.key] = next;
        return merged;
      });
    },
    [selectedWall]
  );

  const handleChangeSelectedWallLength = useCallback(
    (deltaFt: number) => {
      const sel = selectedWall;
      if (!sel) return;

      // A drawn wall owns its length: the far end slides along the line the wall already runs on,
      // so the wall keeps its start point and its direction. Integer inches, per [[integer-inches]].
      if (sel.kind === "custom") {
        setCustomWalls((prev) =>
          prev.map((w) => {
            if (w.id !== sel.wallId) return w;
            const dx = w.endXIn - w.startXIn;
            const dy = w.endYIn - w.startYIn;
            const len = Math.hypot(dx, dy);
            if (len < 1) return w;
            const nextLen = Math.max(12, len + deltaFt * 12);
            return {
              ...w,
              endXIn: Math.round(w.startXIn + (dx / len) * nextLen),
              endYIn: Math.round(w.startYIn + (dy / len) * nextLen),
            };
          })
        );
        return;
      }

      // A solver wall's length is the room's, so this resizes the room and the plan re-packs.
      const room = rooms[sel.roomIndex];
      if (!room) return;
      const current = customDims[sel.roomId] ?? {
        wFt: Math.round(inchesToFeet(room.w_in) * 10) / 10,
        dFt: Math.round(inchesToFeet(room.d_in) * 10) / 10,
      };
      const grown = Math.max(4, (sel.isEW ? current.dFt : current.wFt) + deltaFt);
      setCustomDims({
        ...customDims,
        [sel.roomId]: sel.isEW ? { ...current, dFt: grown } : { ...current, wFt: grown },
      });
    },
    [selectedWall, rooms, customDims]
  );

  // Bowing the wall in plan. Both kinds could already do this — a room edge through the room
  // customiser, a drawn wall through the 2D inspector — but neither was reachable from the wall
  // you had just clicked in 3D.
  const handleChangeSelectedWallCurve = useCallback(
    (deltaIn: number) => {
      const sel = selectedWall;
      if (!sel) return;

      if (sel.kind === "custom") {
        setCustomWalls((prev) =>
          prev.map((w) => {
            if (w.id !== sel.wallId) return w;
            const nextBulge = Math.max(
              -MAX_BULGE_IN,
              Math.min(MAX_BULGE_IN, (w.curveBulgeIn ?? 0) + deltaIn)
            );
            return { ...w, curveBulgeIn: nextBulge, isCurved: Math.abs(nextBulge) > 1 };
          })
        );
        return;
      }

      setRoomEdgeCurves((prev) => {
        const forRoom = { ...(prev[sel.roomId] ?? {}) };
        const next = Math.max(
          -MAX_BULGE_IN,
          Math.min(MAX_BULGE_IN, (forRoom[sel.edge] ?? 0) + deltaIn)
        );
        if (next === 0) delete forRoom[sel.edge];
        else forRoom[sel.edge] = next;
        return { ...prev, [sel.roomId]: forRoom };
      });
    },
    [selectedWall]
  );

  const handleCopySelection = useCallback(() => {
    if (selectedWall) {
      setClipboard({ kind: "wall", edit: selectedWall.edit ?? {} });
      return;
    }
    const obj = customObjects.find((o) => o.id === selectedObjectId);
    if (obj) setClipboard({ kind: "object", obj });
  }, [selectedWall, customObjects, selectedObjectId]);

  const handlePasteSelection = useCallback(() => {
    if (!clipboard) return;

    if (clipboard.kind === "wall") {
      // Needs somewhere to land. Pasting a wall onto nothing is not an error worth reporting,
      // it just does not apply.
      if (!selectedWall) return;
      handleChangeSelectedWallEdit({
        ...clipboard.edit,
        // Fresh ids, or the two walls would name their holes the same thing — and on a drawn
        // wall a cutout id is an opening id, which the renderer keys its joinery by.
        cutouts: (clipboard.edit.cutouts ?? []).map((c) => ({
          ...c,
          id: `cut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        })),
      });
      return;
    }

    // A pasted object lands beside the original rather than inside it, so it is visible and
    // draggable straight away instead of z-fighting with what it was copied from.
    const copy: PlacedCustomObject = {
      ...clipboard.obj,
      id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: clipboard.obj.x + 1.5,
      z: clipboard.obj.z + 1.5,
    };
    setCustomObjects((prev) => [...prev, copy]);
    setSelectedObjectId(copy.id);
    setSelectedObjectInfo({
      id: copy.id,
      name: copy.name,
      type: copy.type,
      isBuiltin: false,
      x: copy.x,
      y: 0,
      z: copy.z,
      rotationY: copy.rotationY,
    });
  }, [clipboard, selectedWall, handleChangeSelectedWallEdit]);

  const buildableW = useMemo(() => buildableWidthIn(plot, facing, activeSetback), [plot, facing, activeSetback]);
  const buildableD = useMemo(() => buildableDepthIn(plot, facing, activeSetback), [plot, facing, activeSetback]);

  // Coverage, achieved FAR and the rule behind them. One floor: the solver packs one, and
  // claiming a FAR for storeys it never placed would be the same lie as the floor selector.
  const compliance = useMemo(
    () => assessCompliance(plot, solvedRooms, roadWidthM),
    [plot, solvedRooms, roadWidthM]
  );

  // Real-time room detection
  const detected = useMemo(() => {
    return detectCurrentRoom(player.x, player.z, rooms);
  }, [player.x, player.z, rooms]);

  const currentRoom = detected?.room ?? null;
  const currentRoomIndex = detected?.index ?? null;

  // ESC shortcut to exit walkthrough
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "walkthrough") {
        setMode("orbit");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Teleport to (x, z) in world coordinates (feet)
  const handleTeleport = useCallback((x: number, z: number) => {
    setTeleportTarget({ x, z });
  }, []);

  const handleTeleportToRoomIndex = useCallback(
    (index: number) => {
      const targetRoom = rooms[index];
      if (!targetRoom) return;
      setTeleportTarget({
        x: inchesToFeet(targetRoom.x_in + targetRoom.w_in / 2),
        z: inchesToFeet(targetRoom.y_in + targetRoom.d_in / 2),
      });
    },
    [rooms]
  );

  const handleToggleLights = useCallback(() => {
    setLightsOn((prev) => !prev);
  }, []);

  // Global Keyboard Shortcuts (L for Day/Night Light mode, G for Graphics Studio)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "l" || e.key === "L") {
        setLightsOn((prev) => !prev);
      } else if (e.key === "g" || e.key === "G") {
        setIsGraphicsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedObject = useMemo(() => {
    if (selectedObjectInfo) return selectedObjectInfo;
    const custom = customObjects.find((o) => o.id === selectedObjectId);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        type: custom.type,
        isBuiltin: false,
        x: custom.x,
        y: 0,
        z: custom.z,
        rotationY: custom.rotationY || 0,
        scale: custom.scale || 1.0,
        colorHex: custom.colorHex,
      };
    }
    return null;
  }, [customObjects, selectedObjectId, selectedObjectInfo]);

  const handleRotatePlacing = useCallback((angleDelta: number) => {
    setPlacingRotationY((prev) => (prev + angleDelta) % (Math.PI * 2));
  }, []);

  const handleConvertBuiltinToCustom = useCallback(
    (builtinObj: SelectedObjectInfo): PlacedCustomObject | null => {
      if (!builtinObj || builtinObj.isWall || builtinObj.isWindow) return null;
      const itemDef = FURNITURE_CATALOG.find((i) => i.type === builtinObj.type);
      const newId = `custom_${builtinObj.type || "furniture"}_${Date.now()}`;
      const newObj: PlacedCustomObject = {
        id: newId,
        type: builtinObj.type || "sofa_3seater",
        name: builtinObj.name || itemDef?.name || "Furniture",
        x: builtinObj.x,
        y: 0,
        z: builtinObj.z,
        rotationY: builtinObj.rotationY || 0,
        scale: builtinObj.scale || 1.0,
        colorHex: builtinObj.colorHex,
      };

      setDeletedBuiltinIds((prev) => [...prev, builtinObj.id]);
      setCustomObjects((prev) => [...prev, newObj]);
      setSelectedObjectId(newId);
      setSelectedObjectInfo({
        ...builtinObj,
        id: newId,
        isBuiltin: false,
      });
      return newObj;
    },
    []
  );

  const handleUpdateCustomObjectPos = useCallback((id: string, x: number, z: number, rotationY?: number) => {
    const snappedX = Math.round(x * 2) / 2;
    const snappedZ = Math.round(z * 2) / 2;
    setCustomObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: snappedX, z: snappedZ, ...(rotationY !== undefined ? { rotationY } : {}) } : o))
    );
    setSelectedObjectInfo((prev) =>
      prev && prev.id === id ? { ...prev, x: snappedX, z: snappedZ, ...(rotationY !== undefined ? { rotationY } : {}) } : prev
    );
  }, []);

  const handleMoveSelected = useCallback(
    (dx: number, dz: number) => {
      if (selectedObjectInfo) {
        if (selectedObjectInfo.isWall || selectedObjectInfo.isWindow) return;
        let targetId = selectedObjectInfo.id;
        let startX = selectedObjectInfo.x;
        let startZ = selectedObjectInfo.z;
        let targetType = selectedObjectInfo.type;

        if (selectedObjectInfo.isBuiltin) {
          const converted = handleConvertBuiltinToCustom(selectedObjectInfo);
          if (converted) {
            targetId = converted.id;
            startX = converted.x;
            startZ = converted.z;
            targetType = converted.type;
          } else {
            return;
          }
        }

        const nextX = startX + dx;
        const nextZ = startZ + dz;

        if (targetType?.startsWith("wall_")) {
          const itemDef = FURNITURE_CATALOG.find((i) => i.type === targetType);
          const wallLen = itemDef?.dimensions.widthFt || 8.0;
          const snap = computeSmartWallSnap(nextX, nextZ, wallLen, rooms, customObjects, customOpenings, targetId);
          handleUpdateCustomObjectPos(targetId, snap.x, snap.z, snap.isSnapped ? snap.rotationY : undefined);
        } else {
          handleUpdateCustomObjectPos(targetId, nextX, nextZ);
        }
        return;
      }

      if (selectedObjectId) {
        const custom = customObjects.find((o) => o.id === selectedObjectId);
        if (custom) {
          const nextX = custom.x + dx;
          const nextZ = custom.z + dz;
          if (custom.type.startsWith("wall_")) {
            const itemDef = FURNITURE_CATALOG.find((i) => i.type === custom.type);
            const wallLen = itemDef?.dimensions.widthFt || 8.0;
            const snap = computeSmartWallSnap(nextX, nextZ, wallLen, rooms, customObjects, customOpenings, custom.id);
            handleUpdateCustomObjectPos(custom.id, snap.x, snap.z, snap.isSnapped ? snap.rotationY : undefined);
          } else {
            handleUpdateCustomObjectPos(custom.id, nextX, nextZ);
          }
        }
      }
    },
    [selectedObjectInfo, customObjects, selectedObjectId, handleConvertBuiltinToCustom, handleUpdateCustomObjectPos, rooms, customOpenings]
  );

  const handleRotateSelected = useCallback((angleDelta: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId ? { ...o, rotationY: (o.rotationY || 0) + angleDelta } : o
      )
    );
    setSelectedObjectInfo((prev) => (prev ? { ...prev, rotationY: (prev.rotationY || 0) + angleDelta } : null));
  }, [selectedObjectId]);

  const handleScaleSelected = useCallback((scaleDelta: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId
          ? { ...o, scale: Math.max(0.5, Math.min(2.5, (o.scale || 1.0) + scaleDelta)) }
          : o
      )
    );
  }, [selectedObjectId]);

  const handleChangeColorSelected = useCallback((colorHex: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) => (o.id === selectedObjectId ? { ...o, colorHex } : o))
    );
  }, [selectedObjectId]);

  const handleDeleteIndividualWindow = useCallback((windowId: string) => {
    setWindowConfig((prev) => {
      const deleted = prev.deletedWindowIds || [];
      if (deleted.includes(windowId)) return prev;
      return {
        ...prev,
        deletedWindowIds: [...deleted, windowId],
      };
    });
    setSelectedObjectId(null);
    setSelectedObjectInfo(null);
  }, []);

  const handleChangeIndividualWindow = useCallback(
    (
      windowId: string,
      updates: {
        shape?: WindowShapeId;
        frameFinish?: WindowFrameFinishId;
        glassTint?: WindowGlassTintId;
        widthFt?: number;
        heightFt?: number;
        hasCurtains?: boolean;
      }
    ) => {
      setWindowConfig((prev) => {
        const currentOverride = prev.individualOverrides?.[windowId] || {};
        const nextOverrides = {
          ...(prev.individualOverrides || {}),
          [windowId]: {
            ...currentOverride,
            ...updates,
          },
        };
        return {
          ...prev,
          individualOverrides: nextOverrides,
        };
      });

      // Update selectedObjectInfo in-place for zero-latency ribbon feedback
      setSelectedObjectInfo((prev) => {
        if (!prev || prev.id !== windowId) return prev;
        return {
          ...prev,
          windowShape: updates.shape !== undefined ? updates.shape : prev.windowShape,
          windowFrameFinish: updates.frameFinish !== undefined ? updates.frameFinish : prev.windowFrameFinish,
          windowGlassTint: updates.glassTint !== undefined ? updates.glassTint : prev.windowGlassTint,
          windowWidthFt: updates.widthFt !== undefined ? updates.widthFt : prev.windowWidthFt,
          windowHeightFt: updates.heightFt !== undefined ? updates.heightFt : prev.windowHeightFt,
          windowHasCurtains: updates.hasCurtains !== undefined ? updates.hasCurtains : prev.windowHasCurtains,
        };
      });
    },
    []
  );

  const handleToggleRemoveWall = useCallback(
    (roomIndex: number, edge: "N" | "S" | "E" | "W") => {
      const room = rooms[roomIndex];
      if (!room) return;
      const spec = roomListWithSpecs[roomIndex];
      const id = spec?.id || `${room.name}_${roomIndex}`;
      const currentOps = customOpenings[id] !== undefined ? customOpenings[id] : (room.openings || []);
      const isAlreadyRemoved = currentOps.some((o) => o.kind === "opening" && o.edge === edge);

      // Check if this wall is shared with an adjacent touching room
      const adj = findAdjacentRoomEdge(rooms, roomIndex, edge);

      let nextOps: RoomOpening[];
      if (isAlreadyRemoved) {
        // Rebuild the solid wall by removing the full opening
        nextOps = currentOps.filter((o) => !(o.kind === "opening" && o.edge === edge));
      } else {
        // Demolish the wall into an open-concept passage
        const wallLengthIn = edge === "N" || edge === "S" ? room.w_in : room.d_in;
        nextOps = [
          ...currentOps.filter((o) => o.edge !== edge),
          {
            kind: "opening",
            edge,
            offset_in: 0,
            width_in: wallLengthIn,
            height_in: 108,
          },
        ];
      }

      const nextCustomOpenings: Record<string, RoomOpening[]> = {
        ...customOpenings,
        [id]: nextOps,
      };

      // If this wall is shared with an adjacent room, synchronize the opening on the adjacent room too!
      if (adj) {
        const adjSpec = roomListWithSpecs[adj.adjIndex];
        const adjId = adjSpec?.id || `${rooms[adj.adjIndex]?.name}_${adj.adjIndex}`;
        const adjRoom = rooms[adj.adjIndex];
        if (adjRoom) {
          const adjCurrentOps = customOpenings[adjId] !== undefined ? customOpenings[adjId] : (adjRoom.openings || []);
          let nextAdjOps: RoomOpening[];
          if (isAlreadyRemoved) {
            nextAdjOps = adjCurrentOps.filter((o) => !(o.kind === "opening" && o.edge === adj.adjEdge));
          } else {
            const adjWallLengthIn = adj.adjEdge === "N" || adj.adjEdge === "S" ? adjRoom.w_in : adjRoom.d_in;
            nextAdjOps = [
              ...adjCurrentOps.filter((o) => o.edge !== adj.adjEdge),
              {
                kind: "opening",
                edge: adj.adjEdge,
                offset_in: 0,
                width_in: adjWallLengthIn,
                height_in: 108,
              },
            ];
          }
          nextCustomOpenings[adjId] = nextAdjOps;
        }
      }

      setCustomOpenings(nextCustomOpenings);

      // Update selectedObjectInfo in-place so ribbon button updates immediately
      setSelectedObjectInfo((prev) => {
        if (!prev || !prev.isWall) return prev;
        return {
          ...prev,
          isWallRemoved: !isAlreadyRemoved,
          name: !isAlreadyRemoved
            ? `${prev.name.replace(" [Open-Concept]", "")} [Open-Concept]`
            : prev.name.replace(" [Open-Concept]", ""),
        };
      });
    },
    [rooms, roomListWithSpecs, customOpenings]
  );

  const handleAddWindowToWall = useCallback(
    (roomIndex: number, edge: "N" | "S" | "E" | "W") => {
      const room = rooms[roomIndex];
      if (!room) return;
      const spec = roomListWithSpecs[roomIndex];
      const id = spec?.id || `${room.name}_${roomIndex}`;
      const currentOps = customOpenings[id] !== undefined ? customOpenings[id] : (room.openings || []);

      const wallLengthIn = edge === "N" || edge === "S" ? room.w_in : room.d_in;
      const newWin: RoomOpening = {
        kind: "window",
        edge,
        offset_in: Math.round(wallLengthIn / 2),
        width_in: 48,
        height_in: 48,
        sill_in: 36,
      };

      const nextOps = [
        ...currentOps.filter((o) => o.edge !== edge),
        newWin,
      ];

      setCustomOpenings((prev) => ({
        ...prev,
        [id]: nextOps,
      }));

      const winId = `win_${roomIndex}_${edge}`;
      setWindowConfig((prev) => ({
        ...prev,
        deletedWindowIds: (prev.deletedWindowIds || []).filter((dId) => dId !== winId),
      }));

      setSelectedObjectId(winId);
      const roomLabel = ROOM_LABELS[room.name as RoomName] || room.name;
      setSelectedObjectInfo({
        id: winId,
        name: `${roomLabel} (${edge} Wall) Window`,
        type: "window",
        isWindow: true,
        roomIndex,
        roomName: room.name,
        edge,
        windowShape: "modern_slider",
        windowFrameFinish: "black_aluminum",
        windowGlassTint: "clear",
        windowWidthFt: 4.0,
        windowHeightFt: 4.0,
        windowHasCurtains: true,
        x: inchesToFeet(room.x_in + room.w_in / 2),
        y: 0,
        z: inchesToFeet(room.y_in + room.d_in / 2),
        rotationY: 0,
      });
    },
    [rooms, roomListWithSpecs, customOpenings]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedObjectInfo) {
      // A drawn wall is an object in its own right: it is deleted, not demolished. This has to
      // come before the isWall branch, because a drawn wall's mesh carries BOTH flags and the
      // demolish path below would otherwise fall back to room 0's north wall and quietly take
      // out an unrelated wall while leaving the drawn one standing. The ribbon's wall inspector
      // already guards against the same fallback; this path did not.
      if (selectedObjectInfo.isCustomWall) {
        setCustomWalls((prev) => prev.filter((w) => w.id !== selectedObjectInfo.id));
      } else if (selectedObjectInfo.isWall) {
        // A solver wall is not removed, it is opened up — and only when we know which one. No
        // room index or edge means the selection did not come from a solver wall, and guessing
        // is what caused the bug above.
        if (selectedObjectInfo.roomIndex == null || !selectedObjectInfo.edge) return;
        handleToggleRemoveWall(selectedObjectInfo.roomIndex, selectedObjectInfo.edge);
        return;
      } else if (selectedObjectInfo.isWindow) {
        handleDeleteIndividualWindow(selectedObjectInfo.id);
        return;
      } else if (selectedObjectInfo.isBuiltin) {
        setDeletedBuiltinIds((prev) => [...prev, selectedObjectInfo.id]);
      } else {
        setCustomObjects((prev) => prev.filter((o) => o.id !== selectedObjectInfo.id));
      }
      setSelectedObjectInfo(null);
      setSelectedObjectId(null);
    } else if (selectedObjectId) {
      setCustomObjects((prev) => prev.filter((o) => o.id !== selectedObjectId));
      setSelectedObjectId(null);
    }
  }, [selectedObjectInfo, selectedObjectId, handleDeleteIndividualWindow, handleToggleRemoveWall]);

  const handleReplaceSelected = useCallback((newType: string) => {
    const current = selectedObjectInfo;
    if (!current) return;
    const itemDef = FURNITURE_CATALOG.find((i) => i.type === newType);
    const posX = current.x;
    const posZ = current.z;
    const rotY = current.rotationY;

    // Delete the old object
    if (current.isBuiltin) {
      setDeletedBuiltinIds((prev) => [...prev, current.id]);
    } else {
      setCustomObjects((prev) => prev.filter((o) => o.id !== current.id));
    }

    // Spawn the new replacement object at the same spot
    const newObj: PlacedCustomObject = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: newType,
      name: itemDef?.name || "Furniture",
      x: posX,
      y: 0,
      z: posZ,
      rotationY: rotY,
      scale: 1.0,
      colorHex: itemDef?.defaultColor,
    };

    setCustomObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    setSelectedObjectInfo({
      id: newObj.id,
      name: newObj.name,
      type: newObj.type,
      isBuiltin: false,
      x: posX,
      y: 0,
      z: posZ,
      rotationY: rotY,
    });
  }, [selectedObjectInfo]);

  const handleRestoreDefaults = useCallback(() => {
    setDeletedBuiltinIds([]);
  }, []);

  const handleClearAllFurniture = useCallback(() => {
    setCustomObjects([]);
    setSelectedObjectId(null);
    setSelectedObjectInfo(null);
    setPlacingItemType(null);
    setPlacingRotationY(0);
  }, []);

  /**
   * Put down whatever tool is held, and remember it.
   *
   * Returns whether anything was actually holding, so Escape can fall through to its other jobs
   * — closing a modal, dropping a selection — when no tool was armed. Without that, one Escape
   * would have to be pressed twice in a row to get out of a dialog opened while a tool was up.
   */
  const unequipTool = useCallback((): boolean => {
    if (placingItemType) {
      setLastTool({ kind: "item", type: placingItemType, rotationY: placingRotationY });
      setPlacingItemType(null);
      setPlacingRotationY(0);
      return true;
    }
    if (placingOpeningDef) {
      setLastTool({ kind: "opening", def: placingOpeningDef });
      setPlacingOpeningDef(null);
      return true;
    }
    if (activeCadTool !== "select") {
      setLastTool({ kind: "cad", tool: activeCadTool });
      setActiveCadTool("select");
      return true;
    }
    return false;
  }, [placingItemType, placingRotationY, placingOpeningDef, activeCadTool]);

  /** Pick the last tool back up. Arming one clears the other two, as arming always does. */
  const reequipLastTool = useCallback((): boolean => {
    if (!lastTool) return false;
    setPlacingItemType(null);
    setPlacingOpeningDef(null);
    setActiveCadTool("select");
    if (lastTool.kind === "item") {
      setPlacingItemType(lastTool.type);
      setPlacingRotationY(lastTool.rotationY);
    } else if (lastTool.kind === "opening") {
      setPlacingOpeningDef(lastTool.def);
    } else {
      setActiveCadTool(lastTool.tool);
    }
    return true;
  }, [lastTool]);

  // Global Keyboard shortcuts (Escape, Delete, Backspace, KeyR)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // H: blueprint alongside the 3D view. Only from 3D — in blueprint mode the 2D view is
      // already the whole window, and there is nothing to put beside it.
      if (e.code === "KeyH" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (mode === "orbit") setIsSplitView((v) => !v);
        return;
      }

      // Escape has just put a tool down and nothing has been edited since, so Ctrl+Z means
      // "pick that back up". One press only: the memory is consumed here, so pressing it again
      // undoes, which is what it would have done anyway.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey && lastTool) {
        e.preventDefault();
        reequipLastTool();
        setLastTool(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyZ" || e.code === "KeyY")) {
        e.preventDefault();
        // Ctrl+Y and Ctrl+Shift+Z both redo: the first is what Windows tools trained people on,
        // the second is what browsers and Mac apps did.
        if (e.code === "KeyY" || e.shiftKey) history.redo();
        else history.undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyC" || e.code === "KeyV")) {
        e.preventDefault();
        if (e.code === "KeyC") handleCopySelection();
        else handlePasteSelection();
        return;
      }

      if (e.code === "Escape") {
        setTourPlaying(false);
        // Remembers what was held, so it can be picked back up. Everything below still runs:
        // one Escape should clear the whole transient state, not just the first thing it finds.
        unequipTool();
        setSelectedObjectId(null);
        setSelectedObjectInfo(null);
        setIsGraphicsModalOpen(false);
        setIsMaterialModalOpen(false);
        setIsWindowModalOpen(false);
        setIsExportModalOpen(false);
        setIsModelBlueprintsOpen(false);
        setIsAIFurnitureModalOpen(false);
        setIsReplaceModalOpen(false);
        setIsRoomDimensionsOpen(false);
        setIsBOQModalOpen(false);
        setIsScheduleModalOpen(false);
        setIsElevationsModalOpen(false);
        setIsClearanceModalOpen(false);
        setIsMoodboardModalOpen(false);
        setIsCeilingPlanModalOpen(false);
        setIsCustomWallBlendModalOpen(false);
      } else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedObjectId || selectedObjectInfo) {
          handleDeleteSelected();
        }
      } else if (e.code === "KeyR") {
        if (placingItemType) {
          handleRotatePlacing(Math.PI / 4);
        } else if (selectedObjectId || selectedObjectInfo) {
          handleRotateSelected(Math.PI / 4);
        }
      } else if (e.code === "ArrowUp") {
        if (selectedObjectId || selectedObjectInfo) {
          e.preventDefault();
          handleMoveSelected(0, -0.5);
        }
      } else if (e.code === "ArrowDown") {
        if (selectedObjectId || selectedObjectInfo) {
          e.preventDefault();
          handleMoveSelected(0, 0.5);
        }
      } else if (e.code === "ArrowLeft") {
        if (selectedObjectId || selectedObjectInfo) {
          e.preventDefault();
          handleMoveSelected(-0.5, 0);
        }
      } else if (e.code === "ArrowRight") {
        if (selectedObjectId || selectedObjectInfo) {
          e.preventDefault();
          handleMoveSelected(0.5, 0);
        }
      } else if (e.code === "KeyG" || e.key === "g" || e.key === "G") {
        setIsGraphicsModalOpen((prev) => !prev);
      } else if (e.code === "KeyL" || e.key === "l" || e.key === "L") {
        handleToggleLights();
      } else if (e.code === "KeyU" || e.key === "u" || e.key === "U") {
        setIsUpgraded((prev) => !prev);
      } else if (e.code === "KeyP" || e.key === "p" || e.key === "P") {
        setIsRaytracing((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, lastTool, unequipTool, reequipLastTool, placingItemType, selectedObjectId, selectedObjectInfo, handleDeleteSelected, handleRotateSelected, handleRotatePlacing, handleToggleLights, handleMoveSelected, setIsUpgraded, setIsRaytracing]);

  return (
    <div className={styles.appContainer}>
      {/* MS Paint / CAD Ribbon Taskbar */}
      <TopRibbonTaskbar
        mode={mode}
        onChangeMode={setMode}
        plot={plot}
        onChangePlot={setPlot}
        facing={facing}
        onChangeFacing={setFacing}
        counts={counts}
        onChangeCounts={setCounts}
        program={program}
        onChangeProgram={handleChangeProgram}
        coverCount={coverCount}
        selectedWallBands={selectedWallBands}
        onChangeSelectedWallBands={handleChangeSelectedWallBands}
        selectedWallGlazing={selectedWallGlazing}
        onChangeSelectedWallGlazing={handleChangeSelectedWallGlazing}
        furnished={furnished}
        onToggleFurnished={setFurnished}
        customDims={customDims}
        onChangeCustomDims={setCustomDims}
        meta={meta}
        materialConfig={materialConfig}
        onChangeMaterialConfig={setMaterialConfig}
        windowConfig={windowConfig}
        onChangeWindowConfig={setWindowConfig}
        lightsOn={lightsOn}
        onToggleLights={handleToggleLights}
        isUpgraded={isUpgraded}
        onToggleUpgrade={() => setIsUpgraded((prev) => !prev)}
        isRaytracing={isRaytracing}
        onToggleRaytrace={() => setIsRaytracing((prev) => !prev)}
        isLayoutLocked={isLayoutLocked}
        onToggleLayoutLock={handleToggleLayoutLock}
        onOpenWindowModal={() => setIsWindowModalOpen(true)}
        onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenRoomDimensionsModal={() => setIsRoomDimensionsOpen(true)}
        onOpenGraphicsModal={() => setIsGraphicsModalOpen(true)}
        onOpenBOQModal={() => setIsBOQModalOpen(true)}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        onOpenElevationsModal={() => setIsElevationsModalOpen(true)}
        onOpenClearanceModal={() => setIsClearanceModalOpen(true)}
        onOpenMoodboardModal={() => setIsMoodboardModalOpen(true)}
        onOpenCeilingPlanModal={() => setIsCeilingPlanModalOpen(true)}
        onOpenCustomWallBlendModal={() => setIsCustomWallBlendModalOpen(true)}
        onOpenPlotShapeModal={() => setIsPlotShapeModalOpen(true)}

        placingItemType={placingItemType}
        onSelectPlaceItem={(type) => {
          setPlacingItemType(type);
          if (!type) setPlacingRotationY(0);
        }}
        selectedObject={selectedObject}
        onOpenReplaceModal={() => setIsReplaceModalOpen(true)}
        onRotateSelected={handleRotateSelected}
        onScaleSelected={handleScaleSelected}
        onChangeColorSelected={handleChangeColorSelected}
        onDeleteSelected={handleDeleteSelected}
        onChangeIndividualWindow={handleChangeIndividualWindow}
        onDeleteIndividualWindow={handleDeleteIndividualWindow}
        onToggleRemoveWall={handleToggleRemoveWall}
        onAddWindowToWall={handleAddWindowToWall}
        onMoveSelected={handleMoveSelected}
        onDeselectObject={() => {
          setSelectedObjectId(null);
          setSelectedObjectInfo(null);
        }}
        onStartFromScratch={handleStartFromScratch}
        onResetDesign={handleResetDesign}
        lastSavedTime={lastSavedTime}
        roadWidthM={roadWidthM}
        onChangeRoadWidthM={setRoadWidthM}
        autoSetback={autoSetback}
        onToggleAutoSetback={setAutoSetback}
        compliance={compliance}
        floorsCount={floorsCount}
        onChangeFloorsCount={setFloorsCount}
        solvedFloorCount={solvedFloorCount}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        undoLabel={history.undoLabel}
        redoLabel={history.redoLabel}
        activeFloor={activeFloor}
        onChangeActiveFloor={setActiveFloor}
        activeCadTool={activeCadTool}
        onChangeCadTool={setActiveCadTool}
        activeWallType={activeWallType}
        onChangeWallType={setActiveWallType}
        onToggleDoorsWindowsDrawer={() => setIsDoorsWindowsDrawerOpen((prev) => !prev)}
        placingOpeningDef={placingOpeningDef}
        onSelectPlaceOpening={handleSelectPlaceOpening}
        isDoorsWindowsDrawerOpen={isDoorsWindowsDrawerOpen}
        onPromptToSimulate={handlePromptToSimulate}
        isSimulatingPrompt={isSimulatingPrompt || promptBusy}
        onBuildFromText={applyPromptText}
        onReadPlanPhoto={applyPlanImage}
        onReadHousePhoto={applyFacadePhoto}
        aiNotice={planImageNotice}
        aiError={promptError}
        aiAssumed={promptAssumed}
        aiUnsupported={promptUnsupported}
        onOpenMaterialModal={() => setIsMaterialModalOpen(true)}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView((v) => !v)}
        tourPlaying={tourPlaying}
        onToggleTour={() => {
          // A tour needs the whole window and its own camera, so it turns the split off and
          // leaves walkthrough for orbit rather than fighting either for the view.
          if (!tourPlaying) {
            setIsSplitView(false);
            setMode("orbit");
          }
          setTourPlaying((v) => !v);
          setTourProgress(null);
        }}
        onOpenAIFurnitureModal={() => setIsAIFurnitureModalOpen(true)}
        totalPlacedCount={customObjects.length}
        deletedBuiltinCount={deletedBuiltinIds.length}
        onRestoreDefaults={handleRestoreDefaults}
        onClearAllFurniture={handleClearAllFurniture}
      />

      <main className={styles.mainLayout}>
        <section className={styles.viewport}>

          {(promptError ||
            planImageNotice ||
            promptAssumed.length > 0 ||
            promptUnsupported.length > 0) && (
            <div className={styles.promptNotice} role="status">
              {promptError && <div className={styles.promptError}>{promptError}</div>}
              {planImageNotice && (
                <div className={styles.promptAssumed}>{planImageNotice}</div>
              )}
              {promptAssumed.length > 0 && (
                <div className={styles.promptAssumed}>
                  You did not say: {promptAssumed.join("; ")}. Change it in the ribbon if that is
                  wrong.
                </div>
              )}
              {promptUnsupported.length > 0 && (
                <div className={styles.promptUnsupported}>
                  Not built, because this tool cannot: {promptUnsupported.join("; ")}.
                </div>
              )}
            </div>
          )}

          {solverNotice && (
            <div className={styles.solverNotice} role="alert">
              <div className={styles.solverNoticeTitle}>⚠ {solverNotice.title}</div>
              <div className={styles.solverNoticeDetail}>{solverNotice.detail}</div>
            </div>
          )}

          {/* 3D on the left, 2D on the right, both live off the same state — so a wall drawn
              in the blueprint is already in the scene graph, with nothing to sync. `H` puts the
              blueprint alongside instead of instead of. */}
          {mode !== "blueprint" && (
            <div
              className={styles.viewportPane}
              onMouseEnter={() => setActivePane("3d")}
            >
              <Scene
                plot={plot}
                facing={facing}
                envelopePolygonIn={meta?.envelope_polygon_in ?? null}
                roomEdgeCurves={roomEdgeCurves}
                rooms={rooms}
                customOpenings={customOpenings}
                customWalls={customWalls}
                drawnStairs={drawnStairs}
                onChangeDrawnStairs={setDrawnStairs}
                stairWidthIn={stairWidthIn}
                keyboardActive={!splitActive || activePane === "3d"}
                tourPlaying={tourPlaying}
                onTourEnd={() => {
                  setTourPlaying(false);
                  setTourProgress(null);
                }}
                onTourProgress={(atSec, totalSec) => setTourProgress({ atSec, totalSec })}
                selectedWallIds={selectedRunWallIds}
                customRoomZones={customRoomZones}
                activeFloor={activeFloor}
                onChangeActiveFloor={setActiveFloor}
                activeCadTool={activeCadTool}
                onChangeCadTool={setActiveCadTool}
                activeWallType={activeWallType}
                onChangeWallType={setActiveWallType}
                onChangeCustomWalls={setCustomWalls}
                onChangeCustomRoomZones={setCustomRoomZones}
                onChangeCustomOpenings={setCustomOpenings}
                onStartFromScratch={handleStartFromScratch}
                setback={activeSetback}
                mode={mode}
                activeMoveCmd={activeMoveCmd}
                teleportTarget={teleportTarget}
                lightsOn={lightsOn}
                furnished={furnished}
                isUpgraded={isUpgraded}
                onToggleUpgrade={() => setIsUpgraded((prev) => !prev)}
                isRaytracing={isRaytracing}
                onToggleRaytrace={() => setIsRaytracing((prev) => !prev)}
                materialConfig={materialConfig}

                graphicsSettings={graphicsSettings}
                onChangeGraphicsSettings={setGraphicsSettings}
                windowConfig={windowConfig}
                onChangeWindowConfig={setWindowConfig}
                placingOpeningDef={placingOpeningDef}
                onSelectPlaceOpening={handleSelectPlaceOpening}
                isLayoutLocked={isLayoutLocked}
                onToggleLayoutLock={handleToggleLayoutLock}
                customObjects={customObjects}
                deletedBuiltinIds={deletedBuiltinIds}
                onFurnitureInventory={setBuiltinInventory}
                placingItemType={placingItemType}
                placingRotationY={placingRotationY}
                selectedObjectId={selectedObjectId}
                selectedObjectInfo={selectedObjectInfo}
                onPlotChange={setPlot}
                onPlayerUpdate={setPlayer}
                onToggleLights={handleToggleLights}
                onRoomMove={handleRoomMove}
                onRoomResize={handleRoomResize}
                wallEdits={wallEdits}
                onAddCustomObject={(newObj) => {
                  setCustomObjects((prev) => [...prev, newObj]);
                  setPlacingItemType(null);
                  setPlacingRotationY(0);
                  setSelectedObjectId(newObj.id);
                  setSelectedObjectInfo({
                    id: newObj.id,
                    name: newObj.name,
                    type: newObj.type,
                    isBuiltin: false,
                    x: newObj.x,
                    y: 0,
                    z: newObj.z,
                    rotationY: newObj.rotationY || 0,
                  });
                }}
                onSelectObject={(info) => {
                  setSelectedObjectInfo(info);
                  setSelectedObjectId(info ? info.id : null);
                  setRunJoinError(null);
                  // A drawn wall can also be picked up for combining. A run answers as one, so
                  // clicking any of its walls — or a corner piece, which is not a wall the user
                  // drew and carries only the run id — takes the whole run.
                  if (!info?.isCustomWall) {
                    setSelectedRunWallIds([]);
                    return;
                  }
                  const picked = info.chainId
                    ? chainWalls(customWalls, info.chainId).map((w) => w.id)
                    : [info.id];
                  setSelectedRunWallIds((prev) =>
                    info.addToSelection
                      ? prev.some((id) => picked.includes(id))
                        ? prev.filter((id) => !picked.includes(id))
                        : [...prev, ...picked]
                      : picked
                  );
                }}
                onUpdateCustomObject={(updated) => {
                  setCustomObjects((prev) =>
                    prev.map((o) => (o.id === updated.id ? updated : o))
                  );
                }}
                onUpdateCustomObjectPos={handleUpdateCustomObjectPos}
                onConvertBuiltinToCustom={handleConvertBuiltinToCustom}
                onRequestReplace={() => setIsReplaceModalOpen(true)}
                onRequestDelete={handleDeleteSelected}
                onRotateSelected={handleRotateSelected}
                onRotatePlacing={handleRotatePlacing}
                onNearestDoorChange={setDoorPrompt}
                onRegisterDoorTrigger={(fn) => { doorTriggerRef.current = fn; }}
              /> {/* Orbit View HUD Overlay */}
              {/* Clicked a wall in 3D: its own thickness, height and cutouts. */}
              {mode === "orbit" && selectedWall && (
                <WallInspector
                  title={selectedWall.title}
                  subtitle={selectedWall.subtitle}
                  runFt={selectedWall.runFt}
                  storeyHeightIn={WALL_HEIGHT_FT * 12}
                  defaultThicknessIn={selectedWall.defaultThicknessIn}
                  edit={selectedWall.edit}
                  onChange={handleChangeSelectedWallEdit}
                  onChangeLength={handleChangeSelectedWallLength}
                  lengthNote={selectedWall.lengthNote}
                  curveIn={selectedWall.curveIn}
                  onChangeCurve={handleChangeSelectedWallCurve}
                  curveBlocked={selectedWall.curveBlocked}
                  onCopy={handleCopySelection}
                  onPaste={handlePasteSelection}
                  canPaste={clipboard?.kind === "wall"}
                  onDelete={selectedWall.kind === "custom" ? handleDeleteSelected : undefined}
                  onClose={() => {
                    setSelectedObjectInfo(null);
                    setSelectedObjectId(null);
                  }}
                />
              )}

              {/* Combining drawn walls into one run, and the shape of its corners, in 3D. */}
              {mode === "orbit" &&
                (() => {
                  // Read back off the walls rather than trusting the ids: clearing the design
                  // leaves the picked ids behind, and a wall that is gone is not selected.
                  const picked = customWalls.filter((w) => selectedRunWallIds.includes(w.id));
                  // A wall of the solved plan. It is a wall, it is clicked, and it can never join
                  // a run — so saying nothing leaves the feature looking broken rather than
                  // inapplicable, which is the single thing most likely to be clicked first.
                  const clickedSolvedWall = Boolean(
                    selectedObjectInfo?.isWall && !selectedObjectInfo?.isCustomWall
                  );
                  // With nothing picked the panel still offers to join the walls by itself, which
                  // is the only way to reach that from here: there is nothing to click first.
                  if (picked.length === 0 && customWalls.length < 2 && !clickedSolvedWall) {
                    return null;
                  }

                  const chainId = commonChainId(customWalls, picked.map((w) => w.id));
                  const runWalls = chainId ? chainWalls(customWalls, chainId) : [];
                  const style: WallJoinStyle = runWalls[0]?.joinStyle ?? "miter";
                  const radiusIn = runWalls[0]?.joinRadiusIn ?? DEFAULT_JOIN_RADIUS_IN;
                  const applyRadius = (next: number) => {
                    if (!chainId) return;
                    setCustomWalls(setChainJoin(customWalls, chainId, style, next));
                  };

                  return (
                    <div
                      style={{
                        position: "absolute",
                        // Above the quick-action pill at bottom 24, which appears under exactly
                        // the same condition as this panel. Top left is the 3D tool HUD and top
                        // right is the wall inspector, so this is the one edge left free.
                        bottom: 92,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(19, 18, 16, 0.96)",
                        backdropFilter: "blur(16px)",
                        border: "1.5px solid #6f9aa8",
                        padding: "7px 12px",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                        // Over the 3D tool HUD (45) and the wall inspector (42). At 26 this panel
                        // rendered every time and sat invisible underneath the tool HUD, which is
                        // why clicking a wall looked like it did nothing at all.
                        zIndex: 50,
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
                        color: "#ffffff",
                        fontSize: "12px",
                      }}
                    >
                      {chainId ? (
                        <>
                          <span style={{ fontWeight: 800, color: "#8ab3bf" }}>
                            Run ({runWalls.length} walls, {Math.max(0, runWalls.length - 1)} corners)
                          </span>

                          <span style={{ fontSize: "10.5px", color: "#8e8a82" }}>Corner:</span>
                          <select
                            value={style}
                            onChange={(e) =>
                              setCustomWalls(
                                setChainJoin(
                                  customWalls,
                                  chainId,
                                  e.target.value as WallJoinStyle,
                                  radiusIn
                                )
                              )
                            }
                            title={JOIN_STYLES.find((s) => s.id === style)?.description}
                            style={{
                              background: "rgba(26, 25, 22, 0.9)",
                              color: "#6f9aa8",
                              border: "1px solid #6f9aa8",
                              borderRadius: "6px",
                              padding: "3px 6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {JOIN_STYLES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          {/* A square corner has no radius to set. */}
                          {style !== "miter" && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(0,0,0,0.35)",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              <span style={{ fontSize: "10.5px", color: "#8e8a82" }}>Radius:</span>
                              <button
                                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "3px", width: "18px", height: "18px", cursor: "pointer", fontWeight: 800 }}
                                onClick={() => applyRadius(radiusIn - 6)}
                                disabled={radiusIn <= MIN_JOIN_RADIUS_IN}
                                title="Tighter corner"
                              >
                                -
                              </button>
                              <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "30px", textAlign: "center", color: "#6f9aa8" }}>
                                {radiusIn}&quot;
                              </span>
                              <button
                                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "3px", width: "18px", height: "18px", cursor: "pointer", fontWeight: 800 }}
                                onClick={() => applyRadius(radiusIn + 6)}
                                disabled={radiusIn >= MAX_JOIN_RADIUS_IN}
                                title="Wider corner"
                              >
                                +
                              </button>
                            </div>
                          )}

                          <button
                            style={{
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255,255,255,0.2)",
                              color: "#b5b0a6",
                              borderRadius: "6px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setCustomWalls(breakChain(customWalls, chainId));
                              setRunJoinError(null);
                            }}
                            title="Split this run back into separate walls"
                          >
                            Break apart
                          </button>
                        </>
                      ) : picked.length >= 2 ? (
                        <>
                          <span style={{ fontWeight: 800, color: "#8ab3bf" }}>
                            {picked.length} walls selected
                          </span>
                          <button
                            style={{
                              background: "#3d5c69",
                              border: "1px solid #6f9aa8",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              const result = combineWalls(customWalls, picked.map((w) => w.id));
                              if ("error" in result) {
                                setRunJoinError(result.error);
                                return;
                              }
                              setRunJoinError(null);
                              setCustomWalls(result.walls);
                            }}
                            title="Join these walls into one run with shaped corners"
                          >
                            Combine into run
                          </button>
                        </>
                      ) : clickedSolvedWall && picked.length === 0 ? (
                        <span style={{ fontSize: "10.5px", color: "#d98b52", maxWidth: "340px" }}>
                          That is a wall of the solved plan — the edge of a room, not a wall you
                          drew. Only walls placed with <strong>Draw Wall</strong> can be combined
                          into a run.
                        </span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 800, color: "#8ab3bf" }}>Walls</span>
                          <button
                            style={{
                              background: "#3d5c69",
                              border: "1px solid #6f9aa8",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              const result = autoJoinWalls(customWalls);
                              if (result.runs === 0) {
                                setRunJoinError("No loose walls meet end to end. A T junction or a closed loop is left alone.");
                                return;
                              }
                              setRunJoinError(null);
                              setCustomWalls(result.walls);
                              setSelectedRunWallIds(result.firstRunIds);
                            }}
                            title="Find every run the walls already make and join each one"
                          >
                            Auto join
                          </button>
                          <span style={{ fontSize: "10.5px", color: "#8e8a82" }}>
                            or shift-click walls to combine them yourself.
                          </span>
                        </>
                      )}

                      {runJoinError && (
                        <span style={{ fontSize: "10.5px", color: "#bf5a42", maxWidth: "260px" }}>
                          {runJoinError}
                        </span>
                      )}

                      <button
                        style={{ background: "transparent", border: "none", color: "#8e8a82", fontSize: "12px", cursor: "pointer", padding: "0 4px" }}
                        onClick={() => {
                          setSelectedRunWallIds([]);
                          setRunJoinError(null);
                        }}
                        title="Deselect"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })()}

              {/* A feature nobody can see is a feature nobody uses, and this one is two
                  keystrokes with nothing on screen to suggest it. The pill lives exactly as long
                  as the offer does: it goes when the tool is picked back up, and when an edit
                  makes Ctrl+Z mean undo again. */}
              {lastTool && !tourPlaying && (
                <div className={styles.toolMemoryPill} role="status">
                  <span>
                    Put down{" "}
                    <strong>
                      {lastTool.kind === "item"
                        ? FURNITURE_CATALOG.find((i) => i.type === lastTool.type)?.name ?? "tool"
                        : lastTool.kind === "opening"
                        ? lastTool.def.name
                        : CAD_TOOL_LABELS[lastTool.tool]}
                    </strong>
                  </span>
                  <button className={styles.toolMemoryBtn} onClick={() => { reequipLastTool(); setLastTool(null); }}>
                    Ctrl+Z to pick back up
                  </button>
                </div>
              )}

              {tourPlaying && tourProgress && (
                <div className={styles.tourBar} role="status">
                  <div className={styles.tourTrack}>
                    <div
                      className={styles.tourFill}
                      style={{ width: `${Math.round((tourProgress.atSec / Math.max(0.001, tourProgress.totalSec)) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.tourTime}>
                    {Math.round(tourProgress.atSec)}s / {Math.round(tourProgress.totalSec)}s
                  </span>
                  <button className={styles.tourStop} onClick={() => setTourPlaying(false)}>
                    Stop (Esc)
                  </button>
                </div>
              )}

              {mode === "orbit" && !tourPlaying && (
                <>
                  <div className={styles.plotMetaOverlay}>
                    <span className={styles.metaLabel}>Plot:</span>
                    <span className={styles.metaValue}>
                      {inchesToFeet(plot.widthIn)}′ × {inchesToFeet(plot.depthIn)}′ ft
                    </span>
                    <span className={styles.metaDivider}>•</span>
                    <span className={styles.metaLabel}>Buildable:</span>
                    <span className={styles.metaValue}>
                      {inchesToFeet(buildableW)}′ × {inchesToFeet(buildableD)}′ ft
                    </span>
                  </div>
                  {/* 3D Minimap Radar. Hidden with the blueprint open beside the scene: the
                      radar is a plan reference for when there is no plan on screen, and in split
                      view it sits on the divider in front of the full one. */}
                  {!splitActive && (
                    <Minimap
                      plot={plot}
                      facing={facing}
                      rooms={rooms}
                      player={player}
                      currentRoomIndex={currentRoomIndex}
                      onTeleport={handleTeleport}
                    />
                  )}
                </>
              )}

              {/* First-Person Walkthrough HUD Overlay */}
              {mode === "walkthrough" && (
                <WalkthroughOverlay
                  currentRoom={currentRoom}
                  currentRoomIndex={currentRoomIndex}
                  rooms={rooms}
                  player={player}
                  lightsOn={lightsOn}
                  activeMoveCmd={activeMoveCmd}
                  doorPrompt={doorPrompt}
                  onMoveCmdChange={setActiveMoveCmd}
                  onExit={() => setMode("orbit")}
                  onToggleLights={handleToggleLights}
                  onTeleport={handleTeleportToRoomIndex}
                  onInteractDoor={() => doorTriggerRef.current?.()}
                />
              )}
            </div>
          )}

          {(mode === "blueprint" || splitActive) && (
            <div
              className={splitActive ? styles.viewportPaneSplit2d : styles.viewportPane}
              onMouseEnter={() => setActivePane("2d")}
            >
              {/* 2D Architectural Blueprint View */}
              <Blueprint2DView
              spaces={program.spaces}
              plot={plot}
              onChangePlot={setPlot}
              facing={facing}
              setback={activeSetback}
              rooms={rooms}
              meta={meta}
              counts={counts}
              customDims={customDims}
              roomEdgeCurves={roomEdgeCurves}
              customOpenings={customOpenings}
              customWallThickness={customWallThickness}
              customWalls={customWalls}
              onChangeCustomWalls={setCustomWalls}
              drawnStairs={drawnStairs}
              onChangeDrawnStairs={setDrawnStairs}
              stairWidthIn={stairWidthIn}
              onChangeStairWidthIn={setStairWidthIn}
              keyboardActive={!splitActive || activePane === "2d"}
              compact={splitActive}
              customRoomZones={customRoomZones}
              onChangeCustomRoomZones={setCustomRoomZones}
              activeFloor={activeFloor}
              onChangeActiveFloor={setActiveFloor}
              activeCadTool={activeCadTool}
              onChangeCadTool={setActiveCadTool}
              activeWallType={activeWallType}
              onChangeWallType={setActiveWallType}
              activeBlueprintName={activeBlueprintName}
              windowConfig={windowConfig}
              onChangeWindowConfig={setWindowConfig}
              placingOpeningDef={placingOpeningDef}
              onSelectPlaceOpening={handleSelectPlaceOpening}
              onChangeCounts={setCounts}
              onChangeCustomDims={setCustomDims}
              onChangeCustomOpenings={setCustomOpenings}
              onChangeCustomWallThickness={setCustomWallThickness}
              onRoomMove={handleRoomMove}
              onRoomResize={handleRoomResize}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
              onApplyBlueprint={handleApplyModelBlueprint}
              onStartFromScratch={handleStartFromScratch}
            />
            </div>
          )}
        </section>
      </main> {/* Room Dimensions & Sizing Studio Modal */}
      <RoomDimensionsModal
        isOpen={isRoomDimensionsOpen}
        onClose={() => setIsRoomDimensionsOpen(false)}
        counts={counts}
        rooms={rooms}
        customDims={customDims}
        onChangeCustomDims={setCustomDims}
        roomEdgeCurves={roomEdgeCurves}
        onChangeRoomEdgeCurves={setRoomEdgeCurves}
      /> {/* Materials & Finishes Studio Dialog Modal */}
      <MaterialCustomizerModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        config={materialConfig}
        onChangeConfig={setMaterialConfig}
        activeRooms={Object.keys(counts).filter((k) => (counts[k as RoomName] || 0) > 0) as RoomName[]}
      /> {/* Architectural Window Shapes & Fenestration Studio Modal */}
      <WindowShapeModal
        isOpen={isWindowModalOpen}
        onClose={() => setIsWindowModalOpen(false)}
        config={windowConfig}
        onChangeConfig={setWindowConfig}
        rooms={rooms}
        selectedWindowId={selectedObject?.isWindow ? selectedObject.id : null}
        onAddWindow={handleAddWindowToWall}
      /> {/* Architectural Blueprint Export Dialog Modal */}
      <BlueprintExportModal
        quantities={quantities}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plot={plot}
        facing={facing}
        setback={activeSetback}
        rooms={rooms}
        meta={meta}
      /> {/* Curated Model Blueprints Catalog Modal */}
      <ModelBlueprintsModal
        program={program}
        isOpen={isModelBlueprintsOpen}
        onClose={() => setIsModelBlueprintsOpen(false)}
        onSelectBlueprint={handleApplyModelBlueprint}
      /> {/* Interactive 3D Object Replacement Modal */}
      <ReplaceObjectModal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        targetObjectName={selectedObjectInfo?.name || "Selected Object"}
        targetItemType={selectedObjectInfo?.type}
        onConfirmReplace={handleReplaceSelected}
      /> {/* Doors & Windows Drag & Drop Catalog Shelf */}
      <DoorsWindowsDrawer
        isOpen={isDoorsWindowsDrawerOpen}
        onToggleOpen={() => setIsDoorsWindowsDrawerOpen((prev) => !prev)}
        placingOpeningDef={placingOpeningDef}
        onSelectPlaceOpening={handleSelectPlaceOpening}
        onOpenWindowShapeModal={() => setIsWindowModalOpen(true)}
      /> {/* AI Photo-to-3D Furniture Studio Modal */}
      <AIFurnitureStudioModal
        isOpen={isAIFurnitureModalOpen}
        onClose={() => setIsAIFurnitureModalOpen(false)}
        onSpawnFurniture={handleSpawnAIFurniture}
      /> {/* AAA Game-Style Graphics Control Studio Modal */}
      <GraphicsControlModal
        isOpen={isGraphicsModalOpen}
        onClose={() => setIsGraphicsModalOpen(false)}
        settings={graphicsSettings}
        onChangeSettings={(next) => setGraphicsSettings({ ...next, autoQuality: false })}
      /> {/* Engineering Bill of Quantities (BOQ) & Cost Takeoff Modal */}
      <BOQCostModal
        isOpen={isBOQModalOpen}
        onClose={() => setIsBOQModalOpen(false)}
        plot={plot}
        facing={facing}
        rooms={rooms}
        roomEdgeCurves={roomEdgeCurves}
      /> {/* FF&E and Finish Schedule — the interior designer's deliverable */}
      <DesignScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        rooms={rooms}
        builtins={builtinInventory}
        customObjects={customObjects}
        materialConfig={materialConfig}
      /> {/* Interior elevations — the drawing a plan cannot carry */}
      <ElevationsModal
        isOpen={isElevationsModalOpen}
        onClose={() => setIsElevationsModalOpen(false)}
        rooms={rooms}
        builtins={builtinInventory}
        customObjects={customObjects}
        materialConfig={materialConfig}
      /> {/* Clearance audit — NKBA and trade minimums, measured */}
      <ClearanceAuditModal
        isOpen={isClearanceModalOpen}
        onClose={() => setIsClearanceModalOpen(false)}
        rooms={rooms}
        builtins={builtinInventory}
        customObjects={customObjects}
      /> {/* Finish board — the scheme in one page, every piece at one scale */}
      <MoodboardModal
        isOpen={isMoodboardModalOpen}
        onClose={() => setIsMoodboardModalOpen(false)}
        rooms={rooms}
        builtins={builtinInventory}
        customObjects={customObjects}
        materialConfig={materialConfig}
      /> {/* Reflected ceiling plan — fixtures, downlight layout, illuminance check */}
      <CeilingPlanModal
        isOpen={isCeilingPlanModalOpen}
        onClose={() => setIsCeilingPlanModalOpen(false)}
        rooms={rooms}
        builtins={builtinInventory}
        customObjects={customObjects}
      /> {/* Custom Wall Partitions & Permutations Studio Modal */}
      <PlotShapeModal
        isOpen={isPlotShapeModalOpen}
        onClose={() => setIsPlotShapeModalOpen(false)}
        plot={plot}
        onApply={setPlot}
      />

      <CustomWallBlendModal
        isOpen={isCustomWallBlendModalOpen}
        onClose={() => setIsCustomWallBlendModalOpen(false)}
        initialScheme={selectedWallBands || materialConfig.globalWallBands}
        selectedWallName={selectedObjectInfo?.isWall ? (selectedObjectInfo.name || "Selected Wall") : undefined}
        onApplyScheme={handleApplyCustomWallBlend}
      />
    </div>
  );

}
