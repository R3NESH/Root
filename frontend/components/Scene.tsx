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
import { ROOM_LABELS, RoomName } from "@/lib/rooms";
import { SolvedRoom } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
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

export interface SelectedObjectInfo {
  id: string;
  name: string;
  type?: string;
  isBuiltin?: boolean;
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
  deletedBuiltinIds?: string[];
  placingItemType?: string | null;
  selectedObjectId?: string | null;
  selectedObjectInfo?: SelectedObjectInfo | null;
  materialConfig?: HouseMaterialConfig;
  onPlotChange?: (next: PlotDims) => void;
  onPlayerUpdate?: (player: PlayerTransform) => void;
  onToggleLights?: () => void;
  onRoomMove?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => void;
  onAddCustomObject?: (obj: PlacedCustomObject) => void;
  onSelectObject?: (info: SelectedObjectInfo | null) => void;
  onUpdateCustomObject?: (obj: PlacedCustomObject) => void;
  onRequestReplace?: () => void;
  onRequestDelete?: () => void;
  onRotateSelected?: (angleDelta: number) => void;
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

function getPrimaryCardinalEdge(facing: Facing): "N" | "S" | "E" | "W" {
  if (facing === "N" || facing === "NE" || facing === "NW") return "N";
  if (facing === "S" || facing === "SE" || facing === "SW") return "S";
  if (facing === "E") return "E";
  if (facing === "W") return "W";
  return "N";
}

function createRoomBadge(name: string, wFt: number, dFt: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.roundRect(8, 12, 240, 104, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 145, 45, 0.85)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name.toUpperCase(), 128, 52);

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${wFt}' × ${dFt}' ft`, 128, 84);

    ctx.fillStyle = "#e8912d";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("✋ Drag to Reposition", 128, 106);
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
  deletedBuiltinIds = [],
  placingItemType = null,
  selectedObjectId = null,
  selectedObjectInfo = null,
  materialConfig = DEFAULT_MATERIAL_CONFIG,
  onPlotChange,
  onPlayerUpdate,
  onToggleLights,
  onRoomMove,
  onAddCustomObject,
  onSelectObject,
  onUpdateCustomObject,
  onRequestReplace,
  onRequestDelete,
  onRotateSelected,
}: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const widthHandleRef = useRef<THREE.Mesh | null>(null);
  const depthHandleRef = useRef<THREE.Mesh | null>(null);

  // Metaheuristic Room Occlusion Culling Sub-Graphs & Portals
  const roomGroupsRef = useRef<Map<number, THREE.Group>>(new Map());
  const roomDoorwaysRef = useRef<DoorwayConnection[]>([]);
  const roomLightsByRoomRef = useRef<Map<number, THREE.PointLight[]>>(new Map());

  // Drag-and-Drop room meshes references
  const ghostRoomMeshRef = useRef<THREE.Mesh | null>(null);
  const draggedRoomIdxRef = useRef<number | null>(null);
  const [draggedRoomInfo, setDraggedRoomInfo] = useState<{ name: string; x: number; z: number } | null>(null);
  const [doorAlert, setDoorAlert] = useState<string | null>(null);

  // Custom 3D Furniture Placement & Selection References
  const placingGhostGroupRef = useRef<THREE.Group | null>(null);
  const draggedCustomObjectIdRef = useRef<string | null>(null);
  const customObjectMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const draggedCustomObjPosRef = useRef<{ x: number; z: number } | null>(null);

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
  const onPlotChangeRef = useRef(onPlotChange);
  const onPlayerUpdateRef = useRef(onPlayerUpdate);
  const onToggleLightsRef = useRef(onToggleLights);
  const onRoomMoveRef = useRef(onRoomMove);
  const onAddCustomObjectRef = useRef(onAddCustomObject);
  const onSelectObjectRef = useRef(onSelectObject);
  const onUpdateCustomObjectRef = useRef(onUpdateCustomObject);
  const modeRef = useRef(mode);
  const activeMoveCmdRef = useRef(activeMoveCmd);
  const lightsOnRef = useRef(lightsOn);
  const roomsRef = useRef(rooms);
  const customObjectsRef = useRef(customObjects);
  const deletedBuiltinIdsRef = useRef(deletedBuiltinIds);
  const placingItemTypeRef = useRef(placingItemType);
  const selectedObjectIdRef = useRef(selectedObjectId);
  const materialConfigRef = useRef(materialConfig);

  useEffect(() => {
    plotRef.current = plot;
    onPlotChangeRef.current = onPlotChange;
    onPlayerUpdateRef.current = onPlayerUpdate;
    onToggleLightsRef.current = onToggleLights;
    onRoomMoveRef.current = onRoomMove;
    onAddCustomObjectRef.current = onAddCustomObject;
    onSelectObjectRef.current = onSelectObject;
    onUpdateCustomObjectRef.current = onUpdateCustomObject;
    modeRef.current = mode;
    activeMoveCmdRef.current = activeMoveCmd;
    lightsOnRef.current = lightsOn;
    roomsRef.current = rooms;
    customObjectsRef.current = customObjects;
    deletedBuiltinIdsRef.current = deletedBuiltinIds;
    placingItemTypeRef.current = placingItemType;
    selectedObjectIdRef.current = selectedObjectId;
    materialConfigRef.current = materialConfig;

    roomLightsRef.current.forEach((l) => {
      l.visible = lightsOn;
    });
  }, [
    plot,
    onPlotChange,
    onPlayerUpdate,
    onToggleLights,
    onRoomMove,
    onAddCustomObject,
    onSelectObject,
    onUpdateCustomObject,
    mode,
    activeMoveCmd,
    lightsOn,
    rooms,
    customObjects,
    deletedBuiltinIds,
    placingItemType,
    selectedObjectId,
    materialConfig,
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

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    let dragKind: "width" | "depth" | "room" | "customObject" | null = null;

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

    // Universal 3D Furniture Picker (Both Custom Placed & Built-in Items)
    function pickFurnitureObject(ev: PointerEvent): SelectedObjectInfo | null {
      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      // 1. Raycast against scene hierarchy for any mesh with userData.isFurniture or userData.isCustomObject
      if (groupRef.current) {
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        for (const hit of intersects) {
          let curr: THREE.Object3D | null = hit.object;
          while (curr && curr !== groupRef.current) {
            if (curr.userData && (curr.userData.isCustomObject || curr.userData.isFurniture)) {
              const id = curr.userData.id;
              const isBuiltin = Boolean(curr.userData.isBuiltin);
              const name = curr.userData.name || "Furniture";
              const type = curr.userData.type || "sofa_3seater";
              return {
                id,
                name,
                type,
                isBuiltin,
                x: curr.position.x || curr.userData.x || 0,
                y: curr.position.y || curr.userData.y || 0,
                z: curr.position.z || curr.userData.z || 0,
                rotationY: curr.rotation.y || curr.userData.rotationY || 0,
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

      // If user is currently placing a furniture item from the catalog
      if (placingItemTypeRef.current && ev.button === 0) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          const itemDef = FURNITURE_CATALOG.find((i) => i.type === placingItemTypeRef.current);
          const newObj: PlacedCustomObject = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: placingItemTypeRef.current,
            name: itemDef?.name || "Furniture",
            x: Math.round(hitPoint.x * 2) / 2,
            y: 0,
            z: Math.round(hitPoint.z * 2) / 2,
            rotationY: 0,
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
      }

      // Check plot dimension resize handles
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
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        dragKind = hitObj.isBuiltin ? null : "customObject";
        draggedCustomObjectIdRef.current = hitObj.isBuiltin ? null : hitObj.id;
        if (onSelectObjectRef.current) {
          onSelectObjectRef.current(hitObj);
        }
        if (!hitObj.isBuiltin) {
          controls.enabled = false;
        }
        return;
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

        // Handle placing preview ghost in walkthrough mode
        if (placingItemTypeRef.current) {
          if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
            if (placingGhostGroupRef.current) {
              placingGhostGroupRef.current.position.set(hitPoint.x, 0, hitPoint.z);
              placingGhostGroupRef.current.visible = true;
            }
            renderer.domElement.style.cursor = "crosshair";
          }
          return;
        }

        // Hover feedback in walkthrough mode
        const now = performance.now();
        if (now - lastHoverCheckTime > 60) {
          lastHoverCheckTime = now;
          const isOverFurniture = pickFurnitureObject(ev) !== null;
          renderer.domElement.style.cursor = isOverFurniture ? "pointer" : "crosshair";
        }
        return;
      }

      // Handle placing preview ghost in orbit mode
      if (placingItemTypeRef.current) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          if (placingGhostGroupRef.current) {
            placingGhostGroupRef.current.position.set(hitPoint.x, 0, hitPoint.z);
            placingGhostGroupRef.current.visible = true;
          }
          renderer.domElement.style.cursor = "crosshair";
        }
        return;
      }

      if (!dragKind) {
        const now = performance.now();
        if (now - lastHoverCheckTime > 50) {
          lastHoverCheckTime = now;
          const isOverHandle = pickHandle(ev) !== null;
          const isOverFurniture = pickFurnitureObject(ev) !== null;
          const isOverRoom = pickRoom(ev) !== null;
          renderer.domElement.style.cursor = isOverHandle || isOverFurniture || isOverRoom ? "grab" : "auto";
        }
        return;
      }

      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      const current = plotRef.current;
      if (dragKind === "width") {
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
        // Direct Three.js GPU transform (0 React re-renders, 0 latency!)
        const objId = draggedCustomObjectIdRef.current;
        const mesh = customObjectMeshesRef.current.get(objId);
        const snappedX = Math.round(hitPoint.x * 2) / 2;
        const snappedZ = Math.round(hitPoint.z * 2) / 2;
        if (mesh) {
          mesh.position.set(snappedX, 0, snappedZ);
        }
        draggedCustomObjPosRef.current = { x: snappedX, z: snappedZ };
      } else if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
        // Direct Three.js ghost transform (0 React setState during drag)
        const rIdx = draggedRoomIdxRef.current;
        const r = roomsRef.current[rIdx];
        if (r) {
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          const snappedCornerX = Math.round(hitPoint.x - rw / 2);
          const snappedCornerZ = Math.round(hitPoint.z - rd / 2);
          ghostMesh.position.set(snappedCornerX + rw / 2, WALL_HEIGHT_FT / 2, snappedCornerZ + rd / 2);
        }
      }
    }

    function onPointerUp(ev: PointerEvent) {
      isDraggingLook.current = false;

      // Handle walkthrough mode click-to-select and click-to-place
      if (modeRef.current === "walkthrough") {
        const dist = Math.hypot(
          ev.clientX - pointerDownPosRef.current.x,
          ev.clientY - pointerDownPosRef.current.y
        );
        const timeDiff = performance.now() - pointerDownPosRef.current.time;

        // If it was a quick click / tap (not a sustained camera look drag)
        if (dist < 8 && timeDiff < 450) {
          // If in placing mode
          if (placingItemTypeRef.current && ev.button === 0) {
            setPointerNdc(ev);
            raycaster.setFromCamera(pointerNdc, camera);
            if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
              const itemDef = FURNITURE_CATALOG.find((i) => i.type === placingItemTypeRef.current);
              const newObj: PlacedCustomObject = {
                id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                type: placingItemTypeRef.current,
                name: itemDef?.name || "Furniture",
                x: Math.round(hitPoint.x * 2) / 2,
                y: 0,
                z: Math.round(hitPoint.z * 2) / 2,
                rotationY: playerRef.current.yaw + Math.PI,
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
          }

          // Otherwise, check object pick
          const hitObj = pickFurnitureObject(ev);
          if (hitObj && ev.button === 0) {
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
        const obj = (customObjectsRef.current || []).find((o) => o.id === objId);
        if (obj && onUpdateCustomObjectRef.current) {
          onUpdateCustomObjectRef.current({
            ...obj,
            x: draggedCustomObjPosRef.current.x,
            z: draggedCustomObjPosRef.current.z,
          });
        }
        draggedCustomObjPosRef.current = null;
      } else if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
        const rIdx = draggedRoomIdxRef.current;
        const r = roomsRef.current[rIdx];
        if (r && onRoomMoveRef.current) {
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          const snappedCornerX = Math.round(ghostMesh.position.x - rw / 2);
          const snappedCornerZ = Math.round(ghostMesh.position.z - rd / 2);

          const targetXIn = Math.max(0, snappedCornerX * 12);
          const targetYIn = Math.max(0, snappedCornerZ * 12);
          onRoomMoveRef.current(rIdx, targetXIn, targetYIn);

          const label = ROOM_LABELS[r.name as RoomName] ?? r.name;
          setDoorAlert(`🚪 ${label} repositioned — Door automatically connected!`);
          setTimeout(() => setDoorAlert(null), 3000);
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
    }

    function onKeyUp(ev: KeyboardEvent) {
      keysPressed.current[ev.code] = false;
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
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

      if (widthHandleRef.current) widthHandleRef.current.visible = true;
      if (depthHandleRef.current) depthHandleRef.current.visible = true;
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
          assignedDoorways.push({
            roomAIndex: i,
            roomBIndex: o.to_room,
            edgeA: o.edge,
            edgeB: oppositeEdge[o.edge],
            center: openingCentreFt(r, o),
          });
        }
      }
    });

    // Save topological doorways for metaheuristic PVS occlusion graph culling
    roomDoorwaysRef.current = assignedDoorways.map((d) => ({
      roomAIndex: d.roomAIndex,
      roomBIndex: d.roomBIndex,
    }));

    const windowOn = (i: number, edge: "N" | "S" | "E" | "W") =>
      (rooms[i].openings ?? []).find((o) => o.kind === "window" && o.edge === edge);

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
        const isMainEntrance = i === entranceRoomIndex && edge === chosenEntranceEdge;

        const assignedDoor = assignedDoorways.find(
          (d) => (d.roomAIndex === i && d.edgeA === edge) || (d.roomBIndex === i && d.edgeB === edge)
        );

        const hasDoor = isMainEntrance || Boolean(assignedDoor);
        const windowSpec = hasDoor ? undefined : windowOn(i, edge);
        const hasWindow = Boolean(windowSpec);

        if (hasDoor) {
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
              roomGroup.add(rightWall);

              const rightBase = new THREE.Mesh(new THREE.BoxGeometry(rightW, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
              rightBase.position.set(wx + ww / 2 - rightW / 2, BASEBOARD_H_FT / 2, wz);
              roomGroup.add(rightBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wd), wallMaterial);
            lintel.position.set(doorPos, doorH + lintelH / 2, wz);
            lintel.castShadow = true;
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
            }
          } else {
            const topD = Math.max(0.1, doorPos - (wz - wd / 2) - doorW / 2);
            const bottomD = Math.max(0.1, (wz + wd / 2) - (doorPos + doorW / 2));

            if (topD > 0.1) {
              const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, topD), wallMaterial);
              topWall.position.set(wx, WALL_HEIGHT_FT / 2, wz - wd / 2 + topD / 2);
              topWall.castShadow = true;
              topWall.receiveShadow = true;
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
              roomGroup.add(botWall);

              const botBase = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, bottomD), baseboardMaterial);
              botBase.position.set(wx, BASEBOARD_H_FT / 2, wz + wd / 2 - bottomD / 2);
              roomGroup.add(botBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(ww, lintelH, doorW), wallMaterial);
            lintel.position.set(wx, doorH + lintelH / 2, doorPos);
            lintel.castShadow = true;
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
            }
          }
        } else if (hasWindow) {
          const winW = Math.min(
            windowSpec ? inchesToFeet(windowSpec.width_in) : WINDOW_W_FT,
            (isEW ? ww : wd) - 1.8
          );
          const winH = WINDOW_H_FT;
          const sillH = WINDOW_SILL_Y_FT;
          const topH = WALL_HEIGHT_FT - (sillH + winH);

          if (isEW) {
            const sideW = Math.max(0.4, (ww - winW) / 2);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, wd), wallMaterial);
            leftWall.position.set(wx - ww / 2 + sideW / 2, WALL_HEIGHT_FT / 2, wz);
            leftWall.castShadow = true;
            leftWall.receiveShadow = true;
            roomGroup.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, wd), wallMaterial);
            rightWall.position.set(wx + ww / 2 - sideW / 2, WALL_HEIGHT_FT / 2, wz);
            rightWall.castShadow = true;
            rightWall.receiveShadow = true;
            roomGroup.add(rightWall);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, wd), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            roomGroup.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            roomGroup.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(winW, topH, wd), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            roomGroup.add(topWall);

            buildWindowWithCurtains(
              roomGroup,
              wx,
              sillH + winH / 2,
              wz,
              winW,
              winH,
              wd,
              true,
              furnished && (room.name === "bedroom" || room.name === "hall"),
              false
            );
          } else {
            const sideD = Math.max(0.4, (wd - winW) / 2);

            const topWallSeg = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, sideD), wallMaterial);
            topWallSeg.position.set(wx, WALL_HEIGHT_FT / 2, wz - wd / 2 + sideD / 2);
            topWallSeg.castShadow = true;
            topWallSeg.receiveShadow = true;
            roomGroup.add(topWallSeg);

            const botWallSeg = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, sideD), wallMaterial);
            botWallSeg.position.set(wx, WALL_HEIGHT_FT / 2, wz + wd / 2 - sideD / 2);
            botWallSeg.castShadow = true;
            botWallSeg.receiveShadow = true;
            roomGroup.add(botWallSeg);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(ww, sillH, winW), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            roomGroup.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, wd), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            roomGroup.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, topH, winW), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            roomGroup.add(topWall);

            buildWindowWithCurtains(
              roomGroup,
              wx,
              sillH + winH / 2,
              wz,
              winW,
              winH,
              ww,
              false,
              furnished && (room.name === "bedroom" || room.name === "hall"),
              false
            );
          }
        } else {
          // Solid Wall
          const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, wd), wallMaterial);
          wall.position.set(wx, WALL_HEIGHT_FT / 2, wz);
          wall.castShadow = true;
          wall.receiveShadow = true;
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

    // 7. Roof — RCC slab, parapet, and sunshades over exterior openings.
    if (rooms.length > 0) {
      const roof = new THREE.Group();
      roof.visible = modeRef.current === "walkthrough";
      roofGroupRef.current = roof;
      group.add(roof);

      const slabMat = new THREE.MeshStandardMaterial({ color: 0xb8b3aa, roughness: 0.92 });
      const SLAB_T = 0.55;
      const CHAJJA_T = 0.28;
      const CHAJJA_OUT = 1.9;      // ~22 in projection, a standard sunshade
      const PARAPET_H = 3.2;

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

      rooms.forEach((room) => {
        const rw = inchesToFeet(room.w_in);
        const rd = inchesToFeet(room.d_in);
        const rx = inchesToFeet(room.x_in);
        const rz = inchesToFeet(room.y_in);
        for (const o of room.openings ?? []) {
          if (o.to_room != null) continue;
          const width = inchesToFeet(o.width_in) + 1.2;
          const head = inchesToFeet((o.sill_in ?? 0) + o.height_in) + 0.35;
          const isEW = o.edge === "N" || o.edge === "S";
          const centre = openingCentreFt(room, o);
          const geom = isEW
            ? new THREE.BoxGeometry(width, CHAJJA_T, CHAJJA_OUT)
            : new THREE.BoxGeometry(CHAJJA_OUT, CHAJJA_T, width);
          const shade = new THREE.Mesh(geom, slabMat);
          const off = CHAJJA_OUT / 2;
          if (o.edge === "N") shade.position.set(centre, head, rz - off + 0.3);
          else if (o.edge === "S") shade.position.set(centre, head, rz + rd + off - 0.3);
          else if (o.edge === "W") shade.position.set(rx - off + 0.3, head, centre);
          else shade.position.set(rx + rw + off - 0.3, head, centre);
          shade.castShadow = true;
          group.add(shade);
        }
      });
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
  }, [
    plot,
    facing,
    setback,
    rooms,
    furnished,
    customObjects,
    deletedBuiltinIds,
    selectedObjectId,
    materialConfig,
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
  }, [placingItemType]);

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

      {draggedRoomInfo && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 229, 255, 0.95)",
            color: "#051119",
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
          📍 Dragging {ROOM_LABELS[draggedRoomInfo.name as RoomName] ?? draggedRoomInfo.name} — Release to place & auto-connect door!
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
