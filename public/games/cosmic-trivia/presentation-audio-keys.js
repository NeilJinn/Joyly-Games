export function audioPlanPlaybackKey(plan = {}, snapshot = {}) {
  if (plan.replayKey) return String(plan.replayKey);
  const segments = Array.isArray(plan.segments) ? plan.segments : [];
  return `${plan.phase || ""}:${segments.map(segment => segment.src).join("|")}:${snapshot?.playCount || 1}:${snapshot?.questionId || ""}`;
}
