import { escape, html, withIcon } from "../../platform/shared/ui.js";
import { avatarToken } from "../../players/client.js";

const privateStateCache = new Map();
const revealedCards = new Set();

function cacheKey(roomCode, playerId) {
  return `${roomCode}:${playerId}`;
}

function notesKey(roomCode, playerId) {
  return `fateWerewolfNotes:${roomCode}:${playerId}`;
}

function readLocalNote(roomCode, playerId) {
  try {
    return globalThis.localStorage?.getItem(notesKey(roomCode, playerId)) || "";
  } catch {
    return "";
  }
}

function writeLocalNote(roomCode, playerId, value) {
  try {
    globalThis.localStorage?.setItem(notesKey(roomCode, playerId), value);
  } catch {
    // Notes are a local enhancement, so persistence failure should stay silent.
  }
}

function phaseCountdown(gameState) {
  const endsAt = Number(gameState?.phaseEndsAt || 0);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function stageClass(gameState) {
  return gameState?.phaseGroup === "day" ? "werewolf-stage-day" : "werewolf-stage-night";
}

function phoneHeroTitle(gameState) {
  if (gameState?.phaseGroup === "day") return "Daytime";
  if (gameState?.phase === "first-night") return "First night";
  return "Night";
}

function stageHeader(gameState) {
  const seconds = phaseCountdown(gameState);
  return html`
    <div class="werewolf-stage-topline">
      <span class="werewolf-chip">${escape(String(gameState?.phase || "waiting").replace(/-/g, " "))}</span>
      ${gameState?.phaseEndsAt ? `<span class="werewolf-chip werewolf-chip-strong">${seconds}s</span>` : ""}
    </div>
    <div class="werewolf-stage-title-wrap">
      <span class="werewolf-stage-kicker">Cycle ${escape(gameState?.cycle || 1)}</span>
      <h1 class="werewolf-stage-title">${escape(gameState?.headline || "Fate Werewolf")}</h1>
      <p class="werewolf-stage-copy">${escape(gameState?.directorMessage || "")}</p>
    </div>
  `;
}

function seatMarkup(seat, index) {
  return html`
    <article class="werewolf-seat ${seat.alive ? "" : "is-dead"}" data-seat-id="${escape(seat.id)}" style="--seat-index:${index}">
      <div class="werewolf-seat-ring">
        <div class="werewolf-seat-avatar">${avatarToken(seat.avatar)}</div>
        ${seat.alive ? "" : `<div class="werewolf-seat-strike">X</div>`}
      </div>
      <h3>${escape(seat.nickname)}</h3>
      <p>${seat.alive ? "Alive" : escape(seat.eliminationReason === "night" ? "Taken at night" : "Voted out")}</p>
    </article>
  `;
}

function fateCardMarkup(gameState) {
  const card = gameState?.currentFateCard;
  if (!card) {
    return html`
      <section class="werewolf-fate-card is-empty">
        <span class="werewolf-fate-kicker">Daily fate</span>
        <h2>No fate card yet</h2>
        <p>The first omen will appear after the first night resolves.</p>
      </section>
    `;
  }

  return html`
    <section class="werewolf-fate-card werewolf-fate-${escape(card.tendency)}">
      <span class="werewolf-fate-kicker">Daily fate · ${escape(card.tendencyLabel || card.tendency)}</span>
      <h2>${escape(card.title)}</h2>
      <p>${escape(card.text)}</p>
      ${card.scope === "blessing" ? `<small>An anonymous player has received a private tarot blessing.</small>` : ""}
    </section>
  `;
}

function renderHostRail(room) {
  const gameState = room.gameState || {};
  return html`
    <aside class="sidebar werewolf-sidebar">
      <div class="werewolf-rail">
        <section class="werewolf-panel">
          <h2>Game Pulse</h2>
          <div class="werewolf-stats">
            <div><span>Living</span><strong>${escape(gameState.livingCount || 0)}</strong></div>
            <div><span>Lost</span><strong>${escape(gameState.eliminatedCount || 0)}</strong></div>
            <div><span>Night acts</span><strong>${escape(gameState.currentNightActionCount || 0)}/${escape(gameState.expectedNightActionCount || 0)}</strong></div>
            <div><span>Votes</span><strong>${escape(gameState.currentVoteCount || 0)}/${escape(gameState.expectedVoteCount || 0)}</strong></div>
          </div>
        </section>
        <section class="werewolf-panel">
          <h2>Prototype Scope</h2>
          <ul class="werewolf-note-list">
            ${(gameState.prototypeNotes || []).map(note => `<li>${escape(note)}</li>`).join("")}
          </ul>
        </section>
        <section class="werewolf-panel">
          <h2>Fate Council</h2>
          <div class="werewolf-fate-summary">
            <p>${gameState?.fateResult ? `Today's fate leaned toward ${escape(gameState.fateResult.dominantTitle)}.` : "No fate result has been revealed yet."}</p>
            <p class="werewolf-meta">Dead votes: ${escape(gameState.deadVoteCount || 0)}/${escape(gameState.expectedDeadVoteCount || 0)}</p>
          </div>
        </section>
        <section class="werewolf-panel werewolf-panel-controls">
          <h2>Director Controls</h2>
          <button class="secondary" type="button" data-werewolf-next>${withIcon("right", "Advance phase")}</button>
          <button class="ghost" type="button" data-werewolf-restart>${withIcon("play", "Restart ritual")}</button>
        </section>
      </div>
    </aside>
  `;
}

export function renderHostGame(room) {
  const gameState = room.gameState || {};
  return html`
    ${renderHostRail(room)}
    <main class="main werewolf-main ${stageClass(gameState)}">
      <section class="werewolf-stage">
        <div class="werewolf-ornament werewolf-ornament-top"></div>
        <div class="werewolf-ornament werewolf-ornament-bottom"></div>
        ${stageHeader(gameState)}
        ${fateCardMarkup(gameState)}
        <section class="werewolf-seat-grid">
          ${(gameState.seats || []).map((seat, index) => seatMarkup(seat, index)).join("")}
        </section>
      </section>
    </main>
  `;
}

function renderRoleCard(privateState, isRevealed) {
  const role = privateState?.role || {};
  return html`
    <section class="werewolf-phone-card ${isRevealed ? "is-revealed" : ""}">
      <div class="werewolf-phone-card-face werewolf-phone-card-back">
        <span class="werewolf-card-crescent"></span>
        <span class="werewolf-card-eyebrow">Destiny keeps its mask on</span>
        <strong>Tap to reveal</strong>
      </div>
      <div class="werewolf-phone-card-face werewolf-phone-card-front werewolf-accent-${escape(role.accent || "gold")}">
        <span class="werewolf-card-team">${escape(role.team || "")}</span>
        <h2>${escape(role.cardTitle || "")}</h2>
        <h3>${escape(role.name || "")}</h3>
        <p>${escape(role.summary || "")}</p>
        <small>${escape(role.abilityStatus || "")}</small>
      </div>
    </section>
  `;
}

function renderTargets(action, attributeName) {
  return html`
    <div class="werewolf-target-grid">
      ${(action?.targets || []).map(target => html`
        <button
          class="werewolf-target-button ${action.selectedTargetId === target.id ? "is-selected" : ""}"
          type="button"
          ${attributeName}="${escape(target.id)}"
        >
          <span>${escape(target.nickname)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderFateTendencies(action) {
  return html`
    <div class="werewolf-target-grid werewolf-fate-grid">
      ${(action?.tendencies || []).map(entry => html`
        <button
          class="werewolf-target-button ${action.selectedTendency === entry.id ? "is-selected" : ""}"
          type="button"
          data-fate-tendency="${escape(entry.id)}"
        >
          <strong>${escape(entry.title)}</strong>
          <span>${escape(entry.label)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderPhoneAction(privateState) {
  const action = privateState?.action;
  if (!action) {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Current task</h2>
        <p>${escape(privateState?.promptBody || "Wait for the next phase.")}</p>
      </section>
    `;
  }

  if (action.type === "confirm-role") {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Current task</h2>
        <p>${escape(privateState?.promptBody || "")}</p>
        <button class="primary" type="button" data-werewolf-action="confirm-role" ${action.disabled ? "disabled" : ""}>
          ${withIcon("check", escape(action.label))}
        </button>
      </section>
    `;
  }

  if (action.type === "night-target") {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Choose a victim</h2>
        <p>${escape(privateState?.promptBody || "")}</p>
        ${renderTargets(action, "data-night-target")}
      </section>
    `;
  }

  if (action.type === "vote-target") {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Cast your vote</h2>
        <p>${escape(privateState?.promptBody || "")}</p>
        ${renderTargets(action, "data-vote-target")}
      </section>
    `;
  }

  if (action.type === "fate-vote") {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Fate Council</h2>
        <p>${escape(privateState?.promptBody || "")}</p>
        ${renderFateTendencies(action)}
      </section>
    `;
  }

  return "";
}

function renderPrivateFacts(privateState) {
  if (!privateState) {
    return html`
      <section class="werewolf-phone-panel">
        <h2>Fate channel</h2>
        <p>Connecting to your private role channel...</p>
      </section>
    `;
  }

  return html`
    <section class="werewolf-phone-panel">
      <h2>Fate channel</h2>
      <p>${escape(privateState.promptTitle || "")}</p>
      ${privateState.oracleWhisper?.text ? `<div class="werewolf-whisper"><strong>Whisper:</strong> ${escape(privateState.oracleWhisper.text)}</div>` : ""}
      ${privateState.privateBlessing ? `<div class="werewolf-blessing"><strong>Blessing:</strong> ${escape(privateState.privateBlessing)}</div>` : ""}
      ${privateState.packmates?.length ? `<div class="werewolf-packmates">Packmates: ${privateState.packmates.map(item => escape(item.nickname)).join(", ")}</div>` : ""}
      ${!privateState.alive ? `<div class="werewolf-death-tag">You are dead in this prototype round.</div>` : ""}
    </section>
  `;
}

function renderNotes(room, player) {
  const saved = readLocalNote(room.code, player.id);
  return html`
    <section class="werewolf-phone-panel">
      <h2>Notes</h2>
      <textarea class="werewolf-notes" data-werewolf-notes placeholder="Track suspicion, trust, and contradictions...">${escape(saved)}</textarea>
    </section>
  `;
}

export function renderPhoneGame(room, player, chrome = {}) {
  const gameState = room.gameState || {};
  const privateState = privateStateCache.get(cacheKey(room.code, player.id)) || null;
  const cardRevealed = revealedCards.has(cacheKey(room.code, player.id));
  return html`
    <main class="werewolf-phone-shell ${stageClass(gameState)}">
      ${chrome.header || ""}
      <div class="werewolf-phone-flow">
        <section class="werewolf-phone-hero">
          <span class="werewolf-phone-phase">${escape(gameState.headline || "")}</span>
          <h1>${escape(phoneHeroTitle(gameState))}</h1>
          <p>${escape(gameState.directorMessage || "")}</p>
        </section>
        ${fateCardMarkup(gameState)}
        <button class="werewolf-card-toggle" type="button" data-reveal-card>
          ${renderRoleCard(privateState, cardRevealed)}
        </button>
        ${renderPrivateFacts(privateState)}
        ${renderPhoneAction(privateState)}
        ${renderNotes(room, player)}
        ${chrome.switcher || ""}
      </div>
    </main>
  `;
}

async function loadPrivateState(room, player, api, onRoom) {
  const key = cacheKey(room.code, player.id);
  const cached = privateStateCache.get(key);
  const phase = room.gameState?.phase || "";
  const publicSeat = (room.gameState?.seats || []).find(seat => seat.id === player.id) || null;
  if (cached && cached.phase === phase && cached.alive === Boolean(publicSeat?.alive)) return;
  const data = await api(`/api/rooms/${room.code}/werewolf/private/${player.id}`);
  privateStateCache.set(key, data.privateState);
  onRoom(room);
}

async function submitAction({ room, player, api, onRoom, type, targetId = "" }) {
  const data = await api(`/api/rooms/${room.code}/werewolf/action`, {
    method: "POST",
    body: { playerId: player.id, type, targetId }
  });
  privateStateCache.set(cacheKey(room.code, player.id), data.privateState);
  onRoom(data.room);
}

export function attachPhoneGameHandlers(root, { room, player, api, onRoom }) {
  void loadPrivateState(room, player, api, onRoom).catch(() => {});

  root.querySelector("[data-reveal-card]")?.addEventListener("click", () => {
    const key = cacheKey(room.code, player.id);
    revealedCards.add(key);
    onRoom(room);
  });

  root.querySelector("[data-werewolf-action=\"confirm-role\"]")?.addEventListener("click", async () => {
    await submitAction({ room, player, api, onRoom, type: "confirm-role" });
  });

  root.querySelectorAll("[data-night-target]").forEach(button => {
    button.addEventListener("click", async event => {
      const targetId = event.currentTarget.dataset.nightTarget || "";
      await submitAction({ room, player, api, onRoom, type: "night-target", targetId });
    });
  });

  root.querySelectorAll("[data-vote-target]").forEach(button => {
    button.addEventListener("click", async event => {
      const targetId = event.currentTarget.dataset.voteTarget || "";
      await submitAction({ room, player, api, onRoom, type: "vote-target", targetId });
    });
  });

  root.querySelectorAll("[data-fate-tendency]").forEach(button => {
    button.addEventListener("click", async event => {
      const tendency = event.currentTarget.dataset.fateTendency || "";
      const data = await api(`/api/rooms/${room.code}/werewolf/action`, {
        method: "POST",
        body: { playerId: player.id, type: "fate-vote", tendency }
      });
      privateStateCache.set(cacheKey(room.code, player.id), data.privateState);
      onRoom(data.room);
    });
  });

  root.querySelector("[data-werewolf-notes]")?.addEventListener("input", event => {
    writeLocalNote(room.code, player.id, event.currentTarget.value);
  });
}

export function attachHostGameHandlers(root, { room, api }) {
  root.querySelector("[data-werewolf-next]")?.addEventListener("click", async () => {
    await api(`/api/rooms/${room.code}/werewolf/next`, { method: "POST" });
  });

  root.querySelector("[data-werewolf-restart]")?.addEventListener("click", async () => {
    await api(`/api/rooms/${room.code}/werewolf/restart`, { method: "POST" });
  });
}

export const fateWerewolfClient = {
  id: "fate-werewolf",
  renderHostGame,
  renderPhoneGame,
  attachHostGameHandlers,
  attachPhoneGameHandlers
};

export default fateWerewolfClient;
