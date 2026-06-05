const MOTION_PACK_VERSION_FALLBACK = "1.0.0";
const ALLOWED_REDUCED_MOTION_MODES = new Set(["static", "simplified", "skip"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function pushError(errors, path, message) {
  if (Array.isArray(errors)) {
    errors.push(path ? `${path}: ${message}` : message);
  }
}

function readString(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function readNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeSlotDescriptor(value, path, errors, fallbackRequired = false) {
  if (typeof value === "string") {
    const id = value.trim();
    if (!id) {
      pushError(errors, path, "Slot id is required");
      return null;
    }
    return {
      id,
      label: id,
      type: "element",
      required: fallbackRequired,
      description: "",
      defaultValue: null
    };
  }

  if (!isPlainObject(value)) {
    pushError(errors, path, "Slot descriptor must be a string or object");
    return null;
  }

  const id = readString(value.id);
  if (!id) {
    pushError(errors, path, "Slot id is required");
    return null;
  }

  return {
    id,
    label: readString(value.label, id),
    type: readString(value.type, "element"),
    required: value.required == null ? fallbackRequired : Boolean(value.required),
    description: readString(value.description, ""),
    defaultValue: cloneValue(value.defaultValue ?? null),
    metadata: isPlainObject(value.metadata) ? cloneValue(value.metadata) : {}
  };
}

function normalizeSlotCollection(value, path, errors, fallbackRequired = false) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    pushError(errors, path, "Slots must be an array");
    return [];
  }

  const slots = [];
  for (let index = 0; index < value.length; index += 1) {
    const slot = normalizeSlotDescriptor(value[index], `${path}[${index}]`, errors, fallbackRequired);
    if (slot) slots.push(slot);
  }
  return slots;
}

function normalizeTimelineBlock(value, path, errors) {
  if (!isPlainObject(value)) {
    pushError(errors, path, "Timeline block must be an object");
    return null;
  }

  const id = readString(value.id);
  const type = readString(value.type);
  if (!id) pushError(errors, `${path}.id`, "Block id is required");
  if (!type) pushError(errors, `${path}.type`, "Block type is required");

  const start = Math.max(0, readNumber(value.start, 0));
  const duration = Math.max(0, readNumber(value.duration, 0));

  if (duration <= 0) {
    pushError(errors, `${path}.duration`, "Block duration must be greater than 0");
  }

  return {
    id: id || `${path}.block`,
    type: type || "unknown",
    label: readString(value.label, type || id || "block"),
    start,
    duration,
    lane: value.lane == null ? null : Math.max(0, Math.floor(readNumber(value.lane, 0))),
    slot: value.slot == null ? null : readString(value.slot, ""),
    params: isPlainObject(value.params) ? cloneValue(value.params) : isPlainObject(value.options) ? cloneValue(value.options) : {},
    easing: value.easing == null ? null : readString(value.easing, ""),
    hooks: isPlainObject(value.hooks) ? cloneValue(value.hooks) : {},
    notes: readString(value.notes, "")
  };
}

function normalizeTimeline(value, path, errors) {
  const source = Array.isArray(value)
    ? { blocks: value }
    : isPlainObject(value)
      ? value
      : null;

  if (!source) {
    pushError(errors, path, "Timeline must be an object or an array of blocks");
    return null;
  }

  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  if (!blocks.length) {
    pushError(errors, `${path}.blocks`, "Timeline must contain at least one block");
    return null;
  }

  const normalizedBlocks = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = normalizeTimelineBlock(blocks[index], `${path}.blocks[${index}]`, errors);
    if (block) normalizedBlocks.push(block);
  }

  if (!normalizedBlocks.length) return null;

  const computedDuration = normalizedBlocks.reduce((longest, block) => Math.max(longest, block.start + block.duration), 0);
  const declaredDuration = readNumber(source.duration, 0);

  return {
    duration: Math.max(declaredDuration, computedDuration),
    blocks: normalizedBlocks
  };
}

