import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { findGame, games, playableGames } from "./server/platform/game-catalog.js";
import { runtimeFor } from "./server/games/registry.js";
import { getAvatarCatalog } from "./server/players/avatar-catalog.js";
import { normalizePlayerProfile, testPlayers } from "./server/players/player-info.js";
import {
  activePlayers as activeRoomPlayers,
  allActivePlayersReady,
  joinedPlayersWithinRange,
  sweepInactivePlayers as sweepRoomPlayers,
  touchPlayer
} from "./server/players/status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const rooms = new Map();
const clients = new Map();
const hostRooms = new Map();
const directorTimers = new Map();
const launchTimers = new Map();
const hostEntitlements = new Map();
const pairings = new Map();
const PLAYER_DISCONNECT_WINDOW_MS = 90_000;
const PLAYER_RECONNECT_WINDOW_MS = 3 * 60_000;
const PLAYER_SWEEP_INTERVAL_MS = 15_000;

function makeId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createCode() {
  let code = "";
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));
  return code;
}

function createPairToken() {
  let token = "";
  do {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "0123456789";
    token = [
      letters[Math.floor(Math.random() * letters.length)],
      letters[Math.floor(Math.random() * letters.length)],
      digits[Math.floor(Math.random() * digits.length)],
      digits[Math.floor(Math.random() * digits.length)],
      digits[Math.floor(Math.random() * digits.length)]
    ].join("");
  } while (pairings.has(token));
  return token;
}

function normalizePairToken(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function accountKey(email) {
  return String(email || "").trim().toLowerCase();
}

function roomView(room) {
  const gameState = room.status === "playing" ? runtimeFor(room.selectedGame?.id).publicState(room) : null;
  return {
    code: room.code,
    host: room.host,
    players: [...room.players.values()],
    status: room.status,
    selectedGame: room.selectedGame,
    paymentMode: room.paymentMode,
    entitlement: room.entitlement,
    launchCountdown: room.launchCountdown || null,
    gameState,
    createdAt: room.createdAt
  };
}

function sweepInactivePlayers(room, now = Date.now()) {
  return sweepRoomPlayers(room, {
    disconnectWindowMs: PLAYER_DISCONNECT_WINDOW_MS,
    reconnectWindowMs: PLAYER_RECONNECT_WINDOW_MS
  }, now);
}

function sweepAllRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "closed") continue;
    if (!sweepInactivePlayers(room, now)) continue;
    broadcast(room.code);
  }
}

function closeRoom(room) {
  room.status = "closed";
  room.closedAt = Date.now();
  clearDirector(room.code);
  clearLaunch(room.code);
  hostRooms.delete(accountKey(room.host.email));
}

function hostEntitlement(email) {
  const key = accountKey(email);
  if (!hostEntitlements.has(key)) {
    hostEntitlements.set(key, {
      points: 120,
      timePassExpiresAt: 0
    });
  }
  return hostEntitlements.get(key);
}

function publicHostEntitlement(email) {
  const entitlement = hostEntitlement(email);
  return {
    points: entitlement.points,
    timePassExpiresAt: entitlement.timePassExpiresAt,
    hasActiveTimePass: entitlement.timePassExpiresAt > Date.now()
  };
}

function activeHostRoom(email) {
  const code = hostRooms.get(accountKey(email));
  return code ? rooms.get(code) : null;
}

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function broadcast(code) {
  const room = rooms.get(code);
  if (!room) return;
  const payload = `data: ${JSON.stringify({ type: "room", room: roomView(room) })}\n\n`;
  for (const res of clients.get(code) || []) res.write(payload);
}

function roomClients(code) {
  if (!clients.has(code)) clients.set(code, new Set());
  return clients.get(code);
}

function clearDirector(code) {
  const timer = directorTimers.get(code);
  if (timer) clearTimeout(timer);
  directorTimers.delete(code);
}

function clearLaunch(code) {
  const timer = launchTimers.get(code);
  if (timer) clearTimeout(timer);
  launchTimers.delete(code);
}

