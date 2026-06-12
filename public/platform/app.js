import { escape, html, icon, withIcon } from "./shared/ui.js";
import {
  activePlayers as activeRoomPlayers,
  disconnectedPlayers,
  launchCountdownSeconds,
  playerRingColor,
  readyActivePlayers,
  waitingStatusLabel
} from "./shared/player-status.js";
import {
  avatarEditor,
  avatarToken,
  bindAvatarEditors,
  normalizeAvatarSelection,
  setAvatarCatalog
} from "../players/client.js";

const app = document.querySelector("#app");
const PASSES = [
  { minutes: 60, label: "1 hr", price: "29 kr" },
  { minutes: 120, label: "2 hrs", price: "39 kr" },
  { minutes: 240, label: "4 hrs", price: "59 kr" }
];
const CREDIT_PACKS = [
  { credits: 20, price: "29 kr" },
  { credits: 50, price: "59 kr" },
  { credits: 120, price: "99 kr" }
];
const HOST_POINTS = 120;
const HOST_ACCOUNT_KEY = "joylyHostAccount";
const LEGACY_HOST_ACCOUNT_KEY = "playroomHostAccount";
const CONTROLLER_PAIRED_KEY = "joylyControllerPaired";
const ACTIVE_PAIRING_KEY = "joylyActivePairingToken";
const PLAYER_IDENTITY_KEY = "joylyPlayerIdentity";
const PHONE_SURFACE_KEY = "joylyPhoneSurface";
const ACTIVE_ROOM_CODE_KEY = "joylyActiveRoomCode";

let config = {
  games: [],
  localJoinBase: location.origin,
  tools: {
    jmsStudio: false,
    voiceLibrary: false
  }
};
let room = null;
let player = null;
let playerIdentity = loadPlayerIdentity();
let events = null;
let hostAccount = null;
let hostEntitlement = { points: HOST_POINTS, timePassExpiresAt: 0, hasActiveTimePass: false };
let authOpen = false;
let authNextSurface = "home";
let gamePickerOpen = false;
let paymentOpen = false;
let paymentMode = "time";
let selectedGameId = null;
let selectedMinutes = 60;
let selectedCreditPack = 20;
let joinError = "";
let lobbyError = "";
let activeSurface = "home";
let desktopPairing = null;
let activePairingToken = localStorage.getItem(ACTIVE_PAIRING_KEY) || "";
let pairError = "";
let pairClaimed = false;
let controllerPaired = false;
let pairCodeError = "";
let deviceView = localStorage.getItem("joylyDeviceView") || "desktop";
let phoneSurface = localStorage.getItem(PHONE_SURFACE_KEY) || localStorage.getItem("joylyHostPhoneView") || "room";
let promoIndex = 0;
let authSubmitting = false;
let pairingSubmitting = false;
let closeRoomSubmitting = false;
let phonePlayerEditing = false;
let currentView = "";
let accountMenuOpen = false;
let pendingRoom = null;
let playerHeartbeatTimer = null;
let playerRestoreInFlight = false;
let deferredPlayingRender = false;
let deferredPlayingRenderTimer = null;
let triviaRankAnimationActive = false;
let triviaChoiceAnimationActive = false;
const gameClients = new Map();
let globalActionHandlersAttached = false;

const PLAYER_HEARTBEAT_INTERVAL_MS = 30_000;

const params = new URLSearchParams(location.search);
const joinCode = params.get("room");
const hostCode = params.get("host");
const pairToken = params.get("pair");
const route = pairToken ? "pair" : joinCode ? "join" : "host";

window.addEventListener("cosmic-trivia-rank-animation-start", () => {
  triviaRankAnimationActive = true;
});

window.addEventListener("cosmic-trivia-rank-animation-end", () => {
  triviaRankAnimationActive = false;
});

window.addEventListener("cosmic-trivia-choice-animation-start", () => {
  triviaChoiceAnimationActive = true;
});

window.addEventListener("cosmic-trivia-choice-animation-end", () => {
  triviaChoiceAnimationActive = false;
});

function maybeResumePlayingRender() {
  if (!deferredPlayingRender || deferredPlayingRenderTimer) return;
  if (
    triviaRankAnimationActive ||
    triviaChoiceAnimationActive ||
    document.documentElement.hasAttribute("data-cosmic-trivia-rank-animating") ||
    document.documentElement.hasAttribute("data-cosmic-trivia-choice-animating")
  ) {
    return;
  }

  deferredPlayingRenderTimer = window.setTimeout(() => {
    deferredPlayingRenderTimer = null;
    if (
      triviaRankAnimationActive ||
      triviaChoiceAnimationActive ||
      document.documentElement.hasAttribute("data-cosmic-trivia-rank-animating") ||
      document.documentElement.hasAttribute("data-cosmic-trivia-choice-animating")
    ) {
      maybeResumePlayingRender();
      return;
    }
    deferredPlayingRender = false;
    if (room?.status === "playing") void renderPlaying();
  }, 220);
}

window.addEventListener("cosmic-trivia-rank-animation-end", maybeResumePlayingRender);
window.addEventListener("cosmic-trivia-choice-animation-end", maybeResumePlayingRender);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

async function loadConfig() {
  config = await api("/api/config");
  const playableGame = config.games.find(game => game.status === "playable") || config.games[0];
  const selectedStillExists = config.games.some(game => game.id === selectedGameId && game.status === "playable");
  selectedGameId = selectedStillExists ? selectedGameId : playableGame?.id;
}

async function loadAvatarCatalog() {
  setAvatarCatalog(await api("/api/avatar-catalog"));
}

function makeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadPlayerIdentity() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_IDENTITY_KEY) || "null");
  } catch {
    return null;
  }
}

function savePlayerIdentity(nextIdentity) {
  if (!nextIdentity?.playerId) return;
  playerIdentity = {
    playerId: String(nextIdentity.playerId),
    nickname: String(nextIdentity.nickname || "").trim().slice(0, 24),
    avatar: nextIdentity.avatar || null
  };
  localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(playerIdentity));
}

function ensurePlayerIdentity() {
  if (!playerIdentity?.playerId) {
    savePlayerIdentity({ playerId: makeId(), nickname: "", avatar: null });
  }
  return playerIdentity;
}

function syncPlayerIdentityFromPlayer(nextPlayer) {
  if (!nextPlayer?.id) return;
  savePlayerIdentity({
    playerId: nextPlayer.id,
    nickname: nextPlayer.nickname || "",
    avatar: nextPlayer.avatar || null
  });
}

function recoverPlayerFromRoom(nextRoom = room) {
  if (!nextRoom || !playerIdentity?.playerId) return null;
  const matched = nextRoom.players?.find?.(item => item.id === playerIdentity.playerId) || null;
  if (!matched) return null;
  player = matched;
  syncPlayerIdentityFromPlayer(matched);
  return matched;
}

function rememberRoomCode(nextRoom) {
  if (nextRoom?.code) localStorage.setItem(ACTIVE_ROOM_CODE_KEY, nextRoom.code);
}

function forgetRoomCode() {
  localStorage.removeItem(ACTIVE_ROOM_CODE_KEY);
}

function selectedGame() {
  return config.games.find(game => game.id === selectedGameId) || config.games[0];
}

function qrImageUrl(value, size = 164) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

function isTextEntryActive() {
  const element = document.activeElement;
  return Boolean(element && ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));
}

function isPhoneViewport() {
  return deviceView === "mobile" || window.matchMedia?.("(max-width: 700px)")?.matches;
}

function isInteractionLocked() {
  return accountMenuOpen || authOpen || gamePickerOpen || paymentOpen || isTextEntryActive() || Boolean(document.querySelector("#hostPlayerForm, #joinForm"));
}

function applyPendingRoom() {
  if (!pendingRoom || isInteractionLocked()) return;
  const nextRoom = pendingRoom;
  pendingRoom = null;
  const previousStatus = room?.status;
  room = nextRoom;
  applyRoomUpdate(previousStatus);
}

function accountFromForm(formElement) {
  const form = new FormData(formElement);
  return {
    name: String(form.get("hostName") || "Host"),
    email: String(form.get("email") || "host@example.com")
  };
}

async function claimPairing(account) {
  const data = await api(`/api/pairings/${pairToken}/claim`, {
    method: "POST",
    body: account
  });
  hostAccount = data.account;
  controllerPaired = true;
  pairClaimed = true;
  activePairingToken = pairToken;
  localStorage.setItem(CONTROLLER_PAIRED_KEY, "true");
  localStorage.setItem(ACTIVE_PAIRING_KEY, activePairingToken);
  if (data.entitlement) hostEntitlement = data.entitlement;
  if (data.room) {
    room = data.room;
    selectedGameId = room.selectedGame?.id || selectedGameId;
    activeSurface = "room";
    connect(room.code);
    recoverPlayerFromRoom(room);
  } else {
    activeSurface = "setup";
  }
  saveHostAccount();
  return data;
}

async function signInHost(account) {
  hostAccount = account;
  controllerPaired = false;
  activePairingToken = "";
  localStorage.removeItem(CONTROLLER_PAIRED_KEY);
  localStorage.removeItem(ACTIVE_PAIRING_KEY);
  saveHostAccount();
  await loadHostEntitlement();
  await loadActiveHostRoom();
}

async function ensureDesktopPairing() {
  if (hostAccount || pairToken || desktopPairing || isPhoneViewport()) return;
  const data = await api("/api/pairings", { method: "POST" });
  desktopPairing = {
    token: data.token,
    url: `${config.localJoinBase}/?pair=${data.token}`
  };
}

async function pollDesktopPairing() {
  if (!desktopPairing?.token) return;
  const data = await api(`/api/pairings/${desktopPairing.token}`);
  if (!data.account) return;
  hostAccount = data.account;
  controllerPaired = true;
  activePairingToken = desktopPairing.token;
  localStorage.setItem(CONTROLLER_PAIRED_KEY, "true");
  localStorage.setItem(ACTIVE_PAIRING_KEY, activePairingToken);
  saveHostAccount();
  if (data.entitlement) hostEntitlement = data.entitlement;
  if (data.room) {
    room = data.room;
    selectedGameId = room.selectedGame?.id || selectedGameId;
    activeSurface = "room";
    connect(room.code);
    recoverPlayerFromRoom(room);
  } else {
    activeSurface = "home";
  }
  desktopPairing = null;
  render();
}

