import { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Copy, Calendar, Users, Check, X } from 'lucide-react'
import type { Attendance } from 'shared/dist'

const API_URL = import.meta.env.VITE_API_URL || 'https://ballot-app-server.siener.workers.dev'

interface AttendanceDetailProps {
  attendanceId: string
  onBack: () => void
}

export function AttendanceDetail({ attendanceId, onBack }: AttendanceDetailProps) {
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copyPressed, setCopyPressed] = useState(false)

  useEffect(() => {
    fetchAttendance()
  }, [attendanceId])

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/attendance/${attendanceId}`)
      if (!response.ok) throw new Error('Failed to fetch attendance')
      const data = await response.json()
      setAttendance(data)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResponse = async (attending: boolean) => {
    if (!attendance || !name.trim()) {
      alert('Please enter your name')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/api/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          attending
        }),
      })
      if (!response.ok) throw new Error('Failed to submit response')
      const updatedAttendance = await response.json()
      setAttendance(updatedAttendance)
      setName('')
    } catch (error) {
      console.error('Error submitting response:', error)
      alert('Failed to submit response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const countResponses = () => {
    if (!attendance) return { yes: 0, no: 0 }
    const yes = attendance.responses.filter(r => r.attending).length
    const no = attendance.responses.filter(r => !r.attending).length
    return { yes, no }
  }

  const existingResponse = attendance?.responses.find(
    r => r.name.toLowerCase() === name.trim().toLowerCase()
  )

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  if (!attendance) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">
          <p>Attendance not found</p>
          <Button onClick={onBack} className="mt-4">Back to Attendance</Button>
        </div>
      </div>
    )
  }

  const counts = countResponses()

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="bg-card text-card-foreground shadow-md rounded-lg p-6 border border-border">
        <h1 className="text-3xl font-bold mb-2">{attendance.title}</h1>
        <div className="text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{formatDate(attendance.date)}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <a
              href={`${window.location.origin}/attendance/${attendance.id}`}
              className="font-mono text-primary flex-grow hover:underline text-xs"
              target="_blank"
              rel="noopener noreferrer"
            >
              {`${window.location.origin}/attendance/${attendance.id}`}
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setCopyPressed(true)
                await navigator.clipboard.writeText(`${window.location.origin}/attendance/${attendance.id}`)
                setTimeout(() => setCopyPressed(false), 150)
              }}
              className={`h-6 w-6 p-0 transition-all duration-150 ${copyPressed ? 'scale-95 bg-muted' : ''}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex justify-center space-x-8 mb-8">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-50 dark:bg-green-950">
              <span className="text-4xl font-bold text-green-600 dark:text-green-400">{counts.yes}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Attending</p>
          </div>
          <div className="text-center">
            <div className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-50 dark:bg-red-950">
              <span className="text-4xl font-bold text-red-600 dark:text-red-400">{counts.no}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Not Attending</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Your Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="mb-2"
            />
            {existingResponse && (
              <p className="text-sm text-muted-foreground">
                You previously responded: <span className={existingResponse.attending ? 'text-green-600' : 'text-red-600'}>
                  {existingResponse.attending ? 'Yes' : 'No'}
                </span>. Click a button below to update your response.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleResponse(true)}
              disabled={submitting || !name.trim()}
              className="w-full h-12 bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-5 w-5 mr-2" />
              Yes, I'll attend
            </Button>
            <Button
              onClick={() => handleResponse(false)}
              disabled={submitting || !name.trim()}
              className="w-full h-12 bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700 disabled:opacity-50"
            >
              <X className="h-5 w-5 mr-2" />
              No, I can't attend
            </Button>
          </div>
        </div>

        {attendance.responses.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Responses ({attendance.responses.length})
            </h2>
            <div className="grid gap-2">
              {attendance.responses
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((response, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded ${
                    response.attending
                      ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${response.attending ? 'text-green-600' : 'text-red-600'}`}>
                      {response.attending ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </span>
                    <span className="font-medium">{response.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(response.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
