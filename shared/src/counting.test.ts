import { describe, test, expect } from 'bun:test'
import { countVotes, countAllVotes, countComments, countAttendanceResponses } from './counting'
import type { Ballot, Attendance } from './types'

const ballot: Ballot = {
  id: 'b1',
  question: 'Ship it?',
  createdAt: '2024-01-01T00:00:00Z',
  votes: [
    { color: 'green', comment: 'yes!', createdAt: '2024-01-01T01:00:00Z' },
    { color: 'green', createdAt: '2024-01-01T02:00:00Z' },
    { color: 'yellow', comment: '   ', createdAt: '2024-01-01T03:00:00Z' }, // whitespace-only
    { color: 'red', comment: 'no', createdAt: '2024-01-01T04:00:00Z' }
  ]
}

describe('countVotes', () => {
  test('counts votes of a single color', () => {
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
  test('counts only votes with non-blank comments', () => {
    // "yes!" and "no" count; the whitespace-only comment does not.
    expect(countComments(ballot)).toBe(2)
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
