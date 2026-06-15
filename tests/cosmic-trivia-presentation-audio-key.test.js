import test from "node:test";
import assert from "node:assert/strict";

import { audioPlanPlaybackKey } from "../public/games/cosmic-trivia/presentation-audio-keys.js";

test("presentation audio identity prefers the replay key used by reactive director plans", () => {
  const key = audioPlanPlaybackKey(
    {
      phase: "reveal",
      replayKey: "reveal.positive:room:question",
      segments: [{ src: "/voice/reveal.mp3" }]
    },
    {
      playCount: 1,
      questionId: "q1"
    }
  );

  assert.equal(key, "reveal.positive:room:question");
});
