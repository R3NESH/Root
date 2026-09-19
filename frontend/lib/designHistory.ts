// Undo and redo for the whole design.
//
// Every other pro tool in this space treats an edit as reversible; this one treated every click
// as final, which is what made experimenting with a layout expensive. The model here is a
// snapshot stack, not a command log: the design is small enough (a plot, a room mix, a few
// hundred placed objects) that copying it is cheaper than writing an inverse for every action —
// and a snapshot cannot drift out of step with the action it is supposed to undo.
//
// Two ways an entry gets pushed:
//
//   - `record(label)`, driven by an effect watching the document. It pushes the value the
//     document held *before* the change that woke it, so no call site has to remember to ask for
//     history. Nothing can be forgotten by an author adding a new mutation later.
//   - `commitBefore(label)`, called by hand immediately before a mutation the watcher cannot
//     see. Room geometry is the case: rooms are solver output, and a re-solve changes them
//     without the user having edited anything, so they are excluded from the watcher and their
//     one mutation point asks for the entry itself.
//
// Solver-owned room geometry is still *in* the snapshot — it is restored on undo — it just does
// not trigger one.

import { useCallback, useRef, useState } from "react";

import { CustomDim } from "@/components/RoomCustomizer";
import { CustomDrawnWall, CustomRoomZone,
  DrawnStair,
} from "@/lib/customArchitecture";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import { HouseMaterialConfig } from "@/lib/materialsCatalog";
import { Facing, PlotDims } from "@/lib/plot";
import { ProgramKey } from "@/lib/programs";
import { RoomName } from "@/lib/rooms";
import { RoomOpening } from "@/lib/solve";
import { RoomEdgeCurves } from "@/lib/wallCurves";
import { WallEdits } from "@/lib/wallEdits";
import { WindowConfig } from "@/lib/windowCatalog";

/**
 * Everything an edit can change. Deliberately narrower than the autosave payload: the camera,
 * the active floor, the lights and the walkthrough are view state, and undoing a look around is
 * not what Ctrl+Z is for.
 */
export interface DesignSnapshot {
  plot: PlotDims;
  facing: Facing;
  programKey: ProgramKey;
  counts: Record<RoomName, number>;
  customDims: Record<string, CustomDim>;
  customOpenings: Record<string, RoomOpening[]>;
  customWallThickness: Record<string, number>;
  roadWidthM: number;
  autoSetback: boolean;
  floorsCount: number;
  roomEdgeCurves: RoomEdgeCurves;
  wallEdits: WallEdits;
  customWalls: CustomDrawnWall[];
  drawnStairs: DrawnStair[];
  customRoomZones: CustomRoomZone[];
  customObjects: PlacedCustomObject[];
  deletedBuiltinIds: string[];
  materialConfig: HouseMaterialConfig;
  windowConfig: WindowConfig;
  /** Envelope-relative feet, keyed by room id — the frame useSolve keeps its position map in. */
  roomPositions: Record<string, { xFt: number; yFt: number }>;
}

/**
 * What to call the step, from the first field that differs, or null when nothing did. Comparison
 * is by reference, which is exactly right here: React state is replaced, not mutated, so a new
 * object means an edit — and an effect that re-ran without one gets no entry.
 */
export function describeDesignChange(prev: DesignSnapshot, next: DesignSnapshot): string | null {
  if (prev.plot !== next.plot) return "Plot size";
  if (prev.facing !== next.facing) return "Road facing";
  if (prev.programKey !== next.programKey) return "Building type";
  if (prev.counts !== next.counts) return "Room mix";
  if (prev.customDims !== next.customDims) return "Room size";
  if (prev.customOpenings !== next.customOpenings) return "Doors & windows";
  if (prev.customWallThickness !== next.customWallThickness) return "Wall thickness";
  if (prev.wallEdits !== next.wallEdits) return "Wall geometry";
  if (prev.roomEdgeCurves !== next.roomEdgeCurves) return "Wall curve";
  if (prev.roadWidthM !== next.roadWidthM) return "Road width";
  if (prev.floorsCount !== next.floorsCount) return "Storeys";
  if (prev.autoSetback !== next.autoSetback) return "Setback rule";
  if (prev.customWalls !== next.customWalls) return "Drawn wall";
  if (prev.drawnStairs !== next.drawnStairs) return "Drawn stair";
  if (prev.customRoomZones !== next.customRoomZones) return "Room zone";
  if (prev.customObjects !== next.customObjects) return "Furniture";
  if (prev.deletedBuiltinIds !== next.deletedBuiltinIds) return "Delete built-in";
  if (prev.materialConfig !== next.materialConfig) return "Materials";
  if (prev.windowConfig !== next.windowConfig) return "Window style";
  return null;
}

