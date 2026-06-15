export type CosmicTriviaPhase =
  | "game-setup"
  | "preferences"
  | "round-prep"
  | "question-intro"
  | "question-read"
  | "answering"
  | "answer-lock"
  | "reveal"
  | "scoring"
  | "between-questions"
  | "final-hype"
  | "finale"
  | "post-game";

export interface CosmicAnswer {
  id: string;
  text: string;
}

export interface CosmicQuestion {
  id: string;
  question: string;
  answers: CosmicAnswer[];
  correctAnswer: string | null;
  fact: string;
  category: string;
}

export interface CosmicPlayerState {
  preferences: { categories: string[]; tags: string[] };
  preferencesLocked: boolean;
}

export interface CosmicLastResolution {
  correctAnswerId: string;
  fact: string;
  rewards: Record<string, number>;
}

export interface CosmicFinalHype {
  current: { text: string } | null;
}

export interface CosmicTriviaState {
  phase: CosmicTriviaPhase;
  phaseEndsAt: number | null;
  questionIndex: number;
  questionCount: number;
  questionCountOptions: number[];
  currentQuestion: CosmicQuestion | null;
  scores: Record<string, number>;
  scoreVisibility: "visible" | "hidden";
  scoreboardVisible: boolean;
  answeredPlayerIds: string[];
  expectedAnswerCount: number;
  preferencePlayerIds: string[];
  expectedPreferenceCount: number;
  playerStates: Record<string, CosmicPlayerState>;
  questionOptions: { categories: string[]; tags: string[] } | null;
  lastResolution: CosmicLastResolution | null;
  finalHype: CosmicFinalHype | null;
  isFinalQuestion: boolean;
}

export interface CosmicPrivateState {
  personalScore: number;
  hiddenScoreMode: boolean;
  scoreVisibility: "visible" | "hidden";
}

export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
