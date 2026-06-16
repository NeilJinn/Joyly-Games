import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { findGame, games, playableGames } from "./server/platform/game-catalog.js";
import { runtimeFor } from "./server/games/registry.js";
import { getVoiceLibraryCatalog } from "./server/voice-library/catalog.js";
import { regenerateTaggedVoiceLibraryAudio } from "./server/voice-library/regenerate.js";
import { joinVoiceSegments, splitVoiceText } from "./server/voice-library/text.js";
import { loadVoiceLibraryReviewState, saveVoiceLibraryReviewState } from "./server/voice-library/review-state.js";
import {
  createVoiceLibraryDatabase,
  listVoiceLibraryLines,
  syncVoiceLibraryDatabase,
  updateVoiceLibraryLineTranscript,
  validateVoiceLibraryAssets
} from "./server/voice-library/sqlite-store.js";
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
const distDir = path.join(__dirname, "dist");
const useReactBuild = existsSync(path.join(distDir, "index.html"));
const cosmicTriviaMusicDir = path.join(publicDir, "games", "cosmic-trivia", "audio", "music");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const voiceLibraryDb = createVoiceLibraryDatabase();
const localOnlyToolsEnabled = process.env.JOYLY_LOCAL_TOOLS === "true" || process.env.NODE_ENV !== "production";

