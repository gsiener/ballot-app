/**
 * Vote and attendance counting.
 *
 * These live in `shared/` so the client, the server, and the edge unfurl
 * function all count the same way — the server genuinely cannot import a
 * client util, so a "shared" counting module in the client was never shared
 * across the real client/server seam.
 */

import type { Ballot, VoteColor, Attendance } from './types'

/** Count votes of a specific color in a ballot. */
export function countVotes(ballot: Ballot, color: VoteColor): number {
  return ballot.votes.filter(vote => vote.color === color).length
}

/** Count all votes by color in a ballot. */
export function countAllVotes(ballot: Ballot): Record<VoteColor, number> {
  return {
    green: countVotes(ballot, 'green'),
    yellow: countVotes(ballot, 'yellow'),
    red: countVotes(ballot, 'red')
  }
}

/** Count votes carrying a non-blank comment. */
export function countComments(ballot: Ballot): number {
  return ballot.votes.filter(vote => vote.comment && vote.comment.trim() !== '').length
}

/** Tally attendance responses by attending status. */
export function countAttendanceResponses(attendance: Attendance): {
  yes: number
  no: number
  total: number
} {
  const yes = attendance.responses.filter(r => r.attending).length
  const no = attendance.responses.filter(r => !r.attending).length
  return { yes, no, total: attendance.responses.length }
}
