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
  CROUCH_HEIGHT_FT,
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
  onPlotChange?: (next: PlotDims) => void;
  onPlayerUpdate?: (player: PlayerTransform) => void;
  onToggleLights?: () => void;
  onRoomMove?: (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => void;
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
  onPlotChange,
  onPlayerUpdate,
  onToggleLights,
  onRoomMove,
}: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const widthHandleRef = useRef<THREE.Mesh | null>(null);
  const depthHandleRef = useRef<THREE.Mesh | null>(null);

  // Drag-and-Drop room meshes references
  const ghostRoomMeshRef = useRef<THREE.Mesh | null>(null);
  const draggedRoomIdxRef = useRef<number | null>(null);
  const [draggedRoomInfo, setDraggedRoomInfo] = useState<{ name: string; x: number; z: number } | null>(null);
  const [doorAlert, setDoorAlert] = useState<string | null>(null);

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
    pitch: 0,
    isSprinting: false,
    isCrouched: false,
    isMoving: false,
    lightsOn: true,
  });

  const jumpVelocityY = useRef(0);
  const isJumping = useRef(false);
  const bobTimer = useRef(0);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const isDraggingLook = useRef(false);
  const prevMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const savedOrbitTarget = useRef<THREE.Vector3>(new THREE.Vector3());
  const savedOrbitCamPos = useRef<THREE.Vector3>(new THREE.Vector3());

  const plotRef = useRef(plot);
  const onPlotChangeRef = useRef(onPlotChange);
  const onPlayerUpdateRef = useRef(onPlayerUpdate);
  const onToggleLightsRef = useRef(onToggleLights);
  const onRoomMoveRef = useRef(onRoomMove);
  const modeRef = useRef(mode);
  const activeMoveCmdRef = useRef(activeMoveCmd);
  const lightsOnRef = useRef(lightsOn);
  const roomsRef = useRef(rooms);

  useEffect(() => {
    plotRef.current = plot;
    onPlotChangeRef.current = onPlotChange;
    onPlayerUpdateRef.current = onPlayerUpdate;
    onToggleLightsRef.current = onToggleLights;
    onRoomMoveRef.current = onRoomMove;
    modeRef.current = mode;
    activeMoveCmdRef.current = activeMoveCmd;
    lightsOnRef.current = lightsOn;
    roomsRef.current = rooms;

    roomLightsRef.current.forEach((l) => {
      l.visible = lightsOn;
    });
  }, [plot, onPlotChange, onPlayerUpdate, onToggleLights, onRoomMove, mode, activeMoveCmd, lightsOn, rooms]);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controlsRef.current = controls;

    // Architectural Lighting setup
    const hemiLight = new THREE.HemisphereLight(0xe8f0fe, 0x1e2630, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.85);
    sunLight.position.set(50, 80, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 220;
    const shadowSize = 75;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    sunLight.shadow.bias = -0.0003;
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
    let dragKind: "width" | "depth" | "room" | null = null;

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

    function onPointerDownCapture(ev: PointerEvent) {
      if (modeRef.current === "walkthrough") {
        isDraggingLook.current = true;
        prevMousePos.current = { x: ev.clientX, y: ev.clientY };
        return;
      }

      const hitHandle = pickHandle(ev);
      if (hitHandle) {
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        dragKind = hitHandle;
        controls.enabled = false;
        return;
      }

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
      }
    }

    function onPointerMove(ev: PointerEvent) {
      if (modeRef.current === "walkthrough") {
        if (isDraggingLook.current) {
          const dx = ev.clientX - prevMousePos.current.x;
          const dy = ev.clientY - prevMousePos.current.y;
          prevMousePos.current = { x: ev.clientX, y: ev.clientY };

          const p = playerRef.current;
          p.yaw -= dx * 0.0045;
          p.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, p.pitch - dy * 0.0045));
        }
        return;
      }

      setPointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      if (!dragKind) {
        const isOverHandle = pickHandle(ev) !== null;
        const isOverRoom = pickRoom(ev) !== null;
        renderer.domElement.style.cursor = isOverHandle || isOverRoom ? "grab" : "auto";
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
      } else if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
        const rIdx = draggedRoomIdxRef.current;
        const r = roomsRef.current[rIdx];
        if (r) {
          const rw = inchesToFeet(r.w_in);
          const rd = inchesToFeet(r.d_in);
          const snappedCornerX = Math.round(hitPoint.x - rw / 2);
          const snappedCornerZ = Math.round(hitPoint.z - rd / 2);
          ghostMesh.position.set(snappedCornerX + rw / 2, WALL_HEIGHT_FT / 2, snappedCornerZ + rd / 2);
          setDraggedRoomInfo({ name: r.name, x: snappedCornerX + rw / 2, z: snappedCornerZ + rd / 2 });
        }
      }
    }

    function onPointerUp() {
      isDraggingLook.current = false;
      if (dragKind === "room" && draggedRoomIdxRef.current !== null && ghostMesh) {
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

        if (onPlayerUpdateRef.current) {
          onPlayerUpdateRef.current({
            ...p,
            y: effectiveCameraY,
            isSprinting,
            isCrouched,
            isMoving,
            lightsOn: lightsOnRef.current,
          });
        }
      } else {
        controls.enabled = true;
        controls.update();
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
        pitch: 0,
      };

      if (widthHandleRef.current) widthHandleRef.current.visible = false;
      if (depthHandleRef.current) depthHandleRef.current.visible = false;
    } else {
      if (savedOrbitCamPos.current.lengthSq() > 0) {
        camera.position.copy(savedOrbitCamPos.current);
        controls.target.copy(savedOrbitTarget.current);
      }
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
      houseCenterX = (minX + maxX) / 2;
      houseCenterZ = (minZ + maxZ) / 2;
      houseRadius = Math.max(Math.hypot(maxX - minX, maxZ - minZ) / 2, WALL_HEIGHT_FT);
    } else {
      houseCenterX = (envMinX + envMaxX) / 2;
      houseCenterZ = (envMinZ + envMaxZ) / 2;
      houseRadius = Math.max(Math.hypot(envMaxX - envMinX, envMaxZ - envMinZ) / 2, WALL_HEIGHT_FT);
    }

    const houseCenter = new THREE.Vector3(houseCenterX, WALL_HEIGHT_FT * 0.35, houseCenterZ);
    controls.target.copy(houseCenter);

    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 1.2, 1.4);
    dir.normalize();

    const fovRad = (camera.fov * Math.PI) / 180;
    const dist = (houseRadius * 1.35) / Math.sin(fovRad / 2);
    camera.position.copy(houseCenter).addScaledVector(dir, dist);
    controls.update();
    // Deliberately not keyed on `furnished`: toggling furniture must not yank the camera out
    // from under someone mid-orbit. Same reasoning as the 2026-08-24 reframe fix.
  }, [plot, facing, setback, rooms]);

  // Sync effect: Rebuild Architectural 3D Geometry
  useEffect(() => {
    const group = groupRef.current;
    const widthHandle = widthHandleRef.current;
    const depthHandle = depthHandleRef.current;
    if (!group || !widthHandle || !depthHandle) return;

    fanBladesRef.current = [];
    roomLightsRef.current = [];

    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite || child instanceof THREE.PointLight) {
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

    // 5. Doors, windows and the front door come from the solver.
    //
    // They used to be re-derived here from the room rectangles alone, which meant the renderer
    // and the solver held two different opinions about the same house — see
    // notes/architecture/duplicated-geometry.md. The backend now ships `openings` on every
    // room (door / window / entrance, with edge, offset and width) and this reads them.
    //
    // It matters beyond tidiness: the client's own rule attached a bathroom to whichever
    // bedroom it happened to touch, while the solver *constrains* the ensuite to open off the
    // master bedroom and the second bath off the hall. The doors drawn were not the doors the
    // plan was solved for.
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

    // Offsets run along the edge from the room's minimum corner on that edge's axis, matching
    // _edge_origin() in backend/solver/connectivity.py. N/S edges run along X, E/W along Z.
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

    const windowOn = (i: number, edge: "N" | "S" | "E" | "W") =>
      (rooms[i].openings ?? []).find((o) => o.kind === "window" && o.edge === edge);

    // 6. Build Architectural Rooms
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const rw = inchesToFeet(room.w_in);
      const rd = inchesToFeet(room.d_in);
      const rx = inchesToFeet(room.x_in);
      const rz = inchesToFeet(room.y_in);
      const isHub = i === hubIndex;

      // Floor Mesh
      let floorTexture: THREE.CanvasTexture;
      if (room.name === "bedroom") floorTexture = getWoodFloorTexture();
      else if (room.name === "hall") floorTexture = getMarbleFloorTexture(false);
      else if (room.name === "pooja") floorTexture = getMarbleFloorTexture(true);
      else if (room.name === "kitchen") floorTexture = getTileFloorTexture(true);
      else floorTexture = getTileFloorTexture(false);

      const floorGeom = new THREE.PlaneGeometry(rw, rd);
      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: room.name === "bedroom" ? 0.45 : 0.18,
        metalness: room.name === "hall" || room.name === "pooja" ? 0.14 : 0.04,
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(rx + rw / 2, 0.04, rz + rd / 2);
      floorMesh.receiveShadow = true;
      group.add(floorMesh);

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
        // The solver decides which walls carry glass. The old rule excluded bathrooms outright,
        // which left every wet room unventilated — see derive_windows() in connectivity.py.
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
              group.add(leftWall);

              const leftBase = new THREE.Mesh(new THREE.BoxGeometry(leftW, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
              leftBase.position.set(wx - ww / 2 + leftW / 2, BASEBOARD_H_FT / 2, wz);
              group.add(leftBase);
            }

            if (rightW > 0.1) {
              const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightW, WALL_HEIGHT_FT, wd), wallMaterial);
              rightWall.position.set(wx + ww / 2 - rightW / 2, WALL_HEIGHT_FT / 2, wz);
              rightWall.castShadow = true;
              rightWall.receiveShadow = true;
              group.add(rightWall);

              const rightBase = new THREE.Mesh(new THREE.BoxGeometry(rightW, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
              rightBase.position.set(wx + ww / 2 - rightW / 2, BASEBOARD_H_FT / 2, wz);
              group.add(rightBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wd), wallMaterial);
            lintel.position.set(doorPos, doorH + lintelH / 2, wz);
            lintel.castShadow = true;
            group.add(lintel);

            const fMat = isMainEntrance ? mainEntranceFrameMat : doorFrameMaterial;
            const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, wd + 0.08), fMat);
            frameL.position.set(doorPos - doorW / 2 + 0.11, doorH / 2, wz);
            group.add(frameL);

            const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, wd + 0.08), fMat);
            frameR.position.set(doorPos + doorW / 2 - 0.11, doorH / 2, wz);
            group.add(frameR);

            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.22, wd + 0.08), fMat);
            frameTop.position.set(doorPos, doorH - 0.11, wz);
            group.add(frameTop);

            if (isMainEntrance) {
              const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.2), goldHardwareMat);
              handle.position.set(doorPos + doorW / 2 - 0.4, doorH * 0.48, wz + 0.15);
              group.add(handle);
            }
          } else {
            const topD = Math.max(0.1, doorPos - (wz - wd / 2) - doorW / 2);
            const bottomD = Math.max(0.1, (wz + wd / 2) - (doorPos + doorW / 2));

            if (topD > 0.1) {
              const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, topD), wallMaterial);
              topWall.position.set(wx, WALL_HEIGHT_FT / 2, wz - wd / 2 + topD / 2);
              topWall.castShadow = true;
              topWall.receiveShadow = true;
              group.add(topWall);

              const topBase = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, topD), baseboardMaterial);
              topBase.position.set(wx, BASEBOARD_H_FT / 2, wz - wd / 2 + topD / 2);
              group.add(topBase);
            }

            if (bottomD > 0.1) {
              const botWall = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, bottomD), wallMaterial);
              botWall.position.set(wx, WALL_HEIGHT_FT / 2, wz + wd / 2 - bottomD / 2);
              botWall.castShadow = true;
              botWall.receiveShadow = true;
              group.add(botWall);

              const botBase = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, bottomD), baseboardMaterial);
              botBase.position.set(wx, BASEBOARD_H_FT / 2, wz + wd / 2 - bottomD / 2);
              group.add(botBase);
            }

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(ww, lintelH, doorW), wallMaterial);
            lintel.position.set(wx, doorH + lintelH / 2, doorPos);
            lintel.castShadow = true;
            group.add(lintel);

            const fMat = isMainEntrance ? mainEntranceFrameMat : doorFrameMaterial;
            const frameN = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, doorH, 0.22), fMat);
            frameN.position.set(wx, doorH / 2, doorPos - doorW / 2 + 0.11);
            group.add(frameN);

            const frameS = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, doorH, 0.22), fMat);
            frameS.position.set(wx, doorH / 2, doorPos + doorW / 2 - 0.11);
            group.add(frameS);

            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, 0.22, doorW), fMat);
            frameTop.position.set(wx, doorH - 0.11, doorPos);
            group.add(frameTop);

            if (isMainEntrance) {
              const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.12), goldHardwareMat);
              handle.position.set(wx + 0.15, doorH * 0.48, doorPos + doorW / 2 - 0.4);
              group.add(handle);
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
            group.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT_FT, wd), wallMaterial);
            rightWall.position.set(wx + ww / 2 - sideW / 2, WALL_HEIGHT_FT / 2, wz);
            rightWall.castShadow = true;
            rightWall.receiveShadow = true;
            group.add(rightWall);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, wd), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            group.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww, BASEBOARD_H_FT, wd + 0.04), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            group.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(winW, topH, wd), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            group.add(topWall);

            buildWindowWithCurtains(
              group,
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
            group.add(topWallSeg);

            const botWallSeg = new THREE.Mesh(new THREE.BoxGeometry(ww, WALL_HEIGHT_FT, sideD), wallMaterial);
            botWallSeg.position.set(wx, WALL_HEIGHT_FT / 2, wz + wd / 2 - sideD / 2);
            botWallSeg.castShadow = true;
            botWallSeg.receiveShadow = true;
            group.add(botWallSeg);

            const sillWall = new THREE.Mesh(new THREE.BoxGeometry(ww, sillH, winW), wallMaterial);
            sillWall.position.set(wx, sillH / 2, wz);
            sillWall.castShadow = true;
            sillWall.receiveShadow = true;
            group.add(sillWall);

            const baseboard = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, BASEBOARD_H_FT, wd), baseboardMaterial);
            baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
            group.add(baseboard);

            const topWall = new THREE.Mesh(new THREE.BoxGeometry(ww, topH, winW), wallMaterial);
            topWall.position.set(wx, sillH + winH + topH / 2, wz);
            topWall.castShadow = true;
            group.add(topWall);

            buildWindowWithCurtains(
              group,
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
          group.add(wall);

          const baseboard = new THREE.Mesh(
            new THREE.BoxGeometry(isEW ? ww : ww + 0.04, BASEBOARD_H_FT, isEW ? wd + 0.04 : wd),
            baseboardMaterial
          );
          baseboard.position.set(wx, BASEBOARD_H_FT / 2, wz);
          group.add(baseboard);
        }
      };

      // Wall thickness comes from the solver: 9 in load-bearing on the building's perimeter,
      // 4.5 in partitions inside. The renderer used to draw 4.5 in everywhere while the solver
      // reserved 5 in — notes/architecture/duplicated-geometry.md.
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

      // Warm interior recessed spotlight
      const roomLight = new THREE.PointLight(0xfff0dd, 1.1, 26, 1.2);
      roomLight.position.set(rx + rw / 2, 8.2, rz + rd / 2);
      roomLight.castShadow = true;
      roomLight.shadow.bias = -0.001;
      roomLight.visible = lightsOnRef.current;
      group.add(roomLight);
      roomLightsRef.current.push(roomLight);

      const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffe6ba,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 24), fixtureMat);
      fixture.position.set(rx + rw / 2, 8.95, rz + rd / 2);
      group.add(fixture);

      // Ceiling Fan in Living Hall & Bedrooms
      if (furnished && (room.name === "hall" || room.name === "bedroom")) {
        const fan = addCeilingFan(group, rx + rw / 2, rz + rd / 2, 8.1);
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

      // Intelligent, Door-Aware Furniture Placement. Unchecked leaves the bare shell, which is
      // also the honest view of what the solver actually decided.
      if (furnished) {
        addRoomInteriorDetails(group, room.name as RoomName, rx, rz, rw, rd, roomDoors);
      }

      // 3D Floating Room Badge
      const badge = createRoomBadge(
        ROOM_LABELS[room.name as RoomName] ?? room.name,
        rw,
        rd
      );
      badge.position.set(rx + rw / 2, WALL_HEIGHT_FT + 1.8, rz + rd / 2);
      group.add(badge);
    }

    // 7. Roof — RCC slab, parapet, and sunshades over exterior openings.
    //
    // The walls used to stop at 9 ft and stop. An Indian house is a flat reinforced-concrete
    // slab with a parapet round the terrace and a chajja over every window and door to keep
    // monsoon rain off the opening; without them this reads as a massing diagram, not a
    // building. Hidden in orbit so the plan stays readable from above, shown in walkthrough
    // where you would otherwise be standing in a roofless room.
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

      // One slab per room, so the roof follows an L- or T-shaped footprint rather than
      // bridging the gaps a rectangular slab would invent.
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

      // Parapet around the outside of the built footprint.
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

      // Chajja over each exterior opening. These stay visible in orbit — they are part of how
      // the building reads from outside, and they do not hide the plan.
      rooms.forEach((room) => {
        const rw = inchesToFeet(room.w_in);
        const rd = inchesToFeet(room.d_in);
        const rx = inchesToFeet(room.x_in);
        const rz = inchesToFeet(room.y_in);
        for (const o of room.openings ?? []) {
          if (o.to_room != null) continue; // interior door, no weather to keep off
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

    widthHandle.position.set(wFt, HANDLE_RADIUS_FT, dFt / 2);
    depthHandle.position.set(wFt / 2, HANDLE_RADIUS_FT, dFt);
  }, [plot, facing, setback, rooms, furnished]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