function normalizeReducedMotionFallback(value, path, errors) {
  if (value == null) {
    return { mode: "static" };
  }

  if (typeof value === "string") {
    const mode = value.trim();
    if (!ALLOWED_REDUCED_MOTION_MODES.has(mode)) {
      pushError(errors, path, `Unsupported reduced-motion mode: ${mode}`);
      return { mode: "static" };
    }
    return { mode };
  }

  if (!isPlainObject(value)) {
    pushError(errors, path, "Reduced-motion fallback must be an object or string");
    return { mode: "static" };
  }

  const mode = readString(value.mode, "static");
  if (!ALLOWED_REDUCED_MOTION_MODES.has(mode)) {
    pushError(errors, `${path}.mode`, `Unsupported reduced-motion mode: ${mode}`);
  }

  return {
    mode: ALLOWED_REDUCED_MOTION_MODES.has(mode) ? mode : "static",
    title: value.title == null ? "" : readString(value.title, ""),
    description: value.description == null ? "" : readString(value.description, ""),
    timeline: value.timeline ? normalizeTimeline(value.timeline, `${path}.timeline`, errors) : null,
    params: isPlainObject(value.params) ? cloneValue(value.params) : {},
    metadata: isPlainObject(value.metadata) ? cloneValue(value.metadata) : {}
  };
}

function computeCueDuration(timeline) {
  return timeline.blocks.reduce((longest, block) => Math.max(longest, block.start + block.duration), 0);
}

export function normalizeCuePackage(input, errors = []) {
  if (!isPlainObject(input)) {
    pushError(errors, "", "Cue package must be an object");
    return null;
  }

  const id = readString(input.id);
  const name = readString(input.name);
  const version = readString(input.version, MOTION_PACK_VERSION_FALLBACK);
  const category = readString(input.category);
  const description = readString(input.description, "");

  if (!id) pushError(errors, "id", "Cue id is required");
  if (!name) pushError(errors, "name", "Cue name is required");
  if (!version) pushError(errors, "version", "Cue version is required");
  if (!category) pushError(errors, "category", "Cue category is required");

  const requiredSlots = normalizeSlotCollection(input.requiredSlots, "requiredSlots", errors, true);
  const optionalSlots = normalizeSlotCollection(input.optionalSlots, "optionalSlots", errors, false);
  const timeline = normalizeTimeline(input.timeline, "timeline", errors);

  if (!timeline) {
    return null;
  }

  const reducedMotionFallback = normalizeReducedMotionFallback(input.reducedMotionFallback, "reducedMotionFallback", errors);
  const cue = {
    id: id || "motion-pack.untitled",
    name: name || "Untitled motion pack",
    version,
    category: category || "uncategorized",
    description,
    requiredSlots,
    optionalSlots,
    timeline: {
      duration: computeCueDuration(timeline),
      blocks: timeline.blocks
    },
    defaultParams: isPlainObject(input.defaultParams) ? cloneValue(input.defaultParams) : {},
    themeSlots: isPlainObject(input.themeSlots) ? cloneValue(input.themeSlots) : {},
    assetSlots: isPlainObject(input.assetSlots) ? cloneValue(input.assetSlots) : {},
    particleHooks: isPlainObject(input.particleHooks) ? cloneValue(input.particleHooks) : {},
    lottieHooks: isPlainObject(input.lottieHooks) ? cloneValue(input.lottieHooks) : {},
    soundHooks: isPlainObject(input.soundHooks) ? cloneValue(input.soundHooks) : {},
    reducedMotionFallback,
    metadata: isPlainObject(input.metadata) ? cloneValue(input.metadata) : {}
  };

  return cue;
}

export function validateCuePackage(input) {
  const errors = [];
  const cue = normalizeCuePackage(input, errors);
  return {
    valid: Boolean(cue) && errors.length === 0,
    errors,
    cue: errors.length === 0 ? cue : null
  };
}

export function getCuePackageDuration(cue) {
  const normalized = normalizeCuePackage(cue, []);
  return normalized?.timeline?.duration || 0;
}

export function createCuePackageDraft(overrides = {}) {
  return {
    id: overrides.id || "motion-pack.untitled",
    name: overrides.name || "Untitled motion pack",
    version: overrides.version || MOTION_PACK_VERSION_FALLBACK,
    category: overrides.category || "presentation",
    description: overrides.description || "",
    requiredSlots: overrides.requiredSlots || [],
    optionalSlots: overrides.optionalSlots || [],
    timeline: overrides.timeline || { duration: 0, blocks: [] },
    defaultParams: overrides.defaultParams || {},
    themeSlots: overrides.themeSlots || {},
    assetSlots: overrides.assetSlots || {},
    particleHooks: overrides.particleHooks || {},
    lottieHooks: overrides.lottieHooks || {},
    soundHooks: overrides.soundHooks || {},
    reducedMotionFallback: overrides.reducedMotionFallback || { mode: "static" },
    metadata: overrides.metadata || {}
  };
}

export function normalizeMotionPack(input, errors = []) {
  return normalizeCuePackage(input, errors);
}

