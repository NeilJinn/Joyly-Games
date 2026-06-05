import {
  MotionCore,
  Move,
  Scale,
  Rotate,
  Fade,
  Flip,
  Glow,
  Pulse,
  Shake,
  FlyTo,
  Stagger,
  setPngLayer
} from "../src/runtime/runtime.js";
import { motionPackPlayer } from "../src/packs/motion-pack-player.js";
import {
  motionPackToEditorRecord,
  normalizeMotionPack,
  editorRecordToMotionPack
} from "../src/packs/motion-pack-schema.js";
import {
  loadBuiltInMotionPacks
} from "../src/packs/motion-pack-library.js";
import { installJMS } from "../src/api/browser.js";

const heroAsset = document.querySelector("#hero-asset");
const runtimeStatus = document.querySelector("#runtime-status");
const sceneStatus = document.querySelector("#scene-status");
const motionPackStatus = document.querySelector("#motion-pack-status");
const stackCount = document.querySelector("#stack-count");
const primitiveList = document.querySelector("#primitive-list");
const stackList = document.querySelector("#stack-list");
const motionPackList = document.querySelector("#motion-pack-list");
const motionPackName = document.querySelector("#motion-pack-name");
const sceneSelect = document.querySelector("#scene-select");
const pngInput = document.querySelector("#png-input");
const motionPackInput = document.querySelector("#motion-pack-input");
const stepTitle = document.querySelector("#step-title");
const stepKind = document.querySelector("#step-kind");
const stepFields = document.querySelector("#step-fields");
const stepPopover = document.querySelector("#step-popover");
const stepClose = document.querySelector("#step-close");
const stageZoomInput = document.querySelector("#stage-zoom");
const stageZoomValue = document.querySelector("#stage-zoom-value");
const timelineLength = document.querySelector("#timeline-length");
const timelineZoomInput = document.querySelector("#timeline-zoom");
const timelineLengthInput = document.querySelector("#timeline-length-input");
const playgroundStage = document.querySelector("#playground-stage");
const playgroundStageScene = document.querySelector("#playground-stage-scene");
const panelGrid = document.querySelector("#panel-grid");
const stackPanel = document.querySelector(".panel--stack");
const btnAddLane = document.querySelector("#btn-add-lane");
const btnZoomOut = document.querySelector("#btn-zoom-out");
const btnZoomIn = document.querySelector("#btn-zoom-in");
const sceneButtons = Array.from(document.querySelectorAll(".scene-chip"));
const resizeHandles = Array.from(document.querySelectorAll(".grid-resizer"));
const sectionResizeHandles = Array.from(document.querySelectorAll(".section-resizer"));

const btnPreview = document.querySelector("#btn-preview");
const btnReset = document.querySelector("#btn-reset");
const btnDemo = document.querySelector("#btn-demo");
const btnPopoutPreview = document.querySelector("#btn-popout-preview");
const btnTogglePreviewCard = document.querySelector("#btn-toggle-preview-card");
const btnSave = document.querySelector("#btn-save");
const btnClear = document.querySelector("#btn-clear");
const btnExport = document.querySelector("#btn-export");
const btnImport = document.querySelector("#btn-import");

const STORAGE_KEY = "joyly.motion.playground.motion-packs.v1";
const LAYOUT_STORAGE_KEY = "joyly.motion.playground.layout.v1";
const HERO_HEIGHT_STORAGE_KEY = "joyly.motion.playground.hero-height.v1";
const TIMELINE_ZOOM_STORAGE_KEY = "joyly.motion.playground.timeline-zoom.v1";
const TIMELINE_LENGTH_STORAGE_KEY = "joyly.motion.playground.timeline-length.v1";
const PREVIEW_POPUP_STATE_STORAGE_KEY = "joyly.motion.playground.preview-popup-state.v1";
const PREVIEW_POPUP_EVENT_STORAGE_KEY = "joyly.motion.playground.preview-popup-event.v1";
const PREVIEW_CARD_HIDDEN_STORAGE_KEY = "joyly.motion.playground.preview-card-hidden.v1";
const WORKING_DRAFT_STORAGE_KEY = "joyly.motion.playground.working-draft.v1";
const PREVIEW_POPUP_NAME = "joyly-motion-preview-window";
const PREVIEW_POPUP_PARAM = "preview";
const COLOR_SWATCHES = [
  "#7de2ff",
  "#8dffce",
  "#ffa86b",
  "#ff7dc7",
  "#8a7dff",
  "#ffffff",
  "#d4d9e8",
  "#7d8aa8",
  "#2f3647",
  "#152033",
  "#ff5d5d",
  "#f4c542"
];
const TIMELINE_STEP = 0.05;
const MIN_DURATION = 0.05;
const PREVIEW_STAGE_ZOOM_DEFAULT = 0.75;

const primitiveCatalog = [
  { type: "move", label: "Move", description: "Slide the asset across the stage.", defaults: { x: 40, y: -10, duration: 0.5 } },
  { type: "scale", label: "Scale", description: "Make the asset breathe bigger or smaller.", defaults: { scale: 1.14, duration: 0.45 } },
  { type: "squashstretch", label: "Squash Stretch", description: "Compress and release with weight.", defaults: { scaleX: 1.12, scaleY: 0.88, duration: 0.45 } },
  { type: "rotate", label: "Rotate", description: "Spin the asset a little.", defaults: { rotate: 12, duration: 0.45 } },
  { type: "fade", label: "Fade", description: "Lower or restore opacity.", defaults: { opacity: 0.4, duration: 0.35 } },
  { type: "flip", label: "Flip", description: "Turn the asset around the Y axis.", defaults: { rotateY: 180, duration: 0.55 } },
  { type: "flip3d", label: "Flip 3D", description: "Flip with depth and settle.", defaults: { rotateY: 180, perspective: 1200, duration: 0.65 } },
  { type: "pulse", label: "Pulse", description: "Momentarily scale up and settle.", defaults: { scale: 1.08, duration: 0.5 } },
  { type: "set", label: "Set", description: "Set a state instantly.", defaults: { opacity: 1, scale: 1, duration: 0.05 } },
  { type: "fromto", label: "From To", description: "Animate from an explicit state into another.", defaults: { fromY: 24, fromScale: 0.96, fromOpacity: 0, toY: 0, toScale: 1, toOpacity: 1, duration: 0.5 } },
  { type: "shake", label: "Shake", description: "Add a quick energetic wobble.", defaults: { magnitude: 10, cycles: 3, duration: 0.45 } },
  { type: "glow", label: "Glow", description: "Add a soft light trail.", defaults: { strength: 24, color: "#7de2ff", duration: 0.3 } },
  { type: "flash", label: "Flash", description: "Hit the stage with a quick burst.", defaults: { strength: 32, color: "#7de2ff", opacity: 1, duration: 0.25 } },
  { type: "flyto", label: "Fly To", description: "Enter with a lift and settle.", defaults: { y: 24, scale: 0.96, opacity: 0, duration: 0.65 } },
  { type: "pathfly", label: "Path Fly", description: "Fly along a curved path.", defaults: { y: 120, arc: 90, scale: 0.84, opacity: 0, duration: 0.8 } },
  { type: "impact", label: "Impact", description: "Hit, shake, flash, and recover.", defaults: { magnitude: 12, cycles: 2, scaleX: 1.1, scaleY: 0.9, strength: 32, color: "#ff5d5d", duration: 0.45 } },
  { type: "impactslam", label: "Impact Slam", description: "A heavier hit with a bigger landing.", defaults: { magnitude: 14, cycles: 2, scaleX: 1.12, scaleY: 0.88, strength: 34, color: "#ff5d5d", duration: 0.5 } },
  { type: "settlebounce", label: "Settle Bounce", description: "Land with a satisfying rebound.", defaults: { scaleX: 1.08, scaleY: 0.92, duration: 0.35 } },
  { type: "custombounce", label: "Custom Bounce", description: "A tailored rebound with more shape.", defaults: { scaleX: 1.14, scaleY: 0.86, duration: 0.38 } },
  { type: "customwiggle", label: "Custom Wiggle", description: "A stylized wobble with more beats.", defaults: { magnitude: 8, cycles: 4, duration: 0.45 } },
  { type: "magnettotarget", label: "Magnet To Target", description: "Snap hard toward the target.", defaults: { y: 72, arc: 24, scale: 0.88, opacity: 0, duration: 0.6 } },
  { type: "stagepulse", label: "Stage Pulse", description: "Pulse the hero with glow.", defaults: { scale: 1.08, strength: 28, color: "#7de2ff", duration: 0.45 } },
  { type: "finalhold", label: "Final Hold", description: "Lock the final state in place.", defaults: { opacity: 1, scale: 1, duration: 0.35 } },
  { type: "trail", label: "Trail", description: "Leave a soft trail of motion.", defaults: { strength: 10, color: "#7de2ff", size: 3, cadence: 2, duration: 0.35 } },
  { type: "stagger", label: "Stagger", description: "Animate the three marker tokens in sequence.", defaults: { delay: 0.08, scale: 1.08, duration: 0.28 } }
];

const defaultLanes = [
  {
    id: crypto.randomUUID(),
    blocks: []
  }
];

let lanes = structuredClone(defaultLanes);
let selectedLaneId = lanes[0]?.id || null;
let selectedBlockId = null;
let savedMotionPacks = loadMotionPacks();
let currentMotionPackPackage = null;
let currentScene = "aurora";
let layoutRatios = loadLayoutRatios();
let heroHeight = loadHeroHeight();
let timelineZoom = loadTimelineZoom();
let timelineLengthSetting = loadTimelineLengthSetting();
let blockDragState = { blockId: null, fromLaneId: null, dragging: false, pointerId: null, lastX: 0, lastY: 0 };
let primitiveDragType = null;
let previewRunId = 0;
let isPreviewing = false;
let timelineScrollLeft = 0;
let syncingTimelineScroll = false;
let previewWindowRef = null;
let previewCardHidden = loadPreviewCardHidden();
let activeColorPickerKey = null;

const isPreviewWindow = new URLSearchParams(window.location.search).get(PREVIEW_POPUP_PARAM) === "window";
let previewStageZoom = isPreviewWindow ? PREVIEW_STAGE_ZOOM_DEFAULT : 1;

runtimeStatus.textContent = globalThis.gsap ? "Runtime: ready" : "Runtime: fallback";
sceneStatus.textContent = `Scene: ${currentScene}`;
safeInit(() => installJMS(window));
safeInit(() => applyLayoutRatios(layoutRatios));
safeInit(() => applyHeroHeight(heroHeight));
safeInit(() => applyTimelineZoom(timelineZoom));
safeInit(() => applyTimelineLengthSetting(timelineLengthSetting));
safeInit(() => applyPreviewStageZoom(previewStageZoom));
safeInit(() => renderPrimitiveList());
safeInit(() => renderMotionPacks());
const restoredWorkingDraft = safeInit(() => restoreWorkingDraft());
if (!restoredWorkingDraft) {
  safeInit(() => renderStack());
  safeInit(() => renderSelectedStep());
  safeInit(() => updateMotionPackStatus());
  safeInit(() => applyScene(currentScene, false));
}
safeInit(() => setupSectionResizer());
safeInit(() => setupPanelResizers());
safeInit(() => initializePreviewBridge());
safeInit(() => applyPreviewCardVisibility(previewCardHidden));
safeInit(() => setupColorPickerDismiss());
void seedBuiltInMotionPackRegistry();

