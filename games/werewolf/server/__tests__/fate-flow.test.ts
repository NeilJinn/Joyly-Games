import { describe, expect, it, vi } from 'vitest'
import * as mod from '../game.js'
import { drawFateCard } from '../fate/cards.js'

function mockRoom(playerCount: number) {
  const players = new Map()
  for (let i = 1; i <= playerCount; i++) {
    players.set(String(i), { id: String(i), nickname: `Player${i}`, online: true, joinedAt: i })
  }
  return { code: 'FATE01', players, gameState: null as any, fateWerewolfSetup: null }
}

describe('fate council public contract', () => {
  it('allows a dead player to submit one of the currently registered tendencies', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.phase = 'fate-council'

    const result = mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'chaos' })

    expect(result.status).toBe(200)
    expect(mod.publicWerewolfState(room).deadVoteCount).toBe(1)
    expect(mod.publicWerewolfState(room).expectedDeadVoteCount).toBe(1)
    expect(result.private.action.tendencies.map((item: { label: string }) => item.label)).toEqual(['神谕', '守护', '混乱', '黑暗'])
  })
})

describe('fate flow specification (implemented by the fate engine task)', () => {
  it('enters fate council with no pre-drawn card after an actual night completes', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    await mod.advanceWerewolf(room)
    while (room.gameState.phase === 'night') await mod.advanceWerewolf(room)

    expect(room.gameState.phase).toBe('fate-council')
    expect(room.gameState.currentFateCard).toBeNull()
    expect(room.gameState.fateHistory).toEqual([])
  })

  it('draws and records a weighted card only after every dead player has voted', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.players['2'].alive = false
    room.gameState.phase = 'fate-council'
    room.gameState.currentFateCard = null

    mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'chaos' })
    expect(room.gameState.currentFateCard).toBeNull()
    expect(room.gameState.fateHistory).toEqual([])

    mod.actionWerewolf(room, '2', { type: 'fate-vote', tendency: 'chaos' })
    await mod.advanceWerewolf(room)

    expect(room.gameState.phase).toBe('fate-card-reveal')
    expect(room.gameState.currentFateCard).toMatchObject({ effectKey: 'placeholder' })
    expect(room.gameState.fateHistory).toHaveLength(1)
    expect(mod.publicWerewolfState(room).fateCard).toMatchObject({
      id: room.gameState.currentFateCard.id,
      effectKey: 'placeholder',
    })
  })

  it('does not draw on a regular council advance while votes are incomplete', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.players['2'].alive = false
    room.gameState.phase = 'fate-council'
    mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'chaos' })

    await mod.advanceWerewolf(room)

    expect(room.gameState.phase).toBe('fate-council')
    expect(room.gameState.currentFateCard).toBeNull()
    expect(room.gameState.fateHistory).toEqual([])
  })

  it('draws on an explicit host council close and audits abstentions without identities', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.players['2'].alive = false
    room.gameState.phase = 'fate-council'
    mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'chaos' })

    await mod.advanceWerewolf(room, { forceFateCouncil: true })

    expect(room.gameState.phase).toBe('fate-card-reveal')
    expect(room.gameState.fateHistory[0]).toMatchObject({ closedReason: 'host-close', abstentionCount: 1 })
    expect(room.gameState.fateHistory[0]).not.toHaveProperty('abstainingPlayerIds')
  })

  it.each([
    ['omen', 0.1],
    ['shelter', 0.35],
    ['chaos', 0.6],
    ['dark', 0.85],
  ])('uses %s council vote weight when selecting with injected randomness', (tendency, random) => {
    const card = drawFateCard({
      votes: { dead1: tendency },
      triggers: [],
      random: () => random,
    })
    expect(card.tendency).toBe(tendency)
  })

  it.each([
    ['first-wolf-death', 'major-first-wolf-death'],
    ['endgame', 'major-endgame'],
    ['two-peaceful-nights', 'major-two-peaceful-nights'],
  ])('only includes %s major arcana when its trigger is active', (trigger, cardId) => {
    const withoutTrigger = drawFateCard({ votes: {}, triggers: [], random: () => 0.99 })
    const withTrigger = drawFateCard({ votes: {}, triggers: [trigger], random: () => 0.99 })

    expect(withoutTrigger.arcanaType).toBe('minor')
    expect(withTrigger).toMatchObject({ id: cardId, arcanaType: 'major', trigger })
  })

  it('activates the endgame trigger at four living players', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    const nonWolfIds = Object.entries(room.gameState.players)
      .filter(([, player]: any) => player.role !== 'werewolf')
      .slice(0, 2)
      .map(([id]) => id)
    room.gameState.players[nonWolfIds[0]].alive = false
    room.gameState.players[nonWolfIds[1]].alive = false
    room.gameState.phase = 'fate-council'
    mod.actionWerewolf(room, nonWolfIds[0], { type: 'fate-vote', tendency: 'dark' })
    mod.actionWerewolf(room, nonWolfIds[1], { type: 'fate-vote', tendency: 'dark' })
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)

    await mod.advanceWerewolf(room)

    expect(room.gameState.currentFateCard).toMatchObject({ id: 'major-endgame', arcanaType: 'major' })
    random.mockRestore()
  })

  it.each([
    ['first-wolf-death', (state: any) => {
      const wolfId = Object.entries(state.players).find(([, player]: any) => player.role === 'werewolf')![0]
      state.players[wolfId].alive = false
    }],
    ['endgame', (state: any) => {
      const ids = Object.entries(state.players).filter(([, player]: any) => player.role !== 'werewolf').slice(0, 2).map(([id]) => id)
      ids.forEach(id => { state.players[id].alive = false })
    }],
    ['two-peaceful-nights', (state: any) => {
      const id = Object.entries(state.players).find(([, player]: any) => player.role !== 'werewolf')![0]
      state.players[id].alive = false
      state.fateMeta.peacefulNightStreak = 1
      state.nightDeaths = []
    }],
  ])('consumes the %s major trigger after its first eligible draw', async (_trigger, arrange) => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    arrange(room.gameState)
    room.gameState.phase = 'fate-council'
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)

    await mod.advanceWerewolf(room, { forceFateCouncil: true })
    expect(room.gameState.currentFateCard.arcanaType).toBe('major')

    room.gameState.round = 2
    room.gameState.phase = 'fate-council'
    room.gameState.currentFateCard = null
    room.gameState.nightDeaths = ['non-peaceful']
    await mod.advanceWerewolf(room, { forceFateCouncil: true })

    expect(room.gameState.currentFateCard.arcanaType).toBe('minor')
    random.mockRestore()
  })

  it('records placeholder cards as resolved without changing game rules', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.phase = 'fate-council'
    const playersBefore = structuredClone(room.gameState.players)
    const votesBefore = structuredClone(room.gameState.day.votes)
    const victoryBefore = room.gameState.victory

    mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'dark' })
    await mod.advanceWerewolf(room)

    expect(room.gameState.fateHistory[0]).toMatchObject({ processed: true, effectKey: 'placeholder' })
    expect(room.gameState.players).toEqual(playersBefore)
    expect(room.gameState.day.votes).toEqual(votesBefore)
    expect(room.gameState.victory).toBe(victoryBefore)
  })

  it('publishes only safe fate history fields', async () => {
    const room = mockRoom(6)
    await mod.createWerewolfState(room)
    room.gameState.players['1'].alive = false
    room.gameState.phase = 'fate-council'
    mod.actionWerewolf(room, '1', { type: 'fate-vote', tendency: 'omen' })
    await mod.advanceWerewolf(room)

    const history = mod.publicWerewolfState(room).fateHistory[0]
    expect(history).toMatchObject({ round: 1, cardId: expect.any(String), arcanaType: expect.any(String), tendency: expect.any(String), processedAt: expect.any(Number) })
    expect(history).not.toHaveProperty('votes')
    expect(history).not.toHaveProperty('playerId')
    expect(history).not.toHaveProperty('role')
    expect(history).not.toHaveProperty('players')
  })
})
