import type { GameConfig } from "./config";

export type RoomStatus = "waiting" | "playing" | "complete" | "closed";

export interface Avatar {
  [key: string]: unknown;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: Avatar | null;
  online: boolean;
  ready: boolean;
  lastSeen?: number;
}

export interface RoomEntitlement {
  type: string;
  minutes?: number;
  expiresAt?: number;
  purchased?: number;
  spent?: number;
  remaining?: number;
}

export interface RoomHost {
  name: string;
  email: string;
}

export interface Room {
  code: string;
  host: RoomHost;
  players: Player[];
  status: RoomStatus;
  selectedGame: GameConfig | null;
  paymentMode: string;
  entitlement: RoomEntitlement;
  launchCountdown: { endsAt: number } | null;
  gameSetup: unknown;
  gameState: unknown;
  createdAt: number;
}
