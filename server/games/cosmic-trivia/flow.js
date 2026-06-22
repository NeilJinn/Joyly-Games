import { getDirectorMessage, getDirectorStep, AUDIO_ADVANCE_FALLBACK_MS } from "./director.js";
import { getQuestionOptions } from "./content-loader.js";
import { answeredQuestionIds, markQuestionAnswered } from "./question-history.js";
import { selectRoundQuestions } from "./question-selector.js";
import { activePlayers } from "../../players/status.js";
import {
  stateKey,
  testerKey,
  playerState,
  playerList,
  getQuestionCount,
  totalQuestionCount,
  buildDirectorContext,
  syncQuestionFlags,
  clearTesterTimer,
  bumpPrivateStateVersion,
  DEFAULT_QUESTION_COUNT,
  QUESTION_COUNT_OPTIONS
} from "./state.js";
import { finalizeCurrentQuestion } from "./scoring.js";
import { buildFinalHypeSummaries } from "./summaries.js";

const PHASE_TRANSITIONS = {
  "game-setup": "preferences",
  preferences: "interest-reveal",
  "interest-reveal": "round-prep",
  "round-prep": "question-intro",
  "question-intro": "question-read",
  "question-read": "answering",
  answering: "answer-lock",
  "answer-lock": "reveal",
  reveal: "scoring",
  scoring: context => (context.isLastQuestion ? "final-hype" : "between-questions"),
  "between-questions": "question-intro",
  "final-hype": context => (context.hasMoreFinalHype ? "final-hype" : "finale"),
  finale: "post-game",
  "post-game": null
};

const DIRECTOR_AUDIO_STALE_MS = 2_500;

function createDirectorAudioState(phase, phaseStartedAt) {
  return {
    phase,
    phaseStartedAt,
    playbackKey: "",
    status: "idle",
    pending: false,
    playing: false,
    started: false,
    completed: true,
    updatedAt: Date.now(),
    startedAt: null,
    completedAt: null
  };
}

function normalizeDirectorAudioStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["queued", "playing", "ended", "blocked", "idle"].includes(normalized)) {
    return normalized;
  }
  return "idle";
}

function currentDirectorAudio(room) {
  const state = stateKey(room);
  if (state.directorAudio?.phase !== state.phase) return null;
  return state.directorAudio;
}

function isDirectorAudioFresh(audioState, maxAgeMs = DIRECTOR_AUDIO_STALE_MS) {
  if (!audioState?.updatedAt) return false;
  return Date.now() - Number(audioState.updatedAt || 0) <= maxAgeMs;
}

export function enterPhase(room, phase, options = {}) {
  const state = stateKey(room);
  state.phase = phase;
  state.phaseStartedAt = options.startedAt || Date.now();
  clearTesterTimer(room);
  syncQuestionFlags(room);
  state.directorAudio = createDirectorAudioState(phase, state.phaseStartedAt);
  state.director = {
    mode: options.mode || "auto",
    message: getDirectorMessage(phase, buildDirectorContext(room))
  };
}

export function nextPhaseFor(room) {
  const state = stateKey(room);
  const resolver = PHASE_TRANSITIONS[state.phase];
  if (!resolver) return null;
  const context = buildDirectorContext(room);
  return typeof resolver === "function" ? resolver(context) : resolver;
}

export function directorDelay(room) {
  const state = stateKey(room);
  const step = getDirectorStep(state.phase);
  const mode = step?.kind || null;
  if (mode === "timer" || mode === "timer-and-audio") {
    const remainingMs = phaseTimerRemainingMs(room);
    if (mode === "timer") return remainingMs;
    if (remainingMs != null && remainingMs > 0) return remainingMs;
    return isDirectorAudioPlaying(room) ? null : 0;
  }
  if (mode === "audio-advance") {
    if (isDirectorAudioPending(room)) return null;
    return AUDIO_ADVANCE_FALLBACK_MS[state.phase] ?? 6_000;
  }
  return null;
}

export function phaseTimerRemainingMs(room) {
  const state = stateKey(room);
  const step = getDirectorStep(state.phase);
  const phaseDurationMs = state.phaseDurationOverrideMs ??
    (step ? (typeof step.timerMs === "function" ? step.timerMs(buildDirectorContext(room)) : step.timerMs) : null);
  const startedAt = state.phaseTimerStartedAt || state.phaseStartedAt;
  const endsAt = state.phaseEndsAtOverride || (phaseDurationMs != null ? startedAt + phaseDurationMs : null);
  return endsAt != null ? Math.max(0, endsAt - Date.now()) : null;
}

