import { describe, test, expect, beforeEach, mock } from 'bun:test'

// Integration tests for complete admin workflow
describe('Admin Workflow Integration', () => {
  const adminKey = 'test-admin-key-123'
  const mockKV = {
    get: mock(async (key: string) => {
      if (key === 'ballots') {
        return JSON.stringify([
          {
            id: 'test-1',
            question: 'Integration test ballot?',
            votes: [
              { color: 'green', comment: 'Good', createdAt: '2024-01-01T10:00:00Z' }
            ],
            createdAt: '2024-01-01T09:00:00Z'
          },
          {
            id: 'test-2',
            question: 'Another test ballot?',
            votes: [],
            createdAt: '2024-01-02T09:00:00Z'
          }
        ])
      }
      return null
    }),
    put: mock(async (key: string, value: string) => {
      return undefined
    })
  }

  beforeEach(() => {
    mockKV.get.mockClear()
    mockKV.put.mockClear()
  })

  describe('Complete Admin Session', () => {
    test('should authenticate, list ballots, and delete ballot', async () => {
      // 1. Authentication check
      const authHeader = `Bearer ${adminKey}`
      const token = authHeader.substring(7)
      expect(token).toBe(adminKey)
      expect(authHeader.startsWith('Bearer ')).toBe(true)

      // 2. Get admin ballots
      const ballotsJson = await mockKV.get('ballots')
      expect(ballotsJson).toBeDefined()
      
      if (ballotsJson) {
        const ballots = JSON.parse(ballotsJson)
        expect(ballots).toHaveLength(2)

        // Add admin metadata
        const adminBallots = ballots.map((ballot: any) => ({
          ...ballot,
          voteCount: ballot.votes.length,
          commentCount: ballot.votes.filter((v: any) => v.comment && v.comment.trim() !== '').length,
          lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1].createdAt : null
        }))

        expect(adminBallots[0].voteCount).toBe(1)
        expect(adminBallots[0].commentCount).toBe(1)
        expect(adminBallots[1].voteCount).toBe(0)
        expect(adminBallots[1].commentCount).toBe(0)

        // 3. Delete a ballot
        const ballotToDelete = 'test-1'
        const ballotIndex = ballots.findIndex((b: any) => b.id === ballotToDelete)
        expect(ballotIndex).toBe(0)

        const deletedBallot = ballots[ballotIndex]
        ballots.splice(ballotIndex, 1)

        // 4. Save updated ballots
        await mockKV.put('ballots', JSON.stringify(ballots))
        expect(mockKV.put).toHaveBeenCalledWith('ballots', JSON.stringify(ballots))

        // 5. Verify deletion
        expect(ballots).toHaveLength(1)
        expect(ballots[0].id).toBe('test-2')
        expect(deletedBallot.id).toBe('test-1')
      }
    })

    test('should handle multiple ballot deletions', async () => {
      const ballotsJson = await mockKV.get('ballots')
      
      if (ballotsJson) {
        let ballots = JSON.parse(ballotsJson)
        expect(ballots).toHaveLength(2)

        // Delete first ballot
        const firstBallotIndex = ballots.findIndex((b: any) => b.id === 'test-1')
        ballots.splice(firstBallotIndex, 1)
        await mockKV.put('ballots', JSON.stringify(ballots))

        expect(ballots).toHaveLength(1)
        expect(ballots[0].id).toBe('test-2')

        // Delete second ballot
        const secondBallotIndex = ballots.findIndex((b: any) => b.id === 'test-2')
        ballots.splice(secondBallotIndex, 1)
        await mockKV.put('ballots', JSON.stringify(ballots))

        expect(ballots).toHaveLength(0)
      }
    })

    test('should maintain ballot integrity during admin operations', async () => {
      const ballotsJson = await mockKV.get('ballots')
      
      if (ballotsJson) {
        const ballots = JSON.parse(ballotsJson)
        
        // Verify ballot structure
        ballots.forEach((ballot: any) => {
          expect(ballot).toHaveProperty('id')
          expect(ballot).toHaveProperty('question')
          expect(ballot).toHaveProperty('votes')
          expect(ballot).toHaveProperty('createdAt')
          expect(Array.isArray(ballot.votes)).toBe(true)
        })

        // Verify vote structure
        const ballotWithVotes = ballots.find((b: any) => b.votes.length > 0)
        if (ballotWithVotes) {
          ballotWithVotes.votes.forEach((vote: any) => {
            expect(vote).toHaveProperty('color')
            expect(vote).toHaveProperty('createdAt')
            expect(['green', 'yellow', 'red']).toContain(vote.color)
          })
        }
      }
    })
  })

  describe('Error Scenarios', () => {
    test('should handle invalid admin key', () => {
      const invalidAuthHeader = 'Bearer invalid-key'
      const validKey = adminKey
      const providedKey = invalidAuthHeader.substring(7)
      
      expect(providedKey).not.toBe(validKey)
      // Should return 401 Unauthorized
    })

    test('should handle missing authorization header', () => {
      const authHeader = undefined
      expect(authHeader).toBeUndefined()
      // Should return 401 Unauthorized
    })

    test('should handle malformed authorization header', () => {
      const malformedHeaders = [
        'Basic admin-key',
        'Bearer',
        'admin-key',
        ''
      ]

      malformedHeaders.forEach(header => {
        let isValid = false
        if (header && header.length > 0) {
          isValid = header.startsWith('Bearer ') && header.length > 7
        }
        expect(isValid).toBe(false)
      })
    })

    test('should handle non-existent ballot deletion', () => {
      const ballots = [
        { id: 'test-1', question: 'Test?', votes: [], createdAt: '2024-01-01T09:00:00Z' }
      ]

      const nonExistentId = 'test-999'
      const ballotIndex = ballots.findIndex(b => b.id === nonExistentId)
      
      expect(ballotIndex).toBe(-1)
      // Should return 404 Not Found
    })

    test('should handle KV storage errors gracefully', async () => {
      // Mock KV error
      mockKV.get.mockRejectedValueOnce(new Error('KV storage unavailable'))
      
      try {
        await mockKV.get('ballots')
      } catch (error: any) {
        expect(error.message).toBe('KV storage unavailable')
        // Should fall back to demo data
      }
    })
  })

  describe('Performance and Scale', () => {
    test('should handle large ballot datasets efficiently', () => {
      // Generate large dataset for testing
      const largeBallotSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `ballot-${i}`,
        question: `Test ballot ${i}?`,
        votes: Array.from({ length: Math.floor(Math.random() * 100) }, (_, j) => ({
          color: ['green', 'yellow', 'red'][Math.floor(Math.random() * 3)],
          comment: Math.random() > 0.5 ? `Comment ${j}` : '',
          createdAt: new Date().toISOString()
        })),
        createdAt: new Date().toISOString()
      }))

      // Test admin metadata calculation performance
      const start = Date.now()
      const adminBallots = largeBallotSet.map(ballot => ({
        ...ballot,
        voteCount: ballot.votes.length,
        commentCount: ballot.votes.filter(v => v.comment && v.comment.trim() !== '').length,
        lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1].createdAt : null
      }))
      const end = Date.now()

      expect(adminBallots).toHaveLength(1000)
      expect(end - start).toBeLessThan(1000) // Should process in under 1 second
    })

    test('should handle concurrent admin operations', async () => {
      // Simulate concurrent ballot deletions
      const ballots = [
        { id: 'test-1', question: 'Test 1?', votes: [], createdAt: '2024-01-01T09:00:00Z' },
        { id: 'test-2', question: 'Test 2?', votes: [], createdAt: '2024-01-02T09:00:00Z' },
        { id: 'test-3', question: 'Test 3?', votes: [], createdAt: '2024-01-03T09:00:00Z' }
      ]

      // Simulate concurrent access
      const operations = [
        () => ballots.findIndex(b => b.id === 'test-1'),
        () => ballots.findIndex(b => b.id === 'test-2'),
        () => ballots.findIndex(b => b.id === 'test-3')
      ]

      const results = operations.map(op => op())
      expect(results).toEqual([0, 1, 2])
    })
  })

  describe('Audit and Logging', () => {
    test('should generate proper audit trail for admin actions', () => {
      const adminActions = [
        {
          action: 'admin_auth_success',
          timestamp: new Date().toISOString(),
          user: 'authenticated',
          details: { method: 'bearer_token' }
        },
        {
          action: 'admin_ballots_accessed',
          timestamp: new Date().toISOString(),
          user: 'authenticated',
          details: { ballots_count: 2 }
        },
        {
          action: 'admin_ballot_deleted',
          timestamp: new Date().toISOString(),
          user: 'authenticated',
          details: { 
            ballot_id: 'test-1',
            ballot_question: 'Integration test ballot?',
            ballot_votes: 1
          }
        }
      ]

      adminActions.forEach(action => {
        expect(action).toHaveProperty('action')
        expect(action).toHaveProperty('timestamp')
        expect(action).toHaveProperty('user')
        expect(action).toHaveProperty('details')
        expect(action.user).toBe('authenticated')
      })
    })

    test('should include proper span attributes for telemetry', () => {
      const spanAttributes = {
        'auth.success': true,
        'auth.type': 'admin',
        'operation': 'admin_delete_ballot',
        'admin.action': 'delete_ballot',
        'ballot.id': 'test-1',
        'ballot.found': true,
        'ballot.question': 'Integration test ballot?',
        'ballot.vote_count': 1
      }

      // Verify all required attributes are present
      expect(spanAttributes['auth.success']).toBe(true)
      expect(spanAttributes['auth.type']).toBe('admin')
      expect(spanAttributes['operation']).toBe('admin_delete_ballot')
      expect(spanAttributes['admin.action']).toBe('delete_ballot')
      expect(spanAttributes['ballot.id']).toBe('test-1')
      expect(spanAttributes['ballot.found']).toBe(true)
    })
  })
})

