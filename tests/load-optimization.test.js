import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getReactiveAudioPlan } from "../public/games/cosmic-trivia/audio/director-flow.js";
import { publicCosmicTriviaState } from "../server/games/cosmic-trivia.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function makeSnapshot(overrides = {}) {
  return {
    phase: "",
    questionId: "q1",
    playCount: 1,
    questionIndex: 0,
    totalQuestions: 5,
    questionAudio: "/audio/q1.mp3",
    lastResolution: null,
    answersCount: 0,
    expectedAnswerCount: 4,
    remainingMs: 20_000,
    ...overrides
  };
}

function planForPhase(phase, questionAudio = "/audio/q1.mp3", previousPhase = "round-prep") {
  return getReactiveAudioPlan(
    makeSnapshot({ phase: previousPhase, questionAudio: "" }),
    makeSnapshot({ phase, questionAudio }),
    {
      roomCode: "ROOM1",
      playCount: 1,
      questionIndex: 0,
      questionAudio,
      isLastQuestion: false,
      lastResolution: null
    }
  );
}

test("cosmic trivia client keeps presentation behind a dynamic import", async () => {
  const source = await readFile(path.join(projectRoot, "public/games/cosmic-trivia/client.js"), "utf8");
  assert.match(source, /import\("\.\/presentation\.js"\)/);
  assert.doesNotMatch(source, /import\s+\{\s*hydrateTriviaHostPresentation\s*\}\s+from\s+"\.\/presentation\.js"/);
});

test("question audio is not scheduled before question-read phase", () => {
  const phases = ["preferences", "round-prep", "question-intro"];
  for (const phase of phases) {
    const plan = planForPhase(phase);
    assert.equal(
      plan.segments.some(segment => segment.src === "/audio/q1.mp3"),
      false,
      `question audio should stay idle during ${phase}`
    );
  }
});

test("question audio starts exactly at question-read phase", () => {
  const plan = planForPhase("question-read", "/audio/q1.mp3", "question-intro");
  assert.deepEqual(
    plan.segments.map(segment => segment.src),
    ["/audio/q1.mp3"]
  );
});

test("next question audio is not exposed for preload in public trivia state", () => {
  const room = {
    code: "ROOM1",
    players: new Map([
      ["p1", { id: "p1", joinedAt: 1 }],
      ["p2", { id: "p2", joinedAt: 2 }]
    ]),
    gameContent: {
      questions: [
        {
          id: "q1",
          category: "science",
          tags: ["ai"],
          difficulty: "easy",
          question: "Question 1",
          answers: [{ id: "a", text: "A" }],
          correctAnswer: "a",
          fact: "Fact 1",
          questionAudio: "/audio/q1.mp3"
        },
        {
          id: "q2",
          category: "science",
          tags: ["space"],
          difficulty: "easy",
          question: "Question 2",
          answers: [{ id: "b", text: "B" }],
          correctAnswer: "b",
          fact: "Fact 2",
          questionAudio: "/audio/q2.mp3"
        }
      ],
      options: { categories: ["science"], tags: ["ai", "space"] },
      selection: [{ id: "q1" }, { id: "q2" }]
    },
    gameState: {
      playCount: 1,
      questionIndex: 0,
      phase: "question-intro",
      phaseStartedAt: Date.now(),
      scores: { p1: 0, p2: 0 },
      answers: {},
      playerStates: {
        p1: { preferences: { categories: [], tags: [] }, preferencesLocked: false },
        p2: { preferences: { categories: [], tags: [] }, preferencesLocked: false }
      },
      tester: { selectedPlayerId: null },
      roundSize: 2,
      lastResolution: null
    }
  };

  const state = publicCosmicTriviaState(room);
  assert.equal(state.currentQuestion?.questionAudio, "/audio/q1.mp3");
  assert.equal("preloadAudio" in state, false);
});
