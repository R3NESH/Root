"use client";

import React from "react";
import { RoomName } from "@/lib/rooms";
import { SolvedRoom } from "@/lib/solve";
import RoomCustomizer, { CustomDim } from "./RoomCustomizer";
import styles from "./RoomDimensionsModal.module.css";

interface RoomDimensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  counts: Record<RoomName, number>;
  rooms: SolvedRoom[];
  customDims: Record<string, CustomDim>;
  onChangeCustomDims: (next: Record<string, CustomDim>) => void;
}

export default function RoomDimensionsModal({
  isOpen,
  onClose,
  counts,
  rooms,
  customDims,
  onChangeCustomDims,
}: RoomDimensionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>📐</span>
            <div>
              <h2 className={styles.title}>Room Dimensions &amp; Sizing Studio</h2>
              <p className={styles.subtitle}>
                Customize exact width &amp; depth dimensions for individual rooms. The architectural solver automatically adapts layout &amp; door openings.
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <RoomCustomizer
            counts={counts}
            rooms={rooms}
            customDims={customDims}
            onChangeCustomDims={onChangeCustomDims}
          />
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerTip}>
            💡 Tip: Dimensions snap in 1-foot increments. The 3D view and 2D CAD blueprint update in real time!
          </span>
          <button className={styles.doneBtn} onClick={onClose}>
            ✓ Done Sizing
          </button>
        </div>
      </div>
    </div>
  );
}
