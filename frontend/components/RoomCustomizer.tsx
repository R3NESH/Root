"use client";

import React from "react";
import { ROOM_COLORS, ROOM_LABELS, RoomName, ROOM_NAMES } from "@/lib/rooms";
import { SolvedRoom } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import styles from "./RoomCustomizer.module.css";

export interface CustomDim {
  wFt: number;
  dFt: number;
}

interface RoomCustomizerProps {
  counts: Record<RoomName, number>;
  rooms: SolvedRoom[];
  customDims: Record<string, CustomDim>;
  onChangeCustomDims: (next: Record<string, CustomDim>) => void;
}

export default function RoomCustomizer({
  counts,
  rooms,
  customDims,
  onChangeCustomDims,
}: RoomCustomizerProps) {
  // Build active room list from counts so it works for single room, 2 rooms, or any count
  const activeRooms: { id: string; name: RoomName; label: string; index: number }[] = [];
  let globalIdx = 0;
  for (const name of ROOM_NAMES) {
    const count = counts[name] ?? 0;
    for (let c = 0; c < count; c++) {
      activeRooms.push({
        id: `${name}_${c}`,
        name,
        label: count > 1 ? `${ROOM_LABELS[name]} ${c + 1}` : ROOM_LABELS[name],
        index: globalIdx++,
      });
    }
  }

  if (activeRooms.length === 0) return null;

  const handleDimChange = (id: string, roomIdx: number, roomName: RoomName, key: "wFt" | "dFt", delta: number) => {
    const solved = rooms[roomIdx];
    const defaultW = solved ? Math.round(inchesToFeet(solved.w_in)) : (roomName === "hall" || roomName === "bedroom" ? 14 : 10);
    const defaultD = solved ? Math.round(inchesToFeet(solved.d_in)) : (roomName === "hall" || roomName === "bedroom" ? 14 : 10);

    const current = customDims[id] ?? {
      wFt: defaultW,
      dFt: defaultD,
    };

    const nextVal = Math.max(4, Math.min(35, current[key] + delta));
    const nextDims = {
      ...customDims,
      [id]: {
        ...current,
        [key]: nextVal,
      },
    };
    onChangeCustomDims(nextDims);
  };

  const handleApplyPreset = (id: string, w: number, d: number) => {
    const nextDims = {
      ...customDims,
      [id]: { wFt: w, dFt: d },
    };
    onChangeCustomDims(nextDims);
  };

  const handleResetRoom = (id: string) => {
    const next = { ...customDims };
    delete next[id];
    onChangeCustomDims(next);
  };

  const handleResetAll = () => {
    onChangeCustomDims({});
  };

  return (
    <div className={styles.customizerContainer}>
      <div className={styles.customizerHeader}>
        <span>📐 Custom Room Dimensions</span>
        <button className={styles.resetAllBtn} onClick={handleResetAll} title="Reset all to automatic">
          Reset Auto
        </button>
      </div>

      <div className={styles.roomList}>
        {activeRooms.map((item) => {
          const hex = (ROOM_COLORS[item.name] ?? 0xe8912d).toString(16).padStart(6, "0");
          const custom = customDims[item.id];
          const solved = rooms[item.index];

          const currentW = custom ? custom.wFt : (solved ? Math.round(inchesToFeet(solved.w_in)) : 14);
          const currentD = custom ? custom.dFt : (solved ? Math.round(inchesToFeet(solved.d_in)) : 14);
          const sqFt = currentW * currentD;

          return (
            <div key={item.id} className={styles.roomCard}>
              <div className={styles.roomCardTop}>
                <div className={styles.roomTitleRow}>
                  <div className={styles.colorDot} style={{ backgroundColor: `#${hex}` }} />
                  <span className={styles.roomNameText}>{item.label}</span>
                </div>
                <div className={styles.sqFtBadge}>{sqFt} sq ft</div>
              </div>

              {/* Width & Depth Steppers */}
              <div className={styles.dimensionControls}>
                {/* Width */}
                <div className={styles.controlGroup}>
                  <span className={styles.dimLabel}>W</span>
                  <div className={styles.stepper}>
                    <button
                      className={styles.stepBtn}
                      onClick={() => handleDimChange(item.id, item.index, item.name, "wFt", -1)}
                      title="Decrease Width"
                    >
                      -
                    </button>
                    <span className={styles.dimValue}>{currentW}&apos;</span>
                    <button
                      className={styles.stepBtn}
                      onClick={() => handleDimChange(item.id, item.index, item.name, "wFt", 1)}
                      title="Increase Width"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Depth */}
                <div className={styles.controlGroup}>
                  <span className={styles.dimLabel}>D</span>
                  <div className={styles.stepper}>
                    <button
                      className={styles.stepBtn}
                      onClick={() => handleDimChange(item.id, item.index, item.name, "dFt", -1)}
                      title="Decrease Depth"
                    >
                      -
                    </button>
                    <span className={styles.dimValue}>{currentD}&apos;</span>
                    <button
                      className={styles.stepBtn}
                      onClick={() => handleDimChange(item.id, item.index, item.name, "dFt", 1)}
                      title="Increase Depth"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Presets for 15x15 etc. */}
              <div className={styles.presetsRow}>
                <button
                  className={`${styles.presetBtn} ${currentW === 15 && currentD === 15 ? styles.activePreset : ""}`}
                  onClick={() => handleApplyPreset(item.id, 15, 15)}
                >
                  15×15&apos;
                </button>
                <button
                  className={`${styles.presetBtn} ${currentW === 14 && currentD === 14 ? styles.activePreset : ""}`}
                  onClick={() => handleApplyPreset(item.id, 14, 14)}
                >
                  14×14&apos;
                </button>
                <button
                  className={`${styles.presetBtn} ${currentW === 12 && currentD === 14 ? styles.activePreset : ""}`}
                  onClick={() => handleApplyPreset(item.id, 12, 14)}
                >
                  12×14&apos;
                </button>
                <button
                  className={`${styles.presetBtn} ${currentW === 10 && currentD === 12 ? styles.activePreset : ""}`}
                  onClick={() => handleApplyPreset(item.id, 10, 12)}
                >
                  10×12&apos;
                </button>
                {custom && (
                  <button className={styles.presetBtn} onClick={() => handleResetRoom(item.id)}>
                    Auto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
