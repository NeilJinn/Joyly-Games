import { escape, html, withIcon } from "../../platform/shared/ui.js";
import { avatarToken } from "../../players/client.js";

const preferenceDrafts = new Map();
const answerDrafts = new Map();
const hostRankMemory = new Map();
const hostSelectionMemory = new Map();
let countdownTickerStarted = false;
let triviaPresentationModulePromise = null;

async function loadTriviaPresentationModule() {
  if (!triviaPresentationModulePromise) {
    triviaPresentationModulePromise = import("./presentation.js").catch(error => {
      triviaPresentationModulePromise = null;
      throw error;
    });
  }
  return triviaPresentationModulePromise;
}

export function sortedPlayersByScore(room) {
  const scores = room?.gameState?.scores || room?.trivia?.scores || {};
  return sortedPlayersByScoreWithOrder(room, scores);
}

function sortedPlayersByScoreWithOrder(room, scores, previousOrder = null) {
  return [...(room?.players || [])].sort((a, b) => {
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
  });
}

function phaseSeconds(trivia) {
  return Math.max(0, Math.ceil((trivia?.phaseEndsAt - Date.now()) / 1000) || 0);
}

function countdownUrgency(trivia) {
  const seconds = phaseSeconds(trivia);
  if (seconds <= 5) return "danger";
  if (seconds <= 10) return "warning";
  return "normal";
}

function formatPhaseLabel(phase) {
  if (!phase) return "Ready";
  return String(phase).replace(/-/g, " ");
}

function stageTimerTag(label, trivia) {
  if (!["interest-selecting", "answering"].includes(trivia?.phase) || !trivia?.phaseEndsAt) {
    return html`
      <span class="tag stage-bar">
        <span class="stage-bar-label">${escape(label)}</span>
      </span>
    `;
  }
  const seconds = phaseSeconds(trivia);
  const duration = Number(trivia?.phaseDurationMs || 0);
  const remaining = Math.max(0, trivia.phaseEndsAt - Date.now());
  const progress = duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / duration)) : 0;
  return html`
    <span
      class="tag director-countdown countdown-${countdownUrgency(trivia)}"
      data-director-countdown
      data-countdown-remaining="${trivia?.phaseEndsAt || 0}"
      data-countdown-duration="${duration}"
      style="--timer-progress:${progress}"
      aria-label="Time left ${seconds} seconds"
    >
      <span class="director-countdown-fill" aria-hidden="true"></span>
      <span class="director-countdown-glow-track" aria-hidden="true">
        <span class="director-countdown-glow"></span>
      </span>
      <span class="stage-bar-label director-countdown-label">${escape(label)}</span>
      <strong class="director-countdown-value">${seconds}s</strong>
    </span>
  `;
}

function refreshCountdownFills() {
  for (const countdown of document.querySelectorAll("[data-director-countdown]")) {
    const remainingAt = Number(countdown.dataset.countdownRemaining || 0);
    const durationMs = Number(countdown.dataset.countdownDuration || 0);
    const remainingMs = Math.max(0, remainingAt - Date.now());
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / durationMs)) : 0;
    countdown.style.setProperty("--timer-progress", String(progress));
    countdown.classList.toggle("countdown-warning", seconds <= 10 && seconds > 5);
    countdown.classList.toggle("countdown-danger", seconds <= 5);
    countdown.classList.toggle("countdown-normal", seconds > 10);
    const value = countdown.querySelector(".director-countdown-value");
    if (value) value.textContent = `${seconds}s`;
    if (seconds <= 10 && seconds > 0 && countdown.dataset.countdownMotionSecond !== String(seconds)) {
      countdown.dataset.countdownMotionSecond = String(seconds);
      countdown.dispatchEvent(new CustomEvent("cosmic-trivia-countdown-tick", {
        bubbles: true,
        detail: {
          seconds,
          urgency: seconds <= 5 ? "danger" : "warning",
          targetSelector: ".director-countdown-glow"
        }
      }));
    }
  }
}

