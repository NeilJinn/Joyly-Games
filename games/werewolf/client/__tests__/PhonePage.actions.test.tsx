import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActionPanel, loadPlayerJournal, savePlayerJournal } from '../PhonePage'
import { canRenderDevWerewolfPanel, shouldRenderDevWerewolfPanel } from '../BigScreenPage'

const target = { id: 'target-1', nickname: 'Target' }

async function submit(action: any, clicks: string[] = []) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ActionPanel action={action} onSubmit={onSubmit} />)
  for (const label of clicks) fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: action.label }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  return onSubmit.mock.calls[0][0]
}

describe('Fate Werewolf phone action payloads', () => {
  it('maps a generic guardian target descriptor to its server command', async () => {
    const payload = await submit({ type: 'select-target', actionId: 'guardian-protect', label: '守护', targets: [target] }, ['Target'])
    expect(payload).toMatchObject({ type: 'guardian-protect', targetId: 'target-1' })
  })

  it('maps a generic vote descriptor to its server command', async () => {
    const payload = await submit({ type: 'select-target', actionId: 'vote-target', label: '投票', targets: [target] }, ['Target'])
    expect(payload).toMatchObject({ type: 'vote-target', targetId: 'target-1' })
  })

  it('submits independently selected fate weaver card and target ids', async () => {
    const payload = await submit({
      type: 'card-and-target', actionId: 'fate-weaver-card', label: '编织',
      cards: [{ id: 'guard', label: '守护牌', requiresTarget: true }], targets: [target],
    }, ['守护牌', 'Target'])
    expect(payload).toMatchObject({ type: 'fate-weaver-card', cardId: 'guard', targetId: 'target-1' })
  })

  it('submits exactly two targets for a multi-target action', async () => {
    const secondTarget = { id: 'target-2', nickname: 'Second target' }
    const payload = await submit({
      type: 'multi-target', actionId: 'cupid-bind', label: '结缘', requiredTargetCount: 2,
      targets: [target, secondTarget],
    }, ['Target', 'Second target'])
    expect(payload).toMatchObject({ type: 'cupid-bind', targetIds: ['target-1', 'target-2'] })
  })

  it('does not submit a target-required card without a target', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ActionPanel action={{
      type: 'card-and-target', actionId: 'fate-weaver-card', label: '编织',
      cards: [{ id: 'guard', label: '守护牌', requiresTarget: true }], targets: [target],
    }} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: '守护牌' }))
    fireEvent.click(screen.getByRole('button', { name: '编织' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '编织' })).toBeDisabled()
  })

  it('keeps target, wolf kill, card, multi-target, and fate submits disabled until valid', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { unmount } = render(<ActionPanel action={{ type: 'select-target', actionId: 'guardian-protect', label: '守护', targets: [target] }} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: '守护' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Target' }))
    expect(screen.getByRole('button', { name: '守护' })).toBeEnabled()
    unmount()

    render(<ActionPanel action={{ type: 'wolf-night-action', label: '狼人行动', targets: [target], wolfOptions: [{ id: 'kill', label: '击杀' }, { id: 'no-action', label: '不行动' }] }} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: '狼人行动' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '不行动' }))
    expect(screen.getByRole('button', { name: '狼人行动' })).toBeEnabled()
  })

  it('persists a personal journal per room and player', () => {
    savePlayerJournal('ROOM1', 'player-1', { suspects: '狼A', trusts: '神谕者', notes: '第一夜无死亡' })
    expect(loadPlayerJournal('ROOM1', 'player-1')).toEqual({ suspects: '狼A', trusts: '神谕者', notes: '第一夜无死亡' })
    expect(loadPlayerJournal('ROOM1', 'player-2')).toEqual({ suspects: '', trusts: '', notes: '' })
  })

  it('only enables the dev panel with an explicit development URL flag', () => {
    expect(shouldRenderDevWerewolfPanel('')).toBe(false)
    expect(shouldRenderDevWerewolfPanel('?devWerewolf=1')).toBe(true)
    expect(canRenderDevWerewolfPanel('?devWerewolf=1')).toBe(true)
  })

})
