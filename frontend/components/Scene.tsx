"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WebGLPathTracer } from "three-gpu-pathtracer";

import {
  DEFAULT_SETBACK,
  edgeSetbacksIn,
  Facing,
  MAX_DIM_IN,
  MIN_DIM_IN,
  PlotDims,
  Setback,
} from "@/lib/plot";
import { findAdjacentRoomEdge, ROOM_LABELS, RoomName } from "@/lib/rooms";
import { RoomOpening, SolvedRoom } from "@/lib/solve";
import { clampInches, inchesToFeet, snapToFoot } from "@/lib/units";
import {
  ACCENT,
  BASEBOARD_H_FT,
  DOOR_HEIGHT_FT,
  DOOR_WIDTH_FT,
  HANDLE_RADIUS_FT,
  DAY_GROUND_COLOR,
  DAY_PLOT_COLOR,
  NIGHT_PLOT_COLOR,
  PLOT_COLOR,
  WALL_HEIGHT_FT,
  WALL_THICK_INT_FT,
  WINDOW_H_FT,
  WINDOW_SILL_Y_FT,
  WINDOW_W_FT,
} from "@/lib/sceneConstants";
import { createRoomBadge, makeRoomBadgeSprite } from "@/lib/sceneBadges";
import {
  Doorway,
  getPrimaryCardinalEdge,
  openingCentreFt,
  oppositeEdge,
} from "@/lib/sceneDoorways";
import { computeSmartWallSnap } from "@/lib/smartWallSnap";
import { resolveBands, resolveWallBandScheme, roomInstanceId, wallBandKey } from "@/lib/wallBands";
import { DEFAULT_FRAME_THICKNESS_FT, findGlazingStyle, resolveWallGlazing } from "@/lib/glazing";
import {
  clampPlayerPosition,
  computePotentiallyVisibleRooms,
  CROUCH_HEIGHT_FT,
  detectCurrentRoom,
  DoorwayConnection,
  EYE_LEVEL_FT,
  getSpawnPosition,
  ObstacleBox,
  PLAYER_COLLISION_RADIUS,
  PlayerTransform,
  resolvePlayerMovement,
  ROTATE_SPEED_RAD,
  SPRINT_SPEED_FPS,
  WALK_SPEED_FPS,
} from "@/lib/walkthrough";
import {
  addCeilingFan,
  addRoomInteriorDetails,
  buildWindowWithCurtains,
  RoomDoorInfo,
} from "@/lib/interiorDetails";
import {
  createFurnitureMesh,
  FURNITURE_CATALOG,
  PlacedCustomObject,
} from "@/lib/furnitureCatalog";
import { loadGlbModel, loadGlbFromFile } from "@/lib/modelLoader";
import { mountRealModels } from "@/lib/furnitureModels";
import { addSiteLandscape } from "@/lib/siteLandscape";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { SolidGeometryGTAOPass } from "@/lib/aoPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import {
  DEFAULT_MATERIAL_CONFIG,
  FLOOR_MATERIALS,
  getFloorTexture,
  getRoomFloorMaterial,
  getRoomWallColorHex,
  getWallColorHexStr,
  getRoomWallTextureId,
  resolveDoorColorHex,
  getEffectiveFloorRoughness,
  getEffectiveWallRoughness,
  getEffectiveWallBumpScale,
  clearTextureCache,
  HouseMaterialConfig,
  getFloorNormalMap,
  getFloorRoughnessMap,
  getWallNormalMap,
  ROUGHNESS_MAP_HEADROOM,
} from "@/lib/materialsCatalog";
import {
  GraphicsSettings,
  DEFAULT_GRAPHICS_SETTINGS,
  getTextureResolution,
  getShadowMapResolution,
  estimateVRAMUsageGB,
} from "@/lib/graphicsConfig";
import { OpeningItemDef } from "@/lib/openingsCatalog";
import {
  DEFAULT_WINDOW_CONFIG,
  getIndividualWindowProps,
  WindowConfig,
  WindowFrameFinishId,
  WindowGlassTintId,
  WindowShapeId,
} from "@/lib/windowCatalog";
import {
  CustomDrawnWall,
  CustomRoomZone,
  CustomWallOpening,
  CustomWallType,
  CadTool,
  getCurvedWallArcPoints,
} from "@/lib/customArchitecture";

export interface SelectedObjectInfo {
  id: string;
  name: string;
  type?: string;
  isBuiltin?: boolean;
  isWindow?: boolean;
  isWall?: boolean;
  isWallRemoved?: boolean;
  windowShape?: WindowShapeId;
  windowFrameFinish?: WindowFrameFinishId;
  windowGlassTint?: WindowGlassTintId;
  windowHasCurtains?: boolean;
  windowWidthFt?: number;
  windowHeightFt?: number;
  roomIndex?: number;
  roomName?: string;
  edge?: "N" | "S" | "E" | "W";
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale?: number;
  colorHex?: number;
}

interface SceneProps {
  plot: PlotDims;
  facing: Facing;
  rooms: SolvedRoom[];
  setback?: Setback;
  mode?: "orbit" | "walkthrough";
  activeMoveCmd?: string | null;
  teleportTarget?: { x: number; z: number } | null;
  lightsOn?: boolean;
  /** Place beds, sofas, counters, fans and curtains. Off gives the bare shell. */
  furnished?: boolean;
  customObjects?: PlacedCustomObject[];
  customOpenings?: Record<string, RoomOpening[]>;
  customWalls?: CustomDrawnWall[];
  customRoomZones?: CustomRoomZone[];
  activeFloor?: number;
  onChangeActiveFloor?: (floor: number) => void;
  activeCadTool?: CadTool;
  onChangeCadTool?: (tool: CadTool) => void;
  activeWallType?: CustomWallType;
  onChangeWallType?: (type: CustomWallType) => void;
  onChangeCustomWalls?: (walls: CustomDrawnWall[]) => void;
  onChangeCustomRoomZones?: (zones: CustomRoomZone[]) => void;
  onChangeCustomOpenings?: (openings: Record<string, RoomOpening[]>) => void;
  onStartFromScratch?: () => void;
  deletedBuiltinIds?: string[];
  placingItemType?: string | null;
  placingRotationY?: number;
  selectedObjectId?: string | null;
  selectedObjectInfo?: SelectedObjectInfo | null;
  materialConfig?: HouseMaterialConfig;
  windowConfig?: WindowConfig;
  onChangeWindowConfig?: (config: WindowConfig) => void;
  placingOpeningDef?: OpeningItemDef | null;
  onSelectPlaceOpening?: (def: OpeningItemDef | null) => void;
  isLayoutLocked?: boolean;
  onToggleLayoutLock?: () => void;
  onPlotChange?: (next: PlotDims) => void;
  onPlayerUpdate?: (player: PlayerTransform) => void;
  onToggleLights?: () => void;
  onRoomMove?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => void;
  onRoomResize?: (
    roomIndex: number,
    targetPlotXIn: number,
    targetPlotYIn: number,
    targetWIn: number,
    targetDIn: number
  ) => void;
  onAddCustomObject?: (obj: PlacedCustomObject) => void;
  onSelectObject?: (info: SelectedObjectInfo | null) => void;
  onUpdateCustomObject?: (obj: PlacedCustomObject) => void;
  onUpdateCustomObjectPos?: (id: string, x: number, z: number, rotationY?: number) => void;
  onConvertBuiltinToCustom?: (obj: SelectedObjectInfo) => PlacedCustomObject | null;
  onRequestReplace?: () => void;
  onRequestDelete?: () => void;
  onRotateSelected?: (angleDelta: number) => void;
  onRotatePlacing?: (angleDelta: number) => void;
  onNearestDoorChange?: (prompt: { doorId: string; label: string; isOpen: boolean } | null) => void;
  onRegisterDoorTrigger?: (trigger: () => void) => void;
  graphicsSettings?: GraphicsSettings;
  isUpgraded?: boolean;
  onToggleUpgrade?: () => void;
  isRaytracing?: boolean;
  onToggleRaytrace?: () => void;
}


function createDaySkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Atmospheric Sunny Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    skyGrad.addColorStop(0, "#1d4ed8");    // Deep azure blue zenith
    skyGrad.addColorStop(0.32, "#3b82f6"); // Vibrant sky blue
    skyGrad.addColorStop(0.68, "#60a5fa"); // Light blue
    skyGrad.addColorStop(0.90, "#bae6fd"); // Horizon haze
    skyGrad.addColorStop(1.0, "#e0f2fe");  // Light horizon glow
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Radiant Sun & Atmospheric Glow
    const sunGrad = ctx.createRadialGradient(720, 240, 10, 720, 240, 180);
    sunGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    sunGrad.addColorStop(0.2, "rgba(255, 248, 220, 0.85)");
    sunGrad.addColorStop(0.5, "rgba(254, 215, 170, 0.45)");
    sunGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(720, 240, 180, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createNightSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const nightGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    nightGrad.addColorStop(0, "#020617");   // Deep space obsidian
    nightGrad.addColorStop(0.5, "#0b132b"); // Midnight navy
    nightGrad.addColorStop(1.0, "#1e293b"); // Horizon slate
    ctx.fillStyle = nightGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Sparkling stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < 180; i++) {
      const sx = (Math.sin(i * 99.7) * 0.5 + 0.5) * 1024;
      const sy = (Math.cos(i * 37.3) * 0.5 + 0.5) * 750;
      const sr = (i % 3 === 0) ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Equirectangular radiance map for image-based lighting. PMREM prefilters it into the ambient
// and reflection source every MeshStandardMaterial samples, and it is the only environment light
// three-gpu-pathtracer gets — it zeroes environmentIntensity when scene.environment is null.
//
// This is half-float, not a canvas, on purpose. A canvas is LDR: its brightest possible sun is
// 1.0, the same value as plain white sky, so a polished floor reflects a sun that is not any
// brighter than the sky around it and the reflection reads as flat ambient. Radiance here is
// linear and unbounded, so the sun disc sits ~60x above the sky and blows out where it lands.
// The sharp horizon matters for the same reason: a smooth gradient reflects as a smooth
// gradient, which is indistinguishable from the hemisphere light this replaces. Reflections
// only read as reflections when the environment has edges.
const SUN_DIR = new THREE.Vector3(60, 95, 45).normalize();

function createSkyEnvTexture(night: boolean): THREE.DataTexture {
  const W = 256;
  const H = 128;
  const data = new Uint16Array(W * H * 4);
  const dir = new THREE.Vector3();

  const zenith = night ? [0.004, 0.008, 0.022] : [0.09, 0.19, 0.44];
  const horizon = night ? [0.020, 0.034, 0.062] : [0.62, 0.74, 0.92];
  const groundNear = night ? [0.012, 0.013, 0.016] : [0.20, 0.175, 0.140];
  const groundFar = night ? [0.002, 0.002, 0.003] : [0.055, 0.048, 0.040];
  const discRadiance = night ? [7, 8, 11] : [62, 55, 44];
  const discCos = Math.cos((night ? 1.6 : 2.4) * Math.PI / 180);
  const glowCos = Math.cos((night ? 9 : 26) * Math.PI / 180);
  const glowRadiance = night ? [0.10, 0.12, 0.18] : [2.6, 2.1, 1.4];

  for (let y = 0; y < H; y++) {
    // DataTexture is flipY = false, so row 0 is uv v = 0, which equirect maps to straight down.
    const v = (y + 0.5) / H;
    const dy = Math.sin((v - 0.5) * Math.PI);
    const horiz = Math.sqrt(Math.max(0, 1 - dy * dy));

    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      dir.set(Math.cos(phi) * horiz, dy, Math.sin(phi) * horiz);

      let r: number;
      let g: number;
      let b: number;

      if (dy >= 0) {
        // Sky. Biased towards the horizon colour so the band just above the ground stays bright,
        // which is what a glossy floor actually catches at a grazing angle.
        const t = Math.pow(dy, 0.55);
        r = horizon[0] + (zenith[0] - horizon[0]) * t;
        g = horizon[1] + (zenith[1] - horizon[1]) * t;
        b = horizon[2] + (zenith[2] - horizon[2]) * t;
      } else {
        const t = Math.pow(-dy, 0.6);
        r = groundNear[0] + (groundFar[0] - groundNear[0]) * t;
        g = groundNear[1] + (groundFar[1] - groundNear[1]) * t;
        b = groundNear[2] + (groundFar[2] - groundNear[2]) * t;
      }

      // Sun disc and its glow, at the direction of the sun DirectionalLight itself, so the
      // highlight in a polished floor sits where the cast shadows say it should.
      const cosSun = dir.dot(SUN_DIR);
      if (cosSun > discCos) {
        r = discRadiance[0];
        g = discRadiance[1];
        b = discRadiance[2];
      } else if (cosSun > glowCos) {
        const f = Math.pow((cosSun - glowCos) / (discCos - glowCos), 3);
        r += glowRadiance[0] * f;
        g += glowRadiance[1] * f;
        b += glowRadiance[2] * f;
      }

      const i = (y * W + x) * 4;
      data[i] = THREE.DataUtils.toHalfFloat(r);
      data[i + 1] = THREE.DataUtils.toHalfFloat(g);
      data[i + 2] = THREE.DataUtils.toHalfFloat(b);
      data[i + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface EnvMapCache {
  day: THREE.Texture | null;
  night: THREE.Texture | null;
}

// Prefilters the sky into a mipped radiance map and hangs it on the scene. Built once per sky
// and cached — the PMREM pass is a handful of GPU draws but it does not belong in a toggle.
function applyEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer | null,
  cache: EnvMapCache,
  night: boolean
): void {
  if (!renderer) return;
  const key = night ? "night" : "day";
  if (!cache[key]) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const src = createSkyEnvTexture(night);
    cache[key] = pmrem.fromEquirectangular(src).texture;
    src.dispose();
    pmrem.dispose();
  }
  scene.environment = cache[key];
}

// Lawn detail for the plot slab, which was a single flat green before this.
//
// Deliberately near-white and near-neutral: it multiplies DAY_PLOT_COLOR rather than replacing
// it, so the mown-lawn green stays the one place the lawn colour is decided. What it adds is the
// two things that make grass read as grass from above — the blade noise, and the mower stripes,
// which are the strongest cue of all because they are the only straight lines in a lawn.
let lawnDetailTexture: THREE.CanvasTexture | null = null;

function getLawnDetailTexture(): THREE.CanvasTexture | null {
  if (lawnDetailTexture) return lawnDetailTexture;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 512);

  // Mower stripes. Four bands at a repeat of four puts the pitch at roughly a real mower's
  // width on a typical plot. The first pass had them eight times finer, which put the stripe
  // pitch under a pixel over most of the lawn and returned moire banding instead of mowing.
  for (let band = 0; band < 4; band++) {
    if (band % 2 !== 0) continue;
    ctx.fillStyle = "rgba(0, 0, 0, 0.035)";
    ctx.fillRect(0, band * 128, 512, 128);
  }

  // Blade noise. Seeded off the index rather than Math.random so the plot does not re-texture
  // itself on every rebuild.
  for (let i = 0; i < 900; i++) {
    const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const gy = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const x = Math.abs(gx) * 512;
    const y = Math.abs(gy) * 512;
    ctx.fillStyle = i % 3 === 0 ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.09)";
    ctx.fillRect(x, y, 2, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  lawnDetailTexture = tex;
  return tex;
}

export default function Scene({
  plot,
  facing,
  rooms,
  setback = DEFAULT_SETBACK,
  mode = "orbit",
  activeMoveCmd = null,
  teleportTarget = null,
  lightsOn = true,
  furnished = true,
  customObjects = [],
  customOpenings = {},
  customWalls = [],
  customRoomZones = [],
  activeFloor = 0,
  onChangeActiveFloor,
  activeCadTool,
  onChangeCadTool,
  activeWallType,
  onChangeWallType,
  onChangeCustomWalls,
  onChangeCustomRoomZones,
  onChangeCustomOpenings,
  onStartFromScratch,
  deletedBuiltinIds = [],
  placingItemType = null,
  placingRotationY = 0,
  selectedObjectId = null,
  selectedObjectInfo = null,
  materialConfig = DEFAULT_MATERIAL_CONFIG,
  windowConfig = DEFAULT_WINDOW_CONFIG,
  onChangeWindowConfig,
  placingOpeningDef = null,
  onSelectPlaceOpening,
  isLayoutLocked = false,
  onToggleLayoutLock,
  onPlotChange,
  onPlayerUpdate,
  onToggleLights,
  onRoomMove,
  onRoomResize,
  onAddCustomObject,
  onSelectObject,
  onUpdateCustomObject,
  onUpdateCustomObjectPos,
  onConvertBuiltinToCustom,
  onRequestReplace,
  onRequestDelete,
  onRotateSelected,
  onRotatePlacing,
  graphicsSettings = DEFAULT_GRAPHICS_SETTINGS,
  isUpgraded = false,
  onToggleUpgrade,
  isRaytracing = false,
  onToggleRaytrace,
  onNearestDoorChange,
  onRegisterDoorTrigger,
}: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const skyFillRef = useRef<THREE.DirectionalLight | null>(null);
  // Ground-truth ambient occlusion. The rasterizer draws through this composer instead of
  // straight to the canvas; the path tracer computes its own occlusion and bypasses it.
  const composerRef = useRef<EffectComposer | null>(null);
  const gtaoPassRef = useRef<GTAOPass | null>(null);

  // Prefiltered day/night radiance maps. Kept across toggles so flipping the sky is a pointer
  // swap, not a re-prefilter.
  const envMapsRef = useRef<EnvMapCache>({ day: null, night: null });
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  // The plot slab. Held so day/night can recolour it without waiting for a re-solve — it is
  // built inside the layout effect, which only runs when the plan changes.
  const plotMeshRef = useRef<THREE.Mesh | null>(null);
  const darkGridRef = useRef<THREE.GridHelper | null>(null);
  const whiteGridRef = useRef<THREE.GridHelper | null>(null);
  const roomLightsRef = useRef<THREE.PointLight[]>([]);
  const [currentFps, setCurrentFps] = useState<number>(144);
  const [currentFrameTime, setCurrentFrameTime] = useState<number>(6.9);
  const [renderRes, setRenderRes] = useState<string>("3840 × 2160");
  const [isDollhouseCutaway, setIsDollhouseCutaway] = useState<boolean>(true);

  // Real-Time GPU Path Tracer States & Refs
  const [raytraceSamples, setRaytraceSamples] = useState<number>(0);
  const [raytraceTargetSamples, setRaytraceTargetSamples] = useState<number>(60);
  const [raytraceBounces, setRaytraceBounces] = useState<number>(4);
  const [isRaytraceBuilding, setIsRaytraceBuilding] = useState<boolean>(false);

  const pathTracerRef = useRef<WebGLPathTracer | null>(null);
  const isRaytracingRef = useRef<boolean>(isRaytracing);
  const isPathTracerReadyRef = useRef<boolean>(false);
  const targetSamplesRef = useRef<number>(60);
  const bouncesRef = useRef<number>(4);
  const onToggleRaytraceRef = useRef(onToggleRaytrace);

  const fpsFrames = useRef<number>(0);
  const lastFpsUpdate = useRef<number>(performance.now());
  const graphicsSettingsRef = useRef<GraphicsSettings>(graphicsSettings);
  graphicsSettingsRef.current = graphicsSettings;
  const widthHandleRef = useRef<THREE.Mesh | null>(null);
  const depthHandleRef = useRef<THREE.Mesh | null>(null);
  const roomHandlesGroupRef = useRef<THREE.Group | null>(null);
  const customWallHandlesGroupRef = useRef<THREE.Group | null>(null);
  const draggedCustomWallHandleInfoRef = useRef<{
    wallId: string;
    endpoint: "start" | "end";
    initialXIn: number;
    initialYIn: number;
  } | null>(null);
  // Value is never read — only the ref below is. Kept as a setter-only binding because the
  // setter drives re-renders that the 3D draft overlay depends on.
  const [, setDraftWallStartFt] = useState<{ x: number; z: number } | null>(null);
  const draftWallStartFtRef = useRef<{ x: number; z: number } | null>(null);
  const draftGhost3DWallRef = useRef<THREE.Mesh | null>(null);
  const [drafting3DDescription, setDrafting3DDescription] = useState<string | null>(null);
  const draggedRoomHandleInfoRef = useRef<{
    roomIdx: number;
    handleType: "E" | "S" | "SE" | "N" | "W";
    initialXIn: number;
    initialYIn: number;
    initialWIn: number;
    initialDIn: number;
    currentXIn: number;
    currentYIn: number;
    currentWIn: number;
    currentDIn: number;
  } | null>(null);

  // Metaheuristic Room Occlusion Culling Sub-Graphs & Portals
  const roomGroupsRef = useRef<Map<number, THREE.Group>>(new Map());
  const roomDoorwaysRef = useRef<DoorwayConnection[]>([]);
  const roomLightsByRoomRef = useRef<Map<number, THREE.PointLight[]>>(new Map());

  // Drag-and-Drop room meshes references
  const ghostRoomMeshRef = useRef<THREE.Mesh | null>(null);
  const draggedRoomIdxRef = useRef<number | null>(null);
  const [draggedRoomInfo, setDraggedRoomInfo] = useState<{
    name: string;
    x: number;
    z: number;
    isCropped?: boolean;
    cropWFt?: number;
    cropDFt?: number;
  } | null>(null);
  const [doorAlert, setDoorAlert] = useState<string | null>(null);
  const [smartSnapDescription, setSmartSnapDescription] = useState<string | null>(null);

  // Custom 3D Furniture Placement & Selection References
  const placingGhostGroupRef = useRef<THREE.Group | null>(null);
  const snapGuideMeshRef = useRef<THREE.Line | null>(null);
  const draggedCustomObjectIdRef = useRef<string | null>(null);
  const customObjectMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const draggedCustomObjPosRef = useRef<{ x: number; z: number; rotationY?: number } | null>(null);

  // Animated Ceiling Fan references
  const fanBladesRef = useRef<THREE.Group[]>([]);
  // The roof hides the plan from above, so it is only shown in first person.
  const roofGroupRef = useRef<THREE.Group | null>(null);

  // Player walkthrough state (5'5" eye level)
  const playerRef = useRef<PlayerTransform>({
    x: 15,
    y: EYE_LEVEL_FT,
    z: 20,
    yaw: Math.PI,
    pitch: -0.06,
    isSprinting: false,
    isCrouched: false,
    isMoving: false,
    lightsOn: true,
  });

  const jumpVelocityY = useRef(0);
  const isJumping = useRef(false);
  const bobTimer = useRef(0);
  const lastPlayerReportTime = useRef(0);
  const lastReportedPos = useRef<{ x: number; z: number; yaw: number }>({ x: 0, z: 0, yaw: 0 });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const isDraggingLook = useRef(false);
  const prevMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerDownPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const savedOrbitTarget = useRef<THREE.Vector3>(new THREE.Vector3());
  const savedOrbitCamPos = useRef<THREE.Vector3>(new THREE.Vector3());

  const plotRef = useRef(plot);
  const facingRef = useRef(facing);
  const setbackRef = useRef(setback);
  const onPlotChangeRef = useRef(onPlotChange);
  const onPlayerUpdateRef = useRef(onPlayerUpdate);
  const onToggleLightsRef = useRef(onToggleLights);
  const onRoomMoveRef = useRef(onRoomMove);
  const onRoomResizeRef = useRef(onRoomResize);
  const onAddCustomObjectRef = useRef(onAddCustomObject);
  const onSelectObjectRef = useRef(onSelectObject);
  const onUpdateCustomObjectRef = useRef(onUpdateCustomObject);
  const onUpdateCustomObjectPosRef = useRef(onUpdateCustomObjectPos);
  const onConvertBuiltinToCustomRef = useRef(onConvertBuiltinToCustom);
  const onRequestReplaceRef = useRef(onRequestReplace);
  const onRequestDeleteRef = useRef(onRequestDelete);
  const onRotateSelectedRef = useRef(onRotateSelected);
  const onRotatePlacingRef = useRef(onRotatePlacing);
  const activeCadToolRef = useRef(activeCadTool);
  const activeWallTypeRef = useRef(activeWallType);
  const activeFloorRef = useRef(activeFloor);
  const onChangeActiveFloorRef = useRef(onChangeActiveFloor);
  const onChangeCustomWallsRef = useRef(onChangeCustomWalls);
  const onChangeCustomRoomZonesRef = useRef(onChangeCustomRoomZones);
  const modeRef = useRef(mode);
  const activeMoveCmdRef = useRef(activeMoveCmd);
  const lightsOnRef = useRef(lightsOn);
  const roomsRef = useRef(rooms);
  const customObjectsRef = useRef(customObjects);
  const customOpeningsRef = useRef(customOpenings || {});
  const customWallsRef = useRef(customWalls || []);
  const customRoomZonesRef = useRef(customRoomZones || []);
  const deletedBuiltinIdsRef = useRef(deletedBuiltinIds);
  const placingItemTypeRef = useRef(placingItemType);
  const placingRotationYRef = useRef(placingRotationY);
  const selectedObjectIdRef = useRef(selectedObjectId);
  const materialConfigRef = useRef(materialConfig);
  const windowConfigRef = useRef(windowConfig);
  const onChangeWindowConfigRef = useRef(onChangeWindowConfig);
  const placingOpeningDefRef = useRef(placingOpeningDef);
  const onSelectPlaceOpeningRef = useRef(onSelectPlaceOpening);
  const onChangeCustomOpeningsRef = useRef(onChangeCustomOpenings);
  const isLayoutLockedRef = useRef(isLayoutLocked);
  const onToggleLayoutLockRef = useRef(onToggleLayoutLock);
  const isUpgradedRef = useRef(isUpgraded);

  interface InteractiveDoorItem {
    id: string;
    group: THREE.Group;
    doorPos: THREE.Vector3;
    widthFt: number;
    edge: string;
    swingSign: number;
    isOpen: boolean;
    currentAngle: number;
    targetAngle: number;
    label: string;
  }

  const interactiveDoorsRef = useRef<Map<string, InteractiveDoorItem>>(new Map());
  const sceneObstaclesRef = useRef<ObstacleBox[]>([]);
  const activeNearDoorRef = useRef<InteractiveDoorItem | null>(null);
  const doorPromptRef = useRef<{ doorId: string; label: string; isOpen: boolean } | null>(null);
  const toggleDoorRef = useRef<((doorId?: string) => void) | null>(null);
  const onNearestDoorChangeRef = useRef(onNearestDoorChange);
  onNearestDoorChangeRef.current = onNearestDoorChange;

  useEffect(() => {
    if (onRegisterDoorTrigger) {
      onRegisterDoorTrigger(() => {
        if (toggleDoorRef.current) {
          toggleDoorRef.current();
        }
      });
    }
  }, [onRegisterDoorTrigger]);

  useEffect(() => {
    isUpgradedRef.current = isUpgraded;
    plotRef.current = plot;
    facingRef.current = facing;
    setbackRef.current = setback;
    onPlotChangeRef.current = onPlotChange;
    onPlayerUpdateRef.current = onPlayerUpdate;
    onToggleLightsRef.current = onToggleLights;
    onRoomMoveRef.current = onRoomMove;
    onRoomResizeRef.current = onRoomResize;
    onAddCustomObjectRef.current = onAddCustomObject;
    onSelectObjectRef.current = onSelectObject;
    onUpdateCustomObjectRef.current = onUpdateCustomObject;
    onUpdateCustomObjectPosRef.current = onUpdateCustomObjectPos;
    onConvertBuiltinToCustomRef.current = onConvertBuiltinToCustom;
    onRequestReplaceRef.current = onRequestReplace;
    onRequestDeleteRef.current = onRequestDelete;
    onRotateSelectedRef.current = onRotateSelected;
    onRotatePlacingRef.current = onRotatePlacing;
    activeCadToolRef.current = activeCadTool;
    activeWallTypeRef.current = activeWallType;
    activeFloorRef.current = activeFloor;
    onChangeActiveFloorRef.current = onChangeActiveFloor;
    modeRef.current = mode;
    activeMoveCmdRef.current = activeMoveCmd;
    lightsOnRef.current = lightsOn;
    roomsRef.current = rooms;
    customObjectsRef.current = customObjects;
    customOpeningsRef.current = customOpenings || {};
    customWallsRef.current = customWalls || [];
    customRoomZonesRef.current = customRoomZones || [];
    deletedBuiltinIdsRef.current = deletedBuiltinIds;
    placingItemTypeRef.current = placingItemType;
    placingRotationYRef.current = placingRotationY;
    selectedObjectIdRef.current = selectedObjectId;
    materialConfigRef.current = materialConfig;
    windowConfigRef.current = windowConfig;
    onChangeWindowConfigRef.current = onChangeWindowConfig;
    placingOpeningDefRef.current = placingOpeningDef;
    onSelectPlaceOpeningRef.current = onSelectPlaceOpening;
    isLayoutLockedRef.current = isLayoutLocked;
    onToggleLayoutLockRef.current = onToggleLayoutLock;
    activeCadToolRef.current = activeCadTool;
    activeWallTypeRef.current = activeWallType;
    onChangeCustomWallsRef.current = onChangeCustomWalls;
    onChangeCustomRoomZonesRef.current = onChangeCustomRoomZones;
    onChangeCustomOpeningsRef.current = onChangeCustomOpenings;
    onToggleRaytraceRef.current = onToggleRaytrace;

    if (widthHandleRef.current) widthHandleRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (depthHandleRef.current) depthHandleRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (customWallHandlesGroupRef.current) customWallHandlesGroupRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;

    roomLightsRef.current.forEach((l) => {
      l.visible = true;
    });
  }, [
    plot,
    facing,
    setback,
    onPlotChange,
    onPlayerUpdate,
    onToggleLights,
    onRoomMove,
    onRoomResize,
    onAddCustomObject,
    onSelectObject,
    onUpdateCustomObject,
    onRequestReplace,
    onRequestDelete,
    onRotateSelected,
    onRotatePlacing,
    mode,
    activeMoveCmd,
    lightsOn,
    isUpgraded,
    rooms,
    customObjects,
    deletedBuiltinIds,
    placingItemType,
    placingRotationY,
    selectedObjectId,
    materialConfig,
    windowConfig,
    isLayoutLocked,
    onToggleLayoutLock,
    onToggleRaytrace,
  ]);

  // Real-Time GPU Path Tracer Lifecycle Effect
  useEffect(() => {
    isRaytracingRef.current = isRaytracing;
    if (isRaytracing) {
      let isSubscribed = true;
      const startPT = async () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return;

        setIsRaytraceBuilding(true);

        // Hide gizmos & grids so they don't get baked into BVH
        if (widthHandleRef.current) widthHandleRef.current.visible = false;
        if (depthHandleRef.current) depthHandleRef.current.visible = false;
        if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = false;
        if (customWallHandlesGroupRef.current) customWallHandlesGroupRef.current.visible = false;
        if (whiteGridRef.current) whiteGridRef.current.visible = false;
        if (darkGridRef.current) darkGridRef.current.visible = false;

        let pt = pathTracerRef.current;
        if (!pt) {
          pt = new WebGLPathTracer(renderer);
          pathTracerRef.current = pt;
        }
        pt.bounces = bouncesRef.current;
        pt.renderScale = 1.0;
        pt.tiles.set(2, 2);
        pt.filterGlossyFactor = 0.5;
        pt.dynamicLowRes = true;
        pt.lowResScale = 0.25;

        try {
          await pt.setSceneAsync(scene, camera);
          if (!isSubscribed) return;
          isPathTracerReadyRef.current = true;
          setRaytraceSamples(0);
        } catch (err) {
          console.warn("Path tracer setScene error:", err);
        } finally {
          if (isSubscribed) setIsRaytraceBuilding(false);
        }
      };
      startPT();

      return () => {
        isSubscribed = false;
      };
    } else {
      isPathTracerReadyRef.current = false;
      if (modeRef.current !== "walkthrough" && !isLayoutLockedRef.current) {
        if (widthHandleRef.current) widthHandleRef.current.visible = true;
        if (depthHandleRef.current) depthHandleRef.current.visible = true;
        if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = true;
      }
      if (lightsOnRef.current) {
        if (whiteGridRef.current) whiteGridRef.current.visible = true;
      } else {
        if (darkGridRef.current) darkGridRef.current.visible = true;
      }
    }
  }, [isRaytracing]);


  // Dynamic Day (Light Mode) vs Night (Dark Mode) Environment & Sky Dome
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (lightsOn) {
      // ☀️ DAY / LIGHT MODE: Clear Blue Sky, Radiant Sun & Clean White Grids
      const daySky = createDaySkyTexture();
      scene.background = daySky;
      applyEnvironment(scene, rendererRef.current, envMapsRef.current, false);

      if (groundMeshRef.current) {
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).map = null;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).color.set(DAY_GROUND_COLOR);
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).roughness = 0.88;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).metalness = 0.02;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }

      if (plotMeshRef.current) {
        const m = plotMeshRef.current.material as THREE.MeshStandardMaterial;
        m.color.set(DAY_PLOT_COLOR);
        m.roughness = 0.96;
        m.metalness = 0.0;
        m.needsUpdate = true;
      }

      if (darkGridRef.current) darkGridRef.current.visible = false;
      if (whiteGridRef.current) whiteGridRef.current.visible = true;

      if (sunLightRef.current) {
        sunLightRef.current.color.set(0xfff8ee);
        sunLightRef.current.intensity = 2.2;
        sunLightRef.current.position.set(60, 95, 45);
      }

      if (hemiLightRef.current) {
        hemiLightRef.current.color.set(0x93c5fd); // Clear blue sky light
        hemiLightRef.current.groundColor.set(0xdcfce7); // Ground bounce
        hemiLightRef.current.intensity = 0.3;
      }

      if (skyFillRef.current) {
        skyFillRef.current.color.set(0xbfdbfe);
        skyFillRef.current.intensity = 0.85;
      }

      // Soft ambient interior lights in daytime
      roomLightsRef.current.forEach((l) => {
        l.intensity = 0.4;
      });
    } else {
      // 🌙 NIGHT / DARK MODE: Exact Previous Default Dark Mode
      scene.background = new THREE.Color(0x0a0e17);
      applyEnvironment(scene, rendererRef.current, envMapsRef.current, true);

      if (groundMeshRef.current) {
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).map = null;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).color.set(0x111827); // Previous default dark ground
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).roughness = 0.95;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).metalness = 0.05;
        (groundMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }

      if (plotMeshRef.current) {
        const m = plotMeshRef.current.material as THREE.MeshStandardMaterial;
        m.color.set(NIGHT_PLOT_COLOR);
        m.roughness = 0.9;
        m.metalness = 0.1;
        m.needsUpdate = true;
      }

      if (darkGridRef.current) darkGridRef.current.visible = true;
      if (whiteGridRef.current) whiteGridRef.current.visible = false;

      if (sunLightRef.current) {
        sunLightRef.current.color.set(0xfff5e6); // Previous default sun
        sunLightRef.current.intensity = 1.85;
        sunLightRef.current.position.set(50, 80, 40);
      }

      if (hemiLightRef.current) {
        hemiLightRef.current.color.set(0xe8f0fe); // Previous default hemi
        hemiLightRef.current.groundColor.set(0x1e2630);
        hemiLightRef.current.intensity = 0.25;
      }

      if (skyFillRef.current) {
        skyFillRef.current.color.set(0x8cb6e8); // Previous default sky fill
        skyFillRef.current.intensity = 0.55;
      }

      // Previous default interior lights
      roomLightsRef.current.forEach((l) => {
        l.intensity = 1.6;
      });
    }
  }, [lightsOn]);

  // 1. Scene & Renderer Initialization
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      600
    );
    camera.position.set(32, 42, 58);
    cameraRef.current = camera;

    // Read once, at mount, and it gates anti-aliasing, shadow filtering, shadow map size, pixel
    // ratio and whether the post-processing composer is built at all. A narrow window used to
    // count as a weak GPU here, which meant docking the app beside an editor silently dropped
    // every one of those — the result reads as a drop in resolution, and resizing never got it
    // back. How much canvas is on screen says nothing about what the GPU can fill it with.
    const isMobileOrLowGPU =
      typeof window !== "undefined" &&
      (/Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent) ||
        (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4));

    const targetDPR = isMobileOrLowGPU
      ? Math.min(window.devicePixelRatio, 1.0)
      : Math.min(window.devicePixelRatio, 1.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobileOrLowGPU,
      alpha: true,
      powerPreference: "high-performance",
      precision: isMobileOrLowGPU ? "mediump" : "highp",
    });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(targetDPR);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = isMobileOrLowGPU ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.enablePan = false; // Strictly keeps rotation centered on the house model
    controlsRef.current = controls;

    controls.addEventListener("change", () => {
      if (isRaytracingRef.current && pathTracerRef.current && isPathTracerReadyRef.current) {
        pathTracerRef.current.updateCamera();
        pathTracerRef.current.reset();
        setRaytraceSamples(0);
      }
    });


    // Architectural Lighting setup
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xdcfce7, 0.3);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    sunLight.position.set(60, 95, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = isMobileOrLowGPU ? 1024 : 2048;
    sunLight.shadow.mapSize.height = isMobileOrLowGPU ? 1024 : 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 220;
    const shadowSize = 65;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const skyFill = new THREE.DirectionalLight(0xbfdbfe, 0.8);
    skyFill.position.set(-40, 50, -30);
    scene.add(skyFill);
    skyFillRef.current = skyFill;

    // Ground Plane & Sky Initializer
    const groundGeom = new THREE.PlaneGeometry(360, 360);
    const groundMat = new THREE.MeshStandardMaterial({
      color: DAY_GROUND_COLOR,
      roughness: 0.88,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    groundMeshRef.current = groundMesh;

    // Dark Mode CAD Grid (Previous Default)
    const darkGrid = new THREE.GridHelper(260, 130, 0x334155, 0x1e293b);
    darkGrid.position.y = -0.01;
    darkGrid.visible = false;
    scene.add(darkGrid);
    darkGridRef.current = darkGrid;

    // Light Mode CAD Grid. The lines used to be white on a sky-blue ground; now the ground is
    // white, so the lines have to be the darker of the two or the tiles have no seams at all.
    const whiteGrid = new THREE.GridHelper(260, 130, 0x9fb0c2, 0xd4dde6);
    whiteGrid.position.y = -0.01;
    (whiteGrid.material as THREE.Material).transparent = true;
    (whiteGrid.material as THREE.Material).opacity = 0.85;
    whiteGrid.visible = true;
    scene.add(whiteGrid);
    whiteGridRef.current = whiteGrid;

    // Initial Sky Background (Day Light Mode: Clear Blue Sky & Sun)
    scene.background = createDaySkyTexture();
    applyEnvironment(scene, renderer, envMapsRef.current, false);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Ghost room mesh for drag and drop preview
    const ghostGeom = new THREE.BoxGeometry(1, WALL_HEIGHT_FT, 1);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x006688,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2,
    });
    const ghostMesh = new THREE.Mesh(ghostGeom, ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);
    ghostRoomMeshRef.current = ghostMesh;

    // 3D Smart Wall Magnetic Snapping Guide Line
    const snapGuideGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.06, 0),
      new THREE.Vector3(0, 0.06, 0),
    ]);
    const snapGuideMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const snapGuideLine = new THREE.Line(snapGuideGeom, snapGuideMat);
    snapGuideLine.visible = false;
    scene.add(snapGuideLine);
    snapGuideMeshRef.current = snapGuideLine;

    // Ambient occlusion. Nothing in the scene carried contact darkening before this: corners,
    // the gap under a sofa and the join where a wall meets the floor all lit as if open sky
    // reached them. Skipped on mobile and weak GPUs, where the extra depth-normal pass and the
    // denoise cost more than the look is worth.
    if (!isMobileOrLowGPU) {
      // EffectComposer's own default target is single-sampled, and `antialias: true` on the
      // renderer only ever applied to the default framebuffer — which stops being the render
      // destination the moment a composer exists. Without this the AO pass costs every edge in
      // the scene its anti-aliasing, which reads as a drop in resolution rather than as a
      // missing effect. Supply a multisampled target instead of taking the default.
      const bufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
      const msaaTarget = new THREE.WebGLRenderTarget(bufferSize.width, bufferSize.height, {
        type: THREE.HalfFloatType,
        samples: 4,
      });

      const composer = new EffectComposer(renderer, msaaTarget);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(mount.clientWidth, mount.clientHeight);
      composer.addPass(new RenderPass(scene, camera));

      const gtao = new SolidGeometryGTAOPass(scene, camera, mount.clientWidth, mount.clientHeight);
      // The scene is measured in feet, and GTAO's radius is in world units — the 0.25 default is
      // three inches, which reads as a thin outline rather than occlusion. A foot and a half is
      // about the depth of the gaps that actually want darkening.
      gtao.updateGtaoMaterial({
        radius: 1.5,
        distanceExponent: 1.0,
        thickness: 1.0,
        scale: 1.0,
        samples: 16,
        screenSpaceRadius: false,
      });
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
      // Tone mapping and the sRGB transform move here: three skips both when a pass renders
      // into a render target, so without this the composed image goes out untonemapped.
      composer.addPass(new OutputPass());

      composerRef.current = composer;
      gtaoPassRef.current = gtao;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composerRef.current?.setSize(width, height);
      }
    });
    resizeObserver.observe(mount);

    // Dimension handles
    const handleGeom = new THREE.SphereGeometry(HANDLE_RADIUS_FT, 24, 24);
    const handleMat = new THREE.MeshStandardMaterial({
      color: ACCENT,
      emissive: 0x663300,
      roughness: 0.25,
      metalness: 0.3,
    });
    const widthHandle = new THREE.Mesh(handleGeom, handleMat);
    const depthHandle = new THREE.Mesh(handleGeom, handleMat.clone());
    scene.add(widthHandle);
    scene.add(depthHandle);
    widthHandleRef.current = widthHandle;
    depthHandleRef.current = depthHandle;

    const roomHandlesGroup = new THREE.Group();
    scene.add(roomHandlesGroup);
    roomHandlesGroupRef.current = roomHandlesGroup;

    const customWallHandlesGroup = new THREE.Group();
    scene.add(customWallHandlesGroup);
    customWallHandlesGroupRef.current = customWallHandlesGroup;

    // 3D Draft Wall Extrusion Ghost
    const draftGhostWallMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    });
    const draftGhostWallGeom = new THREE.BoxGeometry(1, WALL_HEIGHT_FT, 0.75);
    const draftGhostWallMesh = new THREE.Mesh(draftGhostWallGeom, draftGhostWallMat);
    draftGhostWallMesh.visible = false;
    scene.add(draftGhostWallMesh);
    draftGhost3DWallRef.current = draftGhostWallMesh;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    let dragKind: "width" | "depth" | "room" | "roomHandle" | "customObject" | "customWallHandle" | null = null;

    function setPointerNdc(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickHandle(ev: PointerEvent): "width" | "depth" | null {
      if (modeRef.current === "walkthrough") return null;
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects([widthHandle, depthHandle]);
      if (intersects.length === 0) return null;
      return intersects[0].object === widthHandle ? "width" : "depth";
    }

    function pickRoomHandle(
      ev: PointerEvent
    ): { roomIdx: number; handleType: "E" | "S" | "SE" | "N" | "W" } | null {
      if (modeRef.current === "walkthrough" || isLayoutLockedRef.current) return null;
      if (!roomHandlesGroupRef.current) return null;
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects(roomHandlesGroupRef.current.children, true);
      if (intersects.length === 0) return null;
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.isRoomHandle) {
        return { roomIdx: hit.userData.roomIdx, handleType: hit.userData.handleType };
      }
      return null;
    }

    function pickCustomWallHandle(
      ev: PointerEvent
    ): { wallId: string; endpoint: "start" | "end" } | null {
      if (modeRef.current === "walkthrough" || isLayoutLockedRef.current) return null;
      if (!customWallHandlesGroupRef.current) return null;
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects(customWallHandlesGroupRef.current.children, true);
      if (intersects.length === 0) return null;
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.isCustomWallHandle) {
        return { wallId: hit.userData.wallId, endpoint: hit.userData.endpoint };
      }
      return null;
    }

    // High-Precision 3D Volume Room Picker: Picks ANY room (Pooja, Bath, Bed, Hall)
    // whether clicking the floor, furniture, altar, walls, or floating badge!
    function pickRoom(ev: PointerEvent): number | null {
      if (modeRef.current === "walkthrough") return null;
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      const currentRooms = roomsRef.current;
      let closestIdx: number | null = null;
      let closestDist = Infinity;

      for (let i = 0; i < currentRooms.length; i++) {
        const r = currentRooms[i];
        const rx = inchesToFeet(r.x_in);
        const rz = inchesToFeet(r.y_in);
        const rw = inchesToFeet(r.w_in);
        const rd = inchesToFeet(r.d_in);

        const roomBox = new THREE.Box3(
          new THREE.Vector3(rx, 0, rz),
          new THREE.Vector3(rx + rw, WALL_HEIGHT_FT + 3.2, rz + rd)
        );

        const target = new THREE.Vector3();
        if (raycaster.ray.intersectBox(roomBox, target)) {
          const dist = raycaster.ray.origin.distanceTo(target);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
      }

      // Ground plane fallback
      if (closestIdx === null && raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        for (let i = 0; i < currentRooms.length; i++) {
          const r = currentRooms[i];
          const rx = inchesToFeet(r.x_in);
          const rz = inchesToFeet(r.y_in);
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          if (hitPoint.x >= rx && hitPoint.x <= rx + rw && hitPoint.z >= rz && hitPoint.z <= rz + rd) {
            return i;
          }
        }
      }

      return closestIdx;
    }

    // Universal 3D Placement Position Calculator for Walkthrough Mode
    function getWalkthroughPlacementPoint(ndc: THREE.Vector2): THREE.Vector3 {
      raycaster.setFromCamera(ndc, camera);
      // 1. Raycast against scene objects (floors & walls)
      if (groupRef.current) {
        const hits = raycaster.intersectObjects(groupRef.current.children, true);
        for (const hit of hits) {
          // Exclude ceiling/roof slabs & ceiling fans
          if (hit.point.y > 8.5) continue;
          if (hit.distance < 28) {
            return new THREE.Vector3(hit.point.x, 0, hit.point.z);
          }
        }
      }
      // 2. Ground plane intersection if in front of player
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const camToHit = hitPoint.clone().sub(camera.position);
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        if (camToHit.dot(lookDir) > 0 && hitPoint.distanceTo(camera.position) < 32) {
          return new THREE.Vector3(hitPoint.x, 0, hitPoint.z);
        }
      }
      // 3. Fallback: 6 feet directly in front of the player on floor
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      return new THREE.Vector3(
        playerRef.current.x + forward.x * 6.0,
        0,
        playerRef.current.z + forward.z * 6.0
      );
    }

    // Universal 3D Furniture Picker (Both Custom Placed & Built-in Items)
    function pickFurnitureObject(ev?: PointerEvent | null, ndcOverride?: THREE.Vector2): SelectedObjectInfo | null {
      if (ndcOverride) {
        pointerNdc.copy(ndcOverride);
      } else if (ev) {
        setPointerNdc(ev);
      }
      raycaster.setFromCamera(pointerNdc, camera);

      // 1. Raycast against scene hierarchy for any mesh with userData.isFurniture or userData.isCustomObject
      if (groupRef.current) {
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        for (const hit of intersects) {
          let curr: THREE.Object3D | null = hit.object;
          while (curr && curr !== groupRef.current) {
            if (curr.userData && (curr.userData.isCustomObject || curr.userData.isFurniture || curr.userData.isWindow || curr.userData.isWall)) {
              const id = curr.userData.id;
              const isBuiltin = Boolean(curr.userData.isBuiltin);
              const isWindow = Boolean(curr.userData.isWindow);
              const isWall = Boolean(curr.userData.isWall);
              const isWallRemoved = Boolean(curr.userData.isRemoved);
              const name = curr.userData.name || (isWindow ? "Window" : isWall ? "Wall" : "Furniture");
              const type = curr.userData.type || (isWindow ? "window" : isWall ? "wall" : "sofa_3seater");
              const worldPos = new THREE.Vector3();
              curr.getWorldPosition(worldPos);
              return {
                id,
                name,
                type,
                isBuiltin,
                isWindow,
                isWall,
                isWallRemoved,
                windowShape: curr.userData.shape,
                windowFrameFinish: curr.userData.frameFinish,
                windowGlassTint: curr.userData.glassTint,
                windowHasCurtains: curr.userData.hasCurtains,
                windowWidthFt: curr.userData.widthFt,
                windowHeightFt: curr.userData.heightFt,
                roomIndex: curr.userData.roomIndex,
                roomName: curr.userData.roomName,
                edge: curr.userData.edge,
                x: curr.userData.x ?? worldPos.x,
                y: 0,
                z: curr.userData.z ?? worldPos.z,
                rotationY: curr.rotation.y || curr.userData.rotationY || 0,
                scale: curr.scale.x || curr.userData.scale || 1.0,
                colorHex: curr.userData.colorHex,
              };
            }
            curr = curr.parent;
          }
        }
      }

      // 2. Also check bounding boxes of custom list as fallback
      const customList = customObjectsRef.current || [];
      let closestObj: SelectedObjectInfo | null = null;
      let closestDist = Infinity;

      for (const obj of customList) {
        const itemDef = FURNITURE_CATALOG.find((i) => i.type === obj.type);
        const s = obj.scale || 1.0;
        const w = (itemDef?.dimensions.widthFt || 4) * s;
        const d = (itemDef?.dimensions.depthFt || 4) * s;
        const h = (itemDef?.dimensions.heightFt || 4) * s;

        const box = new THREE.Box3(
          new THREE.Vector3(obj.x - w / 2, 0, obj.z - d / 2),
          new THREE.Vector3(obj.x + w / 2, h, obj.z + d / 2)
        );

        const target = new THREE.Vector3();
        if (raycaster.ray.intersectBox(box, target)) {
          const dist = raycaster.ray.origin.distanceTo(target);
          if (dist < closestDist) {
            closestDist = dist;
            closestObj = {
              id: obj.id,
              name: obj.name || itemDef?.name || "Furniture",
              type: obj.type,
              isBuiltin: false,
              x: obj.x,
              y: 0,
              z: obj.z,
              rotationY: obj.rotationY || 0,
              scale: obj.scale || 1.0,
              colorHex: obj.colorHex,
            };
          }
        }
      }
      return closestObj;
    }

    function onPointerDownCapture(ev: PointerEvent) {
      pointerDownPosRef.current = { x: ev.clientX, y: ev.clientY, time: performance.now() };

      if (modeRef.current === "walkthrough") {
        isDraggingLook.current = true;
        prevMousePos.current = { x: ev.clientX, y: ev.clientY };
        return;
      }

      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      // 0a. CAD Tool 1: 3D Freehand Wall Drawing
      if (activeCadToolRef.current === "draw_wall" && ev.button === 0) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();

          let snapX = Math.round(hitPoint.x * 2) / 2;
          let snapZ = Math.round(hitPoint.z * 2) / 2;

          // Magnetically snap to custom wall endpoints
          for (const w of customWallsRef.current) {
            const wx1 = inchesToFeet(w.startXIn);
            const wz1 = inchesToFeet(w.startYIn);
            const wx2 = inchesToFeet(w.endXIn);
            const wz2 = inchesToFeet(w.endYIn);
            if (Math.hypot(snapX - wx1, snapZ - wz1) <= 1.2) {
              snapX = wx1;
              snapZ = wz1;
              break;
            }
            if (Math.hypot(snapX - wx2, snapZ - wz2) <= 1.2) {
              snapX = wx2;
              snapZ = wz2;
              break;
            }
          }

          if (!draftWallStartFtRef.current) {
            draftWallStartFtRef.current = { x: snapX, z: snapZ };
            setDraftWallStartFt({ x: snapX, z: snapZ });
            setDrafting3DDescription(`✏️ Started 3D Wall at (${snapX.toFixed(1)}', ${snapZ.toFixed(1)}') • Move cursor & click to erect wall`);
          } else {
            const startPt = draftWallStartFtRef.current;
            const dx = snapX - startPt.x;
            const dz = snapZ - startPt.z;
            const lenFt = Math.hypot(dx, dz);

            if (lenFt >= 1.0) {
              const newWall: CustomDrawnWall = {
                id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                floor: activeFloorRef.current || 0,
                startXIn: Math.round(startPt.x * 12),
                startYIn: Math.round(startPt.z * 12),
                endXIn: Math.round(snapX * 12),
                endYIn: Math.round(snapZ * 12),
                wallType: activeWallTypeRef.current || "exterior",
                thicknessIn: activeWallTypeRef.current === "exterior" ? 9.0 : 4.5,
                heightFt: 9.0,
                openings: [],
              };
              const updated = [...(customWallsRef.current || []), newWall];
              customWallsRef.current = updated;
              onChangeCustomWallsRef.current?.(updated);
              draftWallStartFtRef.current = { x: snapX, z: snapZ };
              setDraftWallStartFt({ x: snapX, z: snapZ });
              setDrafting3DDescription(`✅ Built 3D Wall on Floor ${activeFloorRef.current || "G"} (${lenFt.toFixed(1)} ft) • Click next corner or press ESC`);
            }
          }
          return;
        }
      }

      // 0b. CAD Tool 2 & 3: Place 3D Door or Window directly onto 3D Walls (Custom Walls + Solved Room Walls)
      if ((activeCadToolRef.current === "place_door" || activeCadToolRef.current === "place_window" || placingOpeningDefRef.current) && ev.button === 0) {
        let hasHit = false;
        // 1. Raycast against scene objects (walls, rooms) in groupRef.current
        if (groupRef.current) {
          const hits = raycaster.intersectObjects(groupRef.current.children, true);
          for (const h of hits) {
            if (h.point.y <= 12.0) {
              hitPoint.copy(h.point);
              hasHit = true;
              break;
            }
          }
        }
        if (!hasHit && raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          hasHit = true;
        }

        if (hasHit) {
          let closestCustomHit: { wall: CustomDrawnWall; offsetIn: number } | null = null;
          let closestRoomHit: { roomIndex: number; edge: "N" | "S" | "E" | "W"; offsetIn: number } | null = null;
          let closestDist = 8.0; // feet (generous snap)

          // 1. Check Custom Drawn Walls (Build from Scratch)
          for (const w of (customWallsRef.current || [])) {
            const x1 = inchesToFeet(w.startXIn);
            const z1 = inchesToFeet(w.startYIn);
            const x2 = inchesToFeet(w.endXIn);
            const z2 = inchesToFeet(w.endYIn);
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.hypot(dx, dz);
            if (len < 0.5) continue;

            const t = Math.max(0, Math.min(1, ((hitPoint.x - x1) * dx + (hitPoint.z - z1) * dz) / (len * len)));
            const projX = x1 + t * dx;
            const projZ = z1 + t * dz;
            const dist = Math.hypot(hitPoint.x - projX, hitPoint.z - projZ);

            if (dist < closestDist) {
              closestDist = dist;
              closestCustomHit = {
                wall: w,
                offsetIn: Math.round(t * len * 12),
              };
              closestRoomHit = null;
            }
          }

          // 2. Check Solved Room Perimeter Walls (3D House Model)
          for (let rIdx = 0; rIdx < roomsRef.current.length; rIdx++) {
            const r = roomsRef.current[rIdx];
            if ((r.floor ?? 0) !== (activeFloorRef.current || 0)) continue;

            const wallEdges: Array<{ edge: "N" | "S" | "E" | "W"; x1: number; z1: number; x2: number; z2: number; lenIn: number }> = [
              { edge: "N", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in), lenIn: r.w_in },
              { edge: "S", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in + r.d_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.w_in },
              { edge: "W", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.d_in },
              { edge: "E", x1: inchesToFeet(r.x_in + r.w_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.d_in },
            ];

            for (const we of wallEdges) {
              const dx = we.x2 - we.x1;
              const dz = we.z2 - we.z1;
              const lenFt = Math.hypot(dx, dz);
              if (lenFt < 0.5) continue;

              const t = Math.max(0, Math.min(1, ((hitPoint.x - we.x1) * dx + (hitPoint.z - we.z1) * dz) / (lenFt * lenFt)));
              const projX = we.x1 + t * dx;
              const projZ = we.z1 + t * dz;
              const dist = Math.hypot(hitPoint.x - projX, hitPoint.z - projZ);

              if (dist < closestDist) {
                closestDist = dist;
                closestRoomHit = {
                  roomIndex: rIdx,
                  edge: we.edge,
                  offsetIn: Math.round(t * we.lenIn),
                };
                closestCustomHit = null;
              }
            }
          }

          const placingDef = placingOpeningDefRef.current;
          const isWindow = placingDef ? placingDef.category === "window" : activeCadToolRef.current === "place_window";
          const widthIn = placingDef?.widthIn || (isWindow ? 48 : 36);
          const heightIn = placingDef?.heightIn || (isWindow ? 48 : 84);
          const sillIn = placingDef?.sillIn !== undefined ? placingDef.sillIn : (isWindow ? 36 : 0);
          // A sliding door is a door as far as the plan is concerned: it connects the two rooms
          // either side and the solver, the BOQ and the connectivity check should all count it as
          // one. The distinction is purely how the leaf is drawn, so it rides on the custom wall
          // opening — which already declared the kind — and is flattened back to "door" for
          // RoomOpening, whose kinds the solver owns.
          const catalogKind = placingDef?.kind || (isWindow ? "window" : "door");
          const customKind: CustomWallOpening["kind"] = catalogKind;
          const kind: RoomOpening["kind"] = catalogKind === "sliding_door" ? "door" : catalogKind;

          if (closestCustomHit) {
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const newOpening: CustomWallOpening = {
              id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              kind: customKind,
              offsetIn: Math.max(0, closestCustomHit.offsetIn - widthIn / 2),
              widthIn,
              heightIn,
              sillIn,
            };
            const updated = (customWallsRef.current || []).map((cw) =>
              cw.id === closestCustomHit!.wall.id ? { ...cw, openings: [...(cw.openings || []), newOpening] } : cw
            );
            customWallsRef.current = updated;
            onChangeCustomWallsRef.current?.(updated);
            setDrafting3DDescription(`✨ Inserted 3D ${placingDef?.name || (isWindow ? "Window" : "Door")} onto Wall!`);
            setTimeout(() => setDrafting3DDescription(null), 3000);
            return;
          }

          if (closestRoomHit) {
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const rIdx = closestRoomHit.roomIndex;
            const room = roomsRef.current[rIdx];
            if (room) {
              const roomId = `${room.name}_${rIdx}`;
              const currentOps = customOpeningsRef.current[roomId] !== undefined ? customOpeningsRef.current[roomId] : (room.openings || []);
              const wallLengthIn = closestRoomHit.edge === "N" || closestRoomHit.edge === "S" ? room.w_in : room.d_in;
              const offsetIn = Math.max(0, Math.min(wallLengthIn - widthIn, closestRoomHit.offsetIn - widthIn / 2));

              const newOp: RoomOpening = {
                kind,
                edge: closestRoomHit.edge,
                offset_in: offsetIn,
                width_in: widthIn,
                height_in: heightIn,
                sill_in: sillIn,
              };

              const nextOps = [
                ...currentOps.filter((o) => !(o.edge === closestRoomHit!.edge && Math.abs(o.offset_in - offsetIn) < 12)),
                newOp,
              ];

              const nextCustomOpenings: Record<string, RoomOpening[]> = {
                ...(customOpeningsRef.current || {}),
                [roomId]: nextOps,
              };

              const adj = findAdjacentRoomEdge(roomsRef.current, rIdx, closestRoomHit.edge);
              if (adj && (kind === "door" || kind === "opening")) {
                const adjId = `${roomsRef.current[adj.adjIndex]?.name}_${adj.adjIndex}`;
                const adjRoom = roomsRef.current[adj.adjIndex];
                if (adjRoom) {
                  const adjOps = customOpeningsRef.current[adjId] !== undefined ? customOpeningsRef.current[adjId] : (adjRoom.openings || []);
                  const adjNextOps = [
                    ...adjOps.filter((o) => !(o.edge === adj.adjEdge && Math.abs(o.offset_in - offsetIn) < 12)),
                    {
                      ...newOp,
                      edge: adj.adjEdge,
                    },
                  ];
                  nextCustomOpenings[adjId] = adjNextOps;
                }
              }

              customOpeningsRef.current = nextCustomOpenings;
              onChangeCustomOpeningsRef.current?.(nextCustomOpenings);

              if (placingDef?.windowShape) {
                const winId = `win_${rIdx}_${closestRoomHit.edge}`;
                const nextWindowConfig: WindowConfig = {
                  ...windowConfigRef.current,
                  individualOverrides: {
                    ...(windowConfigRef.current.individualOverrides || {}),
                    [winId]: {
                      ...(windowConfigRef.current.individualOverrides?.[winId] || {}),
                      shape: placingDef.windowShape,
                    },
                  },
                };
                windowConfigRef.current = nextWindowConfig;
                onChangeWindowConfigRef.current?.(nextWindowConfig);
              }

              setDrafting3DDescription(`✨ Installed 3D ${placingDef?.name || (isWindow ? "Window" : "Door")} on ${ROOM_LABELS[room.name as RoomName] || room.name}!`);
              setTimeout(() => setDrafting3DDescription(null), 3000);
              return;
            }
          }
        }
      }

      // 0c. CAD Tool 4: Tag Room Zone / Add Floor Slab in 3D
      if (activeCadToolRef.current === "tag_room" && ev.button === 0) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          const posXIn = Math.round(hitPoint.x * 12);
          const posZIn = Math.round(hitPoint.z * 12);

          // Auto-detect enclosing custom walls bounding box around the click point!
          const currentFloorWalls = (customWallsRef.current || []).filter(
            (w) => (w.floor ?? 0) === (activeFloorRef.current || 0)
          );

          let minXIn = posXIn - 72;
          let maxXIn = posXIn + 72;
          let minZIn = posZIn - 72;
          let maxZIn = posZIn + 72;

          if (currentFloorWalls.length >= 2) {
            const allXs = currentFloorWalls.flatMap((w) => [w.startXIn, w.endXIn]);
            const allZs = currentFloorWalls.flatMap((w) => [w.startYIn, w.endYIn]);

            const lefts = allXs.filter((x) => x <= posXIn);
            const rights = allXs.filter((x) => x >= posXIn);
            const tops = allZs.filter((z) => z <= posZIn);
            const bottoms = allZs.filter((z) => z >= posZIn);

            if (lefts.length && rights.length && tops.length && bottoms.length) {
              minXIn = Math.max(...lefts);
              maxXIn = Math.min(...rights);
              minZIn = Math.max(...tops);
              maxZIn = Math.min(...bottoms);
            }
          }

          const wIn = Math.max(36, maxXIn - minXIn);
          const dIn = Math.max(36, maxZIn - minZIn);
          const areaSqFt = Math.round(((wIn * dIn) / 144) * 10) / 10;

          const newZone: CustomRoomZone = {
            id: `zone_${Date.now()}`,
            floor: activeFloorRef.current || 0,
            name: "hall",
            customLabel: "Living Room",
            xIn: minXIn,
            yIn: minZIn,
            wIn,
            dIn,
            areaSqFt,
          };
          const updated = [...(customRoomZonesRef.current || []), newZone];
          customRoomZonesRef.current = updated;
          onChangeCustomRoomZonesRef.current?.(updated);
          setDrafting3DDescription(`✨ Added ${areaSqFt} sq ft Floor Slab to Room!`);
          return;
        }
      }

      // If user is currently placing a furniture item from the catalog
      if (placingItemTypeRef.current && ev.button === 0) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          const isWall = placingItemTypeRef.current.startsWith("wall_");
          const itemDef = FURNITURE_CATALOG.find((i) => i.type === placingItemTypeRef.current);
          const wallLen = itemDef?.dimensions.widthFt || 8.0;

          let posX = Math.round(hitPoint.x * 2) / 2;
          let posZ = Math.round(hitPoint.z * 2) / 2;
          let rotY = placingRotationYRef.current || 0;

          if (isWall) {
            const snap = computeSmartWallSnap(
              hitPoint.x,
              hitPoint.z,
              wallLen,
              roomsRef.current,
              customObjectsRef.current,
              customOpeningsRef.current
            );
            if (snap.isSnapped) {
              posX = snap.x;
              posZ = snap.z;
              rotY = snap.rotationY;
            }
          }

          const newObj: PlacedCustomObject = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: placingItemTypeRef.current,
            name: itemDef?.name || (isWall ? "Partition Wall" : "Furniture"),
            x: posX,
            y: 0,
            z: posZ,
            rotationY: rotY,
            scale: 1.0,
            colorHex: itemDef?.defaultColor,
          };
          if (onAddCustomObjectRef.current) {
            onAddCustomObjectRef.current(newObj);
          }
          if (placingGhostGroupRef.current) {
            placingGhostGroupRef.current.visible = false;
          }
          if (snapGuideMeshRef.current) {
            snapGuideMeshRef.current.visible = false;
          }
          setSmartSnapDescription(null);
          return;
        }
      }

      // If layout is unlocked, allow dragging plot resize handles, custom objects, and room blocks
      if (!isLayoutLockedRef.current) {
        // 0. Check custom wall endpoint bubble handles (Orange Bubbles on Custom Walls!)
        const hitCustomWallHandle = pickCustomWallHandle(ev);
        if (hitCustomWallHandle && ev.button === 0) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          const wall = customWallsRef.current.find((w) => w.id === hitCustomWallHandle.wallId);
          if (wall) {
            dragKind = "customWallHandle";
            draggedCustomWallHandleInfoRef.current = {
              wallId: hitCustomWallHandle.wallId,
              endpoint: hitCustomWallHandle.endpoint,
              initialXIn: hitCustomWallHandle.endpoint === "start" ? wall.startXIn : wall.endXIn,
              initialYIn: hitCustomWallHandle.endpoint === "start" ? wall.startYIn : wall.endYIn,
            };
            controls.enabled = false;
          }
          return;
        }

        // 1. Check room crop/resize bubble handles (Orange Bubbles on Rooms!)
        const hitRoomHandle = pickRoomHandle(ev);
        if (hitRoomHandle && ev.button === 0) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          const r = roomsRef.current[hitRoomHandle.roomIdx];
          if (r) {
            dragKind = "roomHandle";
            draggedRoomHandleInfoRef.current = {
              roomIdx: hitRoomHandle.roomIdx,
              handleType: hitRoomHandle.handleType,
              initialXIn: r.x_in,
              initialYIn: r.y_in,
              initialWIn: r.w_in,
              initialDIn: r.d_in,
              currentXIn: r.x_in,
              currentYIn: r.y_in,
              currentWIn: r.w_in,
              currentDIn: r.d_in,
            };
            controls.enabled = false;
            if (ghostMesh) {
              const rw = inchesToFeet(r.w_in);
              const rd = inchesToFeet(r.d_in);
              const rx = inchesToFeet(r.x_in);
              const rz = inchesToFeet(r.y_in);
              ghostMesh.scale.set(rw, 1, rd);
              ghostMesh.position.set(rx + rw / 2, WALL_HEIGHT_FT / 2, rz + rd / 2);
              if (ghostMesh.material instanceof THREE.MeshStandardMaterial) {
                ghostMesh.material.color.setHex(0xf59e0b);
                ghostMesh.material.emissive.setHex(0x663300);
              }
              ghostMesh.visible = true;
            }
            setDraggedRoomInfo({
              name: r.name,
              x: inchesToFeet(r.x_in + r.w_in / 2),
              z: inchesToFeet(r.y_in + r.d_in / 2),
              isCropped: true,
              cropWFt: Math.round(inchesToFeet(r.w_in) * 10) / 10,
              cropDFt: Math.round(inchesToFeet(r.d_in) * 10) / 10,
            });
          }
          return;
        }

        // 2. Check plot dimension resize handles (Orange Bubbles on Plot!)
        const hitHandle = pickHandle(ev);
        if (hitHandle) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          dragKind = hitHandle;
          controls.enabled = false;
          return;
        }

        // Check furniture object selection (custom OR built-in)
        const hitObj = pickFurnitureObject(ev);
        if (hitObj && ev.button === 0) {
          if (hitObj.isWall || hitObj.isWindow) {
            if (onSelectObjectRef.current) {
              onSelectObjectRef.current(hitObj);
            }
            // Do NOT stop propagation or disable controls for walls/windows so OrbitControls rotates view smoothly!
            return;
          }

          ev.stopPropagation();
          ev.stopImmediatePropagation();

          if (hitObj.isBuiltin) {
            let targetId = hitObj.id;
            if (onConvertBuiltinToCustomRef.current) {
              const converted = onConvertBuiltinToCustomRef.current(hitObj);
              if (converted) {
                targetId = converted.id;
              }
            }
            dragKind = "customObject";
            draggedCustomObjectIdRef.current = targetId;
            controls.enabled = false;
            return;
          } else {
            dragKind = "customObject";
            draggedCustomObjectIdRef.current = hitObj.id;
            if (onSelectObjectRef.current) {
              onSelectObjectRef.current(hitObj);
            }
            controls.enabled = false;
            return;
          }
        }

        // Check room drag
        const hitRoomIdx = pickRoom(ev);
        if (hitRoomIdx !== null && ev.button === 0) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          dragKind = "room";
          draggedRoomIdxRef.current = hitRoomIdx;
          controls.enabled = false;

          const r = roomsRef.current[hitRoomIdx];
          if (r && ghostMesh) {
            const rw = inchesToFeet(r.w_in);
            const rd = inchesToFeet(r.d_in);
            const rx = inchesToFeet(r.x_in);
            const rz = inchesToFeet(r.y_in);
            ghostMesh.scale.set(rw, 1, rd);
            ghostMesh.position.set(rx + rw / 2, WALL_HEIGHT_FT / 2, rz + rd / 2);
            ghostMesh.visible = true;
            setDraggedRoomInfo({ name: r.name, x: rx + rw / 2, z: rz + rd / 2 });
          }
          return;
        }
      } else {
        // When 3D Orbit is locked, clicking an object selects it to view details without moving any block
        const hitObj = pickFurnitureObject(ev);
        if (hitObj && ev.button === 0) {
          if (onSelectObjectRef.current) {
            onSelectObjectRef.current(hitObj);
          }
        }
      }

      // Clicking empty ground deselects custom object
      if (selectedObjectIdRef.current && onSelectObjectRef.current) {
        onSelectObjectRef.current(null);
      }
    }

    let lastHoverCheckTime = 0;

    function onPointerMove(ev: PointerEvent) {
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      if (modeRef.current === "walkthrough") {
        if (isDraggingLook.current) {
          const dx = ev.clientX - prevMousePos.current.x;
          const dy = ev.clientY - prevMousePos.current.y;
          prevMousePos.current = { x: ev.clientX, y: ev.clientY };

          const p = playerRef.current;
          p.yaw -= dx * 0.0042;
          p.pitch = Math.max(-Math.PI / 2.6, Math.min(Math.PI / 2.6, p.pitch - dy * 0.0042));
        }

        // Handle placing preview ghost in walkthrough mode (uses robust 3D forward floor projection)
        if (placingItemTypeRef.current) {
          const placePos = getWalkthroughPlacementPoint(pointerNdc);
          if (placingGhostGroupRef.current) {
            placingGhostGroupRef.current.position.set(placePos.x, 0, placePos.z);
            placingGhostGroupRef.current.rotation.y =
              playerRef.current.yaw + Math.PI + (placingRotationYRef.current || 0);
            placingGhostGroupRef.current.visible = true;
          }
          renderer.domElement.style.cursor = "crosshair";
          return;
        }

        // Hover feedback in walkthrough mode
        const now = performance.now();
        if (now - lastHoverCheckTime > 60) {
          lastHoverCheckTime = now;
          const isOverFurniture =
            pickFurnitureObject(ev) !== null ||
            pickFurnitureObject(null, new THREE.Vector2(0, 0)) !== null;
          renderer.domElement.style.cursor = isOverFurniture ? "pointer" : "crosshair";
        }
        return;
      }

      // Handle placing preview ghost in orbit mode with smart snapping
      if (placingItemTypeRef.current) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          const isWall = placingItemTypeRef.current.startsWith("wall_");
          let finalX = Math.round(hitPoint.x * 2) / 2;
          let finalZ = Math.round(hitPoint.z * 2) / 2;
          let finalRotY = placingRotationYRef.current || 0;

          if (isWall) {
            const itemDef = FURNITURE_CATALOG.find((i) => i.type === placingItemTypeRef.current);
            const wallLen = itemDef?.dimensions.widthFt || 8.0;
            const snap = computeSmartWallSnap(
              hitPoint.x,
              hitPoint.z,
              wallLen,
              roomsRef.current,
              customObjectsRef.current,
              customOpeningsRef.current
            );

            if (snap.isSnapped) {
              finalX = snap.x;
              finalZ = snap.z;
              finalRotY = snap.rotationY;
              setSmartSnapDescription(snap.snapDescription || "🧲 Attached to Wall");

              if (snapGuideMeshRef.current && snap.guideLine) {
                const points = [
                  new THREE.Vector3(snap.guideLine.x1, 0.06, snap.guideLine.z1),
                  new THREE.Vector3(snap.guideLine.x2, 0.06, snap.guideLine.z2),
                ];
                snapGuideMeshRef.current.geometry.setFromPoints(points);
                snapGuideMeshRef.current.computeLineDistances();
                snapGuideMeshRef.current.visible = true;
              }
            } else {
              setSmartSnapDescription(null);
              if (snapGuideMeshRef.current) snapGuideMeshRef.current.visible = false;
            }
          } else {
            setSmartSnapDescription(null);
            if (snapGuideMeshRef.current) snapGuideMeshRef.current.visible = false;
          }

          if (placingGhostGroupRef.current) {
            placingGhostGroupRef.current.position.set(finalX, 0, finalZ);
            placingGhostGroupRef.current.rotation.y = finalRotY;
            placingGhostGroupRef.current.visible = true;
          }
          renderer.domElement.style.cursor = "crosshair";
        }
        return;
      }

      // Handle 3D Wall Drafting Ghost & Dimension Updates
      if (activeCadToolRef.current === "draw_wall") {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          let snapX = Math.round(hitPoint.x * 2) / 2;
          let snapZ = Math.round(hitPoint.z * 2) / 2;

          for (const w of customWallsRef.current) {
            const wx1 = inchesToFeet(w.startXIn);
            const wz1 = inchesToFeet(w.startYIn);
            const wx2 = inchesToFeet(w.endXIn);
            const wz2 = inchesToFeet(w.endYIn);
            if (Math.hypot(snapX - wx1, snapZ - wz1) <= 1.2) {
              snapX = wx1;
              snapZ = wz1;
              break;
            }
            if (Math.hypot(snapX - wx2, snapZ - wz2) <= 1.2) {
              snapX = wx2;
              snapZ = wz2;
              break;
            }
          }

          const startPt = draftWallStartFtRef.current;
          const floorElevFt = (activeFloorRef.current || 0) * (WALL_HEIGHT_FT + 0.8);
          if (startPt) {
            const dx = snapX - startPt.x;
            const dz = snapZ - startPt.z;
            const lenFt = Math.hypot(dx, dz);
            const angleDeg = (Math.atan2(dz, dx) * 180) / Math.PI;

            if (draftGhost3DWallRef.current && lenFt > 0.2) {
              draftGhost3DWallRef.current.position.set(
                (startPt.x + snapX) / 2,
                floorElevFt + WALL_HEIGHT_FT / 2,
                (startPt.z + snapZ) / 2
              );
              draftGhost3DWallRef.current.scale.set(Math.max(0.2, lenFt), 1, 1);
              draftGhost3DWallRef.current.rotation.y = -Math.atan2(dz, dx);
              draftGhost3DWallRef.current.visible = true;
            }
            setDrafting3DDescription(`✏️ Floor ${(activeFloorRef.current || 0) === 0 ? "G" : activeFloorRef.current} Wall: ${lenFt.toFixed(1)} ft (${Math.round(angleDeg)}°) • Click to erect`);
          } else {
            if (draftGhost3DWallRef.current) {
              draftGhost3DWallRef.current.position.set(snapX, floorElevFt + WALL_HEIGHT_FT / 2, snapZ);
              draftGhost3DWallRef.current.scale.set(0.75, 1, 0.75);
              draftGhost3DWallRef.current.rotation.y = 0;
              draftGhost3DWallRef.current.visible = true;
            }
            setDrafting3DDescription(`✏️ Click on Floor ${(activeFloorRef.current || 0) === 0 ? "G" : activeFloorRef.current} to start 3D Wall`);
          }
          renderer.domElement.style.cursor = "crosshair";
        }
        return;
      }

      if (!dragKind) {
        const now = performance.now();
        if (now - lastHoverCheckTime > 50) {
          lastHoverCheckTime = now;
          if (isLayoutLockedRef.current) {
            const isOverFurniture = pickFurnitureObject(ev) !== null;
            renderer.domElement.style.cursor = isOverFurniture ? "pointer" : "default";
          } else {
            const isOverCustomWallHandle = pickCustomWallHandle(ev) !== null;
            const isOverHandle = pickHandle(ev) !== null;
            const isOverRoomHandle = pickRoomHandle(ev) !== null;
            const isOverFurniture = pickFurnitureObject(ev) !== null;
            const isOverRoom = pickRoom(ev) !== null;
            renderer.domElement.style.cursor =
              isOverCustomWallHandle || isOverHandle || isOverRoomHandle || isOverFurniture || isOverRoom ? "grab" : "auto";
          }
        }
        return;
      }

      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      if (dragKind === "customWallHandle" && draggedCustomWallHandleInfoRef.current) {
        const snapXIn = Math.round(hitPoint.x * 2) * 6;
        const snapZIn = Math.round(hitPoint.z * 2) * 6;
        const info = draggedCustomWallHandleInfoRef.current;
        const updated = customWallsRef.current.map((w) => {
          if (w.id !== info.wallId) return w;
          if (info.endpoint === "start") {
            return { ...w, startXIn: snapXIn, startYIn: snapZIn };
          } else {
            return { ...w, endXIn: snapXIn, endYIn: snapZIn };
          }
        });
        onChangeCustomWallsRef.current?.(updated);
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      const current = plotRef.current;
      if (dragKind === "roomHandle" && draggedRoomHandleInfoRef.current) {
        const info = draggedRoomHandleInfoRef.current;
        const r = roomsRef.current[info.roomIdx];
        if (r && ghostMesh) {
          let newXIn = info.initialXIn;
          let newYIn = info.initialYIn;
          let newWIn = info.initialWIn;
          let newDIn = info.initialDIn;

          const mouseXIn = Math.round(hitPoint.x * 12);
          const mouseZIn = Math.round(hitPoint.z * 12);
          const MIN_IN = 48; // 4 ft minimum

          if (info.handleType === "E" || info.handleType === "SE") {
            newWIn = Math.max(MIN_IN, mouseXIn - info.initialXIn);
          }
          if (info.handleType === "S" || info.handleType === "SE") {
            newDIn = Math.max(MIN_IN, mouseZIn - info.initialYIn);
          }
          if (info.handleType === "W") {
            const clamped = Math.max(MIN_IN, info.initialXIn + info.initialWIn - mouseXIn);
            newXIn = info.initialXIn + info.initialWIn - clamped;
            newWIn = clamped;
          }
          if (info.handleType === "N") {
            const clamped = Math.max(MIN_IN, info.initialYIn + info.initialDIn - mouseZIn);
            newYIn = info.initialYIn + info.initialDIn - clamped;
            newDIn = clamped;
          }

          const rwFt = inchesToFeet(newWIn);
          const rdFt = inchesToFeet(newDIn);
          const rxFt = inchesToFeet(newXIn);
          const rzFt = inchesToFeet(newYIn);

          ghostMesh.scale.set(rwFt, 1, rdFt);
          ghostMesh.position.set(rxFt + rwFt / 2, WALL_HEIGHT_FT / 2, rzFt + rdFt / 2);
          if (ghostMesh.material instanceof THREE.MeshStandardMaterial) {
            ghostMesh.material.color.setHex(0xf59e0b);
            ghostMesh.material.emissive.setHex(0x663300);
          }
          ghostMesh.visible = true;

          info.currentXIn = newXIn;
          info.currentYIn = newYIn;
          info.currentWIn = newWIn;
          info.currentDIn = newDIn;

          const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
          setDraggedRoomInfo({
            name: label,
            x: rxFt + rwFt / 2,
            z: rzFt + rdFt / 2,
            isCropped: true,
            cropWFt: Math.round(rwFt * 10) / 10,
            cropDFt: Math.round(rdFt * 10) / 10,
          });
        }
      } else if (dragKind === "width") {
        const nextIn = snapToFoot(clampInches(hitPoint.x * 12, MIN_DIM_IN, MAX_DIM_IN));
        if (nextIn !== current.widthIn && onPlotChangeRef.current) {
          onPlotChangeRef.current({ ...current, widthIn: nextIn });
        }
      } else if (dragKind === "depth") {
        const nextIn = snapToFoot(clampInches(hitPoint.z * 12, MIN_DIM_IN, MAX_DIM_IN));
        if (nextIn !== current.depthIn && onPlotChangeRef.current) {
          onPlotChangeRef.current({ ...current, depthIn: nextIn });
        }
      } else if (dragKind === "customObject" && draggedCustomObjectIdRef.current) {
        // Direct Three.js GPU transform with Smart Wall Auto-Positioning
        const objId = draggedCustomObjectIdRef.current;
        const mesh = customObjectMeshesRef.current.get(objId);
        const customObj = (customObjectsRef.current || []).find((o) => o.id === objId);
        const isWall = customObj?.type?.startsWith("wall_");

        let posX = Math.round(hitPoint.x * 2) / 2;
        let posZ = Math.round(hitPoint.z * 2) / 2;
        let rotY: number | undefined = undefined;

        if (isWall) {
          const itemDef = FURNITURE_CATALOG.find((i) => i.type === customObj?.type);
          const wallLen = itemDef?.dimensions.widthFt || 8.0;
          const snap = computeSmartWallSnap(
            hitPoint.x,
            hitPoint.z,
            wallLen,
            roomsRef.current,
            customObjectsRef.current,
            customOpeningsRef.current,
            objId
          );

          if (snap.isSnapped) {
            posX = snap.x;
            posZ = snap.z;
            rotY = snap.rotationY;
            setSmartSnapDescription(snap.snapDescription || "🧲 Attached to Wall");

            if (snapGuideMeshRef.current && snap.guideLine) {
              const points = [
                new THREE.Vector3(snap.guideLine.x1, 0.06, snap.guideLine.z1),
                new THREE.Vector3(snap.guideLine.x2, 0.06, snap.guideLine.z2),
              ];
              snapGuideMeshRef.current.geometry.setFromPoints(points);
              snapGuideMeshRef.current.computeLineDistances();
              snapGuideMeshRef.current.visible = true;
            }
          } else {
            setSmartSnapDescription(null);
            if (snapGuideMeshRef.current) snapGuideMeshRef.current.visible = false;
          }
        }

        if (mesh) {
          mesh.position.set(posX, 0, posZ);
          if (rotY !== undefined) {
            mesh.rotation.y = rotY;
          }
        }
        draggedCustomObjPosRef.current = { x: posX, z: posZ, rotationY: rotY };
      } else if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
        // Direct Three.js ghost transform with real-time boundary auto-cropping
        const rIdx = draggedRoomIdxRef.current;
        const r = roomsRef.current[rIdx];
        if (r) {
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          const rawCornerX = Math.round(hitPoint.x - rw / 2);
          const rawCornerZ = Math.round(hitPoint.z - rd / 2);
          const rawRightX = rawCornerX + rw;
          const rawBottomZ = rawCornerZ + rd;

          const [sbN, sbE, sbS, sbW] = edgeSetbacksIn(facingRef.current, setbackRef.current);
          const envMinX = inchesToFeet(sbW);
          const envMaxX = inchesToFeet(plotRef.current.widthIn - sbE);
          const envMinZ = inchesToFeet(sbN);
          const envMaxZ = inchesToFeet(plotRef.current.depthIn - sbS);

          const cropMinX = Math.max(envMinX, Math.min(rawCornerX, envMaxX - 4));
          const cropMaxX = Math.min(envMaxX, Math.max(rawRightX, envMinX + 4));
          const cropMinZ = Math.max(envMinZ, Math.min(rawCornerZ, envMaxZ - 4));
          const cropMaxZ = Math.min(envMaxZ, Math.max(rawBottomZ, envMinZ + 4));

          const cropWFt = Math.max(4, Math.round((cropMaxX - cropMinX) * 2) / 2);
          const cropDFt = Math.max(4, Math.round((cropMaxZ - cropMinZ) * 2) / 2);
          const isCropped = Math.abs(cropWFt - rw) > 0.1 || Math.abs(cropDFt - rd) > 0.1;

          ghostMesh.scale.set(cropWFt, 1, cropDFt);
          ghostMesh.position.set(cropMinX + cropWFt / 2, WALL_HEIGHT_FT / 2, cropMinZ + cropDFt / 2);

          if (ghostMesh.material instanceof THREE.MeshStandardMaterial) {
            ghostMesh.material.color.setHex(isCropped ? 0xf59e0b : 0x00e5ff);
            ghostMesh.material.emissive.setHex(isCropped ? 0x663300 : 0x006688);
          }

          setDraggedRoomInfo({
            name: r.name,
            x: cropMinX + cropWFt / 2,
            z: cropMinZ + cropDFt / 2,
            isCropped,
            cropWFt,
            cropDFt,
          });
        }
      }
    }

    function onPointerUp(ev: PointerEvent) {
      isDraggingLook.current = false;
      if (snapGuideMeshRef.current) {
        snapGuideMeshRef.current.visible = false;
      }
      setSmartSnapDescription(null);

      // Handle walkthrough mode click-to-select and click-to-place
      if (modeRef.current === "walkthrough") {
        const dist = Math.hypot(
          ev.clientX - pointerDownPosRef.current.x,
          ev.clientY - pointerDownPosRef.current.y
        );
        const timeDiff = performance.now() - pointerDownPosRef.current.time;

        // Forgiving click detection (up to 20px look-drag or 750ms tap)
        if (dist < 20 && timeDiff < 750 && ev.button === 0) {
          // 1. If in placing mode -> drop item into room floor in front of player
          if (placingItemTypeRef.current) {
            setPointerNdc(ev);
            const placePos = getWalkthroughPlacementPoint(pointerNdc);
            const itemDef = FURNITURE_CATALOG.find((i) => i.type === placingItemTypeRef.current);
            const newObj: PlacedCustomObject = {
              id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              type: placingItemTypeRef.current,
              name: itemDef?.name || "Furniture",
              x: Math.round(placePos.x * 2) / 2,
              y: 0,
              z: Math.round(placePos.z * 2) / 2,
              rotationY: playerRef.current.yaw + Math.PI + (placingRotationYRef.current || 0),
              scale: 1.0,
            };
            if (onAddCustomObjectRef.current) {
              onAddCustomObjectRef.current(newObj);
            }
            if (placingGhostGroupRef.current) {
              placingGhostGroupRef.current.visible = false;
            }
            return;
          }

          // 1.5. In walkthrough mode, check if user clicked an interactive door leaf within reaching distance
          setPointerNdc(ev);
          raycaster.setFromCamera(pointerNdc, camera);
          const doorHits = raycaster.intersectObjects(group.children, true);
          for (const hit of doorHits) {
            let cur: THREE.Object3D | null = hit.object;
            while (cur && cur !== group) {
              if (cur.userData && cur.userData.isDoorLeaf && cur.userData.doorId) {
                const targetDoor = interactiveDoorsRef.current.get(cur.userData.doorId);
                if (targetDoor) {
                  const dist = Math.hypot(
                    playerRef.current.x - targetDoor.doorPos.x,
                    playerRef.current.z - targetDoor.doorPos.z
                  );
                  if (dist <= 8.5) {
                    toggleDoor(targetDoor.id);
                    return;
                  }
                }
              }
              cur = cur.parent;
            }
          }

          // 2. Otherwise check object pick from mouse point OR center crosshair
          let hitObj = pickFurnitureObject(ev);
          if (!hitObj) {
            hitObj = pickFurnitureObject(null, new THREE.Vector2(0, 0));
          }

          if (hitObj) {
            if (onSelectObjectRef.current) {
              onSelectObjectRef.current(hitObj);
            }
            return;
          }

          // Clicked empty ground -> deselect
          if (selectedObjectIdRef.current && onSelectObjectRef.current) {
            onSelectObjectRef.current(null);
          }
        }
        return;
      }

      if (dragKind === "customObject" && draggedCustomObjectIdRef.current && draggedCustomObjPosRef.current) {
        const objId = draggedCustomObjectIdRef.current;
        const newX = draggedCustomObjPosRef.current.x;
        const newZ = draggedCustomObjPosRef.current.z;
        const newRotY = draggedCustomObjPosRef.current.rotationY;

        if (onUpdateCustomObjectPosRef.current) {
          onUpdateCustomObjectPosRef.current(objId, newX, newZ, newRotY);
        } else {
          const obj = (customObjectsRef.current || []).find((o) => o.id === objId);
          if (obj && onUpdateCustomObjectRef.current) {
            onUpdateCustomObjectRef.current({
              ...obj,
              x: newX,
              z: newZ,
              ...(newRotY !== undefined ? { rotationY: newRotY } : {}),
            });
          }
        }
      } else if (dragKind === "roomHandle" && draggedRoomHandleInfoRef.current) {
        const info = draggedRoomHandleInfoRef.current;
        const r = roomsRef.current[info.roomIdx];
        if (r && onRoomResizeRef.current) {
          onRoomResizeRef.current(
            info.roomIdx,
            info.currentXIn,
            info.currentYIn,
            info.currentWIn,
            info.currentDIn
          );
          const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
          const wFt = Math.round(inchesToFeet(info.currentWIn) * 10) / 10;
          const dFt = Math.round(inchesToFeet(info.currentDIn) * 10) / 10;
          setDoorAlert(`✂️ ${label} resized to ${wFt}' × ${dFt}' — Auto-connected!`);
          setTimeout(() => setDoorAlert(null), 3500);
        }
        if (ghostMesh) ghostMesh.visible = false;
        draggedRoomHandleInfoRef.current = null;
        setDraggedRoomInfo(null);
      } else if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
        const rIdx = draggedRoomIdxRef.current;
        const r = roomsRef.current[rIdx];
        if (r) {
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          const ghostScaleX = ghostMesh.scale.x;
          const ghostScaleZ = ghostMesh.scale.z;
          const ghostPosX = ghostMesh.position.x;
          const ghostPosZ = ghostMesh.position.z;

          const cornerXFt = ghostPosX - ghostScaleX / 2;
          const cornerZFt = ghostPosZ - ghostScaleZ / 2;

          const isCropped = Math.abs(ghostScaleX - rw) > 0.1 || Math.abs(ghostScaleZ - rd) > 0.1;

          if (isCropped && onRoomResizeRef.current) {
            const targetXIn = Math.max(0, Math.round(cornerXFt * 12));
            const targetYIn = Math.max(0, Math.round(cornerZFt * 12));
            const targetWIn = Math.max(48, Math.round(ghostScaleX * 12));
            const targetDIn = Math.max(48, Math.round(ghostScaleZ * 12));
            onRoomResizeRef.current(rIdx, targetXIn, targetYIn, targetWIn, targetDIn);

            const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
            setDoorAlert(`✂️ ${label} cropped to ${ghostScaleX.toFixed(1)}' × ${ghostScaleZ.toFixed(1)}' — Auto-connected!`);
            setTimeout(() => setDoorAlert(null), 3500);
          } else if (onRoomMoveRef.current) {
            const targetXIn = Math.max(0, Math.round(cornerXFt * 12));
            const targetYIn = Math.max(0, Math.round(cornerZFt * 12));
            onRoomMoveRef.current(rIdx, targetXIn, targetYIn);

            const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
            setDoorAlert(`🚪 ${label} repositioned — Door automatically connected!`);
            setTimeout(() => setDoorAlert(null), 3000);
          }
        }
        ghostMesh.visible = false;
        draggedRoomIdxRef.current = null;
        setDraggedRoomInfo(null);
      }

      if (dragKind) {
        dragKind = null;
        draggedCustomObjectIdRef.current = null;
        controls.enabled = true;
      }
    }

    const toggleDoor = (doorId?: string) => {
      let targetDoor: InteractiveDoorItem | undefined;
      if (doorId) {
        targetDoor = interactiveDoorsRef.current.get(doorId);
      } else if (activeNearDoorRef.current) {
        targetDoor = activeNearDoorRef.current;
      }
      if (!targetDoor) return;

      targetDoor.isOpen = !targetDoor.isOpen;
      targetDoor.targetAngle = targetDoor.isOpen ? (targetDoor.swingSign * Math.PI) / 2.05 : 0;

      // Update doorway obstacle in collision engine
      const obs = sceneObstaclesRef.current.find((o) => o.id === targetDoor!.id && o.isDoor);
      if (obs) {
        obs.isOpen = targetDoor.isOpen;
      }

      const prompt = {
        doorId: targetDoor.id,
        label: targetDoor.label,
        isOpen: targetDoor.isOpen,
      };
      doorPromptRef.current = prompt;
      if (onNearestDoorChangeRef.current) {
        onNearestDoorChangeRef.current(prompt);
      }

      setDoorAlert(`🚪 ${targetDoor.label} ${targetDoor.isOpen ? "Opened" : "Closed"}`);
      setTimeout(() => setDoorAlert(null), 2500);
    };
    toggleDoorRef.current = toggleDoor;

    function onKeyDown(ev: KeyboardEvent) {
      keysPressed.current[ev.code] = true;
      if (ev.code === "KeyF" && onToggleLightsRef.current && modeRef.current === "walkthrough") {
        onToggleLightsRef.current();
      }
      if (ev.code === "Space" && !isJumping.current && modeRef.current === "walkthrough") {
        jumpVelocityY.current = 10.0;
        isJumping.current = true;
      }
      // 'E' Key: Interact / Open or Close door (if near one), or inspect crosshair object
      if (ev.code === "KeyE" && modeRef.current === "walkthrough") {
        if (activeNearDoorRef.current) {
          toggleDoor(activeNearDoorRef.current.id);
          return;
        }
        const hitObj = pickFurnitureObject(null, new THREE.Vector2(0, 0));
        if (hitObj && onSelectObjectRef.current) {
          onSelectObjectRef.current(hitObj);
        }
      }
      // Delete / Backspace: Delete selected object immediately
      if ((ev.code === "Delete" || ev.code === "Backspace") && selectedObjectIdRef.current) {
        if (onRequestDeleteRef.current) {
          onRequestDeleteRef.current();
        }
      }
      // 'R' Key: Rotate selected object or placing ghost
      if (ev.code === "KeyR") {
        if (placingItemTypeRef.current && onRotatePlacingRef.current) {
          onRotatePlacingRef.current(Math.PI / 4);
        } else if (selectedObjectIdRef.current && onRotateSelectedRef.current) {
          onRotateSelectedRef.current(Math.PI / 4);
        }
      }
      // 'L' Key: Toggle 3D Orbit Layout Lock
      if (ev.code === "KeyL" && onToggleLayoutLockRef.current) {
        onToggleLayoutLockRef.current();
      }
      // 'P' Key: Toggle Real-Time GPU Path Tracer
      if (ev.code === "KeyP" && onToggleRaytraceRef.current) {
        onToggleRaytraceRef.current();
      }
      // Escape: Deselect or cancel placement or draft wall
      if (ev.code === "Escape") {
        if (isRaytracingRef.current && onToggleRaytraceRef.current) {
          onToggleRaytraceRef.current();
        }
        draftWallStartFtRef.current = null;
        setDraftWallStartFt(null);
        setDrafting3DDescription(null);
        if (draftGhost3DWallRef.current) {
          draftGhost3DWallRef.current.visible = false;
        }
        if (onSelectObjectRef.current) {
          onSelectObjectRef.current(null);
        }
      }

    }

    function onKeyUp(ev: KeyboardEvent) {
      keysPressed.current[ev.code] = false;
    }

    function onWheel(ev: WheelEvent) {
      if (placingItemTypeRef.current && onRotatePlacingRef.current) {
        ev.preventDefault();
        const delta = (ev.deltaY > 0 ? 1 : -1) * (Math.PI / 8);
        onRotatePlacingRef.current(delta);
      }
    }

    function onDragOver(ev: DragEvent) {
      ev.preventDefault();
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = "copy";
      }
    }

    function onDrop(ev: DragEvent) {
      ev.preventDefault();
      const files = ev.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file.name.toLowerCase().endsWith(".glb") || file.name.toLowerCase().endsWith(".gltf")) {
        const raycaster = new THREE.Raycaster();
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersectPoint);

        const newId = "custom_glb_" + Date.now();
        const blobUrl = URL.createObjectURL(file);
        const newObj: PlacedCustomObject = {
          id: newId,
          type: "custom_3d_model",
          name: file.name.replace(/\.[^/.]+$/, ""),
          x: Math.round((intersectPoint.x || 10) * 10) / 10,
          y: 0,
          z: Math.round((intersectPoint.z || 10) * 10) / 10,
          rotationY: 0,
          scale: 1.0,
          glbUrl: blobUrl,
        };

        if (onAddCustomObjectRef.current) {
          onAddCustomObjectRef.current(newObj);
        }
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("dragover", onDragOver);
    renderer.domElement.addEventListener("drop", onDrop);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);


    // Animation & Physics Loop
    let frameId = 0;
    let lastTime = performance.now();

    function animate(currentTime: number) {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      fanBladesRef.current.forEach((fan) => {
        if (modeRef.current === "walkthrough" && fan.parent && !fan.parent.visible) {
          return;
        }
        fan.rotation.y += 4.2 * dt;
      });

      if (modeRef.current === "walkthrough") {
        controls.enabled = false;
        const p = playerRef.current;
        const keys = keysPressed.current;
        const cmd = activeMoveCmdRef.current;

        // Animate all interactive hinged doors smoothly
        for (const door of interactiveDoorsRef.current.values()) {
          if (Math.abs(door.currentAngle - door.targetAngle) > 0.001) {
            door.currentAngle += (door.targetAngle - door.currentAngle) * Math.min(1.0, 9.0 * dt);
            door.group.rotation.y = door.currentAngle;
          }
        }

        // Proximity detection for nearest interactive door
        let closestDoor: InteractiveDoorItem | null = null;
        let closestDist = 6.0;
        for (const door of interactiveDoorsRef.current.values()) {
          const dist = Math.hypot(p.x - door.doorPos.x, p.z - door.doorPos.z);
          if (dist < closestDist) {
            closestDist = dist;
            closestDoor = door;
          }
        }
        activeNearDoorRef.current = closestDoor;
        const currentPrompt = closestDoor
          ? { doorId: closestDoor.id, label: closestDoor.label, isOpen: closestDoor.isOpen }
          : null;
        if (
          currentPrompt?.doorId !== doorPromptRef.current?.doorId ||
          currentPrompt?.isOpen !== doorPromptRef.current?.isOpen
        ) {
          doorPromptRef.current = currentPrompt;
          if (onNearestDoorChangeRef.current) {
            onNearestDoorChangeRef.current(currentPrompt);
          }
        }

        const isSprinting = Boolean(keys["ShiftLeft"] || keys["ShiftRight"] || cmd === "sprint");
        const isCrouched = Boolean(keys["KeyC"] || cmd === "crouch");

        let moveForward = 0;
        let moveStrafe = 0;
        let turn = 0;

        if (keys["KeyW"] || keys["ArrowUp"] || cmd === "forward") moveForward += 1;
        if (keys["KeyS"] || keys["ArrowDown"] || cmd === "backward") moveForward -= 1;
        if (keys["KeyA"] || cmd === "left") moveStrafe -= 1;
        if (cmd === "turnLeft") turn += 1;
        if (cmd === "turnRight") turn -= 1;
        if (cmd === "jump" && !isJumping.current) {
          jumpVelocityY.current = 10.0;
          isJumping.current = true;
        }

        if (turn !== 0) {
          p.yaw += turn * ROTATE_SPEED_RAD * dt;
        }

        const isMoving = moveForward !== 0 || moveStrafe !== 0;
        const baseSpeed = isCrouched
          ? WALK_SPEED_FPS * 0.55
          : isSprinting
          ? SPRINT_SPEED_FPS
          : WALK_SPEED_FPS;

        if (isMoving) {
          const moveLen = Math.hypot(moveForward, moveStrafe) || 1;
          const forwardNorm = moveForward / moveLen;
          const strafeNorm = moveStrafe / moveLen;

          const sinY = Math.sin(p.yaw);
          const cosY = Math.cos(p.yaw);

          const forwardX = -sinY;
          const forwardZ = -cosY;
          const rightX = cosY;
          const rightZ = -sinY;

          const deltaX = (forwardX * forwardNorm + rightX * strafeNorm) * baseSpeed * dt;
          const deltaZ = (forwardZ * forwardNorm + rightZ * strafeNorm) * baseSpeed * dt;

          const nextPos = {
            x: p.x + deltaX,
            y: p.y,
            z: p.z + deltaZ,
          };

          const clamped = clampPlayerPosition(nextPos, plotRef.current);
          const resolved = resolvePlayerMovement(
            p.x,
            p.z,
            clamped.x,
            clamped.z,
            PLAYER_COLLISION_RADIUS,
            sceneObstaclesRef.current
          );
          p.x = resolved.x;
          p.z = resolved.z;

          const bobFreq = isSprinting ? 12.0 : 8.5;
          bobTimer.current += dt * bobFreq;
        } else {
          bobTimer.current *= 0.85;
        }

        const targetEyeLevel = isCrouched ? CROUCH_HEIGHT_FT : EYE_LEVEL_FT;
        const bobAmount = isMoving ? Math.sin(bobTimer.current) * (isSprinting ? 0.09 : 0.065) : 0;
        const swayAmount = isMoving ? Math.cos(bobTimer.current * 0.5) * 0.005 : 0;

        let jumpOffset = 0;
        if (isJumping.current) {
          p.y += jumpVelocityY.current * dt;
          jumpVelocityY.current -= 28.0 * dt;
          if (p.y <= targetEyeLevel) {
            p.y = targetEyeLevel;
            isJumping.current = false;
            jumpVelocityY.current = 0;
          }
          jumpOffset = p.y - targetEyeLevel;
        }

        const effectiveCameraY = targetEyeLevel + bobAmount + jumpOffset;

        camera.position.set(p.x, effectiveCameraY, p.z);
        const lookTarget = new THREE.Vector3(
          p.x - Math.sin(p.yaw + swayAmount) * Math.cos(p.pitch),
          effectiveCameraY + Math.sin(p.pitch),
          p.z - Math.cos(p.yaw + swayAmount) * Math.cos(p.pitch)
        );
        camera.lookAt(lookTarget);

        const targetFov = isSprinting ? 75 : 68;
        camera.fov += (targetFov - camera.fov) * 0.1;
        camera.updateProjectionMatrix();

        // Metaheuristic Topological Cell & Portal Occlusion Culling
        const detected = detectCurrentRoom(p.x, p.z, roomsRef.current);
        const pvs = computePotentiallyVisibleRooms(
          detected?.index ?? null,
          roomsRef.current.length,
          roomDoorwaysRef.current,
          2
        );

        roomGroupsRef.current.forEach((rg, roomIdx) => {
          const isVis = pvs.has(roomIdx);
          if (rg.visible !== isVis) {
            rg.visible = isVis;
          }
          const lights = roomLightsByRoomRef.current.get(roomIdx) || [];
          lights.forEach((l) => {
            l.visible = isVis && lightsOnRef.current;
          });
        });

        if (onPlayerUpdateRef.current) {
          const now = performance.now();
          const distMoved = Math.hypot(
            p.x - lastReportedPos.current.x,
            p.z - lastReportedPos.current.z
          );
          const yawDiff = Math.abs(p.yaw - lastReportedPos.current.yaw);

          // Throttle React state updates to 12 FPS or on movement to eliminate 60 FPS React re-renders
          if (now - lastPlayerReportTime.current > 80 || distMoved > 0.15 || yawDiff > 0.08) {
            lastPlayerReportTime.current = now;
            lastReportedPos.current = { x: p.x, z: p.z, yaw: p.yaw };

            if (isRaytracingRef.current && pathTracerRef.current && isPathTracerReadyRef.current) {
              pathTracerRef.current.updateCamera();
              pathTracerRef.current.reset();
              setRaytraceSamples(0);
            }

            onPlayerUpdateRef.current({
              ...p,
              y: effectiveCameraY,
              isSprinting,
              isCrouched,
              isMoving,
              lightsOn: lightsOnRef.current,
            });
          }
        }
      } else {
        controls.enabled = true;
        controls.update();

        // In Orbit mode, ensure all rooms and active lights are rendered
        roomGroupsRef.current.forEach((rg, roomIdx) => {
          if (!rg.visible) rg.visible = true;
          const lights = roomLightsByRoomRef.current.get(roomIdx) || [];
          lights.forEach((l) => {
            l.visible = lightsOnRef.current;
          });
        });
      }

      // Real-Time Performance Tracking for HUD
      const nowMs = performance.now();
      fpsFrames.current++;
      if (nowMs - lastFpsUpdate.current >= 400) {
        const measuredFps = Math.round((fpsFrames.current * 1000) / (nowMs - lastFpsUpdate.current));
        const measuredFrameTime = +((nowMs - lastFpsUpdate.current) / fpsFrames.current).toFixed(1);
        setCurrentFps(measuredFps);
        setCurrentFrameTime(measuredFrameTime);
        fpsFrames.current = 0;
        lastFpsUpdate.current = nowMs;
      }

      // Real-Time GPU Path Tracer execution or standard WebGL rasterizer
      if (isRaytracingRef.current && pathTracerRef.current && isPathTracerReadyRef.current) {
        const pt = pathTracerRef.current;
        if (pt.samples < targetSamplesRef.current) {
          pt.renderSample();
          if (pt.samples % 2 === 0 || pt.samples >= targetSamplesRef.current) {
            setRaytraceSamples(pt.samples);
          }
        }
      } else if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("dragover", onDragOver);
      renderer.domElement.removeEventListener("drop", onDrop);
      window.removeEventListener("pointermove", onPointerMove);

      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.dispose();
      composerRef.current?.dispose();
      composerRef.current = null;
      gtaoPassRef.current = null;
      envMapsRef.current.day?.dispose();
      envMapsRef.current.night?.dispose();
      envMapsRef.current = { day: null, night: null };
      scene.environment = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    };
  }, []);

  // Mode Transition Handler (Orbit <-> Walkthrough)
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Roof on inside, off outside: a slab is what makes first person feel like a building,
    // and exactly what stops orbit from showing the plan.
    if (roofGroupRef.current) {
      roofGroupRef.current.visible = mode === "walkthrough";
    }

    if (!camera || !controls) return;

    if (mode === "walkthrough") {
      savedOrbitCamPos.current.copy(camera.position);
      savedOrbitTarget.current.copy(controls.target);

      const spawn = getSpawnPosition(rooms, plot, facing);
      playerRef.current = {
        x: spawn.x,
        y: EYE_LEVEL_FT,
        z: spawn.z,
        yaw: spawn.yaw,
        pitch: -0.06,
      };

      if (widthHandleRef.current) widthHandleRef.current.visible = false;
      if (depthHandleRef.current) depthHandleRef.current.visible = false;
      if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = false;
    } else {
      const wFt = inchesToFeet(plot.widthIn);
      const dFt = inchesToFeet(plot.depthIn);
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const r of rooms) {
        const rx = inchesToFeet(r.x_in);
        const rz = inchesToFeet(r.y_in);
        const rw = inchesToFeet(r.w_in);
        const rd = inchesToFeet(r.d_in);
        minX = Math.min(minX, rx);
        maxX = Math.max(maxX, rx + rw);
        minZ = Math.min(minZ, rz);
        maxZ = Math.max(maxZ, rz + rd);
      }
      const hX = isFinite(minX) && isFinite(maxX) ? (minX + maxX) / 2 : wFt / 2;
      const hZ = isFinite(minZ) && isFinite(maxZ) ? (minZ + maxZ) / 2 : dFt / 2;
      const houseCenter = new THREE.Vector3(hX, WALL_HEIGHT_FT * 0.4, hZ);
      controls.target.copy(houseCenter);

      if (savedOrbitCamPos.current.lengthSq() > 0) {
        const dir = savedOrbitCamPos.current.clone().sub(savedOrbitTarget.current).normalize();
        if (dir.lengthSq() < 1e-6) dir.set(1, 1.2, 1.4).normalize();
        const houseRad = isFinite(minX) && isFinite(maxX) ? Math.max(Math.hypot(maxX - minX, maxZ - minZ) / 2, WALL_HEIGHT_FT * 1.5) : wFt;
        const fovRad = (camera.fov * Math.PI) / 180;
        const dist = (houseRad * 1.35) / Math.sin(fovRad / 2);
        camera.position.copy(houseCenter).addScaledVector(dir, dist);
      }
      controls.update();

      if (widthHandleRef.current) widthHandleRef.current.visible = !isLayoutLockedRef.current;
      if (depthHandleRef.current) depthHandleRef.current.visible = !isLayoutLockedRef.current;
      if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = !isLayoutLockedRef.current;
    }
  }, [mode, rooms, plot, facing]);

  // Dynamic Graphics Controls Live Re-Binding (Resolution Scale, Shadows, Exposure, Tone Mapping)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !graphicsSettings) return;

    // 1. Dynamic Resolution Scale / Super-Sampling
    const targetDPR = Math.min(window.devicePixelRatio * (graphicsSettings.renderScale || 1.0), 3.5);
    renderer.setPixelRatio(targetDPR);
    composerRef.current?.setPixelRatio(targetDPR);

    if (mountRef.current) {
      const w = Math.round(mountRef.current.clientWidth * targetDPR);
      const h = Math.round(mountRef.current.clientHeight * targetDPR);
      setRenderRes(`${w} × ${h}`);
    }

    // 2. Dynamic Tone Mapping & Exposure
    if (graphicsSettings.toneMapping === "aces_filmic") {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else if (graphicsSettings.toneMapping === "reinhard") {
      renderer.toneMapping = THREE.ReinhardToneMapping;
    } else if (graphicsSettings.toneMapping === "cineon") {
      renderer.toneMapping = THREE.CineonToneMapping;
    } else {
      renderer.toneMapping = THREE.LinearToneMapping;
    }
    renderer.toneMappingExposure = graphicsSettings.exposure ?? 1.15;

    // 3. Dynamic Shadow Quality. The Low / Eco preset turns shadows off to buy back frames, and
    // occlusion is the other per-frame cost in the same class, so it follows the same switch
    // rather than growing a control of its own — see the note above GraphicsSettings about
    // settings that were never wired to anything.
    if (gtaoPassRef.current) {
      gtaoPassRef.current.enabled = graphicsSettings.shadowQuality !== "off";
    }

    if (sunLightRef.current) {
      const shadowRes = getShadowMapResolution(graphicsSettings.shadowQuality);
      if (shadowRes > 0) {
        sunLightRef.current.castShadow = true;
        sunLightRef.current.shadow.mapSize.width = shadowRes;
        sunLightRef.current.shadow.mapSize.height = shadowRes;
        if (sunLightRef.current.shadow.map) {
          sunLightRef.current.shadow.map.dispose();
          sunLightRef.current.shadow.map = null;
        }
      } else {
        sunLightRef.current.castShadow = false;
      }
    }

    // 4. Invalidate and clear texture cache so high-resolution 4K procedural textures are generated
    clearTextureCache();
  }, [graphicsSettings]);

  // Teleport Target Handler
  useEffect(() => {
    if (!teleportTarget) return;
    const p = playerRef.current;
    const clamped = clampPlayerPosition(
      { x: teleportTarget.x, y: EYE_LEVEL_FT, z: teleportTarget.z },
      plot
    );
    p.x = clamped.x;
    p.z = clamped.z;
  }, [teleportTarget, plot]);

  // Orbit Camera Centering on HOUSE CENTER
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || modeRef.current === "walkthrough") return;

    const wFt = inchesToFeet(plot.widthIn);
    const dFt = inchesToFeet(plot.depthIn);
    const edgesIn = edgeSetbacksIn(facing, setback);
    const [nIn, eIn, sIn, wIn] = edgesIn;
    const envMinX = inchesToFeet(wIn);
    const envMaxX = wFt - inchesToFeet(eIn);
    const envMinZ = inchesToFeet(nIn);
    const envMaxZ = dFt - inchesToFeet(sIn);

    let houseCenterX: number;
    let houseCenterZ: number;
    let houseRadius: number;

    if (rooms.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const r of rooms) {
        const rx = inchesToFeet(r.x_in);
        const rz = inchesToFeet(r.y_in);
        const rw = inchesToFeet(r.w_in);
        const rd = inchesToFeet(r.d_in);
        minX = Math.min(minX, rx);
        maxX = Math.max(maxX, rx + rw);
        minZ = Math.min(minZ, rz);
        maxZ = Math.max(maxZ, rz + rd);
      }
      houseCenterX = isFinite(minX) && isFinite(maxX) ? (minX + maxX) / 2 : wFt / 2;
      houseCenterZ = isFinite(minZ) && isFinite(maxZ) ? (minZ + maxZ) / 2 : dFt / 2;
      houseRadius = isFinite(minX) && isFinite(maxX)
        ? Math.max(Math.hypot(maxX - minX, maxZ - minZ) / 2, WALL_HEIGHT_FT * 1.5)
        : Math.max(Math.hypot(envMaxX - envMinX, envMaxZ - envMinZ) / 2, WALL_HEIGHT_FT * 1.5);
    } else {
      houseCenterX = (envMinX + envMaxX) / 2;
      houseCenterZ = (envMinZ + envMaxZ) / 2;
      houseRadius = Math.max(Math.hypot(envMaxX - envMinX, envMaxZ - envMinZ) / 2, WALL_HEIGHT_FT * 1.5);
    }

    const houseCenter = new THREE.Vector3(houseCenterX, WALL_HEIGHT_FT * 0.4, houseCenterZ);
    controls.target.copy(houseCenter);

    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 1.2, 1.4);
    dir.normalize();

    const fovRad = (camera.fov * Math.PI) / 180;
    const dist = (houseRadius * 1.35) / Math.sin(fovRad / 2);
    camera.position.copy(houseCenter).addScaledVector(dir, dist);
    controls.update();
  }, [plot, facing, setback, rooms]);

  // Sync effect: Rebuild Architectural 3D Geometry
  useEffect(() => {
    const group = groupRef.current;
    const widthHandle = widthHandleRef.current;
    const depthHandle = depthHandleRef.current;
    if (!group || !widthHandle || !depthHandle) return;

    fanBladesRef.current = [];
    roomLightsRef.current = [];
    roomGroupsRef.current.clear();
    roomLightsByRoomRef.current.clear();
    customObjectMeshesRef.current.clear();
    sceneObstaclesRef.current = [];
    interactiveDoorsRef.current.clear();
    activeNearDoorRef.current = null;
    doorPromptRef.current = null;

    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite || child instanceof THREE.PointLight || child instanceof THREE.Group) {
        if ("geometry" in child && child.geometry) child.geometry.dispose();
        if ("material" in child && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m.dispose());
        }
      }
    });
    group.clear();

    const wFt = inchesToFeet(plot.widthIn);
    const dFt = inchesToFeet(plot.depthIn);
    const edgesIn = edgeSetbacksIn(facing, setback);
    const [nIn, eIn, sIn, wIn] = edgesIn;
    const envMinX = inchesToFeet(wIn);
    const envMaxX = wFt - inchesToFeet(eIn);
    const envMinZ = inchesToFeet(nIn);
    const envMaxZ = dFt - inchesToFeet(sIn);

    // 1. Plot Boundary
    const plotShape = new THREE.PlaneGeometry(wFt, dFt);
    const plotMesh = new THREE.Mesh(
      plotShape,
      new THREE.MeshStandardMaterial({
        // Lawn by day, dark slate by night. Read from the ref rather than the prop because this
        // effect rebuilds on the plan, not on the light switch — the day/night effect keeps it
        // in step after that.
        color: lightsOnRef.current ? DAY_PLOT_COLOR : NIGHT_PLOT_COLOR,
        map: getLawnDetailTexture(),
        roughness: lightsOnRef.current ? 0.96 : 0.9,
        metalness: lightsOnRef.current ? 0.0 : 0.1,
        side: THREE.DoubleSide,
      })
    );
    plotMesh.rotation.x = -Math.PI / 2;
    plotMesh.position.set(wFt / 2, 0, dFt / 2);
    plotMesh.receiveShadow = true;
    group.add(plotMesh);
    plotMeshRef.current = plotMesh;

    // Planting bed, shrubs and driveway on the strip between the boundary and the building.
    // Derived from the same setback the solver honoured, so it can never eat into the envelope,
    // and skipped outright when the setback is too tight to plant.
    addSiteLandscape(group, {
      widthFt: wFt,
      depthFt: dFt,
      envMinX,
      envMaxX,
      envMinZ,
      envMaxZ,
      entranceEdge: getPrimaryCardinalEdge(facing),
    });

    const plotOutline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.02, 0),
        new THREE.Vector3(wFt, 0.02, 0),
        new THREE.Vector3(wFt, 0.02, dFt),
        new THREE.Vector3(0, 0.02, dFt),
      ]),
      new THREE.LineBasicMaterial({ color: PLOT_COLOR, opacity: 0.85, transparent: true })
    );
    group.add(plotOutline);

    // 2. Setback Envelope Line
    if (envMaxX > envMinX && envMaxZ > envMinZ) {
      const dashedGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(envMinX, 0.03, envMinZ),
        new THREE.Vector3(envMaxX, 0.03, envMinZ),
        new THREE.Vector3(envMaxX, 0.03, envMaxZ),
        new THREE.Vector3(envMinX, 0.03, envMaxZ),
        new THREE.Vector3(envMinX, 0.03, envMinZ),
      ]);
      const dashedLine = new THREE.Line(
        dashedGeom,
        new THREE.LineDashedMaterial({ color: ACCENT, dashSize: 1, gapSize: 0.6 })
      );
      dashedLine.computeLineDistances();
      group.add(dashedLine);
    }

    // 3. Materials
    const baseboardMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1b18,
      roughness: 0.5,
    });
    const doorFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b1e16,
      roughness: 0.45,
    });
    const mainEntranceFrameMat = new THREE.MeshStandardMaterial({
      color: 0x18120d,
      roughness: 0.35,
    });
    const goldHardwareMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.2,
      metalness: 0.9,
    });

    // 4. Find Circulation Hub (Hall or fallback room 0)
    const hallIdx = rooms.findIndex((r) => r.name === "hall");
    const hubIndex = hallIdx >= 0 ? hallIdx : 0;

    const assignedDoorways: Doorway[] = [];
    let entranceRoomIndex = -1;
    let chosenEntranceEdge: "N" | "S" | "E" | "W" = getPrimaryCardinalEdge(facing);
    // Where the front door actually sits. Null when the solver sent no entrance opening and the
    // edge is only a guess from the facing — then the widest exterior segment takes it.
    let entranceCenterFt: number | null = null;
    let entranceWidthFt = DOOR_WIDTH_FT + 0.4;

    rooms.forEach((r, i) => {
      for (const o of r.openings ?? []) {
        if (o.kind === "entrance") {
          entranceRoomIndex = i;
          chosenEntranceEdge = o.edge;
          entranceCenterFt = openingCentreFt(r, o);
          entranceWidthFt = o.width_in > 0 ? inchesToFeet(o.width_in) : DOOR_WIDTH_FT + 0.4;
        } else if (o.kind === "door" && o.to_room != null && o.to_room > i) {
          const roomAHasOpening = (r.openings ?? []).some((op) => op.kind === "opening" && op.edge === o.edge);
          const roomB = rooms[o.to_room];
          const oppEdge = oppositeEdge[o.edge];
          const roomBHasOpening = (roomB?.openings ?? []).some((op) => op.kind === "opening" && op.edge === oppEdge);

          if (!roomAHasOpening && !roomBHasOpening) {
            assignedDoorways.push({
              roomAIndex: i,
              roomBIndex: o.to_room,
              edgeA: o.edge,
              edgeB: oppEdge,
              center: openingCentreFt(r, o),
              widthFt: o.width_in > 0 ? inchesToFeet(o.width_in) : DOOR_WIDTH_FT,
            });
          }
        }
      }
    });

    // Also discover touching adjacent rooms and ensure an interior doorway connects them if not already assigned
    rooms.forEach((r1, i) => {
      (["N", "S", "E", "W"] as const).forEach((edge) => {
        const adj = findAdjacentRoomEdge(rooms, i, edge);
        if (!adj || adj.adjIndex <= i) return;
        const j = adj.adjIndex;
        const r2 = rooms[j];
        const oppEdge = adj.adjEdge;

        // Check if either room has demolished the wall for open-concept
        const r1Open = (r1.openings ?? []).some((o) => o.kind === "opening" && o.edge === edge);
        const r2Open = (r2.openings ?? []).some((o) => o.kind === "opening" && o.edge === oppEdge);
        if (r1Open || r2Open) return;

        // Check if doorway already exists between these two rooms
        const exists = assignedDoorways.some(
          (d) => (d.roomAIndex === i && d.roomBIndex === j) || (d.roomAIndex === j && d.roomBIndex === i)
        );
        if (!exists) {
          // Calculate the shared wall contact interval
          let sharedCenterFt: number;
          let sharedRunFt: number;
          if (edge === "N" || edge === "S") {
            const minX = Math.max(r1.x_in, r2.x_in);
            const maxX = Math.min(r1.x_in + r1.w_in, r2.x_in + r2.w_in);
            sharedCenterFt = inchesToFeet((minX + maxX) / 2);
            sharedRunFt = inchesToFeet(maxX - minX);
          } else {
            const minZ = Math.max(r1.y_in, r2.y_in);
            const maxZ = Math.min(r1.y_in + r1.d_in, r2.y_in + r2.d_in);
            sharedCenterFt = inchesToFeet((minZ + maxZ) / 2);
            sharedRunFt = inchesToFeet(maxZ - minZ);
          }

          assignedDoorways.push({
            roomAIndex: i,
            roomBIndex: j,
            edgeA: edge,
            edgeB: oppEdge,
            center: sharedCenterFt,
            widthFt: Math.min(DOOR_WIDTH_FT, sharedRunFt),
          });
        }
      });
    });

    // Save topological doorways for metaheuristic PVS occlusion graph culling
    roomDoorwaysRef.current = assignedDoorways.map((d) => ({
      roomAIndex: d.roomAIndex,
      roomBIndex: d.roomBIndex,
    }));

    const windowOn = (i: number, edge: "N" | "S" | "E" | "W") =>
      (rooms[i].openings ?? []).find((o) => o.kind === "window" && o.edge === edge);

    const slabMat = new THREE.MeshStandardMaterial({ color: 0xb8b3aa, roughness: 0.92 });
    const SLAB_T = 0.55;
    const PARAPET_H = 3.2;

    // 6. Build Architectural Rooms (Organized as Per-Room Sub-Graphs for $O(1)$ Culling)
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const rw = inchesToFeet(room.w_in);
      const rd = inchesToFeet(room.d_in);
      const rx = inchesToFeet(room.x_in);
      const rz = inchesToFeet(room.y_in);
      const isHub = i === hubIndex;

      const roomGroup = new THREE.Group();

      // Floor Mesh (Customized via Material & Finishes Studio & Texture Smoothness)
      // The floor is whatever the config says, full stop. Upgrade mode used to force chevron
      // parquet onto the hall, dining and foyer here, which meant picking a floor in the
      // Finishes panel changed every room except those — the panel sets `globalFloor` and clears
      // `roomFloors`, and this override beat both. The chevron reception floor is now seeded
      // into DEFAULT_MATERIAL_CONFIG.roomFloors instead: same look out of the box, visible in
      // the UI, and cleared the moment the user picks anything.
      const floorId =
        materialConfigRef.current.roomFloors?.[room.name as RoomName] ||
        materialConfigRef.current.globalFloor;
      const floorMatDef = FLOOR_MATERIALS.find((f) => f.id === floorId) || getRoomFloorMaterial(room.name as RoomName, materialConfigRef.current);
      const res = graphicsSettingsRef.current
        ? getTextureResolution(graphicsSettingsRef.current.textureQuality)
        : (materialConfigRef.current.textureResolution || 2048);
      const aniso = graphicsSettingsRef.current
        ? graphicsSettingsRef.current.anisotropicFiltering
        : (materialConfigRef.current.anisotropicFiltering || 16);
      const floorTexture = getFloorTexture(floorMatDef.id, res, aniso);
      const floorNormalMap = getFloorNormalMap(floorMatDef.id, res, aniso);
      const floorRoughnessMap = getFloorRoughnessMap(floorMatDef.id, res, aniso);

      const effectiveFloorRoughness = getEffectiveFloorRoughness(floorMatDef.roughness, materialConfigRef.current);

      const floorGeom = new THREE.PlaneGeometry(rw, rd);
      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTexture,
        normalMap: floorNormalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughnessMap: floorRoughnessMap,
        // A roughness map can only scale the material's value down, so when one is present the
        // scalar carries the headroom the grout lines need and the map returns the polished
        // face to the roughness the finish actually asked for.
        roughness: floorRoughnessMap
          ? Math.min(1, effectiveFloorRoughness * ROUGHNESS_MAP_HEADROOM)
          : effectiveFloorRoughness,
        metalness: floorMatDef.metalness,
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(rx + rw / 2, 0.04, rz + rd / 2);
      floorMesh.receiveShadow = true;
      roomGroup.add(floorMesh);

      // Wall Materials & Textures (Customized via Material & Finishes Studio & Smoothness)
      const wallColorHex = getRoomWallColorHex(room.name as RoomName, materialConfigRef.current);
      const wallTextureId = getRoomWallTextureId(room.name as RoomName, materialConfigRef.current);
      const wallNormalMap = getWallNormalMap(wallTextureId, res, aniso);

      const baseWallRoughness =
        wallTextureId === "wood_slat"
          ? 0.45
          : wallTextureId === "venetian_stucco"
          ? 0.65
          : 0.82;
      const effectiveWallRoughness = getEffectiveWallRoughness(baseWallRoughness, materialConfigRef.current);
      // Same smoothness curve the bump scale used, read at unit depth: a normal map carries
      // the relief itself, so all this has to supply is how far to lean on it.
      const wallRelief = getEffectiveWallBumpScale(1.0, materialConfigRef.current);

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: wallColorHex,
        normalMap: wallNormalMap,
        normalScale: new THREE.Vector2(wallRelief, wallRelief),
        roughness: effectiveWallRoughness,
        metalness: 0.02,
      });

      // Door Frame & Entrance Materials (Customized via Door Colors & Color Wheel)
      const roomDoorColorHex = resolveDoorColorHex(
        materialConfigRef.current.roomDoorColors?.[room.name as RoomName] ||
        materialConfigRef.current.globalDoorColor
      );
      const roomDoorFrameMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(roomDoorColorHex),
        roughness: 0.45,
      });
      const roomMainEntranceMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(roomDoorColorHex).multiplyScalar(0.85),
        roughness: 0.35,
      });

      // Wall Builder
      /**
       * Lay paint bands over the pieces a wall was just built from.
       *
       * Bands are a finish, so nothing above this line changes: the wall is built exactly as it
       * always was, openings and all, and each finished piece then gets thin coloured panels on
       * both faces. Painting per piece rather than per wall is what keeps a band from floating
       * across a doorway — the piece it is clipped to already stops at the opening.
       *
       * Band spans are measured over the WHOLE wall (its full height, or its full run along the
       * room), not over the piece, so a dado line stays level as it crosses either side of a door.
       */
      const paintWallBands = (
        pieces: THREE.Object3D[],
        edge: "N" | "S" | "E" | "W",
        isEW: boolean
      ) => {
        const scheme = resolveWallBandScheme(
          materialConfigRef.current,
          roomInstanceId(rooms, i),
          room.name as RoomName,
          edge
        );
        const bands = resolveBands(scheme);
        if (bands.length === 0) return;

        const vertical = scheme?.axis === "vertical";
        // The wall's own run, for vertical bands: N/S walls run along X, E/W walls along Z.
        const runStart = isEW ? rx : rz;
        const runLen = isEW ? rw : rd;
        const SKIN = 0.02; // panel thickness, and how far it stands off the wall face

        for (const piece of pieces) {
          const mesh = piece as THREE.Mesh;
          const geom = mesh.geometry as THREE.BoxGeometry;
          const params = geom?.parameters as { width: number; height: number; depth: number } | undefined;
          if (!params) continue;

          const { width: pw, height: ph, depth: pd } = params;
          const px = mesh.position.x;
          const py = mesh.position.y;
          const pz = mesh.position.z;

          for (const band of bands) {
            const hex = getWallColorHexStr(band.colorId);
            const mat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(hex),
              roughness: effectiveWallRoughness,
              metalness: 0.02,
            });

            // Clip this band's span to the piece it is being painted on.
            let lo: number;
            let hi: number;
            let pieceLo: number;
            let pieceHi: number;
            if (vertical) {
              lo = runStart + band.start * runLen;
              hi = runStart + band.end * runLen;
              pieceLo = (isEW ? px : pz) - (isEW ? pw : pd) / 2;
              pieceHi = (isEW ? px : pz) + (isEW ? pw : pd) / 2;
            } else {
              lo = band.start * WALL_HEIGHT_FT;
              hi = band.end * WALL_HEIGHT_FT;
              pieceLo = py - ph / 2;
              pieceHi = py + ph / 2;
            }

            const from = Math.max(lo, pieceLo);
            const to = Math.min(hi, pieceHi);
            const span = to - from;
            if (span <= 0.01) continue;
            const mid = (from + to) / 2;

            // Both faces, so the band reads from inside the room and from the neighbouring one.
            for (const side of [-1, 1]) {
              let panel: THREE.Mesh;
              if (isEW) {
                panel = new THREE.Mesh(
                  new THREE.BoxGeometry(vertical ? span : pw, vertical ? ph : span, SKIN),
                  mat
                );
                panel.position.set(vertical ? mid : px, vertical ? py : mid, pz + side * (pd / 2 + SKIN / 2));
              } else {
                panel = new THREE.Mesh(
                  new THREE.BoxGeometry(SKIN, vertical ? ph : span, vertical ? span : pd),
                  mat
                );
                panel.position.set(px + side * (pw / 2 + SKIN / 2), vertical ? py : mid, vertical ? mid : pz);
              }
              panel.receiveShadow = true;
              // Carries the wall's identity so clicking the paint still selects the wall.
              panel.userData = { ...mesh.userData };
              roomGroup.add(panel);
            }
          }
        }
      };

      /**
       * Turn a finished wall into glass.
       *
       * A material pass, not a geometry one. Every piece the segment loop produced — the piers
       * either side of a door, the lintel over it, the sill under a window — is already the
       * right shape, so glazing swaps what it is made of and thins it on its own axis. The
       * door hole the solver cut stays cut. Nothing above this line has to know about glass.
       */
      const glazeWall = (
        pieces: THREE.Object3D[],
        edge: "N" | "S" | "E" | "W",
        isEW: boolean
      ) => {
        const glazing = resolveWallGlazing(
          materialConfigRef.current,
          wallBandKey(roomInstanceId(rooms, i), edge),
          room.name as RoomName
        );
        if (!glazing?.wall) return;

        const style = findGlazingStyle(glazing.styleId);
        // Same move as the window panes in lib/windowCatalog.ts: transmission rather than
        // alpha, so the wall gets Fresnel and refraction and stays out of the transparent
        // queue. The depthWrite dodge below it went with the alpha it was compensating for.
        const glassMat = new THREE.MeshPhysicalMaterial({
          // Desaturated for the same reason as the window panes: a saturated tint used as the
          // transmission colour turns the glazing into a lit blue panel. The catalog colour
          // moves to attenuation, where it reads as glass absorbing light through its depth.
          color: new THREE.Color(style.colorHex).lerp(new THREE.Color(0xffffff), 0.72),
          attenuationColor: new THREE.Color(style.colorHex),
          attenuationDistance: 1.5,
          transmission: Math.min(0.97, Math.max(0.15, 1 - style.opacity * 0.85)),
          roughness: style.roughness,
          ior: 1.52,
          thickness: 0.25,
          metalness: 0,
          specularIntensity: 1,
          transparent: false,
          side: THREE.DoubleSide,
        });
        const frameMat = new THREE.MeshStandardMaterial({
          color: style.frameHex,
          roughness: 0.35,
          metalness: 0.6,
        });

        for (const piece of pieces) {
          const mesh = piece as THREE.Mesh;
          const params = (mesh.geometry as THREE.BoxGeometry)?.parameters as
            | { width: number; height: number; depth: number }
            | undefined;
          if (!params) continue;

          mesh.material = glassMat;
          // Glass is a sheet, not a 9 in brick. Scale on the thickness axis rather than
          // rebuilding the geometry, so the piece keeps its position and its userData.
          if (isEW) mesh.scale.z = 0.18;
          else mesh.scale.x = 0.18;
          // A transparent pane casting a solid shadow is the giveaway that it is faked.
          mesh.castShadow = false;

          const { width: pw, height: ph, depth: pd } = params;
          const px = mesh.position.x;
          const py = mesh.position.y;
          const pz = mesh.position.z;
          const runLen = isEW ? pw : pd;
          const thin = style.frameThicknessFt ?? DEFAULT_FRAME_THICKNESS_FT;

          // Head and cill rails frame every pane, so a glazed pier still reads as joinery.
          for (const railY of [py + ph / 2 - thin / 2, py - ph / 2 + thin / 2]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(isEW ? pw : thin * 1.6, thin, isEW ? thin * 1.6 : pd),
              frameMat
            );
            rail.position.set(px, railY, pz);
            rail.castShadow = true;
            roomGroup.add(rail);
          }

          // Vertical mullions, spaced across this piece. Because they are per piece, a door
          // opening never gets one across it.
          const bays = glazing.mullions;
          if (bays > 0 && runLen > 2.0) {
            for (let m = 1; m <= bays; m++) {
              const t = m / (bays + 1);
              const offset = -runLen / 2 + t * runLen;
              const mullion = new THREE.Mesh(
                new THREE.BoxGeometry(isEW ? thin : thin * 1.6, ph - thin * 2, isEW ? thin * 1.6 : thin),
                frameMat
              );
              mullion.position.set(isEW ? px + offset : px, py, isEW ? pz : pz + offset);
              mullion.castShadow = true;
              roomGroup.add(mullion);
            }
          }
        }
      };

      const buildWall = (
        edge: "N" | "S" | "E" | "W",
        wx: number,
        wz: number,
        ww: number,
        wd: number,
        isEW: boolean
      ) => {
        const pieceMark = roomGroup.children.length;

        // Glazing for this wall, resolved once: the door branches below need it, and so does the
        // material pass after the loop.
        const wallGlazing = resolveWallGlazing(
          materialConfigRef.current,
          wallBandKey(roomInstanceId(rooms, i), edge),
          room.name as RoomName
        );
        const glassDoor = Boolean(wallGlazing?.door);
        const glassDoorStyle = glassDoor ? findGlazingStyle(wallGlazing!.styleId) : null;

        /**
         * A glazed leaf: a pane in stiles and rails, rather than a painted slab.
         *
         * Transmissive, matching the glazed wall the door sits in and the window panes. It was
         * left on alpha when those two moved over, which put a door and the wall around it in
         * different materials — the wall refracting and picking up Fresnel, the leaf flat and
         * faded — and that difference is most visible in exactly the case the style exists for,
         * a glass door in a glass wall.
         */
        const glassLeafMaterial = () =>
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(glassDoorStyle!.colorHex).lerp(new THREE.Color(0xffffff), 0.72),
            attenuationColor: new THREE.Color(glassDoorStyle!.colorHex),
            attenuationDistance: 1.5,
            transmission: Math.min(0.97, Math.max(0.15, 1 - glassDoorStyle!.opacity * 0.85)),
            roughness: glassDoorStyle!.roughness,
            ior: 1.52,
            thickness: 0.25,
            metalness: 0,
            specularIntensity: 1,
            // Transmission blends, so the leaf stays in the opaque queue and sorts against the
            // wall it swings in. The depthWrite dodge went with the alpha it was compensating for.
            transparent: false,
            side: THREE.DoubleSide,
          });
        const glassFrameMaterial = () =>
          new THREE.MeshStandardMaterial({
            color: glassDoorStyle!.frameHex,
            roughness: 0.35,
            metalness: 0.6,
          });
        interface TouchingSegment {
          start: number;
          end: number;
          adjIndex: number;
          adjEdge: "N" | "S" | "E" | "W";
        }
        const touchingSegments: TouchingSegment[] = [];

        for (let j = 0; j < rooms.length; j++) {
          if (j === i) continue;
          const rj = rooms[j];
          const rjx = inchesToFeet(rj.x_in);
          const rjz = inchesToFeet(rj.y_in);
          const rjw = inchesToFeet(rj.w_in);
          const rjd = inchesToFeet(rj.d_in);

          if (edge === "N") {
            if (Math.abs((rjz + rjd) - rz) <= 0.35) {
              const ovStart = Math.max(rx, rjx);
              const ovEnd = Math.min(rx + rw, rjx + rjw);
              if (ovEnd - ovStart > 0.4) {
                touchingSegments.push({ start: ovStart, end: ovEnd, adjIndex: j, adjEdge: "S" });
              }
            }
          } else if (edge === "S") {
            if (Math.abs(rjz - (rz + rd)) <= 0.35) {
              const ovStart = Math.max(rx, rjx);
              const ovEnd = Math.min(rx + rw, rjx + rjw);
              if (ovEnd - ovStart > 0.4) {
                touchingSegments.push({ start: ovStart, end: ovEnd, adjIndex: j, adjEdge: "N" });
              }
            }
          } else if (edge === "W") {
            if (Math.abs((rjx + rjw) - rx) <= 0.35) {
              const ovStart = Math.max(rz, rjz);
              const ovEnd = Math.min(rz + rd, rjz + rjd);
              if (ovEnd - ovStart > 0.4) {
                touchingSegments.push({ start: ovStart, end: ovEnd, adjIndex: j, adjEdge: "E" });
              }
            }
          } else if (edge === "E") {
            if (Math.abs(rjx - (rx + rw)) <= 0.35) {
              const ovStart = Math.max(rz, rjz);
              const ovEnd = Math.min(rz + rd, rjz + rjd);
              if (ovEnd - ovStart > 0.4) {
                touchingSegments.push({ start: ovStart, end: ovEnd, adjIndex: j, adjEdge: "W" });
              }
            }
          }
        }

        touchingSegments.sort((a, b) => a.start - b.start);

        interface WallSegment {
          start: number;
          end: number;
          adj: { adjIndex: number; adjEdge: "N" | "S" | "E" | "W" } | null;
        }
        const wallSegments: WallSegment[] = [];

        let curPos = isEW ? rx : rz;
        const totalEnd = isEW ? rx + rw : rz + rd;

        for (const seg of touchingSegments) {
          const s = Math.max(curPos, seg.start);
          const e = Math.min(totalEnd, seg.end);
          if (s > curPos + 0.1) {
            wallSegments.push({ start: curPos, end: s, adj: null });
          }
          if (e > s + 0.1) {
            wallSegments.push({ start: s, end: e, adj: { adjIndex: seg.adjIndex, adjEdge: seg.adjEdge } });
            curPos = e;
          }
        }
        if (curPos < totalEnd - 0.1) {
          wallSegments.push({ start: curPos, end: totalEnd, adj: null });
        }
        if (wallSegments.length === 0) {
          wallSegments.push({ start: isEW ? rx : rz, end: totalEnd, adj: null });
        }

        // A door belongs to exactly one segment. Every non-shared segment on the entrance edge used
        // to claim its own front door, and every segment on a door's edge its own leaf, so a corner
        // stub a few inches wide got a full-width door hanging off the end of the wall.
        const MIN_DOOR_SEG_FT = 1.6;

        const segmentOwning = (centre: number, adjIndex?: number) => {
          let best = -1;
          let bestDist = Infinity;
          for (let k = 0; k < wallSegments.length; k++) {
            const cand = wallSegments[k];
            if (cand.end - cand.start < 0.2) continue;
            if (adjIndex != null && cand.adj?.adjIndex !== adjIndex) continue;
            const dist =
              centre < cand.start ? cand.start - centre : centre > cand.end ? centre - cand.end : 0;
            if (dist < bestDist) {
              bestDist = dist;
              best = k;
            }
          }
          return best;
        };

        const doorwaysOnEdge = assignedDoorways.filter(
          (d) => (d.roomAIndex === i && d.edgeA === edge) || (d.roomBIndex === i && d.edgeB === edge)
        );
        const doorOwnerSeg = new Map<Doorway, number>();
        for (const d of doorwaysOnEdge) {
          const partner = d.roomAIndex === i ? d.roomBIndex : d.roomAIndex;
          const owner = segmentOwning(d.center, partner);
          // Never drop the doorway: if no segment is shared with that room, the nearest one takes it.
          doorOwnerSeg.set(d, owner >= 0 ? owner : segmentOwning(d.center));
        }

        let entranceSegIdx = -1;
        if (i === entranceRoomIndex && edge === chosenEntranceEdge) {
          const entC = entranceCenterFt;
          const exterior = wallSegments
            .map((sg, idx) => ({ sg, idx }))
            .filter(({ sg }) => !sg.adj && sg.end - sg.start >= MIN_DOOR_SEG_FT);
          if (entC != null) {
            const hit = exterior.find(({ sg }) => entC >= sg.start && entC <= sg.end);
            if (hit) entranceSegIdx = hit.idx;
          }
          if (entranceSegIdx < 0 && exterior.length > 0) {
            entranceSegIdx = exterior.reduce((a, b) =>
              b.sg.end - b.sg.start > a.sg.end - a.sg.start ? b : a
            ).idx;
          }
        }

        for (let sIdx = 0; sIdx < wallSegments.length; sIdx++) {
          const seg = wallSegments[sIdx];
          const segLen = seg.end - seg.start;
          if (segLen < 0.2) continue;

          const isShared = Boolean(seg.adj);
          // If this segment is shared with another room that already built this partition segment (adjIndex < i), skip this segment!
          if (isShared && seg.adj && seg.adj.adjIndex < i) {
            continue;
          }

          const adjRoom = seg.adj ? rooms[seg.adj.adjIndex] : null;
          const adjLabel = adjRoom ? (ROOM_LABELS[adjRoom.name as RoomName] || adjRoom.name) : "";

          const segCenter = (seg.start + seg.end) / 2;
          const seg_wx = isEW ? segCenter : wx;
          const seg_wz = isEW ? wz : segCenter;
          const seg_ww = isEW ? segLen : ww;
          const seg_wd = isEW ? wd : segLen;

          const isMainEntrance = sIdx === entranceSegIdx;

          const assignedDoor = doorwaysOnEdge.find((d) => doorOwnerSeg.get(d) === sIdx);

          const openingSpec = (room.openings ?? []).find((o) => o.kind === "opening" && o.edge === edge);
          const adjOpeningSpec =
            seg.adj && adjRoom
              ? (adjRoom.openings ?? []).find((o) => o.kind === "opening" && o.edge === seg.adj?.adjEdge)
              : null;
          const hasFullOpening = Boolean(openingSpec || adjOpeningSpec);

          const wantsDoor = !hasFullOpening && (isMainEntrance || Boolean(assignedDoor));
          // Too short to frame a door. Leave the passage open rather than sealing the rooms off
          // (connectivity is never dropped) or hanging a door past the end of the wall.
          const hasNarrowPassage = wantsDoor && segLen < MIN_DOOR_SEG_FT;
          const hasDoor = wantsDoor && !hasNarrowPassage;
          const windowSpec = !isShared && !wantsDoor && !hasFullOpening ? windowOn(i, edge) : undefined;
          const hasWindow = Boolean(windowSpec);

          const roomLabel = ROOM_LABELS[room.name as RoomName] || room.name;

          // A shared run is a 4.5 in partition; an unshared one carries the 9 in load-bearing
          // wall. Only the second needs a beam over the opening — see the demolition branch.
          const isLoadBearing = !isShared;

          const wallTitle = hasFullOpening
            ? isLoadBearing
              ? `${roomLabel} (${edge}) — Lintel Beam over Opening`
              : `${roomLabel} / ${adjLabel} — Open-Concept Opening`
            : isShared
            ? `${roomLabel} / ${adjLabel} Partition Wall`
            : `${roomLabel} (${edge} Wall)`;

          const wallUserData = {
            isWall: true,
            isRemoved: hasFullOpening,
            id: `wall_${i}_${edge}_${sIdx}`,
            roomIndex: i,
            adjRoomIndex: seg.adj?.adjIndex,
            edge,
            adjEdge: seg.adj?.adjEdge,
            name: wallTitle,
          };

          if (hasFullOpening || hasNarrowPassage) {
            // Demolished wall. A 9 in load-bearing wall cannot simply be taken away — the slab
            // above it has to land on something — so a lintel beam stays and is named as one.
            // A 4.5 in partition carries nothing, so "delete" means the whole thing goes: the
            // beam used to be left on those too, which reads on screen as the top of the wall
            // failing to delete.
            if (isLoadBearing) {
              const beamH = 0.75;
              const beam = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, beamH, seg_wd), wallMaterial);
              beam.position.set(seg_wx, WALL_HEIGHT_FT - beamH / 2, seg_wz);
              beam.castShadow = true;
              beam.userData = { ...wallUserData, isLintel: true };
              roomGroup.add(beam);
            } else {
              // The partition is gone, but the opening still has to be clickable or there is no
              // way back — the beam used to be what you clicked to rebuild. A floor threshold is
              // what actually remains on site where a partition was taken out, it is an inch
              // tall so it cannot be mistaken for the wall, and it keeps the selection target.
              const threshold = new THREE.Mesh(
                new THREE.BoxGeometry(seg_ww, 0.08, seg_wd),
                baseboardMaterial
              );
              threshold.position.set(seg_wx, 0.04, seg_wz);
              threshold.receiveShadow = true;
              threshold.userData = { ...wallUserData, isThreshold: true };
              roomGroup.add(threshold);
            }
          } else if (hasDoor) {
            // The solver's width_in wins over the DOOR_* fallback, then the segment caps it — the
            // renderer must never draw a door wider than the wall holding it.
            const requestedDoorW = isMainEntrance ? entranceWidthFt : assignedDoor?.widthFt ?? DOOR_WIDTH_FT;
            const doorW = Math.min(requestedDoorW, segLen - 0.4);

            // Ry(+t) sends the EW leaf's local +X to -Z and the NS leaf's local +Z to +X, so a
            // single sign swings both into the room instead of out over the setback.
            const swingSign = edge === "N" || edge === "E" ? -1 : 1;
            const doorH = DOOR_HEIGHT_FT;
            const lintelH = WALL_HEIGHT_FT - doorH;

            let doorPos = isEW ? seg_wx : seg_wz;
            if (assignedDoor && assignedDoor.center >= seg.start + doorW / 2 && assignedDoor.center <= seg.end - doorW / 2) {
              doorPos = assignedDoor.center;
            } else {
              doorPos = isEW ? seg_wx : seg_wz;
            }

            if (isEW) {
              doorPos = Math.max(seg.start + doorW / 2 + 0.1, Math.min(seg.end - doorW / 2 - 0.1, doorPos));
            } else {
              doorPos = Math.max(seg.start + doorW / 2 + 0.1, Math.min(seg.end - doorW / 2 - 0.1, doorPos));
            }

            if (isEW) {
              const leftW = Math.max(0.05, doorPos - (seg_wx - seg_ww / 2) - doorW / 2);
              const rightW = Math.max(0.05, (seg_wx + seg_ww / 2) - (doorPos + doorW / 2));

              if (leftW > 0.08) {
                const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftW, WALL_HEIGHT_FT, seg_wd), wallMaterial);
                leftWall.position.set(seg_wx - seg_ww / 2 + leftW / 2, WALL_HEIGHT_FT / 2, seg_wz);
                leftWall.castShadow = true;
                leftWall.receiveShadow = true;
                leftWall.userData = { ...wallUserData };
                roomGroup.add(leftWall);

                const leftBase = new THREE.Mesh(new THREE.BoxGeometry(leftW, BASEBOARD_H_FT, seg_wd + 0.04), baseboardMaterial);
                leftBase.position.set(seg_wx - seg_ww / 2 + leftW / 2, BASEBOARD_H_FT / 2, seg_wz);
                roomGroup.add(leftBase);
              }

              if (rightW > 0.08) {
                const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightW, WALL_HEIGHT_FT, seg_wd), wallMaterial);
                rightWall.position.set(seg_wx + seg_ww / 2 - rightW / 2, WALL_HEIGHT_FT / 2, seg_wz);
                rightWall.castShadow = true;
                rightWall.receiveShadow = true;
                rightWall.userData = { ...wallUserData };
                roomGroup.add(rightWall);

                const rightBase = new THREE.Mesh(new THREE.BoxGeometry(rightW, BASEBOARD_H_FT, seg_wd + 0.04), baseboardMaterial);
                rightBase.position.set(seg_wx + seg_ww / 2 - rightW / 2, BASEBOARD_H_FT / 2, seg_wz);
                roomGroup.add(rightBase);
              }

              const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, seg_wd), wallMaterial);
              lintel.position.set(doorPos, doorH + lintelH / 2, seg_wz);
              lintel.castShadow = true;
              lintel.userData = { ...wallUserData };
              roomGroup.add(lintel);

              const fMat = isMainEntrance ? roomMainEntranceMat : roomDoorFrameMat;
              const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, seg_wd + 0.08), fMat);
              frameL.position.set(doorPos - doorW / 2 + 0.11, doorH / 2, seg_wz);
              roomGroup.add(frameL);

              const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, seg_wd + 0.08), fMat);
              frameR.position.set(doorPos + doorW / 2 - 0.11, doorH / 2, seg_wz);
              roomGroup.add(frameR);

              const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.22, seg_wd + 0.08), fMat);
              frameTop.position.set(doorPos, doorH - 0.11, seg_wz);
              roomGroup.add(frameTop);

              // 3D Hinged Door Leaf (Swung open at 35° angle, matching the reference architectural cutaway!)
              const doorLeafGroupEW = new THREE.Group();
              const dLeafThick = 0.12;
              const dLeafW = Math.max(0.6, doorW - 0.25);
              const dLeafH = doorH - 0.15;
              const dLeafMat = glassDoor
                ? glassLeafMaterial()
                : isMainEntrance
                ? new THREE.MeshStandardMaterial({ color: 0x181e29, roughness: 0.35 })
                : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
              const dLeafMeshEW = new THREE.Mesh(new THREE.BoxGeometry(dLeafW, dLeafH, dLeafThick), dLeafMat);
              dLeafMeshEW.position.set(dLeafW / 2, dLeafH / 2, 0);
              dLeafMeshEW.castShadow = !glassDoor;
              doorLeafGroupEW.add(dLeafMeshEW);

              if (glassDoor) {
                // Stiles and rails. Without them a glass door is an invisible rectangle and the
                // opening reads as a hole.
                const fm = glassFrameMaterial();
                const bar = 0.18;
                for (const sx of [bar / 2, dLeafW - bar / 2]) {
                  const stile = new THREE.Mesh(
                    new THREE.BoxGeometry(bar, dLeafH, dLeafThick * 1.4),
                    fm
                  );
                  stile.position.set(sx, dLeafH / 2, 0);
                  stile.castShadow = true;
                  doorLeafGroupEW.add(stile);
                }
                for (const sy of [bar / 2, dLeafH - bar / 2, dLeafH * 0.32]) {
                  const rail = new THREE.Mesh(
                    new THREE.BoxGeometry(dLeafW, bar, dLeafThick * 1.4),
                    fm
                  );
                  rail.position.set(dLeafW / 2, sy, 0);
                  rail.castShadow = true;
                  doorLeafGroupEW.add(rail);
                }
                // A glass door takes a pull, not a lever.
                const pull = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10),
                  fm
                );
                pull.position.set(dLeafW - 0.45, dLeafH * 0.5, dLeafThick / 2 + 0.12);
                doorLeafGroupEW.add(pull);
              }

              const leverMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.15 });
              const leverEW = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.18), leverMat);
              leverEW.position.set(dLeafW - 0.3, dLeafH * 0.48, dLeafThick / 2 + 0.04);
              doorLeafGroupEW.add(leverEW);

              const doorId = isMainEntrance
                ? `door_entrance_${i}`
                : assignedDoor
                ? `door_${Math.min(assignedDoor.roomAIndex, assignedDoor.roomBIndex)}_${Math.max(assignedDoor.roomAIndex, assignedDoor.roomBIndex)}`
                : `door_${i}_${edge}_${sIdx}`;

              const doorLabel = isMainEntrance
                ? "Front Entrance Door"
                : `${ROOM_LABELS[room.name as RoomName] || room.name} Door`;

              doorLeafGroupEW.position.set(doorPos - doorW / 2 + 0.15, 0, seg_wz);
              doorLeafGroupEW.rotation.y = 0; // Starts firmly CLOSED across the doorway!
              doorLeafGroupEW.userData = { isDoorLeaf: true, doorId };
              dLeafMeshEW.userData = { isDoorLeaf: true, doorId };
              roomGroup.add(doorLeafGroupEW);

              interactiveDoorsRef.current.set(doorId, {
                id: doorId,
                group: doorLeafGroupEW,
                doorPos: new THREE.Vector3(doorPos, 0, seg_wz),
                widthFt: doorW,
                edge,
                swingSign,
                isOpen: false,
                currentAngle: 0,
                targetAngle: 0,
                label: doorLabel,
              });

              // Add doorway obstacle to collision engine (blocks movement while closed!)
              sceneObstaclesRef.current.push({
                id: doorId,
                minX: doorPos - doorW / 2,
                maxX: doorPos + doorW / 2,
                minZ: seg_wz - seg_wd / 2,
                maxZ: seg_wz + seg_wd / 2,
                isDoor: true,
                isOpen: false,
              });

              if (isMainEntrance) {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.2), goldHardwareMat);
                handle.position.set(doorPos + doorW / 2 - 0.4, doorH * 0.48, seg_wz + 0.15);
                roomGroup.add(handle);

                // Exterior Front Door Canopy / Sunshade
                if (!isShared) {
                  const canopyW = doorW + 1.2;
                  const canopyT = 0.28;
                  const canopyOut = 1.8;
                  const canopyY = doorH + canopyT / 2 + 0.12;

                  const canopyGeom = new THREE.BoxGeometry(canopyW, canopyT, canopyOut);
                  const canopyMesh = new THREE.Mesh(canopyGeom, slabMat);
                  canopyMesh.castShadow = true;
                  canopyMesh.receiveShadow = true;

                  if (edge === "N") canopyMesh.position.set(doorPos, canopyY, seg_wz - canopyOut / 2 + seg_wd / 2);
                  else if (edge === "S") canopyMesh.position.set(doorPos, canopyY, seg_wz + canopyOut / 2 - seg_wd / 2);
                  roomGroup.add(canopyMesh);
                }
              }
            } else {
              const topD = Math.max(0.05, doorPos - (seg_wz - seg_wd / 2) - doorW / 2);
              const bottomD = Math.max(0.05, (seg_wz + seg_wd / 2) - (doorPos + doorW / 2));

              if (topD > 0.08) {
                const topWall = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, WALL_HEIGHT_FT, topD), wallMaterial);
                topWall.position.set(seg_wx, WALL_HEIGHT_FT / 2, seg_wz - seg_wd / 2 + topD / 2);
                topWall.castShadow = true;
                topWall.receiveShadow = true;
                topWall.userData = { ...wallUserData };
                roomGroup.add(topWall);

                const topBase = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.04, BASEBOARD_H_FT, topD), baseboardMaterial);
                topBase.position.set(seg_wx, BASEBOARD_H_FT / 2, seg_wz - seg_wd / 2 + topD / 2);
                roomGroup.add(topBase);
              }

              if (bottomD > 0.08) {
                const botWall = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, WALL_HEIGHT_FT, bottomD), wallMaterial);
                botWall.position.set(seg_wx, WALL_HEIGHT_FT / 2, seg_wz + seg_wd / 2 - bottomD / 2);
                botWall.castShadow = true;
                botWall.receiveShadow = true;
                botWall.userData = { ...wallUserData };
                roomGroup.add(botWall);

                const botBase = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.04, BASEBOARD_H_FT, bottomD), baseboardMaterial);
                botBase.position.set(seg_wx, BASEBOARD_H_FT / 2, seg_wz + seg_wd / 2 - bottomD / 2);
                roomGroup.add(botBase);
              }

              const lintel = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, lintelH, doorW), wallMaterial);
              lintel.position.set(seg_wx, doorH + lintelH / 2, doorPos);
              lintel.castShadow = true;
              lintel.userData = { ...wallUserData };
              roomGroup.add(lintel);

              const fMat = isMainEntrance ? roomMainEntranceMat : roomDoorFrameMat;
              const frameN = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.08, doorH, 0.22), fMat);
              frameN.position.set(seg_wx, doorH / 2, doorPos - doorW / 2 + 0.11);
              roomGroup.add(frameN);

              const frameS = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.08, doorH, 0.22), fMat);
              frameS.position.set(seg_wx, doorH / 2, doorPos + doorW / 2 - 0.11);
              roomGroup.add(frameS);

              const frameTop = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.08, 0.22, doorW), fMat);
              frameTop.position.set(seg_wx, doorH - 0.11, doorPos);
              roomGroup.add(frameTop);

              // 3D Hinged Door Leaf (Swung open at 35° angle, matching the reference architectural cutaway!)
              const doorLeafGroupNS = new THREE.Group();
              const dLeafThickNS = 0.12;
              const dLeafWNS = Math.max(0.6, doorW - 0.25);
              const dLeafHNS = doorH - 0.15;
              const dLeafMatNS = glassDoor
                ? glassLeafMaterial()
                : isMainEntrance
                ? new THREE.MeshStandardMaterial({ color: 0x181e29, roughness: 0.35 })
                : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
              const dLeafMeshNS = new THREE.Mesh(new THREE.BoxGeometry(dLeafThickNS, dLeafHNS, dLeafWNS), dLeafMatNS);
              dLeafMeshNS.position.set(0, dLeafHNS / 2, dLeafWNS / 2);
              dLeafMeshNS.castShadow = !glassDoor;
              doorLeafGroupNS.add(dLeafMeshNS);

              if (glassDoor) {
                const fmNS = glassFrameMaterial();
                const barNS = 0.18;
                for (const sz of [barNS / 2, dLeafWNS - barNS / 2]) {
                  const stile = new THREE.Mesh(
                    new THREE.BoxGeometry(dLeafThickNS * 1.4, dLeafHNS, barNS),
                    fmNS
                  );
                  stile.position.set(0, dLeafHNS / 2, sz);
                  stile.castShadow = true;
                  doorLeafGroupNS.add(stile);
                }
                for (const sy of [barNS / 2, dLeafHNS - barNS / 2, dLeafHNS * 0.32]) {
                  const rail = new THREE.Mesh(
                    new THREE.BoxGeometry(dLeafThickNS * 1.4, barNS, dLeafWNS),
                    fmNS
                  );
                  rail.position.set(0, sy, dLeafWNS / 2);
                  rail.castShadow = true;
                  doorLeafGroupNS.add(rail);
                }
                const pullNS = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10),
                  fmNS
                );
                pullNS.position.set(dLeafThickNS / 2 + 0.12, dLeafHNS * 0.5, dLeafWNS - 0.45);
                doorLeafGroupNS.add(pullNS);
              }

              const leverMatNS = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.15 });
              const leverNS = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.35), leverMatNS);
              leverNS.position.set(dLeafThickNS / 2 + 0.04, dLeafHNS * 0.48, dLeafWNS - 0.3);
              doorLeafGroupNS.add(leverNS);

              const doorId = isMainEntrance
                ? `door_entrance_${i}`
                : assignedDoor
                ? `door_${Math.min(assignedDoor.roomAIndex, assignedDoor.roomBIndex)}_${Math.max(assignedDoor.roomAIndex, assignedDoor.roomBIndex)}`
                : `door_${i}_${edge}_${sIdx}`;

              const doorLabel = isMainEntrance
                ? "Front Entrance Door"
                : `${ROOM_LABELS[room.name as RoomName] || room.name} Door`;

              doorLeafGroupNS.position.set(seg_wx, 0, doorPos - doorW / 2 + 0.15);
              doorLeafGroupNS.rotation.y = 0; // Starts firmly CLOSED across the doorway!
              doorLeafGroupNS.userData = { isDoorLeaf: true, doorId };
              dLeafMeshNS.userData = { isDoorLeaf: true, doorId };
              roomGroup.add(doorLeafGroupNS);

              interactiveDoorsRef.current.set(doorId, {
                id: doorId,
                group: doorLeafGroupNS,
                doorPos: new THREE.Vector3(seg_wx, 0, doorPos),
                widthFt: doorW,
                edge,
                swingSign,
                isOpen: false,
                currentAngle: 0,
                targetAngle: 0,
                label: doorLabel,
              });

              // Add doorway obstacle to collision engine (blocks movement while closed!)
              sceneObstaclesRef.current.push({
                id: doorId,
                minX: seg_wx - seg_ww / 2,
                maxX: seg_wx + seg_ww / 2,
                minZ: doorPos - doorW / 2,
                maxZ: doorPos + doorW / 2,
                isDoor: true,
                isOpen: false,
              });

              if (isMainEntrance) {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.12), goldHardwareMat);
                handle.position.set(seg_wx + 0.15, doorH * 0.48, doorPos + doorW / 2 - 0.4);
                roomGroup.add(handle);

                // Exterior Front Door Canopy / Sunshade
                if (!isShared) {
                  const canopyW = doorW + 1.2;
                  const canopyT = 0.28;
                  const canopyOut = 1.8;
                  const canopyY = doorH + canopyT / 2 + 0.12;

                  const canopyGeom = new THREE.BoxGeometry(canopyOut, canopyT, canopyW);
                  const canopyMesh = new THREE.Mesh(canopyGeom, slabMat);
                  canopyMesh.castShadow = true;
                  canopyMesh.receiveShadow = true;

                  if (edge === "W") canopyMesh.position.set(seg_wx - canopyOut / 2 + seg_ww / 2, canopyY, doorPos);
                  else if (edge === "E") canopyMesh.position.set(seg_wx + canopyOut / 2 - seg_ww / 2, canopyY, doorPos);
                  roomGroup.add(canopyMesh);
                }
              }
            }
          } else if (hasWindow && segLen >= 2.0) {
            const winId = `win_${i}_${edge}`;
            const winProps = getIndividualWindowProps(winId, room.name as RoomName, windowConfigRef.current);

            const maxAllowedW = Math.max(1.5, (isEW ? seg_ww : seg_wd) - 0.6);
            const winW = Math.min(
              winProps.widthFt ?? (windowSpec ? inchesToFeet(windowSpec.width_in) : WINDOW_W_FT),
              maxAllowedW
            );
            const winH = winProps.heightFt ?? (windowSpec?.height_in ? inchesToFeet(windowSpec.height_in) : WINDOW_H_FT);
            const sillH = winProps.sillHeightFt ?? (windowSpec?.sill_in != null ? inchesToFeet(windowSpec.sill_in) : WINDOW_SILL_Y_FT);
            const topH = Math.max(0.1, WALL_HEIGHT_FT - (sillH + winH));

            if (isEW) {
              const sideW = Math.max(0.2, (seg_ww - winW) / 2);

              const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, seg_wd), wallMaterial);
              leftWall.position.set(seg_wx - seg_ww / 2 + sideW / 2, WALL_HEIGHT_FT / 2, seg_wz);
              leftWall.castShadow = true;
              leftWall.receiveShadow = true;
              leftWall.userData = { ...wallUserData };
              roomGroup.add(leftWall);

              const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, seg_wd), wallMaterial);
              rightWall.position.set(seg_wx + seg_ww / 2 - sideW / 2, WALL_HEIGHT_FT / 2, seg_wz);
              rightWall.castShadow = true;
              rightWall.receiveShadow = true;
              rightWall.userData = { ...wallUserData };
              roomGroup.add(rightWall);

              const sillWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, seg_wd), wallMaterial);
              sillWall.position.set(seg_wx, sillH / 2, seg_wz);
              sillWall.castShadow = true;
              sillWall.receiveShadow = true;
              sillWall.userData = { ...wallUserData };
              roomGroup.add(sillWall);

              const baseboard = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, BASEBOARD_H_FT, seg_wd + 0.04), baseboardMaterial);
              baseboard.position.set(seg_wx, BASEBOARD_H_FT / 2, seg_wz);
              roomGroup.add(baseboard);

              const topWall = new THREE.Mesh(new THREE.BoxGeometry(winW, topH, seg_wd), wallMaterial);
              topWall.position.set(seg_wx, sillH + winH + topH / 2, seg_wz);
              topWall.castShadow = true;
              topWall.userData = { ...wallUserData };
              roomGroup.add(topWall);

              if (!winProps.isDeleted) {
                buildWindowWithCurtains(
                  roomGroup,
                  seg_wx,
                  sillH + winH / 2,
                  seg_wz,
                  winW,
                  winH,
                  seg_wd,
                  true,
                  winProps.hasCurtains,
                  room.name === "bathroom",
                  winProps.shape,
                  winProps.frameFinish,
                  winProps.glassTint,
                  winId,
                  room.name,
                  i,
                  edge
                );

                // Exterior Window Sunshade / Chajja (Cleanly centered directly above window)
                if (!isShared) {
                  const chajjaW = winW + 0.8;
                  const chajjaT = 0.24;
                  const chajjaOut = 1.5;
                  const chajjaY = sillH + winH + chajjaT / 2 + 0.1;

                  const chajjaGeom = new THREE.BoxGeometry(chajjaW, chajjaT, chajjaOut);
                  const chajjaMesh = new THREE.Mesh(chajjaGeom, slabMat);
                  chajjaMesh.castShadow = true;
                  chajjaMesh.receiveShadow = true;

                  if (edge === "N") chajjaMesh.position.set(seg_wx, chajjaY, seg_wz - chajjaOut / 2 + seg_wd / 2);
                  else if (edge === "S") chajjaMesh.position.set(seg_wx, chajjaY, seg_wz + chajjaOut / 2 - seg_wd / 2);
                  roomGroup.add(chajjaMesh);
                }
              }
            } else {
              const sideD = Math.max(0.2, (seg_wd - winW) / 2);

              const topWallSeg = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, WALL_HEIGHT_FT, sideD), wallMaterial);
              topWallSeg.position.set(seg_wx, WALL_HEIGHT_FT / 2, seg_wz - seg_wd / 2 + sideD / 2);
              topWallSeg.castShadow = true;
              topWallSeg.receiveShadow = true;
              topWallSeg.userData = { ...wallUserData };
              roomGroup.add(topWallSeg);

              const botWallSeg = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, WALL_HEIGHT_FT, sideD), wallMaterial);
              botWallSeg.position.set(seg_wx, WALL_HEIGHT_FT / 2, seg_wz + seg_wd / 2 - sideD / 2);
              botWallSeg.castShadow = true;
              botWallSeg.receiveShadow = true;
              botWallSeg.userData = { ...wallUserData };
              roomGroup.add(botWallSeg);

              const sillWall = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, sillH, winW), wallMaterial);
              sillWall.position.set(seg_wx, sillH / 2, seg_wz);
              sillWall.castShadow = true;
              sillWall.receiveShadow = true;
              sillWall.userData = { ...wallUserData };
              roomGroup.add(sillWall);

              const baseboard = new THREE.Mesh(new THREE.BoxGeometry(seg_ww + 0.04, BASEBOARD_H_FT, seg_wd), baseboardMaterial);
              baseboard.position.set(seg_wx, BASEBOARD_H_FT / 2, seg_wz);
              roomGroup.add(baseboard);

              const topWall = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, topH, winW), wallMaterial);
              topWall.position.set(seg_wx, sillH + winH + topH / 2, seg_wz);
              topWall.castShadow = true;
              topWall.userData = { ...wallUserData };
              roomGroup.add(topWall);

              if (!winProps.isDeleted) {
                buildWindowWithCurtains(
                  roomGroup,
                  seg_wx,
                  sillH + winH / 2,
                  seg_wz,
                  winW,
                  winH,
                  seg_ww,
                  false,
                  winProps.hasCurtains,
                  room.name === "bathroom",
                  winProps.shape,
                  winProps.frameFinish,
                  winProps.glassTint,
                  winId,
                  room.name,
                  i,
                  edge
                );

                // Exterior Window Sunshade / Chajja (Cleanly centered directly above window)
                if (!isShared) {
                  const chajjaW = winW + 0.8;
                  const chajjaT = 0.24;
                  const chajjaOut = 1.5;
                  const chajjaY = sillH + winH + chajjaT / 2 + 0.1;

                  const chajjaGeom = new THREE.BoxGeometry(chajjaOut, chajjaT, chajjaW);
                  const chajjaMesh = new THREE.Mesh(chajjaGeom, slabMat);
                  chajjaMesh.castShadow = true;
                  chajjaMesh.receiveShadow = true;

                  if (edge === "W") chajjaMesh.position.set(seg_wx - chajjaOut / 2 + seg_ww / 2, chajjaY, seg_wz);
                  else if (edge === "E") chajjaMesh.position.set(seg_wx + chajjaOut / 2 - seg_ww / 2, chajjaY, seg_wz);
                  roomGroup.add(chajjaMesh);
                }
              }
            }
          } else {
            // Solid Wall
            const wall = new THREE.Mesh(new THREE.BoxGeometry(seg_ww, WALL_HEIGHT_FT, seg_wd), wallMaterial);
            wall.position.set(seg_wx, WALL_HEIGHT_FT / 2, seg_wz);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData = { ...wallUserData };
            roomGroup.add(wall);

            const baseboard = new THREE.Mesh(
              new THREE.BoxGeometry(isEW ? seg_ww : seg_ww + 0.04, BASEBOARD_H_FT, isEW ? seg_wd + 0.04 : seg_wd),
              baseboardMaterial
            );
            baseboard.position.set(seg_wx, BASEBOARD_H_FT / 2, seg_wz);
            roomGroup.add(baseboard);

            // Architectural Wainscoting / Boiserie Relief Panels in Upgraded Mode
            if (isUpgradedRef.current && (room.name === "hall" || room.name === "dining") && (isEW ? seg_ww : seg_wd) > 2.8) {
              const panelW = isEW ? seg_ww - 0.4 : 0.08;
              const panelD = isEW ? 0.08 : seg_wd - 0.4;
              const boiserie = new THREE.Mesh(
                new THREE.BoxGeometry(panelW, 2.6, panelD),
                baseboardMaterial
              );
              boiserie.position.set(seg_wx, 1.8, seg_wz);
              boiserie.castShadow = true;
              roomGroup.add(boiserie);
            }
          }
        }

        // Every piece of this wall now exists, so the finish can go on. Anything added since the
        // mark and tagged as wall is a piece of it.
        // A lintel beam is wall and gets painted; a floor threshold is not, and a band on an
        // inch-tall strip reads as a smear.
        const pieces = roomGroup.children
          .slice(pieceMark)
          .filter(
            (c) => (c as THREE.Mesh).isMesh && c.userData?.isWall && !c.userData?.isThreshold
          );
        // Glass first: a glazed wall is not painted, it is glazed.
        const glazedHere = resolveWallGlazing(
          materialConfigRef.current,
          wallBandKey(roomInstanceId(rooms, i), edge),
          room.name as RoomName
        );
        if (glazedHere?.wall) {
          glazeWall(pieces, edge, isEW);
        } else {
          paintWallBands(pieces, edge, isEW);
        }

        // Register solid wall colliders for all physical wall segments
        for (const pMesh of pieces) {
          // Exclude lintels (which sit above doors/windows) and floor thresholds
          if (pMesh.userData?.isLintel || pMesh.userData?.isThreshold) continue;

          const box = new THREE.Box3().setFromObject(pMesh);
          // Only register walls that stand at human body height (between 0.5 ft and 5.5 ft)
          if (!box.isEmpty() && box.min.y < 5.0 && box.max.y > 0.5) {
            sceneObstaclesRef.current.push({
              id: `wall_${i}_${edge}_${pMesh.id}`,
              minX: box.min.x,
              maxX: box.max.x,
              minZ: box.min.z,
              maxZ: box.max.z,
            });
          }
        }
      };

      const wt = room.wall_thickness_in != null
        ? inchesToFeet(room.wall_thickness_in)
        : WALL_THICK_INT_FT;

      // North Wall
      buildWall("N", rx + rw / 2, rz + wt / 2, rw, wt, true);
      // South Wall
      buildWall("S", rx + rw / 2, rz + rd - wt / 2, rw, wt, true);
      // West Wall
      buildWall("W", rx + wt / 2, rz + rd / 2, wt, rd, false);
      // East Wall
      buildWall("E", rx + rw - wt / 2, rz + rd / 2, wt, rd, false);

      // Warm interior recessed spotlight (Non-shadowed to eliminate 30+ GPU shadow depth passes per frame)
      const roomLight = new THREE.PointLight(0xfff0dd, 1.2, 28, 1.2);
      roomLight.position.set(rx + rw / 2, 8.2, rz + rd / 2);
      roomLight.castShadow = false;
      roomLight.visible = lightsOnRef.current;
      roomGroup.add(roomLight);
      roomLightsRef.current.push(roomLight);

      const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffe6ba,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 24), fixtureMat);
      fixture.position.set(rx + rw / 2, 8.95, rz + rd / 2);
      roomGroup.add(fixture);

      // Ceiling Fan in Living Hall & Bedrooms
      if (furnished && (room.name === "hall" || room.name === "bedroom")) {
        const fan = addCeilingFan(roomGroup, rx + rw / 2, rz + rd / 2, 8.1);
        fanBladesRef.current.push(fan);
      }

      // Collect all active doorways for this room
      const roomDoors: RoomDoorInfo[] = [];
      if (isHub && chosenEntranceEdge) {
        roomDoors.push({ edge: chosenEntranceEdge, center: 0, isEntrance: true });
      }
      for (const d of assignedDoorways) {
        const roomA = rooms[d.roomAIndex];
        const roomB = rooms[d.roomBIndex];
        const isAOpen = (roomA?.openings ?? []).some((o) => o.kind === "opening" && o.edge === d.edgeA);
        const isBOpen = (roomB?.openings ?? []).some((o) => o.kind === "opening" && o.edge === d.edgeB);
        if (isAOpen || isBOpen) continue;

        if (d.roomAIndex === i) {
          roomDoors.push({ edge: d.edgeA, center: d.center });
        } else if (d.roomBIndex === i) {
          roomDoors.push({ edge: d.edgeB, center: d.center });
        }
      }

      if (furnished) {
        const deletedBuiltinSet = new Set(deletedBuiltinIdsRef.current || []);
        addRoomInteriorDetails(
          roomGroup,
          room.name as RoomName,
          rx,
          rz,
          rw,
          rd,
          roomDoors,
          i,
          deletedBuiltinSet,
          isUpgradedRef.current
        );
      }

      // 3D Floating Room Badge
      const badge = createRoomBadge(
        ROOM_LABELS[room.name as RoomName] ?? room.name,
        rw,
        rd
      );
      badge.position.set(rx + rw / 2, WALL_HEIGHT_FT + 1.8, rz + rd / 2);
      roomGroup.add(badge);

      group.add(roomGroup);
      roomGroupsRef.current.set(i, roomGroup);
      roomLightsByRoomRef.current.set(i, [roomLight]);
    }

    // Ensure world transformation matrices are fully calculated for precise bounding boxes
    group.updateMatrixWorld(true);

    // 6.5. Physical Collision Obstacles: Custom Furniture, Built-in Furniture, and Custom Walls
    // Custom placed furniture objects
    for (const obj of (customObjectsRef.current || [])) {
      if (obj.type === "custom_3d_model") continue;
      const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
      const s = obj.scale || 1.0;
      const w = (def?.dimensions.widthFt || 3.0) * s;
      const d = (def?.dimensions.depthFt || 3.0) * s;
      const hw = Math.max(0.3, (w * 0.7) / 2);
      const hd = Math.max(0.3, (d * 0.7) / 2);
      sceneObstaclesRef.current.push({
        id: `cobj_${obj.id}`,
        minX: obj.x - hw,
        maxX: obj.x + hw,
        minZ: obj.z - hd,
        maxZ: obj.z + hd,
      });
    }

    // Built-in room furniture (major pieces: beds, wardrobes, dining tables, sofas)
    for (const rg of roomGroupsRef.current.values()) {
      rg.traverse((child) => {
        if (child.userData && child.userData.isFurniture && !child.userData.isCustomObject) {
          // Skip windows, curtains, thresholds, fans, lights
          if (child.userData.isWindow || child.userData.type === "window" || child.userData.isThreshold) return;
          const box = new THREE.Box3().setFromObject(child);
          if (!box.isEmpty() && box.min.y < 3.5 && box.max.y > 0.4) {
            const cx = (box.min.x + box.max.x) / 2;
            const cz = (box.min.z + box.max.z) / 2;
            const bw = box.max.x - box.min.x;
            const bd = box.max.z - box.min.z;
            // Only substantial ground furniture items (beds, sofas, tables, wardrobes, counters)
            if (bw > 1.2 && bd > 1.2) {
              const hw = (bw * 0.7) / 2;
              const hd = (bd * 0.7) / 2;
              sceneObstaclesRef.current.push({
                id: `builtin_${child.userData.id || child.id}`,
                minX: cx - hw,
                maxX: cx + hw,
                minZ: cz - hd,
                maxZ: cz + hd,
              });
            }
          }
        }
      });
    }

    // Custom drawn walls
    for (const cw of (customWallsRef.current || [])) {
      const x1 = inchesToFeet(cw.startXIn);
      const z1 = inchesToFeet(cw.startYIn);
      const x2 = inchesToFeet(cw.endXIn);
      const z2 = inchesToFeet(cw.endYIn);
      const th = inchesToFeet(cw.thicknessIn || 9.0) / 2;
      sceneObstaclesRef.current.push({
        id: `cwall_${cw.id}`,
        minX: Math.min(x1, x2) - th,
        maxX: Math.max(x1, x2) + th,
        minZ: Math.min(z1, z2) - th,
        maxZ: Math.max(z1, z2) + th,
      });
    }

    // 7. Roof — RCC slab & parapet
    if (rooms.length > 0) {
      const roof = new THREE.Group();
      roof.visible = modeRef.current === "walkthrough";
      roofGroupRef.current = roof;
      group.add(roof);

      for (const room of rooms) {
        const rw = inchesToFeet(room.w_in);
        const rd = inchesToFeet(room.d_in);
        const rx = inchesToFeet(room.x_in);
        const rz = inchesToFeet(room.y_in);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(rw, SLAB_T, rd), slabMat);
        slab.position.set(rx + rw / 2, WALL_HEIGHT_FT + SLAB_T / 2, rz + rd / 2);
        slab.castShadow = true;
        slab.receiveShadow = true;
        roof.add(slab);
      }

      const fx0 = Math.min(...rooms.map((r) => inchesToFeet(r.x_in)));
      const fz0 = Math.min(...rooms.map((r) => inchesToFeet(r.y_in)));
      const fx1 = Math.max(...rooms.map((r) => inchesToFeet(r.x_in + r.w_in)));
      const fz1 = Math.max(...rooms.map((r) => inchesToFeet(r.y_in + r.d_in)));
      const parapetY = WALL_HEIGHT_FT + SLAB_T + PARAPET_H / 2;
      const PT = 0.4;
      for (const [px, pz, pw, pd] of [
        [(fx0 + fx1) / 2, fz0 + PT / 2, fx1 - fx0, PT],
        [(fx0 + fx1) / 2, fz1 - PT / 2, fx1 - fx0, PT],
        [fx0 + PT / 2, (fz0 + fz1) / 2, PT, fz1 - fz0],
        [fx1 - PT / 2, (fz0 + fz1) / 2, PT, fz1 - fz0],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(pw, PARAPET_H, pd), slabMat);
        wall.position.set(px, parapetY, pz);
        wall.castShadow = true;
        roof.add(wall);
      }
    }

    // 8. Custom Interactive Placed Furniture & Decor Objects (Procedural + Real 3D GLTF/GLB)
    const customList = customObjectsRef.current || [];
    for (const obj of customList) {
      if (obj.glbUrl) {
        // Load real 3D GLB model asynchronously with procedural fallback
        const placeholder = new THREE.Group();
        placeholder.position.set(obj.x, obj.y || 0, obj.z);
        placeholder.rotation.y = obj.rotationY || 0;
        const s = obj.scale || 1.0;
        placeholder.scale.set(s, s, s);
        placeholder.userData = { isCustomObject: true, id: obj.id, name: obj.name, type: obj.type, glbUrl: obj.glbUrl };

        const fallback = createFurnitureMesh(obj.type, obj.colorHex, obj.aiParametricDef);
        placeholder.add(fallback);
        group.add(placeholder);
        customObjectMeshesRef.current.set(obj.id, placeholder);

        const def = FURNITURE_CATALOG.find((f) => f.type === obj.type);
        const dims = def?.dimensions || { widthFt: 3, heightFt: 3, depthFt: 3 };
        loadGlbModel(obj.glbUrl, dims)
          .then((loadedMesh) => {
            placeholder.clear();
            placeholder.add(loadedMesh);
            if (pathTracerRef.current && isRaytracingRef.current) {
              pathTracerRef.current.reset();
              setRaytraceSamples(0);
            }
          })
          .catch((err) => {
            console.warn(`GLB asset load failed, using procedural geometry:`, err);
          });
      } else {
        const objGroup = createFurnitureMesh(obj.type, obj.colorHex, obj.aiParametricDef);
        objGroup.position.set(obj.x, obj.y || 0, obj.z);
        objGroup.rotation.y = obj.rotationY || 0;
        const s = obj.scale || 1.0;
        objGroup.scale.set(s, s, s);
        objGroup.userData = { isCustomObject: true, id: obj.id, name: obj.name, type: obj.type, aiParametricDef: obj.aiParametricDef };

        objGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        group.add(objGroup);
        customObjectMeshesRef.current.set(obj.id, objGroup);
      }
    }


    // 9. Swap procedural boxes for real scanned models wherever the catalog has one. Runs over
    // the finished group so it catches both the auto-furnished rooms and hand-placed pieces,
    // and it runs before the selection ring below so the ring is never one of the children a
    // swap removes.
    mountRealModels(group, () => {
      if (pathTracerRef.current && isRaytracingRef.current) {
        pathTracerRef.current.reset();
        setRaytraceSamples(0);
      }
    });

    // Add Glowing Selection Ring around ANY selected object (custom or built-in)
    if (selectedObjectIdRef.current) {
      group.traverse((child) => {
        if (child.userData && child.userData.id === selectedObjectIdRef.current) {
          const ringGeom = new THREE.RingGeometry(2.3, 2.55, 32);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0xe8912d, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(ringGeom, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.06;
          child.add(ring);
        }
      });
    }

    widthHandle.position.set(wFt, HANDLE_RADIUS_FT, dFt / 2);
    depthHandle.position.set(wFt / 2, HANDLE_RADIUS_FT, dFt);

    // Build Room Orange Resize/Crop Bubbles (just like plot orange bubbles!)
    if (roomHandlesGroupRef.current) {
      const roomHandlesGroup = roomHandlesGroupRef.current;
      while (roomHandlesGroup.children.length > 0) {
        const child = roomHandlesGroup.children[0];
        roomHandlesGroup.remove(child);
      }

      if (modeRef.current !== "walkthrough" && !isLayoutLocked) {
        const handleSphereGeom = new THREE.SphereGeometry(HANDLE_RADIUS_FT * 0.85, 24, 24);
        const handleSphereMat = new THREE.MeshStandardMaterial({
          color: ACCENT,
          emissive: 0x663300,
          roughness: 0.25,
          metalness: 0.3,
        });

        rooms.forEach((room, rIdx) => {
          const rx = inchesToFeet(room.x_in);
          const rz = inchesToFeet(room.y_in);
          const rw = inchesToFeet(room.w_in);
          const rd = inchesToFeet(room.d_in);

          // 1. East (Width) Orange Bubble Handle
          const eastMesh = new THREE.Mesh(handleSphereGeom, handleSphereMat);
          eastMesh.position.set(rx + rw, HANDLE_RADIUS_FT * 0.85, rz + rd / 2);
          eastMesh.userData = { isRoomHandle: true, roomIdx: rIdx, handleType: "E" };
          roomHandlesGroup.add(eastMesh);

          // 2. South (Depth) Orange Bubble Handle
          const southMesh = new THREE.Mesh(handleSphereGeom, handleSphereMat);
          southMesh.position.set(rx + rw / 2, HANDLE_RADIUS_FT * 0.85, rz + rd);
          southMesh.userData = { isRoomHandle: true, roomIdx: rIdx, handleType: "S" };
          roomHandlesGroup.add(southMesh);

          // 3. SE Corner Orange Bubble Handle
          const cornerMesh = new THREE.Mesh(handleSphereGeom, handleSphereMat);
          cornerMesh.position.set(rx + rw, HANDLE_RADIUS_FT * 0.85, rz + rd);
          cornerMesh.userData = { isRoomHandle: true, roomIdx: rIdx, handleType: "SE" };
          roomHandlesGroup.add(cornerMesh);

          // 4. North Orange Bubble Handle
          const northMesh = new THREE.Mesh(handleSphereGeom, handleSphereMat);
          northMesh.position.set(rx + rw / 2, HANDLE_RADIUS_FT * 0.85, rz);
          northMesh.userData = { isRoomHandle: true, roomIdx: rIdx, handleType: "N" };
          roomHandlesGroup.add(northMesh);

          // 5. West Orange Bubble Handle
          const westMesh = new THREE.Mesh(handleSphereGeom, handleSphereMat);
          westMesh.position.set(rx, HANDLE_RADIUS_FT * 0.85, rz + rd / 2);
          westMesh.userData = { isRoomHandle: true, roomIdx: rIdx, handleType: "W" };
          roomHandlesGroup.add(westMesh);
        });
      }
    }

    // Build Custom Wall Orange Crop/Resize Handles
    if (customWallHandlesGroupRef.current) {
      const customWallHandlesGroup = customWallHandlesGroupRef.current;
      while (customWallHandlesGroup.children.length > 0) {
        const child = customWallHandlesGroup.children[0];
        customWallHandlesGroup.remove(child);
      }

      if (modeRef.current !== "walkthrough" && !isLayoutLocked && customWalls && customWalls.length > 0) {
        const wallHandleGeom = new THREE.SphereGeometry(HANDLE_RADIUS_FT * 0.75, 20, 20);
        const wallHandleMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x78350f,
          roughness: 0.2,
          metalness: 0.4,
        });

        for (const wall of customWalls) {
          const elevFt = (wall.floor ?? 0) * (WALL_HEIGHT_FT + 0.8);
          const x1 = inchesToFeet(wall.startXIn);
          const z1 = inchesToFeet(wall.startYIn);
          const x2 = inchesToFeet(wall.endXIn);
          const z2 = inchesToFeet(wall.endYIn);

          const h1 = new THREE.Mesh(wallHandleGeom, wallHandleMat);
          h1.position.set(x1, elevFt + HANDLE_RADIUS_FT * 0.85, z1);
          h1.userData = { isCustomWallHandle: true, wallId: wall.id, endpoint: "start" };
          customWallHandlesGroup.add(h1);

          const h2 = new THREE.Mesh(wallHandleGeom, wallHandleMat);
          h2.position.set(x2, elevFt + HANDLE_RADIUS_FT * 0.85, z2);
          h2.userData = { isCustomWallHandle: true, wallId: wall.id, endpoint: "end" };
          customWallHandlesGroup.add(h2);
        }
      }
    }

    // 9. Custom Freehand Architecture Walls & Room Zones (Build From Scratch Mode)
    if (customWalls && customWalls.length > 0) {
      const customArchGroup = new THREE.Group();
      customArchGroup.name = "customArchitecture";

      const defaultWallMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.85,
        metalness: 0.05,
      });

      // Glazing on custom drawn walls. Brought in line with the window panes and the glazed
      // room walls: transmission rather than alpha, and metalness at zero. At 0.8 metalness a
      // saturated blue this material was rendering every custom window and glass door as tinted
      // sheet metal, which is what glass looks like when you light a metal with it.
      const glassWallMat = new THREE.MeshPhysicalMaterial({
        color: 0xf2f8fb,
        attenuationColor: new THREE.Color(0xbfe3f5),
        attenuationDistance: 1.5,
        transmission: 0.92,
        roughness: 0.06,
        ior: 1.52,
        thickness: 0.25,
        metalness: 0,
        specularIntensity: 1,
        transparent: false,
        side: THREE.DoubleSide,
      });

      const woodSlatMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.6,
      });

      for (const wall of customWalls) {
        const elevFt = (wall.floor ?? 0) * (WALL_HEIGHT_FT + 0.8);
        const x1 = inchesToFeet(wall.startXIn);
        const z1 = inchesToFeet(wall.startYIn);
        const x2 = inchesToFeet(wall.endXIn);
        const z2 = inchesToFeet(wall.endYIn);

        const chordLenFt = Math.hypot(x2 - x1, z2 - z1);
        if (chordLenFt < 0.5) continue;

        const thickFt = (wall.thicknessIn || 9.0) / 12;
        const heightFt = wall.heightFt || WALL_HEIGHT_FT;
        const isCurvedWall = Boolean(
          wall.isCurved ||
          wall.wallType.startsWith("curved") ||
          (wall.curveBulgeIn && Math.abs(wall.curveBulgeIn) > 1)
        );

        const wallMat =
          wall.wallType === "glass" || wall.wallType === "curved_glass"
            ? glassWallMat
            : wall.wallType === "slat" || wall.wallType === "curved_slat"
            ? woodSlatMat
            : defaultWallMat;

        const wallGroup = new THREE.Group();

        if (isCurvedWall) {
          // Render Smooth Procedural Curved Arc Wall
          const numArcSegs = 20;
          const arcPoints = getCurvedWallArcPoints(wall, numArcSegs);

          for (let s = 0; s < arcPoints.length - 1; s++) {
            const p1 = arcPoints[s];
            const p2 = arcPoints[s + 1];

            const p1x = inchesToFeet(p1.x);
            const p1z = inchesToFeet(p1.y);
            const p2x = inchesToFeet(p2.x);
            const p2z = inchesToFeet(p2.y);

            const segLen = Math.hypot(p2x - p1x, p2z - p1z) + 0.02;
            const segMidX = (p1x + p2x) / 2;
            const segMidZ = (p1z + p2z) / 2;
            const segAngle = -Math.atan2(p2z - p1z, p2x - p1x);

            const segMesh = new THREE.Mesh(
              new THREE.BoxGeometry(segLen, heightFt, thickFt),
              wallMat
            );
            segMesh.position.set(segMidX, elevFt + heightFt / 2, segMidZ);
            segMesh.rotation.y = segAngle;
            segMesh.castShadow = true;
            segMesh.receiveShadow = true;
            segMesh.userData = { isCustomWall: true, id: wall.id, isWall: true, name: `${wall.wallType} Curved Wall` };
            wallGroup.add(segMesh);

            // If slat wall, add vertical slats
            if (wall.wallType === "curved_slat") {
              const slat = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, heightFt - 0.3, thickFt + 0.1),
                woodSlatMat
              );
              slat.position.set(segMidX, elevFt + heightFt / 2, segMidZ);
              slat.rotation.y = segAngle;
              wallGroup.add(slat);
            }
          }
        } else {
          // Straight Wall Logic
          const midX = (x1 + x2) / 2;
          const midZ = (z1 + z2) / 2;
          const angle = -Math.atan2(z2 - z1, x2 - x1);
          wallGroup.position.set(midX, elevFt, midZ);
          wallGroup.rotation.y = angle;

          const openings = wall.openings || [];
          if (openings.length === 0) {
            const wallMesh = new THREE.Mesh(
              new THREE.BoxGeometry(chordLenFt, heightFt, thickFt),
              wallMat
            );
            wallMesh.position.set(0, heightFt / 2, 0);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            wallMesh.userData = { isCustomWall: true, id: wall.id, isWall: true, name: `${wall.wallType} Wall` };
            wallGroup.add(wallMesh);
          } else {
            // Segmented wall around openings
            const sortedOps = [...openings].sort((a, b) => a.offsetIn - b.offsetIn);
            let currentOffsetIn = 0;
            const totalLenIn = chordLenFt * 12;

            for (const op of sortedOps) {
              const opStartIn = Math.max(currentOffsetIn, Math.min(totalLenIn, op.offsetIn));
              const opEndIn = Math.min(totalLenIn, opStartIn + op.widthIn);

              // Left solid segment
              const segLenIn = opStartIn - currentOffsetIn;
              if (segLenIn > 2) {
                const segLenFt = segLenIn / 12;
                const segCenterIn = currentOffsetIn + segLenIn / 2;
                const segCenterFt = segCenterIn / 12 - chordLenFt / 2;

                const segMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(segLenFt, heightFt, thickFt),
                  wallMat
                );
                segMesh.position.set(segCenterFt, heightFt / 2, 0);
                segMesh.castShadow = true;
                segMesh.receiveShadow = true;
                segMesh.userData = { isCustomWall: true, id: wall.id, isWall: true };
                wallGroup.add(segMesh);
              }

              // Top Lintel over opening
              const opWidthFt = (opEndIn - opStartIn) / 12;
              const opCenterIn = (opStartIn + opEndIn) / 2;
              const opCenterFt = opCenterIn / 12 - chordLenFt / 2;
              const opHeightFt = (op.heightIn || 84) / 12;
              const lintelHeightFt = Math.max(0.5, heightFt - opHeightFt - ((op.sillIn || 0) / 12));

              if (lintelHeightFt > 0.2) {
                const lintelMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(opWidthFt, lintelHeightFt, thickFt),
                  wallMat
                );
                lintelMesh.position.set(opCenterFt, heightFt - lintelHeightFt / 2, 0);
                lintelMesh.castShadow = true;
                lintelMesh.userData = { isCustomWall: true, id: wall.id, isWall: true };
                wallGroup.add(lintelMesh);
              }

              // Bottom Sill (if window)
              if (op.sillIn && op.sillIn > 0) {
                const sillHeightFt = op.sillIn / 12;
                const sillMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(opWidthFt, sillHeightFt, thickFt),
                  wallMat
                );
                sillMesh.position.set(opCenterFt, sillHeightFt / 2, 0);
                sillMesh.castShadow = true;
                sillMesh.userData = { isCustomWall: true, id: wall.id, isWall: true };
                wallGroup.add(sillMesh);
              }

              // Specialized Door / Window / Arch Leaf in 3D
              if (op.kind === "arch_door") {
                // Roman Arch Transom & Door
                const archTransom = new THREE.Mesh(
                  new THREE.CylinderGeometry(opWidthFt / 2, opWidthFt / 2, 0.2, 20, 1, false, 0, Math.PI),
                  woodSlatMat
                );
                archTransom.rotation.z = Math.PI / 2;
                archTransom.rotation.y = Math.PI / 2;
                archTransom.position.set(opCenterFt, opHeightFt, 0);
                wallGroup.add(archTransom);

                const doorLeaf = new THREE.Mesh(
                  new THREE.BoxGeometry(opWidthFt - 0.1, opHeightFt - 0.1, 0.15),
                  new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45 })
                );
                doorLeaf.position.set(opCenterFt, opHeightFt / 2, 0);
                wallGroup.add(doorLeaf);
              } else if (op.kind === "curved_window") {
                // Bow Curved Window Projection
                const bowGlass = new THREE.Mesh(
                  new THREE.CylinderGeometry(opWidthFt / 1.5, opWidthFt / 1.5, opHeightFt, 16, 1, true, 0, Math.PI * 0.7),
                  glassWallMat
                );
                bowGlass.position.set(opCenterFt, (op.sillIn ? op.sillIn / 12 : 0) + opHeightFt / 2, 0.3);
                wallGroup.add(bowGlass);
              } else if (op.kind === "sliding_door") {
                // Twin bypassing panels on two tracks, the way the reference frontage reads: the
                // leaves overlap at the centre and sit on slightly different planes, rather than
                // meeting edge to edge like a pair of french doors.
                const trackMat = new THREE.MeshStandardMaterial({
                  color: 0x0d0f12,
                  roughness: 0.35,
                  metalness: 0.65,
                });
                const railT = 0.09;
                const stileT = 0.07;

                for (const trackY of [opHeightFt - railT / 2, railT / 2]) {
                  const track = new THREE.Mesh(
                    new THREE.BoxGeometry(opWidthFt, railT, 0.34),
                    trackMat
                  );
                  track.position.set(opCenterFt, trackY, 0);
                  track.castShadow = true;
                  wallGroup.add(track);
                }

                // Each leaf covers a little over half the opening so the pair closes on an
                // overlap at the centre, which is what makes a slider a slider.
                const leafW = (opWidthFt / 2) * 1.08;
                const leafH = opHeightFt - railT * 2;
                for (const side of [-1, 1]) {
                  const leafX = opCenterFt + side * (opWidthFt / 2 - leafW / 2);
                  const leafZ = side * 0.075;

                  const pane = new THREE.Mesh(
                    new THREE.BoxGeometry(leafW - stileT * 2, leafH - stileT * 2, 0.05),
                    glassWallMat
                  );
                  pane.position.set(leafX, opHeightFt / 2, leafZ);
                  wallGroup.add(pane);

                  for (const sx of [-1, 1]) {
                    const stile = new THREE.Mesh(
                      new THREE.BoxGeometry(stileT, leafH, 0.11),
                      trackMat
                    );
                    stile.position.set(leafX + sx * (leafW / 2 - stileT / 2), opHeightFt / 2, leafZ);
                    stile.castShadow = true;
                    wallGroup.add(stile);
                  }
                  for (const sy of [-1, 1]) {
                    const rail = new THREE.Mesh(
                      new THREE.BoxGeometry(leafW, stileT, 0.11),
                      trackMat
                    );
                    rail.position.set(leafX, opHeightFt / 2 + sy * (leafH / 2 - stileT / 2), leafZ);
                    rail.castShadow = true;
                    wallGroup.add(rail);
                  }

                  // Flush vertical pull on the leading edge of each leaf.
                  const pull = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, 1.5, 0.05),
                    trackMat
                  );
                  pull.position.set(
                    leafX - side * (leafW / 2 - stileT * 2.2),
                    opHeightFt * 0.46,
                    leafZ + 0.09
                  );
                  wallGroup.add(pull);
                }
              } else if (op.kind === "revolving_door") {
                // Revolving Door Cylinder
                const revDrum = new THREE.Mesh(
                  new THREE.CylinderGeometry(opWidthFt / 2, opWidthFt / 2, opHeightFt, 20, 1, true),
                  glassWallMat
                );
                revDrum.position.set(opCenterFt, opHeightFt / 2, 0);
                wallGroup.add(revDrum);
              } else if (op.kind === "door" || op.kind === "entrance") {
                const globalDoorColorHex = resolveDoorColorHex(materialConfigRef.current.globalDoorColor);
                const doorLeafMat = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(globalDoorColorHex),
                  roughness: 0.45,
                });
                const doorLeaf = new THREE.Mesh(
                  new THREE.BoxGeometry(opWidthFt - 0.1, opHeightFt - 0.1, 0.15),
                  doorLeafMat
                );
                doorLeaf.position.set(opCenterFt, opHeightFt / 2, 0);
                wallGroup.add(doorLeaf);
              } else if (op.kind === "window") {
                const winGlass = new THREE.Mesh(
                  new THREE.BoxGeometry(opWidthFt - 0.1, opHeightFt - 0.1, 0.08),
                  glassWallMat
                );
                winGlass.position.set(opCenterFt, (op.sillIn ? op.sillIn / 12 : 0) + opHeightFt / 2, 0);
                wallGroup.add(winGlass);
              }

              currentOffsetIn = opEndIn;
            }

            // Trailing solid segment
            if (currentOffsetIn < totalLenIn - 2) {
              const segLenIn = totalLenIn - currentOffsetIn;
              const segLenFt = segLenIn / 12;
              const segCenterIn = currentOffsetIn + segLenIn / 2;
              const segCenterFt = segCenterIn / 12 - chordLenFt / 2;

              const segMesh = new THREE.Mesh(
                new THREE.BoxGeometry(segLenFt, heightFt, thickFt),
                wallMat
              );
              segMesh.position.set(segCenterFt, heightFt / 2, 0);
              segMesh.castShadow = true;
              segMesh.receiveShadow = true;
              segMesh.userData = { isCustomWall: true, id: wall.id, isWall: true };
              wallGroup.add(segMesh);
            }
          }
        }

        customArchGroup.add(wallGroup);
      }
      group.add(customArchGroup);
    }

    // Render Custom Room Zones Floor Slabs in 3D
    if (customRoomZones && customRoomZones.length > 0) {
      for (const zone of customRoomZones) {
        const elevFt = (zone.floor ?? 0) * (WALL_HEIGHT_FT + 0.8);
        const zx = inchesToFeet(zone.xIn);
        const zz = inchesToFeet(zone.yIn);
        const zw = inchesToFeet(zone.wIn);
        const zd = inchesToFeet(zone.dIn);

        const floorMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.4,
        });

        const floorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(zw, 0.1, zd),
          floorMat
        );
        floorMesh.position.set(zx + zw / 2, elevFt + 0.05, zz + zd / 2);
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        // 3D Room Label Floating Badge
        const badge = makeRoomBadgeSprite(
          zone.customLabel || zone.name
        );
        badge.position.set(zx + zw / 2, elevFt + WALL_HEIGHT_FT + 1.8, zz + zd / 2);
        group.add(badge);
      }
    }

    // Render Intermediate Multi-Floor Slabs if Upper Storeys Exist
    const allFloors = [
      ...(customWalls || []).map((w) => w.floor ?? 0),
      ...(customRoomZones || []).map((z) => z.floor ?? 0),
    ];
    const maxFloor = Math.max(...allFloors, 0);
    if (maxFloor >= 1) {
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8,
      });
      for (let f = 1; f <= maxFloor; f++) {
        const slabElevFt = f * (WALL_HEIGHT_FT + 0.8);
        const slabMesh = new THREE.Mesh(
          new THREE.BoxGeometry(wFt - envMinX * 1.5, 0.5, dFt - envMinZ * 1.5),
          slabMat
        );
        slabMesh.position.set(wFt / 2, slabElevFt - 0.25, dFt / 2);
        slabMesh.receiveShadow = true;
        group.add(slabMesh);
      }
    }
  }, [
    plot,
    facing,
    setback,
    rooms,
    customWalls,
    customRoomZones,
    furnished,
    customObjects,
    deletedBuiltinIds,
    selectedObjectId,
    materialConfig,
    windowConfig,
    isLayoutLocked,
    graphicsSettings,
    isDollhouseCutaway,
    isUpgraded,
  ]);

  // Ghost Furniture Placement Preview Handler
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (placingGhostGroupRef.current) {
      scene.remove(placingGhostGroupRef.current);
      placingGhostGroupRef.current = null;
    }

    if (placingItemType) {
      const ghost = createFurnitureMesh(placingItemType);
      ghost.rotation.y = modeRef.current === "walkthrough"
        ? playerRef.current.yaw + Math.PI + (placingRotationY || 0)
        : (placingRotationY || 0);
      ghost.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = Array.isArray(child.material) ? child.material[0] : child.material;
          const origColor = mat && "color" in mat ? (mat.color as THREE.Color).getHex() : 0xe8912d;
          child.material = new THREE.MeshStandardMaterial({
            color: origColor,
            emissive: 0x553300,
            transparent: true,
            opacity: 0.6,
          });
        }
      });
      ghost.visible = false;
      scene.add(ghost);
      placingGhostGroupRef.current = ghost;
    }
  }, [placingItemType, placingRotationY]);

  useEffect(() => {
    if (placingGhostGroupRef.current) {
      placingGhostGroupRef.current.rotation.y = modeRef.current === "walkthrough"
        ? playerRef.current.yaw + Math.PI + (placingRotationY || 0)
        : (placingRotationY || 0);
    }
  }, [placingRotationY]);

  const handle3DDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handle3DDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
    if (!rawData) return;

    let payload: {
      type?: string;
      shapeId?: WindowShapeId;
      kind?: "door" | "window" | "entrance" | "opening";
      category?: "door" | "window";
      widthIn?: number;
      heightIn?: number;
      sillIn?: number;
      name?: string;
      icon?: string;
    } | null = null;

    try {
      payload = JSON.parse(rawData);
    } catch {
      if (typeof rawData === "string" && rawData.length > 0) {
        payload = {
          type: "window_style",
          shapeId: rawData as WindowShapeId,
        };
      }
    }

    if (!payload) return;

    if (!rendererRef.current || !cameraRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();

    // 1. If dropping a window style onto an EXISTING 3D window:
    if (payload.shapeId && groupRef.current) {
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== groupRef.current) {
          if (curr.userData && (curr.userData.isWindow || curr.userData.type === "window")) {
            const winId = curr.userData.id;
            if (winId) {
              const nextConfig: WindowConfig = {
                ...windowConfigRef.current,
                individualOverrides: {
                  ...(windowConfigRef.current.individualOverrides || {}),
                  [winId]: {
                    ...(windowConfigRef.current.individualOverrides?.[winId] || {}),
                    shape: payload.shapeId,
                  },
                },
              };
              windowConfigRef.current = nextConfig;
              onChangeWindowConfigRef.current?.(nextConfig);
              setDrafting3DDescription(`✨ Applied ${payload.name || payload.shapeId} shape to ${curr.userData.name || "Window"}!`);
              setTimeout(() => setDrafting3DDescription(null), 3000);
              return;
            }
          }
          curr = curr.parent;
        }
      }
    }

    // 2. If dropping onto a wall (custom wall or room wall):
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      let closestCustomHit: { wall: CustomDrawnWall; offsetIn: number } | null = null;
      let closestRoomHit: { roomIndex: number; edge: "N" | "S" | "E" | "W"; offsetIn: number } | null = null;
      let closestDist = 4.0; // feet

      // Check Custom Walls
      for (const w of (customWallsRef.current || [])) {
        const x1 = inchesToFeet(w.startXIn);
        const z1 = inchesToFeet(w.startYIn);
        const x2 = inchesToFeet(w.endXIn);
        const z2 = inchesToFeet(w.endYIn);
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.5) continue;

        const t = Math.max(0, Math.min(1, ((hitPoint.x - x1) * dx + (hitPoint.z - z1) * dz) / (len * len)));
        const projX = x1 + t * dx;
        const projZ = z1 + t * dz;
        const dist = Math.hypot(hitPoint.x - projX, hitPoint.z - projZ);

        if (dist < closestDist) {
          closestDist = dist;
          closestCustomHit = {
            wall: w,
            offsetIn: Math.round(t * len * 12),
          };
          closestRoomHit = null;
        }
      }

      // Check Solved Room Perimeter Walls
      for (let rIdx = 0; rIdx < roomsRef.current.length; rIdx++) {
        const r = roomsRef.current[rIdx];
        if ((r.floor ?? 0) !== (activeFloorRef.current || 0)) continue;

        const wallEdges: Array<{ edge: "N" | "S" | "E" | "W"; x1: number; z1: number; x2: number; z2: number; lenIn: number }> = [
          { edge: "N", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in), lenIn: r.w_in },
          { edge: "S", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in + r.d_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.w_in },
          { edge: "W", x1: inchesToFeet(r.x_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.d_in },
          { edge: "E", x1: inchesToFeet(r.x_in + r.w_in), z1: inchesToFeet(r.y_in), x2: inchesToFeet(r.x_in + r.w_in), z2: inchesToFeet(r.y_in + r.d_in), lenIn: r.d_in },
        ];

        for (const we of wallEdges) {
          const dx = we.x2 - we.x1;
          const dz = we.z2 - we.z1;
          const lenFt = Math.hypot(dx, dz);
          if (lenFt < 0.5) continue;

          const t = Math.max(0, Math.min(1, ((hitPoint.x - we.x1) * dx + (hitPoint.z - we.z1) * dz) / (lenFt * lenFt)));
          const projX = we.x1 + t * dx;
          const projZ = we.z1 + t * dz;
          const dist = Math.hypot(hitPoint.x - projX, hitPoint.z - projZ);

          if (dist < closestDist) {
            closestDist = dist;
            closestRoomHit = {
              roomIndex: rIdx,
              edge: we.edge,
              offsetIn: Math.round(t * we.lenIn),
            };
            closestCustomHit = null;
          }
        }
      }

      const isWindow = payload.category === "window" || payload.type === "window_style" || payload.kind === "window" || Boolean(payload.shapeId);
      const kind: "door" | "window" | "entrance" | "opening" = payload.kind || (isWindow ? "window" : "door");
      const widthIn = payload.widthIn || (isWindow ? 48 : 36);
      const heightIn = payload.heightIn || (isWindow ? 48 : 84);
      const sillIn = payload.sillIn !== undefined ? payload.sillIn : (isWindow ? 36 : 0);

      if (closestCustomHit) {
        const newOpening: CustomWallOpening = {
          id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          kind,
          offsetIn: Math.max(0, closestCustomHit.offsetIn - widthIn / 2),
          widthIn,
          heightIn,
          sillIn,
        };
        const updated = (customWallsRef.current || []).map((cw) =>
          cw.id === closestCustomHit!.wall.id ? { ...cw, openings: [...(cw.openings || []), newOpening] } : cw
        );
        customWallsRef.current = updated;
        onChangeCustomWallsRef.current?.(updated);
        setDrafting3DDescription(`✨ Dropped 3D ${payload.name || (isWindow ? "Window" : "Door")} onto Wall!`);
        setTimeout(() => setDrafting3DDescription(null), 3000);
        return;
      }

      if (closestRoomHit) {
        const rIdx = closestRoomHit.roomIndex;
        const room = roomsRef.current[rIdx];
        if (room) {
          const roomId = `${room.name}_${rIdx}`;
          const currentOps = customOpeningsRef.current[roomId] !== undefined ? customOpeningsRef.current[roomId] : (room.openings || []);
          const wallLengthIn = closestRoomHit.edge === "N" || closestRoomHit.edge === "S" ? room.w_in : room.d_in;
          const offsetIn = Math.max(0, Math.min(wallLengthIn - widthIn, closestRoomHit.offsetIn - widthIn / 2));

          const newOp: RoomOpening = {
            kind,
            edge: closestRoomHit.edge,
            offset_in: offsetIn,
            width_in: widthIn,
            height_in: heightIn,
            sill_in: sillIn,
          };

          const nextOps = [
            ...currentOps.filter((o) => !(o.edge === closestRoomHit!.edge && Math.abs(o.offset_in - offsetIn) < 12)),
            newOp,
          ];

          const nextCustomOpenings: Record<string, RoomOpening[]> = {
            ...(customOpeningsRef.current || {}),
            [roomId]: nextOps,
          };

          const adj = findAdjacentRoomEdge(roomsRef.current, rIdx, closestRoomHit.edge);
          if (adj && (kind === "door" || kind === "opening")) {
            const adjId = `${roomsRef.current[adj.adjIndex]?.name}_${adj.adjIndex}`;
            const adjRoom = roomsRef.current[adj.adjIndex];
            if (adjRoom) {
              const adjOps = customOpeningsRef.current[adjId] !== undefined ? customOpeningsRef.current[adjId] : (adjRoom.openings || []);
              const adjNextOps = [
                ...adjOps.filter((o) => !(o.edge === adj.adjEdge && Math.abs(o.offset_in - offsetIn) < 12)),
                {
                  ...newOp,
                  edge: adj.adjEdge,
                },
              ];
              nextCustomOpenings[adjId] = adjNextOps;
            }
          }

          customOpeningsRef.current = nextCustomOpenings;
          onChangeCustomOpeningsRef.current?.(nextCustomOpenings);

          if (payload.shapeId) {
            const winId = `win_${rIdx}_${closestRoomHit.edge}`;
            const nextWindowConfig: WindowConfig = {
              ...windowConfigRef.current,
              individualOverrides: {
                ...(windowConfigRef.current.individualOverrides || {}),
                [winId]: {
                  ...(windowConfigRef.current.individualOverrides?.[winId] || {}),
                  shape: payload.shapeId,
                },
              },
            };
            windowConfigRef.current = nextWindowConfig;
            onChangeWindowConfigRef.current?.(nextWindowConfig);
          }

          setDrafting3DDescription(`✨ Dropped 3D ${payload.name || (isWindow ? "Window" : "Door")} on ${ROOM_LABELS[room.name as RoomName] || room.name}!`);
          setTimeout(() => setDrafting3DDescription(null), 3000);
          return;
        }
      }
    }
  };

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      onDragOver={handle3DDragOver}
      onDrop={handle3DDrop}
    >
      {/* Floating 3D Object Quick Action Menu */}
      {selectedObjectInfo && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.94)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
            padding: "8px 18px",
            borderRadius: "30px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 40,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>🛋️</span>
            <span style={{ fontSize: "12.5px", fontWeight: "bold", color: "#fbbf24" }}>
              {selectedObjectInfo.name}
            </span>
            {selectedObjectInfo.isBuiltin && (
              <span
                style={{
                  fontSize: "9px",
                  background: "rgba(148, 163, 184, 0.2)",
                  color: "#cbd5e1",
                  padding: "1px 6px",
                  borderRadius: "4px",
                }}
              >
                Default
              </span>
            )}
          </div>

          <div style={{ height: "16px", width: "1px", background: "rgba(255,255,255,0.15)" }} />

          <button
            style={{
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.35))",
              border: "1px solid rgba(56, 189, 248, 0.5)",
              color: "#38bdf8",
              padding: "4px 12px",
              borderRadius: "14px",
              fontSize: "11.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={onRequestReplace}
            title="Replace this object with a different piece of furniture"
          >
            🔄 Replace...
          </button>

          <button
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f1f5f9",
              padding: "4px 10px",
              borderRadius: "14px",
              fontSize: "11.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => onRotateSelected && onRotateSelected(Math.PI / 4)}
            title="Rotate 45° (or press R)"
          >
            🔄 45°
          </button>

          <button
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.45)",
              color: "#ef4444",
              padding: "4px 12px",
              borderRadius: "14px",
              fontSize: "11.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={onRequestDelete}
            title="Delete this object from the house"
          >
            🗑️ Delete
          </button>

          <button
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "14px",
              padding: "0 4px",
            }}
            onClick={() => onSelectObject && onSelectObject(null)}
            title="Deselect (ESC)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-Time Performance & VRAM HUD (Toggleable in Graphics Controls) */}
      {graphicsSettings?.showPerformanceHUD && (
        <div
          style={{
            position: "absolute",
            top: mode === "orbit" ? 64 : 14,
            left: 14,
            background: "rgba(8, 14, 28, 0.90)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "10px",
            padding: "6px 10px",
            zIndex: 45,
            backdropFilter: "blur(8px)",
            color: "#f8fafc",
            fontFamily: "monospace",
            fontSize: "11px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            pointerEvents: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ color: "#34d399", fontWeight: "bold" }}>⚡ {currentFps} FPS</span>
            <span style={{ color: "#94a3b8" }}>{currentFrameTime} ms</span>
            <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{renderRes}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "10px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "2px" }}>
            <span style={{ color: "#cbd5e1" }}>GPU: Dedicated (High VRAM)</span>
            <span style={{ color: "#f59e0b" }}>~{estimateVRAMUsageGB(graphicsSettings)} GB VRAM</span>
          </div>
        </div>
      )}

      {/* 3D CAD Drafting Studio Toolbar (Orbit Mode) */}
      {mode === "orbit" && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            background: "rgba(10, 25, 48, 0.92)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "12px",
            padding: "6px 8px",
            zIndex: 40,
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            alignItems: "center",
          }}
        >
          {/* 3D Floor Level Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "2px 4px", marginRight: "4px" }}>
            {[
              { floor: 0, short: "G 🏡", title: "Ground Floor" },
              { floor: 1, short: "1F 🏢", title: "1st Floor" },
              { floor: 2, short: "2F 🏙️", title: "2nd Floor" },
              { floor: 3, short: "Roof ☀️", title: "Terrace / Roof" },
            ].map((fl) => (
              <button
                key={fl.floor}
                style={{
                  background: activeFloor === fl.floor ? "#0284c7" : "transparent",
                  color: activeFloor === fl.floor ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "5px",
                  padding: "3px 7px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => {
                  draftWallStartFtRef.current = null;
                  setDraftWallStartFt(null);
                  onChangeActiveFloor?.(fl.floor);
                }}
                title={`Switch 3D Drafting Elevation to ${fl.title}`}
              >
                {fl.short}
              </button>
            ))}
          </div>

          <button
            style={{
              background: isDollhouseCutaway ? "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: isDollhouseCutaway ? "1px solid #38bdf8" : "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: isDollhouseCutaway ? "0 0 12px rgba(56, 189, 248, 0.4)" : "none",
            }}
            onClick={() => setIsDollhouseCutaway((prev) => !prev)}
            title="Toggle 3D Architectural Cutaway / Dollhouse View (Matches Reference Studio Photo)"
          >
            🏠 {isDollhouseCutaway ? "Cutaway View" : "Full Walls"}
          </button>

          {onToggleUpgrade && (
            <button
              style={{
                background: isUpgraded
                  ? "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)"
                  : "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: isUpgraded ? "1px solid #f472b6" : "1px solid rgba(244, 114, 182, 0.4)",
                padding: "5px 11px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: isUpgraded ? "0 0 14px rgba(236, 72, 153, 0.5)" : "none",
                letterSpacing: "0.4px",
              }}
              onClick={onToggleUpgrade}
              title="Toggle Photorealistic Studio Upgrade (Curved Bouclé Cloud Sofas, Custom Library Shelving, Herringbone Oak Parquet & Wainscoting)"
            >
              {isUpgraded ? "✨ UPGRADE ON" : "✨ UPGRADE"}
            </button>
          )}

          <button
            style={{
              background: lightsOn
                ? "linear-gradient(135deg, rgba(234, 179, 8, 0.35) 0%, rgba(249, 115, 22, 0.35) 100%)"
                : "linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.85) 100%)",
              color: lightsOn ? "#fef08a" : "#94a3b8",
              border: lightsOn ? "1px solid #f59e0b" : "1px solid rgba(148, 163, 184, 0.4)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: lightsOn ? "0 0 12px rgba(245, 158, 11, 0.35)" : "none",
            }}
            onClick={onToggleLights}
            title={lightsOn ? "Switch to Dark / Night Mode (Atmospheric Moon & Spotlights)" : "Switch to Light / Day Mode (Clear Blue Sky & Radiant Sun)"}
          >
            {lightsOn ? "☀️ Day (Light)" : "🌙 Night (Dark)"}
          </button>

          <button
            style={{
              background: activeCadTool === "select" ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              draftWallStartFtRef.current = null;
              setDraftWallStartFt(null);
              setDrafting3DDescription(null);
              if (draftGhost3DWallRef.current) draftGhost3DWallRef.current.visible = false;
              onChangeCadTool?.("select");
            }}
            title="3D Select Tool (V)"
          >
            ↖ 3D Select
          </button>

          <button
            style={{
              background: activeCadTool === "draw_wall" ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              draftWallStartFtRef.current = null;
              setDraftWallStartFt(null);
              onChangeCadTool?.("draw_wall");
            }}
            title="Point-and-click to erect 3D walls on ground plane (W)"
          >
            ✏️ 3D Wall
          </button>

          {activeCadTool === "draw_wall" && (
            <select
              value={activeWallType}
              onChange={(e) => onChangeWallType?.(e.target.value as CustomWallType)}
              style={{
                background: "rgba(15, 23, 42, 0.95)",
                color: "#38bdf8",
                border: "1px solid #38bdf8",
                borderRadius: "6px",
                padding: "3px 6px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <option value="exterior">🧱 9" Ext Wall</option>
              <option value="interior">🧱 4.5" Int Wall</option>
              <option value="glass">🪟 3" Glass Wall</option>
              <option value="slat">🪵 3.5" Wood Slat</option>
              <option value="arch">🏛️ 6" Arch Divider</option>
            </select>
          )}

          <button
            style={{
              background: activeCadTool === "place_door" ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              draftWallStartFtRef.current = null;
              setDraftWallStartFt(null);
              if (draftGhost3DWallRef.current) draftGhost3DWallRef.current.visible = false;
              onChangeCadTool?.("place_door");
            }}
            title="Click any 3D wall to cut and insert a 3D Door (D)"
          >
            🚪 3D Door
          </button>

          <button
            style={{
              background: activeCadTool === "place_window" ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              draftWallStartFtRef.current = null;
              setDraftWallStartFt(null);
              if (draftGhost3DWallRef.current) draftGhost3DWallRef.current.visible = false;
              onChangeCadTool?.("place_window");
            }}
            title="Click any 3D wall to cut and insert a 3D Window (Win)"
          >
            🪟 3D Window
          </button>

          <button
            style={{
              background: activeCadTool === "tag_room" ? "#0284c7" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              setDraftWallStartFt(null);
              if (draftGhost3DWallRef.current) draftGhost3DWallRef.current.visible = false;
              onChangeCadTool?.("tag_room");
            }}
            title="Click inside 3D walls to tag room zone"
          >
            🏷️ 3D Room Tag
          </button>

          {onStartFromScratch && (
            <button
              style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))",
                border: "1px solid rgba(245, 158, 11, 0.5)",
                color: "#fbbf24",
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={onStartFromScratch}
              title="Start with blank plot in 3D"
            >
              🏗️ Blank 3D
            </button>
          )}

          {customWalls && customWalls.length > 0 && (
            <button
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                fontSize: "11px",
                padding: "5px 8px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onClick={() => {
                if (confirm("Clear all custom drawn walls in 3D?")) {
                  onChangeCustomWalls?.([]);
                  onChangeCustomRoomZones?.([]);
                }
              }}
              title="Clear custom walls"
            >
              🗑️ ({customWalls.length})
            </button>
          )}

          {onToggleLayoutLock && (
            <button
              onClick={onToggleLayoutLock}
              style={{
                background: isLayoutLocked ? "rgba(2, 132, 199, 0.92)" : "rgba(255, 255, 255, 0.08)",
                border: isLayoutLocked ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title={isLayoutLocked ? "3D View is Locked (Press 'L')" : "3D View is Edit Mode (Press 'L')"}
            >
              {isLayoutLocked ? "🔒 Locked" : "🔓 Edit"}
            </button>
          )}
        </div>
      )}

      {/* 3D Real-Time Drafting Banner */}
      {drafting3DDescription && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10, 25, 48, 0.95)",
            border: "1px solid #38bdf8",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            color: "#38bdf8",
            fontWeight: "bold",
            padding: "8px 20px",
            borderRadius: "20px",
            zIndex: 100,
            fontSize: "12.5px",
            pointerEvents: "none",
          }}
        >
          {drafting3DDescription}
        </div>
      )}

      {draggedRoomInfo && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            background: draggedRoomInfo.isCropped
              ? "linear-gradient(135deg, rgba(245, 158, 11, 0.96), rgba(217, 119, 6, 0.96))"
              : "rgba(0, 229, 255, 0.95)",
            color: "#051119",
            fontWeight: "bold",
            padding: "9px 24px",
            borderRadius: "20px",
            boxShadow: draggedRoomInfo.isCropped
              ? "0 4px 24px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0,0,0,0.4)"
              : "0 4px 24px rgba(0,0,0,0.5)",
            border: draggedRoomInfo.isCropped ? "1px solid rgba(254, 240, 138, 0.8)" : "none",
            zIndex: 100,
            pointerEvents: "none",
            fontSize: "13px",
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {draggedRoomInfo.isCropped ? (
            <>
              ✂️ <span>Cropping <strong>{ROOM_LABELS[draggedRoomInfo.name as RoomName] ?? draggedRoomInfo.name}</strong> to Map: <strong>{draggedRoomInfo.cropWFt}&apos; × {draggedRoomInfo.cropDFt}&apos;</strong></span>
            </>
          ) : (
            <>
              📍 <span>Dragging <strong>{ROOM_LABELS[draggedRoomInfo.name as RoomName] ?? draggedRoomInfo.name}</strong> — Release to place &amp; auto-connect door!</span>
            </>
          )}
        </div>
      )}

      {/* First-Person Walkthrough Targeting Reticle */}
      {mode === "walkthrough" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "7px",
            height: "7px",
            background: "rgba(255, 255, 255, 0.8)",
            border: "1.5px solid rgba(0, 0, 0, 0.6)",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            boxShadow: "0 0 10px rgba(0, 0, 0, 0.6)",
            zIndex: 35,
          }}
        />
      )}

      {smartSnapDescription && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.95), rgba(15, 23, 42, 0.98))",
            border: "1.5px solid #38bdf8",
            boxShadow: "0 0 24px rgba(56, 189, 248, 0.6), 0 8px 32px rgba(0, 0, 0, 0.6)",
            color: "#ffffff",
            fontWeight: 800,
            padding: "9px 24px",
            borderRadius: "22px",
            zIndex: 110,
            pointerEvents: "none",
            fontSize: "13px",
            letterSpacing: "0.03em",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: "16px" }}>🧲</span>
          <span>{smartSnapDescription}</span>
          <span
            style={{
              fontSize: "10.5px",
              background: "rgba(56, 189, 248, 0.25)",
              padding: "2px 7px",
              borderRadius: "10px",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              color: "#e0f2fe",
            }}
          >
            Auto-Positioned
          </span>
        </div>
      )}

      {doorAlert && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(34, 197, 94, 0.95)",
            color: "#ffffff",
            fontWeight: "bold",
            padding: "9px 22px",
            borderRadius: "20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            zIndex: 100,
            pointerEvents: "none",
            fontSize: "13px",
            letterSpacing: "0.02em",
          }}
        >
          {doorAlert}
        </div>
      )}

      {/* Real-Time GPU Path Tracer Loading Modal */}
      {isRaytraceBuilding && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10, 15, 29, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 150,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              border: "3px solid rgba(56, 189, 248, 0.2)",
              borderTopColor: "#38bdf8",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "0.03em" }}>
            Building BVH Acceleration Geometry Tree...
          </span>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Preparing hardware raytracing buffers &amp; light sources
          </span>
        </div>
      )}

      {/* Real-Time GPU Path Tracer HUD */}
      {isRaytracing && !isRaytraceBuilding && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92))",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.25)",
            color: "#ffffff",
            padding: "10px 20px",
            borderRadius: "16px",
            zIndex: 120,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            backdropFilter: "blur(12px)",
            minWidth: "460px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "15px" }}>📸</span>
              <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.03em" }}>
                GPU Path Tracer
              </span>
              <span
                style={{
                  fontSize: "11px",
                  background: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 600,
                }}
              >
                Sample {raytraceSamples} / {raytraceTargetSamples}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => {
                  const renderer = rendererRef.current;
                  if (!renderer) return;
                  const dataUrl = renderer.domElement.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = dataUrl;
                  a.download = `architectural_raytrace_${Date.now()}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                style={{
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  border: "1px solid #38bdf8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                💾 Save 4K PNG
              </button>

              <button
                onClick={() => {
                  if (pathTracerRef.current) {
                    pathTracerRef.current.reset();
                    setRaytraceSamples(0);
                  }
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                title="Restart light accumulation"
              >
                🔄 Reset
              </button>

              <button
                onClick={() => onToggleRaytraceRef.current?.()}
                style={{
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  color: "#fca5a5",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                title="Exit Path Tracer (Press 'P')"
              >
                ✕ Exit (P)
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: "4px",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (raytraceSamples / raytraceTargetSamples) * 100)}%`,
                background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                transition: "width 0.15s ease",
              }}
            />
          </div>

          {/* Preset buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Quality:</span>
              {[25, 60, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRaytraceTargetSamples(s);
                    targetSamplesRef.current = s;
                  }}
                  style={{
                    background: raytraceTargetSamples === s ? "rgba(56, 189, 248, 0.3)" : "transparent",
                    color: raytraceTargetSamples === s ? "#38bdf8" : "#94a3b8",
                    border: raytraceTargetSamples === s ? "1px solid #38bdf8" : "1px solid transparent",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                  }}
                >
                  {s === 25 ? "Draft (25)" : s === 60 ? "HD (60)" : "Studio (120)"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Bounces:</span>
              {[2, 4, 8].map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setRaytraceBounces(b);
                    bouncesRef.current = b;
                    if (pathTracerRef.current) {
                      pathTracerRef.current.bounces = b;
                      pathTracerRef.current.reset();
                      setRaytraceSamples(0);
                    }
                  }}
                  style={{
                    background: raytraceBounces === b ? "rgba(56, 189, 248, 0.3)" : "transparent",
                    color: raytraceBounces === b ? "#38bdf8" : "#94a3b8",
                    border: raytraceBounces === b ? "1px solid #38bdf8" : "1px solid transparent",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
