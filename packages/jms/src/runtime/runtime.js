const DEFAULT_DURATION = 0.6;
const motionState = new WeakMap();
const sequenceSystems = new WeakMap();
const spriteSystems = new WeakMap();
const particleSystems = new WeakMap();
const lottieSystems = new WeakMap();

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function resolveElements(target) {
  if (!target) return [];
  if (typeof target === "string") return Array.from(document.querySelectorAll(target));
  if (target instanceof Element || target instanceof SVGElement) return [target];
  if (Array.isArray(target)) return target.flatMap(resolveElements);
  if (target instanceof NodeList || target instanceof HTMLCollection) return Array.from(target);
  return [];
}

function resolveElement(target) {
  return resolveElements(target)[0] || null;
}

function ensureMotionState(element) {
  if (!motionState.has(element)) {
    const baseFilter = globalThis.getComputedStyle ? globalThis.getComputedStyle(element).filter : "none";
    motionState.set(element, {
      x: 0,
      y: 0,
      z: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      rotateY: 0,
      opacity: 1,
      glowStrength: 0,
      glowColor: "rgba(125, 226, 255, 0)",
      baseFilter: baseFilter && baseFilter !== "none" ? baseFilter : "",
      origin: "50% 50%"
    });
  }

  const state = motionState.get(element);
  element.style.setProperty("--jms-x", String(state.x));
  element.style.setProperty("--jms-y", String(state.y));
  element.style.setProperty("--jms-z", String(state.z));
  element.style.setProperty("--jms-scale", String(state.scale));
  element.style.setProperty("--jms-scale-x", String(state.scaleX));
  element.style.setProperty("--jms-scale-y", String(state.scaleY));
  element.style.setProperty("--jms-rotate", String(state.rotate));
  element.style.setProperty("--jms-rotate-y", String(state.rotateY));
  element.style.setProperty("--jms-opacity", String(state.opacity));
  element.style.setProperty("--jms-glow-strength", String(state.glowStrength));
  element.style.setProperty("--jms-glow-color", state.glowColor);
  element.style.transform = buildTransform();
  element.style.opacity = "var(--jms-opacity)";
  element.style.filter = buildFilter(state);
  element.style.transformOrigin = state.origin;
  element.style.backfaceVisibility = "hidden";
  element.style.willChange = "transform, opacity, filter";
  return state;
}

function buildTransform() {
  return "translate3d(calc(var(--jms-x) * 1px), calc(var(--jms-y) * 1px), calc(var(--jms-z) * 1px)) scaleX(var(--jms-scale-x)) scaleY(var(--jms-scale-y)) scale(var(--jms-scale)) rotate(calc(var(--jms-rotate) * 1deg)) rotateY(calc(var(--jms-rotate-y) * 1deg))";
}

function buildFilter(state) {
  const base = state.baseFilter ? `${state.baseFilter} ` : "";
  return `${base}drop-shadow(0 0 calc(var(--jms-glow-strength) * 1px) var(--jms-glow-color))`;
}

function animateCssVars(element, patch, options = {}) {
  const duration = prefersReducedMotion() ? 0.01 : Number(options.duration ?? DEFAULT_DURATION);
  const ease = options.ease ?? "power2.out";
  const gsap = globalThis.gsap;

  if (gsap) {
    return new Promise((resolve) => {
      gsap.to(element, {
        duration,
        ease,
        ...patch,
        overwrite: false,
        onComplete: resolve
      });
    });
  }

  Object.entries(patch).forEach(([property, value]) => {
    element.style.setProperty(property, String(value));
  });

  return new Promise((resolve) => setTimeout(resolve, duration * 1000));
}

function getCssVarPatch(state, patch) {
  const cssPatch = {};

  if ("x" in patch) cssPatch["--jms-x"] = state.x;
  if ("y" in patch) cssPatch["--jms-y"] = state.y;
  if ("z" in patch) cssPatch["--jms-z"] = state.z;
  if ("scale" in patch) cssPatch["--jms-scale"] = state.scale;
  if ("scaleX" in patch) cssPatch["--jms-scale-x"] = state.scaleX;
  if ("scaleY" in patch) cssPatch["--jms-scale-y"] = state.scaleY;
  if ("rotate" in patch) cssPatch["--jms-rotate"] = state.rotate;
  if ("rotateY" in patch) cssPatch["--jms-rotate-y"] = state.rotateY;
  if ("opacity" in patch) cssPatch["--jms-opacity"] = state.opacity;
  if ("glowStrength" in patch) cssPatch["--jms-glow-strength"] = state.glowStrength;

  return cssPatch;
}

