import { installJMS } from "/jms/src/api/browser.js";
import { seedBuiltInMotionPackRegistry } from "/jms/src/packs/motion-pack-library.js";
import { motionPackPlayer } from "/jms/src/packs/motion-pack-player.js";
import { triviaMotionPacks } from "/jms/src/packs/trivia-packs.js";
import { setPngLayer } from "/jms/src/runtime/runtime.js";
import { mountSvgAsset } from "/jms/src/visuals/index.js";
import { getReactiveAudioPlan } from "/games/cosmic-trivia/audio/director-flow.js";
import { audioPlanPlaybackKey } from "/games/cosmic-trivia/presentation-audio-keys.js";
import { getDirectorSegmentPauseMs } from "/shared/director/flow.js";

const TROPHY_BADGE_SRC = "/assets/avatars/events/event-winner-trophy.png";
const BACKGROUND_MUSIC_FALLBACK_SRC = "/games/cosmic-trivia/audio/music/bgm-trivia-time-chill-01.mp3";
const BACKGROUND_MUSIC_LIBRARY_ENDPOINT = "/api/games/cosmic-trivia/music-library";
const BACKGROUND_MUSIC_VOLUME = 0.45;
const BACKGROUND_MUSIC_DUCKED_VOLUME = 0.15;
const BACKGROUND_MUSIC_FADE_MS = 180;
const DIRECTOR_AUDIO_HEARTBEAT_MS = 1_000;

let jmsReady = null;
const roomSnapshots = new Map();
const roomPresentationRuns = new Map();
const roomRankQueues = new Map();
const roomAudioPlayers = new Map();
const roomAudioCues = new Map();
const roomMusicPlayers = new Map();
let backgroundMusicSourcesPromise = null;
let backgroundMusicSources = null;
const activeRankAnimationTokens = new Set();
const activeChoiceAnimationTokens = new Set();
let countdownListenerReady = false;

function exposeRankAnimationState() {
  const isAnimating = activeRankAnimationTokens.size > 0;
  document.documentElement.toggleAttribute("data-cosmic-trivia-rank-animating", isAnimating);
  window.CosmicTriviaPresentation = {
    ...(window.CosmicTriviaPresentation || {}),
    isRankAnimating: () => document.documentElement.hasAttribute("data-cosmic-trivia-rank-animating")
  };
}

function beginRankAnimation() {
  const token = Symbol("rank-animation");
  activeRankAnimationTokens.add(token);
  exposeRankAnimationState();
  window.dispatchEvent(new CustomEvent("cosmic-trivia-rank-animation-start"));
  return () => {
    activeRankAnimationTokens.delete(token);
    exposeRankAnimationState();
    if (!activeRankAnimationTokens.size) {
      window.dispatchEvent(new CustomEvent("cosmic-trivia-rank-animation-end"));
    }
  };
}

function exposeChoiceAnimationState() {
  const isAnimating = activeChoiceAnimationTokens.size > 0;
  document.documentElement.toggleAttribute("data-cosmic-trivia-choice-animating", isAnimating);
  window.CosmicTriviaPresentation = {
    ...(window.CosmicTriviaPresentation || {}),
    isChoiceAnimating: () => document.documentElement.hasAttribute("data-cosmic-trivia-choice-animating")
  };
}

function beginChoiceAnimation() {
  const token = Symbol("choice-animation");
  activeChoiceAnimationTokens.add(token);
  exposeChoiceAnimationState();
  window.dispatchEvent(new CustomEvent("cosmic-trivia-choice-animation-start"));
  return () => {
    activeChoiceAnimationTokens.delete(token);
    exposeChoiceAnimationState();
    if (!activeChoiceAnimationTokens.size) {
      window.dispatchEvent(new CustomEvent("cosmic-trivia-choice-animation-end"));
    }
  };
}

function nextPresentationRun(roomCode) {
  const next = (roomPresentationRuns.get(roomCode) || 0) + 1;
  roomPresentationRuns.set(roomCode, next);
  return next;
}

function isCurrentPresentationRun(roomCode, runId) {
  return roomPresentationRuns.get(roomCode) === runId;
}

