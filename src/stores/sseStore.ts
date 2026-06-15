import { create } from "zustand";

type SSEStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface SSEState {
  status: SSEStatus;
  lastEventAt: number | null;
  setStatus: (status: SSEStatus) => void;
  recordEvent: () => void;
}

export const useSSEStore = create<SSEState>()((set) => ({
  status: "idle",
  lastEventAt: null,
  setStatus: (status) => set({ status }),
  recordEvent: () => set({ lastEventAt: Date.now() }),
}));
