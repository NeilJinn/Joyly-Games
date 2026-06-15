export type RoomStatus = "waiting" | "playing" | "complete";

export interface Player {
  id: string;
  nickname: string;
  avatarKey: string;
  ready: boolean;
  connected: boolean;
}

export interface Room {
  code: string;
  status: RoomStatus;
  players: Player[];
  selectedGameId: string | null;
  hostEmail: string | null;
}
