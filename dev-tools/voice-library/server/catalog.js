import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CONTENT_GAMES_DIR = path.join(ROOT, "content", "games");
const PUBLIC_GAMES_DIR = path.join(ROOT, "public", "games");
const REVIEW_STATE_PATH = path.join(ROOT, "content", "voice-library", "review-state.json");

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toTitle(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function audioPathToFilePath(audioPath) {
  if (!audioPath) return null;
  const clean = String(audioPath).replace(/^\/+/, "");
  return path.join(PUBLIC_GAMES_DIR, clean.replace(/^games\//, ""));
}

function formatDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const whole = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
}

function humanizePhase(phase) {
  return toTitle(phase)
    .replace(/^Phase /, "")
    .replace(/ Interest Selecting /, " Interest Selecting ")
    .trim();
}

function shortFileStem(fileName = "") {
  return String(fileName || "")
    .replace(/^phase-/, "")
    .replace(/\.(mp3|m4a|wav|aac|ogg|webm|mp4|mp5)$/i, "")
    .trim();
}

// Legacy phase name normalization — only needed for old review-state.json entries
// that predate the canonical phase naming. New entries use cueKey directly.
// Do not add new mappings here; add cueKey to the source record instead.
function normalizeDirectorPhase(phase, fileName = "") {
  const raw = String(phase || "").trim();
  if (!raw) return "unknown";
  if (raw === "interest-selecting" || raw === "interest-selecting-prefix" || raw === "interest-selecting-desc" || raw === "preferences-locked") return "preferences";
  if (raw === "deck-loading") return "round-prep";
  if (raw === "question-audio") return "question-read";
  if (raw === "answer-reveal" || raw === "answer-audio") return "reveal";
  if (raw === "next-question") return "between-questions";
  if (raw === "finale-intro" || /complete-prelude/.test(fileName)) return "finale";
  if (raw === "complete") return "post-game";
  return raw;
}

function canonicalDirectorGroupKey(phase, fileName = "") {
  return normalizeDirectorPhase(phase, fileName);
}

function manifestEntryCueKey(entry = {}) {
  if (entry.cueKey) return String(entry.cueKey).trim();
  const phase = canonicalDirectorGroupKey(entry.phase, entry.fileName);
  return `phase.${phase}.default`;
}

function parseCueKey(cueKey = "", metadata = {}) {
  const parts = String(cueKey || "").trim().split(".").filter(Boolean);
  const scope = parts[0] || "phase";
  if (!["phase", "global", "cross"].includes(scope)) {
    return {
      cueKey: "",
      scope: "",
      domain: "",
      phaseOrDomain: "",
      event: "",
      eventPath: []
    };
  }
  const domain = metadata.domain || metadata.phaseOrDomain || parts[1] || (scope === "global" ? "game" : "unknown");
  const eventPath = Array.isArray(metadata.eventPath) && metadata.eventPath.length
    ? metadata.eventPath.map(item => String(item))
    : (parts.length > 2 ? parts.slice(2) : [metadata.event || "default"]);
  return {
    cueKey: String(metadata.cueKey || cueKey || "").trim(),
    scope,
    domain,
    phaseOrDomain: domain,
    event: eventPath[eventPath.length - 1] || "default",
    eventPath
  };
}

function parseDirectorReviewCue(projectId, candidate = {}, manifestByFileName) {
  const fileName = candidate?.fileName || path.basename(String(candidate?.audioPath || ""));
  if (candidate?.cueKey) return parseCueKey(candidate.cueKey);

  const matchedManifestCue = manifestByFileName.get(fileName);
  if (matchedManifestCue) return matchedManifestCue;

  const groupId = String(candidate?.groupId || "");
  const legacyGroup = groupId.startsWith(`${projectId}:director:`)
    ? groupId.slice(`${projectId}:director:`.length)
    : "";
  if (!legacyGroup || legacyGroup === "director") return null;

  const phase = candidate?.phase || candidate?.phaseGroup || legacyGroup;
  return parseCueKey(`phase.${phase}.default`);
}

function cueGroupId(projectId, cueKey) {
  return `${projectId}:director:${cueKey}`;
}

function cueGroupTitle({ scope, phaseOrDomain, event, purpose }) {
  if (purpose) return String(purpose).trim();
  if (scope === "global") return `${phaseOrDomain} > ${event}`;
  if (scope === "cross") return `${phaseOrDomain} > ${event}`;
  return `${phaseOrDomain} > ${event}`;
}

function cueGroupSubtitle({ cueKey, scope }) {
  return `${scope} cue · ${cueKey}`;
}

function cueTags({ scope, phaseOrDomain, event, eventPath }) {
  return [scope, phaseOrDomain, ...(eventPath || [event])].filter(Boolean);
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolvePlayableAudio(entry = {}) {
  const primaryAudioPath = String(entry.audioPath || "").trim();
  const primaryFilePath = primaryAudioPath ? audioPathToFilePath(primaryAudioPath) : null;
  if (primaryAudioPath && primaryFilePath && existsSync(primaryFilePath)) {
    return {
      audioPath: primaryAudioPath,
      filePath: primaryFilePath,
      canonicalAudioPath: primaryAudioPath
    };
  }
  return {
    audioPath: primaryAudioPath,
    filePath: primaryFilePath,
    canonicalAudioPath: primaryAudioPath
  };
}

function candidateDuration(filePath) {
  const stat = safeStat(filePath);
  return stat ? stat.mtimeMs : 0;
}

function loadVoiceLibraryReviewStateSnapshot() {
  const state = readJson(REVIEW_STATE_PATH);
  if (!state || typeof state !== "object") return { groups: {}, candidates: {}, customTags: [] };
  return state;
}

function ensureDirectorGroup(byGroup, projectId, manifest, cue = {}, source = null) {
  const cueKey = String(cue.cueKey || "").trim();
  if (!cueKey) return null;
  if (!byGroup.has(cueKey)) {
    const sourcePath = source?.manifestPath || source?.registryPath || null;
    byGroup.set(cueKey, {
      id: cueGroupId(projectId, cueKey),
      projectId,
      projectTitle: toTitle(projectId),
      kind: "director",
      title: cueGroupTitle(cue),
      subtitle: cueGroupSubtitle(cue),
      phase: cue.phaseOrDomain || null,
      domain: cue.domain || cue.phaseOrDomain || null,
      scope: cue.scope || "phase",
      event: cue.event || "default",
      eventPath: Array.isArray(cue.eventPath) ? cue.eventPath : [cue.event || "default"],
      cueKey,
      source: {
        manifestPath: sourcePath,
        modelId: manifest?.modelId || "eleven_v3",
        voiceId: manifest?.voiceId || null,
        voiceIdEnv: manifest?.voiceIdEnv || "ELEVENLABS_VOICE_ID",
        voiceSettings: manifest?.voiceSettings || null,
        outputRoot: manifest?.outputRoot || manifest?.outputDir || null
      },
      tags: cueTags(cue),
      keywords: cueTags(cue),
      searchText: [projectId, cueKey, cue.phaseOrDomain, cue.event, cue.scope, ...(cue.eventPath || [])].filter(Boolean).join(" ").toLowerCase(),
      candidates: [],
      updatedAt: 0,
      stats: { candidateCount: 0, totalDurationSeconds: 0 }
    });
  }
  return byGroup.get(cueKey);
}

function buildDirectorProject(projectId, projectDir) {
  const manifestPath = path.join(projectDir, "audio", "tts-manifest.json");
  const registryPath = path.join(projectDir, "audio", "audio-stage-map.json");
  const cuesPath = path.join(projectDir, "director", "cues.json");
  if (!existsSync(manifestPath)) return null;

  const manifest = readJson(manifestPath);
  // Prefer director/cues.json when available; fall back to audio/audio-stage-map.json
  const cuesRegistry = existsSync(cuesPath) ? readJson(cuesPath) : null;
  const registry = cuesRegistry || (existsSync(registryPath) ? readJson(registryPath) : null);
  const hasManifestFiles = Array.isArray(manifest?.files) && manifest.files.length > 0;
  const hasRegistryCues = Array.isArray(registry?.cues) && registry.cues.length > 0;
  if (!hasManifestFiles && !hasRegistryCues) return null;

  const byGroup = new Map();
  const cueMetadataByKey = new Map();
  const registrySourceLabel = cuesRegistry
    ? `/content/games/${projectId}/director/cues.json`
    : `/content/games/${projectId}/audio/audio-stage-map.json`;

  for (const cueEntry of registry?.cues || []) {
    const parsedCue = { ...parseCueKey(cueEntry.cueKey, cueEntry), purpose: cueEntry.purpose || null };
    cueMetadataByKey.set(parsedCue.cueKey, parsedCue);
    ensureDirectorGroup(byGroup, projectId, manifest, parsedCue, { registryPath: registrySourceLabel });

    // If cues.json provides variants, seed candidates from them (manifest entries take priority later)
    if (cuesRegistry && Array.isArray(cueEntry.variants) && cueEntry.variants.length > 0) {
      const group = byGroup.get(parsedCue.cueKey);
      if (!group) continue;
      for (const variant of cueEntry.variants) {
        if (!variant.path) continue;
        const playable = resolvePlayableAudio({ audioPath: variant.path });
        const durationScore = playable.filePath ? candidateDuration(playable.filePath) : 0;
        const fileName = path.basename(variant.path);
        const candidateId = variant.id || `${group.id}:${fileName}`;
        if (group.candidates.some(item => item.id === candidateId)) continue;
        group.candidates.push({
          id: candidateId,
          groupId: group.id,
          projectId,
          kind: "director-candidate",
          title: fileName,
          label: variant.text || fileName,
          cueKey: parsedCue.cueKey,
          scope: parsedCue.scope,
          domain: parsedCue.domain,
          phase: parsedCue.phaseOrDomain,
          phaseGroup: parsedCue.phaseOrDomain,
          event: parsedCue.event,
          eventPath: parsedCue.eventPath,
          fileName,
          audioPath: playable.audioPath,
          canonicalAudioPath: playable.canonicalAudioPath,
          filePath: playable.filePath,
          text: variant.text || "",
          tone: cueEntry.tone || "",
          audience: cueEntry.audience || "host",
          visibility: cueEntry.visibility || "public-safe",
          priority: 100,
          active: true,
          modelId: manifest.modelId || "eleven_v3",
          voiceId: manifest.voiceId || null,
          voiceSettings: manifest.voiceSettings || null,
          updatedAt: durationScore,
          durationSeconds: null
        });
        group.updatedAt = Math.max(group.updatedAt, durationScore);
      }
    }
  }

  const manifestByFileName = new Map();
  for (const entry of manifest?.files || []) {
    const manifestCueKey = manifestEntryCueKey(entry);
    const cue = cueMetadataByKey.get(manifestCueKey) || parseCueKey(manifestCueKey, entry);
    const group = ensureDirectorGroup(byGroup, projectId, manifest, cue, {
      manifestPath: `/content/games/${projectId}/audio/tts-manifest.json`
    });
    if (!group) continue;

    const playable = resolvePlayableAudio(entry);
    const durationScore = playable.filePath ? candidateDuration(playable.filePath) : 0;
    const candidateId = entry.id || `${group.id}:${entry.fileName}`;
    const fileName = entry.fileName || path.basename(playable.canonicalAudioPath || playable.audioPath || `${cue.event}.mp3`);
    manifestByFileName.set(fileName, {
      cueKey: cue.cueKey,
      scope: cue.scope,
      domain: cue.domain,
      phaseOrDomain: cue.phaseOrDomain,
      event: cue.event,
      eventPath: cue.eventPath
    });
    const manifestCandidate = {
      id: candidateId,
      groupId: group.id,
      projectId,
      kind: "director-candidate",
      title: fileName,
      label: entry.text || shortFileStem(fileName) || cue.event,
      cueKey: cue.cueKey,
      scope: cue.scope,
      domain: cue.domain,
      phase: cue.phaseOrDomain,
      phaseGroup: cue.phaseOrDomain,
      event: cue.event,
      eventPath: cue.eventPath,
      fileName,
      audioPath: playable.audioPath,
      canonicalAudioPath: playable.canonicalAudioPath,
      filePath: playable.filePath,
      text: entry.text || "",
      tone: entry.tone || "",
      audience: entry.audience || "host",
      visibility: entry.visibility || "public-safe",
      priority: entry.priority ?? 100,
      active: entry.active !== false,
      modelId: manifest.modelId || "eleven_v3",
      voiceId: entry.voiceId || manifest.voiceId || null,
      voiceSettings: entry.voiceSettings || manifest.voiceSettings || null,
      updatedAt: durationScore,
      durationSeconds: null
    };
    // Manifest data is authoritative — replace any cues.json-seeded placeholder with same ID
    const existingIdx = group.candidates.findIndex(item => item.id === candidateId);
    if (existingIdx >= 0) {
      group.candidates[existingIdx] = manifestCandidate;
    } else {
      group.candidates.push(manifestCandidate);
    }
    group.updatedAt = Math.max(group.updatedAt, durationScore);
  }

  const reviewState = loadVoiceLibraryReviewStateSnapshot();
  for (const candidate of Object.values(reviewState.candidates || {})) {
    const fileName = candidate?.fileName || path.basename(String(candidate?.audioPath || ""));
    const parsedCue = parseDirectorReviewCue(projectId, candidate, manifestByFileName);
    if (!parsedCue?.cueKey) continue;
    if (!byGroup.has(parsedCue.cueKey)) continue;
    const group = ensureDirectorGroup(byGroup, projectId, manifest, parsedCue, {
      manifestPath: `/content/games/${projectId}/audio/tts-manifest.json`
    });
    if (!group || group.candidates.some(item => item.id === candidate.id)) continue;

    const playable = resolvePlayableAudio(candidate);
    const filePath = candidate.filePath || playable.filePath;
    const durationScore = filePath ? candidateDuration(filePath) : 0;
    group.candidates.push({
      id: candidate.id,
      groupId: group.id,
      projectId,
      kind: candidate.kind || "director-candidate",
      title: candidate.title || candidate.fileName || "Generated part",
      label: candidate.transcript || candidate.text || candidate.label || candidate.title || shortFileStem(candidate.fileName) || candidate.fileName || "",
      cueKey: parsedCue.cueKey,
      scope: parsedCue.scope,
      domain: parsedCue.domain,
      phase: parsedCue.phaseOrDomain,
      phaseGroup: parsedCue.phaseOrDomain,
      event: parsedCue.event,
      eventPath: parsedCue.eventPath,
      fileName: candidate.fileName || path.basename(playable.audioPath || ""),
      audioPath: playable.audioPath,
      canonicalAudioPath: candidate.canonicalAudioPath || playable.canonicalAudioPath,
      filePath,
      text: candidate.text || "",
      tone: candidate.tone || "",
      audience: candidate.audience || "host",
      visibility: candidate.visibility || "public-safe",
      priority: candidate.priority ?? 100,
      active: candidate.active !== false,
      modelId: candidate.modelId || manifest.modelId || "eleven_v3",
      voiceId: candidate.voiceId || manifest.voiceId || null,
      voiceSettings: candidate.voiceSettings || manifest.voiceSettings || null,
      updatedAt: candidate.updatedAt || durationScore,
      durationSeconds: null
    });
    group.updatedAt = Math.max(group.updatedAt, candidate.updatedAt || durationScore);
  }

  const groups = [...byGroup.values()].map(group => ({
    ...group,
    candidates: group.candidates
      .sort((a, b) => (Number(a.priority ?? 100) - Number(b.priority ?? 100)) || String(a.fileName).localeCompare(String(b.fileName)))
      .map(candidate => ({
        ...candidate,
        searchText: [candidate.fileName, candidate.label, candidate.text, candidate.phase, candidate.event, candidate.scope, candidate.cueKey, ...(candidate.eventPath || [])].filter(Boolean).join(" ").toLowerCase()
      })),
    stats: {
      candidateCount: group.candidates.length,
      totalDurationSeconds: 0
    }
  }));

  return {
    id: projectId,
    title: toTitle(projectId),
    kind: "game",
    source: {
      manifestPath: `/content/games/${projectId}/audio/tts-manifest.json`
    },
    sections: {
      director: groups,
      question: []
    },
    summary: {
      directorGroupCount: groups.length,
      questionGroupCount: 0,
      totalGroupCount: groups.length,
      totalCandidateCount: groups.reduce((sum, group) => sum + group.candidates.length, 0)
    }
  };
}

function buildQuestionProjects(projectId, projectDir, libraryProjectId = `${projectId}-questions`) {
  const questionPackDir = path.join(projectDir, "question-packs");
  if (!existsSync(questionPackDir)) return [];
  const manifestPath = path.join(projectDir, "audio", "tts-manifest.json");
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const defaultQuestionVoiceId = manifest?.voiceId || null;
  const defaultQuestionVoiceSettings = manifest?.voiceSettings || null;

  const packFiles = readdirSync(questionPackDir).filter(fileName => fileName.endsWith(".json"));
  const byId = new Map();

  for (const fileName of packFiles) {
    const packPath = path.join(questionPackDir, fileName);
    const pack = readJson(packPath);
    if (!pack?.questions?.length) continue;

    for (const question of pack.questions) {
      const questionId = slug(question.id || "question");
      const category = slug(question.category || "uncategorized") || "uncategorized";
      const cueKey = `question.${category}.${questionId}.prompt`;
      const eventPath = [questionId, "prompt"];
      const groupId = `${libraryProjectId}:question:${questionId}`;
      const tags = Array.isArray(question.tags) ? question.tags.map(tag => String(tag).toLowerCase()) : [];
      if (!byId.has(groupId)) {
        byId.set(groupId, {
          id: groupId,
          projectId: libraryProjectId,
          projectTitle: `${toTitle(projectId)} Questions`,
          kind: "question",
          title: question.question || question.id,
          subtitle: `${category}${tags.length ? ` · ${tags.join(", ")}` : ""}`,
          phase: null,
          scope: "question",
          domain: category,
          event: "prompt",
          eventPath,
          cueKey,
          category,
          keywords: tags,
          source: {
            packPath: `/content/games/${projectId}/question-packs/${fileName}`,
            packId: pack.id || fileName.replace(/\.json$/, ""),
            manifestPath: manifest ? `/content/games/${projectId}/audio/tts-manifest.json` : null,
            modelId: manifest?.modelId || "eleven_v3",
            voiceId: defaultQuestionVoiceId,
            voiceSettings: defaultQuestionVoiceSettings
          },
          tags: [...tags, category].filter(Boolean),
          searchText: [question.id, question.question, category, cueKey, ...tags, question.fact].filter(Boolean).join(" ").toLowerCase(),
          candidates: [],
          updatedAt: 0,
          stats: { candidateCount: 0, totalDurationSeconds: 0 }
        });
      }

      const group = byId.get(groupId);
      const entries = [
        {
          suffix: "question",
          label: "Question prompt",
          audioPath: question.questionAudio || "",
          text: question.question || "",
          title: question.question?.slice(0, 80) || "Question prompt"
        }
      ];

      for (const entry of entries) {
        if (!entry.audioPath) continue;
        const filePath = audioPathToFilePath(entry.audioPath);
        const durationScore = filePath ? candidateDuration(filePath) : 0;
        group.candidates.push({
          id: `${groupId}:${entry.suffix}`,
          groupId,
          projectId: libraryProjectId,
          kind: "question-candidate",
          label: entry.label,
          title: entry.title,
          cueKey,
          scope: "question",
          domain: category,
          event: "prompt",
          eventPath,
          audioPath: entry.audioPath,
          filePath,
          text: entry.text || "",
          modelId: manifest?.modelId || "eleven_v3",
          voiceId: defaultQuestionVoiceId,
          voiceSettings: defaultQuestionVoiceSettings,
          category,
          keywords: tags,
          fileName: path.basename(entry.audioPath),
          updatedAt: durationScore,
          durationSeconds: null
        });
        group.updatedAt = Math.max(group.updatedAt, durationScore);
      }
    }
  }

  return [...byId.values()].map(group => ({
    ...group,
    candidates: group.candidates
      .sort((a, b) => String(a.suffix || a.fileName).localeCompare(String(b.suffix || b.fileName)))
      .map(candidate => ({
        ...candidate,
        searchText: [candidate.fileName, candidate.label, candidate.title, candidate.text, candidate.category, ...(candidate.keywords || [])].filter(Boolean).join(" ").toLowerCase()
      })),
    stats: {
      candidateCount: group.candidates.length,
      totalDurationSeconds: 0
    }
  }));
}

export function getVoiceLibraryCatalog() {
  const projects = [];

  if (!existsSync(CONTENT_GAMES_DIR)) {
    return {
      projects,
      summary: { projectCount: 0, directorGroupCount: 0, questionGroupCount: 0, totalGroupCount: 0, totalCandidateCount: 0 }
    };
  }

  const directories = readdirSync(CONTENT_GAMES_DIR, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .sort();

  for (const projectId of directories) {
    const projectDir = path.join(CONTENT_GAMES_DIR, projectId);
    const directorProject = buildDirectorProject(projectId, projectDir);
    const questionGroups = buildQuestionProjects(projectId, projectDir);

    if (!directorProject && !questionGroups.length) continue;

    if (directorProject) {
      const projectTitle = directorProject.title || toTitle(projectId);
      projects.push({
        id: projectId,
        title: projectTitle,
        kind: "game",
        source: {
          projectDir: `/content/games/${projectId}`
        },
        sections: {
          director: directorProject.sections.director || [],
          question: []
        },
        summary: {
          directorGroupCount: directorProject.summary.directorGroupCount || 0,
          questionGroupCount: 0,
          totalGroupCount: directorProject.summary.directorGroupCount || 0,
          totalCandidateCount: directorProject.summary.totalCandidateCount || 0
        }
      });
    }

    if (questionGroups.length) {
      const questionProjectId = `${projectId}-questions`;
      projects.push({
        id: questionProjectId,
        title: `${toTitle(projectId)} Questions`,
        kind: "question-bank",
        source: {
          projectDir: `/content/games/${projectId}`,
          questionPackDir: `/content/games/${projectId}/question-packs`
        },
        sections: {
          director: [],
          question: questionGroups
        },
        summary: {
          directorGroupCount: 0,
          questionGroupCount: questionGroups.length,
          totalGroupCount: questionGroups.length,
          totalCandidateCount: questionGroups.reduce((sum, group) => sum + group.candidates.length, 0)
        }
      });
    }
  }

  const summary = projects.reduce((acc, project) => {
    acc.projectCount += 1;
    acc.directorGroupCount += project.summary.directorGroupCount;
    acc.questionGroupCount += project.summary.questionGroupCount;
    acc.totalGroupCount += project.summary.totalGroupCount;
    acc.totalCandidateCount += project.summary.totalCandidateCount;
    return acc;
  }, { projectCount: 0, directorGroupCount: 0, questionGroupCount: 0, totalGroupCount: 0, totalCandidateCount: 0 });

  return { projects, summary };
}
