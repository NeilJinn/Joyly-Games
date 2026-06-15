import { createDirectorFlow } from "../../../shared/director/flow.js";
import { createReactiveDirector } from "../../../shared/director/cues.js";
import { COSMIC_TRIVIA_PHASES } from "../../../shared/director/cosmic-trivia-phases.js";
import { getPhaseEntryCues, getTriggeredCues, pickCueVariant } from "../director/cue-library.js";

function cueAudio(cueKey, seed = "") {
  return pickCueVariant(cueKey, seed);
}

function firstPlayableCue(cues = [], seed = "") {
  for (const cue of cues) {
    const audio = cueAudio(cue.cueKey, `${seed}:${cue.cueKey}`);
    if (audio.length) return audio;
  }
  return [];
}

function phaseEntryAudio(phase, context = {}) {
  return firstPlayableCue(getPhaseEntryCues(phase), cueSeed(context, `auto:${phase}`));
}

function eventAudio({ phase = "", eventKey = "" } = {}, context = {}) {
  return firstPlayableCue(
    getTriggeredCues({
      triggerMode: "event-match",
      phase,
      eventKey
    }),
    cueSeed(context, eventKey)
  );
}

function withPhaseEntryFallback(phase, audioSelector) {
  return context => {
    const configured = typeof audioSelector === "function" ? audioSelector(context) : [];
    return configured.length ? configured : phaseEntryAudio(phase, context);
  };
}

// Phase audio layer — merges shared timing/message schema with audio config.
// kind/timerMs/message come from COSMIC_TRIVIA_PHASES and are not repeated here.
const PHASE_AUDIO = {
  preferences: {
    audio: context => cueAudio(
      "phase.preferences.selection.intro",
      `${context.roomCode || ""}:${context.playCount || 1}:phase.preferences.selection.intro:${context.questionIndex || 0}`
    )
  },
  "round-prep": {
    audio: context => cueAudio("phase.round-prep.round.loading", cueSeed(context, "round-prep"))
  },
  "question-intro": {
    audio: context => cueAudio(
      "phase.question-intro.question.next",
      `${context.roomCode || ""}:phase.question-intro.question.next:${context.questionIndex || 0}:${context.playCount || 1}`
    ),
    segmentPauseMultiplier: 0.12
  },
  "question-read": {
    audio: context => context.questionAudio ? [context.questionAudio] : []
  },
  "answer-lock": {
    audio: context => cueAudio("phase.answer-lock.answer.locked", cueSeed(context, "answer-lock"))
  },
  "between-questions": {
    audio: context => cueAudio(
      "phase.between-questions.transition.next",
      `${context.roomCode || ""}:phase.between-questions.transition.next:${context.questionIndex || 0}:${context.playCount || 1}`
    ),
    segmentPauseMultiplier: 0.12
  },
  finale: {
    audio: context => cueAudio("phase.finale.result.incoming", cueSeed(context, "finale")),
    segmentPauseMultiplier: 0.2,
    segmentPauseMaxMs: 1800
  },
  "post-game": {
    audio: context => cueAudio("phase.post-game.result.outro", cueSeed(context, "post-game"))
  }
};

const mergedPhases = Object.fromEntries(
  Object.entries(COSMIC_TRIVIA_PHASES).map(([phase, base]) => {
    const configured = PHASE_AUDIO[phase] || {};
    return [
      phase,
      {
        ...base,
        ...configured,
        audio: withPhaseEntryFallback(phase, configured.audio)
      }
    ];
  })
);

const cosmicTriviaDirector = createDirectorFlow({ phases: mergedPhases });

