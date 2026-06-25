import type { DirectorStep, DirectorContext, DirectorAudioPlan, DirectorFlow, DirectorKind } from "./types"

export function stableHash(text: string): number {
  let hash = 0
  const s = String(text || "")
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function flattenSources(value: unknown, output: string[] = []): string[] {
  if (value == null || value === false) return output
  if (typeof value === "string") { output.push(value); return output }
  if (Array.isArray(value)) {
    for (const item of value) flattenSources(item, output)
    return output
  }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    if (typeof v.src === "string") output.push(v.src)
  }
  return output
}

function resolveValue<T>(
  value: T | ((ctx: DirectorContext, step: DirectorStep) => T) | undefined,
  context: DirectorContext,
  step: DirectorStep
): T | undefined {
  return typeof value === "function"
    ? (value as (ctx: DirectorContext, step: DirectorStep) => T)(context, step)
    : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function pickVariant<T>(list: T[], seed: string): T[] {
  if (!Array.isArray(list) || !list.length) return []
  if (list.length === 1) return [list[0]]
  return [list[stableHash(seed) % list.length]]
}

function resolveSources(step: DirectorStep, context: DirectorContext): string[] {
  const explicitSource = step.source ? context[step.source] : null
  if (explicitSource) return flattenSources(explicitSource)
  const audio = resolveValue(step.audio, context, step)
  const sources = flattenSources(audio)
  if (sources.length) return sources
  const fallback = resolveValue(step.fallbackAudio, context, step)
  return flattenSources(fallback)
}

export function getDirectorSegmentPauseMs(
  step: Partial<DirectorStep>,
  durationSeconds: number,
  context: DirectorContext
): number {
  const explicit = resolveValue(step.segmentPauseMs, context, step as DirectorStep)
  if (Number.isFinite(Number(explicit))) return Math.max(0, Number(explicit))
  const multiplier = Number(resolveValue(step.segmentPauseMultiplier, context, step as DirectorStep))
  const minMs = Number(resolveValue(step.segmentPauseMinMs, context, step as DirectorStep))
  const maxMs = Number(resolveValue(step.segmentPauseMaxMs, context, step as DirectorStep))
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 0.12
  const safeMin = Number.isFinite(minMs) ? minMs : 180
  const safeMax = Number.isFinite(maxMs) ? maxMs : 1200
  const base = Math.max(0, Number(durationSeconds) || 0) * 1000 * safeMultiplier
  return clamp(base, safeMin, safeMax)
}

export function createDirectorFlow(definition: { phases: Record<string, DirectorStep> }): DirectorFlow {
  const phases = definition.phases || {}

  const getDirectorStep = (phase: string): DirectorStep | null => phases[phase] || null

  const getDirectorMessage = (phase: string, context: DirectorContext = {}): string => {
    const step = getDirectorStep(phase)
    if (!step) return ""
    return String(resolveValue(step.message, context, step) || "")
  }

  const getDirectorNextPhase = (phase: string, context: DirectorContext = {}): string | null => {
    const step = getDirectorStep(phase)
    if (!step) return null
    const val = typeof step.next === "function" ? step.next(context, step) : step.next
    return val ?? null
  }

  const getDirectorTimerMs = (phase: string, context: DirectorContext = {}): number | null => {
    const step = getDirectorStep(phase)
    if (!step) return null
    const val = resolveValue(step.timerMs, context, step)
    return val ?? null
  }

  const getDirectorMode = (phase: string): DirectorKind | null =>
    getDirectorStep(phase)?.kind || null

  const shouldAdvanceOnAudioEnd = (phase: string) => getDirectorMode(phase) === "audio-advance"

  const shouldNotifyOnAudioEnd = (phase: string) =>
    ["audio-advance", "timer-and-audio"].includes(getDirectorMode(phase) ?? "")

  const shouldHoldOnComplete = (phase: string) => getDirectorMode(phase) === "hold"

  const getDirectorAudioSources = (phase: string, context: DirectorContext = {}): string[] => {
    const step = getDirectorStep(phase)
    return step ? resolveSources(step, context) : []
  }

  function buildEmptyPlan(phase: string): DirectorAudioPlan {
    return {
      phase, mode: null, advanceOnEnd: false, notifyOnEnd: false, hold: false,
      nextPhase: null, timerMs: null, message: "", segmentPauseMs: null,
      segmentPauseMultiplier: null, segmentPauseMinMs: null, segmentPauseMaxMs: null,
      segments: [], cueId: `phase:${phase}:default`, replayKey: phase,
      eventId: null, policy: "replace", interruptible: true, maxLateStartMs: 0, duckMusic: true,
    }
  }

  const getDirectorAudioPlan = (phase: string, context: DirectorContext = {}): DirectorAudioPlan => {
    const step = getDirectorStep(phase)
    if (!step) return buildEmptyPlan(phase)
    const sources = getDirectorAudioSources(phase, context)
    return {
      phase,
      mode: step.kind || null,
      advanceOnEnd: shouldAdvanceOnAudioEnd(phase),
      notifyOnEnd: shouldNotifyOnAudioEnd(phase),
      hold: shouldHoldOnComplete(phase),
      nextPhase: getDirectorNextPhase(phase, context),
      timerMs: getDirectorTimerMs(phase, context),
      message: getDirectorMessage(phase, context),
      segmentPauseMs: resolveValue(step.segmentPauseMs, context, step) ?? null,
      segmentPauseMultiplier: resolveValue(step.segmentPauseMultiplier, context, step) ?? null,
      segmentPauseMinMs: resolveValue(step.segmentPauseMinMs, context, step) ?? null,
      segmentPauseMaxMs: resolveValue(step.segmentPauseMaxMs, context, step) ?? null,
      segments: sources.map(src => ({ src })),
      cueId: `phase:${phase}:default`,
      replayKey: phase,
      eventId: null,
      policy: "replace",
      interruptible: true,
      maxLateStartMs: 0,
      duckMusic: true,
    }
  }

  return {
    getDirectorStep, getDirectorMessage, getDirectorNextPhase, getDirectorTimerMs,
    getDirectorMode, shouldAdvanceOnAudioEnd, shouldNotifyOnAudioEnd, shouldHoldOnComplete,
    getDirectorAudioSources, getDirectorAudioPlan,
  }
}
