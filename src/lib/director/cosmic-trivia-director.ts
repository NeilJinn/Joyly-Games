import { createDirectorFlow } from "./flow"
import { createReactiveDirector } from "./cues"
import { COSMIC_TRIVIA_PHASES } from "./cosmic-trivia-phases"
import { pickCueVariant, getPhaseEntryCues, getTriggeredCues } from "./cosmic-trivia-cue-library"
import type { DirectorContext, DirectorSnapshot, ReactiveDirectorRuntime } from "./types"

function cueAudio(cueKey: string, seed = ""): string[] {
  return pickCueVariant(cueKey, seed)
}

function firstPlayableCue(cues: { cueKey: string }[], seed = ""): string[] {
  for (const cue of cues) {
    const audio = cueAudio(cue.cueKey, `${seed}:${cue.cueKey}`)
    if (audio.length) return audio
  }
  return []
}

function phaseEntryAudio(phase: string, context: DirectorContext): string[] {
  return firstPlayableCue(getPhaseEntryCues(phase), cueSeed(context, `auto:${phase}`))
}

function eventAudio({ phase = "", eventKey = "" }: { phase?: string; eventKey?: string }, context: DirectorContext): string[] {
  return firstPlayableCue(
    getTriggeredCues({ triggerMode: "event-match", phase, eventKey }),
    cueSeed(context, eventKey)
  )
}

function withPhaseEntryFallback(phase: string, audioSelector?: (ctx: DirectorContext) => string[]): (ctx: DirectorContext) => string[] {
  return (context: DirectorContext) => {
    const configured = audioSelector ? audioSelector(context) : []
    return configured.length ? configured : phaseEntryAudio(phase, context)
  }
}

function cueSeed(context: DirectorContext, cueId: string): string {
  const hype = context.finalHype as { index?: number } | null
  return [
    context.roomCode || "",
    context.playCount || 1,
    cueId,
    context.questionIndex || 0,
    context.questionId || "",
    context.rewardCount || 0,
    hype?.index || 0,
  ].join(":")
}

const PHASE_AUDIO: Record<string, { audio?: (ctx: DirectorContext) => string[]; segmentPauseMultiplier?: number; segmentPauseMaxMs?: number }> = {
  preferences: {
    audio: ctx => cueAudio("phase.preferences.selection.intro", cueSeed(ctx, "preferences.intro")),
  },
  "round-prep": {
    audio: ctx => cueAudio("phase.round-prep.round.loading", cueSeed(ctx, "round-prep")),
  },
  "question-intro": {
    audio: ctx => cueAudio(
      "phase.question-intro.question.next",
      `${ctx.roomCode || ""}:phase.question-intro.question.next:${ctx.questionIndex || 0}:${ctx.playCount || 1}`
    ),
    segmentPauseMultiplier: 0.12,
  },
  "question-read": {
    audio: ctx => (ctx.questionAudio as string) ? [ctx.questionAudio as string] : [],
  },
  "answer-lock": {
    audio: ctx => cueAudio("phase.answer-lock.answer.locked", cueSeed(ctx, "answer-lock")),
  },
  "between-questions": {
    audio: ctx => cueAudio(
      "phase.between-questions.transition.next",
      `${ctx.roomCode || ""}:phase.between-questions.transition.next:${ctx.questionIndex || 0}:${ctx.playCount || 1}`
    ),
    segmentPauseMultiplier: 0.12,
  },
  finale: {
    audio: ctx => cueAudio("phase.finale.result.incoming", cueSeed(ctx, "finale")),
    segmentPauseMultiplier: 0.2,
    segmentPauseMaxMs: 1800,
  },
  "post-game": {
    audio: ctx => cueAudio("phase.post-game.result.outro", cueSeed(ctx, "post-game")),
  },
}

const mergedPhases = Object.fromEntries(
  Object.entries(COSMIC_TRIVIA_PHASES).map(([phase, base]) => {
    const configured = PHASE_AUDIO[phase] || {}
    return [
      phase,
      {
        ...base,
        ...configured,
        audio: withPhaseEntryFallback(phase, configured.audio),
      },
    ]
  })
)

const cosmicTriviaFlow = createDirectorFlow({ phases: mergedPhases })

