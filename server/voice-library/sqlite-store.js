import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
export const DEFAULT_VOICE_LIBRARY_DB_PATH = path.join(ROOT, "content", "voice-library", "trivia-content.sqlite");
const DEFAULT_PUBLIC_ROOT = path.join(ROOT, "public");
const DEFAULT_GAME_ID = "cosmic-trivia";
const DEFAULT_PROJECT_TITLE = "Cosmic Trivia";
const VALID_SCOPES = new Set(["phase", "global", "cross"]);
const VALID_TRIGGER_MODES = new Set(["manual", "phase-entry", "event-match", "fallback-only"]);

function now() {
  return Date.now();
}

function jsonString(value) {
  return JSON.stringify(value ?? null);
}

function jsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || "").trim()).filter(Boolean);
}

function cleanSegment(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEventPath(value = []) {
  if (Array.isArray(value)) {
    return value.map(cleanSegment).filter(Boolean);
  }
  return String(value || "")
    .split(".")
    .map(cleanSegment)
    .filter(Boolean);
}

function cueKeyFor({ scope, domain, eventPath }) {
  return [scope, domain, ...normalizeEventPath(eventPath)].filter(Boolean).join(".");
}

function groupIdFor(gameId, cueKey) {
  return `${gameId}:director:${cueKey}`;
}

function normalizeTriggerMode(value = "manual") {
  const mode = cleanSegment(value) || "manual";
  return VALID_TRIGGER_MODES.has(mode) ? mode : "manual";
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTags(value) {
  return [...new Set(jsonArray(value).map(tag => tag.toLowerCase()).filter(Boolean))];
}

function textHash(text = "") {
  return createHash("sha256").update(String(text || "")).digest("hex");
}

function fileHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function audioPathToFilePath(audioPath = "", publicRoot = DEFAULT_PUBLIC_ROOT) {
  const clean = String(audioPath || "").replace(/^\/+/, "");
  if (!clean) return "";
  return path.join(publicRoot, clean);
}

function candidateReview(reviewState = {}, candidateId = "") {
  return reviewState?.candidates?.[candidateId] || {};
}

function sourceTextFor(candidate = {}, review = {}) {
  return String(review.transcript || candidate.text || candidate.label || candidate.title || candidate.fileName || "");
}

function ensureReviewCandidate(reviewState, candidate) {
  if (!reviewState.candidates || typeof reviewState.candidates !== "object") reviewState.candidates = {};
  if (!reviewState.candidates[candidate.id]) {
    reviewState.candidates[candidate.id] = {
      id: candidate.id,
      groupId: candidate.groupId || null,
      projectId: candidate.projectId || null,
      kind: candidate.kind || "director-candidate",
      title: candidate.title || candidate.fileName || "",
      label: candidate.label || candidate.text || "",
      fileName: candidate.fileName || "",
      audioPath: candidate.audioPath || "",
      cueKey: candidate.cueKey || "",
      status: "unreviewed",
      tags: [],
      notes: [],
      transcript: "",
      transcriptSegments: [],
      updatedAt: now()
    };
  }
  return reviewState.candidates[candidate.id];
}

export function createVoiceLibraryDatabase(dbPath = DEFAULT_VOICE_LIBRARY_DB_PATH) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = DELETE");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_cues (
      cue_key TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      project_title TEXT NOT NULL,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scope TEXT NOT NULL,
      domain TEXT NOT NULL,
      event_path_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_lines (
      line_id TEXT PRIMARY KEY,
      cue_key TEXT NOT NULL REFERENCES voice_cues(cue_key) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      file_name TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      source_text TEXT NOT NULL,
      source_text_hash TEXT NOT NULL,
      tone TEXT,
      audience TEXT,
      visibility TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_assets (
      line_id TEXT PRIMARY KEY REFERENCES voice_lines(line_id) ON DELETE CASCADE,
      audio_path TEXT NOT NULL,
      file_hash TEXT,
      file_size INTEGER,
      text_hash TEXT,
      asset_status TEXT NOT NULL,
      checked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_review_state (
      line_id TEXT PRIMARY KEY REFERENCES voice_lines(line_id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      transcript TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS director_trigger_rules (
      cue_key TEXT PRIMARY KEY REFERENCES voice_cues(cue_key) ON DELETE CASCADE,
      trigger_mode TEXT NOT NULL DEFAULT 'manual',
      phase TEXT,
      event_key TEXT,
      priority INTEGER NOT NULL DEFAULT 100,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

function upsertTriggerRule(db, {
  cueKey,
  triggerMode = "manual",
  phase = "",
  eventKey = "",
  priority = 100,
  enabled = true
}) {
  db.prepare(`
    INSERT INTO director_trigger_rules (
      cue_key, trigger_mode, phase, event_key, priority, enabled, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cue_key) DO UPDATE SET
      trigger_mode = excluded.trigger_mode,
      phase = excluded.phase,
      event_key = excluded.event_key,
      priority = excluded.priority,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `).run(
    cueKey,
    normalizeTriggerMode(triggerMode),
    phase || "",
    eventKey || "",
    Number(priority || 100),
    enabled === false ? 0 : 1,
    now()
  );
}

function ensureDefaultTriggerRule(db, cueKey, phase = "") {
  db.prepare(`
    INSERT OR IGNORE INTO director_trigger_rules (
      cue_key, trigger_mode, phase, event_key, priority, enabled, updated_at
    ) VALUES (?, 'manual', ?, '', 100, 1, ?)
  `).run(cueKey, phase || "", now());
}

function upsertCue(db, { project, group }) {
  const eventPath = normalizeEventPath(group.eventPath || []);
  const trigger = group.trigger || {};
  const hasExplicitTrigger = Boolean(group.trigger || group.triggerMode);
  db.prepare(`
    INSERT INTO voice_cues (
      cue_key, game_id, project_title, group_id, title, scope, domain, event_path_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cue_key) DO UPDATE SET
      game_id = excluded.game_id,
      project_title = excluded.project_title,
      group_id = excluded.group_id,
      title = excluded.title,
      scope = excluded.scope,
      domain = excluded.domain,
      event_path_json = excluded.event_path_json,
      updated_at = excluded.updated_at
  `).run(
    group.cueKey,
    project.id,
    project.title || project.id,
    group.id || "",
    group.title || group.cueKey,
    group.scope || "phase",
    group.domain || group.phase || "",
    jsonString(eventPath),
    now()
  );
  if (hasExplicitTrigger) {
    upsertTriggerRule(db, {
      cueKey: group.cueKey,
      triggerMode: trigger.mode || group.triggerMode || "manual",
      phase: trigger.phase || group.phase || (group.scope === "phase" ? group.domain : ""),
      eventKey: trigger.eventKey || "",
      priority: trigger.priority ?? 100,
      enabled: trigger.enabled !== false
    });
  } else {
    ensureDefaultTriggerRule(db, group.cueKey, group.scope === "phase" ? group.domain : "");
  }
}

function upsertLine(db, { project, group, candidate, reviewState, publicRoot }) {
  const review = candidateReview(reviewState, candidate.id);
  const transcript = sourceTextFor(candidate, review);
  db.prepare(`
    INSERT INTO voice_lines (
      line_id, cue_key, game_id, kind, file_name, audio_path, source_text, source_text_hash,
      tone, audience, visibility, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(line_id) DO UPDATE SET
      cue_key = excluded.cue_key,
      game_id = excluded.game_id,
      kind = excluded.kind,
      file_name = excluded.file_name,
      audio_path = excluded.audio_path,
      source_text = excluded.source_text,
      source_text_hash = excluded.source_text_hash,
      tone = excluded.tone,
      audience = excluded.audience,
      visibility = excluded.visibility,
      active = excluded.active,
      updated_at = excluded.updated_at
  `).run(
    candidate.id,
    group.cueKey,
    project.id,
    candidate.kind || "director-candidate",
    candidate.fileName || "",
    candidate.audioPath || "",
    candidate.text || candidate.label || "",
    textHash(candidate.text || candidate.label || ""),
    candidate.tone || "",
    candidate.audience || "host",
    candidate.visibility || "public-safe",
    candidate.active === false ? 0 : 1,
    now()
  );

  db.prepare(`
    INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(line_id) DO UPDATE SET
      status = excluded.status,
      tags_json = excluded.tags_json,
      transcript = excluded.transcript,
      updated_at = excluded.updated_at
  `).run(
    candidate.id,
    String(review.status || "unreviewed"),
    jsonString(normalizeTags(review.tags || [])),
    transcript,
    Number(review.updatedAt || now())
  );

  validateLineAsset(db, { lineId: candidate.id, audioPath: candidate.audioPath || "", transcript, publicRoot });
}

export function createVoiceCue(db, {
  gameId = DEFAULT_GAME_ID,
  projectTitle = DEFAULT_PROJECT_TITLE,
  scope = "phase",
  domain = "",
  eventPath = [],
  title = "",
  triggerMode = "manual",
  phase = "",
  eventKey = "",
  priority = 100,
  enabled = true
} = {}) {
  const cleanScope = cleanSegment(scope);
  const cleanDomain = cleanSegment(domain);
  const cleanEventPath = normalizeEventPath(eventPath);
  if (!VALID_SCOPES.has(cleanScope)) {
    throw new Error(`Invalid voice cue scope: ${scope}`);
  }
  if (!cleanDomain) {
    throw new Error("Voice cue domain is required");
  }
  if (!cleanEventPath.length) {
    throw new Error("Voice cue eventPath is required");
  }
  const cueKey = cueKeyFor({ scope: cleanScope, domain: cleanDomain, eventPath: cleanEventPath });
  const cleanGameId = String(gameId || DEFAULT_GAME_ID);
  const cue = {
    cueKey,
    gameId: cleanGameId,
    projectTitle: projectTitle || cleanGameId,
    groupId: groupIdFor(cleanGameId, cueKey),
    title: title || cueKey,
    scope: cleanScope,
    domain: cleanDomain,
    eventPath: cleanEventPath
  };
  db.prepare(`
    INSERT INTO voice_cues (
      cue_key, game_id, project_title, group_id, title, scope, domain, event_path_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cue_key) DO UPDATE SET
      game_id = excluded.game_id,
      project_title = excluded.project_title,
      group_id = excluded.group_id,
      title = excluded.title,
      scope = excluded.scope,
      domain = excluded.domain,
      event_path_json = excluded.event_path_json,
      updated_at = excluded.updated_at
  `).run(
    cue.cueKey,
    cue.gameId,
    cue.projectTitle,
    cue.groupId,
    cue.title,
    cue.scope,
    cue.domain,
    jsonString(cue.eventPath),
    now()
  );
  upsertTriggerRule(db, {
    cueKey,
    triggerMode,
    phase: phase || (cleanScope === "phase" ? cleanDomain : ""),
    eventKey,
    priority,
    enabled
  });
  return cue;
}

function nextLineNumber(db, cueKey) {
  const rows = db.prepare("SELECT file_name FROM voice_lines WHERE cue_key = ?").all(cueKey);
  const used = rows
    .map(row => /^line-(\d+)\.mp3$/i.exec(String(row.file_name || ""))?.[1])
    .filter(Boolean)
    .map(value => Number(value));
  return used.length ? Math.max(...used) + 1 : 1;
}

export function createVoiceLine(db, {
  cueKey,
  text = "",
  fileName = "",
  tone = "witty",
  audience = "host",
  visibility = "public-safe",
  publicRoot = DEFAULT_PUBLIC_ROOT
} = {}) {
  const cue = db.prepare("SELECT * FROM voice_cues WHERE cue_key = ?").get(cueKey);
  if (!cue) {
    throw new Error(`Unknown voice cue: ${cueKey}`);
  }
  const lineNumber = fileName
    ? Number(/^line-(\d+)\.mp3$/i.exec(fileName)?.[1] || nextLineNumber(db, cueKey))
    : nextLineNumber(db, cueKey);
  const cleanFileName = fileName || `line-${String(lineNumber).padStart(2, "0")}.mp3`;
  const lineId = `${cueKey}.line-${String(lineNumber).padStart(2, "0")}`;
  const eventPath = parseJson(cue.event_path_json, []);
  const audioPath = `/games/${cue.game_id}/audio/host/director/${cue.scope}/${cue.domain}/${eventPath.join("/")}/${cleanFileName}`;
  const transcript = String(text || "");
  const timestamp = now();

  db.prepare(`
    INSERT INTO voice_lines (
      line_id, cue_key, game_id, kind, file_name, audio_path, source_text, source_text_hash,
      tone, audience, visibility, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lineId,
    cueKey,
    cue.game_id,
    "director-candidate",
    cleanFileName,
    audioPath,
    transcript,
    textHash(transcript),
    tone,
    audience,
    visibility,
    1,
    timestamp
  );
  db.prepare(`
    INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(lineId, "unreviewed", jsonString(["regenerate"]), transcript, timestamp);
  validateLineAsset(db, { lineId, audioPath, transcript, publicRoot });

  return {
    lineId,
    cueKey,
    fileName: cleanFileName,
    audioPath,
    transcript,
    tags: ["regenerate"],
    status: "unreviewed"
  };
}

function validateLineAsset(db, { lineId, audioPath, transcript, publicRoot = DEFAULT_PUBLIC_ROOT }) {
  const filePath = audioPathToFilePath(audioPath, publicRoot);
  let assetStatus = "missing-file";
  let size = null;
  let hash = null;
  if (filePath && existsSync(filePath)) {
    const stat = statSync(filePath);
    size = stat.size;
    hash = fileHash(filePath);
    assetStatus = "ready";
  }
  db.prepare(`
    INSERT INTO voice_assets (line_id, audio_path, file_hash, file_size, text_hash, asset_status, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(line_id) DO UPDATE SET
      audio_path = excluded.audio_path,
      file_hash = excluded.file_hash,
      file_size = excluded.file_size,
      text_hash = excluded.text_hash,
      asset_status = excluded.asset_status,
      checked_at = excluded.checked_at
  `).run(lineId, audioPath, hash, size, textHash(transcript), assetStatus, now());
  return assetStatus;
}

export function syncVoiceLibraryDatabase(db, { catalog, reviewState = {}, publicRoot = DEFAULT_PUBLIC_ROOT }) {
  const seenLineIds = new Set();
  db.exec("BEGIN");
  try {
    for (const project of catalog?.projects || []) {
      const sections = project.sections || {};
      for (const sectionName of ["director", "question"]) {
        for (const group of sections[sectionName] || []) {
          if (!group.cueKey) continue;
          upsertCue(db, { project, group });
          for (const candidate of group.candidates || []) {
            if (!candidate.id) continue;
            seenLineIds.add(candidate.id);
            upsertLine(db, { project, group, candidate, reviewState, publicRoot });
          }
        }
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { syncedLines: seenLineIds.size };
}

export function listVoiceLibraryLines(db, filters = {}) {
  const clauses = [];
  const params = [];
  if (filters.projectId) {
    clauses.push("l.game_id = ?");
    params.push(filters.projectId);
  }
  if (filters.scope) {
    clauses.push("c.scope = ?");
    params.push(filters.scope);
  }
  if (filters.domain) {
    clauses.push("c.domain = ?");
    params.push(filters.domain);
  }
  if (filters.regenerateOnly) {
    clauses.push("r.tags_json LIKE ?");
    params.push("%regenerate%");
  }
  const sql = `
    SELECT
      l.line_id, l.cue_key, l.game_id, l.kind, l.file_name, l.audio_path, l.source_text,
      l.tone, l.audience, l.visibility, l.active,
      c.project_title, c.group_id, c.title AS group_title, c.scope, c.domain, c.event_path_json,
      r.status, r.tags_json, r.transcript,
      a.asset_status, a.file_hash, a.file_size, a.text_hash,
      t.trigger_mode, t.phase AS trigger_phase, t.event_key AS trigger_event_key,
      t.priority AS trigger_priority, t.enabled AS trigger_enabled
    FROM voice_lines l
    JOIN voice_cues c ON c.cue_key = l.cue_key
    JOIN voice_review_state r ON r.line_id = l.line_id
    LEFT JOIN voice_assets a ON a.line_id = l.line_id
    LEFT JOIN director_trigger_rules t ON t.cue_key = c.cue_key
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY c.project_title, c.scope, c.domain, c.event_path_json, l.file_name
  `;
  return db.prepare(sql).all(...params).map(row => ({
    id: row.line_id,
    candidateId: row.line_id,
    cueKey: row.cue_key,
    projectId: row.game_id,
    projectTitle: row.project_title,
    groupId: row.group_id,
    groupTitle: row.group_title,
    kind: row.kind,
    scope: row.scope,
    domain: row.domain,
    eventPath: parseJson(row.event_path_json, []),
    fileName: row.file_name,
    audioPath: row.audio_path,
    sourceText: row.source_text,
    transcript: row.transcript,
    status: row.status,
    tags: parseJson(row.tags_json, []),
    tone: row.tone || "",
    audience: row.audience || "",
    visibility: row.visibility || "",
    active: row.active === 1,
    assetStatus: row.asset_status || "missing-file",
    fileHash: row.file_hash || "",
    fileSize: row.file_size ?? null,
    textHash: row.text_hash || ""
    ,
    triggerMode: row.trigger_mode || "manual",
    triggerPhase: row.trigger_phase || "",
    triggerEventKey: row.trigger_event_key || "",
    triggerPriority: row.trigger_priority ?? 100,
    triggerEnabled: row.trigger_enabled !== 0
  }));
}

export function updateVoiceLibraryLineTranscript(db, { lineId, transcript, reviewState }) {
  const existing = db.prepare("SELECT line_id FROM voice_lines WHERE line_id = ?").get(lineId);
  if (!existing) {
    throw new Error(`Unknown voice line: ${lineId}`);
  }

  const stateCandidate = ensureReviewCandidate(reviewState, { id: lineId });
  stateCandidate.transcript = String(transcript || "");
  stateCandidate.transcriptSegments = String(transcript || "").split("//").map(part => part.trim()).filter(Boolean);
  stateCandidate.status = stateCandidate.status === "approved" ? "unreviewed" : (stateCandidate.status || "unreviewed");
  stateCandidate.tags = normalizeTags([...(stateCandidate.tags || []), "regenerate"]);
  stateCandidate.updatedAt = now();

  db.prepare(`
    INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(line_id) DO UPDATE SET
      status = excluded.status,
      tags_json = excluded.tags_json,
      transcript = excluded.transcript,
      updated_at = excluded.updated_at
  `).run(lineId, stateCandidate.status, jsonString(stateCandidate.tags), stateCandidate.transcript, stateCandidate.updatedAt);

  return {
    lineId,
    transcript: stateCandidate.transcript,
    tags: stateCandidate.tags,
    status: stateCandidate.status
  };
}

export function validateVoiceLibraryAssets(db, { publicRoot = DEFAULT_PUBLIC_ROOT } = {}) {
  const rows = db.prepare(`
    SELECT l.line_id, l.audio_path, r.transcript
    FROM voice_lines l
    JOIN voice_review_state r ON r.line_id = l.line_id
  `).all();
  const summary = { ready: 0, missingFile: 0 };
  for (const row of rows) {
    const status = validateLineAsset(db, {
      lineId: row.line_id,
      audioPath: row.audio_path,
      transcript: row.transcript,
      publicRoot
    });
    if (status === "ready") summary.ready += 1;
    if (status === "missing-file") summary.missingFile += 1;
  }
  return summary;
}
