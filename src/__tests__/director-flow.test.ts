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
      "game-setup": { kind: "hold", message: "Choose questions", next: "preferences" },
      "preferences": { kind: "timer", next: null },
      "question-read": { kind: "audio-advance", next: ctx => `next-${ctx.suffix}` },
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
    expect(flow.shouldAdvanceOnAudioEnd("question-read")).toBe(true)
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
  it("getDirectorNextPhase returns static string next", () => {
    expect(flow.getDirectorNextPhase("game-setup")).toBe("preferences")
  })
  it("getDirectorNextPhase returns null when next is null", () => {
    expect(flow.getDirectorNextPhase("preferences")).toBeNull()
  })
  it("getDirectorNextPhase calls function next with context", () => {
    expect(flow.getDirectorNextPhase("question-read", { suffix: "foo" })).toBe("next-foo")
  })
  it("getDirectorNextPhase returns null for unknown phase", () => {
    expect(flow.getDirectorNextPhase("unknown")).toBeNull()
  })
})