async function tween(target, patch, options = {}) {
  const elements = resolveElements(target);
  if (!elements.length) return [];
  return Promise.all(
    elements.map((element) => {
      const state = ensureMotionState(element);
      if ("x" in patch) state.x = Number(patch.x);
      if ("y" in patch) state.y = Number(patch.y);
      if ("z" in patch) state.z = Number(patch.z);
      if ("scale" in patch) state.scale = Number(patch.scale);
      if ("scaleX" in patch) state.scaleX = Number(patch.scaleX);
      if ("scaleY" in patch) state.scaleY = Number(patch.scaleY);
      if ("rotate" in patch) state.rotate = Number(patch.rotate);
      if ("rotateY" in patch) state.rotateY = Number(patch.rotateY);
      if ("opacity" in patch) state.opacity = Number(patch.opacity);
      if ("glowStrength" in patch) state.glowStrength = Number(patch.glowStrength);
      if ("glowColor" in patch) {
        state.glowColor = String(patch.glowColor);
        element.style.setProperty("--jms-glow-color", state.glowColor);
      }

      const cssPatch = getCssVarPatch(state, patch);
      return Object.keys(cssPatch).length ? animateCssVars(element, cssPatch, options) : Promise.resolve();
    })
  );
}

function applyStatePatch(target, patch = {}) {
  const elements = resolveElements(target);
  if (!elements.length) return [];

  for (const element of elements) {
    const state = ensureMotionState(element);
    if ("x" in patch) state.x = Number(patch.x);
    if ("y" in patch) state.y = Number(patch.y);
    if ("z" in patch) state.z = Number(patch.z);
    if ("scale" in patch) state.scale = Number(patch.scale);
    if ("scaleX" in patch) state.scaleX = Number(patch.scaleX);
    if ("scaleY" in patch) state.scaleY = Number(patch.scaleY);
    if ("rotate" in patch) state.rotate = Number(patch.rotate);
    if ("rotateY" in patch) state.rotateY = Number(patch.rotateY);
    if ("opacity" in patch) state.opacity = Number(patch.opacity);
    if ("glowStrength" in patch) state.glowStrength = Number(patch.glowStrength);
    if ("glowColor" in patch) state.glowColor = String(patch.glowColor);

    const cssPatch = getCssVarPatch(state, patch);
    for (const [property, value] of Object.entries(cssPatch)) {
      element.style.setProperty(property, String(value));
    }
    if ("glowColor" in patch) {
      element.style.setProperty("--jms-glow-color", state.glowColor);
    }
    element.style.transform = buildTransform();
    element.style.opacity = "var(--jms-opacity)";
    element.style.filter = buildFilter(state);
    element.style.transformOrigin = state.origin;
    element.style.backfaceVisibility = "hidden";
    element.style.willChange = "transform, opacity, filter";
  }

  return elements;
}

export function Set(target, patch = {}) {
  return applyStatePatch(target, patch);
}

export async function fromTo(target, fromPatch = {}, toPatch = {}, options = {}) {
  applyStatePatch(target, fromPatch);
  return tween(target, toPatch, options);
}

export async function Move(target, patch = {}, options = {}) {
  return tween(
    target,
    {
      x: Number(patch.x ?? 0),
      y: Number(patch.y ?? 0),
      z: Number(patch.z ?? 0)
    },
    options
  );
}

export async function Scale(target, patch = {}, options = {}) {
  return tween(target, { scale: Number(patch.scale ?? 1) }, options);
}

