import { describe, test, expect } from 'bun:test'
import { countVotes, countAllVotes, countComments, countAttendanceResponses } from './ballot'
import type { Ballot, Attendance } from 'shared/dist'

// These import the REAL counting functions (re-exported from shared/) through
// the client's own import path, rather than redefining them in the test — so a
// change in the shared implementation is actually caught here.

const ballot: Ballot = {
  id: 'test-1',
  question: 'Test ballot?',
  createdAt: '2024-01-01T09:00:00Z',
  votes: [
    { color: 'green', comment: 'Good idea', createdAt: '2024-01-01T10:00:00Z' },
    { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
    { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
    { color: 'red', comment: '   ', createdAt: '2024-01-01T13:00:00Z' }
  ]
}

describe('countVotes', () => {
  test('counts votes of each color', () => {
    expect(countVotes(ballot, 'green')).toBe(2)
    expect(countVotes(ballot, 'yellow')).toBe(1)
    expect(countVotes(ballot, 'red')).toBe(1)
  })
})

describe('countAllVotes', () => {
  test('returns a per-color tally', () => {
    expect(countAllVotes(ballot)).toEqual({ green: 2, yellow: 1, red: 1 })
  })
})

describe('countComments', () => {
  test('counts only non-blank comments', () => {
    // 'Good idea' and 'Maybe' count; the empty and whitespace-only ones do not.
    expect(countComments(ballot)).toBe(2)
  })

  test('is zero for a ballot with no votes', () => {
    const empty: Ballot = { ...ballot, votes: [] }
    expect(countComments(empty)).toBe(0)
    expect(countAllVotes(empty)).toEqual({ green: 0, yellow: 0, red: 0 })
  })
})

describe('countAttendanceResponses', () => {
  test('tallies yes / no / total', () => {
    const attendance: Attendance = {
      id: 'a1',
      title: 'Standup',
      date: '2024-01-15',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      responses: [
        { name: 'Ada', attending: true, timestamp: '2024-01-01T00:00:00Z' },
        { name: 'Bo', attending: false, timestamp: '2024-01-01T00:00:00Z' },
        { name: 'Cy', attending: true, timestamp: '2024-01-01T00:00:00Z' }
      ]
    }
    expect(countAttendanceResponses(attendance)).toEqual({ yes: 2, no: 1, total: 3 })
  })
})
