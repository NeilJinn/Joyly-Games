import { describe, it, expect } from 'vitest'
import * as mod from '../game.js'

function mockRoom(playerCount: number, overrides: Record<string, unknown> = {}) {
  const players = new Map()
  for (let i = 1; i <= playerCount; i++) {
    players.set(String(i), { id: String(i), nickname: `Player${i}`, online: true, joinedAt: i })
  }
  return { code: 'TEST01', players, gameState: null as unknown, fateWerewolfSetup: null, ...overrides }
}

describe('createWerewolfState', () => {
  it('starts in role-assignment phase with nightStep null', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    const pub = mod.publicWerewolfState(room)
    expect(pub.phase).toBe('role-assignment')
    expect(pub.nightStep).toBeNull()
    expect(pub.timeOfDay).toBe('night')
    expect(pub.round).toBe(1)
  })

  it('creates one seat per player', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    const pub = mod.publicWerewolfState(room)
    const seats = pub.seats as { alive: boolean }[]
    expect(seats).toHaveLength(6)
    expect(seats.every(s => s.alive)).toBe(true)
  })
})

describe('advanceWerewolf — role-assignment → night', () => {
  it('moves to night with guardian-action as first step', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    await mod.advanceWerewolf(room)
    const pub = mod.publicWerewolfState(room)
    expect(pub.phase).toBe('night')
    expect(pub.nightStep).toBe('guardian-action')
  })
})

describe('advanceWerewolf — nightStep progression', () => {
  it('advances guardian → wolf → fate-weaver → oracle', async () => {
    const room = mockRoom(8)
    await mod.createWerewolfState(room)
    await mod.advanceWerewolf(room) // → night/guardian-action

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).nightStep).toBe('wolf-action')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).nightStep).toBe('fate-weaver-action')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).nightStep).toBe('oracle-action')
  })

  it('moves to fate-council after last night step', async () => {
    const room = mockRoom(5)
    await mod.createWerewolfState(room)
    await mod.advanceWerewolf(room) // → night
    for (let i = 0; i < 10; i++) {
      const pub = mod.publicWerewolfState(room)
      if (pub.phase !== 'night') break
      await mod.advanceWerewolf(room)
    }
    expect(mod.publicWerewolfState(room).phase).toBe('fate-council')
  })
})

describe('advanceWerewolf — day flow', () => {
  it('fate-council → fate-card-reveal → fate-blessing → night-results → discussion-r1', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    ;(room.gameState as Record<string, unknown>).phase = 'fate-council'
    ;(room.gameState as Record<string, unknown>).nightStep = null

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('fate-card-reveal')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('fate-blessing')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('night-results')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('discussion-r1')
  })

  it('discussion-r1 → discussion-r2 → voting', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    ;(room.gameState as Record<string, unknown>).phase = 'discussion-r1'
    ;(room.gameState as Record<string, unknown>).nightStep = null

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('discussion-r2')

    await mod.advanceWerewolf(room)
    expect(mod.publicWerewolfState(room).phase).toBe('voting')
  })
})

describe('voting — tie detection', () => {
  it('moves to pk-discussion on a tie', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    ;(room.gameState as Record<string, unknown>).phase = 'voting'
    ;(room.gameState as Record<string, unknown>).day = { votes: { '3': '1', '4': '1', '5': '1', '6': '2', '1': '2', '2': '2' }, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] }

    await mod.advanceWerewolf(room)
    const pub = mod.publicWerewolfState(room)
    expect(pub.phase).toBe('pk-discussion')
    expect((pub.pkCandidates as string[]).length).toBe(2)
  })

  it('goes to execution on clear majority', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    ;(room.gameState as Record<string, unknown>).phase = 'voting'
    ;(room.gameState as Record<string, unknown>).day = { votes: { '2': '1', '3': '1', '4': '1', '5': '6', '6': '6' }, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] }

    await mod.advanceWerewolf(room)
    const pub = mod.publicWerewolfState(room)
    expect(pub.phase).toBe('execution')
    expect(pub.executedPlayerId).toBe('1')
  })
})

describe('execution → victory-check', () => {
  it('moves to victory-check after execution', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    ;(room.gameState as Record<string, unknown>).phase = 'execution'
    ;(room.gameState as Record<string, unknown>).executedPlayerId = null

    await mod.advanceWerewolf(room)
    const pub = mod.publicWerewolfState(room)
    expect(['victory-check', 'complete', 'night']).toContain(pub.phase)
  })
})