export async function SquashStretch(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const scaleX = Number(patch.scaleX ?? 1.12);
  const scaleY = Number(patch.scaleY ?? 0.88);
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const half = Math.max(0.01, duration * 0.5);

  return Promise.all(
    elements.map(async (element) => {
      const state = ensureMotionState(element);
      const baseScaleX = state.scaleX;
      const baseScaleY = state.scaleY;
      await tween(element, { scaleX: baseScaleX * scaleX, scaleY: baseScaleY * scaleY }, { duration: half, ease: options.ease ?? "power2.out" });
      await tween(element, { scaleX: baseScaleX, scaleY: baseScaleY }, { duration: half, ease: options.settleEase ?? "back.out(2)" });
    })
  );
}

export async function Rotate(target, patch = {}, options = {}) {
  return tween(target, { rotate: Number(patch.rotate ?? 0) }, options);
}

export async function Fade(target, patch = {}, options = {}) {
  return tween(target, { opacity: Number(patch.opacity ?? 1) }, options);
}

export async function Flip(target, patch = {}, options = {}) {
  return tween(target, { rotateY: Number(patch.rotateY ?? 180) }, options);
}

export async function Flip3D(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const half = Math.max(0.01, duration * 0.5);
  const perspective = Number(patch.perspective ?? options.perspective ?? 1200);
  const flipTo = Number(patch.rotateY ?? 180);
  const settleRotate = Number(patch.settleRotate ?? 0);
  const settleScale = Number(patch.settleScale ?? 1);
  const face = patch.face ?? options.face ?? null;

  return Promise.all(
    elements.map(async (element) => {
      const parent = element.parentElement;
      if (parent) parent.style.perspective = `${perspective}px`;
      element.style.transformStyle = "preserve-3d";
      if (face) element.dataset.jmsFace = "front";

      await tween(
        element,
        {
          rotateY: flipTo / 2,
          scale: settleScale,
          scaleX: 1,
          scaleY: 1
        },
        { duration: half, ease: options.ease ?? "power2.out" }
      );

      if (face) element.dataset.jmsFace = face;

      await tween(
        element,
        {
          rotateY: flipTo,
          rotate: settleRotate
        },
        { duration: half, ease: options.settleEase ?? "back.out(1.8)" }
      );
    })
  );
}

export async function Glow(target, patch = {}, options = {}) {
  const color = patch.color ?? "#7de2ff";
  const strength = Number(patch.strength ?? 16);
  return tween(target, { glowStrength: strength, glowColor: color }, options);
}

export async function Flash(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const peakStrength = Number(patch.strength ?? 32);
  const peakOpacity = Number(patch.opacity ?? 1);
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const half = Math.max(0.01, duration * 0.45);

  return Promise.all(
    elements.map(async (element) => {
      const state = ensureMotionState(element);
      const baseStrength = state.glowStrength;
      const baseOpacity = state.opacity;
      const baseScale = state.scale;
      await tween(element, { glowStrength: peakStrength, opacity: peakOpacity, scale: baseScale * 1.02 }, { duration: half, ease: options.ease ?? "power4.out" });
      await tween(element, { glowStrength: baseStrength, opacity: baseOpacity, scale: baseScale }, { duration: half, ease: options.settleEase ?? "power2.out" });
    })
  );
}

export async function FlyTo(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const from = patch.from ?? { x: 0, y: 24, scale: 0.96, opacity: 0 };
  const to = patch.to ?? { x: 0, y: 0, scale: 1, opacity: 1 };
  const first = await tween(elements, from, { duration: 0.01, ease: options.ease });
  const second = await tween(elements, to, options);
  return [...first, ...second];
}

export async function PathFly(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const from = patch.from ?? { x: 0, y: 120, scale: 0.84, opacity: 0 };
  const to = patch.to ?? { x: 0, y: 0, scale: 1, opacity: 1 };
  const arc = Number(patch.arc ?? options.arc ?? 90);
  const bendX = Number(patch.bendX ?? 0);
  const mid = patch.mid ?? {
    x: (Number(from.x ?? 0) + Number(to.x ?? 0)) / 2 + bendX,
    y: Math.min(Number(from.y ?? 0), Number(to.y ?? 0)) - arc
  };
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const firstDuration = Math.max(0.01, duration * 0.55);
  const secondDuration = Math.max(0.01, duration - firstDuration);

  return Promise.all(
    elements.map(async (element) => {
      await tween(element, from, { duration: 0.01, ease: options.ease });
      await tween(
        element,
        {
          x: mid.x,
          y: mid.y,
          rotate: Number(patch.autoRotate === false ? (from.rotate ?? 0) : (patch.rotate ?? -8)),
          scale: Number(mid.scale ?? from.scale ?? 0.92),
          opacity: Number(mid.opacity ?? 1)
        },
        { duration: firstDuration, ease: options.ease ?? "power2.out" }
      );
      await tween(
        element,
        {
          x: to.x,
          y: to.y,
          rotate: Number(to.rotate ?? patch.settleRotate ?? 0),
          scale: Number(to.scale ?? 1),
          opacity: Number(to.opacity ?? 1)
        },
        { duration: secondDuration, ease: options.settleEase ?? "back.out(1.8)" }
      );
    })
  );
}

