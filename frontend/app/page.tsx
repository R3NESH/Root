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
import { findAdjacentRoomEdge, RoomName, ROOM_NAMES, ROOM_LABELS } from "@/lib/rooms";
import { useSolve } from "@/lib/useSolve";
import { RoomOpening, RoomSpecIn } from "@/lib/solve";
import { feetToInches, inchesToFeet } from "@/lib/units";
import { ModelBlueprint } from "@/lib/modelBlueprints";
import ModelBlueprintsModal from "@/components/ModelBlueprintsModal";
import MaterialCustomizerModal from "@/components/MaterialCustomizerModal";
import WindowShapeModal from "@/components/WindowShapeModal";
import TopRibbonTaskbar from "@/components/TopRibbonTaskbar";
import ReplaceObjectModal from "@/components/ReplaceObjectModal";
import DoorsWindowsDrawer from "@/components/DoorsWindowsDrawer";
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
import { clearProject, loadProject, saveProject } from "@/lib/projectStorage";
import styles from "./page.module.css";

const DEFAULT_COUNTS: Record<RoomName, number> = {
  hall: 1,
  dining: 1,
  kitchen: 1,
  bedroom: 2,
  bathroom: 1,
  pooja: 0,
  store: 0,
  entrance: 0,
};

export default function Home() {
  const [plot, setPlot] = useState<PlotDims>(DEFAULT_PLOT);
  const [facing, setFacing] = useState<Facing>("N");
  const [counts, setCounts] = useState<Record<RoomName, number>>(DEFAULT_COUNTS);
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
  const [placingOpeningDef, setPlacingOpeningDef] = useState<OpeningItemDef | null>(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

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
  });

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

  const handleApplyModelBlueprint = (
    bp: ModelBlueprint,
    targetMode: "blueprint" | "orbit" | "walkthrough" = "blueprint"
  ) => {
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
    setCounts(bp.counts);
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

  // Start From Scratch Blank Canvas Mode: Clears automated pre-built rooms to allow 100% custom CAD drafting
  const handleStartFromScratch = useCallback(() => {
    resetPositions();
    setActiveBlueprintName("Custom Freehand Draft");
    setCounts({
      hall: 0,
      dining: 0,
      kitchen: 0,
      bedroom: 0,
      bathroom: 0,
      pooja: 0,
      store: 0,
      entrance: 0,
    });
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
      } else if (e.code === "KeyL") {
        handleToggleLayoutLock();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [placingItemType, selectedObjectId, selectedObjectInfo, handleDeleteSelected, handleRotateSelected, handleRotatePlacing, handleToggleLayoutLock, handleMoveSelected]);

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
        isLayoutLocked={isLayoutLocked}
        onToggleLayoutLock={handleToggleLayoutLock}
        onOpenMaterialModal={() => setIsMaterialModalOpen(true)}
        onOpenWindowModal={() => setIsWindowModalOpen(true)}
        onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenRoomDimensionsModal={() => setIsRoomDimensionsOpen(true)}
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
        onClearAllFurniture={handleClearAllFurniture}
        onDeselectObject={() => {
          setSelectedObjectId(null);
          setSelectedObjectInfo(null);
        }}
        totalPlacedCount={customObjects.length}
        deletedBuiltinCount={deletedBuiltinIds.length}
        onRestoreDefaults={handleRestoreDefaults}
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
      />

      <main className={styles.mainLayout}>
        <section className={styles.viewport}>
          {mode === "blueprint" ? (
            /* 2D Architectural Blueprint View */
            <Blueprint2DView
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
                teleportTarget={teleportTarget}
                lightsOn={lightsOn}
                furnished={furnished}
                materialConfig={materialConfig}
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
    </div>
  );
}
