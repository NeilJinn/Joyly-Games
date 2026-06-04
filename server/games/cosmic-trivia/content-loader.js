import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const contentRoot = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs");
const defaultPackId = "core";

const packCache = new Map();

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function loadQuestionPack(packId = defaultPackId) {
  if (packCache.has(packId)) return packCache.get(packId);
  const packPath = path.join(contentRoot, `${packId}.json`);
  const pack = await readJson(packPath);
  packCache.set(packId, pack);
  return pack;
}

export async function getQuestionOptions(packId = defaultPackId) {
  const pack = await loadQuestionPack(packId);
  const categories = new Set();
  const tags = new Set();
  const difficulties = new Set();

  for (const question of pack.questions || []) {
    if (question.category) categories.add(question.category);
    for (const tag of question.tags || []) tags.add(tag);
    if (question.difficulty) difficulties.add(question.difficulty);
  }

  return {
    packId: pack.id,
    title: pack.title,
    roundSize: pack.roundSize,
    categories: [...categories],
    tags: [...tags],
    difficulties: [...difficulties]
  };
}

export async function loadQuestionsById(questionIds, packId = defaultPackId) {
  const pack = await loadQuestionPack(packId);
  const byId = new Map((pack.questions || []).map(question => [question.id, question]));
  return questionIds.map(questionId => byId.get(questionId)).filter(Boolean);
}

export function audioForQuestion(question) {
  if (!question) return {};
  return {
    questionAudio: question.questionAudio || "",
    answerAudio: question.answerAudio || ""
  };
}
