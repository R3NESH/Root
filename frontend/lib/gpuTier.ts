// What the machine can actually draw, asked of the GPU rather than inferred from the CPU.
//
// Scene.tsx decided this with:
//
//     navigator.hardwareConcurrency <= 4
//
// which counts CPU threads. It says nothing about graphics, and it is wrong in the commonest
// case there is: a laptop with an eight-core CPU and Intel integrated graphics reports 8, fails
// the test, and is handed the dedicated-GPU path — MSAA, a 1.5 pixel ratio (2.25x the pixels of
// 1.0), soft shadows, highp precision and the whole post chain. That is the machine that runs at
// single-digit FPS while the developer's desktop is fine.
//
// ## This is a starting guess, not an answer
//
// `WEBGL_debug_renderer_info` is the only way to ask the browser what the GPU is, and it is not
// dependable: Firefox masks it under privacy.resistFingerprinting, and any browser may. The
// string it returns is also a marketing name, not a benchmark. So the tier here only picks a
// starting rung and the two settings that cannot be changed later; `adaptiveQuality.ts` measures
// real frame times and corrects it. Detection that cannot be corrected is the bug this replaces.

export type GpuTier = "low" | "medium" | "high";

export interface GpuInfo {
  tier: GpuTier;
  /** UNMASKED_RENDERER_WEBGL, or null when the browser withholds it. */
  renderer: string | null;
  /** Why this tier, in words, so the performance HUD can stop inventing one. */
  reason: string;
}

/**
 * Software renderers. A browser that has fallen back to these is not using a GPU at all, and no
 * quality setting will save it — worth naming rather than filing under "low".
 */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** Discrete parts. The only ones that earn the expensive path up front. */
const DISCRETE = /geforce|rtx|gtx|quadro|radeon (rx|pro|hd [7-9])|firepro|arc a\d|tesla/i;

/**
 * Integrated desktop and laptop graphics. These are the machines the old check waved through.
 * Apple Silicon is deliberately not here: an M-series GPU is integrated by construction and
 * comfortably outruns much of the discrete list.
 */
const INTEGRATED = /intel|uhd graphics|hd graphics|iris|vega \d|radeon graphics|microsoft basic/i;

/** Phone and tablet GPUs. */
const MOBILE_GPU = /adreno|mali|powervr|apple a\d{1,2} gpu|videocore/i;

const APPLE_SILICON = /apple m\d/i;

/** Reads the renderer string once. Creating a throwaway context is the only way to ask. */
function readRendererString(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
    // Contexts are a limited resource and this one exists only to be read.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

let cached: GpuInfo | null = null;

/** Classify the GPU. Cached: the answer cannot change while the page is open. */
export function detectGpu(): GpuInfo {
  if (cached) return cached;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  const renderer = readRendererString();

  let tier: GpuTier;
  let reason: string;

  if (renderer && SOFTWARE.test(renderer)) {
    tier = "low";
    reason = "software rendering, no GPU in use";
  } else if (isMobileUA) {
    tier = "low";
    reason = "mobile device";
  } else if (renderer && MOBILE_GPU.test(renderer)) {
    tier = "low";
    reason = "mobile-class GPU";
  } else if (renderer && APPLE_SILICON.test(renderer)) {
    tier = "high";
    reason = "Apple Silicon";
  } else if (renderer && DISCRETE.test(renderer)) {
    tier = "high";
    reason = "discrete GPU";
  } else if (renderer && INTEGRATED.test(renderer)) {
    tier = "medium";
    reason = "integrated graphics";
  } else if (renderer) {
    tier = "medium";
    reason = "unrecognised GPU, starting mid";
  } else {
    // Masked, or no WebGL debug extension. Starting high here is how the original bug behaved;
    // starting mid costs a little sharpness on a strong machine and saves an unusable first
    // minute on a weak one, and the frame-time loop moves it either way within seconds.
    tier = "medium";
    reason = "GPU hidden by the browser, starting mid";
  }

  cached = { tier, renderer, reason };
  return cached;
}

/**
 * Device pixel ratio cap.
 *
 * The single biggest multiplier on this page: rendering at 1.5 is 2.25 times the pixels of 1.0,
 * and it is applied before any of the quality settings. Fixed at renderer creation, so the tier
 * has to get it approximately right — the adaptive loop scales `renderScale` instead.
 */
export function dprCapFor(tier: GpuTier): number {
  if (tier === "low") return 1.0;
  if (tier === "medium") return 1.25;
  return 1.5;
}

/**
 * Settings that can only be chosen when the WebGL context is created and never afterwards.
 * Anti-aliasing and precision are context attributes; the shadow map type is cheap to change but
 * belongs with them because it is the same decision.
 */
export function contextOptionsFor(tier: GpuTier): {
  antialias: boolean;
  precision: "highp" | "mediump";
  softShadows: boolean;
} {
  if (tier === "low") return { antialias: false, precision: "mediump", softShadows: false };
  if (tier === "medium") return { antialias: false, precision: "highp", softShadows: true };
  return { antialias: true, precision: "highp", softShadows: true };
}