function ensureCountdownTicker() {
  if (countdownTickerStarted) return;
  countdownTickerStarted = true;
  const tick = () => {
    refreshCountdownFills();
    window.requestAnimationFrame(tick);
  };
  tick();
}

const categoryLabels = {
  space: "Space",
  science: "Science",
  general: "General",
  history: "History",
  sports: "Sports",
  nature: "Nature",
  movies: "Movies",
  geography: "Geography"
};

const tagLabels = {
  planets: "Planets",
  ai: "AI",
  light: "Light",
  cards: "Cards",
  earth: "Earth",
  plants: "Plants",
  music: "Music",
  food: "Food",
  inventions: "Inventions",
  animals: "Animals",
  movies: "Movies",
  geography: "Geography",
  history: "History",
  sports: "Sports",
  language: "Language",
  weather: "Weather",
  oceans: "Oceans",
  books: "Books",
  games: "Games"
};

function labelFor(kind, value) {
  return (kind === "category" ? categoryLabels : tagLabels)[value] || value;
}

function preferenceProgress(room, trivia) {
  return `${trivia?.preferencesCount || 0}/${trivia?.expectedPreferenceCount || room.players.length}`;
}

function preferenceDraftKey(roomCode, playerId) {
  return `${roomCode}:${playerId}:preferences`;
}

function answerDraftKey(roomCode, playerId, questionId) {
  return `${roomCode}:${playerId}:${questionId || "pending"}:answer`;
}

function getPreferenceDraft(room, playerId, playerState, locked) {
  const key = preferenceDraftKey(room.code, playerId);
  if (locked) {
    preferenceDrafts.delete(key);
    return {
      categories: playerState.preferences?.categories || [],
      tags: playerState.preferences?.tags || []
    };
  }
  if (!preferenceDrafts.has(key)) {
    preferenceDrafts.set(key, {
      categories: [...(playerState.preferences?.categories || [])],
      tags: [...(playerState.preferences?.tags || [])]
    });
  }
  return preferenceDrafts.get(key);
}

function getDraftAnswer(room, playerId, trivia) {
  const questionId = trivia?.currentQuestion?.id;
  const key = answerDraftKey(room.code, playerId, questionId);
  if (trivia?.phase !== "answering") {
    answerDrafts.delete(key);
    return "";
  }
  return answerDrafts.get(key) || "";
}

function renderPreferenceOptions(values = [], kind, picked = [], locked = false) {
  return values.map(value => html`
    <label class="preference-pill ${picked.includes(value) ? "active" : ""} ${locked ? "locked" : ""}">
      <input type="checkbox" name="${kind}" value="${escape(value)}" ${picked.includes(value) ? "checked" : ""} ${locked ? "disabled" : ""} />
      <span>${escape(labelFor(kind, value))}</span>
    </label>
  `).join("");
}

function renderPreferenceSummary(kind, picked = []) {
  if (!picked.length) return "";
  return html`
    <div class="preference-selection">
      ${picked.map(value => `<span>${escape(labelFor(kind, value))}</span>`).join("")}
    </div>
  `;
}

function preferenceLabelsForPlayer(trivia, playerId) {
  return "";
}

function buildRankSnapshot(room, trivia) {
  const scores = trivia?.scores || {};
  const previous = hostRankMemory.get(room.code);
  const previousOrder = previous?.order || null;
  const ranked = sortedPlayersByScoreWithOrder(room, scores, previousOrder);
  const signature = ranked.map(player => `${player.id}:${scores[player.id] || 0}`).join("|");
  const animate = Boolean(previous && previous.signature !== signature);
  const previousOrderMap = previous?.order || new Map();
  const previousScores = previous?.scores || {};
  const deltas = new Map();

  if (animate) {
    ranked.forEach((player, index) => {
      const previousIndex = previousOrderMap.get(player.id);
      const previousScore = previousScores[player.id] || 0;
      const currentScore = scores[player.id] || 0;
      deltas.set(player.id, {
        move: previousIndex == null ? 0 : previousIndex - index,
        scoreDelta: currentScore - previousScore
      });
    });
  }

  hostRankMemory.set(room.code, {
    signature,
    order: new Map(ranked.map((player, index) => [player.id, index])),
    scores: { ...scores }
  });

  return { ranked, deltas, animate };
}