function loadMotionPacks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(record => normalizeMotionPack(record, []) || normalizeMotionPackRecord(record)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function registerMotionPackIfPossible(motionPackPackage) {
  const normalized = normalizeMotionPack(motionPackPackage, []);
  if (!normalized) return null;

  try {
    return motionPackPlayer.registerMotionPack(normalized);
  } catch {
    return normalized;
  }
}

async function seedBuiltInMotionPackRegistry() {
  try {
    for (const motionPack of savedMotionPacks) {
      if (normalizeMotionPack(motionPack, [])) {
        registerMotionPackIfPossible(motionPack);
      }
    }

    const builtInMotionPacks = await loadBuiltInMotionPacks();
    for (const motionPack of builtInMotionPacks) {
      registerMotionPackIfPossible(motionPack);
    }

    renderMotionPacks();
  } catch {
    // Best-effort seeding only.
  }
}

function safeInit(action) {
  try {
    return action();
  } catch {
    return null;
  }
}

function persistMotionPacks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMotionPacks));
}

function loadLayoutRatios() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || parsed.length !== 3) return [0.95, 1.05, 0.95];
    const ratios = parsed.map(value => Number(value)).filter(value => Number.isFinite(value) && value > 0.2);
    if (ratios.length !== 3) return [0.95, 1.05, 0.95];
    return ratios;
  } catch {
    return [0.95, 1.05, 0.95];
  }
}

function saveLayoutRatios(ratios) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(ratios));
}

function loadHeroHeight() {
  try {
    const raw = localStorage.getItem(HERO_HEIGHT_STORAGE_KEY);
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 180 && value <= 420) return value;
    return 260;
  } catch {
    return 260;
  }
}

function saveHeroHeight(value) {
  localStorage.setItem(HERO_HEIGHT_STORAGE_KEY, String(value));
}

