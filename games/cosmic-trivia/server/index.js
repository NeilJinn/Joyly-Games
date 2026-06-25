import { getQuestionOptions } from "./content-loader.js";
import { activePlayers } from "../../../server/players/status.js";
import {
  stateKey,
  testerKey,
  playerState,
  answerCount,
  readyPreferenceCount,
  bumpPrivateStateVersion,
  buildDirectorContext,
  clearTesterTimer,
  QUESTION_COUNT_OPTIONS,
  publicCosmicTriviaState,
  privateCosmicTriviaState
} from "./state.js";
import {
  enterPhase,
  directorDelay,
  advanceCosmicTrivia,
  createCosmicTriviaState,
  ensureCosmicTriviaState,
  isPhaseTimerComplete,
  markDirectorAudioComplete,
  markDirectorAudioStarted,
  markDirectorAudioStatus
} from "./flow.js";
import { finalizeCurrentQuestion } from "./scoring.js";
import { markQuestionAnswered } from "./question-history.js";
import { getDirectorMessage, getDirectorStep } from "./director.js";

const ALL_ANSWERED_GRACE_MS = 1_800;

export { createCosmicTriviaState, ensureCosmicTriviaState, publicCosmicTriviaState, privateCosmicTriviaState, advanceCosmicTrivia, directorDelay };

export async function setCosmicTriviaSetup(room, settings = {}) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (state.phase !== "game-setup") return { status: 409, error: "Game setup is closed" };

  const nextCount = Number(settings.questionCount || settings.roundSize || 0);
  if (!QUESTION_COUNT_OPTIONS.includes(nextCount)) {
    return { status: 400, error: "Invalid question count" };
  }

  state.questionCount = nextCount;
  state.totalQuestions = nextCount;
  enterPhase(room, "preferences");
  bumpPrivateStateVersion(room);
  return { status: 200 };
}

export async function setCosmicTriviaPreferences(room, playerId, preferences = {}) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (state.phase !== "preferences") return { status: 409, error: "Topic selection is closed" };

  const player = room.players.get(playerId);
  if (!player) return { status: 404, error: "Player not found" };
  const stateEntry = playerState(room, playerId);

  const options = room.gameContent?.options || await getQuestionOptions("core");
  const categorySet = new Set(options.categories || []);
  const tagSet = new Set(options.tags || []);
  const categories = [...new Set(preferences.categories || [])].filter(item => categorySet.has(item)).slice(0, 3);
  const tags = [...new Set(preferences.tags || [])].filter(item => tagSet.has(item)).slice(0, 5);
  const preview = Boolean(preferences.preview);

  stateEntry.preferences = { categories, tags };
  if (!preview) stateEntry.preferencesLocked = true;

  bumpPrivateStateVersion(room);
  return {
    status: 200,
    allSelected: !preview && readyPreferenceCount(room) >= activePlayers(room).length
  };
}

export async function restartCosmicTrivia(room) {
  await createCosmicTriviaState(room);
}

export async function answerCosmicTrivia(room, playerId, choice) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (state.phase !== "answering") return { status: 409, error: "Answering is closed" };

  const player = room.players.get(playerId);
  const questions = room.gameContent?.questions || [];
  const question = questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
  if (!player) return { status: 404, error: "Player not found" };
  if (!question?.answers?.some(answer => answer.id === choice)) {
    return { status: 400, error: "Invalid answer" };
  }

  state.answers[playerId] = choice;

  if (answerCount(room) >= activePlayers(room).length && !state.phaseEndsAtOverride) {
    state.phaseTimerStartedAt = Date.now();
    state.phaseDurationOverrideMs = ALL_ANSWERED_GRACE_MS;
    state.phaseEndsAtOverride = state.phaseTimerStartedAt + state.phaseDurationOverrideMs;
  }

  bumpPrivateStateVersion(room);
  return { status: 200, allAnswered: answerCount(room) >= activePlayers(room).length };
}

export async function setCosmicTriviaTesterSelection(room, playerId = null) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const tester = testerKey(room);
  if (playerId) {
    const player = room.players.get(String(playerId));
    if (!player) return { status: 404, error: "Player not found" };
    tester.selectedPlayerId = player.id;
  } else {
    tester.selectedPlayerId = null;
  }

  state.director = {
    mode: "manual",
    message: state.director?.message || getDirectorMessage(state.phase, buildDirectorContext(room))
  };

  bumpPrivateStateVersion(room);
  return { status: 200 };
}