const rooms = new Map();
const clients = new Map();
const hostRooms = new Map();
const directorTimers = new Map();
const launchTimers = new Map();
const hostEntitlements = new Map();
const pairings = new Map();
const PLAYER_DISCONNECT_WINDOW_MS = 200_000;
const PLAYER_RECONNECT_WINDOW_MS = 400_000;
const PLAYER_SWEEP_INTERVAL_MS = 15_000;
const marketingPaths = new Set(["/", "/games", "/how-to-play", "/support", "/company"]);

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
  const runtime = runtimeFor(room.selectedGame?.id);
  const gameState = room.status === "playing" ? runtime.publicState(room) : null;
  return {
    code: room.code,
    host: room.host,
    players: [...room.players.values()],
    status: room.status,
    selectedGame: room.selectedGame,
    paymentMode: room.paymentMode,
    entitlement: room.entitlement,
    launchCountdown: room.launchCountdown || null,
    gameSetup: room.status === "waiting" ? runtime.setupState?.(room) || null : null,
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

async function listCosmicTriviaMusicSources() {
  if (!existsSync(cosmicTriviaMusicDir)) return [];
  const entries = await readdir(cosmicTriviaMusicDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map(fileName => `/games/cosmic-trivia/audio/music/${fileName}`);
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
  if (delay == null) return;

  const timer = setTimeout(async () => {
    const activeRoom = rooms.get(code);
    if (!activeRoom || activeRoom.status !== "playing") return;
    await runtime.advance(activeRoom);
    broadcast(code);
    scheduleDirector(code);
  }, Math.max(0, delay));
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
  const availableSlots = Math.max(0, game.maxPlayers - room.players.size);
  const existingNames = new Set([...room.players.values()].map(player => player.nickname));
  const added = [];

  if (!availableSlots) return added;

  for (const template of testPlayers) {
    if (added.length >= 1) break;
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

function requestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const requestHost = String(req.headers.host || "").trim();
  const proto = forwardedProto || (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${requestHost}`;
}

function publicJoinBase(req) {
  const configuredBaseUrl = String(process.env.JOYLY_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configuredBaseUrl) return configuredBaseUrl;
  if (localOnlyToolsEnabled) return `http://${localAddress()}:${port}`;
  return requestBaseUrl(req);
}

function notFound(res) {
  res.writeHead(404);
  res.end("Not found");
}

async function serveStaticDir(req, res, rootDir, {
  mountPath = "/",
  defaultPath = "/index.html"
} = {}) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requested = defaultPath;

  if (mountPath === "/") {
    requested = url.pathname === "/" ? defaultPath : decodeURIComponent(url.pathname);
  } else if (url.pathname === mountPath || url.pathname === `${mountPath}/`) {
    requested = defaultPath;
  } else if (url.pathname.startsWith(`${mountPath}/`)) {
    requested = decodeURIComponent(url.pathname.slice(mountPath.length));
  }

  let filePath = path.normalize(path.join(rootDir, requested));

  if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (statSync(filePath).isDirectory()) {
    const nestedIndexPath = path.join(filePath, "index.html");
    if (!existsSync(nestedIndexPath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    filePath = nestedIndexPath;
  }

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(await readFile(filePath));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (useReactBuild) {
    // React SPA: serve real files from dist/, fall back to index.html for all other paths
    const requested = decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(distDir, requested));
    if (filePath.startsWith(distDir) && existsSync(filePath) && !statSync(filePath).isDirectory()) {
      const ext = path.extname(filePath);
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".ico": "image/x-icon",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
      };
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(await readFile(filePath));
    } else {
      // SPA fallback — let React Router handle the route
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(await readFile(path.join(distDir, "index.html")));
    }
    return;
  }

  if (marketingPaths.has(url.pathname)) {
    return serveStaticDir({
      url: "/index.html",
      method: req.method,
      headers: req.headers
    }, res, publicDir);
  }
  return serveStaticDir(req, res, publicDir);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const isVoiceLibraryPath =
      url.pathname === "/voice" ||
      url.pathname === "/voice/" ||
      url.pathname.startsWith("/voice/") ||
      url.pathname === "/voice-library" ||
      url.pathname === "/voice-library/" ||
      url.pathname.startsWith("/voice-library/");
    const isVoiceLibraryApiPath = url.pathname.startsWith("/api/voice-library/");

    if ((req.method === "GET" || req.method === "HEAD") && isVoiceLibraryPath && !localOnlyToolsEnabled) {
      notFound(res);
      return;
    }

    if (isVoiceLibraryApiPath && !localOnlyToolsEnabled) {
      notFound(res);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/voice" || url.pathname === "/voice/" || url.pathname.startsWith("/voice/"))) {
      await serveStaticDir(req, res, path.join(publicDir, "voice-library"), {
        mountPath: "/voice",
        defaultPath: "/index.html"
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        localJoinBase: publicJoinBase(req),
        games,
        tools: {
          voiceLibrary: localOnlyToolsEnabled
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/avatar-catalog") {
      sendJson(res, 200, getAvatarCatalog());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/voice-library/catalog") {
      sendJson(res, 200, getVoiceLibraryCatalog());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/voice-library/db") {
      const reviewState = await loadVoiceLibraryReviewState();
      const catalog = getVoiceLibraryCatalog();
      syncVoiceLibraryDatabase(voiceLibraryDb, { catalog, reviewState, publicRoot: publicDir });
      validateVoiceLibraryAssets(voiceLibraryDb, { publicRoot: publicDir });
      const regenerateOnly = url.searchParams.get("regenerateOnly") === "1";
      const lines = listVoiceLibraryLines(voiceLibraryDb, {
        projectId: url.searchParams.get("projectId") || "",
        scope: url.searchParams.get("scope") || "",
        domain: url.searchParams.get("domain") || "",
        regenerateOnly
      });
      sendJson(res, 200, {
        lines,
        filters: {
          projects: [...new Set(lines.map(line => line.projectId).filter(Boolean))],
          scopes: [...new Set(lines.map(line => line.scope).filter(Boolean))],
          domains: [...new Set(lines.map(line => line.domain).filter(Boolean))],
          events: [...new Set(lines.map(line => (line.eventPath || []).join(".")).filter(Boolean))]
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games/cosmic-trivia/music-library") {
      sendJson(res, 200, {
        sources: await listCosmicTriviaMusicSources()
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/voice-library/state") {
      const reviewState = await loadVoiceLibraryReviewState();
      sendJson(res, 200, reviewState);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/voice-library/state") {
      const body = await getBody(req);
      const reviewState = body.reviewState || body.state || body || {};
      const saved = await saveVoiceLibraryReviewState(reviewState);
      syncVoiceLibraryDatabase(voiceLibraryDb, { catalog: getVoiceLibraryCatalog(), reviewState: saved, publicRoot: publicDir });
      sendJson(res, 200, saved);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/voice-library/line") {
      const body = await getBody(req);
      const lineId = String(body.lineId || body.candidateId || "").trim();
      if (!lineId) {
        sendJson(res, 400, { error: "Missing lineId" });
        return;
      }
      const reviewState = await loadVoiceLibraryReviewState();
      syncVoiceLibraryDatabase(voiceLibraryDb, { catalog: getVoiceLibraryCatalog(), reviewState, publicRoot: publicDir });
      const updated = updateVoiceLibraryLineTranscript(voiceLibraryDb, {
        lineId,
        transcript: String(body.transcript || ""),
        reviewState
      });
      const saved = await saveVoiceLibraryReviewState(reviewState);
      syncVoiceLibraryDatabase(voiceLibraryDb, { catalog: getVoiceLibraryCatalog(), reviewState: saved, publicRoot: publicDir });
      sendJson(res, 200, { updated, reviewState: saved });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/voice-library/regenerate") {
      const body = await getBody(req);
      const reviewState = body.reviewState || body.state || await loadVoiceLibraryReviewState();
      if (body.reviewState || body.state) {
        await saveVoiceLibraryReviewState(reviewState);
      }
      const catalog = getVoiceLibraryCatalog();
      const apiKey = String(body.apiKey || process.env.ELEVENLABS_API_KEY || "").trim();
      if (!apiKey) {
        return sendJson(res, 409, { error: "Missing ELEVENLABS_API_KEY" });
      }
      const voiceIdOverride = String(body.voiceIdOverride || body.voiceId || "").trim();
      const baseUrl = String(process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
      const modelId = String(process.env.ELEVENLABS_MODEL_ID || "eleven_v3").trim();
      const outputFormat = String(process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128").trim();
      const result = await regenerateTaggedVoiceLibraryAudio({
        catalog,
        reviewState,
        apiKey,
        baseUrl,
        modelId,
        outputFormat,
        voiceIdOverride
      });
      for (const item of result.generated || []) {
        if (item.kind !== "candidate") continue;
        const candidate = reviewState.candidates?.[item.id];
        if (!candidate) continue;
        for (const candidateId of Object.keys(reviewState.candidates || {})) {
          if (candidateId !== item.id && candidateId.startsWith(`${item.id}:`)) {
            delete reviewState.candidates[candidateId];
          }
        }
        candidate.status = "pending";
        candidate.tags = (candidate.tags || []).filter(tag => tag !== "regenerate");
        candidate.transcriptSegments = Array.isArray(item.segments) && item.segments.length
          ? item.segments.map(segment => String(segment || "").trim()).filter(Boolean)
          : splitVoiceText(candidate.transcript || "");
        candidate.transcript = joinVoiceSegments(candidate.transcriptSegments);
        candidate.generatedAudioPaths = Array.isArray(item.segmentFiles) ? item.segmentFiles.map(segment => segment.outputPath).filter(Boolean) : [];
        candidate.generatedFiles = Array.isArray(item.segmentFiles) ? item.segmentFiles.map(segment => ({
          index: segment.index,
          text: segment.text,
          outputPath: segment.outputPath
        })) : [];
        candidate.updatedAt = Date.now();

        for (const segment of item.segmentFiles || []) {
          if (!segment || segment.index <= 0) continue;
          const segmentFileName = path.basename(segment.outputPath);
          const segmentId = `${item.id}:${segmentFileName}`;
          reviewState.candidates[segmentId] = {
            id: segmentId,
            groupId: candidate.groupId || item.groupId || null,
            projectId: candidate.projectId || null,
            kind: candidate.kind || "director-candidate",
            title: segment.text || segmentFileName.replace(/\.mp3$/, ""),
            label: segment.text || `Segment ${segment.index + 1}`,
            audioPath: candidate.canonicalAudioPath
              ? `${path.dirname(candidate.canonicalAudioPath)}/${segmentFileName}`
              : `/games/cosmic-trivia/audio/host/director/${segmentFileName}`,
            filePath: segment.outputPath,
            text: segment.text || "",
            modelId: candidate.modelId || modelId,
            voiceId: candidate.voiceId || null,
            voiceSettings: candidate.voiceSettings || null,
            fileName: segmentFileName,
            updatedAt: Date.now(),
            durationSeconds: null,
            status: "pending",
            tags: [],
            notes: [],
            transcript: segment.text || "",
            transcriptSegments: [segment.text || ""]
          };
        }
      }
      for (const item of result.skipped || []) {
        if (item.reason === "test-sample") {
          const candidate = reviewState.candidates?.[item.id];
          if (!candidate) continue;
          candidate.notes = [...(candidate.notes || []), {
            id: makeId(),
            text: "Skipped during batch regeneration because this looks like a test sample.",
            createdAt: Date.now()
          }];
          candidate.updatedAt = Date.now();
        }
      }
      await saveVoiceLibraryReviewState(reviewState);
      syncVoiceLibraryDatabase(voiceLibraryDb, { catalog: getVoiceLibraryCatalog(), reviewState, publicRoot: publicDir });
      validateVoiceLibraryAssets(voiceLibraryDb, { publicRoot: publicDir });
      sendJson(res, 200, {
        generated: result.generated || [],
        skipped: result.skipped || [],
        reviewState
      });
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

    if (req.method === "GET" && url.pathname.match(/^\/api\/rooms\/\d+$/)) {
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
      if (!added.length) return sendJson(res, 409, { error: "No tester slots left" });
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

    if (req.method === "GET" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/private\/[^/]+$/)) {
      const [, , , code, , , playerId] = url.pathname.split("/");
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.privateState) return sendJson(res, 404, { error: "This game does not expose private state" });
      await runtime.ensureState(room);
      const privateState = runtime.privateState(room, playerId);
      if (!privateState) return sendJson(res, 404, { error: "Private state not found" });
      sendJson(res, 200, { privateState });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/setup$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.setup) return sendJson(res, 404, { error: "This game does not support setup" });
      const result = await runtime.setup(room, body || {});
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      scheduleDirector(code);
      broadcast(code);
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

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/director\/audio-status$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.directorAudioStatus) return sendJson(res, 404, { error: "This game does not support director audio events" });
      const result = await runtime.directorAudioStatus(
        room,
        String(body.phase || ""),
        String(body.playbackKey || ""),
        String(body.status || "")
      );
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      if (result.advanced) {
        scheduleDirector(code);
      }
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/director\/audio-ended$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.directorAudioEnded) return sendJson(res, 404, { error: "This game does not support director audio events" });
      const result = await runtime.directorAudioEnded(room, String(body.phase || ""), String(body.playbackKey || ""));
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      if (result.advanced) {
        scheduleDirector(code);
      }
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/director\/audio-started$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.directorAudioStarted) return sendJson(res, 404, { error: "This game does not support director audio events" });
      const result = await runtime.directorAudioStarted(room, String(body.phase || ""), String(body.playbackKey || ""));
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      scheduleDirector(code);
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

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/tester\/selection$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerSelect) return sendJson(res, 404, { error: "Tester mode is not available" });
      const result = await runtime.testerSelect(room, body.playerId || null);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/tester\/timer$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerTimer) return sendJson(res, 404, { error: "Tester mode is not available" });
      const result = await runtime.testerTimer(room, body.seconds);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      scheduleDirector(code);
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/tester\/score$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerScore) return sendJson(res, 404, { error: "Tester mode is not available" });
      const result = await runtime.testerScore(room, body.playerId || null, body.points);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/tester\/answer-correct$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerAnswerCorrect) return sendJson(res, 404, { error: "Tester mode is not available" });
      const result = await runtime.testerAnswerCorrect(room, body.playerId);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      broadcast(code);
      sendJson(res, 200, { trivia: runtime.publicState(room), room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/trivia\/tester\/complete$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerComplete) return sendJson(res, 404, { error: "Tester mode is not available" });
      const result = await runtime.testerComplete(room);
      if (result?.status && result.status !== 200) return sendJson(res, result.status, { error: result.error });
      clearDirector(code);
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

    if (req.method === "GET" && url.pathname.match(/^\/api\/rooms\/\d+\/werewolf\/private\/[^/]+$/)) {
      const [, , , code, , , playerId] = url.pathname.split("/");
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.privateState) return sendJson(res, 404, { error: "This game does not expose private state" });
      const privateState = runtime.privateState(room, playerId);
      if (!privateState) return sendJson(res, 404, { error: "Private state not found" });
      sendJson(res, 200, { privateState });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/werewolf\/action$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.action) return sendJson(res, 404, { error: "This game does not support actions" });
      const playerId = String(body.playerId || "");
      const result = await runtime.action(room, playerId, body);
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      const actedPlayer = room.players.get(playerId);
      if (actedPlayer) touchPlayer(actedPlayer);
      if (result.allSubmitted) {
        await runtime.advance(room);
        scheduleDirector(code);
      }
      broadcast(code);
      sendJson(res, 200, {
        room: roomView(room),
        privateState: result.private || runtime.privateState?.(room, playerId) || null
      });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/werewolf\/tester\/role$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "waiting") return sendJson(res, 409, { error: "Tester roles can only be changed before the game starts" });
      if (room.selectedGame?.id !== "fate-werewolf") return sendJson(res, 409, { error: "Tester roles are only available for Fate Werewolf" });
      const body = await getBody(req);
      const runtime = runtimeFor(room.selectedGame?.id);
      if (!runtime.testerRole) return sendJson(res, 404, { error: "This game does not support tester role setup" });
      const result = await runtime.testerRole(room, String(body.playerId || ""), String(body.roleId || ""));
      if (result.status !== 200) return sendJson(res, result.status, { error: result.error });
      broadcast(code);
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/werewolf\/restart$/)) {
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
      sendJson(res, 200, { room: roomView(room) });
      return;
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/\d+\/werewolf\/next$/)) {
      const code = url.pathname.split("/")[3];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Room not found" });
      if (room.status !== "playing") return sendJson(res, 409, { error: "Game is not live" });
      const runtime = runtimeFor(room.selectedGame?.id);
      await runtime.advance(room);
      scheduleDirector(code);
      broadcast(code);
      sendJson(res, 200, { room: roomView(room) });
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
