"use client";

import React, { useState, useMemo } from "react";
import { PlotDims, Facing, Setback } from "@/lib/plot";
import { SolvedRoom, SolveMeta } from "@/lib/solve";
import { inchesToFeet } from "@/lib/units";
import {
  generateBlueprintSvg,
  downloadBlueprintSvg,
  downloadBlueprintPng,
  printBlueprintSheet,
} from "@/lib/blueprintExport";
import styles from "./BlueprintExportModal.module.css";

interface BlueprintExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: PlotDims;
  facing: Facing;
  setback: Setback;
  rooms: SolvedRoom[];
  meta: SolveMeta | null;
}

export default function BlueprintExportModal({
  isOpen,
  onClose,
  plot,
  facing,
  setback,
  rooms,
  meta,
}: BlueprintExportModalProps) {
  const [theme, setTheme] = useState<"blueprint" | "dark" | "drafting">("blueprint");
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Generate SVG string
  const svgString = useMemo(() => {
    return generateBlueprintSvg({
      plot,
      facing,
      setback,
      rooms,
      meta,
      theme,
    });
  }, [plot, facing, setback, rooms, meta, theme]);

  if (!isOpen) return null;

  const totalPlotSqFt = (plot.widthIn * plot.depthIn) / 144;
  const totalBuiltSqFt = rooms.reduce((acc, r) => acc + (r.w_in * r.d_in) / 144, 0);

  const handleExportSvg = () => {
    const filename = `blueprint_${inchesToFeet(plot.widthIn)}x${inchesToFeet(
      plot.depthIn
    )}_${facing}.svg`;
    downloadBlueprintSvg(svgString, filename);
  };

  const handleExportPng = async () => {
    try {
      setIsExportingPng(true);
      const filename = `blueprint_${inchesToFeet(plot.widthIn)}x${inchesToFeet(
        plot.depthIn
      )}_${facing}.png`;
      await downloadBlueprintPng(svgString, filename, 2.5); // 2.5x scale for ultra-crisp 4K raster
    } catch (err) {
      console.error("Failed to export PNG:", err);
      alert("Failed to export PNG. Please try exporting as SVG instead.");
    } finally {
      setIsExportingPng(false);
    }
  };

  const handlePrint = () => {
    printBlueprintSheet(
      svgString,
      `Plot-to-Plan Blueprint - ${inchesToFeet(plot.widthIn)}x${inchesToFeet(
        plot.depthIn
      )} ft ${facing}-Facing`
    );
  };

  const handleExportJson = () => {
    const wFt = inchesToFeet(plot.widthIn);
    const dFt = inchesToFeet(plot.depthIn);
    const blueprintData = {
      name: `Custom Blueprint ${wFt}x${dFt} ${facing}-Facing`,
      type: `${rooms.filter((r) => r.name === "bedroom").length || 2}BHK`,
      plotWidthFt: wFt,
      plotDepthFt: dFt,
      facing,
      totalSqFt: wFt * dFt,
      builtUpAreaSqFt: Math.round(rooms.reduce((acc, r) => acc + (r.w_in * r.d_in) / 144, 0)),
      counts: rooms.reduce((acc, r) => {
        acc[r.name] = (acc[r.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      customDims: rooms.reduce((acc, r, i) => {
        acc[`${r.name}_${i}`] = { wFt: Math.round(r.w_in / 12), dFt: Math.round(r.d_in / 12) };
        return acc;
      }, {} as Record<string, { wFt: number; dFt: number }>),
      customOpenings: rooms.reduce((acc, r, i) => {
        if (r.openings?.length) acc[`${r.name}_${i}`] = r.openings;
        return acc;
      }, {} as Record<string, any>),
      customWallThickness: rooms.reduce((acc, r, i) => {
        if (r.wall_thickness_in) acc[`${r.name}_${i}`] = r.wall_thickness_in;
        return acc;
      }, {} as Record<string, number>),
    };

    const blob = new Blob([JSON.stringify(blueprintData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blueprint_${wFt}x${dFt}_${facing}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <span className={styles.modalTitleBadge}>ARCHITECTURAL EXPORT</span>
            <h2 className={styles.modalTitle}>Export Architectural Blueprint Sheet</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Controls Bar: Theme picker */}
          <div className={styles.controlsBar}>
            <div className={styles.themeSelectorGroup}>
              <span className={styles.themeLabel}>Paper Style:</span>
              <button
                className={`${styles.themePill} ${
                  theme === "blueprint" ? styles.themePillActive : ""
                }`}
                onClick={() => setTheme("blueprint")}
              >
                🟦 Cyan Blueprint
              </button>
              <button
                className={`${styles.themePill} ${
                  theme === "dark" ? styles.themePillActive : ""
                }`}
                onClick={() => setTheme("dark")}
              >
                ⬛ Midnight Dark
              </button>
              <button
                className={`${styles.themePill} ${
                  theme === "drafting" ? styles.themePillActive : ""
                }`}
                onClick={() => setTheme("drafting")}
              >
                📄 White Drafting Paper
              </button>
            </div>
          </div>

          {/* SVG Live Preview Box */}
          <div className={styles.previewBox}>
            <div
              className={styles.previewSvg}
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.metaInfo}>
            Plot: <span className={styles.metaHighlight}>{inchesToFeet(plot.widthIn)}′ × {inchesToFeet(plot.depthIn)}′ ft</span> ({totalPlotSqFt.toFixed(0)} sq.ft) • Built: <span className={styles.metaHighlight}>{totalBuiltSqFt.toFixed(0)} sq.ft</span> • {rooms.length} Rooms
          </div>

          <div className={styles.actionButtonsGroup}>
            <button
              className={`${styles.exportActionBtn} ${styles.btnSvg}`}
              onClick={handleExportJson}
              title="Download Blueprint JSON model file to import anytime"
            >
              📋 Blueprint JSON
            </button>
            <button
              className={`${styles.exportActionBtn} ${styles.btnSvg}`}
              onClick={handleExportSvg}
              title="Download editable Scalable Vector Graphics (.svg)"
            >
              📐 Download SVG
            </button>
            <button
              className={`${styles.exportActionBtn} ${styles.btnPng}`}
              onClick={handleExportPng}
              disabled={isExportingPng}
              title="Download high-resolution 4K PNG image for mobile/WhatsApp"
            >
              {isExportingPng ? "⏳ Rendering 4K..." : "🖼️ Download 4K PNG"}
            </button>
            <button
              className={`${styles.exportActionBtn} ${styles.btnPrint}`}
              onClick={handlePrint}
              title="Open print sheet dialog to print or save as PDF"
            >
              🖨️ Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
