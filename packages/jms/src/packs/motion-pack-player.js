import {
  Move,
  Scale,
  SquashStretch,
  Rotate,
  Fade,
  Flip,
  Flip3D,
  Glow,
  Flash,
  Pulse,
  PathFly,
  SettleBounce,
  StagePulse,
  FinalHold,
  Impact,
  ImpactSlam,
  CustomBounce,
  CustomWiggle,
  MagnetToTarget,
  Trail,
  Shake,
  FlyTo,
  Set,
  fromTo,
  RevealSequence,
  Stagger
} from "../runtime/runtime.js";
import { motionPackRegistry } from "./motion-pack-registry.js";
import { normalizeMotionPack } from "./motion-pack-schema.js";

const activeCueInstances = new Map();
let nextCueInstanceId = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readString(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function mergeDeep(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return clone(patch ?? base);
  }

  const merged = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeDeep(merged[key], value);
    } else {
      merged[key] = clone(value);
    }
  }
  return merged;
}

function resolveCueSource(cueOrId, registry = motionPackRegistry) {
  if (typeof cueOrId === "string") {
    const cue = registry.getMotionPack(cueOrId);
    if (!cue) {
      throw new Error(`Cue "${cueOrId}" was not found in the registry`);
    }
    return cue;
  }

  const normalized = normalizeMotionPack(cueOrId, []);
  if (!normalized) {
    throw new Error("Cue package could not be normalized");
  }
  return normalized;
}

function resolveSlotValue(slot, options = {}, cue = null) {
  const key = slot.id;
  const sources = [options.slots, options.data, options.params, options, cue?.defaultParams];

  for (const source of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("target")) {
    return options.target ?? options.targetElement ?? options.element ?? null;
  }
  if (lowerKey.includes("source")) {
    return options.source ?? options.sourceElement ?? null;
  }
  if (lowerKey.includes("title")) {
    return options.titleText ?? options.title ?? null;
  }
  if (lowerKey.includes("subtitle")) {
    return options.subtitleText ?? options.subtitle ?? null;
  }
  if (lowerKey.includes("sound")) {
    return options.soundKey ?? options.sound ?? null;
  }
  if (lowerKey.includes("particle")) {
    return options.particleStyle ?? options.particles ?? null;
  }

  return slot.defaultValue ?? null;
}

function resolveCueSlots(cue, options = {}) {
  const resolved = {};
  const descriptors = [...(cue.requiredSlots || []), ...(cue.optionalSlots || [])];

  for (const slot of descriptors) {
    resolved[slot.id] = resolveSlotValue(slot, options, cue);
  }

  return resolved;
}

function applyThemeToCue(cue, options = {}) {
  const themeName = readString(options.theme, "");
  if (!themeName) {
    return { cue: clone(cue), themeName: "", theme: null };
  }

  const theme = cue.themeSlots?.[themeName] || cue.themeSlots?.default || null;
  if (!theme) {
    return { cue: clone(cue), themeName, theme: null };
  }

  const themedCue = clone(cue);
  if (isPlainObject(theme.defaultParams)) {
    themedCue.defaultParams = mergeDeep(themedCue.defaultParams || {}, theme.defaultParams);
  }
  if (isPlainObject(theme.assetSlots)) {
    themedCue.assetSlots = mergeDeep(themedCue.assetSlots || {}, theme.assetSlots);
  }
  if (isPlainObject(theme.particleHooks)) {
    themedCue.particleHooks = mergeDeep(themedCue.particleHooks || {}, theme.particleHooks);
  }
  if (isPlainObject(theme.lottieHooks)) {
    themedCue.lottieHooks = mergeDeep(themedCue.lottieHooks || {}, theme.lottieHooks);
  }
  if (isPlainObject(theme.soundHooks)) {
    themedCue.soundHooks = mergeDeep(themedCue.soundHooks || {}, theme.soundHooks);
  }
  if (isPlainObject(theme.metadata)) {
    themedCue.metadata = mergeDeep(themedCue.metadata || {}, theme.metadata);
  }
  if (isPlainObject(theme.reducedMotionFallback)) {
    themedCue.reducedMotionFallback = mergeDeep(themedCue.reducedMotionFallback || {}, theme.reducedMotionFallback);
  }
  if (isPlainObject(theme.timeline)) {
    themedCue.timeline = mergeDeep(themedCue.timeline || {}, theme.timeline);
  }

  return { cue: themedCue, themeName, theme };
}