function loadPreviewCardHidden() {
  try {
    return localStorage.getItem(PREVIEW_CARD_HIDDEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function savePreviewCardHidden(value) {
  localStorage.setItem(PREVIEW_CARD_HIDDEN_STORAGE_KEY, String(Boolean(value)));
}

function applyPreviewStageZoom(value) {
  previewStageZoom = Math.min(1.5, Math.max(0.25, Number(value) || PREVIEW_STAGE_ZOOM_DEFAULT));
  try {
    if (stageZoomInput) stageZoomInput.value = String(previewStageZoom);
    if (stageZoomValue) stageZoomValue.textContent = `${Math.round(previewStageZoom * 100)}%`;
    if (playgroundStageScene) {
      playgroundStageScene.style.transform = `scale(${previewStageZoom})`;
      playgroundStageScene.style.transformOrigin = "center center";
    }
  } catch {
    // Keep the preview usable even if a browser wrapper rejects a style mutation.
  }
}

function applyPreviewCardVisibility(hidden) {
  if (isPreviewWindow) return;

  previewCardHidden = Boolean(hidden);
  const hero = document.querySelector(".hero");
  const sectionResizer = document.querySelector(".section-resizer");
  const shell = document.querySelector(".shell");

  document.body.classList.toggle("is-preview-hidden", previewCardHidden);
  if (hero) hero.hidden = previewCardHidden;
  if (sectionResizer) sectionResizer.hidden = previewCardHidden;

  if (shell) {
    shell.style.gridTemplateRows = previewCardHidden
      ? "minmax(0, 1fr)"
      : `${heroHeight}px 12px minmax(0, 1fr)`;
  }

  if (btnTogglePreviewCard) {
    btnTogglePreviewCard.textContent = previewCardHidden ? "Show preview card" : "Hide preview card";
  }

  savePreviewCardHidden(previewCardHidden);
}

function readStoredPreviewState() {
  try {
    const raw = localStorage.getItem(PREVIEW_POPUP_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredPreviewState(payload) {
  try {
    localStorage.setItem(PREVIEW_POPUP_STATE_STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(PREVIEW_POPUP_EVENT_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage failures in preview sync
  }
}

function loadTimelineZoom() {
  try {
    const raw = Number(localStorage.getItem(TIMELINE_ZOOM_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= 0.5 && raw <= 6) return raw;
    return 1.25;
  } catch {
    return 1.25;
  }
}

function saveTimelineZoom(value) {
  localStorage.setItem(TIMELINE_ZOOM_STORAGE_KEY, String(value));
}

function applyTimelineZoom(value) {
  timelineZoom = Math.min(6, Math.max(0.5, Number(value) || 1.25));
  timelineZoomInput.value = String(timelineZoom);
}

function loadTimelineLengthSetting() {
  try {
    const raw = Number(localStorage.getItem(TIMELINE_LENGTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= 1) return raw;
    return 8;
  } catch {
    return 8;
  }
}

function saveTimelineLengthSetting(value) {
  localStorage.setItem(TIMELINE_LENGTH_STORAGE_KEY, String(value));
}

function applyTimelineLengthSetting(value) {
  timelineLengthSetting = Math.max(1, Number(value) || 8);
  timelineLengthInput.value = String(Number(timelineLengthSetting.toFixed(2)));
}

function applyHeroHeight(value) {
  const shell = document.querySelector(".shell");
  if (shell) {
    shell.style.gridTemplateRows = `${value}px 12px minmax(0, 1fr)`;
  }
}

function applyLayoutRatios(ratios) {
  if (panelGrid) {
    panelGrid.style.gridTemplateColumns = `${ratios[0]}fr 12px ${ratios[1]}fr 12px ${ratios[2]}fr`;
  }
}

function setupPanelResizers() {
  const minWidth = 260;
  const handleTargets = {
    left: [0, 1],
    right: [1, 2]
  };

  for (const handle of resizeHandles) {
    handle.addEventListener("pointerdown", event => {
      event.preventDefault();
      const pair = handleTargets[handle.dataset.resize];
      if (!pair) return;

      const gridRect = panelGrid.getBoundingClientRect();
      const widths = [...document.querySelectorAll(".panel")].map(panel => panel.getBoundingClientRect().width);
      const totalWidth = Math.max(1, gridRect.width - 24);
      const state = {
        pair,
        startX: event.clientX,
        widths
      };

      handle.classList.add("is-dragging");
      handle.setPointerCapture(event.pointerId);

      const onMove = moveEvent => {
        const delta = moveEvent.clientX - state.startX;
        const nextWidths = [...state.widths];
        const [a, b] = state.pair;
        nextWidths[a] = Math.max(minWidth, state.widths[a] + delta);
        nextWidths[b] = Math.max(minWidth, state.widths[b] - delta);

        const sum = nextWidths[0] + nextWidths[1] + nextWidths[2];
        const nextRatios = nextWidths.map(width => Math.max(0.2, width / sum * 3));
        layoutRatios = nextRatios;
        applyLayoutRatios(layoutRatios);
      };

      const onUp = () => {
        handle.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        saveLayoutRatios(layoutRatios);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    });
  }
}

function setupSectionResizer() {
  const handle = sectionResizeHandles[0];
  if (!handle) return;

  const minHeight = 180;
  const maxHeight = 420;

  handle.addEventListener("pointerdown", event => {
    event.preventDefault();
    const startHeight = heroHeight;
    const startY = event.clientY;

    handle.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);

    const onMove = moveEvent => {
      const delta = moveEvent.clientY - startY;
      heroHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta));
      applyHeroHeight(heroHeight);
    };

    const onUp = () => {
      handle.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveHeroHeight(heroHeight);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  });
}

function updateMotionPackStatus() {
  const laneCount = lanes.length;
  const blockCount = lanes.reduce((count, lane) => count + lane.blocks.length, 0);
  motionPackStatus.textContent = `Motion packs: ${savedMotionPacks.length} saved · ${laneCount} lane${laneCount === 1 ? "" : "s"} · ${blockCount} block${blockCount === 1 ? "" : "s"}`;
}

function setCurrentMotionPackPackage(motionPackPackage) {
  currentMotionPackPackage = normalizeMotionPack(motionPackPackage, []);
}

function getHeroSnapshot() {
  return {
    src: heroAsset?.currentSrc || heroAsset?.getAttribute("src") || "",
    alt: heroAsset?.getAttribute("alt") || ""
  };
}

function buildPreviewState() {
  return {
    motionPackPackage: buildMotionPackPackage(),
    name: motionPackName.value.trim() || "Untitled motion pack",
    scene: currentScene,
    lanes: buildMotionPackRecord({
      name: motionPackName.value.trim() || "Untitled motion pack",
      scene: currentScene,
      lanes
    }).lanes,
    hero: getHeroSnapshot()
  };
}

function getMotionPackPreviewSlots() {
  const ghostTokens = Array.from(document.querySelectorAll(".ghost-token"));
  const sourceElement = ghostTokens[0] || heroAsset;
  return {
    target: heroAsset,
    element: heroAsset,
    targetElement: heroAsset,
    sourceElement,
    cardElement: heroAsset,
    boardElement: heroAsset,
    tokenElement: heroAsset,
    targetElements: ghostTokens,
    sourceElements: ghostTokens,
    ghostTokens
  };
}

function buildMotionPackPackage() {
  const motionPack = buildMotionPackRecord({
    id: currentMotionPackPackage?.id || motionPackName.value.trim() || "motion-pack.untitled",
    name: motionPackName.value.trim() || currentMotionPackPackage?.name || "Untitled motion pack",
    scene: currentScene,
    lanes
  });

  const baseCue = currentMotionPackPackage || {
    id: motionPack.id,
    name: motionPack.name,
    version: "1.0.0",
    category: "playground",
    description: "",
    requiredSlots: [],
    optionalSlots: [],
    timeline: { duration: 0, blocks: [] },
    defaultParams: {},
    themeSlots: {},
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: { mode: "static" },
    metadata: {}
  };

  const cuePackage = editorRecordToMotionPack({
    ...baseCue,
    ...motionPack,
    version: baseCue.version || "1.0.0",
    category: baseCue.category || "playground",
    description: baseCue.description || "",
    defaultParams: { ...(baseCue.defaultParams || {}) },
    themeSlots: { ...(baseCue.themeSlots || {}) },
    assetSlots: { ...(baseCue.assetSlots || {}) },
    particleHooks: { ...(baseCue.particleHooks || {}) },
    lottieHooks: { ...(baseCue.lottieHooks || {}) },
    soundHooks: { ...(baseCue.soundHooks || {}) },
    reducedMotionFallback: baseCue.reducedMotionFallback || { mode: "static" },
    metadata: {
      ...(baseCue.metadata || {}),
      scene: currentScene,
      source: baseCue.metadata?.source || "motion-pack-editor"
    }
  });

  if (!cuePackage) return null;

  const blocks = cuePackage.timeline.blocks.map(block => ({
    ...block,
    slot: block.type === "stagger"
      ? "targetElements"
      : block.type === "flyto"
        ? "sourceElement"
        : "targetElement",
    hooks: {
      ...(block.hooks || {}),
      ...(block.type === "flyto" ? { targetSlot: "targetElement" } : {})
    }
  }));

  return normalizeMotionPack({
    ...cuePackage,
    id: baseCue.id || cuePackage.id,
    name: motionPack.name,
    version: baseCue.version || cuePackage.version,
    category: baseCue.category || cuePackage.category,
    description: baseCue.description || cuePackage.description,
    requiredSlots: baseCue.requiredSlots?.length
      ? baseCue.requiredSlots
      : [
          {
            id: "targetElement",
            label: "Target element",
            type: "element",
            required: true,
            description: "Primary element used by the cue."
          }
        ],
    optionalSlots: baseCue.optionalSlots?.length
      ? baseCue.optionalSlots
      : [
          {
            id: "sourceElement",
            label: "Source element",
            type: "element",
            required: false,
            description: "Optional source element for travel cues."
          },
          {
            id: "targetElements",
            label: "Target elements",
            type: "elements",
            required: false,
            description: "Optional token group used for staggered or group cues."
          },
          {
            id: "titleText",
            label: "Title text",
            type: "text",
            required: false,
            description: "Optional text slot for cue titles."
          },
          {
            id: "subtitleText",
            label: "Subtitle text",
            type: "text",
            required: false,
            description: "Optional text slot for cue subtitles."
          }
        ],
    timeline: {
      ...cuePackage.timeline,
      blocks
    },
    metadata: {
      ...(baseCue.metadata || {}),
      scene: currentScene,
      source: baseCue.metadata?.source || "motion-pack-editor"
    },
    assetSlots: {
      ...(baseCue.assetSlots || {}),
      ...(baseCue.assetSlots?.cardImage ? {} : {
        cardImage: {
          type: "image",
          label: "Card image",
          description: "Optional card or board art.",
          required: false
        }
      }),
      ...(baseCue.assetSlots?.boardImage ? {} : {
        boardImage: {
          type: "image",
          label: "Board image",
          description: "Optional board or stage artwork.",
          required: false
        }
      })
    }
  }, []);
}

function loadWorkingDraft() {
  try {
    const raw = localStorage.getItem(WORKING_DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildWorkingDraft() {
  return {
    ...buildPreviewState(),
    selectedLaneId,
    selectedBlockId
  };
}

function saveWorkingDraft(payload = buildWorkingDraft()) {
  if (isPreviewWindow) return;
  try {
    localStorage.setItem(WORKING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore draft write failures
  }
}

function restoreWorkingDraft() {
  const payload = loadWorkingDraft();
  if (!payload) return false;
  return applyWorkingDraft(payload);
}

function applyWorkingDraft(payload) {
  if (!payload) return false;
  const motionPackPackage = payload.motionPackPackage || payload.cuePackage || (Array.isArray(payload.lanes) ? editorRecordToMotionPack(payload) : null);
  setCurrentMotionPackPackage(motionPackPackage);
  const sourceLanes = Array.isArray(payload.lanes) ? payload.lanes : [];
  if (!sourceLanes.length) return false;

  const nextLanes = sourceLanes
    .map(lane => {
      const blocks = Array.isArray(lane?.blocks) ? lane.blocks.map(normalizeBlock).filter(Boolean) : [];
      if (!blocks.length) return null;
      sortLaneBlocks({ blocks });
      return {
        id: lane.id || crypto.randomUUID(),
        blocks
      };
    })
    .filter(Boolean);

  if (!nextLanes.length) return false;

  lanes = nextLanes;
  selectedLaneId = lanes.some(lane => lane.id === payload.selectedLaneId)
    ? payload.selectedLaneId
    : lanes[0]?.id || null;

  const selectedLane = getLane(selectedLaneId) || lanes[0] || null;
  const hasSelectedBlock = selectedLane?.blocks.some(block => block.id === payload.selectedBlockId);
  selectedBlockId = hasSelectedBlock
    ? payload.selectedBlockId
    : selectedLane?.blocks[0]?.id || null;

  motionPackName.value = String(payload.name || "Untitled motion pack");
  applyScene(["aurora", "midnight", "sunset"].includes(payload.scene) ? payload.scene : "aurora", false);

  if (payload.hero?.src) {
    setPngLayer(heroAsset, payload.hero.src, { alt: payload.hero.alt || "Joyly avatar sample" });
  }

  renderStack();
  renderSelectedStep();
  updateMotionPackStatus();
  return true;
}

function applyPreviewState(payload) {
  if (!payload) return;
  const motionPackPackage = payload.motionPackPackage || payload.cuePackage || normalizeMotionPack(payload, []);
  setCurrentMotionPackPackage(motionPackPackage);
  const normalized = motionPackPackage ? motionPackToEditorRecord(motionPackPackage) : normalizeMotionPackRecord(payload);
  if (!normalized) return;

  lanes = normalized.lanes.map(lane => makeLane(lane.blocks));
  if (!lanes.length) {
    lanes = [makeLane()];
  }

  selectedLaneId = lanes[0]?.id || null;
  selectedBlockId = null;
  motionPackName.value = normalized.name;
  applyScene(normalized.scene || motionPackPackage?.metadata?.scene || "aurora", true);

  if (payload.hero?.src) {
    setPngLayer(heroAsset, payload.hero.src, { alt: payload.hero.alt || "Joyly avatar sample" });
  }

  renderStack();
  renderSelectedStep();
  updateMotionPackStatus();
}

function collectRenderableMotionPacks() {
  const merged = [...motionPackPlayer.listMotionPacks(), ...savedMotionPacks];
  const unique = [];
  const seen = new Set();

  for (const motionPack of merged) {
    const key = `${motionPack?.id || motionPack?.name || "motionPack"}::${motionPack?.version || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(motionPack);
  }

  return unique;
}

function canUsePreviewWindow(target = previewWindowRef) {
  return Boolean(target && !target.closed);
}

function buildPreviewPopupUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(PREVIEW_POPUP_PARAM, "window");
  return nextUrl.toString();
}

function syncDetachedPreview() {
  if (isPreviewWindow) return null;
  const payload = buildPreviewState();
  writeStoredPreviewState(payload);

  if (canUsePreviewWindow()) {
    try {
      previewWindowRef.JMSPreviewPopup?.sync?.(payload);
    } catch {
      // fallback to storage sync
    }
  }

  return payload;
}

function initializePreviewBridge() {
  if (isPreviewWindow) {
    document.title = "Joyly Motion System · Detached Preview";
    applyPreviewStageZoom(previewStageZoom);
    document.body.style.overflow = "auto";

    const shell = document.querySelector(".shell");
    const heroStage = document.querySelector(".hero-stage");
    const previewControls = document.querySelector(".preview-stage-controls");
    const previewPanelGrid = document.querySelector(".panel-grid");

    if (shell) {
      shell.style.width = "min(100vw - 20px, 1800px)";
      shell.style.height = "100vh";
      shell.style.padding = "10px 0";
      shell.style.gridTemplateRows = "minmax(0, 1fr)";
      shell.style.gap = "0";
    }

    if (heroStage) {
      heroStage.style.height = "calc(100vh - 20px)";
      heroStage.style.minHeight = "540px";
      heroStage.style.padding = "14px";
    }

    if (playgroundStage) {
      playgroundStage.style.minHeight = "calc(100vh - 190px)";
      playgroundStage.style.marginBottom = "10px";
    }

    if (previewPanelGrid) {
      previewPanelGrid.style.display = "none";
    }

    for (const handle of sectionResizeHandles) {
      handle.style.display = "none";
    }

    if (previewControls) {
      previewControls.style.display = "flex";
    }

    if (btnPopoutPreview) {
      btnPopoutPreview.hidden = true;
    }

    selectedBlockId = null;
    stepPopover.classList.add("is-hidden");

    window.JMSPreviewPopup = {
      sync(payload) {
        applyPreviewState(payload);
      },
      async preview(payload) {
        if (payload) applyPreviewState(payload);
        await previewStack();
      },
      async reset(payload) {
        if (payload) applyPreviewState(payload);
        previewRunId += 1;
        isPreviewing = false;
        btnPreview.disabled = false;
        motionPackPlayer.stopAllPacks();
        await resetHero();
        runtimeStatus.textContent = globalThis.gsap ? "Runtime: ready" : "Runtime: fallback";
      }
    };

    const seedState = (() => {
      try {
        return window.opener?.JMSPreviewBridge?.getState?.() || readStoredPreviewState();
      } catch {
        return readStoredPreviewState();
      }
    })();

    if (seedState) {
      applyPreviewState(seedState);
    }

    window.addEventListener("storage", event => {
      if (event.key !== PREVIEW_POPUP_STATE_STORAGE_KEY && event.key !== PREVIEW_POPUP_EVENT_STORAGE_KEY) return;
      const nextState = readStoredPreviewState();
      if (nextState) applyPreviewState(nextState);
    });
    return;
  }

  window.JMSPreviewBridge = {
    getState: buildPreviewState,
    sync: syncDetachedPreview
  };
  syncDetachedPreview();
}

async function ensureDetachedPreviewWindow({ focus = true } = {}) {
  if (isPreviewWindow) return window;

  if (!canUsePreviewWindow()) {
    previewWindowRef = window.open(
      buildPreviewPopupUrl(),
      PREVIEW_POPUP_NAME,
      "popup=yes,width=1440,height=960,resizable=yes,scrollbars=yes"
    );
  }

  if (!canUsePreviewWindow()) return null;

  if (focus) {
    previewWindowRef.focus?.();
  }

  const payload = syncDetachedPreview();
  try {
    previewWindowRef.JMSPreviewPopup?.sync?.(payload);
  } catch {
    // storage sync will cover early loads
  }

  return previewWindowRef;
}

async function previewEverywhere() {
  const payload = syncDetachedPreview();
  const jobs = [previewStack()];

  if (!isPreviewWindow && canUsePreviewWindow()) {
    try {
      jobs.push(Promise.resolve(previewWindowRef.JMSPreviewPopup?.preview?.(payload)));
    } catch {
      // ignore detached preview failures
    }
  }

  await Promise.allSettled(jobs);
}

async function resetEverywhere() {
  previewRunId += 1;
  isPreviewing = false;
  btnPreview.disabled = false;
  motionPackPlayer.stopAllPacks();
  await resetHero();
  runtimeStatus.textContent = globalThis.gsap ? "Runtime: ready" : "Runtime: fallback";

  if (!isPreviewWindow && canUsePreviewWindow()) {
    const payload = syncDetachedPreview();
    try {
      await Promise.resolve(previewWindowRef.JMSPreviewPopup?.reset?.(payload));
    } catch {
      // ignore detached preview failures
    }
  }
}

function setSelection(laneId, blockId = null) {
  selectedLaneId = laneId;
  selectedBlockId = blockId;
  renderStack();
  renderSelectedStep();
}

function primitiveByType(type) {
  return primitiveCatalog.find(item => item.type === type);
}

function snapTime(value) {
  const next = Math.round(Number(value || 0) / TIMELINE_STEP) * TIMELINE_STEP;
  return Math.max(0, Number(next.toFixed(2)));
}

function getBlockStart(block) {
  return snapTime(block?.options?.start ?? 0);
}

function getBlockDuration(block) {
  const value = Number(block?.options?.duration ?? 0.5);
  return Math.max(MIN_DURATION, Number.isFinite(value) ? value : 0.5);
}

function getBlockEnd(block) {
  return getBlockStart(block) + getBlockDuration(block);
}

function getLaneEnd(lane) {
  return lane.blocks.reduce((longest, block) => Math.max(longest, getBlockEnd(block)), 0);
}

function getTimelineDuration() {
  return lanes.reduce((longest, lane) => Math.max(longest, getLaneEnd(lane)), 0);
}

function getRenderableTimelineDuration() {
  return Math.max(1, Number(getTimelineDuration().toFixed(2)), timelineLengthSetting);
}

function sortLaneBlocks(lane) {
  lane.blocks.sort((a, b) => getBlockStart(a) - getBlockStart(b) || getBlockDuration(b) - getBlockDuration(a));
}

function placeBlockAtLaneEnd(lane, block) {
  block.options.start = snapTime(getLaneEnd(lane));
  lane.blocks.push(block);
  sortLaneBlocks(lane);
}

function normalizeBlock(block) {
  if (!block || typeof block !== "object") return null;
  const primitive = primitiveByType(block.type);
  if (!primitive) return null;

  const options = {
    start: 0,
    ...structuredClone(primitive.defaults),
    ...(block.options || {})
  };
  options.start = getBlockStart({ options });
  options.duration = getBlockDuration({ options });

  return {
    id: block.id || crypto.randomUUID(),
    type: primitive.type,
    label: block.label || primitive.label,
    options
  };
}

function makeBlock(type) {
  const primitive = primitiveByType(type);
  const options = {
    start: 0,
    ...structuredClone(primitive.defaults)
  };
  return {
    id: crypto.randomUUID(),
    type,
    label: primitive.label,
    options
  };
}

function makeLane(blocks = []) {
  const normalizedBlocks = blocks.map(normalizeBlock).filter(Boolean);
  normalizedBlocks.sort((a, b) => getBlockStart(a) - getBlockStart(b) || getBlockDuration(b) - getBlockDuration(a));
  return {
    id: crypto.randomUUID(),
    blocks: normalizedBlocks
  };
}

function normalizeMotionPackRecord(record) {
  if (!record || typeof record !== "object") return null;
  const sourceLanes = Array.isArray(record.lanes)
    ? record.lanes
    : Array.isArray(record.stack)
      ? [record.stack]
      : [];
  const normalizedLanes = sourceLanes
    .map(lane => {
      const sourceBlocks = Array.isArray(lane) ? lane : Array.isArray(lane?.blocks) ? lane.blocks : null;
      if (!sourceBlocks) return null;
      const blocks = sourceBlocks.map(normalizeBlock).filter(Boolean);
      return blocks.length ? { id: crypto.randomUUID(), blocks } : null;
    })
    .filter(Boolean);

  if (!normalizedLanes.length) return null;

  return {
    id: record.id || crypto.randomUUID(),
    name: String(record.name || "Untitled motion pack"),
    scene: ["aurora", "midnight", "sunset"].includes(record.scene) ? record.scene : "aurora",
    lanes: normalizedLanes
  };
}

function getLane(laneId) {
  return lanes.find(lane => lane.id === laneId) || null;
}

function getBlockLocation(blockId) {
  for (const lane of lanes) {
    const index = lane.blocks.findIndex(block => block.id === blockId);
    if (index !== -1) {
      return { lane, index, block: lane.blocks[index] };
    }
  }
  return null;
}

function findSelectedBlock() {
  if (!selectedBlockId) return null;
  for (const lane of lanes) {
    const block = lane.blocks.find(item => item.id === selectedBlockId);
    if (block) {
      selectedLaneId = lane.id;
      return block;
    }
  }
  selectedBlockId = null;
  return null;
}

function removeBlock(blockId) {
  for (const lane of lanes) {
    const index = lane.blocks.findIndex(block => block.id === blockId);
    if (index === -1) continue;
    lane.blocks.splice(index, 1);
    if (selectedBlockId === blockId) {
      const next = lane.blocks[index] || lane.blocks[index - 1] || lane.blocks[0] || null;
      selectedLaneId = lane.id;
      selectedBlockId = next?.id || null;
    }
    return;
  }
}

function removeLane(laneId) {
  const index = lanes.findIndex(lane => lane.id === laneId);
  if (index === -1) return;
  const wasSelected = selectedLaneId === laneId;
  lanes.splice(index, 1);
  if (!lanes.length) {
    lanes = [makeLane()];
  }
  const fallbackLane = lanes[index] || lanes[index - 1] || lanes[0];
  selectedLaneId = fallbackLane?.id || null;
  selectedBlockId = wasSelected ? fallbackLane?.blocks[0]?.id || null : selectedBlockId;
}

function duplicateLane(lane) {
  const clone = makeLane(lane.blocks);
  lanes.splice(lanes.indexOf(lane) + 1, 0, clone);
  selectedLaneId = clone.id;
  selectedBlockId = clone.blocks[0]?.id || null;
}

function insertBlock(block, targetLaneId, targetIndex) {
  const targetLane = getLane(targetLaneId) || ensureLane();
  const boundedIndex = Math.max(0, Math.min(targetIndex, targetLane.blocks.length));
  targetLane.blocks.splice(boundedIndex, 0, block);
  selectedLaneId = targetLane.id;
  selectedBlockId = block.id;
}

function moveBlock(blockId, targetLaneId, targetIndex) {
  const location = getBlockLocation(blockId);
  const targetLane = getLane(targetLaneId);
  if (!location || !targetLane) return;

  const { lane: sourceLane, index: sourceIndex, block } = location;
  sourceLane.blocks.splice(sourceIndex, 1);

  let insertIndex = targetIndex;
  if (sourceLane.id === targetLane.id && targetIndex > sourceIndex) {
    insertIndex -= 1;
  }

  const boundedIndex = Math.max(0, Math.min(insertIndex, targetLane.blocks.length));
  targetLane.blocks.splice(boundedIndex, 0, block);
  selectedLaneId = targetLane.id;
  selectedBlockId = block.id;
}

function clearBlockDropState() {
  blockDragState = { blockId: null, fromLaneId: null, dragging: false, pointerId: null, lastX: 0, lastY: 0 };
  for (const el of document.querySelectorAll(".lane-card.is-drop-target, .lane-blocks.is-drop-target, .lane-block.is-dragging")) {
    el.classList.remove("is-drop-target", "is-dragging");
  }
}

function clearPrimitiveDragState() {
  primitiveDragType = null;
}

function beginBlockDrag(blockId, fromLaneId, pointerId) {
  blockDragState = { blockId, fromLaneId, dragging: true, pointerId, lastX: 0, lastY: 0 };
}

function updateBlockDropTarget(clientX, clientY) {
  for (const el of document.querySelectorAll(".lane-card.is-drop-target, .lane-blocks.is-drop-target")) {
    el.classList.remove("is-drop-target");
  }

  const element = document.elementFromPoint(clientX, clientY);
  const laneCard = element?.closest?.(".lane-card");
  const laneBlocks = element?.closest?.(".lane-blocks");
  if (!laneCard || !laneBlocks || !blockDragState.blockId) return;

  laneCard.classList.add("is-drop-target");
  laneBlocks.classList.add("is-drop-target");
}

function finishBlockDrag(clientX, clientY) {
  if (!blockDragState.blockId) return;

  const element = document.elementFromPoint(clientX, clientY);
  const laneCard = element?.closest?.(".lane-card");
  const laneBlocks = element?.closest?.(".lane-blocks");
  if (!laneCard || !laneBlocks) {
    clearBlockDropState();
    return;
  }

  const resolvedLaneId = laneCard.dataset.laneId;
  const dropIndex = getBlockDropIndex(laneBlocks, clientX, clientY);
  moveBlock(blockDragState.blockId, resolvedLaneId || blockDragState.fromLaneId, dropIndex);
  clearBlockDropState();
  renderStack();
  renderSelectedStep();
}

function finishPrimitiveDrop(clientX, clientY) {
  if (!primitiveDragType) return;

  const element = document.elementFromPoint(clientX, clientY);
  const laneCard = element?.closest?.(".lane-card");
  const laneBlocks = element?.closest?.(".lane-blocks");
  if (!laneCard || !laneBlocks) {
    clearPrimitiveDragState();
    return;
  }

  const dropIndex = getBlockDropIndex(laneBlocks, clientX, clientY);
  const block = makeBlock(primitiveDragType);
  insertBlock(block, laneCard.dataset.laneId, dropIndex);
  clearPrimitiveDragState();
  renderStack();
  renderSelectedStep();
}

function getBlockDropIndex(container, clientX, clientY) {
  const items = [...container.querySelectorAll(".lane-block:not(.is-dragging)")];
  if (!items.length) return 0;

  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
    const beforeThisRow = clientY < rect.top + rect.height / 2;
    const beforeThisItem = clientX < rect.left + rect.width / 2;
    if (beforeThisRow || (Math.abs(clientY - (rect.top + rect.height / 2)) < rect.height / 2 && beforeThisItem)) {
      return index;
    }
  }

  return items.length;
}

function renderPrimitiveList() {
  primitiveList.innerHTML = "";

  for (const primitive of primitiveCatalog) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primitive-card";
    button.draggable = true;
    button.innerHTML = `
      <strong>${primitive.label}</strong>
      <span>${primitive.description}</span>
    `;
    button.addEventListener("click", () => {
      const lane = getLane(selectedLaneId) || ensureLane();
      const block = makeBlock(primitive.type);
      placeBlockAtLaneEnd(lane, block);
      selectedLaneId = lane.id;
      selectedBlockId = block.id;
      renderStack();
      renderSelectedStep();
    });
    button.addEventListener("dragstart", event => {
      primitiveDragType = primitive.type;
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", primitive.type);
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("is-dragging");
      clearPrimitiveDragState();
    });
    primitiveList.appendChild(button);
  }
}

function ensureLane() {
  if (lanes.length) return lanes[0];
  const lane = makeLane();
  lanes = [lane];
  selectedLaneId = lane.id;
  selectedBlockId = null;
  return lane;
}

function getTimelineDropTime(track, clientX, offsetRatio = 0) {
  const surface = track.querySelector(".lane-timeline__surface, .timeline-axis__surface") || track;
  const rect = surface.getBoundingClientRect();
  const timelineDuration = getRenderableTimelineDuration();
  const raw = ((clientX - rect.left) / Math.max(rect.width, 1)) * timelineDuration;
  const offsetSeconds = offsetRatio * timelineDuration;
  return snapTime(Math.max(0, raw - offsetSeconds));
}

function syncTimelineScroll(source) {
  if (syncingTimelineScroll) return;
  syncingTimelineScroll = true;
  timelineScrollLeft = source.scrollLeft;
  for (const track of stackList.querySelectorAll(".timeline-axis, .lane-timeline")) {
    if (track !== source) track.scrollLeft = timelineScrollLeft;
  }
  syncingTimelineScroll = false;
  positionSelectedStepPopover();
}

function attachTimelineScrollSync() {
  const tracks = [...stackList.querySelectorAll(".timeline-axis, .lane-timeline")];
  for (const track of tracks) {
    track.addEventListener("scroll", () => syncTimelineScroll(track), { passive: true });
    track.scrollLeft = timelineScrollLeft;
  }
}

function moveBlockToLane(blockId, targetLaneId, start) {
  const location = getBlockLocation(blockId);
  const targetLane = getLane(targetLaneId);
  if (!location || !targetLane) return;

  const { lane: sourceLane, index, block } = location;
  sourceLane.blocks.splice(index, 1);
  block.options.start = snapTime(start);
  targetLane.blocks.push(block);
  sortLaneBlocks(sourceLane);
  sortLaneBlocks(targetLane);
  selectedLaneId = targetLane.id;
  selectedBlockId = block.id;
}

function renderStack() {
  stackList.innerHTML = "";
  const laneCount = lanes.length;
  const blockCount = lanes.reduce((count, lane) => count + lane.blocks.length, 0);
  stackCount.textContent = `${laneCount} lane${laneCount === 1 ? "" : "s"} / ${blockCount} block${blockCount === 1 ? "" : "s"}`;
  const timelineDuration = getRenderableTimelineDuration();
  timelineLength.textContent = `Shown: ${timelineDuration.toFixed(2)}s`;

  if (!lanes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Add a lane to begin building a motion pack.";
    stackList.appendChild(empty);
    return;
  }

  const chart = document.createElement("section");
  chart.className = "timeline-chart";

  const chartHeader = document.createElement("div");
  chartHeader.className = "timeline-chart__header";

  const chartCorner = document.createElement("div");
  chartCorner.className = "timeline-chart__corner";
  chartCorner.innerHTML = `
    <strong>Tracks</strong>
    <span>${laneCount} lanes</span>
  `;

  const axis = document.createElement("div");
  axis.className = "timeline-axis";
  const axisSurface = document.createElement("div");
  axisSurface.className = "timeline-axis__surface";
  axisSurface.style.width = `${timelineZoom * 100}%`;
  const axisTicks = document.createElement("div");
  axisTicks.className = "timeline-axis__ticks";
  const tickCount = Math.max(1, Math.ceil(timelineDuration));

  for (let second = 0; second <= tickCount; second += 1) {
    const tick = document.createElement("span");
    tick.className = "timeline-axis__tick";
    tick.style.left = `${(second / Math.max(tickCount, 1)) * 100}%`;
    tick.textContent = `${second}s`;
    axisTicks.appendChild(tick);
  }

  axisSurface.appendChild(axisTicks);
  axis.appendChild(axisSurface);
  chartHeader.appendChild(chartCorner);
  chartHeader.appendChild(axis);
  chart.appendChild(chartHeader);

  const chartBody = document.createElement("div");
  chartBody.className = "timeline-chart__body";

  for (const lane of lanes) {
    const laneCard = document.createElement("article");
    laneCard.className = `lane-card${lane.id === selectedLaneId ? " is-selected" : ""}`;
    laneCard.dataset.laneId = lane.id;
    laneCard.addEventListener("click", () => {
      setSelection(lane.id, null);
    });

    const head = document.createElement("div");
    head.className = "lane-head";
    const laneDuration = getLaneEnd(lane);
    head.innerHTML = `
      <div class="lane-head__meta">
        <strong>Lane ${lanes.indexOf(lane) + 1}</strong>
        <div class="lane-meta">${laneDuration.toFixed(2)}s end</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "lane-actions";

    const addBlockButton = document.createElement("button");
    addBlockButton.type = "button";
    addBlockButton.textContent = "+ Block";
    addBlockButton.addEventListener("click", event => {
      event.stopPropagation();
      const block = makeBlock("scale");
      placeBlockAtLaneEnd(lane, block);
      setSelection(lane.id, block.id);
    });

    const duplicateLaneButton = document.createElement("button");
    duplicateLaneButton.type = "button";
    duplicateLaneButton.textContent = "Duplicate";
    duplicateLaneButton.addEventListener("click", event => {
      event.stopPropagation();
      duplicateLane(lane);
      renderStack();
      renderSelectedStep();
    });

    const removeLaneButton = document.createElement("button");
    removeLaneButton.type = "button";
    removeLaneButton.textContent = "Remove";
    removeLaneButton.addEventListener("click", event => {
      event.stopPropagation();
      removeLane(lane.id);
      renderStack();
      renderSelectedStep();
    });
    actions.appendChild(addBlockButton);
    actions.appendChild(duplicateLaneButton);
    actions.appendChild(removeLaneButton);
    head.appendChild(actions);
    laneCard.appendChild(head);

    const laneTimeline = document.createElement("div");
    laneTimeline.className = "lane-timeline";
    laneTimeline.dataset.laneId = lane.id;
    const laneSurface = document.createElement("div");
    laneSurface.className = "lane-timeline__surface";
    laneSurface.style.width = `${timelineZoom * 100}%`;

    const laneGrid = document.createElement("div");
    laneGrid.className = "lane-timeline__grid";
    for (let second = 0; second <= tickCount; second += 1) {
      const marker = document.createElement("span");
      marker.className = "lane-timeline__marker";
      marker.style.left = `${(second / Math.max(tickCount, 1)) * 100}%`;
      laneGrid.appendChild(marker);
    }
    laneSurface.appendChild(laneGrid);

    const sortedBlocks = [...lane.blocks].sort((a, b) => getBlockStart(a) - getBlockStart(b) || getBlockDuration(b) - getBlockDuration(a));

    for (const block of sortedBlocks) {
      const start = getBlockStart(block);
      const duration = getBlockDuration(block);
      const left = timelineDuration ? (start / timelineDuration) * 100 : 0;
      const width = timelineDuration ? (duration / timelineDuration) * 100 : 0;
      const chip = document.createElement("div");
      chip.className = `lane-block${block.id === selectedBlockId ? " is-selected" : ""}`;
      chip.dataset.blockId = block.id;
      chip.dataset.laneId = lane.id;
      chip.style.left = `${left}%`;
      chip.style.width = `max(${width}%, 92px)`;
      chip.innerHTML = `
        <div class="lane-block__body">
          <strong>${block.label}</strong>
          <small>${start.toFixed(2)}s -> ${(start + duration).toFixed(2)}s · ${summarizeBlock(block)}</small>
        </div>
        <button type="button" class="lane-block__remove" aria-label="Remove block">-</button>
        <span class="lane-block__resize" aria-hidden="true"></span>
      `;
      chip.querySelector(".lane-block__remove")?.addEventListener("click", event => {
        event.stopPropagation();
        removeBlock(block.id);
        renderStack();
        renderSelectedStep();
      });
      chip.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        if (event.target.closest(".lane-block__remove")) return;
        event.stopPropagation();
        const isResize = Boolean(event.target.closest(".lane-block__resize"));
        const pointerOffsetRatio = (event.clientX - chip.getBoundingClientRect().left) / Math.max(laneSurface.getBoundingClientRect().width, 1);
        const originStart = getBlockStart(block);
        const originDuration = getBlockDuration(block);
        let targetLaneId = lane.id;
        let started = false;

        chip.setPointerCapture(event.pointerId);

        const onMove = moveEvent => {
          const distance = Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY);
          if (!started && distance < 4) return;
          if (!started) {
            started = true;
            chip.classList.add("is-dragging");
            stepPopover.classList.add("is-hidden");
          }
          const hoveredTimeline = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".lane-timeline");
          for (const active of document.querySelectorAll(".lane-timeline.is-drop-target")) {
            active.classList.remove("is-drop-target");
          }
          if (hoveredTimeline) {
            hoveredTimeline.classList.add("is-drop-target");
            targetLaneId = hoveredTimeline.dataset.laneId || targetLaneId;
          }

          if (isResize) {
            const nextDuration = snapTime(Math.max(MIN_DURATION, getTimelineDropTime(laneTimeline, moveEvent.clientX) - originStart));
            const nextWidth = timelineDuration ? (nextDuration / timelineDuration) * 100 : 0;
            chip.style.width = `max(${nextWidth}%, 92px)`;
            return;
          }

          const activeTimeline = hoveredTimeline || laneTimeline;
          const nextStart = getTimelineDropTime(activeTimeline, moveEvent.clientX, pointerOffsetRatio);
          const nextLeft = timelineDuration ? (nextStart / timelineDuration) * 100 : 0;
          chip.style.left = `${nextLeft}%`;
        };

        const onUp = upEvent => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          chip.classList.remove("is-dragging");
          for (const active of document.querySelectorAll(".lane-timeline.is-drop-target")) {
            active.classList.remove("is-drop-target");
          }
          if (!started) {
            if (!isResize) {
              setSelection(lane.id, block.id);
            }
            return;
          }
          const hoveredTimeline = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".lane-timeline");
          const activeTimeline = hoveredTimeline || laneTimeline;

          if (isResize) {
            block.options.duration = snapTime(Math.max(MIN_DURATION, getTimelineDropTime(laneTimeline, upEvent.clientX) - originStart));
            renderStack();
            renderSelectedStep();
            return;
          }

          moveBlockToLane(block.id, (activeTimeline?.dataset.laneId || targetLaneId), getTimelineDropTime(activeTimeline || laneTimeline, upEvent.clientX, pointerOffsetRatio));
          renderStack();
          renderSelectedStep();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
      });
      laneSurface.appendChild(chip);
    }

    laneTimeline.addEventListener("dragover", event => {
      if (!primitiveDragType) return;
      event.preventDefault();
      laneTimeline.classList.add("is-drop-target");
    });

    laneTimeline.addEventListener("dragleave", event => {
      if (!laneTimeline.contains(event.relatedTarget)) {
        laneTimeline.classList.remove("is-drop-target");
      }
    });

    laneTimeline.addEventListener("drop", event => {
      if (!primitiveDragType) return;
      event.preventDefault();
      const block = makeBlock(primitiveDragType);
      block.options.start = getTimelineDropTime(laneTimeline, event.clientX);
      lane.blocks.push(block);
      sortLaneBlocks(lane);
      selectedLaneId = lane.id;
      selectedBlockId = block.id;
      clearPrimitiveDragState();
      renderStack();
      renderSelectedStep();
    });

    laneTimeline.appendChild(laneSurface);
    laneCard.appendChild(laneTimeline);
    chartBody.appendChild(laneCard);
  }

  chart.appendChild(chartBody);
  stackList.appendChild(chart);
  attachTimelineScrollSync();
  updateMotionPackStatus();
  saveWorkingDraft();
  syncDetachedPreview();
}

function summarizeBlock(block) {
  const opts = block.options;
  switch (block.type) {
    case "move":
      return `x ${opts.x}, y ${opts.y}`;
    case "scale":
      return `scale ${opts.scale}`;
    case "rotate":
      return `${opts.rotate}°`;
    case "fade":
      return `opacity ${opts.opacity}`;
    case "flip":
      return `rotateY ${opts.rotateY}°`;
    case "pulse":
      return `scale ${opts.scale}`;
    case "shake":
      return `mag ${opts.magnitude}`;
    case "glow":
      return `strength ${opts.strength}`;
    case "flyto":
      return `lift ${opts.y}`;
    case "stagger":
      return `delay ${opts.delay}s`;
    default:
      return "motion block";
  }
}

function renderSelectedStep() {
  const block = findSelectedBlock();
  stepTitle.textContent = block ? block.label : "Nothing selected";
  stepKind.textContent = block ? block.type : "--";
  stepFields.innerHTML = "";

  if (!block) {
    stepPopover.classList.add("is-hidden");
    return;
  }

  const fieldDefs = getFieldDefsForBlock(block);

  for (const [key, label, type, min, max, stepSize] of fieldDefs) {
    const wrapper = document.createElement("label");
    const isColorField = isColorFieldKey(key, type);
    wrapper.className = `field${isColorField ? " field--color" : ""}`;
    wrapper.innerHTML = `<span>${label}</span>`;

    if (isColorField) {
      const row = document.createElement("div");
      row.className = "color-field";

      const colorButton = document.createElement("button");
      colorButton.type = "button";
      colorButton.className = "color-swatch-button";

      const valueChip = document.createElement("span");
      valueChip.className = "color-field__value";

      const initialRaw = block.options[key];
      const initialIsNull = initialRaw == null || initialRaw === "";
      const initialHex = normalizeColor(initialRaw ?? defaultValueFor(key));
      const initialRgb = hexToRgb(initialHex);
      const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);
      const initialHsl = rgbToHsl(initialRgb.r, initialRgb.g, initialRgb.b);

      let pickerMode = initialIsNull ? "null" : "hex";
      let pickerHex = initialHex;
      let pickerRgb = { ...initialRgb };
      let pickerHsv = { ...initialHsv };
      let pickerHsl = { ...initialHsl };

      const colorPicker = document.createElement("div");
      colorPicker.className = "color-picker is-hidden";
      colorPicker.innerHTML = `
        <div class="color-picker__header">
          <div class="color-picker__tabs" role="tablist" aria-label="Color format tabs"></div>
        </div>
        <div class="color-picker__body">
          <button type="button" class="color-picker__canvas" aria-label="Color canvas">
            <span class="color-picker__canvas-surface" aria-hidden="true"></span>
            <span class="color-picker__canvas-thumb" aria-hidden="true"></span>
          </button>
          <label class="color-picker__hue">
            <span>Hue</span>
            <input type="range" min="0" max="360" step="1" />
          </label>
          <div class="color-picker__panels" aria-live="polite"></div>
        </div>
      `;

      const tabsHost = colorPicker.querySelector(".color-picker__tabs");
      const panelsHost = colorPicker.querySelector(".color-picker__panels");
      const canvasButton = colorPicker.querySelector(".color-picker__canvas");
      const canvasSurface = colorPicker.querySelector(".color-picker__canvas-surface");
      const canvasThumb = colorPicker.querySelector(".color-picker__canvas-thumb");
      const hueInput = colorPicker.querySelector(".color-picker__hue input");

      const hexPanel = document.createElement("div");
      hexPanel.className = "color-picker__panel";
      hexPanel.dataset.mode = "hex";
      hexPanel.innerHTML = `
        <label class="color-picker__field">
          <span>Hex</span>
          <input type="text" inputmode="text" placeholder="#7de2ff" />
        </label>
      `;

      const rgbPanel = document.createElement("div");
      rgbPanel.className = "color-picker__panel";
      rgbPanel.dataset.mode = "rgb";
      rgbPanel.innerHTML = `
        <div class="color-picker__triplet">
          <label class="color-picker__field"><span>R</span><input type="number" min="0" max="255" step="1" /></label>
          <label class="color-picker__field"><span>G</span><input type="number" min="0" max="255" step="1" /></label>
          <label class="color-picker__field"><span>B</span><input type="number" min="0" max="255" step="1" /></label>
        </div>
      `;

      const hslPanel = document.createElement("div");
      hslPanel.className = "color-picker__panel";
      hslPanel.dataset.mode = "hsl";
      hslPanel.innerHTML = `
        <div class="color-picker__triplet">
          <label class="color-picker__field"><span>H</span><input type="number" min="0" max="360" step="1" /></label>
          <label class="color-picker__field"><span>S</span><input type="number" min="0" max="100" step="1" /></label>
          <label class="color-picker__field"><span>L</span><input type="number" min="0" max="100" step="1" /></label>
        </div>
      `;

      const nullPanel = document.createElement("div");
      nullPanel.className = "color-picker__panel";
      nullPanel.dataset.mode = "null";
      nullPanel.innerHTML = `
        <p class="color-picker__note">Clear the color so the block falls back to its default.</p>
        <button type="button" class="color-picker__clear">Clear color</button>
      `;

      panelsHost.appendChild(hexPanel);
      panelsHost.appendChild(rgbPanel);
      panelsHost.appendChild(hslPanel);
      panelsHost.appendChild(nullPanel);

      const tabButtons = new Map();
      for (const [mode, title] of [
        ["hex", "Hex"],
        ["rgb", "RGB"],
        ["hsl", "HSL"],
        ["null", "Null"]
      ]) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "color-picker__tab";
        tab.dataset.mode = mode;
        tab.textContent = title;
        tab.setAttribute("role", "tab");
        tab.addEventListener("click", event => {
          event.stopPropagation();
          pickerMode = mode;
          syncColorPickerState({ commit: false });
        });
        tabButtons.set(mode, tab);
        tabsHost.appendChild(tab);
      }

      const hexInput = hexPanel.querySelector("input");
      const [rInput, gInput, bInput] = rgbPanel.querySelectorAll("input");
      const [hInput, sInput, lInput] = hslPanel.querySelectorAll("input");
      const clearButton = nullPanel.querySelector(".color-picker__clear");

      const syncColorPickerState = ({ commit = true } = {}) => {
        const rgb = hsvToRgb(pickerHsv.h, pickerHsv.s, pickerHsv.v);
        pickerRgb = { ...rgb };
        pickerHex = rgbToHex(rgb.r, rgb.g, rgb.b);
        pickerHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

        setColorButtonAppearance(colorButton, pickerMode === "null" ? null : pickerHex);
        valueChip.textContent = pickerMode === "null" ? "null" : pickerHex;
        valueChip.classList.toggle("is-null", pickerMode === "null");

        canvasSurface.style.background = `
          linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0)),
          linear-gradient(to right, #ffffff, hsl(${pickerHsv.h}, 100%, 50%))
        `;
        canvasThumb.style.left = `${pickerHsv.s * 100}%`;
        canvasThumb.style.top = `${(1 - pickerHsv.v) * 100}%`;
        hueInput.value = String(Math.round(pickerHsv.h));

        hexInput.value = pickerHex;
        rInput.value = String(pickerRgb.r);
        gInput.value = String(pickerRgb.g);
        bInput.value = String(pickerRgb.b);
        hInput.value = String(Math.round(pickerHsl.h));
        sInput.value = String(Math.round(pickerHsl.s * 100));
        lInput.value = String(Math.round(pickerHsl.l * 100));

        for (const [mode, tab] of tabButtons) {
          tab.classList.toggle("is-active", mode === pickerMode);
          tab.setAttribute("aria-selected", String(mode === pickerMode));
        }
        for (const panel of panelsHost.querySelectorAll(".color-picker__panel")) {
          panel.classList.toggle("is-active", panel.dataset.mode === pickerMode);
        }

        if (commit) {
          block.options[key] = pickerMode === "null" ? null : pickerHex;
          saveWorkingDraft();
        }
      };

      const applyFromHex = value => {
        const raw = String(value || "").trim();
        if (!/^#[0-9a-f]{3}$/i.test(raw) && !/^#[0-9a-f]{6}$/i.test(raw)) {
          return;
        }
        const normalized = normalizeColor(raw, pickerHex);
        const rgb = hexToRgb(normalized);
        pickerHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        pickerMode = "hex";
        syncColorPickerState();
      };

      const applyFromRgb = () => {
        const rgb = {
          r: clamp(rInput.value, 0, 255),
          g: clamp(gInput.value, 0, 255),
          b: clamp(bInput.value, 0, 255)
        };
        pickerHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        pickerMode = "rgb";
        syncColorPickerState();
      };

      const applyFromHsl = () => {
        const rgb = hslToRgb(
          clamp(hInput.value, 0, 360),
          clamp(sInput.value, 0, 100) / 100,
          clamp(lInput.value, 0, 100) / 100
        );
        pickerHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        pickerMode = "hsl";
        syncColorPickerState();
      };

      const applyFromCanvas = (clientX, clientY) => {
        const rect = canvasButton.getBoundingClientRect();
        pickerHsv = {
          ...pickerHsv,
          s: clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
          v: clamp(1 - (clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
        };
        pickerMode = "hex";
        syncColorPickerState();
      };

      const keepPickerOpen = event => {
        event.stopPropagation();
      };
      colorPicker.addEventListener("pointerdown", keepPickerOpen);
      colorPicker.addEventListener("click", keepPickerOpen);
      row.addEventListener("pointerdown", keepPickerOpen);
      colorButton.addEventListener("pointerdown", keepPickerOpen);
      valueChip.addEventListener("pointerdown", keepPickerOpen);

      canvasButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        canvasButton.setPointerCapture?.(event.pointerId);
        applyFromCanvas(event.clientX, event.clientY);
        const onMove = moveEvent => applyFromCanvas(moveEvent.clientX, moveEvent.clientY);
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
      });

      hueInput.addEventListener("input", () => {
        pickerHsv = { ...pickerHsv, h: clamp(hueInput.value, 0, 360) };
        pickerMode = pickerMode === "null" ? "hex" : pickerMode;
        syncColorPickerState();
      });

      hexInput.addEventListener("input", () => applyFromHex(hexInput.value));
      hexInput.addEventListener("change", () => {
        if (!/^#[0-9a-f]{3}$/i.test(String(hexInput.value || "").trim()) && !/^#[0-9a-f]{6}$/i.test(String(hexInput.value || "").trim())) {
          syncColorPickerState({ commit: false });
        }
      });
      rInput.addEventListener("input", applyFromRgb);
      gInput.addEventListener("input", applyFromRgb);
      bInput.addEventListener("input", applyFromRgb);
      hInput.addEventListener("input", applyFromHsl);
      sInput.addEventListener("input", applyFromHsl);
      lInput.addEventListener("input", applyFromHsl);

      clearButton.addEventListener("click", event => {
        event.stopPropagation();
        pickerMode = "null";
        block.options[key] = null;
        syncColorPickerState({ commit: false });
      });

      colorButton.addEventListener("click", event => {
        event.stopPropagation();
        const shouldOpen = colorPicker.classList.contains("is-hidden");
        setColorPickerOpen(key, colorPicker, colorButton, shouldOpen);
        if (shouldOpen) syncColorPickerState({ commit: false });
      });

      row.appendChild(colorButton);
      row.appendChild(valueChip);
      wrapper.appendChild(row);
      wrapper.appendChild(colorPicker);

      syncColorPickerState({ commit: false });
    } else {
      const input = document.createElement("input");
      input.type = type;
      input.step = String(stepSize);
      if (min !== undefined) input.min = String(min);
      if (max !== undefined) input.max = String(max);
      input.value = block.options[key] ?? defaultValueFor(key);
      input.addEventListener("input", () => {
        block.options[key] = type === "number" ? Number(input.value) : input.value;
        if (key === "start") block.options[key] = getBlockStart(block);
        if (key === "duration") block.options[key] = getBlockDuration(block);
        const lane = getLane(selectedLaneId);
        if (lane) sortLaneBlocks(lane);
        renderStack();
      });

      wrapper.appendChild(input);
    }
    stepFields.appendChild(wrapper);
  }

  closeActiveColorPicker();

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-button";
  remove.textContent = "Remove block";
  remove.addEventListener("click", () => {
    removeBlock(block.id);
    renderStack();
    renderSelectedStep();
  });
  stepFields.appendChild(remove);
  stepPopover.classList.remove("is-hidden");
  positionSelectedStepPopover();
}

function positionSelectedStepPopover() {
  if (stepPopover.classList.contains("is-hidden")) return;
  const selectedBlock = document.querySelector(`.lane-block[data-block-id="${selectedBlockId}"]`);
  if (!selectedBlock || !stackPanel) {
    stepPopover.classList.add("is-hidden");
    return;
  }

  const panelRect = stackPanel.getBoundingClientRect();
  const blockRect = selectedBlock.getBoundingClientRect();
  const preferredWidth = Math.min(340, Math.max(280, panelRect.width * 0.34));
  stepPopover.style.width = `${preferredWidth}px`;

  const margin = 12;
  const topInPanel = blockRect.bottom - panelRect.top + 10 + stackPanel.scrollTop;
  let leftInPanel = blockRect.left - panelRect.left + stackPanel.scrollLeft;

  const maxLeft = Math.max(margin, stackPanel.scrollWidth - preferredWidth - margin);
  leftInPanel = Math.min(Math.max(margin, leftInPanel), maxLeft);

  stepPopover.style.top = `${topInPanel}px`;
  stepPopover.style.left = `${leftInPanel}px`;
}

function defaultValueFor(key) {
  return {
    start: 0,
    duration: 0.5,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    rotateY: 0,
    opacity: 1,
    strength: 16,
    magnitude: 8,
    delay: 0.08,
    cycles: 3,
    color: "#7de2ff"
  }[key];
}

function isColorFieldKey(key, type) {
  return type === "color" || String(key || "").toLowerCase().includes("color");
}

function setupColorPickerDismiss() {
  document.addEventListener("pointerdown", event => {
    if (!activeColorPickerKey) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const clickedInsidePicker = path.some(node => node instanceof Element && node.closest(".color-picker, .color-swatch-button, .field--color"));
    const target = event.target instanceof Element ? event.target : null;
    if (clickedInsidePicker || target?.closest(".color-picker, .color-swatch-button, .field--color")) return;
    closeActiveColorPicker();
  });
}

function setColorPickerOpen(key, colorPicker, button, isOpen) {
  activeColorPickerKey = isOpen ? key : null;
  colorPicker.classList.toggle("is-hidden", !isOpen);
  button.setAttribute("aria-expanded", String(isOpen));
}

function closeActiveColorPicker() {
  activeColorPickerKey = null;
  for (const picker of document.querySelectorAll(".color-picker")) {
    picker.classList.add("is-hidden");
  }
  for (const button of document.querySelectorAll(".color-swatch-button")) {
    button.setAttribute("aria-expanded", "false");
  }
}

function normalizeColor(value, fallback = "#7de2ff") {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split("").map(char => char + char).join("")}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  return fallback;
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function hexToRgb(hex) {
  const normalized = normalizeColor(hex, "#7de2ff").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv(r, g, b) {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

function hsvToRgb(h, s, v) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let [rn, gn, bn] = [0, 0, 0];

  if (hue < 60) [rn, gn, bn] = [c, x, 0];
  else if (hue < 120) [rn, gn, bn] = [x, c, 0];
  else if (hue < 180) [rn, gn, bn] = [0, c, x];
  else if (hue < 240) [rn, gn, bn] = [0, x, c];
  else if (hue < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255)
  };
}

function rgbToHsl(r, g, b) {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const light = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let [rn, gn, bn] = [0, 0, 0];

  if (hue < 60) [rn, gn, bn] = [c, x, 0];
  else if (hue < 120) [rn, gn, bn] = [x, c, 0];
  else if (hue < 180) [rn, gn, bn] = [0, c, x];
  else if (hue < 240) [rn, gn, bn] = [0, x, c];
  else if (hue < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255)
  };
}

function setColorButtonAppearance(button, value) {
  const isNull = value == null || value === "";
  button.classList.toggle("is-null", isNull);
  button.style.background = isNull ? "" : String(value);
}

function getFieldDefsForBlock(block) {
  const shared = [
    ["start", "start", "number", 0, 20, 0.05],
    ["duration", "duration", "number", 0.05, 20, 0.05]
  ];

  const byType = {
    move: [
      ["x", "x", "number", -240, 240, 1],
      ["y", "y", "number", -240, 240, 1]
    ],
    scale: [
      ["scale", "scale", "number", 0.5, 2, 0.01]
    ],
    squashstretch: [
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01]
    ],
    rotate: [
      ["rotate", "rotate", "number", -360, 360, 1]
    ],
    fade: [
      ["opacity", "opacity", "number", 0, 1, 0.05]
    ],
    flip: [
      ["rotateY", "rotateY", "number", -360, 360, 1]
    ],
    flip3d: [
      ["rotateY", "rotateY", "number", -360, 360, 1],
      ["perspective", "perspective", "number", 200, 2400, 10],
      ["settleRotate", "settleRotate", "number", -45, 45, 1],
      ["settleScale", "settleScale", "number", 0.5, 2, 0.01]
    ],
    pulse: [
      ["scale", "scale", "number", 0.5, 2, 0.01]
    ],
    set: [
      ["x", "x", "number", -240, 240, 1],
      ["y", "y", "number", -240, 240, 1],
      ["z", "z", "number", -240, 240, 1],
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01],
      ["rotate", "rotate", "number", -360, 360, 1],
      ["rotateY", "rotateY", "number", -360, 360, 1],
      ["opacity", "opacity", "number", 0, 1, 0.05],
      ["glowStrength", "glow strength", "number", 0, 60, 1],
      ["color", "color", "text", undefined, undefined, undefined]
    ],
    fromto: [
      ["fromX", "from x", "number", -240, 240, 1],
      ["fromY", "from y", "number", -240, 240, 1],
      ["fromZ", "from z", "number", -240, 240, 1],
      ["fromScale", "from scale", "number", 0.5, 2, 0.01],
      ["fromScaleX", "from scale x", "number", 0.5, 2, 0.01],
      ["fromScaleY", "from scale y", "number", 0.5, 2, 0.01],
      ["fromRotate", "from rotate", "number", -360, 360, 1],
      ["fromRotateY", "from rotateY", "number", -360, 360, 1],
      ["fromOpacity", "from opacity", "number", 0, 1, 0.05],
      ["toX", "to x", "number", -240, 240, 1],
      ["toY", "to y", "number", -240, 240, 1],
      ["toZ", "to z", "number", -240, 240, 1],
      ["toScale", "to scale", "number", 0.5, 2, 0.01],
      ["toScaleX", "to scale x", "number", 0.5, 2, 0.01],
      ["toScaleY", "to scale y", "number", 0.5, 2, 0.01],
      ["toRotate", "to rotate", "number", -360, 360, 1],
      ["toRotateY", "to rotateY", "number", -360, 360, 1],
      ["toOpacity", "to opacity", "number", 0, 1, 0.05]
    ],
    shake: [
      ["magnitude", "magnitude", "number", 0, 40, 1],
      ["cycles", "cycles", "number", 1, 12, 1]
    ],
    glow: [
      ["strength", "strength", "number", 0, 40, 1],
      ["color", "color", "text", undefined, undefined, undefined]
    ],
    flash: [
      ["strength", "strength", "number", 0, 60, 1],
      ["color", "color", "text", undefined, undefined, undefined],
      ["opacity", "opacity", "number", 0, 1, 0.05]
    ],
    flyto: [
      ["y", "y", "number", -240, 240, 1],
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["opacity", "opacity", "number", 0, 1, 0.05]
    ],
    pathfly: [
      ["y", "y", "number", -240, 240, 1],
      ["arc", "arc", "number", 0, 360, 1],
      ["bendX", "bendX", "number", -240, 240, 1],
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["opacity", "opacity", "number", 0, 1, 0.05]
    ],
    impact: [
      ["magnitude", "magnitude", "number", 0, 40, 1],
      ["cycles", "cycles", "number", 1, 12, 1],
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01],
      ["strength", "strength", "number", 0, 60, 1],
      ["color", "color", "text", undefined, undefined, undefined]
    ],
    impactslam: [
      ["magnitude", "magnitude", "number", 0, 50, 1],
      ["cycles", "cycles", "number", 1, 12, 1],
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01],
      ["strength", "strength", "number", 0, 60, 1],
      ["color", "color", "text", undefined, undefined, undefined]
    ],
    settlebounce: [
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01]
    ],
    custombounce: [
      ["scaleX", "scaleX", "number", 0.5, 2, 0.01],
      ["scaleY", "scaleY", "number", 0.5, 2, 0.01]
    ],
    customwiggle: [
      ["magnitude", "magnitude", "number", 0, 40, 1],
      ["cycles", "cycles", "number", 1, 12, 1]
    ],
    magnettotarget: [
      ["y", "y", "number", -240, 240, 1],
      ["arc", "arc", "number", 0, 360, 1],
      ["bendX", "bendX", "number", -240, 240, 1],
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["opacity", "opacity", "number", 0, 1, 0.05]
    ],
    stagepulse: [
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["strength", "strength", "number", 0, 60, 1],
      ["color", "color", "text", undefined, undefined, undefined]
    ],
    finalhold: [
      ["opacity", "opacity", "number", 0, 1, 0.05],
      ["scale", "scale", "number", 0.5, 2, 0.01],
      ["rotate", "rotate", "number", -360, 360, 1],
      ["rotateY", "rotateY", "number", -360, 360, 1]
    ],
    trail: [
      ["strength", "strength", "number", 0, 40, 1],
      ["color", "color", "text", undefined, undefined, undefined],
      ["size", "size", "number", 0, 20, 1],
      ["cadence", "cadence", "number", 1, 10, 1]
    ],
    stagger: [
      ["delay", "delay", "number", 0, 0.5, 0.01],
      ["scale", "scale", "number", 0.5, 2, 0.01]
    ]
  };

  return [...shared, ...(byType[block?.type] || [])];
}