async function syncPairingStatus() {
  if (route !== "host" || !activePairingToken || !hostAccount) return;
  try {
    const data = await api(`/api/pairings/${activePairingToken}`);
    const nextPaired = Boolean(data.paired);
    if (nextPaired === controllerPaired) return;
    controllerPaired = nextPaired;
    if (controllerPaired) {
      localStorage.setItem(CONTROLLER_PAIRED_KEY, "true");
    } else {
      localStorage.removeItem(CONTROLLER_PAIRED_KEY);
      localStorage.removeItem(ACTIVE_PAIRING_KEY);
      activePairingToken = "";
    }
    render();
  } catch {
    controllerPaired = false;
    activePairingToken = "";
    localStorage.removeItem(CONTROLLER_PAIRED_KEY);
    localStorage.removeItem(ACTIVE_PAIRING_KEY);
    render();
  }
}

async function releasePairing() {
  const token = pairToken || activePairingToken;
  if (!token) return;
  try {
    await api(`/api/pairings/${token}/release`, { method: "POST" });
  } catch {
    // The phone can still leave locally if the desktop pairing has expired.
  }
  pairClaimed = false;
  controllerPaired = false;
  activePairingToken = "";
  localStorage.removeItem(CONTROLLER_PAIRED_KEY);
  localStorage.removeItem(ACTIVE_PAIRING_KEY);
}

async function syncHostRoom() {
  if (route !== "host" || !hostAccount?.email) return;
  const data = await api(`/api/hosts/${encodeURIComponent(hostAccount.email)}/room`);
  if (data.entitlement) hostEntitlement = data.entitlement;
  if (data.room) {
    const previousCode = room?.code;
    const previousStatus = room?.status;
    const changed = !room || room.code !== data.room.code || room.status !== data.room.status || room.players.length !== data.room.players.length;
    room = data.room;
    rememberRoomCode(room);
    selectedGameId = room.selectedGame?.id || selectedGameId;
    if (!events || previousCode !== room.code) connect(room.code);
    if (changed) activeSurface = "room";
    recoverPlayerFromRoom(room);
    if (changed) applyRoomUpdate(previousStatus);
  }
}

async function loadGameClient(game = room?.selectedGame || selectedGame()) {
  if (!game?.clientModule) throw new Error("This game package is not available.");
  if (!gameClients.has(game.id)) {
    const module = await import(game.clientModule);
    if (!module.default) throw new Error(`${game.title} package is missing a default client export.`);
    gameClients.set(game.id, module.default);
  }
  return gameClients.get(game.id);
}

function selectedPass() {
  return PASSES.find(item => item.minutes === selectedMinutes) || PASSES[0];
}

function remainingTime() {
  const expiresAt = room?.entitlement?.expiresAt || hostEntitlement?.timePassExpiresAt;
  if (!expiresAt || expiresAt <= Date.now()) return "--";
  const minutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function hasActiveTimePass() {
  return Boolean(hostEntitlement?.timePassExpiresAt && hostEntitlement.timePassExpiresAt > Date.now());
}

function saveHostAccount() {
  if (hostAccount) {
    localStorage.setItem(HOST_ACCOUNT_KEY, JSON.stringify(hostAccount));
    localStorage.removeItem(LEGACY_HOST_ACCOUNT_KEY);
  }
}

function loadHostAccount() {
  try {
    const savedAccount = localStorage.getItem(HOST_ACCOUNT_KEY) || localStorage.getItem(LEGACY_HOST_ACCOUNT_KEY);
    hostAccount = JSON.parse(savedAccount || "null");
    controllerPaired = localStorage.getItem(CONTROLLER_PAIRED_KEY) === "true";
    if (hostAccount && localStorage.getItem(LEGACY_HOST_ACCOUNT_KEY)) saveHostAccount();
  } catch {
    hostAccount = null;
    controllerPaired = false;
  }
}

async function loadActiveHostRoom() {
  if (!hostAccount?.email) return null;
  const data = await api(`/api/hosts/${encodeURIComponent(hostAccount.email)}/room`);
  if (data.entitlement) hostEntitlement = data.entitlement;
  if (!data.room) return null;
  room = data.room;
  rememberRoomCode(room);
  selectedGameId = room.selectedGame?.id || selectedGameId;
  connect(room.code);
  recoverPlayerFromRoom(room);
  return room;
}

async function loadHostEntitlement() {
  if (!hostAccount?.email) return null;
  const data = await api(`/api/hosts/${encodeURIComponent(hostAccount.email)}/entitlement`);
  hostEntitlement = data.entitlement;
  return hostEntitlement;
}

function connect(code) {
  if (events) events.close();
  events = new EventSource(`/api/events/${code}`);
  events.onmessage = event => {
    const payload = JSON.parse(event.data);
    if (payload.room) {
      const previousStatus = room?.status;
      if (isInteractionLocked()) {
        pendingRoom = payload.room;
        return;
      }
      room = payload.room;
      rememberRoomCode(room);
      applyRoomUpdate(previousStatus);
    }
  };
}

function applyRoomUpdate(previousStatus) {
  if (room.status === "closed" && route === "host") {
    room = null;
    forgetRoomCode();
    activeSurface = "home";
    events?.close();
    currentView = "";
    render();
    return;
  }
  if (room.status === "closed" && route === "pair") {
    room = null;
    player = null;
    phonePlayerEditing = false;
    forgetRoomCode();
    activeSurface = "setup";
    events?.close();
    currentView = "";
    render();
    return;
  }
  if (currentView === "lobby" && room.status === "waiting" && previousStatus === "waiting") {
    updateLobbyStage();
    return;
  }
  if ((route === "join" || route === "pair") && player && !room.players.some(item => item.id === player.id)) {
    player = null;
    phonePlayerEditing = false;
    render();
    return;
  }
  if (phonePlayerEditing && (!player || player.ready || room.status !== "waiting")) {
    phonePlayerEditing = false;
  }
  recoverPlayerFromRoom(room);
  if ((route === "join" || route === "pair") && player && room.status === "waiting" && previousStatus === "waiting") {
    if (!updatePhoneStatus()) render();
    return;
  }
  render();
}

function qrUrl() {
  const url = `${config.localJoinBase}/?room=${room.code}`;
  return qrImageUrl(url, 520);
}

function joinUrl() {
  return `${config.localJoinBase}/?room=${room.code}`;
}

function hostUrl() {
  return `${config.localJoinBase}/?host=${room.code}`;
}

function stopPlayerHeartbeat() {
  if (!playerHeartbeatTimer) return;
  clearInterval(playerHeartbeatTimer);
  playerHeartbeatTimer = null;
}

function startPlayerHeartbeat() {
  stopPlayerHeartbeat();
  const hostPhonePlayerSurface = route === "host" && isPhoneViewport() && currentPhoneSurface() === "player";
  if (!player?.id || !room?.code || !(["join", "pair"].includes(route) || hostPhonePlayerSurface)) return;
  if (!["waiting", "playing"].includes(room.status)) return;
  playerHeartbeatTimer = setInterval(async () => {
    if (!player?.id || !room?.code) return;
    if (!["waiting", "playing"].includes(room.status)) return;
    try {
      const data = await api(`/api/rooms/${room.code}/players/${player.id}/ping`, { method: "POST" });
      player = data.player;
      room = data.room;
      if (room.status === "waiting") {
        if (!updatePhoneStatus()) render();
      }
    } catch {
      // The room update stream or next navigation will reconcile removed players.
    }
  }, PLAYER_HEARTBEAT_INTERVAL_MS);
}

function lobbySummaryText({ onlineCount, readyCount, disconnectedCount, maxPlayers }) {
  const reconnecting = disconnectedCount ? ` · ${disconnectedCount} reconnecting` : "";
  return `${onlineCount}/${maxPlayers} active · ${readyCount} ready${reconnecting}`;
}

function isHostPhoneSession() {
  return Boolean(route === "host" && isPhoneViewport() && hostAccount);
}

function currentPhoneSurface() {
  return phoneSurface === "player" ? "player" : "room";
}

function setPhoneSurface(nextSurface) {
  phoneSurface = nextSurface === "player" ? "player" : "room";
  localStorage.setItem(PHONE_SURFACE_KEY, phoneSurface);
  localStorage.setItem("joylyHostPhoneView", phoneSurface);
}

function isRoomSurface() {
  return currentPhoneSurface() === "room";
}

function isPlayerSurface() {
  return currentPhoneSurface() === "player";
}

function canRenderRoomSurface() {
  return Boolean(room && isRoomSurface() && (isHostPhoneSession() || route === "pair" || Boolean(player)));
}

function phoneHeader() {
  const showHostViewToggle = Boolean(room && (isHostPhoneSession() || route === "pair" || Boolean(player)));
  const hostViewLabel = isPlayerSurface() ? "Room view" : "Player view";
  const showHostLogout = isHostPhoneSession();
  return html`
    <header class="phone-topbar">
      <button class="brand brand-button" data-phone-home type="button" aria-label="Home"><span class="brand-mark">J</span> Joyly Games</button>
      <div class="phone-topbar-actions">
        ${showHostViewToggle ? `<button class="secondary btn-tool" data-host-phone-view-toggle type="button">${withIcon("users", hostViewLabel)}</button>` : ""}
        ${showHostLogout ? `<button class="ghost btn-danger" data-phone-logout type="button">${withIcon("logout", "Log out")}</button>` : ""}
      </div>
    </header>
  `;
}

function phoneSurfaceShell({ body, includeRoomSwitcher = false, includeGamePicker = false }) {
  return html`
    <main class="phone-wrap">
      ${phoneHeader()}
      <div class="phone-flow">
        ${body}
        ${includeRoomSwitcher ? phoneRoomSwitcher() : ""}
      </div>
      ${includeGamePicker ? gamePickerModal() : ""}
    </main>
  `;
}

function phonePlayerEditCard() {
  return html`
    <form class="join-card" id="phonePlayerEditForm">
      <h1>Edit avatar</h1>
      <p class="muted">Update your nickname and look before you mark yourself ready.</p>
      <label class="field">
        <span>Nickname</span>
        <input name="nickname" maxlength="24" value="${escape(player.nickname || "")}" autofocus />
      </label>
      <div class="error field-error" id="phonePlayerEditError"></div>
      ${avatarEditor(player.avatar)}
      <button class="ghost btn-action" type="button" id="cancelPlayerEdit">Cancel</button>
    </form>
  `;
}

function phonePlayerViewBody({ statusText, ringColor }) {
  return phonePlayerStatusCard({ statusText, ringColor });
}

function phoneRoomViewBody({ launchState, activePlayers, readyPlayers }) {
  return html`
    ${phoneRoomSurfaceCard({ launchState, activePlayers, readyPlayers })}
    ${phoneHostControls()}
  `;
}

function phonePlayerSurfaceBody({ statusText, ringColor }) {
  return html`
    ${phonePlayerViewBody({ statusText, ringColor })}
    ${isHostPhoneSession() && isRoomSurface() ? phoneHostControls() : ""}
  `;
}

function phonePlayerEditSurface() {
  return phoneSurfaceShell({
    body: phonePlayerEditCard()
  });
}

function phonePlayerSurface({ statusText, ringColor }) {
  return phoneSurfaceShell({
    body: phonePlayerSurfaceBody({ statusText, ringColor }),
    includeRoomSwitcher: showPhoneRoomSwitcher()
  });
}

function renderPairPage() {
  if (pairClaimed && hostAccount) return renderHost();
  app.innerHTML = html`
    <main class="phone-wrap">
      ${phoneHeader()}
      <form class="join-card" id="pairForm">
        <h1>Pair host phone</h1>
        <p class="muted">Sign in here. The big screen will follow this host account.</p>
        <label class="field">
          <span>Display name</span>
          <input name="hostName" value="${escape(hostAccount?.name || "Neil")}" autocomplete="name" />
        </label>
        <label class="field">
          <span>Email</span>
          <input name="email" value="${escape(hostAccount?.email || "host@example.com")}" autocomplete="email" />
        </label>
        ${pairError ? `<p class="error">${escape(pairError)}</p>` : ""}
        <button class="primary btn-action" type="button" id="pairContinue">${withIcon("login", "Continue")}</button>
      </form>
    </main>
  `;
  attachPhoneChromeHandlers();
  const submitPairing = async formElement => {
    if (pairingSubmitting) return;
    const submitButton = document.querySelector("#pairContinue");
    try {
      pairingSubmitting = true;
      pairError = "";
      if (submitButton) submitButton.disabled = true;
      await claimPairing(accountFromForm(formElement));
      render();
    } catch (error) {
      pairError = error.message;
      pairingSubmitting = false;
      renderPairPage();
    }
  };
  document.querySelector("#pairForm")?.addEventListener("submit", event => {
    event.preventDefault();
    submitPairing(event.currentTarget);
  });
  document.querySelector("#pairContinue")?.addEventListener("click", () => {
    const formElement = document.querySelector("#pairForm");
    if (formElement) submitPairing(formElement);
  });
}

function showPhoneRoomSwitcher() {
  return Boolean(room) && isRoomSurface();
}

function phoneRoomSwitcher() {
  return html`
    <section class="join-card phone-switch-card" data-phone-switch-room>
      <strong>Join another room</strong>
      <div class="phone-room-switcher">
        <input name="code" inputmode="numeric" maxlength="6" placeholder="Room code" />
        <button class="secondary btn-action" type="button" data-phone-switch-submit>${withIcon("login", "Join another room")}</button>
      </div>
    </section>
  `;
}

function attachPhoneChromeHandlers() {
  document.querySelector("[data-phone-home]")?.addEventListener("click", () => {
    if (isHostPhoneSession()) {
      activeSurface = "home";
      setPhoneSurface("room");
      render();
      return;
    }
    location.href = "/";
  });
  document.querySelector("[data-host-phone-view-toggle]")?.addEventListener("click", () => {
    setPhoneSurface(isPlayerSurface() ? "room" : "player");
    render();
  });
  document.querySelector("[data-phone-logout]")?.addEventListener("click", async () => {
    if (isPairedHostPhone()) await releasePairing();
    localStorage.removeItem(HOST_ACCOUNT_KEY);
    localStorage.removeItem(LEGACY_HOST_ACCOUNT_KEY);
    localStorage.removeItem(CONTROLLER_PAIRED_KEY);
    localStorage.removeItem(ACTIVE_PAIRING_KEY);
    localStorage.removeItem("joylyHostPhoneView");
    hostAccount = null;
    controllerPaired = false;
    activePairingToken = "";
    setPhoneSurface("room");
    player = null;
    room = null;
    desktopPairing = null;
    activeSurface = "home";
    if (events) events.close();
    location.href = "/";
  });
  document.querySelectorAll("[data-phone-switch-room]").forEach(switcher => {
    const goToRoom = () => {
      const code = String(switcher.querySelector("input")?.value || "").replace(/\D/g, "");
      if (code.length === 6) location.href = `/?room=${code}`;
    };
    switcher.querySelector("[data-phone-switch-submit]")?.addEventListener("click", goToRoom);
    switcher.querySelector("input")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        goToRoom();
      }
    });
  });
}