export function isPhaseTimerComplete(room) {
  const remainingMs = phaseTimerRemainingMs(room);
  return remainingMs == null || remainingMs <= 0;
}

export function isDirectorAudioComplete(room) {
  const state = stateKey(room);
  const step = getDirectorStep(state.phase);
  if (!["timer-and-audio", "audio-advance"].includes(step?.kind)) return true;
  return !isDirectorAudioPending(room);
}

export function isDirectorAudioPending(room) {
  const audioState = currentDirectorAudio(room);
  if (!audioState?.pending) return false;
  return isDirectorAudioFresh(audioState);
}

export function isDirectorAudioPlaying(room) {
  const audioState = currentDirectorAudio(room);
  if (!audioState?.playing) return false;
  return isDirectorAudioFresh(audioState);
}

export function markDirectorAudioStatus(room, phase = null, playbackKey = "", status = "") {
  const state = stateKey(room);
  if (phase && state.phase !== phase) return false;
  const step = getDirectorStep(state.phase);
  if (!["timer-and-audio", "audio-advance"].includes(step?.kind)) return false;

  const normalizedStatus = normalizeDirectorAudioStatus(status);
  const current = currentDirectorAudio(room) || createDirectorAudioState(state.phase, state.phaseStartedAt);
  const currentKey = String(current.playbackKey || "");
  const incomingKey = String(playbackKey || "");
  const canReplaceSequence = normalizedStatus === "queued" || normalizedStatus === "playing";

  if (currentKey && incomingKey && currentKey !== incomingKey && !canReplaceSequence) {
    return false;
  }
  if (currentKey && !incomingKey && !canReplaceSequence) {
    return false;
  }

  const activeKey = canReplaceSequence ? (incomingKey || currentKey) : (currentKey || incomingKey);
  const now = Date.now();
  const pending = normalizedStatus === "queued" || normalizedStatus === "playing";
  const playing = normalizedStatus === "playing";
  const isSequenceReset = activeKey && activeKey !== currentKey;

  state.directorAudio = {
    ...current,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    playbackKey: activeKey,
    status: normalizedStatus,
    pending,
    playing,
    started: pending || current.started,
    completed: !pending,
    updatedAt: now,
    startedAt: pending ? (isSequenceReset || !current.startedAt ? now : current.startedAt) : current.startedAt,
    completedAt: !pending ? now : null
  };
  return true;
}

export function markDirectorAudioComplete(room, phase = null, playbackKey = "") {
  return markDirectorAudioStatus(room, phase, playbackKey, "ended");
}

export function markDirectorAudioStarted(room, phase = null, playbackKey = "") {
  return markDirectorAudioStatus(room, phase, playbackKey, "playing");
}

export function canAdvanceCurrentPhase(room) {
  const state = stateKey(room);
  if (state.phase === "interest-reveal") {
    return isDirectorAudioComplete(room) && Boolean(state.contentLoadingComplete);
  }
  const step = getDirectorStep(state.phase);
  if (step?.kind === "timer-and-audio") {
    return isPhaseTimerComplete(room) && !isDirectorAudioPlaying(room);
  }
  if (step?.kind === "audio-advance") {
    return isDirectorAudioComplete(room);
  }
  return true;
}

function computeTopCategories(room) {
  const categoryVotes = new Map();
  for (const player of playerList(room)) {
    for (const category of (player.preferences?.categories || [])) {
      categoryVotes.set(category, (categoryVotes.get(category) || 0) + 1);
    }
  }
  return [...categoryVotes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);
}

async function loadRoundContent(room) {
  const state = stateKey(room);
  const packId = room.gameContent?.packId || "core";
  const selected = await selectRoundQuestions({
    players: playerList(room),
    roundSize: getQuestionCount(room),
    packId,
    seed: `${room.code}:${state.playCount || 1}:${Date.now()}`,
    answeredIds: await answeredQuestionIds()
  });

  room.gameContent = {
    ...room.gameContent,
    packId: selected.packId,
    selection: selected.selection,
    questions: selected.questions
  };
  state.questionIndex = 0;
  state.answers = {};
  state.scoredQuestionId = null;
  state.lastResolution = null;
  state.totalQuestions = selected.questions.length;
  syncQuestionFlags(room);
}

