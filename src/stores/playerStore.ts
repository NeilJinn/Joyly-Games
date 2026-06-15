import { create } from "zustand";
import type { PlayerIdentity } from "../types/player";
import { loadPlayerIdentity, savePlayerIdentity } from "../types/player";

interface PlayerState {
  playerId: string | null;
  nickname: string;
  joinStatus: "idle" | "joining" | "joined" | "error";
  joinError: string;
  setPlayer: (identity: PlayerIdentity) => void;
  setJoinStatus: (status: "idle" | "joining" | "joined" | "error", error?: string) => void;
  clearPlayer: () => void;
  loadFromStorage: () => PlayerIdentity | null;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playerId: null,
  nickname: "",
  joinStatus: "idle",
  joinError: "",
  setPlayer: (identity) => {
    savePlayerIdentity(identity);
    set({ playerId: identity.playerId, nickname: identity.nickname, joinStatus: "joined", joinError: "" });
  },
  setJoinStatus: (status, error = "") =>
    set({ joinStatus: status, joinError: error }),
  clearPlayer: () =>
    set({ playerId: null, nickname: "", joinStatus: "idle", joinError: "" }),
  loadFromStorage: () => loadPlayerIdentity(),
}));
