export function playerActionAt(player) {
  return Number(player?.lastActionAt || player?.joinedAt || 0);
}

export function touchPlayer(player) {
  player.lastActionAt = Date.now();
  player.online = true;
  return player;
}

export function playerDisconnected(player, disconnectWindowMs, now = Date.now()) {
  if (!player || player.virtual) return false;
  return now - playerActionAt(player) >= disconnectWindowMs;
}

export function playerExpired(player, reconnectWindowMs, now = Date.now()) {
  if (!player || player.virtual) return false;
  return now - playerActionAt(player) >= reconnectWindowMs;
}

export function sweepInactivePlayers(room, { disconnectWindowMs, reconnectWindowMs }, now = Date.now()) {
  let changed = false;
  for (const [playerId, player] of room.players.entries()) {
    if (!playerExpired(player, reconnectWindowMs, now)) continue;
    room.players.delete(playerId);
    changed = true;
    continue;
  }
  for (const player of room.players.values()) {
    const nextOnline = !playerDisconnected(player, disconnectWindowMs, now);
    if (player.online === nextOnline) continue;
    player.online = nextOnline;
    changed = true;
  }
  return changed;
}

export function activePlayers(room) {
  return [...room.players.values()].filter(player => player.online !== false);
}

export function activePlayerIds(room) {
  return activePlayers(room).map(player => player.id);
}

export function joinedPlayers(room) {
  return [...room.players.values()];
}

export function allActivePlayersReady(room, game) {
  const players = activePlayers(room);
  return players.length >= game.minPlayers
    && players.length <= game.maxPlayers
    && players.every(player => player.ready);
}

export function joinedPlayersWithinRange(room, game) {
  const players = joinedPlayers(room);
  return players.length >= game.minPlayers && players.length <= game.maxPlayers;
}
