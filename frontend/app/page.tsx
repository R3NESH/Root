"use client";

// Phase 1 composition root + 3D First-Person Walkthrough Engine + Drag-and-Drop + Robust Room Customization
// Plot geometry is instant and local; rooms arrive from POST /solve on a 400ms debounce.

import { useCallback, useEffect, useMemo, useState } from "react";
import Scene from "@/components/Scene";
import PlotPicker from "@/components/PlotPicker";
import CompassDial from "@/components/CompassDial";
import RoomTray from "@/components/RoomTray";
import RoomCustomizer, { CustomDim } from "@/components/RoomCustomizer";
import Minimap from "@/components/Minimap";
import WalkthroughOverlay from "@/components/WalkthroughOverlay";
import {
  buildableDepthIn,
  buildableWidthIn,
  DEFAULT_PLOT,
  DEFAULT_SETBACK,
  Facing,
  PlotDims,
} from "@/lib/plot";
import { RoomName, ROOM_NAMES } from "@/lib/rooms";
import { useSolve } from "@/lib/useSolve";
import { RoomSpecIn } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import {
  detectCurrentRoom,
  EYE_LEVEL_FT,
  PlayerTransform,
} from "@/lib/walkthrough";
import styles from "./page.module.css";

const DEFAULT_COUNTS: Record<RoomName, number> = {
  hall: 1,
  kitchen: 1,
  bedroom: 2,
  bathroom: 1,
  pooja: 0,
};

export default function Home() {
  const [plot, setPlot] = useState<PlotDims>(DEFAULT_PLOT);
  const [facing, setFacing] = useState<Facing>("N");
  const [counts, setCounts] = useState<Record<RoomName, number>>(DEFAULT_COUNTS);
  const [customDims, setCustomDims] = useState<Record<string, CustomDim>>({});
  const [mode, setMode] = useState<"orbit" | "walkthrough">("orbit");
  const [lightsOn, setLightsOn] = useState(true);

  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number } | null>(null);

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

  const { rooms, meta, pending, error, moveRoom } = useSolve({
    plotWIn: plot.widthIn,
    plotDIn: plot.depthIn,
    facing,
    rooms: roomListWithSpecs,
    setback: DEFAULT_SETBACK,
  });

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

  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === "orbit" ? "walkthrough" : "orbit"));
  }, []);

  const handleToggleLights = useCallback(() => {
    setLightsOn((prev) => !prev);
  }, []);

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.logoGroup}>
          <div className={styles.badge}>3D PLANNER</div>
          <h1 className={styles.title}>Plot to Plan</h1>
        </div>
        <div className={styles.headerControls}>
          {pending && <div className={styles.solvingPill}>⚡ Solving Layout...</div>}
          {error && <div className={styles.errorPill}>⚠️ {error}</div>}

          {/* Mode Switcher Button */}
          <button
            className={`${styles.modeBtn} ${mode === "walkthrough" ? styles.modeBtnActive : ""}`}
            onClick={handleToggleMode}
          >
            {mode === "orbit" ? "🚶 Walk Inside (5'5\")" : "🌐 Aerial 3D Orbit"}
          </button>
        </div>
      </header>

      <main className={styles.mainLayout}>
        <section className={styles.viewport}>
          <Scene
            plot={plot}
            facing={facing}
            rooms={rooms}
            setback={DEFAULT_SETBACK}
            mode={mode}
            teleportTarget={teleportTarget}
            lightsOn={lightsOn}
            onPlotChange={setPlot}
            onPlayerUpdate={setPlayer}
            onToggleLights={handleToggleLights}
            onRoomMove={moveRoom}
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
            </>
          )}

          {/* 3D Minimap Radar */}
          <Minimap
            plot={plot}
            facing={facing}
            rooms={rooms}
            player={player}
            currentRoomIndex={currentRoomIndex}
            onTeleport={handleTeleport}
          />

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
        </section>

        {/* Sidebar Controls (Visible in Orbit Mode) */}
        {mode === "orbit" && (
          <aside className={styles.sidebar}>
            <div className={styles.card}>
              <h2 className={styles.cardHeading}>1. Plot Dimensions</h2>
              <PlotPicker plot={plot} onChange={setPlot} />
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>2. Road Facing Direction</h2>
              <CompassDial facing={facing} onChange={setFacing} />
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>3. Room Program</h2>
              <RoomTray counts={counts} onChange={setCounts} />
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>4. Room Dimensions (Custom)</h2>
              <RoomCustomizer
                counts={counts}
                rooms={rooms}
                customDims={customDims}
                onChangeCustomDims={setCustomDims}
              />
            </div>

            {meta && (
              <div className={styles.statusFooter}>
                <div className={styles.statusRow}>
                  <span>Solver Status:</span>
                  <span className={styles.statusOk}>{meta.status}</span>
                </div>
                <div className={styles.statusRow}>
                  <span>Solve Time:</span>
                  <span>{meta.solve_ms} ms</span>
                </div>
                <div className={styles.statusRow}>
                  <span>Vaastu Compliant:</span>
                  <span>{meta.vaastu_constraints_applied.length} zones active</span>
                </div>
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
}
