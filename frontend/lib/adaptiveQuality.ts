// Quality that measures itself, because detection cannot be trusted and hardware cannot be known.
//
// `gpuTier.ts` picks a starting rung from what the browser says the GPU is. That is a guess: the
// string is a marketing name, browsers are allowed to withhold it, and a thermally throttled
// laptop is a different machine at minute ten than at minute one. The only fact available is the
// frame time, and this file is the loop that acts on it.
//
// ## Why only two settings move
//
// The ladder changes render scale and shadow quality and nothing else. Anti-aliasing and shader
// precision are WebGL context attributes and cannot be changed after the context exists. Texture
// quality could be changed, but the textures are generated on a canvas and cached, so moving it
// rebuilds every material mid-frame — a stall, in the name of avoiding stalls. Render scale is a
// framebuffer resize and shadow quality is a shadow-map resize; both are cheap, and between them
// they are most of the cost.
//
// ## Hysteresis, or it oscillates
//
// Stepping down on one slow frame and up on one fast one produces a renderer that flickers
// between resolutions forever, which looks worse than either. So: a window of frames, different
// thresholds for down and up, a longer wait before stepping up than down, and a cap on how many
// times it may climb back — a machine that has been demoted twice has proved something.

import { GraphicsSettings, RenderScale, ShadowQuality } from "./graphicsConfig";
import { GpuTier } from "./gpuTier";

interface Rung {
  renderScale: RenderScale;
  shadowQuality: ShadowQuality;
}

/**
 * Best first. Every rung is a pair the renderer can move to between frames.
 *
 * Render scale steps before shadows: a softer shadow is a visible downgrade, and a 25% resolution
 * drop on a moving 3D view mostly is not.
 */
export const QUALITY_LADDER: Rung[] = [
  { renderScale: 1.0, shadowQuality: "high" },
  { renderScale: 0.75, shadowQuality: "high" },
  { renderScale: 0.75, shadowQuality: "medium" },
  { renderScale: 0.5, shadowQuality: "medium" },
  { renderScale: 0.5, shadowQuality: "low" },
  { renderScale: 0.5, shadowQuality: "off" },
];

/** Where a tier starts before any frame has been measured. */
export function startingRung(tier: GpuTier): number {
  if (tier === "low") return 4;
  if (tier === "medium") return 2;
  return 0;
}

/** The rung a settings object is currently on, or the nearest one below it. */
export function rungOf(settings: GraphicsSettings): number {
  const exact = QUALITY_LADDER.findIndex(
    (r) => r.renderScale === settings.renderScale && r.shadowQuality === settings.shadowQuality
  );
  if (exact >= 0) return exact;
  // Hand-tuned settings are not on the ladder. Match on render scale, which is the bigger lever.
  const byScale = QUALITY_LADDER.findIndex((r) => r.renderScale <= settings.renderScale);
  return byScale >= 0 ? byScale : 0;
}

export function applyRung(settings: GraphicsSettings, rung: number): GraphicsSettings {
  const clamped = Math.max(0, Math.min(QUALITY_LADDER.length - 1, rung));
  const step = QUALITY_LADDER[clamped];
  return {
    ...settings,
    renderScale: step.renderScale,
    shadowQuality: step.shadowQuality,
    // The named preset stops describing the settings the moment this moves one.
    preset: "custom",
  };
}

/** Frames per window. About a second at 60fps, a third of a second at 20. */
const WINDOW_FRAMES = 45;
/** Below this many fps, step down. 24 is the floor at which orbiting still feels continuous. */
const FLOOR_FPS = 24;
/** Above this, consider stepping back up. The gap to FLOOR_FPS is the hysteresis band. */
const COMFORTABLE_FPS = 58;
/** Consecutive good windows before climbing. Slower up than down, on purpose. */
const WINDOWS_BEFORE_UP = 6;
/** A machine that has been demoted this many times has proved it, and stops being promoted. */
const MAX_CLIMBS = 2;

export interface AdaptiveDecision {
  /** The rung to move to, or null to stay. */
  rung: number | null;
  /** Measured frames per second over the window just closed, for the readout. */
  fps: number;
}

/**
 * Rolling frame-time judge.
 *
 * Fed one frame time per frame; answers at most once per window. Deliberately a plain object with
 * a `sample` method rather than a hook — it is called from inside the render loop, where a React
 * state read per frame is the thing being avoided.
 */
export class QualityGovernor {
  private acc = 0;
  private frames = 0;
  private goodWindows = 0;
  private climbs = 0;
  private demotions = 0;
  /** Frames to ignore after a change: a resize costs a frame and it is not evidence. */
  private settle = 0;

  constructor(private rung: number) {}

  get currentRung(): number {
    return this.rung;
  }

  /** Call when something other than this governor changed the settings. */
  syncTo(rung: number): void {
    this.rung = rung;
    this.reset();
  }

  private reset(): void {
    this.acc = 0;
    this.frames = 0;
    this.goodWindows = 0;
    this.settle = 10;
  }

  /** `dtSeconds` is the frame delta the render loop already computes. */
  sample(dtSeconds: number): AdaptiveDecision | null {
    if (this.settle > 0) {
      this.settle -= 1;
      return null;
    }
    // A tab that was in the background hands back one enormous delta on return. It is not a
    // slow frame, and treating it as one demotes a machine for being minimised.
    if (dtSeconds <= 0 || dtSeconds > 0.5) return null;

    this.acc += dtSeconds;
    this.frames += 1;
    if (this.frames < WINDOW_FRAMES) return null;

    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;

    if (fps < FLOOR_FPS && this.rung < QUALITY_LADDER.length - 1) {
      this.rung += 1;
      this.demotions += 1;
      this.goodWindows = 0;
      this.settle = 10;
      return { rung: this.rung, fps };
    }

    if (fps > COMFORTABLE_FPS && this.rung > 0 && this.climbs < MAX_CLIMBS && this.demotions < 2) {
      this.goodWindows += 1;
      if (this.goodWindows >= WINDOWS_BEFORE_UP) {
        this.rung -= 1;
        this.climbs += 1;
        this.goodWindows = 0;
        this.settle = 10;
        return { rung: this.rung, fps };
      }
      return { rung: null, fps };
    }

    this.goodWindows = 0;
    return { rung: null, fps };
  }
}