function topbar(extra = "") {
  return html`
    <header class="topbar ${room ? "" : "floating"}">
      <button class="brand brand-button" id="homeLogo" type="button" aria-label="Home"><span class="brand-mark">J</span> Joyly Games</button>
      ${extra}
    </header>
  `;
}

function roomStatusPill() {
  if (!room) return "";
  return html`
    <button class="room-pill btn-tool" id="openRoomFromTop" type="button">
      ${icon("door")}
      <span>Room ${escape(room.code)}</span>
      <strong>${escape(room.selectedGame?.title || "Lobby")}</strong>
    </button>
  `;
}

function accountMenu() {
  const account = hostAccount || room?.host;
  if (!account) return "";
  return html`
    <div class="account-menu ${accountMenuOpen ? "open" : ""}">
      <button class="host-chip account-trigger btn-tool" id="accountTrigger" type="button" aria-expanded="${accountMenuOpen ? "true" : "false"}">
        ${icon("users")}<span>Host</span><strong>${escape(account.name || "Host")}</strong>
      </button>
      <div class="account-popover">
        <div class="account-head">
          <strong>${escape(account.name || "Host")}</strong>
          <span>${escape(account.email || "")}</span>
        </div>
        <div class="account-stats">
          <div><span>Points</span><strong>${hostEntitlement?.points ?? HOST_POINTS}</strong></div>
          <div><span>Time</span><strong>${remainingTime()}</strong></div>
          <div><span>Balance</span><strong>88 kr</strong></div>
        </div>
        <button class="menu-row btn-tool" id="menuSettings" type="button">${withIcon("settings", "User settings")}</button>
        ${room ? `<button class="menu-row btn-tool" id="menuRoom" type="button">${withIcon("door", `Room ${escape(room.code)} · ${escape(room.status)}`)}</button>` : ""}
        ${room ? `<button class="menu-row danger btn-danger" id="menuCloseRoom" type="button">${withIcon("power", "Close room")}</button>` : ""}
        <button class="menu-row danger btn-danger" id="logoutHost" type="button">${withIcon("logout", "Log out")}</button>
      </div>
    </div>
  `;
}

function topbarActions() {
  const waitingForPairedPhone = isDesktopControlledByPairedPhone();
  const voiceLibraryAction = config.tools?.voiceLibrary
    ? `<button class="secondary btn-action" data-open-voice-library type="button">${withIcon("music", "Voice library")}</button>`
    : "";
  const deviceToggle = html`
    <div class="device-toggle" aria-label="Preview device">
      <button class="icon-button btn-tool ${deviceView === "desktop" ? "active btn-selected" : ""}" data-device-view="desktop" type="button" aria-label="Desktop view">${icon("desktop")}</button>
      <button class="icon-button btn-tool ${deviceView === "mobile" ? "active btn-selected" : ""}" data-device-view="mobile" type="button" aria-label="Phone view">${icon("mobile")}</button>
    </div>
  `;
  if (hostAccount || room) {
    return html`
      <nav class="home-actions">
        ${deviceToggle}
        ${voiceLibraryAction}
        ${roomStatusPill()}
        ${!room && !waitingForPairedPhone ? `<button class="primary btn-play" data-start-setup>${withIcon("play", "Play")}</button>` : ""}
        ${accountMenu()}
      </nav>
    `;
  }
  return html`
    <nav class="home-actions">
      ${deviceToggle}
      ${voiceLibraryAction}
      <button class="secondary btn-action" data-open-auth>${withIcon("login", "Sign in")}</button>
      <button class="primary btn-play" data-open-auth data-auth-next="setup">${withIcon("play", "Play")}</button>
    </nav>
  `;
}

function pairAction() {
  if (pairToken) return "";
  if (isDesktopControlledByPairedPhone() && hostAccount && !room) {
    return html`
      <aside class="action-card pair-card paired">
        <div class="action-icon">${icon("check")}</div>
        <div>
          <span class="action-label">Pair phone and screen</span>
          <strong>Phone paired</strong>
          <span>Waiting for your phone to create a room.</span>
        </div>
      </aside>
    `;
  }
  if (hostAccount) return "";
  if (!desktopPairing) {
    return html`
      <aside class="action-card pair-card pair-entry-card">
        <div class="action-icon">${icon("mobile")}</div>
        <div class="pair-copy">
          <span class="action-label">Pair phone and screen</span>
          <strong>Enter the desktop pair code</strong>
          <span>Use the code shown on the big screen to sync this phone as the host controller.</span>
          <form class="pair-inline-form" id="pairByCode">
            <input name="code" inputmode="text" maxlength="5" placeholder="Pair code" />
            <button class="secondary btn-action" type="button" data-pair-code-submit>${withIcon("mobile", "Pair")}</button>
          </form>
          <span class="error" id="pairCodeError">${pairCodeError ? escape(pairCodeError) : ""}</span>
        </div>
      </aside>
    `;
  }
  const displayCode = desktopPairing.token.toUpperCase();
  return html`
    <aside class="action-card pair-card">
      <img src="${qrImageUrl(desktopPairing.url, 132)}" alt="Host phone pairing QR code" />
      <div class="pair-copy">
        <span class="action-label">Pair phone and screen</span>
        <strong>Sync your phone with this desktop</strong>
        <span>Pairing lets the host use a phone to choose games, pay, and create rooms while this screen follows along.</span>
        <form class="pair-inline-form" id="pairByCode">
          <input name="code" inputmode="text" maxlength="5" placeholder="Pair code" value="${escape(displayCode)}" />
          <button class="secondary btn-action" type="button" data-pair-code-submit>${withIcon("mobile", "Pair")}</button>
        </form>
        <span class="error" id="pairCodeError">${pairCodeError ? escape(pairCodeError) : ""}</span>
      </div>
    </aside>
  `;
}

