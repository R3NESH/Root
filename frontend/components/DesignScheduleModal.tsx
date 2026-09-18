"use client";

import React, { useMemo, useState } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import {
  BuiltinFurnitureRecord,
  buildDesignSchedule,
  exportDesignScheduleToCsv,
  printDesignSchedule,
} from "@/lib/designSchedule";
import styles from "./DesignScheduleModal.module.css";

interface DesignScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: SolvedRoom[];
  builtins: BuiltinFurnitureRecord[];
  customObjects: PlacedCustomObject[];
  materialConfig: HouseMaterialConfig;
}

type Tab = "ffe" | "finishes";

export default function DesignScheduleModal({
  isOpen,
  onClose,
  rooms,
  builtins,
  customObjects,
  materialConfig,
}: DesignScheduleModalProps) {
  const [tab, setTab] = useState<Tab>("ffe");
  const [roomFilter, setRoomFilter] = useState<string>("all");

  const schedule = useMemo(
    () => buildDesignSchedule(rooms, builtins, customObjects, materialConfig),
    [rooms, builtins, customObjects, materialConfig]
  );

  const roomNames = useMemo(
    () => [...new Set(schedule.finishes.map((f) => f.room))],
    [schedule]
  );

  const ffeRows = useMemo(
    () => (roomFilter === "all" ? schedule.ffe : schedule.ffe.filter((r) => r.room === roomFilter)),
    [schedule, roomFilter]
  );

  const finishRows = useMemo(
    () =>
      roomFilter === "all"
        ? schedule.finishes
        : schedule.finishes.filter((f) => f.room === roomFilter),
    [schedule, roomFilter]
  );

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>FFE</span>
            <div>
              <h2 className={styles.title}>FF&amp;E and Finish Schedule</h2>
              <div className={styles.subtitle}>
                Every piece and every surface, taken off the model — feet-inches and millimetres
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Escape)">
            ✕
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabGroup}>
            <button
              className={tab === "ffe" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setTab("ffe")}
            >
              FF&amp;E ({schedule.ffe.length})
            </button>
            <button
              className={tab === "finishes" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setTab("finishes")}
            >
              Finishes ({schedule.finishes.length})
            </button>
          </div>
          <div className={styles.actionsGroup}>
            <button
              className={styles.exportBtn}
              onClick={() => exportDesignScheduleToCsv(schedule)}
              title="Download both schedules as one CSV"
            >
              Export CSV
            </button>
            <button
              className={styles.printBtn}
              onClick={() => printDesignSchedule(schedule)}
              title="Open a printable spec sheet"
            >
              Print sheet
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rooms</div>
              <div className={styles.kpiValue}>{schedule.totals.rooms}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Pieces</div>
              <div className={styles.kpiValue}>{schedule.totals.pieces}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Line items</div>
              <div className={styles.kpiValue}>{schedule.totals.lineItems}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Flooring</div>
              <div className={styles.kpiValue}>{schedule.totals.flooringSqFt} sq ft</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Paint area</div>
              <div className={styles.kpiValue}>{schedule.totals.paintAreaSqFt} sq ft</div>
            </div>
          </div>

          <div className={styles.roomFilter}>
            <button
              className={roomFilter === "all" ? styles.roomPillActive : styles.roomPill}
              onClick={() => setRoomFilter("all")}
            >
              Whole house
            </button>
            {roomNames.map((name) => (
              <button
                key={name}
                className={roomFilter === name ? styles.roomPillActive : styles.roomPill}
                onClick={() => setRoomFilter(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === "ffe" ? (
            <div className={styles.tableWrap}>
              {ffeRows.length === 0 ? (
                <div className={styles.empty}>
                  Nothing scheduled yet.
                  <br />
                  Auto-furnish the plan, or place pieces from the left tool rail, and they appear
                  here with their measured sizes.
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Code</th>
                      <th className={styles.th}>Room</th>
                      <th className={styles.th}>Item</th>
                      <th className={styles.th}>Category</th>
                      <th className={styles.th}>Qty</th>
                      <th className={styles.th}>Size (ft-in)</th>
                      <th className={styles.th}>Size (mm)</th>
                      <th className={styles.th}>Finish</th>
                      <th className={styles.th}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ffeRows.map((r) => (
                      <tr key={r.code} className={styles.tr}>
                        <td className={`${styles.td} ${styles.itemCode}`}>{r.code}</td>
                        <td className={styles.td}>{r.room}</td>
                        <td className={`${styles.td} ${styles.itemName}`}>{r.item}</td>
                        <td className={styles.td}>{r.category}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{r.qty}</td>
                        <td className={styles.td}>{r.sizeFt}</td>
                        <td className={`${styles.td} ${styles.mmCol}`}>{r.sizeMm}</td>
                        <td className={styles.td}>{r.finish}</td>
                        <td className={`${styles.td} ${styles.sourceTag}`}>{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Room</th>
                    <th className={styles.th}>Area</th>
                    <th className={styles.th}>Floor</th>
                    <th className={styles.th}>Wall paint</th>
                    <th className={styles.th}>Wall texture</th>
                    <th className={styles.th}>Door finish</th>
                    <th className={styles.th}>Paint area</th>
                    <th className={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {finishRows.map((f) => (
                    <tr key={f.room} className={styles.tr}>
                      <td className={`${styles.td} ${styles.itemName}`}>{f.room}</td>
                      <td className={`${styles.td} ${styles.numCol}`}>{f.areaSqFt} sq ft</td>
                      <td className={styles.td}>{f.floor}</td>
                      <td className={styles.td}>{f.wallPaint}</td>
                      <td className={styles.td}>{f.wallTexture}</td>
                      <td className={styles.td}>{f.doorFinish}</td>
                      <td className={`${styles.td} ${styles.numCol}`}>{f.paintAreaSqFt} sq ft</td>
                      <td className={styles.td}>{f.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.note}>
            Sizes come from the built model, not from a catalog sheet, so a piece the fit-out
            resized to clear a walkway is scheduled at the size it was built. Millimetres are
            rounded to the nearest 5 mm. Paint areas are gross wall face with openings not
            deducted; the BOQ nets them off the solver&rsquo;s own wall objects.
          </div>
        </div>
      </div>
    </div>
  );
}
