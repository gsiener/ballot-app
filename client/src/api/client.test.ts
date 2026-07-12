import { describe, test, expect } from 'bun:test'
import { createApiClient, ApiError } from './client'

// The api client accepts an injected fetch adapter — the second adapter that
// justifies the seam (real fetch in prod, this fake in tests). Callers no
// longer reach for raw fetch or re-declare the base URL.

const BASE = 'https://test.example'

function fakeFetch(responder: (url: string, init?: any) => Response) {
  const calls: { url: string; init?: any }[] = []
  const fn = (async (input: any, init?: any) => {
    calls.push({ url: String(input), init })
    return responder(String(input), init)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })

describe('createApiClient — URL and verb construction', () => {
  test('ballotApi.getAll hits GET /api/ballots', async () => {
    const { fn, calls } = fakeFetch(() => ok([{ id: 'b1' }]))
    const { ballotApi } = createApiClient(fn, BASE)
    const result = await ballotApi.getAll()
    expect(result).toEqual([{ id: 'b1' }] as any)
    expect(calls[0]!.url).toBe(`${BASE}/api/ballots`)
  })

  test('attendanceApi.respond PUTs name/attending to the attendance', async () => {
    const { fn, calls } = fakeFetch(() => ok({ id: 'a1', responses: [] }))
    const { attendanceApi } = createApiClient(fn, BASE)
    await attendanceApi.respond('a1', 'Ada', true)
    expect(calls[0]!.url).toBe(`${BASE}/api/attendance/a1`)
    expect(calls[0]!.init.method).toBe('PUT')
    expect(JSON.parse(calls[0]!.init.body)).toEqual({ name: 'Ada', attending: true })
  })

  test('adminApi.deleteBallot sends the bearer token', async () => {
    const { fn, calls } = fakeFetch(() => ok({ message: 'ok' }))
    const { adminApi } = createApiClient(fn, BASE)
    await adminApi.deleteBallot('secret', 'b1')
    expect(calls[0]!.url).toBe(`${BASE}/api/admin/ballots/b1`)
    expect(calls[0]!.init.method).toBe('DELETE')
    expect(calls[0]!.init.headers.Authorization).toBe('Bearer secret')
  })
})

describe('createApiClient — error mapping', () => {
  test('throws ApiError carrying the status on a non-ok response', async () => {
    const { fn } = fakeFetch(() => new Response('Not found', { status: 404, statusText: 'Not Found' }))
    const { attendanceApi } = createApiClient(fn, BASE)
    try {
      await attendanceApi.getById('missing')
      throw new Error('expected ApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(404)
    }
  })
})
