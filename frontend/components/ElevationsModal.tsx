"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SolvedRoom } from "@/lib/solve";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { BuiltinFurnitureRecord } from "@/lib/furnitureInventory";
import {
  EDGE_NAMES,
  WallElevation,
  buildElevations,
  elevationSvg,
  printElevationSet,
} from "@/lib/elevations";
// The same three exporters the blueprint sheet uses; an elevation is a sheet like any other.
import {
  downloadBlueprintPng,
  downloadBlueprintSvg,
  printBlueprintSheet,
} from "@/lib/blueprintExport";
import { formatFtIn } from "@/lib/designSchedule";
import styles from "./StudioModal.module.css";

interface ElevationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: SolvedRoom[];
  builtins: BuiltinFurnitureRecord[];
  customObjects: PlacedCustomObject[];
  materialConfig: HouseMaterialConfig;
}

/** A wall with nothing on it and no opening is a blank rectangle; hide those by default. */
function isBlank(el: WallElevation): boolean {
  return el.openings.length === 0 && el.pieces.length === 0;
}

export default function ElevationsModal({
  isOpen,
  onClose,
  rooms,
  builtins,
  customObjects,
  materialConfig,
}: ElevationsModalProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showBlank, setShowBlank] = useState(false);

  const all = useMemo(
    () => buildElevations(rooms, builtins, customObjects, materialConfig),
    [rooms, builtins, customObjects, materialConfig]
  );

  const shown = useMemo(() => (showBlank ? all : all.filter((el) => !isBlank(el))), [all, showBlank]);

  // Keep a valid selection when the plan, the filter or the fit-out changes under it.
  useEffect(() => {
    if (shown.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    if (!selectedKey || !shown.some((el) => el.key === selectedKey)) {
      setSelectedKey(shown[0].key);
    }
  }, [shown, selectedKey]);

  const selected = shown.find((el) => el.key === selectedKey) ?? shown[0] ?? null;
  const svg = useMemo(() => (selected ? elevationSvg(selected) : ""), [selected]);

  const byRoom = useMemo(() => {
    const groups = new Map<string, WallElevation[]>();
    for (const el of shown) {
      const list = groups.get(el.roomLabel) ?? [];
      list.push(el);
      groups.set(el.roomLabel, list);
    }
    return [...groups.entries()];
  }, [shown]);

  if (!isOpen) return null;

  const fileStem = selected ? selected.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "elevation";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.logoIcon}>ELV</span>
            <div>
              <h2 className={styles.title}>Interior Elevations</h2>
              <div className={styles.subtitle}>
                Every wall drawn flat and straight on, with heights a plan cannot carry
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
              className={showBlank ? styles.tabBtn : styles.tabBtnActive}
              onClick={() => setShowBlank(false)}
            >
              With something on them ({all.filter((el) => !isBlank(el)).length})
            </button>
            <button
              className={showBlank ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setShowBlank(true)}
            >
              Every wall ({all.length})
            </button>
          </div>
          <div className={styles.actionsGroup}>
            <button
              className={styles.exportBtn}
              onClick={() => svg && downloadBlueprintSvg(svg, `${fileStem}.svg`)}
              disabled={!selected}
              title="Vector sheet of the selected wall"
            >
              SVG
            </button>
            <button
              className={styles.printBtn}
              onClick={() => svg && downloadBlueprintPng(svg, `${fileStem}.png`, 2.0)}
              disabled={!selected}
              title="High-resolution raster of the selected wall"
            >
              PNG
            </button>
            <button
              className={styles.printBtn}
              onClick={() => svg && printBlueprintSheet(svg, selected?.title)}
              disabled={!selected}
              title="Print just this wall"
            >
              Print sheet
            </button>
            <button
              className={styles.exportBtn}
              onClick={() => printElevationSet(shown)}
              disabled={shown.length === 0}
              title="Print every elevation shown, one per page"
            >
              Print set ({shown.length})
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {shown.length === 0 ? (
            <div className={styles.empty}>
              No elevations to draw.
              <br />
              Solve a plan first. Auto-furnish it and the elevations fill with the fit-out.
            </div>
          ) : (
            <div className={styles.split}>
              <div className={styles.wallList}>
                {byRoom.map(([room, walls]) => (
                  <div key={room}>
                    <div className={styles.roomHeading}>{room}</div>
                    {walls.map((el) => (
                      <button
                        key={el.key}
                        className={el.key === selected?.key ? styles.wallItemActive : styles.wallItem}
                        onClick={() => setSelectedKey(el.key)}
                      >
                        <span>{EDGE_NAMES[el.edge]}</span>
                        <span className={styles.wallMeta}>
                          {formatFtIn(el.lengthFt)} &middot; {el.pieces.length}p {el.openings.length}o
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.preview} dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          )}

          <div className={styles.note}>
            Each wall is drawn looking at it from inside the room, so left-to-right follows the
            direction you would be facing. Solid outlines are against the wall; dashed ones stand
            in front of it and are shown because they block it. Heights come from the built model,
            not from a catalog. Pieces turned to an angle that is not a quarter turn are drawn at
            their unrotated footprint.
          </div>
        </div>
      </div>
    </div>
  );
}
