import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const historyPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-history.json");

let historyCache = null;

async function readHistory() {
  if (historyCache) return historyCache;
  try {
    historyCache = JSON.parse(await readFile(historyPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    historyCache = { answeredQuestionIds: [] };
  }
  historyCache.answeredQuestionIds ||= [];
  return historyCache;
}

async function writeHistory(history) {
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
}

export async function answeredQuestionIds() {
  const history = await readHistory();
  return new Set(history.answeredQuestionIds);
}

export async function markQuestionAnswered(questionId) {
  if (!questionId) return;
  const history = await readHistory();
  if (history.answeredQuestionIds.includes(questionId)) return;
  history.answeredQuestionIds.push(questionId);
  await writeHistory(history);
}