function renderMotionPacks() {
  motionPackList.innerHTML = "";

  const motionPacks = collectRenderableMotionPacks();

  if (!motionPacks.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No motion packs saved yet.";
    motionPackList.appendChild(empty);
    return;
  }

  for (const motionPack of motionPacks) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "motion-pack-row";
    const cue = normalizeMotionPack(motionPack, []);
    const laneCount = cue ? 1 : motionPack.lanes.length;
    const blockCount = cue
      ? cue.timeline.blocks.length
      : motionPack.lanes.reduce((count, lane) => count + lane.blocks.length, 0);
    row.innerHTML = `
      <strong>${motionPack.name}</strong>
      <span>${cue ? `${cue.category} · ${blockCount} blocks · ${cue.metadata?.scene || motionPack.scene || "aurora"}${cue.metadata?.source === "m3-library" ? " · built-in" : ""}` : `${laneCount} lanes · ${blockCount} blocks · ${motionPack.scene}`}</span>
    `;
    row.addEventListener("click", () => {
      const sourceCue = normalizeMotionPack(motionPack, []);
      if (sourceCue) {
        setCurrentMotionPackPackage(sourceCue);
        const converted = motionPackToEditorRecord(sourceCue);
        if (converted) {
          lanes = converted.lanes.map(lane => makeLane(lane.blocks));
          selectedLaneId = lanes[0]?.id || null;
          selectedBlockId = lanes[0]?.blocks[0]?.id || null;
          motionPackName.value = sourceCue.name;
          applyScene(sourceCue.metadata?.scene || "aurora", false);
          renderStack();
          renderSelectedStep();
          updateMotionPackStatus();
          sceneStatus.textContent = `Scene: ${sourceCue.metadata?.scene || "aurora"}`;
          return;
        }
      }

      setCurrentMotionPackPackage(null);
      lanes = motionPack.lanes.map(lane => makeLane(lane.blocks));
      selectedLaneId = lanes[0]?.id || null;
      selectedBlockId = lanes[0]?.blocks[0]?.id || null;
      motionPackName.value = motionPack.name;
      applyScene(motionPack.scene, false);
      renderStack();
      renderSelectedStep();
      updateMotionPackStatus();
      sceneStatus.textContent = `Scene: ${motionPack.scene}`;
    });
    motionPackList.appendChild(row);
  }
}

