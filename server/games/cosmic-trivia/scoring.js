import { activePlayers } from "../../players/status.js";
import { stateKey, currentQuestion, answerCount } from "./state.js";

export function pushQuestionHistory(state, entry) {
  state.questionHistory ||= [];
  if (state.questionHistory.some(item => item.questionId === entry.questionId)) return;
  state.questionHistory.push(entry);
}

export function finalizeCurrentQuestion(room) {
  const state = stateKey(room);
  const question = currentQuestion(room);
  if (!question || state.scoredQuestionId === question.id) {
    return state.lastResolution || null;
  }

  const winners = [];
  for (const [playerId, choice] of Object.entries(state.answers || {})) {
    if (choice === question.correctAnswer) {
      state.scores[playerId] = (state.scores[playerId] || 0) + 100;
      winners.push(playerId);
    }
  }

  state.scoredQuestionId = question.id;
  const resolution = {
    questionId: question.id,
    questionText: question.question,
    correctAnswer: question.correctAnswer,
    rewardCount: winners.length,
    answeredCount: answerCount(room),
    winnerIds: winners,
    everyoneCorrect: winners.length > 0 && winners.length === activePlayers(room).length,
    noOneCorrect: winners.length === 0,
    scoredAt: Date.now()
  };
  state.lastResolution = resolution;
  pushQuestionHistory(state, resolution);
  return resolution;
}
