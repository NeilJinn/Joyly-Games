export interface GameConfig {
  id: string;
  title: string;
  genre: string;
  players: string;
  minPlayers: number;
  maxPlayers: number;
  mood: string;
  status: "playable" | "coming-soon";
  description: string;
  price?: number;
  credits?: number;
  clientModule?: string;
}

export interface AppConfig {
  games: GameConfig[];
  localJoinBase: string;
  tools: {
    voiceLibrary: boolean;
  };
}
