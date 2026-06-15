import { escape, html } from "/platform/shared/ui.js";
import { joinVoiceSegments, splitVoiceText } from "/shared/director/text.js";

const app = document.querySelector("#app");
const LEGACY_STORAGE_KEY = "joylyVoiceLibraryReviewState";
const UI_KEY = "joylyVoiceLibraryUiState";
const TAG_PRESETS = [
  "too fast",
  "too slow",
  "tone mismatch",
  "not cheerful enough",
  "too flat",
  "too intense",
  "pronunciation issue",
  "cut off",
  "good take"
];

const audio = new Audio();
audio.preload = "metadata";

let catalog = null;
let durationCache = new Map();
let reviewState = {
  groups: {},
  candidates: {},
  customTags: []
};
let uiState = loadJson(UI_KEY, {
  projectId: "all",
  libraryType: "all",
  quickView: "unreviewed",
  search: "",
  sortKey: "recent",
  sortDir: "desc",
  filterPhases: [],
  filterCategories: [],
  filterKeywords: [],
  filterReviewTags: [],
  expandedGroups: [],
  selectedIds: []
});

let selectedGroupKey = "";
let selectedNodeKey = "";
let regenerationBusy = false;
let reviewStateLoaded = false;
let reviewStateSaveTimer = null;
let reviewStateSavePromise = Promise.resolve();

function normalizeReviewState(state) {
  if (!state || typeof state !== "object") return state;
  if (!state.groups || typeof state.groups !== "object") state.groups = {};
  if (!state.candidates || typeof state.candidates !== "object") state.candidates = {};
  if (!Array.isArray(state.customTags)) state.customTags = [];

  for (const group of Object.values(state.groups)) {
    if (!group || typeof group !== "object") continue;
    if (Array.isArray(group.tags) && group.tags.length) delete group.tags;
    if (group.status === "regenerate") group.status = "unreviewed";
    if (!Array.isArray(group.notes)) group.notes = [];
    if (typeof group.transcript !== "string") group.transcript = "";
    group.transcriptSegments = splitVoiceText(group.transcript);
    if (group.transcriptSegments.length > 1) {
      group.transcript = joinVoiceSegments(group.transcriptSegments);
    }
  }

  for (const candidate of Object.values(state.candidates)) {
    if (!candidate || typeof candidate !== "object") continue;
    if (!Array.isArray(candidate.tags)) candidate.tags = [];
    candidate.tags = [...new Set(candidate.tags.map(tag => String(tag || "").trim().toLowerCase()).filter(Boolean))];
    if (candidate.status === "regenerate") {
      candidate.status = "unreviewed";
      if (!candidate.tags.includes("regenerate")) candidate.tags.push("regenerate");
    }
    if (!Array.isArray(candidate.notes)) candidate.notes = [];
    if (typeof candidate.transcript !== "string") candidate.transcript = "";
    candidate.transcriptSegments = splitVoiceText(candidate.transcript);
    if (candidate.transcriptSegments.length > 1) {
      candidate.transcript = joinVoiceSegments(candidate.transcriptSegments);
    }
  }

  state.customTags = [...new Set(state.customTags.map(tag => String(tag || "").trim().toLowerCase()).filter(Boolean))];
  return state;
}

normalizeReviewState(reviewState);

function createEmptyReviewState() {
  return {
    groups: {},
    candidates: {},
    customTags: []
  };
}

function hasReviewStateContent(state) {
  return Boolean(
    state &&
      typeof state === "object" &&
      (Object.keys(state.groups || {}).length || Object.keys(state.candidates || {}).length || (state.customTags || []).length)
  );
}

const scheduleRender = (() => {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  };
})();

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function legacyReviewState() {
  return loadJson(LEGACY_STORAGE_KEY, null);
}

async function persistReviewStateNow() {
  if (!reviewStateLoaded) return reviewState;
  const snapshot = normalizeReviewState(structuredClone(reviewState));
  reviewStateSavePromise = fetch("/api/voice-library/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reviewState: snapshot })
  })
    .then(response => response.json().catch(() => null))
    .then(payload => {
      if (!payload || typeof payload !== "object") return snapshot;
      reviewState = normalizeReviewState(payload);
      return reviewState;
    })
    .catch(error => {
      console.error(error);
      return snapshot;
    });
  return reviewStateSavePromise;
}

function scheduleReviewStateSave() {
  if (!reviewStateLoaded) return;
  if (reviewStateSaveTimer) clearTimeout(reviewStateSaveTimer);
  reviewStateSaveTimer = setTimeout(() => {
    reviewStateSaveTimer = null;
    void persistReviewStateNow();
  }, 120);
}

async function flushReviewState() {
  if (!reviewStateLoaded) return reviewState;
  if (reviewStateSaveTimer) {
    clearTimeout(reviewStateSaveTimer);
    reviewStateSaveTimer = null;
  }
  await persistReviewStateNow();
  return reviewStateSavePromise;
}

