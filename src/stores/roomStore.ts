import { create } from "zustand";
import type { Room } from "../types/room";

interface RoomState {
  room: Room | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null }),
}));