function phaseContext(runtime: ReactiveDirectorRuntime): DirectorContext {
  const ctx = runtime.context || {}
  const next: Partial<DirectorSnapshot> = runtime.nextSnapshot || {}
  const res = (next.lastResolution || ctx.lastResolution) as { rewards?: Record<string, number> } | null
  const rewardCount = res?.rewards
    ? Object.values(res.rewards).filter(v => v > 0).length
    : 0
  return {
    ...ctx,
    roomCode: ctx.roomCode || "",
    playCount: Number(ctx.playCount || next.playCount || 1),
    questionIndex: Number((ctx.questionIndex as number) ?? (next.questionIndex as number) ?? 0),
    questionId: String(next.questionId || ""),
    questionAudio: ctx.questionAudio || next.questionAudio || "",
    rewardCount,
    lastResolution: next.lastResolution || ctx.lastResolution || null,
    scoreVisibility: ctx.scoreVisibility || next.scoreVisibility || "visible",
    finalHype: ctx.finalHype || next.finalHype || null,
    isFinalQuestion: Boolean(ctx.isFinalQuestion),
  }
}

function allAnsweredEarly(prev: DirectorSnapshot | null, next: DirectorSnapshot | null): boolean {
  if (!prev || !next) return false
  if (prev.phase !== "answering" || next.phase !== "answering") return false
  if (!next.questionId || prev.questionId !== next.questionId) return false
  if (prev.expectedAnswerCount !== next.expectedAnswerCount) return false
  return prev.answersCount < next.expectedAnswerCount &&
    next.expectedAnswerCount > 0 &&
    next.answersCount >= next.expectedAnswerCount &&
    next.remainingMs > 0
}

function allPreferencesLocked(prev: DirectorSnapshot | null, next: DirectorSnapshot | null): boolean {
  if (!prev || !next) return false
  if (prev.phase !== "preferences" || next.phase !== "preferences") return false
  if (!next.expectedPreferenceCount || next.expectedPreferenceCount <= 0) return false
  return prev.preferenceCount < next.expectedPreferenceCount &&
    next.preferenceCount >= next.expectedPreferenceCount
}

function questionCountChanged(prev: DirectorSnapshot | null, next: DirectorSnapshot | null): boolean {
  if (!prev || !next) return false
  if (prev.phase !== "game-setup" || next.phase !== "game-setup") return false
  return prev.questionCount !== next.questionCount
}

function finalHypeSummaryChanged(prev: DirectorSnapshot | null, next: DirectorSnapshot | null): boolean {
  if (!next || next.phase !== "final-hype") return false
  const nextText = (next.finalHype?.current as { text?: string } | null)?.text
  if (!nextText) return false
  if (!prev || prev.phase !== "final-hype") return true
  const prevText = (prev.finalHype?.current as { text?: string } | null)?.text
  return prevText !== nextText
}

function answeringTimeCrossed(prev: DirectorSnapshot | null, next: DirectorSnapshot | null, thresholdMs: number): boolean {
  if (!prev || !next) return false
  if (prev.phase !== "answering" || next.phase !== "answering") return false
  if (!next.questionId || prev.questionId !== next.questionId) return false
  return prev.remainingMs > thresholdMs && next.remainingMs <= thresholdMs && next.remainingMs > 0
}