function normalizeBlockParams(block) {
  return isPlainObject(block?.params) ? clone(block.params) : {};
}

function resolveBlockTarget(block, slots, options = {}) {
  if (block?.slot && slots?.[block.slot] != null) return slots[block.slot];
  if (block?.targetSlot && slots?.[block.targetSlot] != null) return slots[block.targetSlot];

  const candidates = [
    options.target,
    options.targetElement,
    options.element,
    slots?.targetElement,
    slots?.sourceElement
  ];

  return candidates.find(value => value != null) ?? null;
}

function resolveElementTarget(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.find(item => item instanceof Element || item instanceof SVGElement) || null;
  }
  if (value instanceof Element || value instanceof SVGElement) return value;
  if (typeof value === "string") {
    return document.querySelector(value);
  }
  return null;
}

function getElementCenter(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") {
    return { x: 0, y: 0 };
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function getMotionRunner(blockType) {
  switch (blockType) {
    case "move":
      return Move;
    case "scale":
      return Scale;
    case "squashstretch":
      return SquashStretch;
    case "rotate":
      return Rotate;
    case "fade":
      return Fade;
    case "flip":
      return Flip;
    case "flip3d":
      return Flip3D;
    case "glow":
      return Glow;
    case "flash":
      return Flash;
    case "pulse":
      return Pulse;
    case "pathfly":
    case "motionpathfly":
      return PathFly;
    case "settlebounce":
      return SettleBounce;
    case "custombounce":
      return CustomBounce;
    case "customwiggle":
      return CustomWiggle;
    case "stagepulse":
      return StagePulse;
    case "finalhold":
      return FinalHold;
    case "impact":
      return Impact;
    case "impactslam":
      return ImpactSlam;
    case "trail":
      return Trail;
    case "magnettotarget":
      return MagnetToTarget;
    case "revealsequence":
      return RevealSequence;
    case "shake":
      return Shake;
    case "flyto":
      return FlyTo;
    case "set":
      return Set;
    case "fromto":
      return fromTo;
    case "stagger":
      return Stagger;
    default:
      return null;
  }
}

function collectTargetsFromSlots(slots) {
  const targets = [];
  for (const value of Object.values(slots || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) targets.push(item);
      }
      continue;
    }
    targets.push(value);
  }
  return targets;
}

function killCueTargets(targets) {
  const gsap = globalThis.gsap;
  if (!gsap || typeof gsap.killTweensOf !== "function") return;

  for (const target of targets) {
    try {
      gsap.killTweensOf(target);
    } catch {
      // Ignore kill failures for non-DOM targets.
    }
  }
}

function buildReducedMotionCue(cue) {
  const fallback = cue.reducedMotionFallback || {};
  if (fallback.mode === "skip") {
    return { ...cue, timeline: { duration: 0, blocks: [] } };
  }

  if (fallback.timeline?.blocks?.length) {
    return {
      ...cue,
      timeline: {
        duration: fallback.timeline.duration || 0,
        blocks: fallback.timeline.blocks.map(block => ({
          ...block,
          duration: 0.01,
          start: block.start ?? 0
        }))
      }
    };
  }

  return {
    ...cue,
    timeline: {
      duration: cue.timeline?.duration || 0,
      blocks: (cue.timeline?.blocks || []).map(block => ({
        ...block,
        duration: 0.01
      }))
    }
  };
}

