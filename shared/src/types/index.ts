export type ApiResponse = {
  message: string;
  success: true;
}

export type VoteColor = 'green' | 'yellow' | 'red'

export type Vote = {
  color: VoteColor
  comment?: string
  createdAt: string
}

export type Ballot = {
  id: string
  question: string
  votes: Vote[]
  createdAt: string
  isPrivate?: boolean
}

export type AdminBallot = Ballot & {
  voteCount: number
  commentCount: number
  lastVote: string | null
}

export type Dashboard = {
  id: string
  name: string
  ballotIds: string[]
  attendanceIds: string[]
  createdAt: string
  updatedAt: string
}

export type AttendanceResponse = {
  name: string
  attending: boolean
  timestamp: string
}

export type Attendance = {
  id: string
  title: string
  date: string
  responses: AttendanceResponse[]
  createdAt: string
  updatedAt: string
}
