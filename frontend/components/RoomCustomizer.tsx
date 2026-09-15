"use client";

import React from "react";
import { ROOM_COLORS, ROOM_LABELS, RoomName, ROOM_NAMES } from "@/lib/rooms";
import { MAX_BULGE_IN, RoomEdgeCurves, WallEdge } from "@/lib/wallCurves";
import { SolvedRoom } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import styles from "./RoomCustomizer.module.css";

export interface CustomDim {
  wFt: number;
  dFt: number;
  /**
   * How far either side of `wFt`/`dFt` the solver may move, in feet. Absent means none: the size
   * is pinned, which is what every stepper in this component asks for.
   *
   * Only lib/aiPlanImage.ts sets it. A dimension read off a photographed drawing is evidence at
   * an unknown scale, not a specification, and pinning a whole house of them is how a plan comes
   * back INFEASIBLE instead of a house. A zero on either axis means that axis was not printed and
   * is left to the room catalog.
   */
  tolFt?: number;
}

interface RoomCustomizerProps {
  counts: Record<RoomName, number>;
  rooms: SolvedRoom[];
  customDims: Record<string, CustomDim>;
  onChangeCustomDims: (next: Record<string, CustomDim>) => void;
  /** Bowed wall faces per room edge, in inches — lib/wallCurves.ts. */
  roomEdgeCurves?: RoomEdgeCurves;
  onChangeRoomEdgeCurves?: (next: RoomEdgeCurves) => void;
}

export default function RoomCustomizer({
  counts,
  rooms,
  customDims,
  onChangeCustomDims,
  roomEdgeCurves,
  onChangeRoomEdgeCurves,
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

  const handleRotateRoom = (id: string, roomIdx: number, roomName: RoomName) => {
    const solved = rooms[roomIdx];
    const defaultW = solved ? Math.round(inchesToFeet(solved.w_in)) : (roomName === "hall" || roomName === "bedroom" ? 14 : 10);
    const defaultD = solved ? Math.round(inchesToFeet(solved.d_in)) : (roomName === "hall" || roomName === "bedroom" ? 14 : 10);

    const current = customDims[id] ?? {
      wFt: defaultW,
      dFt: defaultD,
    };

    const nextDims = {
      ...customDims,
      [id]: {
        wFt: current.dFt,
        dFt: current.wFt,
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

  // A door or a window on a bowed wall is a joinery problem the renderer does not solve, so the
  // control is refused rather than the curve being silently dropped at draw time.
  const edgeHasOpening = (roomIdx: number, edge: WallEdge) => {
    const solved = rooms[roomIdx];
    if (!solved) return false;
    return (solved.openings ?? []).some((o) => o.edge === edge);
  };

  const handleCurveChange = (id: string, edge: WallEdge, deltaIn: number) => {
    if (!onChangeRoomEdgeCurves) return;
    const current = roomEdgeCurves?.[id]?.[edge] ?? 0;
    const next = Math.max(0, Math.min(MAX_BULGE_IN, current + deltaIn));
    if (next === current) return;

    const forRoom = { ...(roomEdgeCurves?.[id] ?? {}), [edge]: next };
    if (next === 0) delete forRoom[edge];

    const all = { ...(roomEdgeCurves ?? {}) };
    if (Object.keys(forRoom).length === 0) delete all[id];
    else all[id] = forRoom;
    onChangeRoomEdgeCurves(all);
  };

  return (
    <div className={styles.customizerContainer}>
      <div className={styles.customizerHeader}>
        <span> Custom Room Dimensions</span>
        <button className={styles.resetAllBtn} onClick={handleResetAll} title="Reset all to automatic">
          Reset Auto
        </button>
      </div>

      <div className={styles.roomList}>
        {activeRooms.map((item) => {
          const hex = (ROOM_COLORS[item.name] ?? 0xe8912d).toString(16).padStart(6, "0");
          const custom = customDims[item.id];
          const solved = rooms[item.index];

          // A zero is an axis nobody gave — a drawing that printed one dimension and left the
          // other to the eye — so it shows what the solver chose, not "0 ft". See CustomDim.
          const currentW = custom && custom.wFt > 0 ? custom.wFt : (solved ? Math.round(inchesToFeet(solved.w_in)) : 14);
          const currentD = custom && custom.dFt > 0 ? custom.dFt : (solved ? Math.round(inchesToFeet(solved.d_in)) : 14);
          const sqFt = currentW * currentD;
          const orientation = currentW > currentD ? "Horiz" : currentW < currentD ? "Vert" : "Square";

          return (
            <div key={item.id} className={styles.roomCard}>
              <div className={styles.roomCardTop}>
                <div className={styles.roomTitleRow}>
                  <div className={styles.colorDot} style={{ backgroundColor: `#${hex}` }} />
                  <span className={styles.roomNameText}>{item.label}</span>
                </div>
                <div className={styles.badgeRow}>
                  <span className={styles.orientationPill}>{orientation}</span>
                  <div className={styles.sqFtBadge}>{sqFt} sq ft</div>
                </div>
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

              {/* Bowed wall faces. A curve is a property of the wall, not of the plan: the room
                  keeps the rectangle the solver packed and only its face bows outward. */}
              <div className={styles.curveRow}>
                <span className={styles.curveRowLabel}>Curve</span>
                {(["N", "E", "S", "W"] as WallEdge[]).map((edge) => {
                  const bulgeIn = roomEdgeCurves?.[item.id]?.[edge] ?? 0;
                  const blocked = edgeHasOpening(item.index, edge);
                  return (
                    <div key={edge} className={styles.curveStepper}>
                      <span className={styles.dimLabel}>{edge}</span>
                      <button
                        className={styles.stepBtn}
                        disabled={blocked}
                        onClick={() => handleCurveChange(item.id, edge, -6)}
                        title={blocked ? "This wall carries a door or window" : "Flatten"}
                      >
                        -
                      </button>
                      <span className={styles.dimValue}>{Math.round((bulgeIn / 12) * 10) / 10}&apos;</span>
                      <button
                        className={styles.stepBtn}
                        disabled={blocked}
                        onClick={() => handleCurveChange(item.id, edge, 6)}
                        title={blocked ? "This wall carries a door or window" : "Bow outward"}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Rotate Clockwise & Anticlockwise Controls */}
              <div className={styles.rotateRow}>
                <button
                  className={styles.rotateBtn}
                  onClick={() => handleRotateRoom(item.id, item.index, item.name)}
                  title="Rotate Room Anticlockwise (-90°)"
                >
                  <span className={styles.rotateIcon}></span>
                  <span>Rotate CCW (-90°)</span>
                </button>
                <button
                  className={styles.rotateBtn}
                  onClick={() => handleRotateRoom(item.id, item.index, item.name)}
                  title="Rotate Room Clockwise (+90°)"
                >
                  <span className={styles.rotateIcon}></span>
                  <span>Rotate CW (+90°)</span>
                </button>
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
                  className={`${styles.presetBtn} ${currentW === 14 && currentD === 12 ? styles.activePreset : ""}`}
                  onClick={() => handleApplyPreset(item.id, 14, 12)}
                >
                  14×12&apos;
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