export async function Pulse(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const scaleBoost = Number(patch.scale ?? 1.08);
  const halfDuration = Number(options.duration ?? DEFAULT_DURATION) * 0.45;

  return Promise.all(
    elements.map(async (element) => {
      const state = ensureMotionState(element);
      const baseScale = state.scale;
      await tween(element, { scale: baseScale * scaleBoost }, { duration: halfDuration, ease: options.ease });
      await tween(element, { scale: baseScale }, { duration: halfDuration, ease: options.ease });
    })
  );
}

export async function SettleBounce(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const half = Math.max(0.01, duration * 0.5);
  const scaleX = Number(patch.scaleX ?? 1.08);
  const scaleY = Number(patch.scaleY ?? 0.92);

  return Promise.all(
    elements.map(async (element) => {
      const state = ensureMotionState(element);
      const baseScaleX = state.scaleX;
      const baseScaleY = state.scaleY;
      await tween(element, { scaleX: baseScaleX * scaleX, scaleY: baseScaleY * scaleY }, { duration: half, ease: options.ease ?? "back.out(2)" });
      await tween(element, { scaleX: baseScaleX, scaleY: baseScaleY }, { duration: half, ease: options.settleEase ?? "elastic.out(1, 0.6)" });
    })
  );
}

export async function StagePulse(target, patch = {}, options = {}) {
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const color = patch.color ?? "#7de2ff";
  await Promise.all([
    Pulse(target, { scale: Number(patch.scale ?? 1.08) }, { duration, ease: options.ease }),
    Glow(target, { strength: Number(patch.strength ?? 28), color }, { duration: Math.max(0.05, duration * 0.8), ease: options.ease })
  ]);
}

export async function FinalHold(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  return Promise.all(
    elements.map((element) =>
      tween(
        element,
        {
          opacity: Number(patch.opacity ?? 1),
          scale: Number(patch.scale ?? 1),
          scaleX: Number(patch.scaleX ?? 1),
          scaleY: Number(patch.scaleY ?? 1),
          rotate: Number(patch.rotate ?? 0),
          rotateY: Number(patch.rotateY ?? 0),
          glowStrength: Number(patch.strength ?? ensureMotionState(element).glowStrength),
          glowColor: patch.color ?? ensureMotionState(element).glowColor
        },
        { duration: Number(options.duration ?? DEFAULT_DURATION), ease: options.ease ?? "none" }
      )
    )
  );
}

export async function CustomBounce(target, patch = {}, options = {}) {
  return SettleBounce(target, {
    scaleX: patch.scaleX ?? 1.14,
    scaleY: patch.scaleY ?? 0.86
  }, {
    ...options,
    duration: options.duration ?? patch.duration ?? DEFAULT_DURATION
  });
}

export async function CustomWiggle(target, patch = {}, options = {}) {
  return Shake(target, {
    magnitude: patch.magnitude ?? 8,
    cycles: patch.cycles ?? 4
  }, options);
}

export async function ImpactSlam(target, patch = {}, options = {}) {
  return Impact(target, {
    magnitude: patch.magnitude ?? 14,
    cycles: patch.cycles ?? 2,
    scaleX: patch.scaleX ?? 1.12,
    scaleY: patch.scaleY ?? 0.88,
    strength: patch.strength ?? 34,
    color: patch.color ?? "#ff5d5d",
    particlesTarget: patch.particlesTarget ?? options.particlesTarget ?? null,
    origin: patch.origin ?? options.origin ?? null
  }, options);
}