function createRoomAction() {
  if (isDesktopControlledByPairedPhone() && hostAccount && !room) {
    return html`
      <div class="action-card create-card waiting-card">
        <div class="action-icon">${icon("mobile")}</div>
        <div>
          <span class="action-label">Start a Jam</span>
          <strong>Use your phone</strong>
          <span>Choose game, pay, then this screen opens the lobby.</span>
        </div>
      </div>
    `;
  }
  const playAttr = hostAccount ? "data-start-setup" : "data-open-auth data-auth-next=\"setup\"";
  return html`
    <button class="action-card create-card primary hero-button btn-play" ${playAttr}>
      ${icon("play")}
      <span>
        <strong>Start a Jam</strong>
      </span>
    </button>
  `;
}

function joinRoomAction() {
  return html`
    <form class="action-card join-code-card" id="joinByCode">
      <div class="join-code-card-copy">
        <span class="action-label">Join room</span>
      </div>
      <div class="join-code-row">
        <input name="code" inputmode="numeric" maxlength="6" placeholder="Room code" />
        <button class="secondary btn-action" type="button" data-join-code-submit>${withIcon("login", "Join")}</button>
      </div>
      <span class="error" id="joinCodeError">${joinError ? escape(joinError) : ""}</span>
    </form>
  `;
}

function attachChromeHandlers() {
  attachGlobalActionHandlers();
  document.querySelector("#accountTrigger")?.addEventListener("click", event => {
    event.stopPropagation();
    accountMenuOpen = !accountMenuOpen;
    document.querySelector(".account-menu")?.classList.toggle("open", accountMenuOpen);
    document.querySelector("#accountTrigger")?.setAttribute("aria-expanded", accountMenuOpen ? "true" : "false");
    if (!accountMenuOpen) applyPendingRoom();
  });
  document.querySelectorAll(".device-toggle button[data-device-view]").forEach(button => {
    button.addEventListener("click", () => {
      deviceView = button.dataset.deviceView;
      localStorage.setItem("joylyDeviceView", deviceView);
      document.documentElement.dataset.deviceView = deviceView;
      document.querySelectorAll(".device-toggle button[data-device-view]").forEach(item => {
        const active = item.dataset.deviceView === deviceView;
        item.classList.toggle("active", active);
        item.classList.toggle("btn-selected", active);
      });
    });
  });
  document.querySelector("#homeLogo")?.addEventListener("click", () => {
    activeSurface = "home";
    render();
  });
  document.querySelector("#openRoomFromTop")?.addEventListener("click", () => {
    activeSurface = "room";
    render();
  });
  document.querySelector("#menuRoom")?.addEventListener("click", () => {
    activeSurface = "room";
    render();
  });
  document.querySelector("#logoutHost")?.addEventListener("click", async () => {
    await releasePairing();
    localStorage.removeItem(HOST_ACCOUNT_KEY);
    localStorage.removeItem(LEGACY_HOST_ACCOUNT_KEY);
    localStorage.removeItem(CONTROLLER_PAIRED_KEY);
    localStorage.removeItem(ACTIVE_PAIRING_KEY);
    hostAccount = null;
    controllerPaired = false;
    activePairingToken = "";
    room = null;
    desktopPairing = null;
    activeSurface = "home";
    if (events) events.close();
    await ensureDesktopPairing();
    render();
  });
  document.querySelector("#menuCloseRoom")?.addEventListener("click", async () => {
    await closeCurrentRoom();
  });
  document.querySelector("[data-open-voice-library]")?.addEventListener("click", () => {
    location.href = "/voice-library/";
  });
  document.querySelectorAll("[data-close-room]").forEach(button => {
    button.addEventListener("click", async () => {
      await closeCurrentRoom();
    });
  });
  document.querySelectorAll("[data-start-setup]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.gameId) selectedGameId = button.dataset.gameId;
      activeSurface = "setup";
      render();
    });
  });
}

function attachGlobalActionHandlers() {
  if (globalActionHandlersAttached) return;
  globalActionHandlersAttached = true;
  const closeFromMenu = async event => {
    if (event.target.closest("#menuCloseRoom")) {
      event.preventDefault();
      event.stopPropagation();
      await closeCurrentRoom();
    }
  };
  document.addEventListener("pointerdown", event => {
    if (!accountMenuOpen || event.target.closest(".account-menu")) return;
    accountMenuOpen = false;
    document.querySelector(".account-menu")?.classList.remove("open");
    document.querySelector("#accountTrigger")?.setAttribute("aria-expanded", "false");
    applyPendingRoom();
  }, true);
  document.addEventListener("pointerdown", closeFromMenu, true);
  document.addEventListener("click", closeFromMenu, true);
}

async function closeCurrentRoom({ nextSurface = "home" } = {}) {
  if (!room || closeRoomSubmitting) return;
  closeRoomSubmitting = true;
  try {
    const code = room.code;
    await api(`/api/rooms/${code}/close`, { method: "POST" });
    room = null;
    forgetRoomCode();
    if (!isPairedHostPhone()) player = null;
    currentView = "";
    activeSurface = nextSurface;
    if (events) events.close();
    render();
  } finally {
    closeRoomSubmitting = false;
  }
}

function gameCards(mode = "play") {
  const playAttr = hostAccount ? "data-start-setup" : "data-open-auth data-auth-next=\"setup\"";
  const waitingForPairedPhone = isDesktopControlledByPairedPhone();
  return config.games.map(game => html`
    <article class="store-card ${game.id === selectedGameId ? "selected" : ""}">
      <div class="game-art game-art-${escape(game.id)}"><span class="tag">${escape(game.genre)}</span></div>
      <div class="game-body">
        <div>
          <h3>${escape(game.title)}</h3>
          <p class="muted">${escape(game.description)}</p>
        </div>
        <div class="game-meta">
          <span>${escape(game.players)}</span>
          <span>${escape(game.mood)}</span>
          <span>${game.status === "playable" ? "Playable" : "Coming soon"}</span>
        </div>
        <button class="primary ${game.status !== "playable" || (waitingForPairedPhone && mode === "play") ? "btn-disabled" : mode === "pick" ? game.id === selectedGameId ? "btn-selected" : "btn-action" : "btn-play"}" ${game.status !== "playable" || (waitingForPairedPhone && mode === "play") ? "disabled" : mode === "pick" ? `data-pick-game="${game.id}"` : `${playAttr} data-game-id="${game.id}"`}>
          ${game.status !== "playable" ? withIcon("star", "Coming soon") : waitingForPairedPhone && mode === "play" ? withIcon("mobile", "Use phone") : mode === "pick" ? withIcon("check", "Select") : withIcon("play", "Play")}
        </button>
      </div>
    </article>
  `).join("");
}

function authModal() {
  if (!authOpen) return "";
  return html`
    <div class="modal-backdrop" id="modalBackdrop">
      <form class="auth-card auth-modal" id="loginForm">
        <button class="icon-button modal-close" type="button" id="closeAuth" aria-label="Close"></button>
        <h2>Host account</h2>
        <p class="muted">Sign in to choose a game and buy play time.</p>
        <label class="field">
          <span>Display name</span>
          <input name="hostName" value="${escape(hostAccount?.name || "Neil")}" autocomplete="name" />
        </label>
        <label class="field">
          <span>Email</span>
          <input name="email" value="${escape(hostAccount?.email || "host@example.com")}" autocomplete="email" />
        </label>
        ${pairError ? `<p class="error">${escape(pairError)}</p>` : ""}
        <button class="primary btn-action" type="button" id="loginContinue">${withIcon("login", "Continue")}</button>
      </form>
    </div>
  `;
}

function gamePickerModal() {
  if (!gamePickerOpen) return "";
  return html`
    <div class="modal-backdrop" id="gameBackdrop">
      <section class="game-picker">
        <button class="icon-button modal-close" type="button" id="closeGamePicker" aria-label="Close"></button>
        <div class="section-title">
          <div>
            <h2>Choose Game</h2>
            <p class="muted">Pick one for this room.</p>
          </div>
        </div>
        <div class="store-grid picker-grid">${gameCards("pick")}</div>
      </section>
    </div>
  `;
}

function paymentModal() {
  if (!paymentOpen) return "";
  const game = selectedGame();
  const pass = selectedPass();
  const creditPack = CREDIT_PACKS.find(item => item.credits === selectedCreditPack) || CREDIT_PACKS[0];
  const availablePoints = hostEntitlement?.points ?? HOST_POINTS;
  const canUsePoints = availablePoints >= game.credits;
  const cta = paymentMode === "time"
    ? `Pay ${pass.price} · Create room`
    : paymentMode === "useCredits"
      ? "Use points · Create room"
      : `Buy ${creditPack.credits} points · Create room`;

  return html`
    <div class="modal-backdrop" id="paymentBackdrop">
      <section class="payment-card">
        <button class="icon-button modal-close" type="button" id="closePayment" aria-label="Close"></button>
        <div class="section-title">
          <div>
            <h2>Payment</h2>
            <p class="muted">${escape(game.title)} · ${escape(game.players)} players</p>
          </div>
        </div>
        <div class="payment-summary-strip">
          <div><span>Game</span><strong>${escape(game.title)}</strong></div>
          <div><span>Points</span><strong>${availablePoints}</strong></div>
          <div><span>Time left</span><strong>${remainingTime()}</strong></div>
        </div>
        <div class="payment-tabs">
          <button class="payment-tab btn-tool ${paymentMode === "time" ? "active btn-selected" : ""}" data-payment-mode="time">${withIcon("card", "Time pass")}</button>
          <button class="payment-tab btn-tool ${paymentMode === "useCredits" ? "active btn-selected" : ""}" data-payment-mode="useCredits">${withIcon("coins", "Use points")}</button>
          <button class="payment-tab btn-tool ${paymentMode === "buyCredits" ? "active btn-selected" : ""}" data-payment-mode="buyCredits">${withIcon("coins", "Buy points")}</button>
        </div>
        ${paymentMode === "time" ? html`
          <div class="price-grid payment-options">
            ${PASSES.map(item => html`
              <button class="price-card btn-tool ${item.minutes === selectedMinutes ? "active btn-selected" : ""}" data-pass="${item.minutes}">
                ${icon("card")}
                <strong>${item.label}</strong>
                <span>${item.price}</span>
              </button>
            `).join("")}
          </div>
        ` : ""}
        ${paymentMode === "useCredits" ? html`
          <div class="points-panel">
            <div><span>Current points</span><strong>${availablePoints}</strong></div>
            <div><span>This game costs</span><strong>${game.credits}</strong></div>
            <div><span>After purchase</span><strong>${Math.max(0, availablePoints - game.credits)}</strong></div>
          </div>
          ${canUsePoints ? "" : `<p class="error">Not enough points for this game.</p>`}
        ` : ""}
        ${paymentMode === "buyCredits" ? html`
          <div class="price-grid payment-options">
            ${CREDIT_PACKS.map(item => html`
              <button class="price-card btn-tool ${item.credits === selectedCreditPack ? "active btn-selected" : ""}" data-credit-pack="${item.credits}">
                ${icon("coins")}
                <strong>${item.credits}</strong>
                <span>${item.price}</span>
              </button>
            `).join("")}
          </div>
        ` : ""}
        <button class="primary pay-create btn-play ${paymentMode === "useCredits" && !canUsePoints ? "btn-disabled" : ""}" id="confirmPayment" ${paymentMode === "useCredits" && !canUsePoints ? "disabled" : ""}>${withIcon(paymentMode === "time" ? "card" : "coins", cta)}</button>
      </section>
    </div>
  `;
}

