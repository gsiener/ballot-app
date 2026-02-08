import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAttendance } from '../hooks/useAttendance'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { AttendanceCalendar } from '../components/AttendanceCalendar'
import { Plus, Users, Calendar } from 'lucide-react'

export function AttendanceListPage() {
  const navigate = useNavigate()
  const { attendances, loading, createAttendance } = useAttendance()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newDate) return

    try {
      const attendance = await createAttendance(newTitle, newDate)
      setNewTitle('')
      setNewDate('')
      setShowCreateForm(false)
      navigate(`/attendance/${attendance.id}`)
    } catch (error) {
      console.error('Failed to create attendance:', error)
      alert('Failed to create attendance. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const countResponses = (responses: { attending: boolean }[]) => {
    const yes = responses.filter(r => r.attending).length
    const no = responses.filter(r => !r.attending).length
    return { yes, no, total: responses.length }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center py-8">Loading attendance records...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Track attendance for events and meetings
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Attendance
        </Button>
      </div>

      <AttendanceCalendar
        attendances={attendances}
        onCreateAttendance={createAttendance}
      />

      {showCreateForm && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Create New Attendance</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
                Title
              </label>
              <Input
                id="title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Event title (e.g., Team Meeting)"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-1">
                Date
              </label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Create
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewTitle('')
                  setNewDate('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {attendances.length === 0 ? (
        <div className="text-center py-16 bg-card text-card-foreground border border-border rounded-lg">
          <div className="max-w-md mx-auto">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No attendance records yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first attendance to start tracking who's coming
            </p>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Attendance
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {attendances.map((attendance) => {
            const counts = countResponses(attendance.responses)
            return (
              <div
                key={attendance.id}
                className="bg-card text-card-foreground border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <h2 className="text-xl font-semibold mb-2">
                      <a
                        href={`/attendance/${attendance.id}`}
                        className="text-foreground hover:text-blue-500 hover:underline transition-colors"
                      >
                        {attendance.title}
                      </a>
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(attendance.date)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {counts.total} response{counts.total !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                      {counts.yes} Yes
                    </span>
                    <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                      {counts.no} No
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
