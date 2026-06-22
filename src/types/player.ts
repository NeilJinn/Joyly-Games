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
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for HTTP (non-secure context) where randomUUID is unavailable
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((b, i) =>
    [4, 6, 8, 10].includes(i) ? `-${b.toString(16).padStart(2, "0")}` : b.toString(16).padStart(2, "0")
  ).join("");
}