function rankPlayersByScore(room, trivia, previousOrder = null) {
  const scores = trivia?.scores || {};
  return [...(room?.players || [])]
    .sort((a, b) => {
      const scoreDiff = (scores[b.id] || 0) - (scores[a.id] || 0);
      if (scoreDiff) return scoreDiff;

      if (previousOrder?.has(a.id) && previousOrder?.has(b.id)) {
        return (previousOrder.get(a.id) || 0) - (previousOrder.get(b.id) || 0);
      }
      if (previousOrder?.has(a.id)) return -1;
      if (previousOrder?.has(b.id)) return 1;

      const joinedDiff = Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      if (joinedDiff) return joinedDiff;
      return String(a.id).localeCompare(String(b.id));
    })
    .map(player => player.id);
}

function snapshotRoom(room, previousSnapshot = null) {
  const trivia = room?.gameState || room?.trivia || {};
  const previousOrder = previousSnapshot ? new Map(previousSnapshot.rankedIds.map((playerId, index) => [playerId, index])) : null;
  const visibleScores = trivia?.scoreboardVisible ? { ...(trivia.scores || {}) } : {};
  return {
    phase: trivia.phase || "",
    questionId: trivia.currentQuestion?.id || "",
    playCount: Number(trivia.playCount || 1),
    questionIndex: Number(trivia.questionIndex || 0),
    totalQuestions: Number(trivia.totalQuestions || 0),
    scores: visibleScores,
    rankedIds: trivia?.scoreboardVisible ? rankPlayersByScore(room, { ...trivia, scores: visibleScores }, previousOrder) : [],
    correctAnswer: trivia.currentQuestion?.correctAnswer || null,
    questionAudio: trivia.currentQuestion?.questionAudio || "",
    lastResolution: trivia.lastResolution || null,
    answersCount: Number(trivia.answersCount || 0),
    expectedAnswerCount: Number(trivia.expectedAnswerCount || 0),
    remainingMs: Number(trivia.remainingMs || 0),
    scoreVisibility: trivia?.scoreVisibility || "visible",
    scoreboardVisible: Boolean(trivia?.scoreboardVisible),
    finalHype: trivia?.finalHype || null
  };
}

function collectScoreRowRects(root) {
  const rects = {};
  for (const row of root.querySelectorAll("[data-jms-score-row]")) {
    const playerId = row.getAttribute("data-jms-score-row");
    if (!playerId) continue;
    const box = row.getBoundingClientRect();
    rects[playerId] = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height
    };
  }
  return rects;
}

function shouldRevealQuestion(previousSnapshot, nextSnapshot) {
  if (!nextSnapshot.questionId) return false;
  if (!previousSnapshot) return true;
  if (previousSnapshot.questionId !== nextSnapshot.questionId) return true;
  return previousSnapshot.phase !== "question-read" && nextSnapshot.phase === "question-read";
}

async function ensureTriviaJMS() {
  if (jmsReady) return jmsReady;

  jmsReady = (async () => {
    installJMS(window);
    await seedBuiltInMotionPackRegistry(motionPackPlayer.registry);
    for (const pack of triviaMotionPacks) {
      try {
        motionPackPlayer.registerMotionPack(pack);
      } catch {
        // Ignore duplicates while preserving previously-registered packs.
      }
    }
  })();

  return jmsReady;
}

function pointWithinCanvas(canvas, element) {
  if (!canvas || !element) return null;
  const canvasRect = canvas.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  return {
    x: targetRect.left - canvasRect.left + targetRect.width / 2,
    y: targetRect.top - canvasRect.top + targetRect.height / 2
  };
}

function playPack(packId, options = {}) {
  try {
    motionPackPlayer.playPack(packId, options);
  } catch {
    // Presentation failures should never block gameplay.
  }
}

async function loadBackgroundMusicSources() {
  if (Array.isArray(backgroundMusicSources) && backgroundMusicSources.length) {
    return backgroundMusicSources;
  }
  if (!backgroundMusicSourcesPromise) {
    backgroundMusicSourcesPromise = fetch(BACKGROUND_MUSIC_LIBRARY_ENDPOINT)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const sources = Array.isArray(data?.sources) ? data.sources.map(source => String(source || "").trim()).filter(Boolean) : [];
        backgroundMusicSources = sources.length ? [...new Set(sources)] : [BACKGROUND_MUSIC_FALLBACK_SRC];
        return backgroundMusicSources;
      })
      .catch(() => {
        backgroundMusicSources = [BACKGROUND_MUSIC_FALLBACK_SRC];
        return backgroundMusicSources;
      });
  }
  return backgroundMusicSourcesPromise;
}

