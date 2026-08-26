"use client";

import React, { useState, useRef, useCallback } from "react";
import { PlotDims, Facing, Setback, edgeSetbacksIn, frontCardinalIndex } from "@/lib/plot";
import { SolvedRoom, SolveMeta } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import { ROOM_COLORS, ROOM_LABELS, ROOM_NAMES, RoomName } from "@/lib/rooms";
import { CustomDim } from "./RoomCustomizer";
import {
  formatFeetInches,
  formatAreaSqFt,
  getRoomVaastuZone,
  VAASTU_ZONE_LABELS,
} from "@/lib/blueprintExport";
import styles from "./Blueprint2DView.module.css";

interface Blueprint2DViewProps {
  plot: PlotDims;
  facing: Facing;
  setback: Setback;
  rooms: SolvedRoom[];
  meta: SolveMeta | null;
  counts: Record<RoomName, number>;
  customDims: Record<string, CustomDim>;
  onChangeCounts: (counts: Record<RoomName, number>) => void;
  onChangeCustomDims: (dims: Record<string, CustomDim>) => void;
  onRoomMove?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => void;
  onOpenExportModal: () => void;
}

export default function Blueprint2DView({
  plot,
  facing,
  setback,
  rooms,
  counts,
  customDims,
  onChangeCounts,
  onChangeCustomDims,
  onRoomMove,
  onOpenExportModal,
}: Blueprint2DViewProps) {
  // Layer visibility state
  const [showDimensions, setShowDimensions] = useState(true);
  const [showSetbacks, setShowSetbacks] = useState(true);
  const [showVaastuGrid, setShowVaastuGrid] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);

  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag-to-Move Room State
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffsetIn, setDragOffsetIn] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragStartMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRoomRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Mouse pan & drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!isDraggingRoomRef.current) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRoomRef.current && draggingIndex !== null) {
      // Calculate inch delta from mouse drag
      const deltaScreenX = (e.clientX - dragStartMouseRef.current.x) / zoom;
      const deltaScreenY = (e.clientY - dragStartMouseRef.current.y) / zoom;

      const deltaInchesX = Math.round(deltaScreenX / baseScale);
      const deltaInchesY = Math.round(deltaScreenY / baseScale);

      setDragOffsetIn({ dx: deltaInchesX, dy: deltaInchesY });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRoomRef.current && draggingIndex !== null && onRoomMove) {
      const room = rooms[draggingIndex];
      if (room) {
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

    setIsPanning(false);
    isDraggingRoomRef.current = false;
    setDraggingIndex(null);
    setDragOffsetIn({ dx: 0, dy: 0 });
  };

  const handleRoomMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedRoomIndex(idx);
    setDraggingIndex(idx);
    isDraggingRoomRef.current = true;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    setDragOffsetIn({ dx: 0, dy: 0 });
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

        {/* Export Blueprint Button */}
        <button className={styles.exportBtn} onClick={onOpenExportModal}>
          📥 Export Blueprint
        </button>
      </div>

      {/* Legend Overlay */}
      <div className={styles.legendOverlay}>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#7dd3fc" }} />
          <span>Walls (9″/4.5″)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#fbbf24" }} />
          <span>Doors &amp; Swings</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#34d399" }} />
          <span>Windows</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColorBox} style={{ background: "#f43f5e" }} />
          <span>Setback Boundary</span>
        </div>
      </div>

      {/* Interactive Edit Tip Pill */}
      <div className={styles.editTipOverlay}>
        <span>🖐️ Drag any room to reposition • Click to edit dimensions • Changes sync instantly to 3D</span>
      </div>

      {/* SVG Blueprint Canvas Viewport */}
      <svg
        className={`${styles.canvasViewport} ${isPanning ? styles.canvasViewportPanning : ""}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0e2d4f" strokeWidth="0.8" />
          </pattern>
          <pattern id="fineGrid" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#0a233f" strokeWidth="0.4" />
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
                height={20}
                fill="#38bdf822"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY - 13}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="1"
              >
                ▲ {roadLabel} ▲
              </text>
            </g>
          )}
          {frontIdx === 1 && (
            <g>
              <rect
                x={plotPxX + plotPxW + 6}
                y={plotPxY}
                width={20}
                height={plotPxH}
                fill="#38bdf822"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text
                x={plotPxX + plotPxW + 16}
                y={plotPxY + plotPxH / 2}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(90, ${plotPxX + plotPxW + 16}, ${plotPxY + plotPxH / 2})`}
                letterSpacing="1"
              >
                ▲ {roadLabel} ▲
              </text>
            </g>
          )}
          {frontIdx === 2 && (
            <g>
              <rect
                x={plotPxX}
                y={plotPxY + plotPxH + 6}
                width={plotPxW}
                height={20}
                fill="#38bdf822"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY + plotPxH + 19}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="1"
              >
                ▼ {roadLabel} ▼
              </text>
            </g>
          )}
          {frontIdx === 3 && (
            <g>
              <rect
                x={plotPxX - 26}
                y={plotPxY}
                width={20}
                height={plotPxH}
                fill="#38bdf822"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text
                x={plotPxX - 16}
                y={plotPxY + plotPxH / 2}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(-90, ${plotPxX - 16}, ${plotPxY + plotPxH / 2})`}
                letterSpacing="1"
              >
                ▲ {roadLabel} ▲
              </text>
            </g>
          )}

          {/* Setback Boundary & Envelope */}
          {showSetbacks && (
            <g>
              <rect
                x={envPxX}
                y={envPxY}
                width={envPxW}
                height={envPxH}
                fill="#f43f5e08"
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="6,4"
              />
              {/* Setback Distance Labels */}
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY + (setbackN * baseScale) / 2 + 4}
                fill="#f43f5e"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                Front/N Setback: {formatFeetInches(setbackN)}
              </text>
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY + plotPxH - (setbackS * baseScale) / 2 + 4}
                fill="#f43f5e"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                Rear/S Setback: {formatFeetInches(setbackS)}
              </text>
              <text
                x={plotPxX + (setbackW * baseScale) / 2}
                y={plotPxY + plotPxH / 2}
                fill="#f43f5e"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
                transform={`rotate(-90, ${plotPxX + (setbackW * baseScale) / 2}, ${
                  plotPxY + plotPxH / 2
                })`}
              >
                Side (W): {formatFeetInches(setbackW)}
              </text>
              <text
                x={plotPxX + plotPxW - (setbackE * baseScale) / 2}
                y={plotPxY + plotPxH / 2}
                fill="#f43f5e"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
                transform={`rotate(90, ${plotPxX + plotPxW - (setbackE * baseScale) / 2}, ${
                  plotPxY + plotPxH / 2
                })`}
              >
                Side (E): {formatFeetInches(setbackE)}
              </text>
            </g>
          )}

          {/* Outer Plot Dimension Strings */}
          {showDimensions && (
            <g>
              {/* Top Dimension (Width) */}
              <line
                x1={plotPxX}
                y1={plotPxY - 8}
                x2={plotPxX}
                y2={plotPxY - 50}
                stroke="#38bdf8"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={plotPxX + plotPxW}
                y1={plotPxY - 8}
                x2={plotPxX + plotPxW}
                y2={plotPxY - 50}
                stroke="#38bdf8"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={plotPxX}
                y1={plotPxY - 42}
                x2={plotPxX + plotPxW}
                y2={plotPxY - 42}
                stroke="#38bdf8"
                strokeWidth="1.5"
                markerStart="url(#dimTick)"
                markerEnd="url(#dimTick)"
              />
              <rect
                x={plotPxX + plotPxW / 2 - 45}
                y={plotPxY - 53}
                width="90"
                height="22"
                fill="#06182c"
                rx="4"
              />
              <text
                x={plotPxX + plotPxW / 2}
                y={plotPxY - 38}
                fill="#38bdf8"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {formatFeetInches(plot.widthIn)}
              </text>

              {/* Right Dimension (Depth) */}
              <line
                x1={plotPxX + plotPxW + 8}
                y1={plotPxY}
                x2={plotPxX + plotPxW + 50}
                y2={plotPxY}
                stroke="#38bdf8"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={plotPxX + plotPxW + 8}
                y1={plotPxY + plotPxH}
                x2={plotPxX + plotPxW + 50}
                y2={plotPxY + plotPxH}
                stroke="#38bdf8"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={plotPxX + plotPxW + 42}
                y1={plotPxY}
                x2={plotPxX + plotPxW + 42}
                y2={plotPxY + plotPxH}
                stroke="#38bdf8"
                strokeWidth="1.5"
                markerStart="url(#dimTick)"
                markerEnd="url(#dimTick)"
              />
              <rect
                x={plotPxX + plotPxW + 31}
                y={plotPxY + plotPxH / 2 - 45}
                width="22"
                height="90"
                fill="#06182c"
                rx="4"
              />
              <text
                x={plotPxX + plotPxW + 42}
                y={plotPxY + plotPxH / 2}
                fill="#38bdf8"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
                transform={`rotate(90, ${plotPxX + plotPxW + 42}, ${plotPxY + plotPxH / 2})`}
              >
                {formatFeetInches(plot.depthIn)}
              </text>
            </g>
          )}

          {/* Placed Rooms (with interactive Drag-to-Move and Selection) */}
          {rooms.map((room, idx) => {
            const isDraggingThis = draggingIndex === idx;
            const currentXIn = isDraggingThis ? room.x_in + dragOffsetIn.dx : room.x_in;
            const currentYIn = isDraggingThis ? room.y_in + dragOffsetIn.dy : room.y_in;

            const rx = toPxX(currentXIn);
            const ry = toPxY(currentYIn);
            const rw = room.w_in * baseScale;
            const rd = room.d_in * baseScale;

            const isSelected = idx === selectedRoomIndex;
            const label = ROOM_LABELS[room.name as RoomName] ?? room.name;
            const zone = getRoomVaastuZone(room, plot.widthIn, plot.depthIn);
            const zoneInfo = VAASTU_ZONE_LABELS[zone];

            const wallThicknessPx = Math.max(2, 4.5 * baseScale);

            return (
              <g
                key={idx}
                id={`room-${idx}`}
                style={{
                  cursor: isDraggingThis ? "grabbing" : "grab",
                  transition: isDraggingThis ? "none" : "transform 0.15s ease",
                }}
                onMouseDown={(e) => handleRoomMouseDown(e, idx)}
              >
                {/* Room Floor Fill */}
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rd}
                  fill={isSelected ? "#0284c7" : isDraggingThis ? "#0369a1" : "#0c3b6d"}
                  stroke={isSelected ? "#ffffff" : isDraggingThis ? "#38bdf8" : "#7dd3fc"}
                  strokeWidth={isSelected || isDraggingThis ? 3.5 : 2}
                  filter={isDraggingThis ? "drop-shadow(0 8px 16px rgba(0,0,0,0.6))" : undefined}
                  rx="1"
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
                />

                {/* Selection / Drag Highlight Border */}
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
                  />
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

                {/* Doors and Windows */}
                {(room.openings ?? []).map((opening, oIdx) => {
                  const openOffsetPx = opening.offset_in * baseScale;
                  const openWidthPx = opening.width_in * baseScale;

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
                    const doorColor = isEntrance ? "#38bdf8" : "#fbbf24";

                    return (
                      <g key={`door-${oIdx}`} pointerEvents="none">
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
                          strokeWidth="4"
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
                          strokeWidth="1.8"
                        />
                        {isEntrance && (
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
                      <g key={`win-${oIdx}`} pointerEvents="none">
                        <line
                          x1={ox}
                          y1={oy}
                          x2={wx2}
                          y2={wy2}
                          stroke="#34d399"
                          strokeWidth="3.5"
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
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
          })}

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

      {/* Floating Room Inspector & Live Dimension Steppers (When a room is clicked) */}
      {selectedRoom && (
        <div className={styles.inspectorCard}>
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitle}>
              {ROOM_LABELS[selectedRoom.name as RoomName] ?? selectedRoom.name}
            </div>
            <button
              className={styles.inspectorClose}
              onClick={() => setSelectedRoomIndex(null)}
            >
              ×
            </button>
          </div>

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

          {/* Interactive Live Dimension Steppers */}
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
              <button
                className={styles.presetChip}
                onClick={() => handleSetPresetDimensions(10, 12)}
              >
                10×12
              </button>
              <button
                className={styles.presetChip}
                onClick={() => handleSetPresetDimensions(12, 14)}
              >
                12×14
              </button>
              <button
                className={styles.presetChip}
                onClick={() => handleSetPresetDimensions(14, 16)}
              >
                14×16
              </button>
              <button
                className={styles.presetChip}
                onClick={() => handleSetPresetDimensions(16, 18)}
              >
                16×18
              </button>
            </div>
          </div>

          {/* Delete / Remove Room Action */}
          <button className={styles.deleteRoomBtn} onClick={handleDeleteSelectedRoom}>
            🗑️ Delete This Room
          </button>

          {/* Openings list */}
          {selectedRoom.openings && selectedRoom.openings.length > 0 && (
            <div>
              <span className={styles.inspectorLabel} style={{ fontSize: "11px" }}>
                Openings ({selectedRoom.openings.length}):
              </span>
              <div className={styles.openingsList}>
                {selectedRoom.openings.map((op, oi) => (
                  <div key={oi} className={styles.openingItem}>
                    <span>
                      {op.kind.toUpperCase()} on {op.edge} Wall
                    </span>
                    <span>
                      {formatFeetInches(op.width_in)} × {formatFeetInches(op.height_in)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
