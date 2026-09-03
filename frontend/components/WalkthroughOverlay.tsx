"use client";

// First-Person Walkthrough HUD Overlay — crosshair, room badge, touch D-pad & action controls, room teleporter.

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
  activeMoveCmd?: string | null;
  onMoveCmdChange?: (cmd: string | null) => void;
  onExit: () => void;
  onToggleLights?: () => void;
  onTeleport?: (index: number) => void;
}

export default function WalkthroughOverlay({
  currentRoom,
  currentRoomIndex,
  rooms,
  player,
  lightsOn = true,
  activeMoveCmd,
  onMoveCmdChange,
  onExit,
  onToggleLights,
  onTeleport,
}: WalkthroughOverlayProps) {
  const roomName = currentRoom?.name as RoomName | undefined;
  const roomLabel = roomName ? ROOM_LABELS[roomName] ?? currentRoom?.name : "Circulation / Foyer";
  const hexColor = roomName ? ROOM_COLORS[roomName] ?? 0xe8912d : 0x8899aa;

  const wFt = currentRoom ? inchesToFeet(currentRoom.w_in) : 0;
  const dFt = currentRoom ? inchesToFeet(currentRoom.d_in) : 0;

  const handlePointerDownCmd = (cmd: string) => {
    onMoveCmdChange?.(cmd);
  };

  const handlePointerUpCmd = () => {
    onMoveCmdChange?.(null);
  };

  return (
    <div className={styles.walkthroughOverlay}>
      {/* Center Reticle / Crosshair */}
      <div className={styles.crosshair}>
        <div className={styles.crosshairDot} />
      </div>

      {/* Top Bar: Location Badge & Teleport Bar & Exit Button */}
      <div className={styles.topBar}>
        <div className={styles.locationBadge}>
          <div
            className={styles.roomDot}
            style={{
              background: `#${hexColor.toString(16).padStart(6, "0")}`,
              color: `#${hexColor.toString(16).padStart(6, "0")}`,
            }}
          />
          <div className={styles.roomInfo}>
            <span className={styles.roomTitle}>
              {roomLabel}
              <span className={styles.eyeLevelTag}>
                {player?.isCrouched ? "2′8″ Eye" : "5′5″ Eye"}
              </span>
            </span>
            {currentRoom && (
              <span className={styles.roomDims}>
                {wFt}′ × {dFt}′ ft • {Math.round(wFt * dFt)} sq ft
              </span>
            )}
          </div>
        </div>

        {/* Teleport to Room Bar */}
        {rooms.length > 0 && onTeleport && (
          <div className={styles.teleportBar}>
            {rooms.map((r, idx) => {
              const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
              const isActive = idx === currentRoomIndex;
              return (
                <button
                  key={idx}
                  className={`${styles.teleportBtn} ${isActive ? styles.activeTeleport : ""}`}
                  onClick={() => onTeleport(idx)}
                  title={`Jump directly into ${label}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.topActions}>
          {onToggleLights && (
            <button
              className={`${styles.actionBtn} ${lightsOn ? styles.actionBtnActive : ""}`}
              onClick={onToggleLights}
              title="Toggle Interior Room Lights (F)"
            >
              💡 {lightsOn ? "Lights ON" : "Lights OFF"}
            </button>
          )}
          <button className={styles.exitBtn} onClick={onExit} title="Exit Walkthrough (ESC)">
            ✕ Exit Walkthrough [ESC]
          </button>
        </div>
      </div>

      {/* Center Subtle Hint for Desktop Users */}
      <div className={styles.centerHint}>
        <span>⌨️ WASD to Walk</span>
        <span>•</span>
        <span>🖱️ Drag / Swipe to Look</span>
        <span>•</span>
        <span>Shift Sprint</span>
        <span>•</span>
        <span>Space Jump</span>
      </div>

      {/* Bottom Container: Touch D-Pad on Left & Mobile Action Buttons on Right */}
      <div className={styles.bottomContainer}>
        {/* Mobile / Touch Virtual D-Pad (Navigation) */}
        <div className={styles.dpad}>
          {/* Row 1: Turn Left, Forward, Turn Right */}
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "turnLeft" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("turnLeft")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Turn Left"
          >
            ↺
          </button>
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "forward" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("forward")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Move Forward"
          >
            ▲
          </button>
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "turnRight" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("turnRight")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Turn Right"
          >
            ↻
          </button>

          {/* Row 2: Strafe Left, Backward, Strafe Right */}
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "left" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("left")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Strafe Left"
          >
            ◀
          </button>
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "backward" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("backward")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Move Backward"
          >
            ▼
          </button>
          <button
            className={`${styles.dpadBtn} ${activeMoveCmd === "right" ? styles.dpadBtnActive : ""}`}
            onPointerDown={() => handlePointerDownCmd("right")}
            onPointerUp={handlePointerUpCmd}
            onPointerLeave={handlePointerUpCmd}
            title="Strafe Right"
          >
            ▶
          </button>
        </div>

        {/* Mobile / Touch Action Pad (Sprint, Jump, Crouch, Lights) */}
        <div className={styles.actionPad}>
          <div className={styles.actionPadRow}>
            <button
              className={`${styles.actionPadBtn} ${activeMoveCmd === "sprint" ? styles.actionPadBtnActive : ""}`}
              onPointerDown={() => handlePointerDownCmd("sprint")}
              onPointerUp={handlePointerUpCmd}
              onPointerLeave={handlePointerUpCmd}
              title="Hold to Sprint"
            >
              ⚡
              <span>Run</span>
            </button>
            <button
              className={`${styles.actionPadBtn} ${activeMoveCmd === "jump" ? styles.actionPadBtnActive : ""}`}
              onPointerDown={() => handlePointerDownCmd("jump")}
              onPointerUp={handlePointerUpCmd}
              onPointerLeave={handlePointerUpCmd}
              title="Jump"
            >
              ⬆️
              <span>Jump</span>
            </button>
          </div>
          <div className={styles.actionPadRow}>
            <button
              className={`${styles.actionPadBtn} ${activeMoveCmd === "crouch" ? styles.actionPadBtnActive : ""}`}
              onPointerDown={() => handlePointerDownCmd("crouch")}
              onPointerUp={handlePointerUpCmd}
              onPointerLeave={handlePointerUpCmd}
              title="Crouch / Eye Level Down"
            >
              ⬇️
              <span>Duck</span>
            </button>
            {onToggleLights && (
              <button
                className={`${styles.actionPadBtn} ${lightsOn ? styles.actionPadBtnActive : ""}`}
                onClick={onToggleLights}
                title="Toggle Lights"
              >
                💡
                <span>Light</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
