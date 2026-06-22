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

function canonicalDirectorGroupKey(phase, fileName = "") {
  const raw = String(phase || "");
  if (!raw) return "director";
  if (raw.startsWith("interest-selecting-")) return "interest-selecting";
  if (raw === "v3-test-1" || raw === "v3-test-2" || raw === "v3-test-3" || raw === "v3-test-4" || raw === "v3-test-5") return "test-samples";
  if (raw === "finale-intro" || /complete-prelude/.test(fileName)) return "finale-intro";
  return raw;
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

function ensureDirectorGroup(byGroup, projectId, manifest, groupKey, fallbackTitle = "") {
  if (!byGroup.has(groupKey)) {
    byGroup.set(groupKey, {
      id: `${projectId}:director:${groupKey}`,
      projectId,
      projectTitle: toTitle(projectId),
      kind: "director",
      title: fallbackTitle || humanizePhase(groupKey),
      subtitle: groupKey,
      phase: groupKey,
      source: {
        manifestPath: manifest ? `/content/games/${projectId}/audio/tts-manifest.json` : null,
        modelId: manifest?.modelId || "eleven_v3",
        voiceId: manifest?.voiceId || null,
        voiceIdEnv: manifest?.voiceIdEnv || "ELEVENLABS_VOICE_ID",
        voiceSettings: manifest?.voiceSettings || null,
        outputDir: manifest?.outputDir || null
      },
      tags: [groupKey],
      keywords: [groupKey],
      searchText: [projectId, groupKey, fallbackTitle].filter(Boolean).join(" ").toLowerCase(),
      candidates: [],
      updatedAt: 0,
      stats: { candidateCount: 0, totalDurationSeconds: 0 }
    });
  }
  return byGroup.get(groupKey);
}

function buildDirectorProject(projectId, projectDir) {
  const manifestPath = path.join(projectDir, "audio", "tts-manifest.json");
  if (!existsSync(manifestPath)) return null;

  const manifest = readJson(manifestPath);
  if (!manifest?.files?.length) return null;

  const byGroup = new Map();
  for (const entry of manifest.files) {
    const groupKey = canonicalDirectorGroupKey(entry.phase, entry.fileName);
    ensureDirectorGroup(byGroup, projectId, manifest, groupKey, humanizePhase(groupKey));

    const filePath = audioPathToFilePath(`/games/${projectId}/audio/host/phases/${entry.fileName}`);
    const durationScore = filePath ? candidateDuration(filePath) : 0;
    const group = byGroup.get(groupKey);
    const candidateId = `${group.id}:${entry.fileName}`;
      group.candidates.push({
        id: candidateId,
        groupId: group.id,
        projectId,
        kind: "director-candidate",
      title: entry.fileName.replace(/^phase-/, "").replace(/\.mp3$/, ""),
      label: entry.text || entry.fileName,
      phase: entry.phase,
      phaseGroup: groupKey,
      fileName: entry.fileName,
        audioPath: `/games/${projectId}/audio/host/phases/${entry.fileName}`,
        filePath,
        text: entry.text || "",
        modelId: manifest.modelId || "eleven_v3",
        voiceId: entry.voiceId || manifest.voiceId || null,
        voiceSettings: entry.voiceSettings || manifest.voiceSettings || null,
        updatedAt: durationScore,
        durationSeconds: null
      });
    group.updatedAt = Math.max(group.updatedAt, durationScore);
  }

  const reviewState = loadVoiceLibraryReviewStateSnapshot();
  for (const candidate of Object.values(reviewState.candidates || {})) {
    const groupId = String(candidate?.groupId || "");
    if (!groupId.startsWith(`${projectId}:director:`)) continue;
    const groupKey = groupId.slice(`${projectId}:director:`.length);
    const audioPath = String(candidate?.audioPath || "");
    if (!audioPath.includes("/audio/host/phases/")) continue;
    const group = ensureDirectorGroup(byGroup, projectId, manifest, groupKey, candidate?.title || humanizePhase(groupKey));
    if (group.candidates.some(item => item.id === candidate.id)) continue;

    const filePath = candidate.filePath || audioPathToFilePath(audioPath);
    const durationScore = filePath ? candidateDuration(filePath) : 0;
    group.candidates.push({
      id: candidate.id,
      groupId: candidate.groupId,
      projectId,
      kind: candidate.kind || "director-candidate",
      title: candidate.title || candidate.label || candidate.fileName || "Generated part",
      label: candidate.label || candidate.text || candidate.title || candidate.fileName || "",
      phase: candidate.phase || groupKey,
      phaseGroup: groupKey,
      fileName: candidate.fileName || path.basename(audioPath),
      audioPath,
      filePath,
      text: candidate.text || "",
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
      .sort((a, b) => String(a.fileName).localeCompare(String(b.fileName)))
      .map(candidate => ({
        ...candidate,
        searchText: [candidate.fileName, candidate.label, candidate.text, candidate.phase].filter(Boolean).join(" ").toLowerCase()
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

function buildQuestionProjects(projectId, projectDir) {
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
      const groupId = `${projectId}:question:${question.id}`;
      const category = String(question.category || "uncategorized").toLowerCase();
      const tags = Array.isArray(question.tags) ? question.tags.map(tag => String(tag).toLowerCase()) : [];
      if (!byId.has(groupId)) {
        byId.set(groupId, {
          id: groupId,
          projectId,
          projectTitle: toTitle(projectId),
          kind: "question",
          title: question.question || question.id,
          subtitle: `${category}${tags.length ? ` · ${tags.join(", ")}` : ""}`,
          phase: null,
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
          searchText: [question.id, question.question, category, ...tags, question.fact].filter(Boolean).join(" ").toLowerCase(),
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
          projectId,
          kind: "question-candidate",
          label: entry.label,
          title: entry.title,
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

    const projectTitle = directorProject?.title || toTitle(projectId);
    projects.push({
      id: projectId,
      title: projectTitle,
      kind: "game",
      source: {
        projectDir: `/content/games/${projectId}`
      },
      sections: {
        director: directorProject?.sections.director || [],
        question: questionGroups
      },
      summary: {
        directorGroupCount: directorProject?.summary.directorGroupCount || 0,
        questionGroupCount: questionGroups.length,
        totalGroupCount: (directorProject?.summary.directorGroupCount || 0) + questionGroups.length,
        totalCandidateCount: (directorProject?.summary.totalCandidateCount || 0) + questionGroups.reduce((sum, group) => sum + group.candidates.length, 0)
      }
    });
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
