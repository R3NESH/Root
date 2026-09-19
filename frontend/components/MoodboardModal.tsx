"use client";

import React, { useMemo, useState } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { BuiltinFurnitureRecord } from "@/lib/furnitureInventory";
import { buildMoodboard, moodboardSvg, printMoodboardSet } from "@/lib/moodboard";
import { roomDisplayNames } from "@/lib/designSchedule";
import {
  downloadBlueprintPng,
  downloadBlueprintSvg,
  printBlueprintSheet,
} from "@/lib/blueprintExport";
import styles from "./StudioModal.module.css";

interface MoodboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: SolvedRoom[];
  builtins: BuiltinFurnitureRecord[];
  customObjects: PlacedCustomObject[];
  materialConfig: HouseMaterialConfig;
}

export default function MoodboardModal({
  isOpen,
  onClose,
  rooms,
  builtins,
  customObjects,
  materialConfig,
}: MoodboardModalProps) {
  // null is the whole-house scheme board; a number is that room.
  const [scope, setScope] = useState<number | null>(null);

  const names = useMemo(() => roomDisplayNames(rooms), [rooms]);

  const board = useMemo(
    () => buildMoodboard(rooms, builtins, customObjects, materialConfig, scope),
    [rooms, builtins, customObjects, materialConfig, scope]
  );

  const svg = useMemo(() => moodboardSvg(board), [board]);

  const allBoards = useMemo(
    () => [
      buildMoodboard(rooms, builtins, customObjects, materialConfig, null),
      ...rooms.map((_, i) => buildMoodboard(rooms, builtins, customObjects, materialConfig, i)),
    ],
    [rooms, builtins, customObjects, materialConfig]
  );

  if (!isOpen) return null;

  const stem = board.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const validScope = scope !== null && scope < rooms.length ? scope : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>BRD</span>
            <div>
              <h2 className={styles.title}>Finish Board</h2>
              <div className={styles.subtitle}>
                The scheme in one page — finishes, and every piece at one true scale
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Escape)">
            ✕
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.roomFilter}>
            <button
              className={validScope === null ? styles.roomPillActive : styles.roomPill}
              onClick={() => setScope(null)}
            >
              Whole house
            </button>
            {names.map((name, i) => (
              <button
                key={`${name}-${i}`}
                className={validScope === i ? styles.roomPillActive : styles.roomPill}
                onClick={() => setScope(i)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className={styles.actionsGroup}>
            <button className={styles.exportBtn} onClick={() => downloadBlueprintSvg(svg, `board-${stem}.svg`)}>
              SVG
            </button>
            <button className={styles.printBtn} onClick={() => downloadBlueprintPng(svg, `board-${stem}.png`, 2.0)}>
              PNG
            </button>
            <button className={styles.printBtn} onClick={() => printBlueprintSheet(svg, `Finish board — ${board.title}`)}>
              Print
            </button>
            <button
              className={styles.exportBtn}
              onClick={() => printMoodboardSet(allBoards)}
              title="Every board, one per page — the pack you walk a client through"
            >
              Print pack ({allBoards.length})
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.preview} dangerouslySetInnerHTML={{ __html: svg }} />
          <div className={styles.note}>
            Every piece is drawn at the <strong>same scale</strong>, off its measured size, so a
            console really does read smaller than the sectional beside it — the question a board
            gets looked at for. Collage tools arrange cutouts by eye and lose that. There is no
            product photography here: the colours are the specified finish and the piece&rsquo;s
            own colour, and the numbers under each piece are the real dimensions.
          </div>
        </div>
      </div>
    </div>
  );
}