export async function MagnetToTarget(target, patch = {}, options = {}) {
  return PathFly(target, {
    from: patch.from,
    to: patch.to,
    arc: patch.arc ?? 24,
    bendX: patch.bendX ?? 0,
    autoRotate: patch.autoRotate ?? true,
    settleRotate: patch.settleRotate ?? 0
  }, options);
}

export function setFace(target, face = "front") {
  const elements = resolveElements(target);
  for (const element of elements) {
    element.dataset.jmsFace = face;
  }
  return elements;
}

export async function Impact(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  if (!elements.length) return [];

  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const strength = Number(patch.strength ?? 32);
  const magnitude = Number(patch.magnitude ?? 12);
  const scaleX = Number(patch.scaleX ?? 1.1);
  const scaleY = Number(patch.scaleY ?? 0.9);
  const color = patch.color ?? "#ff5d5d";
  const particlesTarget = patch.particlesTarget ?? options.particlesTarget ?? null;
  const particleOptions = patch.particles ?? options.particles ?? {};

  if (particlesTarget) {
    burstParticles(particlesTarget, patch.origin ?? options.origin ?? {}, {
      count: Number(particleOptions.count ?? 16),
      color,
      size: Number(particleOptions.size ?? 4),
      speed: Number(particleOptions.speed ?? 220),
      life: Number(particleOptions.life ?? 600)
    });
  }

  await Promise.all([
    Shake(target, { magnitude, cycles: Number(patch.cycles ?? 2) }, { duration: Math.max(0.1, duration * 0.55), ease: options.ease }),
    SettleBounce(target, { scaleX, scaleY }, { duration: Math.max(0.12, duration * 0.5), ease: options.ease }),
    Flash(target, { strength, color }, { duration: Math.max(0.08, duration * 0.45), ease: options.ease })
  ]);

  return elements;
}

export async function Trail(target, patch = {}, options = {}) {
  const canvas = resolveElement(options.canvas ?? patch.canvas ?? target);
  if (canvas && canvas.tagName === "CANVAS") {
    return trailParticles(canvas, patch.originFn ?? options.originFn ?? (() => ({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 })), {
      ...options,
      color: patch.color ?? options.color ?? "#7de2ff",
      size: patch.size ?? options.size ?? 3,
      cadence: patch.cadence ?? options.cadence ?? 2
    });
  }
  return Glow(target, { strength: Number(patch.strength ?? 10), color: patch.color ?? "#7de2ff" }, options);
}

