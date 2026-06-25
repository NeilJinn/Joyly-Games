import { activePlayers, activePlayerIds } from "../../../server/players/status.js";
import { getDirectorStep, getDirectorMessage, getDirectorTimerMs } from "./director.js";

export const QUESTION_COUNT_OPTIONS = [5, 8, 10, 12];
export const DEFAULT_QUESTION_COUNT = 8;

export function stateKey(room) {
  return room.gameState ||= {};
}

export function testerKey(room) {
  const state = stateKey(room);
  return state.tester ||= { selectedPlayerId: null };
}

export function playerStateMap(room) {
  return stateKey(room).playerStates ||= {};
}

export function playerState(room, playerId) {
  const map = playerStateMap(room);
  map[playerId] ||= {
    preferences: { categories: [], tags: [] },
    preferencesLocked: false
  };
  return map[playerId];
}

export function playerList(room) {
  return [...room.players.values()].map(player => ({
    ...player,
    ...playerState(room, player.id)
  }));
}

export function currentQuestion(room) {
  const state = stateKey(room);
  const questions = room.gameContent?.questions || [];
  return questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
}

export function answerCount(room) {
  return Object.keys(stateKey(room).answers || {}).length;
}

export function readyPreferenceCount(room) {
  return activePlayers(room).filter(player => playerState(room, player.id).preferencesLocked).length;
}

export function getQuestionCount(room) {
  const state = stateKey(room);
  const configured = Number(state.questionCount || 0);
  if (QUESTION_COUNT_OPTIONS.includes(configured)) return configured;
  return DEFAULT_QUESTION_COUNT;
}

export function totalQuestionCount(room) {
  const state = stateKey(room);
  return room.gameContent?.questions?.length || state.questionCount || DEFAULT_QUESTION_COUNT;
}

export function hiddenQuestionCount(totalQuestions) {
  if (totalQuestions <= 0) return 0;
  return Math.max(1, Math.ceil(totalQuestions * 0.3));
}

export function hiddenStartIndex(totalQuestions) {
  return Math.max(0, totalQuestions - hiddenQuestionCount(totalQuestions));
}

export function syncQuestionFlags(room) {
  const state = stateKey(room);
  const totalQuestions = totalQuestionCount(room);
  state.totalQuestions = totalQuestions;
  state.isFirstQuestion = (state.questionIndex || 0) === 0;
  state.isFinalQuestion = totalQuestions > 0 && (state.questionIndex || 0) >= totalQuestions - 1;
  state.isLastThirtyPercent = totalQuestions > 0 && (state.questionIndex || 0) >= hiddenStartIndex(totalQuestions);

  if (state.isLastThirtyPercent) {
    state.scoreVisibility = "hidden";
    state.leaderboardFrozen = true;
  } else {
    state.scoreVisibility = "visible";
    state.leaderboardFrozen = false;
  }
}

export function clearTesterTimer(room) {
  const state = stateKey(room);
  state.phaseDurationOverrideMs = null;
  state.phaseEndsAtOverride = null;
  state.phaseTimerStartedAt = null;
}

export function bumpPrivateStateVersion(room) {
  const state = stateKey(room);
  state.privateStateVersion = Number(state.privateStateVersion || 0) + 1;
}

export function buildDirectorContext(room, extra = {}) {
  const state = stateKey(room);
  const totalQuestions = totalQuestionCount(room);
  const finalHypeSummaries = Array.isArray(state.finalHypeSummaries) ? state.finalHypeSummaries : [];
  const finalHypeIndex = Number(state.finalHypeIndex || 0);
  return {
    roomCode: room.code,
    playCount: state.playCount || 1,
    questionIndex: state.questionIndex || 0,
    questionId: currentQuestion(room)?.id || "",
    totalQuestions,
    questionCount: state.questionCount || totalQuestions,
    isLastQuestion: totalQuestions > 0 && (state.questionIndex || 0) >= totalQuestions - 1,
    isFirstQuestion: (state.questionIndex || 0) === 0,
    isLastThirtyPercent: Boolean(state.isLastThirtyPercent),
    scoreVisibility: state.scoreVisibility || "visible",
    leaderboardFrozen: Boolean(state.leaderboardFrozen),
    lastResolution: state.lastResolution || null,
    finalHype: {
      summaries: finalHypeSummaries,
      index: finalHypeIndex,
      current: finalHypeSummaries[finalHypeIndex] || null,
      remaining: Math.max(0, finalHypeSummaries.length - finalHypeIndex - 1)
    },
    hasMoreFinalHype: finalHypeIndex < finalHypeSummaries.length - 1,
    ...extra
  };
}

