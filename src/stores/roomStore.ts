import { create } from "zustand";
import type { Room, Player } from "../types/room";

interface RoomState {
  room: Room | null;
  setRoom: (room: Room) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, ready: boolean) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;
      const exists = state.room.players.some((p) => p.id === player.id);
      const players = exists
        ? state.room.players.map((p) => (p.id === player.id ? player : p))
        : [...state.room.players, player];
      return { room: { ...state.room, players } };
    }),
  removePlayer: (playerId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== playerId),
        },
      };
    }),
  setPlayerReady: (playerId, ready) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, ready } : p
          ),
        },
      };
    }),
  clearRoom: () => set({ room: null }),
}));
