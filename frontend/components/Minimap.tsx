"use client";

import React, { useEffect, useRef } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlotDims, Facing } from "@/lib/plot";
import { inchesToFeet } from "@/lib/units";
import { ROOM_COLORS, ROOM_LABELS, RoomName } from "@/lib/rooms";
import { PlayerTransform } from "@/lib/walkthrough";
import styles from "./Minimap.module.css";

interface MinimapProps {
  plot: PlotDims;
  facing: Facing;
  rooms: SolvedRoom[];
  player: PlayerTransform;
  currentRoomIndex: number | null;
  onTeleport?: (x: number, z: number) => void;
}

const CANVAS_SIZE = 180;

export default function Minimap({
  plot,
  rooms,
  player,
  currentRoomIndex,
  onTeleport,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const plotWFt = inchesToFeet(plot.widthIn);
  const plotDFt = inchesToFeet(plot.depthIn);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const padding = 14;
    const drawW = CANVAS_SIZE - padding * 2;
    const drawH = CANVAS_SIZE - padding * 2;

    const scale = Math.min(drawW / Math.max(plotWFt, 1), drawH / Math.max(plotDFt, 1));
    const offsetX = padding + (drawW - plotWFt * scale) / 2;
    const offsetZ = padding + (drawH - plotDFt * scale) / 2;

    // Helper: convert world (x, z) in feet to canvas (cx, cy)
    const toCanvas = (x: number, z: number) => ({
      cx: offsetX + x * scale,
      cy: offsetZ + z * scale,
    });

    // 1. Draw Plot boundary
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetZ, plotWFt * scale, plotDFt * scale);

    // 2. Draw compass direction badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N (0°)", offsetX + (plotWFt * scale) / 2, offsetZ - 4);

    // 3. Draw Rooms
    rooms.forEach((room, idx) => {
      const rx = inchesToFeet(room.x_in);
      const rz = inchesToFeet(room.y_in);
      const rw = inchesToFeet(room.w_in);
      const rd = inchesToFeet(room.d_in);

      const p0 = toCanvas(rx, rz);
      const wPx = rw * scale;
      const hPx = rd * scale;

      const hexColor = ROOM_COLORS[room.name as RoomName] ?? 0xe8912d;
      const isCurrent = idx === currentRoomIndex;

      // Fill
      ctx.fillStyle = isCurrent
        ? `#${hexColor.toString(16).padStart(6, "0")}bb`
        : `#${hexColor.toString(16).padStart(6, "0")}55`;
      ctx.fillRect(p0.cx, p0.cy, wPx, hPx);

      // Stroke
      ctx.strokeStyle = isCurrent ? "#ffffff" : `#${hexColor.toString(16).padStart(6, "0")}aa`;
      ctx.lineWidth = isCurrent ? 2 : 1;
      ctx.strokeRect(p0.cx, p0.cy, wPx, hPx);

      // Label
      ctx.fillStyle = isCurrent ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
      ctx.font = isCurrent ? "bold 9px sans-serif" : "8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = ROOM_LABELS[room.name as RoomName] ?? room.name;
      ctx.fillText(label, p0.cx + wPx / 2, p0.cy + hPx / 2);
    });

    // 4. Draw Player Position and FOV Cone
    const playerCanvas = toCanvas(player.x, player.z);

    // Viewing FOV cone (angle in radians; 0 is pointing North / -Z, so -PI/2 in screen space)
    const coneRadius = 26;
    const fovAngle = Math.PI / 3.2; // ~56 deg cone
    const viewAngle = player.yaw - Math.PI / 2;

    const startAngle = viewAngle - fovAngle / 2;
    const endAngle = viewAngle + fovAngle / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(playerCanvas.cx, playerCanvas.cy);
    ctx.arc(playerCanvas.cx, playerCanvas.cy, coneRadius, startAngle, endAngle);
    ctx.closePath();
    const grad = ctx.createRadialGradient(
      playerCanvas.cx,
      playerCanvas.cy,
      2,
      playerCanvas.cx,
      playerCanvas.cy,
      coneRadius
    );
    grad.addColorStop(0, "rgba(232, 145, 45, 0.7)");
    grad.addColorStop(1, "rgba(232, 145, 45, 0.0)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Player dot
    ctx.beginPath();
    ctx.arc(playerCanvas.cx, playerCanvas.cy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#e8912d";
    ctx.stroke();
  }, [plot, rooms, player, currentRoomIndex, plotWFt, plotDFt]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTeleport) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const padding = 14;
    const drawW = CANVAS_SIZE - padding * 2;
    const drawH = CANVAS_SIZE - padding * 2;
    const scale = Math.min(drawW / Math.max(plotWFt, 1), drawH / Math.max(plotDFt, 1));
    const offsetX = padding + (drawW - plotWFt * scale) / 2;
    const offsetZ = padding + (drawH - plotDFt * scale) / 2;

    const wx = (cx - offsetX) / scale;
    const wz = (cy - offsetZ) / scale;

    if (wx >= 0 && wx <= plotWFt && wz >= 0 && wz <= plotDFt) {
      onTeleport(wx, wz);
    }
  };

  return (
    <div className={styles.radarContainer}>
      <div className={styles.radarCard}>
        <div className={styles.radarHeader}>
          <span>Live Radar</span>
          <span style={{ fontSize: "9px", opacity: 0.6 }}>Click to Jump</span>
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className={styles.radarCanvas}
          onClick={handleCanvasClick}
          title="Click to teleport player to location"
        />
      </div>
    </div>
  );
}
