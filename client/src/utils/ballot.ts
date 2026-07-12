// Counting logic lives in shared/ (imported by client, server, and the edge
// unfurl function alike). This module re-exports it so existing client import
// paths (`../utils/ballot`) stay stable.
export { countVotes, countAllVotes, countComments, countAttendanceResponses } from 'shared/dist'
export type { VoteColor } from 'shared/dist'
