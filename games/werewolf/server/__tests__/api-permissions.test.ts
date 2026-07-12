import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'

const port = 47000 + Math.floor(Math.random() * 1000)
const baseUrl = `http://127.0.0.1:${port}`
let server: ChildProcess

async function request(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() as any }
}

beforeAll(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/games`)
      if (response.ok) return
    } catch { /* wait for startup */ }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Test server did not start')
})

afterAll(() => server?.kill())

describe('werewolf API development controls', () => {
  it('requires an explicit development flag and never advances from a player action', async () => {
    const hostEmail = 'host@example.com'
    const created = await request('/api/rooms', { gameId: 'fate-werewolf', hostName: 'Host', email: hostEmail, minutes: 60 })
    expect(created.status).toBe(201)
    const code = created.body.room.code as string

    // The guardian is part of the ten-player core deck.
    for (let seat = 1; seat <= 10; seat++) {
      const joined = await request(`/api/rooms/${code}/join`, { playerId: String(seat), nickname: `Player${seat}` })
      expect(joined.status).toBe(201)
    }
    expect((await request(`/api/rooms/${code}/werewolf/tester/role`, { playerId: '1', roleId: 'guardian' })).status).toBe(403)
    expect((await request(`/api/rooms/${code}/werewolf/tester/role`, { playerId: '1', roleId: 'guardian', email: 'developer@example.com', devWerewolf: true })).status).toBe(200)
    for (let seat = 1; seat <= 10; seat++) {
      expect((await request(`/api/rooms/${code}/players/${seat}/ready`, { ready: true })).status).toBe(200)
    }
    expect((await request(`/api/rooms/${code}/start`)).status).toBe(200)

    expect((await request(`/api/rooms/${code}/werewolf/test/auto`, { email: 'intruder@example.com' })).status).toBe(403)
    const developerAuto = await request(`/api/rooms/${code}/werewolf/test/auto`, { email: 'developer@example.com', devWerewolf: true })
    expect(developerAuto.status).toBe(200)
    expect(developerAuto.body.room.gameState).toMatchObject({ phase: 'night', nightStep: 'guardian-action', acknowledgedCount: 10 })

    const guardianAuto = await request(`/api/rooms/${code}/werewolf/test/auto`, { devWerewolf: true })
    expect(guardianAuto.status).toBe(200)
    expect(guardianAuto.body.room.gameState).toMatchObject({ phase: 'night', nightStep: 'wolf-action' })

    expect((await request(`/api/rooms/${code}/werewolf/restart`, { email: 'intruder@example.com' })).status).toBe(403)
    const developerRestart = await request(`/api/rooms/${code}/werewolf/restart`, { devWerewolf: true })
    expect(developerRestart.status).toBe(200)
    expect(developerRestart.body.room.gameState).toMatchObject({ phase: 'role-assignment', acknowledgedCount: 0 })

    const unauthorized = await request(`/api/rooms/${code}/werewolf/next`, { email: 'intruder@example.com' })
    expect(unauthorized.status).toBe(403)

    const developerAdvance = await request(`/api/rooms/${code}/werewolf/next`, { devWerewolf: true })
    expect(developerAdvance.status).toBe(200)
    expect(developerAdvance.body.room.gameState).toMatchObject({ phase: 'night', nightStep: 'guardian-action' })

    const guardianAction = await request(`/api/rooms/${code}/werewolf/action`, { playerId: '1', type: 'guardian-protect', targetId: '2' })
    expect(guardianAction.status).toBe(200)
    expect(guardianAction.body.room.gameState).toMatchObject({ phase: 'night', nightStep: 'guardian-action' })
  })
})
