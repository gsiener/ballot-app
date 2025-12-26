import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDashboards } from '../hooks/useDashboards'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ArrowLeft, Plus, X, Pencil } from 'lucide-react'

const API_BASE = 'https://ballot-app-server.siener.workers.dev/api'

type Ballot = {
  id: string
  question: string
  votes: Array<{
    color: 'green' | 'yellow' | 'red'
    comment?: string
  }>
  createdAt: string
}

type AttendanceResponse = {
  name: string
  attending: boolean
  timestamp: string
}

type Attendance = {
  id: string
  title: string
  date: string
  responses: AttendanceResponse[]
  createdAt: string
  updatedAt: string
}

export function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getDashboard, addBallot, removeBallot, addAttendance, removeAttendance, updateDashboard } = useDashboards()

  const dashboard = id ? getDashboard(id) : undefined
  const [ballots, setBallots] = useState<Ballot[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemInput, setNewItemInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(dashboard?.name || '')

  useEffect(() => {
    if (dashboard) {
      fetchBallots()
      fetchAttendances()
      setEditedName(dashboard.name)
    }
  }, [dashboard?.ballotIds, dashboard?.attendanceIds])

  const fetchBallots = async () => {
    if (!dashboard || dashboard.ballotIds.length === 0) {
      setBallots([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Use batch endpoint to fetch all ballots in a single request
      const response = await fetch(
        `${API_BASE}/ballots/batch?ids=${dashboard.ballotIds.join(',')}`
      )
      if (!response.ok) {
        console.error('Failed to fetch ballots batch')
        setBallots([])
        return
      }
      const results = await response.json()
      setBallots(results)
    } catch (error) {
      console.error('Error fetching ballots:', error)
      setBallots([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendances = async () => {
    if (!dashboard) return

    const attendanceIds = dashboard.attendanceIds || []
    if (attendanceIds.length === 0) {
      setAttendances([])
      return
    }

    try {
      // Use batch endpoint to fetch all attendances in a single request
      const response = await fetch(
        `${API_BASE}/attendance/batch?ids=${attendanceIds.join(',')}`
      )
      if (!response.ok) {
        console.error('Failed to fetch attendances batch')
        setAttendances([])
        return
      }
      const results = await response.json()
      setAttendances(results)
    } catch (error) {
      console.error('Error fetching attendances:', error)
      setAttendances([])
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemInput.trim() || !id) return

    setAdding(true)
    try {
      const input = newItemInput.trim()

      // Check if URL contains /attendance/ to determine type
      const isAttendanceUrl = input.includes('/attendance/')

      // Extract ID from URL or use as-is
      let itemId = input
      if (input.includes('/')) {
        const parts = input.split('/')
        itemId = parts[parts.length - 1]
      }

      // If URL indicates attendance, or ID starts with attendance-, try attendance first
      if (isAttendanceUrl || itemId.startsWith('attendance-')) {
        const response = await fetch(`${API_BASE}/attendance/${itemId}`)
        if (response.ok) {
          await addAttendance(id, itemId)
          setNewItemInput('')
          return
        }
      }

      // Try ballot first
      const ballotResponse = await fetch(`${API_BASE}/ballots/${itemId}`)
      if (ballotResponse.ok) {
        await addBallot(id, itemId)
        setNewItemInput('')
        return
      }

      // If ballot fails, try attendance
      const attendanceResponse = await fetch(`${API_BASE}/attendance/${itemId}`)
      if (attendanceResponse.ok) {
        await addAttendance(id, itemId)
        setNewItemInput('')
        return
      }

      // Neither found
      alert('Item not found. Please check the URL or ID.')
    } catch (error) {
      alert('Failed to add item. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveAttendance = async (attendanceId: string) => {
    if (!id) return
    if (window.confirm('Remove this attendance from the dashboard?')) {
      try {
        await removeAttendance(id, attendanceId)
      } catch (error) {
        console.error('Failed to remove attendance:', error)
        alert('Failed to remove attendance. Please try again.')
      }
    }
  }

  const handleRemoveBallot = async (ballotId: string) => {
    if (!id) return
    if (window.confirm('Remove this ballot from the dashboard?')) {
      try {
        await removeBallot(id, ballotId)
      } catch (error) {
        console.error('Failed to remove ballot:', error)
        alert('Failed to remove ballot. Please try again.')
      }
    }
  }

  const handleSaveName = async () => {
    if (!id || !editedName.trim()) return
    try {
      await updateDashboard(id, { name: editedName.trim() })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update dashboard name:', error)
      alert('Failed to update dashboard name. Please try again.')
    }
  }

  const countVotes = (ballot: Ballot, color: 'green' | 'yellow' | 'red') => {
    return ballot.votes.filter(vote => vote.color === color).length
  }

  const countComments = (ballot: Ballot) => {
    return ballot.votes.filter(vote => vote.comment && vote.comment.trim() !== '').length
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Dashboard not found</h2>
          <Button onClick={() => navigate('/dashboards')}>
            Back to Dashboards
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboards')}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboards
      </Button>

      <div className="mb-6">
        {isEditing ? (
          <div className="flex items-center gap-2 mb-2">
            <Input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-2xl font-bold"
              autoFocus
            />
            <Button onClick={handleSaveName} size="sm">
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditing(false)
                setEditedName(dashboard.name)
              }}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{dashboard.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-muted-foreground">
          {dashboard.ballotIds.length} ballot{dashboard.ballotIds.length !== 1 ? 's' : ''} •{' '}
          {(dashboard.attendanceIds || []).length} attendance{(dashboard.attendanceIds || []).length !== 1 ? 's' : ''} •
          Last updated {new Date(dashboard.updatedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Add Item</h2>
        <form onSubmit={handleAddItem} className="flex gap-2">
          <Input
            type="text"
            value={newItemInput}
            onChange={(e) => setNewItemInput(e.target.value)}
            placeholder="Paste ballot or attendance URL"
            className="flex-grow"
            disabled={adding}
          />
          <Button
            type="submit"
            disabled={adding}
            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : ballots.length === 0 && attendances.length === 0 ? (
        <div className="text-center py-16 bg-card text-card-foreground border border-border rounded-lg">
          <p className="text-muted-foreground">
            No ballots or attendances in this dashboard yet. Add one above to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {ballots.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground">Ballots</h2>
              <div className="space-y-4">
                {ballots.map((ballot) => (
                  <div
                    key={ballot.id}
                    className="bg-card text-card-foreground border border-border rounded-lg p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-grow pr-4">
                        <h3 className="text-lg font-semibold mb-1">
                          <a
                            href={`/${ballot.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-red-500 hover:underline transition-colors"
                          >
                            {ballot.question}
                          </a>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {ballot.votes.length} votes • {countComments(ballot)} comments
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBallot(ballot.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1">
                        <span className="text-lg">✅</span>
                        <span className="font-medium">{countVotes(ballot, 'green')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">⚠️</span>
                        <span className="font-medium">{countVotes(ballot, 'yellow')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">❌</span>
                        <span className="font-medium">{countVotes(ballot, 'red')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attendances.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground">Attendance</h2>
              <div className="space-y-4">
                {attendances.map((attendance) => {
                  const yesCount = attendance.responses.filter(r => r.attending).length
                  const noCount = attendance.responses.filter(r => !r.attending).length
                  return (
                    <div
                      key={attendance.id}
                      className="bg-card text-card-foreground border border-border rounded-lg p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-grow pr-4">
                          <h3 className="text-lg font-semibold mb-1">
                            <a
                              href={`/attendance/${attendance.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:text-red-500 hover:underline transition-colors"
                            >
                              {attendance.title}
                            </a>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(attendance.date).toLocaleDateString()} • {attendance.responses.length} responses
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttendance(attendance.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1">
                          <span className="text-lg">✅</span>
                          <span className="font-medium">{yesCount} yes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-lg">❌</span>
                          <span className="font-medium">{noCount} no</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
