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
