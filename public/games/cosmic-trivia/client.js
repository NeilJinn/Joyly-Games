import { escape, html, withIcon } from "../../platform/shared/ui.js";
import { avatarToken } from "../../players/client.js";

const preferenceDrafts = new Map();
const answerDrafts = new Map();
const topicBubbleMemory = new Map();
const hostRankMemory = new Map();

export function sortedPlayersByScore(room) {
  const scores = room?.gameState?.scores || room?.trivia?.scores || {};
  return [...(room?.players || [])].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
}

function phaseSeconds(trivia) {
  return Math.max(0, Math.ceil((trivia?.phaseEndsAt - Date.now()) / 1000) || 0);
}

function phaseProgress(trivia) {
  if (!trivia?.phaseDurationMs || !trivia?.phaseStartedAt) return 0;
  const elapsed = Date.now() - trivia.phaseStartedAt;
  return Math.min(100, Math.max(0, (elapsed / trivia.phaseDurationMs) * 100));
}

function directorCountdown(trivia) {
  const seconds = phaseSeconds(trivia);
  if (!seconds) return "";
  return html`
    <div class="director-countdown">
      <span>${seconds}s</span>
      <div><i style="width:${phaseProgress(trivia)}%"></i></div>
    </div>
  `;
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

function hashBubble(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
  return hash;
}

function bubbleBox(kind, label) {
  const length = label.length;
  const width = kind === "category"
    ? Math.min(268, Math.max(126, 104 + length * 9))
    : Math.min(228, Math.max(110, 88 + length * 7));
  const height = width;
  return { width, height };
}

function bubbleLabel(kind, value) {
  return escape(labelFor(kind, value));
}

function bubbleEntries(room, trivia) {
  if (!trivia || !["interest-selecting", "preferences-locked"].includes(trivia.phase)) {
    topicBubbleMemory.delete(room.code);
    return [];
  }

  const fieldOptions = [
    ...(trivia.questionOptions?.categories || []).map(value => ({ kind: "category", value })),
    ...(trivia.questionOptions?.tags || []).map(value => ({ kind: "tag", value }))
  ];
  if (!fieldOptions.length) {
    topicBubbleMemory.delete(room.code);
    return [];
  }

  const entries = new Map(fieldOptions.map(option => {
    const key = `${option.kind}:${option.value}`;
    return [key, {
      key,
      kind: option.kind,
      value: option.value,
      label: labelFor(option.kind, option.value),
      count: 0
    }];
  }));

  for (const player of room.players || []) {
    const state = trivia.playerStates?.[player.id];
    const preferences = state?.preferences || { categories: [], tags: [] };
    for (const value of preferences.categories || []) {
      const entry = entries.get(`category:${value}`);
      if (entry) entry.count += 1;
    }
    for (const value of preferences.tags || []) {
      const entry = entries.get(`tag:${value}`);
      if (entry) entry.count += 1;
    }
  }

  const previousMemory = topicBubbleMemory.get(room.code) || new Map();
  const selected = [...entries.values()];
  const nextMemory = new Map();
  selected.forEach(entry => {
    const previous = previousMemory.get(entry.key) || 0;
    nextMemory.set(entry.key, entry.count);
    entry.growing = entry.count > previous;
    entry.selected = entry.count > 0;
  });

  topicBubbleMemory.set(room.code, nextMemory);

  const fieldWidth = 1080;
  const fieldHeight = 460;
  const margin = 18;
  const paddedWidth = fieldWidth - margin * 2;
  const paddedHeight = fieldHeight - margin * 2;
  const cells = [];
  const cols = Math.max(4, Math.ceil(Math.sqrt(selected.length * 1.3)));
  const rows = Math.max(3, Math.ceil(selected.length / cols));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({
        x: margin + ((col + 0.5) / cols) * paddedWidth,
        y: margin + ((row + 0.5) / rows) * paddedHeight
      });
    }
  }

  const occupied = new Set();
  const bubbles = selected
    .map(entry => {
      const seed = hashBubble(`${room.code}:${entry.key}`);
      const box = bubbleBox(entry.kind, entry.label);
      const sizeBoost = entry.count > 0 ? 1 + Math.min(1.2, entry.count * (entry.kind === "category" ? 0.28 : 0.22)) : 1;
      const size = Math.min(520, Math.round(box.width * sizeBoost));
      const startIndex = seed % cells.length;
      let cellIndex = startIndex;
      while (occupied.has(cellIndex)) cellIndex = (cellIndex + 1) % cells.length;
      occupied.add(cellIndex);
      const anchor = cells[cellIndex];
      const jitterX = (((seed >> 5) % 19) - 9) * 1.6;
      const jitterY = (((seed >> 11) % 19) - 9) * 1.2;
      return {
        ...entry,
        seed,
        x: anchor.x + jitterX,
        y: anchor.y + jitterY,
        width: size,
        height: Math.max(42, Math.round(size * 0.58)),
        rotate: ((seed >> 15) % 5) - 2,
        z: (seed >> 20) % 4,
        delay: ((seed >> 9) % 9) / 10
      };
    });

  for (let pass = 0; pass < 18; pass += 1) {
    for (let i = 0; i < bubbles.length; i += 1) {
      for (let j = i + 1; j < bubbles.length; j += 1) {
        const a = bubbles[i];
        const b = bubbles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = (a.width + b.width) / 2 + 18;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const overlap = minDist - distance;
        if (overlap <= 0) continue;

        const push = overlap * 0.14;
        const nx = dx / distance;
        const ny = dy / distance;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }

    for (const bubble of bubbles) {
      const halfW = bubble.width / 2;
      const halfH = bubble.height / 2;
      bubble.x = Math.max(margin + halfW, Math.min(fieldWidth - margin - halfW, bubble.x));
      bubble.y = Math.max(margin + halfH, Math.min(fieldHeight - margin - halfH, bubble.y));
    }
  }

  for (const bubble of bubbles) {
    let crowd = 0;
    for (const other of bubbles) {
      if (other === bubble) continue;
      const dx = Math.abs(other.x - bubble.x);
      const dy = Math.abs(other.y - bubble.y);
      const limit = (bubble.width + other.width) / 2 + 20;
      if (Math.hypot(dx, dy) < limit) crowd += 1;
    }
    const bump = bubble.growing ? 0.28 : 0;
    bubble.scale = bubble.selected
      ? Math.min(2.2, 1.08 + bubble.count * 0.34 + bump)
      : 0.86;
    bubble.float = 7 + ((bubble.seed >> 7) % 7) * 0.55;
    bubble.drift = 0.4 + ((bubble.seed >> 17) % 7) / 14;
  }

  return bubbles.map(bubble => ({
    ...bubble,
    style: `--x:${(bubble.x / fieldWidth) * 100}%;--y:${(bubble.y / fieldHeight) * 100}%;--size:${bubble.width}px;--rotate:${bubble.rotate}deg;--z:${bubble.z};--delay:${bubble.delay}s;--scale:${bubble.scale};--float:${bubble.float}s;--drift:${bubble.drift};`
  }));
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
  const ranked = sortedPlayersByScore(room);
  const signature = ranked.map(player => `${player.id}:${scores[player.id] || 0}`).join("|");
  const previous = hostRankMemory.get(room.code);
  const animate = Boolean(previous && previous.signature !== signature);
  const previousOrder = previous?.order || new Map();
  const previousScores = previous?.scores || {};
  const deltas = new Map();

  if (animate) {
    ranked.forEach((player, index) => {
      const previousIndex = previousOrder.get(player.id);
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

function renderHostPrep(room, trivia) {
  const isSelecting = trivia?.phase === "interest-selecting";
  return html`
    <section class="question-card prep-card">
      <div class="prep-stage-copy">
        <span class="tag">${isSelecting ? "Topic vote" : trivia?.directorMessage || "Preparing round"}</span>
        ${directorCountdown(trivia)}
      </div>
      <h1>${isSelecting ? "Choose keywords on your phone" : "Loading this round"}</h1>
      <p class="fact-line">${isSelecting ? "Pick a few topics you like. Once choices are locked, the big screen will load the round." : "Questions and audio cues are being prepared from the selected topics."}</p>
    </section>
  `;
}

export function renderHostGame(room) {
  const trivia = room.gameState || room.trivia;
  const isPrep = ["interest-selecting", "preferences-locked", "deck-loading"].includes(trivia?.phase);
  const { ranked, deltas, animate } = buildRankSnapshot(room, trivia);
  const currentQuestion = (trivia?.questionIndex ?? 0) + 1;
  const answered = trivia?.answeredPlayerIds || [];
  const question = trivia?.currentQuestion;
  const isReveal = ["answer-reveal", "answer-audio", "scoring", "next-question", "complete"].includes(trivia?.phase);
  const isComplete = trivia?.phase === "complete";

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
          <div class="score-row ${animate && (deltas.get(item.id)?.move || 0) > 0 ? "rank-up" : animate && (deltas.get(item.id)?.move || 0) < 0 ? "rank-down" : ""}">
            <span>${index + 1}</span>
            ${avatarToken(item.avatar)}
            <div class="score-body">
              <strong>${escape(item.nickname)}</strong>
              <span class="score-subline">${isPrep ? "Choosing" : (animate && (deltas.get(item.id)?.move || 0) > 0 ? "Moved up" : animate && (deltas.get(item.id)?.move || 0) < 0 ? "Moved down" : "Holding position")}</span>
            </div>
            <div class="score-meta">
              <em class="${animate && (deltas.get(item.id)?.scoreDelta || 0) ? "score-pulse" : ""}">${trivia?.scores?.[item.id] || 0}</em>
              ${animate && (deltas.get(item.id)?.scoreDelta || 0) ? html`<span class="rank-delta ${deltas.get(item.id).scoreDelta > 0 ? "positive" : "negative"}">${deltas.get(item.id).scoreDelta > 0 ? `+${deltas.get(item.id).scoreDelta}` : deltas.get(item.id).scoreDelta}</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </aside>
    <main class="main trivia-stage">
      <div class="section-title trivia-head">
        <div>
          <h2>${isComplete ? "Final Scores" : `Question ${currentQuestion} / ${trivia?.totalQuestions || 6}`}</h2>
          <p class="muted">${isComplete ? "Cosmic Trivia complete" : isPrep ? `${trivia?.directorMessage || "Preparing"} · ${preferenceProgress(room, trivia)} topic picks locked` : `${trivia?.directorMessage || "Director running"} · ${answered.length}/${trivia?.expectedAnswerCount || room.players.length} answers locked`}</p>
        </div>
        <div class="director-chip">${withIcon(isComplete ? "trophy" : "play", isComplete ? "Finished" : `${trivia?.phase || "director"} · ${phaseSeconds(trivia)}s`)}</div>
      </div>
      ${isComplete ? html`
        <section class="winner-board">
          ${ranked.map((item, index) => html`
            <article class="winner-row ${index === 0 ? "winner" : ""}">
              <span class="winner-rank">${index + 1}</span>
              ${avatarToken(item.avatar, "large")}
              <strong>${escape(item.nickname)}</strong>
              <em>${trivia?.scores?.[item.id] || 0} pts</em>
            </article>
          `).join("")}
          <button class="primary replay-button" type="button" onclick="fetch('/api/rooms/${escape(room.code)}/trivia/restart',{method:'POST'}).then(()=>location.reload())">${withIcon("play", "Play again")}</button>
        </section>
      ` : isPrep ? renderHostPrep(room, trivia) : html`
        <section class="question-card">
          <span class="tag">${isReveal ? "Answer reveal" : trivia?.phase === "answering" ? "Choose on your phone" : trivia?.directorMessage || "Get ready"}</span>
          ${directorCountdown(trivia)}
          <h1>${escape(question?.question || trivia?.directorMessage || "Loading question...")}</h1>
          <div class="choice-grid">
            ${(question?.answers || []).map((choice, index) => html`
              <div class="choice-tile ${isReveal && choice.id === question.correctAnswer ? "correct" : ""}">
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
  const isReveal = ["answer-reveal", "answer-audio", "scoring", "next-question"].includes(trivia?.phase);
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
        ${directorCountdown(trivia)}
        ${isComplete ? html`
          <div class="phone-trivia-panel">
            <p class="muted">Game complete. Look at the big screen for the final ranking.</p>
          </div>
        ` : isSelecting ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Topic vote</span>
              <h2>Pick your topics</h2>
              <p class="muted">${preferencesLocked ? "Choices locked. Waiting for the round." : "Choose a few topics you want in this round."}</p>
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
        ` : isPreparing ? html`
          <div class="phone-trivia-panel">
            <div class="phone-trivia-question">
              <span class="tag">Round setup</span>
              <h2>Choices locked</h2>
              <p class="muted">The director is loading the selected questions.</p>
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
                <button class="answer-button ${currentAnswer === choice.id ? "selected" : ""}" data-answer="${escape(choice.id)}" ${currentAnswer && currentAnswer !== choice.id ? "disabled" : !isAnswering ? "disabled" : ""}>
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

export const cosmicTriviaClient = {
  id: "cosmic-trivia",
  renderHostGame,
  renderPhoneGame,
  attachPhoneGameHandlers
};

export default cosmicTriviaClient;
