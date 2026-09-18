"use client";

// Describe the plot by walking its boundary.
//
// This replaces a table of corner X/Y coordinates, which was the wrong mental model twice over:
// nobody knows their plot as coordinates, and coordinates cannot be edited one at a time — each
// keystroke left the other corners disagreeing with the one just typed, so the outline passed
// through degenerate shapes and the plot resized underneath the cursor.
//
// A side length is different. It is what a tape measure reads, it is what a sale deed lists, and
// changing one is always a valid edit. See lib/plotTraverse.ts for the two real-world conventions
// this follows.
//
// Nothing here writes to the plot until Apply. The preview is live, the commit is not.

import React, { useEffect, useMemo, useState } from "react";
import {
  MAX_EDGE_BULGE_IN,
  MAX_PLOT_VERTICES,
  PlotDims,
  isConvexOutline,
  outlineBoundsIn,
  plotPolygonIn,
  plotShapeProblem,
} from "@/lib/plot";
import {
  CLOSURE_TOLERANCE_IN,
  PLOT_SHAPE_PRESETS,
  PlotEdge,
  closureErrorIn,
  edgeCompassLabels,
  rectangleTraverse,
  traverseToVerts,
  vertsToTraverse,
} from "@/lib/plotTraverse";
import styles from "./PlotShapeModal.module.css";

interface PlotShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: PlotDims;
  onApply: (next: PlotDims) => void;
}

const ft = (inches: number) => Math.round((inches / 12) * 10) / 10;

/** A side you can walk in under a foot is a corner artefact, not a boundary. */
const MIN_SIDE_IN = 12;