export function validateMotionPack(input) {
  const result = validateCuePackage(input);
  return {
    valid: result.valid,
    errors: result.errors,
    motionPack: result.cue
  };
}

export function getMotionPackDuration(motionPack) {
  return getCuePackageDuration(motionPack);
}

export function createMotionPackDraft(overrides = {}) {
  return createCuePackageDraft(overrides);
}

export function motionPackToEditorRecord(motionPack) {
  return cuePackageToMotionPackRecord(motionPack);
}

export function editorRecordToMotionPack(editorRecord) {
  return motionPackRecordToCuePackage(editorRecord);
}

export function cuePackageToMotionPackRecord(cuePackage) {
  const cue = normalizeCuePackage(cuePackage, []);
  if (!cue) return null;

  const laneBuckets = new Map();
  for (const block of cue.timeline.blocks) {
    const laneIndex = Number.isFinite(block.lane) ? Math.max(0, Math.floor(block.lane)) : 0;
    if (!laneBuckets.has(laneIndex)) laneBuckets.set(laneIndex, []);
    laneBuckets.get(laneIndex).push(block);
  }

  return {
    id: cue.id,
    name: cue.name,
    scene: cue.metadata?.scene || "aurora",
    lanes: Array.from(laneBuckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([laneIndex, blocks]) => ({
        id: `${cue.id}.lane.${laneIndex}`,
        blocks: blocks.map(block => ({
          id: block.id,
          type: block.type,
          label: block.label || block.type,
          options: {
            start: block.start,
            duration: block.duration,
            ...(block.params || {})
          }
        }))
      }))
  };
}

export function motionPackRecordToCuePackage(motionPackRecord) {
  if (!motionPackRecord || typeof motionPackRecord !== "object") return null;

  const sourceLanes = Array.isArray(motionPackRecord.lanes) ? motionPackRecord.lanes : [];
  const blocks = sourceLanes.flatMap((lane, laneIndex) => {
    const laneBlocks = Array.isArray(lane?.blocks) ? lane.blocks : [];
    return laneBlocks.map((block, blockIndex) => {
      const options = isPlainObject(block?.options) ? cloneValue(block.options) : {};
      const start = readNumber(options.start ?? block?.start ?? 0, 0);
      const duration = Math.max(0.01, readNumber(options.duration ?? block?.duration ?? 0.5, 0.5));
      const params = { ...options };
      delete params.start;
      delete params.duration;

      return {
        id: block?.id || `${motionPackRecord.id || "motion-pack"}.lane${laneIndex}.block${blockIndex}`,
        type: readString(block?.type, "unknown"),
        label: readString(block?.label, readString(block?.type, "block")),
        start,
        duration,
        lane: laneIndex,
        params
      };
    });
  });

  return normalizeCuePackage({
    id: readString(motionPackRecord.id, "motion-pack.from-editor"),
    name: readString(motionPackRecord.name, "Motion pack from editor"),
    version: readString(motionPackRecord.version, "1.0.0"),
    category: "playground",
    description: "Converted from a M2 motion pack",
    requiredSlots: [],
    optionalSlots: [],
    timeline: {
      duration: blocks.reduce((longest, block) => Math.max(longest, block.start + block.duration), 0),
      blocks
    },
    defaultParams: isPlainObject(motionPackRecord.defaultParams) ? cloneValue(motionPackRecord.defaultParams) : {},
    themeSlots: isPlainObject(motionPackRecord.themeSlots) ? cloneValue(motionPackRecord.themeSlots) : {},
    assetSlots: isPlainObject(motionPackRecord.assetSlots) ? cloneValue(motionPackRecord.assetSlots) : {},
    particleHooks: isPlainObject(motionPackRecord.particleHooks) ? cloneValue(motionPackRecord.particleHooks) : {},
    lottieHooks: isPlainObject(motionPackRecord.lottieHooks) ? cloneValue(motionPackRecord.lottieHooks) : {},
    soundHooks: isPlainObject(motionPackRecord.soundHooks) ? cloneValue(motionPackRecord.soundHooks) : {},
    reducedMotionFallback: isPlainObject(motionPackRecord.reducedMotionFallback)
      ? cloneValue(motionPackRecord.reducedMotionFallback)
      : { mode: "static" },
    metadata: {
      ...(isPlainObject(motionPackRecord.metadata) ? cloneValue(motionPackRecord.metadata) : {}),
      scene: readString(motionPackRecord.scene, "aurora"),
      source: "m2-playground"
    }
  }, []);
}