function cueSeed(context = {}, cueId = "") {
  return [
    context.roomCode || "",
    context.playCount || 1,
    cueId,
    context.questionIndex || 0,
    context.questionId || "",
    context.rewardCount || 0,
    context.finalHype?.index || 0
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
    rewardCount: Number(nextSnapshot.lastResolution?.rewardCount || context.lastResolution?.rewardCount || 0),
    scoreVisibility: context.scoreVisibility || nextSnapshot.scoreVisibility || "visible",
    finalHype: context.finalHype || nextSnapshot.finalHype || null
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

function scoreVisibilityJustHidden(previousSnapshot, nextSnapshot) {
  return previousSnapshot?.scoreVisibility !== "hidden" && nextSnapshot?.scoreVisibility === "hidden";
}

function answeringTimeCrossed(previousSnapshot, nextSnapshot, thresholdMs) {
  if (!previousSnapshot || !nextSnapshot) return false;
  if (previousSnapshot.phase !== "answering" || nextSnapshot.phase !== "answering") return false;
  if (!nextSnapshot.questionId || previousSnapshot.questionId !== nextSnapshot.questionId) return false;

  const previousRemainingMs = Number(previousSnapshot.remainingMs || 0);
  const nextRemainingMs = Number(nextSnapshot.remainingMs || 0);
  return previousRemainingMs > thresholdMs && nextRemainingMs <= thresholdMs && nextRemainingMs > 0;
}

const reactiveDirector = createReactiveDirector({
  flow: cosmicTriviaDirector,
  rules: [
    {
      id: "phase:game-setup",
      when: runtime => runtime.phaseChanged && runtime.phase === "game-setup",
      select: runtime => {
        const context = phaseContext(runtime);
        const audio = phaseEntryAudio("game-setup", context);
        if (!audio.length) return null;
        return {
          id: "game-setup.question-count.selection",
          replayKey: `game-setup.question-count.selection:${cueSeed(context, "game-setup")}`,
          audio
        };
      }
    },
    {
      id: "phase:preferences",
      when: runtime => runtime.phaseChanged && runtime.phase === "preferences",
      select: runtime => ({
        id: "preferences.intro",
        replayKey: `preferences.intro:${cueSeed(phaseContext(runtime), "preferences.intro")}`,
        audio: cueAudio("phase.preferences.selection.intro", cueSeed(phaseContext(runtime), "preferences.intro"))
      })
    },
    {
      id: "phase:round-prep",
      when: runtime => runtime.phaseChanged && runtime.phase === "round-prep",
      select: () => ({
        id: "phase.round-prep.round.loading",
        replayKey: "phase.round-prep.round.loading",
        audio: cueAudio("phase.round-prep.round.loading", cueSeed(phaseContext(runtime), "round-prep"))
      })
    },
    {
      id: "phase:question-intro",
      when: runtime => runtime.phaseChanged && runtime.phase === "question-intro",
      select: runtime => ({
        id: "question.intro",
        replayKey: `question.intro:${cueSeed(phaseContext(runtime), "question.intro")}`,
        audio: cueAudio("phase.question-intro.question.next", cueSeed(phaseContext(runtime), "question.intro"))
      })
    },
    {
      id: "phase:question-read",
      when: runtime => runtime.phaseChanged && runtime.phase === "question-read",
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
        audio: cueAudio("phase.answering.answer.open", cueSeed(phaseContext(runtime), "answering-first"))
      })
    },
    {
      id: "phase:answering:answer:all-in",
      when: runtime => allAnsweredEarly(runtime.previousSnapshot, runtime.nextSnapshot),
      select: runtime => ({
        id: "answering.answer.all-in",
        replayKey: `answering.answer.all-in:${cueSeed(phaseContext(runtime), "answer-all-in")}`,
        audio: cueAudio("phase.answering.answer.all-in", cueSeed(phaseContext(runtime), "answer-all-in")),
        maxLateStartMs: 2_500
      })
    },
    {
      id: "phase:answering:time:critical",
      when: runtime => answeringTimeCrossed(runtime.previousSnapshot, runtime.nextSnapshot, 5_000),
      select: runtime => {
        const context = phaseContext(runtime);
        const eventKey = "phase.answering.time.critical";
        const audio = eventAudio({ phase: "answering", eventKey }, context);
        if (!audio.length) return null;
        return {
          id: "answering.time.critical",
          replayKey: `answering.time.critical:${cueSeed(context, "time-critical")}`,
          audio,
          maxLateStartMs: 1_200
        };
      }
    },
    {
      id: "phase:answering:time:warning",
      when: runtime => answeringTimeCrossed(runtime.previousSnapshot, runtime.nextSnapshot, 10_000),
      select: runtime => {
        const context = phaseContext(runtime);
        const eventKey = "phase.answering.time.warning";
        const audio = eventAudio({ phase: "answering", eventKey }, context);
        if (!audio.length) return null;
        return {
          id: "answering.time.warning",
          replayKey: `answering.time.warning:${cueSeed(context, "time-warning")}`,
          audio,
          maxLateStartMs: 1_800
        };
      }
    },
    {
      id: "phase:reveal:no-correct",
      when: runtime => runtime.phaseChanged && runtime.phase === "reveal" && Number(runtime.context.lastResolution?.rewardCount || 0) <= 0,
      select: runtime => ({
        id: "reveal.no-correct",
        replayKey: `reveal.no-correct:${cueSeed(phaseContext(runtime), "reveal-no-correct")}`,
        audio: cueAudio("phase.reveal.answer.no-one-correct", cueSeed(phaseContext(runtime), "reveal-no-correct"))
      })
    },
    {
      id: "phase:reveal:positive",
      when: runtime => runtime.phaseChanged && runtime.phase === "reveal" && Number(runtime.context.lastResolution?.rewardCount || 0) > 0,
      select: runtime => ({
        id: "reveal.positive",
        replayKey: `reveal.positive:${cueSeed(phaseContext(runtime), "reveal-positive")}`,
        audio: cueAudio("phase.reveal.answer.positive", cueSeed(phaseContext(runtime), "reveal-positive"))
      })
    },
    {
      id: "global:score:hidden:started",
      when: runtime => scoreVisibilityJustHidden(runtime.previousSnapshot, runtime.nextSnapshot),
      select: runtime => ({
        id: "score.hidden.started",
        replayKey: `score.hidden.started:${cueSeed(phaseContext(runtime), "score-hidden-start")}`,
        audio: cueAudio("global.score.hidden.started", cueSeed(phaseContext(runtime), "score-hidden-start"))
      })
    },
    {
      id: "phase:between-questions",
      when: runtime => runtime.phaseChanged && runtime.phase === "between-questions",
      select: runtime => ({
        id: "transition.next-question",
        replayKey: `transition.next-question:${cueSeed(phaseContext(runtime), "next-question")}`,
        audio: cueAudio("phase.between-questions.transition.next", cueSeed(phaseContext(runtime), "next-question"))
      })
    },
    {
      id: "phase:final-hype",
      when: runtime => runtime.phaseChanged && runtime.phase === "final-hype",
      select: runtime => ({
        id: "final-hype.summary-line",
        replayKey: `final-hype.summary-line:${cueSeed(phaseContext(runtime), "final-hype")}:${phaseContext(runtime).finalHype?.index || 0}`,
        audio: [],
        duckMusic: false
      })
    },
    {
      id: "phase:finale",
      when: runtime => runtime.phaseChanged && runtime.phase === "finale",
      select: () => ({
        id: "finale.intro",
        replayKey: "finale.intro",
        audio: cueAudio("phase.finale.result.incoming", cueSeed(phaseContext(runtime), "finale"))
      })
    },
    {
      id: "phase:post-game",
      when: runtime => runtime.phaseChanged && runtime.phase === "post-game",
      select: () => ({
        id: "post-game.outro",
        replayKey: "post-game.outro",
        audio: cueAudio("phase.post-game.result.outro", cueSeed(phaseContext(runtime), "post-game"))
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
