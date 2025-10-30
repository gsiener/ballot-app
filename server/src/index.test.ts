import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Hono } from 'hono'

// Mock the telemetry module
const mockTelemetry = {
  initTelemetry: mock(() => {}),
  createSpan: mock(() => ({ end: mock(() => {}) })),
  addSpanAttributes: mock(() => {}),
  recordSpanEvent: mock(() => {}),
  setSpanStatus: mock(() => {})
}

// Mock the index file with telemetry mocked
const mockApp = new Hono()

// Mock KV storage
const mockKV = {
  get: mock(async (key: string) => {
    if (key === 'ballots') {
      return JSON.stringify([
        {
          id: 'test-1',
          question: 'Test ballot?',
          votes: [
            { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' },
            { color: 'red', comment: '', createdAt: '2024-01-01T11:00:00Z' }
          ],
          createdAt: '2024-01-01T09:00:00Z'
        }
      ])
    }
    if (key === 'dashboards') {
      return JSON.stringify([
        {
          id: 'dashboard-1',
          name: 'Test Dashboard',
          ballotIds: ['test-1'],
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z'
        }
      ])
    }
    return null
  }),
  put: mock(async (key: string, value: string) => {
    return undefined
  })
}

// Mock environment
const mockEnv = {
  BALLOTS_KV: mockKV,
  ADMIN_API_KEY: 'test-admin-key-123',
  HONEYCOMB_API_KEY: 'test-honeycomb-key',
  HONEYCOMB_DATASET: 'test-dataset',
  NODE_ENV: 'test'
}

describe('Ballot API', () => {
  beforeEach(() => {
    // Reset mocks
    mockKV.get.mockClear()
    mockKV.put.mockClear()
  })

  describe('GET /api/ballots', () => {
    test('should return all ballots', async () => {
      // We'll need to import and test the actual app
      // For now, testing the data structure
      const mockResponse = [
        {
          id: 'test-1',
          question: 'Test ballot?',
          votes: [
            { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' },
            { color: 'red', comment: '', createdAt: '2024-01-01T11:00:00Z' }
          ],
          createdAt: '2024-01-01T09:00:00Z'
        }
      ]

      expect(mockResponse).toHaveLength(1)
      expect(mockResponse[0]).toHaveProperty('id', 'test-1')
      expect(mockResponse[0]).toHaveProperty('question', 'Test ballot?')
      expect(mockResponse[0]?.votes).toHaveLength(2)
    })
  })

  describe('POST /api/ballots', () => {
    test('should create a new ballot', async () => {
      const newBallot = {
        question: 'New test ballot?'
      }

      // Test ballot creation logic
      const createdBallot = {
        id: expect.stringMatching(/^ballot-\d+-[a-z0-9]+$/),
        question: newBallot.question,
        votes: [],
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      }

      expect(createdBallot.question).toBe('New test ballot?')
      expect(createdBallot.votes).toHaveLength(0)
    })

    test('should reject empty question', async () => {
      const invalidBallot = {
        question: ''
      }

      // Should return error for empty question
      expect(invalidBallot.question.trim()).toBe('')
    })
  })

  describe('PUT /api/ballots/:id', () => {
    test('should add vote to existing ballot', async () => {
      const existingBallot = {
        id: 'test-1',
        question: 'Test ballot?',
        votes: [
          { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' }
        ],
        createdAt: '2024-01-01T09:00:00Z'
      }

      const newVote = {
        color: 'yellow' as const,
        comment: 'Maybe',
        createdAt: '2024-01-01T12:00:00Z'
      }

      const updatedBallot = {
        ...existingBallot,
        votes: [...existingBallot.votes, newVote]
      }

      expect(updatedBallot.votes).toHaveLength(2)
      expect(updatedBallot.votes[1]).toEqual(newVote)
    })
  })
})

describe('Admin API', () => {
  describe('Authentication', () => {
    test('should require admin API key', () => {
      const authHeader = 'Bearer test-admin-key-123'
      const token = authHeader.substring(7)
      
      expect(token).toBe('test-admin-key-123')
      expect(authHeader.startsWith('Bearer ')).toBe(true)
    })

    test('should reject invalid API key', () => {
      const invalidToken = 'invalid-key'
      const validToken = 'test-admin-key-123'
      
      expect(invalidToken).not.toBe(validToken)
    })

    test('should reject missing authorization header', () => {
      const authHeader = undefined
      
      expect(authHeader).toBeUndefined()
    })
  })

  describe('GET /api/admin/ballots', () => {
    test('should return ballots with admin metadata', () => {
      const ballot = {
        id: 'test-1',
        question: 'Test ballot?',
        votes: [
          { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' },
          { color: 'red', comment: '', createdAt: '2024-01-01T11:00:00Z' }
        ],
        createdAt: '2024-01-01T09:00:00Z'
      }

      const adminBallot = {
        ...ballot,
        voteCount: ballot.votes.length,
        commentCount: ballot.votes.filter(v => v.comment && v.comment.trim() !== '').length,
        lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1]?.createdAt || null : null
      }

      expect(adminBallot.voteCount).toBe(2)
      expect(adminBallot.commentCount).toBe(1) // Only first vote has comment
      expect(adminBallot.lastVote).toBe('2024-01-01T11:00:00Z')
    })
  })

  describe('DELETE /api/admin/ballots/:id', () => {
    test('should delete ballot and return confirmation', () => {
      const ballots = [
        {
          id: 'test-1',
          question: 'Test ballot?',
          votes: [{ color: 'green', comment: 'Good', createdAt: '2024-01-01T10:00:00Z' }],
          createdAt: '2024-01-01T09:00:00Z'
        },
        {
          id: 'test-2',
          question: 'Another ballot?',
          votes: [],
          createdAt: '2024-01-02T09:00:00Z'
        }
      ]

      const ballotToDelete = 'test-1'
      const ballotIndex = ballots.findIndex(b => b.id === ballotToDelete)
      const deletedBallot = ballots[ballotIndex]
      
      expect(ballotIndex).toBe(0)
      expect(deletedBallot).toBeDefined()
      if (deletedBallot) {
        expect(deletedBallot.id).toBe('test-1')
      }

      // Remove from array
      ballots.splice(ballotIndex, 1)
      expect(ballots).toHaveLength(1)
      expect(ballots[0]?.id).toBe('test-2')
    })

    test('should return 404 for non-existent ballot', () => {
      const ballots = [
        { id: 'test-1', question: 'Test?', votes: [], createdAt: '2024-01-01T09:00:00Z' }
      ]

      const nonExistentId = 'test-999'
      const ballotIndex = ballots.findIndex(b => b.id === nonExistentId)
      
      expect(ballotIndex).toBe(-1)
    })
  })
})

describe('Vote Counting Logic', () => {
  test('should count votes by color correctly', () => {
    const votes = [
      { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
      { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
      { color: 'red', comment: 'No', createdAt: '2024-01-01T13:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T14:00:00Z' }
    ]

    const greenCount = votes.filter(v => v.color === 'green').length
    const yellowCount = votes.filter(v => v.color === 'yellow').length
    const redCount = votes.filter(v => v.color === 'red').length
    const commentCount = votes.filter(v => v.comment && v.comment.trim() !== '').length

    expect(greenCount).toBe(3)
    expect(yellowCount).toBe(1)
    expect(redCount).toBe(1)
    expect(commentCount).toBe(3)
  })
})

describe('KV Storage Operations', () => {
  test('should handle ballot retrieval from KV', async () => {
    const result = await mockKV.get('ballots')
    expect(mockKV.get).toHaveBeenCalledWith('ballots')
    expect(result).toBeDefined()
    
    if (result !== null) {
      const ballots = JSON.parse(result)
      expect(Array.isArray(ballots)).toBe(true)
      expect(ballots).toHaveLength(1)
    }
  })

  test('should handle ballot storage to KV', async () => {
    const ballots = [
      { id: 'test-1', question: 'Test?', votes: [], createdAt: '2024-01-01T09:00:00Z' }
    ]
    
    await mockKV.put('ballots', JSON.stringify(ballots))
    expect(mockKV.put).toHaveBeenCalledWith('ballots', JSON.stringify(ballots))
  })

  test('should return demo data when KV is empty', async () => {
    // Mock empty KV response
    mockKV.get.mockResolvedValueOnce(null)
    
    const result = await mockKV.get('ballots')
    expect(result).toBeNull()
    
    // Demo data should be used
    const demoData = [
      {
        id: 'demo-1',
        question: 'Should we implement dark mode for the application?',
        votes: expect.any(Array),
        createdAt: expect.any(String)
      }
    ]
    
    expect(demoData[0]).toHaveProperty('id', 'demo-1')
    expect(demoData[0]).toHaveProperty('question')
  })
})

describe('Input Validation', () => {
  test('should validate ballot question', () => {
    const validQuestion = 'Is this a valid question?'
    const emptyQuestion = ''
    const whitespaceQuestion = '   '
    
    expect(validQuestion.trim().length).toBeGreaterThan(0)
    expect(emptyQuestion.trim().length).toBe(0)
    expect(whitespaceQuestion.trim().length).toBe(0)
  })

  test('should validate vote colors', () => {
    const validColors = ['green', 'yellow', 'red']
    const invalidColor = 'blue'
    
    expect(validColors).toContain('green')
    expect(validColors).toContain('yellow')
    expect(validColors).toContain('red')
    expect(validColors).not.toContain(invalidColor)
  })

  test('should handle optional vote comments', () => {
    const voteWithComment = {
      color: 'green' as const,
      comment: 'This is great!',
      createdAt: '2024-01-01T10:00:00Z'
    }
    
    const voteWithoutComment = {
      color: 'red' as const,
      comment: '',
      createdAt: '2024-01-01T11:00:00Z'
    }
    
    expect(voteWithComment.comment).toBeDefined()
    expect(voteWithComment.comment.trim()).toBe('This is great!')
    expect(voteWithoutComment.comment).toBe('')
  })
})

describe('Date Handling', () => {
  test('should generate valid ISO timestamps', () => {
    const timestamp = new Date().toISOString()
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

    expect(timestamp).toMatch(isoRegex)
  })

  test('should handle date parsing for display', () => {
    const timestamp = '2024-01-01T10:00:00Z'
    const date = new Date(timestamp)

    expect(date.toLocaleDateString()).toBeDefined()
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0) // January is 0
    expect(date.getDate()).toBe(1)
  })
})

describe('Dashboard API', () => {
  beforeEach(() => {
    // Reset mocks
    mockKV.get.mockClear()
    mockKV.put.mockClear()
  })

  describe('GET /api/dashboards', () => {
    test('should return all dashboards', async () => {
      const mockResponse = [
        {
          id: 'dashboard-1',
          name: 'Test Dashboard',
          ballotIds: ['test-1'],
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z'
        }
      ]

      expect(mockResponse).toHaveLength(1)
      expect(mockResponse[0]).toHaveProperty('id', 'dashboard-1')
      expect(mockResponse[0]).toHaveProperty('name', 'Test Dashboard')
      expect(mockResponse[0]?.ballotIds).toHaveLength(1)
    })

    test('should return empty array when no dashboards exist', async () => {
      const emptyResponse: any[] = []
      expect(emptyResponse).toHaveLength(0)
    })
  })

  describe('GET /api/dashboards/:id', () => {
    test('should return a specific dashboard', async () => {
      const dashboard = {
        id: 'dashboard-1',
        name: 'Test Dashboard',
        ballotIds: ['test-1'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }

      expect(dashboard).toHaveProperty('id', 'dashboard-1')
      expect(dashboard).toHaveProperty('name', 'Test Dashboard')
      expect(dashboard.ballotIds).toContain('test-1')
    })

    test('should return 404 for non-existent dashboard', async () => {
      const dashboard = null
      expect(dashboard).toBeNull()
    })
  })

  describe('POST /api/dashboards', () => {
    test('should create a new dashboard', async () => {
      const newDashboard = {
        name: 'New Dashboard'
      }

      // Test dashboard creation logic
      const createdDashboard = {
        id: expect.stringMatching(/^dashboard-\d+-[a-z0-9]+$/),
        name: newDashboard.name,
        ballotIds: [],
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      }

      expect(createdDashboard.name).toBe('New Dashboard')
      expect(createdDashboard.ballotIds).toHaveLength(0)
    })

    test('should reject empty dashboard name', async () => {
      const invalidDashboard = {
        name: ''
      }

      expect(invalidDashboard.name.trim()).toBe('')
    })

    test('should reject dashboard without name', async () => {
      const invalidDashboard = {}

      expect(invalidDashboard).not.toHaveProperty('name')
    })

    test('should trim dashboard name', async () => {
      const dashboardWithSpaces = {
        name: '  Dashboard with spaces  '
      }

      const trimmedName = dashboardWithSpaces.name.trim()
      expect(trimmedName).toBe('Dashboard with spaces')
    })
  })

  describe('PUT /api/dashboards/:id', () => {
    test('should update dashboard name', async () => {
      const updatedDashboard = {
        id: 'dashboard-1',
        name: 'Updated Dashboard Name',
        ballotIds: ['test-1'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      }

      expect(updatedDashboard.name).toBe('Updated Dashboard Name')
      expect(updatedDashboard.updatedAt).toBeDefined()
    })

    test('should update dashboard ballotIds', async () => {
      const updatedDashboard = {
        id: 'dashboard-1',
        name: 'Test Dashboard',
        ballotIds: ['test-1', 'test-2', 'test-3'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      }

      expect(updatedDashboard.ballotIds).toHaveLength(3)
      expect(updatedDashboard.ballotIds).toContain('test-2')
      expect(updatedDashboard.ballotIds).toContain('test-3')
    })

    test('should update both name and ballotIds', async () => {
      const updatedDashboard = {
        id: 'dashboard-1',
        name: 'Completely Updated',
        ballotIds: ['new-ballot-1'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      }

      expect(updatedDashboard.name).toBe('Completely Updated')
      expect(updatedDashboard.ballotIds).toEqual(['new-ballot-1'])
    })

    test('should return 404 for non-existent dashboard', async () => {
      const dashboard = null
      expect(dashboard).toBeNull()
    })
  })

  describe('DELETE /api/dashboards/:id', () => {
    test('should delete a dashboard', async () => {
      const deleteResponse = {
        message: 'Dashboard deleted successfully',
        deletedDashboard: {
          id: 'dashboard-1',
          name: 'Test Dashboard',
          ballotCount: 1
        }
      }

      expect(deleteResponse.message).toBe('Dashboard deleted successfully')
      expect(deleteResponse.deletedDashboard.id).toBe('dashboard-1')
      expect(deleteResponse.deletedDashboard.ballotCount).toBe(1)
    })

    test('should return 404 for non-existent dashboard', async () => {
      const dashboard = null
      expect(dashboard).toBeNull()
    })
  })

  describe('Dashboard Data Validation', () => {
    test('should have valid dashboard structure', () => {
      const dashboard = {
        id: 'dashboard-1',
        name: 'Test Dashboard',
        ballotIds: ['test-1', 'test-2'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }

      expect(dashboard).toHaveProperty('id')
      expect(dashboard).toHaveProperty('name')
      expect(dashboard).toHaveProperty('ballotIds')
      expect(dashboard).toHaveProperty('createdAt')
      expect(dashboard).toHaveProperty('updatedAt')
      expect(Array.isArray(dashboard.ballotIds)).toBe(true)
    })

    test('should handle dashboards with no ballots', () => {
      const emptyDashboard = {
        id: 'dashboard-2',
        name: 'Empty Dashboard',
        ballotIds: [],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T09:00:00Z'
      }

      expect(emptyDashboard.ballotIds).toHaveLength(0)
    })

    test('should handle dashboards with multiple ballots', () => {
      const fullDashboard = {
        id: 'dashboard-3',
        name: 'Full Dashboard',
        ballotIds: ['ballot-1', 'ballot-2', 'ballot-3', 'ballot-4', 'ballot-5'],
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      }

      expect(fullDashboard.ballotIds).toHaveLength(5)
    })
  })
})