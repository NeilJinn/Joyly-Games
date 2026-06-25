import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceCosmicTrivia,
  directorDelay,
  enterPhase
} from "../server/games/cosmic-trivia/flow.js";
import { directorAudioEnded, directorAudioStarted, directorAudioStatus } from "../server/games/cosmic-trivia.js";

function roomInPhase(phase, overrides = {}) {
  return {
    code: "1234",
    players: new Map(),
    gameContent: {
      questions: [
        {
          id: "q1",
          answers: [{ id: "a" }],
          correctAnswer: "a"
        }
      ]
    },
    gameState: {
      playCount: 1,
      phase,
      phaseStartedAt: Date.now() - 10_000,
      questionIndex: 0,
      totalQuestions: 1,
      questionCount: 1,
      answers: {},
      scores: {},
      playerStates: {},
      lastResolution: { rewardCount: 1 },
      finalHypeSummaries: [],
      finalHypeIndex: 0,
      scoreVisibility: "visible",
      leaderboardFrozen: false,
      tester: { selectedPlayerId: null },
      privateStateVersion: 1,
      ...overrides
    }
  };
}

test("timer-and-audio phases wait for both timer and audio before advancing", async () => {
  const room = roomInPhase("reveal");
  enterPhase(room, "reveal", { startedAt: Date.now() - 10_000 });
  await directorAudioStarted(room, "reveal", "reveal-a");

  assert.equal(directorDelay(room), null);

  const timerOnlyAdvance = await advanceCosmicTrivia(room);
  assert.equal(timerOnlyAdvance?.advanced, false);
  assert.equal(room.gameState.phase, "reveal");

  const audioResult = await directorAudioEnded(room, "reveal", "reveal-a");
  assert.equal(audioResult.advanced, true);
  assert.equal(room.gameState.phase, "scoring");
});

test("timer-and-audio phases keep waiting when audio ends before the timer", async () => {
  const room = roomInPhase("reveal");
  enterPhase(room, "reveal", { startedAt: Date.now() });
  await directorAudioStarted(room, "reveal", "reveal-a");

  const audioResult = await directorAudioEnded(room, "reveal", "reveal-a");
  assert.equal(audioResult.advanced, false);
  assert.equal(room.gameState.phase, "reveal");
  assert.equal(directorDelay(room) > 0, true);

  room.gameState.phaseStartedAt = Date.now() - 10_000;
  const timerResult = await advanceCosmicTrivia(room);
  assert.equal(timerResult.advanced, true);
  assert.equal(room.gameState.phase, "scoring");
});

test("timer-and-audio phases wait for the latest cue started in the same phase", async () => {
  const room = roomInPhase("answering", {
    phaseStartedAt: Date.now() - 24_000,
    currentQuestion: { id: "q1" }
  });
  enterPhase(room, "answering", { startedAt: Date.now() - 24_000 });

  await directorAudioEnded(room, "answering");
  assert.equal(room.gameState.directorAudio.completed, true);

  await directorAudioStarted(room, "answering");
  assert.equal(room.gameState.directorAudio.completed, false);

  room.gameState.phaseStartedAt = Date.now() - 30_000;
  const timerResult = await advanceCosmicTrivia(room);
  assert.equal(timerResult.advanced, false);
  assert.equal(room.gameState.phase, "answering");

  const audioResult = await directorAudioEnded(room, "answering");
  assert.equal(audioResult.advanced, true);
  assert.equal(room.gameState.phase, "answer-lock");
});

test("timer-and-audio phases advance at timer end when no audio is active", async () => {
  const room = roomInPhase("answering", {
    phaseStartedAt: Date.now() - 30_000
  });
  enterPhase(room, "answering", { startedAt: Date.now() - 30_000 });

  const result = await advanceCosmicTrivia(room);
  assert.equal(result.advanced, true);
  assert.equal(room.gameState.phase, "answer-lock");
});

test("timer-and-audio phases do not stay blocked by queued audio that is not playing", async () => {
  const room = roomInPhase("answering", {
    phaseStartedAt: Date.now() - 30_000
  });
  enterPhase(room, "answering", { startedAt: Date.now() - 30_000 });

  const result = await directorAudioStatus(room, "answering", "warning", "queued");
  assert.equal(result.advanced, true);
  assert.equal(room.gameState.phase, "answer-lock");
});

test("audio-advance phases do not use fallback timers after audio has started", async () => {
  const room = roomInPhase("question-intro");
  enterPhase(room, "question-intro", { startedAt: Date.now() - 10_000 });

  await directorAudioStarted(room, "question-intro", "intro-a");

  assert.equal(directorDelay(room), null);
  const timerResult = await advanceCosmicTrivia(room);
  assert.equal(timerResult.advanced, false);
  assert.equal(room.gameState.phase, "question-intro");

  const audioResult = await directorAudioEnded(room, "question-intro", "intro-a");
  assert.equal(audioResult.advanced, true);
  assert.equal(room.gameState.phase, "question-read");
});

test("audio-advance phases keep waiting while a queued sequence has not finished yet", async () => {
  const room = roomInPhase("question-intro");
  enterPhase(room, "question-intro", { startedAt: Date.now() - 10_000 });

  await directorAudioStatus(room, "question-intro", "intro-a", "queued");

  assert.equal(directorDelay(room), null);

  const timerResult = await advanceCosmicTrivia(room);
  assert.equal(timerResult.advanced, false);
  assert.equal(room.gameState.phase, "question-intro");
});

test("audio-advance phases recover when playback is blocked before it can start", async () => {
  const room = roomInPhase("question-intro");
  enterPhase(room, "question-intro", { startedAt: Date.now() - 10_000 });

  await directorAudioStatus(room, "question-intro", "intro-a", "queued");
  const blockedResult = await directorAudioStatus(room, "question-intro", "intro-a", "blocked");

  assert.equal(blockedResult.advanced, true);
  assert.equal(room.gameState.phase, "question-read");
});

test("stale audio-ended events cannot complete a newer cue in the same phase", async () => {
  const room = roomInPhase("answering", {
    phaseStartedAt: Date.now() - 30_000
  });
  enterPhase(room, "answering", { startedAt: Date.now() - 30_000 });

  await directorAudioStarted(room, "answering", "warning");
  await directorAudioStarted(room, "answering", "critical");

  const staleResult = await directorAudioEnded(room, "answering", "warning");
  assert.equal(staleResult.advanced, false);
  assert.equal(room.gameState.phase, "answering");
  assert.equal(room.gameState.directorAudio.completed, false);

  const currentResult = await directorAudioEnded(room, "answering", "critical");
  assert.equal(currentResult.advanced, true);
  assert.equal(room.gameState.phase, "answer-lock");
});
