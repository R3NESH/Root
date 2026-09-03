"use client";

import React, { useState, useEffect } from "react";
import {
  WallBandScheme,
  WallBandAxis,
  WallBand,
  generateRandomPermutation,
  withBandColor,
  withBandCount,
  withAxis,
  DESIGNER_PERMUTATION_PALETTES,
} from "@/lib/wallBands";
import { getWallColorHexStr } from "@/lib/materialsCatalog";
import styles from "./CustomWallBlendModal.module.css";

interface CustomWallBlendModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScheme?: WallBandScheme;
  selectedWallName?: string;
  onApplyScheme: (scheme: WallBandScheme, scope: "wall" | "room" | "global") => void;
}

const DEFAULT_SCHEME: WallBandScheme = {
  axis: "horizontal",
  bands: [
    { sizeFrac: 0.35, colorId: "charcoal_slate" },
    { sizeFrac: 0.65, colorId: "arctic_white" },
  ],
};

export default function CustomWallBlendModal({
  isOpen,
  onClose,
  initialScheme,
  selectedWallName,
  onApplyScheme,
}: CustomWallBlendModalProps) {
  const [scheme, setScheme] = useState<WallBandScheme>(initialScheme || DEFAULT_SCHEME);
  const [scope, setScope] = useState<"wall" | "room" | "global">(
    selectedWallName ? "wall" : "global"
  );
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(0);

  useEffect(() => {
    if (initialScheme) {
      setScheme(initialScheme);
    }
  }, [initialScheme]);

  if (!isOpen) return null;

  // Calculate normalized percentage sizes for preview display
  const totalFrac = scheme.bands.reduce((sum, b) => sum + Math.max(0.01, b.sizeFrac), 0);
  const percentages = scheme.bands.map((b) =>
    Math.round((Math.max(0.01, b.sizeFrac) / totalFrac) * 100)
  );

  const handleShuffle = () => {
    const perm = generateRandomPermutation(scheme.axis, scheme.bands.length);
    setScheme(perm);
  };

  const handleSetAxis = (axis: WallBandAxis) => {
    setScheme(withAxis(scheme, axis));
  };

  const handleSetBandCount = (count: number) => {
    setScheme(withBandCount(scheme, count));
  };

  const handleUpdateBandColor = (idx: number, hex: string) => {
    setScheme(withBandColor(scheme, idx, hex));
  };

  const handleUpdateBandSize = (idx: number, newFrac: number) => {
    const nextBands = scheme.bands.map((b, i) =>
      i === idx ? { ...b, sizeFrac: Math.max(0.05, newFrac) } : b
    );
    setScheme({ ...scheme, bands: nextBands });
  };

  const handleApplyPalette = (paletteIdx: number) => {
    setSelectedPaletteIndex(paletteIdx);
    const palette = DESIGNER_PERMUTATION_PALETTES[paletteIdx];
    if (!palette) return;

    const nextBands = scheme.bands.map((b, i) => ({
      ...b,
      colorId: palette.colors[i % palette.colors.length],
    }));
    setScheme({ ...scheme, bands: nextBands });
  };

  const handlePresetSplit = (ratios: number[]) => {
    const nextBands: WallBand[] = ratios.map((r, i) => ({
      sizeFrac: r,
      colorId: scheme.bands[i]?.colorId ?? "#f8fafc",
    }));
    setScheme({ ...scheme, bands: nextBands });
  };

  const handleApply = () => {
    onApplyScheme(scheme, scope);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>🎨</span>
            <div>
              <h2 className={styles.title}>Custom Wall Partitions &amp; Permutations</h2>
              <div className={styles.subtitle}>
                Split wall surfaces horizontally or vertically to test different permutations and color/material combinations
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Escape)">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* Live Interactive Wall Canvas */}
          <div className={styles.canvasCard}>
            <div className={styles.canvasHeader}>
              <div className={styles.canvasLabel}>
                <span>🧱 Live Wall Elevation Preview</span>
                <span style={{ color: "#38bdf8", fontSize: "11px" }}>
                  ({scheme.axis === "horizontal" ? "Horizontal Stack" : "Vertical Columns"})
                </span>
              </div>
              <span className={styles.canvasDimensions}>10&apos; Height × Wall Span</span>
            </div>

            <div
              className={`${styles.wallDisplay} ${
                scheme.axis === "horizontal"
                  ? styles.wallDisplayHorizontal
                  : styles.wallDisplayVertical
              }`}
            >
              {scheme.bands.map((band, idx) => {
                const pct = percentages[idx];
                const hex = getWallColorHexStr(band.colorId);
                return (
                  <div
                    key={idx}
                    className={styles.partitionSlice}
                    style={{
                      backgroundColor: hex,
                      flex: `${Math.max(0.05, band.sizeFrac)} 1 0%`,
                    }}
                  >
                    <span className={styles.sliceBadge}>
                      P{idx + 1}: {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Permutation Generator Bar */}
          <div className={styles.permutationBar}>
            <div className={styles.permutationInfo}>
              <span style={{ fontSize: "16px" }}>✨</span>
              <div>
                <strong style={{ fontSize: "12.5px", color: "#f8fafc" }}>
                  Designer Permutations Engine
                </strong>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Randomize proportions &amp; color harmonies with 1 click
                </div>
              </div>
            </div>

            <button className={styles.shuffleBtn} onClick={handleShuffle} title="Generate new harmonious combination">
              <span>🎲</span> Shuffle Combinations
            </button>
          </div>

          {/* Controls Grid */}
          <div className={styles.controlsGrid}>
            {/* Direction & Partition Count */}
            <div className={styles.controlCard}>
              <span className={styles.cardTitle}>1. Partition Direction &amp; Slices</span>

              <div>
                <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                  Partition Orientation:
                </label>
                <div className={styles.btnGroup}>
                  <button
                    className={scheme.axis === "horizontal" ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => handleSetAxis("horizontal")}
                  >
                    ↕ Horizontal (Dado / Frieze)
                  </button>
                  <button
                    className={scheme.axis === "vertical" ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => handleSetAxis("vertical")}
                  >
                    ↔ Vertical (Columns / Accents)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                  Number of Partitions:
                </label>
                <div className={styles.btnGroup}>
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      className={scheme.bands.length === cnt ? styles.toggleBtnActive : styles.toggleBtn}
                      onClick={() => handleSetBandCount(cnt)}
                    >
                      {cnt} Slices
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                  Quick Ratio Presets:
                </label>
                <div className={styles.btnGroup}>
                  <button className={styles.toggleBtn} onClick={() => handlePresetSplit([0.5, 0.5])}>
                    50:50 Half
                  </button>
                  <button className={styles.toggleBtn} onClick={() => handlePresetSplit([0.35, 0.65])}>
                    35:65 Dado
                  </button>
                  <button className={styles.toggleBtn} onClick={() => handlePresetSplit([0.72, 0.28])}>
                    72:28 Frieze
                  </button>
                  <button className={styles.toggleBtn} onClick={() => handlePresetSplit([0.33, 0.34, 0.33])}>
                    Equal Thirds
                  </button>
                  <button className={styles.toggleBtn} onClick={() => handlePresetSplit([0.2, 0.6, 0.2])}>
                    Accent Center
                  </button>
                </div>
              </div>
            </div>

            {/* Designer Color Harmony Palettes */}
            <div className={styles.controlCard}>
              <span className={styles.cardTitle}>2. Designer Color Harmonies</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {DESIGNER_PERMUTATION_PALETTES.map((pal, idx) => (
                  <div
                    key={pal.id}
                    onClick={() => handleApplyPalette(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: selectedPaletteIndex === idx ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.5)",
                      border: selectedPaletteIndex === idx ? "1px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.5)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "11.5px", color: "#f8fafc" }}>{pal.name}</strong>
                      <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{pal.theme}</div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {pal.colors.map((c, ci) => (
                        <div
                          key={ci}
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "3px",
                            backgroundColor: c,
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Slices Detail & Fine Tuning */}
          <div className={styles.controlCard}>
            <span className={styles.cardTitle}>3. Fine-Tune Slice Proportions &amp; Swatches</span>
            <div className={styles.sliceList}>
              {scheme.bands.map((band, idx) => {
                const hex = getWallColorHexStr(band.colorId);
                return (
                  <div key={idx} className={styles.sliceItem}>
                    <span className={styles.sliceTitle}>
                      Partition {idx + 1} ({percentages[idx]}%)
                    </span>

                    <div className={styles.slicePickerArea}>
                      <div className={styles.colorThumb} style={{ backgroundColor: hex }}>
                        <input
                          type="color"
                          className={styles.hiddenColorInput}
                          value={hex}
                          onChange={(e) => handleUpdateBandColor(idx, e.target.value)}
                        />
                      </div>
                      <span style={{ fontSize: "10.5px", fontFamily: "monospace", color: "#cbd5e1" }}>
                        {hex.toUpperCase()}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={Math.round(band.sizeFrac * 100)}
                      className={styles.sliceSlider}
                      onChange={(e) => handleUpdateBandSize(idx, Number(e.target.value) / 100)}
                    />

                    <span className={styles.sliceValue}>{percentages[idx]}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer & Scope */}
        <div className={styles.footer}>
          <div className={styles.scopeSelector}>
            <span className={styles.scopeLabel}>Apply Design To:</span>
            {selectedWallName && (
              <button
                className={scope === "wall" ? styles.scopeBtnActive : styles.scopeBtn}
                onClick={() => setScope("wall")}
              >
                📌 {selectedWallName} Only
              </button>
            )}
            <button
              className={scope === "room" ? styles.scopeBtnActive : styles.scopeBtn}
              onClick={() => setScope("room")}
            >
              🚪 Active Room Walls
            </button>
            <button
              className={scope === "global" ? styles.scopeBtnActive : styles.scopeBtn}
              onClick={() => setScope("global")}
            >
              🏠 Whole Building (Global)
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className={styles.closeBtn} onClick={onClose} style={{ width: "auto", padding: "0 14px" }}>
              Cancel
            </button>
            <button className={styles.applyBtn} onClick={handleApply}>
              ✨ Apply Custom Wall Design
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
