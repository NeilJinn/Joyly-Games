import { stableHash } from "./flow.js";

function flattenSegments(value, output = []) {
  if (value == null || value === false) return output;
  if (typeof value === "string") {
    output.push({ src: value });
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenSegments(item, output);
    return output;
  }
  if (typeof value === "object" && typeof value.src === "string") {
    output.push({
      ...value,
      src: value.src
    });
  }
  return output;
}

function resolveValue(value, context) {
  return typeof value === "function" ? value(context) : value;
}

function pickOne(list = [], seed = "") {
  if (!Array.isArray(list) || !list.length) return null;
  if (list.length === 1) return list[0];
  const index = stableHash(seed) % list.length;
  return list[index];
}

function normalizeCue(cue, runtime) {
  if (!cue) return null;
  const context = {
    ...runtime,
    cue
  };
  const resolved = resolveValue(cue, context);
  if (!resolved) return null;

  const id = String(resolveValue(resolved.id, context) || resolved.cueId || "cue");
  const replayKey = String(resolveValue(resolved.replayKey, context) || id);
  const message = resolveValue(resolved.message, context);

  return {
    id,
    replayKey,
    eventId: resolved.eventId || runtime.eventId || null,
    message: typeof message === "string" ? message : "",
    segments: flattenSegments(resolveValue(resolved.audio, context)),
    policy: resolveValue(resolved.policy, context) || "replace",
    interruptible: resolved.interruptible !== false,
    maxLateStartMs: Number(resolveValue(resolved.maxLateStartMs, context) || 0) || 0,
    duckMusic: resolved.duckMusic !== false
  };
}

export function createReactiveDirector(definition = {}) {
  const flow = definition.flow;
  const rules = Array.isArray(definition.rules) ? definition.rules : [];

  if (!flow || typeof flow.getDirectorAudioPlan !== "function") {
    throw new Error("createReactiveDirector requires a flow with getDirectorAudioPlan().");
  }

  function matchRule(rule, runtime) {
    if (!rule || typeof rule !== "object") return null;
    if (typeof rule.when === "function" && !rule.when(runtime)) return null;

    const selected = typeof rule.select === "function"
      ? rule.select(runtime)
      : (rule.cue || rule.select || null);

    if (Array.isArray(selected)) {
      const chosen = pickOne(
        selected.filter(Boolean),
        `${runtime.seedBase}:${rule.id || "rule"}`
      );
      return normalizeCue(chosen, {
        ...runtime,
        eventId: rule.id || null
      });
    }

    return normalizeCue(selected, {
      ...runtime,
      eventId: rule.id || null
    });
  }

  function getReactiveAudioPlan(previousSnapshot, nextSnapshot, context = {}) {
    const phase = String(nextSnapshot?.phase || context.phase || "");
    const base = flow.getDirectorAudioPlan(phase, context);
    const runtime = {
      previousSnapshot: previousSnapshot || null,
      nextSnapshot: nextSnapshot || null,
      context,
      phase,
      phaseChanged: previousSnapshot?.phase !== phase,
      seedBase: [
        context.roomCode || "",
        context.playCount || 1,
        phase,
        context.questionIndex || 0,
        nextSnapshot?.questionId || ""
      ].join(":")
    };

    let matchedCue = null;
    for (const rule of rules) {
      matchedCue = matchRule(rule, runtime);
      if (matchedCue) break;
    }

    const fallbackReplayKey = `${phase}:${base.segments.map(segment => segment.src).join("|")}:${context.playCount || 1}:${nextSnapshot?.questionId || ""}`;
    return {
      ...base,
      cueId: matchedCue?.id || `phase:${phase}:default`,
      replayKey: matchedCue?.replayKey || fallbackReplayKey,
      eventId: matchedCue?.eventId || null,
      message: matchedCue?.message || base.message,
      segments: matchedCue?.segments?.length ? matchedCue.segments : base.segments,
      policy: matchedCue?.policy || "replace",
      interruptible: matchedCue?.interruptible !== false,
      maxLateStartMs: matchedCue?.maxLateStartMs || 0,
      duckMusic: matchedCue?.duckMusic !== false
    };
  }

  return {
    getReactiveAudioPlan
  };
}
