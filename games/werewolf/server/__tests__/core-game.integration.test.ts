import { describe, expect, it } from 'vitest'
import { games } from '../../../../server/platform/game-catalog.js'
import { werewolfManifest } from '../../manifest.ts'
import {
  actionWerewolf,
  advanceWerewolf,
  createWerewolfState,
  getCoreRoleDeck,
  privateWerewolfState,
  publicWerewolfState,
  testAutoComplete,
} from '../game.js'
import { getRoleDefinitions } from '../roles/registry.js'

function mockRoom(playerCount: number) {
  const players = new Map()
  for (let index = 1; index <= playerCount; index += 1) {
    players.set(String(index), {
      id: String(index),
      nickname: `玩家${index}`,
      online: true,
      joinedAt: index,
    })
  }
  return { code: 'CORE10', players, gameState: null, fateWerewolfSetup: null }
}

function expectPublicStateToBeRoleSafe(room: ReturnType<typeof mockRoom>) {
  const publicState = publicWerewolfState(room)
  expect(JSON.stringify(publicState)).not.toContain('"role"')
  expect(JSON.stringify(publicState)).not.toContain('"team"')
}

function expectPrivateActionsToMatchCurrentStep(room: ReturnType<typeof mockRoom>) {
  const { phase, nightStep, players } = room.gameState
  for (const player of room.players.values()) {
    const privateState = privateWerewolfState(room, player.id)
    const action = privateState?.action
    if (!action) continue

    if (phase === 'role-assignment') expect(action.type).toBe('confirm-role')
    if (phase === 'night') {
      const role = players[player.id].role
      const expectedByStep: Record<string, string> = {
        'guardian-action': 'guardian',
        'wolf-action': 'werewolf',
        'fate-weaver-action': 'fateweaver',
        'oracle-action': 'oracle',
      }
      expect(role).toBe(expectedByStep[nightStep])
    }
    if (phase === 'fate-council') expect(players[player.id].alive).toBe(false)
    if (phase === 'voting') expect(players[player.id].alive).toBe(true)
    if (phase === 'pk-voting') expect(players[player.id].alive).toBe(true)
  }
}

async function advanceFullCoreGame(playerCount: number) {
  const room = mockRoom(playerCount)
  await createWerewolfState(room)
  const registeredRoles = Object.keys(getRoleDefinitions())
  expect(Object.values(room.gameState.players)).toHaveLength(playerCount)
  for (const player of Object.values(room.gameState.players) as Array<{ role: string }>) {
    expect(registeredRoles).toContain(player.role)
  }

  for (let guard = 0; guard < 300 && room.gameState.phase !== 'complete'; guard += 1) {
    expectPublicStateToBeRoleSafe(room)
    expectPrivateActionsToMatchCurrentStep(room)
    const { phase } = room.gameState

    if (phase === 'voting') {
      const target = Object.entries(room.gameState.players)
        .find(([, player]: any) => player.alive && player.team === 'moon')?.[0]
      if (target) {
        for (const [id, player] of Object.entries(room.gameState.players) as Array<[string, any]>) {
          if (player.alive && id !== target) actionWerewolf(room, id, { type: 'vote-target', targetId: target })
        }
      }
    } else if (phase === 'hunter-revenge') {
      const hunterId = room.gameState.pendingHunterRevenge.hunterId
      actionWerewolf(room, hunterId, { type: 'hunter-revenge' })
    } else {
      testAutoComplete(room)
    }
    await advanceWerewolf(room, { forceFateCouncil: phase === 'fate-council' })
  }

  expect(room.gameState.phase).toBe('complete')
  expect(room.gameState.victory).toMatchObject({ winner: '狼人阵营' })
  expectPublicStateToBeRoleSafe(room)
  return room
}

describe('Fate Werewolf core mode integration', () => {
  it('advertises exactly the supported six-to-ten player core range', () => {
    const catalog = games.find((game) => game.id === 'fate-werewolf')
    expect(catalog).toMatchObject({ players: '6-10', minPlayers: 6, maxPlayers: 10 })
    expect(werewolfManifest.playerRange).toEqual({ min: 6, max: 10 })
  })

  it.each([6, 8, 10])('runs a %i-player core game from role confirmation to a complete game', async (count) => {
    await advanceFullCoreGame(count)
  })

  it.each([6, 7, 8, 9, 10])('uses the exact registered core deck for %i players', async (count) => {
    const room = mockRoom(count)
    await createWerewolfState(room)

    const expected = getCoreRoleDeck(count).sort()
    const dealt = Object.values(room.gameState.players).map((player: any) => player.role).sort()
    expect(dealt).toEqual(expected)
  })

  it.each([5, 11])('rejects unsupported core-mode room size %i', async (count) => {
    await expect(createWerewolfState(mockRoom(count))).rejects.toThrow('Core mode supports 6–10 players')
  })

  it('rejects setup assignments for a player who is not in the room', async () => {
    const room = mockRoom(6)
    room.fateWerewolfSetup = { roleAssignments: { missing: 'werewolf' } }

    await expect(createWerewolfState(room)).rejects.toThrow('unknown player')
  })

  it('rejects setup assignments for non-core roles', async () => {
    const room = mockRoom(6)
    room.fateWerewolfSetup = { roleAssignments: { '1': 'cupid' } }

    await expect(createWerewolfState(room)).rejects.toThrow('not a registered core role')
  })

  it('rejects setup assignments that exceed the selected deck multiplicity', async () => {
    const room = mockRoom(6)
    room.fateWerewolfSetup = { roleAssignments: { '1': 'werewolf', '2': 'werewolf', '3': 'werewolf' } }

    await expect(createWerewolfState(room)).rejects.toThrow('exceeds the 6-player deck')
  })

  it('fills a partial valid setup assignment from the same selected deck', async () => {
    const room = mockRoom(6)
    room.fateWerewolfSetup = { roleAssignments: { '1': 'oracle', '2': 'werewolf' } }

    await createWerewolfState(room)

    expect(room.gameState.players['1'].role).toBe('oracle')
    expect(room.gameState.players['2'].role).toBe('werewolf')
    expect(Object.values(room.gameState.players).map((player: any) => player.role).sort())
      .toEqual(getCoreRoleDeck(6).sort())
  })
})