function buildSelectionSnapshot(room, trivia) {
  const phase = trivia?.phase || "";
  const questionId = trivia?.currentQuestion?.id || "";
  const selectedIds = new Set(trivia?.answeredPlayerIds || []);
  const previous = hostSelectionMemory.get(room.code) || { questionId: "", selectedIds: new Set() };
  const animateIds = new Set();

  if (phase === "answering" && questionId) {
    if (previous.questionId !== questionId) {
      previous.questionId = questionId;
      previous.selectedIds = new Set();
    }
    for (const playerId of selectedIds) {
      if (!previous.selectedIds.has(playerId)) animateIds.add(playerId);
    }
    previous.selectedIds = new Set(selectedIds);
    hostSelectionMemory.set(room.code, previous);
  } else if (["scoring", "next-question", "finale-intro", "complete"].includes(phase)) {
    hostSelectionMemory.delete(room.code);
  }

  return { animateIds, selectedIds };
}

function renderTesterPanel(room, trivia, ranked) {
  const selectedPlayerId = trivia?.tester?.selectedPlayerId || "";
  const selectedPlayer = ranked.find(player => player.id === selectedPlayerId) || null;
  return html`
    <section class="tester-panel" data-trivia-tester-panel>
      <div class="tester-panel-head">
        <div>
          <span class="tag">Tester mode</span>
          <h2>Director tools</h2>
          <p class="muted">${selectedPlayer ? `Selected: ${escape(selectedPlayer.nickname)}` : "Pick a player from the score list."}</p>
        </div>
        <button type="button" class="ghost tester-clear" data-trivia-tester-select="">${withIcon("close", "Clear")}</button>
      </div>
      <div class="tester-group">
        <strong>Countdown</strong>
        <div class="tester-actions">
          ${[3, 5, 10].map(seconds => html`
            <button type="button" class="ghost tester-button" data-trivia-tester-timer="${seconds}">${seconds}s</button>
          `).join("")}
        </div>
      </div>
      <div class="tester-group">
        <strong>Score selected</strong>
        <div class="tester-actions">
          ${[50, 100, 250].map(points => html`
            <button type="button" class="ghost tester-button" data-trivia-tester-score="${points}" ${selectedPlayer ? "" : "disabled"}>+${points}</button>
          `).join("")}
        </div>
      </div>
      <div class="tester-group">
        <strong>Finish</strong>
        <button type="button" class="danger tester-finish" data-trivia-tester-complete>${withIcon("trophy", "End game")}</button>
      </div>
    </section>
  `;
}

function renderHostPrep(room, trivia) {
  const isSelecting = trivia?.phase === "interest-selecting";
  return html`
    <section class="question-card prep-card" data-jms-prep-card>
      <div class="prep-stage-copy">
        <div class="prep-stage-copy-row">
          ${stageTimerTag(isSelecting ? "Selection" : trivia?.directorMessage || "Preparing round", trivia)}
        </div>
      </div>
      <h1>${isSelecting ? "Pick your choices on your phone" : "Loading this round"}</h1>
      <p class="fact-line">${isSelecting ? "Lock a few choices on your phone. Once they're set, the round will load." : "Questions and audio cues are being prepared."}</p>
    </section>
  `;
}

