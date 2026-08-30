"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
import { inchesToFeet, feetToInches } from "@/lib/units";
import { computeSmartWallSnap } from "@/lib/smartWallSnap";
import {
  clampPlayerPosition,
  computePotentiallyVisibleRooms,
  CROUCH_HEIGHT_FT,
  detectCurrentRoom,
  DoorwayConnection,
  EYE_LEVEL_FT,
  getSpawnPosition,
  PlayerTransform,
  ROTATE_SPEED_RAD,
  SPRINT_SPEED_FPS,
  WALK_SPEED_FPS,
} from "@/lib/walkthrough";
import {
  addCeilingFan,
  addRoomInteriorDetails,
  buildWindowWithCurtains,
  getMarbleFloorTexture,
  getTileFloorTexture,
  getWoodFloorTexture,
  RoomDoorInfo,
} from "@/lib/interiorDetails";
import {
  createFurnitureMesh,
  FURNITURE_CATALOG,
  PlacedCustomObject,
} from "@/lib/furnitureCatalog";
import {
  DEFAULT_MATERIAL_CONFIG,
  getFloorTexture,
  getRoomFloorMaterial,
  getRoomWallColorHex,
  getRoomWallTextureId,
  getWallTextureBumpMap,
  HouseMaterialConfig,
} from "@/lib/materialsCatalog";
import {
  DEFAULT_WINDOW_CONFIG,
  getIndividualWindowProps,
  getRoomWindowShape,
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
  getWallLengthIn,
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
  activeCadTool?: "select" | "draw_wall" | "place_door" | "place_window" | "tag_room";
  onChangeCadTool?: (tool: "select" | "draw_wall" | "place_door" | "place_window" | "tag_room") => void;
  activeWallType?: CustomWallType;
  onChangeWallType?: (type: CustomWallType) => void;
  onChangeCustomWalls?: (walls: CustomDrawnWall[]) => void;
  onChangeCustomRoomZones?: (zones: CustomRoomZone[]) => void;
  onStartFromScratch?: () => void;
  deletedBuiltinIds?: string[];
  placingItemType?: string | null;
  placingRotationY?: number;
  selectedObjectId?: string | null;
  selectedObjectInfo?: SelectedObjectInfo | null;
  materialConfig?: HouseMaterialConfig;
  windowConfig?: WindowConfig;
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
}

const PLOT_COLOR = 0xffffff;
const ACCENT = 0xe8912d;
const HANDLE_RADIUS_FT = 0.55;
const WALL_HEIGHT_FT = 9.0;
const WALL_THICK_INT_FT = 4.5 / 12; // 0.375 ft
const DOOR_WIDTH_FT = 32 / 12; // 2.67 ft
const DOOR_HEIGHT_FT = 84 / 12; // 7.0 ft
const BASEBOARD_H_FT = 4 / 12; // 0.33 ft
const WINDOW_W_FT = 4.0;
const WINDOW_H_FT = 4.2;
const WINDOW_SILL_Y_FT = 2.8;

function snapToFoot(inches: number): number {
  return Math.round(inches / 12) * 12;
}

function clampInches(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function makeRoomBadgeSprite(text: string): THREE.Sprite {
  if (typeof document === "undefined") return new THREE.Sprite();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(10, 25, 48, 0.88)";
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 248, 56, 10);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.5, 1.1, 1);
  return sprite;
}

function getPrimaryCardinalEdge(facing: Facing): "N" | "S" | "E" | "W" {
  if (facing === "N" || facing === "NE" || facing === "NW") return "N";
  if (facing === "S" || facing === "SE" || facing === "SW") return "S";
  if (facing === "E") return "E";
  if (facing === "W") return "W";
  return "N";
}

