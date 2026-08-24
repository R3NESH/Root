"use client";

import React from "react";
import { SolvedRoom } from "@/lib/solve";
import { ROOM_COLORS, ROOM_LABELS, RoomName } from "@/lib/rooms";
import { inchesToFeet } from "@/lib/units";
import { PlayerTransform } from "@/lib/walkthrough";
import styles from "./WalkthroughOverlay.module.css";

interface WalkthroughOverlayProps {
  currentRoom: SolvedRoom | null;
  currentRoomIndex: number | null;
  rooms: SolvedRoom[];
  player?: PlayerTransform;
  lightsOn?: boolean;
  onExit: () => void;
  onTeleportToRoom: (index: number) => void;
  onToggleLights?: () => void;
  onMoveStart?: (cmd: "forward" | "backward" | "left" | "right" | "turnLeft" | "turnRight" | "sprint" | "crouch") => void;
  onMoveEnd?: () => void;
}

export default function WalkthroughOverlay({
  currentRoom,
  currentRoomIndex,
  rooms,
  lightsOn = true,
  onExit,
  onTeleportToRoom,
  onToggleLights,
  onMoveStart,
  onMoveEnd,
}: WalkthroughOverlayProps) {
  const roomHex = currentRoom
    ? (ROOM_COLORS[currentRoom.name as RoomName] ?? 0xe8912d).toString(16).padStart(6, "0")
    : "ffffff";
  const roomTitle = currentRoom
    ? (ROOM_LABELS[currentRoom.name as RoomName] ?? currentRoom.name)
    : "Inside House";

  return (
    <div className={styles.walkthroughOverlay}>
      {/* Top Bar HUD */}
      <div className={styles.topBar}>
        <div className={styles.locationBadge}>
          <div
            className={styles.roomDot}
            style={{ backgroundColor: `#${roomHex}`, color: `#${roomHex}` }}
          />
          <div className={styles.roomInfo}>
            <div className={styles.roomTitle}>
              {roomTitle}
              <span className={styles.eyeLevelTag}>🚶 5&apos;5&quot; Human Perspective</span>
            </div>
            {currentRoom && (
              <div className={styles.roomDims}>
                {inchesToFeet(currentRoom.w_in)}&apos; × {inchesToFeet(currentRoom.d_in)}&apos; ft
              </div>
            )}
          </div>
        </div>

        {/* Action buttons (Lights, Exit) */}
        <div className={styles.topActions}>
          <button
            className={`${styles.actionBtn} ${lightsOn ? styles.actionBtnActive : ""}`}
            onClick={onToggleLights}
            title="Toggle Room Lights (F)"
          >
            <span>{lightsOn ? "💡" : "🌙"}</span> {lightsOn ? "Lights ON (F)" : "Lights OFF (F)"}
          </button>

          <button className={styles.exitBtn} onClick={onExit} title="Exit Walkthrough (ESC)">
            <span>✕</span> Exit Walkthrough
          </button>
        </div>
      </div>

      {/* Center Controls Legend */}
      <div className={styles.centerHint}>
        <span>🖱️ <strong>Drag</strong> Look 360°</span>
        <span>⌨️ <strong>WASD / Arrows</strong> Walk</span>
        <span>⚡ <strong>Shift</strong> Sprint</span>
        <span>🧘 <strong>C</strong> Crouch</span>
        <span>🦘 <strong>Space</strong> Jump</span>
        <span>💡 <strong>F</strong> Lights</span>
      </div>

      {/* Bottom Container: Teleport + Touch/Mouse Navigation D-Pad */}
      <div className={styles.bottomContainer}>
        {/* Quick Room Teleport Bar */}
        <div className={styles.teleportBar}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", alignSelf: "center" }}>
            Jump to:
          </span>
          {rooms.map((r, i) => {
            const isActive = i === currentRoomIndex;
            const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
            return (
              <button
                key={`${r.name}-${i}`}
                className={`${styles.teleportBtn} ${isActive ? styles.activeTeleport : ""}`}
                onClick={() => onTeleportToRoom(i)}
              >
                {label} {i > 0 && r.name === rooms[i - 1]?.name ? `(${i + 1})` : ""}
              </button>
            );
          })}
        </div>

        {/* Virtual Directional Pad */}
        <div className={styles.dpad}>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("turnLeft")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Turn Left"
          >
            ↺
          </button>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("forward")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Walk Forward (W)"
          >
            ▲
          </button>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("turnRight")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Turn Right"
          >
            ↻
          </button>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("left")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Strafe Left (A)"
          >
            ◀
          </button>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("backward")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Walk Backward (S)"
          >
            ▼
          </button>
          <button
            className={styles.dpadBtn}
            onPointerDown={() => onMoveStart?.("right")}
            onPointerUp={onMoveEnd}
            onPointerLeave={onMoveEnd}
            title="Strafe Right (D)"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
