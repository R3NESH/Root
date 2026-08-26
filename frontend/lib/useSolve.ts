"use client";

// Debounced solve — notes/architecture/architecture.md: ~400ms after input settles.
// Supports optimistic drag-and-drop repositioning via moveRoom() and custom room dimensions.
// Persistent stable instance-ID position tracking: adding/removing rooms never shifts existing room placements.

import { useCallback, useEffect, useRef, useState } from "react";
import { Facing, Setback } from "./plot";
import { RoomName } from "./rooms";
import { PrevRoomIn, requestSolve, RoomSpecIn, SolveMeta, SolvedRoom } from "./solve";

const DEBOUNCE_MS = 350;

interface UseSolveArgs {
  plotWIn: number;
  plotDIn: number;
  facing: Facing;
  rooms: (RoomName | RoomSpecIn)[];
  setback: Setback;
}

function getRoomId(r: RoomName | RoomSpecIn, index: number): string {
  if (typeof r === "string") return `${r}_${index}`;
  return r.id || `${r.name}_${index}`;
}

export function useSolve({ plotWIn, plotDIn, facing, rooms: roomList, setback }: UseSolveArgs) {
  const [rooms, setRooms] = useState<SolvedRoom[]>([]);
  const [meta, setMeta] = useState<SolveMeta | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the API answers without any openings at all. The renderer draws doors and windows
  // from `openings` now, so an out-of-date backend yields a house with solid walls and no way
  // in — which looks like a rendering bug and is not one. Fail loudly instead.
  const [staleBackend, setStaleBackend] = useState(false);

  // Persistent instance-level position map: roomId -> { x_in, y_in } (envelope relative)
  const savedPositionsRef = useRef<Map<string, { x_in: number; y_in: number }>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true);

      // Build prev payload strictly matching each room's persistent instance ID
      const prevPayload: PrevRoomIn[] = [];
      roomList.forEach((r, i) => {
        const id = getRoomId(r, i);
        const saved = savedPositionsRef.current.get(id);
        if (saved) {
          prevPayload.push({
            index: i,
            x_in: saved.x_in,
            y_in: saved.y_in,
          });
        }
      });

      try {
        const res = await requestSolve(
          {
            plotWIn,
            plotDIn,
            facing,
            rooms: roomList,
            setback,
            prev: prevPayload.length > 0 ? prevPayload : undefined,
          },
          controller.signal
        );
        setRooms(res.rooms);
        setMeta(res.meta);
        setError(null);
        setStaleBackend(
          res.rooms.length > 0 && res.rooms.every((r) => !r.openings?.length)
        );

        // Update persistent positions for every placed room
        res.rooms.forEach((r, i) => {
          if (i < roomList.length) {
            const id = getRoomId(roomList[i], i);
            savedPositionsRef.current.set(id, {
              x_in: r.x_in - res.meta.envelope_origin_x_in,
              y_in: r.y_in - res.meta.envelope_origin_z_in,
            });
          }
        });
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

      // Update persistent instance position immediately
      const movedId = getRoomId(roomList[roomIndex], roomIndex);
      savedPositionsRef.current.set(movedId, {
        x_in: Math.max(0, targetPlotXIn - envX0),
        y_in: Math.max(0, targetPlotYIn - envZ0),
      });

      // Build updated prev payload
      const nextPrev: PrevRoomIn[] = [];
      roomList.forEach((r, i) => {
        const id = getRoomId(r, i);
        const saved = savedPositionsRef.current.get(id);
        if (saved) {
          nextPrev.push({
            index: i,
            x_in: saved.x_in,
            y_in: saved.y_in,
          });
        }
      });

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
          movedIndex: roomIndex,
        });
        setRooms(res.rooms);
        setMeta(res.meta);
        setError(null);

        res.rooms.forEach((r, i) => {
          if (i < roomList.length) {
            const id = getRoomId(roomList[i], i);
            savedPositionsRef.current.set(id, {
              x_in: r.x_in - res.meta.envelope_origin_x_in,
              y_in: r.y_in - res.meta.envelope_origin_z_in,
            });
          }
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [meta, plotWIn, plotDIn, facing, roomList, setback]
  );

  // Immediate optimistic room crop resizing (width, depth, and position)
  const resizeRoom = useCallback(
    async (
      roomIndex: number,
      targetPlotXIn: number,
      targetPlotYIn: number,
      targetWIn: number,
      targetDIn: number
    ) => {
      if (!meta) return;
      const envX0 = meta.envelope_origin_x_in;
      const envZ0 = meta.envelope_origin_z_in;

      const resizedId = getRoomId(roomList[roomIndex], roomIndex);
      savedPositionsRef.current.set(resizedId, {
        x_in: Math.max(0, targetPlotXIn - envX0),
        y_in: Math.max(0, targetPlotYIn - envZ0),
      });

      const nextRoomList: (RoomName | RoomSpecIn)[] = roomList.map((r, i) => {
        if (i !== roomIndex) return r;
        if (typeof r === "string") {
          // r is just a RoomName string — wrap into a RoomSpecIn with new dims
          return { name: r as RoomName, custom_w_in: targetWIn, custom_d_in: targetDIn } as RoomSpecIn;
        }
        return { ...r, custom_w_in: targetWIn, custom_d_in: targetDIn };
      });

      const nextPrev: PrevRoomIn[] = [];
      roomList.forEach((r, i) => {
        const id = getRoomId(r, i);
        const saved = savedPositionsRef.current.get(id);
        if (saved) {
          nextPrev.push({
            index: i,
            x_in: saved.x_in,
            y_in: saved.y_in,
          });
        }
      });

      // Optimistically update on-screen position and dimensions immediately
      setRooms((prevRooms) =>
        prevRooms.map((r, i) =>
          i === roomIndex
            ? { ...r, x_in: targetPlotXIn, y_in: targetPlotYIn, w_in: targetWIn, d_in: targetDIn }
            : r
        )
      );

      setPending(true);
      try {
        const res = await requestSolve({
          plotWIn,
          plotDIn,
          facing,
          rooms: nextRoomList,
          setback,
          prev: nextPrev,
          movedIndex: roomIndex,
        });
        setRooms(res.rooms);
        setMeta(res.meta);
        setError(null);

        res.rooms.forEach((r, i) => {
          if (i < roomList.length) {
            const id = getRoomId(roomList[i], i);
            savedPositionsRef.current.set(id, {
              x_in: r.x_in - res.meta.envelope_origin_x_in,
              y_in: r.y_in - res.meta.envelope_origin_z_in,
            });
          }
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [meta, plotWIn, plotDIn, facing, roomList, setback]
  );

  const resetPositions = useCallback(() => {
    savedPositionsRef.current.clear();
  }, []);

  return { rooms, meta, pending, error, staleBackend, moveRoom, resizeRoom, resetPositions };
}
