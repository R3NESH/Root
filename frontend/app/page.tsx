"use client";

// Phase 1 composition root + 3D First-Person Walkthrough Engine + 2D Architectural Blueprint & Export Engine
// Plot geometry is instant and local; rooms arrive from POST /solve on a 400ms debounce.

import { useCallback, useEffect, useMemo, useState } from "react";
import Scene from "@/components/Scene";
import PlotPicker from "@/components/PlotPicker";
import CompassDial from "@/components/CompassDial";
import RoomTray from "@/components/RoomTray";
import RoomCustomizer, { CustomDim } from "@/components/RoomCustomizer";
import Minimap from "@/components/Minimap";
import WalkthroughOverlay from "@/components/WalkthroughOverlay";
import Blueprint2DView from "@/components/Blueprint2DView";
import BlueprintExportModal from "@/components/BlueprintExportModal";
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
import { RoomOpening, RoomSpecIn } from "@/lib/solve";
import { feetToInches, inchesToFeet } from "@/lib/units";
import { ModelBlueprint } from "@/lib/modelBlueprints";
import ModelBlueprintsModal from "@/components/ModelBlueprintsModal";
import MaterialCustomizerModal from "@/components/MaterialCustomizerModal";
import TopRibbonTaskbar from "@/components/TopRibbonTaskbar";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import {
  DEFAULT_MATERIAL_CONFIG,
  FLOOR_MATERIALS,
  HouseMaterialConfig,
  WALL_COLORS,
} from "@/lib/materialsCatalog";
import {
  detectCurrentRoom,
  EYE_LEVEL_FT,
  PlayerTransform,
} from "@/lib/walkthrough";
import styles from "./page.module.css";

const DEFAULT_COUNTS: Record<RoomName, number> = {
  hall: 1,
  dining: 1,
  kitchen: 1,
  bedroom: 2,
  bathroom: 1,
  pooja: 0,
  store: 0,
};

