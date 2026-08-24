"use client";

// First-Person Walkthrough HUD Overlay — crosshair, room badge, controls cheat sheet, minimap radar toggle.

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
  onToggleLights?: () => void;
  onTeleport?: (index: number) => void;
}

export default function WalkthroughOverlay({
  currentRoom,
  player,
  lightsOn = true,
  onExit,
  onToggleLights,
}: WalkthroughOverlayProps) {
  const roomName = currentRoom?.name as RoomName | undefined;
  const roomLabel = roomName ? ROOM_LABELS[roomName] ?? currentRoom?.name : "Circulation / Foyer";
  const hexColor = roomName ? ROOM_COLORS[roomName] ?? 0xe8912d : 0x8899aa;

  const wFt = currentRoom ? inchesToFeet(currentRoom.w_in) : 0;
  const dFt = currentRoom ? inchesToFeet(currentRoom.d_in) : 0;

  return (
    <div className={styles.overlayContainer}>
      {/* Center Reticle / Crosshair */}
      <div className={styles.crosshair}>
        <div className={styles.crosshairDot} />
      </div>

      {/* Top Center: Current Room Banner */}
      <div className={styles.roomBanner}>
        <div
          className={styles.roomColorIndicator}
          style={{ background: `#${hexColor.toString(16).padStart(6, "0")}` }}
        />
        <div className={styles.roomTextGroup}>
          <span className={styles.currentRoomName}>{roomLabel}</span>
          {currentRoom && (
            <span className={styles.currentRoomDims}>
              {wFt}′ × {dFt}′ ft • {Math.round(wFt * dFt)} sq ft
            </span>
          )}
        </div>
      </div>

      {/* Bottom Center: Quick Controls HUD */}
      <div className={styles.bottomHud}>
        <div className={styles.hudCard}>
          <div className={styles.hudHeader}>
            <span className={styles.hudTitle}>🎮 5′5″ First-Person Navigation</span>
            <button className={styles.exitBtn} onClick={onExit} title="Exit Walkthrough (ESC)">
              ✕ Exit to Aerial Orbit [ESC]
            </button>
          </div>

          <div className={styles.hudKeysGrid}>
            <div className={styles.keyItem}>
              <span className={styles.keyBadge}>W A S D</span>
              <span className={styles.keyDesc}>Walk</span>
            </div>
            <div className={styles.keyItem}>
              <span className={styles.keyBadge}>Mouse Drag</span>
              <span className={styles.keyDesc}>Look Around</span>
            </div>
            <div className={styles.keyItem}>
              <span className={styles.keyBadge}>Shift</span>
              <span className={styles.keyDesc}>Sprint</span>
            </div>
            <div className={styles.keyItem}>
              <span className={styles.keyBadge}>Space</span>
              <span className={styles.keyDesc}>Jump</span>
            </div>
            <div className={styles.keyItem}>
              <span className={styles.keyBadge}>C</span>
              <span className={styles.keyDesc}>Crouch</span>
            </div>
            <div className={styles.keyItem} onClick={onToggleLights} style={{ cursor: "pointer" }}>
              <span className={styles.keyBadge}>F</span>
              <span className={styles.keyDesc}>Lights ({lightsOn ? "ON" : "OFF"})</span>
            </div>
          </div>

          {player && (
            <div className={styles.telemetryRow}>
              <span>
                Eye Level: <strong>{player.isCrouched ? "3′8″ (Crouched)" : "5′5″ (Standing)"}</strong>
              </span>
              <span>•</span>
              <span>
                Status: <strong>{player.isSprinting ? "Sprinting" : player.isMoving ? "Walking" : "Idle"}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
