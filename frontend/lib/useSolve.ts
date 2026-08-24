"use client";

// Debounced solve — notes/architecture/architecture.md: ~400ms after input settles.
// Supports optimistic drag-and-drop repositioning via moveRoom() and custom room dimensions.

import { useCallback, useEffect, useRef, useState } from "react";
import { Facing, Setback } from "./plot";
import { RoomName } from "./rooms";
import { requestSolve, RoomSpecIn, SolveMeta, SolvedRoom } from "./solve";

const DEBOUNCE_MS = 350;

interface UseSolveArgs {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  rooms: (RoomName | RoomSpecIn)[];
  setback: Setback;
}

export function useSolve({ plotWIn, plotDIn, facing, rooms: roomList, setback }: UseSolveArgs) {
  const [rooms, setRooms] = useState<SolvedRoom[]>([]);
  const [meta, setMeta] = useState<SolveMeta | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevRef = useRef<{ index: number; x_in: number; y_in: number }[] | undefined>(undefined);
  const lastRoomsKeyRef = useRef("");

  useEffect(() => {
    const roomsKey = JSON.stringify(roomList);
    if (lastRoomsKeyRef.current !== roomsKey) {
      lastRoomsKeyRef.current = roomsKey;
      prevRef.current = undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true);
      try {
        const res = await requestSolve(
          { plotWIn, plotDIn, facing, rooms: roomList, setback, prev: prevRef.current },
          controller.signal
        );
        setRooms(res.rooms);
        setMeta(res.meta);
        setError(null);
        prevRef.current = res.rooms.map((r, index) => ({
          index,
          x_in: r.x_in - res.meta.envelope_origin_x_in,
          y_in: r.y_in - res.meta.envelope_origin_z_in,
        }));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [plotWIn, plotDIn, facing, roomList, setback]);

  // Immediate optimistic room drag-and-drop repositioning
  const moveRoom = useCallback(
    async (roomIndex: number, targetPlotXIn: number, targetPlotYIn: number) => {
      if (!meta) return;
      const envX0 = meta.envelope_origin_x_in;
      const envZ0 = meta.envelope_origin_z_in;

      const nextPrev = rooms.map((r, i) => ({
        index: i,
        x_in: i === roomIndex ? Math.max(0, targetPlotXIn - envX0) : r.x_in - envX0,
        y_in: i === roomIndex ? Math.max(0, targetPlotYIn - envZ0) : r.y_in - envZ0,
      }));
      prevRef.current = nextPrev;

      // Optimistically update on-screen position instantly
      setRooms((prevRooms) =>
        prevRooms.map((r, i) =>
          i === roomIndex ? { ...r, x_in: targetPlotXIn, y_in: targetPlotYIn } : r
        )
      );

      setPending(true);
      try {
        const res = await requestSolve({
          plotWIn,
          plotDIn,
          facing,
          rooms: roomList,
          setback,
          prev: nextPrev,
        });
        setRooms(res.rooms);
        setMeta(res.meta);
        setError(null);
        prevRef.current = res.rooms.map((r, index) => ({
          index,
          x_in: r.x_in - res.meta.envelope_origin_x_in,
          y_in: r.y_in - res.meta.envelope_origin_z_in,
        }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [meta, rooms, plotWIn, plotDIn, facing, roomList, setback]
  );

  return { rooms, meta, pending, error, moveRoom };
}
