"use client";

import React, { useState, useMemo } from "react";
import { PlotDims, Facing } from "@/lib/plot";
import { SolvedRoom } from "@/lib/solve";
import {
  calculateBoq,
  exportBoqToCsv,
  printBoqReport,
  BoqQualityTier,
} from "@/lib/boqEngine";
import styles from "./BOQCostModal.module.css";

interface BOQCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: PlotDims;
  facing: Facing;
  rooms: SolvedRoom[];
}

export default function BOQCostModal({
  isOpen,
  onClose,
  plot,
  facing,
  rooms,
}: BOQCostModalProps) {
  const [tier, setTier] = useState<BoqQualityTier>("standard");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const boq = useMemo(() => {
    return calculateBoq(plot, facing, rooms, tier);
  }, [plot, facing, rooms, tier]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return boq.items;
    return boq.items.filter((it) => it.category === selectedCategory);
  }, [boq, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>📊</span>
            <div>
              <h2 className={styles.title}>Bill of Quantities (BOQ) &amp; Cost Takeoff</h2>
              <div className={styles.subtitle}>
                Engineering material estimation derived directly from the solved architectural floor plan
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Escape)">
            ✕
          </button>
        </div>

        {/* Quality Tier & Actions Bar */}
        <div className={styles.tierBar}>
          <div className={styles.tierGroup}>
            <span className={styles.tierLabel}>Specification Tier:</span>
            <button
              className={tier === "economy" ? styles.tierBtnActive : styles.tierBtn}
              onClick={() => setTier("economy")}
            >
              Economy (₹1,650/sq.ft)
            </button>
            <button
              className={tier === "standard" ? styles.tierBtnActive : styles.tierBtn}
              onClick={() => setTier("standard")}
            >
              Standard (₹2,150/sq.ft)
            </button>
            <button
              className={tier === "luxury" ? styles.tierBtnActive : styles.tierBtn}
              onClick={() => setTier("luxury")}
            >
              Luxury (₹2,950/sq.ft)
            </button>
          </div>

          <div className={styles.actionsGroup}>
            <button
              className={styles.exportBtn}
              onClick={() => exportBoqToCsv(boq, "FloorPlan")}
              title="Download detailed Excel/CSV spreadsheet"
            >
              <span>📥</span> Export CSV
            </button>
            <button
              className={styles.printBtn}
              onClick={() => printBoqReport(boq, "FloorPlan")}
              title="Print official formatted estimate sheet"
            >
              <span>🖨️</span> Print / PDF
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* KPI Dashboard */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Total Estimated Cost</div>
              <div className={styles.kpiValue}>₹{boq.totalCost.toLocaleString()}</div>
              <div className={styles.kpiSub}>₹{boq.costPerSqFt} / sq.ft BUA</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Built-Up Area</div>
              <div className={styles.kpiValue}>{boq.builtUpAreaSqFt} sq.ft</div>
              <div className={styles.kpiSub}>Carpet: {boq.carpetAreaSqFt} sq.ft</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>TMT Steel Rebar</div>
              <div className={styles.kpiValue}>{boq.keyQuantities.steelTons} Tons</div>
              <div className={styles.kpiSub}>Fe500D Grade</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Cement Required</div>
              <div className={styles.kpiValue}>{boq.keyQuantities.cementBags} Bags</div>
              <div className={styles.kpiSub}>50kg OPC/PPC</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Red Clay Bricks</div>
              <div className={styles.kpiValue}>{boq.keyQuantities.brickCount.toLocaleString()}</div>
              <div className={styles.kpiSub}>Modular Units</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Flooring &amp; Dado</div>
              <div className={styles.kpiValue}>{boq.keyQuantities.flooringSqFt} sq.ft</div>
              <div className={styles.kpiSub}>Tiles + 10% Wastage</div>
            </div>
          </div>

          {/* Category Distribution Pills */}
          <div className={styles.categoryPills}>
            <button
              onClick={() => setSelectedCategory("all")}
              style={{
                background: selectedCategory === "all" ? "rgba(56, 189, 248, 0.25)" : "rgba(15, 23, 42, 0.8)",
                border: selectedCategory === "all" ? "1px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.7)",
                color: selectedCategory === "all" ? "#38bdf8" : "#cbd5e1",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "11.5px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              All Items ({boq.items.length})
            </button>
            {boq.categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                style={{
                  background: selectedCategory === cat.category ? "rgba(56, 189, 248, 0.25)" : "rgba(15, 23, 42, 0.8)",
                  border: selectedCategory === cat.category ? "1px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.7)",
                  color: selectedCategory === cat.category ? "#38bdf8" : "#cbd5e1",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                }}
              >
                <span>{cat.name}</span>
                <span className={styles.catPercent}>{cat.percentage}%</span>
              </button>
            ))}
          </div>

          {/* Detailed Takeoff Table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: "80px" }}>Code</th>
                  <th className={styles.th}>Description &amp; Specification</th>
                  <th className={styles.th} style={{ width: "80px", textAlign: "right" }}>Qty</th>
                  <th className={styles.th} style={{ width: "70px" }}>Unit</th>
                  <th className={styles.th} style={{ width: "90px", textAlign: "right" }}>Rate (₹)</th>
                  <th className={styles.th} style={{ width: "110px", textAlign: "right" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.code} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.itemCode}>{it.code}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.itemDesc}>{it.description}</div>
                      {it.specNotes && <div className={styles.itemNotes}>{it.specNotes}</div>}
                    </td>
                    <td className={`${styles.td} ${styles.numCol}`}>{it.quantity.toLocaleString()}</td>
                    <td className={styles.td}>{it.unit}</td>
                    <td className={`${styles.td} ${styles.numCol}`}>{it.rate.toLocaleString()}</td>
                    <td className={`${styles.td} ${styles.amountCol}`}>₹{it.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <td className={styles.td} colSpan={5} style={{ textAlign: "right", color: "#f8fafc" }}>
                    TOTAL ESTIMATED BUDGET ({tier.toUpperCase()} SPECIFICATION):
                  </td>
                  <td className={`${styles.td} ${styles.amountCol}`} style={{ fontSize: "14px" }}>
                    ₹{boq.totalCost.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
