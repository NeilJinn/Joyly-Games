import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workbook, SpreadsheetFile } from "/Users/neil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "cosmic-trivia-director-gantt.xlsx");
const hostPhasesRoot = path.join(projectRoot, "public", "games", "cosmic-trivia", "audio", "host", "phases");
const questionsPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs", "core.json");

const COLOR = {
  title: "#10233F",
  titleText: "#FFFFFF",
  header: "#173458",
  headerText: "#FFFFFF",
  bodyText: "#1D2433",
  muted: "#5C6573",
  note: "#6B7280",
  grid: "#D9E2F2",
  lobby: "#6AA9FF",
  lobbyLight: "#CFE1FF",
  prep: "#44B8A0",
  prepLight: "#CFEFE8",
  question: "#7C74F1",
  questionLight: "#DDD9FF",
  answer: "#F59E0B",
  answerLight: "#FCE7B2",
  scoring: "#22A06B",
  scoringLight: "#D6F4E4",
  next: "#64748B",
  nextLight: "#D9E1EC",
  finale: "#E15B64",
  finaleLight: "#F9D6D8",
  complete: "#8B5CF6",
  completeLight: "#E7DAFF",
  phaseFill: "#DCE9FF",
  section: "#0F1F36"
};

function stableHash(text) {
  let hash = 0;
  for (let index = 0; index < String(text || "").length; index += 1) {
    hash = ((hash << 5) - hash + String(text || "").charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickVariant(list = [], seed = "") {
  if (!Array.isArray(list) || !list.length) return null;
  if (list.length === 1) return list[0];
  const index = stableHash(seed) % list.length;
  return list[index];
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function mp3DurationSeconds(filePath) {
  const info = await stat(filePath);
  return info.size / 16000;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function pauseMs(durationSeconds, { multiplier = 0.12, minMs = 180, maxMs = 1200 } = {}) {
  const base = Math.max(0, durationSeconds || 0) * 1000 * multiplier;
  return Math.max(minMs, Math.min(maxMs, base));
}

function secLabel(seconds) {
  return `${round(seconds, 1).toFixed(1)}s`;
}

function msLabel(ms) {
  return `${Math.round(ms)}ms`;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function durationFromBytes(bytes) {
  return bytes / 16000;
}

function barColor(kind, light = false) {
  switch (kind) {
    case "lobby": return light ? COLOR.lobbyLight : COLOR.lobby;
    case "prep": return light ? COLOR.prepLight : COLOR.prep;
    case "question": return light ? COLOR.questionLight : COLOR.question;
    case "answer": return light ? COLOR.answerLight : COLOR.answer;
    case "scoring": return light ? COLOR.scoringLight : COLOR.scoring;
    case "next": return light ? COLOR.nextLight : COLOR.next;
    case "finale": return light ? COLOR.finaleLight : COLOR.finale;
    case "complete": return light ? COLOR.completeLight : COLOR.complete;
    default: return light ? "#E5EEF9" : COLOR.phaseFill;
  }
}

function secondsToColumn(seconds, resolution) {
  return Math.max(0, Math.round(seconds / resolution));
}

function createSheetTitle(sheet, title, subtitle, maxCol) {
  sheet.mergeCells(`A1:${columnName(maxCol)}1`);
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format.fill.color = COLOR.title;
  sheet.getRange("A1").format.font.bold = true;
  sheet.getRange("A1").format.font.size = 15;
  sheet.getRange("A1").format.font.color = COLOR.titleText;
  sheet.getRange("A1").format.horizontalAlignment = "left";

  sheet.mergeCells(`A2:${columnName(maxCol)}2`);
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format.font.color = COLOR.note;
  sheet.getRange("A2").format.font.size = 10;
}

function columnName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function setCell(sheet, row, col, value, style = {}) {
  const address = `${columnName(col)}${row}`;
  sheet.getRange(address).values = [[value]];
  const fmt = sheet.getRange(address).format;
  if (style.fill) fmt.fill.color = style.fill;
  if (style.bold != null) fmt.font.bold = style.bold;
  if (style.color) fmt.font.color = style.color;
  if (style.size) fmt.font.size = style.size;
  if (style.align) fmt.horizontalAlignment = style.align;
  if (style.valign) fmt.verticalAlignment = style.valign;
}

function fillBar(sheet, row, startCol, endCol, color, noteValue = null) {
  if (endCol < startCol) return;
  const start = columnName(startCol);
  const end = columnName(endCol);
  const range = sheet.getRange(`${start}${row}:${end}${row}`);
  range.format.fill.color = color;
  range.format.font.color = "#FFFFFF";
  range.format.font.bold = true;
  range.format.horizontalAlignment = "center";
  range.format.verticalAlignment = "middle";
  if (noteValue != null) {
    const mid = Math.floor((startCol + endCol) / 2);
    const cell = `${columnName(mid)}${row}`;
    sheet.getRange(cell).values = [[noteValue]];
  }
}

function addTableHeader(sheet, row, headers, widthMap = {}) {
  headers.forEach((header, index) => {
    setCell(sheet, row, index, header, {
      fill: COLOR.header,
      bold: true,
      color: COLOR.headerText,
      align: "center",
      valign: "middle"
    });
    if (widthMap[index] != null) {
      sheet.getRange(`${columnName(index)}:${columnName(index)}`).format.columnWidth = widthMap[index];
    }
  });
}

function formatTimeAxis(sheet, row, startCol, timelineCols, resolution) {
  for (let index = 0; index < timelineCols; index += 1) {
    const seconds = index * resolution;
    const cell = `${columnName(startCol + index)}${row}`;
    if (index % Math.round(1 / resolution) === 0) {
      sheet.getRange(cell).values = [[round(seconds, 1)]];
      sheet.getRange(cell).format.font.size = 8;
      sheet.getRange(cell).format.font.color = COLOR.muted;
      sheet.getRange(cell).format.horizontalAlignment = "center";
    } else {
      sheet.getRange(cell).values = [[""]];
    }
    if (index % Math.round(2 / resolution) === 0) {
      sheet.getRange(cell).format.fill.color = "#F5F8FC";
    }
  }
}

function buildPhraseRows() {
  return [
    {
      kind: "lobby",
      phase: "interest-selecting",
      label: "interest-selecting",
      type: "timer",
      duration: 35,
      rule: "timer 35s; can also advance when all preferences are locked",
      note: "lobby intro audio plays inside the timer"
    },
    {
      kind: "lobby",
      phase: "interest-selecting",
      label: "welcome prefix",
      type: "voice",
      note: "prefix selected by playCount"
    },
    {
      kind: "lobby",
      phase: "interest-selecting",
      label: "description line",
      type: "voice",
      note: "description selected by roomCode/playCount/questionIndex hash"
    },
    {
      kind: "prep",
      phase: "preferences-locked",
      label: "preferences-locked",
      type: "audio-advance",
      note: "advances on audio end"
    },
    {
      kind: "prep",
      phase: "deck-loading",
      label: "deck-loading",
      type: "audio-advance",
      note: "currently a fixed voice clip, not a lazy loader"
    },
    {
      kind: "question",
      phase: "question-intro",
      label: "question-intro",
      type: "audio-advance",
      note: "short transition before the question clip"
    },
    {
      kind: "question",
      phase: "question-audio",
      label: "question-audio",
      type: "audio-advance",
      note: "plays the questionAudio file from the question pack"
    },
    {
      kind: "answer",
      phase: "answering",
      label: "answering",
      type: "timer",
      duration: 25,
      rule: "timer 25s; can shorten to 1.8s when everyone has answered",
      note: "first question only also has a short host prompt"
    },
    {
      kind: "answer",
      phase: "answering",
      label: "answer prompt",
      type: "voice",
      note: "only on questionIndex 0"
    },
    {
      kind: "scoring",
      phase: "scoring",
      label: "scoring",
      type: "audio-advance",
      note: "chooses a positive or no-correct line"
    },
    {
      kind: "next",
      phase: "next-question",
      label: "next-question",
      type: "audio-advance",
      note: "last question routes to finale-intro"
    },
    {
      kind: "finale",
      phase: "finale-intro",
      label: "finale-intro",
      type: "audio-advance",
      note: "wraps up the leaderboard"
    },
    {
      kind: "complete",
      phase: "complete",
      label: "complete",
      type: "hold",
      note: "stays here until restart or external action"
    }
  ];
}

async function buildAudioLibrary() {
  const hostEntries = [];
  for (const fileName of (await import("node:fs/promises")).readdir ? [] : []) {
    void fileName;
  }
  const hostFiles = (await import("node:fs/promises")).readdir ? [] : [];
  void hostFiles;
}

async function loadHostFileDurations() {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(hostPhasesRoot)).filter(fileName => fileName.endsWith(".mp3"));
  const durations = new Map();
  for (const fileName of files) {
    const filePath = path.join(hostPhasesRoot, fileName);
    durations.set(fileName, await mp3DurationSeconds(filePath));
  }
  return durations;
}

async function loadQuestionDurations(questions) {
  const durations = new Map();
  for (const question of questions) {
    if (!question?.questionAudio) continue;
    const filePath = path.join(projectRoot, "public", question.questionAudio.replace(/^\/+/, ""));
    durations.set(question.questionAudio, await mp3DurationSeconds(filePath));
  }
  return durations;
}

function buildDirectorSampleRows({
  sectionTitle,
  sectionSubtitle,
  startPhase,
  question,
  isLastQuestion,
  rewardCount,
  hostDurations,
  questionDurations
}) {
  const rows = [];
  let time = 0;

  const questionAudio = question?.questionAudio || "";
  const questionAudioDuration = questionAudio ? (questionDurations.get(questionAudio) || 0) : 0;
  const seed = `${sectionTitle}:${question?.id || ""}:${question?.question || ""}`;
  const playCount = 1;

  const openingContext = {
    roomCode: "ROOM-001",
    playCount,
    questionIndex: question?.questionIndex || 0,
    questionAudio,
    lastResolution: { rewardCount },
    isLastQuestion
  };

  const phasePlan = phase => (awaitedPlans.get(phase) || null);
  const awaitedPlans = new Map();

  const pushPlan = (phase, context) => {
    const plan = plans.get(phase);
    awaitedPlans.set(phase, plan);
    return plan;
  };
}

function addBarRow(rows, rowLabel, phase, type, start, end, color, note, durationLabel, extra = {}) {
  rows.push({
    rowLabel,
    phase,
    type,
    start,
    end,
    color,
    note,
    durationLabel,
    ...extra
  });
}

async function buildSections({
  question,
  lastQuestion,
  hostDurations,
  questionDurations
}) {
  const { getDirectorAudioPlan } = await import("../public/games/cosmic-trivia/audio/director-flow.js");

  const sections = [];

  // Section 1: opening and first question path.
  {
    const rows = [];
    let cursor = 0;

    const lobbyContext = {
      roomCode: "ROOM-001",
      playCount: 1,
      questionIndex: 0,
      questionAudio: question.questionAudio,
      lastResolution: { rewardCount: 1 },
      isLastQuestion: false
    };
    const lobbyPlan = getDirectorAudioPlan("interest-selecting", lobbyContext);
    const lobbyPrefix = lobbyPlan.segments[0]?.src || "";
    const lobbyDesc = lobbyPlan.segments[1]?.src || "";
    const lobbyPrefixDur = hostDurations.get(path.basename(lobbyPrefix)) || 0;
    const lobbyDescDur = hostDurations.get(path.basename(lobbyDesc)) || 0;
    const lobbyPrefixPause = pauseMs(lobbyPrefixDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    const lobbyDescPause = pauseMs(lobbyDescDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    const lobbyPhaseEnd = 35;

    addBarRow(rows, "interest-selecting phase", "interest-selecting", "timer", cursor, cursor + lobbyPhaseEnd, barColor("lobby"), "35s timer", secLabel(lobbyPhaseEnd));
    addBarRow(rows, "host voice", "interest-selecting", "voice", cursor, cursor + lobbyPrefixDur, barColor("lobby", true), path.basename(lobbyPrefix), secLabel(lobbyPrefixDur));
    addBarRow(rows, "host voice", "interest-selecting", "voice", cursor + lobbyPrefixDur + lobbyPrefixPause, cursor + lobbyPrefixDur + lobbyPrefixPause + lobbyDescDur, barColor("lobby", true), path.basename(lobbyDesc), secLabel(lobbyDescDur));
    cursor = lobbyPhaseEnd;

    const lockedPlan = getDirectorAudioPlan("preferences-locked", lobbyContext);
    const lockedSrc = lockedPlan.segments[0]?.src || "";
    const lockedDur = hostDurations.get(path.basename(lockedSrc)) || 0;
    const lockedPause = pauseMs(lockedDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "preferences-locked phase", "preferences-locked", "audio-advance", cursor, cursor + lockedDur + lockedPause, barColor("prep"), "audio-advance", `${secLabel(lockedDur)} + ${msLabel(lockedPause * 1000)}`);
    addBarRow(rows, "host voice", "preferences-locked", "voice", cursor, cursor + lockedDur, barColor("prep", true), path.basename(lockedSrc), secLabel(lockedDur));
    cursor += lockedDur + lockedPause;

    const deckPlan = getDirectorAudioPlan("deck-loading", lobbyContext);
    const deckSrc = deckPlan.segments[0]?.src || "";
    const deckDur = hostDurations.get(path.basename(deckSrc)) || 0;
    const deckPause = pauseMs(deckDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "deck-loading phase", "deck-loading", "audio-advance", cursor, cursor + deckDur + deckPause, barColor("prep"), "audio-advance", `${secLabel(deckDur)} + ${msLabel(deckPause * 1000)}`);
    addBarRow(rows, "host voice", "deck-loading", "voice", cursor, cursor + deckDur, barColor("prep", true), path.basename(deckSrc), secLabel(deckDur));
    cursor += deckDur + deckPause;

    const introPlan = getDirectorAudioPlan("question-intro", lobbyContext);
    const introSrc = introPlan.segments[0]?.src || "";
    const introDur = hostDurations.get(path.basename(introSrc)) || 0;
    const introPause = pauseMs(introDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "question-intro phase", "question-intro", "audio-advance", cursor, cursor + introDur + introPause, barColor("question"), "audio-advance", `${secLabel(introDur)} + ${msLabel(introPause * 1000)}`);
    addBarRow(rows, "host voice", "question-intro", "voice", cursor, cursor + introDur, barColor("question", true), path.basename(introSrc), secLabel(introDur));
    cursor += introDur + introPause;

    const questionPlan = getDirectorAudioPlan("question-audio", lobbyContext);
    const qSrc = questionPlan.segments[0]?.src || questionAudio;
    const qDur = questionDurations.get(qSrc) || questionAudioDuration;
    const qPause = pauseMs(qDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "question-audio phase", "question-audio", "audio-advance", cursor, cursor + qDur + qPause, barColor("question"), "audio-advance", `${secLabel(qDur)} + ${msLabel(qPause * 1000)}`);
    addBarRow(rows, "question voice", "question-audio", "voice", cursor, cursor + qDur, barColor("question", true), path.basename(qSrc), secLabel(qDur));
    cursor += qDur + qPause;

    const answeringPlan = getDirectorAudioPlan("answering", { ...lobbyContext, questionIndex: 0 });
    const answeringSrc = answeringPlan.segments[0]?.src || "";
    const answeringDur = hostDurations.get(path.basename(answeringSrc)) || 0;
    const answeringTimer = 25;
    addBarRow(rows, "answering phase", "answering", "timer", cursor, cursor + answeringTimer, barColor("answer"), "25s timer; can shorten to 1.8s when all answers are in", secLabel(answeringTimer));
    addBarRow(rows, "host voice", "answering", "voice", cursor, cursor + answeringDur, barColor("answer", true), path.basename(answeringSrc), secLabel(answeringDur));
    cursor += answeringTimer;

    const scoringPlan = getDirectorAudioPlan("scoring", {
      roomCode: "ROOM-001",
      playCount: 1,
      questionIndex: 0,
      questionAudio: question.questionAudio,
      lastResolution: { rewardCount: 1 },
      isLastQuestion: false
    });
    const scoringSrc = scoringPlan.segments[0]?.src || "";
    const scoringDur = hostDurations.get(path.basename(scoringSrc)) || 0;
    const scoringPause = pauseMs(scoringDur, { multiplier: 0.3, minMs: 180, maxMs: 2400 }) / 1000;
    addBarRow(rows, "scoring phase", "scoring", "audio-advance", cursor, cursor + scoringDur + scoringPause, barColor("scoring"), "audio-advance", `${secLabel(scoringDur)} + ${msLabel(scoringPause * 1000)}`);
    addBarRow(rows, "host voice", "scoring", "voice", cursor, cursor + scoringDur, barColor("scoring", true), path.basename(scoringSrc), secLabel(scoringDur));
    cursor += scoringDur + scoringPause;

    const nextPlan = getDirectorAudioPlan("next-question", {
      roomCode: "ROOM-001",
      playCount: 1,
      questionIndex: 0,
      questionAudio: question.questionAudio,
      lastResolution: { rewardCount: 1 },
      isLastQuestion: false
    });
    const nextSrc = nextPlan.segments[0]?.src || "";
    const nextDur = hostDurations.get(path.basename(nextSrc)) || 0;
    const nextPause = pauseMs(nextDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "next-question phase", "next-question", "audio-advance", cursor, cursor + nextDur + nextPause, barColor("next"), "audio-advance", `${secLabel(nextDur)} + ${msLabel(nextPause * 1000)}`);
    addBarRow(rows, "host voice", "next-question", "voice", cursor, cursor + nextDur, barColor("next", true), path.basename(nextSrc), secLabel(nextDur));
    cursor += nextDur + nextPause;

    sections.push({
      title: "Sample A - opening to next question",
      subtitle: "Uses questionIndex = 0, so you can see the short handoff after question-audio and the first-question answer prompt.",
      rows,
      cursor,
      axisMax: Math.max(40, cursor + 2)
    });
  }

  // Section 2: final question path through the ending.
  {
    const rows = [];
    let cursor = 0;
    const ctx = {
      roomCode: "ROOM-001",
      playCount: 1,
      questionIndex: 7,
      questionAudio: question.questionAudio,
      lastResolution: { rewardCount: 0 },
      isLastQuestion: true
    };

    const introPlan = getDirectorAudioPlan("question-intro", ctx);
    const introSrc = introPlan.segments[0]?.src || "";
    const introDur = hostDurations.get(path.basename(introSrc)) || 0;
    const introPause = pauseMs(introDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "question-intro phase", "question-intro", "audio-advance", cursor, cursor + introDur + introPause, barColor("question"), "audio-advance", `${secLabel(introDur)} + ${msLabel(introPause * 1000)}`);
    addBarRow(rows, "host voice", "question-intro", "voice", cursor, cursor + introDur, barColor("question", true), path.basename(introSrc), secLabel(introDur));
    cursor += introDur + introPause;

    const questionPlan = getDirectorAudioPlan("question-audio", ctx);
    const qSrc = questionPlan.segments[0]?.src || question.questionAudio;
    const qDur = questionDurations.get(qSrc) || questionAudioDuration;
    const qPause = pauseMs(qDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "question-audio phase", "question-audio", "audio-advance", cursor, cursor + qDur + qPause, barColor("question"), "audio-advance", `${secLabel(qDur)} + ${msLabel(qPause * 1000)}`);
    addBarRow(rows, "question voice", "question-audio", "voice", cursor, cursor + qDur, barColor("question", true), path.basename(qSrc), secLabel(qDur));
    cursor += qDur + qPause;

    const scoringPlan = getDirectorAudioPlan("scoring", ctx);
    const scoringSrc = scoringPlan.segments[0]?.src || "";
    const scoringDur = hostDurations.get(path.basename(scoringSrc)) || 0;
    const scoringPause = pauseMs(scoringDur, { multiplier: 0.3, minMs: 180, maxMs: 2400 }) / 1000;
    addBarRow(rows, "scoring phase", "scoring", "audio-advance", cursor, cursor + scoringDur + scoringPause, barColor("scoring"), "audio-advance", `${secLabel(scoringDur)} + ${msLabel(scoringPause * 1000)}`);
    addBarRow(rows, "host voice", "scoring", "voice", cursor, cursor + scoringDur, barColor("scoring", true), path.basename(scoringSrc), secLabel(scoringDur));
    cursor += scoringDur + scoringPause;

    const nextPlan = getDirectorAudioPlan("next-question", ctx);
    const nextSrc = nextPlan.segments[0]?.src || "";
    const nextDur = hostDurations.get(path.basename(nextSrc)) || 0;
    const nextPause = pauseMs(nextDur, { multiplier: 0.12, minMs: 180, maxMs: 1200 }) / 1000;
    addBarRow(rows, "next-question phase", "next-question", "audio-advance", cursor, cursor + nextDur + nextPause, barColor("next"), "audio-advance", `${secLabel(nextDur)} + ${msLabel(nextPause * 1000)}`);
    addBarRow(rows, "host voice", "next-question", "voice", cursor, cursor + nextDur, barColor("next", true), path.basename(nextSrc), secLabel(nextDur));
    cursor += nextDur + nextPause;

    const finalePlan = getDirectorAudioPlan("finale-intro", ctx);
    const finaleSrc = finalePlan.segments[0]?.src || "";
    const finaleDur = hostDurations.get(path.basename(finaleSrc)) || 0;
    const finalePause = pauseMs(finaleDur, { multiplier: 0.2, minMs: 180, maxMs: 1800 }) / 1000;
    addBarRow(rows, "finale-intro phase", "finale-intro", "audio-advance", cursor, cursor + finaleDur + finalePause, barColor("finale"), "audio-advance", `${secLabel(finaleDur)} + ${msLabel(finalePause * 1000)}`);
    addBarRow(rows, "host voice", "finale-intro", "voice", cursor, cursor + finaleDur, barColor("finale", true), path.basename(finaleSrc), secLabel(finaleDur));
    cursor += finaleDur + finalePause;

    const completePlan = getDirectorAudioPlan("complete", ctx);
    const completeSrc = completePlan.segments[0]?.src || "";
    const completeDur = hostDurations.get(path.basename(completeSrc)) || 0;
    addBarRow(rows, "complete phase", "complete", "hold", cursor, cursor + completeDur, barColor("complete"), "hold", secLabel(completeDur));
    addBarRow(rows, "host voice", "complete", "voice", cursor, cursor + completeDur, barColor("complete", true), path.basename(completeSrc), secLabel(completeDur));
    cursor += completeDur;

    sections.push({
      title: "Sample B - last question to final screen",
      subtitle: "Uses questionIndex = 7, so next-question routes into finale-intro and complete remains held.",
      rows,
      cursor,
      axisMax: Math.max(20, cursor + 2)
    });
  }

  return sections;
}

function writeSection(sheet, section, startRow, resolution) {
  const timelineStartCol = 7;
  const timelineCols = Math.ceil(section.axisMax / resolution) + 1;
  const maxCol = timelineStartCol + timelineCols;

  sheet.mergeCells(`A${startRow}:${columnName(maxCol)}${startRow}`);
  sheet.getRange(`A${startRow}`).values = [[section.title]];
  sheet.getRange(`A${startRow}`).format.fill.color = COLOR.section;
  sheet.getRange(`A${startRow}`).format.font.bold = true;
  sheet.getRange(`A${startRow}`).format.font.color = COLOR.titleText;
  sheet.getRange(`A${startRow}`).format.font.size = 12;

  sheet.mergeCells(`A${startRow + 1}:${columnName(maxCol)}${startRow + 1}`);
  sheet.getRange(`A${startRow + 1}`).values = [[section.subtitle]];
  sheet.getRange(`A${startRow + 1}`).format.font.color = COLOR.note;

  const headerRow = startRow + 3;
  const headers = ["Lane", "Phase", "Type", "Start", "End", "Dur", "Note"];
  headers.forEach((header, index) => {
    setCell(sheet, headerRow, index, header, {
      fill: COLOR.header,
      bold: true,
      color: COLOR.headerText,
      align: "center",
      valign: "middle"
    });
  });
  formatTimeAxis(sheet, headerRow, timelineStartCol, timelineCols, resolution);

  const bodyStart = headerRow + 1;
  section.rows.forEach((row, index) => {
    const r = bodyStart + index;
    setCell(sheet, r, 0, row.rowLabel, { bold: true, color: COLOR.bodyText });
    setCell(sheet, r, 1, row.phase, { color: COLOR.bodyText });
    setCell(sheet, r, 2, row.type, { color: COLOR.muted });
    setCell(sheet, r, 3, secLabel(row.start), { color: COLOR.bodyText });
    setCell(sheet, r, 4, secLabel(row.end), { color: COLOR.bodyText });
    setCell(sheet, r, 5, row.durationLabel, { color: COLOR.bodyText });
    setCell(sheet, r, 6, row.note, { color: COLOR.note });

    const startCol = timelineStartCol + secondsToColumn(row.start, resolution);
    const endCol = timelineStartCol + Math.max(0, secondsToColumn(row.end, resolution) - 1);
    fillBar(sheet, r, startCol, endCol, row.color, "");
  });

  const totalRows = bodyStart + section.rows.length - 1;
  for (let col = 0; col <= maxCol; col += 1) {
    const columnLetter = columnName(col);
    sheet.getRange(`${columnLetter}:${columnLetter}`).format.columnWidth = col < 7 ? [18, 18, 14, 10, 10, 12, 42][col] || 4 : 4;
  }

  for (let row = startRow; row <= totalRows; row += 1) {
    sheet.getRange(`${row}:${row}`).format.rowHeight = row === startRow || row === startRow + 1 ? 22 : 20;
  }

  return totalRows + 2;
}

async function main() {
  const workbook = Workbook.create();
  const questions = await readJson(questionsPath);
  const hostDurations = await loadHostFileDurations();
  const questionDurations = await loadQuestionDurations(questions.questions || []);
  const representativeQuestion = (questions.questions || [])[0];
  const sections = await buildSections({
    question: representativeQuestion,
    lastQuestion: (questions.questions || [])[questions.questions.length - 1],
    hostDurations,
    questionDurations
  });

  const answersSheet = workbook.worksheets.add("结论");
  createSheetTitle(
    answersSheet,
    "Cosmic Trivia 导演语音逻辑结论",
    "结论先写在前面，下面的甘特图是按真实文件时长估出来的 sample timeline。",
    7
  );

  const answerHeaders = ["问题", "结论", "代码位置", "关键点"];
  addTableHeader(answersSheet, 4, answerHeaders, { 0: 24, 1: 50, 2: 42, 3: 42 });
  const answerRows = [
    [
      "1. deck-loading 是否支持未来按需载入语音",
      "现在不支持真正的运行时懒加载。这个 phase 只是一个固定的 audio-advance 过渡，现有 runtime 只会按导演计划播固定资源；题目音频可以通过 questionAudio 进入上下文，并且 publicState 里还会预取下一题的 nextQuestionAudio，但没有“按需扫描音频库并自动载入”的逻辑。",
      "/Users/neil/Documents/派对游戏/public/games/cosmic-trivia/audio/director-flow.js",
      "/Users/neil/Documents/派对游戏/server/games/cosmic-trivia.js"
    ],
    [
      "2. 多版本口播新增音频后会自动识别吗",
      "不会。当前播放名单是写死在 director-flow.js 里的数组和规则里；tts-manifest.json、audio-stage-map.json、voice-library/catalog.js 更多是清单、生成和审阅层，不会自动把新文件接进播放逻辑。换句话说，新增文件能被目录/清单工具看到，但不会自己进入 runtime 播放。",
      "/Users/neil/Documents/派对游戏/public/games/cosmic-trivia/audio/director-flow.js",
      "/Users/neil/Documents/派对游戏/content/games/cosmic-trivia/audio/tts-manifest.json"
    ],
    [
      "3. 多段语音之间的 pause 为什么感觉短",
      "因为默认 pause 只有 duration * 0.12，再夹在 180ms 到 1200ms 之间；question-intro、next-question 这类短句尤其容易只得到很短的间隔。题目结尾切下一题时，真正能看到的就是这段很短的 pause，所以体感会很紧。",
      "/Users/neil/Documents/派对游戏/public/shared/director/flow.js",
      "/Users/neil/Documents/派对游戏/public/games/cosmic-trivia/audio/director-flow.js"
    ]
  ];
  answerRows.forEach((row, index) => {
    const r = 5 + index + 1;
    row.forEach((value, col) => setCell(answersSheet, r, col, value, { color: col === 1 ? COLOR.bodyText : COLOR.bodyText }));
  });
  answersSheet.getRange("B6:B8").format.wrapText = true;
  answersSheet.getRange("D6:D8").format.wrapText = true;

  const sectionSheet = workbook.worksheets.add("甘特图");
  createSheetTitle(
    sectionSheet,
    "Cosmic Trivia 导演系统甘特图",
    "0.5s 网格；蓝色系是 lobby / prep / question，橙色是 answering，绿色是 scoring，灰蓝是 next-question，红紫是 finale / complete。",
    80
  );

  let rowCursor = 4;
  for (const section of sections) {
    rowCursor = writeSection(sectionSheet, section, rowCursor, 0.5);
  }

  const assetSheet = workbook.worksheets.add("素材清单");
  createSheetTitle(
    assetSheet,
    "Cosmic Trivia 导演素材清单",
    "这个页签把当前 runtime 真正在用的素材入口和识别规则列出来，方便你看“新增文件会不会自动进来”。",
    8
  );

  const assetHeaders = ["来源", "是否被 runtime 直接使用", "识别方式", "内容", "备注"];
  addTableHeader(assetSheet, 4, assetHeaders, { 0: 26, 1: 16, 2: 28, 3: 58, 4: 44 });
  const assetRows = [
    [
      "public/games/cosmic-trivia/audio/director-flow.js",
      "是",
      "手写数组 + 稳定 hash",
      "决定 interest-selecting / question-intro / answering / scoring / next-question / finale-intro / complete 的口播候选集。",
      "这里才是 runtime 真的在看的“播放名单”。"
    ],
    [
      "content/games/cosmic-trivia/audio/tts-manifest.json",
      "否，主要给生成和审阅用",
      "tts 生成脚本 / voice-library catalog",
      "存放 phase 文本、文件名、voiceId、voice settings。",
      "加新文件后，清单工具能看到，但播放逻辑不会自动接上。"
    ],
    [
      "content/games/cosmic-trivia/audio/audio-stage-map.json",
      "否",
      "文档映射",
      "把 phase 和 hostVoice / sfx / music 的意图写出来。",
      "目前更像说明书，不是 runtime 代码路径。"
    ],
    [
      "questionAudio 字段",
      "是",
      "question-audio phase 直接读取",
      "题库里每道题的题干语音，例如 core-space-001-question.mp3。",
      "会被 publicState 暴露并在大屏上自动播放。"
    ],
    [
      "public/games/cosmic-trivia/audio/host/director/",
      "是",
      "固定文件名",
      "所有主持人口播的 mp3 文件。",
      "新音频必须被 director-flow 或生成清单引用才会真正播。"
    ]
  ];
  assetRows.forEach((row, index) => {
    const r = 5 + index + 1;
    row.forEach((value, col) => setCell(assetSheet, r, col, value, { color: COLOR.bodyText }));
  });

  const sectionHeadersRow = 5 + assetRows.length + 3;
  setCell(assetSheet, sectionHeadersRow, 0, "当前 runtime 里的口播规则摘要", { fill: COLOR.section, bold: true, color: COLOR.titleText });
  assetSheet.mergeCells(`A${sectionHeadersRow}:E${sectionHeadersRow}`);

  const ruleRows = [
    "interest-selecting：prefix 按 playCount 选，desc 按 roomCode/playCount/questionIndex 选。",
    "preferences-locked / deck-loading / question-intro / next-question / finale-intro：单文件或少量 variant，播完自动前进。",
    "question-audio：直接播 questionAudio。",
    "answering：只有 questionIndex 0 会附带一条答题提示。",
    "scoring：根据 rewardCount 选正向或 no-correct。",
    "complete：hold，不会自动离开。"
  ];
  ruleRows.forEach((text, index) => {
    setCell(assetSheet, sectionHeadersRow + 1 + index, 0, text, { color: COLOR.bodyText });
    assetSheet.mergeCells(`A${sectionHeadersRow + 1 + index}:E${sectionHeadersRow + 1 + index}`);
  });

  assetSheet.getRange("A:A").format.columnWidth = 28;
  assetSheet.getRange("B:B").format.columnWidth = 16;
  assetSheet.getRange("C:C").format.columnWidth = 28;
  assetSheet.getRange("D:D").format.columnWidth = 60;
  assetSheet.getRange("E:E").format.columnWidth = 44;

  const blob = await SpreadsheetFile.exportXlsx(workbook);
  await writeFile(outputPath, Buffer.from(blob.data));
  console.log(`Wrote ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
