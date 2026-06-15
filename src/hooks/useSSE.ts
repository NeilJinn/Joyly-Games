import { useEffect, useRef } from "react";
import { useSSEStore } from "../stores/sseStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useSSE(roomCode: string | null) {
  const setStatus = useSSEStore((s) => s.setStatus);
  const recordEvent = useSSEStore((s) => s.recordEvent);
  const setRoom = useRoomStore((s) => s.setRoom);

  const retryCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      es = new EventSource(`/api/events/${roomCode}`);

      es.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCount.current = 0;
      };

      es.onmessage = (evt) => {
        if (cancelled) return;
        recordEvent();
        try {
          const msg = JSON.parse(evt.data) as { type: string; room?: Room };
          if (msg.type === "room" && msg.room) {
            setRoom(msg.room);
          }
        } catch {
          // malformed event — ignore
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        const delay =
          RECONNECT_DELAYS[
            Math.min(retryCount.current, RECONNECT_DELAYS.length - 1)
          ];
        retryCount.current += 1;
        setStatus("reconnecting");
        timeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      es?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStatus("idle");
    };
  }, [roomCode]);
}
