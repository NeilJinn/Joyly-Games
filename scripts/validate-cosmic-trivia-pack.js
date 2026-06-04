import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function fail(errors) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function validateQuestion(question, index, seenIds, errors) {
  const prefix = `questions[${index}]`;

  if (!question || typeof question !== "object") {
    errors.push(`${prefix} must be an object`);
    return;
  }

  if (!question.id || String(question.id).trim() === "") errors.push(`${prefix}.id is required`);
  else if (seenIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`);
  else seenIds.add(question.id);

  if (!String(question.question || "").trim()) errors.push(`${question.id || prefix}.question is empty`);
  if (!Array.isArray(question.answers) || question.answers.length !== 4) {
    errors.push(`${question.id || prefix}.answers must contain exactly 4 items`);
  }
  const answerIds = new Set((question.answers || []).map(answer => answer?.id));
  if (!String(question.correctAnswer || "").trim() || !answerIds.has(question.correctAnswer)) {
    errors.push(`${question.id || prefix}.correctAnswer must match one of the 4 answers`);
  }
  if (!String(question.category || "").trim()) errors.push(`${question.id || prefix}.category is empty`);
  if (!Array.isArray(question.tags)) errors.push(`${question.id || prefix}.tags must be an array`);
  if (!String(question.difficulty || "").trim()) errors.push(`${question.id || prefix}.difficulty is empty`);
  if (!String(question.fact || "").trim()) errors.push(`${question.id || prefix}.fact is empty`);
  if (!String(question.questionAudio || "").trim()) errors.push(`${question.id || prefix}.questionAudio is empty`);
  if (!String(question.answerAudio || "").trim()) errors.push(`${question.id || prefix}.answerAudio is empty`);
}

async function main() {
  const packId = String(process.argv[2] || "core").trim();
  const packPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs", `${packId}.json`);
  const pack = await readJson(packPath);
  const errors = [];

  if (!String(pack.id || "").trim()) errors.push("pack.id is required");
  if (!String(pack.title || "").trim()) errors.push("pack.title is required");
  if (!Number.isFinite(Number(pack.roundSize)) || Number(pack.roundSize) <= 0) {
    errors.push("pack.roundSize must be a positive number");
  }
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    errors.push("pack.questions must contain at least one question");
  }

  const seenIds = new Set();
  for (const [index, question] of (pack.questions || []).entries()) {
    validateQuestion(question, index, seenIds, errors);
  }

  if (errors.length) {
    console.error(`Cosmic Trivia pack validation failed for ${packId}.json`);
    fail(errors);
    return;
  }

  console.log(`Cosmic Trivia pack ${packId}.json is valid.`);
  console.log(`Questions: ${pack.questions.length}`);
  console.log(`Categories: ${new Set(pack.questions.map(q => q.category).filter(Boolean)).size}`);
  console.log(`Tags: ${new Set(pack.questions.flatMap(q => q.tags || [])).size}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
