import { describe, expect, it } from 'vitest'
import * as mod from '../game.js'

function mockRoom() {
  const players = new Map()
  for (let i = 1; i <= 6; i++) players.set(String(i), { id: String(i), nickname: `Player${i}`, online: true, joinedAt: i })
  return {
    code: 'ACTION1',
    players,
    gameState: null as any,
    fateWerewolfSetup: { roleAssignments: { '1': 'fateweaver', '2': 'werewolf', '3': 'werewolf' } },
  }
}

async function weaverNight(room: ReturnType<typeof mockRoom>) {
  await mod.createWerewolfState(room)
  room.gameState.phase = 'night'
  room.gameState.nightStep = 'fate-weaver-action'
  return room
}

describe('fate weaver actions', () => {
  it('accepts a card id and its required target independently', async () => {
    const room = await weaverNight(mockRoom())

    const result = mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'guard', targetId: '4' })

    expect(result.status).toBe(200)
    expect(room.gameState.night.fateweaverGuard).toBe('4')
    expect(result.private.action).toMatchObject({ type: 'card-and-target', disabled: true, selectedCardId: 'guard', selectedTargetId: '4' })
  })

  it('rejects targetless kill or guard but permits targetless save and skip', async () => {
    const room = await weaverNight(mockRoom())
    expect(mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'kill' }).status).toBe(400)
    expect(mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'guard' }).status).toBe(400)
    expect(mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'save' }).status).toBe(200)

    const otherRoom = await weaverNight(mockRoom())
    expect(mod.actionWerewolf(otherRoom, '1', { type: 'fate-weaver-card', cardId: 'skip' }).status).toBe(200)
  })

  it('save removes the resolved wolf target but preserves self-sacrifice choices', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.night.targets = { '2': '4', '3': '__sacrifice__' }

    expect(mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'save' }).status).toBe(200)
    expect(room.gameState.night.targets).toEqual({ '2': '__no_action__', '3': '__sacrifice__' })
  })

  it('treats an identical fate weaver replay as idempotent but rejects a different repeat', async () => {
    const room = await weaverNight(mockRoom())
    const payload = { type: 'fate-weaver-card', cardId: 'guard', targetId: '4' }

    expect(mod.actionWerewolf(room, '1', payload).status).toBe(200)
    const replay = mod.actionWerewolf(room, '1', payload)
    expect(replay.status).toBe(200)
    expect(replay.private.action).toMatchObject({ disabled: true, selectedCardId: 'guard', selectedTargetId: '4' })
    expect(mod.actionWerewolf(room, '1', { type: 'fate-weaver-card', cardId: 'kill', targetId: '5' }).status).toBe(409)
  })
})

describe('discussion and PK permissions', () => {
  it('accepts only living discussion round two opt-ins in submission order', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.phase = 'discussion-r2'
    room.gameState.players['4'].alive = false

    expect(mod.actionWerewolf(room, '3', { type: 'discussion-opt-in' }).status).toBe(200)
    expect(mod.actionWerewolf(room, '2', { type: 'discussion-opt-in' }).status).toBe(200)
    expect(mod.actionWerewolf(room, '4', { type: 'discussion-opt-in' }).status).toBe(403)
    expect(room.gameState.day.r2OptIns).toEqual(['3', '2'])
  })

  it('projects sequential speakers for round one and opted-in round two', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.phase = 'discussion-r1'
    room.gameState.day.speakerIndex = 1
    expect(mod.publicWerewolfState(room).speakerNickname).toBe('Player2')
    expect(mod.publicWerewolfState(room).seats[1].isSpeaking).toBe(true)

    room.gameState.phase = 'discussion-r2'
    room.gameState.day.r2OptIns = ['3', '2']
    room.gameState.day.speakerIndex = 1
    expect(mod.publicWerewolfState(room).speakerNickname).toBe('Player2')
    expect(mod.publicWerewolfState(room).seats[1].isSpeaking).toBe(true)
  })

  it('counts only living non-candidates in PK voting progress', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.phase = 'pk-voting'
    room.gameState.day.pkCandidates = ['1', '2']
    room.gameState.day.pkVotes = { '3': '1' }
    room.gameState.players['6'].alive = false

    expect(mod.publicWerewolfState(room).voteProgress).toEqual({ cast: 1, expected: 3 })
    expect(mod.actionWerewolf(room, '1', { type: 'pk-vote', targetId: '2' }).status).toBe(403)
  })
})

describe('oracle confirmation permissions', () => {
  it('accepts confirmation only from the living oracle', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.phase = 'night'
    room.gameState.nightStep = 'oracle-action'
    room.gameState.players['1'].role = 'oracle'
    room.gameState.players['1'].alive = true

    expect(mod.actionWerewolf(room, '2', { type: 'oracle-confirm' }).status).toBe(403)
    room.gameState.players['1'].alive = false
    expect(mod.actionWerewolf(room, '1', { type: 'oracle-confirm' }).status).toBe(403)
  })
})

describe('public replay and dead-player prompts', () => {
  it('projects completed night, vote, and execution records without roles or ballots', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.nightHistory = [{ round: 1, deaths: ['2'] }]
    room.gameState.voteHistory = [{ round: 1, kind: 'vote', cast: 6, expected: 6, outcome: '3' }]
    room.gameState.executionHistory = [{ round: 1, playerId: '3' }]
    const pub = mod.publicWerewolfState(room)

    expect(pub.nightHistory).toEqual([{ round: 1, deaths: ['2'] }])
    expect(pub.voteHistory).toEqual([{ round: 1, kind: 'vote', cast: 6, expected: 6, outcome: '3' }])
    expect(pub.executionHistory).toEqual([{ round: 1, playerId: '3' }])
    expect(JSON.stringify(pub)).not.toContain('werewolf')
  })

  it('gives a dead player a non-secret observing prompt at night', async () => {
    const room = await weaverNight(mockRoom())
    room.gameState.players['1'].alive = false
    room.gameState.players['1'].role = 'werewolf'
    room.gameState.phase = 'night'
    room.gameState.nightStep = 'wolf-action'
    const priv = mod.privateWerewolfState(room, '1')

    expect(priv.promptTitle).toBe('观察中')
    expect(priv.promptBody).toContain('保持沉默')
    expect(priv.wolfAllies).toEqual([])
    expect(priv.oracleMessage).toBeNull()
  })
})
