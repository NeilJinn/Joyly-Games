import { audioForQuestion, getQuestionOptions } from "./cosmic-trivia/content-loader.js";
import { answeredQuestionIds, markQuestionAnswered } from "./cosmic-trivia/question-history.js";
import { selectRoundQuestions } from "./cosmic-trivia/question-selector.js";
import { activePlayers, activePlayerIds } from "../players/status.js";

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

const directorSteps = {
  "interest-selecting": { next: "preferences-locked", delayMs: 30000, message: "Choose topics on your phone" },
  "preferences-locked": { next: "deck-loading", delayMs: 5000, message: "Choices locked" },
  "deck-loading": { next: "question-intro", delayMs: 1800, message: "Loading selected questions" },
  "question-intro": { next: "question-audio", delayMs: 2400, message: "Question incoming" },
  "question-audio": { next: "answering", delayMs: 2200, message: "Get ready to answer" },
  answering: { next: "answer-reveal", delayMs: 20000, message: "Answer on your phone" },
  "answer-reveal": { next: "answer-audio", delayMs: 9000, message: "Answer reveal" },
  "answer-audio": { next: "scoring", delayMs: 3000, message: "Answer explanation" },
  scoring: { next: "next-question", delayMs: 2000, message: "Scoring" },
  "next-question": { next: "question-intro", delayMs: 1000, message: "Next question" },
  complete: { next: null, delayMs: null, message: "Final scores" }
};

function stateKey(room) {
  return room.gameState ||= {};
}

function currentQuestion(room) {
  const state = stateKey(room);
  const questions = room.gameContent?.questions || [];
  return questions[Math.min(Math.max(state.questionIndex || 0, 0), Math.max(questions.length - 1, 0))] || null;
}

function nextQuestion(room) {
  const state = stateKey(room);
  const questions = room.gameContent?.questions || [];
  return questions[Math.min((state.questionIndex || 0) + 1, Math.max(questions.length - 1, 0))] || null;
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

function preferenceCount(room) {
  return Object.values(playerStateMap(room)).filter(player => player.preferencesLocked).length;
}

function readyPreferenceCount(room) {
  return activePlayers(room).filter(player => playerState(room, player.id).preferencesLocked).length;
}

function shouldShowAnswer(state) {
  return ["answer-reveal", "answer-audio", "scoring", "next-question", "complete"].includes(state.phase);
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
    answerAudio: question.answerAudio,
    correctAnswer: shouldShowAnswer(state) ? question.correctAnswer : null,
    fact: shouldShowAnswer(state) ? question.fact : ""
  };
}

export async function createCosmicTriviaState(room) {
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
      message: directorSteps["interest-selecting"].message
    }
  };
}

export async function ensureCosmicTriviaState(room) {
  if (!room.gameState) await createCosmicTriviaState(room);
  const state = stateKey(room);
  state.scores ||= {};
  state.playerStates ||= {};
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
  const next = nextQuestion(room);
  const step = directorSteps[state.phase] || directorSteps["interest-selecting"];
  const phaseDurationMs = step.delayMs || 0;
  const phaseEndsAt = phaseDurationMs ? state.phaseStartedAt + phaseDurationMs : null;
  const remainingMs = phaseEndsAt ? Math.max(0, phaseEndsAt - Date.now()) : 0;

  return {
    questionIndex: state.questionIndex,
    totalQuestions: room.gameContent?.questions?.length || state.roundSize || 0,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseDurationMs,
    phaseEndsAt,
    remainingMs,
    directorMessage: step.message,
    currentQuestion: publicQuestion(question, state),
    scores: state.scores || {},
    answersCount: answerCount(room),
    answeredPlayerIds: Object.keys(state.answers || {}),
    preferencesCount: readyPreferenceCount(room),
    expectedAnswerCount: activePlayers(room).length,
    expectedPreferenceCount: activePlayers(room).length,
    preferencePlayerIds: activePlayerIds(room).filter(playerId => playerState(room, playerId).preferencesLocked),
    playerStates: playerStateMap(room),
    questionOptions: room.gameContent?.options || null,
    selectedQuestionIds: room.gameContent?.selection?.map(entry => entry.id) || [],
    preloadAudio: {
      ...audioForQuestion(question),
      nextQuestionAudio: next?.questionAudio || ""
    }
  };
}

export function directorDelay(room) {
  const state = stateKey(room);
  if (state.phase === "answering" && answerCount(room) >= activePlayers(room).length) return 3000;
  return directorSteps[state.phase]?.delayMs ?? null;
}

export async function advanceCosmicTrivia(room) {
  await ensureCosmicTriviaState(room);
  const state = stateKey(room);
  const step = directorSteps[state.phase];
  if (!step?.next) return;

  if (state.phase === "preferences-locked") {
    state.phase = "deck-loading";
    await loadRoundContent(room);
  } else if (state.phase === "answering") {
    if (answerCount(room) > 0) {
      applyQuestionScoring(room);
      await markQuestionAnswered(currentQuestion(room)?.id);
    }
    state.phase = step.next;
  } else if (state.phase === "next-question") {
    if (state.questionIndex >= (room.gameContent?.questions?.length || 1) - 1) {
      state.phase = "complete";
    } else {
      state.questionIndex += 1;
      state.answers = {};
      state.scoredQuestionId = null;
      state.phase = "question-intro";
    }
  } else {
    state.phase = step.next;
  }

  state.phaseStartedAt = Date.now();
  state.director = {
    mode: "auto",
    message: directorSteps[state.phase]?.message || ""
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

  return {
    status: 200,
    allAnswered: answerCount(room) >= activePlayers(room).length
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
  directorDelay
};
