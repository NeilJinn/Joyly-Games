import { describe, expect, it } from 'vitest'
import { resolveNight } from '../resolvers/night.js'

const baseSnapshot = () => ({
  players: {
    wolf: { alive: true, role: 'werewolf', team: 'wolf' },
    target: { alive: true, role: 'villager', team: 'moon' },
    hunter: { alive: true, role: 'hunter', team: 'moon' },
  },
  night: { targets: {}, guardianTarget: null, fateweaverKill: null, fateweaverGuard: null },
  lovers: [],
})

describe('resolveNight', () => {
  it('resolves wolf self-sacrifice before every other night death', () => {
    const snapshot = baseSnapshot()
    snapshot.night.targets = { wolf: '__sacrifice__' }

    const outcome = resolveNight(snapshot)

    expect(outcome.deaths).toEqual([{ playerId: 'wolf', reason: 'sacrifice' }])
    expect(outcome.players.wolf.alive).toBe(false)
  })

  it('lets fateweaver kill bypass guardian protection and prevents that hunter revenge', () => {
    const snapshot = baseSnapshot()
    snapshot.night.fateweaverKill = 'hunter'
    snapshot.night.guardianTarget = 'hunter'

    const outcome = resolveNight(snapshot)

    expect(outcome.deaths).toEqual([{ playerId: 'hunter', reason: 'fateweaver-kill' }])
    expect(outcome.pendingHunterRevenge).toBeNull()
  })

  it('blocks a wolf kill protected by either guardian or fateweaver guard', () => {
    const snapshot = baseSnapshot()
    snapshot.night.targets = { wolf: 'target' }
    snapshot.night.fateweaverGuard = 'target'

    const outcome = resolveNight(snapshot)

    expect(outcome.deaths).toEqual([])
    expect(outcome.players.target.alive).toBe(true)
    expect(outcome.nextNight.lastGuardianTarget).toBeNull()
  })

  it('carries the guardian target into the next night restriction', () => {
    const snapshot = baseSnapshot()
    snapshot.night.guardianTarget = 'target'

    expect(resolveNight(snapshot).nextNight.lastGuardianTarget).toBe('target')
  })

  it('uses the supplied lover-chain callback after resolving deaths', () => {
    const snapshot = baseSnapshot()
    snapshot.night.targets = { wolf: 'target' }
    const loverChain = (players: Record<string, any>) => {
      players.hunter.alive = false
      players.hunter.eliminationReason = 'heartbreak'
      return [{ playerId: 'hunter', reason: 'heartbreak' }]
    }

    const outcome = resolveNight(snapshot, { resolveLoverChain: loverChain })

    expect(outcome.deaths).toEqual([
      { playerId: 'target', reason: 'night' },
      { playerId: 'hunter', reason: 'heartbreak' },
    ])
    expect(outcome.pendingHunterRevenge).toEqual({ hunterId: 'hunter', nextPhase: null })
  })
})