function applyScene(scene, updateSelect = true) {
  currentScene = scene;
  document.body.dataset.scene = scene;
  sceneStatus.textContent = `Scene: ${scene}`;
  if (updateSelect) sceneSelect.value = scene;
  sceneButtons.forEach(button => {
    button.classList.toggle("is-active", button.dataset.scene === scene);
  });
  saveWorkingDraft();
  syncDetachedPreview();
}

async function resetHero() {
  await Move(heroAsset, { x: 0, y: 0, z: 0 }, { duration: 0.01 });
  await Scale(heroAsset, { scale: 1 }, { duration: 0.01 });
  await Rotate(heroAsset, { rotate: 0 }, { duration: 0.01 });
  await Flip(heroAsset, { rotateY: 0 }, { duration: 0.01 });
  await Fade(heroAsset, { opacity: 1 }, { duration: 0.01 });
  await Glow(heroAsset, { strength: 0, color: "#000000" }, { duration: 0.01 });
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function previewStack() {
  if (isPreviewing) return;
  const runId = ++previewRunId;
  isPreviewing = true;
  btnPreview.disabled = true;
  runtimeStatus.textContent = "Runtime: playing";
  motionPackPlayer.stopAllPacks();
  await resetHero();
  try {
    const motionPackPackage = buildMotionPackPackage();
    if (!motionPackPackage) return;

    const playback = motionPackPlayer.previewPack(motionPackPackage, {
      theme: currentScene,
      slots: getMotionPackPreviewSlots(),
      target: heroAsset,
      element: heroAsset,
      targetElement: heroAsset,
      sourceElement: heroAsset,
      data: {
        scene: currentScene,
        motionPackName: motionPackName.value.trim() || "Untitled motion pack"
      }
    });

    await playback.finished;
  } finally {
    if (previewRunId === runId) {
      isPreviewing = false;
      btnPreview.disabled = false;
      runtimeStatus.textContent = globalThis.gsap ? "Runtime: ready" : "Runtime: fallback";
    }
  }
}

async function scheduleBlock(block, runId) {
  const startMs = getBlockStart(block) * 1000;
  if (startMs > 0) {
    await sleep(startMs);
  }
  if (runId !== previewRunId) return null;
  return runBlock(block);
}

async function runBlock(block) {
  const o = block.options;

  switch (block.type) {
    case "move":
      return Move(heroAsset, { x: o.x, y: o.y }, { duration: o.duration });
    case "scale":
      return Scale(heroAsset, { scale: o.scale }, { duration: o.duration });
    case "rotate":
      return Rotate(heroAsset, { rotate: o.rotate }, { duration: o.duration });
    case "fade":
      return Fade(heroAsset, { opacity: o.opacity }, { duration: o.duration });
    case "flip":
      return Flip(heroAsset, { rotateY: o.rotateY }, { duration: o.duration });
    case "pulse":
      return Pulse(heroAsset, { scale: o.scale }, { duration: o.duration });
    case "shake":
      return Shake(heroAsset, { magnitude: o.magnitude, cycles: o.cycles }, { duration: o.duration });
    case "glow":
      return Glow(heroAsset, { strength: o.strength, color: o.color || "#7de2ff" }, { duration: o.duration });
    case "flyto":
      return FlyTo(heroAsset, {
        from: { x: 0, y: o.y, scale: o.scale, opacity: o.opacity },
        to: { x: 0, y: 0, scale: 1, opacity: 1 }
      }, { duration: o.duration });
    case "stagger":
      return Stagger(".ghost-token", (element, index) => Pulse(element, { scale: o.scale + index * 0.03 }, { duration: o.duration }), { delay: o.delay });
    default:
      return null;
  }
}

function saveMotionPack() {
  const name = motionPackName.value.trim() || "Untitled motion pack";
  const payload = buildMotionPackPackage() || buildMotionPackRecord({
    id: crypto.randomUUID(),
    name,
    scene: currentScene,
    lanes
  });

  savedMotionPacks = [payload, ...savedMotionPacks.filter(item => item.name !== payload.name)];
  registerMotionPackIfPossible(payload);
  persistMotionPacks();
  renderMotionPacks();
  updateMotionPackStatus();
}

function buildMotionPackRecord({ id = crypto.randomUUID(), name, scene, lanes: lanesSource }) {
  return {
    id,
    name: String(name || "Untitled motion pack"),
    scene: ["aurora", "midnight", "sunset"].includes(scene) ? scene : "aurora",
    lanes: lanesSource.map(lane => ({
      id: lane.id || crypto.randomUUID(),
      blocks: lane.blocks.map(block => ({
        id: block.id || crypto.randomUUID(),
        type: block.type,
        label: block.label,
        options: { ...block.options }
      }))
    }))
  };
}

function exportCurrentMotionPack() {
  const record = buildMotionPackPackage() || buildMotionPackRecord({
    name: motionPackName.value.trim() || "Untitled motion pack",
    scene: currentScene,
    lanes
  });

  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "joyly-motion-pack"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importMotionPackFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : [parsed];
  const imported = records.map(record => normalizeMotionPack(record, []) || normalizeMotionPackRecord(record)).filter(Boolean);
  if (!imported.length) return;

  const merged = [...imported, ...savedMotionPacks];
  const unique = [];
  const seen = new Set();
  for (const motionPack of merged) {
    const key = `${motionPack.name}::${motionPack.scene}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(motionPack);
  }
  savedMotionPacks = unique;
  for (const motionPack of imported) {
    registerMotionPackIfPossible(motionPack);
  }
  persistMotionPacks();
  renderMotionPacks();
  updateMotionPackStatus();

  const first = imported[0];
  setCurrentMotionPackPackage(normalizeMotionPack(first, []));
  const motionPackShape = normalizeMotionPack(first, []) ? motionPackToEditorRecord(first) : first;
  lanes = motionPackShape.lanes.map(lane => makeLane(lane.blocks));
  selectedLaneId = lanes[0]?.id || null;
  selectedBlockId = lanes[0]?.blocks[0]?.id || null;
  motionPackName.value = first.name;
  applyScene(first.scene || first.metadata?.scene || "aurora", false);
  renderStack();
  renderSelectedStep();
}

function clearStack() {
  setCurrentMotionPackPackage(null);
  lanes = [makeLane()];
  selectedLaneId = lanes[0].id;
  selectedBlockId = null;
  renderStack();
  renderSelectedStep();
}

function loadDemoMotionPack() {
  setCurrentMotionPackPackage(null);
  lanes = [
    makeLane([
      { type: "scale", label: "Scale", options: { start: 0, scale: 1.16, duration: 0.4 } },
      { type: "rotate", label: "Rotate", options: { start: 0, rotate: 16, duration: 0.4 } },
      { type: "glow", label: "Glow", options: { start: 0.1, strength: 28, color: "#7de2ff", duration: 0.28 } }
    ]),
    makeLane([
      { type: "move", label: "Move", options: { start: 0.3, x: 36, y: -6, duration: 0.45 } },
      { type: "fade", label: "Fade", options: { start: 0.32, opacity: 0.7, duration: 0.32 } }
    ])
  ];
  selectedLaneId = lanes[0]?.id || null;
  selectedBlockId = lanes[0]?.blocks[0]?.id || null;
  renderStack();
  renderSelectedStep();
}

function setHeroSource(file) {
  const reader = new FileReader();
  reader.onload = () => {
    setPngLayer(heroAsset, String(reader.result), { alt: file.name });
    saveWorkingDraft();
    syncDetachedPreview();
  };
  reader.readAsDataURL(file);
}

btnPreview.addEventListener("click", previewEverywhere);
btnReset.addEventListener("click", resetEverywhere);
btnDemo.addEventListener("click", () => {
  loadDemoMotionPack();
  renderStack();
  renderSelectedStep();
});
btnPopoutPreview.addEventListener("click", async () => {
  const popup = await ensureDetachedPreviewWindow();
  if (!popup) {
    runtimeStatus.textContent = "Runtime: popup blocked";
  }
});
btnTogglePreviewCard?.addEventListener("click", () => {
  applyPreviewCardVisibility(!previewCardHidden);
});
btnAddLane.addEventListener("click", () => {
  const lane = makeLane();
  lanes = [...lanes, lane];
  selectedLaneId = lane.id;
  selectedBlockId = null;
  renderStack();
  renderSelectedStep();
});
btnSave.addEventListener("click", saveMotionPack);
btnClear.addEventListener("click", clearStack);
btnExport.addEventListener("click", exportCurrentMotionPack);
btnImport.addEventListener("click", () => motionPackInput.click());
pngInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) setHeroSource(file);
});
motionPackInput.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importMotionPackFile(file);
  } finally {
    motionPackInput.value = "";
  }
});

sceneSelect.addEventListener("change", event => {
  applyScene(String(event.target.value), false);
});

sceneButtons.forEach(button => {
  button.addEventListener("click", () => {
    applyScene(button.dataset.scene, true);
  });
});

stepClose.addEventListener("click", () => {
  selectedBlockId = null;
  renderStack();
  renderSelectedStep();
});

timelineZoomInput.addEventListener("input", () => {
  applyTimelineZoom(Number(timelineZoomInput.value));
  saveTimelineZoom(timelineZoom);
  renderStack();
});

timelineLengthInput.addEventListener("change", () => {
  applyTimelineLengthSetting(Number(timelineLengthInput.value));
  saveTimelineLengthSetting(timelineLengthSetting);
  renderStack();
});

if (stageZoomInput) {
  stageZoomInput.addEventListener("input", () => {
    applyPreviewStageZoom(Number(stageZoomInput.value));
  });
}

btnZoomOut.addEventListener("click", () => {
  applyTimelineZoom(timelineZoom - 0.25);
  saveTimelineZoom(timelineZoom);
  renderStack();
});

btnZoomIn.addEventListener("click", () => {
  applyTimelineZoom(timelineZoom + 0.25);
  saveTimelineZoom(timelineZoom);
  renderStack();
});

document.addEventListener("pointerdown", event => {
  if (event.target.closest(".lane-block")) return;
  if (event.target.closest(".stack-popover")) return;
  if (!selectedBlockId) return;
  selectedBlockId = null;
  renderStack();
  renderSelectedStep();
});

stackPanel.addEventListener("scroll", () => {
  positionSelectedStepPopover();
});

window.addEventListener("resize", () => {
  positionSelectedStepPopover();
});

window.JMSMotion = MotionCore;
window.JMSMotionPackRegistry = motionPackPlayer.registry;