const reactiveDirector = createReactiveDirector({
  flow: cosmicTriviaFlow,
  rules: [
    {
      id: "phase:game-setup",
      when: r => r.phaseChanged && r.phase === "game-setup",
      select: r => {
        const ctx = phaseContext(r)
        const audio = phaseEntryAudio("game-setup", ctx)
        if (!audio.length) return null
        return { id: "game-setup.question-count.selection", replayKey: `game-setup.question-count.selection:${cueSeed(ctx, "game-setup")}`, audio }
      },
    },
    {
      id: "phase:game-setup:count-changed",
      when: r => questionCountChanged(r.previousSnapshot, r.nextSnapshot),
      select: r => {
        const ctx = phaseContext(r)
        const audio = eventAudio({ phase: "game-setup", eventKey: "phase.game-setup.question-count.2nd-selection" }, ctx)
        if (!audio.length) return null
        return { id: "game-setup.count-changed", replayKey: `game-setup.count-changed:${cueSeed(ctx, "count-changed")}:${r.nextSnapshot?.questionCount ?? ""}`, audio, maxLateStartMs: 2_000 }
      },
    },
    {
      id: "phase:preferences",
      when: r => r.phaseChanged && r.phase === "preferences",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "preferences.intro", replayKey: `preferences.intro:${cueSeed(ctx, "preferences.intro")}`, audio: cueAudio("phase.preferences.selection.intro", cueSeed(ctx, "preferences.intro")) }
      },
    },
    {
      id: "phase:preferences:all-locked",
      when: r => allPreferencesLocked(r.previousSnapshot, r.nextSnapshot),
      select: r => {
        const ctx = phaseContext(r)
        return { id: "preferences.all-locked", replayKey: `preferences.all-locked:${cueSeed(ctx, "prefs-done")}`, audio: cueAudio("phase.preferences.selection.done", cueSeed(ctx, "prefs-done")), maxLateStartMs: 2_500 }
      },
    },
    {
      id: "phase:round-prep",
      when: r => r.phaseChanged && r.phase === "round-prep",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "phase.round-prep.round.loading", replayKey: "phase.round-prep.round.loading", audio: cueAudio("phase.round-prep.round.loading", cueSeed(ctx, "round-prep")) }
      },
    },
    {
      id: "phase:question-intro",
      when: r => r.phaseChanged && r.phase === "question-intro",
      select: r => {
        const ctx = phaseContext(r)
        const isFinal = Boolean(r.context.isFinalQuestion)
        const cueKey = isFinal ? "phase.question-intro.question.final" : "phase.question-intro.question.next"
        return { id: "question.intro", replayKey: `question.intro:${cueSeed(ctx, "question.intro")}`, audio: cueAudio(cueKey, cueSeed(ctx, "question.intro")) }
      },
    },
    {
      id: "phase:question-read",
      when: r => r.phaseChanged && r.phase === "question-read",
      select: r => {
        const ctx = phaseContext(r)
        const audio = ctx.questionAudio ? [ctx.questionAudio as string] : []
        return { id: "question.read", replayKey: `question.read:${cueSeed(ctx, "question.read")}`, audio }
      },
    },
    {
      id: "phase:answering:first-question",
      when: r => r.phaseChanged && r.phase === "answering" && Number(r.context.questionIndex || 0) === 0,
      select: r => {
        const ctx = phaseContext(r)
        return { id: "answering.prompt.first-question", replayKey: `answering.prompt.first-question:${cueSeed(ctx, "answering-first")}`, audio: cueAudio("phase.answering.answer.open", cueSeed(ctx, "answering-first")) }
      },
    },
    {
      id: "phase:answering:generic",
      when: r => r.phaseChanged && r.phase === "answering" && Number(r.context.questionIndex || 0) > 0,
      select: r => {
        const ctx = phaseContext(r)
        return { id: "answering.prompt.generic", replayKey: `answering.prompt.generic:${cueSeed(ctx, "answering-generic")}`, audio: cueAudio("phase.answering.answer.open", cueSeed(ctx, "answering-generic")) }
      },
    },
    {
      id: "phase:answering:answer:all-in",
      when: r => allAnsweredEarly(r.previousSnapshot, r.nextSnapshot),
      select: r => {
        const ctx = phaseContext(r)
        return { id: "answering.answer.all-in", replayKey: `answering.answer.all-in:${cueSeed(ctx, "answer-all-in")}`, audio: cueAudio("phase.answering.answer.all-in", cueSeed(ctx, "answer-all-in")), maxLateStartMs: 2_500 }
      },
    },
    {
      id: "phase:answering:time:critical",
      when: r => answeringTimeCrossed(r.previousSnapshot, r.nextSnapshot, 5_000),
      select: r => {
        const ctx = phaseContext(r)
        const audio = eventAudio({ phase: "answering", eventKey: "phase.answering.time.critical" }, ctx)
        if (!audio.length) return null
        return { id: "answering.time.critical", replayKey: `answering.time.critical:${cueSeed(ctx, "time-critical")}`, audio, maxLateStartMs: 1_200 }
      },
    },
    {
      id: "phase:answering:time:warning",
      when: r => answeringTimeCrossed(r.previousSnapshot, r.nextSnapshot, 10_000),
      select: r => {
        const ctx = phaseContext(r)
        const audio = eventAudio({ phase: "answering", eventKey: "phase.answering.time.warning" }, ctx)
        if (!audio.length) return null
        return { id: "answering.time.warning", replayKey: `answering.time.warning:${cueSeed(ctx, "time-warning")}`, audio, maxLateStartMs: 1_800 }
      },
    },
    {
      id: "phase:scoring",
      when: r => r.phaseChanged && r.phase === "scoring",
      select: r => {
        const ctx = phaseContext(r)
        const isHidden = ctx.scoreVisibility === "hidden"
        const cueKey = isHidden ? "phase.scoring.score.hidden-update" : "phase.scoring.score.update"
        return { id: "scoring.update", replayKey: `scoring.update:${cueSeed(ctx, "scoring")}`, audio: cueAudio(cueKey, cueSeed(ctx, "scoring")) }
      },
    },
    {
      id: "phase:reveal:no-one-correct",
      when: r => {
        if (!r.phaseChanged || r.phase !== "reveal") return false
        const res = r.nextSnapshot?.lastResolution as { noOneCorrect?: boolean; rewardCount?: number } | null
        return !!(res?.noOneCorrect || (res !== null && res !== undefined && (res.rewardCount ?? -1) === 0))
      },
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.no-one-correct", replayKey: `reveal.no-one-correct:${cueSeed(ctx, "reveal-no-correct")}`, audio: cueAudio("phase.reveal.answer.no-one-correct", cueSeed(ctx, "reveal-no-correct")) }
      },
    },
    {
      id: "phase:reveal:everyone-correct",
      when: r => {
        if (!r.phaseChanged || r.phase !== "reveal") return false
        const res = r.nextSnapshot?.lastResolution as { everyoneCorrect?: boolean } | null
        return !!res?.everyoneCorrect
      },
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.everyone-correct", replayKey: `reveal.everyone-correct:${cueSeed(ctx, "reveal-everyone")}`, audio: cueAudio("phase.reveal.answer.everyone-correct", cueSeed(ctx, "reveal-everyone")) }
      },
    },
    {
      id: "phase:reveal:only-one-correct",
      when: r => {
        if (!r.phaseChanged || r.phase !== "reveal") return false
        const res = r.nextSnapshot?.lastResolution as { rewardCount?: number; noOneCorrect?: boolean; everyoneCorrect?: boolean } | null
        if (!res || res.noOneCorrect || res.everyoneCorrect) return false
        return (res.rewardCount ?? -1) === 1
      },
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.only-one-correct", replayKey: `reveal.only-one-correct:${cueSeed(ctx, "reveal-one")}`, audio: cueAudio("phase.reveal.answer.only-one-correct", cueSeed(ctx, "reveal-one")) }
      },
    },
    {
      id: "phase:reveal:only-two-correct",
      when: r => {
        if (!r.phaseChanged || r.phase !== "reveal") return false
        const res = r.nextSnapshot?.lastResolution as { rewardCount?: number; noOneCorrect?: boolean; everyoneCorrect?: boolean } | null
        if (!res || res.noOneCorrect || res.everyoneCorrect) return false
        return (res.rewardCount ?? -1) === 2
      },
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.only-two-correct", replayKey: `reveal.only-two-correct:${cueSeed(ctx, "reveal-two")}`, audio: cueAudio("phase.reveal.answer.only-two-correct", cueSeed(ctx, "reveal-two")) }
      },
    },
    {
      id: "phase:reveal:positive",
      when: r => {
        if (!r.phaseChanged || r.phase !== "reveal") return false
        const res = r.nextSnapshot?.lastResolution as { rewardCount?: number; noOneCorrect?: boolean } | null
        return !!(res && !res.noOneCorrect && (res.rewardCount ?? 0) > 0)
      },
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.positive", replayKey: `reveal.positive:${cueSeed(ctx, "reveal-positive")}`, audio: cueAudio("phase.reveal.answer.positive", cueSeed(ctx, "reveal-positive")) }
      },
    },
    {
      id: "phase:between-questions",
      when: r => r.phaseChanged && r.phase === "between-questions",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "transition.next-question", replayKey: `transition.next-question:${cueSeed(ctx, "next-question")}`, audio: cueAudio("phase.between-questions.transition.next", cueSeed(ctx, "next-question")) }
      },
    },
    {
      id: "phase:final-hype",
      when: r => finalHypeSummaryChanged(r.previousSnapshot, r.nextSnapshot),
      select: r => {
        const ctx = phaseContext(r)
        const hype = ctx.finalHype as { current?: { kind?: string } | null } | null
        const kind = hype?.current?.kind || "round-energy"
        const cueKey = `phase.final-hype.summary.${kind}`
        const audio = cueAudio(cueKey, cueSeed(ctx, `final-hype.${kind}`))
        const safeAudio = audio.length ? audio : cueAudio("phase.final-hype.summary.round-energy", cueSeed(ctx, "final-hype.round-energy"))
        return { id: `final-hype.${kind}`, replayKey: `final-hype.${kind}:${cueSeed(ctx, `final-hype.${kind}`)}`, audio: safeAudio, duckMusic: false }
      },
    },
    {
      id: "phase:finale",
      when: r => r.phaseChanged && r.phase === "finale",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "finale.intro", replayKey: "finale.intro", audio: cueAudio("phase.finale.result.incoming", cueSeed(ctx, "finale")) }
      },
    },
    {
      id: "phase:post-game",
      when: r => r.phaseChanged && r.phase === "post-game",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "post-game.outro", replayKey: "post-game.outro", audio: cueAudio("phase.post-game.result.outro", cueSeed(ctx, "post-game")) }
      },
    },
  ],
})

export const getReactiveAudioPlan = reactiveDirector.getReactiveAudioPlan
export { cosmicTriviaFlow }
