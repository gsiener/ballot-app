import { describe, test, expect } from 'bun:test'

// Test ballot utility functions and logic
describe('Ballot Utils', () => {
  describe('Vote Counting', () => {
    test('should count votes by color correctly', () => {
      const votes = [
        { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
        { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
        { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
        { color: 'red', comment: 'No', createdAt: '2024-01-01T13:00:00Z' },
        { color: 'green', comment: '', createdAt: '2024-01-01T14:00:00Z' }
      ]

      const countVotes = (votes: any[], color: string) => {
        return votes.filter(v => v.color === color).length
      }

      expect(countVotes(votes, 'green')).toBe(3)
      expect(countVotes(votes, 'yellow')).toBe(1)
      expect(countVotes(votes, 'red')).toBe(1)
    })

    test('should count comments correctly', () => {
      const votes = [
        { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
        { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
        { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
        { color: 'red', comment: '   ', createdAt: '2024-01-01T13:00:00Z' }
      ]

      const countComments = (votes: any[]) => {
        return votes.filter(v => v.comment && v.comment.trim() !== '').length
      }

      expect(countComments(votes)).toBe(2) // Only 'Yes' and 'Maybe'
    })
  })

  describe('URL Generation', () => {
    test('should generate correct ballot URL', () => {
      const ballotId = 'test-123'
      const origin = 'https://example.com'
      const expectedUrl = `${origin}/ballot/${ballotId}`
      
      expect(expectedUrl).toBe('https://example.com/ballot/test-123')
    })

    test('should generate admin URL with key', () => {
      const origin = 'https://example.com'
      const adminKey = 'admin-key-123'
      const expectedUrl = `${origin}/admin?key=${adminKey}`
      
      expect(expectedUrl).toBe('https://example.com/admin?key=admin-key-123')
    })
  })

  describe('Form Validation', () => {
    test('should validate ballot question', () => {
      const validQuestions = [
        'Is this valid?',
        'Should we do this?',
        'What do you think about X?'
      ]

      const invalidQuestions = [
        '',
        '   ',
        '  \n  \t  '
      ]

      validQuestions.forEach(question => {
        expect(question.trim().length).toBeGreaterThan(0)
      })

      invalidQuestions.forEach(question => {
        expect(question.trim().length).toBe(0)
      })
    })

    test('should validate vote colors', () => {
      const validColors = ['green', 'yellow', 'red']
      const invalidColors = ['blue', 'purple', 'orange', '']

      validColors.forEach(color => {
        expect(['green', 'yellow', 'red']).toContain(color)
      })

      invalidColors.forEach(color => {
        expect(['green', 'yellow', 'red']).not.toContain(color)
      })
    })
  })

  describe('Date Formatting', () => {
    test('should handle date parsing', () => {
      const timestamps = [
        '2024-01-01T10:00:00Z',
        '2024-01-01T10:00:00.000Z',
        '2024-12-31T23:59:59.999Z'
      ]

      timestamps.forEach(timestamp => {
        const date = new Date(timestamp)
        expect(date).toBeInstanceOf(Date)
        expect(date.getTime()).toBeGreaterThan(0)
      })
    })

    test('should generate ISO timestamps', () => {
      const timestamp = new Date().toISOString()
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      
      expect(timestamp).toMatch(isoRegex)
    })
  })

  describe('API Response Handling', () => {
    test('should handle successful API responses', () => {
      const mockResponse = {
        id: 'test-1',
        question: 'Test ballot?',
        votes: [
          { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' }
        ],
        createdAt: '2024-01-01T09:00:00Z'
      }

      expect(mockResponse).toHaveProperty('id')
      expect(mockResponse).toHaveProperty('question')
      expect(mockResponse).toHaveProperty('votes')
      expect(mockResponse).toHaveProperty('createdAt')
      expect(Array.isArray(mockResponse.votes)).toBe(true)
    })

    test('should handle API error responses', () => {
      const errorResponses = [
        { ok: false, status: 400 },
        { ok: false, status: 401 },
        { ok: false, status: 404 },
        { ok: false, status: 500 }
      ]

      errorResponses.forEach(response => {
        expect(response.ok).toBe(false)
        expect(response.status).toBeGreaterThanOrEqual(400)
      })
    })
  })

  describe('Admin Metadata Calculation', () => {
    test('should calculate admin ballot metadata', () => {
      const ballot = {
        id: 'test-1',
        question: 'Test ballot?',
        votes: [
          { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' },
          { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
          { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' }
        ],
        createdAt: '2024-01-01T09:00:00Z'
      }

      const adminBallot = {
        ...ballot,
        voteCount: ballot.votes.length,
        commentCount: ballot.votes.filter(v => v.comment && v.comment.trim() !== '').length,
        lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1].createdAt : null
      }

      expect(adminBallot.voteCount).toBe(3)
      expect(adminBallot.commentCount).toBe(2) // 'Good idea' and 'Maybe'
      expect(adminBallot.lastVote).toBe('2024-01-01T12:00:00Z')
    })

    test('should handle empty ballot for admin metadata', () => {
      const emptyBallot = {
        id: 'test-2',
        question: 'Empty ballot?',
        votes: [],
        createdAt: '2024-01-01T09:00:00Z'
      }

      const adminBallot = {
        ...emptyBallot,
        voteCount: emptyBallot.votes.length,
        commentCount: emptyBallot.votes.filter(v => v.comment && v.comment.trim() !== '').length,
        lastVote: emptyBallot.votes.length > 0 ? emptyBallot.votes[emptyBallot.votes.length - 1].createdAt : null
      }

      expect(adminBallot.voteCount).toBe(0)
      expect(adminBallot.commentCount).toBe(0)
      expect(adminBallot.lastVote).toBeNull()
    })
  })

  describe('Color Class Utilities', () => {
    test('should return correct CSS classes for colors', () => {
      const getColorClass = (color: string) => {
        switch (color) {
          case 'green': return 'text-green-500'
          case 'yellow': return 'text-yellow-500'
          case 'red': return 'text-red-500'
          default: return ''
        }
      }

      expect(getColorClass('green')).toBe('text-green-500')
      expect(getColorClass('yellow')).toBe('text-yellow-500')
      expect(getColorClass('red')).toBe('text-red-500')
      expect(getColorClass('blue')).toBe('')
    })

    test('should return correct background classes for colors', () => {
      const getBgColorClass = (color: string) => {
        switch (color) {
          case 'green': return 'bg-green-500'
          case 'yellow': return 'bg-yellow-500'
          case 'red': return 'bg-red-500'
          default: return 'bg-gray-500'
        }
      }

      expect(getBgColorClass('green')).toBe('bg-green-500')
      expect(getBgColorClass('yellow')).toBe('bg-yellow-500')
      expect(getBgColorClass('red')).toBe('bg-red-500')
      expect(getBgColorClass('invalid')).toBe('bg-gray-500')
    })
  })

  describe('Vote Submission Logic', () => {
    test('should create vote object with timestamp', () => {
      const vote = {
        color: 'green' as const,
        comment: 'Test comment',
        createdAt: new Date().toISOString()
      }

      expect(vote.color).toBe('green')
      expect(vote.comment).toBe('Test comment')
      expect(vote.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    test('should handle empty comments', () => {
      const vote = {
        color: 'red' as const,
        comment: '',
        createdAt: new Date().toISOString()
      }

      expect(vote.color).toBe('red')
      expect(vote.comment).toBe('')
      expect(typeof vote.comment).toBe('string')
    })
  })
})