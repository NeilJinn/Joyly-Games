// Canonical event vocabulary for Cosmic Trivia.
// Server uses these constants when emitting events to the director layer.
// Frontend event detectors (allAnsweredEarly, scoreVisibilityJustHidden, etc.)
// live in director-flow.js and read from public state snapshots.

// ── Phase-local events ────────────────────────────────────────────────────────
// Scoped to a single phase; only meaningful while inside that phase.
export const EVT = {
  // phase: answering
  ANSWERING_ALL_ANSWERS_IN: "phase.answering.answer.all-in",
  ANSWERING_TIME_WARNING:   "phase.answering.time.warning",
  ANSWERING_TIME_CRITICAL:  "phase.answering.time.critical",

  // phase: reveal
  REVEAL_NO_ONE_CORRECT:    "phase.reveal.answer.no-one-correct",
  REVEAL_EVERYONE_CORRECT:  "phase.reveal.answer.everyone-correct",
  REVEAL_ONLY_ONE_CORRECT:  "phase.reveal.answer.only-one-correct",

  // phase: scoring
  SCORING_NEW_LEADER:       "phase.scoring.leader.new",
  SCORING_RANK_BIG_JUMP:    "phase.scoring.rank.big-jump",

  // phase: final-hype
  FINAL_HYPE_ONLY_ONE:      "phase.final-hype.summary.only-one-correct",
  FINAL_HYPE_EVERYONE_MISS: "phase.final-hype.summary.everyone-missed",
  FINAL_HYPE_BEST_STREAK:   "phase.final-hype.summary.best-streak",
  FINAL_HYPE_CLOSE_FINISH:  "phase.final-hype.summary.close-finish",
  FINAL_HYPE_ROUND_ENERGY:  "phase.final-hype.summary.round-energy",

  // ── Cross-phase events ──────────────────────────────────────────────────────
  // Can occur in multiple phases; director response may vary by current phase.
  SCORE_HIDDEN_STARTED:     "global.score.hidden.started",
  GAME_FINAL_QUESTION_ARMED:"cross.game.final-question-armed",
  GAME_FINAL_QUESTION_ENDED:"cross.game.final-question-ended",

  // ── Global insert events ────────────────────────────────────────────────────
  // May interrupt playback at any point.
  SKIP_REQUESTED:           "global.host.skip-requested",
  STREAK_DETECTED:          "cross.stats.streak.detected",
  RARE_STAT_DETECTED:       "global.stats.rare-stat.detected"
};

// ── Server-side event detection ───────────────────────────────────────────────
// These run after state transitions and return the canonical event key,
// or null if the event did not occur.

export function detectRevealEvent(resolution) {
  if (!resolution) return null;
  if (resolution.noOneCorrect) return EVT.REVEAL_NO_ONE_CORRECT;
  if (resolution.everyoneCorrect) return EVT.REVEAL_EVERYONE_CORRECT;
  if (resolution.rewardCount === 1) return EVT.REVEAL_ONLY_ONE_CORRECT;
  return null;
}

export function detectFinalHypeKind(summary) {
  if (!summary?.kind) return null;
  return EVT[`FINAL_HYPE_${summary.kind.replace(/-/g, "_").toUpperCase()}`] || null;
}
