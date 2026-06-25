import { describe, it, expect } from 'vitest'
import { resolveCue, WEREWOLF_CUE_MAP } from '../lib/cue-map'

describe('WEREWOLF_CUE_MAP', () => {
  it('has entries for all non-night phases', () => {
    const phases = [
      'lobby', 'role-assignment', 'fate-council',
      'fate-card-reveal', 'fate-blessing', 'night-results',
      'discussion-r1', 'discussion-r2', 'voting',
      'pk-discussion', 'pk-voting', 'execution', 'complete',
    ]
    for (const phase of phases) {
      expect(WEREWOLF_CUE_MAP[phase], `missing phase: ${phase}`).toBeDefined()
    }
  })

  it('has all four core nightStep entries', () => {
    const steps = ['guardian-action', 'wolf-action', 'fate-weaver-action', 'oracle-action']
    for (const step of steps) {
      expect(WEREWOLF_CUE_MAP['night']?.[step], `missing nightStep: ${step}`).toBeDefined()
    }
  })
})

describe('resolveCue', () => {
  it('fills {round} template in headline', () => {
    const cue = resolveCue('night', 'wolf-action', { round: 3 })
    expect(cue.headline).toBe('第3夜')
  })

  it('narration has no unfilled {round} placeholder', () => {
    const cue = resolveCue('night', 'guardian-action', { round: 2 })
    expect(cue.narration).not.toContain('{round}')
  })

  it('returns moon-icon + werewolf-stage for any night step', () => {
    const cue = resolveCue('night', 'wolf-action', {})
    expect(cue.topAsset).toBe('moon-icon')
    expect(cue.botAsset).toBe('werewolf-stage')
  })

  it('returns sun-banner + daytime-illus for fate-card-reveal', () => {
    const cue = resolveCue('fate-card-reveal', null, { cardName: '命运', cardEffect: '…' })
    expect(cue.topAsset).toBe('sun-banner')
    expect(cue.botAsset).toBe('daytime-illus')
  })

  it('returns null assets for lobby and complete', () => {
    expect(resolveCue('lobby', null, {}).topAsset).toBeNull()
    expect(resolveCue('complete', null, {}).botAsset).toBeNull()
  })

  it('falls back gracefully for unknown phase', () => {
    const cue = resolveCue('unknown-phase', null, {})
    expect(cue.narration).toBe('')
    expect(cue.topAsset).toBeNull()
  })

  it('fills {deaths} in night-results', () => {
    const cue = resolveCue('night-results', null, { deaths: '小明、小红' })
    expect(cue.narration).toContain('小明、小红')
    expect(cue.narration).not.toContain('{deaths}')
  })

  it('shows 平安无事 when no deaths', () => {
    const cue = resolveCue('night-results', null, { deaths: '' })
    expect(cue.narration).toContain('平安无事')
  })
})