export async function setCosmicTriviaTesterTimer(room, seconds = 0) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const nextSeconds = Math.max(0, Number(seconds) || 0);
  state.phaseTimerStartedAt = Date.now();
  state.phaseDurationOverrideMs = nextSeconds * 1000;
  state.phaseEndsAtOverride = state.phaseTimerStartedAt + state.phaseDurationOverrideMs;
  state.director = {
    mode: "manual",
    message: state.director?.message || getDirectorMessage(state.phase, buildDirectorContext(room))
  };
  bumpPrivateStateVersion(room);
  return { status: 200 };
}

export async function testerAnswerCorrect(room, playerId) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (state.phase !== "answering") return { status: 409, error: "Not in answering phase" };
  const player = room.players.get(String(playerId || ""));
  if (!player) return { status: 404, error: "Player not found" };
  const questions = room.gameContent?.questions || [];
  const question = questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
  if (!question?.correctAnswer) return { status: 409, error: "No correct answer available" };
  return answerCosmicTrivia(room, player.id, question.correctAnswer);
}

export async function addCosmicTriviaTesterScore(room, playerId, points = 0) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const selectedPlayerId = String(playerId || testerKey(room).selectedPlayerId || "");
  const player = room.players.get(selectedPlayerId);
  const delta = Number(points) || 0;
  if (!player) return { status: 404, error: "Player not found" };
  state.scores[player.id] = (state.scores[player.id] || 0) + delta;
  bumpPrivateStateVersion(room);
  return { status: 200, score: state.scores[player.id] };
}

export async function completeCosmicTrivia(room) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const questions = room.gameContent?.questions || [];
  const question = questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
  const shouldFinalizeQuestion =
    ["answering", "answer-lock", "reveal", "scoring", "between-questions", "final-hype", "finale"].includes(state.phase) ||
    Object.keys(state.answers || {}).length > 0;

  if (shouldFinalizeQuestion && question) {
    const resolution = finalizeCurrentQuestion(room);
    if (resolution?.questionId) await markQuestionAnswered(resolution.questionId);
  }

  clearTesterTimer(room);
  enterPhase(room, "post-game", { mode: "manual" });
  bumpPrivateStateVersion(room);
  return { status: 200 };
}

export async function directorAudioStatus(room, phase = null, playbackKey = "", status = "") {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (phase && state.phase !== phase) {
    return { status: 200, advanced: false, phase: state.phase };
  }

  const step = getDirectorStep(state.phase);
  if (!step || !["audio-advance", "timer-and-audio"].includes(step.kind)) {
    return { status: 200, advanced: false, phase: state.phase };
  }

  const normalizedStatus = String(status || "").trim().toLowerCase();
  let accepted = false;

  if (normalizedStatus === "ended") {
    accepted = markDirectorAudioComplete(room, phase, playbackKey);
  } else if (normalizedStatus === "playing") {
    accepted = markDirectorAudioStarted(room, phase, playbackKey);
  } else {
    accepted = markDirectorAudioStatus(room, phase, playbackKey, normalizedStatus);
  }
  if (!accepted) return { status: 200, advanced: false, phase: state.phase };

  if (step.kind === "timer-and-audio") {
    const shouldTryAdvance = normalizedStatus === "ended" || normalizedStatus === "blocked" || isPhaseTimerComplete(room);
    if (!shouldTryAdvance) {
      return { status: 200, advanced: false, phase: state.phase };
    }
    if (!isPhaseTimerComplete(room) && normalizedStatus !== "blocked") {
      return { status: 200, advanced: false, phase: state.phase };
    }
  } else if (!["ended", "blocked"].includes(normalizedStatus)) {
    return { status: 200, advanced: false, phase: state.phase };
  }

  const result = await advanceCosmicTrivia(room);
  return { status: 200, advanced: result?.advanced === true, phase: state.phase };
}

export async function directorAudioStarted(room, phase = null, playbackKey = "") {
  return directorAudioStatus(room, phase, playbackKey, "playing");
}

export async function directorAudioEnded(room, phase = null, playbackKey = "") {
  return directorAudioStatus(room, phase, playbackKey, "ended");
}

export const cosmicTriviaRuntime = {
  createState: createCosmicTriviaState,
  ensureState: ensureCosmicTriviaState,
  publicState: publicCosmicTriviaState,
  privateState: privateCosmicTriviaState,
  setup: setCosmicTriviaSetup,
  answer: answerCosmicTrivia,
  preferences: setCosmicTriviaPreferences,
  restart: restartCosmicTrivia,
  advance: advanceCosmicTrivia,
  directorDelay,
  testerSelect: setCosmicTriviaTesterSelection,
  testerTimer: setCosmicTriviaTesterTimer,
  testerScore: addCosmicTriviaTesterScore,
  testerAnswerCorrect,
  testerComplete: completeCosmicTrivia,
  directorAudioStatus,
  directorAudioStarted,
  directorAudioEnded
};