function createRoomBadge(name: string, wFt: number, dFt: number, isLocked: boolean = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.roundRect(8, 12, 240, 104, 16);
    ctx.fill();
    ctx.strokeStyle = isLocked ? "rgba(56, 189, 248, 0.85)" : "rgba(232, 145, 45, 0.85)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name.toUpperCase(), 128, 52);

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${wFt}' × ${dFt}' ft`, 128, 84);

    ctx.fillStyle = isLocked ? "#38bdf8" : "#e8912d";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(isLocked ? "🔒 View-Only Mode" : "✋ Drag to Reposition", 128, 106);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(4.4, 2.2, 1);
  return sprite;
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
  deletedBuiltinIds = [],
  placingItemType = null,
  placingRotationY = 0,
  selectedObjectId = null,
  selectedObjectInfo = null,
  materialConfig = DEFAULT_MATERIAL_CONFIG,
  windowConfig = DEFAULT_WINDOW_CONFIG,
  isLayoutLocked = false,
  onToggleLayoutLock,
  activeCadTool = "select",
  onChangeCadTool,
  activeWallType = "exterior",
  onChangeWallType,
  onChangeCustomWalls,
  onChangeCustomRoomZones,
  activeFloor = 0,
  onChangeActiveFloor,
  onStartFromScratch,
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
}: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
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
  const [draftWallStartFt, setDraftWallStartFt] = useState<{ x: number; z: number } | null>(null);
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
  // Room interior lights references
  const roomLightsRef = useRef<THREE.PointLight[]>([]);
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
  const isLayoutLockedRef = useRef(isLayoutLocked);
  const onToggleLayoutLockRef = useRef(onToggleLayoutLock);

  useEffect(() => {
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
    isLayoutLockedRef.current = isLayoutLocked;
    onToggleLayoutLockRef.current = onToggleLayoutLock;
    activeCadToolRef.current = activeCadTool;
    activeWallTypeRef.current = activeWallType;
    onChangeCustomWallsRef.current = onChangeCustomWalls;
    onChangeCustomRoomZonesRef.current = onChangeCustomRoomZones;

    if (widthHandleRef.current) widthHandleRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (depthHandleRef.current) depthHandleRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (roomHandlesGroupRef.current) roomHandlesGroupRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;
    if (customWallHandlesGroupRef.current) customWallHandlesGroupRef.current.visible = modeRef.current !== "walkthrough" && !isLayoutLocked;

    roomLightsRef.current.forEach((l) => {
      l.visible = lightsOn;
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
  ]);

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

    const isMobileOrLowGPU =
      typeof window !== "undefined" &&
      (/Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent) ||
        window.innerWidth < 800 ||
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

    // Architectural Lighting setup
    const hemiLight = new THREE.HemisphereLight(0xe8f0fe, 0x1e2630, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.85);
    sunLight.position.set(50, 80, 40);
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

    const skyFill = new THREE.DirectionalLight(0x8cb6e8, 0.55);
    skyFill.position.set(-40, 50, -30);
    scene.add(skyFill);

    const groundGeom = new THREE.PlaneGeometry(320, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.95,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const grid = new THREE.GridHelper(260, 130, 0x334155, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);

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

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
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

      // 0b. CAD Tool 2 & 3: Place 3D Door or Window directly onto 3D Walls
      if ((activeCadToolRef.current === "place_door" || activeCadToolRef.current === "place_window") && ev.button === 0) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          let closestHit: { wall: CustomDrawnWall; offsetIn: number } | null = null;
          let closestDist = 3.0; // feet

          for (const w of customWallsRef.current) {
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
              closestHit = {
                wall: w,
                offsetIn: Math.round(t * len * 12),
              };
            }
          }

          if (closestHit) {
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const isWindow = activeCadToolRef.current === "place_window";
            const widthIn = isWindow ? 48 : 36;
            const newOpening: CustomWallOpening = {
              id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              kind: isWindow ? "window" : "door",
              offsetIn: Math.max(0, closestHit.offsetIn - widthIn / 2),
              widthIn,
              heightIn: isWindow ? 48 : 84,
              sillIn: isWindow ? 34 : 0,
            };
            const updated = customWallsRef.current.map((cw) =>
              cw.id === closestHit.wall.id ? { ...cw, openings: [...(cw.openings || []), newOpening] } : cw
            );
            onChangeCustomWallsRef.current?.(updated);
            setDrafting3DDescription(`✨ Inserted 3D ${isWindow ? "Window" : "Door"} onto Wall!`);
            return;
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

    function onKeyDown(ev: KeyboardEvent) {
      keysPressed.current[ev.code] = true;
      if (ev.code === "KeyF" && onToggleLightsRef.current && modeRef.current === "walkthrough") {
        onToggleLightsRef.current();
      }
      if (ev.code === "Space" && !isJumping.current && modeRef.current === "walkthrough") {
        jumpVelocityY.current = 10.0;
        isJumping.current = true;
      }
      // 'E' Key: Interact / Select object directly in center crosshair
      if (ev.code === "KeyE" && modeRef.current === "walkthrough") {
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
      // Escape: Deselect or cancel placement or draft wall
      if (ev.code === "Escape") {
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

    renderer.domElement.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
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

        const isSprinting = Boolean(keys["ShiftLeft"] || keys["ShiftRight"] || cmd === "sprint");
        const isCrouched = Boolean(keys["KeyC"] || cmd === "crouch");

        let moveForward = 0;
        let moveStrafe = 0;
        let turn = 0;

        if (keys["KeyW"] || keys["ArrowUp"] || cmd === "forward") moveForward += 1;
        if (keys["KeyS"] || keys["ArrowDown"] || cmd === "backward") moveForward -= 1;
        if (keys["KeyA"] || cmd === "left") moveStrafe -= 1;
        if (keys["KeyD"] || cmd === "right") moveStrafe += 1;
        if (cmd === "turnLeft") turn += 1;
        if (cmd === "turnRight") turn += 1;

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
          p.x = clamped.x;
          p.z = clamped.z;

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

        const targetFov = isSprinting ? 48 : 45;
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

      renderer.render(scene, camera);
    }
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.dispose();
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
        color: 0x1e293b,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
    );
    plotMesh.rotation.x = -Math.PI / 2;
    plotMesh.position.set(wFt / 2, 0, dFt / 2);
    plotMesh.receiveShadow = true;
    group.add(plotMesh);

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
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.82,
      metalness: 0.02,
    });
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

    interface Doorway {
      roomAIndex: number;
      roomBIndex: number;
      edgeA: "N" | "S" | "E" | "W";
      edgeB: "N" | "S" | "E" | "W";
      center: number;
    }

    const oppositeEdge: Record<"N" | "S" | "E" | "W", "N" | "S" | "E" | "W"> = {
      N: "S",
      S: "N",
      E: "W",
      W: "E",
    };

    const openingCentreFt = (
      r: SolvedRoom,
      o: { edge: "N" | "S" | "E" | "W"; offset_in: number; width_in: number }
    ): number => {
      const originIn = o.edge === "N" || o.edge === "S" ? r.x_in : r.y_in;
      return inchesToFeet(originIn + o.offset_in + o.width_in / 2);
    };

    const assignedDoorways: Doorway[] = [];
    let entranceRoomIndex = -1;
    let chosenEntranceEdge: "N" | "S" | "E" | "W" = getPrimaryCardinalEdge(facing);

    rooms.forEach((r, i) => {
      for (const o of r.openings ?? []) {
        if (o.kind === "entrance") {
          entranceRoomIndex = i;
          chosenEntranceEdge = o.edge;
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
          if (edge === "N" || edge === "S") {
            const minX = Math.max(r1.x_in, r2.x_in);
            const maxX = Math.min(r1.x_in + r1.w_in, r2.x_in + r2.w_in);
            sharedCenterFt = inchesToFeet((minX + maxX) / 2);
          } else {
            const minZ = Math.max(r1.y_in, r2.y_in);
            const maxZ = Math.min(r1.y_in + r1.d_in, r2.y_in + r2.d_in);
            sharedCenterFt = inchesToFeet((minZ + maxZ) / 2);
          }

          assignedDoorways.push({
            roomAIndex: i,
            roomBIndex: j,
            edgeA: edge,
            edgeB: oppEdge,
            center: sharedCenterFt,
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

      // Floor Mesh (Customized via Material & Finishes Studio)
      const floorMatDef = getRoomFloorMaterial(room.name as RoomName, materialConfigRef.current);
      const floorTexture = getFloorTexture(floorMatDef.id);

      const floorGeom = new THREE.PlaneGeometry(rw, rd);
      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: floorMatDef.roughness,
        metalness: floorMatDef.metalness,
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(rx + rw / 2, 0.04, rz + rd / 2);
      floorMesh.receiveShadow = true;
      roomGroup.add(floorMesh);

      // Wall Materials & Textures (Customized via Material & Finishes Studio)
      const wallColorHex = getRoomWallColorHex(room.name as RoomName, materialConfigRef.current);
      const wallTextureId = getRoomWallTextureId(room.name as RoomName, materialConfigRef.current);
      const wallBumpMap = getWallTextureBumpMap(wallTextureId);

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: wallColorHex,
        bumpMap: wallBumpMap,
        bumpScale: wallBumpMap ? 0.05 : 0,
        roughness:
          wallTextureId === "wood_slat"
            ? 0.45
            : wallTextureId === "venetian_stucco"
            ? 0.65
            : 0.82,
        metalness: 0.02,
      });

      // Wall Builder
      const buildWall = (
        edge: "N" | "S" | "E" | "W",
        wx: number,
        wz: number,
        ww: number,
        wd: number,
        isEW: boolean
      ) => {
        // Detect if this wall edge is shared with an adjacent touching room
        const adj = findAdjacentRoomEdge(rooms, i, edge);
        // If this edge is shared with another room that already built the partition wall (adjIndex < i), skip to avoid duplicate overlapping walls!
        if (adj && adj.adjIndex < i) {
          return;
        }

        const isShared = Boolean(adj);
        const adjRoom = adj ? rooms[adj.adjIndex] : null;
        const adjLabel = adjRoom ? (ROOM_LABELS[adjRoom.name as RoomName] || adjRoom.name) : "";

        const isMainEntrance = i === entranceRoomIndex && edge === chosenEntranceEdge;

        const assignedDoor = assignedDoorways.find(
          (d) => (d.roomAIndex === i && d.edgeA === edge) || (d.roomBIndex === i && d.edgeB === edge)
        );

        const openingSpec = (room.openings ?? []).find((o) => o.kind === "opening" && o.edge === edge);
        const adjOpeningSpec = adj && adjRoom ? (adjRoom.openings ?? []).find((o) => o.kind === "opening" && o.edge === adj.adjEdge) : null;
        const hasFullOpening = Boolean(openingSpec || adjOpeningSpec);

        const hasDoor = !hasFullOpening && (isMainEntrance || Boolean(assignedDoor));
        const windowSpec = !isShared && !hasDoor && !hasFullOpening ? windowOn(i, edge) : undefined;
        const hasWindow = Boolean(windowSpec);

        const roomLabel = ROOM_LABELS[room.name as RoomName] || room.name;

        const wallTitle = isShared
          ? `${roomLabel} / ${adjLabel} Partition Wall${hasFullOpening ? " [Open-Concept]" : ""}`
          : `${roomLabel} (${edge} Wall)${hasFullOpening ? " [Open-Concept]" : ""}`;

        const wallUserData = {
          isWall: true,
          isRemoved: hasFullOpening,
          id: `wall_${i}_${edge}`,
          roomIndex: i,
          adjRoomIndex: adj?.adjIndex,
          edge,
          adjEdge: adj?.adjEdge,
          name: wallTitle,
        };

        if (hasFullOpening) {
          // Open-Concept Demolished Wall: Render top architectural lintel beam and tag for interaction
          const beamH = 0.75;
          const beam = new THREE.Mesh(new THREE.BoxGeometry(ww, beamH, wd), wallMaterial);
          beam.position.set(wx, WALL_HEIGHT_FT - beamH / 2, wz);
          beam.castShadow = true;
          beam.userData = { ...wallUserData };
          roomGroup.add(beam);
        } else if (hasDoor) {
          const doorW = isMainEntrance ? DOOR_WIDTH_FT + 0.4 : DOOR_WIDTH_FT;
          const doorH = DOOR_HEIGHT_FT;
          const lintelH = WALL_HEIGHT_FT - doorH;

          let doorPos = isEW ? wx : wz;
          if (assignedDoor && assignedDoor.center > 0) {
            doorPos = assignedDoor.center;
          }

          if (isEW) {
            doorPos = Math.max(rx + doorW / 2 + 0.2, Math.min(rx + rw - doorW / 2 - 0.2, doorPos));
          } else {
            doorPos = Math.max(rz + doorW / 2 + 0.2, Math.min(rz + rd - doorW / 2 - 0.2, doorPos));
          }

          if (isEW) {
            const leftW = Math.max(0.1, doorPos - (wx - ww / 2) - doorW / 2);
            const rightW = Math.max(0.1, (wx + ww / 2) - (doorPos + doorW / 2));

            if (leftW > 0.1) {
              const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftW, WALL_HEIGHT_FT, wd), wallMaterial);
              leftWall.position.set(wx - ww / 2 + leftW / 2, WALL_HEIGHT_FT / 2, wz);
              leftWall.castShadow = true;
              leftWall.receiveShadow = true;
              leftWall.userData = { ...wallUserData };
              roomGroup.add(leftWall);

              const leftBase = new THREE.Mesh(new THREE.BoxGeometry(leftW, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
              leftBase.position.set(wx - ww / 2 + leftW / 2, BASEBOARD_H_FT / 2, wz);
              roomGroup.add(leftBase);
            }

            if (rightW > 0.1) {
              const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightW, WALL_HEIGHT_FT, wd), wallMaterial);
              rightWall.position.set(wx + ww / 2 - rightW / 2, WALL_HEIGHT_FT / 2, wz);
              rightWall.castShadow = true;
              rightWall.receiveShadow = true;
              rightWall.userData = { ...wallUserData };
              roomGroup.add(rightWall);

              const rightBase = new THREE.Mesh(new THREE.BoxGeometry(rightW, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
              rightBase.position.set(wx + ww / 2 - rightW / 2, BASEBOARD_H_FT / 2, wz);
              roomGroup.add(rightBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wd), wallMaterial);
            lintel.position.set(doorPos, doorH + lintelH / 2, wz);
            lintel.castShadow = true;
            lintel.userData = { ...wallUserData };
            roomGroup.add(lintel);

            const fMat = isMainEntrance ? mainEntranceFrameMat : doorFrameMaterial;
            const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, wd + 0.08), fMat);
            frameL.position.set(doorPos - doorW / 2 + 0.11, doorH / 2, wz);
            roomGroup.add(frameL);

            const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, wd + 0.08), fMat);
            frameR.position.set(doorPos + doorW / 2 - 0.11, doorH / 2, wz);
            roomGroup.add(frameR);

            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.22, wd + 0.08), fMat);
            frameTop.position.set(doorPos, doorH - 0.11, wz);
            roomGroup.add(frameTop);

            if (isMainEntrance) {
              const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.2), goldHardwareMat);
              handle.position.set(doorPos + doorW / 2 - 0.4, doorH * 0.48, wz + 0.15);
              roomGroup.add(handle);

              // Exterior Front Door Canopy / Sunshade (Cleanly aligned above door)
              if (!isShared) {
                const canopyW = doorW + 1.2;
                const canopyT = 0.28;
                const canopyOut = 1.8;
                const canopyY = doorH + canopyT / 2 + 0.12;

                const canopyGeom = new THREE.BoxGeometry(canopyW, canopyT, canopyOut);
                const canopyMesh = new THREE.Mesh(canopyGeom, slabMat);
                canopyMesh.castShadow = true;
                canopyMesh.receiveShadow = true;

                if (edge === "N") canopyMesh.position.set(doorPos, canopyY, wz - canopyOut / 2 + wd / 2);
                else if (edge === "S") canopyMesh.position.set(doorPos, canopyY, wz + canopyOut / 2 - wd / 2);
                roomGroup.add(canopyMesh);
              }
            }
          } else {
            const topD = Math.max(0.1, doorPos - (wz - wd / 2) - doorW / 2);
            const bottomD = Math.max(0.1, (wz + wd / 2) - (doorPos + doorW / 2));

            if (topD > 0.1) {
              const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, topD), wallMaterial);
              topWall.position.set(wx, WALL_HEIGHT_FT / 2, wz - wd / 2 + topD / 2);
              topWall.castShadow = true;
              topWall.receiveShadow = true;
              topWall.userData = { ...wallUserData };
              roomGroup.add(topWall);

              const topBase = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, topD), baseboardMaterial);
              topBase.position.set(wx, BASEBOARD_H_FT / 2, wz - wd / 2 + topD / 2);
              roomGroup.add(topBase);
            }

            if (bottomD > 0.1) {
              const botWall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, bottomD), wallMaterial);
              botWall.position.set(wx, WALL_HEIGHT_FT / 2, wz + wd / 2 - bottomD / 2);
              botWall.castShadow = true;
              botWall.receiveShadow = true;
              botWall.userData = { ...wallUserData };
              roomGroup.add(botWall);

              const botBase = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, bottomD), baseboardMaterial);
              botBase.position.set(wx, BASEBOARD_H_FT / 2, wz + wd / 2 - bottomD / 2);
              roomGroup.add(botBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(ww, lintelH, doorW), wallMaterial);
            lintel.position.set(wx, doorH + lintelH / 2, doorPos);
            lintel.castShadow = true;
            lintel.userData = { ...wallUserData };
            roomGroup.add(lintel);

            const fMat = isMainEntrance ? mainEntranceFrameMat : doorFrameMaterial;
            const frameN = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, doorH, 0.22), fMat);
            frameN.position.set(wx, doorH / 2, doorPos - doorW / 2 + 0.11);
            roomGroup.add(frameN);

            const frameS = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, doorH, 0.22), fMat);
            frameS.position.set(wx, doorH / 2, doorPos + doorW / 2 - 0.11);
            roomGroup.add(frameS);

            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, 0.22, doorW), fMat);
            frameTop.position.set(wx, doorH - 0.11, doorPos);
            roomGroup.add(frameTop);

            if (isMainEntrance) {
              const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.12), goldHardwareMat);
              handle.position.set(wx + 0.15, doorH * 0.48, doorPos + doorW / 2 - 0.4);
              roomGroup.add(handle);

              // Exterior Front Door Canopy / Sunshade (Cleanly aligned above door)
              if (!isShared) {
                const canopyW = doorW + 1.2;
                const canopyT = 0.28;
                const canopyOut = 1.8;
                const canopyY = doorH + canopyT / 2 + 0.12;

                const canopyGeom = new THREE.BoxGeometry(canopyOut, canopyT, canopyW);
                const canopyMesh = new THREE.Mesh(canopyGeom, slabMat);
                canopyMesh.castShadow = true;
                canopyMesh.receiveShadow = true;

                if (edge === "W") canopyMesh.position.set(wx - canopyOut / 2 + ww / 2, canopyY, doorPos);
                else if (edge === "E") canopyMesh.position.set(wx + canopyOut / 2 - ww / 2, canopyY, doorPos);
                roomGroup.add(canopyMesh);
              }
            }
          }
        } else if (hasWindow) {
          const winId = `win_${i}_${edge}`;
          const winProps = getIndividualWindowProps(winId, room.name as RoomName, windowConfigRef.current);

          const maxAllowedW = Math.max(1.8, (isEW ? ww : wd) - 0.8);
          const winW = Math.min(
            winProps.widthFt ?? (windowSpec ? inchesToFeet(windowSpec.width_in) : WINDOW_W_FT),
            maxAllowedW
          );
          const winH = winProps.heightFt ?? (windowSpec?.height_in ? inchesToFeet(windowSpec.height_in) : WINDOW_H_FT);
          const sillH = winProps.sillHeightFt ?? (windowSpec?.sill_in != null ? inchesToFeet(windowSpec.sill_in) : WINDOW_SILL_Y_FT);
          const topH = Math.max(0.1, WALL_HEIGHT_FT - (sillH + winH));

          if (isEW) {
            const sideW = Math.max(0.4, (ww - winW) / 2);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, wd), wallMaterial);
            leftWall.position.set(wx - ww / 2 + sideW / 2, WALL_HEIGHT_FT / 2, wz);
            leftWall.castShadow = true;
            leftWall.receiveShadow = true;
            leftWall.userData = { ...wallUserData };
            roomGroup.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, wd), wallMaterial);
            rightWall.position.set(wx + ww / 2 - sideW / 2, WALL_HEIGHT_FT / 2, wz);
            rightWall.castShadow = true;
            rightWall.receiveShadow = true;
            rightWall.userData = { ...wallUserData };
            roomGroup.add(rightWall);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, wd), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            sillWall.userData = { ...wallUserData };
            roomGroup.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            roomGroup.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(winW, topH, wd), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            topWall.userData = { ...wallUserData };
            roomGroup.add(topWall);

            if (!winProps.isDeleted) {
              buildWindowWithCurtains(
                roomGroup,
                wx,
                sillH + winH / 2,
                wz,
                winW,
                winH,
                wd,
                true,
                winProps.hasCurtains && (room.name === "bedroom" || room.name === "hall" || winProps.hasCurtains),
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

                if (edge === "N") chajjaMesh.position.set(wx, chajjaY, wz - chajjaOut / 2 + wd / 2);
                else if (edge === "S") chajjaMesh.position.set(wx, chajjaY, wz + chajjaOut / 2 - wd / 2);
                roomGroup.add(chajjaMesh);
              }
            }
          } else {
            const sideD = Math.max(0.4, (wd - winW) / 2);

            const topWallSeg = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, sideD), wallMaterial);
            topWallSeg.position.set(wx, WALL_HEIGHT_FT / 2, wz - wd / 2 + sideD / 2);
            topWallSeg.castShadow = true;
            topWallSeg.receiveShadow = true;
            topWallSeg.userData = { ...wallUserData };
            roomGroup.add(topWallSeg);

            const botWallSeg = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, sideD), wallMaterial);
            botWallSeg.position.set(wx, WALL_HEIGHT_FT / 2, wz + wd / 2 - sideD / 2);
            botWallSeg.castShadow = true;
            botWallSeg.receiveShadow = true;
            botWallSeg.userData = { ...wallUserData };
            roomGroup.add(botWallSeg);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(ww, sillH, winW), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            sillWall.userData = { ...wallUserData };
            roomGroup.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, wd), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            roomGroup.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, topH, winW), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            topWall.userData = { ...wallUserData };
            roomGroup.add(topWall);

            if (!winProps.isDeleted) {
              buildWindowWithCurtains(
                roomGroup,
                wx,
                sillH + winH / 2,
                wz,
                winW,
                winH,
                ww,
                false,
                winProps.hasCurtains && (room.name === "bedroom" || room.name === "hall" || winProps.hasCurtains),
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

                if (edge === "W") chajjaMesh.position.set(wx - chajjaOut / 2 + ww / 2, chajjaY, wz);
                else if (edge === "E") chajjaMesh.position.set(wx + chajjaOut / 2 - ww / 2, chajjaY, wz);
                roomGroup.add(chajjaMesh);
              }
            }
          }
        } else {
          // Solid Wall
          const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, wd), wallMaterial);
          wall.position.set(wx, WALL_HEIGHT_FT / 2, wz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          wall.userData = { ...wallUserData };
          roomGroup.add(wall);

          const baseboard = new THREE.Mesh(
            new THREE.BoxGeometry(isEW ? ww : ww + 0.04, BASEBOARD_H_FT, isEW ? wd + 0.04 : wd),
            baseboardMaterial
          );
          baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
          roomGroup.add(baseboard);
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
          deletedBuiltinSet
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

    // 8. Custom Interactive Placed Furniture & Decor Objects
    const customList = customObjectsRef.current || [];
    for (const obj of customList) {
      const objGroup = createFurnitureMesh(obj.type, obj.colorHex);
      objGroup.position.set(obj.x, obj.y || 0, obj.z);
      objGroup.rotation.y = obj.rotationY || 0;
      const s = obj.scale || 1.0;
      objGroup.scale.set(s, s, s);
      objGroup.userData = { isCustomObject: true, id: obj.id, name: obj.name, type: obj.type };

      objGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      group.add(objGroup);
      customObjectMeshesRef.current.set(obj.id, objGroup);
    }

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

      const glassWallMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        metalness: 0.8,
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
              } else if (op.kind === "revolving_door") {
                // Revolving Door Cylinder
                const revDrum = new THREE.Mesh(
                  new THREE.CylinderGeometry(opWidthFt / 2, opWidthFt / 2, opHeightFt, 20, 1, true),
                  glassWallMat
                );
                revDrum.position.set(opCenterFt, opHeightFt / 2, 0);
                wallGroup.add(revDrum);
              } else if (op.kind === "door" || op.kind === "entrance") {
                const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
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

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
    </div>
  );
}
