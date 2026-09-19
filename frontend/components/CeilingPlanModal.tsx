"use client";

import React, { useMemo, useState } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { BuiltinFurnitureRecord } from "@/lib/furnitureInventory";
import {
  MAINTENANCE_FACTOR,
  UTILISATION_FACTOR,
  buildCeilingPlan,
  ceilingPlanSvg,
  ceilingScheduleCsv,
} from "@/lib/ceilingPlan";
import {
  downloadBlueprintPng,
  downloadBlueprintSvg,
  printBlueprintSheet,
} from "@/lib/blueprintExport";
import { formatFtIn } from "@/lib/designSchedule";
import styles from "./StudioModal.module.css";

interface CeilingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: SolvedRoom[];
  builtins: BuiltinFurnitureRecord[];
  customObjects: PlacedCustomObject[];
}

export default function CeilingPlanModal({
  isOpen,
  onClose,
  rooms,
  builtins,
  customObjects,
}: CeilingPlanModalProps) {
  const [floor, setFloor] = useState(0);
  const [propose, setPropose] = useState(true);

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b),
    [rooms]
  );

  const plan = useMemo(
    () => buildCeilingPlan(rooms, builtins, customObjects, floor, propose),
    [rooms, builtins, customObjects, floor, propose]
  );

  const svg = useMemo(() => ceilingPlanSvg(plan), [plan]);

  const under = plan.rooms.filter((r) => r.verdict === "under").length;
  const unassessed = plan.rooms.filter((r) => r.verdict === "not assessed").length;

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>RCP</span>
            <div>
              <h2 className={styles.title}>Reflected Ceiling Plan</h2>
              <div className={styles.subtitle}>
                Fixtures, a proposed downlight layout, and whether the room actually hits its lux
                target
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Escape)">
            ✕
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabGroup}>
            {floors.length > 1 &&
              floors.map((f) => (
                <button
                  key={f}
                  className={f === floor ? styles.tabBtnActive : styles.tabBtn}
                  onClick={() => setFloor(f)}
                >
                  {f === 0 ? "Ground" : `${f}F`}
                </button>
              ))}
            <button
              className={propose ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setPropose((p) => !p)}
              title="Lay a general-lighting grid at ceiling height / 2, capped at 6 ft"
            >
              {propose ? "Proposed downlights on" : "Proposed downlights off"}
            </button>
          </div>
          <div className={styles.actionsGroup}>
            <button className={styles.exportBtn} onClick={() => downloadBlueprintSvg(svg, "ceiling-plan.svg")}>
              SVG
            </button>
            <button className={styles.printBtn} onClick={() => downloadBlueprintPng(svg, "ceiling-plan.png", 2.0)}>
              PNG
            </button>
            <button className={styles.printBtn} onClick={() => printBlueprintSheet(svg, "Reflected Ceiling Plan")}>
              Print
            </button>
            <button
              className={styles.exportBtn}
              onClick={() => ceilingScheduleCsv(plan)}
              title="Fixture schedule and the illuminance check"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ceiling height</div>
              <div className={styles.kpiValue}>{formatFtIn(plan.ceilingHeightFt)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Existing fixtures</div>
              <div className={styles.kpiValue}>{plan.existingCount}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Proposed</div>
              <div className={styles.kpiValue}>{plan.proposedCount}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rooms under target</div>
              <div className={styles.kpiValue}>{under}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>No published target</div>
              <div className={styles.kpiValue}>{unassessed}</div>
            </div>
          </div>

          {plan.rooms.length === 0 ? (
            <div className={styles.empty}>
              No ceiling to draw on this floor.
              <br />
              Solve a plan first.
            </div>
          ) : (
            <>
              <div className={styles.preview} dangerouslySetInnerHTML={{ __html: svg }} />

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Room</th>
                      <th className={styles.th}>Area</th>
                      <th className={styles.th}>Fixtures</th>
                      <th className={styles.th}>Lumens</th>
                      <th className={styles.th}>Est. lux</th>
                      <th className={styles.th}>Target</th>
                      <th className={styles.th}>Verdict</th>
                      <th className={styles.th}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rooms.map((rc) => (
                      <tr key={rc.roomIndex} className={styles.tr}>
                        <td className={`${styles.td} ${styles.itemName}`}>{rc.label}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{rc.areaSqFt} sq ft</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{rc.fixtures.length}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{rc.totalLumens.toLocaleString()}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{rc.estimatedLux}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>
                          {rc.target ? `${rc.target.minLux}–${rc.target.maxLux}` : "—"}
                        </td>
                        <td className={styles.td}>
                          {rc.verdict === "under" ? (
                            <span className={styles.sevFail}>Under</span>
                          ) : rc.verdict === "within" ? (
                            <span className={styles.sourceTag}>Within</span>
                          ) : rc.verdict === "over" ? (
                            <span className={styles.sevTight}>Over</span>
                          ) : (
                            <span className={styles.noSource}>Not assessed</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {rc.target ? (
                            <a
                              className={styles.srcLink}
                              href={rc.target.source}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              IS 3646
                            </a>
                          ) : (
                            <span className={styles.noSource}>no published figure found</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className={styles.note}>
            Drawn <strong>reflected</strong> — the mirror-on-the-floor convention, so left and
            right match the floor plan. Downlights are proposed at ceiling height ÷ 2 (capped at
            6 ft) and drawn dashed; everything solid already exists in the model. Illuminance is
            the lumen method, <code>E = N × lumens × UF × MF ÷ area</code>, with UF{" "}
            {UTILISATION_FACTOR} and MF {MAINTENANCE_FACTOR} and assumed lamp outputs — a sizing
            estimate, not a photometric calculation, because the catalog carries sizes and not
            photometry. A fan is drawn and counts zero lumens. Rooms with no published target are
            left unassessed rather than given an invented one.
          </div>
        </div>
      </div>
    </div>
  );
}
