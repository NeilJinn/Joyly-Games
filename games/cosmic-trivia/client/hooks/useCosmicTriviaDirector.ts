import { useEffect, useRef, useState, useCallback } from "react"
import type { Room } from "../types/room"
import type { CosmicTriviaState } from "../types/cosmic-trivia"
import { getReactiveAudioPlan } from "../lib/director/cosmic-trivia-director"
import { getDirectorSegmentPauseMs, stableHash } from "../lib/director/flow"
import type { DirectorAudioPlan, DirectorSnapshot, DirectorContext } from "../lib/director/types"
import { useEmojiParticles } from "./useEmojiParticles"
import { getCueVariants } from "../lib/director/cosmic-trivia-cue-library"

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

interface HookRefs {
  previousSnapshot: DirectorSnapshot | null
  audioCueKey: string
  audioController: AudioController | null
}

// ── Utilities ────────────────────────────────────────────────────────────────

function audioPlanPlaybackKey(plan: DirectorAudioPlan, snapshot: DirectorSnapshot): string {
  if (plan.replayKey) return plan.replayKey
  return `${plan.phase}:${plan.segments.map(s => s.src).join("|")}:${snapshot.playCount}:${snapshot.questionId}`
}

function buildSnapshot(trivia: CosmicTriviaState): DirectorSnapshot {
  const scores = trivia.scores as Record<string, number> | undefined ?? {}
  const playerIds = Object.keys(scores)
  const rankedPlayerIds = playerIds.length > 0
    ? [...playerIds].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    : []
  return {
    phase: trivia.phase,
    questionId: trivia.currentQuestion?.id || "",
    playCount: 1,
    questionIndex: trivia.questionIndex,
    questionCount: trivia.questionCount,
    questionAudio: trivia.currentQuestion?.questionAudio || "",
    lastResolution: trivia.lastResolution as Record<string, unknown> | null,
    answersCount: trivia.answeredPlayerIds.length,
    expectedAnswerCount: trivia.expectedAnswerCount,
    preferenceCount: trivia.preferencePlayerIds.length,
    expectedPreferenceCount: trivia.expectedPreferenceCount,
    remainingMs: trivia.phaseEndsAt ? Math.max(0, trivia.phaseEndsAt - Date.now()) : 0,
    scoreVisibility: trivia.scoreVisibility,
    scoreboardVisible: trivia.scoreboardVisible,
    finalHype: trivia.finalHype,
    leaderId: rankedPlayerIds[0] ?? "",
    rankedPlayerIds,
    streakCorrect: trivia.scoreVisibility !== "hidden"
      ? Math.max(0, ...(trivia.lastResolution?.streakPlayers?.map((p: { streak: number }) => p.streak) ?? [0]))
      : 0,
    streakWrong: trivia.scoreVisibility !== "hidden"
      ? Math.max(0, ...(trivia.lastResolution?.wrongStreakPlayers?.map((p: { streak: number }) => p.streak) ?? [0]))
      : 0,
    topCategories: trivia.topCategories || [],
  }
}

function pickCueSrc(cueKey: string, seed: string): string | null {
  const variants = getCueVariants(cueKey)
  if (!variants.length) return null
  if (variants.length === 1) return variants[0]
  return variants[stableHash(seed) % variants.length]
}

