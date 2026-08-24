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

  // Walkthrough active control state
  const [activeMoveCmd, setActiveMoveCmd] = useState<string | null>(null);
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

  const roomListWithSpecs: (RoomName | RoomSpecIn)[] = useMemo(() => {
    const list: (RoomName | RoomSpecIn)[] = [];
    for (const name of ROOM_NAMES) {
      const count = counts[name] ?? 0;
      for (let c = 0; c < count; c++) {
        const id = `${name}_${c}`;
        const custom = customDims[id];
        if (custom) {
          list.push({
            name,
            custom_w_in: custom.wFt * 12,
            custom_d_in: custom.dFt * 12,
          });
        } else {
          list.push(name);
        }
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

  // Teleport to a room center
  const handleTeleportToRoom = useCallback(
    (index: number) => {
      const targetRoom = rooms[index];
      if (!targetRoom) return;
      const rx = inchesToFeet(targetRoom.x_in);
      const rz = inchesToFeet(targetRoom.y_in);
      const rw = inchesToFeet(targetRoom.w_in);
      const rd = inchesToFeet(targetRoom.d_in);

      setTeleportTarget({
        x: rx + rw / 2,
        z: rz + rd / 2,
      });
      setTimeout(() => setTeleportTarget(null), 100);
    },
    [rooms]
  );

  // Teleport to canvas coordinate
  const handleTeleportToCoord = useCallback((x: number, z: number) => {
    setTeleportTarget({ x, z });
    setTimeout(() => setTeleportTarget(null), 100);
  }, []);

  const toggleLights = useCallback(() => {
    setLightsOn((prev) => !prev);
  }, []);

  return (
    <div className={styles.page}>
      {/* 3D Canvas Host with Drag-and-Drop & Auto Doors */}
      <div className={styles.canvasHost}>
        <Scene
          plot={plot}
          facing={facing}
          rooms={rooms}
          mode={mode}
          activeMoveCmd={activeMoveCmd}
          teleportTarget={teleportTarget}
          lightsOn={lightsOn}
          onPlotChange={setPlot}
          onPlayerUpdate={setPlayer}
          onToggleLights={toggleLights}
          onRoomMove={moveRoom}
        />
      </div>

      {/* Top Center Mode Switcher */}
      <div className={styles.topCenterBar}>
        <button
          className={`${styles.modeToggleBtn} ${mode === "orbit" ? styles.activeModeBtn : ""}`}
          onClick={() => setMode("orbit")}
        >
          <span>🌐</span> 3D Orbit View
        </button>
        <button
          className={`${styles.modeToggleBtn} ${mode === "walkthrough" ? styles.activeModeBtn : ""}`}
          onClick={() => setMode("walkthrough")}
        >
          <span>🚶</span> 5&apos;5&quot; First-Person Walkthrough
        </button>
      </div>

      {/* Orbit Control Panel (Left) */}
      <div className={`${styles.panel} ${mode === "walkthrough" ? styles.panelHidden : ""}`}>
        <div className={styles.brand}>
          <div className={styles.brandDot} />
          plot-to-plan
        </div>
        <PlotPicker plot={plot} onChange={setPlot} />
        <RoomTray counts={counts} onChange={setCounts} />
        <RoomCustomizer
          counts={counts}
          rooms={rooms}
          customDims={customDims}
          onChangeCustomDims={setCustomDims}
        />
        <CompassDial facing={facing} onChange={setFacing} />
      </div>

      {/* Orbit Info Readout (Right) */}
      <div className={`${styles.readout} ${mode === "walkthrough" ? styles.panelHidden : ""}`}>
        <div>
          Plot <strong>{inchesToFeet(plot.widthIn)} × {inchesToFeet(plot.depthIn)} ft</strong>
        </div>
        <div>
          Buildable <strong>{inchesToFeet(buildableW)} × {inchesToFeet(buildableD)} ft</strong>
        </div>
        <div className={styles.divider} />
        <div>
          Rooms <strong>{rooms.length}</strong>
          {pending && <span className={styles.pending}> solving…</span>}
        </div>
        {meta && (
          <div>
            Solve <strong>{meta.solve_ms} ms</strong>{" "}
            <span className={styles.status}>{meta.status}</span>
          </div>
        )}
        {meta?.vaastu_constraints_applied.map((c) => (
          <div key={c} className={styles.vaastu}>
            ✓ {c}
          </div>
        ))}
        {error && <div className={styles.error}>solver offline — {error}</div>}
      </div>

      {/* Interactive 2D Minimap Radar */}
      <Minimap
        plot={plot}
        facing={facing}
        rooms={rooms}
        player={player}
        currentRoomIndex={currentRoomIndex}
        onTeleport={handleTeleportToCoord}
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
          onTeleportToRoom={handleTeleportToRoom}
          onToggleLights={toggleLights}
          onMoveStart={(cmd) => setActiveMoveCmd(cmd)}
          onMoveEnd={() => setActiveMoveCmd(null)}
        />
      )}
    </div>
  );
}
