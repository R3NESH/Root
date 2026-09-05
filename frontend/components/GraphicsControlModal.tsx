"use client";

import React from "react";
import {
  GraphicsSettings,
  GRAPHICS_PRESETS,
  GraphicsPresetId,
  RenderScale,
  TextureQuality,
  ShadowQuality,
  ToneMappingType,
  estimateVRAMUsageGB,
} from "@/lib/graphicsConfig";
import styles from "./GraphicsControlModal.module.css";

interface GraphicsControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GraphicsSettings;
  onChangeSettings: (next: GraphicsSettings) => void;
}

export default function GraphicsControlModal({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
}: GraphicsControlModalProps) {
  if (!isOpen) return null;

  const handleApplyPreset = (presetId: GraphicsPresetId) => {
    const preset = GRAPHICS_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChangeSettings({
        ...settings,
        ...preset.settings,
        preset: presetId,
      });
    }
  };

  const updateSetting = <K extends keyof GraphicsSettings>(key: K, val: GraphicsSettings[K]) => {
    onChangeSettings({
      ...settings,
      preset: "custom",
      [key]: val,
    });
  };

  const estimatedVRAM = estimateVRAMUsageGB(settings);
  const vramPercent = Math.min(100, Math.round((estimatedVRAM / 24.0) * 100));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBadge}>GFX</div>
            <div>
              <h2 className={styles.headerTitle}>
                Graphics &amp; Display Control <span className={styles.gpuBadge}>High-Performance GPU Detected</span>
              </h2>
              <p className={styles.headerSubtitle}>
                Fine-tune internal render resolution, procedural texture detail, shadow map size and colour grading in real time.
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Settings">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Top Row: Quick Presets */}
          <div className={styles.presetsRow}>
            {GRAPHICS_PRESETS.map((preset) => {
              const isSelected = settings.preset === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`${styles.presetCard} ${isSelected ? styles.presetCardActive : ""}`}
                  onClick={() => handleApplyPreset(preset.id)}
                >
                  <div className={styles.presetTitle}>{preset.name}</div>
                  <span className={styles.presetBadge}>{preset.badge}</span>
                  <div className={styles.presetDesc}>{preset.description}</div>
                </div>
              );
            })}
          </div>

          {/* Left Column: Display, Resolution & Textures */}
          <div className={styles.column}>
            <div className={styles.sectionHeading}>
              <span>DSP</span> Display &amp; Render Resolution
            </div>

            {/* Resolution Scale / DSR */}
            <div className={styles.settingCard}>
              <div className={styles.settingHeader}>
                <span className={styles.settingTitle}>Resolution Scale (DSR Super-Sampling)</span>
                <span className={styles.settingValueBadge}>{Math.round(settings.renderScale * 100)}%</span>
              </div>
              <div className={styles.settingDesc}>
                Always match your monitor native resolution for sharpest images, or boost to 150%-200% for extreme anti-aliased super-sampling on high-end GPUs.
              </div>
              <div className={styles.chipGroup}>
                {[
                  { val: 0.5, label: "50% (1080p Perf)" },
                  { val: 0.75, label: "75% (1440p Balanced)" },
                  { val: 1.0, label: "100% (Native 4K)" },
                  { val: 1.5, label: "150% (DSR 6K Super-Sample)" },
                  { val: 2.0, label: "200% (8K Extreme)" },
                ].map((scale) => (
                  <button
                    key={scale.val}
                    className={`${styles.optionChip} ${settings.renderScale === scale.val ? styles.optionChipActive : ""}`}
                    onClick={() => updateSetting("renderScale", scale.val as RenderScale)}
                  >
                    {scale.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Texture Quality & VRAM */}
            <div className={styles.settingCard}>
              <div className={styles.settingHeader}>
                <span className={styles.settingTitle}>Texture Quality (VRAM Pool)</span>
                <span className={styles.settingValueBadge}>
                  {settings.textureQuality === "ultra_4k"
                    ? "4K Ultra (4096px)"
                    : settings.textureQuality === "high"
                    ? "2K High (2048px)"
                    : settings.textureQuality === "medium"
                    ? "1K Medium"
                    : "Low (512px)"}
                </span>
              </div>
              <div className={styles.settingDesc}>
                Set to 4K Ultra if your GPU has plenty of video memory (24GB VRAM) for uncompressed procedural marble, hardwood, and brick normal maps.
              </div>
              <div className={styles.chipGroup}>
                {[
                  { val: "ultra_4k", label: "4K Ultra (4096px - 24GB VRAM)" },
                  { val: "high", label: "2K High (2048px)" },
                  { val: "medium", label: "1K Medium (1024px)" },
                  { val: "low", label: "Low (512px)" },
                ].map((t) => (
                  <button
                    key={t.val}
                    className={`${styles.optionChip} ${settings.textureQuality === t.val ? styles.optionChipActive : ""}`}
                    onClick={() => updateSetting("textureQuality", t.val as TextureQuality)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Shadows, Lighting & Post-FX */}
          <div className={styles.column}>
            <div className={styles.sectionHeading}>
              <span>AO</span> Shadows, Lighting &amp; Post-Processing
            </div>

            {/* Shadow Quality */}
            <div className={styles.settingCard}>
              <div className={styles.settingHeader}>
                <span className={styles.settingTitle}>Shadow Quality</span>
                <span className={styles.settingValueBadge}>
                  {settings.shadowQuality === "ultra_4k"
                    ? "4K Soft PCF"
                    : settings.shadowQuality === "high"
                    ? "2K Soft"
                    : settings.shadowQuality === "medium"
                    ? "1K Standard"
                    : settings.shadowQuality === "low"
                    ? "512px Low"
                    : "Off"}
                </span>
              </div>
              <div className={styles.settingDesc}>
                Major visual consumer; 4K Ultra provides contact-hardening soft penumbra shadows under furniture and through window mullions.
              </div>
              <div className={styles.chipGroup}>
                {[
                  { val: "ultra_4k", label: "4K Ultra (4096px PCF Soft)" },
                  { val: "high", label: "2K High (2048px)" },
                  { val: "medium", label: "1K Medium (1024px)" },
                  { val: "low", label: "512px Low" },
                  { val: "off", label: "Off" },
                ].map((s) => (
                  <button
                    key={s.val}
                    className={`${styles.optionChip} ${settings.shadowQuality === s.val ? styles.optionChipActive : ""}`}
                    onClick={() => updateSetting("shadowQuality", s.val as ShadowQuality)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anisotropic Filtering */}
            <div className={styles.settingCard}>
              <div className={styles.settingHeader}>
                <span className={styles.settingTitle}>Anisotropic Texture Filtering</span>
                <span className={styles.settingValueBadge}>{settings.anisotropicFiltering}x</span>
              </div>
              <div className={styles.settingDesc}>
                Keeps floor textures and wall patterns crisp when viewed at sharp angles across long hallways.
              </div>
              <div className={styles.chipGroup}>
                {[
                  { val: 16, label: "16x (Maximum Clarity)" },
                  { val: 8, label: "8x Standard" },
                  { val: 4, label: "4x Balanced" },
                  { val: 2, label: "2x Performance" },
                ].map((a) => (
                  <button
                    key={a.val}
                    className={`${styles.optionChip} ${settings.anisotropicFiltering === a.val ? styles.optionChipActive : ""}`}
                    onClick={() => updateSetting("anisotropicFiltering", a.val as 2 | 4 | 8 | 16)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lighting & Tone Mapping */}
            <div className={styles.settingCard}>
              <div className={styles.settingHeader}>
                <span className={styles.settingTitle}>Color Tone Mapping &amp; Exposure</span>
                <span className={styles.settingValueBadge}>{settings.exposure.toFixed(2)}x</span>
              </div>
              <div className={styles.chipGroup} style={{ marginBottom: "6px" }}>
                {[
                  { val: "aces_filmic", label: "ACES Filmic (Cinematic)" },
                  { val: "reinhard", label: "Reinhard" },
                  { val: "cineon", label: "Cineon" },
                ].map((tm) => (
                  <button
                    key={tm.val}
                    className={`${styles.optionChip} ${settings.toneMapping === tm.val ? styles.optionChipActive : ""}`}
                    onClick={() => updateSetting("toneMapping", tm.val as ToneMappingType)}
                  >
                    {tm.label}
                  </button>
                ))}
              </div>
              <div className={styles.sliderRow}>
                <span style={{ fontSize: "10px", color: "#8e8a82" }}>Exposure:</span>
                <input
                  type="range"
                  min="60"
                  max="160"
                  step="5"
                  value={Math.round(settings.exposure * 100)}
                  onChange={(e) => updateSetting("exposure", parseInt(e.target.value, 10) / 100)}
                  className={styles.slider}
                />
              </div>
            </div>

            {/* Performance HUD */}
            <div className={styles.settingCard}>
              <div
                className={styles.toggleRow}
                onClick={() => updateSetting("showPerformanceHUD", !settings.showPerformanceHUD)}
              >
                <div>
                  <div className={styles.settingTitle}>On-Screen Performance HUD</div>
                  <div className={styles.settingDesc}>Display live FPS, frame times, render resolution, and VRAM gauge.</div>
                </div>
                <div className={`${styles.toggleSwitch} ${settings.showPerformanceHUD ? styles.toggleSwitchActive : ""}`}>
                  <div className={`${styles.toggleKnob} ${settings.showPerformanceHUD ? styles.toggleKnobActive : ""}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: VRAM Allocation Gauge & Done */}
        <div className={styles.modalFooter}>
          <div className={styles.vramMeterGroup}>
            <span className={styles.vramLabel}>Estimated VRAM Pool:</span>
            <div className={styles.vramBarContainer}>
              <div className={styles.vramBarFill} style={{ width: `${vramPercent}%` }} />
            </div>
            <span className={styles.vramStats}>
              {estimatedVRAM} GB / 24.0 GB VRAM ({vramPercent}%)
            </span>
          </div>

          <button className={styles.applyBtn} onClick={onClose}>
            ✓ Apply &amp; Return to Simulation (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
