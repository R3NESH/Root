"use client";

// notes/ui/ui-principles.md #1 (preset cards) and #4 (steppers, never text inputs).
// notes/decisions/zero-keyboard-events.md — the default path never asks for a keyboard.

import { useState } from "react";
import { MAX_DIM_IN, MIN_DIM_IN, PLOT_PRESETS, PlotDims } from "@/lib/plot";
import { clampInches, feetToInches, inchesToFeet } from "@/lib/units";
import styles from "./PlotPicker.module.css";

interface PlotPickerProps {
  plot: PlotDims;
  onChange: (plot: PlotDims) => void;
}

const STEP_FT = 1;

export default function PlotPicker({ plot, onChange }: PlotPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);

  const activePreset = PLOT_PRESETS.find(
    (p) => feetToInches(p.widthFt) === plot.widthIn && feetToInches(p.depthFt) === plot.depthIn
  );

  function step(dim: "widthIn" | "depthIn", deltaFt: number) {
    const next = clampInches(plot[dim] + feetToInches(deltaFt), MIN_DIM_IN, MAX_DIM_IN);
    onChange({ ...plot, [dim]: next });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.cards}>
        {PLOT_PRESETS.map((p) => (
          <button
            key={p.label}
            className={activePreset?.label === p.label ? styles.cardActive : styles.card}
            onClick={() => {
              setCustomOpen(false);
              onChange({ widthIn: feetToInches(p.widthFt), depthIn: feetToInches(p.depthFt) });
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          className={customOpen ? styles.cardActive : styles.card}
          onClick={() => setCustomOpen((v) => !v)}
        >
          Custom
        </button>
      </div>

      {customOpen && (
        <div className={styles.steppers}>
          <Stepper
            label="Width"
            valueFt={inchesToFeet(plot.widthIn)}
            onDec={() => step("widthIn", -STEP_FT)}
            onInc={() => step("widthIn", STEP_FT)}
          />
          <Stepper
            label="Depth"
            valueFt={inchesToFeet(plot.depthIn)}
            onDec={() => step("depthIn", -STEP_FT)}
            onInc={() => step("depthIn", STEP_FT)}
          />
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  valueFt,
  onDec,
  onInc,
}: {
  label: string;
  valueFt: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperLabel}>{label}</span>
      <button className={styles.stepBtn} onClick={onDec} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className={styles.stepValue}>{valueFt} ft</span>
      <button className={styles.stepBtn} onClick={onInc} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}
