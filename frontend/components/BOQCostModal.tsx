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
import { extraWallLengthFt, RoomEdgeCurves } from "@/lib/wallCurves";
import styles from "./StudioModal.module.css";

// Headline rate per tier, shown on the button so the choice is priced before it is made.
const TIERS: { id: BoqQualityTier; label: string }[] = [
  { id: "economy", label: "Economy · ₹1,650/sq.ft" },
  { id: "standard", label: "Standard · ₹2,150/sq.ft" },
  { id: "luxury", label: "Luxury · ₹2,950/sq.ft" },
];

interface BOQCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: PlotDims;
  facing: Facing;
  rooms: SolvedRoom[];
  /** Bowed wall faces. A curve is longer than the run it replaces and has to be costed as such. */
  roomEdgeCurves?: RoomEdgeCurves;
}

export default function BOQCostModal({
  isOpen,
  onClose,
  plot,
  facing,
  rooms,
  roomEdgeCurves,
}: BOQCostModalProps) {
  const [tier, setTier] = useState<BoqQualityTier>("standard");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const boq = useMemo(() => {
    const curveExtraFt = extraWallLengthFt(
      roomEdgeCurves,
      rooms.map((r, i) => ({
        id: `${r.name}_${rooms.slice(0, i).filter((o) => o.name === r.name).length}`,
        widthFt: r.w_in / 12,
        depthFt: r.d_in / 12,
      }))
    );
    return calculateBoq(plot, facing, rooms, tier, curveExtraFt);
  }, [plot, facing, rooms, tier, roomEdgeCurves]);

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
            <span className={styles.logoIcon}>BOQ</span>
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
        <div className={styles.toolbar}>
          <div className={styles.tabGroup}>
            <span className={styles.toolbarLabel}>Specification Tier</span>
            {TIERS.map((t) => (
              <button
                key={t.id}
                className={tier === t.id ? styles.tabBtnActive : styles.tabBtn}
                onClick={() => setTier(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.actionsGroup}>
            <button
              className={styles.exportBtn}
              onClick={() => exportBoqToCsv(boq, "FloorPlan")}
              title="Download detailed Excel/CSV spreadsheet"
            >
              <span>EXP</span> Export CSV
            </button>
            <button
              className={styles.printBtn}
              onClick={() => printBoqReport(boq, "FloorPlan")}
              title="Print official formatted estimate sheet"
            >
              <span>PRN</span> Print / PDF
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
          <div className={styles.roomFilter}>
            <button
              className={selectedCategory === "all" ? styles.roomPillActive : styles.roomPill}
              onClick={() => setSelectedCategory("all")}
            >
              All Items <span className={styles.pillCount}>{boq.items.length}</span>
            </button>
            {boq.categories.map((cat) => (
              <button
                key={cat.category}
                className={selectedCategory === cat.category ? styles.roomPillActive : styles.roomPill}
                onClick={() => setSelectedCategory(cat.category)}
              >
                {cat.name} <span className={styles.pillCount}>{cat.percentage}%</span>
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
                      <div className={styles.itemName}>{it.description}</div>
                      {it.specNotes && <div className={styles.note}>{it.specNotes}</div>}
                    </td>
                    <td className={`${styles.td} ${styles.numCol}`}>{it.quantity.toLocaleString()}</td>
                    <td className={styles.td}>{it.unit}</td>
                    <td className={`${styles.td} ${styles.numCol}`}>{it.rate.toLocaleString()}</td>
                    <td className={`${styles.td} ${styles.numCol} ${styles.amountCol}`}>₹{it.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <td className={styles.td} colSpan={5} style={{ textAlign: "right", color: "#eceae5" }}>
                    TOTAL ESTIMATED BUDGET ({tier.toUpperCase()} SPECIFICATION):
                  </td>
                  <td className={`${styles.td} ${styles.numCol} ${styles.amountCol}`} style={{ fontSize: "14px" }}>
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