function scheduleDirector(code) {
  clearDirector(code);
  const room = rooms.get(code);
  if (!room || room.status !== "playing") return;
  const runtime = runtimeFor(room.selectedGame?.id);
  const delay = runtime.directorDelay?.(room);
  if (!delay) return;

  const timer = setTimeout(async () => {
    const activeRoom = rooms.get(code);
    if (!activeRoom || activeRoom.status !== "playing") return;
    await runtime.advance(activeRoom);
    broadcast(code);
    scheduleDirector(code);
  }, delay);
  directorTimers.set(code, timer);
}

function allPlayersReady(room) {
  return allActivePlayersReady(room, room.selectedGame || playableGames()[0]);
}

function allJoinedPlayersWithinRange(room) {
  return joinedPlayersWithinRange(room, room.selectedGame || playableGames()[0]);
}

async function launchRoom(code, { force = false } = {}) {
  const room = rooms.get(code);
  if (!room) return { status: 404, error: "Room not found" };
  if (room.status === "closed") return { status: 409, error: "Room is closed" };
  if (room.status !== "waiting") return { status: 409, error: "This room has already moved on" };

  const game = room.selectedGame || playableGames()[0];
  if (force) {
    if (!allJoinedPlayersWithinRange(room)) {
      if (room.players.size < game.minPlayers) return { status: 409, error: `${game.title} needs at least ${game.minPlayers} joined players` };
      return { status: 409, error: `${game.title} supports up to ${game.maxPlayers} joined players` };
    }
  } else {
    const activePlayers = activeRoomPlayers(room);
    if (activePlayers.length < game.minPlayers) return { status: 409, error: `${game.title} needs at least ${game.minPlayers} active players` };
    if (activePlayers.length > game.maxPlayers) return { status: 409, error: `${game.title} supports up to ${game.maxPlayers} active players` };
    if (!allPlayersReady(room)) return { status: 409, error: "Everyone needs to be ready before launch" };
  }

  clearLaunch(code);
  room.launchCountdown = null;
  room.status = "playing";
  await runtimeFor(game.id).createState(room);
  scheduleDirector(code);
  broadcast(code);
  return { status: 200, room: roomView(room) };
}

function scheduleForcedLaunch(code, delayMs = 5000) {
  clearLaunch(code);
  const room = rooms.get(code);
  if (!room) return;
  room.launchCountdown = {
    mode: "force",
    endsAt: Date.now() + delayMs
  };
  broadcast(code);
  const timer = setTimeout(async () => {
    launchTimers.delete(code);
    const result = await launchRoom(code, { force: true });
    if (result.status !== 200) {
      const activeRoom = rooms.get(code);
      if (activeRoom && activeRoom.status === "waiting") {
        activeRoom.launchCountdown = null;
        broadcast(code);
      }
    }
  }, delayMs);
  launchTimers.set(code, timer);
}

function addTestPlayers(room) {
  const game = room.selectedGame || playableGames()[0];
  const needed = Math.max(0, game.minPlayers - room.players.size);
  const availableSlots = Math.max(0, game.maxPlayers - room.players.size);
  const count = Math.min(needed, availableSlots);
  const existingNames = new Set([...room.players.values()].map(player => player.nickname));
  const added = [];

  for (const template of testPlayers) {
    if (added.length >= count) break;
    if (existingNames.has(template.nickname)) continue;
    const player = {
      id: makeId(),
      nickname: template.nickname,
      avatar: template.avatar,
      joinedAt: Date.now(),
      lastActionAt: Date.now(),
      online: true,
      ready: true,
      virtual: true
    };
    room.players.set(player.id, player);
    existingNames.add(player.nickname);
    added.push(player);
  }

  for (const player of room.players.values()) player.ready = true;
  return added;
}

