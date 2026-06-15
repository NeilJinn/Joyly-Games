import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "content", "games", "cosmic-trivia", "director", "cues.json");
const dbPath = path.join(projectRoot, "content", "voice-library", "voice-library.sqlite");
const outputPath = path.join(projectRoot, "public", "games", "cosmic-trivia", "director", "cue-library.generated.js");
const VALID_SCOPES = new Set(["phase", "global", "cross"]);

function cueKeyFor(cue) {
  return [cue.scope, cue.domain, ...(cue.eventPath || [])].filter(Boolean).join(".");
}

function validateCue(cue) {
  if (!VALID_SCOPES.has(cue.scope)) {
    throw new Error(`${cue.cueKey || "unknown"}: invalid scope ${cue.scope}`);
  }
  if (!cue.domain) {
    throw new Error(`${cue.cueKey || "unknown"}: missing domain`);
  }
  if (!Array.isArray(cue.eventPath) || cue.eventPath.length === 0) {
    throw new Error(`${cue.cueKey || "unknown"}: missing eventPath`);
  }
  const expected = cueKeyFor(cue);
  if (cue.cueKey !== expected) {
    throw new Error(`${cue.cueKey || "unknown"}: cueKey should be ${expected}`);
  }
  if (!Array.isArray(cue.variants)) {
    throw new Error(`${cue.cueKey}: variants must be an array`);
  }
}

function normalizeCue(cue) {
  validateCue(cue);
  return {
    cueKey: cue.cueKey,
    scope: cue.scope,
    domain: cue.domain,
    eventPath: cue.eventPath,
    purpose: cue.purpose || "",
    policy: cue.policy || {},
    trigger: cue.trigger || {
      mode: "manual",
      phase: cue.scope === "phase" ? cue.domain : "",
      eventKey: "",
      priority: 100,
      enabled: true
    },
    variants: cue.variants.map(variant => ({
      id: variant.id,
      path: variant.path,
      text: variant.text || "",
      placeholder: variant.placeholder === true,
      regenerate: variant.regenerate === true
    }))
  };
}

async function existingPublicAudioPath(audioPath = "") {
  const clean = String(audioPath || "").replace(/^\/+/, "");
  if (!clean) return false;
  const filePath = path.join(projectRoot, "public", clean);
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function loadRegistryFromSqlite() {
  if (!existsSync(dbPath)) return null;
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const count = db.prepare("SELECT COUNT(*) AS count FROM voice_cues").get()?.count || 0;
    if (!count) return null;
    const rows = db.prepare(`
      SELECT
        c.cue_key,
        c.game_id,
        c.project_title,
        c.title,
        c.scope,
        c.domain,
        c.event_path_json,
        l.line_id,
        l.audio_path,
        l.source_text,
        r.tags_json,
        a.asset_status,
        t.trigger_mode,
        t.phase AS trigger_phase,
        t.event_key AS trigger_event_key,
        t.priority AS trigger_priority,
        t.enabled AS trigger_enabled
      FROM voice_cues c
      LEFT JOIN voice_lines l ON l.cue_key = c.cue_key AND l.active = 1
      LEFT JOIN voice_review_state r ON r.line_id = l.line_id
      LEFT JOIN voice_assets a ON a.line_id = l.line_id
      LEFT JOIN director_trigger_rules t ON t.cue_key = c.cue_key
      WHERE c.game_id = 'cosmic-trivia'
      ORDER BY c.scope, c.domain, c.event_path_json, l.file_name
    `).all();
    const byCue = new Map();
    for (const row of rows) {
      if (!byCue.has(row.cue_key)) {
        byCue.set(row.cue_key, {
          cueKey: row.cue_key,
          scope: row.scope,
          domain: row.domain,
          eventPath: parseJson(row.event_path_json, []),
          purpose: row.title || "",
          policy: {},
          trigger: {
            mode: row.trigger_mode || "manual",
            phase: row.trigger_phase || "",
            eventKey: row.trigger_event_key || "",
            priority: row.trigger_priority ?? 100,
            enabled: row.trigger_enabled !== 0
          },
          variants: []
        });
      }
      if (row.line_id) {
        const tags = parseJson(row.tags_json, []);
        byCue.get(row.cue_key).variants.push({
          id: row.line_id,
          path: row.audio_path,
          text: row.source_text || "",
          placeholder: row.asset_status !== "ready",
          regenerate: Array.isArray(tags) && tags.includes("regenerate")
        });
      }
    }
    return {
      version: 2,
      gameId: "cosmic-trivia",
      defaults: { fallbackOrder: ["global.game.default"] },
      cues: [...byCue.values()]
    };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

const registry = loadRegistryFromSqlite() || JSON.parse(await readFile(sourcePath, "utf8"));
const cues = [];
for (const cue of registry.cues || []) {
  const normalized = normalizeCue(cue);
  const playableVariants = [];
  for (const variant of normalized.variants) {
    if (await existingPublicAudioPath(variant.path)) {
      playableVariants.push(variant);
    }
  }
  cues.push({ ...normalized, variants: playableVariants });
}
const payload = {
  version: registry.version || 1,
  gameId: registry.gameId || "cosmic-trivia",
  defaults: registry.defaults || {},
  cues
};

const source = `// Generated by scripts/build-cosmic-trivia-director-cues.js.\n// Edit content/games/cosmic-trivia/director/cues.json, then regenerate.\n\nexport const DIRECTOR_CUE_REGISTRY = ${JSON.stringify(payload, null, 2)};\n\nexport const DIRECTOR_CUES = DIRECTOR_CUE_REGISTRY.cues;\n\nexport const CUE_VARIANTS = Object.fromEntries(\n  DIRECTOR_CUES.map(cue => [cue.cueKey, cue.variants.map(variant => variant.path).filter(Boolean)])\n);\n`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, source);
console.log(`Wrote ${path.relative(projectRoot, outputPath)} (${cues.length} cue(s))`);