export default function Home() {
  const [plot, setPlot] = useState<PlotDims>(DEFAULT_PLOT);
  const [facing, setFacing] = useState<Facing>("N");
  const [counts, setCounts] = useState<Record<RoomName, number>>(DEFAULT_COUNTS);
  const [customDims, setCustomDims] = useState<Record<string, CustomDim>>({});
  const [customOpenings, setCustomOpenings] = useState<Record<string, RoomOpening[]>>({});
  const [customWallThickness, setCustomWallThickness] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"orbit" | "walkthrough" | "blueprint">("orbit");
  const [lightsOn, setLightsOn] = useState(true);
  const [furnished, setFurnished] = useState(true);
  const [materialConfig, setMaterialConfig] = useState<HouseMaterialConfig>(DEFAULT_MATERIAL_CONFIG);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isModelBlueprintsOpen, setIsModelBlueprintsOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number } | null>(null);
  const [activeBlueprintName, setActiveBlueprintName] = useState<string | null>(null);

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

  const { rooms: solvedRooms, meta, pending, error, staleBackend, moveRoom, resetPositions } = useSolve({
    plotWIn: plot.widthIn,
    plotDIn: plot.depthIn,
    facing,
    rooms: roomListWithSpecs,
    setback: DEFAULT_SETBACK,
  });

  // Apply a curated or imported model blueprint to instantly configure and construct the house in 2D & 3D
  const handleApplyModelBlueprint = (
    bp: ModelBlueprint,
    targetMode: "blueprint" | "orbit" | "walkthrough" = "blueprint"
  ) => {
    resetPositions();
    setActiveBlueprintName(bp.name);
    setPlot({
      widthIn: feetToInches(bp.plotWidthFt),
      depthIn: feetToInches(bp.plotDepthFt),
    });
    setFacing(bp.facing);
    setCounts(bp.counts);
    setCustomDims(bp.customDims);
    setCustomOpenings(bp.customOpenings ?? {});
    setCustomWallThickness(bp.customWallThickness ?? {});
    setMode(targetMode);
  };

  // Merge custom door / window openings and wall thicknesses into solved rooms
  const rooms = useMemo(() => {
    return solvedRooms.map((room, idx) => {
      const spec = roomListWithSpecs[idx];
      const id = spec?.id || `${room.name}_${idx}`;
      const customOps = customOpenings[id];
      const customThick = customWallThickness[id];
      return {
        ...room,
        wall_thickness_in: customThick !== undefined ? customThick : room.wall_thickness_in,
        openings: customOps !== undefined ? customOps : room.openings,
      };
    });
  }, [solvedRooms, customOpenings, customWallThickness, roomListWithSpecs]);

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

  const handleToggleLights = useCallback(() => {
    setLightsOn((prev) => !prev);
  }, []);

  const [customObjects, setCustomObjects] = useState<PlacedCustomObject[]>([]);
  const [placingItemType, setPlacingItemType] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const selectedObject = useMemo(
    () => customObjects.find((o) => o.id === selectedObjectId) || null,
    [customObjects, selectedObjectId]
  );

  const handleRotateSelected = useCallback((angleDelta: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId ? { ...o, rotationY: (o.rotationY || 0) + angleDelta } : o
      )
    );
  }, [selectedObjectId]);

  const handleScaleSelected = useCallback((scaleDelta: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId
          ? { ...o, scale: Math.max(0.5, Math.min(2.5, (o.scale || 1.0) + scaleDelta)) }
          : o
      )
    );
  }, [selectedObjectId]);

  const handleChangeColorSelected = useCallback((colorHex: number) => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) =>
      prev.map((o) => (o.id === selectedObjectId ? { ...o, colorHex } : o))
    );
  }, [selectedObjectId]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedObjectId) return;
    setCustomObjects((prev) => prev.filter((o) => o.id !== selectedObjectId));
    setSelectedObjectId(null);
  }, [selectedObjectId]);

  const handleClearAllFurniture = useCallback(() => {
    setCustomObjects([]);
    setSelectedObjectId(null);
    setPlacingItemType(null);
  }, []);

  // Global Keyboard shortcuts (Escape, Delete, Backspace, KeyR)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Escape") {
        setPlacingItemType(null);
        setSelectedObjectId(null);
      } else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedObjectId) {
          handleDeleteSelected();
        }
      } else if (e.code === "KeyR") {
        if (selectedObjectId) {
          handleRotateSelected(Math.PI / 4);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedObjectId, handleDeleteSelected, handleRotateSelected]);

  return (
    <div className={styles.appContainer}>
      {/* MS Paint / CAD Ribbon Taskbar */}
      <TopRibbonTaskbar
        mode={mode}
        onChangeMode={setMode}
        lightsOn={lightsOn}
        onToggleLights={handleToggleLights}
        onOpenMaterialModal={() => setIsMaterialModalOpen(true)}
        onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        placingItemType={placingItemType}
        onSelectPlaceItem={setPlacingItemType}
        selectedObject={selectedObject}
        onRotateSelected={handleRotateSelected}
        onScaleSelected={handleScaleSelected}
        onChangeColorSelected={handleChangeColorSelected}
        onDeleteSelected={handleDeleteSelected}
        onClearAllFurniture={handleClearAllFurniture}
        onDeselectObject={() => setSelectedObjectId(null)}
        totalPlacedCount={customObjects.length}
      />

      <main className={styles.mainLayout}>
        <section className={styles.viewport}>
          {mode === "blueprint" ? (
            /* 2D Architectural Blueprint View */
            <Blueprint2DView
              plot={plot}
              facing={facing}
              setback={DEFAULT_SETBACK}
              rooms={rooms}
              meta={meta}
              counts={counts}
              customDims={customDims}
              customOpenings={customOpenings}
              customWallThickness={customWallThickness}
              activeBlueprintName={activeBlueprintName}
              onChangeCounts={setCounts}
              onChangeCustomDims={setCustomDims}
              onChangeCustomOpenings={setCustomOpenings}
              onChangeCustomWallThickness={setCustomWallThickness}
              onRoomMove={moveRoom}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenModelBlueprintsModal={() => setIsModelBlueprintsOpen(true)}
              onApplyBlueprint={handleApplyModelBlueprint}
            />
          ) : (
            /* 3D Three.js Scene Viewport */
            <>
              <Scene
                plot={plot}
                facing={facing}
                rooms={rooms}
                setback={DEFAULT_SETBACK}
                mode={mode}
                teleportTarget={teleportTarget}
                lightsOn={lightsOn}
                furnished={furnished}
                materialConfig={materialConfig}
                customObjects={customObjects}
                placingItemType={placingItemType}
                selectedObjectId={selectedObjectId}
                onPlotChange={setPlot}
                onPlayerUpdate={setPlayer}
                onToggleLights={handleToggleLights}
                onRoomMove={moveRoom}
                onAddCustomObject={(newObj) => {
                  setCustomObjects((prev) => [...prev, newObj]);
                  setPlacingItemType(null);
                  setSelectedObjectId(newObj.id);
                }}
                onSelectObject={setSelectedObjectId}
                onUpdateCustomObject={(updated) => {
                  setCustomObjects((prev) =>
                    prev.map((o) => (o.id === updated.id ? updated : o))
                  );
                }}
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

                  {/* 3D Minimap Radar */}
                  <Minimap
                    plot={plot}
                    facing={facing}
                    rooms={rooms}
                    player={player}
                    currentRoomIndex={currentRoomIndex}
                    onTeleport={handleTeleport}
                  />
                </>
              )}

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
            </>
          )}
        </section>

        {/* Sidebar Controls (Active in Orbit and Blueprint Modes) */}
        {mode !== "walkthrough" && (
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 className={styles.cardHeading} style={{ margin: 0 }}>4. Materials & Finishes</h2>
                <button
                  className={styles.sidebarMaterialBtn}
                  onClick={() => setIsMaterialModalOpen(true)}
                >
                  🎨 Customize
                </button>
              </div>
              <div className={styles.materialPillsSummary}>
                <div className={styles.summaryBadge}>
                  <b>Flooring:</b> {FLOOR_MATERIALS.find((m) => m.id === materialConfig.globalFloor)?.name ?? "Carrara White Marble"}
                </div>
                <div className={styles.summaryBadge}>
                  <b>Walls:</b> {WALL_COLORS.find((c) => c.id === materialConfig.globalWallColor)?.name ?? "Arctic White"}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>5. Interiors</h2>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  className={styles.toggleBox}
                  checked={furnished}
                  onChange={(e) => setFurnished(e.target.checked)}
                />
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>Auto-Furnish Interiors</span>
                  <span className={styles.toggleHint}>
                    Beds, sofas, counters, wardrobes, fans and curtains, placed clear of every
                    doorway. Uncheck for the bare shell.
                  </span>
                </span>
              </label>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>6. Room Dimensions (Custom)</h2>
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

      {/* Materials & Finishes Studio Dialog Modal */}
      <MaterialCustomizerModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        config={materialConfig}
        onChangeConfig={setMaterialConfig}
        activeRooms={Object.keys(counts).filter((k) => (counts[k as RoomName] || 0) > 0) as RoomName[]}
      />

      {/* Architectural Blueprint Export Dialog Modal */}
      <BlueprintExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plot={plot}
        facing={facing}
        setback={DEFAULT_SETBACK}
        rooms={rooms}
        meta={meta}
      />

      {/* Curated Model Blueprints Catalog Modal */}
      <ModelBlueprintsModal
        isOpen={isModelBlueprintsOpen}
        onClose={() => setIsModelBlueprintsOpen(false)}
        onSelectBlueprint={handleApplyModelBlueprint}
      />
    </div>
  );
}