async function runCueBlock(block, context) {
  const runner = getMotionRunner(block.type);
  if (!runner) return null;

  const target = resolveBlockTarget(block, context.slots, context.options);
  if (!target) return null;

  const params = {
    ...clone(context.cue.defaultParams || {}),
    ...clone(context.theme?.defaultParams || {}),
    ...normalizeBlockParams(block)
  };
  const duration = Number(block.duration ?? params.duration ?? 0.6);
  const options = {
    duration: Math.max(0.01, duration),
    ease: block.easing || context.options.ease || "power2.out"
  };

  switch (block.type) {
    case "move":
      return runner(target, { x: params.x ?? 0, y: params.y ?? 0, z: params.z ?? 0 }, options);
    case "scale":
      return runner(target, { scale: params.scale ?? 1 }, options);
    case "squashstretch":
      return runner(target, { scaleX: params.scaleX ?? 1.12, scaleY: params.scaleY ?? 0.88 }, options);
    case "rotate":
      return runner(target, { rotate: params.rotate ?? 0 }, options);
    case "fade":
      return runner(target, { opacity: params.opacity ?? 1 }, options);
    case "flip":
      return runner(target, { rotateY: params.rotateY ?? 180 }, options);
    case "flip3d":
      return runner(target, { rotateY: params.rotateY ?? 180, perspective: params.perspective ?? 1200, settleRotate: params.settleRotate ?? 0, settleScale: params.settleScale ?? 1, face: params.face ?? "back" }, options);
    case "glow":
      return runner(target, { strength: params.strength ?? 16, color: params.color ?? "#7de2ff" }, options);
    case "flash":
      return runner(target, { strength: params.strength ?? 32, color: params.color ?? "#7de2ff", opacity: params.opacity ?? 1 }, options);
    case "pulse":
      return runner(target, { scale: params.scale ?? 1.08 }, options);
    case "custombounce":
      return runner(target, { scaleX: params.scaleX ?? 1.14, scaleY: params.scaleY ?? 0.86 }, options);
    case "customwiggle":
      return runner(target, { magnitude: params.magnitude ?? 8, cycles: params.cycles ?? 4 }, options);
    case "pathfly":
      return runner(target, {
        from: params.from ?? { x: 0, y: params.y ?? 120, scale: params.scale ?? 0.84, opacity: params.opacity ?? 0 },
        to: params.to ?? { x: params.x ?? 0, y: 0, scale: 1, opacity: 1 },
        arc: params.arc ?? 90,
        bendX: params.bendX ?? 0,
        autoRotate: params.autoRotate ?? true
      }, options);
    case "settlebounce":
      return runner(target, { scaleX: params.scaleX ?? 1.08, scaleY: params.scaleY ?? 0.92 }, options);
    case "stagepulse":
      return runner(target, { scale: params.scale ?? 1.08, strength: params.strength ?? 28, color: params.color ?? "#7de2ff" }, options);
    case "finalhold":
      return runner(target, { opacity: params.opacity ?? 1, scale: params.scale ?? 1, scaleX: params.scaleX ?? 1, scaleY: params.scaleY ?? 1, rotate: params.rotate ?? 0, rotateY: params.rotateY ?? 0, strength: params.strength ?? 0, color: params.color ?? "#7de2ff" }, options);
    case "impact":
      return runner(target, {
        magnitude: params.magnitude ?? 12,
        cycles: params.cycles ?? 2,
        scaleX: params.scaleX ?? 1.1,
        scaleY: params.scaleY ?? 0.9,
        strength: params.strength ?? 32,
        color: params.color ?? "#ff5d5d",
        particlesTarget: context.options?.particlesTarget ?? null,
        origin: params.origin ?? null
      }, options);
    case "impactslam":
      return runner(target, {
        magnitude: params.magnitude ?? 14,
        cycles: params.cycles ?? 2,
        scaleX: params.scaleX ?? 1.12,
        scaleY: params.scaleY ?? 0.88,
        strength: params.strength ?? 34,
        color: params.color ?? "#ff5d5d",
        particlesTarget: context.options?.particlesTarget ?? null,
        origin: params.origin ?? null
      }, options);
    case "trail":
      return runner(target, { color: params.color ?? "#7de2ff", strength: params.strength ?? 10, size: params.size ?? 3, cadence: params.cadence ?? 2 }, options);
    case "magnettotarget":
      return runner(target, {
        from: params.from ?? { x: 0, y: params.y ?? 72, scale: params.scale ?? 0.88, opacity: params.opacity ?? 0 },
        to: params.to ?? { x: 0, y: 0, scale: 1, opacity: 1 },
        arc: params.arc ?? 24,
        bendX: params.bendX ?? 0,
        autoRotate: params.autoRotate ?? true,
        settleRotate: params.settleRotate ?? 0
      }, options);
    case "shake":
      return runner(target, { magnitude: params.magnitude ?? 8, cycles: params.cycles ?? 3 }, options);
    case "flyto":
      {
        const sourceElement = resolveElementTarget(target);
        const targetSlotName = readString(block?.hooks?.targetSlot || params.targetSlot || "targetElement", "targetElement");
        const destinationElement = resolveElementTarget(
          context.slots?.[targetSlotName] ?? context.options?.[targetSlotName] ?? null
        );

        if (sourceElement && destinationElement && sourceElement !== destinationElement) {
          const sourceCenter = getElementCenter(sourceElement);
          const destinationCenter = getElementCenter(destinationElement);
          const deltaX = destinationCenter.x - sourceCenter.x;
          const deltaY = destinationCenter.y - sourceCenter.y;
          return runner(sourceElement, {
            from: params.from ?? { x: 0, y: 0, scale: params.scale ?? 0.96, opacity: params.opacity ?? 0 },
            to: params.to ?? { x: deltaX, y: deltaY, scale: 1, opacity: 1 }
          }, options);
        }

        return runner(target, {
          from: params.from ?? { x: 0, y: params.y ?? 24, scale: params.scale ?? 0.96, opacity: params.opacity ?? 0 },
          to: params.to ?? { x: 0, y: 0, scale: 1, opacity: 1 }
        }, options);
      }
    case "stagger":
      return runner(params.targets ?? target, (element, index) => {
        const scaleBoost = params.scale ?? 1.08;
        return Pulse(element, { scale: scaleBoost + index * 0.03 }, { duration: options.duration / 2, ease: options.ease });
      }, { delay: params.delay ?? 0.08 });
    case "set":
      return runner(target, { ...params }, options);
    case "fromto":
      {
        const fromPatch = params.from ?? {
          x: params.fromX,
          y: params.fromY,
          z: params.fromZ,
          scale: params.fromScale,
          scaleX: params.fromScaleX,
          scaleY: params.fromScaleY,
          rotate: params.fromRotate,
          rotateY: params.fromRotateY,
          opacity: params.fromOpacity
        };
        const toPatch = params.to ?? {
          x: params.toX,
          y: params.toY,
          z: params.toZ,
          scale: params.toScale,
          scaleX: params.toScaleX,
          scaleY: params.toScaleY,
          rotate: params.toRotate,
          rotateY: params.toRotateY,
          opacity: params.toOpacity
        };
        return runner(target, fromPatch, toPatch, options);
      }
    case "revealsequence":
      return RevealSequence(target, {
        phases: params.phases ?? [
          { type: "pathFly", params: { from: params.from, to: params.to, arc: params.arc, color: params.color } },
          { type: "impact", params: { magnitude: params.magnitude, strength: params.strength, color: params.color } },
          { type: "stagePulse", params: { scale: params.scale, strength: params.strength, color: params.color } },
          { type: "finalHold", params: { opacity: params.opacity ?? 1, color: params.color } }
        ]
      }, options);
    default:
      return null;
  }
}

