"use client";

// notes/ui/ui-principles.md #6 — a rotating ring beats a dropdown for a spatial question.

import { FACINGS, Facing, facingAngleDeg } from "@/lib/plot";
import styles from "./CompassDial.module.css";

interface CompassDialProps {
  facing: Facing;
  onChange: (facing: Facing) => void;
}

const RADIUS = 68;
const CENTER = 84;

export default function CompassDial({ facing, onChange }: CompassDialProps) {
  return (
    <div className={styles.wrap}>
      <svg width={CENTER * 2} height={CENTER * 2} className={styles.dial}>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className={styles.ring} />
        <circle cx={CENTER} cy={CENTER} r={3} className={styles.hub} />
        {FACINGS.map((f) => {
          const angle = ((facingAngleDeg(f) - 90) * Math.PI) / 180;
          const x = CENTER + RADIUS * Math.cos(angle);
          const y = CENTER + RADIUS * Math.sin(angle);
          const active = f === facing;
          return (
            <g key={f}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                className={active ? styles.spokeActive : styles.spoke}
              />
              <circle
                cx={x}
                cy={y}
                r={active ? 12 : 9}
                className={active ? styles.nodeActive : styles.node}
                onClick={() => onChange(f)}
                role="button"
                aria-label={`Facing ${f}`}
              />
              <text x={x} y={y} dy={4} textAnchor="middle" className={styles.label}>
                {f}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.caption}>
        Facing <strong>{facing}</strong>
      </div>
    </div>
  );
}
