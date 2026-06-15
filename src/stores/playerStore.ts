import { create } from "zustand";

type JoinStatus = "idle" | "joining" | "joined" | "error";

interface PlayerState {
  playerId: string | null;
  nickname: string;
  avatarKey: string;
  joinStatus: JoinStatus;
  joinError: string;
  setIdentity: (playerId: string, nickname: string, avatarKey: string) => void;
  setJoinStatus: (status: JoinStatus, error?: string) => void;
  clearIdentity: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playerId: null,
  nickname: "",
  avatarKey: "",
  joinStatus: "idle",
  joinError: "",
  setIdentity: (playerId, nickname, avatarKey) =>
    set({ playerId, nickname, avatarKey, joinStatus: "joined", joinError: "" }),
  setJoinStatus: (status, error = "") =>
    set({ joinStatus: status, joinError: error }),
  clearIdentity: () =>
    set({
      playerId: null,
      nickname: "",
      avatarKey: "",
      joinStatus: "idle",
      joinError: "",
    }),
}));
