"use client";

// Phase 1 composition root + 3D First-Person Walkthrough Engine + 2D Architectural Blueprint & Export Engine
// Plot geometry is instant and local; rooms arrive from POST /solve on a 400ms debounce.

import { useCallback, useEffect, useMemo, useState } from "react";
import Scene from "@/components/Scene";
import { CustomDim } from "@/components/RoomCustomizer";
import Minimap from "@/components/Minimap";
import WalkthroughOverlay from "@/components/WalkthroughOverlay";
import Blueprint2DView from "@/components/Blueprint2DView";
import BlueprintExportModal from "@/components/BlueprintExportModal";
import RoomDimensionsModal from "@/components/RoomDimensionsModal";
import {
  buildableDepthIn,
  buildableWidthIn,
  DEFAULT_PLOT,
  DEFAULT_SETBACK,
  Facing,
  PlotDims,
} from "@/lib/plot";
import { findAdjacentRoomEdge, RoomName, ROOM_NAMES, ROOM_LABELS, withCounts } from "@/lib/rooms";
import { defaultCounts, getProgram, ProgramKey } from "@/lib/programs";
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
import LeftToolRail from "@/components/LeftToolRail";
import AIFurnitureStudioModal from "@/components/AIFurnitureStudioModal";
import GraphicsControlModal from "@/components/GraphicsControlModal";
import BOQCostModal from "@/components/BOQCostModal";
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
  CustomWallType,
  CadTool,
} from "@/lib/customArchitecture";
import { clearProject, loadProject, programOfSavedProject, saveProject } from "@/lib/projectStorage";
import styles from "./page.module.css";

