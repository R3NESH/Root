"use client";

// notes/ui/ui-principles.md #4 — steppers, never text inputs. One row per room kind.
// The user supplies intent (how many bedrooms); the solver supplies correctness (where).

import { ROOM_COLORS, ROOM_LABELS, ROOM_NAMES, RoomName } from "@/lib/rooms";
import styles from "./RoomTray.module.css";

interface RoomTrayProps {
  counts: Record<RoomName, number>;
  onChange: (counts: Record<RoomName, number>) => void;
}

const MAX_PER_KIND = 4;

export default function RoomTray({ counts, onChange }: RoomTrayProps) {
  function step(name: RoomName, delta: number) {
    const next = Math.min(MAX_PER_KIND, Math.max(0, counts[name] + delta));
    if (next !== counts[name]) onChange({ ...counts, [name]: next });
  }

  return (
    <div className={styles.tray}>
      {ROOM_NAMES.map((name) => (
        <div key={name} className={styles.row}>
          <span
            className={styles.swatch}
            style={{ background: `#${ROOM_COLORS[name].toString(16).padStart(6, "0")}` }}
          />
          <span className={styles.label}>{ROOM_LABELS[name]}</span>
          <button className={styles.btn} onClick={() => step(name, -1)} aria-label={`Fewer ${name}`}>
            −
          </button>
          <span className={styles.count}>{counts[name]}</span>
          <button className={styles.btn} onClick={() => step(name, 1)} aria-label={`More ${name}`}>
            +
          </button>
        </div>
      ))}
    </div>
  );
}
