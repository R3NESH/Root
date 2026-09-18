"use client";

// The panel that appears when a wall is clicked in the 3D view.
//
// Everything here is a property of one wall: how long its run is, how thick it is drawn, how tall
// it stands, and the rectangular holes cut through it.
//
// It serves both kinds of wall this app has, which is why it takes plain numbers and a writer
// rather than a wall. A wall the solver placed keeps its overrides in lib/wallEdits.ts and its
// length belongs to the room behind it; a wall the user drew keeps all four on the
// CustomDrawnWall itself and owns its own length. The panel does not need to know which.

import { CUTOUT_SHAPES, CutoutShape, WALL_PROFILES, WallProfile } from "@/lib/wallShapes";
import {
  clampThicknessIn,
  clampWallHeightIn,
  firstFreeOffsetIn,
  isEmptyWallEdit,
  MAX_WALL_THICKNESS_IN,
  MIN_CUTOUT_IN,
  MIN_WALL_HEIGHT_IN,
  MIN_WALL_THICKNESS_IN,
  resolveCutouts,
  WallCutout,
  WallEdit,
} from "@/lib/wallEdits";

interface WallInspectorProps {
  title: string;
  subtitle: string;
  /** The wall's run, in feet. */
  runFt: number;
  /** Floor to ceiling for this storey, in inches — the tallest a wall may be drawn. */
  storeyHeightIn: number;
  /** What the wall would be without an override, in inches. */
  defaultThicknessIn: number;
  edit: WallEdit | undefined;
  onChange: (next: WallEdit) => void;
  /** Positive lengthens the run. */
  onChangeLength: (deltaFt: number) => void;
  /** Shown under the length control, where changing it does more than change the wall. */
  lengthNote?: string;
  /** How far the wall bows in plan, in inches. Absent hides the control. */
  curveIn?: number;
  onChangeCurve?: (deltaIn: number) => void;
  /** Why the bow is refused — a wall carrying a door or a window cannot take one. */
  curveBlocked?: string;
  /** Copy this wall's geometry, and paste the copied one onto it. */
  onCopy?: () => void;
  onPaste?: () => void;
  /** False when the clipboard is empty or holds something that is not a wall. */
  canPaste?: boolean;
  /**
   * Delete this wall outright. Only a wall the user drew has this: a solver wall cannot be
   * deleted, only opened up, and that control lives in the ribbon's wall inspector.
   */
  onDelete?: () => void;
  onClose: () => void;
}

const PANEL: React.CSSProperties = {
  position: "absolute",
  top: 76,
  right: 16,
  width: 268,
  maxHeight: "calc(100% - 108px)",
  overflowY: "auto",
  background: "rgba(26, 25, 22, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
  borderRadius: 12,
  padding: "12px 13px",
  zIndex: 42,
  backdropFilter: "blur(8px)",
  color: "#eceae5",
  fontSize: 12,
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 7,
};

const LABEL: React.CSSProperties = { color: "#b5b0a6", fontSize: 11 };

const STEP_BTN: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "#eceae5",
  width: 22,
  height: 22,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  lineHeight: "18px",
  padding: 0,
};

const VALUE: React.CSSProperties = {
  minWidth: 62,
  textAlign: "center",
  fontWeight: 700,
  color: "#d4703a",
  fontVariantNumeric: "tabular-nums",
};

const SECTION_HEAD: React.CSSProperties = {
  color: "#8e8a82",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  margin: "12px 0 6px",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  paddingTop: 8,
};

const CHIP: React.CSSProperties = {
  flex: "1 1 auto",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 5,
  color: "#b5b0a6",
  fontSize: 10.5,
  fontWeight: 600,
  padding: "4px 6px",
  cursor: "pointer",
};

const DANGER: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "rgba(184, 92, 34, 0.16)",
  borderColor: "rgba(184, 92, 34, 0.5)",
  color: "#d98b52",
};

