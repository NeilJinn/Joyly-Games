import { pickVariant } from "./flow"
// @ts-ignore — generated data file without TypeScript annotations
import { CUE_VARIANTS, DIRECTOR_CUES, DIRECTOR_CUE_REGISTRY } from "./cosmic-trivia-cue-library.generated"

export interface CueDefinition {
  cueKey: string
  scope: string
  domain: string
  eventPath: string[]
  purpose: string
  policy: Record<string, unknown>
  trigger: {
    mode: string
    phase: string
    eventKey: string
    priority: number
    enabled: boolean
  }
  variants: { id: string; path: string; text: string; placeholder: boolean }[]
}

const cueVariants = CUE_VARIANTS as Record<string, string[]>
const directorCues = DIRECTOR_CUES as CueDefinition[]
export const CUE_FALLBACK_ORDER: string[] =
  (DIRECTOR_CUE_REGISTRY as { defaults?: { fallbackOrder?: string[] } }).defaults?.fallbackOrder || []

const CUES_BY_KEY = new Map<string, CueDefinition>(
  directorCues.map(cue => [cue.cueKey, cue])
)

function canonicalCueKey(cueKey: string): string {
  return cueKey
}

function domainDefaultKey(cueKey: string): string | null {
  const cue = CUES_BY_KEY.get(canonicalCueKey(cueKey))
  const scope = cue?.scope || String(cueKey).split(".")[0]
  const domain = cue?.domain || String(cueKey).split(".")[1]
  if (scope === "phase") {
    if (domain === "answering") return "phase.answering.answer.open"
    if (domain === "reveal") return "phase.reveal.answer.positive"
    if (domain === "scoring") return "phase.scoring.score.update"
    if (domain === "between-questions") return "phase.between-questions.transition.next"
  }
  if (scope === "global") return "global.game.default"
  return null
}

function fallbackKeys(cueKey: string): string[] {
  const canonical = canonicalCueKey(cueKey)
  const cue = CUES_BY_KEY.get(canonical)
  const policyFallbacks = Array.isArray(cue?.policy?.fallback)
    ? (cue.policy.fallback as string[]).map(canonicalCueKey)
    : []
  return [canonical, ...policyFallbacks, domainDefaultKey(canonical), "global.game.default"].filter(
    (k): k is string => k !== null
  )
}

export function getCue(cueKey: string): CueDefinition | null {
  return CUES_BY_KEY.get(canonicalCueKey(cueKey)) || null
}

export function getCueVariants(cueKey: string): string[] {
  for (const key of fallbackKeys(cueKey)) {
    const variants = cueVariants[canonicalCueKey(key)] || []
    if (variants.length) return variants
  }
  return []
}

export function pickCueVariant(cueKey: string, seed: string): string[] {
  return pickVariant(getCueVariants(cueKey), seed)
}

export function hasCueVariants(cueKey: string): boolean {
  return getCueVariants(cueKey).length > 0
}

export function getTriggeredCues({
  triggerMode = "",
  phase = "",
  eventKey = "",
  scope = "",
  domain = "",
}: {
  triggerMode?: string
  phase?: string
  eventKey?: string
  scope?: string
  domain?: string
} = {}): CueDefinition[] {
  return directorCues
    .filter(cue => {
      const trigger = cue.trigger || {}
      if (trigger.enabled === false) return false
      if (triggerMode && trigger.mode !== triggerMode) return false
      if (phase && trigger.phase && trigger.phase !== phase) return false
      if (eventKey && trigger.eventKey && trigger.eventKey !== eventKey) return false
      if (scope && cue.scope !== scope) return false
      if (domain && cue.domain !== domain) return false
      return true
    })
    .sort((a, b) => {
      const pa = Number(a.trigger?.priority ?? 100)
      const pb = Number(b.trigger?.priority ?? 100)
      return pa - pb || a.cueKey.localeCompare(b.cueKey)
    })
}

export function getPhaseEntryCues(phase: string): CueDefinition[] {
  return getTriggeredCues({ triggerMode: "phase-entry", phase, scope: "phase", domain: phase })
}
