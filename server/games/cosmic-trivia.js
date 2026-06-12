import { getQuestionOptions } from "./cosmic-trivia/content-loader.js";
import { answeredQuestionIds, markQuestionAnswered } from "./cosmic-trivia/question-history.js";
import { selectRoundQuestions } from "./cosmic-trivia/question-selector.js";
import { activePlayers, activePlayerIds } from "../players/status.js";
import {
  getDirectorMessage,
  getDirectorNextPhase,
  getDirectorStep,
  getDirectorTimerMs
} from "../../public/games/cosmic-trivia/audio/director-flow.js";

export const cosmicTriviaGame = {
  id: "cosmic-trivia",
  title: "Cosmic Trivia",
  genre: "Trivia party",
  price: 7,
  credits: 2,
  players: "2-8",
  minPlayers: 2,
  maxPlayers: 8,
  mood: "Bright sci-fi quiz",
  status: "playable",
  clientModule: "/games/cosmic-trivia/client.js",
  description: "Fast multiple-choice questions, cheerful music cues, and quick score reveals."
};

function stateKey(room) {
  return room.gameState ||= {};
}

function testerKey(room) {
  const state = stateKey(room);
  return state.tester ||= {
    selectedPlayerId: null
  };
}

function currentQuestion(room) {
  const state = stateKey(room);
  const questions = room.gameContent?.questions || [];
  return questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
}

function playerStateMap(room) {
  return stateKey(room).playerStates ||= {};
}

function playerState(room, playerId) {
  const map = playerStateMap(room);
  map[playerId] ||= {
    preferences: { categories: [], tags: [] },
    preferencesLocked: false
  };
  return map[playerId];
}

function playerList(room) {
  return [...room.players.values()].map(player => ({
    ...player,
    ...playerState(room, player.id)
  }));
}

function answerCount(room) {
  return Object.keys(stateKey(room).answers || {}).length;
}

function applyQuestionScoring(room) {
  const state = stateKey(room);
  const question = currentQuestion(room);
  if (!question || state.scoredQuestionId === question.id) return;
  for (const [playerId, choice] of Object.entries(state.answers || {})) {
    if (choice === question.correctAnswer) {
      state.scores[playerId] = (state.scores[playerId] || 0) + 100;
    }
  }
  state.scoredQuestionId = question.id;
}

function clearTesterTimer(room) {
  const state = stateKey(room);
  state.phaseDurationOverrideMs = null;
  state.phaseEndsAtOverride = null;
  state.phaseTimerStartedAt = null;
}

function phaseTiming(room) {
  const state = stateKey(room);
  const step = getDirectorStep(state.phase) || null;
  const baseDurationMs = getDirectorTimerMs(state.phase);
  const durationMs = state.phaseDurationOverrideMs ?? baseDurationMs;
  const startedAt = state.phaseTimerStartedAt || state.phaseStartedAt;
  const endsAt = state.phaseEndsAtOverride || (durationMs != null ? startedAt + durationMs : null);
  const remainingMs = endsAt != null ? Math.max(0, endsAt - Date.now()) : null;

  return {
    step,
    baseDurationMs,
    durationMs,
    startedAt,
    endsAt,
    remainingMs
  };
}

function preferenceCount(room) {
  return Object.values(playerStateMap(room)).filter(player => player.preferencesLocked).length;
}

function readyPreferenceCount(room) {
  return activePlayers(room).filter(player => playerState(room, player.id).preferencesLocked).length;
}

function shouldShowAnswer(state) {
  return ["scoring", "next-question", "finale-intro", "complete"].includes(state.phase);
}

