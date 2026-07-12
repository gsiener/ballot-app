import type { Ballot, Vote, VoteColor, AdminBallot, Dashboard, Attendance } from 'shared/dist'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ballot-app-server.siener.workers.dev'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Build the app's API client over an injected fetch and base URL. Production
 * uses the real `fetch`; tests pass a fake (see client.test.ts). This is the
 * one place network access lives — callers never reach for raw fetch or
 * re-declare the base URL.
 */
export function createApiClient(fetchImpl: typeof fetch = fetch, baseUrl: string = API_BASE_URL) {
  // Single owner of URL construction, response handling, and error mapping.
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, init)
    if (!response.ok) {
      const errorBody = await response.text()
      throw new ApiError(errorBody || response.statusText, response.status, response.statusText)
    }
    return response.json() as Promise<T>
  }

  const jsonHeaders = { 'Content-Type': 'application/json' }
  const authHeaders = (adminKey: string) => ({
    'Authorization': `Bearer ${adminKey}`,
    'Content-Type': 'application/json'
  })
  const postJson = (body: unknown) => ({ method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) })
  const putJson = (body: unknown) => ({ method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) })

  const ballotApi = {
    getAll: (): Promise<Ballot[]> => request('/api/ballots'),

    getById: (id: string): Promise<Ballot> => request(`/api/ballots/${id}`),

    create: (question: string, isPrivate = false): Promise<Ballot> =>
      request('/api/ballots', postJson({ question, isPrivate })),

    addVote: (ballot: Ballot, color: VoteColor, comment?: string): Promise<Ballot> => {
      const newVote: Vote = { color, comment: comment?.trim() || undefined, createdAt: new Date().toISOString() }
      return request(`/api/ballots/${ballot.id}`, putJson({ ...ballot, votes: [...ballot.votes, newVote] }))
    },

    getBatch: (ids: string[]): Promise<Ballot[]> =>
      ids.length === 0 ? Promise.resolve([]) : request(`/api/ballots/batch?ids=${ids.join(',')}`)
  }

  const dashboardApi = {
    getAll: (): Promise<Dashboard[]> => request('/api/dashboards'),

    getById: (id: string): Promise<Dashboard> => request(`/api/dashboards/${id}`),

    create: (name: string): Promise<Dashboard> => request('/api/dashboards', postJson({ name: name.trim() })),

    update: (id: string, updates: Partial<Pick<Dashboard, 'name' | 'ballotIds' | 'attendanceIds'>>): Promise<Dashboard> =>
      request(`/api/dashboards/${id}`, putJson(updates)),

    delete: (id: string): Promise<{ message: string }> =>
      request(`/api/dashboards/${id}`, { method: 'DELETE' })
  }

  const adminApi = {
    getBallots: (adminKey: string): Promise<AdminBallot[]> =>
      request('/api/admin/ballots', { headers: authHeaders(adminKey) }),

    deleteBallot: (adminKey: string, ballotId: string): Promise<{ message: string }> =>
      request(`/api/admin/ballots/${ballotId}`, { method: 'DELETE', headers: authHeaders(adminKey) }),

    togglePrivacy: (adminKey: string, ballotId: string, isPrivate: boolean): Promise<Ballot> =>
      request(`/api/admin/ballots/${ballotId}`, { method: 'PATCH', headers: authHeaders(adminKey), body: JSON.stringify({ isPrivate }) })
  }

  const attendanceApi = {
    getAll: (): Promise<Attendance[]> => request('/api/attendance'),

    getById: (id: string): Promise<Attendance> => request(`/api/attendance/${id}`),

    getBatch: (ids: string[]): Promise<Attendance[]> =>
      ids.length === 0 ? Promise.resolve([]) : request(`/api/attendance/batch?ids=${ids.join(',')}`),

    create: (title: string, date: string): Promise<Attendance> =>
      request('/api/attendance', postJson({ title: title.trim(), date })),

    respond: (id: string, name: string, attending: boolean): Promise<Attendance> =>
      request(`/api/attendance/${id}`, putJson({ name, attending })),

    delete: (adminKey: string, id: string): Promise<{ message: string }> =>
      request(`/api/attendance/${id}`, { method: 'DELETE', headers: authHeaders(adminKey) }),

    rename: (adminKey: string, id: string, title: string): Promise<Attendance> =>
      request(`/api/attendance/${id}`, { method: 'PATCH', headers: authHeaders(adminKey), body: JSON.stringify({ title }) })
  }

  return { ballotApi, dashboardApi, adminApi, attendanceApi }
}

// Default client wired to the real fetch and configured base URL.
const client = createApiClient()
export const ballotApi = client.ballotApi
export const dashboardApi = client.dashboardApi
export const adminApi = client.adminApi
export const attendanceApi = client.attendanceApi

// Re-export types for convenience
export type { Ballot, Vote, VoteColor, AdminBallot, Dashboard, Attendance }