export function phaseTiming(room) {
  const state = stateKey(room);
  const step = getDirectorStep(state.phase) || null;
  const baseDurationMs = getDirectorTimerMs(state.phase, buildDirectorContext(room));
  const durationMs = state.phaseDurationOverrideMs ?? baseDurationMs;
  const startedAt = state.phaseTimerStartedAt || state.phaseStartedAt;
  const endsAt = state.phaseEndsAtOverride || (durationMs != null ? startedAt + durationMs : null);
  const remainingMs = endsAt != null ? Math.max(0, endsAt - Date.now()) : null;

  return { step, baseDurationMs, durationMs, startedAt, endsAt, remainingMs };
}

export function shouldShowAnswer(state) {
  return ["reveal", "scoring", "between-questions", "final-hype", "finale", "post-game"].includes(state.phase);
}

export function shouldShowPublicScores(state) {
  if (state.phase === "post-game") return true;
  return state.scoreVisibility !== "hidden";
}

export function publicQuestion(question, state) {
  if (!question) return null;
  return {
    id: question.id,
    category: question.category,
    tags: question.tags,
    difficulty: question.difficulty,
    question: question.question,
    answers: question.answers,
    questionAudio: question.questionAudio,
    correctAnswer: shouldShowAnswer(state) ? question.correctAnswer : null,
    fact: shouldShowAnswer(state) ? question.fact : ""
  };
}

export function rankPlayersByScore(room, scores, previousOrder = null) {
  return [...room.players.values()]
    .sort((a, b) => {
      const scoreDiff = (scores[b.id] || 0) - (scores[a.id] || 0);
      if (scoreDiff) return scoreDiff;
      if (previousOrder?.has(a.id) && previousOrder?.has(b.id)) {
        return (previousOrder.get(a.id) || 0) - (previousOrder.get(b.id) || 0);
      }
      if (previousOrder?.has(a.id)) return -1;
      if (previousOrder?.has(b.id)) return 1;
      const joinedDiff = Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      if (joinedDiff) return joinedDiff;
      return String(a.id).localeCompare(String(b.id));
    })
    .map(player => player.id);
}

export function publicCosmicTriviaState(room) {
  if (!room.gameState) return null;
  const state = stateKey(room);
  const question = currentQuestion(room);
  const timing = phaseTiming(room);
  const showPublicScores = shouldShowPublicScores(state);

  return {
    playCount: state.playCount || 1,
    questionCount: state.questionCount || DEFAULT_QUESTION_COUNT,
    questionCountOptions: state.questionCountOptions || [...QUESTION_COUNT_OPTIONS],
    questionIndex: state.questionIndex || 0,
    totalQuestions: totalQuestionCount(room),
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseDurationMs: timing.durationMs || 0,
    phaseEndsAt: timing.endsAt,
    remainingMs: timing.remainingMs || 0,
    directorMessage: getDirectorMessage(state.phase, buildDirectorContext(room)),
    currentQuestion: publicQuestion(question, state),
    scores: showPublicScores ? { ...(state.scores || {}) } : {},
    scoreVisibility: state.phase === "post-game" ? "visible" : (state.scoreVisibility || "visible"),
    leaderboardFrozen: Boolean(state.leaderboardFrozen && state.phase !== "post-game"),
    scoreboardVisible: showPublicScores,
    answersCount: answerCount(room),
    answeredPlayerIds: Object.keys(state.answers || {}),
    preferencesCount: readyPreferenceCount(room),
    expectedAnswerCount: activePlayers(room).length,
    expectedPreferenceCount: activePlayers(room).length,
    preferencePlayerIds: activePlayerIds(room).filter(playerId => playerState(room, playerId).preferencesLocked),
    topCategories: state.topCategories || [],
    upcomingAudioUrls: ["interest-reveal", "round-prep"].includes(state.phase)
      ? (state.roundPreloadManifest || [])
      : [],
    playerStates: playerStateMap(room),
    tester: { selectedPlayerId: state.tester?.selectedPlayerId || null },
    questionOptions: room.gameContent?.options || null,
    selectedQuestionIds: room.gameContent?.selection?.map(entry => entry.id) || [],
    lastResolution: state.lastResolution || null,
    isFirstQuestion: Boolean(state.isFirstQuestion),
    isFinalQuestion: Boolean(state.isFinalQuestion),
    isLastThirtyPercent: Boolean(state.isLastThirtyPercent),
    finalHype: {
      index: state.finalHypeIndex || 0,
      total: state.finalHypeSummaries?.length || 0,
      current: state.finalHypeSummaries?.[state.finalHypeIndex || 0] || null,
      remaining: Math.max(0, (state.finalHypeSummaries?.length || 0) - (state.finalHypeIndex || 0) - 1)
    },
    privateStateVersion: state.privateStateVersion || 0
  };
}

export function privateCosmicTriviaState(room, playerId) {
  const state = stateKey(room);
  return {
    playerId,
    phase: state.phase,
    personalScore: state.scores?.[playerId] || 0,
    scoreVisibility: state.scoreVisibility || "visible",
    hiddenScoreMode: state.scoreVisibility === "hidden" && state.phase !== "post-game",
    version: state.privateStateVersion || 0
  };
}
