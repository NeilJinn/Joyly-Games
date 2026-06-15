import { stableHash } from "./flow"
import type {
  DirectorFlow,
  DirectorAudioPlan,
  DirectorContext,
  DirectorRule,
  NormalizedCue,
  ReactiveDirectorRuntime,
  ReactiveDirector,
  DirectorSnapshot,
} from "./types"

function flattenSegments(value: unknown, output: { src: string }[] = []): { src: string }[] {
  if (value == null || value === false) return output
  if (typeof value === "string") {
    output.push({ src: value })
    return output
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenSegments(item, output)
    return output
  }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    if (typeof v.src === "string") output.push({ src: v.src, ...(v as object) })
  }
  return output
}

function pickOne<T>(list: T[], seed: string): T | null {
  if (!Array.isArray(list) || !list.length) return null
  if (list.length === 1) return list[0]
  return list[stableHash(seed) % list.length]
}

function normalizeCue(
  cue: (Partial<NormalizedCue> & { audio?: unknown; id?: string }) | ((runtime: ReactiveDirectorRuntime) => Partial<NormalizedCue> & { audio?: unknown } | null) | null,
  runtime: ReactiveDirectorRuntime
): NormalizedCue | null {
  if (!cue) return null
  const resolved = typeof cue === "function" ? cue(runtime) : cue
  if (!resolved) return null

  const id = String(resolved.id || "cue")
  const replayKey = String(resolved.replayKey || id)
  const message = typeof resolved.message === "string" ? resolved.message : ""

  return {
    id,
    replayKey,
    eventId: (resolved as { eventId?: string | null }).eventId || null,
    message,
    segments: flattenSegments(resolved.audio),
    policy: resolved.policy || "replace",
    interruptible: resolved.interruptible !== false,
    maxLateStartMs: Number((resolved as { maxLateStartMs?: number }).maxLateStartMs || 0) || 0,
    duckMusic: (resolved as { duckMusic?: boolean }).duckMusic !== false,
  }
}

function matchRule(rule: DirectorRule, runtime: ReactiveDirectorRuntime): NormalizedCue | null {
  if (!rule || typeof rule !== "object") return null
  if (typeof rule.when === "function" && !rule.when(runtime)) return null

  const selected = typeof rule.select === "function"
    ? rule.select(runtime)
    : (rule.cue || rule.select || null)

  if (Array.isArray(selected)) {
    const chosen = pickOne(
      (selected as (Partial<NormalizedCue> & { audio?: unknown })[]).filter(Boolean),
      `${runtime.seedBase}:${rule.id || "rule"}`
    )
    return normalizeCue(chosen, { ...runtime, eventId: rule.id || null } as ReactiveDirectorRuntime & { eventId?: string | null })
  }

  return normalizeCue(
    selected as Partial<NormalizedCue> & { audio?: unknown } | null,
    { ...runtime, eventId: rule.id || null } as ReactiveDirectorRuntime & { eventId?: string | null }
  )
}

export function createReactiveDirector(definition: {
  flow: DirectorFlow
  rules: DirectorRule[]
}): ReactiveDirector {
  const { flow, rules } = definition

  function getReactiveAudioPlan(
    previousSnapshot: DirectorSnapshot | null,
    nextSnapshot: DirectorSnapshot | null,
    context: DirectorContext = {}
  ): DirectorAudioPlan {
    const phase = String(nextSnapshot?.phase || context.phase || "")
    const base = flow.getDirectorAudioPlan(phase, context)
    const runtime: ReactiveDirectorRuntime = {
      previousSnapshot,
      nextSnapshot,
      context,
      phase,
      phaseChanged: previousSnapshot?.phase !== phase,
      seedBase: [
        context.roomCode || "",
        context.playCount || 1,
        phase,
        context.questionIndex || 0,
        nextSnapshot?.questionId || "",
      ].join(":"),
    }

    let matchedCue: NormalizedCue | null = null
    for (const rule of rules) {
      matchedCue = matchRule(rule, runtime)
      if (matchedCue) break
    }

    const fallbackReplayKey = `${phase}:${base.segments.map(s => s.src).join("|")}:${context.playCount || 1}:${nextSnapshot?.questionId || ""}`
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
      duckMusic: matchedCue?.duckMusic !== false,
    }
  }

  return { getReactiveAudioPlan }
}
