export type ApiResponse = {
  message: string;
  success: true;
}

export type Dashboard = {
  id: string
  name: string
  ballotIds: string[]
  createdAt: string
  updatedAt: string
}