export async function RevealSequence(target, patch = {}, options = {}) {
  const phases = Array.isArray(patch.phases) && patch.phases.length ? patch.phases : [
    { type: "pathFly", params: { from: patch.from, to: patch.to, arc: patch.arc, color: patch.color } },
    { type: "impact", params: { magnitude: patch.magnitude, strength: patch.strength, color: patch.color } },
    { type: "stagePulse", params: { scale: patch.scale, strength: patch.strength, color: patch.color } },
    { type: "finalHold", params: { opacity: patch.opacity ?? 1, color: patch.color } }
  ];

  for (const phase of phases) {
    const name = String(phase?.type || "").toLowerCase();
    const params = phase?.params || {};
    if (name === "pathfly") await PathFly(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
    else if (name === "impact") await Impact(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
    else if (name === "stagepulse") await StagePulse(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
    else if (name === "finalhold") await FinalHold(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
    else if (name === "flash") await Flash(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
    else if (name === "settlebounce") await SettleBounce(target, params, { ...options, duration: Number(params.duration ?? options.duration ?? DEFAULT_DURATION) });
  }

  return resolveElements(target);
}

export async function Shake(target, patch = {}, options = {}) {
  const elements = resolveElements(target);
  const magnitude = Number(patch.magnitude ?? 8);
  const cycles = Number(patch.cycles ?? 3);
  const duration = Number(options.duration ?? DEFAULT_DURATION);
  const step = duration / Math.max(cycles * 2, 1);

  return Promise.all(
    elements.map(async (element) => {
      const state = ensureMotionState(element);
      const startX = state.x;
      for (let index = 0; index < cycles; index += 1) {
        await tween(element, { x: startX + magnitude }, { duration: step, ease: "power1.out" });
        await tween(element, { x: startX - magnitude }, { duration: step, ease: "power1.out" });
      }
      await tween(element, { x: startX }, { duration: step, ease: "power1.out" });
    })
  );
}

export async function Stagger(target, motion, options = {}) {
  const elements = resolveElements(target);
  const delay = Number(options.delay ?? 0.06) * 1000;
  const runner = typeof motion === "function" ? motion : (el) => tween(el, motion ?? {}, options);

  return Promise.all(
    elements.map(
      (element, index) =>
        new Promise((resolve) => {
          window.setTimeout(() => {
            Promise.resolve(runner(element, index, elements)).then(resolve);
          }, delay * index);
        })
    )
  );
}

export function compose(...motions) {
  return async (target) => {
    for (const motion of motions) {
      await motion(target);
    }
  };
}

export function setPngLayer(target, src, options = {}) {
  const element = resolveElement(target);
  if (!element) return null;

  if (element.tagName === "IMG") {
    element.src = src;
    element.alt = options.alt ?? element.alt ?? "";
  } else {
    element.style.backgroundImage = `url("${src}")`;
    element.style.backgroundRepeat = "no-repeat";
    element.style.backgroundPosition = "center";
    element.style.backgroundSize = options.fit ?? "contain";
  }

  return element;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function createPngSequence(target, frames, options = {}) {
  const element = resolveElement(target);
  if (!element || !frames?.length) {
    return {
      play() {},
      stop() {},
      destroy() {}
    };
  }

  const frameList = [...frames];
  const fps = Number(options.fps ?? 8);
  const interval = 1000 / Math.max(fps, 1);
  const controller = {
    frameIndex: 0,
    running: false,
    raf: 0,
    lastTick: 0,
    play() {
      if (controller.running) return;
      controller.running = true;
      controller.lastTick = 0;
      loop();
    },
    stop() {
      controller.running = false;
      if (controller.raf) cancelAnimationFrame(controller.raf);
      controller.raf = 0;
    },
    destroy() {
      controller.stop();
      sequenceSystems.delete(element);
    },
    setFrame(index) {
      controller.frameIndex = Math.max(0, Math.min(frameList.length - 1, Number(index) || 0));
      renderFrame();
    }
  };

  function renderFrame() {
    const src = frameList[controller.frameIndex];
    if (element.tagName === "IMG") {
      element.src = src;
    } else {
      element.style.backgroundImage = `url("${src}")`;
      element.style.backgroundPosition = "center";
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundSize = options.fit ?? "contain";
    }
  }

  function loop(now = 0) {
    if (!controller.running) return;
    if (!controller.lastTick) controller.lastTick = now;

    if (now - controller.lastTick >= interval) {
      controller.frameIndex = (controller.frameIndex + 1) % frameList.length;
      renderFrame();
      controller.lastTick = now;
    }

    if (prefersReducedMotion()) {
      controller.stop();
      return;
    }

    controller.raf = requestAnimationFrame(loop);
  }

  renderFrame();
  if (prefersReducedMotion()) controller.stop();
  sequenceSystems.set(element, controller);
  return controller;
}

export function createSpriteSheetPlayer(target, options = {}) {
  const canvas = resolveElement(target);
  if (!canvas || canvas.tagName !== "CANVAS") {
    return {
      play() {},
      stop() {},
      destroy() {}
    };
  }

  const context = canvas.getContext("2d");
  const src = options.src;
  const columns = Number(options.columns ?? 1);
  const rows = Number(options.rows ?? 1);
  const frameCount = Number(options.frameCount ?? columns * rows);
  const fps = Number(options.fps ?? 12);
  const interval = 1000 / Math.max(fps, 1);
  const controller = {
    frameIndex: 0,
    running: false,
    raf: 0,
    lastTick: 0,
    image: null,
    play() {
      if (controller.running) return;
      controller.running = true;
      controller.lastTick = 0;
      loop();
    },
    stop() {
      controller.running = false;
      if (controller.raf) cancelAnimationFrame(controller.raf);
      controller.raf = 0;
    },
    destroy() {
      controller.stop();
      spriteSystems.delete(canvas);
    },
    setFrame(index) {
      controller.frameIndex = Math.max(0, Math.min(frameCount - 1, Number(index) || 0));
      renderFrame();
    }
  };

  function resize() {
    const width = canvas.clientWidth || 384;
    const height = canvas.clientHeight || 384;
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame();
  }

  function renderFrame() {
    if (!controller.image?.complete) return;
    const image = controller.image;
    const frameWidth = image.naturalWidth / columns;
    const frameHeight = image.naturalHeight / rows;
    const column = controller.frameIndex % columns;
    const row = Math.floor(controller.frameIndex / columns);
    const sx = frameWidth * column;
    const sy = frameHeight * row;
    const targetWidth = canvas.clientWidth || 384;
    const targetHeight = canvas.clientHeight || 384;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, targetWidth, targetHeight);
  }

  function loop(now = 0) {
    if (!controller.running) return;
    if (!controller.lastTick) controller.lastTick = now;

    if (now - controller.lastTick >= interval) {
      controller.frameIndex = (controller.frameIndex + 1) % frameCount;
      renderFrame();
      controller.lastTick = now;
    }

    if (prefersReducedMotion()) {
      controller.stop();
      return;
    }

    controller.raf = requestAnimationFrame(loop);
  }

  controller.image = new Image();
  controller.image.onload = () => {
    resize();
    renderFrame();
  };
  controller.image.src = src;

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  controller.destroy = () => {
    controller.stop();
    observer.disconnect();
    spriteSystems.delete(canvas);
  };

  resize();
  if (prefersReducedMotion()) controller.stop();
  spriteSystems.set(canvas, controller);
  return controller;
}

function resizeParticleCanvas(canvas, context) {
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureParticleSystem(target) {
  const canvas = resolveElement(target);
  if (!canvas || canvas.tagName !== "CANVAS") return null;
  if (particleSystems.has(canvas)) return particleSystems.get(canvas);

  const context = canvas.getContext("2d");
  const state = {
    particles: [],
    running: false,
    trail: null,
    raf: 0,
    last: 0,
    observer: null,
    burst(origin, options = {}) {
      const count = Number(options.count ?? 24);
      const spread = Number(options.spread ?? Math.PI * 2);
      const speed = Number(options.speed ?? 220);
      const life = Number(options.life ?? 700);
      const color = options.color ?? "#7de2ff";
      const size = Number(options.size ?? 5);

      for (let index = 0; index < count; index += 1) {
        const angle = (spread / count) * index + Math.random() * 0.15;
        const velocity = speed * (0.35 + Math.random() * 0.65);
        state.particles.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life,
          age: 0,
          size: size * (0.6 + Math.random() * 1.25),
          color
        });
      }

      if (!state.running) {
        state.running = true;
        state.last = 0;
        state.tick();
      }
    },
    trail(originFn, options = {}) {
      state.trail = {
        originFn,
        options,
        cadence: Number(options.cadence ?? 2),
        pulse: 0
      };

      if (!state.running) {
        state.running = true;
        state.last = 0;
        state.tick();
      }
    },
    clear() {
      state.particles = [];
      state.trail = null;
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
    destroy() {
      state.running = false;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.observer?.disconnect();
      particleSystems.delete(canvas);
    }
  };

  function drawParticle(particle) {
    const alpha = Math.max(0, 1 - particle.age / particle.life);
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  function step(now) {
    if (!state.running) return;
    if (!state.last) state.last = now;
    const elapsed = Math.min(32, now - state.last);
    state.last = now;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "lighter";

    if (state.trail) {
      state.trail.pulse += elapsed;
      if (state.trail.pulse >= state.trail.cadence * 16) {
        state.trail.pulse = 0;
        const origin = state.trail.originFn();
        state.burst(origin, { ...state.trail.options, count: 2, size: state.trail.options.size ?? 3 });
      }
    }

    state.particles = state.particles.filter((particle) => {
      particle.age += elapsed;
      if (particle.age >= particle.life) return false;
      particle.x += (particle.vx * elapsed) / 1000;
      particle.y += (particle.vy * elapsed) / 1000;
      particle.vy += (state.trail?.gravity ?? 0) * elapsed;
      drawParticle(particle);
      return true;
    });

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";

    if (!state.particles.length && !state.trail) {
      state.running = false;
      return;
    }

    state.raf = requestAnimationFrame(step);
  }

  state.observer = new ResizeObserver(() => resizeParticleCanvas(canvas, context));
  state.observer.observe(canvas);
  resizeParticleCanvas(canvas, context);
  particleSystems.set(canvas, state);
  state.tick = step;
  return state;
}

export function spawnParticles(target, options = {}) {
  return ensureParticleSystem(target)?.burst(
    options.origin ?? {
      x: resolveElement(target)?.clientWidth / 2 || 0,
      y: resolveElement(target)?.clientHeight / 2 || 0
    },
    options
  );
}

export function burstParticles(target, origin = {}, options = {}) {
  const system = ensureParticleSystem(target);
  if (!system) return null;
  const canvas = resolveElement(target);
  const point = {
    x: Number(origin.x ?? canvas.clientWidth / 2 ?? 0),
    y: Number(origin.y ?? canvas.clientHeight / 2 ?? 0)
  };
  system.burst(point, options);
  return system;
}

export function trailParticles(target, originFn, options = {}) {
  const system = ensureParticleSystem(target);
  if (!system) return null;
  system.trail(originFn, options);
  return system;
}

export function clearParticles(target) {
  const system = ensureParticleSystem(target);
  system?.clear();
  return system;
}

export async function loadLottie(target, options = {}) {
  const element = resolveElement(target);
  if (!element) return null;

  const lottie = globalThis.lottie;
  if (!lottie?.loadAnimation) {
    element.textContent = "Lottie runtime unavailable";
    return null;
  }

  const animation = lottie.loadAnimation({
    container: element,
    renderer: options.renderer ?? "svg",
    loop: options.loop ?? true,
    autoplay: options.autoplay ?? false,
    animationData: options.animationData
  });

  const controller = {
    instance: animation,
    play() {
      animation.play();
    },
    stop() {
      animation.stop();
    },
    loop(value = true) {
      animation.loop = value;
      return controller;
    },
    destroy() {
      animation.destroy();
      lottieSystems.delete(element);
    }
  };

  lottieSystems.set(element, controller);
  return controller;
}

export function playLottie(target) {
  const controller = resolveElement(target) ? lottieSystems.get(resolveElement(target)) : target;
  controller?.play?.();
  return controller ?? null;
}

export function stopLottie(target) {
  const controller = resolveElement(target) ? lottieSystems.get(resolveElement(target)) : target;
  controller?.stop?.();
  return controller ?? null;
}

export function loopLottie(target, value = true) {
  const controller = resolveElement(target) ? lottieSystems.get(resolveElement(target)) : target;
  controller?.loop?.(value);
  return controller ?? null;
}

export function destroyLottie(target) {
  const controller = resolveElement(target) ? lottieSystems.get(resolveElement(target)) : target;
  controller?.destroy?.();
  return controller ?? null;
}

export const MotionCore = {
  prefersReducedMotion,
  Set,
  set: Set,
  fromTo,
  Move,
  Scale,
  SquashStretch,
  squashStretch: SquashStretch,
  Rotate,
  Fade,
  Flip,
  Flip3D,
  flip3d: Flip3D,
  Glow,
  Flash,
  flash: Flash,
  Pulse,
  PathFly,
  pathFly: PathFly,
  motionPathFly: PathFly,
  SettleBounce,
  settleBounce: SettleBounce,
  StagePulse,
  stagePulse: StagePulse,
  FinalHold,
  finalHold: FinalHold,
  CustomBounce,
  customBounce: CustomBounce,
  CustomWiggle,
  customWiggle: CustomWiggle,
  ImpactSlam,
  impactSlam: ImpactSlam,
  MagnetToTarget,
  magnetToTarget: MagnetToTarget,
  Impact,
  impact: Impact,
  Trail,
  trail: Trail,
  RevealSequence,
  revealSequence: RevealSequence,
  setFace,
  Shake,
  FlyTo,
  Stagger,
  compose,
  setPngLayer,
  createPngSequence,
  createSpriteSheetPlayer,
  spawnParticles,
  burstParticles,
  trailParticles,
  clearParticles,
  loadLottie,
  playLottie,
  stopLottie,
  loopLottie,
  destroyLottie
};

globalThis.JMSMotion = MotionCore;