function saveState() {
  localStorage.setItem(UI_KEY, JSON.stringify(uiState));
  scheduleReviewStateSave();
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

function timeAgo(value) {
  if (!value) return "just now";
  const delta = Math.max(0, Date.now() - value);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function loadDuration(url) {
  if (!url || durationCache.has(url)) return Promise.resolve(durationCache.get(url) || null);
  return new Promise(resolve => {
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.src = url;
    const done = seconds => {
      if (Number.isFinite(seconds) && seconds > 0) durationCache.set(url, seconds);
      resolve(durationCache.get(url) || null);
      scheduleRender();
    };
    probe.addEventListener("loadedmetadata", () => done(probe.duration), { once: true });
    probe.addEventListener("error", () => done(null), { once: true });
  });
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function currentProject() {
  if (!catalog) return null;
  if (uiState.projectId === "all") return null;
  return catalog.projects.find(project => project.id === uiState.projectId) || null;
}

function flattenGroups() {
  const projects = catalog?.projects || [];
  const groups = [];
  for (const project of projects) {
    for (const sectionName of ["director", "question"]) {
      for (const group of project.sections?.[sectionName] || []) {
        groups.push({
          ...group,
          project,
          libraryType: sectionName,
          searchText: normalizeText([
            project.title,
            project.id,
            group.title,
            group.subtitle,
            group.phase,
            group.domain,
            group.scope,
            group.event,
            ...(group.eventPath || []),
            group.cueKey,
            group.category,
            ...(group.keywords || []),
            ...(group.tags || []),
            ...(group.candidates || []).map(candidate => [candidate.title, candidate.label, candidate.text, candidate.fileName, candidate.event, candidate.cueKey].join(" "))
          ].join(" "))
        });
      }
    }
  }
  return groups;
}

function groupState(groupId) {
  if (!reviewState.groups[groupId]) {
    reviewState.groups[groupId] = {
      status: "unreviewed",
      notes: [],
      transcript: "",
      updatedAt: Date.now()
    };
  }
  return reviewState.groups[groupId];
}

function candidateState(candidateId) {
  if (!reviewState.candidates[candidateId]) {
    reviewState.candidates[candidateId] = {
      status: "unreviewed",
      tags: [],
      notes: [],
      transcript: "",
      updatedAt: Date.now()
    };
  }
  return reviewState.candidates[candidateId];
}

function parseNumericSuffix(fileName) {
  const baseName = pathBaseName(fileName);
  const match = baseName.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    value: Number(match[2]),
    width: match[2].length,
    suffix: match[3]
  };
}

function pathBaseName(value) {
  return String(value || "").split("/").pop() || "";
}

function nextGroupFileName(group) {
  const candidates = group?.candidates || [];
  if (!candidates.length && group?.libraryType === "director") return "line-01.mp3";
  const parsed = candidates
    .map(candidate => {
      const fileName = pathBaseName(candidate.fileName || candidate.audioPath || "");
      const suffix = parseNumericSuffix(fileName);
      return suffix ? { fileName, ...suffix } : null;
    })
    .filter(Boolean);

  if (parsed.length) {
    parsed.sort((a, b) => a.value - b.value || a.fileName.localeCompare(b.fileName));
    const top = parsed[parsed.length - 1];
    return `${top.prefix}${String(top.value + 1).padStart(top.width, "0")}${top.suffix}`;
  }

  const fallback = pathBaseName(candidates[candidates.length - 1]?.fileName || candidates[candidates.length - 1]?.audioPath || group?.id || "voice");
  const fallbackParsed = fallback.match(/^(.*?)(\.[^.]+)?$/);
  const stem = fallbackParsed?.[1] || fallback;
  const ext = fallbackParsed?.[2] || "";
  return `${stem}-02${ext}`;
}

function createGroupCandidateDraft(group) {
  const fileName = nextGroupFileName(group);
  const sourceCandidate = group.candidates[group.candidates.length - 1] || group.candidates[0] || null;
  const sourceAudioPath = String(sourceCandidate?.audioPath || "");
  const eventPath = Array.isArray(group.eventPath) && group.eventPath.length ? group.eventPath : [group.event || "default"];
  const defaultAudioPath = group.libraryType === "director"
    ? `/games/${group.projectId}/audio/host/director/${group.scope}/${group.domain || group.phase}/${eventPath.join("/")}/${fileName}`
    : `/games/${group.projectId}/audio/${fileName}`;
  const nextAudioPath = sourceAudioPath
    ? `${sourceAudioPath.slice(0, sourceAudioPath.lastIndexOf("/") + 1)}${fileName}`
    : defaultAudioPath;
  const id = `${group.id}:${fileName}`;

  return {
    id,
    groupId: group.id,
    projectId: group.projectId,
    kind: sourceCandidate?.kind || (group.libraryType === "question" ? "question-candidate" : "director-candidate"),
    title: fileName.replace(/\.(mp3|m4a|wav|aac|ogg|webm|mp4|mp5)$/i, ""),
    label: "New voice placeholder",
    phase: sourceCandidate?.phase || group.phase || null,
    phaseGroup: sourceCandidate?.phaseGroup || group.phase || null,
    domain: sourceCandidate?.domain || group.domain || group.phase || null,
    scope: sourceCandidate?.scope || group.scope || null,
    event: sourceCandidate?.event || group.event || null,
    eventPath,
    cueKey: sourceCandidate?.cueKey || group.cueKey || null,
    fileName,
    audioPath: nextAudioPath,
    canonicalAudioPath: nextAudioPath,
    filePath: null,
    text: "",
    modelId: sourceCandidate?.modelId || group.source?.modelId || "eleven_v3",
    voiceId: sourceCandidate?.voiceId || group.source?.voiceId || null,
    voiceSettings: sourceCandidate?.voiceSettings || group.source?.voiceSettings || null,
    updatedAt: Date.now(),
    durationSeconds: null,
    status: "unreviewed",
    tags: ["regenerate"],
    notes: [],
    transcript: "",
    transcriptSegments: [],
    generatedAudioPaths: [],
    generatedFiles: []
  };
}

async function addGroupCandidate(groupId) {
  const group = resolveGroup(groupId);
  if (!group || !reviewStateLoaded) return;
  const draft = createGroupCandidateDraft(group);
  reviewState.candidates[draft.id] = draft;
  groupState(group.id).updatedAt = Date.now();
  selectedGroupKey = group.id;
  selectedNodeKey = draft.id;
  uiState.expandedGroups = [...new Set([...(uiState.expandedGroups || []), group.id])];
  saveState();
  await flushReviewState();
  await loadCatalog(true);
  selectedGroupKey = group.id;
  selectedNodeKey = draft.id;
  render();
}

function effectiveCandidateStatus(candidate) {
  const state = candidateState(candidate.id);
  if ((state.tags || []).includes("regenerate")) return "regenerate";
  if (state.status && state.status !== "unreviewed") return state.status;
  if ((state.tags || []).length) return "approved";
  return "unreviewed";
}

function effectiveGroupStatus(group) {
  const state = groupState(group.id);
  return state.status || "unreviewed";
}

function groupReviewStatus(group) {
  const explicitStatus = effectiveGroupStatus(group);
  if (explicitStatus !== "unreviewed") return explicitStatus;

  const candidateStatuses = group.candidates.map(candidate => effectiveCandidateStatus(candidate));
  if (!candidateStatuses.length) return "unreviewed";
  if (candidateStatuses.some(status => status === "regenerate")) return "regenerate";
  if (candidateStatuses.some(status => status === "pending")) return "pending";
  if (candidateStatuses.every(status => status === "approved")) return "approved";
  if (candidateStatuses.some(status => status === "approved") && candidateStatuses.some(status => status === "unreviewed")) return "mixed";
  return "unreviewed";
}

function groupMatchesQuickView(group, quickView) {
  if (quickView === "all") return true;
  if (quickView === "unreviewed") {
    if (group.libraryType === "director" && !group.candidates.length) return true;
    return group.candidates.some(candidate => effectiveCandidateStatus(candidate) === "unreviewed");
  }
  if (quickView === "approved") {
    return effectiveGroupStatus(group) === "approved" || group.candidates.some(candidate => effectiveCandidateStatus(candidate) === "approved");
  }
  if (quickView === "pending" || quickView === "regenerate") {
    return effectiveGroupStatus(group) === quickView || group.candidates.some(candidate => effectiveCandidateStatus(candidate) === quickView);
  }
  return groupReviewStatus(group) === quickView;
}

function candidateMatchesQuickView(candidate, quickView) {
  if (quickView === "all") return true;
  return effectiveCandidateStatus(candidate) === quickView;
}

function statusLabel(status) {
  return {
    unreviewed: "Unreviewed",
    pending: "Pending",
    regenerate: "Regenerate",
    approved: "Approved",
    mixed: "Mixed"
  }[status] || "Unreviewed";
}

function statusClass(status) {
  return status || "unreviewed";
}

function projectOptions() {
  return [
    { id: "all", title: "All projects" },
    ...(catalog?.projects || []).map(project => ({ id: project.id, title: project.title }))
  ];
}

function reviewTags() {
  const tags = new Set(TAG_PRESETS);
  for (const tag of reviewState.customTags || []) tags.add(tag);
  for (const candidate of Object.values(reviewState.candidates)) {
    for (const tag of candidate.tags || []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function filteredGroups() {
  const groups = flattenGroups();
  const projectId = uiState.projectId;
  const libraryType = uiState.libraryType;
  const quickView = uiState.quickView;
  const search = normalizeText(uiState.search);
  const phaseSet = new Set(uiState.filterPhases);
  const categorySet = new Set(uiState.filterCategories);
  const keywordSet = new Set(uiState.filterKeywords);
  const reviewTagSet = new Set(uiState.filterReviewTags);

  return groups.filter(group => {
    if (projectId !== "all" && group.projectId !== projectId) return false;
    if (libraryType !== "all" && group.libraryType !== libraryType) return false;

    if (!groupMatchesQuickView(group, quickView)) return false;

    if (search && !group.searchText.includes(search)) return false;

    if (phaseSet.size && !phaseSet.has(String(group.phase || ""))) return false;
    if (categorySet.size && !categorySet.has(String(group.category || ""))) return false;
    if (keywordSet.size) {
      const keywords = new Set((group.keywords || []).map(value => String(value)));
      if (![...keywordSet].every(keyword => keywords.has(keyword))) return false;
    }
    if (reviewTagSet.size) {
      const tags = new Set(group.candidates.flatMap(candidate => candidateState(candidate.id).tags || []));
      if (![...reviewTagSet].every(tag => tags.has(tag))) return false;
    }

    return true;
  });
}

function sortedGroups() {
  const groups = filteredGroups();
  const dir = uiState.sortDir === "asc" ? 1 : -1;
  return groups.sort((a, b) => {
    const statusOrder = {
      regenerate: 0,
      pending: 1,
      unreviewed: 2,
      approved: 3,
      mixed: 4
    };
    switch (uiState.sortKey) {
      case "name":
        return a.title.localeCompare(b.title) * dir;
      case "duration":
        return (groupDurationSeconds(a) - groupDurationSeconds(b)) * dir;
      case "status":
        return ((statusOrder[groupReviewStatus(a)] ?? 9) - (statusOrder[groupReviewStatus(b)] ?? 9)) * dir;
      case "project":
        return a.project.title.localeCompare(b.project.title) * dir || a.title.localeCompare(b.title) * dir;
      case "recent":
      default:
        return ((b.updatedAt || 0) - (a.updatedAt || 0)) * dir;
    }
  });
}

function groupDurationSeconds(group) {
  const values = group.candidates.map(candidate => durationCache.get(candidate.audioPath) || 0).filter(Boolean);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0);
}

function regenerateTaggedCount() {
  return Object.values(reviewState.candidates || {}).filter(candidate => (candidate.tags || []).includes("regenerate")).length;
}

function toggleSetValue(values, value) {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return [...next];
}

function setGroupStatus(groupId, status) {
  const state = groupState(groupId);
  state.status = status === "regenerate" ? "unreviewed" : status;
  state.updatedAt = Date.now();
  saveState();
  render();
}

function setCandidateStatus(candidateId, status) {
  const state = candidateState(candidateId);
  if (status === "regenerate") {
    state.status = "unreviewed";
    state.tags = [...new Set([...(state.tags || []), "regenerate"])];
  } else {
    state.status = status;
    state.tags = (state.tags || []).filter(tag => tag !== "regenerate");
  }
  state.updatedAt = Date.now();
  saveState();
  render();
}

function addCandidateTag(candidateId, tag) {
  const clean = String(tag || "").trim().toLowerCase();
  if (!clean) return;
  const state = candidateState(candidateId);
  state.tags = [...new Set([...(state.tags || []), clean])];
  state.updatedAt = Date.now();
  if (!reviewState.customTags.includes(clean) && !TAG_PRESETS.includes(clean)) {
    reviewState.customTags = [...new Set([...(reviewState.customTags || []), clean])];
  }
  saveState();
  render();
}

function addGroupNote(groupId, text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const state = groupState(groupId);
  state.notes = [...(state.notes || []), { id: crypto.randomUUID?.() || `${Date.now()}`, text: clean, createdAt: Date.now() }];
  state.updatedAt = Date.now();
  saveState();
  render();
}

function addCandidateNote(candidateId, text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const state = candidateState(candidateId);
  state.notes = [...(state.notes || []), { id: crypto.randomUUID?.() || `${Date.now()}`, text: clean, createdAt: Date.now() }];
  state.updatedAt = Date.now();
  saveState();
  render();
}

function targetState(kind, id) {
  return kind === "candidate" ? candidateState(id) : groupState(id);
}

function sourceTranscript(candidate, group) {
  if (candidate) return candidate.text || candidate.label || candidate.title || candidate.fileName || "";
  if (group) return group.subtitle || group.title || group.phase || group.id || "";
  return "";
}

function transcriptText(kind, id, fallback) {
  const state = targetState(kind, id);
  const override = String(state.transcript || "").trim();
  return override || fallback || "";
}

function transcriptSegments(text) {
  return splitVoiceText(text);
}

function renderTranscriptSegments(text) {
  const segments = transcriptSegments(text);
  if (!segments.length) {
    return `<div class="muted">No cut points yet. Use <code>//</code> to split the audio into segments.</div>`;
  }
  return `<div class="segment-list">${segments.map((segment, index) => `<span class="segment-chip"><strong>${index + 1}</strong><span>${escape(segment)}</span></span>`).join("")}<div class="tiny">Saved as ${escape(String(segments.length))} segment${segments.length === 1 ? "" : "s"}.</div></div>`;
}

function saveTranscript(kind, id, text) {
  const state = targetState(kind, id);
  state.transcript = String(text || "");
  state.transcriptSegments = splitVoiceText(state.transcript);
  if (kind === "candidate") {
    const displayTitle = joinVoiceSegments(state.transcriptSegments).trim();
    if (displayTitle) state.label = displayTitle;
  }
  state.updatedAt = Date.now();
  saveState();
  void flushReviewState();
  render();
}

function resetTranscript(kind, id) {
  const state = targetState(kind, id);
  state.transcript = "";
  state.transcriptSegments = [];
  state.updatedAt = Date.now();
  saveState();
  render();
}

function toggleSelected(id) {
  const next = new Set(uiState.selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  uiState.selectedIds = [...next];
  saveState();
  render();
}

function expandGroup(id) {
  const next = new Set(uiState.expandedGroups);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  uiState.expandedGroups = [...next];
  if (!selectedGroupKey) selectedGroupKey = id;
  saveState();
  render();
}

function selectGroup(id) {
  selectedGroupKey = id;
  const group = flattened().find(item => item.id === id);
  if (group && group.candidates[0]) selectedNodeKey = group.candidates[0].id;
  saveState();
  render();
}

function selectCandidate(id, groupId) {
  selectedGroupKey = groupId;
  selectedNodeKey = id;
  saveState();
  render();
}

function flattened() {
  return sortedGroups();
}

function selectedGroup() {
  return flattened().find(group => group.id === selectedGroupKey) || flattened()[0] || null;
}

function selectedCandidate() {
  const group = selectedGroup();
  if (!group) return null;
  return group.candidates.find(candidate => candidate.id === selectedNodeKey) || group.candidates[0] || null;
}

async function runTaggedRegeneration() {
  if (regenerationBusy || window.__voiceLibraryRegenerationBusy || !regenerateTaggedCount()) return;
  regenerationBusy = true;
  window.__voiceLibraryRegenerationBusy = true;
  try {
    await flushReviewState();
    const response = await fetch("/api/voice-library/regenerate", {
      method: "POST"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Batch regeneration failed");
    }
    if (payload.reviewState) {
      reviewState = normalizeReviewState(payload.reviewState);
    }
    await loadCatalog(true);
  } catch (error) {
    console.error(error);
    audio.dataset.currentMeta = `Regeneration failed: ${error.message || "unknown error"}`;
    syncAudioBar();
  } finally {
    regenerationBusy = false;
    window.__voiceLibraryRegenerationBusy = false;
    render();
  }
}

function clearFilters() {
  uiState.filterPhases = [];
  uiState.filterCategories = [];
  uiState.filterKeywords = [];
  uiState.filterReviewTags = [];
  uiState.search = "";
  saveState();
  render();
}

function groupMeta(group) {
  return [...new Set(group.tags || [])];
}

function candidateMeta(candidate) {
  const manual = candidateState(candidate.id);
  return [...new Set([...(candidate.keywords || []), ...(manual.tags || [])])];
}

function renderDuration(group) {
  const total = group.candidates.map(candidate => durationCache.get(candidate.audioPath) || 0).filter(Boolean).reduce((sum, value) => sum + value, 0);
  if (!total) return "—";
  return `${durationLabel(total)} · ${group.candidates.length} files`;
}

function renderMainRows() {
  const groups = flattened();
  if (!groups.length) {
    return `<div class="empty-state"><strong>No results</strong><span>Try clearing a filter or switching project/type.</span></div>`;
  }
  const directorGroups = groups.filter(group => group.libraryType === "director");
  const questionGroups = groups.filter(group => group.libraryType === "question");
  return [
    renderDirectorTreeRows(directorGroups),
    ...questionGroups.map(group => renderQuestionRows(group))
  ].join("");
}

function directorScopeLabel(scope) {
  return {
    phase: "phase",
    global: "global",
    cross: "cross"
  }[scope] || scope || "phase";
}

function directorScopeSortValue(scope) {
  return { phase: 0, global: 1, cross: 2 }[scope] ?? 9;
}

function createEventPathNode(name) {
  return {
    name,
    children: new Map(),
    groups: [],
    groupCount: 0,
    fileCount: 0
  };
}

function insertEventPath(root, group) {
  const path = Array.isArray(group.eventPath) && group.eventPath.length
    ? group.eventPath.map(item => String(item || "default"))
    : [String(group.event || "default")];
  let node = root;
  for (const part of path) {
    if (!node.children.has(part)) node.children.set(part, createEventPathNode(part));
    node = node.children.get(part);
    node.groupCount += 1;
    node.fileCount += group.candidates.length;
  }
  node.groups.push(group);
}

function sortedEventNodes(node) {
  return [...node.children.values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(child => ({
      ...child,
      children: sortedEventNodes(child),
      groups: child.groups.sort((a, b) => String(a.cueKey).localeCompare(String(b.cueKey)))
    }));
}

function buildDirectorTree(groups) {
  const projects = new Map();
  for (const group of groups) {
    const projectId = group.projectId || group.project?.id || "unknown";
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        project: group.project || { id: projectId, title: projectId },
        scopes: new Map(),
        groupCount: 0,
        fileCount: 0
      });
    }
    const projectNode = projects.get(projectId);
    const scope = group.scope || "phase";
    const phaseOrDomain = group.domain || group.phase || group.category || "unknown";
    if (!projectNode.scopes.has(scope)) {
      projectNode.scopes.set(scope, {
        scope,
        domains: new Map(),
        groupCount: 0,
        fileCount: 0
      });
    }
    const scopeNode = projectNode.scopes.get(scope);
    if (!scopeNode.domains.has(phaseOrDomain)) {
      scopeNode.domains.set(phaseOrDomain, {
        phaseOrDomain,
        eventRoot: createEventPathNode(phaseOrDomain),
        groups: [],
        groupCount: 0,
        fileCount: 0
      });
    }
    const domainNode = scopeNode.domains.get(phaseOrDomain);
    domainNode.groups.push(group);
    insertEventPath(domainNode.eventRoot, group);
    domainNode.groupCount += 1;
    domainNode.fileCount += group.candidates.length;
    scopeNode.groupCount += 1;
    scopeNode.fileCount += group.candidates.length;
    projectNode.groupCount += 1;
    projectNode.fileCount += group.candidates.length;
  }

  return [...projects.values()]
    .sort((a, b) => String(a.project.title || a.project.id).localeCompare(String(b.project.title || b.project.id)))
    .map(projectNode => ({
      ...projectNode,
      scopes: [...projectNode.scopes.values()]
        .sort((a, b) => directorScopeSortValue(a.scope) - directorScopeSortValue(b.scope) || String(a.scope).localeCompare(String(b.scope)))
        .map(scopeNode => ({
          ...scopeNode,
          domains: [...scopeNode.domains.values()]
            .sort((a, b) => String(a.phaseOrDomain).localeCompare(String(b.phaseOrDomain)))
            .map(domainNode => ({
              ...domainNode,
              eventTree: sortedEventNodes(domainNode.eventRoot),
              groups: domainNode.groups.sort((a, b) => String(a.cueKey).localeCompare(String(b.cueKey)))
            }))
        }))
    }));
}

function renderEventPathNodes(nodes, depth = 0) {
  return nodes.map(node => html`
    <section class="tree-event-node" style="--tree-depth:${depth}">
      <div class="tree-event-head">
        <span class="tree-kicker">${depth === 0 ? "Event" : "Subevent"}</span>
        <strong>${escape(node.name)}</strong>
        <span>${escape(`${node.groupCount || node.groups.length} events · ${node.fileCount || node.groups.reduce((sum, group) => sum + group.candidates.length, 0)} files`)}</span>
      </div>
      ${node.children?.length ? renderEventPathNodes(node.children, depth + 1) : ""}
      ${node.groups.map(group => renderDirectorCueRow(group)).join("")}
    </section>
  `).join("");
}

function renderDirectorTreeRows(groups) {
  if (!groups.length) return "";
  return buildDirectorTree(groups).map(projectNode => html`
    <section class="director-project-node">
      <div class="tree-project-head">
        <span class="tree-kicker">Project</span>
        <strong>${escape(projectNode.project.title || projectNode.project.id)}</strong>
        <span>${escape(`${projectNode.groupCount} events · ${projectNode.fileCount} files`)}</span>
      </div>
      ${projectNode.scopes.map(scopeNode => html`
        <section class="tree-scope-node">
          <div class="tree-scope-head">
            <span class="tree-kicker">Scope</span>
            <strong>${escape(directorScopeLabel(scopeNode.scope))}</strong>
            <span>${escape(`${scopeNode.groupCount} events · ${scopeNode.fileCount} files`)}</span>
          </div>
          ${scopeNode.domains.map(domainNode => html`
            <section class="tree-domain-node">
              <div class="tree-domain-head">
                <span class="tree-kicker">${escape(scopeNode.scope === "phase" ? "Phase" : "Domain")}</span>
                <strong>${escape(domainNode.phaseOrDomain)}</strong>
                <span>${escape(`${domainNode.groupCount} events · ${domainNode.fileCount} files`)}</span>
              </div>
              ${renderEventPathNodes(domainNode.eventTree || [])}
            </section>
          `).join("")}
        </section>
      `).join("")}
    </section>
  `).join("");
}

function renderDirectorCueRow(group) {
  const expanded = uiState.expandedGroups.includes(group.id);
  const selected = uiState.selectedIds.includes(group.id);
  const notesCount = (groupState(group.id).notes || []).length + group.candidates.reduce((sum, candidate) => sum + (candidateState(candidate.id).notes || []).length, 0);
  return html`
    <section class="record director-event-row ${expanded ? "expanded" : ""}">
      <div class="record-head ${selected ? "selected" : ""}">
        <div class="record-leading">
          <label class="check"><input type="checkbox" data-select-id="${escape(group.id)}" ${selected ? "checked" : ""} /></label>
        </div>
        <button class="record-main btn-link" data-open-group="${escape(group.id)}" type="button">
          <span class="record-kicker">Event · ${escape(group.event || "default")}</span>
          <h3 class="record-title">${escape(group.event || group.title || "default")}</h3>
          <p class="record-subtitle">${escape(group.cueKey || group.subtitle || "Director cue")}</p>
          <div class="record-meta-line">
            <span>${escape(`${group.projectId} / ${group.scope || "phase"} / ${group.domain || group.phase || "unknown"} / ${(group.eventPath || [group.event || "default"]).join(" / ")}`)}</span>
            <span>${escape(renderDuration(group))}</span>
            <span>${escape(timeAgo(group.updatedAt))}</span>
            <span>${escape(String(notesCount))} notes</span>
          </div>
        </button>
        <div class="record-details">
          <div class="chips record-tags">${(groupMeta(group).slice(0, 3)).map(tag => `<span class="chip">${escape(tag)}</span>`).join("") || `<span class="tiny">No tags</span>`}</div>
        </div>
        <div class="record-actions">
          <div class="row-actions">
            <button class="row-action" data-play-group="${escape(group.id)}" type="button">Play</button>
            <button class="row-action" data-toggle-group="${escape(group.id)}" type="button">${expanded ? "Collapse" : "Expand"}</button>
            <button class="row-action primary" data-add-group-candidate="${escape(group.id)}" type="button" title="Add a new voice to this event">+</button>
          </div>
        </div>
      </div>
      ${expanded ? renderCandidateRows(group) : ""}
    </section>
  `;
}

function renderQuestionRows(group) {
  const candidates = group.candidates.filter(candidate => candidateMatchesQuickView(candidate, uiState.quickView));
  if (!candidates.length && uiState.quickView !== "all") return "";
  return html`
    <section class="record question-stream">
      ${candidates.map(candidate => {
        const selected = uiState.selectedIds.includes(candidate.id);
        const status = effectiveCandidateStatus(candidate);
        const active = candidate.id === selectedNodeKey;
        const candidateNotes = candidateState(candidate.id).notes || [];
        return html`
          <div class="candidate-record standalone ${active ? "selected" : ""}">
            <div class="record-leading">
              <label class="check"><input type="checkbox" data-select-id="${escape(candidate.id)}" ${selected ? "checked" : ""} /></label>
              <button class="badge ${statusClass(status)}" data-set-candidate-status="${escape(candidate.id)}" data-status-cycle="true" type="button">${statusLabel(status)}</button>
            </div>
            <button class="candidate-main btn-link" data-open-candidate="${escape(candidate.id)}" data-group-id="${escape(group.id)}" type="button">
              <span class="record-kicker">${escape("Question clip")} · ${escape(group.project.title)}</span>
              <h4 class="candidate-title">${escape(group.title)}</h4>
              <p class="candidate-subtitle">${escape(candidate.label || candidate.title || candidate.fileName || "")}</p>
              <div class="record-meta-line">
                <span>${escape(group.category || "question")}</span>
                <span>${escape(durationLabel(durationCache.get(candidate.audioPath) || 0))}</span>
                <span>${escape(timeAgo(candidate.updatedAt || group.updatedAt))}</span>
                <span>${escape(String(candidateNotes.length))} notes</span>
              </div>
            </button>
            <div class="record-details">
              <div class="chips record-tags">${(candidateMeta(candidate).slice(0, 3)).map(tag => `<span class="chip soft">${escape(tag)}</span>`).join("") || `<span class="tiny">No tags</span>`}</div>
            </div>
            <div class="record-actions">
              <div class="row-actions">
                <button class="row-action primary" data-play-candidate="${escape(candidate.id)}" data-group-id="${escape(group.id)}" type="button">${candidate.audioPath === audio.dataset.currentUrl ? (audio.paused ? "Resume" : "Playing") : "Play"}</button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderCandidateRows(group) {
  const candidates = group.candidates.filter(candidate => candidateMatchesQuickView(candidate, uiState.quickView));
  if (!candidates.length && uiState.quickView !== "all") return "";
  return candidates.map(candidate => {
    const selected = uiState.selectedIds.includes(candidate.id);
    const status = effectiveCandidateStatus(candidate);
    const active = candidate.id === selectedNodeKey;
    return html`
      <div class="candidate-record ${active ? "selected" : ""}">
        <div class="record-leading">
          <label class="check"><input type="checkbox" data-select-id="${escape(candidate.id)}" ${selected ? "checked" : ""} /></label>
          <button class="badge ${statusClass(status)}" data-set-candidate-status="${escape(candidate.id)}" data-status-cycle="true" type="button">${statusLabel(status)}</button>
        </div>
        <button class="candidate-main btn-link" data-open-candidate="${escape(candidate.id)}" data-group-id="${escape(group.id)}" type="button">
          <span class="record-kicker">${escape(candidate.kind === "question-candidate" ? "Question clip" : `Director clip · ${candidate.cueKey || group.cueKey || candidate.fileName}`)}</span>
          <h4 class="candidate-title">${escape(candidate.label || "New voice placeholder")}</h4>
          <p class="candidate-subtitle">${escape(candidate.title || candidate.fileName)}</p>
          <div class="record-meta-line">
            <span>${escape(candidate.category || (candidate.scope ? `${candidate.scope} / ${candidate.domain || candidate.phase || "—"} / ${(candidate.eventPath || [candidate.event || "—"]).join(" / ")}` : (candidate.phase || "—")))}</span>
            <span>${escape(durationLabel(durationCache.get(candidate.audioPath) || 0))}</span>
            <span>${escape(timeAgo(candidate.updatedAt || group.updatedAt))}</span>
            <span>${escape(String((candidateState(candidate.id).notes || []).length))} notes</span>
          </div>
        </button>
        <div class="record-details">
          <div class="chips record-tags">${(candidateMeta(candidate).slice(0, 3)).map(tag => `<span class="chip soft">${escape(tag)}</span>`).join("") || `<span class="tiny">No tags</span>`}</div>
        </div>
        <div class="record-actions">
          <div class="row-actions">
            <button class="row-action primary" data-play-candidate="${escape(candidate.id)}" data-group-id="${escape(group.id)}" type="button">${candidate.audioPath === audio.dataset.currentUrl ? (audio.paused ? "Resume" : "Playing") : "Play"}</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function topStats() {
  const groups = flattenGroups();
  const directorCount = groups.filter(group => group.libraryType === "director").length;
  const questionCount = groups.filter(group => group.libraryType === "question").length;
  const reviewedCount = groups.filter(group => groupReviewStatus(group) !== "unreviewed").length;
  return {
    projectCount: catalog?.projects?.length || 0,
    groupCount: groups.length,
    candidateCount: groups.reduce((sum, group) => sum + group.candidates.length, 0),
    reviewedCount,
    directorCount,
    questionCount
  };
}

function renderFilters() {
  const project = currentProject();
  const allGroups = project ? flattenGroups().filter(group => group.projectId === project.id) : flattenGroups();
  const directorGroups = allGroups.filter(group => group.libraryType === "director");
  const questionGroups = allGroups.filter(group => group.libraryType === "question");
  const phaseOptions = [...new Set(directorGroups.map(group => group.phase).filter(Boolean))].sort();
  const categoryOptions = [...new Set(questionGroups.map(group => group.category).filter(Boolean))].sort();
  const keywordOptions = [...new Set(questionGroups.flatMap(group => group.keywords || []).filter(Boolean))].sort();
  const reviewTagOptions = reviewTags();
  const activeFilterCount = uiState.filterPhases.length + uiState.filterCategories.length + uiState.filterKeywords.length + uiState.filterReviewTags.length;

  return html`
    <aside class="panel filters-panel">
      <div class="panel-section">
        <h3>Filters</h3>
        <p>${escape(activeFilterCount ? `${activeFilterCount} filters active` : "No filter means default order.")}</p>
        <div class="detail-actions">
          <button class="btn" data-clear-filters type="button">Clear</button>
        </div>
      </div>
      <div class="filter-clusters">
        <details class="cluster" open>
          <summary><strong>Phase / Domain</strong><span class="count">${phaseOptions.length}</span></summary>
          <div class="cluster-body">
            <div class="pill-group">
              ${phaseOptions.map(phase => `<button class="pill ${uiState.filterPhases.includes(phase) ? "active" : ""}" data-filter-toggle="phase" data-filter-value="${escape(phase)}" type="button">${escape(phase)}</button>`).join("")}
            </div>
          </div>
        </details>
        <details class="cluster" open>
          <summary><strong>Category</strong><span class="count">${categoryOptions.length}</span></summary>
          <div class="cluster-body">
            <div class="pill-group">
              ${categoryOptions.map(category => `<button class="pill ${uiState.filterCategories.includes(category) ? "active" : ""}" data-filter-toggle="category" data-filter-value="${escape(category)}" type="button">${escape(category)}</button>`).join("")}
            </div>
          </div>
        </details>
        <details class="cluster" open>
          <summary><strong>Keywords</strong><span class="count">${keywordOptions.length}</span></summary>
          <div class="cluster-body">
            <div class="pill-group">
              ${keywordOptions.map(keyword => `<button class="pill ${uiState.filterKeywords.includes(keyword) ? "active" : ""}" data-filter-toggle="keyword" data-filter-value="${escape(keyword)}" type="button">${escape(keyword)}</button>`).join("")}
            </div>
          </div>
        </details>
        <details class="cluster" open>
          <summary><strong>Review tags</strong><span class="count">${reviewTagOptions.length}</span></summary>
          <div class="cluster-body">
            <div class="pill-group">
              ${reviewTagOptions.map(tag => `<button class="pill ${uiState.filterReviewTags.includes(tag) ? "active" : ""}" data-filter-toggle="reviewTag" data-filter-value="${escape(tag)}" type="button">${escape(tag)}</button>`).join("")}
            </div>
          </div>
        </details>
      </div>
    </aside>
  `;
}

function detailTarget() {
  return selectedCandidate() || selectedGroup();
}

function renderDetail() {
  const group = selectedGroup();
  const candidate = selectedCandidate();
  if (!group) {
    return html`
      <aside class="panel detail-panel">
        <div class="detail-card">
          <div class="detail-header">
            <h2>No selection yet</h2>
            <p class="muted">Choose a row to hear it, tag it, and decide whether it stays.</p>
          </div>
        </div>
      </aside>
    `;
  }

  const candidateStatus = candidate ? effectiveCandidateStatus(candidate) : null;
  const groupNotes = groupState(group.id).notes || [];
  const candidateNotes = candidate ? candidateState(candidate.id).notes || [] : [];
  const candidateTags = candidate ? candidateState(candidate.id).tags || [] : [];
  const candidateGeneratedFiles = candidate ? candidateState(candidate.id).generatedFiles || [] : [];
  const transcriptKind = candidate ? "candidate" : "group";
  const transcriptId = candidate ? candidate.id : group.id;
  const transcriptFallback = sourceTranscript(candidate, group);
  const transcriptValue = transcriptText(transcriptKind, transcriptId, transcriptFallback);
  const transcriptSegmentHtml = renderTranscriptSegments(transcriptValue);

  return html`
    <aside class="panel detail-panel">
      <div class="detail-card">
        <div class="detail-header">
          <span class="brand-eyebrow">Inspector</span>
          <h2>${escape(candidate ? (candidate.label || candidate.title || candidate.fileName || "") : group.title)}</h2>
          <p class="muted">${escape(candidate ? (candidate.cueKey || candidate.title || candidate.fileName || "") : group.subtitle || group.cueKey || group.phase || group.category || "")}</p>
        </div>
        <div class="detail-grid">
          <div class="detail-stat"><span>Project</span><strong>${escape(group.project.title)}</strong></div>
          <div class="detail-stat"><span>Type</span><strong>${escape(group.libraryType === "director" ? "Director" : "Question")}</strong></div>
          ${group.libraryType === "director" ? `<div class="detail-stat"><span>Cue</span><strong>${escape(group.cueKey || "—")}</strong></div>` : ""}
          ${candidate ? `<div class="detail-stat"><span>State</span><strong>${escape(statusLabel(candidateStatus))}</strong></div>` : ""}
          <div class="detail-stat"><span>Files</span><strong>${escape(String(group.candidates.length))}</strong></div>
        </div>
        <div class="chips">
          ${(candidate ? candidateTags : []).slice(0, 6).map(tag => `<span class="chip">${escape(tag)}</span>`).join("") || `<span class="tiny">No tags yet</span>`}
        </div>
        <div class="detail-actions">
          <div class="detail-actions-primary">
            <button class="btn primary" data-play-target="${escape(candidate ? candidate.id : group.id)}" type="button">Play</button>
            <button class="btn" data-set-target-status="approved" data-target-id="${escape(candidate ? candidate.id : group.id)}" data-target-kind="${candidate ? "candidate" : "group"}" type="button">Approve</button>
            <button class="btn" data-set-target-status="pending" data-target-id="${escape(candidate ? candidate.id : group.id)}" data-target-kind="${candidate ? "candidate" : "group"}" type="button">Pending</button>
          </div>
          ${candidate ? `<button class="btn danger detail-actions-secondary" data-set-target-status="regenerate" data-target-id="${escape(candidate.id)}" data-target-kind="candidate" type="button">Regenerate tag</button>` : ""}
        </div>
        <div class="detail-card transcript-card">
          <div class="detail-header">
            <h3>Transcript</h3>
            <p class="muted">Edit the script here. Use <code>//</code> to mark cut points for audio slicing.</p>
          </div>
          <textarea class="transcript-input" data-transcript-input="${escape(transcriptKind)}:${escape(transcriptId)}" data-target-kind="${escape(transcriptKind)}" data-target-id="${escape(transcriptId)}" placeholder="Type or edit the spoken line here...">${escape(transcriptValue)}</textarea>
          <div class="transcript-actions">
            <button class="btn primary" data-save-transcript data-target-kind="${escape(transcriptKind)}" data-target-id="${escape(transcriptId)}" type="button">Save transcript</button>
            <button class="btn" data-reset-transcript data-target-kind="${escape(transcriptKind)}" data-target-id="${escape(transcriptId)}" type="button">Use source</button>
          </div>
          <div class="transcript-preview" data-transcript-preview="${escape(transcriptKind)}:${escape(transcriptId)}">
            ${transcriptSegmentHtml}
          </div>
        </div>
        <div class="field">
          <label>Child tag</label>
          <input type="text" data-note-input="tag" placeholder="too fast, tone mismatch, ..." />
          <button class="btn" data-add-note="tag" data-target-id="${escape(candidate ? candidate.id : group.id)}" data-target-kind="${candidate ? "candidate" : "group"}" type="button">Add child tag</button>
        </div>
        <div class="field">
          <label>Add note</label>
          <textarea data-note-input="note" placeholder="Short note about timing, tone, or what to fix..."></textarea>
          <button class="btn" data-add-note="note" data-target-id="${escape(candidate ? candidate.id : group.id)}" data-target-kind="${candidate ? "candidate" : "group"}" type="button">Add note</button>
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-header">
          <h3>Source</h3>
          <p class="muted">${escape(group.source?.manifestPath || group.source?.packPath || "Filesystem scan")}</p>
        </div>
        <div class="detail-grid">
          <div class="detail-stat"><span>Duration</span><strong>${escape(candidate ? durationLabel(durationCache.get(candidate.audioPath) || 0) : renderDuration(group))}</strong></div>
          <div class="detail-stat"><span>Updated</span><strong>${escape(timeAgo(candidate?.updatedAt || group.updatedAt))}</strong></div>
        </div>
        <div class="notes-list">
          ${((candidate ? candidateNotes : groupNotes).length
            ? (candidate ? candidateNotes : groupNotes).map(note => `
              <div class="note">
                <time>${escape(timeAgo(note.createdAt))}</time>
                <div>${escape(note.text)}</div>
              </div>
            `).join("")
            : `<div class="muted">No notes yet.</div>`)}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-header">
          <h3>Group files</h3>
          <p class="muted">Use the rows to compare candidates without leaving the group.</p>
        </div>
        <div class="notes-list">
          ${group.candidates.map(candidateRow => `
            <button class="row-action ${candidateRow.id === candidate?.id ? "active" : ""}" data-open-candidate="${escape(candidateRow.id)}" data-group-id="${escape(group.id)}" type="button">
              ${escape(candidateRow.label)} · ${escape(durationLabel(durationCache.get(candidateRow.audioPath) || 0))}
            </button>
          `).join("")}
        </div>
      </div>
    </aside>
  `;
}

function renderToolbar() {
  const stats = topStats();
  return html`
    <header class="voice-header">
      <div class="brand-block">
        <span class="brand-eyebrow">Joyly backend</span>
        <h1 class="brand-title">Voice Library Preview</h1>
        <p class="brand-copy">A table-first workbench for listening, marking, tagging, and sending batches back to generation.</p>
      </div>
      <div class="summary-grid">
        <div class="summary-card"><span>Projects</span><strong>${escape(String(stats.projectCount))}</strong></div>
        <div class="summary-card"><span>Groups</span><strong>${escape(String(stats.groupCount))}</strong></div>
        <div class="summary-card"><span>Candidates</span><strong>${escape(String(stats.candidateCount))}</strong></div>
        <div class="summary-card"><span>Reviewed</span><strong>${escape(String(stats.reviewedCount))}</strong></div>
      </div>
    </header>
  `;
}

function renderControls() {
  const projects = projectOptions();
  return html`
    <section class="voice-toolbar panel">
      <div class="toolbar-row">
        <div class="toolbar-actions">
          <div class="pill-group" role="tablist" aria-label="Project switcher">
            ${projects.map(project => `<button class="pill ${uiState.projectId === project.id ? "active" : ""}" data-project="${escape(project.id)}" type="button">${escape(project.title)}</button>`).join("")}
          </div>
          <div class="pill-group" role="tablist" aria-label="Library switcher">
            ${[
              { id: "all", label: "All voices" },
              { id: "director", label: "Director voices" },
              { id: "question", label: "Question voices" }
            ].map(option => `<button class="pill ${uiState.libraryType === option.id ? "active" : ""}" data-library-type="${escape(option.id)}" type="button">${escape(option.label)}</button>`).join("")}
          </div>
          <div class="search-field">
            <span class="tiny">Search</span>
            <input data-search-input type="search" placeholder="files, scripts, tags, keywords..." value="${escape(uiState.search)}" />
          </div>
        </div>
        <div class="toolbar-meta">
          <button class="btn" data-toggle-sort type="button">${escape(uiState.sortKey === "recent" ? "Newest" : uiState.sortKey === "name" ? "Name" : uiState.sortKey === "duration" ? "Duration" : uiState.sortKey === "status" ? "Status" : "Project")}</button>
          <button class="btn" data-toggle-sort-dir type="button">${escape(uiState.sortDir === "desc" ? "Desc" : "Asc")}</button>
          <button class="btn" data-scan-library type="button">Rescan filesystem</button>
          <button class="btn primary" data-run-tagged type="button">Generate regenerate-tagged (${escape(String(regenerateTaggedCount()))})</button>
        </div>
      </div>
      <div class="toolbar-row">
        <div class="pill-group" aria-label="Quick view">
          ${[
            { id: "all", label: "All" },
            { id: "unreviewed", label: "Unreviewed" },
            { id: "pending", label: "Pending" },
            { id: "regenerate", label: "Regenerate" },
            { id: "approved", label: "Approved" }
          ].map(option => `<button class="pill ${uiState.quickView === option.id ? "active" : ""}" data-quick-view="${escape(option.id)}" type="button">${escape(option.label)}</button>`).join("")}
        </div>
        <div class="toolbar-meta">
          <span class="tiny">${escape(`${uiState.selectedIds.length} selected`)}</span>
          <button class="btn" data-clear-selection type="button">Clear selection</button>
        </div>
      </div>
    </section>
  `;
}

function renderTable() {
  return html`
    <section class="panel table-panel">
      <div class="list-header" aria-hidden="true">
        <span>Status</span>
        <span>Record</span>
        <span>Details</span>
        <span>Actions</span>
      </div>
      <div class="group-list">${renderMainRows()}</div>
    </section>
  `;
}

function renderFooter() {
  const current = audio.dataset.currentLabel || "Nothing playing";
  const currentMeta = audio.dataset.currentMeta || "Choose a row to preview.";
  const progress = Number(audio.duration) > 0 ? Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100)) : 0;
  return html`
    <footer class="audio-bar">
      <div class="audio-bar-row">
        <button class="btn primary" data-audio-toggle type="button">${audio.paused ? "Play" : "Pause"}</button>
        <button class="btn" data-audio-stop type="button">Stop</button>
        <div>
          <div class="title" data-audio-current-title>${escape(current)}</div>
          <div class="meta" data-audio-current-meta>${escape(currentMeta)}</div>
        </div>
        <div style="margin-left:auto" class="meta" data-audio-current-time>${escape(durationLabel(audio.duration || 0))} · ${escape(durationLabel(audio.currentTime || 0))}</div>
      </div>
      <div class="progress" aria-hidden="true"><span data-audio-progress style="width:${progress}%"></span></div>
    </footer>
  `;
}

function syncAudioBar() {
  const footer = app.querySelector(".audio-bar");
  if (!footer) return;
  const toggle = footer.querySelector("[data-audio-toggle]");
  const currentTitle = footer.querySelector("[data-audio-current-title]");
  const currentMeta = footer.querySelector("[data-audio-current-meta]");
  const currentTime = footer.querySelector("[data-audio-current-time]");
  const progress = footer.querySelector("[data-audio-progress]");
  if (toggle) toggle.textContent = audio.paused ? "Play" : "Pause";
  if (currentTitle) currentTitle.textContent = audio.dataset.currentLabel || "Nothing playing";
  if (currentMeta) currentMeta.textContent = audio.dataset.currentMeta || "Choose a row to preview.";
  if (currentTime) currentTime.textContent = `${durationLabel(audio.duration || 0)} · ${durationLabel(audio.currentTime || 0)}`;
  if (progress) {
    const percent = Number(audio.duration) > 0 ? Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100)) : 0;
    progress.style.width = `${percent}%`;
  }
}

function render() {
  if (!catalog) {
    app.innerHTML = `<main class="voice-shell"><div class="empty-state"><strong>Loading voice library…</strong><span>Scanning the filesystem for director and question audio.</span></div></main>`;
    return;
  }
  app.innerHTML = html`
    <main class="voice-shell">
      ${renderToolbar()}
      ${renderControls()}
      <div class="layout">
        ${renderFilters()}
        ${renderTable()}
        ${renderDetail()}
      </div>
      ${renderFooter()}
    </main>
  `;
}

function cycleStatus(current) {
  const order = ["unreviewed", "pending", "regenerate", "approved"];
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}

function playUrl(url, label, meta) {
  if (!url) return;
  if (audio.dataset.currentUrl === url && !audio.paused) {
    audio.pause();
    return;
  }
  audio.src = url;
  audio.dataset.currentUrl = url;
  audio.dataset.currentLabel = label || "Preview";
  audio.dataset.currentMeta = meta || url;
  audio.dataset.currentId = url;
  audio.play().catch(() => {});
}

function resolveGroup(id) {
  return flattened().find(group => group.id === id) || null;
}

function resolveCandidate(id) {
  return flattened().flatMap(group => group.candidates.map(candidate => ({ group, candidate }))).find(entry => entry.candidate.id === id) || null;
}

function handleAction(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.project) {
    uiState.projectId = button.dataset.project;
    selectedGroupKey = "";
    selectedNodeKey = "";
    saveState();
    render();
    return;
  }

  if (button.dataset.libraryType) {
    uiState.libraryType = button.dataset.libraryType;
    saveState();
    render();
    return;
  }

  if (button.dataset.quickView) {
    uiState.quickView = button.dataset.quickView;
    saveState();
    render();
    return;
  }

  if (button.dataset.toggleSort) {
    const next = { recent: "name", name: "duration", duration: "status", status: "project", project: "recent" };
    uiState.sortKey = next[uiState.sortKey] || "recent";
    saveState();
    render();
    return;
  }

  if (button.dataset.toggleSortDir) {
    uiState.sortDir = uiState.sortDir === "desc" ? "asc" : "desc";
    saveState();
    render();
    return;
  }

  if (button.dataset.scanLibrary) {
    loadCatalog(true);
    return;
  }

  if (button.dataset.runTagged !== undefined) {
    void runTaggedRegeneration();
    return;
  }

  if (button.dataset.clearSelection) {
    uiState.selectedIds = [];
    saveState();
    render();
    return;
  }

  if (button.dataset.clearFilters) {
    clearFilters();
    return;
  }

  if (button.dataset.toggleGroup) {
    expandGroup(button.dataset.toggleGroup);
    return;
  }

  if (button.dataset.addGroupCandidate) {
    void addGroupCandidate(button.dataset.addGroupCandidate);
    return;
  }

  if (button.dataset.openGroup) {
    const nextGroupId = button.dataset.openGroup;
    selectGroup(nextGroupId);
    expandGroup(nextGroupId);
    return;
  }

  if (button.dataset.openCandidate) {
    selectCandidate(button.dataset.openCandidate, button.dataset.groupId);
    return;
  }

  if (button.dataset.playGroup) {
    const group = resolveGroup(button.dataset.playGroup);
    const firstCandidate = group?.candidates?.[0];
    if (firstCandidate) playUrl(firstCandidate.audioPath, firstCandidate.label, firstCandidate.fileName);
    selectGroup(button.dataset.playGroup);
    return;
  }

  if (button.dataset.playCandidate) {
    const entry = resolveCandidate(button.dataset.playCandidate);
    if (entry) {
      const candidate = entry.candidate;
      playUrl(candidate.audioPath, candidate.label, candidate.fileName);
      selectCandidate(candidate.id, entry.group.id);
    }
    return;
  }

  if (button.dataset.playTarget) {
    const group = selectedGroup();
    const candidate = selectedCandidate();
    if (candidate && candidate.id === button.dataset.playTarget) {
      playUrl(candidate.audioPath, candidate.label, candidate.fileName);
    } else if (group && group.id === button.dataset.playTarget && group.candidates[0]) {
      playUrl(group.candidates[0].audioPath, group.candidates[0].label, group.candidates[0].fileName);
    }
    return;
  }

  if (button.dataset.audioToggle !== undefined) {
    if (audio.src) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      render();
    }
    return;
  }

  if (button.dataset.audioStop !== undefined) {
    audio.pause();
    audio.currentTime = 0;
    render();
    return;
  }

  if (button.dataset.selectId) {
    toggleSelected(button.dataset.selectId);
    return;
  }

  if (button.dataset.statusCycle !== undefined) {
    if (button.dataset.setGroupStatus) {
      setGroupStatus(button.dataset.setGroupStatus, cycleStatus(effectiveGroupStatus(resolveGroup(button.dataset.setGroupStatus) || { id: button.dataset.setGroupStatus, candidates: [] })));
    }
    if (button.dataset.setCandidateStatus) {
      const entry = resolveCandidate(button.dataset.setCandidateStatus);
      if (entry) {
        setCandidateStatus(button.dataset.setCandidateStatus, cycleStatus(effectiveCandidateStatus(entry.candidate)));
      }
    }
    return;
  }

  if (button.dataset.setGroupStatus) {
    setGroupStatus(button.dataset.setGroupStatus, button.dataset.statusValue || "approved");
    return;
  }

  if (button.dataset.setCandidateStatus) {
    setCandidateStatus(button.dataset.setCandidateStatus, button.dataset.statusValue || "approved");
    return;
  }

  if (button.dataset.setTargetStatus) {
    const kind = button.dataset.targetKind;
    const targetId = button.dataset.targetId;
    const status = button.dataset.setTargetStatus;
    if (kind === "group") setGroupStatus(targetId, status);
    else setCandidateStatus(targetId, status);
    return;
  }

  if (button.dataset.addNote) {
    const kind = button.dataset.targetKind;
    const targetId = button.dataset.targetId;
    const noteInput = app.querySelector(`[data-note-input="${button.dataset.addNote}"]`);
    const text = noteInput?.value || "";
    if (kind === "candidate") {
      if (button.dataset.addNote === "tag") addCandidateTag(targetId, text);
      else addCandidateNote(targetId, text);
    } else {
      if (button.dataset.addNote !== "tag") addGroupNote(targetId, text);
    }
    if (noteInput) noteInput.value = "";
    return;
  }

  if (button.dataset.saveTranscript !== undefined) {
    const kind = button.dataset.targetKind || "candidate";
    const targetId = button.dataset.targetId;
    const textarea = button.closest(".transcript-card")?.querySelector("textarea.transcript-input");
    if (textarea) saveTranscript(kind, targetId, textarea.value);
    return;
  }

  if (button.dataset.resetTranscript !== undefined) {
    const kind = button.dataset.targetKind || "candidate";
    const targetId = button.dataset.targetId;
    resetTranscript(kind, targetId);
    return;
  }
}

function handleInput(event) {
  const input = event.target;
  if (!input) return;
  if (input.matches("[data-search-input]")) {
    uiState.search = input.value;
    saveState();
    render();
    return;
  }
  if (input.matches("[data-transcript-input]")) {
    const raw = input.value || "";
    const kind = input.dataset.targetKind || "candidate";
    const targetId = input.dataset.targetId || "";
    const state = targetState(kind, targetId);
    state.transcript = raw;
    state.transcriptSegments = splitVoiceText(raw);
    state.updatedAt = Date.now();
    saveState();
    const preview = input.closest(".transcript-card")?.querySelector("[data-transcript-preview]");
    if (preview) {
      preview.innerHTML = renderTranscriptSegments(raw);
    }
    return;
  }
}

function handleChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.selectId) {
    toggleSelected(input.dataset.selectId);
    return;
  }
  if (input.dataset.filterToggle) {
    const key = input.dataset.filterToggle;
    const value = input.dataset.filterValue || "";
    const map = {
      phase: "filterPhases",
      category: "filterCategories",
      keyword: "filterKeywords",
      reviewTag: "filterReviewTags"
    };
    const stateKey = map[key];
    if (!stateKey) return;
    uiState[stateKey] = toggleSetValue(uiState[stateKey] || [], value);
    saveState();
    render();
    return;
  }
}

app.addEventListener("click", handleAction);
app.addEventListener("input", handleInput);
app.addEventListener("change", handleChange);

audio.addEventListener("play", syncAudioBar);
audio.addEventListener("pause", syncAudioBar);
audio.addEventListener("ended", () => {
  audio.dataset.currentId = "";
  audio.dataset.currentUrl = "";
  syncAudioBar();
  render();
});
audio.addEventListener("timeupdate", syncAudioBar);

async function loadCatalog(force = false) {
  if (force) durationCache = new Map();
  if (!reviewStateLoaded) {
    const serverState = await fetch("/api/voice-library/state").then(response => response.json()).catch(() => null);
    const legacyState = legacyReviewState();
    if (hasReviewStateContent(serverState)) {
      reviewState = normalizeReviewState(serverState);
      if (hasReviewStateContent(legacyState)) localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else if (hasReviewStateContent(legacyState)) {
      reviewState = normalizeReviewState(legacyState);
      const migrated = await fetch("/api/voice-library/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reviewState })
      })
        .then(response => response.json().catch(() => null))
        .catch(() => null);
      if (migrated) {
        reviewState = normalizeReviewState(migrated);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } else {
      reviewState = createEmptyReviewState();
    }
    reviewStateLoaded = true;
  }
  const data = await fetch("/api/voice-library/catalog").then(response => response.json());
  catalog = data;
  selectedGroupKey = selectedGroupKey || flattenGroups()[0]?.id || "";
  selectedNodeKey = selectedNodeKey || flattenGroups()[0]?.candidates?.[0]?.id || "";
  saveState();
  render();
  prefetchDurations();
}

async function prefetchDurations() {
  const urls = [...new Set(flattenGroups().flatMap(group => group.candidates.map(candidate => candidate.audioPath)))];
  for (const url of urls) {
    if (!url) continue;
    // Fire and forget, but keep the first render responsive.
    void loadDuration(url);
  }
}

document.documentElement.dataset.voiceLibrary = "true";
loadCatalog();
