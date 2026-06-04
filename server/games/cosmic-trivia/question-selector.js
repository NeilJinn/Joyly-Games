import { loadQuestionPack, loadQuestionsById } from "./content-loader.js";

function playerPreferenceVotes(players) {
  const categoryVotes = new Map();
  const tagVotes = new Map();

  for (const player of players) {
    const preferences = player.preferences || {};
    for (const category of preferences.categories || []) {
      categoryVotes.set(category, (categoryVotes.get(category) || 0) + 1);
    }
    for (const tag of preferences.tags || []) {
      tagVotes.set(tag, (tagVotes.get(tag) || 0) + 1);
    }
  }

  return { categoryVotes, tagVotes };
}

function scoreQuestion(entry, votes) {
  let score = 1;
  score += (votes.categoryVotes.get(entry.category) || 0) * 3;
  for (const tag of entry.tags || []) score += (votes.tagVotes.get(tag) || 0) * 2;
  return score;
}

function deterministicNoise(seed, index) {
  let hash = 0;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash / 0xffffffff;
}

export async function selectRoundQuestions({ players, roundSize, packId = "core", seed = Date.now(), answeredIds = new Set() }) {
  const pack = await loadQuestionPack(packId);
  const votes = playerPreferenceVotes(players);
  const targetSize = Math.min(roundSize || pack.roundSize || 8, pack.questions.length);
  const weighted = pack.questions.map((entry, index) => ({
    ...entry,
    weight: scoreQuestion(entry, votes),
    wasAnswered: answeredIds.has(entry.id),
    noise: deterministicNoise(seed, index)
  }));

  weighted.sort((a, b) => {
    if (a.wasAnswered !== b.wasAnswered) return a.wasAnswered ? 1 : -1;
    return (b.weight + b.noise) - (a.weight + a.noise);
  });
  const selectedEntries = weighted.slice(0, targetSize);
  const selectedQuestions = await loadQuestionsById(selectedEntries.map(entry => entry.id), packId);

  return {
    packId: pack.id,
    roundSize: targetSize,
    selection: selectedEntries.map(entry => ({
      id: entry.id,
      category: entry.category,
      tags: entry.tags,
      difficulty: entry.difficulty,
      weight: entry.weight,
      wasAnswered: entry.wasAnswered
    })),
    questions: selectedQuestions
  };
}
