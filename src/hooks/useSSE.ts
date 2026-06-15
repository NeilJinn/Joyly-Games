import { useEffect, useRef } from "react";
import { useSSEStore } from "../stores/sseStore";
import { useRoomStore } from "../stores/roomStore";
import { useGameStore } from "../stores/gameStore";
import type { Room, Player } from "../types/room";
import type { GamePhase, Question, ScoreEntry } from "../types/game";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useSSE(roomCode: string | null) {
  const setStatus = useSSEStore((s) => s.setStatus);
  const recordEvent = useSSEStore((s) => s.recordEvent);
  const setRoom = useRoomStore((s) => s.setRoom);
  const addPlayer = useRoomStore((s) => s.addPlayer);
  const removePlayer = useRoomStore((s) => s.removePlayer);
  const setPlayerReady = useRoomStore((s) => s.setPlayerReady);
  const setPhase = useGameStore((s) => s.setPhase);
  const setQuestion = useGameStore((s) => s.setQuestion);
  const setScores = useGameStore((s) => s.setScores);
  const recordAnswer = useGameStore((s) => s.recordAnswer);

  const retryCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      es = new EventSource(`/api/room/${roomCode}/events`);

      es.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCount.current = 0;
      };

      es.onmessage = (evt) => {
        if (cancelled) return;
        recordEvent();
        try {
          const msg = JSON.parse(evt.data) as { type: string; payload: unknown };
          routeEvent(msg.type, msg.payload);
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

    function routeEvent(type: string, payload: unknown) {
      switch (type) {
        case "room-update":
          setRoom(payload as Room);
          break;
        case "player-joined":
          addPlayer(payload as Player);
          break;
        case "player-left":
          removePlayer((payload as { id: string }).id);
          break;
        case "player-ready":
          setPlayerReady(
            (payload as { id: string; ready: boolean }).id,
            (payload as { id: string; ready: boolean }).ready
          );
          break;
        case "game-phase":
          setPhase((payload as { phase: GamePhase }).phase);
          break;
        case "game-question":
          setQuestion(
            (payload as { question: Question; nextAudioPath?: string }).question,
            (payload as { question: Question; nextAudioPath?: string })
              .nextAudioPath
          );
          break;
        case "game-scores":
          setScores(payload as ScoreEntry[]);
          break;
        case "game-answer":
          recordAnswer(
            (payload as { playerId: string; answerKey: string }).playerId,
            (payload as { playerId: string; answerKey: string }).answerKey
          );
          break;
        default:
          break;
      }
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