function pickRandomBackgroundMusicSource(previousSrc, sources) {
  const pool = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (!pool.length) return BACKGROUND_MUSIC_FALLBACK_SRC;
  if (pool.length === 1) return pool[0];
  const usable = previousSrc ? pool.filter(src => src !== previousSrc) : pool;
  const finalPool = usable.length ? usable : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

function waitForAudioMetadata(audio, timeoutMs = 1200) {
  if (!audio) return Promise.resolve();
  if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", done);
      audio.removeEventListener("error", done);
      resolve();
    };
    const timeoutId = window.setTimeout(done, Math.max(0, timeoutMs));
    audio.addEventListener("loadedmetadata", done, { once: true });
    audio.addEventListener("error", done, { once: true });
  });
}

async function notifyDirectorAudioStatus(roomCode, phase, snapshot, status) {
  try {
    await fetch(`/api/rooms/${roomCode}/trivia/director/audio-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase,
        status,
        playbackKey: snapshot?.playbackKey || "",
        questionId: snapshot?.questionId || "",
        playCount: snapshot?.playCount || 1
      })
    });
  } catch {
    // Presentation cues should never block the game if the network is flaky.
  }
}

function clearDirectorAudioHeartbeat(controller) {
  if (controller?.heartbeatId) {
    window.clearInterval(controller.heartbeatId);
    controller.heartbeatId = null;
  }
}

function setDirectorAudioStatus(roomCode, plan, snapshot, controller, status) {
  if (!controller || controller.stopped) return;
  controller.status = status;
  if (plan.notifyOnEnd || plan.advanceOnEnd) {
    void notifyDirectorAudioStatus(roomCode, plan.phase, snapshot, status);
  }
}

function startDirectorAudioHeartbeat(roomCode, plan, snapshot, controller) {
  if (!controller || controller.stopped || (!plan.notifyOnEnd && !plan.advanceOnEnd)) return;
  clearDirectorAudioHeartbeat(controller);
  controller.heartbeatId = window.setInterval(() => {
    if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) {
      clearDirectorAudioHeartbeat(controller);
      return;
    }
    if (!controller.status) return;
    void notifyDirectorAudioStatus(roomCode, plan.phase, snapshot, controller.status);
  }, DIRECTOR_AUDIO_HEARTBEAT_MS);
}

function stopRoomAudio(roomCode) {
  const controller = roomAudioPlayers.get(roomCode);
  if (!controller) return;
  controller.stopped = true;
  clearDirectorAudioHeartbeat(controller);
  if (controller.audio) {
    controller.audio.pause();
    controller.audio.currentTime = 0;
  }
  roomAudioPlayers.delete(roomCode);
  setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
}

function ensureRoomBackgroundMusic(roomCode) {
  if (!roomCode) return null;
  let controller = roomMusicPlayers.get(roomCode);
  if (controller?.audio) return controller;

  const audio = new Audio();
  audio.loop = false;
  audio.preload = "auto";
  audio.volume = BACKGROUND_MUSIC_VOLUME;
  controller = {
    audio,
    fadeToken: 0,
    stopped: false,
    currentSrc: "",
    playlist: [],
    loadingPromise: null
  };
  roomMusicPlayers.set(roomCode, controller);
  audio.addEventListener("ended", () => {
    void advanceRoomBackgroundMusic(roomCode);
  });
  audio.addEventListener("error", () => {
    void advanceRoomBackgroundMusic(roomCode);
  });
  controller.loadingPromise = primeRoomBackgroundMusic(roomCode);
  return controller;
}

async function primeRoomBackgroundMusic(roomCode) {
  const controller = roomMusicPlayers.get(roomCode);
  if (!controller?.audio || controller.stopped) return;
  const sources = await loadBackgroundMusicSources();
  if (controller.stopped || roomMusicPlayers.get(roomCode) !== controller) return;
  controller.playlist = Array.isArray(sources) && sources.length ? [...sources] : [BACKGROUND_MUSIC_FALLBACK_SRC];
  if (!controller.currentSrc) {
    await advanceRoomBackgroundMusic(roomCode);
  }
}

async function advanceRoomBackgroundMusic(roomCode) {
  const controller = roomMusicPlayers.get(roomCode);
  if (!controller?.audio || controller.stopped) return;
  const sources = controller.playlist?.length ? controller.playlist : await loadBackgroundMusicSources();
  if (controller.stopped || roomMusicPlayers.get(roomCode) !== controller) return;
  const nextSrc = pickRandomBackgroundMusicSource(controller.currentSrc, sources);
  controller.currentSrc = nextSrc;
  const audio = controller.audio;
  audio.src = nextSrc;
  audio.currentTime = 0;
  const playResult = audio.play();
  if (playResult && typeof playResult.catch === "function") {
    playResult.catch(() => {
      // Retry happens on the next user gesture or track end.
    });
  }
}

function stopAllRoomBackgroundMusic() {
  for (const roomCode of [...roomMusicPlayers.keys()]) {
    stopRoomBackgroundMusic(roomCode);
  }
}

function setRoomBackgroundMusicVolume(roomCode, targetVolume, fadeMs = BACKGROUND_MUSIC_FADE_MS) {
  const controller = ensureRoomBackgroundMusic(roomCode);
  if (!controller?.audio) return;
  const audio = controller.audio;
  const clampedTargetVolume = Math.max(0, Math.min(1, targetVolume));
  if (!audio.src) {
    audio.volume = clampedTargetVolume;
    void primeRoomBackgroundMusic(roomCode);
    return;
  }
  if (audio.paused) {
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
    }
  }
  controller.fadeToken += 1;
  const token = controller.fadeToken;
  const from = Number.isFinite(audio.volume) ? audio.volume : clampedTargetVolume;
  if (!fadeMs || Math.abs(from - clampedTargetVolume) < 0.01) {
    audio.volume = clampedTargetVolume;
    return;
  }

  const start = performance.now();
  const step = now => {
    if (controller.fadeToken !== token) return;
    const progress = Math.min(1, (now - start) / fadeMs);
    audio.volume = from + (clampedTargetVolume - from) * progress;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function startRoomBackgroundMusic(roomCode) {
  ensureRoomBackgroundMusic(roomCode);
  setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
}

function duckRoomBackgroundMusic(roomCode) {
  setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_DUCKED_VOLUME);
}

function stopRoomBackgroundMusic(roomCode) {
  const controller = roomMusicPlayers.get(roomCode);
  if (!controller?.audio) return;
  controller.fadeToken += 1;
  controller.stopped = true;
  controller.currentSrc = "";
  controller.playlist = [];
  controller.audio.pause();
  controller.audio.currentTime = 0;
  roomMusicPlayers.delete(roomCode);
}

window.addEventListener("pagehide", stopAllRoomBackgroundMusic);
window.addEventListener("beforeunload", stopAllRoomBackgroundMusic);

function playDirectorAudioSequence(roomCode, plan, snapshot) {
  if (!plan || !plan.segments || !plan.segments.length) {
    if (plan?.notifyOnEnd || plan?.advanceOnEnd) {
      void notifyDirectorAudioStatus(roomCode, plan.phase, snapshot, "ended");
    }
    return;
  }

  stopRoomAudio(roomCode);
  const playbackKey = audioPlanPlaybackKey(plan, snapshot);
  const playbackSnapshot = {
    ...snapshot,
    playbackKey
  };
  const controller = {
    phase: plan.phase,
    key: playbackKey,
    stopped: false,
    status: "queued",
    heartbeatId: null,
    audio: null
  };
  roomAudioPlayers.set(roomCode, controller);
  roomAudioCues.set(roomCode, controller.key);
  if (plan.duckMusic !== false) {
    duckRoomBackgroundMusic(roomCode);
  }
  setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "queued");
  startDirectorAudioHeartbeat(roomCode, plan, playbackSnapshot, controller);

  const playIndex = index => {
    if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
    const segment = plan.segments[index];
    if (!segment?.src) {
      if (index >= plan.segments.length - 1 && (plan.notifyOnEnd || plan.advanceOnEnd)) {
        roomAudioPlayers.delete(roomCode);
        clearDirectorAudioHeartbeat(controller);
        void notifyDirectorAudioStatus(roomCode, plan.phase, playbackSnapshot, "ended");
      }
      return;
    }

    const audio = new Audio(segment.src);
    audio.preload = "auto";
    audio.volume = 1;
    controller.audio = audio;
    audio.addEventListener("playing", () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
      setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "playing");
    }, { once: true });
    audio.addEventListener("waiting", () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller || audio.ended) return;
      setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "queued");
    });
    audio.addEventListener("stalled", () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller || audio.ended) return;
      setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "queued");
    });
    audio.addEventListener("pause", () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller || audio.ended) return;
      setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "queued");
    });

    const advanceIfNeeded = () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
      if (index < plan.segments.length - 1) {
        setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "queued");
      }
      void waitForAudioMetadata(audio).then(() => {
        const pauseMs = getDirectorSegmentPauseMs(plan, Number(audio.duration || 0), {
          roomCode,
          playCount: snapshot?.playCount || 1,
          questionIndex: snapshot?.questionIndex || 0,
          questionId: snapshot?.questionId || ""
        });
        if (index < plan.segments.length - 1) {
          window.setTimeout(() => playIndex(index + 1), pauseMs);
          return;
        }
        if (plan.duckMusic !== false) {
          setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
        }
        window.setTimeout(() => {
          if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
          if (plan.notifyOnEnd || plan.advanceOnEnd) {
            clearDirectorAudioHeartbeat(controller);
            void notifyDirectorAudioStatus(roomCode, plan.phase, playbackSnapshot, "ended");
          }
          roomAudioPlayers.delete(roomCode);
        }, pauseMs);
      });
    };

    audio.addEventListener("ended", advanceIfNeeded, { once: true });
    audio.addEventListener("error", () => {
      if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
      clearDirectorAudioHeartbeat(controller);
      setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "blocked");
      if (plan.duckMusic !== false) {
        setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
      }
      roomAudioPlayers.delete(roomCode);
    }, { once: true });
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        if (controller.stopped || roomAudioPlayers.get(roomCode) !== controller) return;
        clearDirectorAudioHeartbeat(controller);
        setDirectorAudioStatus(roomCode, plan, playbackSnapshot, controller, "blocked");
        if (plan.duckMusic !== false) {
          setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
        }
        roomAudioPlayers.delete(roomCode);
      });
    }
  };

  playIndex(0);
}

function maybePlayPhaseAudio(roomCode, previousSnapshot, nextSnapshot) {
  if (!nextSnapshot.phase) return;
  startRoomBackgroundMusic(roomCode);
  const activeQuestionAudio = nextSnapshot.phase === "question-read"
    ? nextSnapshot.questionAudio || ""
    : "";
  const plan = getReactiveAudioPlan(previousSnapshot, nextSnapshot, {
    roomCode,
    playCount: nextSnapshot.playCount || 1,
    questionIndex: nextSnapshot.questionIndex || 0,
    questionAudio: activeQuestionAudio,
    isLastQuestion: nextSnapshot.totalQuestions ? nextSnapshot.questionIndex >= nextSnapshot.totalQuestions - 1 : false,
    lastResolution: nextSnapshot.lastResolution || null,
    scoreVisibility: nextSnapshot.scoreVisibility || "visible",
    finalHype: nextSnapshot.finalHype || null
  });
  const nextKey = audioPlanPlaybackKey(plan, nextSnapshot);
  const current = roomAudioPlayers.get(roomCode);
  if (previousSnapshot?.phase === nextSnapshot.phase && roomAudioCues.get(roomCode) === nextKey) return;
  if (current) stopRoomAudio(roomCode);
  if (plan.segments.length || plan.notifyOnEnd || plan.advanceOnEnd) {
    playDirectorAudioSequence(roomCode, plan, nextSnapshot);
  } else {
    setRoomBackgroundMusicVolume(roomCode, BACKGROUND_MUSIC_VOLUME);
  }
}

function ensureCountdownMotionListener() {
  if (countdownListenerReady) return;
  countdownListenerReady = true;
  window.addEventListener("cosmic-trivia-countdown-tick", event => {
    const sourceElement = event.target instanceof Element ? event.target : null;
    const targetElement = event.detail?.targetSelector
      ? sourceElement?.querySelector(event.detail.targetSelector)
      : sourceElement;
    if (!targetElement) return;
    void ensureTriviaJMS().then(() => {
      playPack(event.detail?.urgency === "danger" ? "countdown.dangerPulse" : "countdown.warningPulse", {
        targetElement
      });
    }).catch(() => {});
  });
}

function enqueueRankAnimation(roomCode, task) {
  const previous = roomRankQueues.get(roomCode) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  const stored = next.finally(() => {
    if (roomRankQueues.get(roomCode) === stored) {
      roomRankQueues.delete(roomCode);
    }
  });
  roomRankQueues.set(roomCode, stored);
  return next;
}

function scoreDeltas(previousSnapshot, nextSnapshot) {
  if (!nextSnapshot?.scoreboardVisible) return [];
  const deltas = [];
  for (const [playerId, score] of Object.entries(nextSnapshot.scores || {})) {
    const delta = score - (previousSnapshot?.scores?.[playerId] || 0);
    if (delta > 0) deltas.push({ playerId, delta });
  }
  return deltas;
}

function rankMoves(previousSnapshot, nextSnapshot) {
  if (!nextSnapshot?.scoreboardVisible) return [];
  if (!previousSnapshot) return [];
  const previousOrder = new Map(previousSnapshot.rankedIds.map((playerId, index) => [playerId, index]));
  return nextSnapshot.rankedIds
    .map((playerId, index) => ({
      playerId,
      delta: previousOrder.has(playerId) ? previousOrder.get(playerId) - index : 0,
      previousIndex: previousOrder.has(playerId) ? previousOrder.get(playerId) : null,
      nextIndex: index,
      previousRect: previousSnapshot.rowRects?.[playerId] || null
    }))
    .filter(entry => entry.delta !== 0);
}

function hydrateVictoryDecor(root) {
  const badge = root.querySelector("[data-jms-victory-badge]");
  if (!badge) return;
  setPngLayer(badge, TROPHY_BADGE_SRC, { fit: "contain", alt: "Winner trophy" });
}

function renderRankArrow(row) {
  const arrow = row.querySelector("[data-jms-rank-arrow]");
  if (!arrow) return;
  mountSvgAsset(arrow, "rank.arrow.up", { title: "Rank up" });
}

function clearRowMotion(row, gsap = window.gsap) {
  row.classList.remove("rank-motion", "rank-promoting", "rank-displaced");
  if (gsap) {
    gsap.killTweensOf(row);
    gsap.set(row, { clearProps: "transform,zIndex" });
    return;
  }
  row.getAnimations().forEach(animation => animation.cancel());
  row.style.transform = "";
  row.style.zIndex = "";
}

function animateRankRow(row, entry) {
  const currentRect = row.getBoundingClientRect();
  const previousRect = entry.previousRect;
  if (!previousRect) return Promise.resolve();

  const fromX = previousRect.left - currentRect.left;
  const fromY = previousRect.top - currentRect.top;
  const isPromotion = entry.delta > 0;
  const gsap = window.gsap;
  row.classList.add("rank-motion");
  row.classList.toggle("rank-promoting", isPromotion);
  row.classList.toggle("rank-displaced", !isPromotion);
  if (isPromotion) renderRankArrow(row);
  const arrowElement = row.querySelector("[data-jms-rank-arrow]");
  if (isPromotion && arrowElement) {
    void ensureTriviaJMS().then(() => {
      playPack("leaderboard.shift", {
        targetElement: arrowElement,
        arrowElement
      });
    }).catch(() => {});
  }

  if (gsap) {
    return new Promise(resolve => {
      gsap.killTweensOf(row);
      gsap.set(row, {
        x: fromX,
        y: fromY,
        scale: 1,
        zIndex: isPromotion ? 6 : 2,
        transformOrigin: "center center"
      });
      const timeline = gsap.timeline({
        onComplete: () => {
          clearRowMotion(row, gsap);
          resolve();
        }
      });
      if (isPromotion) {
        timeline
          .to(row, {
            x: 0,
            y: 0,
            scale: 1.07,
            duration: 1.72,
            ease: "power1.inOut"
          })
          .to(row, { scale: 1, duration: 0.28, ease: "power2.out" });
      } else {
        timeline
          .to(row, {
            x: 0,
            y: 0,
            scale: 0.99,
            duration: 1.72,
            ease: "power1.inOut"
          })
          .to(row, { scale: 1, duration: 0.18, ease: "power1.out" }, "-=0.06");
      }
    });
  }

  const animation = row.animate([
    { transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(1)` },
    { transform: `translate3d(0, 0, 0) scale(${isPromotion ? 1.07 : .99})`, offset: 0.86 },
    { transform: "translate3d(0, 0, 0) scale(1)" }
  ], {
    duration: isPromotion ? 2000 : 1900,
    easing: "ease-in-out",
    fill: "both"
  });

  return animation.finished.catch(() => {}).then(() => {
    clearRowMotion(row, null);
  });
}

