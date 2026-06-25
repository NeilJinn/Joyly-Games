import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { joinVoiceSegments, splitVoiceText } from "./text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const REVIEW_STATE_PATH = path.join(ROOT, "content", "voice-library", "review-state.json");

function emptyReviewState() {
  return {
    groups: {},
    candidates: {},
    customTags: []
  };
}

function normalizeTags(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(tag => String(tag || "").trim().toLowerCase()).filter(Boolean))];
}

export function normalizeVoiceLibraryReviewState(state) {
  const next = state && typeof state === "object" ? state : emptyReviewState();
  if (!next.groups || typeof next.groups !== "object") next.groups = {};
  if (!next.candidates || typeof next.candidates !== "object") next.candidates = {};
  if (!Array.isArray(next.customTags)) next.customTags = [];

  delete next.queue;

  for (const group of Object.values(next.groups)) {
    if (!group || typeof group !== "object") continue;
    delete group.tags;
    if (group.status === "regenerate") group.status = "unreviewed";
    if (!Array.isArray(group.notes)) group.notes = [];
    if (typeof group.transcript !== "string") group.transcript = "";
    group.transcriptSegments = splitVoiceText(group.transcript);
    if (!group.transcriptSegments.length && Array.isArray(group.transcriptSegments)) {
      group.transcriptSegments = [];
    }
    if (group.transcriptSegments.length > 1) {
      group.transcript = joinVoiceSegments(group.transcriptSegments);
    }
    if (!Number.isFinite(group.updatedAt)) group.updatedAt = Date.now();
  }

  for (const candidate of Object.values(next.candidates)) {
    if (!candidate || typeof candidate !== "object") continue;
    candidate.tags = normalizeTags(candidate.tags);
    if (candidate.status === "regenerate") {
      candidate.status = "unreviewed";
      if (!candidate.tags.includes("regenerate")) candidate.tags.push("regenerate");
    }
    if (!Array.isArray(candidate.notes)) candidate.notes = [];
    if (typeof candidate.transcript !== "string") candidate.transcript = "";
    candidate.transcriptSegments = splitVoiceText(candidate.transcript);
    if (!candidate.transcriptSegments.length && Array.isArray(candidate.transcriptSegments)) {
      candidate.transcriptSegments = [];
    }
    if (candidate.transcriptSegments.length > 1) {
      candidate.transcript = joinVoiceSegments(candidate.transcriptSegments);
    }
    if (!Number.isFinite(candidate.updatedAt)) candidate.updatedAt = Date.now();
  }

  next.customTags = normalizeTags(next.customTags);
  return next;
}

export async function loadVoiceLibraryReviewState() {
  try {
    if (!existsSync(REVIEW_STATE_PATH)) {
      return emptyReviewState();
    }
    const raw = await readFile(REVIEW_STATE_PATH, "utf8");
    return normalizeVoiceLibraryReviewState(JSON.parse(raw || "{}"));
  } catch {
    return emptyReviewState();
  }
}

export async function saveVoiceLibraryReviewState(state) {
  const next = normalizeVoiceLibraryReviewState(state);
  await mkdir(path.dirname(REVIEW_STATE_PATH), { recursive: true });
  const tempPath = `${REVIEW_STATE_PATH}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, REVIEW_STATE_PATH);
  return next;
}

export function isEmptyVoiceLibraryReviewState(state) {
  const normalized = normalizeVoiceLibraryReviewState(state);
  return Object.keys(normalized.groups || {}).length === 0 && Object.keys(normalized.candidates || {}).length === 0 && (normalized.customTags || []).length === 0;
}

export { REVIEW_STATE_PATH };
