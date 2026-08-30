"use client";
 
import React, { useState, useEffect, useRef } from "react";
import { MODEL_BLUEPRINTS, ModelBlueprint } from "@/lib/modelBlueprints";
import { ROOM_COLORS, ROOM_LABELS, RoomName } from "@/lib/rooms";
import styles from "./ModelBlueprintsModal.module.css";

interface ModelBlueprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlueprint: (
    blueprint: ModelBlueprint,
    targetMode?: "blueprint" | "orbit" | "walkthrough"
  ) => void;
}

export default function ModelBlueprintsModal({
  isOpen,
  onClose,
  onSelectBlueprint,
}: ModelBlueprintsModalProps) {
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [selectedFacingFilter, setSelectedFacingFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customBlueprints, setCustomBlueprints] = useState<ModelBlueprint[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const widthFt = parsed.plotWidthFt || (parsed.plotWIn ? Math.round(parsed.plotWIn / 12) : 30);
        const depthFt = parsed.plotDepthFt || (parsed.plotDIn ? Math.round(parsed.plotDIn / 12) : 40);
        const facing = parsed.facing || "N";
        const counts =
          parsed.counts || {
            hall: 1,
            kitchen: 1,
            bedroom: 2,
            bathroom: 1,
            dining: 0,
            pooja: 0,
            store: 0,
          };
        const customDims = parsed.customDims || {};
        const customPositions = parsed.customPositions || {};
        const customOpenings = parsed.customOpenings || {};
        const customWallThickness = parsed.customWallThickness || {};

        const newBlueprint: ModelBlueprint = {
          id: `custom_import_${Date.now()}`,
          name: parsed.name || file.name.replace(/\.json$/i, "") || "Imported Custom Blueprint",
          type: parsed.type || "2BHK",
          plotSizeLabel: `${widthFt}×${depthFt} (${widthFt * depthFt} sq ft)`,
          plotWidthFt: widthFt,
          plotDepthFt: depthFt,
          facing,
          builtUpAreaSqFt: parsed.builtUpAreaSqFt || Math.round(widthFt * depthFt * 0.75),
          totalSqFt: widthFt * depthFt,
          vaastuRating: parsed.vaastuRating || "Custom Imported Plan",
          description: parsed.description || "User-imported architectural blueprint model.",
          highlights: parsed.highlights || ["Custom Imported Plan", "Ready to Build in 2D & 3D"],
          counts,
          customDims,
          customPositions,
          customOpenings,
          customWallThickness,
        };

        setCustomBlueprints((prev) => [newBlueprint, ...prev]);
        onSelectBlueprint(newBlueprint, "blueprint");
        onClose();
      } catch (err) {
        console.error("Failed to parse blueprint JSON:", err);
        alert("Invalid blueprint JSON file. Please ensure the file contains valid blueprint data.");
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const sizeOptions = ["All", "20×30", "20×40", "25×40", "25×50", "30×40", "30×50", "35×50", "36×48", "40×60", "50×80"];
  const typeOptions = ["All", "1BHK", "2BHK", "3BHK", "4BHK"];
  const facingOptions: { label: string; value: string }[] = [
    { label: "All", value: "All" },
    { label: "🧭 North", value: "N" },
    { label: "🌅 East", value: "E" },
    { label: "☀️ South", value: "S" },
    { label: "🌇 West", value: "W" },
  ];

  const allBlueprints = [...customBlueprints, ...MODEL_BLUEPRINTS];

  const filteredBlueprints = allBlueprints.filter((bp) => {
    const matchesSize =
      selectedSizeFilter === "All" || bp.plotSizeLabel.startsWith(selectedSizeFilter);
    const matchesType = selectedTypeFilter === "All" || bp.type === selectedTypeFilter;
    const matchesFacing = selectedFacingFilter === "All" || bp.facing === selectedFacingFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.plotSizeLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSize && matchesType && matchesFacing && matchesSearch;
  });

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Hidden File Input for Importing Blueprint JSON */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />

        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <div className={styles.modalTitle}>
              <span>🏛️ Model Blueprints Catalog</span>
            </div>
            <div className={styles.modalSubtitle}>
              Explore authentic, Vaastu-compliant architectural floor plans or import custom blueprints. Select any model to
              import directly into the 2D layout or 3D view.
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.importBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Import a blueprint from a JSON file"
            >
              📂 Import Blueprint JSON
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className={styles.filterBar}>
          {/* Plot Size Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Plot Size:</span>
            {sizeOptions.map((size) => (
              <button
                key={size}
                className={`${styles.filterChip} ${
                  selectedSizeFilter === size ? styles.filterChipActive : ""
                }`}
                onClick={() => setSelectedSizeFilter(size)}
              >
                {size}
              </button>
            ))}
          </div>

          {/* BHK Type Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Layout Type:</span>
            {typeOptions.map((type) => (
              <button
                key={type}
                className={`${styles.filterChip} ${
                  selectedTypeFilter === type ? styles.filterChipActive : ""
                }`}
                onClick={() => setSelectedTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Facing Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Facing:</span>
            {facingOptions.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.filterChip} ${
                  selectedFacingFilter === opt.value ? styles.filterChipActive : ""
                }`}
                onClick={() => setSelectedFacingFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className={styles.searchGroup}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="🔍 Search blueprints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Blueprints Grid */}
        <div className={styles.blueprintsBody}>
          {filteredBlueprints.length === 0 ? (
            <div className={styles.emptyFilterState}>
              No blueprints match your selected filters. Try resetting the filters.
            </div>
          ) : (
            filteredBlueprints.map((blueprint) => (
              <div key={blueprint.id} className={styles.blueprintCard}>
                {/* SVG Blueprint Mini Preview */}
                <div
                  className={styles.previewContainer}
                  onClick={() => {
                    onSelectBlueprint(blueprint, "blueprint");
                    onClose();
                  }}
                  title="Click to import into 2D Layout"
                  style={{ cursor: "pointer" }}
                >
                  <BlueprintMiniPreview blueprint={blueprint} />
                </div>

                {/* Card Title & Badges */}
                <div className={styles.cardTopRow}>
                  <div className={styles.cardTitle}>{blueprint.name}</div>
                </div>

                <div className={styles.badgeGroup}>
                  <span className={styles.plotBadge}>{blueprint.plotSizeLabel}</span>
                  <span className={styles.facingBadge}>
                    Facing {blueprint.facing === "N" ? "North" : blueprint.facing === "E" ? "East" : blueprint.facing === "S" ? "South" : "West"}
                  </span>
                  <span className={styles.vaastuBadge}>{blueprint.vaastuRating}</span>
                </div>

                {/* Description */}
                <div className={styles.cardDescription}>{blueprint.description}</div>

                {/* Room Tags */}
                <div className={styles.roomTagsList}>
                  {Object.entries(blueprint.counts).map(([name, count]) => {
                    if (count <= 0) return null;
                    const rName = name as RoomName;
                    const colorHex = `#${ROOM_COLORS[rName].toString(16).padStart(6, "0")}`;
                    return (
                      <span key={name} className={styles.roomTag}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: colorHex,
                            display: "inline-block",
                          }}
                        />
                        {count > 1 ? `${count} ` : ""}
                        {ROOM_LABELS[rName] ?? name}
                      </span>
                    );
                  })}
                </div>

                {/* Architectural Highlights */}
                <ul className={styles.highlightsList}>
                  {blueprint.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>

                {/* Card Footer with Import Actions */}
                <div className={styles.cardFooter}>
                  <div className={styles.areaSummary}>
                    <span>
                      Built-up: <strong className={styles.areaValue}>~{blueprint.builtUpAreaSqFt} sq ft</strong>
                    </span>
                    <span>
                      Plot: <strong className={styles.areaValue}>{blueprint.totalSqFt} sq ft</strong>
                    </span>
                  </div>

                  <div className={styles.cardActionButtons}>
                    <button
                      className={styles.import2dBtn}
                      onClick={() => {
                        onSelectBlueprint(blueprint, "blueprint");
                        onClose();
                      }}
                      title="Import this blueprint directly into the interactive 2D floor plan editor"
                    >
                      📐 Import to 2D Layout
                    </button>
                    <div className={styles.secondaryActionGroup}>
                      <button
                        className={styles.view3dBtn}
                        onClick={() => {
                          onSelectBlueprint(blueprint, "orbit");
                          onClose();
                        }}
                        title="Load this blueprint and view in 3D Orbit"
                      >
                        🌐 3D Orbit
                      </button>
                      <button
                        className={styles.walk3dBtn}
                        onClick={() => {
                          onSelectBlueprint(blueprint, "walkthrough");
                          onClose();
                        }}
                        title="Load this blueprint and walk inside in first-person"
                      >
                        🚶 3D Walk
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Procedural SVG Mini-Preview Diagram for Blueprint Cards
 */
function BlueprintMiniPreview({ blueprint }: { blueprint: ModelBlueprint }) {
  const svgW = 260;
  const svgH = 120;
  const pad = 12;

  const aspect = blueprint.plotWidthFt / blueprint.plotDepthFt;
  let plotW = svgW - pad * 2;
  let plotH = plotW / aspect;

  if (plotH > svgH - pad * 2) {
    plotH = svgH - pad * 2;
    plotW = plotH * aspect;
  }

  const px = (svgW - plotW) / 2;
  const py = (svgH - plotH) / 2;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* Grid Pattern */}
      <defs>
        <pattern id={`miniGrid-${blueprint.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#0e2d4f" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={svgW} height={svgH} fill="#06182c" />
      <rect x="0" y="0" width={svgW} height={svgH} fill={`url(#miniGrid-${blueprint.id})`} />

      {/* Plot Boundary */}
      <rect
        x={px}
        y={py}
        width={plotW}
        height={plotH}
        fill="#0a2544"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeDasharray="4,2"
        rx="2"
      />

      {/* Road / Front Edge Indicator */}
      {blueprint.facing === "N" && (
        <line x1={px} y1={py - 3} x2={px + plotW} y2={py - 3} stroke="#38bdf8" strokeWidth="2.5" />
      )}
      {blueprint.facing === "E" && (
        <line x1={px + plotW + 3} y1={py} x2={px + plotW + 3} y2={py + plotH} stroke="#38bdf8" strokeWidth="2.5" />
      )}

      {/* Schematic Room Blocks */}
      {(() => {
        const roomsToRender: { name: RoomName; w: number; d: number }[] = [];
        for (const [name, count] of Object.entries(blueprint.counts)) {
          for (let i = 0; i < count; i++) {
            const id = `${name}_${i}`;
            const custom = blueprint.customDims[id];
            roomsToRender.push({
              name: name as RoomName,
              w: custom ? custom.wFt : 10,
              d: custom ? custom.dFt : 10,
            });
          }
        }

        // Arrange schematic blocks proportionally within the envelope
        const margin = 4;
        const innerW = plotW - margin * 2;
        const innerH = plotH - margin * 2;
        const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(roomsToRender.length))));
        const rows = Math.ceil(roomsToRender.length / cols);
        const cellW = innerW / cols;
        const cellH = innerH / rows;

        return roomsToRender.map((r, idx) => {
          const c = idx % cols;
          const row = Math.floor(idx / cols);
          const rx = px + margin + c * cellW + 1;
          const ry = py + margin + row * cellH + 1;
          const rw = cellW - 2;
          const rh = cellH - 2;
          const hex = `#${ROOM_COLORS[r.name].toString(16).padStart(6, "0")}`;

          return (
            <g key={idx}>
              <rect
                x={rx}
                y={ry}
                width={Math.max(4, rw)}
                height={Math.max(4, rh)}
                fill={hex}
                opacity="0.8"
                stroke="#ffffff"
                strokeWidth="0.8"
                rx="2"
              />
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 + 3}
                fill="#ffffff"
                fontSize="7.5"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                {r.name.toUpperCase().slice(0, 4)}
              </text>
            </g>
          );
        });
      })()}
    </svg>
  );
}