function animateRankRows(root, entries) {
  const endRankAnimation = beginRankAnimation();
  const rowAnimations = entries.map(entry => {
    const row = root.querySelector(`[data-jms-score-row="${entry.playerId}"]`);
    if (!row) return Promise.resolve();
    return animateRankRow(row, entry);
  });
  return Promise.all(rowAnimations).finally(endRankAnimation);
}

export async function hydrateTriviaHostPresentation(root, room) {
  const trivia = room?.gameState || room?.trivia;
  if (!root || !room?.code || !trivia) return;
  ensureCountdownMotionListener();
  startRoomBackgroundMusic(room.code);

  const runId = nextPresentationRun(room.code);
  const previousSnapshot = roomSnapshots.get(room.code) || null;
  const nextSnapshot = snapshotRoom(room, previousSnapshot);
  const rankEntries = rankMoves(previousSnapshot, nextSnapshot);
  const nextSnapshotWithRows = {
    ...nextSnapshot,
    rowRects: collectScoreRowRects(root)
  };
  roomSnapshots.set(room.code, nextSnapshotWithRows);
  maybePlayPhaseAudio(room.code, previousSnapshot, nextSnapshot);

  if (rankEntries.length) {
    void enqueueRankAnimation(room.code, async () => {
      await animateRankRows(root, rankEntries);
    });
  }

  await ensureTriviaJMS();
  if (!isCurrentPresentationRun(room.code, runId)) return;
  hydrateVictoryDecor(root);

  const particlesCanvas = root.querySelector("[data-jms-particles]");

  if (shouldRevealQuestion(previousSnapshot, nextSnapshot)) {
    const card = root.querySelector("[data-jms-question-card]");
    const choices = [...root.querySelectorAll("[data-jms-choice]")];
    if (card) {
      playPack("question.cardReveal", {
        targetElement: card,
        choiceElements: choices
      });
    }
  }

  for (const entry of scoreDeltas(previousSnapshot, nextSnapshot)) {
    const scoreElement = root.querySelector(`[data-jms-score-value="${entry.playerId}"]`);
    if (!scoreElement) continue;
    playPack("score.bump", {
      targetElement: scoreElement,
      particlesTarget: particlesCanvas,
      origin: pointWithinCanvas(particlesCanvas, scoreElement)
    });
  }

  const choiceRows = [...root.querySelectorAll(".choice-selected-animate[data-jms-score-row]")];
  if (choiceRows.length) {
    const endChoiceAnimation = beginChoiceAnimation();
    const choiceAnimations = [];
    for (const row of choiceRows) {
      const controller = playPack("player.choiceLocked", {
        targetElement: row,
        fillElement: row.querySelector("[data-jms-choice-lock-fill]"),
        stampElement: row.querySelector("[data-jms-choice-lock-stamp]")
      });
      if (controller?.finished) {
        choiceAnimations.push(controller.finished.catch(() => {}));
      }
    }
    Promise.all(choiceAnimations).finally(() => {
      window.setTimeout(endChoiceAnimation, 120);
    });
  }

  if (previousSnapshot?.phase !== "reveal" && trivia.phase === "reveal" && nextSnapshot.correctAnswer) {
    const tile = root.querySelector(`[data-jms-choice="${nextSnapshot.correctAnswer}"]`);
    if (tile) {
      playPack("answer.reveal", {
        targetElement: tile,
        particlesTarget: particlesCanvas,
        origin: pointWithinCanvas(particlesCanvas, tile)
      });
    }
  }

  if (previousSnapshot?.phase !== "post-game" && trivia.phase === "post-game") {
    const winnerRow = root.querySelector("[data-jms-winner-row='winner']");
    const badge = root.querySelector("[data-jms-victory-badge]");
    if (winnerRow) {
      playPack("trivia.victoryReveal", {
        targetElement: winnerRow,
        badgeElement: badge,
        particlesTarget: particlesCanvas,
        origin: pointWithinCanvas(particlesCanvas, winnerRow),
        assets: {
          badgeImage: {
            src: TROPHY_BADGE_SRC,
            fit: "contain",
            alt: "Winner trophy"
          }
        },
        assetTargets: {
          badgeImage: badge
        }
      });
    }
    if (badge) {
      playPack("trivia.victoryReveal", {
        targetElement: badge,
        particlesTarget: particlesCanvas,
        origin: pointWithinCanvas(particlesCanvas, badge)
      });
    }
  }

}

export default hydrateTriviaHostPresentation;
