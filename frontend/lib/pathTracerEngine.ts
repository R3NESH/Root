import * as THREE from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";

export interface PathTracerConfig {
  bounces?: number;
  targetSamples?: number;
  renderScale?: number;
  tiles?: [number, number];
  filterGlossyFactor?: number;
}

export interface PathTracerState {
  samples: number;
  targetSamples: number;
  isRendering: boolean;
  isPaused: boolean;
  progress: number;
  elapsedMs: number;
}

export class ArchitecturalPathTracer {
  private renderer: THREE.WebGLRenderer;
  private pathTracer: WebGLPathTracer;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private startTime: number = 0;
  private config: Required<PathTracerConfig>;
  private isPaused: boolean = false;
  private isDisposed: boolean = false;
  private onUpdateCallback?: (state: PathTracerState) => void;

  constructor(
    canvas: HTMLCanvasElement,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    config: PathTracerConfig = {},
    onUpdate?: (state: PathTracerState) => void
  ) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.onUpdateCallback = onUpdate;

    this.config = {
      bounces: config.bounces ?? 4,
      targetSamples: config.targetSamples ?? 60,
      renderScale: config.renderScale ?? 1.0,
      tiles: config.tiles ?? [2, 2],
      filterGlossyFactor: config.filterGlossyFactor ?? 0.5,
    };

    // Initialize dedicated WebGL2 renderer for path tracer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

    // Initialize GPU Path Tracer
    this.pathTracer = new WebGLPathTracer(this.renderer);
    this.pathTracer.bounces = this.config.bounces;
    this.pathTracer.renderScale = this.config.renderScale;
    this.pathTracer.tiles.set(this.config.tiles[0], this.config.tiles[1]);
    this.pathTracer.filterGlossyFactor = this.config.filterGlossyFactor;
    this.pathTracer.dynamicLowRes = true;
    this.pathTracer.lowResScale = 0.25;

    // Filter out helper lines, bounding boxes, UI gizmos from path tracer scene
    const cleanScene = this.createRenderableScene(this.scene);

    // Bind scene and camera to path tracer
    this.pathTracer.setScene(cleanScene, this.camera);
  }

  /**
   * Clone scene hierarchy, keeping only standard mesh geometries and lights
   * to prevent raycaster errors on 2D handles, gizmos, and HTML overlays.
   */
  private createRenderableScene(sourceScene: THREE.Scene): THREE.Scene {
    const ptScene = new THREE.Scene();
    ptScene.background = sourceScene.background;
    ptScene.environment = sourceScene.environment;

    sourceScene.traverse((obj) => {
      // Include standard meshes that have valid geometries
      if (
        obj instanceof THREE.Mesh &&
        obj.visible &&
        obj.geometry &&
        obj.geometry.attributes.position &&
        !obj.name.includes("handle") &&
        !obj.name.includes("ghost") &&
        !obj.name.includes("guide") &&
        !obj.name.includes("grid")
      ) {
        const meshClone = new THREE.Mesh(obj.geometry, obj.material);
        obj.getWorldPosition(meshClone.position);
        obj.getWorldQuaternion(meshClone.quaternion);
        obj.getWorldScale(meshClone.scale);
        meshClone.castShadow = true;
        meshClone.receiveShadow = true;
        ptScene.add(meshClone);
      } else if (obj instanceof THREE.Light && obj.visible) {
        const lightClone = obj.clone();
        ptScene.add(lightClone);
      }
    });

    return ptScene;
  }

  public start(): void {
    if (this.isDisposed) return;
    this.startTime = performance.now();
    this.isPaused = false;
    this.loop();
  }

  public pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.notifyUpdate();
  }

  public resume(): void {
    if (this.isPaused && !this.isDisposed) {
      this.isPaused = false;
      this.loop();
    }
  }

  public reset(): void {
    this.pathTracer.reset();
    this.startTime = performance.now();
    this.notifyUpdate();
  }

  private loop = (): void => {
    if (this.isPaused || this.isDisposed) return;

    if (this.pathTracer.samples < this.config.targetSamples) {
      this.pathTracer.renderSample();
      this.notifyUpdate();
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.notifyUpdate();
    }
  };

  private notifyUpdate(): void {
    if (!this.onUpdateCallback) return;
    const currentSamples = this.pathTracer.samples || 0;
    const target = this.config.targetSamples;
    const progress = Math.min(1.0, currentSamples / target);
    const elapsedMs = Math.round(performance.now() - this.startTime);

    this.onUpdateCallback({
      samples: currentSamples,
      targetSamples: target,
      isRendering: currentSamples < target && !this.isPaused,
      isPaused: this.isPaused,
      progress,
      elapsedMs,
    });
  }

  public exportImagePNG(filename: string = "architectural_render.png"): void {
    const dataUrl = this.canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.pathTracer.dispose();
    this.renderer.dispose();
  }
}
