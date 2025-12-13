export type ApiResponse = {
  message: string;
  success: true;
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