export default function PlotShapeModal({ isOpen, onClose, plot, onApply }: PlotShapeModalProps) {
  const [edges, setEdges] = useState<PlotEdge[]>([]);
  // Raw text per field while it is being typed. A controlled number input fed a parsed value
  // fights the typist: clearing "0" to type "50" briefly leaves "", and React puts the 0 back,
  // which is where the "050" in the old table came from. The string is authoritative until the
  // field is left.
  const [raw, setRaw] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setRaw({});
    const verts = plot.vertsIn && plot.vertsIn.length >= 3 ? plot.vertsIn : null;
    setEdges(
      verts
        ? vertsToTraverse(verts, plot.edgeBulgeIn ?? [])
        : vertsToTraverse(
            plotPolygonIn({ ...plot, edgeBulgeIn: undefined }),
            plot.edgeBulgeIn ?? []
          )
    );
  }, [isOpen, plot]);

  const labels = useMemo(() => (edges.length ? edgeCompassLabels(edges) : []), [edges]);
  const verts = useMemo(() => traverseToVerts(edges), [edges]);
  const gapIn = useMemo(() => (edges.length ? closureErrorIn(edges) : 0), [edges]);
  const closes = gapIn <= CLOSURE_TOLERANCE_IN;

  const previewPlot: PlotDims = useMemo(
    () => ({
      widthIn: plot.widthIn,
      depthIn: plot.depthIn,
      vertsIn: verts.length >= 3 ? verts : undefined,
      edgeBulgeIn: edges.map((e) => e.bulgeIn),
    }),
    [verts, edges, plot.widthIn, plot.depthIn]
  );

  const outline = useMemo(
    () => (verts.length >= 3 ? plotPolygonIn(previewPlot) : []),
    [previewPlot, verts.length]
  );
  const bounds = useMemo(() => outlineBoundsIn(outline), [outline]);
  const problem = verts.length >= 3 ? plotShapeProblem(previewPlot) : null;

  const areaSqFt = useMemo(() => {
    if (outline.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < outline.length; i++) {
      const [x0, y0] = outline[i];
      const [x1, y1] = outline[(i + 1) % outline.length];
      a += x0 * y1 - x1 * y0;
    }
    return Math.abs(a / 2) / 144;
  }, [outline]);

  if (!isOpen) return null;

  const setEdge = (i: number, patch: Partial<PlotEdge>) =>
    setEdges((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const field = (i: number, key: string, value: number) => {
    const k = `${i}-${key}`;
    return raw[k] ?? String(value);
  };

  const onField = (i: number, key: "lengthIn" | "turnDeg" | "bulgeIn", text: string) => {
    setRaw((r) => ({ ...r, [`${i}-${key}`]: text }));
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return;
    if (key === "lengthIn") setEdge(i, { lengthIn: Math.max(MIN_SIDE_IN, Math.round(n * 12)) });
    else if (key === "turnDeg") setEdge(i, { turnDeg: n });
    else
      setEdge(i, {
        bulgeIn: Math.max(-MAX_EDGE_BULGE_IN, Math.min(MAX_EDGE_BULGE_IN, Math.round(n))),
      });
  };

  const blurField = (i: number, key: string) =>
    setRaw((r) => {
      const next = { ...r };
      delete next[`${i}-${key}`];
      return next;
    });

  const addSide = () => {
    if (edges.length >= MAX_PLOT_VERTICES) return;
    // Split the longest side and halve the turn that followed it, so the shape does not jump.
    let at = 0;
    for (let i = 1; i < edges.length; i++) if (edges[i].lengthIn > edges[at].lengthIn) at = i;
    const src = edges[at];
    const half = Math.max(MIN_SIDE_IN, Math.round(src.lengthIn / 2));
    setEdges((prev) => [
      ...prev.slice(0, at),
      { lengthIn: half, turnDeg: 0, bulgeIn: Math.round(src.bulgeIn / 2) },
      { lengthIn: src.lengthIn - half, turnDeg: src.turnDeg, bulgeIn: Math.round(src.bulgeIn / 2) },
      ...prev.slice(at + 1),
    ]);
  };

  /**
   * Re-derive the traverse from the corners it walks to, which is what makes it close: the last
   * side becomes whatever runs from the last corner back to the first.
   */
  const closed = (next: PlotEdge[]) =>
    vertsToTraverse(traverseToVerts(next), next.map((e) => e.bulgeIn));

  const dropSide = (i: number) => {
    if (edges.length <= 3) return;
    setEdges((prev) => {
      const next = prev.filter((_, j) => j !== i);
      // The removed side's turn has to go somewhere or the walk spins short of 360.
      const into = i === 0 ? next.length - 1 : i - 1;
      next[into] = { ...next[into], turnDeg: next[into].turnDeg + prev[i].turnDeg };
      // Removing a side removes a vector, so the walk cannot still close and the open polyline
      // it leaves can cross itself. Closing here is not the same liberty as closing a TYPED
      // edit: asking for one fewer side is asking for the shape to change, and leaving a broken
      // outline on screen would be a worse answer than choosing the obvious one.
      return closed(next);
    });
  };

  const closeLoop = () => {
    if (edges.length < 3) return;
    setEdges(closed(edges));
  };

  const apply = () => {
    if (verts.length < 3) return;
    const drawn = plotPolygonIn(previewPlot);
    const b = outlineBoundsIn(drawn);
    const bulges = edges.map((e) => e.bulgeIn);
    onApply({
      ...plot,
      widthIn: Math.max(1, b.widthIn),
      depthIn: Math.max(1, b.depthIn),
      cornerCutsIn: undefined,
      vertsIn: verts,
      edgeBulgeIn: bulges.some((v) => Math.abs(v) >= 1) ? bulges : undefined,
    });
    onClose();
  };

  // --- preview -------------------------------------------------------------------------
  const VW = 300;
  const VH = 300;
  const pad = 26;
  const scale =
    outline.length >= 3
      ? Math.min((VW - pad * 2) / Math.max(bounds.widthIn, 1), (VH - pad * 2) / Math.max(bounds.depthIn, 1))
      : 1;
  const ox = pad + (VW - pad * 2 - bounds.widthIn * scale) / 2;
  const oy = pad + (VH - pad * 2 - bounds.depthIn * scale) / 2;
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy + y * scale;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>PLT</span>
            <div>
              <div className={styles.title}>Plot Shape</div>
              <div className={styles.subtitle}>
                Walk the boundary: how long each side runs, and which way it turns at the corner.
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className={styles.presetRow}>
          {PLOT_SHAPE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={styles.presetBtn}
              onClick={() => {
                setRaw({});
                setEdges(p.build(plot.widthIn, plot.depthIn));
              }}
              title={p.blurb}
            >
              <span className={styles.presetLabel}>{p.label}</span>
              <span className={styles.presetBlurb}>{p.blurb}</span>
            </button>
          ))}
        </div>

        <div className={styles.body}>
          <div className={styles.tableCol}>
            <div className={styles.tableHead}>
              <span>Side</span>
              <span>Faces</span>
              <span>Length ft</span>
              <span>Turn °</span>
              <span>Bow in</span>
              <span />
            </div>
            <div className={styles.tableScroll}>
              {edges.map((e, i) => (
                <div className={styles.row} key={i}>
                  <span className={styles.rowIndex}>{i + 1}</span>
                  <span className={styles.rowFace}>{labels[i] ?? "—"}</span>
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={field(i, "lengthIn", ft(e.lengthIn))}
                    onChange={(ev) => onField(i, "lengthIn", ev.target.value)}
                    onBlur={() => blurField(i, "lengthIn")}
                    aria-label={`Side ${i + 1} length in feet`}
                  />
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={field(i, "turnDeg", Math.round(e.turnDeg * 10) / 10)}
                    onChange={(ev) => onField(i, "turnDeg", ev.target.value)}
                    onBlur={() => blurField(i, "turnDeg")}
                    title="Degrees turned at the corner after this side. Positive turns right, negative turns left. A square corner is 90."
                    aria-label={`Turn after side ${i + 1} in degrees`}
                  />
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={field(i, "bulgeIn", e.bulgeIn)}
                    onChange={(ev) => onField(i, "bulgeIn", ev.target.value)}
                    onBlur={() => blurField(i, "bulgeIn")}
                    title="How far this side bows outward at its middle, in inches. Negative caves inward, which the solver cannot pack."
                    aria-label={`Bow of side ${i + 1} in inches`}
                  />
                  <button
                    className={styles.dropBtn}
                    disabled={edges.length <= 3}
                    onClick={() => dropSide(i)}
                    title={edges.length <= 3 ? "Three sides is the fewest a plot can have" : "Remove this side"}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.tableActions}>
              <button
                className={styles.smallBtn}
                onClick={addSide}
                disabled={edges.length >= MAX_PLOT_VERTICES}
                title={
                  edges.length >= MAX_PLOT_VERTICES
                    ? `The solver takes at most ${MAX_PLOT_VERTICES} corners`
                    : "Split the longest side in two"
                }
              >
                + Side
              </button>
              <button
                className={styles.smallBtn}
                onClick={() => {
                  setRaw({});
                  setEdges(rectangleTraverse(plot.widthIn, plot.depthIn));
                }}
                title="Back to a plain rectangle"
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.previewCol}>
            <svg viewBox={`0 0 ${VW} ${VH}`} className={styles.preview}>
              <rect width={VW} height={VH} fill="#131210" />
              {outline.length >= 3 && (
                <>
                  <polygon
                    points={outline.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}
                    fill={problem ? "rgba(184,92,34,0.10)" : "rgba(111,154,168,0.12)"}
                    stroke={problem ? "#b85c22" : "#6f9aa8"}
                    strokeWidth="1.8"
                  />
                  {verts.map(([x, y], i) => (
                    <g key={i}>
                      <circle cx={px(x)} cy={py(y)} r="3.2" fill="#eceae5" />
                      <text x={px(x) + 6} y={py(y) - 5} className={styles.pvLabel}>
                        {i + 1}
                      </text>
                    </g>
                  ))}
                  {/* The gap, drawn rather than described: the walk ends here and should not. */}
                  {!closes && verts.length >= 2 && (
                    <line
                      x1={px(verts[0][0])}
                      y1={py(verts[0][1])}
                      x2={px(verts[verts.length - 1][0])}
                      y2={py(verts[verts.length - 1][1])}
                      stroke="#b85c22"
                      strokeWidth="1.6"
                      strokeDasharray="5,4"
                    />
                  )}
                </>
              )}
            </svg>

            <div className={styles.readout}>
              <div className={styles.readRow}>
                <span>Encloses</span>
                <strong>{areaSqFt ? `${Math.round(areaSqFt).toLocaleString()} sq ft` : "—"}</strong>
              </div>
              <div className={styles.readRow}>
                <span>Bounding box</span>
                <strong>
                  {ft(bounds.widthIn)}′ × {ft(bounds.depthIn)}′
                </strong>
              </div>
              <div className={styles.readRow}>
                <span>Sides</span>
                <strong>{edges.length}</strong>
              </div>
            </div>

            {!closes ? (
              <div className={styles.warn}>
                <strong>Does not close by {ft(gapIn)} ft.</strong> The walk ends short of where it
                started, shown dashed. Adjust a side or a turn, or let the last corners be moved to
                meet the first.
                <button className={styles.warnBtn} onClick={closeLoop}>
                  Close the loop
                </button>
              </div>
            ) : problem ? (
              <div className={styles.warn}>
                <strong>The solver cannot pack this shape.</strong> {problem}
              </div>
            ) : (
              <div className={styles.ok}>Closes cleanly. {verts.length} corners, all convex.</div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footNote}>
            Turns must add up to 360° for a plot to close. A square corner is 90°.
          </span>
          <div className={styles.footActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              className={styles.applyBtn}
              onClick={apply}
              disabled={verts.length < 3 || !isConvexOutline(verts)}
              title={
                verts.length < 3
                  ? "A plot needs at least three sides"
                  : !isConvexOutline(verts)
                  ? "This outline caves inward and the solver cannot pack it"
                  : "Use this shape"
              }
            >
              Apply shape
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
