import { describe, expect, it } from 'vitest'
import { registerRole, thirdPartyVictoryHooks } from '../roles/registry.js'
import { resolveVictory } from '../resolvers/victory.js'

const snapshot = (players: Record<string, Record<string, unknown>>) => ({ players })

describe('resolveVictory', () => {
  it('does not award a victory when nobody remains alive', () => {
    expect(resolveVictory(snapshot({
      wolf: { alive: false, team: 'wolf', role: 'werewolf' },
      moon: { alive: false, team: 'moon', role: 'villager' },
    }))).toBeNull()
  })

  it('does not let wolves win by parity while moon players survive', () => {
    expect(resolveVictory(snapshot({
      wolf: { alive: true, team: 'wolf', role: 'werewolf' },
      moon: { alive: true, team: 'moon', role: 'villager' },
    }))).toBeNull()
  })

  it('awards wolves only after all moon and hostile third players are gone', () => {
    expect(resolveVictory(snapshot({
      wolf: { alive: true, team: 'wolf', role: 'werewolf' },
      third: { alive: false, team: 'third', role: 'future-role' },
    }))).toMatchObject({ winner: '狼人阵营' })
  })

  it('does not award wolves while a hostile third player survives', () => {
    expect(resolveVictory(snapshot({
      wolf: { alive: true, team: 'wolf', role: 'werewolf' },
      moon: { alive: false, team: 'moon', role: 'villager' },
      third: { alive: true, team: 'third', role: 'future-role' },
    }))).toBeNull()
  })

  it('awards moon only after wolves and hostile third players are gone', () => {
    expect(resolveVictory(snapshot({
      moon: { alive: true, team: 'moon', role: 'villager' },
      wolf: { alive: false, team: 'wolf', role: 'werewolf' },
      third: { alive: false, team: 'third', role: 'future-role' },
    }))).toMatchObject({ winner: '村庄阵营' })
  })

  it('does not award moon while a hostile third player survives', () => {
    expect(resolveVictory(snapshot({
      moon: { alive: true, team: 'moon', role: 'villager' },
      wolf: { alive: false, team: 'wolf', role: 'werewolf' },
      third: { alive: true, team: 'third', role: 'future-role' },
    }))).toBeNull()
  })

  it('runs third-party hooks before faction victory checks', () => {
    const result = resolveVictory(snapshot({
      wolf: { alive: true, team: 'wolf', role: 'werewolf' },
    }), [() => ({ winner: '扩展阵营', title: '扩展获胜', body: 'hook' })])

    expect(result).toMatchObject({ winner: '扩展阵营' })
  })

  it('ignores a registered third-party hook when that role is absent', () => {
    const roleId = 'test-absent-third-victory-role'
    registerRole({
      id: roleId,
      name: '未入场测试角色',
      team: 'third',
      victoryCheck: () => ({ winner: '不应获胜', title: '错误', body: 'absent' }),
    })

    expect(resolveVictory(snapshot({
      moon: { alive: true, team: 'moon', role: 'villager' },
      wolf: { alive: false, team: 'wolf', role: 'werewolf' },
    }), thirdPartyVictoryHooks())).toMatchObject({ winner: '村庄阵营' })
  })
})