const CHIP_ON: React.CSSProperties = {
  ...CHIP,
  background: "rgba(111, 154, 168, 0.2)",
  borderColor: "rgba(111, 154, 168, 0.55)",
  color: "#9dc3d1",
};

const NUM_INPUT: React.CSSProperties = {
  width: "100%",
  background: "#12110f",
  border: "1px solid #3a372f",
  borderRadius: 5,
  color: "#eceae5",
  fontSize: 11,
  padding: "3px 5px",
  fontVariantNumeric: "tabular-nums",
};

function feetInches(totalIn: number): string {
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 0 ? `${ft}′` : `${ft}′ ${inch}″`;
}

export default function WallInspector({
  title,
  subtitle,
  runFt,
  storeyHeightIn,
  defaultThicknessIn,
  edit,
  onChange,
  onChangeLength,
  lengthNote,
  curveIn,
  onChangeCurve,
  curveBlocked,
  onCopy,
  onPaste,
  canPaste,
  onDelete,
  onClose,
}: WallInspectorProps) {
  const runIn = runFt * 12;
  const thicknessIn = edit?.thicknessIn ?? defaultThicknessIn;
  const heightIn = clampWallHeightIn(edit?.heightIn ?? storeyHeightIn, storeyHeightIn);
  const cutouts = edit?.cutouts ?? [];
  // What the renderer will actually build, so the panel and the wall never disagree about which
  // holes exist.
  const builtIds = new Set(resolveCutouts(cutouts, runIn, heightIn).map((c) => c.id));

  const patch = (next: Partial<WallEdit>) => onChange({ ...edit, ...next });

  const setCutouts = (next: WallCutout[]) => patch({ cutouts: next });

  // Keep the four numbers consistent with each other, not just each inside its own range. A sill
  // plus a height taller than the wall, or an offset plus a width past its end, is a hole that
  // leaves the wall — and a hole outside its own outline is what tore the mesh.
  const fitCutout = (c: WallCutout): WallCutout => resolveCutouts([c], runIn, heightIn)[0] ?? c;

  const updateCutout = (id: string, changes: Partial<WallCutout>) =>
    setCutouts(cutouts.map((c) => (c.id === id ? fitCutout({ ...c, ...changes }) : c)));

  const addCutout = () => {
    const widthIn = Math.min(36, Math.max(MIN_CUTOUT_IN, Math.round(runIn / 3)));
    const offsetIn = firstFreeOffsetIn(cutouts, runIn, widthIn);
    if (offsetIn === null) return;
    const height = Math.min(36, Math.max(MIN_CUTOUT_IN, heightIn - 48));
    setCutouts([
      ...cutouts,
      {
        id: `cut_${Date.now().toString(36)}_${cutouts.length}`,
        offsetIn,
        sillIn: Math.max(0, Math.min(heightIn - height, 36)),
        widthIn,
        heightIn: height,
      },
    ]);
  };

  const noRoom = firstFreeOffsetIn(cutouts, runIn, MIN_CUTOUT_IN) === null;

  return (
    <div style={PANEL}>
      <div style={{ ...ROW, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#d4703a", fontSize: 12.5 }}>{title}</div>
          <div style={{ ...LABEL, fontSize: 10 }}>{subtitle}</div>
        </div>
        <button
          style={{ ...STEP_BTN, background: "transparent", border: "none", color: "#8e8a82" }}
          onClick={onClose}
          title="Deselect"
        >
          ✕
        </button>
      </div>

      {onDelete && (
        <button
          style={{ ...CHIP, ...DANGER, marginBottom: 9 }}
          onClick={onDelete}
          title="Delete this drawn wall"
        >
          Delete wall
        </button>
      )}

      {onCopy && onPaste && (
        <div style={{ display: "flex", gap: 4, marginBottom: 9 }}>
          <button style={CHIP} onClick={onCopy} title="Copy this wall's thickness, height, outline and cutouts (Ctrl+C)">
            Copy wall
          </button>
          <button
            style={canPaste ? CHIP_ON : { ...CHIP, opacity: 0.45, cursor: "not-allowed" }}
            disabled={!canPaste}
            onClick={onPaste}
            title={
              canPaste
                ? "Apply the copied wall's geometry to this one (Ctrl+V)"
                : "Copy a wall first"
            }
          >
            Paste onto this
          </button>
        </div>
      )}

      <div style={ROW}>
        <span style={LABEL}>Length</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={STEP_BTN} onClick={() => onChangeLength(-1)} title="Shorten the room by 1 ft">
            −
          </button>
          <span style={VALUE}>{feetInches(runIn)}</span>
          <button style={STEP_BTN} onClick={() => onChangeLength(1)} title="Lengthen the room by 1 ft">
            +
          </button>
        </div>
      </div>
      {lengthNote && (
        <div style={{ ...LABEL, fontSize: 9.5, marginTop: -3, marginBottom: 8 }}>{lengthNote}</div>
      )}

      <div style={ROW}>
        <span style={LABEL}>Thickness</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            style={STEP_BTN}
            disabled={thicknessIn <= MIN_WALL_THICKNESS_IN}
            onClick={() => patch({ thicknessIn: clampThicknessIn(thicknessIn - 1.5) })}
          >
            −
          </button>
          <span style={VALUE}>{thicknessIn}″</span>
          <button
            style={STEP_BTN}
            disabled={thicknessIn >= MAX_WALL_THICKNESS_IN}
            onClick={() => patch({ thicknessIn: clampThicknessIn(thicknessIn + 1.5) })}
          >
            +
          </button>
        </div>
      </div>

      <div style={ROW}>
        <span style={LABEL}>Height</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            style={STEP_BTN}
            disabled={heightIn <= MIN_WALL_HEIGHT_IN}
            onClick={() => patch({ heightIn: clampWallHeightIn(heightIn - 6, storeyHeightIn) })}
          >
            −
          </button>
          <span style={VALUE}>{feetInches(heightIn)}</span>
          <button
            style={STEP_BTN}
            disabled={heightIn >= storeyHeightIn}
            onClick={() => patch({ heightIn: clampWallHeightIn(heightIn + 6, storeyHeightIn) })}
          >
            +
          </button>
        </div>
      </div>
      {heightIn >= storeyHeightIn && (
        <div style={{ ...LABEL, fontSize: 9.5, marginTop: -3, marginBottom: 8 }}>
          Full storey height. A wall cannot be drawn taller than the slab above it.
        </div>
      )}

      <div style={SECTION_HEAD}>Wall shape</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {WALL_PROFILES.map((p) => (
          <button
            key={p.id}
            style={(edit?.profile ?? "square") === p.id ? CHIP_ON : CHIP}
            onClick={() => patch({ profile: p.id as WallProfile })}
            title={p.description}
          >
            {p.name}
          </button>
        ))}
      </div>

      {Boolean(curveIn) && (
        <div style={{ ...LABEL, fontSize: 9.5, marginTop: -3, marginBottom: 8, color: "#c08a5a" }}>
          A bowed wall is drawn as straight chords, and the outline and cutouts above are not
          applied to it. Flatten the bow to get them back.
        </div>
      )}

      {onChangeCurve && (
        <>
          <div style={ROW}>
            <span style={LABEL}>Bow in plan</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                style={STEP_BTN}
                disabled={Boolean(curveBlocked)}
                onClick={() => onChangeCurve(-6)}
                title={curveBlocked ?? "Bow the wall the other way"}
              >
                −
              </button>
              <span style={VALUE}>{Math.round(((curveIn ?? 0) / 12) * 10) / 10}′</span>
              <button
                style={STEP_BTN}
                disabled={Boolean(curveBlocked)}
                onClick={() => onChangeCurve(6)}
                title={curveBlocked ?? "Bow the wall outward"}
              >
                +
              </button>
            </div>
          </div>
          {curveBlocked && (
            <div style={{ ...LABEL, fontSize: 9.5, marginTop: -3, marginBottom: 8 }}>
              {curveBlocked}
            </div>
          )}
        </>
      )}

      <div style={SECTION_HEAD}>Cutouts</div>

      {cutouts.length === 0 && (
        <div style={{ ...LABEL, fontSize: 10.5, marginBottom: 8 }}>
          No holes in this wall.
        </div>
      )}

      {cutouts.map((c, idx) => (
        <div
          key={c.id}
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "7px 8px",
            marginBottom: 7,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ ...ROW, marginBottom: 6 }}>
            <span style={{ ...LABEL, color: builtIds.has(c.id) ? "#7a9668" : "#a8442f" }}>
              {builtIds.has(c.id)
                ? `Hole ${idx + 1}`
                : `Hole ${idx + 1} — overlaps, not built`}
            </span>
            <button
              style={{ ...STEP_BTN, color: "#a8442f", width: "auto", padding: "0 8px", fontSize: 10 }}
              onClick={() => setCutouts(cutouts.filter((x) => x.id !== c.id))}
              title="Fill this hole back in"
            >
              Remove
            </button>
          </div>
          <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
            {CUTOUT_SHAPES.map((sh) => (
              <button
                key={sh.id}
                style={(c.shape ?? "rect") === sh.id ? CHIP_ON : CHIP}
                onClick={() => updateCutout(c.id, { shape: sh.id as CutoutShape })}
                title={sh.description}
              >
                {sh.name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(
              [
                ["Width", "widthIn", MIN_CUTOUT_IN, Math.max(MIN_CUTOUT_IN, runIn - 2 * MIN_CUTOUT_IN)],
                ["Height", "heightIn", MIN_CUTOUT_IN, Math.max(MIN_CUTOUT_IN, heightIn - MIN_CUTOUT_IN)],
                ["From start", "offsetIn", MIN_CUTOUT_IN, Math.max(MIN_CUTOUT_IN, runIn - MIN_CUTOUT_IN)],
                ["Sill height", "sillIn", 0, Math.max(0, heightIn - MIN_CUTOUT_IN)],
              ] as Array<[string, keyof WallCutout, number, number]>
            ).map(([label, field, min, max]) => (
              <label key={field} style={{ display: "block" }}>
                <span style={{ ...LABEL, fontSize: 9.5, display: "block", marginBottom: 2 }}>
                  {label} (in)
                </span>
                <input
                  type="number"
                  style={NUM_INPUT}
                  min={min}
                  max={Math.round(max)}
                  step={1}
                  value={c[field] as number}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (!Number.isFinite(raw)) return;
                    updateCutout(c.id, {
                      [field]: Math.max(min, Math.min(Math.round(max), Math.round(raw))),
                    } as Partial<WallCutout>);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        style={{
          width: "100%",
          background: "linear-gradient(135deg, rgba(111, 154, 168, 0.25), rgba(74, 109, 124, 0.35))",
          border: "1px solid rgba(111, 154, 168, 0.5)",
          color: "#6f9aa8",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: noRoom ? "not-allowed" : "pointer",
          opacity: noRoom ? 0.45 : 1,
          marginTop: 2,
        }}
        disabled={noRoom}
        onClick={addCutout}
        title={noRoom ? "No clear span left on this wall" : "Cut a rectangular hole through this wall"}
      >
        + Cut a hole
      </button>

      {!isEmptyWallEdit(edit) && (
        <button
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#8e8a82",
            padding: "5px 10px",
            borderRadius: 8,
            fontSize: 10.5,
            cursor: "pointer",
            marginTop: 6,
          }}
          onClick={() => onChange({})}
          title="Drop every override on this wall"
        >
          Reset wall
        </button>
      )}
    </div>
  );
}
