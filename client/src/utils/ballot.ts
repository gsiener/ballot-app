import type { Ballot, Vote } from '../api/client'
import type { Attendance, AttendanceResponse } from 'shared/dist'

export type VoteColor = 'green' | 'yellow' | 'red'

/**
 * Count votes of a specific color in a ballot
 */
export function countVotes(ballot: Ballot, color: VoteColor): number {
  return ballot.votes.filter(vote => vote.color === color).length
}

/**
 * Count all votes by color in a ballot
 */
export function countAllVotes(ballot: Ballot): Record<VoteColor, number> {
  return {
    green: countVotes(ballot, 'green'),
    yellow: countVotes(ballot, 'yellow'),
    red: countVotes(ballot, 'red')
  }
}

/**
 * Count votes with non-empty comments in a ballot
 */
export function countComments(ballot: Ballot): number {
  return ballot.votes.filter(vote => vote.comment && vote.comment.trim() !== '').length
}

/**
 * Count attendance responses by attending status
 */
export function countAttendanceResponses(attendance: Attendance): {
  yes: number
  no: number
  total: number
} {
  const yes = attendance.responses.filter(r => r.attending).length
  const no = attendance.responses.filter(r => !r.attending).length
  return { yes, no, total: attendance.responses.length }
}
