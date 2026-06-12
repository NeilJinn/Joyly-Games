import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const authoringPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "authoring", "questions.xlsx");
const outputPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs", "core.json");

const columns = [
  "id",
  "category",
  "tags",
  "difficulty",
  "question",
  "answera",
  "answerb",
  "answerc",
  "answerd",
  "correctanswer",
  "fact",
  "questionaudio",
  "enabled"
];

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase();
}

function cellText(value) {
  return String(value ?? "").trim();
}

function isRowBlank(row) {
  return row.every(value => cellText(value) === "");
}

function parseTags(value) {
  return cellText(value)
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function parseEnabled(value) {
  const text = cellText(value).toLowerCase();
  if (text === "" || text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  throw new Error(`enabled must be true or false, got "${value}"`);
}

function fail(errors) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function questionFromRow(row, rowNumber, indexByColumn, errors, seenIds) {
  const get = name => row[indexByColumn[normalizeHeader(name)]];
  const enabled = parseEnabled(get("enabled"));
  if (!enabled) return null;

  const id = cellText(get("id"));
  const category = cellText(get("category"));
  const tags = parseTags(get("tags"));
  const difficulty = cellText(get("difficulty"));
  const question = cellText(get("question"));
  const answerA = cellText(get("answerA"));
  const answerB = cellText(get("answerB"));
  const answerC = cellText(get("answerC"));
  const answerD = cellText(get("answerD"));
  const correctAnswer = cellText(get("correctAnswer")).toLowerCase();
  const fact = cellText(get("fact"));
  const questionAudio = cellText(get("questionAudio"));

  const label = `Row ${rowNumber}`;

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

async function loadWorkbook() {
  const input = await FileBlob.load(authoringPath);
  return SpreadsheetFile.importXlsx(input);
}

async function main() {
  const workbook = await loadWorkbook();
  let sheet;
  try {
    sheet = workbook.worksheets.getItem("Questions");
  } catch {
    sheet = workbook.worksheets.getActiveWorksheet();
  }

  const usedRange = sheet.getUsedRange();
  const values = usedRange?.values || [];
  const errors = [];

  if (!values.length) {
    errors.push("The Questions sheet is empty.");
  }

  const headers = (values[0] || []).map(normalizeHeader);
  const indexByColumn = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const column of columns) {
    if (!(column in indexByColumn)) errors.push(`Missing required column "${column}"`);
  }

  const questions = [];
  const seenIds = new Set();
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    if (isRowBlank(row)) continue;
    const question = questionFromRow(row, rowIndex + 1, indexByColumn, errors, seenIds);
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
