function clonePlayers(players = {}) {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => [id, { ...player }]))
}

function majorityTarget(votes = {}) {
  const tally = new Map()
  for (const targetId of Object.values(votes)) {
    if (!targetId || String(targetId).startsWith('__')) continue
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1)
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
  return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null
}

/**
 * Resolves all night deaths without mutating the supplied state. The optional
 * lover callback receives the cloned players and returns additional deaths.
 */
export function resolveNight(snapshot, { resolveLoverChain } = {}) {
  const players = clonePlayers(snapshot.players)
  const night = snapshot.night ?? {}
  const deaths = []
  const kill = (playerId, reason) => {
    const player = players[playerId]
    if (!player?.alive) return false
    player.alive = false
    player.eliminationReason = reason
    deaths.push({ playerId, reason })
    return true
  }

  for (const [wolfId, target] of Object.entries(night.targets ?? {})) {
    if (target === '__sacrifice__') kill(wolfId, 'sacrifice')
  }

  if (night.fateweaverKill) kill(night.fateweaverKill, 'fateweaver-kill')

  const wolfTarget = majorityTarget(night.targets)
  const protectedIds = new Set([night.guardianTarget, night.fateweaverGuard].filter(Boolean))
  if (wolfTarget && !protectedIds.has(wolfTarget) && players[wolfTarget]?.role !== 'werewolf') {
    kill(wolfTarget, 'night')
  }

  if (resolveLoverChain) {
    for (const death of resolveLoverChain(players, { ...snapshot, night }) ?? []) {
      if (!deaths.some(existing => existing.playerId === death.playerId)) deaths.push(death)
    }
  }

  const hunterDeath = deaths.find(({ playerId, reason }) => players[playerId]?.role === 'hunter' && reason !== 'fateweaver-kill')
  return {
    players,
    deaths,
    pendingHunterRevenge: hunterDeath ? { hunterId: hunterDeath.playerId, nextPhase: null } : null,
    nextNight: {
      targets: {},
      guardianTarget: null,
      lastGuardianTarget: night.guardianTarget ?? night.lastGuardianTarget ?? null,
      fateweaverKill: null,
      fateweaverGuard: null,
    },
  }
}
