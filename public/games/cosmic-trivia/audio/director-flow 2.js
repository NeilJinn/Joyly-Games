import { createDirectorFlow, pickVariant } from "../../../shared/director/flow.js";
import { createReactiveDirector } from "../../../shared/director/cues.js";

const LOBBY_PREFIX_BY_PLAY_COUNT = [
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-hello-welcome-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-round-2-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-round-3-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-again-01.mp3"
];

const LOBBY_DESCRIPTION_VARIANTS = [
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-desc-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-desc-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-desc-03.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-interest-selecting-desc-04.mp3"
];

const QUESTION_INTRO_VARIANTS = [
  "/games/cosmic-trivia/audio/host/phases/phase-question-intro-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-question-intro-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-question-intro-03.mp3"
];

const ANSWERING_VARIANTS = [
  "/games/cosmic-trivia/audio/host/phases/phase-answering-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-answering-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-answering-03.mp3"
];

const SCORING_VARIANTS_POSITIVE = [
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-03.mp3"
];

const SCORING_VARIANTS_NO_CORRECT = [
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-no-correct-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-no-correct-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-scoring-no-correct-03.mp3"
];

const NEXT_QUESTION_VARIANTS = [
  "/games/cosmic-trivia/audio/host/phases/phase-next-question-01.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-next-question-02.mp3",
  "/games/cosmic-trivia/audio/host/phases/phase-next-question-03.mp3"
];

// Placeholder until we record a dedicated "all answers are in" cue.
const ALL_ANSWERED_VARIANTS = [
  "/games/cosmic-trivia/audio/host/phases/phase-next-question-03.mp3"
];

function playCountPrefixIndex(playCount = 1) {
  if (playCount <= 1) return 0;
  if (playCount === 2) return 1;
  if (playCount === 3) return 2;
  return 3;
}

function lobbyIntroAudio(context = {}) {
  const playCount = Number(context.playCount || 1);
  const prefix = LOBBY_PREFIX_BY_PLAY_COUNT[playCountPrefixIndex(playCount)];
  const description = pickVariant(
    LOBBY_DESCRIPTION_VARIANTS,
    `${context.roomCode || ""}:${playCount}:${context.questionIndex || 0}`
  );
  return [prefix, ...description].filter(Boolean);
}

const cosmicTriviaDirector = createDirectorFlow({
  phases: {
    "interest-selecting": {
      kind: "timer",
      timerMs: 35_000,
      next: "preferences-locked",
      message: "Choose your categories and keywords",
      audio: lobbyIntroAudio
    },
    "preferences-locked": {
      kind: "audio-advance",
      next: "deck-loading",
      message: "Choices are locked",
      audio: ["/games/cosmic-trivia/audio/host/phases/phase-preferences-locked-01.mp3"]
    },
    "deck-loading": {
      kind: "audio-advance",
      next: "question-intro",
      message: "Loading the round",
      audio: ["/games/cosmic-trivia/audio/host/phases/phase-deck-loading-01.mp3"]
    },
    "question-intro": {
      kind: "audio-advance",
      next: "question-audio",
      message: context => `Question ${Number(context.questionIndex || 0) + 1} is coming up`,
      audio: context => pickVariant(QUESTION_INTRO_VARIANTS, `${context.roomCode || ""}:question-intro:${context.questionIndex || 0}:${context.playCount || 1}`),
      segmentPauseMultiplier: 0.12
    },
    "question-audio": {
      kind: "audio-advance",
      next: "answering",
      message: "",
      audio: context => context.questionAudio ? [context.questionAudio] : []
    },
    answering: {
      kind: "timer",
      timerMs: 25_000,
      next: "scoring",
      message: context => Number(context.questionIndex || 0) === 0
        ? "What do you think? Please answer on your phone"
        : "Answer before time runs out",
      audio: context => Number(context.questionIndex || 0) === 0
        ? pickVariant(ANSWERING_VARIANTS, `${context.roomCode || ""}:answering:${context.questionIndex || 0}:${context.playCount || 1}`)
        : []
    },
    scoring: {
      kind: "audio-advance",
      next: "next-question",
      message: context => {
        const winners = Number(context.lastResolution?.rewardCount || 0);
        return winners > 0 ? "Scores are moving" : "No one got it right";
      },
      audio: context => {
        const rewardCount = Number(context.lastResolution?.rewardCount || 0);
        const seed = `${context.roomCode || ""}:scoring:${context.questionIndex || 0}:${context.playCount || 1}:${rewardCount}`;
        return rewardCount > 0
          ? pickVariant(SCORING_VARIANTS_POSITIVE, seed)
          : pickVariant(SCORING_VARIANTS_NO_CORRECT, seed);
      },
      segmentPauseMultiplier: 0.3,
      segmentPauseMaxMs: 2400
    },
    "next-question": {
      kind: "audio-advance",
      next: context => (context?.isLastQuestion ? "finale-intro" : "question-intro"),
      message: context => (context?.isLastQuestion ? "Final scores are coming up" : "Next question coming up"),
      audio: context => pickVariant(NEXT_QUESTION_VARIANTS, `${context.roomCode || ""}:next-question:${context.questionIndex || 0}:${context.playCount || 1}`),
      segmentPauseMultiplier: 0.12
    },
    "finale-intro": {
      kind: "audio-advance",
      next: "complete",
      message: "Wrapping up the leaderboard",
      audio: ["/games/cosmic-trivia/audio/host/phases/phase-complete-prelude-01.mp3"],
      segmentPauseMultiplier: 0.2,
      segmentPauseMaxMs: 1800
    },
    complete: {
      kind: "hold",
      message: "Final scores",
      audio: ["/games/cosmic-trivia/audio/host/phases/phase-complete-01.mp3"]
    }
  }
});

