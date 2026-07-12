import { describe, expect, it } from 'vitest'
import { nightStepsForRoles, registerRole, thirdPartyVictoryHooks } from '../roles/registry.js'

describe('role registry extensions', () => {
  it('orders a registered third-party night step and exposes its victory hook', () => {
    const extensionId = 'test-extension-registry-role'
    const victoryCheck = () => ({ winner: '测试扩展阵营', title: '扩展获胜', body: 'registered hook' })
    registerRole({
      id: extensionId,
      name: '测试扩展角色',
      team: 'third',
      nightSteps: [{ id: 'test-extension-action', order: 25 }],
      victoryCheck,
    })

    expect(nightStepsForRoles(['guardian', 'werewolf', extensionId, 'fateweaver'])).toEqual([
      'guardian-action',
      'wolf-action',
      'test-extension-action',
      'fate-weaver-action',
    ])
    expect(thirdPartyVictoryHooks()).toContain(victoryCheck)
    expect(thirdPartyVictoryHooks().find(hook => hook === victoryCheck)?.({ players: {} })).toMatchObject({
      winner: '测试扩展阵营',
    })
  })
})