export function renderHostGame(room) {
  const trivia = room.gameState || room.trivia;
  const isPrep = ["interest-selecting", "preferences-locked", "deck-loading"].includes(trivia?.phase);
  const { ranked, deltas, animate } = buildRankSnapshot(room, trivia);
  const { animateIds, selectedIds } = buildSelectionSnapshot(room, trivia);
  const currentQuestion = (trivia?.questionIndex ?? 0) + 1;
  const answered = trivia?.answeredPlayerIds || [];
  const question = trivia?.currentQuestion;
  const isAnswering = trivia?.phase === "answering";
  const isQuestionLeadIn = trivia?.phase === "question-intro";
  const isFinaleLeadIn = trivia?.phase === "finale-intro";
  const isReveal = ["scoring", "next-question", "finale-intro", "complete"].includes(trivia?.phase);
  const isComplete = trivia?.phase === "complete";
  const selectedPlayerId = trivia?.tester?.selectedPlayerId || "";
  const hasTesterPlayers = ranked.some(player => player.virtual);
  const stageLabel = isComplete ? "Finished" : `Stage · ${formatPhaseLabel(trivia?.phase)}`;
  const stageValue = trivia?.phase === "answering" ? ` · ${phaseSeconds(trivia)}s` : "";

  return html`
    <aside class="sidebar game-shared-panel">
      <strong>${escape(room.selectedGame?.title || "Cosmic Trivia")}</strong>
      <p class="muted">${trivia?.expectedAnswerCount || room.players.length} active phones connected.</p>
      ${isPrep ? html`
        <div class="prep-sidebar-state">
          <span class="tag">Choosing</span>
        </div>
      ` : ""}
      <div class="score-list">
        ${ranked.map((item, index) => html`
            <div class="score-row ${selectedPlayerId === item.id ? "selected" : ""} ${isAnswering && selectedIds.has(item.id) ? "choice-selected" : ""} ${isAnswering && animateIds.has(item.id) ? "choice-selected-animate" : ""} ${isAnswering && !selectedIds.has(item.id) ? "choice-pending" : ""} ${isReveal ? "choice-revealed" : ""} ${animate && (deltas.get(item.id)?.move || 0) > 0 ? "promoted" : ""} ${animate && (deltas.get(item.id)?.move || 0) < 0 ? "demoted" : ""}" data-player-id="${escape(item.id)}" data-trivia-tester-select="${escape(item.id)}" data-jms-score-row="${escape(item.id)}" data-jms-rank-index="${index}">
              <div class="choice-lock-effect" data-jms-choice-lock-effect aria-hidden="true">
                <div class="choice-lock-fill" data-jms-choice-lock-fill></div>
                <div class="choice-lock-stamp" data-jms-choice-lock-stamp>Selected</div>
              </div>
              <span>${index + 1}</span>
              ${avatarToken(item.avatar)}
              <div class="score-body">
                <strong>${escape(item.nickname)}</strong>
                <span class="score-subline">${isAnswering ? (selectedIds.has(item.id) ? "Selected" : "Not selected") : isReveal ? "Revealing" : isPrep ? "Choosing" : (animate && (deltas.get(item.id)?.move || 0) > 0 ? "Promoted" : animate && (deltas.get(item.id)?.move || 0) < 0 ? "Dropped" : "Holding position")}</span>
              </div>
              <div class="score-meta">
                <em data-jms-score-value="${escape(item.id)}">${trivia?.scores?.[item.id] || 0}</em>
                ${animate && (deltas.get(item.id)?.move || 0) > 0 ? html`
                  <div
                    class="rank-arrow-lottie positive"
                    data-jms-rank-arrow
                    aria-hidden="true"
                  ></div>
                ` : ""}
              </div>
          </div>
          `).join("")}
      </div>
      ${hasTesterPlayers ? renderTesterPanel(room, trivia, ranked) : ""}
    </aside>
    <main class="main trivia-stage" data-jms-trivia-stage>
      <div class="trivia-jms-layer" aria-hidden="true">
        <canvas class="trivia-jms-particles" data-jms-particles></canvas>
        <div class="trivia-jms-victory-badge" data-jms-victory-badge></div>
        <div class="trivia-jms-victory-lottie" data-jms-victory-lottie></div>
      </div>
      <div class="section-title trivia-head">
        <div>
          <h2>${isComplete ? "Final Scores" : `Question ${currentQuestion} / ${trivia?.totalQuestions || 6}`}</h2>
          <p class="muted">${isComplete ? "Cosmic Trivia complete" : trivia?.directorMessage || "Director running"}</p>
        </div>
        <div class="director-chip">${withIcon(isComplete ? "trophy" : "play", `${stageLabel}${stageValue}`)}</div>
      </div>
      ${isComplete ? html`
        <section class="winner-board" data-jms-winner-board>
          ${ranked.map((item, index) => html`
            <article class="winner-row ${index === 0 ? "winner" : ""}" data-jms-winner-row="${index === 0 ? "winner" : "placed"}">
              <span class="winner-rank">${index + 1}</span>
              ${avatarToken(item.avatar, "large")}
              <strong>${escape(item.nickname)}</strong>
              <em>${trivia?.scores?.[item.id] || 0} pts</em>
            </article>
          `).join("")}
          <button class="primary replay-button" data-trivia-restart type="button">${withIcon("play", "Play again")}</button>
        </section>
      ` : isPrep ? renderHostPrep(room, trivia) : isQuestionLeadIn ? html`
        <section class="question-card prep-card" data-jms-question-card data-jms-question-id="${escape(question?.id || "")}">
          ${stageTimerTag(trivia?.directorMessage || "Next question", trivia)}
          <h1>${escape(trivia?.directorMessage || `Question ${currentQuestion} is on the way`)}</h1>
          <p class="fact-line">The question card will appear when the intro voice ends.</p>
        </section>
      ` : isFinaleLeadIn ? html`
        <section class="question-card prep-card" data-jms-question-card>
          ${stageTimerTag(trivia?.directorMessage || "Final leaderboard", trivia)}
          <h1>Final leaderboard incoming</h1>
          <p class="fact-line">The final ranking will appear when the closing voice ends.</p>
        </section>
      ` : html`
        <section class="question-card" data-jms-question-card data-jms-question-id="${escape(question?.id || "")}">
          ${stageTimerTag(isReveal ? "Answer reveal" : isAnswering ? "Choose on your phone" : trivia?.directorMessage || "Get ready", trivia)}
          <h1>${escape(question?.question || trivia?.directorMessage || "Loading question...")}</h1>
          <div class="choice-grid">
            ${(question?.answers || []).map((choice, index) => html`
              <div class="choice-tile ${isReveal && choice.id === question.correctAnswer ? "correct" : ""}" data-jms-choice="${escape(choice.id)}" data-choice-id="${escape(choice.id)}">
                <span>${String.fromCharCode(65 + index)}</span>
                <strong>${escape(choice.text)}</strong>
              </div>
            `).join("")}
          </div>
          ${isReveal ? `<p class="fact-line">${escape(question?.fact || "")}</p>` : ""}
        </section>
      `}
    </main>
  `;
}

