import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../stores/authStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

export interface PairingState {
  token: string;
  url: string;
  code: string;
}

interface PairingPollResponse {
  account?: { name: string; email: string };
  room?: Room;
  paired?: boolean;
}

const POLL_INTERVAL_MS = 2_000;

export function usePairing(): PairingState | null {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const setAccount = useAuthStore((s) => s.setAccount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [pairing, setPairing] = useState<PairingState | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn) return;

    let cancelled = false;

    async function createPairing() {
      try {
        const res = await fetch("/api/pairings", { method: "POST" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token: string };
        if (!data.token || cancelled) return;
        const token = data.token;
        const url = `${window.location.origin}/?pair=${token}`;
        setPairing({ token, url, code: token.toUpperCase() });
      } catch {
        // Silently ignore — desktop pairing is best-effort
      }
    }

    void createPairing();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  useEffect(() => {
    if (!pairing?.token || isSignedIn) return;

    pollingRef.current = setInterval(async () => {
      if (claimedRef.current) return;
      try {
        const res = await fetch(`/api/pairings/${encodeURIComponent(pairing.token)}`);
        if (!res.ok) return;
        const data = (await res.json()) as PairingPollResponse;
        if (!data.account) return;
        claimedRef.current = true;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setAccount({ displayName: data.account.name, email: data.account.email });
        if (data.room) setRoom(data.room);
        setPairing(null);
      } catch {
        // Polling errors are silent — will retry on next interval
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pairing?.token, isSignedIn, setAccount, setRoom]);

  return pairing;
}