function attachAuthHandlers() {
  document.querySelectorAll("[data-open-auth]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.gameId) selectedGameId = button.dataset.gameId;
      authNextSurface = button.dataset.authNext || "home";
      authOpen = true;
      render();
    });
  });

  document.querySelector("#closeAuth")?.addEventListener("click", () => {
    authOpen = false;
    render();
  });

  document.querySelector("#modalBackdrop")?.addEventListener("click", event => {
    if (event.target.id === "modalBackdrop") {
      authOpen = false;
      render();
    }
  });

  const submitLogin = async formElement => {
    if (authSubmitting) return;
    const submitButton = document.querySelector("#loginContinue");
    const account = accountFromForm(formElement);
    try {
      authSubmitting = true;
      pairError = "";
      if (submitButton) submitButton.disabled = true;
      await signInHost(account);
      authOpen = false;
      if (room) {
        activeSurface = "room";
      } else {
        activeSurface = authNextSurface;
      }
      authSubmitting = false;
      render();
    } catch (error) {
      pairError = error.message;
      authSubmitting = false;
      render();
    }
  };

  document.querySelector("#loginForm")?.addEventListener("submit", event => {
    event.preventDefault();
    submitLogin(event.currentTarget);
  });
  document.querySelector("#loginContinue")?.addEventListener("click", () => {
    const formElement = document.querySelector("#loginForm");
    if (formElement) submitLogin(formElement);
  });
}

function attachPickerHandlers() {
  document.querySelector("#openGamePicker")?.addEventListener("click", () => {
    gamePickerOpen = true;
    render();
  });

  document.querySelector("#closeGamePicker")?.addEventListener("click", () => {
    gamePickerOpen = false;
    render();
  });

  document.querySelector("#gameBackdrop")?.addEventListener("click", event => {
    if (event.target.id === "gameBackdrop") {
      gamePickerOpen = false;
      render();
    }
  });

  document.querySelectorAll("[data-pick-game]").forEach(button => {
    button.addEventListener("click", async () => {
      selectedGameId = button.dataset.pickGame;
      gamePickerOpen = false;
      if (room) {
        const data = await api(`/api/rooms/${room.code}/select-game`, {
          method: "POST",
          body: { gameId: selectedGameId }
        });
        room = data.room;
      }
      render();
    });
  });
}

function createRoomBody() {
  const body = {
    hostName: hostAccount.name,
    email: hostAccount.email,
    gameId: selectedGameId,
    paymentMode: hasActiveTimePass() ? "activeTime" : paymentMode
  };
  if (body.paymentMode === "time") body.minutes = selectedMinutes;
  if (body.paymentMode === "buyCredits") body.credits = selectedCreditPack;
  return body;
}

async function createPaidRoom() {
  const data = await api("/api/rooms", {
    method: "POST",
    body: createRoomBody()
  });
  room = data.room;
  await loadHostEntitlement();
  selectedGameId = room.selectedGame.id;
  activeSurface = "room";
  paymentOpen = false;
  connect(room.code);
  render();
}

function attachPaymentHandlers() {
  document.querySelector("#openPayment")?.addEventListener("click", () => {
    if (hasActiveTimePass()) {
      createPaidRoom();
      return;
    }
    paymentOpen = true;
    render();
  });
  document.querySelector("#closePayment")?.addEventListener("click", () => {
    paymentOpen = false;
    render();
  });
  document.querySelector("#paymentBackdrop")?.addEventListener("click", event => {
    if (event.target.id === "paymentBackdrop") {
      paymentOpen = false;
      render();
    }
  });
  document.querySelectorAll("[data-payment-mode]").forEach(button => {
    button.addEventListener("click", () => {
      paymentMode = button.dataset.paymentMode;
      render();
    });
  });
  document.querySelectorAll("[data-pass]").forEach(button => {
    button.addEventListener("click", () => {
      selectedMinutes = Number(button.dataset.pass);
      render();
    });
  });
  document.querySelectorAll("[data-credit-pack]").forEach(button => {
    button.addEventListener("click", () => {
      selectedCreditPack = Number(button.dataset.creditPack);
      render();
    });
  });
  document.querySelector("#confirmPayment")?.addEventListener("click", createPaidRoom);
}

function renderHome() {
  const featuredGames = config.games.slice(0, 4);
  promoIndex = Math.min(promoIndex, Math.max(0, featuredGames.length - 1));
  app.innerHTML = html`
    <main class="home-screen">
      ${topbar(topbarActions())}
      <section class="home-hero promo-rail" aria-label="Featured games">
        ${featuredGames.map((game, index) => html`
          <article class="promo-slide ${index === promoIndex ? "active" : ""}">
            <div>
              <span class="tag">${escape(game.players)} players · ${escape(game.genre)}</span>
              <h1>${escape(game.title)}</h1>
              <p class="hero-copy">${escape(game.description)}</p>
            </div>
            <div class="featured-game">
              <div class="game-art game-art-${escape(game.id)}"></div>
              <div>
                <span class="tag">${index === 0 ? "Featured" : escape(game.mood)}</span>
                <h2>${escape(game.title)}</h2>
                <p class="muted">${escape(game.mood)} · ${game.status === "playable" ? "Playable now" : "Coming soon"}</p>
              </div>
            </div>
          </article>
        `).join("")}
        <div class="promo-controls">
          <button class="icon-button" id="promoPrev" type="button" aria-label="Previous slide">${icon("left")}</button>
          <div class="promo-dots">
            ${featuredGames.map((game, index) => `<button class="${index === promoIndex ? "active" : ""}" data-promo-index="${index}" type="button" aria-label="Show ${escape(game.title)}"></button>`).join("")}
          </div>
          <button class="icon-button" id="promoNext" type="button" aria-label="Next slide">${icon("right")}</button>
        </div>
      </section>
      <section class="home-action-band">
        <div class="room-action-group">
          ${createRoomAction()}
          ${joinRoomAction()}
        </div>
        <div class="pair-action-group">
          ${pairAction()}
        </div>
      </section>
      <section class="home-store">
        <div class="section-title">
          <div>
            <h2>Game Library</h2>
            <p class="muted">Browse by mood, group size, and party style.</p>
          </div>
        </div>
        <div class="store-grid">${gameCards("play")}</div>
      </section>
      ${authModal()}
    </main>
  `;
  attachChromeHandlers();
  attachAuthHandlers();
  attachPromoHandlers(featuredGames.length);
  attachHomeInputHandlers();
  const joinByCode = async formElement => {
    joinError = "";
    updateInlineError("#joinCodeError", joinError);
    const code = String(new FormData(formElement).get("code") || "").replace(/\D/g, "");
    if (code.length !== 6) {
      joinError = "Enter a 6 digit code.";
      updateInlineError("#joinCodeError", joinError);
      return;
    }
    try {
      await api(`/api/rooms/${code}`);
      location.href = `/?room=${code}`;
    } catch {
      joinError = "Room not found.";
      updateInlineError("#joinCodeError", joinError);
    }
  };
  const pairByCode = formElement => {
    pairCodeError = "";
    updateInlineError("#pairCodeError", pairCodeError);
    const code = String(new FormData(formElement).get("code") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5) {
      pairCodeError = "Enter the 5 character pair code.";
      updateInlineError("#pairCodeError", pairCodeError);
      return;
    }
    location.href = `/?pair=${code}`;
  };
  document.querySelector("#joinByCode")?.addEventListener("submit", event => {
    event.preventDefault();
    joinByCode(event.currentTarget);
  });
  document.querySelector("[data-join-code-submit]")?.addEventListener("click", () => {
    const formElement = document.querySelector("#joinByCode");
    if (formElement) joinByCode(formElement);
  });
  document.querySelector("#pairByCode")?.addEventListener("submit", event => {
    event.preventDefault();
    pairByCode(event.currentTarget);
  });
  document.querySelector("[data-pair-code-submit]")?.addEventListener("click", () => {
    const formElement = document.querySelector("#pairByCode");
    if (formElement) pairByCode(formElement);
  });
}

function updateInlineError(selector, message) {
  const element = document.querySelector(selector);
  if (element) element.textContent = message || "";
}

function updatePromoSlides() {
  document.querySelectorAll(".promo-slide").forEach((slide, index) => {
    slide.classList.toggle("active", index === promoIndex);
  });
  document.querySelectorAll("[data-promo-index]").forEach((button, index) => {
    button.classList.toggle("active", index === promoIndex);
  });
}

function attachPromoHandlers(count) {
  const move = step => {
    if (!count) return;
    promoIndex = (promoIndex + step + count) % count;
    updatePromoSlides();
  };
  document.querySelector("#promoPrev")?.addEventListener("click", () => move(-1));
  document.querySelector("#promoNext")?.addEventListener("click", () => move(1));
  document.querySelectorAll("[data-promo-index]").forEach(button => {
    button.addEventListener("click", () => {
      promoIndex = Number(button.dataset.promoIndex);
      updatePromoSlides();
    });
  });
}

function attachHomeInputHandlers() {
  document.querySelectorAll(".join-code-card input, .pair-inline-form input").forEach(input => {
    input.addEventListener("pointerdown", event => {
      event.stopPropagation();
      input.focus();
    });
    input.addEventListener("click", event => {
      event.stopPropagation();
      input.focus();
    });
  });
  document.querySelector(".join-code-card")?.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    document.querySelector(".join-code-card input")?.focus();
  });
  document.querySelector(".pair-inline-form")?.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    document.querySelector(".pair-inline-form input")?.focus();
  });
}