function createPlaybackController({ cue, options, slots, themeName, theme }) {
  const instanceId = `cue-${nextCueInstanceId++}`;
  const gsap = globalThis.gsap;
  const targets = collectTargetsFromSlots(slots);
  const totalDuration = Math.max(0, Number(cue.timeline?.duration ?? 0));
  let settleFinished = null;
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    instance.state = "finished";
    activeCueInstances.delete(instanceId);
    settleFinished?.(instance);
  };
  const instance = {
    id: instanceId,
    cueId: cue.id,
    cue,
    options,
    slots,
    themeName,
    theme,
    state: "idle",
    timeline: null,
    finished: Promise.resolve(),
    stop() {
      if (instance.state === "stopped" || instance.state === "finished") return;
      instance.state = "stopped";
      if (instance.timeline?.kill) {
        instance.timeline.kill();
      }
      killCueTargets(targets);
      activeCueInstances.delete(instanceId);
      finish();
    }
  };

  instance.finished = new Promise(resolve => {
    settleFinished = resolve;

    const context = { cue, options, slots, themeName, theme };
    const blocks = cue.timeline?.blocks || [];

    if (gsap && typeof gsap.timeline === "function") {
      const timeline = gsap.timeline({
        paused: true,
        onComplete: finish
      });
      instance.timeline = timeline;

      timeline.to({}, { duration: Math.max(totalDuration, 0.01), ease: "none" }, 0);
      for (const block of blocks) {
        timeline.add(() => {
          if (instance.state === "stopped") return;
          void runCueBlock(block, context);
        }, Math.max(0, Number(block.start ?? 0)));
      }
      instance.state = "playing";
      activeCueInstances.set(instanceId, instance);
      timeline.play(0);
      return;
    }

    const timers = [];
    for (const block of blocks) {
      const delay = Math.max(0, Number(block.start ?? 0)) * 1000;
      timers.push(
        window.setTimeout(() => {
          if (instance.state === "stopped") return;
          void runCueBlock(block, context);
        }, delay)
      );
    }
    instance.timeline = {
      kill() {
        for (const timer of timers) window.clearTimeout(timer);
      }
    };
    instance.state = "playing";
    activeCueInstances.set(instanceId, instance);
    window.setTimeout(finish, Math.max(0, totalDuration) * 1000 + 16);
  });

  return instance;
}

