function currentSummaryText(context = {}) {
  return context.finalHype?.current?.text || "结果马上揭晓。";
}

export const COSMIC_TRIVIA_PHASES = {
  "game-setup": {
    kind: "hold",
    message: "Choose how many questions to play"
  },
  preferences: {
    kind: "timer",
    timerMs: 35_000,
    message: "Choose your categories and keywords"
  },
  "interest-reveal": { kind: "audio-advance", message: "Revealing your interests..." },
  "round-prep": {
    kind: "audio-advance",
    message: "Loading the round"
  },
  "question-intro": {
    kind: "audio-advance",
    message: context =>
      context.isFinalQuestion
        ? "Final question coming up"
        : `Question ${Number(context.questionIndex || 0) + 1} is coming up`
  },
  "question-read": {
    kind: "audio-advance",
    message: ""
  },
  answering: {
    kind: "timer-and-audio",
    timerMs: 25_000,
    message: context =>
      Number(context.questionIndex || 0) === 0
        ? "What do you think? Please answer on your phone"
        : context.isFinalQuestion
          ? "Final answers. Lock it in now"
          : "Answer before time runs out"
  },
  "answer-lock": {
    kind: "timer",
    timerMs: 1_200,
    message: "Answers locked"
  },
  reveal: {
    kind: "timer-and-audio",
    timerMs: 2_200,
    message: context => {
      const winners = Number(context.lastResolution?.rewardCount || 0);
      if (winners === 0) return "No one got it right";
      if (winners === 1) return "Only one player got that one";
      if (context.lastResolution?.everyoneCorrect) return "Everyone got it right";
      return "Here is the answer";
    }
  },
  scoring: {
    kind: "timer-and-audio",
    timerMs: 2_400,
    message: context =>
      context.scoreVisibility === "hidden"
        ? "Scores are changing behind the scenes"
        : "Scores are moving"
  },
  "between-questions": {
    kind: "audio-advance",
    message: context =>
      context.isFinalQuestion ? "Final question coming up" : "Next question coming up"
  },
  "final-hype": {
    kind: "timer-and-audio",
    timerMs: 2_600,
    message: context => currentSummaryText(context)
  },
  finale: {
    kind: "audio-advance",
    message: "Final results are coming up"
  },
  "post-game": {
    kind: "hold",
    message: "Final scores"
  }
};

export const COSMIC_TRIVIA_AUDIO_ADVANCE_FALLBACK_MS = {
  "interest-reveal": 500,
  "round-prep": 3_500,
  "question-intro": 3_500,
  "question-read": 12_000,
  "between-questions": 3_200,
  finale: 4_500
};