function renderSetup() {
  const game = selectedGame();
  const activePass = hasActiveTimePass();
  app.innerHTML = html`
    <main class="shell">
      ${topbar(html`
        <nav class="home-actions">${roomStatusPill()}${accountMenu()}</nav>
      `)}
      <section class="setup-page">
        <div class="setup-main">
          <div class="section-title">
            <div>
              <h2>Set Up Room</h2>
              <p class="muted">Choose Cosmic Trivia, then open a 2-8 player room.</p>
            </div>
          </div>
          <button class="selected-game-card" id="openGamePicker">
            <div class="game-art"></div>
            <div>
              <span class="button-kicker">${icon("game")} Choose game</span>
              <span class="tag">${escape(game.genre)}</span>
              <h3>${escape(game.title)}</h3>
              <p class="muted">${escape(game.players)} players · ${escape(game.mood)}</p>
            </div>
          </button>
          <div class="setup-summary">
            <div>${icon("users")}<span>Players choose light sci-fi characters on their phones.</span></div>
            <div>${icon(activePass ? "check" : "music")}<span>${activePass ? `Time pass active · ${remainingTime()} left` : "Bright stage colors are ready for an upbeat music loop."}</span></div>
          </div>
          <button class="primary pay-create btn-play" id="openPayment">${activePass ? withIcon("play", "Create room with active pass") : withIcon("card", "Payment · Create room")}</button>
        </div>
      </section>
      ${gamePickerModal()}
      ${paymentModal()}
    </main>
  `;

  attachChromeHandlers();
  attachPickerHandlers();
  attachPaymentHandlers();
}

function hostShell(content) {
  return html`
    <div class="shell">
      ${topbar(html`
        <nav class="home-actions">
          ${roomStatusPill()}
          ${room?.status === "playing" && hostAccount ? `<button class="secondary btn-tool" id="openGamePicker">${withIcon("game", "Change game")}</button>` : ""}
          ${accountMenu()}
        </nav>
      `)}
      <div class="layout">${content}</div>
      ${gamePickerModal()}
    </div>
  `;
}

function lobbyViewModel() {
  const onlinePlayers = activeRoomPlayers(room);
  const readyCount = readyActivePlayers(room).length;
  const onlineCount = onlinePlayers.length;
  const disconnectedCount = disconnectedPlayers(room).length;
  const totalCount = room.players.length;
  const minPlayers = room.selectedGame?.minPlayers || 2;
  const maxPlayers = room.selectedGame?.maxPlayers || 8;
  const canStart = onlineCount >= minPlayers && onlineCount <= maxPlayers;
  const canForceStart = totalCount >= minPlayers && totalCount <= maxPlayers;
  const allReady = canStart && readyCount === onlineCount;
  const countdownSeconds = launchCountdownSeconds();
  const countdownActive = countdownSeconds > 0;
  const players = room.players.map(item => html`
    <article class="player-bubble ${item.online === false ? "disconnected" : item.ready ? "ready" : "pending"}" data-player-id="${escape(item.id)}">
      ${avatarToken(item.avatar, "large", { ringColor: item.online === false ? "#8f99a6" : item.ready ? "#78d45e" : "#f4b04a" })}
      <strong>${escape(item.nickname)}</strong>
      <span data-player-ready>${item.online === false ? "Disconnected" : item.ready ? "Ready" : "Getting ready"}</span>
    </article>
  `).join("");
  return { readyCount, onlineCount, disconnectedCount, totalCount, minPlayers, maxPlayers, canStart, canForceStart, allReady, countdownSeconds, countdownActive, players };
}

function renderWerewolfTesterPanel() {
  if (room?.selectedGame?.id !== "fate-werewolf") return "";
  const setup = room?.gameSetup;
  const roleOptions = setup?.roleOptions || [];
  const roleAssignments = setup?.roleAssignments || {};
  return html`
    <section class="werewolf-lobby-tester" data-werewolf-lobby-tester>
      <div class="werewolf-lobby-tester-head">
        <div>
          <span class="tag">测试身份</span>
          <h3>给指定玩家指定身份</h3>
        </div>
        <p class="muted">开局前直接指定某位玩家是狼人、神谕者、守护者等；不指定就保持随机发牌。</p>
      </div>
      <div class="werewolf-lobby-role-grid">
        ${room.players.map(item => html`
          <label class="werewolf-lobby-role-card">
            <div class="werewolf-lobby-role-meta">
              ${avatarToken(item.avatar)}
              <strong>${escape(item.nickname)}</strong>
            </div>
            <select data-werewolf-tester-role="${escape(item.id)}">
              ${roleOptions.map(option => `
                <option value="${escape(option.id)}" ${String(roleAssignments[item.id] || "") === String(option.id || "") ? "selected" : ""}>
                  ${escape(option.name)}
                </option>
              `).join("")}
            </select>
          </label>
        `).join("")}
      </div>
    </section>
  `;
}

function lobbyStageMarkup() {
  const {
    readyCount,
    onlineCount,
    disconnectedCount,
    minPlayers,
    maxPlayers,
    canStart,
    canForceStart,
    allReady,
    countdownSeconds,
    countdownActive,
    players
  } = lobbyViewModel();
  const startLabel = countdownActive
    ? `Starting in ${countdownSeconds}s`
    : allReady
      ? "Launch now"
      : canForceStart
        ? "Force start · 5s"
        : `Need ${minPlayers} players`;
  return html`
    <div class="section-title stage-title">
      <div>
        <h2>Party Stage</h2>
        <p class="muted" data-lobby-summary>${lobbySummaryText({ onlineCount, readyCount, disconnectedCount, maxPlayers })}</p>
      </div>
      <div class="host-controls">
        <button class="secondary btn-tool" id="openGamePicker">${withIcon("game", escape(room.selectedGame?.title || "Choose game"))}</button>
        <button class="secondary btn-tool" id="addTestPlayers">${withIcon("users", "Add tester")}</button>
        <button class="ghost danger-button btn-danger" data-close-room>${withIcon("power", "Close")}</button>
        <button class="primary btn-play ${(allReady || canForceStart) ? "" : "btn-disabled"} ${countdownActive ? "btn-selected" : ""}" id="startGame" ${(allReady || canForceStart) && !countdownActive ? "" : "disabled"}>${withIcon("play", startLabel)}</button>
      </div>
    </div>
    <p class="error lobby-error" data-lobby-error>${lobbyError ? escape(lobbyError) : ""}</p>
    <section class="stage-floor">
      <div class="stage-light one"></div>
      <div class="stage-light two"></div>
      <div class="stage-ring" data-stage-ring>
        ${players || `<div class="empty-stage"><strong>Scan to join</strong><span>${minPlayers}-${maxPlayers} players</span></div>`}
      </div>
    </section>
    ${renderWerewolfTesterPanel()}
    <button class="secondary compact-copy btn-action" id="copyLink">${withIcon("copy", "Copy link")}</button>
  `;
}

function attachLobbyStageHandlers() {
  attachPickerHandlers();
  document.querySelectorAll("[data-close-room]").forEach(button => {
    button.addEventListener("click", async () => {
      await closeCurrentRoom();
    });
  });
  document.querySelector("#copyLink")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(joinUrl());
  });
  document.querySelector("#addTestPlayers")?.addEventListener("click", async () => {
    try {
      lobbyError = "";
      const data = await api(`/api/rooms/${room.code}/test-players`, { method: "POST" });
      room = data.room;
      updateLobbyStage();
    } catch (error) {
      lobbyError = error.message;
      updateLobbyStage();
    }
  });
  document.querySelector("#startGame")?.addEventListener("click", async () => {
    try {
      lobbyError = "";
      const { allReady } = lobbyViewModel();
      const data = await api(`/api/rooms/${room.code}/${allReady ? "start" : "force-start"}`, { method: "POST" });
      room = data.room;
      if (room.status === "playing") {
        currentView = "";
        render();
      } else {
        updateLobbyStage();
      }
    } catch (error) {
      lobbyError = error.message;
      updateLobbyStage();
    }
  });
  document.querySelectorAll("[data-werewolf-tester-role]").forEach(select => {
    select.addEventListener("change", async event => {
      try {
        lobbyError = "";
        const playerId = event.currentTarget.dataset.werewolfTesterRole || "";
        const roleId = event.currentTarget.value || "";
        const data = await api(`/api/rooms/${room.code}/werewolf/tester/role`, {
          method: "POST",
          body: { playerId, roleId }
        });
        room = data.room;
        updateLobbyStage();
      } catch (error) {
        lobbyError = error.message;
        updateLobbyStage();
      }
    });
  });
}

function updateLobbyStage() {
  if (currentView !== "lobby") return false;
  const stage = document.querySelector("[data-lobby-stage]");
  if (!stage || !room || room.status !== "waiting") return false;
  stage.innerHTML = lobbyStageMarkup();
  attachLobbyStageHandlers();
  return true;
}

function updateLobbyCountdownOnly() {
  if (currentView !== "lobby") return false;
  const stage = document.querySelector("[data-lobby-stage]");
  if (!stage || !room || room.status !== "waiting") return false;
  const { minPlayers, canForceStart, allReady, countdownSeconds, countdownActive } = lobbyViewModel();
  const startButton = stage.querySelector("#startGame");
  if (!startButton) return false;
  const startLabel = countdownActive
    ? `Starting in ${countdownSeconds}s`
    : allReady
      ? "Launch now"
      : canForceStart
        ? "Force start · 5s"
        : `Need ${minPlayers} players`;
  startButton.disabled = !(allReady || canForceStart) || countdownActive;
  startButton.classList.toggle("btn-disabled", !(allReady || canForceStart));
  startButton.classList.toggle("btn-selected", countdownActive);
  startButton.innerHTML = withIcon("play", startLabel);
  return true;
}

function renderLobby() {
  currentView = "lobby";
  app.innerHTML = hostShell(html`
    <aside class="sidebar">
      <div class="room-code">
        <span class="muted">Room code</span>
        <strong>${room.code}</strong>
      </div>
      <div class="qr-box"><img src="${qrUrl()}" alt="Join room QR code" /></div>
      <a class="join-link" href="${joinUrl()}">${joinUrl()}</a>
      <div class="host-link-card">
        <span class="muted">Host phone control</span>
        <p class="muted">Sign in with ${escape(room.host.email)} on your phone.</p>
      </div>
    </aside>
    <main class="main lobby-stage" data-lobby-stage>
      ${lobbyStageMarkup()}
    </main>
  `);

  attachChromeHandlers();
  attachLobbyStageHandlers();
}

