export interface GameConfig {
  id: string;
  name: string;
  playable: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export interface AppConfig {
  games: GameConfig[];
  localJoinBase: string;
  tools: {
    jmsStudio: boolean;
    voiceLibrary: boolean;
  };
}
