import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from "./ui/button"
import { Trash2, AlertTriangle, Shield, Eye, MessageSquare, Lock, Unlock, Users, Calendar, Pencil } from 'lucide-react'
import { adminApi, dashboardApi, attendanceApi, ApiError, type AdminBallot, type Dashboard, type Attendance } from '../api/client'
import { countVotes, countAttendanceResponses } from '../utils/ballot'

export function AdminPanel() {
  const [searchParams] = useSearchParams()
  const [ballots, setBallots] = useState<AdminBallot[]>([])
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingDashboard, setDeletingDashboard] = useState<string | null>(null)
  const [deletingAttendance, setDeletingAttendance] = useState<string | null>(null)
  const [renamingAttendance, setRenamingAttendance] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const adminKey = searchParams.get('key')

  useEffect(() => {
    if (!adminKey) {
      setLoading(false)
      return
    }

    fetchAdminBallots()
    fetchDashboards()
    fetchAttendances()
  }, [adminKey])

  useEffect(() => {
    document.title = 'Ballot Admin'
  }, [])

  // Auto-dismiss toast with proper cleanup
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const fetchAdminBallots = async () => {
    if (!adminKey) return

    try {
      const data = await adminApi.getBallots(adminKey)
      setBallots(data)
      setAuthenticated(true)
      setError(null)
    } catch (error) {
      console.error('Error fetching admin ballots:', error)
      if (error instanceof ApiError && error.status === 401) {
        setAuthenticated(false)
        setError('Invalid admin key')
      } else {
        setError('Failed to load admin data')
        setAuthenticated(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBallot = async (ballotId: string, ballotQuestion: string) => {
    if (!adminKey) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete this ballot?\n\n"${ballotQuestion}"\n\nThis action cannot be undone.`
    )

    if (!confirmDelete) return

    setDeleting(ballotId)

    try {
      await adminApi.deleteBallot(adminKey, ballotId)

      // Remove from local state
      setBallots(prev => prev.filter(ballot => ballot.id !== ballotId))
      setToast('Ballot deleted successfully')
    } catch (error) {
      console.error('Error deleting ballot:', error)
      alert('Failed to delete ballot. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const handleTogglePrivacy = async (ballotId: string, currentPrivacy: boolean) => {
    if (!adminKey) return

    try {
      const updatedBallot = await adminApi.togglePrivacy(adminKey, ballotId, !currentPrivacy)

      // Update local state
      setBallots(prev =>
        prev.map(ballot =>
          ballot.id === ballotId
            ? { ...ballot, isPrivate: updatedBallot.isPrivate }
            : ballot
        )
      )

    } catch (error) {
      console.error('Error toggling privacy:', error)
      alert('Failed to update privacy setting. Please try again.')
    }
  }

  const fetchDashboards = async () => {
    try {
      const data = await dashboardApi.getAll()
      setDashboards(data)
    } catch (error) {
      console.error('Error fetching dashboards:', error)
    }
  }

  const fetchAttendances = async () => {
    try {
      const data = await attendanceApi.getAll()
      setAttendances(data)
    } catch (error) {
      console.error('Error fetching attendances:', error)
    }
  }

  const handleDeleteDashboard = async (dashboardId: string, dashboardName: string) => {
    if (!adminKey) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the dashboard "${dashboardName}"?\n\nThis action cannot be undone.`
    )

    if (!confirmDelete) return

    setDeletingDashboard(dashboardId)

    try {
      await dashboardApi.delete(dashboardId)

      // Remove from local state
      setDashboards(prev => prev.filter(dashboard => dashboard.id !== dashboardId))
      setToast('Dashboard deleted successfully')
    } catch (error) {
      console.error('Error deleting dashboard:', error)
      alert('Failed to delete dashboard. Please try again.')
    } finally {
      setDeletingDashboard(null)
    }
  }

  const handleDeleteAttendance = async (attendanceId: string, attendanceTitle: string) => {
    if (!adminKey) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the attendance "${attendanceTitle}"?\n\nThis action cannot be undone.`
    )

    if (!confirmDelete) return

    setDeletingAttendance(attendanceId)

    try {
      await attendanceApi.delete(adminKey, attendanceId)

      // Remove from local state
      setAttendances(prev => prev.filter(attendance => attendance.id !== attendanceId))
      setToast('Attendance deleted successfully')
    } catch (error) {
      console.error('Error deleting attendance:', error)
      alert('Failed to delete attendance. Please try again.')
    } finally {
      setDeletingAttendance(null)
    }
  }

  const handleRenameAttendance = async (attendanceId: string) => {
    if (!adminKey || !renameValue.trim()) return

    try {
      const updatedAttendance = await attendanceApi.rename(adminKey, attendanceId, renameValue.trim())

      // Update local state
      setAttendances(prev =>
        prev.map(attendance =>
          attendance.id === attendanceId
            ? { ...attendance, title: updatedAttendance.title }
            : attendance
        )
      )
      setToast('Attendance renamed successfully')
      setRenamingAttendance(null)
      setRenameValue('')
    } catch (error) {
      console.error('Error renaming attendance:', error)
      alert('Failed to rename attendance. Please try again.')
    }
  }

  const startRenaming = (attendanceId: string, currentTitle: string) => {
    setRenamingAttendance(attendanceId)
    setRenameValue(currentTitle)
  }

  const cancelRenaming = () => {
    setRenamingAttendance(null)
    setRenameValue('')
  }

  // Memoize ballot stats to avoid recalculating on every render
  const ballotStats = useMemo(() => {
    return new Map(ballots.map(ballot => [
      ballot.id,
      {
        green: countVotes(ballot as any, 'green'),
        yellow: countVotes(ballot as any, 'yellow'),
        red: countVotes(ballot as any, 'red')
      }
    ]))
  }, [ballots])

  // Memoize attendance stats
  const attendanceStatsMap = useMemo(() => {
    return new Map(attendances.map(attendance => [
      attendance.id,
      countAttendanceResponses(attendance)
    ]))
  }, [attendances])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500 dark:text-red-400" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            Admin access requires a valid authentication key in the URL.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact the administrator for access credentials.
          </p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500 dark:text-red-400" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Authentication Failed</h1>
          <p className="text-muted-foreground mb-4">{error || 'Invalid admin credentials'}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-6 mb-6 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-muted-foreground">Manage ballot data and system administration</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Authenticated</p>
              <p className="text-xs text-muted-foreground">{ballots.length} ballots • {dashboards.length} dashboards • {attendances.length} attendances</p>
            </div>
          </div>
        </div>

        {/* Ballots Section */}
        <h2 className="text-xl font-bold text-foreground mb-4">Ballots</h2>
        <div className="space-y-4 mb-8">
          {ballots.length === 0 ? (
            <div className="bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center border border-border">
              <p className="text-muted-foreground">No ballots found</p>
            </div>
          ) : (
            ballots.map(ballot => (
              <div key={ballot.id} className="bg-card text-card-foreground rounded-lg shadow-sm p-6 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {ballot.question}
                      </h3>
                      {ballot.isPrivate && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                          <Lock className="w-3 h-3" />
                          <span>Private</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{ballot.voteCount} votes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>{ballot.commentCount} comments</span>
                      </div>
                      <div>
                        Created {new Date(ballot.createdAt).toLocaleDateString()}
                      </div>
                      {ballot.lastVote && (
                        <div>
                          Last vote {new Date(ballot.lastVote).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Vote breakdown */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        <span>✅</span>
                        <span className="text-sm">{ballotStats.get(ballot.id)?.green ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>⚠️</span>
                        <span className="text-sm">{ballotStats.get(ballot.id)?.yellow ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>❌</span>
                        <span className="text-sm">{ballotStats.get(ballot.id)?.red ?? 0}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground font-mono">ID: {ballot.id}</p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePrivacy(ballot.id, ballot.isPrivate || false)}
                      className="flex items-center gap-1"
                      title={ballot.isPrivate ? 'Make public' : 'Make private'}
                    >
                      {ballot.isPrivate ? (
                        <>
                          <Unlock className="w-4 h-4" />
                          Make Public
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Make Private
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/${ballot.id}`, '_blank')}
                      className="text-primary"
                    >
                      View
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteBallot(ballot.id, ballot.question)}
                      disabled={deleting === ballot.id}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting === ballot.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dashboards Section */}
        <h2 className="text-xl font-bold text-foreground mb-4">Dashboards</h2>
        <div className="space-y-4 mb-8">
          {dashboards.length === 0 ? (
            <div className="bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center border border-border">
              <p className="text-muted-foreground">No dashboards found</p>
            </div>
          ) : (
            dashboards.map(dashboard => (
              <div key={dashboard.id} className="bg-card text-card-foreground rounded-lg shadow-sm p-6 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {dashboard.name}
                    </h3>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <div>
                        {dashboard.ballotIds.length} ballot{dashboard.ballotIds.length !== 1 ? 's' : ''}
                      </div>
                      <div>
                        Created {new Date(dashboard.createdAt).toLocaleDateString()}
                      </div>
                      <div>
                        Updated {new Date(dashboard.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">ID: {dashboard.id}</p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/dashboards/${dashboard.id}`, '_blank')}
                      className="text-primary"
                    >
                      View
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDashboard(dashboard.id, dashboard.name)}
                      disabled={deletingDashboard === dashboard.id}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingDashboard === dashboard.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Attendances Section */}
        <h2 className="text-xl font-bold text-foreground mb-4">Attendances</h2>
        <div className="space-y-4 mb-8">
          {attendances.length === 0 ? (
            <div className="bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center border border-border">
              <p className="text-muted-foreground">No attendances found</p>
            </div>
          ) : (
            attendances.map(attendance => {
              const counts = attendanceStatsMap.get(attendance.id)!
              const isRenaming = renamingAttendance === attendance.id
              return (
                <div key={attendance.id} className="bg-card text-card-foreground rounded-lg shadow-sm p-6 border border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      {isRenaming ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-grow px-3 py-1.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameAttendance(attendance.id)
                              if (e.key === 'Escape') cancelRenaming()
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleRenameAttendance(attendance.id)}
                            disabled={!renameValue.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelRenaming}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {attendance.title}
                        </h3>
                      )}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(attendance.date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{counts.total} response{counts.total !== 1 ? 's' : ''}</span>
                        </div>
                        <div>
                          Created {new Date(attendance.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Response breakdown */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✓</span>
                          <span className="text-sm">{counts.yes} attending</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-red-600">✗</span>
                          <span className="text-sm">{counts.no} not attending</span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground font-mono">ID: {attendance.id}</p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {!isRenaming && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startRenaming(attendance.id, attendance.title)}
                          className="flex items-center gap-1"
                          title="Rename attendance"
                        >
                          <Pencil className="w-4 h-4" />
                          Rename
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/attendance/${attendance.id}`, '_blank')}
                        className="text-primary"
                      >
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAttendance(attendance.id, attendance.title)}
                        disabled={deletingAttendance === attendance.id}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingAttendance === attendance.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>⚠️ This is a secure admin interface. All actions are logged.</p>
        </div>
      </div>
    </div>
  )
}
