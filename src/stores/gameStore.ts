import { create } from "zustand";
import type { GamePhase, Question, ScoreEntry } from "../types/game";

interface GameState {
  phase: GamePhase | null;
  currentQuestion: Question | null;
  scores: ScoreEntry[];
  answers: Record<string, string>;
  selectedAnswer: string | null;
  questionAudioPath: string | null;
  nextQuestionAudioPath: string | null;
  setPhase: (phase: GamePhase) => void;
  setQuestion: (question: Question, nextAudioPath?: string | null) => void;
  setScores: (scores: ScoreEntry[]) => void;
  recordAnswer: (playerId: string, answerKey: string) => void;
  setSelectedAnswer: (key: string) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  phase: null,
  currentQuestion: null,
  scores: [],
  answers: {},
  selectedAnswer: null,
  questionAudioPath: null,
  nextQuestionAudioPath: null,
  setPhase: (phase) => set({ phase }),
  setQuestion: (question, nextAudioPath = null) =>
    set({
      currentQuestion: question,
      questionAudioPath: question.questionAudioPath,
      nextQuestionAudioPath: nextAudioPath,
      answers: {},
      selectedAnswer: null,
    }),
  setScores: (scores) => set({ scores }),
  recordAnswer: (playerId, answerKey) =>
    set((state) => ({
      answers: { ...state.answers, [playerId]: answerKey },
    })),
  setSelectedAnswer: (key) => set({ selectedAnswer: key }),
  clearGame: () =>
    set({
      phase: null,
      currentQuestion: null,
      scores: [],
      answers: {},
      selectedAnswer: null,
      questionAudioPath: null,
      nextQuestionAudioPath: null,
    }),
}));
