export type DirectorKind = "hold" | "timer" | "audio-advance" | "timer-and-audio"

export type DirectorContext = Record<string, unknown>

export interface DirectorStep {
  kind?: DirectorKind
  message?: string | ((ctx: DirectorContext, step: DirectorStep) => string)
  timerMs?: number | ((ctx: DirectorContext, step: DirectorStep) => number)
  next?: string | null | ((ctx: DirectorContext, step: DirectorStep) => string | null)
  audio?: unknown | ((ctx: DirectorContext, step: DirectorStep) => unknown)
  fallbackAudio?: unknown | ((ctx: DirectorContext, step: DirectorStep) => unknown)
  source?: string
  segmentPauseMs?: number | ((ctx: DirectorContext, step: DirectorStep) => number)
  segmentPauseMultiplier?: number | ((ctx: DirectorContext, step: DirectorStep) => number)
  segmentPauseMinMs?: number | ((ctx: DirectorContext, step: DirectorStep) => number)
  segmentPauseMaxMs?: number | ((ctx: DirectorContext, step: DirectorStep) => number)
}

export interface DirectorAudioSegment {
  src: string
}

export interface DirectorAudioPlan {
  phase: string
  mode: DirectorKind | null
  advanceOnEnd: boolean
  notifyOnEnd: boolean
  hold: boolean
  nextPhase: string | null
  timerMs: number | null
  message: string
  segmentPauseMs: number | null
  segmentPauseMultiplier: number | null
  segmentPauseMinMs: number | null
  segmentPauseMaxMs: number | null
  segments: DirectorAudioSegment[]
  cueId: string
  replayKey: string
  eventId: string | null
  policy: string
  interruptible: boolean
  maxLateStartMs: number
  duckMusic: boolean
}

export interface DirectorFlow {
  getDirectorStep: (phase: string) => DirectorStep | null
  getDirectorMessage: (phase: string, context?: DirectorContext) => string
  getDirectorNextPhase: (phase: string, context?: DirectorContext) => string | null
  getDirectorTimerMs: (phase: string, context?: DirectorContext) => number | null
  getDirectorMode: (phase: string) => DirectorKind | null
  shouldAdvanceOnAudioEnd: (phase: string) => boolean
  shouldNotifyOnAudioEnd: (phase: string) => boolean
  shouldHoldOnComplete: (phase: string) => boolean
  getDirectorAudioSources: (phase: string, context?: DirectorContext) => string[]
  getDirectorAudioPlan: (phase: string, context?: DirectorContext) => DirectorAudioPlan
}

export interface DirectorSnapshot {
  phase: string
  questionId: string
  playCount: number
  questionIndex: number
  questionAudio: string
  lastResolution: { correctAnswerId: string; fact: string; rewards: Record<string, number> } | null
  answersCount: number
  expectedAnswerCount: number
  remainingMs: number
  scoreVisibility: string
  scoreboardVisible: boolean
  finalHype: { current: { text: string } | null } | null
}

export interface NormalizedCue {
  id: string
  replayKey: string
  eventId: string | null
  message: string
  segments: DirectorAudioSegment[]
  policy: string
  interruptible: boolean
  maxLateStartMs: number
  duckMusic: boolean
}

export interface ReactiveDirectorRuntime {
  previousSnapshot: DirectorSnapshot | null
  nextSnapshot: DirectorSnapshot | null
  context: DirectorContext
  phase: string
  phaseChanged: boolean
  seedBase: string
}

export interface DirectorRule {
  id?: string
  when?: (runtime: ReactiveDirectorRuntime) => boolean
  select?:
    | ((runtime: ReactiveDirectorRuntime) => Partial<NormalizedCue> & { audio?: unknown } | null)
    | (Partial<NormalizedCue> & { audio?: unknown })
    | null
  cue?: (Partial<NormalizedCue> & { audio?: unknown }) | null
}

export interface ReactiveDirector {
  getReactiveAudioPlan: (
    previousSnapshot: DirectorSnapshot | null,
    nextSnapshot: DirectorSnapshot | null,
    context?: DirectorContext
  ) => DirectorAudioPlan
}
