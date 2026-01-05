import type { Ballot, Vote, VoteColor, AdminBallot, Dashboard } from 'shared/dist'

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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text()
    throw new ApiError(
      errorBody || response.statusText,
      response.status,
      response.statusText
    )
  }
  return response.json()
}

// Ballot API
export const ballotApi = {
  getAll: async (): Promise<Ballot[]> => {
    const response = await fetch(`${API_BASE_URL}/api/ballots`)
    return handleResponse<Ballot[]>(response)
  },

  getById: async (id: string): Promise<Ballot> => {
    const response = await fetch(`${API_BASE_URL}/api/ballots/${id}`)
    return handleResponse<Ballot>(response)
  },

  create: async (question: string, isPrivate = false): Promise<Ballot> => {
    const response = await fetch(`${API_BASE_URL}/api/ballots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, isPrivate })
    })
    return handleResponse<Ballot>(response)
  },

  addVote: async (ballot: Ballot, color: VoteColor, comment?: string): Promise<Ballot> => {
    const newVote: Vote = {
      color,
      comment: comment?.trim() || undefined,
      createdAt: new Date().toISOString()
    }

    const response = await fetch(`${API_BASE_URL}/api/ballots/${ballot.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...ballot,
        votes: [...ballot.votes, newVote]
      })
    })
    return handleResponse<Ballot>(response)
  }
}

// Dashboard API
export const dashboardApi = {
  getAll: async (): Promise<Dashboard[]> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboards`)
    return handleResponse<Dashboard[]>(response)
  },

  getById: async (id: string): Promise<Dashboard> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboards/${id}`)
    return handleResponse<Dashboard>(response)
  },

  create: async (name: string): Promise<Dashboard> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    })
    return handleResponse<Dashboard>(response)
  },

  update: async (id: string, updates: Partial<Pick<Dashboard, 'name' | 'ballotIds'>>): Promise<Dashboard> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    return handleResponse<Dashboard>(response)
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboards/${id}`, {
      method: 'DELETE'
    })
    return handleResponse<{ message: string }>(response)
  }
}

// Admin API
export const adminApi = {
  getBallots: async (adminKey: string): Promise<AdminBallot[]> => {
    const response = await fetch(`${API_BASE_URL}/api/admin/ballots`, {
      headers: {
        'Authorization': `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
      }
    })
    return handleResponse<AdminBallot[]>(response)
  },

  deleteBallot: async (adminKey: string, ballotId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/admin/ballots/${ballotId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
      }
    })
    return handleResponse<{ message: string }>(response)
  },

  togglePrivacy: async (adminKey: string, ballotId: string, isPrivate: boolean): Promise<Ballot> => {
    const response = await fetch(`${API_BASE_URL}/api/admin/ballots/${ballotId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isPrivate })
    })
    return handleResponse<Ballot>(response)
  }
}

// Re-export types for convenience
export type { Ballot, Vote, VoteColor, AdminBallot, Dashboard }
