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
  it("returns empty array for unknown cue key", () => {
    expect(getCueVariants("nonexistent.cue.key.xyz")).toEqual([])
  })
})

describe("getPhaseEntryCues", () => {
  it("returns cues array for a known phase", () => {
    const cues = getPhaseEntryCues("answering")
    expect(Array.isArray(cues)).toBe(true)
  })
})

describe("getTriggeredCues", () => {
  it("filters by triggerMode - every result matches the filter", () => {
    const manual = getTriggeredCues({ triggerMode: "manual" })
    const phaseEntry = getTriggeredCues({ triggerMode: "phase-entry" })
    expect(manual.every(c => c.trigger.mode === "manual")).toBe(true)
    expect(phaseEntry.every(c => c.trigger.mode === "phase-entry")).toBe(true)
    expect(manual.length + phaseEntry.length).toBeGreaterThan(0)
  })
})
