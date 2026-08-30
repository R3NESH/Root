"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { PlotDims, Facing, Setback, edgeSetbacksIn, frontCardinalIndex } from "@/lib/plot";
import { RoomOpening, SolvedRoom, SolveMeta } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import { ROOM_COLORS, ROOM_LABELS, ROOM_NAMES, RoomName } from "@/lib/rooms";
import { CustomDim } from "./RoomCustomizer";
import { ModelBlueprint } from "@/lib/modelBlueprints";
import {
  formatFeetInches,
  formatAreaSqFt,
  getRoomVaastuZone,
  VAASTU_ZONE_LABELS,
} from "@/lib/blueprintExport";
import {
  CustomDrawnWall,
  CustomRoomZone,
  CustomWallOpening,
  CustomWallType,
  WALL_TYPE_CONFIGS,
  getWallAngleRad,
  getWallLengthIn,
} from "@/lib/customArchitecture";
import styles from "./Blueprint2DView.module.css";

type CropHandle = "N" | "S" | "E" | "W" | "NW" | "NE" | "SW" | "SE";

interface Blueprint2DViewProps {
  plot: PlotDims;
  facing: Facing;
  setback: Setback;
  rooms: SolvedRoom[];
  meta: SolveMeta | null;
  counts: Record<RoomName, number>;
  customDims: Record<string, CustomDim>;
  customOpenings?: Record<string, RoomOpening[]>;
  customWallThickness?: Record<string, number>;
  customWalls?: CustomDrawnWall[];
  onChangeCustomWalls?: (walls: CustomDrawnWall[]) => void;
  customRoomZones?: CustomRoomZone[];
  onChangeCustomRoomZones?: (zones: CustomRoomZone[]) => void;
  activeCadTool?: "select" | "draw_wall" | "place_door" | "place_window" | "tag_room";
  onChangeCadTool?: (tool: "select" | "draw_wall" | "place_door" | "place_window" | "tag_room") => void;
  activeWallType?: CustomWallType;
  onChangeWallType?: (type: CustomWallType) => void;
  activeBlueprintName?: string | null;
  onChangeCounts: (counts: Record<RoomName, number>) => void;
  onChangeCustomDims: (dims: Record<string, CustomDim>) => void;
  onChangeCustomOpenings?: (openings: Record<string, RoomOpening[]>) => void;
  onChangeCustomWallThickness?: (thickness: Record<string, number>) => void;
  onRoomMove?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => void;
  onRoomResize?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number, targetWIn: number, targetDIn: number) => void;
  onOpenExportModal: () => void;
  onOpenModelBlueprintsModal?: () => void;
  onApplyBlueprint?: (
    blueprint: ModelBlueprint,
    targetMode?: "blueprint" | "orbit" | "walkthrough"
  ) => void;
  onStartFromScratch?: () => void;
  activeFloor?: number;
  onChangeActiveFloor?: (floor: number) => void;
}