function publicQuestion(question, state) {
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

export async function createCosmicTriviaState(room) {
  return createCosmicTriviaStateWithPlayCount(room, Number(room.gameState?.playCount || 0) + 1 || 1);
}

async function createCosmicTriviaStateWithPlayCount(room, playCount = 1) {
  const scores = {};
  for (const player of room.players.values()) {
    scores[player.id] = 0;
  }

  const options = await getQuestionOptions("core");
  room.gameContent = {
    packId: options.packId,
    options,
    selection: [],
    questions: []
  };

  room.gameState = {
    playCount,
    questionIndex: 0,
    phase: "interest-selecting",
    phaseStartedAt: Date.now(),
    answers: {},
    scores,
    playerStates: Object.fromEntries([...room.players.values()].map(player => [player.id, {
      preferences: { categories: [], tags: [] },
      preferencesLocked: false
    }])),
    roundSize: options.roundSize,
    director: {
      mode: "auto",
      message: getDirectorMessage("interest-selecting", { playCount, roomCode: room.code })
    },
    tester: {
      selectedPlayerId: null
    },
    phaseDurationOverrideMs: null,
    phaseEndsAtOverride: null,
    phaseTimerStartedAt: null
  };
}

export async function ensureCosmicTriviaState(room) {
  if (!room.gameState) await createCosmicTriviaState(room);
  const state = stateKey(room);
  state.scores ||= {};
  state.playerStates ||= {};
  state.tester ||= {
    selectedPlayerId: null
  };
  for (const player of room.players.values()) {
    state.scores[player.id] ||= 0;
    playerState(room, player.id);
  }
}

async function loadRoundContent(room) {
  const state = stateKey(room);
  const packId = room.gameContent?.packId || "core";
  const selected = await selectRoundQuestions({
    players: playerList(room),
    roundSize: state.roundSize || 8,
    packId,
    seed: `${room.code}:${state.roundNumber || 1}:${Date.now()}`,
    answeredIds: await answeredQuestionIds()
  });

  room.gameContent = {
    ...room.gameContent,
    packId: selected.packId,
    selection: selected.selection,
    questions: selected.questions
  };
  state.roundSize = selected.roundSize;
  state.questionIndex = 0;
  state.answers = {};
  state.scoredQuestionId = null;
}

export function publicCosmicTriviaState(room) {
  if (!room.gameState) return null;
  const state = stateKey(room);
  const question = currentQuestion(room);
  const timing = phaseTiming(room);
  const phaseDurationMs = timing.durationMs || 0;
  const phaseEndsAt = timing.endsAt;
  const remainingMs = timing.remainingMs || 0;
  const step = timing.step;

  return {
    playCount: state.playCount || 1,
    questionIndex: state.questionIndex,
    totalQuestions: room.gameContent?.questions?.length || state.roundSize || 0,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseDurationMs,
    phaseEndsAt,
    remainingMs,
    directorMessage: step?.message ? getDirectorMessage(state.phase, {
      roomCode: room.code,
      playCount: state.playCount || 1,
      questionIndex: state.questionIndex || 0,
      isLastQuestion: (state.questionIndex || 0) >= (room.gameContent?.questions?.length || state.roundSize || 1) - 1,
      lastResolution: state.lastResolution || null
    }) : (state.director?.message || ""),
    currentQuestion: publicQuestion(question, state),
    scores: state.scores || {},
    answersCount: answerCount(room),
    answeredPlayerIds: Object.keys(state.answers || {}),
    preferencesCount: readyPreferenceCount(room),
    expectedAnswerCount: activePlayers(room).length,
    expectedPreferenceCount: activePlayers(room).length,
    preferencePlayerIds: activePlayerIds(room).filter(playerId => playerState(room, playerId).preferencesLocked),
    playerStates: playerStateMap(room),
    tester: {
      selectedPlayerId: state.tester?.selectedPlayerId || null
    },
    questionOptions: room.gameContent?.options || null,
    selectedQuestionIds: room.gameContent?.selection?.map(entry => entry.id) || [],
    lastResolution: state.lastResolution || null
  };
}

export function directorDelay(room) {
  const timing = phaseTiming(room);
  const mode = getDirectorStep(stateKey(room).phase)?.kind || null;
  if (mode !== "timer") return null;
  return timing.remainingMs;
}

export async function advanceCosmicTrivia(room) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const phase = state.phase;
  const nextPhase = getDirectorNextPhase(phase, {
    roomCode: room.code,
    playCount: state.playCount || 1,
    questionIndex: state.questionIndex || 0,
    isLastQuestion: (state.questionIndex || 0) >= (room.gameContent?.questions?.length || state.roundSize || 1) - 1,
    lastResolution: state.lastResolution || null
  });
  if (!nextPhase) return;

  if (phase === "preferences-locked") {
    state.phase = "deck-loading";
    await loadRoundContent(room);
  } else if (phase === "answering") {
    const question = currentQuestion(room);
    if (question && state.scoredQuestionId !== question.id) {
      applyQuestionScoring(room);
      await markQuestionAnswered(question.id);
      const rewardCount = Object.values(state.answers || {}).filter(choice => choice === question.correctAnswer).length;
      state.lastResolution = {
        questionId: question.id,
        correctAnswer: question.correctAnswer,
        rewardCount,
        answeredCount: answerCount(room),
        scoredAt: Date.now()
      };
    }
    state.phase = nextPhase;
  } else if (phase === "next-question") {
    if (nextPhase === "finale-intro") {
      state.phase = nextPhase;
    } else {
      state.questionIndex += 1;
      state.answers = {};
      state.scoredQuestionId = null;
      state.lastResolution = null;
      state.phase = nextPhase;
    }
  } else {
    state.phase = nextPhase;
  }

  state.phaseStartedAt = Date.now();
  clearTesterTimer(room);
  state.director = {
    mode: "auto",
    message: getDirectorMessage(state.phase, {
      roomCode: room.code,
      playCount: state.playCount || 1,
      questionIndex: state.questionIndex || 0,
      isLastQuestion: (state.questionIndex || 0) >= (room.gameContent?.questions?.length || state.roundSize || 1) - 1,
      lastResolution: state.lastResolution || null
    })
  };
}