export async function advanceCosmicTrivia(room) {
  await ensureCosmicTriviaState(room);
  if (!canAdvanceCurrentPhase(room)) {
    return { advanced: false, phase: stateKey(room).phase };
  }
  const state = stateKey(room);
  const phase = state.phase;
  const nextPhase = nextPhaseFor(room);
  if (!nextPhase) return { advanced: false, phase };

  if (phase === "preferences") {
    state.topCategories = computeTopCategories(room);
    state.contentLoadingComplete = false;
    enterPhase(room, "interest-reveal");
    loadRoundContent(room).then(() => {
      state.contentLoadingComplete = true;
      bumpPrivateStateVersion(room);
    }).catch(() => {
      state.contentLoadingComplete = true;
      bumpPrivateStateVersion(room);
    });
  } else if (phase === "interest-reveal") {
    enterPhase(room, nextPhase);
  } else if (phase === "round-prep") {
    enterPhase(room, nextPhase);
  } else if (phase === "answering") {
    const resolution = finalizeCurrentQuestion(room);
    if (resolution?.questionId) await markQuestionAnswered(resolution.questionId);
    enterPhase(room, nextPhase);
  } else if (phase === "scoring") {
    if (nextPhase === "between-questions") {
      state.questionIndex += 1;
      state.answers = {};
      state.scoredQuestionId = null;
      state.lastResolution = null;
      syncQuestionFlags(room);
      enterPhase(room, nextPhase);
    } else {
      state.finalHypeSummaries = buildFinalHypeSummaries(room);
      state.finalHypeIndex = 0;
      enterPhase(room, nextPhase);
    }
  } else if (phase === "final-hype") {
    if (nextPhase === "final-hype") {
      state.finalHypeIndex = Math.min(
        (state.finalHypeIndex || 0) + 1,
        Math.max(0, (state.finalHypeSummaries?.length || 1) - 1)
      );
      enterPhase(room, "final-hype");
    } else {
      enterPhase(room, nextPhase);
    }
  } else {
    enterPhase(room, nextPhase);
  }

  bumpPrivateStateVersion(room);
  return { advanced: true, phase: state.phase };
}

export async function createCosmicTriviaState(room) {
  return createCosmicTriviaStateWithPlayCount(room, Number(room.gameState?.playCount || 0) + 1 || 1);
}

async function createCosmicTriviaStateWithPlayCount(room, playCount = 1) {
  const scores = {};
  for (const player of room.players.values()) scores[player.id] = 0;

  const options = await getQuestionOptions("core");
  room.gameContent = { packId: options.packId, options, selection: [], questions: [] };

  room.gameState = {
    playCount,
    phase: "game-setup",
    phaseStartedAt: Date.now(),
    questionCount: DEFAULT_QUESTION_COUNT,
    questionCountOptions: [...QUESTION_COUNT_OPTIONS],
    questionIndex: 0,
    totalQuestions: DEFAULT_QUESTION_COUNT,
    answers: {},
    scores,
    playerStates: Object.fromEntries([...room.players.values()].map(player => [player.id, {
      preferences: { categories: [], tags: [] },
      preferencesLocked: false
    }])),
    scoreVisibility: "visible",
    leaderboardFrozen: false,
    finalHypeSummaries: [],
    finalHypeIndex: 0,
    questionHistory: [],
    director: {
      mode: "auto",
      message: getDirectorMessage("game-setup", { playCount, roomCode: room.code, questionCount: DEFAULT_QUESTION_COUNT })
    },
    directorAudio: createDirectorAudioState("game-setup", Date.now()),
    tester: { selectedPlayerId: null },
    phaseDurationOverrideMs: null,
    phaseEndsAtOverride: null,
    phaseTimerStartedAt: null,
    privateStateVersion: 1
  };
  syncQuestionFlags(room);
}

export async function ensureCosmicTriviaState(room) {
  if (!room.gameState) await createCosmicTriviaState(room);
  const state = stateKey(room);
  state.scores ||= {};
  state.playerStates ||= {};
  state.tester ||= { selectedPlayerId: null };
  state.questionCountOptions ||= [...QUESTION_COUNT_OPTIONS];
  state.finalHypeSummaries ||= [];
  state.topCategories ||= [];
  state.questionHistory ||= [];
  state.scoreVisibility ||= "visible";
  state.privateStateVersion ||= 1;
  state.directorAudio ||= createDirectorAudioState(state.phase || "game-setup", state.phaseStartedAt || Date.now());
  for (const player of room.players.values()) {
    state.scores[player.id] ||= 0;
    playerState(room, player.id);
  }
  syncQuestionFlags(room);
}