export default function Blueprint2DView({
  plot,
  facing,
  setback,
  rooms,
  counts,
  customDims,
  customOpenings,
  customWallThickness,
  customWalls = [],
  onChangeCustomWalls,
  customRoomZones = [],
  onChangeCustomRoomZones,
  activeFloor = 0,
  onChangeActiveFloor,
  activeCadTool = "select",
  onChangeCadTool,
  activeWallType = "exterior",
  onChangeWallType,
  activeBlueprintName,
  onChangeCounts,
  onChangeCustomDims,
  onChangeCustomOpenings,
  onChangeCustomWallThickness,
  onRoomMove,
  onRoomResize,
  onOpenExportModal,
  onOpenModelBlueprintsModal,
  onApplyBlueprint,
  onStartFromScratch,
}: Blueprint2DViewProps) {
  // Layer visibility state
  const [showDimensions, setShowDimensions] = useState(true);
  const [showSetbacks, setShowSetbacks] = useState(true);
  const [showVaastuGrid, setShowVaastuGrid] = useState(true);
  const [showBadges, setShowBadges] = useState(true);

  // Selection states
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [selectedWallEdge, setSelectedWallEdge] = useState<"N" | "S" | "E" | "W" | null>(null);
  const [selectedOpeningIndex, setSelectedOpeningIndex] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"room" | "wall" | "door">("room");

  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag-to-Move & Auto-Crop Room State
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffsetIn, setDragOffsetIn] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragStartMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRoomRef = useRef(false);
  const [autoCropOnDrag, setAutoCropOnDrag] = useState(true);
  const [roomCropDragPreview, setRoomCropDragPreview] = useState<{
    x_in: number;
    y_in: number;
    w_in: number;
    d_in: number;
    isCropped: boolean;
    rawLeft: number;
    rawTop: number;
    originalW: number;
    originalD: number;
  } | null>(null);
  const [cropToast, setCropToast] = useState<string | null>(null);

  // Shortcut key listener (KeyC to toggle auto crop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "KeyC") {
        setAutoCropOnDrag((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag-to-Resize Wall State
  const [draggingWall, setDraggingWall] = useState<{
    roomIndex: number;
    edge: "N" | "S" | "E" | "W";
    startMouse: { x: number; y: number };
    initialW: number;
    initialD: number;
  } | null>(null);

  // Crop-Resize State (image-crop style — 8 directional handles)
  const [draggingCrop, setDraggingCrop] = useState<{
    roomIndex: number;
    handle: CropHandle;
    startMouse: { x: number; y: number };
    initialX: number;  // room.x_in
    initialY: number;  // room.y_in
    initialW: number;  // room.w_in
    initialD: number;  // room.d_in
  } | null>(null);
  // Live preview of crop dimensions during drag
  const [cropPreview, setCropPreview] = useState<{
    x_in: number; y_in: number; w_in: number; d_in: number;
  } | null>(null);

  // Drag-to-Slide / Resize Opening State
  const [draggingOpening, setDraggingOpening] = useState<{
    roomIndex: number;
    openingIndex: number;
    action: "slide" | "resize";
    startMouse: { x: number; y: number };
    initialOffset: number;
    initialWidth: number;
  } | null>(null);

  // CAD Drafting State (for Build From Scratch Mode)
  const svgRef = useRef<SVGSVGElement>(null);
  const [draftWallStart, setDraftWallStart] = useState<{ xIn: number; yIn: number } | null>(null);
  const [draftWallCurrent, setDraftWallCurrent] = useState<{
    xIn: number;
    yIn: number;
    lengthIn: number;
    angleDeg: number;
  } | null>(null);
  const [selectedCustomWallId, setSelectedCustomWallId] = useState<string | null>(null);
  const [selectedCustomZoneId, setSelectedCustomZoneId] = useState<string | null>(null);
  const [hoveredWallInfo, setHoveredWallInfo] = useState<{
    wallId: string;
    offsetIn: number;
    px: number;
    py: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const quickImportFileRef = useRef<HTMLInputElement>(null);

  const handleQuickImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const widthFt = parsed.plotWidthFt || (parsed.plotWIn ? Math.round(parsed.plotWIn / 12) : 30);
        const depthFt = parsed.plotDepthFt || (parsed.plotDIn ? Math.round(parsed.plotDIn / 12) : 40);
        const facingVal = parsed.facing || "N";
        const countsVal =
          parsed.counts || {
            hall: 1,
            kitchen: 1,
            bedroom: 2,
            bathroom: 1,
            dining: 0,
            pooja: 0,
            store: 0,
          };
        const customDimsVal = parsed.customDims || {};
        const customOpeningsVal = parsed.customOpenings || {};
        const customWallThicknessVal = parsed.customWallThickness || {};

        const newBlueprint: ModelBlueprint = {
          id: `custom_import_${Date.now()}`,
          name: parsed.name || file.name.replace(/\.json$/i, "") || "Imported Custom Blueprint",
          type: parsed.type || "2BHK",
          plotSizeLabel: `${widthFt}×${depthFt} (${widthFt * depthFt} sq ft)`,
          plotWidthFt: widthFt,
          plotDepthFt: depthFt,
          facing: facingVal,
          builtUpAreaSqFt: parsed.builtUpAreaSqFt || Math.round(widthFt * depthFt * 0.75),
          totalSqFt: widthFt * depthFt,
          vaastuRating: parsed.vaastuRating || "Custom Imported Plan",
          description: parsed.description || "User-imported architectural blueprint model.",
          highlights: parsed.highlights || ["Custom Imported Plan", "Ready to Build in 2D & 3D"],
          counts: countsVal,
          customDims: customDimsVal,
          customOpenings: customOpeningsVal,
          customWallThickness: customWallThicknessVal,
        };

        if (onApplyBlueprint) {
          onApplyBlueprint(newBlueprint, "blueprint");
        }
      } catch (err) {
        console.error("Failed to parse blueprint JSON:", err);
        alert("Invalid blueprint JSON file. Please ensure the file contains valid blueprint data.");
      }
    };
    reader.readAsText(file);
  };

  // Measurements
  const [setbackN, setbackE, setbackS, setbackW] = edgeSetbacksIn(facing, setback);
  const frontIdx = frontCardinalIndex(facing);
  const facingNames = ["NORTH", "EAST", "SOUTH", "WEST"];
  const roadLabel = `ROAD / FRONT (${facingNames[frontIdx]})`;

  const envW = Math.max(0, plot.widthIn - setbackW - setbackE);
  const envD = Math.max(0, plot.depthIn - setbackN - setbackS);

  // Base SVG dimensions for coordinate system
  const VIEW_W = 1200;
  const VIEW_H = 850;
  const PADDING = 140;

  const drawW = VIEW_W - PADDING * 2;
  const drawH = VIEW_H - PADDING * 2;

  const baseScale = Math.min(drawW / Math.max(plot.widthIn, 1), drawH / Math.max(plot.depthIn, 1));
  const originX = PADDING + (drawW - plot.widthIn * baseScale) / 2;
  const originY = PADDING + (drawH - plot.depthIn * baseScale) / 2;

  const toPxX = (xIn: number) => originX + xIn * baseScale;
  const toPxY = (yIn: number) => originY + yIn * baseScale;

  const plotPxX = toPxX(0);
  const plotPxY = toPxY(0);
  const plotPxW = plot.widthIn * baseScale;
  const plotPxH = plot.depthIn * baseScale;

  const envPxX = toPxX(setbackW);
  const envPxY = toPxY(setbackN);
  const envPxW = envW * baseScale;
  const envPxH = envD * baseScale;

  // Selected room details
  const selectedRoom = selectedRoomIndex !== null ? rooms[selectedRoomIndex] : null;
  const selectedOpening =
    selectedRoom && selectedOpeningIndex !== null && selectedRoom.openings
      ? selectedRoom.openings[selectedOpeningIndex]
      : null;

  // Compute room ID from room list index
  const getRoomIdFromIndex = useCallback(
    (index: number) => {
      let curr = 0;
      for (const name of ROOM_NAMES) {
        const count = counts[name] ?? 0;
        for (let c = 0; c < count; c++) {
          if (curr === index) return `${name}_${c}`;
          curr++;
        }
      }
      return rooms[index] ? `${rooms[index].name}_0` : `room_${index}`;
    },
    [counts, rooms]
  );

  // Helper to update openings for a room
  const updateRoomOpenings = useCallback(
    (roomIdx: number, newOpenings: RoomOpening[]) => {
      if (!onChangeCustomOpenings) return;
      const id = getRoomIdFromIndex(roomIdx);
      onChangeCustomOpenings({
        ...(customOpenings ?? {}),
        [id]: newOpenings,
      });
    },
    [getRoomIdFromIndex, customOpenings, onChangeCustomOpenings]
  );

  // Helper to update wall thickness for a room
  const updateRoomWallThickness = useCallback(
    (roomIdx: number, thicknessIn: number) => {
      if (!onChangeCustomWallThickness) return;
      const id = getRoomIdFromIndex(roomIdx);
      onChangeCustomWallThickness({
        ...(customWallThickness ?? {}),
        [id]: thicknessIn,
      });
    },
    [getRoomIdFromIndex, customWallThickness, onChangeCustomWallThickness]
  );

  // Convert screen mouse coordinates into untransformed plot inches
  const getSvgInchesCoords = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { xIn: 0, yIn: 0, pxX: 0, pxY: 0 };
      const rect = svg.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (VIEW_W / rect.width);
      const screenY = (e.clientY - rect.top) * (VIEW_H / rect.height);

      // Invert pan & zoom transform
      const untransformedX = (screenX - (VIEW_W / 2 + pan.x)) / zoom + VIEW_W / 2;
      const untransformedY = (screenY - (VIEW_H / 2 + pan.y)) / zoom + VIEW_H / 2;

      const xIn = Math.round((untransformedX - originX) / baseScale);
      const yIn = Math.round((untransformedY - originY) / baseScale);

      return { xIn, yIn, pxX: untransformedX, pxY: untransformedY };
    },
    [pan, zoom, originX, originY, baseScale]
  );

  // Snapping helper: grid, corner magnet, and orthogonal angle snapping
  const getOrthoAndSnappedCoords = useCallback(
    (rawXIn: number, rawYIn: number, startXIn?: number, startYIn?: number) => {
      let snapX = Math.round(rawXIn / 6) * 6;
      let snapY = Math.round(rawYIn / 6) * 6;

      // 1. Magnetic corner snap to existing custom walls
      for (const w of customWalls) {
        if (Math.hypot(snapX - w.startXIn, snapY - w.startYIn) <= 14) {
          snapX = w.startXIn;
          snapY = w.startYIn;
          break;
        }
        if (Math.hypot(snapX - w.endXIn, snapY - w.endYIn) <= 14) {
          snapX = w.endXIn;
          snapY = w.endYIn;
          break;
        }
      }

      // 2. Orthogonal angle snapping (0°, 90°, 45°) if a wall start point exists
      if (startXIn !== undefined && startYIn !== undefined) {
        const dx = snapX - startXIn;
        const dy = snapY - startYIn;
        const dist = Math.hypot(dx, dy);
        if (dist > 12) {
          const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          if (angleDeg < 18 || angleDeg > 342 || (angleDeg > 162 && angleDeg < 198)) {
            snapY = startYIn;
          } else if ((angleDeg > 72 && angleDeg < 108) || (angleDeg > 252 && angleDeg < 288)) {
            snapX = startXIn;
          }
        }
      }

      return { snapX, snapY };
    },
    [customWalls]
  );

  // Escape key cancels drafting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraftWallStart(null);
        setDraftWallCurrent(null);
        onChangeCadTool?.("select");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChangeCadTool]);

  // Mouse pan & drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const coords = getSvgInchesCoords(e);
    const { snapX, snapY } = getOrthoAndSnappedCoords(
      coords.xIn,
      coords.yIn,
      draftWallStart?.xIn,
      draftWallStart?.yIn
    );

    // CAD Tool 1: Draw Custom Wall
    if (activeCadTool === "draw_wall") {
      if (!draftWallStart) {
        setDraftWallStart({ xIn: snapX, yIn: snapY });
      } else {
        const lenIn = Math.hypot(snapX - draftWallStart.xIn, snapY - draftWallStart.yIn);
        if (lenIn >= 12) {
          const newWall: CustomDrawnWall = {
            id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            floor: activeFloor,
            startXIn: draftWallStart.xIn,
            startYIn: draftWallStart.yIn,
            endXIn: snapX,
            endYIn: snapY,
            wallType: activeWallType,
            thicknessIn: WALL_TYPE_CONFIGS[activeWallType]?.thicknessIn ?? 9.0,
            heightFt: 9.0,
            openings: [],
          };
          onChangeCustomWalls?.([...customWalls, newWall]);
          // Continuous wall drawing: start next wall from endpoint
          setDraftWallStart({ xIn: snapX, yIn: snapY });
        }
      }
      return;
    }

    // CAD Tool 2 & 3: Place Door or Window on Wall
    if (activeCadTool === "place_door" || activeCadTool === "place_window") {
      if (hoveredWallInfo) {
        const wall = customWalls.find((w) => w.id === hoveredWallInfo.wallId);
        if (wall) {
          const isWindow = activeCadTool === "place_window";
          const widthIn = isWindow ? 48 : 36;
          const newOpening: CustomWallOpening = {
            id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            kind: isWindow ? "window" : "door",
            offsetIn: Math.max(0, hoveredWallInfo.offsetIn - widthIn / 2),
            widthIn,
            heightIn: isWindow ? 48 : 84,
            sillIn: isWindow ? 34 : 0,
          };
          const updated = customWalls.map((cw) =>
            cw.id === wall.id ? { ...cw, openings: [...(cw.openings || []), newOpening] } : cw
          );
          onChangeCustomWalls?.(updated);
        }
      }
      return;
    }

    // CAD Tool 4: Tag Room Zone / Floor Slab
    if (activeCadTool === "tag_room") {
      const posXIn = snapX;
      const posZIn = snapY;

      const currentFloorWalls = customWalls.filter((w) => (w.floor ?? 0) === activeFloor);
      let minXIn = posXIn - 72;
      let maxXIn = posXIn + 72;
      let minZIn = posZIn - 72;
      let maxZIn = posZIn + 72;

      if (currentFloorWalls.length >= 2) {
        const allXs = currentFloorWalls.flatMap((w) => [w.startXIn, w.endXIn]);
        const allZs = currentFloorWalls.flatMap((w) => [w.startYIn, w.endYIn]);

        const lefts = allXs.filter((x) => x <= posXIn);
        const rights = allXs.filter((x) => x >= posXIn);
        const tops = allZs.filter((z) => z <= posZIn);
        const bottoms = allZs.filter((z) => z >= posZIn);

        if (lefts.length && rights.length && tops.length && bottoms.length) {
          minXIn = Math.max(...lefts);
          maxXIn = Math.min(...rights);
          minZIn = Math.max(...tops);
          maxZIn = Math.min(...bottoms);
        }
      }

      const wIn = Math.max(36, maxXIn - minXIn);
      const dIn = Math.max(36, maxZIn - minZIn);
      const areaSqFt = Math.round(((wIn * dIn) / 144) * 10) / 10;

      const newZone: CustomRoomZone = {
        id: `zone_${Date.now()}`,
        floor: activeFloor,
        name: "hall",
        customLabel: "Living Hall",
        xIn: minXIn,
        yIn: minZIn,
        wIn,
        dIn,
        areaSqFt,
      };
      onChangeCustomRoomZones?.([...customRoomZones, newZone]);
      onChangeCadTool?.("select");
      return;
    }

    if (!isDraggingRoomRef.current && !draggingWall && !draggingOpening && !draggingCrop) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getSvgInchesCoords(e);

    // 0a. CAD Wall Drafting Live Rubberband Preview
    if (activeCadTool === "draw_wall" && draftWallStart) {
      const { snapX, snapY } = getOrthoAndSnappedCoords(
        coords.xIn,
        coords.yIn,
        draftWallStart.xIn,
        draftWallStart.yIn
      );
      const lenIn = Math.hypot(snapX - draftWallStart.xIn, snapY - draftWallStart.yIn);
      const angleDeg = ((Math.atan2(snapY - draftWallStart.yIn, snapX - draftWallStart.xIn) * 180) / Math.PI + 360) % 360;
      setDraftWallCurrent({
        xIn: snapX,
        yIn: snapY,
        lengthIn: lenIn,
        angleDeg,
      });
      return;
    }

    // 0b. CAD Door / Window Hover Wall Projection
    if (activeCadTool === "place_door" || activeCadTool === "place_window") {
      let closestHit: { wallId: string; offsetIn: number; px: number; py: number } | null = null;
      let closestDist = 30; // max snap distance in px

      for (const w of customWalls) {
        const dx = w.endXIn - w.startXIn;
        const dy = w.endYIn - w.startYIn;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;

        const t = Math.max(
          0,
          Math.min(1, ((coords.xIn - w.startXIn) * dx + (coords.yIn - w.startYIn) * dy) / (len * len))
        );
        const projXIn = w.startXIn + t * dx;
        const projYIn = w.startYIn + t * dy;
        const distPx = Math.hypot(coords.pxX - toPxX(projXIn), coords.pxY - toPxY(projYIn));

        if (distPx < closestDist) {
          closestDist = distPx;
          closestHit = {
            wallId: w.id,
            offsetIn: Math.round(t * len),
            px: toPxX(projXIn),
            py: toPxY(projYIn),
          };
        }
      }
      setHoveredWallInfo(closestHit);
      return;
    }
    // 1. Room Dragging & Map Boundary Cropping
    if (isDraggingRoomRef.current && draggingIndex !== null) {
      const deltaScreenX = (e.clientX - dragStartMouseRef.current.x) / zoom;
      const deltaScreenY = (e.clientY - dragStartMouseRef.current.y) / zoom;

      const deltaInchesX = Math.round(deltaScreenX / baseScale);
      const deltaInchesY = Math.round(deltaScreenY / baseScale);

      setDragOffsetIn({ dx: deltaInchesX, dy: deltaInchesY });

      const room = rooms[draggingIndex];
      if (room) {
        const rawLeft = room.x_in + deltaInchesX;
        const rawTop = room.y_in + deltaInchesY;
        const rawRight = rawLeft + room.w_in;
        const rawBottom = rawTop + room.d_in;

        const minX = setbackW;
        const maxX = setbackW + envW;
        const minY = setbackN;
        const maxY = setbackN + envD;
        const MIN_IN = 4 * 12; // 4 ft minimum

        if (autoCropOnDrag) {
          // If the room is dragged past boundaries, crop/trim dimensions dynamically
          const cropLeft = Math.max(minX, Math.min(rawLeft, maxX - MIN_IN));
          const cropRight = Math.min(maxX, Math.max(rawRight, minX + MIN_IN));
          const cropTop = Math.max(minY, Math.min(rawTop, maxY - MIN_IN));
          const cropBottom = Math.min(maxY, Math.max(rawBottom, minY + MIN_IN));

          const croppedW = Math.max(MIN_IN, cropRight - cropLeft);
          const croppedD = Math.max(MIN_IN, cropBottom - cropTop);
          const isCropped = croppedW !== room.w_in || croppedD !== room.d_in;

          setRoomCropDragPreview({
            x_in: cropLeft,
            y_in: cropTop,
            w_in: croppedW,
            d_in: croppedD,
            isCropped,
            rawLeft,
            rawTop,
            originalW: room.w_in,
            originalD: room.d_in,
          });
        } else {
          setRoomCropDragPreview(null);
        }
      }
      return;
    }

    // 2a. Crop-Resize (image-crop style, 8 directional handles)
    if (draggingCrop) {
      const dx = Math.round(((e.clientX - draggingCrop.startMouse.x) / zoom) / baseScale);
      const dy = Math.round(((e.clientY - draggingCrop.startMouse.y) / zoom) / baseScale);
      const MIN_IN = 4 * 12; // 4 ft minimum
      const { handle, initialX, initialY, initialW, initialD } = draggingCrop;

      let newX = initialX, newY = initialY, newW = initialW, newD = initialD;

      // East / West edges control width
      if (handle.includes("E")) {
        newW = Math.max(MIN_IN, initialW + dx);
      }
      if (handle.includes("W")) {
        const clamped = Math.max(MIN_IN, initialW - dx);
        newX = initialX + (initialW - clamped);
        newW = clamped;
      }
      // North / South edges control depth
      if (handle.includes("S")) {
        newD = Math.max(MIN_IN, initialD + dy);
      }
      if (handle.includes("N")) {
        const clamped = Math.max(MIN_IN, initialD - dy);
        newY = initialY + (initialD - clamped);
        newD = clamped;
      }

      setCropPreview({ x_in: newX, y_in: newY, w_in: newW, d_in: newD });
      return;
    }

    // 2b. Wall Drag Resizing
    if (draggingWall) {
      const deltaScreenX = (e.clientX - draggingWall.startMouse.x) / zoom;
      const deltaScreenY = (e.clientY - draggingWall.startMouse.y) / zoom;
      const deltaInchesX = Math.round(deltaScreenX / baseScale);
      const deltaInchesY = Math.round(deltaScreenY / baseScale);
      const id = getRoomIdFromIndex(draggingWall.roomIndex);

      if (draggingWall.edge === "E" || draggingWall.edge === "W") {
        const sign = draggingWall.edge === "E" ? 1 : -1;
        const deltaFt = Math.round((deltaInchesX * sign) / 12);
        const nextWFt = Math.max(4, Math.min(35, draggingWall.initialW + deltaFt));
        onChangeCustomDims({
          ...customDims,
          [id]: {
            wFt: nextWFt,
            dFt: draggingWall.initialD,
          },
        });
      } else {
        const sign = draggingWall.edge === "S" ? 1 : -1;
        const deltaFt = Math.round((deltaInchesY * sign) / 12);
        const nextDFt = Math.max(4, Math.min(35, draggingWall.initialD + deltaFt));
        onChangeCustomDims({
          ...customDims,
          [id]: {
            wFt: draggingWall.initialW,
            dFt: nextDFt,
          },
        });
      }
      return;
    }

    // 3. Opening Dragging (Slide or Resize)
    if (draggingOpening) {
      const deltaScreenX = (e.clientX - draggingOpening.startMouse.x) / zoom;
      const deltaScreenY = (e.clientY - draggingOpening.startMouse.y) / zoom;
      const deltaInchesX = Math.round(deltaScreenX / baseScale);
      const deltaInchesY = Math.round(deltaScreenY / baseScale);

      const targetRoom = rooms[draggingOpening.roomIndex];
      if (!targetRoom || !targetRoom.openings) return;
      const currentOps = [...targetRoom.openings];
      const targetOp = currentOps[draggingOpening.openingIndex];
      if (!targetOp) return;

      const isHoriz = targetOp.edge === "N" || targetOp.edge === "S";
      const wallLenIn = isHoriz ? targetRoom.w_in : targetRoom.d_in;

      if (draggingOpening.action === "slide") {
        const deltaEdge = isHoriz ? deltaInchesX : deltaInchesY;
        const nextOffset = Math.max(
          0,
          Math.min(wallLenIn - targetOp.width_in, draggingOpening.initialOffset + deltaEdge)
        );
        currentOps[draggingOpening.openingIndex] = {
          ...targetOp,
          offset_in: Math.round(nextOffset),
        };
        updateRoomOpenings(draggingOpening.roomIndex, currentOps);
      } else if (draggingOpening.action === "resize") {
        const deltaW = isHoriz ? deltaInchesX : deltaInchesY;
        const nextWidth = Math.max(
          20,
          Math.min(wallLenIn - targetOp.offset_in, draggingOpening.initialWidth + deltaW)
        );
        currentOps[draggingOpening.openingIndex] = {
          ...targetOp,
          width_in: Math.round(nextWidth),
        };
        updateRoomOpenings(draggingOpening.roomIndex, currentOps);
      }
      return;
    }

    // 4. Viewport Pan
    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRoomRef.current && draggingIndex !== null) {
      const room = rooms[draggingIndex];
      if (room) {
        if (autoCropOnDrag && roomCropDragPreview && roomCropDragPreview.isCropped && onRoomResize) {
          onRoomResize(
            draggingIndex,
            roomCropDragPreview.x_in,
            roomCropDragPreview.y_in,
            roomCropDragPreview.w_in,
            roomCropDragPreview.d_in
          );
          const label = ROOM_LABELS[room.name as RoomName] ?? room.name;
          setCropToast(
            `✂️ ${label} cropped to ${formatFeetInches(roomCropDragPreview.w_in)} × ${formatFeetInches(roomCropDragPreview.d_in)} by dragging across map!`
          );
          setTimeout(() => setCropToast(null), 3500);
        } else if (onRoomMove) {
          const targetXIn = Math.max(
            setbackW,
            Math.min(setbackW + envW - room.w_in, room.x_in + dragOffsetIn.dx)
          );
          const targetYIn = Math.max(
            setbackN,
            Math.min(setbackN + envD - room.d_in, room.y_in + dragOffsetIn.dy)
          );

          if (Math.abs(dragOffsetIn.dx) > 2 || Math.abs(dragOffsetIn.dy) > 2) {
            onRoomMove(draggingIndex, targetXIn, targetYIn);
          }
        }
      }
    }

    // Commit crop resize
    if (draggingCrop && cropPreview && onRoomResize) {
      onRoomResize(
        draggingCrop.roomIndex,
        cropPreview.x_in,
        cropPreview.y_in,
        cropPreview.w_in,
        cropPreview.d_in
      );
    }

    setIsPanning(false);
    isDraggingRoomRef.current = false;
    setDraggingIndex(null);
    setDragOffsetIn({ dx: 0, dy: 0 });
    setRoomCropDragPreview(null);
    setDraggingWall(null);
    setDraggingOpening(null);
    setDraggingCrop(null);
    setCropPreview(null);
  };

  const handleRoomMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const room = rooms[idx];
    if (!room) return;

    setSelectedRoomIndex(idx);
    setSelectedOpeningIndex(null);

    // If user holds Shift or Alt, dragging immediately crops the room across the map
    if (e.shiftKey || e.altKey) {
      setDraggingCrop({
        roomIndex: idx,
        handle: "SE",
        startMouse: { x: e.clientX, y: e.clientY },
        initialX: room.x_in,
        initialY: room.y_in,
        initialW: room.w_in,
        initialD: room.d_in,
      });
      setCropPreview({ x_in: room.x_in, y_in: room.y_in, w_in: room.w_in, d_in: room.d_in });
      return;
    }

    setDraggingIndex(idx);
    isDraggingRoomRef.current = true;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    setDragOffsetIn({ dx: 0, dy: 0 });
  };

  const handleWallHandleMouseDown = (
    e: React.MouseEvent,
    roomIdx: number,
    edge: "N" | "S" | "E" | "W"
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedWallEdge(edge);
    setInspectorTab("wall");
    handleCropHandleMouseDown(e, roomIdx, edge as CropHandle);
  };

  const handleCropHandleMouseDown = (
    e: React.MouseEvent,
    roomIdx: number,
    handle: CropHandle
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const room = rooms[roomIdx];
    if (!room) return;
    setSelectedRoomIndex(roomIdx);
    setSelectedOpeningIndex(null);
    setDraggingCrop({
      roomIndex: roomIdx,
      handle,
      startMouse: { x: e.clientX, y: e.clientY },
      initialX: room.x_in,
      initialY: room.y_in,
      initialW: room.w_in,
      initialD: room.d_in,
    });
    setCropPreview({ x_in: room.x_in, y_in: room.y_in, w_in: room.w_in, d_in: room.d_in });
  };

  const handleOpeningMouseDown = (
    e: React.MouseEvent,
    roomIdx: number,
    openingIdx: number,
    action: "slide" | "resize"
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const room = rooms[roomIdx];
    if (!room || !room.openings) return;
    const op = room.openings[openingIdx];
    if (!op) return;

    setSelectedRoomIndex(roomIdx);
    setSelectedOpeningIndex(openingIdx);
    setSelectedWallEdge(op.edge);
    setInspectorTab("door");

    setDraggingOpening({
      roomIndex: roomIdx,
      openingIndex: openingIdx,
      action,
      startMouse: { x: e.clientX, y: e.clientY },
      initialOffset: op.offset_in,
      initialWidth: op.width_in,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(3.5, Math.max(0.4, prev * zoomFactor)));
  };

  const handleResetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSelectedRoomIndex(null);
    setSelectedWallEdge(null);
    setSelectedOpeningIndex(null);
  }, []);

  // Room Dimension Stepper Handler
  const handleDimensionChange = (key: "wFt" | "dFt", delta: number) => {
    if (selectedRoomIndex === null || !selectedRoom) return;
    const id = getRoomIdFromIndex(selectedRoomIndex);

    const defaultW = Math.round(inchesToFeet(selectedRoom.w_in));
    const defaultD = Math.round(inchesToFeet(selectedRoom.d_in));

    const current = customDims[id] ?? { wFt: defaultW, dFt: defaultD };
    const nextVal = Math.max(4, Math.min(35, current[key] + delta));

    onChangeCustomDims({
      ...customDims,
      [id]: {
        ...current,
        [key]: nextVal,
      },
    });
  };

  const handleSetPresetDimensions = (wFt: number, dFt: number) => {
    if (selectedRoomIndex === null || !selectedRoom) return;
    const id = getRoomIdFromIndex(selectedRoomIndex);
    onChangeCustomDims({
      ...customDims,
      [id]: { wFt, dFt },
    });
  };

  // Wall Length Preset Handler
  const handleSetWallLength = (lengthFt: number) => {
    if (selectedRoomIndex === null || !selectedRoom) return;
    const isEW = selectedWallEdge === "E" || selectedWallEdge === "W";
    handleDimensionChange(isEW ? "dFt" : "wFt", lengthFt);
  };

  // Room Rotation Handler
  const handleRotateRoomByIndex = useCallback(
    (index: number) => {
      const targetRoom = rooms[index];
      if (!targetRoom) return;
      const id = getRoomIdFromIndex(index);

      const defaultW = Math.round(inchesToFeet(targetRoom.w_in));
      const defaultD = Math.round(inchesToFeet(targetRoom.d_in));
      const current = customDims[id] ?? { wFt: defaultW, dFt: defaultD };

      onChangeCustomDims({
        ...customDims,
        [id]: {
          wFt: current.dFt,
          dFt: current.wFt,
        },
      });
    },
    [rooms, getRoomIdFromIndex, customDims, onChangeCustomDims]
  );

  const handleRotateSelectedRoom = () => {
    if (selectedRoomIndex === null) return;
    handleRotateRoomByIndex(selectedRoomIndex);
  };

  // Keyboard shortcut listener: 'R' to rotate selected room
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "r" || e.key === "R") {
        if (selectedRoomIndex !== null) {
          e.preventDefault();
          handleRotateRoomByIndex(selectedRoomIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRoomIndex, handleRotateRoomByIndex]);

  // Opening modification handlers
  const handleUpdateSelectedOpening = (updates: Partial<RoomOpening>) => {
    if (selectedRoomIndex === null || selectedOpeningIndex === null || !selectedRoom) return;
    const currentOps = [...(selectedRoom.openings ?? [])];
    const op = currentOps[selectedOpeningIndex];
    if (!op) return;

    currentOps[selectedOpeningIndex] = {
      ...op,
      ...updates,
    };
    updateRoomOpenings(selectedRoomIndex, currentOps);
  };

  const handleAddOpeningOnWall = (kind: "door" | "window") => {
    if (selectedRoomIndex === null || !selectedRoom) return;
    const edge = selectedWallEdge || "N";
    const isHoriz = edge === "N" || edge === "S";
    const wallLenIn = isHoriz ? selectedRoom.w_in : selectedRoom.d_in;

    const widthIn = kind === "door" ? 36 : 48;
    const heightIn = kind === "door" ? 84 : 48;
    const offsetIn = Math.max(12, Math.round((wallLenIn - widthIn) / 2));

    const newOp: RoomOpening = {
      kind,
      edge,
      offset_in: offsetIn,
      width_in: widthIn,
      height_in: heightIn,
      sill_in: kind === "window" ? 36 : undefined,
    };

    const nextOps = [...(selectedRoom.openings ?? []), newOp];
    updateRoomOpenings(selectedRoomIndex, nextOps);
    setSelectedOpeningIndex(nextOps.length - 1);
    setInspectorTab("door");
  };

  const handleDeleteSelectedOpening = () => {
    if (selectedRoomIndex === null || selectedOpeningIndex === null || !selectedRoom) return;
    const nextOps = (selectedRoom.openings ?? []).filter((_, i) => i !== selectedOpeningIndex);
    updateRoomOpenings(selectedRoomIndex, nextOps);
    setSelectedOpeningIndex(null);
    setInspectorTab("room");
  };

  // Add Room from 2D Toolbar
  const handleAddRoom = (name: RoomName) => {
    const current = counts[name] ?? 0;
    if (current < 4) {
      onChangeCounts({
        ...counts,
        [name]: current + 1,
      });
    }
  };

  // Remove Room
  const handleDeleteSelectedRoom = () => {
    if (selectedRoomIndex === null || !selectedRoom) return;
    const name = selectedRoom.name as RoomName;
    const current = counts[name] ?? 0;
    if (current > 0) {
      const nextCounts = { ...counts, [name]: current - 1 };
      onChangeCounts(nextCounts);
      setSelectedRoomIndex(null);
      setSelectedOpeningIndex(null);
    }
  };

  return (
    <div
      className={styles.blueprintContainer}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Top Floating CAD Toolbar */}
      <div className={styles.toolbar}>
        {/* Layer Toggles */}
        <div className={styles.toolbarGroup}>
          <button
            className={`${styles.toolButton} ${autoCropOnDrag ? styles.toolButtonActive : ""}`}
            onClick={() => setAutoCropOnDrag((p) => !p)}
            title="Auto-Crop room dimensions when dragging across map boundaries (Press 'C' to toggle)"
          >
            ✂️ Auto-Crop: {autoCropOnDrag ? "ON" : "OFF"}
          </button>
          <button
            className={`${styles.toolButton} ${showDimensions ? styles.toolButtonActive : ""}`}
            onClick={() => setShowDimensions((p) => !p)}
            title="Toggle Dimension Lines & Strings"
          >
            📏 Dimensions
          </button>
          <button
            className={`${styles.toolButton} ${showSetbacks ? styles.toolButtonActive : ""}`}
            onClick={() => setShowSetbacks((p) => !p)}
            title="Toggle Setback Boundary & Offsets"
          >
            🚧 Setbacks
          </button>
          <button
            className={`${styles.toolButton} ${showVaastuGrid ? styles.toolButtonActive : ""}`}
            onClick={() => setShowVaastuGrid((p) => !p)}
            title="Toggle 9-Zone Vaastu Mandala Grid"
          >
            🧭 Vaastu Grid
          </button>
          <button
            className={`${styles.toolButton} ${showBadges ? styles.toolButtonActive : ""}`}
            onClick={() => setShowBadges((p) => !p)}
            title="Toggle Room Names & Areas"
          >
            🏷️ Badges
          </button>
        </div>

        {/* Quick "+ Add Room" Toolbar */}
        <div className={styles.addRoomGroup}>
          <span className={styles.addRoomLabel}>+ Add:</span>
          {ROOM_NAMES.map((name) => (
            <button
              key={name}
              className={styles.addRoomChip}
              onClick={() => handleAddRoom(name)}
              title={`Add 1 ${ROOM_LABELS[name]} to layout`}
              disabled={(counts[name] ?? 0) >= 4}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: `#${ROOM_COLORS[name].toString(16).padStart(6, "0")}`,
                  display: "inline-block",
                }}
              />
              {name.toUpperCase()} ({(counts[name] ?? 0)})
            </button>
          ))}
        </div>

        {/* Active Blueprint Badge */}
        {activeBlueprintName && (
          <div
            className={styles.activeBlueprintPill}
            title={`Active Model Blueprint: ${activeBlueprintName}`}
          >
            <span className={styles.activeBlueprintDot} />
            <span className={styles.activeBlueprintText}>Model: {activeBlueprintName}</span>
          </div>
        )}

        {/* Quick Import JSON Button */}
        <input
          type="file"
          ref={quickImportFileRef}
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleQuickImportJson}
        />
        <button
          className={styles.quickImportBtn}
          onClick={() => quickImportFileRef.current?.click()}
          title="Import a blueprint JSON file directly into 2D Layout"
        >
          📂 Import JSON
        </button>

        {/* Model Blueprints Catalog Button */}
        {onOpenModelBlueprintsModal && (
          <button
            className={styles.modelBtn}
            onClick={onOpenModelBlueprintsModal}
            title="Browse pre-designed architectural model blueprints or import custom plans"
          >
            🏛️ Model Blueprints
          </button>
        )}

        {/* Export Blueprint Button */}
        <button className={styles.exportBtn} onClick={onOpenExportModal}>
          📥 Export Blueprint
        </button>
      </div>

      {/* Auto-Crop Toast Notification */}
      {cropToast && (
        <div className={styles.cropToastOverlay}>
          <span>{cropToast}</span>
        </div>
      )}

      {/* Legend Overlay */}
      <div className={styles.legendOverlay}>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#7dd3fc" }} />
          <span>Walls (Drag Handles)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#fbbf24" }} />
          <span>Doors (Click to Resize/Slide)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#34d399" }} />
          <span>Windows</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#f43f5e" }} />
          <span>Setbacks</span>
        </div>
      </div>

      {/* CAD Freehand Architecture Studio Toolbar */}
      <div className={styles.cadDraftingToolbar}>
        {/* Floor Level Switcher Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "2px 4px", marginRight: "4px" }}>
          {[
            { floor: 0, short: "G 🏡", title: "Ground Floor" },
            { floor: 1, short: "1F 🏢", title: "1st Floor" },
            { floor: 2, short: "2F 🏙️", title: "2nd Floor" },
            { floor: 3, short: "Roof ☀️", title: "Terrace / Roof" },
          ].map((fl) => (
            <button
              key={fl.floor}
              style={{
                background: activeFloor === fl.floor ? "#0284c7" : "transparent",
                color: activeFloor === fl.floor ? "#ffffff" : "#94a3b8",
                border: "none",
                borderRadius: "5px",
                padding: "3px 7px",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => onChangeActiveFloor?.(fl.floor)}
              title={fl.title}
            >
              {fl.short}
            </button>
          ))}
        </div>

        <button
          className={`${styles.cadToolBtn} ${activeCadTool === "select" ? styles.cadToolBtnActive : ""}`}
          onClick={() => {
            setDraftWallStart(null);
            setDraftWallCurrent(null);
            onChangeCadTool?.("select");
          }}
          title="Select & Inspect Objects (V)"
        >
          ↖ Select
        </button>

        <button
          className={`${styles.cadToolBtn} ${activeCadTool === "draw_wall" ? styles.cadToolBtnActive : ""}`}
          onClick={() => {
            onChangeCadTool?.("draw_wall");
          }}
          title="Point-to-Point Wall Drawer (W)"
        >
          ✏️ Draw Wall
        </button>

        {activeCadTool === "draw_wall" && (
          <select
            value={activeWallType}
            onChange={(e) => onChangeWallType?.(e.target.value as CustomWallType)}
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              color: "#38bdf8",
              border: "1px solid #38bdf8",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <option value="exterior">🧱 9" Exterior Wall</option>
            <option value="interior">🧱 4.5" Interior Wall</option>
            <option value="glass">🪟 3" Glass Partition</option>
            <option value="slat">🪵 3.5" Slat Screen</option>
            <option value="arch">🏛️ 6" Arched Divider</option>
            <option value="curved">💫 9" Curved Feature Wall</option>
            <option value="curved_glass">🪟 3" Curved Glass Wall</option>
            <option value="curved_slat">🪵 3.5" Curved Slat Wall</option>
          </select>
        )}

        <button
          className={`${styles.cadToolBtn} ${activeCadTool === "place_door" ? styles.cadToolBtnActive : ""}`}
          onClick={() => {
            setDraftWallStart(null);
            onChangeCadTool?.("place_door");
          }}
          title="Place Doors onto Walls (D)"
        >
          🚪 Place Door
        </button>

        <button
          className={`${styles.cadToolBtn} ${activeCadTool === "place_window" ? styles.cadToolBtnActive : ""}`}
          onClick={() => {
            setDraftWallStart(null);
            onChangeCadTool?.("place_window");
          }}
          title="Place Windows onto Walls"
        >
          🪟 Place Window
        </button>

        <button
          className={`${styles.cadToolBtn} ${activeCadTool === "tag_room" ? styles.cadToolBtnActive : ""}`}
          onClick={() => {
            setDraftWallStart(null);
            onChangeCadTool?.("tag_room");
          }}
          title="Tag and Label Room Zone with Area sq ft"
        >
          🏷️ Tag Room
        </button>

        {onStartFromScratch && (
          <button
            className={styles.cadStartScratchBtn}
            onClick={onStartFromScratch}
            title="Start with a blank plot (clears automated solver rooms)"
          >
            🏗️ Start Blank
          </button>
        )}

        {onOpenModelBlueprintsModal && (
          <button
            style={{
              background: "linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(14, 165, 233, 0.2))",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 9px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={onOpenModelBlueprintsModal}
            title="Exit scratch mode and load a prebuilt Vastu floor plan model"
          >
            ✨ Prebuilt Plans
          </button>
        )}

        {customWalls.length > 0 && (
          <button
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#f87171",
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => {
              if (confirm("Clear all custom drawn walls and room zones?")) {
                onChangeCustomWalls?.([]);
                onChangeCustomRoomZones?.([]);
              }
            }}
            title="Clear all custom drawn walls"
          >
            🗑️ Clear Walls ({customWalls.length})
          </button>
        )}
      </div>

      {/* Floating Selected Custom Wall & Curve Inspector */}
      {(() => {
        const selectedWall = customWalls.find((w) => w.id === selectedCustomWallId);
        if (!selectedWall) return null;

        return (
          <div
            style={{
              position: "absolute",
              top: 125,
              left: 24,
              background: "rgba(10, 25, 48, 0.96)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid #f59e0b",
              padding: "7px 12px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 26,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
              color: "#ffffff",
              fontSize: "12px",
            }}
          >
            <span style={{ fontWeight: 800, color: "#fbbf24", display: "flex", alignItems: "center", gap: "4px" }}>
              🧱 Wall ({formatFeetInches(getWallLengthIn(selectedWall))})
            </span>

            <select
              value={selectedWall.wallType}
              onChange={(e) => {
                const nextType = e.target.value as CustomWallType;
                const isCurved = nextType.startsWith("curved");
                const updated = customWalls.map((w) =>
                  w.id === selectedWall.id
                    ? { ...w, wallType: nextType, isCurved: isCurved || w.isCurved, curveBulgeIn: isCurved && !w.curveBulgeIn ? 24 : w.curveBulgeIn }
                    : w
                );
                onChangeCustomWalls?.(updated);
              }}
              style={{
                background: "rgba(15, 23, 42, 0.9)",
                color: "#38bdf8",
                border: "1px solid #38bdf8",
                borderRadius: "6px",
                padding: "3px 6px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <option value="exterior">🧱 9" Exterior Wall</option>
              <option value="interior">🧱 4.5" Interior Wall</option>
              <option value="glass">🪟 3" Glass Partition</option>
              <option value="slat">🪵 3.5" Slat Screen</option>
              <option value="arch">🏛️ 6" Arched Divider</option>
              <option value="curved">💫 9" Curved Wall</option>
              <option value="curved_glass">🪟 3" Curved Glass</option>
              <option value="curved_slat">🪵 3.5" Curved Slat</option>
            </select>

            {/* Curve Toggle Button */}
            <button
              style={{
                background: selectedWall.isCurved ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
                color: selectedWall.isCurved ? "#ffffff" : "#cbd5e1",
                border: "1px solid " + (selectedWall.isCurved ? "#38bdf8" : "rgba(255,255,255,0.2)"),
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => {
                const nextCurved = !selectedWall.isCurved;
                const updated = customWalls.map((w) =>
                  w.id === selectedWall.id
                    ? { ...w, isCurved: nextCurved, curveBulgeIn: nextCurved ? (w.curveBulgeIn || 24) : 0 }
                    : w
                );
                onChangeCustomWalls?.(updated);
              }}
              title="Toggle Curved Wall Arc"
            >
              💫 {selectedWall.isCurved ? "Curved: ON" : "Make Curved"}
            </button>

            {/* Bulge Adjuster Stepper if curved */}
            {selectedWall.isCurved && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(0,0,0,0.35)", padding: "2px 6px", borderRadius: "6px" }}>
                <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Arc:</span>
                <button
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "3px", width: "18px", height: "18px", cursor: "pointer", fontWeight: 800 }}
                  onClick={() => {
                    const nextBulge = (selectedWall.curveBulgeIn || 24) - 6;
                    const updated = customWalls.map((w) =>
                      w.id === selectedWall.id ? { ...w, curveBulgeIn: nextBulge } : w
                    );
                    onChangeCustomWalls?.(updated);
                  }}
                  title="Decrease Arc Curvature"
                >
                  -
                </button>
                <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "26px", textAlign: "center", color: "#38bdf8" }}>
                  {selectedWall.curveBulgeIn || 24}&quot;
                </span>
                <button
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "3px", width: "18px", height: "18px", cursor: "pointer", fontWeight: 800 }}
                  onClick={() => {
                    const nextBulge = (selectedWall.curveBulgeIn || 24) + 6;
                    const updated = customWalls.map((w) =>
                      w.id === selectedWall.id ? { ...w, curveBulgeIn: nextBulge } : w
                    );
                    onChangeCustomWalls?.(updated);
                  }}
                  title="Increase Arc Curvature"
                >
                  +
                </button>
              </div>
            )}

            {/* Delete Selected Wall */}
            <button
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                color: "#f87171",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => {
                onChangeCustomWalls?.(customWalls.filter((w) => w.id !== selectedWall.id));
                setSelectedCustomWallId(null);
              }}
              title="Delete this wall"
            >
              🗑️ Delete
            </button>

            <button
              style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "12px", cursor: "pointer", padding: "0 4px" }}
              onClick={() => setSelectedCustomWallId(null)}
              title="Deselect"
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* CAD Drafting Real-Time Hint Banner */}
      {activeCadTool === "draw_wall" && (
        <div className={styles.draftingStatusOverlay}>
          <span>✏️ Click anywhere on plot to place wall points • Ortho snaps to 0°/90°/45° • Press ESC to finish</span>
        </div>
      )}
      {activeCadTool === "place_door" && (
        <div className={styles.draftingStatusOverlay}>
          <span>🚪 Hover over any custom wall and click to insert Door</span>
        </div>
      )}
      {activeCadTool === "place_window" && (
        <div className={styles.draftingStatusOverlay}>
          <span>🪟 Hover over any custom wall and click to insert Window</span>
        </div>
      )}

      {/* Interactive Edit Tip Pill */}
      <div className={styles.editTipOverlay}>
        <span>🖐️ Drag rooms across map to crop/move • Click/drag walls &amp; doors to resize • Press &apos;C&apos; to toggle Auto-Crop</span>
      </div>

      {/* SVG Blueprint Canvas Viewport */}
      <svg
        ref={svgRef}
        className={`${styles.canvasViewport} ${isPanning ? styles.canvasViewportPanning : ""}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0e2d4f" strokeWidth="0.8" />
          </pattern>
          <pattern id="fineGrid" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#0a233f" strokeWidth="0.4" />
          </pattern>
          <pattern id="cropHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" />
          </pattern>
          <marker
            id="dimTick"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <line x1="2" y1="8" x2="8" y2="2" stroke="#38bdf8" strokeWidth="1.8" />
          </marker>
        </defs>

        {/* CAD Grid Background */}
        <rect width={VIEW_W} height={VIEW_H} fill="#06182c" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#fineGrid)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#gridPattern)" />

        {/* Pan & Zoom Transform Group */}
        <g
          transform={`translate(${VIEW_W / 2 + pan.x}, ${VIEW_H / 2 + pan.y}) scale(${zoom}) translate(${-VIEW_W / 2}, ${-VIEW_H / 2})`}
        >
          {/* 9-Zone Vaastu Purusha Mandala Overlay */}
          {showVaastuGrid && (
            <g opacity="0.3">
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => {
                  const gx = plotPxX + (plotPxW / 3) * c;
                  const gy = plotPxY + (plotPxH / 3) * r;
                  const gw = plotPxW / 3;
                  const gh = plotPxH / 3;

                  let zoneKey = "CENTER";
                  if (r === 0 && c === 0) zoneKey = "NW";
                  if (r === 0 && c === 1) zoneKey = "N";
                  if (r === 0 && c === 2) zoneKey = "NE";
                  if (r === 1 && c === 0) zoneKey = "W";
                  if (r === 1 && c === 1) zoneKey = "C";
                  if (r === 1 && c === 2) zoneKey = "E";
                  if (r === 2 && c === 0) zoneKey = "SW";
                  if (r === 2 && c === 1) zoneKey = "S";
                  if (r === 2 && c === 2) zoneKey = "SE";

                  const zoneInfo = VAASTU_ZONE_LABELS[zoneKey];

                  return (
                    <g key={`${r}-${c}`}>
                      <rect
                        x={gx}
                        y={gy}
                        width={gw}
                        height={gh}
                        fill={zoneKey === "C" ? "#fbbf240a" : "none"}
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={gx + gw / 2}
                        y={gy + gh / 2}
                        fill="#38bdf8"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                        opacity="0.7"
                      >
                        {zoneInfo?.name ?? zoneKey}
                      </text>
                    </g>
                  );
                })
              )}
            </g>
          )}

          {/* Plot Boundary Outline */}
          <rect
            x={plotPxX}
            y={plotPxY}
            width={plotPxW}
            height={plotPxH}
            fill="none"
            stroke="#f0f9ff"
            strokeWidth="2.5"
            strokeDasharray="14,5"
          />

          {/* Road Frontage Indicator */}
          {frontIdx === 0 && (
            <g>
              <rect
                x={plotPxX}
                y={plotPxY - 26}
                width={plotPxW}
                height="22"
                fill="#0c2340"
                stroke="#38bdf8"
                strokeWidth="1.2"
                rx="4"
              />
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY - 12}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                letterSpacing="1"
              >
                ▲ {roadLabel} ▲
              </text>
            </g>
          )}

          {/* Buildable Envelope Boundary */}
          {showSetbacks && (
            <g>
              <rect
                x={envPxX}
                y={envPxY}
                width={envPxW}
                height={envPxH}
                fill="#0284c70a"
                stroke="#f43f5e"
                strokeWidth="1.8"
                strokeDasharray="6,4"
              />
              <text
                x={envPxX + envPxW / 2}
                y={envPxY - 8}
                fill="#f43f5e"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                Front Setback: {formatFeetInches(setbackN)}
              </text>
            </g>
          )}

          {/* Placed Rooms with Interactive Walls & Doors */}
          {rooms.map((room, idx) => {
            const isDraggingThis = draggingIndex === idx;
            const isCropDraggingThis = draggingCrop?.roomIndex === idx;
            const cropP = isCropDraggingThis && cropPreview ? cropPreview : null;
            const dragCropP = isDraggingThis && roomCropDragPreview ? roomCropDragPreview : null;

            const currentXIn = dragCropP ? dragCropP.x_in
              : isDraggingThis ? room.x_in + dragOffsetIn.dx
              : cropP ? cropP.x_in : room.x_in;
            const currentYIn = dragCropP ? dragCropP.y_in
              : isDraggingThis ? room.y_in + dragOffsetIn.dy
              : cropP ? cropP.y_in : room.y_in;
            const currentWIn = dragCropP ? dragCropP.w_in
              : cropP ? cropP.w_in : room.w_in;
            const currentDIn = dragCropP ? dragCropP.d_in
              : cropP ? cropP.d_in : room.d_in;

            const rx = toPxX(currentXIn);
            const ry = toPxY(currentYIn);
            const rw = currentWIn * baseScale;
            const rd = currentDIn * baseScale;

            const isSelected = idx === selectedRoomIndex;
            const isCropActive = isDraggingThis && dragCropP?.isCropped;
            const label = ROOM_LABELS[room.name as RoomName] ?? room.name;
            const zone = getRoomVaastuZone(room, plot.widthIn, plot.depthIn);
            const zoneInfo = VAASTU_ZONE_LABELS[zone];

            const wallThicknessPx = Math.max(2, (room.wall_thickness_in ?? 4.5) * baseScale);

            return (
              <g key={idx} id={`room-${idx}`}>
                {/* Uncropped drag outline when cropping against boundary */}
                {isCropActive && dragCropP && (
                  <g pointerEvents="none">
                    <rect
                      x={toPxX(dragCropP.rawLeft)}
                      y={toPxY(dragCropP.rawTop)}
                      width={dragCropP.originalW * baseScale}
                      height={dragCropP.originalD * baseScale}
                      fill="rgba(245, 158, 11, 0.08)"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                    />
                  </g>
                )}

                {/* Drag-Crop Floating HUD Badge */}
                {isCropActive && (
                  <g pointerEvents="none">
                    <rect
                      x={rx + rw / 2 - 135}
                      y={ry - 36}
                      width={270}
                      height={28}
                      rx="6"
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <text
                      x={rx + rw / 2}
                      y={ry - 18}
                      fill="#f59e0b"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ✂️ CROPPING TO MAP: {formatFeetInches(currentWIn)} × {formatFeetInches(currentDIn)}
                    </text>
                  </g>
                )}

                {/* Room Floor Fill */}
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rd}
                  fill={isCropActive ? "#78350f" : isSelected ? "#0284c7" : isDraggingThis ? "#0369a1" : "#0c3b6d"}
                  stroke={isCropActive ? "#f59e0b" : isSelected ? "#ffffff" : isDraggingThis ? "#38bdf8" : "#7dd3fc"}
                  strokeWidth={isCropActive || isSelected || isDraggingThis ? 3.5 : 2}
                  filter={isDraggingThis ? "drop-shadow(0 8px 16px rgba(0,0,0,0.6))" : undefined}
                  rx="1"
                  style={{ cursor: isDraggingThis ? "grabbing" : "grab" }}
                  onMouseDown={(e) => handleRoomMouseDown(e, idx)}
                />

                {/* Inner Wall Cavity */}
                <rect
                  x={rx + wallThicknessPx}
                  y={ry + wallThicknessPx}
                  width={Math.max(0, rw - wallThicknessPx * 2)}
                  height={Math.max(0, rd - wallThicknessPx * 2)}
                  fill="#06182c88"
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                  pointerEvents="none"
                />

                {/* Selection Highlight Border */}
                {isSelected && (
                  <rect
                    x={rx - 3}
                    y={ry - 3}
                    width={rw + 6}
                    height={rd + 6}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                    pointerEvents="none"
                  />
                )}

                {/* Quick Rotation Buttons on Selected Room */}
                {isSelected && (
                  <g pointerEvents="all">
                    {/* Anticlockwise -90 deg button */}
                    <g
                      transform={`translate(${rx + Math.max(0, rw - 48)}, ${ry - 24})`}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotateRoomByIndex(idx);
                      }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="22"
                        height="18"
                        rx="4"
                        fill="#0284c7"
                        stroke="#7dd3fc"
                        strokeWidth="1"
                      />
                      <text
                        x="11"
                        y="13"
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ↺
                      </text>
                    </g>
                    {/* Clockwise +90 deg button */}
                    <g
                      transform={`translate(${rx + Math.max(24, rw - 22)}, ${ry - 24})`}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotateRoomByIndex(idx);
                      }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="22"
                        height="18"
                        rx="4"
                        fill="#0284c7"
                        stroke="#7dd3fc"
                        strokeWidth="1"
                      />
                      <text
                        x="11"
                        y="13"
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ↻
                      </text>
                    </g>
                  </g>
                )}

                {/* Interactive 4 Wall Edges & Drag Resize Handles when Selected */}
                {isSelected && (
                  <g pointerEvents="all">
                    {/* North Wall Edge & Handle */}
                    <line
                      x1={rx}
                      y1={ry}
                      x2={rx + rw}
                      y2={ry}
                      stroke={selectedWallEdge === "N" ? "#fbbf24" : "#38bdf8"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "N")}
                    />
                    <g
                      transform={`translate(${rx + rw / 2 - 12}, ${ry - 10})`}
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "N")}
                    >
                      <rect x="0" y="0" width="24" height="10" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                      <text x="12" y="8" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">▲ N</text>
                    </g>

                    {/* South Wall Edge & Handle */}
                    <line
                      x1={rx}
                      y1={ry + rd}
                      x2={rx + rw}
                      y2={ry + rd}
                      stroke={selectedWallEdge === "S" ? "#fbbf24" : "#38bdf8"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "S")}
                    />
                    <g
                      transform={`translate(${rx + rw / 2 - 12}, ${ry + rd})`}
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "S")}
                    >
                      <rect x="0" y="0" width="24" height="10" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                      <text x="12" y="8" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">▼ S</text>
                    </g>

                    {/* West Wall Edge & Handle */}
                    <line
                      x1={rx}
                      y1={ry}
                      x2={rx}
                      y2={ry + rd}
                      stroke={selectedWallEdge === "W" ? "#fbbf24" : "#38bdf8"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "W")}
                    />
                    <g
                      transform={`translate(${rx - 10}, ${ry + rd / 2 - 12})`}
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "W")}
                    >
                      <rect x="0" y="0" width="10" height="24" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                      <text x="5" y="15" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">◀</text>
                    </g>

                    {/* East Wall Edge & Handle */}
                    <line
                      x1={rx + rw}
                      y1={ry}
                      x2={rx + rw}
                      y2={ry + rd}
                      stroke={selectedWallEdge === "E" ? "#fbbf24" : "#38bdf8"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "E")}
                    />
                    <g
                      transform={`translate(${rx + rw}, ${ry + rd / 2 - 12})`}
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) => handleWallHandleMouseDown(e, idx, "E")}
                    >
                      <rect x="0" y="0" width="10" height="24" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                      <text x="5" y="15" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">▶</text>
                    </g>
                  </g>
                )}

                {/* Image-Crop Style Resize Handles (8 directional) */}
                {isSelected && (
                  <g pointerEvents="all">
                    {/* ── Dashed crop bounding box overlay ── */}
                    <rect
                      x={rx} y={ry} width={rw} height={rd}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="5,3"
                      pointerEvents="none"
                    />

                    {/* ── 4 CORNER handles (L-bracket style) ── */}
                    {/* NW corner */}
                    <g style={{ cursor: "nwse-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "NW")}>
                      <rect x={rx - 6} y={ry - 6} width={14} height={14} fill="transparent" />
                      <path d={`M${rx + 8} ${ry} H${rx} V${ry + 8}`} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                    </g>
                    {/* NE corner */}
                    <g style={{ cursor: "nesw-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "NE")}>
                      <rect x={rx + rw - 8} y={ry - 6} width={14} height={14} fill="transparent" />
                      <path d={`M${rx + rw - 8} ${ry} H${rx + rw} V${ry + 8}`} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                    </g>
                    {/* SW corner */}
                    <g style={{ cursor: "nesw-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "SW")}>
                      <rect x={rx - 6} y={ry + rd - 8} width={14} height={14} fill="transparent" />
                      <path d={`M${rx + 8} ${ry + rd} H${rx} V${ry + rd - 8}`} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                    </g>
                    {/* SE corner */}
                    <g style={{ cursor: "nwse-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "SE")}>
                      <rect x={rx + rw - 8} y={ry + rd - 8} width={14} height={14} fill="transparent" />
                      <path d={`M${rx + rw - 8} ${ry + rd} H${rx + rw} V${ry + rd - 8}`} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                    </g>

                    {/* ── 4 EDGE midpoint handles (bars) ── */}
                    {/* N edge */}
                    <g style={{ cursor: "n-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "N")}>
                      <rect x={rx + rw / 2 - 14} y={ry - 5} width={28} height={10} rx="3" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
                      <line x1={rx + rw / 2 - 6} y1={ry} x2={rx + rw / 2 + 6} y2={ry} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                    {/* S edge */}
                    <g style={{ cursor: "s-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "S")}>
                      <rect x={rx + rw / 2 - 14} y={ry + rd - 5} width={28} height={10} rx="3" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
                      <line x1={rx + rw / 2 - 6} y1={ry + rd} x2={rx + rw / 2 + 6} y2={ry + rd} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                    {/* W edge */}
                    <g style={{ cursor: "w-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "W")}>
                      <rect x={rx - 5} y={ry + rd / 2 - 14} width={10} height={28} rx="3" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
                      <line x1={rx} y1={ry + rd / 2 - 6} x2={rx} y2={ry + rd / 2 + 6} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                    {/* E edge */}
                    <g style={{ cursor: "e-resize" }} onMouseDown={(e) => handleCropHandleMouseDown(e, idx, "E")}>
                      <rect x={rx + rw - 5} y={ry + rd / 2 - 14} width={10} height={28} rx="3" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
                      <line x1={rx + rw} y1={ry + rd / 2 - 6} x2={rx + rw} y2={ry + rd / 2 + 6} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </g>

                    {/* ── Live crop dimension HUD (shown while dragging) ── */}
                    {isCropDraggingThis && cropPreview && (
                      <g pointerEvents="none">
                        <rect
                          x={rx + rw / 2 - 56}
                          y={ry + rd / 2 - 14}
                          width={112}
                          height={26}
                          rx="5"
                          fill="rgba(15,23,42,0.88)"
                          stroke="#f59e0b"
                          strokeWidth="1"
                        />
                        <text
                          x={rx + rw / 2}
                          y={ry + rd / 2 + 4}
                          fill="#f59e0b"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {formatFeetInches(cropPreview.w_in)} × {formatFeetInches(cropPreview.d_in)}
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Room Center Info Badge */}
                {showBadges && (
                  <g transform={`translate(${rx + rw / 2}, ${ry + rd / 2})`} pointerEvents="none">
                    <text
                      x="0"
                      y="-10"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                    <text
                      x="0"
                      y="6"
                      fill="#38bdf8"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {formatFeetInches(room.w_in)} × {formatFeetInches(room.d_in)}
                    </text>
                    <text
                      x="0"
                      y="20"
                      fill="#93c5fd"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {formatAreaSqFt(room.w_in, room.d_in)} | {zoneInfo?.tag ?? zone}
                    </text>
                  </g>
                )}

                {/* Doors and Windows (Interactive Selection & Resizing) */}
                {(room.openings ?? []).map((opening, oIdx) => {
                  const openOffsetPx = opening.offset_in * baseScale;
                  const openWidthPx = opening.width_in * baseScale;
                  const isOpeningSelected =
                    isSelected && selectedOpeningIndex === oIdx;

                  let ox = rx;
                  let oy = ry;

                  if (opening.edge === "N") {
                    ox = rx + openOffsetPx;
                    oy = ry;
                  } else if (opening.edge === "S") {
                    ox = rx + openOffsetPx;
                    oy = ry + rd;
                  } else if (opening.edge === "E") {
                    ox = rx + rw;
                    oy = ry + openOffsetPx;
                  } else if (opening.edge === "W") {
                    ox = rx;
                    oy = ry + openOffsetPx;
                  }

                  if (opening.kind === "door" || opening.kind === "entrance") {
                    const isEntrance = opening.kind === "entrance";
                    const doorColor = isOpeningSelected
                      ? "#38bdf8"
                      : isEntrance
                      ? "#38bdf8"
                      : "#fbbf24";

                    return (
                      <g
                        key={`door-${oIdx}`}
                        pointerEvents="all"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoomIndex(idx);
                          setSelectedOpeningIndex(oIdx);
                          setSelectedWallEdge(opening.edge);
                          setInspectorTab("door");
                        }}
                      >
                        {/* Door Wall Cut */}
                        <line
                          x1={ox}
                          y1={oy}
                          x2={
                            opening.edge === "N" || opening.edge === "S" ? ox + openWidthPx : ox
                          }
                          y2={
                            opening.edge === "E" || opening.edge === "W" ? oy + openWidthPx : oy
                          }
                          stroke="#06182c"
                          strokeWidth="6"
                        />
                        {/* 90 Deg Swing Arc */}
                        <path
                          d={
                            opening.edge === "N"
                              ? `M ${ox} ${oy} L ${ox} ${oy + openWidthPx} A ${openWidthPx} ${openWidthPx} 0 0 0 ${ox + openWidthPx} ${oy}`
                              : opening.edge === "S"
                              ? `M ${ox} ${oy} L ${ox} ${oy - openWidthPx} A ${openWidthPx} ${openWidthPx} 0 0 1 ${ox + openWidthPx} ${oy}`
                              : opening.edge === "E"
                              ? `M ${ox} ${oy} L ${ox - openWidthPx} ${oy} A ${openWidthPx} ${openWidthPx} 0 0 0 ${ox} ${oy + openWidthPx}`
                              : `M ${ox} ${oy} L ${ox + openWidthPx} ${oy} A ${openWidthPx} ${openWidthPx} 0 0 1 ${ox} ${oy + openWidthPx}`
                          }
                          fill="none"
                          stroke={doorColor}
                          strokeWidth={isOpeningSelected ? 3 : 1.8}
                          strokeDasharray={isOpeningSelected ? "4,2" : undefined}
                        />

                        {/* Selected Door Halo & Dimension Tag */}
                        {isOpeningSelected && (
                          <g>
                            {/* Slide Grip Handle */}
                            <circle
                              cx={
                                opening.edge === "N" || opening.edge === "S"
                                  ? ox + openWidthPx / 2
                                  : ox
                              }
                              cy={
                                opening.edge === "E" || opening.edge === "W"
                                  ? oy + openWidthPx / 2
                                  : oy
                              }
                              r="6"
                              fill="#fbbf24"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ cursor: "grab" }}
                              onMouseDown={(e) => handleOpeningMouseDown(e, idx, oIdx, "slide")}
                            />

                            {/* Resize Width Grip Handle */}
                            <circle
                              cx={
                                opening.edge === "N" || opening.edge === "S"
                                  ? ox + openWidthPx
                                  : ox
                              }
                              cy={
                                opening.edge === "E" || opening.edge === "W"
                                  ? oy + openWidthPx
                                  : oy
                              }
                              r="5"
                              fill="#38bdf8"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ cursor: "ew-resize" }}
                              onMouseDown={(e) => handleOpeningMouseDown(e, idx, oIdx, "resize")}
                            />

                            {/* Floating Door Size Tag */}
                            <text
                              x={
                                opening.edge === "N" || opening.edge === "S"
                                  ? ox + openWidthPx / 2
                                  : ox + (opening.edge === "E" ? 14 : -14)
                              }
                              y={
                                opening.edge === "N"
                                  ? oy - 8
                                  : opening.edge === "S"
                                  ? oy + 16
                                  : oy + openWidthPx / 2
                              }
                              fill="#fbbf24"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {formatFeetInches(opening.width_in)} DOOR
                            </text>
                          </g>
                        )}

                        {isEntrance && !isOpeningSelected && (
                          <g>
                            <circle
                              cx={
                                ox +
                                (opening.edge === "N" || opening.edge === "S"
                                  ? openWidthPx / 2
                                  : 0)
                              }
                              cy={
                                oy +
                                (opening.edge === "E" || opening.edge === "W"
                                  ? openWidthPx / 2
                                  : 0)
                              }
                              r="4"
                              fill="#38bdf8"
                            />
                            <text
                              x={
                                ox +
                                (opening.edge === "N" || opening.edge === "S"
                                  ? openWidthPx / 2
                                  : 0)
                              }
                              y={
                                oy +
                                (opening.edge === "N" ? -8 : opening.edge === "S" ? 14 : 0)
                              }
                              fill="#38bdf8"
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              ENTRY
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  } else if (opening.kind === "window") {
                    const isHoriz = opening.edge === "N" || opening.edge === "S";
                    const wx2 = isHoriz ? ox + openWidthPx : ox;
                    const wy2 = isHoriz ? oy : oy + openWidthPx;

                    return (
                      <g
                        key={`win-${oIdx}`}
                        pointerEvents="all"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoomIndex(idx);
                          setSelectedOpeningIndex(oIdx);
                          setSelectedWallEdge(opening.edge);
                          setInspectorTab("door");
                        }}
                      >
                        <line
                          x1={ox}
                          y1={oy}
                          x2={wx2}
                          y2={wy2}
                          stroke={isOpeningSelected ? "#6ee7b7" : "#34d399"}
                          strokeWidth={isOpeningSelected ? 5 : 3.5}
                        />
                        <line
                          x1={isHoriz ? ox : ox - 2}
                          y1={isHoriz ? oy - 2 : oy}
                          x2={isHoriz ? wx2 : wx2 - 2}
                          y2={isHoriz ? wy2 - 2 : wy2}
                          stroke="#34d399"
                          strokeWidth="1.2"
                        />
                        <line
                          x1={isHoriz ? ox : ox + 2}
                          y1={isHoriz ? oy + 2 : oy}
                          x2={isHoriz ? wx2 : wx2 + 2}
                          y2={isHoriz ? wy2 + 2 : wy2}
                          stroke="#34d399"
                          strokeWidth="1.2"
                        />

                        {isOpeningSelected && (
                          <g>
                            <circle
                              cx={isHoriz ? ox + openWidthPx / 2 : ox}
                              cy={isHoriz ? oy : oy + openWidthPx / 2}
                              r="5"
                              fill="#34d399"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ cursor: "grab" }}
                              onMouseDown={(e) => handleOpeningMouseDown(e, idx, oIdx, "slide")}
                            />
                            <circle
                              cx={wx2}
                              cy={wy2}
                              r="5"
                              fill="#38bdf8"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ cursor: "ew-resize" }}
                              onMouseDown={(e) => handleOpeningMouseDown(e, idx, oIdx, "resize")}
                            />
                            <text
                              x={isHoriz ? ox + openWidthPx / 2 : ox + 14}
                              y={isHoriz ? oy - 8 : oy + openWidthPx / 2}
                              fill="#34d399"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {formatFeetInches(opening.width_in)} WIN
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  } else if (opening.kind === "opening") {
                    const isHoriz = opening.edge === "N" || opening.edge === "S";
                    const wx2 = isHoriz ? ox + openWidthPx : ox;
                    const wy2 = isHoriz ? oy : oy + openWidthPx;

                    return (
                      <g
                        key={`op-${oIdx}`}
                        pointerEvents="all"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoomIndex(idx);
                          setSelectedOpeningIndex(oIdx);
                          setSelectedWallEdge(opening.edge);
                          setInspectorTab("door");
                        }}
                      >
                        <line
                          x1={ox}
                          y1={oy}
                          x2={wx2}
                          y2={wy2}
                          stroke="#94a3b8"
                          strokeWidth="2.5"
                          strokeDasharray="5,4"
                        />
                        <text
                          x={isHoriz ? ox + openWidthPx / 2 : ox - 6}
                          y={isHoriz ? oy - 6 : oy + openWidthPx / 2}
                          fill="#cbd5e1"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                          transform={isHoriz ? undefined : `rotate(-90, ${ox - 6}, ${oy + openWidthPx / 2})`}
                        >
                          OPEN PASSAGE
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
          })}

          {/* ── Custom Architecture Room Zones (Build From Scratch Mode) ── */}
          {customRoomZones
            .filter((zone) => (zone.floor ?? 0) === activeFloor || (activeFloor > 0 && (zone.floor ?? 0) < activeFloor))
            .map((zone) => {
            const isCurrentFloor = (zone.floor ?? 0) === activeFloor;
            const zx = toPxX(zone.xIn);
            const zy = toPxY(zone.yIn);
            const zw = zone.wIn * baseScale;
            const zd = zone.dIn * baseScale;
            const isSelected = selectedCustomZoneId === zone.id;

            return (
              <g
                key={zone.id}
                onClick={(e) => {
                  if (!isCurrentFloor) return;
                  e.stopPropagation();
                  setSelectedCustomZoneId(zone.id);
                  setSelectedCustomWallId(null);
                }}
                style={{ cursor: isCurrentFloor ? "pointer" : "default" }}
                opacity={isCurrentFloor ? 1 : 0.25}
              >
                <rect
                  x={zx}
                  y={zy}
                  width={zw}
                  height={zd}
                  fill={isCurrentFloor ? "rgba(2, 132, 199, 0.12)" : "rgba(100, 116, 139, 0.05)"}
                  stroke={isSelected ? "#38bdf8" : isCurrentFloor ? "rgba(56, 189, 248, 0.5)" : "rgba(148, 163, 184, 0.3)"}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeDasharray="4,4"
                  rx="4"
                />
                <text
                  x={zx + zw / 2}
                  y={zy + zd / 2 - 4}
                  fill={isCurrentFloor ? "#ffffff" : "#94a3b8"}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {zone.customLabel || ROOM_LABELS[zone.name] || zone.name}
                  {!isCurrentFloor && ` (Floor ${(zone.floor ?? 0) === 0 ? "G" : (zone.floor ?? 0)})`}
                </text>
                <text
                  x={zx + zw / 2}
                  y={zy + zd / 2 + 12}
                  fill={isCurrentFloor ? "#38bdf8" : "#64748b"}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {formatAreaSqFt(zone.wIn, zone.dIn)}
                </text>
              </g>
            );
          })}

          {/* ── Custom Drawn Walls (Build From Scratch Mode) ── */}
          {customWalls
            .filter((wall) => (wall.floor ?? 0) === activeFloor || (activeFloor > 0 && (wall.floor ?? 0) < activeFloor))
            .map((wall) => {
            const isCurrentFloor = (wall.floor ?? 0) === activeFloor;
            const wx1 = toPxX(wall.startXIn);
            const wy1 = toPxY(wall.startYIn);
            const wx2 = toPxX(wall.endXIn);
            const wy2 = toPxY(wall.endYIn);
            const isSelected = selectedCustomWallId === wall.id;
            const strokeW = Math.max(3, wall.thicknessIn * baseScale);
            const strokeColor = !isCurrentFloor
              ? "#475569"
              : wall.wallType === "glass" || wall.wallType === "curved_glass"
              ? "#0284c7"
              : wall.wallType === "slat" || wall.wallType === "curved_slat"
              ? "#d97706"
              : wall.wallType === "arch"
              ? "#64748b"
              : wall.wallType === "curved" || wall.isCurved
              ? "#38bdf8"
              : "#7dd3fc";

            const wallLenIn = getWallLengthIn(wall);
            const midX = (wx1 + wx2) / 2;
            const midY = (wy1 + wy2) / 2;
            const isCurved = Boolean(
              wall.isCurved ||
              wall.wallType.startsWith("curved") ||
              (wall.curveBulgeIn && Math.abs(wall.curveBulgeIn) > 1)
            );

            const chordPx = Math.hypot(wx2 - wx1, wy2 - wy1) || 1;
            const nx = -(wy2 - wy1) / chordPx;
            const ny = (wx2 - wx1) / chordPx;
            const bulgeIn = wall.curveBulgeIn !== undefined ? wall.curveBulgeIn : 24.0;
            const bulgePx = bulgeIn * baseScale;
            const ctrlX = midX + nx * bulgePx * 2;
            const ctrlY = midY + ny * bulgePx * 2;
            const midArcX = isCurved ? midX + nx * bulgePx : midX;
            const midArcY = isCurved ? midY + ny * bulgePx : midY;

            return (
              <g
                key={wall.id}
                onClick={(e) => {
                  if (!isCurrentFloor) return;
                  e.stopPropagation();
                  setSelectedCustomWallId(wall.id);
                  setSelectedCustomZoneId(null);
                }}
                style={{ cursor: isCurrentFloor ? "pointer" : "default" }}
                opacity={isCurrentFloor ? 1 : 0.3}
              >
                {/* Wall Core Line / Curved Arc */}
                {isCurved ? (
                  <path
                    d={`M ${wx1} ${wy1} Q ${ctrlX} ${ctrlY} ${wx2} ${wy2}`}
                    stroke={isSelected ? "#f59e0b" : strokeColor}
                    strokeWidth={strokeW}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={isCurrentFloor ? undefined : "6,6"}
                  />
                ) : (
                  <line
                    x1={wx1}
                    y1={wy1}
                    x2={wx2}
                    y2={wy2}
                    stroke={isSelected ? "#f59e0b" : strokeColor}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeDasharray={isCurrentFloor ? undefined : "6,6"}
                  />
                )}

                {/* Dimension Tag */}
                {isCurrentFloor && (
                  <g transform={`translate(${midArcX}, ${midArcY - 10})`} pointerEvents="none">
                    <rect
                      x={-28}
                      y={-10}
                      width={56}
                      height={16}
                      rx="3"
                      fill="rgba(10, 25, 48, 0.88)"
                      stroke="rgba(56, 189, 248, 0.35)"
                      strokeWidth="0.8"
                    />
                    <text
                      x="0"
                      y="2"
                      fill="#cbd5e1"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {formatFeetInches(wallLenIn)}
                    </text>
                  </g>
                )}

                {/* Custom Wall Openings (Doors & Windows) */}
                {(wall.openings || []).map((op) => {
                  const len = Math.max(1, wallLenIn);
                  const t = op.offsetIn / len;
                  const opPx = Math.hypot(wx2 - wx1, wy2 - wy1);
                  const opW = (op.widthIn / len) * opPx;
                  const dxNorm = (wx2 - wx1) / opPx;
                  const dyNorm = (wy2 - wy1) / opPx;

                  const ox1 = wx1 + t * (wx2 - wx1);
                  const oy1 = wy1 + t * (wy2 - wy1);
                  const ox2 = ox1 + dxNorm * opW;
                  const oy2 = oy1 + dyNorm * opW;

                  if (op.kind === "door" || op.kind === "entrance" || op.kind === "arch_door" || op.kind === "revolving_door") {
                    return (
                      <g key={op.id}>
                        {/* Door Wall Cutout */}
                        <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke="#ffffff" strokeWidth={strokeW + 1} />
                        {/* Door Leaf & Arc */}
                        <line x1={ox1} y1={oy1} x2={ox1 - dyNorm * opW} y2={oy1 + dxNorm * opW} stroke="#fbbf24" strokeWidth="2" />
                        <path
                          d={`M ${ox2} ${oy2} A ${opW} ${opW} 0 0 0 ${ox1 - dyNorm * opW} ${oy1 + dxNorm * opW}`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="1.2"
                          strokeDasharray="3,3"
                        />
                      </g>
                    );
                  } else {
                    // Window
                    return (
                      <g key={op.id}>
                        {/* Window Wall Cutout & Glazing */}
                        <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke="#0f172a" strokeWidth={strokeW} />
                        <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke="#38bdf8" strokeWidth="2.5" />
                        <line
                          x1={ox1 + dyNorm * 3}
                          y1={oy1 - dxNorm * 3}
                          x2={ox2 + dyNorm * 3}
                          y2={oy2 - dxNorm * 3}
                          stroke="#94a3b8"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  }
                })}
              </g>
            );
          })}

          {/* ── Active Wall Drafting Rubberband Preview ── */}
          {activeCadTool === "draw_wall" && draftWallStart && draftWallCurrent && (
            <g pointerEvents="none">
              <line
                x1={toPxX(draftWallStart.xIn)}
                y1={toPxY(draftWallStart.yIn)}
                x2={toPxX(draftWallCurrent.xIn)}
                y2={toPxY(draftWallCurrent.yIn)}
                stroke="#38bdf8"
                strokeWidth={Math.max(3, (WALL_TYPE_CONFIGS[activeWallType]?.thicknessIn ?? 9) * baseScale)}
                strokeDasharray="6,4"
              />
              <circle cx={toPxX(draftWallStart.xIn)} cy={toPxY(draftWallStart.yIn)} r="5" fill="#38bdf8" />
              <circle cx={toPxX(draftWallCurrent.xIn)} cy={toPxY(draftWallCurrent.yIn)} r="5" fill="#f59e0b" />
              {/* Length & Angle HUD */}
              <g
                transform={`translate(${(toPxX(draftWallStart.xIn) + toPxX(draftWallCurrent.xIn)) / 2}, ${
                  (toPxY(draftWallStart.yIn) + toPxY(draftWallCurrent.yIn)) / 2 - 14
                })`}
              >
                <rect
                  x="-38"
                  y="-12"
                  width="76"
                  height="22"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.95)"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  fill="#38bdf8"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {formatFeetInches(draftWallCurrent.lengthIn)} ({Math.round(draftWallCurrent.angleDeg)}°)
                </text>
              </g>
            </g>
          )}

          {/* ── Hovered Opening Snap Preview ── */}
          {(activeCadTool === "place_door" || activeCadTool === "place_window") && hoveredWallInfo && (
            <g pointerEvents="none" transform={`translate(${hoveredWallInfo.px}, ${hoveredWallInfo.py})`}>
              <circle cx="0" cy="0" r="8" fill="#f59e0b" opacity="0.85" />
              <text x="12" y="4" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace">
                {activeCadTool === "place_door" ? "🚪 Click to Add Door" : "🪟 Click to Add Window"}
              </text>
            </g>
          )}

          {/* North Orientation Compass */}
          <g transform={`translate(${plotPxX + plotPxW + 65}, ${plotPxY + 40})`}>
            <circle cx="0" cy="0" r="22" fill="#0a2544" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M 0 -16 L 6 0 L 0 -4 L -6 0 z" fill="#38bdf8" />
            <path d="M 0 16 L 6 0 L 0 4 L -6 0 z" fill="#60a5fa" opacity="0.5" />
            <text
              x="0"
              y="-20"
              fill="#38bdf8"
              fontSize="11"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              N
            </text>
          </g>
        </g>
      </svg>

      {/* Floating Navigation Controls (Bottom-Right) */}
      <div className={styles.navControls}>
        <button
          className={styles.navBtn}
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          title="Zoom In"
        >
          +
        </button>
        <button
          className={styles.navBtn}
          onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}
          title="Zoom Out"
        >
          −
        </button>
        <button className={styles.navBtn} onClick={handleResetView} title="Reset View Fit">
          ⟲
        </button>
      </div>

      {/* Floating Multi-Tab Inspector (Room, Wall, Door) */}
      {selectedRoom && (
        <div className={styles.inspectorCard}>
          {/* Header */}
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitle}>
              {ROOM_LABELS[selectedRoom.name as RoomName] ?? selectedRoom.name}
            </div>
            <button
              className={styles.inspectorClose}
              onClick={() => {
                setSelectedRoomIndex(null);
                setSelectedWallEdge(null);
                setSelectedOpeningIndex(null);
              }}
            >
              ×
            </button>
          </div>

          {/* Inspector Navigation Tabs */}
          <div className={styles.inspectorTabs}>
            <button
              className={`${styles.tabBtn} ${inspectorTab === "room" ? styles.tabBtnActive : ""}`}
              onClick={() => setInspectorTab("room")}
            >
              🏢 Room
            </button>
            <button
              className={`${styles.tabBtn} ${inspectorTab === "wall" ? styles.tabBtnActive : ""}`}
              onClick={() => setInspectorTab("wall")}
            >
              🧱 Wall ({selectedWallEdge || "N"})
            </button>
            <button
              className={`${styles.tabBtn} ${inspectorTab === "door" ? styles.tabBtnActive : ""}`}
              onClick={() => setInspectorTab("door")}
            >
              🚪 Door ({selectedOpening ? selectedOpening.kind.toUpperCase() : "Select"})
            </button>
          </div>

          {/* TAB 1: ROOM INSPECTOR */}
          {inspectorTab === "room" && (
            <div className={styles.tabContent}>
              <div className={styles.inspectorRow}>
                <span className={styles.inspectorLabel}>Dimensions:</span>
                <span className={styles.inspectorValue}>
                  {formatFeetInches(selectedRoom.w_in)} × {formatFeetInches(selectedRoom.d_in)}
                </span>
              </div>

              <div className={styles.inspectorRow}>
                <span className={styles.inspectorLabel}>Floor Area:</span>
                <span className={styles.inspectorValue}>
                  {formatAreaSqFt(selectedRoom.w_in, selectedRoom.d_in)}
                </span>
              </div>

              <div className={styles.inspectorRow}>
                <span className={styles.inspectorLabel}>Vaastu Zone:</span>
                <span className={styles.inspectorVaastuBadge}>
                  {VAASTU_ZONE_LABELS[getRoomVaastuZone(selectedRoom, plot.widthIn, plot.depthIn)]
                    ?.name ?? getRoomVaastuZone(selectedRoom, plot.widthIn, plot.depthIn)}
                </span>
              </div>

              {/* Adjust Room Dimensions */}
              <div className={styles.dimEditorSection}>
                <span className={styles.dimEditorTitle}>📐 Adjust Room Dimensions</span>

                {/* Width Stepper */}
                <div className={styles.stepperRow}>
                  <span>Width (X):</span>
                  <div className={styles.stepperGroup}>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => handleDimensionChange("wFt", -1)}
                      title="Decrease Width"
                    >
                      −
                    </button>
                    <span className={styles.stepperValue}>
                      {Math.round(inchesToFeet(selectedRoom.w_in))} ft
                    </span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => handleDimensionChange("wFt", 1)}
                      title="Increase Width"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Depth Stepper */}
                <div className={styles.stepperRow}>
                  <span>Depth (Y):</span>
                  <div className={styles.stepperGroup}>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => handleDimensionChange("dFt", -1)}
                      title="Decrease Depth"
                    >
                      −
                    </button>
                    <span className={styles.stepperValue}>
                      {Math.round(inchesToFeet(selectedRoom.d_in))} ft
                    </span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() => handleDimensionChange("dFt", 1)}
                      title="Increase Depth"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick Dimension Presets */}
                <div className={styles.presetsRow}>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>Presets:</span>
                  <button className={styles.presetChip} onClick={() => handleSetPresetDimensions(10, 12)}>10×12</button>
                  <button className={styles.presetChip} onClick={() => handleSetPresetDimensions(12, 14)}>12×14</button>
                  <button className={styles.presetChip} onClick={() => handleSetPresetDimensions(14, 16)}>14×16</button>
                  <button className={styles.presetChip} onClick={() => handleSetPresetDimensions(16, 18)}>16×18</button>
                </div>
              </div>

              {/* Rotate Room Orientation Controls */}
              <div className={styles.inspectorRotateSection}>
                <span className={styles.dimEditorTitle}>🔄 Rotate Room Orientation</span>
                <div className={styles.inspectorRotateRow}>
                  <button
                    className={styles.inspectorRotateBtn}
                    onClick={() => handleRotateSelectedRoom()}
                    title="Rotate Room Anticlockwise (-90°)"
                  >
                    <span className={styles.rotateIcon}>↺</span>
                    <span>Rotate CCW (-90°)</span>
                  </button>
                  <button
                    className={styles.inspectorRotateBtn}
                    onClick={() => handleRotateSelectedRoom()}
                    title="Rotate Room Clockwise (+90°)"
                  >
                    <span className={styles.rotateIcon}>↻</span>
                    <span>Rotate CW (+90°)</span>
                  </button>
                </div>
                <span className={styles.shortcutTip}>
                  💡 Keyboard: Press <kbd className={styles.kbd}>R</kbd> to rotate selected room
                </span>
              </div>

              {/* Delete Room Action */}
              <button className={styles.deleteRoomBtn} onClick={handleDeleteSelectedRoom}>
                🗑️ Delete This Room
              </button>
            </div>
          )}

          {/* TAB 2: WALL INSPECTOR */}
          {inspectorTab === "wall" && (
            <div className={styles.tabContent}>
              {/* Wall Edge Selector Buttons */}
              <div className={styles.wallEdgeSelector}>
                <span className={styles.sectionHeading}>Select Wall Edge:</span>
                <div className={styles.edgeButtonsGroup}>
                  {(["N", "E", "S", "W"] as const).map((edge) => (
                    <button
                      key={edge}
                      className={`${styles.edgeBtn} ${
                        (selectedWallEdge || "N") === edge ? styles.edgeBtnActive : ""
                      }`}
                      onClick={() => setSelectedWallEdge(edge)}
                    >
                      {edge === "N" ? "North" : edge === "E" ? "East" : edge === "S" ? "South" : "West"} ({edge})
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Wall Edge Details */}
              <div className={styles.inspectorRow}>
                <span className={styles.inspectorLabel}>Wall Length:</span>
                <span className={styles.inspectorValue}>
                  {formatFeetInches(
                    (selectedWallEdge === "N" || selectedWallEdge === "S" || !selectedWallEdge)
                      ? selectedRoom.w_in
                      : selectedRoom.d_in
                  )}
                </span>
              </div>

              <div className={styles.inspectorRow}>
                <span className={styles.inspectorLabel}>Wall Thickness:</span>
                <span className={styles.inspectorValue}>
                  {selectedRoom.wall_thickness_in ?? 4.5}″
                </span>
              </div>

              {/* Wall Thickness Toggle */}
              <div className={styles.wallThicknessToggle}>
                <span className={styles.sectionHeading}>Toggle Thickness:</span>
                <div className={styles.thicknessGroup}>
                  <button
                    className={`${styles.thicknessBtn} ${
                      (selectedRoom.wall_thickness_in ?? 4.5) < 7 ? styles.thicknessBtnActive : ""
                    }`}
                    onClick={() => {
                      if (selectedRoomIndex !== null) updateRoomWallThickness(selectedRoomIndex, 4.5);
                    }}
                  >
                    4.5″ Partition
                  </button>
                  <button
                    className={`${styles.thicknessBtn} ${
                      (selectedRoom.wall_thickness_in ?? 4.5) >= 7 ? styles.thicknessBtnActive : ""
                    }`}
                    onClick={() => {
                      if (selectedRoomIndex !== null) updateRoomWallThickness(selectedRoomIndex, 9);
                    }}
                  >
                    9.0″ Load-Bearing
                  </button>
                </div>
              </div>

              {/* Wall Length Stepper & Presets */}
              <div className={styles.dimEditorSection}>
                <span className={styles.dimEditorTitle}>📐 Adjust Wall Length</span>
                <div className={styles.stepperRow}>
                  <span>Length:</span>
                  <div className={styles.stepperGroup}>
                    <button
                      className={styles.stepperBtn}
                      onClick={() =>
                        handleDimensionChange(
                          (selectedWallEdge === "E" || selectedWallEdge === "W") ? "dFt" : "wFt",
                          -1
                        )
                      }
                    >
                      −
                    </button>
                    <span className={styles.stepperValue}>
                      {Math.round(
                        inchesToFeet(
                          (selectedWallEdge === "E" || selectedWallEdge === "W")
                            ? selectedRoom.d_in
                            : selectedRoom.w_in
                        )
                      )}{" "}
                      ft
                    </span>
                    <button
                      className={styles.stepperBtn}
                      onClick={() =>
                        handleDimensionChange(
                          (selectedWallEdge === "E" || selectedWallEdge === "W") ? "dFt" : "wFt",
                          1
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.presetsRow}>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>Presets:</span>
                  {[10, 12, 14, 16, 18, 20].map((len) => (
                    <button
                      key={len}
                      className={styles.presetChip}
                      onClick={() => handleSetWallLength(len)}
                    >
                      {len} ft
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Opening Actions on this Wall */}
              <div className={styles.wallActionsSection}>
                <span className={styles.sectionHeading}>Add Opening on this Wall:</span>
                <div className={styles.wallActionButtons}>
                  <button
                    className={styles.addOpeningBtn}
                    onClick={() => handleAddOpeningOnWall("door")}
                  >
                    + 🚪 Add Door
                  </button>
                  <button
                    className={styles.addOpeningBtn}
                    onClick={() => handleAddOpeningOnWall("window")}
                  >
                    + 🪟 Add Window
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOOR / OPENING INSPECTOR */}
          {inspectorTab === "door" && (
            <div className={styles.tabContent}>
              {selectedOpening ? (
                <>
                  <div className={styles.inspectorRow}>
                    <span className={styles.inspectorLabel}>Opening On:</span>
                    <span className={styles.inspectorValue}>
                      {selectedOpening.edge} Wall ({selectedOpening.kind.toUpperCase()})
                    </span>
                  </div>

                  {/* Opening Kind Selector */}
                  <div className={styles.kindSelectorSection}>
                    <span className={styles.sectionHeading}>Opening Type:</span>
                    <div className={styles.kindButtonsGroup}>
                      {(["door", "entrance", "window", "opening"] as const).map((kind) => (
                        <button
                          key={kind}
                          className={`${styles.kindBtn} ${
                            selectedOpening.kind === kind ? styles.kindBtnActive : ""
                          }`}
                          onClick={() => handleUpdateSelectedOpening({ kind })}
                        >
                          {kind === "door"
                            ? "🚪 Door"
                            : kind === "entrance"
                            ? "⛩️ Entry"
                            : kind === "window"
                            ? "🪟 Window"
                            : "🔲 Arch"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Door Width Stepper & Architectural Presets */}
                  <div className={styles.dimEditorSection}>
                    <span className={styles.dimEditorTitle}>📐 Clear Opening Width</span>
                    <div className={styles.stepperRow}>
                      <span>Width:</span>
                      <div className={styles.stepperGroup}>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              width_in: Math.max(20, selectedOpening.width_in - 2),
                            })
                          }
                          title="Decrease width by 2 inches"
                        >
                          −
                        </button>
                        <span className={styles.stepperValue}>
                          {formatFeetInches(selectedOpening.width_in)} ({selectedOpening.width_in}″)
                        </span>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              width_in: Math.min(96, selectedOpening.width_in + 2),
                            })
                          }
                          title="Increase width by 2 inches"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className={styles.presetsRow}>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>Presets:</span>
                      {[
                        { label: "2′6″ (30″)", w: 30 },
                        { label: "2′8″ (32″)", w: 32 },
                        { label: "3′0″ (36″)", w: 36 },
                        { label: "3′6″ (42″)", w: 42 },
                        { label: "4′0″ (48″)", w: 48 },
                        { label: "5′0″ (60″)", w: 60 },
                      ].map((p) => (
                        <button
                          key={p.w}
                          className={`${styles.presetChip} ${
                            selectedOpening.width_in === p.w ? styles.presetChipActive : ""
                          }`}
                          onClick={() => handleUpdateSelectedOpening({ width_in: p.w })}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Door Height Stepper & Presets */}
                  <div className={styles.dimEditorSection}>
                    <span className={styles.dimEditorTitle}>📐 Opening Height</span>
                    <div className={styles.stepperRow}>
                      <span>Height:</span>
                      <div className={styles.stepperGroup}>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              height_in: Math.max(48, selectedOpening.height_in - 6),
                            })
                          }
                        >
                          −
                        </button>
                        <span className={styles.stepperValue}>
                          {formatFeetInches(selectedOpening.height_in)}
                        </span>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              height_in: Math.min(108, selectedOpening.height_in + 6),
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className={styles.presetsRow}>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>Presets:</span>
                      {[
                        { label: "6′6″", h: 78 },
                        { label: "7′0″ (Std)", h: 84 },
                        { label: "7′6″", h: 90 },
                        { label: "8′0″", h: 96 },
                      ].map((p) => (
                        <button
                          key={p.h}
                          className={`${styles.presetChip} ${
                            selectedOpening.height_in === p.h ? styles.presetChipActive : ""
                          }`}
                          onClick={() => handleUpdateSelectedOpening({ height_in: p.h })}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position Offset Stepper along Wall */}
                  <div className={styles.dimEditorSection}>
                    <span className={styles.dimEditorTitle}>📍 Wall Offset Position</span>
                    <div className={styles.stepperRow}>
                      <span>Offset:</span>
                      <div className={styles.stepperGroup}>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              offset_in: Math.max(0, selectedOpening.offset_in - 4),
                            })
                          }
                        >
                          −
                        </button>
                        <span className={styles.stepperValue}>
                          {formatFeetInches(selectedOpening.offset_in)}
                        </span>
                        <button
                          className={styles.stepperBtn}
                          onClick={() =>
                            handleUpdateSelectedOpening({
                              offset_in: selectedOpening.offset_in + 4,
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete Opening Action */}
                  <button
                    className={styles.deleteRoomBtn}
                    onClick={handleDeleteSelectedOpening}
                  >
                    🗑️ Delete This Opening
                  </button>
                </>
              ) : (
                <div className={styles.emptyOpeningsState}>
                  <span>💡 Click any door/window in the blueprint or choose one below:</span>
                  <div className={styles.openingsList}>
                    {(selectedRoom.openings ?? []).map((op, oi) => (
                      <div
                        key={oi}
                        className={styles.openingItem}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setSelectedOpeningIndex(oi);
                          setSelectedWallEdge(op.edge);
                        }}
                      >
                        <span>
                          {op.kind === "door" ? "🚪" : op.kind === "entrance" ? "⛩️" : "🪟"}{" "}
                          {op.kind.toUpperCase()} on {op.edge} Wall
                        </span>
                        <span>{formatFeetInches(op.width_in)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.addOpeningBtn}
                    style={{ marginTop: 10 }}
                    onClick={() => handleAddOpeningOnWall("door")}
                  >
                    + 🚪 Add New Door
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
