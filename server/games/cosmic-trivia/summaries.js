import { stateKey, rankPlayersByScore } from "./state.js";

export function buildFinalHypeSummaries(room) {
  const state = stateKey(room);
  const history = Array.isArray(state.questionHistory) ? state.questionHistory : [];
  const summaries = [];

  const onlyOneCorrect = history.find(entry => entry.rewardCount === 1);
  if (onlyOneCorrect) {
    summaries.push({ id: "only-one-correct", kind: "only-one-correct", text: "有一题只有一位玩家答对。" });
  }

  const everyoneMissed = history.find(entry => entry.rewardCount === 0);
  if (everyoneMissed) {
    summaries.push({ id: "everyone-missed", kind: "everyone-missed", text: "有一题把所有人都难住了。" });
  }

  const streaks = new Map();
  let bestStreak = 0;
  for (const entry of history) {
    const winners = new Set(entry.winnerIds || []);
    for (const player of room.players.values()) {
      const next = winners.has(player.id) ? (streaks.get(player.id) || 0) + 1 : 0;
      streaks.set(player.id, next);
      bestStreak = Math.max(bestStreak, next);
    }
  }
  if (bestStreak >= 2) {
    summaries.push({ id: "best-streak", kind: "best-streak", text: `有人打出了连续答对 ${bestStreak} 题的节奏。` });
  }

  const rankedIds = rankPlayersByScore(room, state.scores || {});
  const firstScore = state.scores?.[rankedIds[0]] || 0;
  const secondScore = state.scores?.[rankedIds[1]] || 0;
  if (rankedIds.length >= 2 && Math.abs(firstScore - secondScore) <= 100) {
    summaries.push({ id: "close-finish", kind: "close-finish", text: "最终结果相当接近，胜负还没有揭晓。" });
  }

  if (!summaries.length) {
    summaries.push({ id: "round-energy", kind: "round-energy", text: "这局一路都有变化，最后的结果还藏着呢。" });
  }

  return summaries.slice(0, 3);
}
