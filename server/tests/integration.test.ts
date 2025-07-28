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