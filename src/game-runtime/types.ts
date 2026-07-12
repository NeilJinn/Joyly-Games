import type { ComponentType } from "react";
import type { Room } from "../types/room";

/** Context supplied by Joyly's platform shell to a game package. */
export interface GameRuntimeContext {
  room?: Room;
  code: string;
  playerId?: string | null;
  embedded?: boolean;
  isHost?: boolean;
}

export type GamePhoneEntry = ComponentType<GameRuntimeContext>;
export type GameBigScreenEntry = ComponentType<Pick<GameRuntimeContext, "room" | "code">>;

export interface GamePackage {
  id: string;
  title: string;
  phone: GamePhoneEntry;
  bigScreen: GameBigScreenEntry;
}
