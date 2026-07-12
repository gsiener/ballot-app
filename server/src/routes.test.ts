import { describe, test, expect, beforeEach } from 'bun:test'
import { app } from './index'

// Route-level tests that drive the REAL app through its HTTP seam, backed by an
// in-memory KV. This is the seam the attendance handlers were missing: the
// hand-rolled read-modify-write logic (and the version-conflict path) now has
// coverage that survives routing them through the shared factory.

const ADMIN_KEY = 'test-admin-key'

function makeEnv() {
  const store = new Map<string, string>()
  const BALLOTS_KV = {
    get: async (key: string) => (store.has(key) ? store.get(key)! : null),
    put: async (key: string, value: string) => { store.set(key, value) },
    delete: async (key: string) => { store.delete(key) }
  }
  return { BALLOTS_KV, ADMIN_API_KEY: ADMIN_KEY } as any
}

let env: any
beforeEach(() => { env = makeEnv() })

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

async function createAttendance(title = 'Standup', date = '2024-01-15') {
  const res = await app.request('/api/attendance', json({ title, date }), env)
  return res.json() as Promise<any>
}

describe('POST /api/attendance', () => {
  test('creates an attendance with version 1 and no responses', async () => {
    const res = await app.request('/api/attendance', json({ title: 'Standup', date: '2024-01-15' }), env)
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.title).toBe('Standup')
    expect(body.date).toBe('2024-01-15')
    expect(body.responses).toEqual([])
    expect(body.version).toBe(1)
    expect(body.id).toBeString()
  })

  test('rejects a missing title', async () => {
    const res = await app.request('/api/attendance', json({ date: '2024-01-15' }), env)
    expect(res.status).toBe(400)
  })

  test('rejects a missing date', async () => {
    const res = await app.request('/api/attendance', json({ title: 'X' }), env)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/attendance/:id', () => {
  test('returns a created attendance', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {}, env)
    expect(res.status).toBe(200)
    expect((await res.json() as any).id).toBe(created.id)
  })

  test('404s for an unknown id', async () => {
    const res = await app.request('/api/attendance/nope', {}, env)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/attendance', () => {
  test('lists attendances sorted by date descending', async () => {
    await createAttendance('Older', '2024-01-01')
    await createAttendance('Newer', '2024-02-01')
    const res = await app.request('/api/attendance', {}, env)
    const list = await res.json() as any
    expect(list.map((a: any) => a.title)).toEqual(['Newer', 'Older'])
  })
})

describe('PUT /api/attendance/:id (respond)', () => {
  test('adds a response and bumps the version', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', attending: true })
    }, env)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.responses).toHaveLength(1)
    expect(body.responses[0]).toMatchObject({ name: 'Ada', attending: true })
    expect(body.version).toBe(2)
  })

  test('updates an existing responder case-insensitively rather than duplicating', async () => {
    const created = await createAttendance()
    await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', attending: true })
    }, env)
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ADA', attending: false })
    }, env)
    const body = await res.json() as any
    expect(body.responses).toHaveLength(1)
    expect(body.responses[0]).toMatchObject({ name: 'ADA', attending: false })
  })

  test('rejects a missing name', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attending: true })
    }, env)
    expect(res.status).toBe(400)
  })

  test('rejects a non-boolean attending', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', attending: 'yes' })
    }, env)
    expect(res.status).toBe(400)
  })

  test('404s for an unknown id', async () => {
    const res = await app.request('/api/attendance/nope', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', attending: true })
    }, env)
    expect(res.status).toBe(404)
  })

  test('409s on a stale version when the client opts into locking', async () => {
    const created = await createAttendance() // version 1
    // First response bumps to version 2.
    await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', attending: true })
    }, env)
    // Second response carrying the stale version 1 must conflict.
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bo', attending: true, version: 1 })
    }, env)
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/attendance/:id (admin rename)', () => {
  test('renames with a valid admin key', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({ title: 'Renamed' })
    }, env)
    expect(res.status).toBe(200)
    expect((await res.json() as any).title).toBe('Renamed')
  })

  test('401s without an admin key', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed' })
    }, env)
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/attendance/:id (admin)', () => {
  test('deletes with a valid admin key', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${ADMIN_KEY}` }
    }, env)
    expect(res.status).toBe(200)
    const check = await app.request(`/api/attendance/${created.id}`, {}, env)
    expect(check.status).toBe(404)
  })

  test('401s without an admin key', async () => {
    const created = await createAttendance()
    const res = await app.request(`/api/attendance/${created.id}`, { method: 'DELETE' }, env)
    expect(res.status).toBe(401)
  })
})

// Ballots seed two demo ballots (demo-1, demo-2) on first read.
describe('PUT /api/ballots/:id (add vote)', () => {
  test('appends a vote and bumps the version', async () => {
    const ballot = await (await app.request('/api/ballots/demo-1', {}, env)).json() as any
    const before = ballot.votes.length
    const res = await app.request('/api/ballots/demo-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ballot, votes: [...ballot.votes, { color: 'green', createdAt: '2024-05-01T00:00:00Z' }] })
    }, env)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.votes).toHaveLength(before + 1)
    expect(body.version).toBe(2)
  })

  test('rejects an over-long comment', async () => {
    const ballot = await (await app.request('/api/ballots/demo-1', {}, env)).json() as any
    const res = await app.request('/api/ballots/demo-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ballot, votes: [{ color: 'green', comment: 'x'.repeat(1001), createdAt: '2024-05-01T00:00:00Z' }] })
    }, env)
    expect(res.status).toBe(400)
  })

  test('404s for an unknown id', async () => {
    const res = await app.request('/api/ballots/nope', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nope', question: 'x', votes: [] })
    }, env)
    expect(res.status).toBe(404)
  })

  test('409s on a stale version', async () => {
    const ballot = await (await app.request('/api/ballots/demo-1', {}, env)).json() as any
    // Bump to version 2.
    await app.request('/api/ballots/demo-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ballot, votes: [...ballot.votes, { color: 'red', createdAt: '2024-05-01T00:00:00Z' }] })
    }, env)
    // Re-submit carrying the stale version 1.
    const res = await app.request('/api/ballots/demo-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ballot, version: 1, votes: [...ballot.votes, { color: 'red', createdAt: '2024-05-02T00:00:00Z' }] })
    }, env)
    expect(res.status).toBe(409)
  })
})

describe('admin ballot routes', () => {
  const auth = { headers: { 'Authorization': `Bearer ${ADMIN_KEY}` } }

  test('GET /api/admin/ballots returns metadata sorted newest-first', async () => {
    const res = await app.request('/api/admin/ballots', auth, env)
    expect(res.status).toBe(200)
    const list = await res.json() as any[]
    expect(list.map(b => b.id)).toEqual(['demo-2', 'demo-1'])
    expect(list[0]).toHaveProperty('voteCount')
    expect(list[0]).toHaveProperty('commentCount')
    expect(list[0]).toHaveProperty('lastVote')
  })

  test('GET /api/admin/ballots 401s without a key', async () => {
    expect((await app.request('/api/admin/ballots', {}, env)).status).toBe(401)
  })

  test('PATCH toggles privacy', async () => {
    const res = await app.request('/api/admin/ballots/demo-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({ isPrivate: true })
    }, env)
    expect(res.status).toBe(200)
    expect((await res.json() as any).isPrivate).toBe(true)
  })

  test('DELETE removes a ballot; unknown id 404s; no key 401s', async () => {
    const del = await app.request('/api/admin/ballots/demo-1', { method: 'DELETE', ...auth }, env)
    expect(del.status).toBe(200)
    expect((await app.request('/api/admin/ballots/demo-1', { method: 'DELETE', ...auth }, env)).status).toBe(404)
    expect((await app.request('/api/admin/ballots/demo-2', { method: 'DELETE' }, env)).status).toBe(401)
  })
})

describe('PUT /api/dashboards/:id (opt-in version)', () => {
  test('a second update without a version does not falsely conflict', async () => {
    const created = await (await app.request('/api/dashboards', json({ name: 'Board' }), env)).json() as any
    // First update (no version) -> succeeds, bumps to version 2.
    const first = await app.request(`/api/dashboards/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ballotIds: ['b1'] })
    }, env)
    expect(first.status).toBe(200)
    // Second update (still no version) must NOT 409 just because version advanced.
    const second = await app.request(`/api/dashboards/${created.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ballotIds: ['b1', 'b2'] })
    }, env)
    expect(second.status).toBe(200)
    expect((await second.json() as any).ballotIds).toEqual(['b1', 'b2'])
  })
})
