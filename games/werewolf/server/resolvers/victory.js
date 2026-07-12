const wolfVictory = { winner: '狼人阵营', title: '狼人获胜！', body: '所有竞争势力均已离场，黑夜笼罩了村庄。' }
const moonVictory = { winner: '村庄阵营', title: '村庄获胜！', body: '所有竞争势力均已离场，村庄获得了最终的胜利。' }

/** Pure, ordered victory resolver. Third-party hooks always get first claim. */
export function resolveVictory(snapshot, thirdPartyHooks = []) {
  const alive = Object.values(snapshot.players ?? {}).filter(player => player.alive)
  for (const hook of thirdPartyHooks) {
    if (hook.roleId && !alive.some(player => player.role === hook.roleId)) continue
    const result = hook(snapshot)
    if (result) return result
  }

  if (!alive.length) return null

  const wolves = alive.filter(player => player.team === 'wolf')
  const moon = alive.filter(player => player.team === 'moon')
  const hostileThird = alive.filter(player => player.team === 'third')

  if (wolves.length > 0 && moon.length === 0 && hostileThird.length === 0) return wolfVictory
  if (wolves.length === 0 && moon.length > 0 && hostileThird.length === 0) return moonVictory
  return null
}