async function renderPlaying() {
  if (
    room?.selectedGame?.id === "cosmic-trivia" &&
    (
      triviaRankAnimationActive ||
      triviaChoiceAnimationActive ||
      document.documentElement.hasAttribute("data-cosmic-trivia-rank-animating") ||
      document.documentElement.hasAttribute("data-cosmic-trivia-choice-animating")
    )
  ) {
    if (!deferredPlayingRender) {
      deferredPlayingRender = true;
    }
    return;
  }

  const client = await loadGameClient(room.selectedGame);
  app.innerHTML = hostShell(client.renderHostGame(room));
  attachChromeHandlers();
  attachPickerHandlers();
  client.attachHostGameHandlers?.(app, { room, api });
}

async function renderHostControlFromUrl() {
  try {
    const data = await api(`/api/rooms/${hostCode}`);
    room = data.room;
    hostAccount = room.host;
    rememberRoomCode(room);
    selectedGameId = room.selectedGame?.id || selectedGameId;
    connect(room.code);
    recoverPlayerFromRoom(room);
    render();
  } catch (error) {
    app.innerHTML = `<main class="phone-wrap"><section class="join-card"><h1>Room not found</h1></section></main>`;
  }
}

function renderHost() {
  const surface = currentPhoneSurface();
  if (pairToken && !pairClaimed) return renderPairPage();
  if (isHostPhoneSession()) {
    if (activeSurface === "home") return renderHome();
    if (room) {
      if (surface === "player") {
        if (player) return renderPhone();
        return renderHostPlayerJoin();
      }
      return renderHostPhoneRoom();
    }
    if (activeSurface === "setup") return renderSetup();
  }
  if (hostCode && room?.status === "playing") return void renderPlaying();
  if (hostCode && room) return renderLobby();
  if (activeSurface === "home") return renderHome();
  if (activeSurface === "setup" && hostAccount) return renderSetup();
  if (room?.status === "playing") return void renderPlaying();
  if (room) return renderLobby();
  if (hostCode) return;
  if (hostAccount) return renderSetup();
  renderHome();
}

async function renderJoin() {
  try {
    const data = await api(`/api/rooms/${joinCode}`);
    room = data.room;
  } catch (error) {
    app.innerHTML = html`
      <main class="phone-wrap">
        ${phoneHeader()}
        <div class="phone-flow">
          <section class="join-card phone-status">
            <h1>Room not found</h1>
            <p class="muted">Ask the host for a new code.</p>
          </section>
        </div>
      </main>
    `;
    attachPhoneChromeHandlers();
    return;
  }

  if (room.status === "closed") {
    app.innerHTML = `<main class="phone-wrap">${phoneHeader()}<div class="phone-flow"><section class="join-card phone-status"><div class="phone-avatar">X</div><h1>Room closed</h1><p class="muted">Ask the host to create a new room.</p></section></div></main>`;
    attachPhoneChromeHandlers();
    return;
  }

  if (!player && !playerRestoreInFlight && playerIdentity?.playerId && playerIdentity?.nickname) {
    try {
      playerRestoreInFlight = true;
      await joinCurrentRoom({
        playerId: playerIdentity.playerId,
        nickname: playerIdentity.nickname,
        avatar: playerIdentity.avatar
      });
      return;
    } catch {
      // Fall back to the manual join form below.
    } finally {
      playerRestoreInFlight = false;
    }
  }

  if (!player) {
    joinError = "";
    app.innerHTML = html`
      <main class="phone-wrap">
        ${phoneHeader()}
        <div class="phone-flow">
          <form class="join-card" id="joinForm">
            <h1>Join ${escape(joinCode)}</h1>
            <p class="muted">Choose your player name and build an avatar for this room.</p>
            <label class="field"><span>Nickname</span><input name="nickname" maxlength="24" value="${escape(playerIdentity?.nickname || "")}" placeholder="Alex" autofocus /></label>
            <div class="error field-error" id="joinError">${joinError ? escape(joinError) : ""}</div>
            ${avatarEditor(playerIdentity?.avatar)}
          </form>
        </div>
      </main>
    `;
    attachPhoneChromeHandlers();
    bindAvatarEditors(app);
    document.querySelector("#joinForm").addEventListener("submit", async event => {
      event.preventDefault();
      const payload = playerPayloadFromForm(event.currentTarget);
      try {
        await joinCurrentRoom(payload);
      } catch (error) {
        document.querySelector("#joinError").textContent = error.message;
      }
    });
    return;
  }

  connect(joinCode);
  render();
}

function playerPayloadFromForm(formElement) {
  const form = new FormData(formElement);
  const avatarValue = form.get("avatar");
  const identity = ensurePlayerIdentity();
  return {
    playerId: identity.playerId,
    nickname: String(form.get("nickname") || ""),
    avatar: normalizeAvatarSelection(avatarValue)
  };
}

async function joinCurrentRoom(payload, errorSelector = "#joinError") {
  const data = await api(`/api/rooms/${room.code}/join`, {
    method: "POST",
    body: payload
  });
  player = data.player;
  room = data.room;
  syncPlayerIdentityFromPlayer(data.player);
  connect(room.code);
  render();
}

async function renderHostPlayerJoin() {
  if (!room) return renderHost();
  if (room.status === "closed") {
    app.innerHTML = html`
      <main class="phone-wrap">
        ${phoneHeader()}
        <section class="join-card phone-status">
          <div class="phone-avatar">X</div>
          <h1>Room closed</h1>
          <p class="muted">Create a new room from this phone.</p>
        </section>
      </main>
    `;
    attachPhoneChromeHandlers();
    return;
  }

  if (!player && !playerRestoreInFlight && playerIdentity?.playerId && playerIdentity?.nickname) {
    try {
      playerRestoreInFlight = true;
      await joinCurrentRoom({
        playerId: playerIdentity.playerId,
        nickname: playerIdentity.nickname,
        avatar: playerIdentity.avatar
      }, "#hostPlayerError");
      return;
    } catch {
      // Continue to the manual form if recovery fails.
    } finally {
      playerRestoreInFlight = false;
    }
  }

  app.innerHTML = html`
    <main class="phone-wrap">
      ${phoneHeader()}
      <div class="phone-flow">
        <form class="join-card" id="hostPlayerForm">
          <h1>Join as host</h1>
          <p class="muted">Choose your player name and build an avatar for Room ${escape(room.code)}.</p>
          <label class="field">
            <span>Nickname</span>
            <input name="nickname" maxlength="24" value="${escape(playerIdentity?.nickname || hostAccount?.name || "Host")}" autofocus />
          </label>
          <div class="error field-error" id="hostPlayerError"></div>
          ${avatarEditor(playerIdentity?.avatar)}
        </form>
      </div>
    </main>
  `;

  attachPhoneChromeHandlers();
  bindAvatarEditors(app);
  const submitHostPlayer = async formElement => {
    try {
      const payload = playerPayloadFromForm(formElement);
      await joinCurrentRoom(payload, "#hostPlayerError");
    } catch (error) {
      document.querySelector("#hostPlayerError").textContent = error.message;
    }
  };
  document.querySelector("#hostPlayerForm")?.addEventListener("submit", event => {
    event.preventDefault();
    submitHostPlayer(event.currentTarget);
  });
}

function renderHostPhoneRoom() {
  if (!room) return renderHost();
  const launchState = phoneHostLaunchState();
  const activePlayers = room.players.filter(item => item.online !== false);
  const readyPlayers = activePlayers.filter(item => item.ready);
  recoverPlayerFromRoom(room);

  app.innerHTML = phoneSurfaceShell({
    body: phoneRoomViewBody({ launchState, activePlayers, readyPlayers }),
    includeRoomSwitcher: true,
    includeGamePicker: true
  });

  attachPhoneChromeHandlers();
  attachPhoneHostControls();
  attachPickerHandlers();
}

function isPairedHostPhone() {
  return Boolean(pairToken && pairClaimed && hostAccount);
}

function isDesktopControlledByPairedPhone() {
  return Boolean(controllerPaired && !isPairedHostPhone());
}

function isHostPhoneController() {
  return Boolean(
    route === "host" &&
    isPhoneViewport() &&
    hostAccount?.email &&
    room?.host?.email &&
    hostAccount.email === room.host.email
  );
}

function phoneHostLaunchState() {
  if (!room) return { canLaunch: false, label: "Need players", endpoint: "force-start", disabled: true };
  const game = room.selectedGame || selectedGame();
  const onlinePlayers = room.players.filter(item => item.online !== false);
  const readyPlayers = onlinePlayers.filter(item => item.ready);
  const onlineCount = onlinePlayers.length;
  const totalCount = room.players.length;
  const allReady = onlineCount >= game.minPlayers && onlineCount <= game.maxPlayers && readyPlayers.length === onlineCount && onlineCount > 0;
  const canForceStart = totalCount >= game.minPlayers && totalCount <= game.maxPlayers;
  const countdownActive = Boolean(room.launchCountdown?.endsAt);
  if (countdownActive) return { canLaunch: false, label: "Starting soon", endpoint: "force-start", disabled: true };
  if (allReady) return { canLaunch: true, label: "Start now", endpoint: "start", disabled: false };
  if (canForceStart) return { canLaunch: true, label: "Force start", endpoint: "force-start", disabled: false };
  return { canLaunch: false, label: `Need ${game.minPlayers} players`, endpoint: "force-start", disabled: true };
}

function phoneHostControls() {
  if (!room || room.status === "closed" || !(isPairedHostPhone() || isHostPhoneController())) return "";
  const launchState = phoneHostLaunchState();
  return html`
    <section class="join-card phone-host-card">
      <div class="phone-host-card-head">
        <span class="action-label">Host controls</span>
        <strong>Control this room</strong>
      </div>
      <div class="phone-host-controls">
        <button class="secondary btn-tool" type="button" data-phone-change-game>${withIcon("game", "Change game")}</button>
        <button class="ghost danger-button btn-danger" type="button" data-phone-close-room>${withIcon("power", "Close room")}</button>
        ${room.status === "waiting" ? `<button class="primary btn-play ${launchState.disabled ? "btn-disabled" : ""}" type="button" data-phone-force-start ${launchState.disabled ? "disabled" : ""}>${withIcon("play", launchState.label)}</button>` : ""}
      </div>
    </section>
  `;
}

