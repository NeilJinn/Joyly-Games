// Source of truth for Cosmic Trivia host director audio variants.
// Data mirrors content/games/cosmic-trivia/director/cues.json.
// To add a new variant: add the path to the correct cueKey entry below.

const CUE_VARIANTS = {
    "phase.preferences.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/preferences/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/preferences/default/line-02.mp3"
  ],
    "phase.round-prep.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/round-prep/default/line-01.mp3"
  ],
    "phase.question-intro.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/question-intro/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/question-intro/default/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/question-intro/default/line-03.mp3"
  ],
    "phase.answering.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/answering/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/answering/default/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/answering/default/line-03.mp3"
  ],
    "phase.answer-lock.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/answer-lock/default/line-01.mp3"
  ],
    "phase.scoring.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/scoring/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/scoring/default/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/scoring/default/line-03.mp3"
  ],
    "phase.between-questions.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/between-questions/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/between-questions/default/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/between-questions/default/line-03.mp3"
  ],
    "phase.finale.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/finale/default/line-01.mp3"
  ],
    "phase.post-game.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/post-game/default/line-01.mp3"
  ],
    "event.reveal.no-one-correct": [
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/no-one-correct/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/no-one-correct/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/no-one-correct/line-03.mp3"
  ],
    "event.answering.all-answers-in": [
    "/games/cosmic-trivia/audio/host/director/phase/event/answering/all-answers-in/line-03.mp3"
  ],
    "global.score.hidden-started": [
    "/games/cosmic-trivia/audio/host/director/global/event/score/hidden-started/line-02.mp3"
  ],
    "phase.reveal.default": [
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/default/line-01.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/default/line-02.mp3",
    "/games/cosmic-trivia/audio/host/director/phase/event/reveal/default/line-03.mp3"
  ]
};

// Fallback chain: exact-cue -> phase.<phase>.default -> global.game.default -> silent
const FALLBACK_ORDER = ["exact-cue", "phase.default", "global.game.default", "silent"];

function phaseDefaultKey(cueKey) {
  const parts = String(cueKey || "").split(".");
  const scope = parts[0];
  if (scope === "event" && parts[1]) return `phase.${parts[1]}.default`;
  if (scope === "global") return "global.game.default";
  return null;
}

export function getCueVariants(cueKey) {
  const direct = CUE_VARIANTS[cueKey];
  if (direct?.length) return direct;

  const phaseDefault = phaseDefaultKey(cueKey);
  if (phaseDefault && CUE_VARIANTS[phaseDefault]?.length) return CUE_VARIANTS[phaseDefault];

  const globalDefault = CUE_VARIANTS["global.game.default"];
  if (globalDefault?.length) return globalDefault;

  return [];
}

export function hasCueVariants(cueKey) {
  return getCueVariants(cueKey).length > 0;
}

export { CUE_VARIANTS, FALLBACK_ORDER };
