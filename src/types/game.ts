export type GamePhase =
  | "deck-selecting"
  | "interest-selecting"
  | "preferences-locked"
  | "question-intro"
  | "question-audio"
  | "answering"
  | "scoring"
  | "next-question"
  | "complete";

export interface AnswerOption {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  answers: AnswerOption[];
  correctAnswer: string;
  questionAudioPath: string | null;
}

export interface ScoreEntry {
  playerId: string;
  score: number;
  delta: number;
  correct: boolean;
}
