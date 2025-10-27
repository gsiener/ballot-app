import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from "./ui/button"
import { Trash2, AlertTriangle, Shield, Eye, MessageSquare, Lock, Unlock } from 'lucide-react'

const API_URL = 'https://ballot-app-server.siener.workers.dev/api'

type AdminBallot = {
  id: string
  question: string
  votes: Array<{
    color: 'green' | 'yellow' | 'red'
    comment?: string
    createdAt: string
  }>
  createdAt: string
  voteCount: number
  commentCount: number
  lastVote: string | null
  isPrivate?: boolean
}

export function AdminPanel() {
  const [searchParams] = useSearchParams()
  const [ballots, setBallots] = useState<AdminBallot[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const adminKey = searchParams.get('key')

  useEffect(() => {
    if (!adminKey) {
      setLoading(false)
      return
    }

    fetchAdminBallots()
  }, [adminKey])

  useEffect(() => {
    document.title = 'Ballot Admin'
  }, [])

  const fetchAdminBallots = async () => {
    if (!adminKey) return
    
    try {
      const response = await fetch(`${API_URL}/admin/ballots`, {
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (response.status === 401) {
        setAuthenticated(false)
        setError('Invalid admin key')
        return
      }
      
      if (!response.ok) throw new Error('Failed to fetch admin data')
      
      const data = await response.json()
      setBallots(data)
      setAuthenticated(true)
      setError(null)
    } catch (error) {
      console.error('Error fetching admin ballots:', error)
      setError('Failed to load admin data')
      setAuthenticated(false)
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
      const response = await fetch(`${API_URL}/admin/ballots/${ballotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to delete ballot')

      // Remove from local state
      setBallots(prev => prev.filter(ballot => ballot.id !== ballotId))

      // Show success message briefly
      const deletedMessage = document.createElement('div')
      deletedMessage.textContent = 'Ballot deleted successfully'
      deletedMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50'
      document.body.appendChild(deletedMessage)
      setTimeout(() => document.body.removeChild(deletedMessage), 3000)

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
      const response = await fetch(`${API_URL}/admin/ballots/${ballotId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPrivate: !currentPrivacy }),
      })

      if (!response.ok) throw new Error('Failed to update privacy')

      const updatedBallot = await response.json()

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

  const countVotesByColor = (ballot: AdminBallot, color: 'green' | 'yellow' | 'red') => {
    return ballot.votes.filter(vote => vote.color === color).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            Admin access requires a valid authentication key in the URL.
          </p>
          <p className="text-sm text-gray-500">
            Contact the administrator for access credentials.
          </p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error || 'Invalid admin credentials'}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-gray-600">Manage ballot data and system administration</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600 font-medium">✓ Authenticated</p>
              <p className="text-xs text-gray-500">{ballots.length} ballots total</p>
            </div>
          </div>
        </div>

        {/* Ballots List */}
        <div className="space-y-4">
          {ballots.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">No ballots found</p>
            </div>
          ) : (
            ballots.map(ballot => (
              <div key={ballot.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ballot.question}
                      </h3>
                      {ballot.isPrivate && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          <Lock className="w-3 h-3" />
                          <span>Private</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
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
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">{countVotesByColor(ballot, 'green')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm">{countVotesByColor(ballot, 'yellow')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">{countVotesByColor(ballot, 'red')}</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 font-mono">ID: {ballot.id}</p>
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
                      className="text-blue-600 hover:text-blue-700"
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

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>⚠️ This is a secure admin interface. All actions are logged.</p>
        </div>
      </div>
    </div>
  )
}