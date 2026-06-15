function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function countdownSecondsFromRemaining(remainingMs) {
  return Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000));
}

export function countdownUrgencyFromSeconds(seconds) {
  if (seconds <= 5) return "danger";
  if (seconds <= 10) return "warning";
  return "normal";
}

export function buildCountdownSnapshot(trivia, now = Date.now()) {
  const phaseEndsAt = Number(trivia?.phaseEndsAt || 0);
  const durationMs = Math.max(0, Number(trivia?.phaseDurationMs || 0));
  const remainingMs = Math.max(0, phaseEndsAt - Number(now || Date.now()));
  const elapsedMs = durationMs > 0 ? clamp(durationMs - remainingMs, 0, durationMs) : 0;
  const progress = durationMs > 0 ? clamp(elapsedMs / durationMs, 0, 1) : 0;
  const seconds = countdownSecondsFromRemaining(remainingMs);
  return {
    durationMs,
    remainingMs,
    elapsedMs,
    progress,
    seconds,
    urgency: countdownUrgencyFromSeconds(seconds)
  };
}

export function buildCountdownCssVars(snapshot) {
  const durationMs = Math.max(0, Number(snapshot?.durationMs || 0));
  const elapsedMs = clamp(Number(snapshot?.elapsedMs || 0), 0, durationMs);
  const progress = clamp(Number(snapshot?.progress || 0), 0, 1);
  return `--countdown-duration-ms:${durationMs}ms;--countdown-elapsed-ms:${elapsedMs}ms;--countdown-progress:${progress}`;
}

export function nextCountdownRefreshDelay(remainingValues = []) {
  const candidates = remainingValues
    .map(value => Math.max(0, Number(value) || 0))
    .filter(value => value > 0)
    .map(value => value % 1000 || 1000);
  if (!candidates.length) return 1000;
  return clamp(Math.min(...candidates), 50, 1000);
}