/** How long two same-label changes stay one undo step. A drag emits a change per frame. */
const COALESCE_MS = 900;

/** Entries beyond this are dropped oldest-first. */
const HISTORY_LIMIT = 60;

interface Entry<T> {
  snapshot: T;
  label: string;
  at: number;
}

export interface DesignHistory<T> {
  /**
   * Push the pre-change snapshot for a change that has already landed in state. Called from an
   * effect watching the document; `label` says what moved.
   */
  record: (label: string) => void;
  /** Push the current snapshot before a mutation the watcher does not observe. */
  commitBefore: (label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** What Ctrl+Z would take back, for the button's tooltip. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** Drop the whole stack — a project load is a new document, not an edit. */
  reset: () => void;
}

export function useDesignHistory<T>(
  capture: () => T,
  restore: (snapshot: T) => void
): DesignHistory<T> {
  // The stacks live in refs, not state. Undo has to read the top entry, restore it and push the
  // current document onto the other stack in one go; doing that inside a state updater would be
  // an impure updater, which React deliberately runs twice in development. `bump` is what tells
  // the buttons their enabled state changed.
  const pastRef = useRef<Entry<T>[]>([]);
  const futureRef = useRef<Entry<T>[]>([]);
  const [, bump] = useState(0);
  const sync = useCallback(() => bump((v) => v + 1), []);

  // Both are read inside callbacks that must not be rebuilt on every render, so they go through
  // refs rather than the dependency list.
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  // The document as of the last entry. `record` pushes this, not the current value.
  const lastRef = useRef<T | null>(null);
  // True while an undo or redo is being applied, so the watcher does not record the restore
  // itself as a new edit.
  const restoringRef = useRef(false);

  const push = useCallback(
    (snapshot: T, label: string) => {
      const stack = pastRef.current;
      const top = stack[stack.length - 1];
      // A drag, a stepper held down, a colour dragged around a wheel: same label, no gap. The
      // older snapshot is the one worth keeping, so the run collapses into its first entry.
      if (top && top.label === label && Date.now() - top.at < COALESCE_MS) {
        top.at = Date.now();
      } else {
        stack.push({ snapshot, label, at: Date.now() });
        if (stack.length > HISTORY_LIMIT) stack.splice(0, stack.length - HISTORY_LIMIT);
      }
      // A new edit is a new branch: whatever was undone past this point is gone.
      futureRef.current = [];
      sync();
    },
    [sync]
  );

  const record = useCallback(
    (label: string) => {
      const next = captureRef.current();
      const prev = lastRef.current;
      lastRef.current = next;
      // First settle after mount or after a load: there is no earlier state to go back to.
      if (prev === null || restoringRef.current) return;
      push(prev, label);
    },
    [push]
  );

  const commitBefore = useCallback(
    (label: string) => {
      if (restoringRef.current) return;
      const now = captureRef.current();
      push(now, label);
      lastRef.current = now;
    },
    [push]
  );

  const apply = useCallback((snapshot: T) => {
    restoringRef.current = true;
    restoreRef.current(snapshot);
    lastRef.current = snapshot;
    // React has flushed the restore's state updates and run the watching effect by the time a
    // macrotask runs, so this is where the flag can safely come down.
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  }, []);

  const undo = useCallback(() => {
    const entry = pastRef.current.pop();
    if (!entry) return;
    futureRef.current.push({ snapshot: captureRef.current(), label: entry.label, at: Date.now() });
    apply(entry.snapshot);
    sync();
  }, [apply, sync]);

  const redo = useCallback(() => {
    const entry = futureRef.current.pop();
    if (!entry) return;
    pastRef.current.push({ snapshot: captureRef.current(), label: entry.label, at: Date.now() });
    apply(entry.snapshot);
    sync();
  }, [apply, sync]);

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    sync();
    // Re-seeded rather than blanked: a loaded project is the state the first edit has to be
    // undoable back to, and a null baseline would silently spend that first edit on seeding.
    lastRef.current = captureRef.current();
  }, [sync]);

  const past = pastRef.current;
  const future = futureRef.current;

  return {
    record,
    commitBefore,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoLabel: past.length > 0 ? past[past.length - 1].label : null,
    redoLabel: future.length > 0 ? future[future.length - 1].label : null,
    reset,
  };
}