function localAddress() {
  const nets = os.networkInterfaces();
  for (const addresses of Object.values(nets)) {
    for (const item of addresses || []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "localhost";
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requested));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  res.end(await readFile(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        localJoinBase: `http://${localAddress()}:${port}`,
        games
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/avatar-catalog") {
      sendJson(res, 200, getAvatarCatalog());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/pairings") {
      const token = createPairToken();
      pairings.set(token, {
        token,
        account: null,
        paired: false,
        createdAt: Date.now()
      });
      sendJson(res, 201, { token });
      return;
    }

    if (req.method === "GET" && url.pathname.match(/^\/api\/pairings\/[A-Za-z0-9]+$/)) {
      const token = normalizePairToken(url.pathname.split("/")[3]);
      const pairing = pairings.get(token);
      if (!pairing) return sendJson(res, 404, { error: "Pairing not found" });
      const room = pairing.account ? activeHostRoom(pairing.account.email) : null;
      sendJson(res, 200, {
        account: pairing.account,
        paired: Boolean(pairing.paired),
        entitlement: pairing.account ? publicHostEntitlement(pairing.account.email) : null,
        room: room ? roomView(room) : null
      });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/pairings\/[A-Za-z0-9]+\/claim$/)) {
      const token = normalizePairToken(url.pathname.split("/")[3]);
      const pairing = pairings.get(token);
      if (!pairing) return sendJson(res, 404, { error: "Pairing not found" });
      const body = await getBody(req);
      const account = {
        name: String(body.hostName || body.name || "Host").trim().slice(0, 40) || "Host",
        email: accountKey(body.email || "host@example.com")
      };
      hostEntitlement(account.email);
      pairing.account = account;
      pairing.paired = true;
      pairing.pairedAt = Date.now();
      const room = activeHostRoom(account.email);
      sendJson(res, 200, {
        account,
        paired: true,
        entitlement: publicHostEntitlement(account.email),
        room: room ? roomView(room) : null
      });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/pairings\/[A-Za-z0-9]+\/release$/)) {
      const token = normalizePairToken(url.pathname.split("/")[3]);
      const pairing = pairings.get(token);
      if (!pairing) return sendJson(res, 404, { error: "Pairing not found" });
      pairing.paired = false;
      pairing.releasedAt = Date.now();
      sendJson(res, 200, {
        account: pairing.account,
        paired: false
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rooms") {
      const body = await getBody(req);
      const requestedGame = findGame(body.gameId);
      const game = requestedGame.status === "playable" ? requestedGame : playableGames()[0];
      const minutes = Number(body.minutes || 60);
      const credits = Number(body.credits || 0);
      const paymentMode = ["activeTime", "useCredits", "buyCredits"].includes(body.paymentMode) ? body.paymentMode : "time";
      const email = accountKey(body.email || "host@example.com");
      const account = hostEntitlement(email);
      if (paymentMode === "activeTime" && account.timePassExpiresAt <= Date.now()) {
        return sendJson(res, 409, { error: "No active time pass" });
      }
      if (paymentMode === "useCredits" && account.points < game.credits) {
        return sendJson(res, 409, { error: "Not enough points" });
      }
      if (paymentMode === "time") account.timePassExpiresAt = Math.max(account.timePassExpiresAt, Date.now()) + minutes * 60_000;
      if (paymentMode === "buyCredits") account.points += credits;
      if (paymentMode === "useCredits" || paymentMode === "buyCredits") account.points = Math.max(0, account.points - game.credits);
      const code = createCode();
      const room = {
        code,
        host: {
          name: body.hostName || "Host",
          email
        },
        players: new Map(),
        status: "waiting",
        selectedGame: game,
        paymentMode,
        entitlement: paymentMode === "time" || paymentMode === "activeTime"
          ? {
              type: "time",
              minutes: Math.max(0, Math.ceil((account.timePassExpiresAt - Date.now()) / 60_000)),
              expiresAt: account.timePassExpiresAt
            }
          : {
              type: "credits",
              purchased: paymentMode === "buyCredits" ? credits : 0,
              spent: game.credits,
              remaining: account.points
            },
        createdAt: Date.now()
      };
      rooms.set(code, room);
      clients.set(code, new Set());
      hostRooms.set(email, code);
      sendJson(res, 201, { room: roomView(room) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/hosts/") && url.pathname.endsWith("/room")) {
      const email = accountKey(decodeURIComponent(url.pathname.split("/")[3] || ""));
      const room = activeHostRoom(email);
      sendJson(res, 200, { room: room ? roomView(room) : null, entitlement: publicHostEntitlement(email) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/hosts/") && url.pathname.endsWith("/entitlement")) {
      const email = accountKey(decodeURIComponent(url.pathname.split("/")[3] || ""));
      sendJson(res, 200, { entitlement: publicHostEntitlement(email) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/rooms/")) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      sweepInactivePlayers(room);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/events/")) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) {
        res.writeHead(404);
        res.end();
        return;
      }
      sweepInactivePlayers(room);
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify({ type: "room", room: roomView(room) })}\n\n`);
      roomClients(code).add(res);
      req.on("close", () => roomClients(code).delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/join$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      sweepInactivePlayers(room);
      const body = await getBody(req);
      const profile = normalizePlayerProfile(body);
      const playerId = String(body.playerId || "").trim();
      const nickname = profile.nickname;
      if (!nickname) return sendJson(res, 400, { error: "Nickname is required" });
      if (playerId) {
        const existingById = room.players.get(playerId);
        if (existingById) {
          existingById.nickname = nickname;
          existingById.avatar = profile.avatar;
          touchPlayer(existingById);
          broadcast(code);
          sendJson(res, 200, { player: existingById, room: roomView(room), resumed: true });
          return;
        }
      } else {
        const existingByNickname = [...room.players.values()].find(player => player.nickname.toLowerCase() === nickname.toLowerCase());
        if (existingByNickname) {
          touchPlayer(existingByNickname);
          broadcast(code);
          sendJson(res, 200, { player: existingByNickname, room: roomView(room), resumed: true });
          return;
        }
      }
      if (room.status !== "waiting") return sendJson(res, 409, { error: "This room has already moved on" });
      if (room.players.size >= room.selectedGame.maxPlayers) return sendJson(res, 409, { error: "This room is full" });

      const player = {
        id: playerId || makeId(),
        nickname,
        avatar: profile.avatar,
        joinedAt: Date.now(),
        lastActionAt: Date.now(),
        online: true,
        ready: false
      };
      room.players.set(player.id, player);
      broadcast(code);
      sendJson(res, 201, { player, room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/close$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      closeRoom(room);
      broadcast(code);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/players\/.+\/ready$/)) {
      const parts = url.pathname.split("/");
      const code = parts[3];
      const playerId = parts[5];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      const found = room.players.get(playerId);
      if (!found) return sendJson(res, 404, { error: "Player not found" });
      const body = await getBody(req);
      found.ready = Boolean(body.ready);
      touchPlayer(found);
      broadcast(code);
      sendJson(res, 200, { player: found, room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/players\/.+\/ping$/)) {
      const parts = url.pathname.split("/");
      const code = parts[3];
      const playerId = parts[5];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      const found = room.players.get(playerId);
      if (!found) return sendJson(res, 404, { error: "Player not found" });
      touchPlayer(found);
      broadcast(code);
      sendJson(res, 200, { player: found, room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/players\/.+\/profile$/)) {
      const parts = url.pathname.split("/");
      const code = parts[3];
      const playerId = parts[5];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      sweepInactivePlayers(room);
      if (room.status !== "waiting") return sendJson(res, 409, { error: "Players can only edit while waiting" });
      const found = room.players.get(playerId);
      if (!found) return sendJson(res, 404, { error: "Player not found" });
      if (found.ready) return sendJson(res, 409, { error: "Ready players cannot edit" });
      const body = await getBody(req);
      const profile = normalizePlayerProfile(body);
      if (!profile.nickname) return sendJson(res, 400, { error: "Nickname is required" });
      const duplicate = [...room.players.values()].find(player => player.id !== playerId && player.nickname.toLowerCase() === profile.nickname.toLowerCase());
      if (duplicate) return sendJson(res, 409, { error: "That nickname is already taken" });
      found.nickname = profile.nickname;
      found.avatar = profile.avatar;
      touchPlayer(found);
      broadcast(code);
      sendJson(res, 200, { player: found, room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/test-players$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "waiting") return sendJson(res, 409, { error: "Test players can only be added before the game starts" });
      const added = addTestPlayers(room);
      broadcast(code);
      sendJson(res, 200, { added, room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/select-game$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status === "closed") return sendJson(res, 409, { error: "Room is closed" });
      const body = await getBody(req);
      const game = games.find(item => item.id === body.gameId);
      if (!game) return sendJson(res, 400, { error: "Unknown game" });
      if (game.status !== "playable") return sendJson(res, 409, { error: "That game is not playable yet" });
      if (!["waiting", "playing"].includes(room.status)) return sendJson(res, 409, { error: "Choose games before the game starts" });
      if (room.status === "playing") {
        clearDirector(code);
        for (const player of room.players.values()) player.ready = false;
        room.status = "waiting";
      }
      clearLaunch(code);
      room.launchCountdown = null;
      room.selectedGame = game;
      room.gameState = null;
      if (!room.entitlement) room.status = "checkout";
      broadcast(code);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/purchase$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status === "closed") return sendJson(res, 409, { error: "Room is closed" });
      const body = await getBody(req);
      room.paymentMode = body.paymentMode === "credits" ? "credits" : "time";
      room.entitlement = room.paymentMode === "credits"
        ? { type: "credits", purchased: Number(body.credits || 20), remaining: Number(body.credits || 20) - (room.selectedGame?.credits || 0) }
        : { type: "time", minutes: Number(body.minutes || 120), expiresAt: Date.now() + Number(body.minutes || 120) * 60_000 };
      room.status = "ready";
      broadcast(code);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/start$/)) {
      const code = url.pathname.split("/")[3];
      const result = await launchRoom(code);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      sendJson(res, 200, { room: result.room });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/force-start$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status === "closed") return sendJson(res, 409, { error: "Room is closed" });
      if (room.status !== "waiting") return sendJson(res, 409, { error: "This room has already moved on" });
      if (room.launchCountdown?.endsAt && room.launchCountdown.endsAt > Date.now()) {
        return sendJson(res, 409, { error: "Countdown already running" });
      }
      const game = room.selectedGame || playableGames()[0];
      if (!allJoinedPlayersWithinRange(room)) {
        if (room.players.size < game.minPlayers) return sendJson(res, 409, { error: `${game.title} needs at least ${game.minPlayers} joined players` });
        return sendJson(res, 409, { error: `${game.title} supports up to ${game.maxPlayers} joined players` });
      }
      scheduleForcedLaunch(code, 5000);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "GET" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      const runtime = runtimeFor(room.selectedGame?.id);
      await runtime.ensureState(room);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/answer$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const playerId = String(body.playerId || "");
      const runtime = runtimeFor(room.selectedGame?.id);
      const result = await runtime.answer(room, playerId, String(body.choice));
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      const actedPlayer = room.players.get(playerId);
      if (actedPlayer) touchPlayer(actedPlayer);
      if (result.allAnswered) {
        scheduleDirector(code);
      }

      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/preferences$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.preferences) return sendJson(res, 404, { error: "This game does not collect preferences" });
      const playerId = String(body.playerId || "");
      const result = await runtime.preferences(room, playerId, body.preferences || {});
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      const actedPlayer = room.players.get(playerId);
      if (actedPlayer) touchPlayer(actedPlayer);
      if (result.allSelected) {
        await runtime.advance(room);
        scheduleDirector(code);
      }

      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/restart$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.restart) return sendJson(res, 404, { error: "This game cannot restart" });
      clearDirector(code);
      await runtime.restart(room);
      scheduleDirector(code);

      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/next$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      await runtime.advance(room);
      scheduleDirector(code);

      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Joyly Games prototype running:`);
  console.log(`  Desktop: http://localhost:${port}`);
  console.log(`  Phone on same Wi-Fi: http://${localAddress()}:${port}`);
});

const inactiveSweep = setInterval(sweepAllRooms, PLAYER_SWEEP_INTERVAL_MS);
inactiveSweep.unref?.();