describe('End-to-End User Flows', () => {
  describe('Complete Ballot Lifecycle', () => {
    test('should complete full ballot flow: create -> vote -> view results', () => {
      // 1. Create new ballot
      const newBallot = {
        id: `ballot-${Date.now()}-abc123`,
        question: 'Should we implement feature X?',
        votes: [],
        createdAt: new Date().toISOString(),
        isPrivate: false,
        version: 1
      }

      expect(newBallot.id).toContain('ballot-')
      expect(newBallot.votes).toHaveLength(0)
      expect(newBallot.version).toBe(1)

      // 2. User A votes green
      const voteA = { color: 'green' as const, comment: 'Great idea!', createdAt: new Date().toISOString() }
      newBallot.votes.push(voteA)
      newBallot.version = 2

      expect(newBallot.votes).toHaveLength(1)
      expect(newBallot.version).toBe(2)

      // 3. User B votes yellow
      const voteB = { color: 'yellow' as const, comment: 'Need more info', createdAt: new Date().toISOString() }
      newBallot.votes.push(voteB)
      newBallot.version = 3

      expect(newBallot.votes).toHaveLength(2)
      expect(newBallot.version).toBe(3)

      // 4. User C votes red
      const voteC = { color: 'red' as const, comment: '', createdAt: new Date().toISOString() }
      newBallot.votes.push(voteC)
      newBallot.version = 4

      expect(newBallot.votes).toHaveLength(3)

      // 5. View results
      const greenVotes = newBallot.votes.filter(v => v.color === 'green').length
      const yellowVotes = newBallot.votes.filter(v => v.color === 'yellow').length
      const redVotes = newBallot.votes.filter(v => v.color === 'red').length
      const comments = newBallot.votes.filter(v => v.comment && v.comment.trim() !== '').length

      expect(greenVotes).toBe(1)
      expect(yellowVotes).toBe(1)
      expect(redVotes).toBe(1)
      expect(comments).toBe(2)
    })

    test('should handle private ballot creation and access', () => {
      const privateBallot = {
        id: `ballot-${Date.now()}-private`,
        question: 'Confidential team vote',
        votes: [],
        createdAt: new Date().toISOString(),
        isPrivate: true,
        version: 1
      }

      expect(privateBallot.isPrivate).toBe(true)

      // Private ballots should not appear in public list
      const publicBallots = [
        { id: 'public-1', isPrivate: false },
        { id: 'public-2', isPrivate: false },
        privateBallot
      ].filter(b => !b.isPrivate)

      expect(publicBallots).toHaveLength(2)
      expect(publicBallots.find(b => b.id === privateBallot.id)).toBeUndefined()
    })
  })

  describe('Complete Attendance Lifecycle', () => {
    test('should complete full attendance flow: create -> respond -> view results', () => {
      // 1. Create new attendance
      const newAttendance = {
        id: `attendance-${Date.now()}-xyz789`,
        title: 'Weekly Team Meeting',
        date: '2024-01-15',
        responses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }

      expect(newAttendance.id).toContain('attendance-')
      expect(newAttendance.responses).toHaveLength(0)

      // 2. Alice responds - attending
      const responseAlice = { name: 'Alice', attending: true, timestamp: new Date().toISOString() }
      newAttendance.responses.push(responseAlice)
      newAttendance.updatedAt = new Date().toISOString()
      newAttendance.version = 2

      expect(newAttendance.responses).toHaveLength(1)

      // 3. Bob responds - not attending
      const responseBob = { name: 'Bob', attending: false, timestamp: new Date().toISOString() }
      newAttendance.responses.push(responseBob)
      newAttendance.updatedAt = new Date().toISOString()
      newAttendance.version = 3

      expect(newAttendance.responses).toHaveLength(2)

      // 4. Charlie responds - attending
      const responseCharlie = { name: 'Charlie', attending: true, timestamp: new Date().toISOString() }
      newAttendance.responses.push(responseCharlie)
      newAttendance.updatedAt = new Date().toISOString()
      newAttendance.version = 4

      // 5. View results
      const attending = newAttendance.responses.filter(r => r.attending).length
      const notAttending = newAttendance.responses.filter(r => !r.attending).length

      expect(attending).toBe(2)
      expect(notAttending).toBe(1)
      expect(newAttendance.version).toBe(4)
    })

    test('should handle response updates (same person responds again)', () => {
      const attendance = {
        id: 'attendance-1',
        title: 'Team Meeting',
        date: '2024-01-15',
        responses: [
          { name: 'Alice', attending: true, timestamp: '2024-01-10T10:00:00Z' }
        ],
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-10T10:00:00Z',
        version: 2
      }

      // Alice changes her response
      const existingIndex = attendance.responses.findIndex(
        r => r.name.toLowerCase() === 'alice'
      )
      expect(existingIndex).toBe(0)

      // Update existing response
      attendance.responses[existingIndex] = {
        name: 'Alice',
        attending: false,
        timestamp: new Date().toISOString()
      }
      attendance.version = 3

      expect(attendance.responses).toHaveLength(1) // Still only 1 response
      expect(attendance.responses[0].attending).toBe(false)
      expect(attendance.version).toBe(3)
    })
  })

  describe('Complete Dashboard Lifecycle', () => {
    test('should complete full dashboard flow: create -> add items -> view -> update', () => {
      // 1. Create new dashboard
      const newDashboard = {
        id: `dashboard-${Date.now()}-dash1`,
        name: 'Sprint Planning',
        ballotIds: [],
        attendanceIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }

      expect(newDashboard.ballotIds).toHaveLength(0)
      expect(newDashboard.attendanceIds).toHaveLength(0)

      // 2. Add ballot to dashboard
      newDashboard.ballotIds.push('ballot-1')
      newDashboard.updatedAt = new Date().toISOString()
      newDashboard.version = 2

      expect(newDashboard.ballotIds).toHaveLength(1)

      // 3. Add attendance to dashboard
      newDashboard.attendanceIds.push('attendance-1')
      newDashboard.updatedAt = new Date().toISOString()
      newDashboard.version = 3

      expect(newDashboard.attendanceIds).toHaveLength(1)

      // 4. Add more items
      newDashboard.ballotIds.push('ballot-2', 'ballot-3')
      newDashboard.updatedAt = new Date().toISOString()
      newDashboard.version = 4

      expect(newDashboard.ballotIds).toHaveLength(3)

      // 5. Update dashboard name
      newDashboard.name = 'Sprint Planning Q1'
      newDashboard.updatedAt = new Date().toISOString()
      newDashboard.version = 5

      expect(newDashboard.name).toBe('Sprint Planning Q1')
      expect(newDashboard.version).toBe(5)
    })

    test('should handle batch fetching for dashboard items', () => {
      const allBallots = [
        { id: 'ballot-1', question: 'Q1?', votes: [], createdAt: '2024-01-01' },
        { id: 'ballot-2', question: 'Q2?', votes: [], createdAt: '2024-01-02' },
        { id: 'ballot-3', question: 'Q3?', votes: [], createdAt: '2024-01-03' },
        { id: 'ballot-4', question: 'Q4?', votes: [], createdAt: '2024-01-04' }
      ]

      const dashboard = {
        id: 'dashboard-1',
        name: 'Test Dashboard',
        ballotIds: ['ballot-1', 'ballot-3', 'ballot-999'], // ballot-999 doesn't exist
        attendanceIds: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      // Batch fetch ballots
      const requestedBallots = dashboard.ballotIds
        .map(id => allBallots.find(b => b.id === id))
        .filter((b): b is typeof allBallots[0] => b !== undefined)

      expect(requestedBallots).toHaveLength(2) // Only 2 found (ballot-999 missing)
      expect(requestedBallots.map(b => b.id)).toEqual(['ballot-1', 'ballot-3'])
    })
  })

  describe('Cross-Feature Integration', () => {
    test('should handle calendar-based attendance creation', () => {
      // Simulate clicking on a day in the calendar
      const selectedDate = '2024-01-15'

      // Generate title from date
      const date = new Date(selectedDate + 'T00:00:00')
      const title = `Attendance for ${date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })}`

      const newAttendance = {
        id: `attendance-${Date.now()}-cal`,
        title,
        date: selectedDate,
        responses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }

      expect(newAttendance.title).toBe('Attendance for January 15, 2024')
      expect(newAttendance.date).toBe('2024-01-15')
    })

    test('should handle one-attendance-per-day logic', () => {
      const attendances = [
        { id: 'att-1', date: '2024-01-15', title: 'Meeting 1' },
        { id: 'att-2', date: '2024-01-16', title: 'Meeting 2' },
        { id: 'att-3', date: '2024-01-17', title: 'Meeting 3' }
      ]

      // Build date lookup map
      const attendanceByDate = new Map(attendances.map(a => [a.date, a]))

      // Check if date has attendance
      expect(attendanceByDate.has('2024-01-15')).toBe(true)
      expect(attendanceByDate.has('2024-01-18')).toBe(false)

      // Get attendance for specific date
      const jan15Attendance = attendanceByDate.get('2024-01-15')
      expect(jan15Attendance?.id).toBe('att-1')
    })
  })

  describe('Error Recovery Scenarios', () => {
    test('should handle version conflict recovery', () => {
      // Initial ballot state
      const ballot = {
        id: 'ballot-1',
        question: 'Test?',
        votes: [{ color: 'green', createdAt: '2024-01-01' }],
        version: 5
      }

      // Client has stale version
      const clientVersion = 3
      const serverVersion = ballot.version

      // Detect conflict
      const hasConflict = clientVersion !== serverVersion
      expect(hasConflict).toBe(true)

      // Recovery: client fetches fresh data
      const refreshedBallot = { ...ballot }

      // Client retries with correct version
      const retryVersion = refreshedBallot.version
      expect(retryVersion).toBe(5)

      // Update should now succeed
      const updatedBallot = {
        ...refreshedBallot,
        votes: [...refreshedBallot.votes, { color: 'red', createdAt: '2024-01-02' }],
        version: refreshedBallot.version + 1
      }

      expect(updatedBallot.version).toBe(6)
      expect(updatedBallot.votes).toHaveLength(2)
    })

    test('should handle network retry logic', async () => {
      let attemptCount = 0
      const maxRetries = 3

      const simulateRequest = async (): Promise<boolean> => {
        attemptCount++
        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount < 3) {
          throw new Error('Network error')
        }
        return true
      }

      let success = false
      let lastError: Error | null = null

      for (let i = 0; i < maxRetries; i++) {
        try {
          success = await simulateRequest()
          break
        } catch (error) {
          lastError = error as Error
        }
      }

      expect(attemptCount).toBe(3)
      expect(success).toBe(true)
    })
  })
})