function lockedLabel(trivia, playerId) {
  return trivia?.playerStates?.[playerId]?.preferencesLocked ? "Locked" : "Choosing";
}

export function renderPhoneGame(room, player, chrome = {}) {
  const trivia = room.gameState || room.trivia;
  const activePlayer = room.players.find(item => item.id === player.id) || player;
  const playerState = trivia?.playerStates?.[activePlayer.id] || { preferences: { categories: [], tags: [] }, preferencesLocked: false };
  const score = trivia?.scores?.[activePlayer.id] || 0;
  const question = trivia?.currentQuestion;
  const isAnswering = trivia?.phase === "answering";
  const isQuestionLeadIn = trivia?.phase === "question-intro";
  const isFinaleLeadIn = trivia?.phase === "finale-intro";
  const isReveal = ["scoring", "next-question", "finale-intro", "complete"].includes(trivia?.phase);
  const isComplete = trivia?.phase === "complete";
  const isSelecting = trivia?.phase === "interest-selecting";
  const isPreparing = ["preferences-locked", "deck-loading"].includes(trivia?.phase);
  const preferencesLocked = Boolean(playerState.preferencesLocked);
  const preferenceDraft = getPreferenceDraft(room, activePlayer.id, playerState, preferencesLocked);
  const pickedCategories = preferenceDraft.categories || [];
  const pickedTags = preferenceDraft.tags || [];
  const currentAnswer = getDraftAnswer(room, activePlayer.id, trivia);

  return html`
    <main class="phone-wrap phone-trivia">
      ${chrome.header || ""}
      <section class="join-card phone-status phone-trivia-card">
        <div class="phone-trivia-head">
          <div class="phone-avatar-wrap phone-trivia-avatar">${avatarToken(activePlayer.avatar, "hero")}</div>
          <div class="phone-trivia-identity">
            <h1>${escape(activePlayer.nickname)}</h1>
            <div class="phone-trivia-meta">
              <span class="trivia-stat-chip ready-chip">${score} pts</span>
              ${!isComplete ? `<span class="trivia-stat-chip">Q ${(trivia?.questionIndex || 0) + 1}/${trivia?.totalQuestions || 6}</span>` : ""}
            </div>
          </div>
        </div>
        ${stageTimerTag(isSelecting ? "Choosing" : isAnswering ? "Answering" : "Time left", trivia)}
        ${isComplete ? html`
          <div class="phone-trivia-panel">
            <p class="muted">Game complete. Look at the big screen for the final ranking.</p>
          </div>
        ` : isSelecting ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Selection</span>
              <h2>Pick your choices</h2>
              <p class="muted">${preferencesLocked ? "Choices locked. Waiting for the round." : "Choose a few choices you want in this round."}</p>
            </div>
            <form class="preference-picker" data-preference-form>
              <div class="preference-group">
                <div class="preference-heading">
                  <h2>Categories</h2>
                  ${renderPreferenceSummary("category", pickedCategories)}
                </div>
                <div class="preference-options">${renderPreferenceOptions(trivia?.questionOptions?.categories || [], "category", pickedCategories, preferencesLocked)}</div>
              </div>
              <div class="preference-group">
                <div class="preference-heading">
                  <h2>Keywords</h2>
                  ${renderPreferenceSummary("tag", pickedTags)}
                </div>
                <div class="preference-options">${renderPreferenceOptions(trivia?.questionOptions?.tags || [], "tag", pickedTags, preferencesLocked)}</div>
              </div>
              <button class="primary" type="submit" ${preferencesLocked ? "disabled" : ""}>${withIcon("check", preferencesLocked ? "Locked" : "Lock choices")}</button>
            </form>
          </div>
        ` : isQuestionLeadIn ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Question ${(trivia?.questionIndex || 0) + 1}/${trivia?.totalQuestions || 6}</span>
              <h2>${escape(trivia?.directorMessage || "The next question is on the way.")}</h2>
              <p class="muted">Wait for the question card to appear when the intro voice ends.</p>
            </div>
          </div>
        ` : isPreparing ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Round setup</span>
              <h2>Choices locked</h2>
              <p class="muted">The director is loading the selected questions.</p>
            </div>
          </div>
        ` : isFinaleLeadIn ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Final leaderboard</span>
              <h2>The ranking is almost here.</h2>
              <p class="muted">The closing voice will finish before the leaderboard appears.</p>
            </div>
          </div>
        ` : isReveal ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Question ${(trivia?.questionIndex || 0) + 1}/${trivia?.totalQuestions || 6}</span>
              <h2>${escape(question?.question || "Answer reveal")}</h2>
            </div>
            <div class="phone-trivia-reveal">
              <span class="tag">${question?.correctAnswer ? `Answer ${String(question.correctAnswer).toUpperCase()}` : "Answer locked"}</span>
              <p class="muted">${escape(question?.fact || "Next question soon.")}</p>
            </div>
          </div>
        ` : html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Question ${(trivia?.questionIndex || 0) + 1}/${trivia?.totalQuestions || 6}</span>
              <h2>${escape(question?.question || trivia?.directorMessage || "Question loading...")}</h2>
            </div>
            <div class="phone-choice-grid">
              ${(question?.answers || []).map((choice, index) => html`
                <button class="answer-button ${currentAnswer === choice.id ? "selected" : ""}" data-answer="${escape(choice.id)}" ${!isAnswering ? "disabled" : ""}>
                  <span>${String.fromCharCode(65 + index)}</span>
                  <strong>${escape(choice.text)}</strong>
                </button>
              `).join("")}
            </div>
            ${currentAnswer ? `<p class="muted">Current pick: ${escape(String(currentAnswer).toUpperCase())}. You can still change it before time runs out.</p>` : `<p class="muted">${escape(trivia?.directorMessage || "Wait for the answer phase.")}</p>`}
          </div>
        `}
        ${chrome.switcher || ""}
      </section>
    </main>
  `;
}

