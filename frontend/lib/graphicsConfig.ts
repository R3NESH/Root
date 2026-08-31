// Graphics Settings & Performance Configuration
// Render scale, procedural texture resolution, shadow map size, anisotropy and tone mapping.
// Every setting here is read by Scene.tsx — see the note above GraphicsSettings.

export type GraphicsPresetId = "low_eco" | "medium_balanced" | "high_quality" | "ultra_extreme" | "custom";

export type RenderScale = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export type TextureQuality = "low" | "medium" | "high" | "ultra_4k"; // 512, 1024, 2048, 4096

export type ShadowQuality = "off" | "low" | "medium" | "high" | "ultra_4k"; // 0, 512, 1024, 2048, 4096

export type ToneMappingType = "aces_filmic" | "reinhard" | "cineon" | "linear";

/**
 * Every field here must be read by Scene.tsx. Nothing else belongs in it.
 *
 * This interface used to also carry `upscalingMode` (DLSS/FSR), `sharpening`, `ambientOcclusion`,
 * `bloomGlow`, `floorReflections` and `targetFpsCap`, each with chips or a toggle in the modal
 * and zero references in the renderer. DLSS and FSR in particular are vendor driver features
 * that WebGL cannot reach at all, so that control could never have been wired up — it had to go
 * rather than wait. If you add a setting, wire it first.
 */
export interface GraphicsSettings {
  preset: GraphicsPresetId;
  renderScale: RenderScale;
  textureQuality: TextureQuality;
  anisotropicFiltering: 2 | 4 | 8 | 16;
  shadowQuality: ShadowQuality;
  toneMapping: ToneMappingType;
  exposure: number; // 0.6 to 1.8
  showPerformanceHUD: boolean;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: "ultra_extreme",
  renderScale: 1.5, // 150% Super-Sampling DSR for High-End GPUs
  textureQuality: "ultra_4k", // 4096px uncompressed procedural textures
  anisotropicFiltering: 16,
  shadowQuality: "ultra_4k", // 4096px PCF Soft contact-hardening shadows
  toneMapping: "aces_filmic",
  exposure: 1.15,
  showPerformanceHUD: true,
};

export interface PresetDef {
  id: GraphicsPresetId;
  name: string;
  badge: string;
  description: string;
  settings: Partial<GraphicsSettings>;
}

export const GRAPHICS_PRESETS: PresetDef[] = [
  {
    id: "ultra_extreme",
    name: "💎 Ultra Extreme (4K / 8K High Fidelity)",
    badge: "Maximum Fidelity",
    description: "150% DSR super-sampling, 4096px procedural PBR textures, 4096px PCF soft shadows, 16x anisotropy.",
    settings: {
      preset: "ultra_extreme",
      renderScale: 1.5,
      textureQuality: "ultra_4k",
      anisotropicFiltering: 16,
      shadowQuality: "ultra_4k",
                  exposure: 1.15,
    },
  },
  {
    id: "high_quality",
    name: "🔥 High Quality (1440p / 4K Standard)",
    badge: "Balanced High-End",
    description: "100% native render scale, 2048px textures, 2048px soft shadows, 8x anisotropy.",
    settings: {
      preset: "high_quality",
      renderScale: 1.0,
      textureQuality: "high",
      anisotropicFiltering: 8,
      shadowQuality: "high",
          exposure: 1.10,
    },
  },
  {
    id: "medium_balanced",
    name: "✨ Balanced / Standard Laptop",
    badge: "Optimal FPS",
    description: "75% render scale, 1024px textures, 1024px shadows, 4x anisotropy.",
    settings: {
      preset: "medium_balanced",
      renderScale: 0.75,
      textureQuality: "medium",
      anisotropicFiltering: 4,
      shadowQuality: "medium",
      exposure: 1.05,
    },
  },
  {
    id: "low_eco",
    name: "⚡ Low / Battery Saver (Integrated GPU)",
    badge: "Max Performance",
    description: "50% render scale, 512px textures, shadows off, for maximum frame rate on integrated GPUs.",
    settings: {
      preset: "low_eco",
      renderScale: 0.5,
      textureQuality: "low",
      anisotropicFiltering: 2,
      shadowQuality: "off",
      exposure: 1.0,
    },
  },
];

/**
 * Returns texture pixel resolution from TextureQuality enum.
 */
export function getTextureResolution(quality: TextureQuality): number {
  switch (quality) {
    case "ultra_4k":
      return 4096;
    case "high":
      return 2048;
    case "medium":
      return 1024;
    case "low":
    default:
      return 512;
  }
}

/**
 * Returns shadow map pixel resolution from ShadowQuality enum.
 */
export function getShadowMapResolution(quality: ShadowQuality): number {
  switch (quality) {
    case "ultra_4k":
      return 4096;
    case "high":
      return 2048;
    case "medium":
      return 1024;
    case "low":
      return 512;
    case "off":
    default:
      return 0;
  }
}

/**
 * Calculates estimated VRAM usage based on active graphics parameters.
 */
export function estimateVRAMUsageGB(settings: GraphicsSettings): number {
  let vram = 1.2; // Base WebGL overhead & geometry buffer

  // Texture VRAM
  if (settings.textureQuality === "ultra_4k") vram += 4.8;
  else if (settings.textureQuality === "high") vram += 1.8;
  else if (settings.textureQuality === "medium") vram += 0.8;
  else vram += 0.3;

  // Framebuffer & Render Scale VRAM
  vram += settings.renderScale * 1.5;

  // Shadow Map Framebuffers
  if (settings.shadowQuality === "ultra_4k") vram += 2.0;
  else if (settings.shadowQuality === "high") vram += 0.8;
  else if (settings.shadowQuality === "medium") vram += 0.3;

  // Anisotropy
  if (settings.anisotropicFiltering === 16) vram += 0.4;

  return +(vram).toFixed(1);
}
