import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dbPath = path.join(projectRoot, "content", "voice-library", "voice-library.sqlite");
const outputPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs", "core.json");

function parseTags(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }
}

function fail(errors) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function questionFromRow(row, errors, seenIds) {
  const id = String(row.id || "").trim();
  const category = String(row.category || "").trim();
  const tags = parseTags(row.tags_json);
  const difficulty = String(row.difficulty || "").trim();
  const question = String(row.question || "").trim();
  const answerA = String(row.answer_a || "").trim();
  const answerB = String(row.answer_b || "").trim();
  const answerC = String(row.answer_c || "").trim();
  const answerD = String(row.answer_d || "").trim();
  const correctAnswer = String(row.correct_answer || "").trim().toLowerCase();
  const fact = String(row.fact || "").trim();
  const questionAudio = String(row.question_audio || "").trim();

  const label = `Row ${id || "(unknown)"}`;

  if (!id) errors.push(`${label}: id is required`);
  if (!category) errors.push(`${label} (${id || "missing id"}): category is required`);
  if (!tags.length) errors.push(`${label} (${id || "missing id"}): tags is required`);
  if (!difficulty) errors.push(`${label} (${id || "missing id"}): difficulty is required`);
  if (!question) errors.push(`${label} (${id || "missing id"}): question is required`);
  if (!answerA || !answerB || !answerC || !answerD) errors.push(`${label} (${id || "missing id"}): all four answers are required`);
  if (!fact) errors.push(`${label} (${id || "missing id"}): fact is required`);
  if (!questionAudio) errors.push(`${label} (${id || "missing id"}): questionAudio is required`);
  if (!["a", "b", "c", "d"].includes(correctAnswer)) {
    errors.push(`${label} (${id || "missing id"}): correctAnswer must be a, b, c, or d`);
  }

  if (id) {
    if (seenIds.has(id)) errors.push(`${label}: duplicate id "${id}"`);
    seenIds.add(id);
  }

  const answers = [
    { id: "a", text: answerA },
    { id: "b", text: answerB },
    { id: "c", text: answerC },
    { id: "d", text: answerD }
  ];

  if (["a", "b", "c", "d"].includes(correctAnswer) && !answers.some(answer => answer.id === correctAnswer && answer.text)) {
    errors.push(`${label} (${id || "missing id"}): correctAnswer must point to a filled answer`);
  }

  if (errors.length) return null;

  return {
    id,
    category,
    tags,
    difficulty,
    question,
    answers,
    correctAnswer,
    fact,
    questionAudio
  };
}

async function main() {
  const db = new DatabaseSync(dbPath);
  const rows = db.prepare(
    "SELECT * FROM questions WHERE game_id = 'cosmic-trivia' AND enabled = 1"
  ).all();
  db.close();

  const errors = [];
  const questions = [];
  const seenIds = new Set();

  if (!rows.length) {
    errors.push("No enabled questions found in the database.");
  }

  for (const row of rows) {
    const question = questionFromRow(row, errors, seenIds);
    if (question) questions.push(question);
  }

  if (errors.length) {
    console.error("Cosmic Trivia build failed.");
    fail(errors);
    return;
  }

  const pack = {
    id: "core",
    title: "Core Trivia",
    roundSize: 8,
    questions
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Built ${questions.length} question(s) into ${outputPath}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
