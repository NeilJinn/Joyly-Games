# Phase 7 — Voice/Director System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Cosmic Trivia audio director system from vanilla JS to React — phase-driven voice cues, background music with ducking, and audio-advance server notifications.

**Architecture:** The vanilla JS `presentation.js` + `director-flow.js` + `shared/director/` stack is ported into:
1. Pure TypeScript modules in `src/lib/director/` (types, flow engine, cue resolution)
2. A `useCosmicTriviaDirector` React hook that watches `room.gameState` phase transitions, plays audio segments sequentially, manages background music (with duck/unduck), and POSTs audio-status notifications back to the server for `audio-advance` phases
3. The hook is wired into `BigScreenPage` with a single call — no JSX changes

**Tech Stack:** React 18, TypeScript, Vite 5, Web Audio API (`new Audio()`), Vitest.

**Key source files to reference (DO NOT modify these — read only):**
- `public/shared/director/flow.js` — core director engine (port to `src/lib/director/flow.ts`)
- `public/shared/director/cues.js` — reactive director (port to `src/lib/director/cues.ts`)
- `public/shared/director/cosmic-trivia-phases.js` — phase definitions (port to TypeScript)
- `public/games/cosmic-trivia/director/cue-library.generated.js` — audio file registry (copy to `src/lib/director/`)
- `public/games/cosmic-trivia/director/cue-library.js` — cue lookup functions (port to TypeScript)
- `public/games/cosmic-trivia/audio/director-flow.js` — reactive director wiring + rules (port to TypeScript)
- `public/games/cosmic-trivia/presentation.js` — audio playback engine (port key functions to hook)

**API endpoints used:**
- `GET /api/games/cosmic-trivia/music-library` → `{ sources: string[] }` — background music playlist
- `POST /api/rooms/:code/trivia/director/audio-status` body `{ phase, snapshot, status }` — notify server when audio ends (required for `audio-advance` phases to advance)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/director/types.ts` | Create | All TypeScript interfaces for the director system |
| `src/lib/director/flow.ts` | Create | Core director engine: `createDirectorFlow`, `stableHash`, `pickVariant`, `getDirectorSegmentPauseMs` |
| `src/lib/director/cues.ts` | Create | Reactive director: `createReactiveDirector` |
| `src/lib/director/cosmic-trivia-phases.ts` | Create | Phase timing/message/kind definitions |
| `src/lib/director/cosmic-trivia-cue-library.generated.ts` | Copy from public/ | Audio file registry — 999-line generated data file |
| `src/lib/director/cosmic-trivia-cue-library.ts` | Create | Cue lookup: `pickCueVariant`, `getPhaseEntryCues`, `getTriggeredCues` |
| `src/lib/director/cosmic-trivia-director.ts` | Create | Reactive director wiring with all Cosmic Trivia rules |
| `src/hooks/useCosmicTriviaDirector.ts` | Create | React hook: phase watch, audio playback, music management, server notify |
| `src/types/cosmic-trivia.ts` | Modify | Add `questionAudio?: string` to `CosmicQuestion` |
| `src/pages/games/cosmic-trivia/BigScreenPage.tsx` | Modify | Call `useCosmicTriviaDirector(room, code)` |
| `src/__tests__/director-flow.test.ts` | Create | Unit tests for flow engine and cue lookup |

---

## Task 1: Types + Flow Engine

**Files:**
- Create: `src/lib/director/types.ts`
- Create: `src/lib/director/flow.ts`
- Create: `src/__tests__/director-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/director-flow.test.ts
import { describe, it, expect } from "vitest"
import { stableHash, pickVariant, getDirectorSegmentPauseMs, createDirectorFlow } from "../lib/director/flow"

describe("stableHash", () => {
  it("returns a non-negative integer", () => {
    expect(stableHash("hello")).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(stableHash("hello"))).toBe(true)
  })
  it("is deterministic", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"))
  })
  it("differs for different inputs", () => {
    expect(stableHash("a")).not.toBe(stableHash("b"))
  })
})

describe("pickVariant", () => {
  it("returns empty array for empty list", () => {
    expect(pickVariant([], "seed")).toEqual([])
  })
  it("returns single-element array for single-item list", () => {
    expect(pickVariant(["only"], "seed")).toEqual(["only"])
  })
  it("returns one element from a multi-item list", () => {
    const result = pickVariant(["a", "b", "c"], "seed")
    expect(result).toHaveLength(1)
    expect(["a", "b", "c"]).toContain(result[0])
  })
  it("is deterministic for same seed", () => {
    const list = ["a", "b", "c"]
    expect(pickVariant(list, "myseed")).toEqual(pickVariant(list, "myseed"))
  })
})