function cueSeed(context = {}, cueId = "") {
  return [
    context.roomCode || "",
    context.playCount || 1,
    cueId,
    context.questionIndex || 0,
    context.questionId || "",
    context.rewardCount || 0
  ].join(":");
}

function phaseContext(runtime = {}) {
  const context = runtime.context || {};
  const nextSnapshot = runtime.nextSnapshot || {};
  return {
    ...context,
    roomCode: context.roomCode || "",
    playCount: Number(context.playCount || nextSnapshot.playCount || 1),
    questionIndex: Number(context.questionIndex ?? nextSnapshot.questionIndex ?? 0),
    questionId: String(nextSnapshot.questionId || ""),
    rewardCount: Number(nextSnapshot.lastResolution?.rewardCount || context.lastResolution?.rewardCount || 0)
  };
}

function allAnsweredEarly(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot || !nextSnapshot) return false;
  if (previousSnapshot.phase !== "answering" || nextSnapshot.phase !== "answering") return false;
  if (!nextSnapshot.questionId || previousSnapshot.questionId !== nextSnapshot.questionId) return false;

  const previousAnswered = Number(previousSnapshot.answersCount || 0);
  const nextAnswered = Number(nextSnapshot.answersCount || 0);
  const expected = Number(nextSnapshot.expectedAnswerCount || 0);
  const remainingMs = Number(nextSnapshot.remainingMs || 0);

  return previousAnswered < expected && expected > 0 && nextAnswered >= expected && remainingMs > 0;
}

