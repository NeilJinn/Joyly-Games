function stableHash(text) {
  let hash = 0;
  for (let index = 0; index < String(text || "").length; index += 1) {
    hash = ((hash << 5) - hash + String(text || "").charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function flattenSources(value, output = []) {
  if (value == null || value === false) return output;
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenSources(item, output);
    return output;
  }
  if (typeof value === "object" && typeof value.src === "string") {
    output.push(value.src);
  }
  return output;
}

function resolveValue(value, context, step) {
  return typeof value === "function" ? value(context, step) : value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickVariant(list = [], seed = "") {
  if (!Array.isArray(list) || !list.length) return [];
  if (list.length === 1) return [list[0]];
  const index = stableHash(seed) % list.length;
  return [list[index]];
}

function resolveSources(step, context = {}) {
  if (!step) return [];

  const explicitSource = step.source ? context[step.source] : null;
  if (explicitSource) {
    return flattenSources(explicitSource);
  }

  const audio = resolveValue(step.audio, context, step);
  const sources = flattenSources(audio);
  if (sources.length) return sources;

  const fallback = resolveValue(step.fallbackAudio, context, step);
  return flattenSources(fallback);
}

export function getDirectorSegmentPauseMs(step = {}, durationSeconds = 0, context = {}) {
  const explicit = resolveValue(step.segmentPauseMs, context, step);
  if (Number.isFinite(Number(explicit))) {
    return Math.max(0, Number(explicit));
  }

  const multiplier = Number(resolveValue(step.segmentPauseMultiplier, context, step));
  const minMs = Number(resolveValue(step.segmentPauseMinMs, context, step));
  const maxMs = Number(resolveValue(step.segmentPauseMaxMs, context, step));
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 0.12;
  const safeMin = Number.isFinite(minMs) ? minMs : 180;
  const safeMax = Number.isFinite(maxMs) ? maxMs : 1200;
  const base = Math.max(0, Number(durationSeconds) || 0) * 1000 * safeMultiplier;
  return clamp(base, safeMin, safeMax);
}

export function createDirectorFlow(definition = {}) {
  const phases = definition.phases || {};

  function getDirectorStep(phase) {
    return phases[phase] || null;
  }

  function getDirectorMessage(phase, context = {}) {
    const step = getDirectorStep(phase);
    if (!step) return "";
    return resolveValue(step.message, context, step) || "";
  }

  function getDirectorNextPhase(phase, context = {}) {
    const step = getDirectorStep(phase);
    if (!step) return null;
    return typeof step.next === "function" ? step.next(context, step) : step.next;
  }

  function getDirectorTimerMs(phase, context = {}) {
    const step = getDirectorStep(phase);
    if (!step) return null;
    return resolveValue(step.timerMs, context, step) ?? null;
  }

  function getDirectorMode(phase) {
    return getDirectorStep(phase)?.kind || null;
  }

  function shouldAdvanceOnAudioEnd(phase) {
    return getDirectorMode(phase) === "audio-advance";
  }

  function shouldHoldOnComplete(phase) {
    return getDirectorMode(phase) === "hold";
  }

  function getDirectorAudioSources(phase, context = {}) {
    const step = getDirectorStep(phase);
    if (!step) return [];
    return resolveSources(step, context);
  }

  function getDirectorAudioPlan(phase, context = {}) {
    const step = getDirectorStep(phase);
    if (!step) {
      return {
        phase,
        mode: null,
        advanceOnEnd: false,
        hold: false,
        nextPhase: null,
        timerMs: null,
        message: "",
        segments: []
      };
    }

    const sources = getDirectorAudioSources(phase, context);
    return {
      phase,
      mode: step.kind || null,
      advanceOnEnd: shouldAdvanceOnAudioEnd(phase),
      hold: shouldHoldOnComplete(phase),
      nextPhase: getDirectorNextPhase(phase, context),
      timerMs: getDirectorTimerMs(phase, context),
      message: getDirectorMessage(phase, context),
      segmentPauseMs: resolveValue(step.segmentPauseMs, context, step) ?? null,
      segmentPauseMultiplier: resolveValue(step.segmentPauseMultiplier, context, step) ?? null,
      segmentPauseMinMs: resolveValue(step.segmentPauseMinMs, context, step) ?? null,
      segmentPauseMaxMs: resolveValue(step.segmentPauseMaxMs, context, step) ?? null,
      segments: sources.map(src => ({ src }))
    };
  }

  return {
    getDirectorStep,
    getDirectorMessage,
    getDirectorNextPhase,
    getDirectorTimerMs,
    getDirectorMode,
    shouldAdvanceOnAudioEnd,
    shouldHoldOnComplete,
    getDirectorAudioSources,
    getDirectorAudioPlan
  };
}

export { pickVariant, stableHash };
