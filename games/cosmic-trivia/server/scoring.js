import { activePlayers } from "../../../server/players/status.js";
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

  // Update per-player consecutive correct/wrong streaks for answered players only.
  state.playerStreaks ||= {};
  state.playerWrongStreaks ||= {};
  for (const [playerId, choice] of Object.entries(state.answers || {})) {
    if (choice === question.correctAnswer) {
      state.playerStreaks[playerId] = (state.playerStreaks[playerId] || 0) + 1;
      state.playerWrongStreaks[playerId] = 0;
    } else {
      state.playerStreaks[playerId] = 0;
      state.playerWrongStreaks[playerId] = (state.playerWrongStreaks[playerId] || 0) + 1;
    }
  }

  // Players with 2+ consecutive correct answers after this question.
  const streakPlayers = Object.entries(state.playerStreaks)
    .filter(([, streak]) => streak >= 2)
    .map(([id, streak]) => ({ id, streak }));


  // Players with 2+ consecutive wrong answers after this question.
  const wrongStreakPlayers = Object.entries(state.playerWrongStreaks)
    .filter(([, streak]) => streak >= 2)
    .map(([id, streak]) => ({ id, streak }));

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
    scoredAt: Date.now(),
    ...(streakPlayers.length > 0 && { streakPlayers }),
    ...(wrongStreakPlayers.length > 0 && { wrongStreakPlayers })
  };
  state.lastResolution = resolution;
  pushQuestionHistory(state, resolution);
  return resolution;
}
