import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCountdownSnapshot,
  buildCountdownCssVars,
  nextCountdownRefreshDelay
} from "../public/games/cosmic-trivia/countdown.js";

test("countdown snapshot tracks elapsed time for continuous bar animation", () => {
  const snapshot = buildCountdownSnapshot({
    phaseEndsAt: 12_000,
    phaseDurationMs: 10_000
  }, 9_250);

  assert.equal(snapshot.seconds, 3);
  assert.equal(snapshot.remainingMs, 2_750);
  assert.equal(snapshot.elapsedMs, 7_250);
  assert.equal(snapshot.progress, 0.725);
  assert.equal(snapshot.urgency, "danger");
});

test("countdown css vars expose absolute duration and elapsed offsets", () => {
  const cssVars = buildCountdownCssVars({
    seconds: 1,
    remainingMs: 900,
    elapsedMs: 9_100,
    durationMs: 10_000,
    progress: 0.91,
    urgency: "danger"
  });

  assert.equal(cssVars, "--countdown-duration-ms:10000ms;--countdown-elapsed-ms:9100ms;--countdown-progress:0.91");
});

test("countdown refresh delay aligns with the next visible second change", () => {
  assert.equal(nextCountdownRefreshDelay([2_750, 9_999]), 750);
  assert.equal(nextCountdownRefreshDelay([5_000]), 1_000);
  assert.equal(nextCountdownRefreshDelay([]), 1_000);
});
