import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

const PAIRING_TOKEN_KEY = "joylyActivePairingToken";
const PAIRED_KEY = "joylyControllerPaired";
const POLL_MS = 2_000;

export type PairingPhase = "waiting" | "claimed";

export interface PairingState {
  token: string;
  url: string;
  code: string;
  phase: PairingPhase;
}

interface PairingPollResponse {
  account?: { name: string; email: string };
  room?: Room;
}

interface HostRoomResponse {
  room?: Room | null;
}

export function usePairing(baseUrl: string | null): PairingState | null {
  const navigate = useNavigate();
  const account = useAuthStore((s) => s.account);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const setAccount = useAuthStore((s) => s.setAccount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [pairing, setPairing] = useState<PairingState | null>(() => {
    // Restore "claimed" phase if the page was refreshed while waiting for the phone to create a room
    const token = localStorage.getItem(PAIRING_TOKEN_KEY);
    const paired = localStorage.getItem(PAIRED_KEY) === "true";
    if (token && paired) {
      return { token, url: "", code: token.toUpperCase(), phase: "claimed" };
    }
    return null;
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claimedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resolvePairing = useCallback(
    (room: Room) => {
      localStorage.removeItem(PAIRING_TOKEN_KEY);
      localStorage.removeItem(PAIRED_KEY);
      stopPolling();
      setRoom(room);
      setPairing(null);
      navigate(`/room/${room.code}`);
    },
    [navigate, setRoom, stopPolling],
  );

  // Effect 1: Create a new pairing token when none exists and not signed in
  useEffect(() => {
    if (isSignedIn || baseUrl === null || pairing !== null) return;
    let cancelled = false;

    async function create() {
      try {
        const res = await fetch("/api/pairings", { method: "POST" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token: string };
        if (!data.token || cancelled) return;
        const token = data.token;
        localStorage.setItem(PAIRING_TOKEN_KEY, token);
        claimedRef.current = false;
        setPairing({ token, url: `${baseUrl}/?pair=${token}`, code: token.toUpperCase(), phase: "waiting" });
      } catch {
        // best-effort — pairing is non-critical
      }
    }

    void create();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, baseUrl, pairing]);

  // Effect 2: Poll pairing endpoint until phone claims the token (phase: "waiting")
  useEffect(() => {
    if (!pairing?.token || pairing.phase !== "waiting") return;
    const token = pairing.token;

    pollRef.current = setInterval(async () => {
      if (claimedRef.current) return;
      try {
        const res = await fetch(`/api/pairings/${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const data = (await res.json()) as PairingPollResponse;
        if (!data.account) return;
        if (claimedRef.current) return; // race guard
        claimedRef.current = true;
        stopPolling();

        setAccount({ displayName: data.account.name, email: data.account.email });
        localStorage.setItem(PAIRED_KEY, "true");

        if (data.room) {
          resolvePairing(data.room);
        } else {
          setPairing((p) => (p ? { ...p, phase: "claimed" } : null));
        }
      } catch {
        // retry on next tick
      }
    }, POLL_MS);

    return stopPolling;
  }, [pairing?.token, pairing?.phase, setAccount, resolvePairing, stopPolling]);

  // Effect 3: Poll host room after phone claims — wait for phone to create a room (phase: "claimed")
  const accountEmail = account?.email;
  useEffect(() => {
    if (!pairing || pairing.phase !== "claimed" || !accountEmail) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/hosts/${encodeURIComponent(accountEmail)}/room`);
        if (!res.ok) return;
        const data = (await res.json()) as HostRoomResponse;
        if (!data.room) return;
        resolvePairing(data.room);
      } catch {
        // retry
      }
    }, POLL_MS);

    return stopPolling;
  }, [pairing?.phase, accountEmail, resolvePairing, stopPolling]);

  // During "claimed" phase, keep returning pairing state even though isSignedIn is now true
  // so HomePage can display the "waiting for phone to create room" card
  if (!isSignedIn || pairing?.phase === "claimed") return pairing;
  return null;
}