export function attachPhoneGameHandlers(root, { room, player, api, onRoom }) {
  const draftKey = preferenceDraftKey(room.code, player.id);
  root.querySelectorAll("[data-preference-form] input[type=\"checkbox\"]").forEach(input => {
    input.addEventListener("change", event => {
      const formElement = event.currentTarget.form;
      if (!formElement) return;
      const form = new FormData(formElement);
      const draft = {
        categories: form.getAll("category").map(String),
        tags: form.getAll("tag").map(String)
      };
      preferenceDrafts.set(draftKey, draft);
      api(`/api/rooms/${room.code}/trivia/preferences`, {
        method: "POST",
        body: { playerId: player.id, preferences: { ...draft, preview: true } }
      }).then(data => onRoom(data.room)).catch(() => {});
    });
  });

  root.querySelector("[data-preference-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categories = form.getAll("category").map(String);
    const tags = form.getAll("tag").map(String);
    preferenceDrafts.set(draftKey, { categories, tags });
    const data = await api(`/api/rooms/${room.code}/trivia/preferences`, {
      method: "POST",
      body: { playerId: player.id, preferences: { categories, tags } }
    });
    onRoom(data.room);
  });

  root.querySelectorAll("[data-answer]").forEach(button => {
    button.addEventListener("click", async () => {
      const trivia = room.gameState || room.trivia;
      const questionId = trivia?.currentQuestion?.id;
      if (!questionId) return;
      answerDrafts.set(answerDraftKey(room.code, player.id, questionId), button.dataset.answer);
      const data = await api(`/api/rooms/${room.code}/trivia/answer`, {
        method: "POST",
        body: { playerId: player.id, choice: button.dataset.answer }
      });
      onRoom(data.room);
    });
  });

  root.querySelector("[data-trivia-restart]")?.addEventListener("click", async () => {
    const data = await api(`/api/rooms/${room.code}/trivia/restart`, { method: "POST" });
    onRoom(data.room);
  });
}