const DEFAULT_COUNTS: Record<RoomName, number> = withCounts({
  hall: 1,
  dining: 1,
  kitchen: 1,
  bedroom: 2,
  bathroom: 1,
});

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
  const [customWalls, setCustomWalls] = useState<CustomDrawnWall[]>([]);
  const [customRoomZones, setCustomRoomZones] = useState<CustomRoomZone[]>([]);
  const [customObjects, setCustomObjects] = useState<PlacedCustomObject[]>([]);
  const [deletedBuiltinIds, setDeletedBuiltinIds] = useState<string[]>([]);
  const [placingItemType, setPlacingItemType] = useState<string | null>(null);
  const [placingRotationY, setPlacingRotationY] = useState<number>(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectInfo, setSelectedObjectInfo] = useState<SelectedObjectInfo | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isRoomDimensionsOpen, setIsRoomDimensionsOpen] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [activeCadTool, setActiveCadTool] = useState<CadTool>("select");
  const [activeWallType, setActiveWallType] = useState<CustomWallType>("exterior");
  const [mode, setMode] = useState<"orbit" | "walkthrough" | "blueprint">("orbit");
  const [lightsOn, setLightsOn] = useState(true);
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
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [isUpgraded, setIsUpgraded] = useState(true);
  const [isRaytracing, setIsRaytracing] = useState(false);
  const [isBOQModalOpen, setIsBOQModalOpen] = useState(false);
  const [isCustomWallBlendModalOpen, setIsCustomWallBlendModalOpen] = useState(false);




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
      if (Array.isArray(data.customWalls)) setCustomWalls(data.customWalls);
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
    lightsOn: true,
  });

  const [activeMoveCmd, setActiveMoveCmd] = useState<string | null>(null);

  const roomListWithSpecs: RoomSpecIn[] = useMemo(() => {
    const list: RoomSpecIn[] = [];
    for (const name of ROOM_NAMES) {
      const count = counts[name] ?? 0;
      for (let c = 0; c < count; c++) {
        const id = `${name}_${c}`;
        const custom = customDims[id];
        list.push({
          id,
          name,
          custom_w_in: custom ? custom.wFt * 12 : undefined,
          custom_d_in: custom ? custom.dFt * 12 : undefined,
        });
      }
    }
    return list;
  }, [counts, customDims]);

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
  } = useSolve({
    plotWIn: plot.widthIn,
    plotDIn: plot.depthIn,
    facing,
    rooms: roomListWithSpecs,
    setback: DEFAULT_SETBACK,
    program: programKey,
  });

  // Why the viewport is empty, when it is. Every one of these used to render as a blank screen
  // that looks like a rendering bug and is not one: a backend that predates a space in the mix
  // rejects it by name and returns nothing at all. `staleBackend` already existed for the
  // related case and was computed but never shown.
  const requestedSpaceCount = roomListWithSpecs.length;
  const solverNotice: { title: string; detail: string } | null = (() => {
    if (pending) return null;
    if (error) {
      return {
        title: "The solver rejected the request",
        detail: `${error}. Check the backend terminal, then reload.`,
      };
    }
    const unknown = meta?.unknown_room_names ?? [];
    if (unknown.length > 0) {
      return {
        title: `The solver does not know ${unknown.length} of these spaces`,
        detail: `It rejected ${unknown.join(", ")}. This is almost always a backend started before those spaces existed - restart it with "cd backend && .venv/Scripts/python.exe -m uvicorn api.main:app --reload".`,
      };
    }
    if (requestedSpaceCount > 0 && solvedRooms.length === 0) {
      return {
        title: "The solver returned no layout",
        detail: `Status ${meta?.status ?? "unknown"}. The programme may not fit this plot - remove a space or enlarge the plot.`,
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
    [setRoomPositions, resetPositions]
  );


  const handleApplyModelBlueprint = (
    bp: ModelBlueprint,
    targetMode: "blueprint" | "orbit" | "walkthrough" = "blueprint"
  ) => {
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
    setCounts(withCounts(bp.counts));
    setCustomDims(bp.customDims);
    setCustomOpenings(bp.customOpenings ?? {});
    setCustomWallThickness(bp.customWallThickness ?? {});
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

  const buildableW = useMemo(() => buildableWidthIn(plot, facing, DEFAULT_SETBACK), [plot, facing]);
  const buildableD = useMemo(() => buildableDepthIn(plot, facing, DEFAULT_SETBACK), [plot, facing]);

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
      if (selectedObjectInfo.isWall) {
        handleToggleRemoveWall(selectedObjectInfo.roomIndex ?? 0, selectedObjectInfo.edge ?? "N");
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

  // Global Keyboard shortcuts (Escape, Delete, Backspace, KeyR)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Escape") {
        setPlacingItemType(null);
        setPlacingRotationY(0);
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
  }, [placingItemType, selectedObjectId, selectedObjectInfo, handleDeleteSelected, handleRotateSelected, handleRotatePlacing, handleToggleLights, handleMoveSelected, setIsUpgraded, setIsRaytracing]);

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
        onOpenCustomWallBlendModal={() => setIsCustomWallBlendModalOpen(true)}



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
        activeFloor={activeFloor}
        onChangeActiveFloor={setActiveFloor}
        activeCadTool={activeCadTool}
        onChangeCadTool={setActiveCadTool}
        activeWallType={activeWallType}
        onChangeWallType={setActiveWallType}
        onToggleDoorsWindowsDrawer={() => setIsDoorsWindowsDrawerOpen((prev) => !prev)}
        isDoorsWindowsDrawerOpen={isDoorsWindowsDrawerOpen}
        onPromptToSimulate={handlePromptToSimulate}
        isSimulatingPrompt={isSimulatingPrompt}
      />


      <main className={styles.mainLayout}>
        {/* Interior design tool rail (furniture, finishes, object management) */}
        <LeftToolRail
          program={program}
          placingItemType={placingItemType}
          onSelectPlaceItem={(type) => {
            setPlacingItemType(type);
            if (!type) setPlacingRotationY(0);
          }}
          materialConfig={materialConfig}
          onChangeMaterialConfig={setMaterialConfig}
          onOpenMaterialModal={() => setIsMaterialModalOpen(true)}
          onOpenAIFurnitureModal={() => setIsAIFurnitureModalOpen(true)}
          onOpenCustomWallBlendModal={() => setIsCustomWallBlendModalOpen(true)}
          totalPlacedCount={customObjects.length}

          deletedBuiltinCount={deletedBuiltinIds.length}
          onRestoreDefaults={handleRestoreDefaults}
          onClearAllFurniture={handleClearAllFurniture}
        />

        <section className={styles.viewport}>
          {solverNotice && (
            <div className={styles.solverNotice} role="alert">
              <div className={styles.solverNoticeTitle}>⚠ {solverNotice.title}</div>
              <div className={styles.solverNoticeDetail}>{solverNotice.detail}</div>
            </div>
          )}

          {mode === "blueprint" ? (
            /* 2D Architectural Blueprint View */
            <Blueprint2DView
              spaces={program.spaces}
              plot={plot}
              facing={facing}
              setback={DEFAULT_SETBACK}
              rooms={rooms}
              meta={meta}
              counts={counts}
              customDims={customDims}
              customOpenings={customOpenings}
              customWallThickness={customWallThickness}
              customWalls={customWalls}
              onChangeCustomWalls={setCustomWalls}
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
              onRoomMove={moveRoom}
              onRoomResize={handleRoomResize}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
              onApplyBlueprint={handleApplyModelBlueprint}
              onStartFromScratch={handleStartFromScratch}
            />
          ) : (
            /* 3D Three.js Scene Viewport */
            <>
              <Scene
                plot={plot}
                facing={facing}
                rooms={rooms}
                customOpenings={customOpenings}
                customWalls={customWalls}
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
                setback={DEFAULT_SETBACK}
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
                windowConfig={windowConfig}
                onChangeWindowConfig={setWindowConfig}
                placingOpeningDef={placingOpeningDef}
                onSelectPlaceOpening={handleSelectPlaceOpening}
                isLayoutLocked={isLayoutLocked}
                onToggleLayoutLock={handleToggleLayoutLock}
                customObjects={customObjects}
                deletedBuiltinIds={deletedBuiltinIds}
                placingItemType={placingItemType}
                placingRotationY={placingRotationY}
                selectedObjectId={selectedObjectId}
                selectedObjectInfo={selectedObjectInfo}
                onPlotChange={setPlot}
                onPlayerUpdate={setPlayer}
                onToggleLights={handleToggleLights}
                onRoomMove={moveRoom}
                onRoomResize={handleRoomResize}
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
              />

              {/* Orbit View HUD Overlay */}
              {mode === "orbit" && (
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

                  {/* 3D Minimap Radar */}
                  <Minimap
                    plot={plot}
                    facing={facing}
                    rooms={rooms}
                    player={player}
                    currentRoomIndex={currentRoomIndex}
                    onTeleport={handleTeleport}
                  />
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
                  onMoveCmdChange={setActiveMoveCmd}
                  onExit={() => setMode("orbit")}
                  onToggleLights={handleToggleLights}
                  onTeleport={handleTeleportToRoomIndex}
                />
              )}
            </>
          )}
        </section>
      </main>

      {/* Room Dimensions & Sizing Studio Modal */}
      <RoomDimensionsModal
        isOpen={isRoomDimensionsOpen}
        onClose={() => setIsRoomDimensionsOpen(false)}
        counts={counts}
        rooms={rooms}
        customDims={customDims}
        onChangeCustomDims={setCustomDims}
      />

      {/* Materials & Finishes Studio Dialog Modal */}
      <MaterialCustomizerModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        config={materialConfig}
        onChangeConfig={setMaterialConfig}
        activeRooms={Object.keys(counts).filter((k) => (counts[k as RoomName] || 0) > 0) as RoomName[]}
      />

      {/* Architectural Window Shapes & Fenestration Studio Modal */}
      <WindowShapeModal
        isOpen={isWindowModalOpen}
        onClose={() => setIsWindowModalOpen(false)}
        config={windowConfig}
        onChangeConfig={setWindowConfig}
        rooms={rooms}
        selectedWindowId={selectedObject?.isWindow ? selectedObject.id : null}
        onAddWindow={handleAddWindowToWall}
      />

      {/* Architectural Blueprint Export Dialog Modal */}
      <BlueprintExportModal
        quantities={quantities}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plot={plot}
        facing={facing}
        setback={DEFAULT_SETBACK}
        rooms={rooms}
        meta={meta}
      />

      {/* Curated Model Blueprints Catalog Modal */}
      <ModelBlueprintsModal
        program={program}
        isOpen={isModelBlueprintsOpen}
        onClose={() => setIsModelBlueprintsOpen(false)}
        onSelectBlueprint={handleApplyModelBlueprint}
      />

      {/* Interactive 3D Object Replacement Modal */}
      <ReplaceObjectModal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        targetObjectName={selectedObjectInfo?.name || "Selected Object"}
        targetItemType={selectedObjectInfo?.type}
        onConfirmReplace={handleReplaceSelected}
      />

      {/* Doors & Windows Drag & Drop Catalog Shelf */}
      <DoorsWindowsDrawer
        isOpen={isDoorsWindowsDrawerOpen}
        onToggleOpen={() => setIsDoorsWindowsDrawerOpen((prev) => !prev)}
        placingOpeningDef={placingOpeningDef}
        onSelectPlaceOpening={handleSelectPlaceOpening}
        onOpenWindowShapeModal={() => setIsWindowModalOpen(true)}
      />

      {/* AI Photo-to-3D Furniture Studio Modal */}
      <AIFurnitureStudioModal
        isOpen={isAIFurnitureModalOpen}
        onClose={() => setIsAIFurnitureModalOpen(false)}
        onSpawnFurniture={handleSpawnAIFurniture}
      />

      {/* AAA Game-Style Graphics Control Studio Modal */}
      <GraphicsControlModal
        isOpen={isGraphicsModalOpen}
        onClose={() => setIsGraphicsModalOpen(false)}
        settings={graphicsSettings}
        onChangeSettings={setGraphicsSettings}
      />

      {/* Engineering Bill of Quantities (BOQ) & Cost Takeoff Modal */}
      <BOQCostModal
        isOpen={isBOQModalOpen}
        onClose={() => setIsBOQModalOpen(false)}
        plot={plot}
        facing={facing}
        rooms={rooms}
      />

      {/* Custom Wall Partitions & Permutations Studio Modal */}
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
