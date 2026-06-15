import type { AvatarSelection } from "./avatar";

export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  avatar: AvatarSelection | null;
}

export interface PlayerPayload {
  playerId: string;
  nickname: string;
  avatar: AvatarSelection | null;
}

export const PLAYER_IDENTITY_KEY = "joylyPlayerIdentity";

export function loadPlayerIdentity(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(PLAYER_IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as PlayerIdentity) : null;
  } catch {
    return null;
  }
}

export function savePlayerIdentity(identity: PlayerIdentity): void {
  localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
}

export function makePlayerId(): string {
  return crypto.randomUUID();
}
