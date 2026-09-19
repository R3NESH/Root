"use client";

import React, { useMemo, useState } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { BuiltinFurnitureRecord } from "@/lib/furnitureInventory";
import {
  CLEARANCE_RULES,
  auditClearances,
  exportClearanceAuditToCsv,
} from "@/lib/clearances";
import styles from "./StudioModal.module.css";

interface ClearanceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: SolvedRoom[];
  builtins: BuiltinFurnitureRecord[];
  customObjects: PlacedCustomObject[];
}

type Tab = "findings" | "rules";

export default function ClearanceAuditModal({
  isOpen,
  onClose,
  rooms,
  builtins,
  customObjects,
}: ClearanceAuditModalProps) {
  const [tab, setTab] = useState<Tab>("findings");

  const audit = useMemo(
    () => auditClearances(rooms, builtins, customObjects),
    [rooms, builtins, customObjects]
  );

  const fails = audit.findings.filter((f) => f.severity === "fail").length;
  const tights = audit.findings.length - fails;

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>CLR</span>
            <div>
              <h2 className={styles.title}>Clearance Audit</h2>
              <div className={styles.subtitle}>
                Every gap in the plan, measured against the figure the trade works to
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
              className={tab === "findings" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setTab("findings")}
            >
              Findings ({audit.findings.length})
            </button>
            <button
              className={tab === "rules" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setTab("rules")}
            >
              Rules applied ({Object.keys(CLEARANCE_RULES).length})
            </button>
          </div>
          <div className={styles.actionsGroup}>
            <button
              className={styles.exportBtn}
              onClick={() => exportClearanceAuditToCsv(audit)}
              title="Download the findings as CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Gaps measured</div>
              <div className={styles.kpiValue}>{audit.gapsMeasured}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rooms checked</div>
              <div className={styles.kpiValue}>{audit.roomsChecked}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Below minimum</div>
              <div className={styles.kpiValue}>{fails}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Tight</div>
              <div className={styles.kpiValue}>{tights}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rooms not checked</div>
              <div className={styles.kpiValue}>{audit.roomsSkipped.length}</div>
            </div>
          </div>

          {tab === "findings" ? (
            audit.gapsMeasured === 0 ? (
              <div className={styles.empty}>
                Nothing measured, so nothing can be said.
                <br />
                Auto-furnish the plan or place some pieces, then run this again — a clean report
                over zero measurements would be a lie.
              </div>
            ) : audit.findings.length === 0 ? (
              <div className={styles.pass}>
                <strong>{audit.gapsMeasured} gaps measured across {audit.roomsChecked} rooms.</strong>
                <br />
                Every one of them clears its minimum.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}></th>
                      <th className={styles.th}>Room</th>
                      <th className={styles.th}>Between</th>
                      <th className={styles.th}>Rule</th>
                      <th className={styles.th}>Measured</th>
                      <th className={styles.th}>Needs</th>
                      <th className={styles.th}>Short by</th>
                      <th className={styles.th}>Authority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.findings.map((f, i) => (
                      <tr key={`${f.ruleId}-${f.room}-${f.between}-${i}`} className={styles.tr}>
                        <td className={styles.td}>
                          <span className={f.severity === "fail" ? styles.sevFail : styles.sevTight}>
                            {f.severity === "fail" ? "Below" : "Tight"}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.itemName}`}>{f.room}</td>
                        <td className={styles.td}>{f.between}</td>
                        <td className={styles.td}>{f.ruleName}</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{f.measuredIn}&quot;</td>
                        <td className={`${styles.td} ${styles.numCol}`}>{f.requiredIn}&quot;</td>
                        <td className={`${styles.td} ${styles.shortfall}`}>
                          {f.measuredIn < f.requiredIn ? `${f.requiredIn - f.measuredIn}"` : "—"}
                        </td>
                        <td className={styles.td}>
                          {f.source ? (
                            <a
                              className={styles.srcLink}
                              href={f.source}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {f.authority}
                            </a>
                          ) : (
                            <span className={styles.noSource}>{f.authority}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className={styles.ruleGrid}>
              {Object.values(CLEARANCE_RULES).map((rule) => (
                <div key={rule.id} className={styles.ruleCard}>
                  <div className={styles.ruleTop}>
                    <span className={styles.ruleName}>{rule.name}</span>
                    <span className={styles.ruleMin}>{rule.minIn}&quot;</span>
                  </div>
                  <div className={styles.ruleNote}>{rule.note}</div>
                  <div className={styles.ruleNote}>
                    {rule.source ? (
                      <a
                        className={styles.srcLink}
                        href={rule.source}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {rule.authority} — read the guideline
                      </a>
                    ) : (
                      <span className={styles.noSource}>
                        {rule.authority} — no published source, low confidence
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {audit.roomsSkipped.length > 0 && (
            <div className={styles.note}>
              Not checked: {audit.roomsSkipped.join(" · ")}. A room with nothing in it has no gap
              to measure, so it is listed rather than counted as a pass.
            </div>
          )}

          <div className={styles.note}>
            Gaps are measured between the bounding boxes of what is actually built, wall to piece
            and piece to piece, and only where the two face each other by at least a foot. A piece
            pushed against a wall is not a passage and is not reported. &ldquo;Tight&rdquo; means
            within 3 in over the minimum.
          </div>
        </div>
      </div>
    </div>
  );
}
