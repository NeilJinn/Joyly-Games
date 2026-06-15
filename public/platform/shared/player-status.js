export function activePlayers(room) {
  return room?.players?.filter(player => player.online !== false) || [];
}

export function disconnectedPlayers(room) {
  return room?.players?.filter(player => player.online === false) || [];
}

export function readyActivePlayers(room) {
  return activePlayers(room).filter(player => player.ready);
}

export function launchCountdownSeconds(room) {
  if (!room?.launchCountdown?.endsAt) return 0;
  return Math.max(0, Math.ceil((room.launchCountdown.endsAt - Date.now()) / 1000));
}

export function waitingStatusLabel(player, room) {
  if (room?.launchCountdown?.endsAt) return `Starting in ${launchCountdownSeconds(room)}s`;
  if (player?.online === false) return "Waiting to reconnect";
  if (player?.ready) return "请等待所有玩家准备";
  return "Getting ready";
}

export function playerRingColor(player, room) {
  if (room?.status !== "waiting") return "#f8fffd";
  if (player?.online === false) return "#8f99a6";
  if (player?.ready) return "#78d45e";
  return "#f4b04a";
}