function buildContext(snapshot: DirectorSnapshot, code: string): DirectorContext {
  const res = snapshot.lastResolution
  const rewardCount = typeof res?.rewardCount === "number"
    ? res.rewardCount as number
    : (res?.rewards
        ? Object.values(res.rewards as Record<string, number>).filter(v => v > 0).length
        : 0)
  return {
    roomCode: code,
    playCount: snapshot.playCount,
    questionIndex: snapshot.questionIndex,
    questionCount: snapshot.questionCount,
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
  status: "queued" | "playing" | "ended" | "blocked",
  playbackKey?: string
): Promise<void> {
  try {
    await fetch(`/api/rooms/${code}/trivia/director/audio-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase, snapshot, status, ...(playbackKey ? { playbackKey } : {}) }),
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

  if (plan.duckMusic !== false) duckMusic()
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
        if (plan.duckMusic !== false) unduckMusic()
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
        const pauseMs = getDirectorSegmentPauseMs({
          segmentPauseMs: plan.segmentPauseMs ?? undefined,
          segmentPauseMultiplier: plan.segmentPauseMultiplier ?? undefined,
          segmentPauseMinMs: plan.segmentPauseMinMs ?? undefined,
          segmentPauseMaxMs: plan.segmentPauseMaxMs ?? undefined,
        }, Number(audio.duration || 0), {
          roomCode: code,
          playCount: snapshot.playCount,
          questionIndex: snapshot.questionIndex,
          questionId: snapshot.questionId,
        })
        if (index < plan.segments.length - 1) {
          setTimeout(() => playIndex(index + 1), pauseMs)
          return
        }
        if (plan.duckMusic !== false) unduckMusic()
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
      if (plan.duckMusic !== false) unduckMusic()
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
//
// A single Audio element lives at module scope for the entire page session.
// This guarantees only one music track ever plays, regardless of how many
// times CosmicTriviaHost mounts/unmounts (AnimatePresence overlap, HMR, etc.).

const _musicAudio = new Audio()
_musicAudio.loop = false
_musicAudio.preload = "auto"
_musicAudio.volume = MUSIC_VOLUME

let _musicStopped = true        // true  = audio should be silent
let _musicCurrentSrc = ""
let _musicFadeToken = 0
let _musicSourcesPromise: Promise<string[]> | null = null
let _musicSources: string[] | null = null

async function loadMusicSources(): Promise<string[]> {
  if (_musicSources?.length) return _musicSources
  if (!_musicSourcesPromise) {
    _musicSourcesPromise = fetch(BACKGROUND_MUSIC_LIBRARY)
      .then(r => r.ok ? r.json() : null)
      .then((data: { sources?: string[] } | null) => {
        const sources = Array.isArray(data?.sources)
          ? [...new Set(data!.sources.map(s => String(s).trim()).filter(Boolean))]
          : []
        _musicSources = sources.length ? sources : [BACKGROUND_MUSIC_FALLBACK]
        return _musicSources
      })
      .catch(() => {
        _musicSources = [BACKGROUND_MUSIC_FALLBACK]
        return _musicSources
      })
  }
  return _musicSourcesPromise
}

function pickNextMusicSrc(previousSrc: string, sources: string[]): string {
  if (!sources.length) return BACKGROUND_MUSIC_FALLBACK
  if (sources.length === 1) return sources[0]
  const available = sources.filter(s => s !== previousSrc)
  return available[Math.floor(Math.random() * available.length)] || sources[0]
}

async function musicAdvance() {
  if (_musicStopped) return
  const sources = await loadMusicSources()
  if (_musicStopped) return
  const next = pickNextMusicSrc(_musicCurrentSrc, sources)
  _musicCurrentSrc = next
  _musicAudio.src = next
  _musicAudio.currentTime = 0
  const p = _musicAudio.play()
  if (p?.catch) {
    p.catch(() => {
      // Autoplay blocked — resume on first user interaction
      const resume = () => {
        if (_musicStopped) return
        void _musicAudio.play().catch(() => {})
      }
      document.addEventListener("click", resume, { once: true })
      document.addEventListener("keydown", resume, { once: true })
    })
  }
}

_musicAudio.addEventListener("ended", () => { void musicAdvance() })
_musicAudio.addEventListener("error", () => { setTimeout(() => { void musicAdvance() }, 3000) })

function setMusicVolume(target: number, fadeMs = FADE_MS) {
  const clamped = Math.max(0, Math.min(1, target))
  if (!_musicAudio.src) { _musicAudio.volume = clamped; return }
  const token = ++_musicFadeToken
  const from = Number.isFinite(_musicAudio.volume) ? _musicAudio.volume : clamped
  const start = performance.now()
  const tick = () => {
    if (_musicFadeToken !== token) return
    const progress = Math.min(1, (performance.now() - start) / fadeMs)
    _musicAudio.volume = from + (clamped - from) * progress
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function duckMusic() {
  setMusicVolume(DUCKED_VOLUME)
}

function unduckMusic() {
  setMusicVolume(MUSIC_VOLUME)
}

function ensureBackgroundMusic() {
  if (!_musicStopped) return   // already playing
  _musicStopped = false
  void musicAdvance()
}

function stopMusic() {
  _musicStopped = true
  _musicFadeToken++
  _musicAudio.pause()
  _musicAudio.src = ""
  _musicCurrentSrc = ""
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface CosmicTriviaDirectorVisuals {
  // Joyly01Overlay — 转场/庆祝花朵
  phaseBurstTrigger: number
  phaseBurstPreset:  'transition' | 'celebration'
  // ScoreBurstOverlay — 得分花朵飞向玩家条
  scoreBurstTrigger:    number
  scoreBurstWinnerIds:  string[]
  onScoreBurstReady:    (playerIds: string[]) => void  // 花朵绽放完毕，行开始高亮
  onScoreFlowerHit:     (playerId: string) => void
  onScoreFlowerLeave:   (playerId: string) => void
  // ScoreRow 动画 props
  scoreRowHits:      Record<string, number>
  scoreRowPushes:    Record<string, number>
  scoreRowWinners:   Set<string>       // 得分玩家（burst开始→花朵消失）
  frozenPlayerOrder: string[] | null   // 动画期间冻结排名顺序
  confettiRainActive: boolean          // post-game 持续彩带雨
  // emoji 粒子避让 ref（绑到 preferences 内容 div）
  prefsContentRef: React.RefObject<HTMLDivElement>
  interestRevealStep: number
  topCategories: string[]
}

export function useCosmicTriviaDirector(room: Room | null, code: string): CosmicTriviaDirectorVisuals {
  const trivia = (room?.gameState as CosmicTriviaState | null) ?? null

  // ── Audio refs ────────────────────────────────────────────────
  const refs = useRef<HookRefs>({
    previousSnapshot: null,
    audioCueKey: "",
    audioController: null,
  })

  // ── Visual cue state ─────────────────────────────────────────

  // 1. Joyly01 转场/庆祝花朵
  const [phaseBurstTrigger, setPhaseBurstTrigger] = useState(0)
  const [phaseBurstPreset,  setPhaseBurstPreset]  = useState<'transition' | 'celebration'>('transition')
  const prevPhaseRef         = useRef<string | null>(null)
  // 捕获 answer-lock 时的排名顺序（评分前），用于动画期间冻结
  const capturedOrderRef     = useRef<string[] | null>(null)

  useEffect(() => {
    const phase = trivia?.phase
    if (!phase || phase === prevPhaseRef.current) return
    prevPhaseRef.current = phase

    if (phase === 'answer-lock' && trivia && room) {
      // 评分前最后一个确定的排名快照
      capturedOrderRef.current = [...room.players]
        .sort((a, b) => (trivia.scores[b.id] ?? 0) - (trivia.scores[a.id] ?? 0))
        .map(p => p.id)
    }

    if (phase === 'between-questions' || phase === 'question-intro') {
      setPhaseBurstPreset('transition')
      setPhaseBurstTrigger(t => t + 1)
    }
  }, [trivia?.phase])  // eslint-disable-line react-hooks/exhaustive-deps

  // 2. 得分花朵 burst（ScoreBurstOverlay）
  const [scoreBurstTrigger,   setScoreBurstTrigger]   = useState(0)
  const [scoreBurstWinnerIds, setScoreBurstWinnerIds] = useState<string[]>([])
  const [scoreRowHits,    setScoreRowHits]    = useState<Record<string, number>>({})
  const [scoreRowPushes,  setScoreRowPushes]  = useState<Record<string, number>>({})
  const [scoreRowWinners, setScoreRowWinners] = useState<Set<string>>(new Set())
  const [frozenPlayerOrder, setFrozenPlayerOrder] = useState<string[] | null>(null)
  const lastFiredResolutionRef = useRef<string | null>(null)
  const pendingFlowerCountRef  = useRef(0)

  const sortedPlayersRef = useRef<{ id: string }[]>([])
  sortedPlayersRef.current = trivia && room
    ? [...room.players].sort((a, b) => (trivia.scores[b.id] ?? 0) - (trivia.scores[a.id] ?? 0))
    : []

  useEffect(() => {
    if (!trivia) return
    const phase = trivia.phase
    if (phase !== 'scoring' && phase !== 'reveal') return
    const winnerIds = trivia.lastResolution?.winnerIds
    if (!winnerIds?.length) return
    const key = `${trivia.questionIndex}-${trivia.lastResolution?.questionId ?? ''}`
    if (key === lastFiredResolutionRef.current) return
    lastFiredResolutionRef.current = key
    pendingFlowerCountRef.current = winnerIds.length

    // 冻结排名：优先使用 answer-lock 时捕获的顺序（评分前），否则用当前顺序
    const frozen = capturedOrderRef.current ?? sortedPlayersRef.current.map(p => p.id)
    setFrozenPlayerOrder(frozen)
    setScoreBurstWinnerIds(winnerIds)
    setScoreBurstTrigger(t => t + 1)
  }, [trivia?.phase, trivia?.lastResolution, trivia?.questionIndex])

  // 花朵绽放完毕（约0.75s后）→ 行开始高亮放大
  const onScoreBurstReady = useCallback((playerIds: string[]) => {
    setScoreRowWinners(new Set(playerIds))
  }, [])

  const onScoreFlowerHit = useCallback((playerId: string) => {
    setScoreRowHits(prev => ({ ...prev, [playerId]: (prev[playerId] ?? 0) + 1 }))
    const players = sortedPlayersRef.current
    const idx = players.findIndex(p => p.id === playerId)
    const neighbors = [players[idx - 1]?.id, players[idx + 1]?.id].filter(Boolean) as string[]
    if (neighbors.length) {
      setScoreRowPushes(prev => {
        const next = { ...prev }
        neighbors.forEach(id => { next[id] = (next[id] ?? 0) + 1 })
        return next
      })
    }
  }, [])

  const onScoreFlowerLeave = useCallback((_playerId: string) => {
    pendingFlowerCountRef.current = Math.max(0, pendingFlowerCountRef.current - 1)
    if (pendingFlowerCountRef.current <= 0) {
      // 最后一朵花消失 → 解冻排名（framer-motion 会动画到新位置）
      setFrozenPlayerOrder(null)
      // 稍等排名动画后再收缩行（约400ms）
      setTimeout(() => setScoreRowWinners(new Set()), 400)
    }
  }, [])

  // 3. emoji 粒子（preferences 阶段）
  const prefsContentRef = useEmojiParticles(
    trivia?.phase === 'preferences',
    trivia?.questionOptions ?? undefined,
  )

  // ── Audio cue effect ─────────────────────────────────────────
  useEffect(() => {
    if (!room || !code) return
    const trivia = room.gameState as CosmicTriviaState | null
    if (!trivia?.phase) return

    const r = refs.current
    ensureBackgroundMusic()

    const nextSnapshot = buildSnapshot(trivia)
    const previousSnapshot = r.previousSnapshot

    const context: DirectorContext = {
      ...buildContext(nextSnapshot, code),
      isFinalQuestion: trivia.isFinalQuestion,
    }

    if (previousSnapshot?.phase === nextSnapshot.phase) {
      r.previousSnapshot = nextSnapshot
      return
    }

    const plan = getReactiveAudioPlan(previousSnapshot, nextSnapshot, context)

    stopAudio(r)

    if (plan.segments.length || plan.notifyOnEnd || plan.advanceOnEnd) {
      playAudioSequence(r, plan, nextSnapshot, code)
    } else {
      unduckMusic()
    }

    r.previousSnapshot = nextSnapshot
  }, [room, code])

  useEffect(() => {
    return () => {
      stopAudio(refs.current)
      stopMusic()
    }
  }, [])

  // ── interest-reveal sequential audio + asset preloading ─────────
  const [interestRevealStep, setInterestRevealStep] = useState(0)
  const interestRevealPlayedRef = useRef(false)
  const upcomingAudioUrlsRef = useRef<string[]>([])
  upcomingAudioUrlsRef.current = trivia?.upcomingAudioUrls ?? []

  useEffect(() => {
    const phase = trivia?.phase
    if (phase !== 'interest-reveal') {
      setInterestRevealStep(0)
      interestRevealPlayedRef.current = false
      return
    }
    if (interestRevealPlayedRef.current) return
    if (!code || !trivia) return
    interestRevealPlayedRef.current = true

    const topCategories = trivia.topCategories || []
    const seed = `interest-reveal:${topCategories.join(',')}`
    const playbackKey = `interest-reveal:${seed}`
    const snapshot = buildSnapshot(trivia)
    const stopRef = { current: false }

    async function playSrc(src: string): Promise<void> {
      return new Promise(resolve => {
        if (stopRef.current) { resolve(); return }
        const audio = new Audio(src)
        audio.addEventListener("ended", () => resolve(), { once: true })
        audio.addEventListener("error", () => resolve(), { once: true })
        audio.play().catch(() => resolve())
      })
    }

    async function preloadOne(url: string): Promise<void> {
      return new Promise(resolve => {
        const audio = new Audio()
        audio.preload = 'auto'
        audio.addEventListener('canplaythrough', () => resolve(), { once: true })
        audio.addEventListener('error', () => resolve(), { once: true })
        audio.src = url
      })
    }

    void notifyAudioStatus(code, "interest-reveal", snapshot, "queued", playbackKey)

    ;(async () => {
      const introSrc = pickCueSrc("phase.interest-reveal.selection.intro", seed)
      if (introSrc && !stopRef.current) await playSrc(introSrc)

      // Start preloading upcoming round audio in parallel once intro finishes.
      // upcomingAudioUrlsRef stays current via render — URLs arrive within ~50ms
      // of phase entry as server-side selection completes.
      const preloadPromise = (async () => {
        const deadline = Date.now() + 3_000
        while (upcomingAudioUrlsRef.current.length === 0 && Date.now() < deadline && !stopRef.current) {
          await new Promise(r => setTimeout(r, 100))
        }
        const urls = upcomingAudioUrlsRef.current
        if (urls.length > 0) {
          await Promise.allSettled(urls.map(preloadOne))
        }
      })()

      if (topCategories.length === 0) {
        const noVotesSrc = pickCueSrc("phase.interest-reveal.selection.no-votes", seed)
        if (noVotesSrc && !stopRef.current) await playSrc(noVotesSrc)
      } else {
        const rank1Src = pickCueSrc(`phase.interest-reveal.selection.rank-1.${topCategories[0]}`, seed)
        if (!stopRef.current) {
          setInterestRevealStep(1)
          if (rank1Src) await playSrc(rank1Src)
        }

        if (topCategories.length >= 2 && !stopRef.current) {
          const andSrc = pickCueSrc("global.connector.and", seed)
          if (andSrc) await playSrc(andSrc)
          const rank2Src = pickCueSrc(`phase.interest-reveal.selection.rank-2.${topCategories[1]}`, seed)
          if (!stopRef.current) {
            setInterestRevealStep(2)
            if (rank2Src) await playSrc(rank2Src)
          }

          if (topCategories.length >= 3 && !stopRef.current) {
            const lastlySrc = pickCueSrc("global.connector.lastly", seed)
            if (lastlySrc) await playSrc(lastlySrc)
            const rank3Src = pickCueSrc(`phase.interest-reveal.selection.rank-3.${topCategories[2]}`, seed)
            if (!stopRef.current) {
              setInterestRevealStep(3)
              if (rank3Src) await playSrc(rank3Src)
            }
          }
        }
      }

      // Wait for preloading to complete (8s cap so slow networks don't stall gameplay)
      if (!stopRef.current) {
        await Promise.race([preloadPromise, new Promise(r => setTimeout(r, 8_000))])
      }

      if (!stopRef.current) {
        void notifyAudioStatus(code, "interest-reveal", snapshot, "ended", playbackKey)
      }
    })()

    return () => { stopRef.current = true }
  }, [trivia?.phase, code])  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phaseBurstTrigger,
    phaseBurstPreset,
    scoreBurstTrigger,
    scoreBurstWinnerIds,
    onScoreBurstReady,
    onScoreFlowerHit,
    onScoreFlowerLeave,
    scoreRowHits,
    scoreRowPushes,
    scoreRowWinners,
    frozenPlayerOrder,
    confettiRainActive: trivia?.phase === 'post-game',
    prefsContentRef,
    interestRevealStep,
    topCategories: trivia?.topCategories || [],
  }
}