function phoneRoomSurfaceCard({ launchState, activePlayers, readyPlayers }) {
  return html`
    <section class="join-card phone-host-room-card">
      <span class="action-label">Room view</span>
      <h1>${escape(room.selectedGame?.title || "Joyly Room")}</h1>
      <div class="phone-host-room-meta">
        <div><span>Room</span><strong>${escape(room.code)}</strong></div>
        <div><span>Players</span><strong>${readyPlayers.length}/${activePlayers.length} ready</strong></div>
      </div>
      <p class="muted">${room.status === "playing" ? "Game is live. Switch to player view to join the action." : launchState.disabled ? launchState.label : "Use your phone to control the room or jump in as a player."}</p>
    </section>
  `;
}

function phonePlayerStatusCard({ statusText, ringColor }) {
  return html`
    <section class="phone-status ${player.online === false ? "is-disconnected" : player.ready ? "is-ready" : "is-pending"}">
      <div class="phone-status-avatar">${avatarToken(player.avatar, "hero", { ringColor })}</div>
      <div class="phone-status-copy">
        <h1>${escape(player.nickname)}</h1>
        <div class="ready-chip">${statusText}</div>
      </div>
      <div class="join-card phone-status-panel">
        ${room.status === "waiting" ? `<button class="primary ready-button ${player.ready ? "btn-selected" : "btn-action"}" id="toggleReady" ${room.launchCountdown?.endsAt ? "disabled" : ""}>${room.launchCountdown?.endsAt ? withIcon("check", "Starting soon") : player.ready ? withIcon("check", "Ready") : withIcon("check", "Tap when ready")}</button>` : ""}
        ${room.status === "waiting" ? `<button class="secondary btn-action ${(player.ready || room.launchCountdown?.endsAt) ? "btn-disabled" : ""}" type="button" id="editPlayerAvatar" ${(player.ready || room.launchCountdown?.endsAt) ? "disabled" : ""}>${withIcon("settings", "Edit avatar")}</button>` : ""}
        <div class="phone-mini">
          <span>${escape(room.code)}</span>
          <strong>${escape(room.selectedGame?.title || "Lobby")}</strong>
        </div>
      </div>
    </section>
  `;
}

function attachPhoneHostControls() {
  document.querySelector("[data-phone-change-game]")?.addEventListener("click", () => {
    gamePickerOpen = true;
    render();
  });
  document.querySelector("[data-phone-close-room]")?.addEventListener("click", async () => {
    await closeCurrentRoom({ nextSurface: "setup" });
  });
  document.querySelector("[data-phone-force-start]")?.addEventListener("click", async () => {
    const launchState = phoneHostLaunchState();
    if (launchState.disabled) return;
    const data = await api(`/api/rooms/${room.code}/${launchState.endpoint}`, { method: "POST" });
    room = data.room;
    render();
  });
}

function updatePhoneStatus() {
  if (!player || !room) return false;
  const currentPlayer = room.players.find(item => item.id === player.id);
  if (!currentPlayer) {
    player = null;
    return false;
  }
  player = currentPlayer;
  syncPlayerIdentityFromPlayer(player);
  const status = document.querySelector(".phone-status");
  if (!status) return false;
  const statusText = {
    waiting: waitingStatusLabel(player, room),
    playing: "Live",
    closed: "Closed"
  }[room.status] || "Ready";
  const ringColor = playerRingColor(player, room);
  status.classList.toggle("is-disconnected", player.online === false);
  status.classList.toggle("is-ready", Boolean(player.ready));
  status.classList.toggle("is-pending", !player.ready && player.online !== false);
  const avatar = status.querySelector(".phone-status-avatar");
  if (avatar) avatar.innerHTML = avatarToken(player.avatar, "hero", { ringColor });
  const chip = status.querySelector(".ready-chip");
  if (chip) chip.textContent = statusText;
  const readyButton = document.querySelector("#toggleReady");
  if (readyButton && room.status === "waiting") {
    readyButton.classList.toggle("btn-selected", Boolean(player.ready));
    readyButton.classList.toggle("btn-action", !player.ready);
    readyButton.innerHTML = withIcon("check", room.launchCountdown?.endsAt ? "Starting soon" : player.ready ? "Ready" : "Tap when ready");
    readyButton.disabled = Boolean(room.launchCountdown?.endsAt);
  }
  const editButton = document.querySelector("#editPlayerAvatar");
  if (editButton && room.status === "waiting") {
    editButton.classList.toggle("btn-disabled", Boolean(player.ready));
    editButton.disabled = Boolean(player.ready || room.launchCountdown?.endsAt);
  }
  const hostLaunchButton = document.querySelector("[data-phone-force-start]");
  if (hostLaunchButton && room.status === "waiting") {
    const launchState = phoneHostLaunchState();
    hostLaunchButton.disabled = launchState.disabled;
    hostLaunchButton.classList.toggle("btn-disabled", launchState.disabled);
    hostLaunchButton.innerHTML = withIcon("play", launchState.label);
  }
  return true;
}

function renderPhone() {
  startPlayerHeartbeat();
  if (room.status === "playing") return void renderPhoneTrivia();

  if (room.status === "waiting" && !player.ready && phonePlayerEditing) {
    app.innerHTML = phonePlayerEditSurface();
    attachPhoneChromeHandlers();
    bindAvatarEditors(app);
    document.querySelector("#cancelPlayerEdit")?.addEventListener("click", () => {
      phonePlayerEditing = false;
      renderPhone();
    });
    document.querySelector("#phonePlayerEditForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const payload = playerPayloadFromForm(event.currentTarget);
      try {
      const data = await api(`/api/rooms/${room.code}/players/${player.id}/profile`, {
        method: "POST",
        body: payload
      });
      player = data.player;
      room = data.room;
      syncPlayerIdentityFromPlayer(data.player);
      phonePlayerEditing = false;
      renderPhone();
      } catch (error) {
        document.querySelector("#phonePlayerEditError").textContent = error.message;
      }
      });
    return;
  }

  const statusText = {
    waiting: waitingStatusLabel(player, room),
    playing: "Live",
    closed: "Closed"
  }[room.status] || "Ready";
  const ringColor = playerRingColor(player, room);

  app.innerHTML = phonePlayerSurface({ statusText, ringColor });

  attachPhoneChromeHandlers();
  attachPhoneHostControls();
  attachPickerHandlers();
  document.querySelector("#editPlayerAvatar")?.addEventListener("click", () => {
    phonePlayerEditing = true;
    renderPhone();
  });
  document.querySelector("#toggleReady")?.addEventListener("click", async () => {
    const nextReady = !player.ready;
    const previousPlayer = player;
    const previousRoom = room;
    player = { ...player, ready: nextReady };
    room = {
      ...room,
      players: room.players.map(item => item.id === player.id ? { ...item, ready: nextReady } : item)
    };
    updatePhoneStatus();
    try {
      const data = await api(`/api/rooms/${room.code}/players/${player.id}/ready`, {
        method: "POST",
        body: { ready: nextReady }
      });
      player = data.player;
      room = data.room;
      syncPlayerIdentityFromPlayer(data.player);
      updatePhoneStatus();
    } catch (error) {
      player = previousPlayer;
      room = previousRoom;
      updatePhoneStatus();
      throw error;
    }
  });
}

async function renderPhoneTrivia() {
  startPlayerHeartbeat();
  const client = await loadGameClient(room.selectedGame);
  app.innerHTML = client.renderPhoneGame(room, player, {
    header: phoneHeader(),
    switcher: `${showPhoneRoomSwitcher() ? phoneRoomSwitcher() : ""}${gamePickerModal()}`
  });

  attachPhoneChromeHandlers();
  attachPhoneHostControls();
  attachPickerHandlers();
  client.attachPhoneGameHandlers?.(app, {
    room,
    player,
    api,
    onRoom(nextRoom) {
      room = nextRoom;
      render();
    }
  });
}

function render() {
  const hostPhonePlayerSurface = route === "host" && isPhoneViewport() && currentPhoneSurface() === "player";
  if (!(player && room && (["join", "pair"].includes(route) || hostPhonePlayerSurface) && ["waiting", "playing"].includes(room.status))) {
    stopPlayerHeartbeat();
  }
  if (route === "join") {
    if (canRenderRoomSurface()) return renderHostPhoneRoom();
    if (player && room) return renderPhone();
    return void renderJoin();
  }
  if (pairToken && !pairClaimed) return renderPairPage();
  if (pairToken && pairClaimed && room) {
    if (canRenderRoomSurface()) return renderHostPhoneRoom();
    if (player) return renderPhone();
    return renderHostPlayerJoin();
  }
  return renderHost();
}

await loadConfig();
await loadAvatarCatalog();
document.documentElement.dataset.deviceView = deviceView;
if (route !== "join") {
  loadHostAccount();
  await loadHostEntitlement();
} else {
  hostAccount = null;
  controllerPaired = false;
  activePairingToken = "";
}
await ensureDesktopPairing();
if (hostCode) {
  await renderHostControlFromUrl();
} else if (route === "pair") {
  renderPairPage();
} else if (route === "join") {
  await renderJoin();
} else {
  const savedRoomCode = localStorage.getItem(ACTIVE_ROOM_CODE_KEY);
  if (savedRoomCode && !room) {
    try {
      const data = await api(`/api/rooms/${savedRoomCode}`);
      room = data.room;
      rememberRoomCode(room);
      selectedGameId = room.selectedGame?.id || selectedGameId;
      connect(room.code);
      recoverPlayerFromRoom(room);
    } catch {
      forgetRoomCode();
    }
  }
  await loadActiveHostRoom();
  renderHost();
}

setInterval(() => {
  if (isInteractionLocked()) return;
  if (route !== "join" && hostAccount && (hostEntitlement?.timePassExpiresAt || room?.entitlement?.expiresAt)) render();
}, 30_000);

setInterval(() => {
  if (isInteractionLocked()) return;
  if (room?.launchCountdown?.endsAt && room.status === "waiting") {
    if (currentView === "lobby") {
      updateLobbyCountdownOnly();
    } else if ((route === "join" || route === "pair") && player) {
      if (!updatePhoneStatus()) render();
    } else {
      render();
    }
    return;
  }
  if (room?.status === "playing" && currentView !== "lobby") render();
}, 1000);

setInterval(() => {
  if (isInteractionLocked()) return;
  pollDesktopPairing().catch(() => {});
  syncPairingStatus().catch(() => {});
  syncHostRoom().catch(() => {});
}, 2500);

setInterval(() => {
  if (activeSurface === "home" && !pairToken && config.games.length && !isInteractionLocked()) {
    promoIndex = (promoIndex + 1) % Math.min(4, config.games.length);
    if (document.querySelector(".promo-slide")) {
      updatePromoSlides();
    } else {
      render();
    }
  }
}, 6500);