export function attachHostGameHandlers(root, { room, api }) {
  void loadTriviaPresentationModule()
    .then(module => module.hydrateTriviaHostPresentation(root, room))
    .catch(() => {});
  ensureCountdownTicker();
  root.querySelector("[data-trivia-restart]")?.addEventListener("click", async () => {
    const data = await api(`/api/rooms/${room.code}/trivia/restart`, { method: "POST" });
    if (data.room) Object.assign(room, data.room);
  });
  root.querySelectorAll("[data-trivia-tester-select]").forEach(button => {
    button.addEventListener("click", async event => {
      const playerId = event.currentTarget.dataset.triviaTesterSelect;
      await api(`/api/rooms/${room.code}/trivia/tester/selection`, {
        method: "POST",
        body: { playerId }
      });
    });
  });
  root.querySelectorAll("[data-trivia-tester-timer]").forEach(button => {
    button.addEventListener("click", async event => {
      const seconds = Number(event.currentTarget.dataset.triviaTesterTimer || 0);
      await api(`/api/rooms/${room.code}/trivia/tester/timer`, {
        method: "POST",
        body: { seconds }
      });
    });
  });
  root.querySelectorAll("[data-trivia-tester-score]").forEach(button => {
    button.addEventListener("click", async event => {
      const points = Number(event.currentTarget.dataset.triviaTesterScore || 0);
      await api(`/api/rooms/${room.code}/trivia/tester/score`, {
        method: "POST",
        body: { points }
      });
    });
  });
  root.querySelector("[data-trivia-tester-complete]")?.addEventListener("click", async () => {
    await api(`/api/rooms/${room.code}/trivia/tester/complete`, { method: "POST" });
  });
}

export const cosmicTriviaClient = {
  id: "cosmic-trivia",
  renderHostGame,
  renderPhoneGame,
  attachHostGameHandlers,
  attachPhoneGameHandlers
};

export default cosmicTriviaClient;