describe("getDirectorSegmentPauseMs", () => {
  it("returns explicit value when set", () => {
    expect(getDirectorSegmentPauseMs({ segmentPauseMs: 500 }, 10, {})).toBe(500)
  })
  it("clamps computed value between min and max", () => {
    const result = getDirectorSegmentPauseMs({ segmentPauseMultiplier: 0.12, segmentPauseMinMs: 200, segmentPauseMaxMs: 600 }, 3, {})
    expect(result).toBeGreaterThanOrEqual(200)
    expect(result).toBeLessThanOrEqual(600)
  })
  it("uses default multiplier 0.12 and clamps to [180, 1200]", () => {
    const result = getDirectorSegmentPauseMs({}, 0, {})
    expect(result).toBe(180)
  })
})

describe("createDirectorFlow", () => {
  const flow = createDirectorFlow({
    phases: {
      "game-setup": { kind: "hold", message: "Choose questions" },
      "answering": {
        kind: "timer-and-audio",
        timerMs: 25_000,
        message: ctx => `Q${Number(ctx.questionIndex || 0) + 1}`,
        audio: ["/audio/answer.mp3"],
      },
    },
  })

  it("getDirectorMode returns phase kind", () => {
    expect(flow.getDirectorMode("game-setup")).toBe("hold")
    expect(flow.getDirectorMode("answering")).toBe("timer-and-audio")
    expect(flow.getDirectorMode("unknown")).toBeNull()
  })
  it("getDirectorMessage resolves function messages", () => {
    expect(flow.getDirectorMessage("answering", { questionIndex: 2 })).toBe("Q3")
  })
  it("getDirectorMessage returns empty string for unknown phase", () => {
    expect(flow.getDirectorMessage("unknown")).toBe("")
  })
  it("shouldAdvanceOnAudioEnd is true only for audio-advance kind", () => {
    expect(flow.shouldAdvanceOnAudioEnd("game-setup")).toBe(false)
    expect(flow.shouldAdvanceOnAudioEnd("answering")).toBe(false)
  })
  it("shouldNotifyOnAudioEnd is true for audio-advance and timer-and-audio", () => {
    expect(flow.shouldNotifyOnAudioEnd("answering")).toBe(true)
    expect(flow.shouldNotifyOnAudioEnd("game-setup")).toBe(false)
  })
  it("getDirectorAudioPlan includes segments", () => {
    const plan = flow.getDirectorAudioPlan("answering", {})
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].src).toBe("/audio/answer.mp3")
  })
  it("getDirectorAudioPlan returns empty segments for unknown phase", () => {
    const plan = flow.getDirectorAudioPlan("unknown", {})
    expect(plan.segments).toHaveLength(0)
    expect(plan.mode).toBeNull()
  })
  it("getDirectorTimerMs resolves number values", () => {
    expect(flow.getDirectorTimerMs("answering")).toBe(25_000)
    expect(flow.getDirectorTimerMs("game-setup")).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:ui -- --reporter=verbose 2>&1 | head -40
```

Expected: FAIL — `../lib/director/flow` not found.

- [ ] **Step 3: Create `src/lib/director/types.ts`**

```ts
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
```

- [ ] **Step 4: Create `src/lib/director/flow.ts`**

```ts
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
  const base = Math.max(0, durationSeconds) * 1000 * safeMultiplier
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
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:ui -- --reporter=verbose 2>&1 | head -60
```

Expected: All `director-flow.test.ts` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/director/types.ts src/lib/director/flow.ts src/__tests__/director-flow.test.ts
git commit -m "feat(director): add TypeScript director flow engine and types"
```

---

## Task 2: Cue Library + Phase Definitions

**Files:**
- Copy: `public/games/cosmic-trivia/director/cue-library.generated.js` → `src/lib/director/cosmic-trivia-cue-library.generated.ts`
- Create: `src/lib/director/cosmic-trivia-cue-library.ts`
- Create: `src/lib/director/cosmic-trivia-phases.ts`
- Create: `src/__tests__/director-cue-library.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/director-cue-library.test.ts
import { describe, it, expect } from "vitest"
import { pickCueVariant, getCueVariants, getPhaseEntryCues, getTriggeredCues } from "../lib/director/cosmic-trivia-cue-library"
import { COSMIC_TRIVIA_PHASES } from "../lib/director/cosmic-trivia-phases"

describe("COSMIC_TRIVIA_PHASES", () => {
  it("defines all 13 game phases", () => {
    const expected = [
      "game-setup", "preferences", "round-prep", "question-intro", "question-read",
      "answering", "answer-lock", "reveal", "scoring", "between-questions",
      "final-hype", "finale", "post-game",
    ]
    for (const phase of expected) {
      expect(COSMIC_TRIVIA_PHASES[phase]).toBeDefined()
    }
  })
  it("audio-advance phases have correct kind", () => {
    const audioAdvance = ["round-prep", "question-intro", "question-read", "between-questions", "finale"]
    for (const phase of audioAdvance) {
      expect(COSMIC_TRIVIA_PHASES[phase].kind).toBe("audio-advance")
    }
  })
  it("hold phases have correct kind", () => {
    expect(COSMIC_TRIVIA_PHASES["game-setup"].kind).toBe("hold")
    expect(COSMIC_TRIVIA_PHASES["post-game"].kind).toBe("hold")
  })
  it("timer-and-audio phases include timerMs", () => {
    expect(COSMIC_TRIVIA_PHASES["answering"].timerMs).toBe(25_000)
    expect(COSMIC_TRIVIA_PHASES["reveal"].timerMs).toBe(2_200)
  })
})

describe("pickCueVariant", () => {
  it("returns an array", () => {
    expect(Array.isArray(pickCueVariant("phase.question-intro.question.next", "seed"))).toBe(true)
  })
  it("returns empty array for unknown cue key", () => {
    expect(pickCueVariant("nonexistent.cue.key", "seed")).toEqual([])
  })
  it("returns consistent result for same seed", () => {
    const a = pickCueVariant("phase.question-intro.question.next", "same-seed")
    const b = pickCueVariant("phase.question-intro.question.next", "same-seed")
    expect(a).toEqual(b)
  })
})

describe("getCueVariants", () => {
  it("returns array for known cue key", () => {
    expect(Array.isArray(getCueVariants("phase.question-intro.question.next"))).toBe(true)
  })
  it("returns empty for cue with no audio files", () => {
    expect(getCueVariants("phase.scoring.score.update")).toEqual([])
  })
})

describe("getPhaseEntryCues", () => {
  it("returns cues array for a known phase", () => {
    const cues = getPhaseEntryCues("answering")
    expect(Array.isArray(cues)).toBe(true)
  })
})

describe("getTriggeredCues", () => {
  it("filters by triggerMode", () => {
    const manual = getTriggeredCues({ triggerMode: "manual" })
    const phaseEntry = getTriggeredCues({ triggerMode: "phase-entry" })
    expect(manual.length + phaseEntry.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:ui -- --reporter=verbose 2>&1 | head -40
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Copy the generated cue library file**

```bash
cp public/games/cosmic-trivia/director/cue-library.generated.js src/lib/director/cosmic-trivia-cue-library.generated.ts
```

No edits needed — the file is valid TypeScript (pure ESM data exports).

- [ ] **Step 4: Create `src/lib/director/cosmic-trivia-phases.ts`**

Port of `public/shared/director/cosmic-trivia-phases.js`. The vanilla JS `message` and `timerMs` fields use function values and are typed using `DirectorStep`.

```ts
import type { DirectorStep, DirectorContext } from "./types"

function currentSummaryText(context: DirectorContext): string {
  const hype = context.finalHype as { current?: { text?: string } } | null
  return hype?.current?.text || "Results coming up."
}

export const COSMIC_TRIVIA_PHASES: Record<string, DirectorStep> = {
  "game-setup": { kind: "hold", message: "Choose how many questions to play" },
  preferences: { kind: "timer", timerMs: 35_000, message: "Choose your categories and keywords" },
  "round-prep": { kind: "audio-advance", message: "Loading the round" },
  "question-intro": {
    kind: "audio-advance",
    message: ctx =>
      ctx.isFinalQuestion
        ? "Final question coming up"
        : `Question ${Number(ctx.questionIndex || 0) + 1} is coming up`,
  },
  "question-read": { kind: "audio-advance", message: "" },
  answering: {
    kind: "timer-and-audio",
    timerMs: 25_000,
    message: ctx =>
      Number(ctx.questionIndex || 0) === 0
        ? "What do you think? Please answer on your phone"
        : ctx.isFinalQuestion
        ? "Final answers. Lock it in now"
        : "Answer before time runs out",
  },
  "answer-lock": { kind: "timer", timerMs: 1_200, message: "Answers locked" },
  reveal: {
    kind: "timer-and-audio",
    timerMs: 2_200,
    message: ctx => {
      const res = ctx.lastResolution as { rewardCount?: number; everyoneCorrect?: boolean } | null
      const winners = Number(res?.rewardCount || 0)
      if (winners === 0) return "No one got it right"
      if (winners === 1) return "Only one player got that one"
      if (res?.everyoneCorrect) return "Everyone got it right"
      return "Here is the answer"
    },
  },
  scoring: {
    kind: "timer-and-audio",
    timerMs: 2_400,
    message: ctx =>
      ctx.scoreVisibility === "hidden"
        ? "Scores are changing behind the scenes"
        : "Scores are moving",
  },
  "between-questions": {
    kind: "audio-advance",
    message: ctx => ctx.isFinalQuestion ? "Final question coming up" : "Next question coming up",
  },
  "final-hype": { kind: "timer-and-audio", timerMs: 2_600, message: ctx => currentSummaryText(ctx) },
  finale: { kind: "audio-advance", message: "Final results are coming up" },
  "post-game": { kind: "hold", message: "Final scores" },
}

export const COSMIC_TRIVIA_AUDIO_ADVANCE_FALLBACK_MS: Record<string, number> = {
  "round-prep": 3_500,
  "question-intro": 3_500,
  "question-read": 12_000,
  "between-questions": 3_200,
  finale: 4_500,
}
```

- [ ] **Step 5: Create `src/lib/director/cosmic-trivia-cue-library.ts`**

Port of `public/games/cosmic-trivia/director/cue-library.js`.

```ts
import { pickVariant, stableHash } from "./flow"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated data file, no TypeScript annotations
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
export const CUE_FALLBACK_ORDER: string[] = (DIRECTOR_CUE_REGISTRY as { defaults?: { fallbackOrder?: string[] } }).defaults?.fallbackOrder || []

const CUES_BY_KEY = new Map<string, CueDefinition>(directorCues.map(cue => [cue.cueKey, cue]))

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
  return [canonical, ...policyFallbacks, domainDefaultKey(canonical), "global.game.default"].filter(Boolean) as string[]
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

export { stableHash }
```

- [ ] **Step 6: Run tests**

```bash
npm run test:ui -- --reporter=verbose 2>&1 | head -60
```

Expected: All `director-cue-library.test.ts` tests PASS. (Some cue keys may return empty arrays — that is correct and expected when audio files haven't been generated yet.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/director/cosmic-trivia-cue-library.generated.ts src/lib/director/cosmic-trivia-cue-library.ts src/lib/director/cosmic-trivia-phases.ts src/__tests__/director-cue-library.test.ts
git commit -m "feat(director): add cue library and Cosmic Trivia phase definitions"
```

---

## Task 3: Reactive Cues + Cosmic Trivia Director

**Files:**
- Create: `src/lib/director/cues.ts`
- Create: `src/lib/director/cosmic-trivia-director.ts`

No separate tests for these — they are tested indirectly via the hook integration test in Task 4.

- [ ] **Step 1: Create `src/lib/director/cues.ts`**

Port of `public/shared/director/cues.js`.

```ts
import { stableHash, pickVariant } from "./flow"
import type {
  DirectorFlow, DirectorAudioPlan, DirectorContext, DirectorRule,
  NormalizedCue, ReactiveDirectorRuntime, ReactiveDirector, DirectorSnapshot,
} from "./types"

function flattenSegments(value: unknown, output: { src: string }[] = []): { src: string }[] {
  if (value == null || value === false) return output
  if (typeof value === "string") { output.push({ src: value }); return output }
  if (Array.isArray(value)) {
    for (const item of value) flattenSegments(item, output)
    return output
  }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    if (typeof v.src === "string") output.push({ src: v.src, ...v as object } as { src: string })
  }
  return output
}

function resolveValue<T>(value: T | ((ctx: ReactiveDirectorRuntime) => T), runtime: ReactiveDirectorRuntime): T {
  return typeof value === "function" ? (value as (r: ReactiveDirectorRuntime) => T)(runtime) : value
}

function pickOne<T>(list: T[], seed: string): T | null {
  if (!Array.isArray(list) || !list.length) return null
  if (list.length === 1) return list[0]
  return list[stableHash(seed) % list.length]
}

function normalizeCue(
  cue: Partial<NormalizedCue> & { audio?: unknown; id?: string } | null,
  runtime: ReactiveDirectorRuntime
): NormalizedCue | null {
  if (!cue) return null
  const resolved = typeof cue === "function" ? (cue as (r: ReactiveDirectorRuntime) => typeof cue)(runtime) : cue
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
```

- [ ] **Step 2: Create `src/lib/director/cosmic-trivia-director.ts`**

Port of `public/games/cosmic-trivia/audio/director-flow.js`. This wires together the flow, phases, cue library, and reactive rules.

```ts
import { createDirectorFlow } from "./flow"
import { createReactiveDirector } from "./cues"
import { COSMIC_TRIVIA_PHASES } from "./cosmic-trivia-phases"
import { pickCueVariant, getPhaseEntryCues, getTriggeredCues } from "./cosmic-trivia-cue-library"
import type { DirectorContext, DirectorAudioPlan, DirectorSnapshot, ReactiveDirectorRuntime } from "./types"

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
  const next = runtime.nextSnapshot || {}
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
    isFinalQuestion: Boolean(ctx.isFinalQuestion ?? next.isFinalQuestion),
  }
}

function allAnsweredEarly(prev: DirectorSnapshot | null, next: DirectorSnapshot | null): boolean {
  if (!prev || !next) return false
  if (prev.phase !== "answering" || next.phase !== "answering") return false
  if (!next.questionId || prev.questionId !== next.questionId) return false
  return prev.answersCount < next.expectedAnswerCount &&
    next.expectedAnswerCount > 0 &&
    next.answersCount >= next.expectedAnswerCount &&
    next.remainingMs > 0
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
      id: "phase:preferences",
      when: r => r.phaseChanged && r.phase === "preferences",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "preferences.intro", replayKey: `preferences.intro:${cueSeed(ctx, "preferences.intro")}`, audio: cueAudio("phase.preferences.selection.intro", cueSeed(ctx, "preferences.intro")) }
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
        return { id: "question.intro", replayKey: `question.intro:${cueSeed(ctx, "question.intro")}`, audio: cueAudio("phase.question-intro.question.next", cueSeed(ctx, "question.intro")) }
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
      id: "phase:reveal:no-correct",
      when: r => r.phaseChanged && r.phase === "reveal" && Number((phaseContext(r).rewardCount as number) || 0) <= 0,
      select: r => {
        const ctx = phaseContext(r)
        return { id: "reveal.no-correct", replayKey: `reveal.no-correct:${cueSeed(ctx, "reveal-no-correct")}`, audio: cueAudio("phase.reveal.answer.no-one-correct", cueSeed(ctx, "reveal-no-correct")) }
      },
    },
    {
      id: "phase:reveal:positive",
      when: r => r.phaseChanged && r.phase === "reveal" && Number((phaseContext(r).rewardCount as number) || 0) > 0,
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
      when: r => r.phaseChanged && r.phase === "final-hype",
      select: r => {
        const ctx = phaseContext(r)
        return { id: "final-hype.summary-line", replayKey: `final-hype.summary-line:${cueSeed(ctx, "final-hype")}`, audio: [], duckMusic: false }
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
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 4: Commit**

```bash
git add src/lib/director/cues.ts src/lib/director/cosmic-trivia-director.ts
git commit -m "feat(director): add reactive cue director and Cosmic Trivia director rules"
```

---

## Task 4: `useCosmicTriviaDirector` Hook

**Files:**
- Modify: `src/types/cosmic-trivia.ts` (add `questionAudio?: string`)
- Create: `src/hooks/useCosmicTriviaDirector.ts`

- [ ] **Step 1: Add `questionAudio` to `CosmicQuestion`**

In `src/types/cosmic-trivia.ts`, modify the `CosmicQuestion` interface to add the optional server-sent field:

```ts
export interface CosmicQuestion {
  id: string;
  question: string;
  answers: CosmicAnswer[];
  correctAnswer: string | null;
  fact: string;
  category: string;
  questionAudio?: string;  // ← add this line
}
```

- [ ] **Step 2: Create `src/hooks/useCosmicTriviaDirector.ts`**

This hook:
- Tracks previous snapshot via `useRef` to detect phase transitions
- Calls `getReactiveAudioPlan` on every room change
- Plays audio segments sequentially, ducking background music
- POSTs `audio-status: "playing"` heartbeat every 1s while playing (for `audio-advance` phases)
- POSTs `audio-status: "ended"` on audio completion (required for `audio-advance` to advance server phase)
- Manages background music lifecycle (start on mount, stop on unmount)

```ts
import { useEffect, useRef } from "react"
import type { Room } from "../types/room"
import type { CosmicTriviaState } from "../types/cosmic-trivia"
import { getReactiveAudioPlan } from "../lib/director/cosmic-trivia-director"
import { getDirectorSegmentPauseMs } from "../lib/director/flow"
import type { DirectorAudioPlan, DirectorSnapshot, DirectorContext } from "../lib/director/types"

const BACKGROUND_MUSIC_FALLBACK = "/games/cosmic-trivia/audio/music/bgm-trivia-time-chill-01.mp3"
const BACKGROUND_MUSIC_LIBRARY = "/api/games/cosmic-trivia/music-library"
const MUSIC_VOLUME = 0.45
const DUCKED_VOLUME = 0.15
const FADE_MS = 180
const HEARTBEAT_MS = 1_000

// ── Internal types ──────────────────────────────────────────────────────────

interface AudioController {
  audio: HTMLAudioElement | null
  stopped: boolean
  heartbeatId: ReturnType<typeof setInterval> | null
  phase: string
  key: string
}

interface MusicController {
  audio: HTMLAudioElement
  stopped: boolean
  fadeToken: number
  currentSrc: string
  playlist: string[]
}

interface HookRefs {
  previousSnapshot: DirectorSnapshot | null
  audioCueKey: string
  audioController: AudioController | null
  musicController: MusicController | null
  musicSourcesPromise: Promise<string[]> | null
  musicSources: string[] | null
}

// ── Utilities ────────────────────────────────────────────────────────────────

function audioPlanPlaybackKey(plan: DirectorAudioPlan, snapshot: DirectorSnapshot): string {
  if (plan.replayKey) return plan.replayKey
  return `${plan.phase}:${plan.segments.map(s => s.src).join("|")}:${snapshot.playCount}:${snapshot.questionId}`
}

function buildSnapshot(trivia: CosmicTriviaState): DirectorSnapshot {
  return {
    phase: trivia.phase,
    questionId: trivia.currentQuestion?.id || "",
    playCount: 1,
    questionIndex: trivia.questionIndex,
    questionAudio: trivia.currentQuestion?.questionAudio || "",
    lastResolution: trivia.lastResolution,
    answersCount: trivia.answeredPlayerIds.length,
    expectedAnswerCount: trivia.expectedAnswerCount,
    remainingMs: trivia.phaseEndsAt ? Math.max(0, trivia.phaseEndsAt - Date.now()) : 0,
    scoreVisibility: trivia.scoreVisibility,
    scoreboardVisible: trivia.scoreboardVisible,
    finalHype: trivia.finalHype,
  }
}

function buildContext(snapshot: DirectorSnapshot, code: string): DirectorContext {
  const res = snapshot.lastResolution
  const rewardCount = res?.rewards
    ? Object.values(res.rewards).filter(v => v > 0).length
    : 0
  return {
    roomCode: code,
    playCount: snapshot.playCount,
    questionIndex: snapshot.questionIndex,
    questionId: snapshot.questionId,
    questionAudio: snapshot.questionAudio,
    lastResolution: snapshot.lastResolution
      ? { ...snapshot.lastResolution, rewardCount }
      : null,
    rewardCount,
    scoreVisibility: snapshot.scoreVisibility,
    finalHype: snapshot.finalHype,
    isFinalQuestion: false, // derived from trivia.isFinalQuestion in caller
  }
}

// ── Audio status notification ────────────────────────────────────────────────

async function notifyAudioStatus(
  code: string,
  phase: string,
  snapshot: DirectorSnapshot,
  status: "queued" | "playing" | "ended" | "blocked"
): Promise<void> {
  try {
    await fetch(`/api/rooms/${code}/trivia/director/audio-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase, snapshot, status }),
    })
  } catch {
    // Network errors must never block gameplay.
  }
}

// ── Audio playback ───────────────────────────────────────────────────────────

function clearHeartbeat(controller: AudioController) {
  if (controller.heartbeatId != null) {
    clearInterval(controller.heartbeatId)
    controller.heartbeatId = null
  }
}

function stopAudio(refs: HookRefs) {
  const controller = refs.audioController
  if (!controller) return
  controller.stopped = true
  clearHeartbeat(controller)
  if (controller.audio) {
    controller.audio.pause()
    controller.audio.src = ""
  }
  refs.audioController = null
}

function playAudioSequence(
  refs: HookRefs,
  plan: DirectorAudioPlan,
  snapshot: DirectorSnapshot,
  code: string
) {
  if (!plan.segments.length) {
    if (plan.notifyOnEnd || plan.advanceOnEnd) {
      void notifyAudioStatus(code, plan.phase, snapshot, "ended")
    }
    return
  }

  stopAudio(refs)

  const playbackKey = audioPlanPlaybackKey(plan, snapshot)
  const controller: AudioController = {
    phase: plan.phase,
    key: playbackKey,
    stopped: false,
    heartbeatId: null,
    audio: null,
  }
  refs.audioController = controller
  refs.audioCueKey = playbackKey

  if (plan.duckMusic !== false) duckMusic(refs)
  void notifyAudioStatus(code, plan.phase, snapshot, "queued")

  if (plan.notifyOnEnd || plan.advanceOnEnd) {
    controller.heartbeatId = setInterval(() => {
      if (controller.stopped || refs.audioController !== controller) {
        clearHeartbeat(controller)
        return
      }
      void notifyAudioStatus(code, plan.phase, snapshot, "playing")
    }, HEARTBEAT_MS)
  }

  const playIndex = (index: number) => {
    if (controller.stopped || refs.audioController !== controller) return
    const segment = plan.segments[index]
    if (!segment?.src) {
      if (index >= plan.segments.length - 1) {
        if (plan.duckMusic !== false) unduckMusic(refs)
        clearHeartbeat(controller)
        refs.audioController = null
        if (plan.notifyOnEnd || plan.advanceOnEnd) {
          void notifyAudioStatus(code, plan.phase, snapshot, "ended")
        }
      }
      return
    }

    const audio = new Audio(segment.src)
    audio.preload = "auto"
    audio.volume = 1
    controller.audio = audio

    audio.addEventListener("playing", () => {
      if (controller.stopped || refs.audioController !== controller) return
      void notifyAudioStatus(code, plan.phase, snapshot, "playing")
    }, { once: true })

    const onSegmentEnd = () => {
      if (controller.stopped || refs.audioController !== controller) return
      void waitForMetadata(audio).then(() => {
        const pauseMs = getDirectorSegmentPauseMs(plan, Number(audio.duration || 0), {
          roomCode: code,
          playCount: snapshot.playCount,
          questionIndex: snapshot.questionIndex,
          questionId: snapshot.questionId,
        })
        if (index < plan.segments.length - 1) {
          setTimeout(() => playIndex(index + 1), pauseMs)
          return
        }
        if (plan.duckMusic !== false) unduckMusic(refs)
        setTimeout(() => {
          if (controller.stopped || refs.audioController !== controller) return
          clearHeartbeat(controller)
          refs.audioController = null
          if (plan.notifyOnEnd || plan.advanceOnEnd) {
            void notifyAudioStatus(code, plan.phase, snapshot, "ended")
          }
        }, pauseMs)
      })
    }

    const onError = () => {
      if (controller.stopped || refs.audioController !== controller) return
      clearHeartbeat(controller)
      if (plan.duckMusic !== false) unduckMusic(refs)
      refs.audioController = null
      void notifyAudioStatus(code, plan.phase, snapshot, "blocked")
    }

    audio.addEventListener("ended", onSegmentEnd, { once: true })
    audio.addEventListener("error", onError, { once: true })

    const playResult = audio.play()
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(onError)
    }
  }

  playIndex(0)
}

function waitForMetadata(audio: HTMLAudioElement): Promise<void> {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => resolve()
    audio.addEventListener("loadedmetadata", done, { once: true })
    audio.addEventListener("error", done, { once: true })
    setTimeout(resolve, 1200)
  })
}

// ── Background music ─────────────────────────────────────────────────────────

async function loadMusicSources(refs: HookRefs): Promise<string[]> {
  if (refs.musicSources?.length) return refs.musicSources
  if (!refs.musicSourcesPromise) {
    refs.musicSourcesPromise = fetch(BACKGROUND_MUSIC_LIBRARY)
      .then(r => r.ok ? r.json() : null)
      .then((data: { sources?: string[] } | null) => {
        const sources = Array.isArray(data?.sources)
          ? [...new Set(data!.sources.map(s => String(s).trim()).filter(Boolean))]
          : []
        refs.musicSources = sources.length ? sources : [BACKGROUND_MUSIC_FALLBACK]
        return refs.musicSources
      })
      .catch(() => {
        refs.musicSources = [BACKGROUND_MUSIC_FALLBACK]
        return refs.musicSources
      })
  }
  return refs.musicSourcesPromise
}

function pickNextMusicSrc(previousSrc: string, sources: string[]): string {
  if (!sources.length) return BACKGROUND_MUSIC_FALLBACK
  if (sources.length === 1) return sources[0]
  const available = sources.filter(s => s !== previousSrc)
  return available[Math.floor(Math.random() * available.length)] || sources[0]
}

function setMusicVolume(controller: MusicController, target: number, fadeMs = FADE_MS) {
  const clamped = Math.max(0, Math.min(1, target))
  const audio = controller.audio
  if (!audio.src) { audio.volume = clamped; return }
  const token = ++controller.fadeToken
  const from = Number.isFinite(audio.volume) ? audio.volume : clamped
  const start = performance.now()
  const tick = () => {
    if (controller.fadeToken !== token || controller.stopped) return
    const progress = Math.min(1, (performance.now() - start) / fadeMs)
    audio.volume = from + (clamped - from) * progress
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function duckMusic(refs: HookRefs) {
  if (refs.musicController) setMusicVolume(refs.musicController, DUCKED_VOLUME)
}

function unduckMusic(refs: HookRefs) {
  if (refs.musicController) setMusicVolume(refs.musicController, MUSIC_VOLUME)
}

function ensureBackgroundMusic(refs: HookRefs) {
  if (refs.musicController) return
  const audio = new Audio()
  audio.loop = false
  audio.preload = "auto"
  audio.volume = MUSIC_VOLUME
  const controller: MusicController = {
    audio, stopped: false, fadeToken: 0, currentSrc: "", playlist: [],
  }
  refs.musicController = controller

  const advance = async () => {
    if (controller.stopped) return
    const sources = await loadMusicSources(refs)
    const next = pickNextMusicSrc(controller.currentSrc, sources)
    controller.currentSrc = next
    audio.src = next
    audio.currentTime = 0
    const p = audio.play()
    if (p?.catch) p.catch(() => {})
  }

  audio.addEventListener("ended", () => { void advance() })
  audio.addEventListener("error", () => { setTimeout(() => { void advance() }, 3000) })
  void advance()
}

function stopMusic(refs: HookRefs) {
  const controller = refs.musicController
  if (!controller) return
  controller.stopped = true
  controller.fadeToken++
  controller.audio.pause()
  controller.audio.src = ""
  refs.musicController = null
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCosmicTriviaDirector(room: Room | null, code: string) {
  const refs = useRef<HookRefs>({
    previousSnapshot: null,
    audioCueKey: "",
    audioController: null,
    musicController: null,
    musicSourcesPromise: null,
    musicSources: null,
  })

  useEffect(() => {
    if (!room || !code) return
    const trivia = room.gameState as CosmicTriviaState | null
    if (!trivia?.phase) return

    const r = refs.current
    ensureBackgroundMusic(r)

    const nextSnapshot = buildSnapshot(trivia)
    const previousSnapshot = r.previousSnapshot

    const context: DirectorContext = {
      ...buildContext(nextSnapshot, code),
      isFinalQuestion: trivia.isFinalQuestion,
    }

    const plan = getReactiveAudioPlan(previousSnapshot, nextSnapshot, context)
    const nextKey = audioPlanPlaybackKey(plan, nextSnapshot)

    if (previousSnapshot?.phase === nextSnapshot.phase && r.audioCueKey === nextKey) {
      r.previousSnapshot = nextSnapshot
      return
    }

    stopAudio(r)

    if (plan.segments.length || plan.notifyOnEnd || plan.advanceOnEnd) {
      playAudioSequence(r, plan, nextSnapshot, code)
    } else {
      unduckMusic(r)
    }

    r.previousSnapshot = nextSnapshot
  }, [room, code])

  useEffect(() => {
    return () => {
      const r = refs.current
      stopAudio(r)
      stopMusic(r)
    }
  }, [])
}
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add src/types/cosmic-trivia.ts src/hooks/useCosmicTriviaDirector.ts
git commit -m "feat(director): add useCosmicTriviaDirector hook with audio playback and background music"
```

---

## Task 5: Wire into BigScreenPage + Build Verification

**Files:**
- Modify: `src/pages/games/cosmic-trivia/BigScreenPage.tsx`

- [ ] **Step 1: Add the hook call to BigScreenPage**

In `src/pages/games/cosmic-trivia/BigScreenPage.tsx`, add one import and one hook call. No JSX changes.

Add the import at line 8 (after existing imports):

```ts
import { useCosmicTriviaDirector } from "../../../hooks/useCosmicTriviaDirector"
```

Inside `CosmicTriviaHost`, after the existing `const [restartingGame, setRestartingGame] = useState(false)` line, add:

```ts
useCosmicTriviaDirector(room, code)
```

The full modified top of the component looks like this:

```tsx
export default function CosmicTriviaHost({ room, code }: CosmicTriviaHostProps) {
  const trivia = room.gameState as CosmicTriviaState | null
  const [settingUp, setSettingUp] = useState(false)
  const [restartingGame, setRestartingGame] = useState(false)
  useCosmicTriviaDirector(room, code)   // ← add this line

  if (!trivia) { ... }
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npm run test:ui -- --reporter=verbose 2>&1
```

Expected: All tests pass (director-flow, director-cue-library, avatar, AvatarStack).

- [ ] **Step 4: Production build**

```bash
npm run build 2>&1
```

Expected: Clean build with no TypeScript or Vite errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/games/cosmic-trivia/BigScreenPage.tsx
git commit -m "feat(trivia): wire useCosmicTriviaDirector into host big screen"
```

---

## Verification Checklist

After all tasks complete, verify manually (or note for manual verification):

- [ ] Navigate to a room's Lobby page — background music starts playing
- [ ] Phase `question-intro` → a voice cue plays (if audio files exist for `phase.question-intro.question.next`)
- [ ] Phase `question-read` → `currentQuestion.questionAudio` plays as the question narration
- [ ] Phase `reveal` → correct-answer voice cue plays based on whether anyone got it right
- [ ] Phase `answering` → background music ducks while director cue plays, then recovers
- [ ] Navigation away from lobby → music stops, audio stops (cleanup)
- [ ] Browser console has no uncaught promise rejections from the audio system

Audio cues that have no MP3 files yet (variants array is `[]`) will simply play nothing — this is correct and expected. The server still receives `audio-status: "ended"` notifications even when no audio plays.