function normalizePackageInput(cueOrId, options = {}, registry = motionPackRegistry) {
  const sourceCue = resolveCueSource(cueOrId, registry);
  const { cue, themeName, theme } = applyThemeToCue(sourceCue, options);
  const slots = resolveCueSlots(cue, options);
  return { cue, themeName, theme, slots };
}

export function createMotionPackPlayer({ registry = motionPackRegistry } = {}) {
  return {
    registry,
    registerMotionPack(motionPack) {
      return registry.registerMotionPack(motionPack);
    },
    unregisterMotionPack(motionPackId) {
      return registry.unregisterMotionPack(motionPackId);
    },
    getMotionPack(motionPackId) {
      return registry.getMotionPack(motionPackId);
    },
    listMotionPacks() {
      return registry.listMotionPacks();
    },
    validateMotionPack(motionPack) {
      return registry.validateMotionPack(motionPack);
    },
    loadMotionPack(source, options = {}) {
      return registry.loadMotionPack(source, options);
    },
    exportMotionPack(motionPackOrId, options = {}) {
      return registry.exportMotionPack(motionPackOrId, options);
    },
    resolveMotionPackSlots(motionPackOrId, options = {}) {
      const { cue, slots } = normalizePackageInput(motionPackOrId, options, registry);
      return { motionPack: cue, slots };
    },
    applyThemeToMotionPack(motionPackOrId, options = {}) {
      const cue = normalizePackageInput(motionPackOrId, options, registry).cue;
      return cue;
    },
    previewPack(motionPackOrId, options = {}) {
      const { cue, slots, themeName, theme } = normalizePackageInput(motionPackOrId, options, registry);
      return createPlaybackController({ cue, options, slots, themeName, theme });
    },
    playPack(motionPackId, options = {}) {
      return this.previewPack(motionPackId, options);
    },
    stopPack(instanceId) {
      const instance = activeCueInstances.get(String(instanceId || ""));
      if (!instance) return false;
      instance.stop();
      return true;
    },
    stopAllPacks() {
      for (const instance of [...activeCueInstances.values()]) {
        instance.stop();
      }
      return true;
    },
    registerCue(cuePackage) {
      return registry.registerMotionPack(cuePackage);
    },
    unregisterCue(cueId) {
      return registry.unregisterMotionPack(cueId);
    },
    getCue(cueId) {
      return registry.getMotionPack(cueId);
    },
    listCues() {
      return registry.listMotionPacks();
    },
    validateCue(cuePackage) {
      const result = registry.validateMotionPack(cuePackage);
      return {
        valid: result.valid,
        errors: result.errors,
        cue: result.motionPack
      };
    },
    loadCuePackage(source, options = {}) {
      const result = registry.loadMotionPack(source, options);
      return {
        valid: result.valid,
        errors: result.errors,
        cue: result.motionPack,
        error: result.error
      };
    },
    exportCuePackage(cueOrId, options = {}) {
      return registry.exportMotionPack(cueOrId, options);
    },
    resolveCueSlots(cueOrId, options = {}) {
      const { cue, slots } = normalizePackageInput(cueOrId, options, registry);
      return { cue, slots };
    },
    applyThemeToCue(cueOrId, options = {}) {
      const cue = normalizePackageInput(cueOrId, options, registry).cue;
      return cue;
    },
    previewCue(cueOrId, options = {}) {
      const { cue, slots, themeName, theme } = normalizePackageInput(cueOrId, options, registry);
      return createPlaybackController({ cue, options, slots, themeName, theme });
    },
    playCue(cueId, options = {}) {
      return this.previewCue(cueId, options);
    },
    stopCue(instanceId) {
      const instance = activeCueInstances.get(String(instanceId || ""));
      if (!instance) return false;
      instance.stop();
      return true;
    },
    stopAllCues() {
      for (const instance of [...activeCueInstances.values()]) {
        instance.stop();
      }
      return true;
    }
  };
}

export const motionPackPlayer = createMotionPackPlayer();
export const createCuePlayer = createMotionPackPlayer;
export const cuePlayer = motionPackPlayer;