export async function setCosmicTriviaPreferences(room, playerId, preferences = {}) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (state.phase !== "interest-selecting") return { status: 409, error: "Topic selection is closed" };

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
  const question = currentQuestion(room);
  if (!player) return { status: 404, error: "Player not found" };
  if (!question?.answers?.some(answer => answer.id === choice)) {
    return { status: 400, error: "Invalid answer" };
  }

  const previousChoice = state.answers[playerId];
  state.answers[playerId] = choice;

  if (answerCount(room) >= activePlayers(room).length && !state.phaseEndsAtOverride) {
    state.phaseTimerStartedAt = Date.now();
    state.phaseDurationOverrideMs = 1_800;
    state.phaseEndsAtOverride = state.phaseTimerStartedAt + state.phaseDurationOverrideMs;
  }

  return {
    status: 200,
    allAnswered: answerCount(room) >= activePlayers(room).length
  };
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
    message: state.director?.message || getDirectorMessage(state.phase, {
      roomCode: room.code,
      playCount: state.playCount || 1,
      questionIndex: state.questionIndex || 0,
      lastResolution: state.lastResolution || null
    })
  };

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
    message: state.director?.message || getDirectorMessage(state.phase, {
      roomCode: room.code,
      playCount: state.playCount || 1,
      questionIndex: state.questionIndex || 0,
      lastResolution: state.lastResolution || null
    })
  };
  return { status: 200 };
}

export async function addCosmicTriviaTesterScore(room, playerId, points = 0) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const selectedPlayerId = String(playerId || testerKey(room).selectedPlayerId || "");
  const player = room.players.get(selectedPlayerId);
  const delta = Number(points) || 0;
  if (!player) return { status: 404, error: "Player not found" };
  state.scores[player.id] = (state.scores[player.id] || 0) + delta;
  return {
    status: 200,
    score: state.scores[player.id]
  };
}

export async function completeCosmicTrivia(room) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const question = currentQuestion(room);
  const shouldFinalizeQuestion = ["answering", "scoring", "next-question"].includes(state.phase) || answerCount(room) > 0;

  if (shouldFinalizeQuestion && question) {
    applyQuestionScoring(room);
    if (state.scoredQuestionId === question.id) {
      await markQuestionAnswered(question.id);
    }
  }

  clearTesterTimer(room);
  state.phase = "complete";
  state.phaseStartedAt = Date.now();
  state.director = {
    mode: "manual",
    message: getDirectorMessage("complete", {
      roomCode: room.code,
      playCount: state.playCount || 1,
      questionIndex: state.questionIndex || 0,
      lastResolution: state.lastResolution || null
    })
  };

  return { status: 200 };
}

export async function directorAudioEnded(room, phase = null) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  if (phase && state.phase !== phase) {
    return {
      status: 200,
      advanced: false,
      phase: state.phase
    };
  }

  const step = getDirectorStep(state.phase);
  if (!step || step.kind !== "audio-advance") {
    return {
      status: 200,
      advanced: false,
      phase: state.phase
    };
  }

  await advanceCosmicTrivia(room);
  return {
    status: 200,
    advanced: true,
    phase: state.phase
  };
}

export const cosmicTriviaRuntime = {
  createState: createCosmicTriviaState,
  ensureState: ensureCosmicTriviaState,
  publicState: publicCosmicTriviaState,
  answer: answerCosmicTrivia,
  preferences: setCosmicTriviaPreferences,
  restart: restartCosmicTrivia,
  advance: advanceCosmicTrivia,
  directorDelay,
  testerSelect: setCosmicTriviaTesterSelection,
  testerTimer: setCosmicTriviaTesterTimer,
  testerScore: addCosmicTriviaTesterScore,
  testerComplete: completeCosmicTrivia,
  directorAudioEnded
};