const reactiveDirector = createReactiveDirector({
  flow: cosmicTriviaDirector,
  rules: [
    {
      id: "phase:interest-selecting",
      when: runtime => runtime.phaseChanged && runtime.phase === "interest-selecting",
      select: runtime => ({
        id: "lobby.intro",
        replayKey: `lobby.intro:${cueSeed(phaseContext(runtime), "lobby.intro")}`,
        audio: lobbyIntroAudio(phaseContext(runtime))
      })
    },
    {
      id: "phase:preferences-locked",
      when: runtime => runtime.phaseChanged && runtime.phase === "preferences-locked",
      select: () => ({
        id: "preferences.locked",
        replayKey: "preferences.locked",
        audio: ["/games/cosmic-trivia/audio/host/phases/phase-preferences-locked-01.mp3"]
      })
    },
    {
      id: "phase:deck-loading",
      when: runtime => runtime.phaseChanged && runtime.phase === "deck-loading",
      select: () => ({
        id: "deck.loading",
        replayKey: "deck.loading",
        audio: ["/games/cosmic-trivia/audio/host/phases/phase-deck-loading-01.mp3"]
      })
    },
    {
      id: "phase:question-intro",
      when: runtime => runtime.phaseChanged && runtime.phase === "question-intro",
      select: runtime => ({
        id: "question.intro",
        replayKey: `question.intro:${cueSeed(phaseContext(runtime), "question.intro")}`,
        audio: pickVariant(QUESTION_INTRO_VARIANTS, cueSeed(phaseContext(runtime), "question.intro"))
      })
    },
    {
      id: "phase:question-audio",
      when: runtime => runtime.phaseChanged && runtime.phase === "question-audio",
      select: runtime => ({
        id: "question.read",
        replayKey: `question.read:${cueSeed(phaseContext(runtime), "question.read")}`,
        audio: runtime.context.questionAudio ? [runtime.context.questionAudio] : []
      })
    },
    {
      id: "phase:answering:first-question",
      when: runtime => runtime.phaseChanged && runtime.phase === "answering" && Number(runtime.context.questionIndex || 0) === 0,
      select: runtime => ({
        id: "answering.prompt.first-question",
        replayKey: `answering.prompt.first-question:${cueSeed(phaseContext(runtime), "answering-first")}`,
        audio: pickVariant(ANSWERING_VARIANTS, cueSeed(phaseContext(runtime), "answering-first"))
      })
    },
    {
      id: "event:answering:all-answered-early",
      when: runtime => allAnsweredEarly(runtime.previousSnapshot, runtime.nextSnapshot),
      select: runtime => ({
        id: "answering.all-answered-early",
        replayKey: `answering.all-answered-early:${cueSeed(phaseContext(runtime), "all-answered-early")}`,
        audio: pickVariant(ALL_ANSWERED_VARIANTS, cueSeed(phaseContext(runtime), "all-answered-early")),
        maxLateStartMs: 2_500
      })
    },
    {
      id: "phase:scoring:no-correct",
      when: runtime => runtime.phaseChanged && runtime.phase === "scoring" && Number(runtime.context.lastResolution?.rewardCount || 0) <= 0,
      select: runtime => ({
        id: "scoring.no-correct",
        replayKey: `scoring.no-correct:${cueSeed(phaseContext(runtime), "scoring-no-correct")}`,
        audio: pickVariant(SCORING_VARIANTS_NO_CORRECT, cueSeed(phaseContext(runtime), "scoring-no-correct"))
      })
    },
    {
      id: "phase:scoring:positive",
      when: runtime => runtime.phaseChanged && runtime.phase === "scoring",
      select: runtime => ({
        id: "scoring.positive",
        replayKey: `scoring.positive:${cueSeed(phaseContext(runtime), "scoring-positive")}`,
        audio: pickVariant(SCORING_VARIANTS_POSITIVE, cueSeed(phaseContext(runtime), "scoring-positive"))
      })
    },
    {
      id: "phase:next-question",
      when: runtime => runtime.phaseChanged && runtime.phase === "next-question",
      select: runtime => ({
        id: "transition.next-question",
        replayKey: `transition.next-question:${cueSeed(phaseContext(runtime), "next-question")}`,
        audio: pickVariant(NEXT_QUESTION_VARIANTS, cueSeed(phaseContext(runtime), "next-question"))
      })
    },
    {
      id: "phase:finale-intro",
      when: runtime => runtime.phaseChanged && runtime.phase === "finale-intro",
      select: () => ({
        id: "finale.intro",
        replayKey: "finale.intro",
        audio: ["/games/cosmic-trivia/audio/host/phases/phase-complete-prelude-01.mp3"]
      })
    },
    {
      id: "phase:complete",
      when: runtime => runtime.phaseChanged && runtime.phase === "complete",
      select: () => ({
        id: "complete.outro",
        replayKey: "complete.outro",
        audio: ["/games/cosmic-trivia/audio/host/phases/phase-complete-01.mp3"]
      })
    }
  ]
});

export const cosmicTriviaDirectorFlow = cosmicTriviaDirector;
export const getDirectorStep = cosmicTriviaDirector.getDirectorStep;
export const getDirectorMessage = cosmicTriviaDirector.getDirectorMessage;
export const getDirectorNextPhase = cosmicTriviaDirector.getDirectorNextPhase;
export const getDirectorTimerMs = cosmicTriviaDirector.getDirectorTimerMs;
export const getDirectorMode = cosmicTriviaDirector.getDirectorMode;
export const shouldAdvanceOnAudioEnd = cosmicTriviaDirector.shouldAdvanceOnAudioEnd;
export const shouldHoldOnComplete = cosmicTriviaDirector.shouldHoldOnComplete;
export const getDirectorAudioSources = cosmicTriviaDirector.getDirectorAudioSources;
export const getDirectorAudioPlan = cosmicTriviaDirector.getDirectorAudioPlan;
export const getReactiveAudioPlan = reactiveDirector.getReactiveAudioPlan;
